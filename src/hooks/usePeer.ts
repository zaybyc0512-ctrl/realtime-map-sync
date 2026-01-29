'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type Peer from 'peerjs';
import type { DataConnection } from 'peerjs';
import { useMapStore } from '@/store/mapStore';
import { P2PPacket, SyncFullPayload, SyncPinsPayload, RequestOpPayload, PermissionGrantedPayload, CursorData, SyncLinesPayload } from '@/types/p2p';
import { toast } from 'sonner';
import throttle from 'lodash/throttle';

export interface GuestInfo {
    peerId: string;
    label: string;
    hasPermission: boolean;
}

export const usePeer = () => {
    const [peerId, setPeerId] = useState<string | null>(null);
    const [connectionState, setConnectionState] = useState<'DISCONNECTED' | 'Connecting...' | 'Connected' | 'Error'>('DISCONNECTED');
    const [connectedGuests, setConnectedGuests] = useState<number>(0);
    const [guestList, setGuestList] = useState<GuestInfo[]>([]);

    const peerRef = useRef<Peer | null>(null);
    const connectionsRef = useRef<DataConnection[]>([]);

    // Critical: Dedicated ref for the active host connection (Guest mode)
    // Arrays are unreliable for single host tracking in async ops.
    const activeHostConnectionRef = useRef<DataConnection | null>(null);

    const permissionTimersRef = useRef<Record<string, NodeJS.Timeout>>({});

    const {
        image, imageSize, pins, lines,
        importData, addPin, updatePin, removePin, addLine, undoLine, updateCursor, setLines,
        setRole, role, setSendRequest,
        setPermissionStatus, setPermissionExpiresAt
    } = useMapStore();

    const storeRef = useRef({ image, imageSize, pins, lines });
    useEffect(() => {
        storeRef.current = { image, imageSize, pins, lines };
    }, [image, imageSize, pins, lines]);

    const updateGuestList = useCallback(() => {
        const list = connectionsRef.current.map(conn => ({
            peerId: conn.peer,
            label: conn.metadata?.label || conn.peer.substring(0, 6) + '...',
            hasPermission: !!permissionTimersRef.current[conn.peer]
        }));
        setGuestList(list);
        setConnectedGuests(list.length);
    }, []);

    const handleIncomingConnection = (conn: DataConnection) => {
        conn.on('open', () => {
            console.log('Guest connected:', conn.peer);
            connectionsRef.current.push(conn);
            setRole('HOST');
            updateGuestList();

            const payload: SyncFullPayload = {
                image: storeRef.current.image,
                imageSize: storeRef.current.imageSize,
                pins: storeRef.current.pins,
            };

            const packet: P2PPacket = { type: 'SYNC_FULL', payload };
            conn.send(packet);

            if (storeRef.current.lines.length > 0) {
                const linesPacket: P2PPacket = {
                    type: 'SYNC_LINES',
                    payload: { lines: storeRef.current.lines }
                };
                conn.send(linesPacket);
            }
        });

        conn.on('data', (data) => {
            handleData(data as P2PPacket, conn);
        });

        conn.on('close', () => {
            console.log('Guest disconnected:', conn.peer);
            connectionsRef.current = connectionsRef.current.filter(c => c !== conn);

            if (permissionTimersRef.current[conn.peer]) {
                clearTimeout(permissionTimersRef.current[conn.peer]);
                delete permissionTimersRef.current[conn.peer];
            }
            updateGuestList();
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
    }, []);

    const grantPermission = (conn: DataConnection, durationSec = 60) => {
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
        // CRITICAL: Do NOT persist immediately (Race condition fix)
        // activeHostConnectionRef.current = conn;
        connectionsRef.current = [conn];

        conn.on('open', () => {
            console.log('Connected to Host:', hostId);
            setConnectionState('Connected');

            // CRITICAL: Persist only when fully open
            activeHostConnectionRef.current = conn;
            if (!connectionsRef.current.includes(conn)) {
                connectionsRef.current = [conn];
            }
            setRole('GUEST');
        });

        conn.on('data', (data) => {
            handleData(data as P2PPacket, conn);
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

    const handleData = (packet: P2PPacket, conn: DataConnection) => {
        if (packet.type !== 'CURSOR_MOVE') {
            console.log('Received Packet:', packet.type, packet.payload);
        }

        if (packet.type === 'SYNC_FULL') {
            const payload = packet.payload as SyncFullPayload;
            importData({
                image: payload.image,
                imageSize: payload.imageSize,
                pins: payload.pins,
                lines: []
            });
        }
        else if (packet.type === 'SYNC_PINS') {
            const payload = packet.payload as SyncPinsPayload;
            const currentImage = storeRef.current.image;
            const currentSize = storeRef.current.imageSize;
            const currentLines = storeRef.current.lines;
            importData({
                image: currentImage,
                imageSize: currentSize,
                pins: payload.pins,
                lines: currentLines
            });
        }
        else if (packet.type === 'SYNC_LINES') {
            const payload = packet.payload as SyncLinesPayload;
            setLines(payload.lines);
        }
        else if (packet.type === 'CURSOR_MOVE') {
            const payload = packet.payload as CursorData;
            updateCursor(payload);
        }
        else if (packet.type === 'REQUEST_PERMISSION') {
            console.log('Processing permission request from:', conn.peer);
            toast('編集リクエスト', {
                description: `Guest が編集権限をリクエストしています`,
                action: {
                    label: '許可 (60秒)',
                    onClick: () => grantPermission(conn, 60),
                },
                cancel: {
                    label: '拒否',
                    onClick: () => console.log('Permission denied'),
                },
                duration: 10000,
            });
        }
        else if (packet.type === 'PERMISSION_GRANTED') {
            const payload = packet.payload as PermissionGrantedPayload;
            setPermissionStatus('GRANTED');
            setPermissionExpiresAt(payload.expiresAt);
            toast.success('編集権限が付与されました！');
        }
        else if (packet.type === 'PERMISSION_REVOKED') {
            setPermissionStatus('NONE');
            setPermissionExpiresAt(null);
            toast.warning('編集権限が終了しました');
        }
        else if (packet.type === 'REQUEST_OP') {
            const payload = packet.payload as RequestOpPayload;

            if (payload.action === 'ADD_PIN' && payload.pin) {
                addPin(payload.pin);
            } else if (payload.action === 'UPDATE_PIN' && payload.pin && payload.pin.id) {
                updatePin(payload.pin.id, payload.pin);
            } else if (payload.action === 'DELETE_PIN' && payload.pinId) {
                removePin(payload.pinId);
            } else if (payload.action === 'ADD_LINE' && payload.line) {
                addLine(payload.line);
            } else if (payload.action === 'UNDO_LINE') {
                undoLine();
            }
        }
    };

    const broadcast = useCallback((packet: P2PPacket) => {
        connectionsRef.current.forEach(conn => {
            if (conn.open) {
                conn.send(packet);
            }
        });
    }, []);

    const broadcastCursor = useCallback(
        throttle((cursor: CursorData) => {
            const packet: P2PPacket = { type: 'CURSOR_MOVE', payload: cursor };
            connectionsRef.current.forEach(conn => {
                if (conn.open) conn.send(packet);
            });
        }, 50),
        []
    );

    const requestAction = useCallback((action: 'ADD_PIN' | 'UPDATE_PIN' | 'DELETE_PIN' | 'REQUEST_PERMISSION' | 'ADD_LINE' | 'UNDO_LINE', data: any) => {
        // Fix: Use activeHostConnectionRef mostly
        let conn = activeHostConnectionRef.current;

        // Fallback check
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

    useEffect(() => {
        setSendRequest(requestAction);
    }, [setSendRequest, requestAction]);

    // Sync Hooks
    useEffect(() => {
        if (role !== 'HOST') return;
        if (connectionsRef.current.length === 0) return;
        const packet: P2PPacket = { type: 'SYNC_PINS', payload: { pins } };
        broadcast(packet);
    }, [pins, role, broadcast]);

    useEffect(() => {
        if (role !== 'HOST') return;
        if (connectionsRef.current.length === 0) return;
        const packet: P2PPacket = { type: 'SYNC_LINES', payload: { lines } };
        broadcast(packet);
    }, [lines, role, broadcast]);

    return {
        peerId,
        connectionState,
        initializePeer,
        connectToHost,
        connectedGuests,
        guestList,
        revokePermission: manualRevoke,
        requestAction,
        broadcastCursor,
        sendCursor
    };
};
