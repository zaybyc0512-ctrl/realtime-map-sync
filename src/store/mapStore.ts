import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { get, set, del } from 'idb-keyval';
import { PinData, LineData, CursorData } from '@/types/p2p';

interface Pin extends PinData { } // Alias

interface ImageSize {
  width: number;
  height: number;
}

interface StageState {
  scale: number;
  x: number;
  y: number;
}

interface MapState {
  image: string | null;
  imageSize: ImageSize | null;
  stage: StageState;

  pins: Pin[];
  lines: LineData[];
  cursors: Record<string, CursorData>; // Transient

  // Local UI State
  toolMode: 'pointer' | 'pen';
  penColor: string;
  penWidth: number;
  pinScale: number; // Added
  exportImageTrigger: number | null; // Timestamp trigger

  openPinIds: string[]; // Changed from selectedPinId
  _hasHydrated: boolean;
  role: 'HOST' | 'GUEST' | 'NONE';

  // Permission State
  permissionStatus: 'NONE' | 'REQUESTING' | 'GRANTED' | 'COOLDOWN';
  permissionExpiresAt: number | null;
  hostSettings: { // Added
    permissionDuration: number;
    reapplyCooldown: number;
  };

  // Dependency injection for P2P
  sendRequest: (action: 'ADD_PIN' | 'UPDATE_PIN' | 'DELETE_PIN' | 'REQUEST_PERMISSION' | 'ADD_LINE' | 'UNDO_LINE', data?: any) => void;
  sendCursor: (data: CursorData) => void; // Added for Singleton fix

  // Actions
  setImage: (image: string, size: ImageSize) => void;
  updateStage: (stage: Partial<StageState>) => void;

  addPin: (pin: Pin) => void;
  removePin: (id: string) => void;
  updatePin: (id: string, updates: Partial<Pin>) => void;

  togglePin: (id: string) => void;
  closePin: (id: string) => void;
  openPin: (id: string) => void;

  addLine: (line: LineData) => void;
  undoLine: () => void;
  setLines: (lines: LineData[]) => void;
  updateCursor: (cursor: CursorData) => void;

  setToolMode: (mode: 'pointer' | 'pen') => void;
  setPenConfig: (color: string, width: number) => void;
  setPinScale: (scale: number) => void; // Added
  triggerImageExport: () => void; // Added
  fitToScreen: (containerWidth: number, containerHeight: number) => void; // Added Phase 10
  setHostSettings: (settings: Partial<{ permissionDuration: number; reapplyCooldown: number; }>) => void; // Added

  clearMap: () => void;
  setHasHydrated: (state: boolean) => void;
  setRole: (role: 'HOST' | 'GUEST' | 'NONE') => void;
  setPermissionStatus: (status: 'NONE' | 'REQUESTING' | 'GRANTED' | 'COOLDOWN') => void;
  setPermissionExpiresAt: (time: number | null) => void;
  setSendRequest: (fn: (action: 'ADD_PIN' | 'UPDATE_PIN' | 'DELETE_PIN' | 'REQUEST_PERMISSION' | 'ADD_LINE' | 'UNDO_LINE', data?: any) => void) => void;
  setSendCursor: (fn: (data: CursorData) => void) => void; // Added for Singleton fix

  importData: (data: { image: string | null; imageSize: ImageSize | null; pins: Pin[]; lines: LineData[] }) => void;
}

