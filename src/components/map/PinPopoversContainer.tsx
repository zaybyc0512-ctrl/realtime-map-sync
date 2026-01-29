'use client';

import React from 'react';
import { useMapStore } from '@/store/mapStore';
import { PinPopover } from './PinPopover';

export const PinPopoversContainer = () => {
    const openPinIds = useMapStore((state) => state.openPinIds);

    return (
        <>
            {openPinIds.map((id) => (
                <PinPopover key={id} pinId={id} />
            ))}
        </>
    );
};
