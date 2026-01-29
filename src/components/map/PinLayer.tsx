'use client';

import React from 'react';
import { Path, Group } from 'react-konva';
import { useMapStore } from '@/store/mapStore';

// Lucide MapPin icon path data
const PIN_PATH = "M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6";

export const PinLayer = () => {
    const pins = useMapStore((state) => state.pins);
    const imageSize = useMapStore((state) => state.imageSize);
    const pinScale = useMapStore((state) => state.pinScale); // Get scale

    if (!imageSize) return null;

    return (
        <>
            {pins.map((pin) => {
                const x = pin.x * imageSize.width;
                const y = pin.y * imageSize.height;

                return (
                    <Group
                        key={pin.id}
                        id={pin.id}
                        name="pin"
                        x={x}
                        y={y}
                        // Offset handles center. Scale affects offset too visually if we scale the Group.
                        // We want the point (x,y) to remain the "tip".
                        // Tip of map pin usually bottom center.
                        // Original offset was { x: 12, y: 24 } for 24x24 icon? 
                        // Wait, path is 0-24? "M20 10..." -> Coordinates seem to be up to 24.
                        // Let's assume 24x24 viewbox. Tip is at (12, 22) roughly?
                        // If we scale the Group, it scales around (0,0).
                        // We should offset BEFORE scale or AFTER?
                        // Konva: offset is "pivot point".
                        // So if we set offset to {x:12, y:24}, it pivots at the tip.
                        // Then scaling will scale AROUND the tip. Perfect.
                        offset={{ x: 12, y: 22 }} // Adjusted slightly for cleaner tip
                        scale={{ x: pinScale, y: pinScale }}

                        onMouseEnter={(e) => {
                            const container = e.target.getStage()?.container();
                            if (container) container.style.cursor = 'pointer';
                        }}
                        onMouseLeave={(e) => {
                            const container = e.target.getStage()?.container();
                            if (container) container.style.cursor = 'default';
                        }}
                        onClick={() => useMapStore.getState().togglePin(pin.id)}
                        onTap={() => useMapStore.getState().togglePin(pin.id)}
                    >
                        <Path
                            data={PIN_PATH}
                            fill={pin.color}
                            stroke="white"
                            strokeWidth={1.5}
                            scale={{ x: 1, y: 1 }}
                        />
                        <Path
                            data="M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6"
                            fill="white" // Inner circle
                            scale={{ x: 1, y: 1 }}
                        />
                    </Group>
                );
            })}
        </>
    );
};
