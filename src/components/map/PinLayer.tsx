'use client';

import React from 'react';
import { Layer, Group, Path, Text, Rect } from 'react-konva';
import { useMapStore } from '@/store/mapStore';
import { PinData } from '@/types/p2p';
import { KonvaEventObject } from 'konva/lib/Node';

export const PinLayer = () => {
    // Select specific state to prevent unnecessary re-renders
    const pins = useMapStore((state) => state.pins);
    const toolMode = useMapStore((state) => state.toolMode);
    const role = useMapStore((state) => state.role);
    const permissionStatus = useMapStore((state) => state.permissionStatus);
    const hostSettings = useMapStore((state) => state.hostSettings);
    const updatePin = useMapStore((state) => state.updatePin);
    const togglePin = useMapStore((state) => state.togglePin); // Use togglePin instead of setPopover
    const imageSize = useMapStore((state) => state.imageSize);

    // Determine if user can edit/drag pins
    const canEdit =
        role === 'NONE' || // Added: Offline/Solo mode always allows editing
        role === 'HOST' ||
        permissionStatus === 'GRANTED' ||
        hostSettings?.guestEditMode === 'FREE';

    const isDraggable = toolMode === 'pointer' && canEdit;

    // Handle Drag End - Syncs new position
    const handleDragEnd = (e: KonvaEventObject<DragEvent>, pinId: string) => {
        if (!isDraggable || !imageSize) return;

        const node = e.target;

        // Ensure we really get position relative to stage/layer correctly if scaled
        // Konva docs: node.x() and node.y() are relative to parent.
        // Screen coords: node.getAbsolutePosition()
        const x = node.x() / imageSize.width;
        const y = node.y() / imageSize.height;

        // Reset scale immediately to avoid visual glitches if Konva tries to persist drag scale?
        node.scale({ x: 1, y: 1 });

        // Update store and sync
        updatePin(pinId, { x, y });
    };

    // Handle Input Start - Blocks event propagation
    const handleInputStart = (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
        // e.evt is native event.
        // e.cancelBubble = true stops Konva event bubbling to Stage.
        if (isDraggable) {
            e.cancelBubble = true;
        }
    };

    // Handle Click - Opens Popover
    const handlePinClick = (e: KonvaEventObject<MouseEvent> | KonvaEventObject<TouchEvent>, pin: PinData) => {
        if (isDraggable) {
            e.cancelBubble = true; // Stop event from creating a new pin on map
        }

        // Open popover using togglePin
        togglePin(pin.id);
    };

    if (!imageSize) return null;

    return (
        <Layer>
            {pins.map((pin) => (
                <Group
                    key={pin.id}
                    x={pin.x * imageSize.width}
                    y={pin.y * imageSize.height}
                    draggable={isDraggable}
                    onDragEnd={(e) => handleDragEnd(e, pin.id)}
                    onMouseDown={handleInputStart}
                    onTouchStart={handleInputStart}
                    onClick={(e) => handlePinClick(e, pin)}
                    onTap={(e) => handlePinClick(e, pin)}
                    onMouseEnter={(e) => {
                        if (isDraggable) {
                            const stage = e.target.getStage();
                            if (stage) stage.container().style.cursor = 'move';
                        }
                    }}
                    onMouseLeave={(e) => {
                        const stage = e.target.getStage();
                        if (stage) stage.container().style.cursor = 'default';
                    }}
                >
                    {/* Transparent Hitbox for easier grabbing */}
                    <Rect
                        width={40}
                        height={40}
                        offsetX={20}
                        offsetY={40}
                        fill="transparent"
                    // fill="rgba(255,0,0,0.3)" // Debug: Uncomment to see hitbox
                    />

                    {/* Pin Icon Path (Map Marker Shape) */}
                    <Path
                        data="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
                        fill={pin.color}
                        stroke="white"
                        strokeWidth={2}
                        scaleX={1.5}
                        scaleY={1.5}
                        offsetX={12}
                        offsetY={22}
                        shadowColor="black"
                        shadowBlur={5}
                        shadowOpacity={0.3}
                        shadowOffsetY={2}
                    />

                    {/* Inner White Dot */}
                    <Path
                        data="M12 7a2 2 0 1 0-.001 4.001A2 2 0 0 0 12 7z"
                        fill="white"
                        scaleX={1.5}
                        scaleY={1.5}
                        offsetX={12}
                        offsetY={22}
                    />

                    {/* Pin Label */}
                    {pin.text && (
                        <Group y={-45}>
                            {/* Text Background for readability */}
                            <Rect
                                x={-(pin.text.length * 7) / 2 - 5}
                                y={-10}
                                width={pin.text.length * 14 + 10}
                                height={24}
                                fill="rgba(0,0,0,0.7)"
                                cornerRadius={4}
                            />
                            <Text
                                text={pin.text}
                                fontSize={14}
                                fill="white"
                                align="center"
                                width={200}
                                offsetX={100}
                                shadowBlur={2}
                                shadowColor="black"
                                shadowOpacity={0.8}
                            />
                        </Group>
                    )}
                </Group>
            ))}
        </Layer>
    );
};
