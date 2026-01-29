export type P2PActionType = 'SYNC_FULL' | 'SYNC_PINS' | 'REQUEST_OP' | 'REQUEST_PERMISSION' | 'PERMISSION_GRANTED' | 'PERMISSION_REVOKED' | 'CURSOR_MOVE' | 'SYNC_LINES';

export interface PinData {
    id: string;
    x: number;
    y: number;
    color: string;
    text?: string;
}

export interface ImageSize {
    width: number;
    height: number;
}

// Payload for initial full sync (Image + Pins)
export interface SyncFullPayload {
    image: string | null;
    imageSize: ImageSize | null;
    pins: PinData[];
}

// Payload for pin-only sync (Lightweight)
export interface SyncPinsPayload {
    pins: PinData[];
}

// Payload for guest requests
export interface RequestOpPayload {
    action: 'ADD_PIN' | 'UPDATE_PIN' | 'DELETE_PIN' | 'ADD_LINE' | 'UNDO_LINE';
    pin?: PinData; // For ADD/UPDATE
    pinId?: string; // For DELETE
    line?: LineData; // For ADD_LINE
}

export interface LineData {
    id: string;
    points: number[];
    color: string;
    strokeWidth: number;
}

export interface CursorData {
    userId: string;
    x: number;
    y: number;
    label?: string;
    color?: string;
}

export interface SyncLinesPayload {
    lines: LineData[];
}

// Payload for permission grant
export interface PermissionGrantedPayload {
    expiresAt: number; // Unix timestamp
}

export interface P2PPacket {
    type: P2PActionType;
    // Payload is optional because some types (REQUEST_PERMISSION, PERMISSION_REVOKED) don't need it
    payload?: SyncFullPayload | SyncPinsPayload | RequestOpPayload | PermissionGrantedPayload | CursorData | SyncLinesPayload;
}
