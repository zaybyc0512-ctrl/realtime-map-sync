'use client';

import React from 'react';
import { Layer, Circle, Text, Group } from 'react-konva';
import { useMapStore } from '@/store/mapStore';

export const CursorLayer = () => {
    const cursors = useMapStore((state) => state.cursors);

    return (
        <Layer>
            {Object.values(cursors).map((cursor) => (
                <Group key={cursor.userId} x={cursor.x} y={cursor.y} listening={false}>
                    <Circle
                        radius={6}
                        fill={cursor.color || '#3b82f6'}
                        stroke="white"
                        strokeWidth={2}
                        shadowBlur={4}
                        shadowColor="black"
                        shadowOpacity={0.3}
                    />
                    {cursor.label && (
                        <Text
                            text={cursor.label}
                            x={10}
                            y={-10}
                            fontSize={12}
                            fill="white"
                            fontStyle="bold"
                            shadowBlur={2}
                            shadowColor="black"
                            shadowOpacity={0.8}
                        />
                    )}
                </Group>
            ))}
        </Layer>
    );
};
