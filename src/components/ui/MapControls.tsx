'use client';

import React, { useRef, useState, useEffect } from 'react';
import { useMapStore } from '@/store/mapStore';
import { Button } from '@/components/ui/button';
import { Download, Upload, Trash2, Lock, Unlock, Timer, Pen, MousePointer2, Undo, Image as ImageIcon, Minus, Plus, Maximize } from 'lucide-react';
import { Loader2 } from 'lucide-react';

export const MapControls = () => {
    const {
        image, imageSize, pins, importData, clearMap, role, permissionStatus, permissionExpiresAt, sendRequest,
        toolMode, setToolMode, penColor, setPenConfig, penWidth, undoLine,
        pinScale, setPinScale, triggerImageExport, fitToScreen
    } = useMapStore();

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [timeLeft, setTimeLeft] = useState<number>(0);

    // Timer logic
    useEffect(() => {
        if (permissionStatus !== 'GRANTED' || !permissionExpiresAt) {
            setTimeLeft(0);
            return;
        }
        const interval = setInterval(() => {
            const seconds = Math.ceil((permissionExpiresAt - Date.now()) / 1000);
            if (seconds <= 0) {
                setTimeLeft(0);
                clearInterval(interval);
            } else {
                setTimeLeft(seconds);
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [permissionStatus, permissionExpiresAt]);


    const handleExportJSON = () => {
        if (!image || !imageSize) return;
        const data = {
            image,
            imageSize,
            pins,
            lines: useMapStore.getState().lines,
            version: 1,
            exportedAt: new Date().toISOString(),
        };
        const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `map-data-${new Date().getTime()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target?.result as string);
                if (json.image && json.imageSize) {
                    if (confirm('現在のマップを上書きしてインポートしますか？')) {
                        importData({
                            image: json.image,
                            imageSize: json.imageSize,
                            pins: json.pins || [],
                            lines: json.lines || []
                        });
                    }
                } else {
                    alert('無効なファイル形式です。');
                }
            } catch (error) {
                console.error('Import failed', error);
                alert('ファイルの読み込みに失敗しました。');
            }
            if (fileInputRef.current) fileInputRef.current.value = '';
        };
        reader.readAsText(file);
    };

    const handleClear = () => {
        if (confirm('マップとピンを全て削除しますか？この操作は取り消せません。')) {
            clearMap();
        }
    };

    const handleRequestPermission = () => {
        sendRequest('REQUEST_PERMISSION');
    };

    const handleFitToScreen = () => {
        if (typeof window !== 'undefined') {
            fitToScreen(window.innerWidth, window.innerHeight);
        }
    };

    const isGuest = role === 'GUEST';
    const canEdit = !isGuest || permissionStatus === 'GRANTED';

    if (!image) return null;

    return (
        <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 items-end">
            {/* Permission Controls */}
            {isGuest && (
                <div className="flex bg-white/90 p-2 rounded-lg shadow-md gap-2 backdrop-blur-sm mb-2">
                    {permissionStatus === 'GRANTED' ? (
                        <div className="flex items-center gap-2 text-green-600 font-bold px-2">
                            <Unlock className="h-4 w-4" />
                            <span>編集可能</span>
                            <div className="flex items-center gap-1 bg-green-100 px-2 py-0.5 rounded text-sm">
                                <Timer className="h-3 w-3" />
                                {timeLeft}s
                            </div>
                        </div>
                    ) : permissionStatus === 'REQUESTING' ? (
                        <Button variant="secondary" disabled className="gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            申請中...
                        </Button>
                    ) : (
                        <Button onClick={handleRequestPermission} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
                            <Lock className="h-4 w-4" />
                            編集リクエスト
                        </Button>
                    )}
                </div>
            )}

            {/* Main Controls Container */}
            <div className="flex flex-col gap-2 p-2 bg-white/90 backdrop-blur-sm rounded-lg shadow-md">

                {/* Row 1: Tools */}
                <div className="flex items-center gap-1">
                    <Button
                        variant={toolMode === 'pointer' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setToolMode('pointer')}
                        title="選択/移動モード"
                        className="flex flex-col h-auto py-1 gap-0.5 min-w-[3.5rem]"
                    >
                        <MousePointer2 className="h-4 w-4" />
                        <span className="text-[10px]">移動/ピン</span>
                    </Button>

                    <Button
                        variant={toolMode === 'pen' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setToolMode('pen')}
                        disabled={!canEdit}
                        title="ペンツール"
                        className="flex flex-col h-auto py-1 gap-0.5 min-w-[3.5rem]"
                    >
                        <Pen className="h-4 w-4" />
                        <span className="text-[10px]">ペン</span>
                    </Button>

                    {/* Fit to Screen */}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleFitToScreen}
                        title="画面に合わせる"
                        className="flex flex-col h-auto py-1 gap-0.5 min-w-[3.5rem]"
                    >
                        <Maximize className="h-4 w-4" />
                        <span className="text-[10px]">全体表示</span>
                    </Button>

                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={undoLine}
                        disabled={!canEdit}
                        title="元に戻す"
                        className="flex flex-col h-auto py-1 gap-0.5 min-w-[3.5rem]"
                    >
                        <Undo className="h-4 w-4" />
                        <span className="text-[10px]">戻す</span>
                    </Button>
                </div>

                <div className="h-px bg-gray-200 w-full" />

                {/* Row 2: Style Controls (Context Sensitive) */}
                {toolMode === 'pen' && (
                    <div className="flex flex-col gap-2 px-1">
                        <div className="flex gap-1 items-center justify-center">
                            {['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#000000', '#ffffff'].map(c => (
                                <button
                                    key={c}
                                    onClick={() => setPenConfig(c, penWidth)}
                                    className={`w-5 h-5 rounded-full border border-gray-300 ${penColor === c ? 'ring-2 ring-offset-1 ring-gray-400' : ''}`}
                                    style={{ backgroundColor: c }}
                                />
                            ))}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                            <span>太さ: {penWidth}</span>
                            <input
                                type="range"
                                min="1" max="20"
                                value={penWidth}
                                onChange={(e) => setPenConfig(penColor, parseInt(e.target.value))}
                                className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                            />
                        </div>
                    </div>
                )}

                {toolMode === 'pointer' && (
                    <div className="flex flex-col gap-2 px-1">
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                            <span>ピンサイズ: {pinScale.toFixed(1)}x</span>
                            <input
                                type="range"
                                min="0.5" max="10" step="0.5"
                                value={pinScale}
                                onChange={(e) => setPinScale(parseFloat(e.target.value))}
                                className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                            />
                        </div>
                    </div>
                )}

                <div className="h-px bg-gray-200 w-full" />

                {/* Row 3: Actions */}
                <div className="flex items-center gap-1 justify-center">
                    <Button variant="ghost" size="sm" onClick={triggerImageExport} className="flex flex-col h-auto py-1 gap-0.5 min-w-[3.5rem]" title="画像保存">
                        <ImageIcon className="h-4 w-4" />
                        <span className="text-[10px]">画像保存</span>
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleExportJSON} className="flex flex-col h-auto py-1 gap-0.5 min-w-[3.5rem]" title="JSON書き出し">
                        <Download className="h-4 w-4" />
                        <span className="text-[10px]">保存JSON</span>
                    </Button>

                    {!isGuest && (
                        <>
                            <Button variant="ghost" size="sm" onClick={handleImportClick} className="flex flex-col h-auto py-1 gap-0.5 min-w-[3.5rem]" title="JSON読み込み">
                                <Upload className="h-4 w-4" />
                                <span className="text-[10px]">読込</span>
                            </Button>

                            <Button variant="ghost" size="sm" onClick={handleClear} className="flex flex-col h-auto py-1 gap-0.5 min-w-[3.5rem] text-red-500 hover:text-red-700 hover:bg-red-50" title="全削除">
                                <Trash2 className="h-4 w-4" />
                                <span className="text-[10px]">削除</span>
                            </Button>
                        </>
                    )}

                </div>
            </div>

            <input
                type="file"
                ref={fileInputRef}
                onChange={handleImportFile}
                accept=".json"
                className="hidden"
            />
        </div>
    );
};
