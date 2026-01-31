import { useEffect, useState, useCallback } from 'react';
import type { Peer, DataConnection } from 'peerjs';
import { useMapStore } from '@/store/mapStore';
import {
    P2PPacket, RequestOpPayload, SyncFullPayload, SyncPinsPayload,
    PermissionGrantedPayload, GuestInfo, CursorData, SyncLinesPayload,
    PermissionDeniedPayload, SyncSettingsPayload
} from '@/types/p2p';
import { toast } from 'sonner';
import { throttle } from 'lodash';

// --- Singleton / Global State ---
// This ensures connection state survives React component unmounts/remounts
let globalPeer: Peer | null = null;
let globalConnections: DataConnection[] = [];
let globalActiveHostConnection: DataConnection | null = null;
let globalPermissionTimers: Record<string, NodeJS.Timeout> = {};

export const usePeer = () => {
    // UI State (synced from global state)
    const [peerId, setPeerId] = useState<string | null>(globalPeer?.id || null);
    const [connectionState, setConnectionState] = useState<'DISCONNECTED' | 'Connecting...' | 'Connected' | 'Error'>('DISCONNECTED');
    const [connectedGuests, setConnectedGuests] = useState<number>(globalConnections.length);
    const [guestList, setGuestList] = useState<GuestInfo[]>([]);

    const {
        importData, addPin, updatePin, removePin, addLine, undoLine, updateCursor, setLines,
        setRole, role, setSendRequest, setSendCursor,
        setPermissionStatus, setPermissionExpiresAt, hostSettings
    } = useMapStore();

    // --- Helpers using Globals ---

    const updateGuestList = useCallback(() => {
        const list: GuestInfo[] = globalConnections.map(conn => ({
            id: conn.peer,
            label: `Guest ${conn.peer.substring(0, 4)}`,
            hasPermission: !!globalPermissionTimers[conn.peer],
            permissionExpiresAt: undefined
        }));
        setGuestList(list);
    }, []); // No dependencies needed as it checks globals

    const handleDataPacket = (packet: P2PPacket, conn: DataConnection) => {
        if (packet.type !== 'CURSOR_MOVE') {
            // console.debug('Received Packet:', packet.type);
        }

        switch (packet.type) {
            case 'SYNC_FULL': {
                const payload = packet.payload as SyncFullPayload;
                importData({
                    image: payload.image,
                    imageSize: payload.imageSize,
                    pins: payload.pins,
                    lines: [],
                    hostSettings: payload.hostSettings
                });
                break;
            }
            case 'SYNC_PINS': {
                const payload = packet.payload as SyncPinsPayload;
                importData({
                    image: useMapStore.getState().image,
                    imageSize: useMapStore.getState().imageSize,
                    pins: payload.pins,
                    lines: useMapStore.getState().lines,
                    hostSettings: useMapStore.getState().hostSettings
                }, false);
                break;
            }
            case 'SYNC_LINES': {
                const payload = packet.payload as SyncLinesPayload;
                setLines(payload.lines);
                break;
            }
            case 'SYNC_SETTINGS': {
                const payload = packet.payload as SyncSettingsPayload;
                useMapStore.getState().setHostSettings(payload.hostSettings);
                break;
            }
            case 'REQUEST_OP': {
                const payload = packet.payload as RequestOpPayload;

                // HOST Logic: Apply the operation requested by Guest
                // (Assuming Host trust for MVP, or we can check permission here)

                if (payload.action === 'ADD_PIN' && payload.pin) addPin(payload.pin, true);
                if (payload.action === 'UPDATE_PIN' && payload.pin) updatePin(payload.pin.id, payload.pin, true);
                if (payload.action === 'DELETE_PIN' && payload.pinId) removePin(payload.pinId, true);
                if (payload.action === 'ADD_LINE' && payload.line) addLine(payload.line, true);
                if (payload.action === 'UNDO_LINE') undoLine(true);
                break;
            }
            case 'REQUEST_PERMISSION': {
                toast.custom((t) => (
                    <div className="flex flex-col gap-2 bg-white p-4 roundedshadow-lg border border-gray-200">
                        <span className="font-bold">編集リクエスト</span>
                        <span className="text-sm">Guest ({conn.peer.substring(0, 4)}...) が編集権限を求めています。</span>
                        <div className="flex gap-2 mt-1">
                            <button
                                onClick={() => {
                                    grantPermission(conn);
                                    toast.dismiss(t);
                                }}
                                className="bg-green-500 text-white px-3 py-1 rounded text-xs hover:bg-green-600"
                            >
                                許可 ({useMapStore.getState().hostSettings.permissionDuration}s)
                            </button>
                            <button
                                onClick={() => {
                                    denyPermission(conn);
                                    toast.dismiss(t);
                                }}
                                className="bg-gray-400 text-white px-3 py-1 rounded text-xs hover:bg-gray-500"
                            >
                                拒否
                            </button>
                        </div>
                    </div>
                ), { duration: 10000, position: 'top-right' });
                break;
            }
            case 'PERMISSION_GRANTED': {
                const payload = packet.payload as PermissionGrantedPayload;
                setPermissionStatus('GRANTED');
                setPermissionExpiresAt(payload.expiresAt);
                toast.success('編集権限が付与されました！');
                break;
            }
            case 'PERMISSION_REVOKED': {
                setPermissionStatus('NONE');
                setPermissionExpiresAt(null);
                toast.info('編集権限が終了しました');
                break;
            }
            case 'PERMISSION_DENIED': {
                const payload = packet.payload as PermissionDeniedPayload;
                setPermissionStatus('COOLDOWN');
                const cooldownEnd = Date.now() + payload.cooldown * 1000;
                setPermissionExpiresAt(cooldownEnd);
                toast.error(`リクエストが拒否されました。${payload.cooldown}秒後に再申請可能です。`);
                break;
            }
            case 'CURSOR_MOVE': {
                const cursor = packet.payload as CursorData;
                updateCursor(cursor);
                break;
            }
        }
    };

    const handleIncomingConnection = (conn: DataConnection) => {
        if (!globalConnections.includes(conn)) {
            globalConnections.push(conn);

            // Auto-Assign Host Role if not already set
            if (useMapStore.getState().role !== 'HOST') {
                setRole('HOST');
            }
        }
        setConnectedGuests(globalConnections.length); // Update UI
        updateGuestList();

        conn.on('open', () => {
            // Initial Sync
            const state = useMapStore.getState();
            const fullSync: P2PPacket = {
                type: 'SYNC_FULL',
                payload: {
                    image: state.image,
                    imageSize: state.imageSize,
                    pins: state.pins,
                    hostSettings: state.hostSettings
                }
            };
            conn.send(fullSync);

            const lines = state.lines;
            const lineSync: P2PPacket = {
                type: 'SYNC_LINES',
                payload: { lines }
            };
            conn.send(lineSync);
        });

        conn.on('data', (data) => {
            handleDataPacket(data as P2PPacket, conn);
        });

        conn.on('close', () => {
            console.log('Guest disconnected:', conn.peer);
            globalConnections = globalConnections.filter(c => c !== conn);
            setConnectedGuests(globalConnections.length);

            if (globalPermissionTimers[conn.peer]) {
                clearTimeout(globalPermissionTimers[conn.peer]);
                delete globalPermissionTimers[conn.peer];
            }
            updateGuestList();
        });
    };

    // --- Peer Initialization ---
    const initializePeer = useCallback(() => {
        if (globalPeer) {
            setPeerId(globalPeer.id);
            setConnectedGuests(globalConnections.length);
            updateGuestList();
            return;
        }

        import('peerjs').then(({ default: Peer }) => {
            const peer = new Peer();
            globalPeer = peer;

            peer.on('open', (id) => {
                console.log('My Peer ID:', id);
                setPeerId(id);
            });

            peer.on('connection', (conn) => {
                handleIncomingConnection(conn);
            });

            peer.on('error', (err) => {
                console.error('Peer error:', err);
                setConnectionState('Error');
            });
        });
    }, [updateGuestList]);

    // --- Actions using Globals ---

    const grantPermission = (conn: DataConnection) => {
        const durationSec = useMapStore.getState().hostSettings.permissionDuration;
        const expiresAt = Date.now() + durationSec * 1000;
        const payload: PermissionGrantedPayload = { expiresAt };
        const packet: P2PPacket = { type: 'PERMISSION_GRANTED', payload };
        conn.send(packet);
        toast.success(`Guest ${conn.peer.substring(0, 4)}... に編集権限を付与しました (${durationSec}秒)`);

        if (globalPermissionTimers[conn.peer]) {
            clearTimeout(globalPermissionTimers[conn.peer]);
        }
        globalPermissionTimers[conn.peer] = setTimeout(() => {
            revokePermissionInternal(conn);
        }, durationSec * 1000);

        updateGuestList();
    };

    const denyPermission = (conn: DataConnection) => {
        const cooldown = useMapStore.getState().hostSettings.reapplyCooldown;
        const payload: PermissionDeniedPayload = { cooldown };
        const packet: P2PPacket = { type: 'PERMISSION_DENIED', payload };
        conn.send(packet);
    };

    const revokePermissionInternal = (conn: DataConnection) => {
        const packet: P2PPacket = { type: 'PERMISSION_REVOKED' };
        conn.send(packet);
        if (globalPermissionTimers[conn.peer]) {
            clearTimeout(globalPermissionTimers[conn.peer]);
            delete globalPermissionTimers[conn.peer];
        }
        updateGuestList();
    };

    const revokePermission = (guestPeerId: string) => {
        const conn = globalConnections.find(c => c.peer === guestPeerId);
        if (conn) {
            revokePermissionInternal(conn);
            toast.info(`Guest ${guestPeerId.substring(0, 4)}... の権限を剥奪しました`);
        }
    };

    const connectToHost = useCallback((hostId: string) => {
        if (!globalPeer) return;

        setConnectionState('Connecting...');

        const conn = globalPeer.connect(hostId);
        globalConnections = [conn]; // Guest only has 1 relevant connection usually

        conn.on('open', () => {
            console.log('Connected to Host:', hostId);
            setConnectionState('Connected');

            globalActiveHostConnection = conn;
            // Ensure unique in list if needed, but guest usually relies on activeHostConnection
            if (!globalConnections.includes(conn)) {
                globalConnections.push(conn);
            }
            setRole('GUEST');
        });

        conn.on('data', (data) => {
            handleDataPacket(data as P2PPacket, conn);
        });

        conn.on('close', () => {
            console.log('Disconnected from Host');
            setConnectionState('DISCONNECTED');
            setRole('NONE');
            setPermissionStatus('NONE');
            setPermissionExpiresAt(null);

            globalActiveHostConnection = null;
            globalConnections = [];
        });

        conn.on('error', (err) => {
            console.error('Connection error:', err);
            setConnectionState('Error');
            globalActiveHostConnection = null;
            globalConnections = [];
        });

    }, [setRole, setPermissionStatus, setPermissionExpiresAt]);

    const requestAction = useCallback((action: 'ADD_PIN' | 'UPDATE_PIN' | 'DELETE_PIN' | 'REQUEST_PERMISSION' | 'ADD_LINE' | 'UNDO_LINE', data?: any) => {
        const { role } = useMapStore.getState();

        // 1. Create Packet (Common)
        let packet: P2PPacket;

        if (action === 'REQUEST_PERMISSION') {
            useMapStore.getState().setPermissionStatus('REQUESTING');
            packet = { type: 'REQUEST_PERMISSION' };

            setTimeout(() => {
                const currentStatus = useMapStore.getState().permissionStatus;
                if (currentStatus === 'REQUESTING') {
                    useMapStore.getState().setPermissionStatus('NONE');
                    toast.error('ホストからの応答がありませんでした');
                }
            }, 15000);
        } else {
            let payload: RequestOpPayload = { action: action as any };

            if (action === 'DELETE_PIN') payload.pinId = data;
            else if (action === 'ADD_PIN' || action === 'UPDATE_PIN') payload.pin = data;
            else if (action === 'ADD_LINE') payload.line = data;
            else if (action === 'UNDO_LINE') { /* no data */ }

            packet = { type: 'REQUEST_OP', payload };
        }

        if (role === 'HOST') {
            if (action !== 'REQUEST_PERMISSION') {
                // Broadcast using globalConnections
                globalConnections.forEach(c => {
                    if (c.open) c.send(packet);
                });
            }
        } else {
            // Guest: Send to Host
            let conn = globalActiveHostConnection;
            if (!conn || !conn.open) {
                const fallback = globalConnections.find(c => c.open);
                if (fallback) conn = fallback;
            }

            if (conn && conn.open) {
                conn.send(packet);
            } else {
                console.error('No valid connection to host to send request.');
                toast.error('ホストとの接続が切れています。リロードしてください。');
            }
        }
    }, [setPermissionStatus]);

    const sendCursor = useCallback(
        throttle((cursor: CursorData) => {
            const myId = globalPeer?.id;
            if (!myId) return;

            // Use Global Connection
            const conn = globalActiveHostConnection || globalConnections[0];
            if (conn && conn.open) {
                const payload = { ...cursor, userId: myId };
                const packet: P2PPacket = { type: 'CURSOR_MOVE', payload };
                conn.send(packet);
            }
        }, 50),
        []
    );

    const broadcastCursor = useCallback((cursor: CursorData) => {
        globalConnections.forEach(conn => {
            if (conn.open) {
                const packet: P2PPacket = { type: 'CURSOR_MOVE', payload: cursor };
                conn.send(packet);
            }
        });
    }, []);

    // --- Sync Hooks (Host Broadcast) ---
    // These need to watch store changes and broadcast using globals
    // We can't rely on 'global' vars as deps, so checking them inside effect is fine.

    // Register Dep Injection
    useEffect(() => {
        setSendRequest(requestAction);
        setSendCursor(sendCursor);
    }, [setSendRequest, requestAction, setSendCursor, sendCursor]);

    // Sync Settings
    useEffect(() => {
        if (useMapStore.getState().role !== 'HOST') return;

        const packet: P2PPacket = {
            type: 'SYNC_SETTINGS',
            payload: { hostSettings }
        };

        globalConnections.forEach(conn => {
            if (conn.open) conn.send(packet);
        });
    }, [hostSettings]); // Removed role dep to avoid re-run on role change glitch, but safest to check role inside

    // Sync Image (Added Phase 32)
    const { image: currentImage, imageSize: currentImageSize } = useMapStore();
    useEffect(() => {
        if (useMapStore.getState().role !== 'HOST') return;

        // Debounce or just send? Image change is rare.
        // Construct SYNC_FULL or just SYNC image? SYNC_FULL is easiest for now.
        // But SYNC_FULL currently resets Pins/Lines in importData logic if valid.
        // Actually Phase 32 plan says: SYNC_FULL with current state.

        const state = useMapStore.getState();
        const packet: P2PPacket = {
            type: 'SYNC_FULL',
            payload: {
                image: state.image,
                imageSize: state.imageSize,
                pins: state.pins,
                hostSettings: state.hostSettings
            }
        };

        globalConnections.forEach(conn => {
            if (conn.open) conn.send(packet);
        });
    }, [currentImage, currentImageSize]);

    // Sync Pins
    const { pins: currentPins } = useMapStore();
    useEffect(() => {
        if (useMapStore.getState().role !== 'HOST') return;

        const packet: P2PPacket = { type: 'SYNC_PINS', payload: { pins: currentPins } };
        globalConnections.forEach(conn => {
            if (conn.open) conn.send(packet);
        });
    }, [currentPins]);

    // Sync Lines
    const { lines: currentLines } = useMapStore();
    useEffect(() => {
        if (useMapStore.getState().role !== 'HOST') return;

        const packet: P2PPacket = { type: 'SYNC_LINES', payload: { lines: currentLines } };
        globalConnections.forEach(conn => {
            if (conn.open) conn.send(packet);
        });
    }, [currentLines]);


    // Setup UI Sync on Mount
    useEffect(() => {
        if (globalPeer?.id) setPeerId(globalPeer.id);
        if (globalConnections.length > 0) setConnectedGuests(globalConnections.length);
        if (globalActiveHostConnection?.open) setConnectionState('Connected');
        updateGuestList();
    }, [updateGuestList]);

    return {
        initializePeer,
        connectToHost,
        peerId,
        requestAction,
        connectionState,
        connectedGuests,
        revokePermission,
        guestList,
        broadcastCursor,
        sendCursor
    };
};
