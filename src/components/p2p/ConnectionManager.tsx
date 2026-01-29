'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Settings } from 'lucide-react';
import { useMapStore } from '@/store/mapStore';
import { Copy, Users, Link, ShieldAlert, ShieldCheck, ChevronUp, ChevronDown, X } from 'lucide-react';
import { GuestInfo } from '@/types/p2p';
import { HelpGuide } from '@/components/ui/HelpGuide'; // Added

interface ConnectionManagerProps {
    peerId: string | null;
    connectionState: 'DISCONNECTED' | 'Connecting...' | 'Connected' | 'Error';
    connectedGuests: number;
    guestList?: GuestInfo[];
    initializePeer: () => void;
    connectToHost: (id: string) => void;
    revokePermission?: (id: string) => void;
}

export const ConnectionManager: React.FC<ConnectionManagerProps> = ({
    peerId,
    connectionState,
    connectedGuests,
    guestList = [],
    initializePeer,
    connectToHost,
    revokePermission
}) => {
    const [hostIdInput, setHostIdInput] = useState('');
    const [mode, setMode] = useState<'NONE' | 'HOST' | 'GUEST'>('NONE');
    const [isCollapsed, setIsCollapsed] = useState(false);

    const handleStartHost = () => {
        setMode('HOST');
        initializePeer();
    };

    const handleJoinGuest = () => {
        setMode('GUEST');
        initializePeer();
    };

    const handleConnect = () => {
        if (hostIdInput.trim()) {
            connectToHost(hostIdInput.trim());
        }
    };

    const copyToClipboard = () => {
        if (peerId) {
            navigator.clipboard.writeText(peerId);
            alert('IDをコピーしました');
        }
    };

    const handleBack = () => {
        if (typeof window !== 'undefined') {
            if (connectionState === 'Connected' || mode === 'HOST') {
                const msg = mode === 'HOST' ? '部屋を閉じますか？' : '切断して退出しますか？';
                if (!window.confirm(msg)) return;
            }
            window.location.reload();
            return;
        }
        setMode('NONE');
        setHostIdInput('');
    };

    if (mode === 'NONE') {
        return (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 flex gap-2">
                <HelpGuide /> {/* Added Help Guide */}
                <div className="flex gap-2 items-center">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="secondary" size="icon" className="shadow-md" title="ホスト設定">
                                <Settings className="h-4 w-4" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80">
                            <div className="grid gap-4">
                                <div className="space-y-2">
                                    <h4 className="font-medium leading-none">ホスト設定</h4>
                                    <p className="text-sm text-muted-foreground">
                                        部屋の権限ルールを設定します。
                                    </p>
                                </div>
                                <div className="grid gap-2">
                                    <div className="grid grid-cols-3 items-center gap-4">
                                        <Label htmlFor="duration">権限時間</Label>
                                        <Input
                                            id="duration"
                                            type="number"
                                            className="col-span-2 h-8"
                                            defaultValue={useMapStore.getState().hostSettings.permissionDuration}
                                            onChange={(e) => useMapStore.getState().setHostSettings({ permissionDuration: Number(e.target.value) })}
                                        />
                                    </div>
                                    <div className="grid grid-cols-3 items-center gap-4">
                                        <Label htmlFor="cooldown">再申請待機</Label>
                                        <Input
                                            id="cooldown"
                                            type="number"
                                            className="col-span-2 h-8"
                                            defaultValue={useMapStore.getState().hostSettings.reapplyCooldown}
                                            onChange={(e) => {
                                                const val = Number(e.target.value);
                                                useMapStore.getState().setHostSettings({ reapplyCooldown: Math.max(5, val) });
                                            }}
                                            min={5}
                                        />
                                    </div>
                                </div>
                                {/* Advanced Settings */}

                                <div className="flex items-center justify-between space-x-2 pt-2 border-t">
                                    <Label htmlFor="free-mode" className="flex flex-col space-y-1">
                                        <span>フリー編集モード</span>
                                        <span className="font-normal text-xs text-muted-foreground">全員に編集権限を付与 (申請不要)</span>
                                    </Label>
                                    <input
                                        type="checkbox"
                                        id="free-mode"
                                        className="h-4 w-4"
                                        checked={useMapStore.getState().hostSettings.guestEditMode === 'FREE'}
                                        onChange={(e) => useMapStore.getState().setHostSettings({ guestEditMode: e.target.checked ? 'FREE' : 'REQUEST' })}
                                    />
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>

                    <Button onClick={handleStartHost} variant="secondary" className="shadow-md">
                        <Users className="mr-2 h-4 w-4" />
                        部屋を作成 (Host)
                    </Button>
                </div>
                <Button onClick={handleJoinGuest} variant="secondary" className="shadow-md">
                    <Link className="mr-2 h-4 w-4" />
                    部屋に参加 (Guest)
                </Button>
            </div >
        );
    }

    // HOST UI
    if (mode === 'HOST') {
        return (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 flex flex-col items-center gap-2 bg-white/90 p-4 rounded-lg shadow-lg backdrop-blur-sm max-w-sm transition-all duration-300">
                <div className="flex items-center justify-between w-full h-6">
                    <h3 className="font-bold text-gray-800 text-sm">Host Session</h3>
                    <div className="flex gap-1">
                        <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => setIsCollapsed(!isCollapsed)}
                            title="折りたたみ切替"
                        >
                            {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                        </Button>
                        <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-gray-400 hover:text-red-500"
                            onClick={handleBack}
                            title="部屋を閉じて戻る"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {!isCollapsed && (
                    <>
                        <div className="flex flex-col gap-1 w-full mt-2">
                            <Label className="text-xs text-gray-500">My Peer ID</Label>
                            <div className="flex gap-2">
                                <Input readOnly value={peerId || 'Generating...'} className="h-8 font-mono text-xs" />
                                <Button size="icon" variant="outline" className="h-8 w-8" onClick={copyToClipboard} disabled={!peerId}>
                                    <Copy className="h-3 w-3" />
                                </Button>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 text-sm text-gray-600 mt-2 self-start w-full border-b pb-1 mb-1">
                            <Users className="h-4 w-4" />
                            <span>Guests: {connectedGuests}</span>
                        </div>

                        {/* Guest List */}
                        <div className="w-full flex flex-col gap-1 max-h-32 overflow-y-auto">
                            {guestList.map(guest => (
                                <div key={guest.id} className="flex items-center justify-between text-xs bg-gray-50 p-1.5 rounded">
                                    <div className="flex items-center gap-1">
                                        <div className={`w-2 h-2 rounded-full ${guest.hasPermission ? 'bg-green-500' : 'bg-gray-400'}`} />
                                        <span className="font-mono">{guest.label}</span>
                                    </div>
                                    {guest.hasPermission && revokePermission && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-5 w-5 text-red-500 hover:text-red-700 hover:bg-red-50"
                                            onClick={() => revokePermission(guest.id)}
                                            title="権限剥奪"
                                        >
                                            <ShieldAlert className="h-3 w-3" />
                                        </Button>
                                    )}
                                </div>
                            ))}
                            {guestList.length === 0 && <span className="text-xs text-center text-gray-400">No guests connected</span>}
                        </div>
                    </>
                )}
            </div>
        );
    }

    // GUEST UI
    if (mode === 'GUEST') {
        return (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 flex flex-col items-center gap-2 bg-white/90 p-4 rounded-lg shadow-lg backdrop-blur-sm max-w-sm">
                <div className="flex items-center justify-between w-full">
                    <h3 className="font-bold text-gray-800">Join Session</h3>
                    <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 text-gray-400 hover:text-red-500"
                        onClick={handleBack}
                        title="戻る"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>
                {connectionState === 'Connected' ? (
                    <div className="text-green-600 font-bold flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4" />
                        Connected to Host
                    </div>
                ) : (
                    <>
                        <div className="flex flex-col gap-1 w-full">
                            <Label className="text-xs text-gray-500">Host ID</Label>
                            <Input
                                value={hostIdInput}
                                onChange={(e) => setHostIdInput(e.target.value)}
                                placeholder="Enter Host ID"
                                className="h-8"
                            />
                        </div>
                        <Button onClick={handleConnect} disabled={!peerId || connectionState === 'Connecting...'} className="w-full h-8 text-sm mt-2">
                            {connectionState === 'Connecting...' ? 'Connecting...' : 'Connect'}
                        </Button>
                        {!peerId && <p className="text-xs text-gray-400">Initializing Client...</p>}
                    </>
                )}
            </div>
        );
    }

    return null;
};
