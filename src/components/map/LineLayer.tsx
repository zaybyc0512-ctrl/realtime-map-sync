'use client';

import React from 'react';
import { Layer, Line } from 'react-konva';
import { useMapStore } from '@/store/mapStore';

import { LineData } from '@/types/p2p';

interface LineLayerProps {
    currentLine: LineData | null;
}

export const LineLayer = ({ currentLine }: LineLayerProps) => {
    const lines = useMapStore((state) => state.lines);

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
                    listening={false}
                />
            ))}
            {currentLine && (
                <Line
                    points={currentLine.points}
                    stroke={currentLine.color}
                    strokeWidth={currentLine.strokeWidth}
                    tension={0.5}
                    lineCap="round"
                    lineJoin="round"
                    listening={false}
                />
            )}
        </Layer>
    );
};
