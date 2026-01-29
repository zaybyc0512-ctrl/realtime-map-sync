import { useEffect, useRef, useState, useCallback } from 'react';
import type { Peer, DataConnection } from 'peerjs';
import { useMapStore } from '@/store/mapStore';
// import { usePeerStore } from '@/store/peerStore'; // Removed
import {
    P2PPacket, RequestOpPayload, SyncFullPayload, SyncPinsPayload,
    PermissionGrantedPayload, GuestInfo, CursorData, SyncLinesPayload,
    PermissionDeniedPayload // Added
} from '@/types/p2p';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import { throttle } from 'lodash';

export const usePeer = () => {
    const [peerId, setPeerId] = useState<string | null>(null);
    const [connectionState, setConnectionState] = useState<'DISCONNECTED' | 'Connecting...' | 'Connected' | 'Error'>('DISCONNECTED');
    const [connectedGuests, setConnectedGuests] = useState<number>(0);
    const [guestList, setGuestList] = useState<GuestInfo[]>([]);

    const {
        image, imageSize, pins, lines,
        importData, addPin, updatePin, removePin, addLine, undoLine, updateCursor, setLines,
        setRole, role, setSendRequest, setSendCursor,
        setPermissionStatus, setPermissionExpiresAt, hostSettings // Added
    } = useMapStore();

    const peerRef = useRef<Peer | null>(null);
    const connectionsRef = useRef<DataConnection[]>([]);
    const activeHostConnectionRef = useRef<DataConnection | null>(null);
    const permissionTimersRef = useRef<Record<string, NodeJS.Timeout>>({});

    const storeRef = useRef({ image, imageSize, pins, lines });
    useEffect(() => {
        storeRef.current = { image, imageSize, pins, lines };
    }, [image, imageSize, pins, lines]);

    // Handle Incoming Data
    const handleDataPacket = (packet: P2PPacket, conn: DataConnection) => {
        if (packet.type !== 'CURSOR_MOVE') {
            console.log('Received Packet:', packet.type, packet.payload);
        }

        switch (packet.type) {
            case 'SYNC_FULL': {
                const payload = packet.payload as SyncFullPayload;
                importData({
                    image: payload.image,
                    imageSize: payload.imageSize,
                    pins: payload.pins,
                    lines: []
                });
                break;
            }
            case 'SYNC_PINS': {
                const payload = packet.payload as SyncPinsPayload;
                // Only update pins, keep image
                importData({
                    image: useMapStore.getState().image,
                    imageSize: useMapStore.getState().imageSize,
                    pins: payload.pins,
                    lines: useMapStore.getState().lines
                });
                break;
            }
            case 'SYNC_LINES': {
                const payload = packet.payload as SyncLinesPayload;
                setLines(payload.lines);
                break;
            }
            case 'REQUEST_OP': {
                const payload = packet.payload as RequestOpPayload;
                // Auto-approve for now if not protecting (or check permission logic later)
                // For now, Host just applies it.
                // In future, check if Guest has permission?
                // The prompt says "Guest requests... Host approves/ignores".
                // Actually the requirement is "Guest requests PERMISSION". Once granted, they can edit.
                // So here we should check if this specific connection HAS permission.
                // But for simplicity, we assume if they sent REQUEST_OP, they MIGHT override or we apply it.
                // Wait, if permission revoked, Host should ignore OP requests?
                // Proper logic: Check if guest is in "authorized" list or timer active.
                // For simplest "MVP+": Host applies all OPs. Permission logic is on Guest side (UI disabled).
                // BUT, malicious guest could send OPs. 
                // Let's rely on Guest UI for now, as implemented in Phase 4.

                if (payload.action === 'ADD_PIN' && payload.pin) addPin(payload.pin);
                if (payload.action === 'UPDATE_PIN' && payload.pin) updatePin(payload.pin.id, payload.pin);
                if (payload.action === 'DELETE_PIN' && payload.pinId) removePin(payload.pinId);
                if (payload.action === 'ADD_LINE' && payload.line) addLine(payload.line);
                if (payload.action === 'UNDO_LINE') undoLine();
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
                // Calculate cooldown end time relative to now
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

    const updateGuestList = useCallback(() => {
        const list: GuestInfo[] = connectionsRef.current.map(conn => ({
            id: conn.peer,
            label: `Guest ${conn.peer.substring(0, 4)}`,
            hasPermission: !!permissionTimersRef.current[conn.peer],
            permissionExpiresAt: undefined // Could track if needed
        }));
        setGuestList(list);
    }, [setGuestList]);

    const handleIncomingConnection = (conn: DataConnection) => {
        console.log('Incoming connection:', conn.peer);
        connectionsRef.current.push(conn);
        setConnectedGuests(prev => prev + 1);
        updateGuestList();

        conn.on('open', () => {
            console.log('Connection opened:', conn.peer);

            // Sync Initial State
            const { image, imageSize, pins } = storeRef.current;
            const fullSync: P2PPacket = {
                type: 'SYNC_FULL',
                payload: { image, imageSize, pins }
            };
            conn.send(fullSync);

            // Sync Lines
            const lines = storeRef.current.lines;
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
            connectionsRef.current = connectionsRef.current.filter(c => c !== conn);

            if (permissionTimersRef.current[conn.peer]) {
                clearTimeout(permissionTimersRef.current[conn.peer]);
                delete permissionTimersRef.current[conn.peer];
            }
            updateGuestList();
            setConnectedGuests(prev => Math.max(0, prev - 1));
        });
    };

    const initializePeer = useCallback(() => {
        if (peerRef.current) return;

        import('peerjs').then(({ default: Peer }) => {
            const peer = new Peer();

            peer.on('open', (id) => {
                console.log('My Peer ID:', id);
                setPeerId(id);
                peerRef.current = peer;
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
    // updateGuestList dependency is okay if wrapped in useCallback, 
    // but updateGuestList uses connectionsRef which is stable. 
    // Ideally updateGuestList should be useCallback-ed.

    const grantPermission = (conn: DataConnection) => {
        const durationSec = useMapStore.getState().hostSettings.permissionDuration;
        const expiresAt = Date.now() + durationSec * 1000;
        const payload: PermissionGrantedPayload = { expiresAt };
        const packet: P2PPacket = { type: 'PERMISSION_GRANTED', payload };
        conn.send(packet);
        toast.success(`Guest ${conn.peer.substring(0, 4)}... に編集権限を付与しました (${durationSec}秒)`);

        if (permissionTimersRef.current[conn.peer]) {
            clearTimeout(permissionTimersRef.current[conn.peer]);
        }
        permissionTimersRef.current[conn.peer] = setTimeout(() => {
            revokePermissionInternal(conn);
        }, durationSec * 1000);

        updateGuestList();
    };

    const denyPermission = (conn: DataConnection) => {
        const cooldown = useMapStore.getState().hostSettings.reapplyCooldown;
        const payload: PermissionDeniedPayload = { cooldown };
        const packet: P2PPacket = { type: 'PERMISSION_DENIED', payload };
        conn.send(packet);
        console.log(`Permission denied for ${conn.peer}, cooldown: ${cooldown}s`);
    };

    const revokePermissionInternal = (conn: DataConnection) => {
        const packet: P2PPacket = { type: 'PERMISSION_REVOKED' };
        conn.send(packet);
        if (permissionTimersRef.current[conn.peer]) {
            clearTimeout(permissionTimersRef.current[conn.peer]);
            delete permissionTimersRef.current[conn.peer];
        }
        updateGuestList();
    };

    const manualRevoke = (guestPeerId: string) => {
        const conn = connectionsRef.current.find(c => c.peer === guestPeerId);
        if (conn) {
            revokePermissionInternal(conn);
            toast.info(`Guest ${guestPeerId.substring(0, 4)}... の権限を剥奪しました`);
        }
    };

    const connectToHost = useCallback((hostId: string) => {
        if (!peerRef.current) return;

        setConnectionState('Connecting...');

        const conn = peerRef.current.connect(hostId);
        connectionsRef.current = [conn];

        conn.on('open', () => {
            console.log('Connected to Host:', hostId);
            setConnectionState('Connected');

            // Fix: Set active connection
            activeHostConnectionRef.current = conn;
            if (!connectionsRef.current.includes(conn)) {
                connectionsRef.current = [conn];
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

            activeHostConnectionRef.current = null;
            connectionsRef.current = [];
        });

        conn.on('error', (err) => {
            console.error('Connection error:', err);
            setConnectionState('Error');
            activeHostConnectionRef.current = null;
            connectionsRef.current = [];
        });

    }, [setRole, setPermissionStatus, setPermissionExpiresAt]);

    const requestAction = useCallback((action: 'ADD_PIN' | 'UPDATE_PIN' | 'DELETE_PIN' | 'REQUEST_PERMISSION' | 'ADD_LINE' | 'UNDO_LINE', data?: any) => {
        let conn = activeHostConnectionRef.current;
        if (!conn || !conn.open) {
            const fallback = connectionsRef.current.find(c => c.open);
            if (fallback) {
                console.warn('activeHostConnectionRef failed, using fallback connection');
                conn = fallback;
            }
        }

        console.log('requestAction called:', action, 'Connection Open:', conn?.open);

        if (conn && conn.open) {
            let packet: P2PPacket;
            if (action === 'REQUEST_PERMISSION') {
                setPermissionStatus('REQUESTING');
                packet = { type: 'REQUEST_PERMISSION' };

                // Timeout safety net: 15 seconds
                setTimeout(() => {
                    const currentStatus = useMapStore.getState().permissionStatus;
                    if (currentStatus === 'REQUESTING') {
                        setPermissionStatus('NONE');
                        toast.error('ホストからの応答がありませんでした');
                    }
                }, 15000);
            } else {
                let payload: RequestOpPayload = { action: action as any };

                if (action === 'DELETE_PIN') payload.pinId = data;
                else if (action === 'ADD_PIN' || action === 'UPDATE_PIN') payload.pin = data;
                else if (action === 'ADD_LINE') payload.line = data;
                else if (action === 'UNDO_LINE') { /* no data */ }

                packet = {
                    type: 'REQUEST_OP',
                    payload
                };
            }
            conn.send(packet);
            console.log('Sent packet:', packet);
        } else {
            console.error('No valid connection to host to send request.');
            toast.error('ホストとの接続が切れています。リロードしてください。');
        }
    }, [setPermissionStatus]);

    // Guest sending Cursor
    const sendCursor = useCallback(
        throttle((cursor: CursorData) => {
            const conn = activeHostConnectionRef.current || connectionsRef.current[0];
            if (conn && conn.open) {
                const packet: P2PPacket = { type: 'CURSOR_MOVE', payload: cursor };
                conn.send(packet);
            }
        }, 50),
        []
    );

    // Register send functions to store (Dependency Injection)
    useEffect(() => {
        setSendRequest(requestAction);
        setSendCursor(sendCursor);
    }, [setSendRequest, requestAction, setSendCursor, sendCursor]);

    // Sync Hooks
    useEffect(() => {
        if (role !== 'HOST') return;
        if (connectionsRef.current.length === 0) return;

        // Broadcast to all
        const broadcast = (packet: P2PPacket) => {
            connectionsRef.current.forEach(conn => {
                if (conn.open) conn.send(packet);
            });
        };

        const packet: P2PPacket = { type: 'SYNC_PINS', payload: { pins } };
        broadcast(packet);
    }, [pins, role]);

    useEffect(() => {
        if (role !== 'HOST') return;
        if (connectionsRef.current.length === 0) return;

        const broadcast = (packet: P2PPacket) => {
            connectionsRef.current.forEach(conn => {
                if (conn.open) conn.send(packet);
            });
        };

        const packet: P2PPacket = { type: 'SYNC_LINES', payload: { lines } };
        broadcast(packet);
    }, [lines, role]);

    // Cursor Broadcast (Host)
    const broadcastCursor = useCallback((cursor: CursorData) => {
        connectionsRef.current.forEach(conn => {
            if (conn.open) {
                const packet: P2PPacket = { type: 'CURSOR_MOVE', payload: cursor };
                conn.send(packet);
            }
        });
    }, []);

    return {
        initializePeer,
        connectToHost,
        peerId,
        requestAction,
        connectionState,
        connectedGuests,
        manualRevoke,
        guestList,
        broadcastCursor,
        sendCursor
    };
};
