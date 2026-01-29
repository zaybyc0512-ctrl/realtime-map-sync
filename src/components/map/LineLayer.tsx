'use client';

import React from 'react';
import { Layer, Line } from 'react-konva';
import { useMapStore } from '@/store/mapStore';

export const LineLayer = () => {
    const lines = useMapStore((state) => state.lines);
    // Also need to show "currently drawing line" if we want local feedback?
    // Local drawing state will be in MapCanvas usually or passed here.
    // Let's assume MapCanvas handles the "preview" line on a separate temp layer or same layer.
    // This layer is for COMMITTED lines.

    return (
        <Layer>
            {lines.map((line) => (
                <Line
                    key={line.id}
                    points={line.points}
                    stroke={line.color}
                    strokeWidth={line.strokeWidth}
                    tension={0.5}
                    lineCap="round"
                    lineJoin="round"
                    listening={false} // Lines don't catch events for now
                />
            ))}
        </Layer>
    );
};
