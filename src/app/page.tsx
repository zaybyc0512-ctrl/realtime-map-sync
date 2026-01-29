'use client';

import { useEffect, useState } from 'react';
import { useMapStore } from '@/store/mapStore';
import { ImageUploader } from '@/components/ui/ImageUploader';
import { MapCanvas } from '@/components/map/MapCanvas';
import { MapControls } from '@/components/ui/MapControls';
// import { PinPopover } from '@/components/map/PinPopover'; // Removed single
import { PinPopoversContainer } from '@/components/map/PinPopoversContainer';
import { ConnectionManager } from '@/components/p2p/ConnectionManager';
import { usePeer } from '@/hooks/usePeer';
import { Loader2 } from 'lucide-react';
import { Toaster } from '@/components/ui/sonner';

export default function Home() {
  const image = useMapStore((state) => state.image);
  const hasHydrated = useMapStore((state) => state._hasHydrated);
  const role = useMapStore((state) => state.role);

  // Initialize P2P hook
  const peer = usePeer();

  if (!hasHydrated) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50">
        <Loader2 className="h-10 w-10 animate-spin text-gray-400" />
        <p className="mt-4 text-gray-500 text-sm">読み込み中...</p>
      </div>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-between relative">
      {/* Global Toaster for Notifications */}
      <Toaster position="top-center" />

      {/* P2P UI Overlay */}
      <ConnectionManager {...peer} />

      {/* Main Content */}
      {!image ? (
        <div className="flex flex-col items-center justify-center min-h-screen w-full bg-gray-50">
          {role === 'GUEST' ? (
            <div className="text-center p-6">
              <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-700">ホストからの同期を待機中...</h2>
              <p className="text-gray-500 mt-2">接続が確立されるとマップが表示されます</p>
            </div>
          ) : (
            <div className="max-w-md w-full p-6 bg-white rounded-xl shadow-lg">
              <h1 className="text-2xl font-bold text-gray-800 mb-6 text-center">Realtime Map Sync</h1>
              <ImageUploader />
            </div>
          )}
        </div>
      ) : (
        <>
          <MapControls />
          <MapCanvas />
          <PinPopoversContainer />
        </>
      )}
    </main>
  );
}