const storage = {
  getItem: async (name: string): Promise<string | null> => {
    return (await get(name)) || null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await set(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    await del(name);
  },
};

export const useMapStore = create<MapState>()(
  persist(
    (set, get) => ({
      image: null,
      imageSize: null,
      stage: { scale: 1, x: 0, y: 0 },
      pins: [],
      lines: [],
      cursors: {},
      toolMode: 'pointer',
      penColor: '#ef4444',
      penWidth: 4,
      pinScale: 1.0, // Default scale
      exportImageTrigger: null,

      openPinIds: [],
      _hasHydrated: false,
      role: 'NONE',
      permissionStatus: 'NONE',
      permissionExpiresAt: null,
      hostSettings: { permissionDuration: 60, reapplyCooldown: 10 }, // Default initialization
      sendRequest: () => { },
      sendCursor: () => { }, // Added

      setImage: (image, size) => set({ image, imageSize: size, pins: [], lines: [], stage: { scale: 1, x: 0, y: 0 } }),

      updateStage: (newStage) =>
        set((state) => ({
          stage: { ...state.stage, ...newStage }
        })),

      // ... (middle parts unchanged, we need to correctly target this block)

      addPin: (pin) => {
        const state = get();
        // ... Check role ...
        // 1. Optimistic Update
        set((state) => ({
          pins: [...state.pins, pin],
          openPinIds: [...state.openPinIds, pin.id]
        }));

        // 2. Send Request if Guest
        const { role, sendRequest } = get();
        if (role === 'GUEST') {
          sendRequest('ADD_PIN', pin);
        }
      },

      removePin: (id) => {
        // 1. Optimistic Update
        set((state) => ({
          pins: state.pins.filter((p) => p.id !== id),
          openPinIds: state.openPinIds.filter((pid) => pid !== id)
        }));

        // 2. Send Request if Guest
        const { role, sendRequest } = get();
        if (role === 'GUEST') {
          sendRequest('DELETE_PIN', id);
        }
      },

      updatePin: (id, updates) => {
        const state = get();
        const targetPin = state.pins.find(p => p.id === id);
        if (!targetPin) return;

        const updatedPin = { ...targetPin, ...updates };

        // 1. Optimistic Update
        set((state) => ({
          pins: state.pins.map((p) => p.id === id ? updatedPin : p)
        }));

        // 2. Send Request if Guest
        if (state.role === 'GUEST') {
          state.sendRequest('UPDATE_PIN', updatedPin);
        }
      },

      togglePin: (id) => set((state) => {
        const isOpen = state.openPinIds.includes(id);
        return {
          openPinIds: isOpen
            ? state.openPinIds.filter(pid => pid !== id)
            : [...state.openPinIds, id]
        };
      }),

      closePin: (id) => set((state) => ({
        openPinIds: state.openPinIds.filter(pid => pid !== id)
      })),

      openPin: (id) => set((state) => {
        if (state.openPinIds.includes(id)) return {};
        return { openPinIds: [...state.openPinIds, id] };
      }),

      addLine: (line) => {
        // 1. Optimistic Update
        set((state) => ({ lines: [...state.lines, line] }));

        // 2. Send Request if Guest
        const { role, sendRequest } = get();
        if (role === 'GUEST') {
          sendRequest('ADD_LINE', line);
        }
      },

      undoLine: () => {
        // 1. Optimistic Update
        set((state) => {
          if (state.lines.length === 0) return {};
          return { lines: state.lines.slice(0, -1) };
        });

        // 2. Send Request if Guest
        const { role, sendRequest } = get();
        if (role === 'GUEST') {
          sendRequest('UNDO_LINE');
        }
      },

      setLines: (lines) => set({ lines }),

      updateCursor: (cursor) => set((state) => ({
        cursors: { ...state.cursors, [cursor.userId]: cursor }
      })),

      setToolMode: (mode) => set({ toolMode: mode }),
      setPenConfig: (color, width) => set({ penColor: color, penWidth: width }),
      setPinScale: (scale) => set({ pinScale: scale }),
      triggerImageExport: () => set({ exportImageTrigger: Date.now() }),

      fitToScreen: (containerWidth, containerHeight) => set((state) => {
        if (!state.imageSize) return {};
        const { width, height } = state.imageSize;

        // Calculate scale to fit
        const scaleX = containerWidth / width;
        const scaleY = containerHeight / height;
        const scale = Math.min(scaleX, scaleY) * 0.9; // 0.9 for padding

        // Center content
        const x = (containerWidth - width * scale) / 2;
        const y = (containerHeight - height * scale) / 2;

        return { stage: { scale, x, y } };
      }),

      setHostSettings: (updates) => set((state) => ({
        hostSettings: { ...state.hostSettings, ...updates }
      })),

      clearMap: () => set({ image: null, imageSize: null, pins: [], lines: [], stage: { scale: 1, x: 0, y: 0 }, openPinIds: [] }),

      importData: (data) => set({
        image: data.image,
        imageSize: data.imageSize,
        pins: data.pins,
        lines: data.lines || [],
        stage: { scale: 1, x: 0, y: 0 }
      }),

      setHasHydrated: (state) => set({ _hasHydrated: state }),
      setRole: (role) => set({ role }),
      setPermissionStatus: (status) => set({ permissionStatus: status }),
      setPermissionExpiresAt: (time) => set({ permissionExpiresAt: time }),
      setSendRequest: (fn) => set({ sendRequest: fn }),
      setSendCursor: (fn) => set({ sendCursor: fn }), // Added
    }),
    {
      name: 'map-storage',
      storage: createJSONStorage(() => storage),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
      partialize: (state) => ({
        image: state.image,
        imageSize: state.imageSize,
        pins: state.pins,
        lines: state.lines,
        // We persist pen settings too for convenience
        penColor: state.penColor,
        penWidth: state.penWidth,
        pinScale: state.pinScale
      }),
    }
  )
);
