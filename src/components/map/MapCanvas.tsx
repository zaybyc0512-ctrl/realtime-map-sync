'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Stage, Layer, Image, Line } from 'react-konva';
import useImage from 'use-image';
import { useMapStore } from '@/store/mapStore';
import { PinLayer } from './PinLayer';
import { LineLayer } from './LineLayer';
import { CursorLayer } from './CursorLayer';
import Konva from 'konva';
import { LineData } from '@/types/p2p';
import { v4 as uuidv4 } from 'uuid';
// import { usePeer } from '@/hooks/usePeer'; // Removed for Singleton pattern
export const MapCanvas = () => {
    const {
        image: imageUrl,
        imageSize,
        stage: stageState,
        updateStage,
        addPin,
        role,
        permissionStatus,
        toolMode, penColor, penWidth, addLine,
        exportImageTrigger,
        sendCursor // Injected from Store
    } = useMapStore();

    const [img] = useImage(imageUrl || '');
    const stageRef = useRef<Konva.Stage>(null);

    // Export Logic
    useEffect(() => {
        if (exportImageTrigger && stageRef.current) {
            const stage = stageRef.current;

            setTimeout(() => {
                const dataUrl = stage.toDataURL({ pixelRatio: 2 });
                const link = document.createElement('a');
                link.download = `map-snapshot-${new Date().getTime()}.png`;
                link.href = dataUrl;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }, 100);
        }
    }, [exportImageTrigger]);

    const [currentLine, setCurrentLine] = useState<LineData | null>(null);
    const [isPanning, setIsPanning] = useState(false);

    // Space key detection for Pan override
    const [isSpacePressed, setIsSpacePressed] = useState(false);

    useEffect(() => {
        const down = (e: KeyboardEvent) => e.code === 'Space' && setIsSpacePressed(true);
        const up = (e: KeyboardEvent) => e.code === 'Space' && setIsSpacePressed(false);
        window.addEventListener('keydown', down);
        window.addEventListener('keyup', up);
        return () => {
            window.removeEventListener('keydown', down);
            window.removeEventListener('keyup', up);
        };
    }, []);

    const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
        e.evt.preventDefault();
        if (!stageRef.current) return;

        const scaleBy = 1.05;
        const stage = stageRef.current;
        const oldScale = stage.scaleX();
        const pointer = stage.getPointerPosition();
        if (!pointer) return;

        const mousePointTo = {
            x: (pointer.x - stage.x()) / oldScale,
            y: (pointer.y - stage.y()) / oldScale,
        };

        const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
        if (newScale < 0.1 || newScale > 10) return;

        stage.scale({ x: newScale, y: newScale });
        const newPos = {
            x: pointer.x - mousePointTo.x * newScale,
            y: pointer.y - mousePointTo.y * newScale,
        };
        stage.position(newPos);
        updateStage({ scale: newScale, x: newPos.x, y: newPos.y });
    };

    const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
        if (isSpacePressed || (toolMode !== 'pen' && e.target === stageRef.current)) {
            updateStage({ x: e.target.x(), y: e.target.y() });
        }
    };

    const handleStageClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
        // Alt-Click to add pin
        if (e.evt.altKey && toolMode === 'pointer') {
            if (!imageSize) return;
            const stage = e.target.getStage();
            if (!stage) return;
            const transform = stage.getAbsoluteTransform().copy().invert();
            const pos = stage.getPointerPosition();
            if (!pos) return;

            const localPos = transform.point(pos);
            const x = localPos.x / imageSize.width;
            const y = localPos.y / imageSize.height;

            const newPin = {
                id: uuidv4(),
                x,
                y,
                color: '#ef4444',
            };
            addPin(newPin);
            return;
        }
    };

    const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
        if (isSpacePressed) return;
        if (e.evt.button === 1) return; // Middle click

        if (toolMode === 'pen') {
            const currentRole = useMapStore.getState().role;
            const currentPermission = useMapStore.getState().permissionStatus;
            const currentSettings = useMapStore.getState().hostSettings;

            if (currentRole === 'GUEST' && currentPermission !== 'GRANTED' && currentSettings.guestEditMode !== 'FREE') {
                return; // Guest cannot draw without permission (unless Free Mode)
            }

            const stage = e.target.getStage();
            if (!stage) return;
            const pos = stage.getRelativePointerPosition();
            if (!pos) return;

            setCurrentLine({
                id: uuidv4(),
                points: [pos.x, pos.y, pos.x, pos.y],
                color: penColor,
                strokeWidth: penWidth,
            });
        }
    };

    // Update cursor when toolMode changes or Space is pressed/released
    useEffect(() => {
        const stage = stageRef.current;
        if (!stage) return;

        if (isSpacePressed) {
            stage.container().style.cursor = 'grab';
        } else if (toolMode === 'pointer') {
            stage.container().style.cursor = 'default';
        } else if (toolMode === 'pen') {
            stage.container().style.cursor = 'crosshair';
        }
    }, [toolMode, isSpacePressed]);

    const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
        const stage = e.target.getStage();
        if (!stage) return;

        // Cursor Broadcast Logic
        // We now use sendCursor from props/store instead of usePeer direct call
        const pos = stage.getRelativePointerPosition();
        if (pos && imageSize) { // Ensure imageSize exists before calculating ratios
            const { role, permissionStatus, hostSettings, sendCursor } = useMapStore.getState();

            // Check if user is allowed to edit (Host, Granted, or Free Mode)
            const canEdit = role === 'HOST' || permissionStatus === 'GRANTED' || hostSettings.guestEditMode === 'FREE';

            // Only send if allowed (Editing)
            if (role !== 'NONE' && canEdit) {
                const cursorData = {
                    userId: 'me', // ID is filled by receiver usually, but we keep this structure
                    x: pos.x / imageSize.width,
                    y: pos.y / imageSize.height,
                    userName: role === 'HOST' ? 'Host' : 'Guest',
                    color: '#ff0000',
                };
                sendCursor(cursorData);
            }
        }

        if (isSpacePressed) {
            stage.container().style.cursor = 'grab';
        } else if (toolMode === 'pen') {
            stage.container().style.cursor = 'crosshair';
        }


        if (!currentLine) return; // Not drawing
        if (toolMode !== 'pen') return;

        // Drawing logic
        const point = stage.getRelativePointerPosition();
        if (!point) return;

        const newPoints = currentLine.points.concat([point.x, point.y]);
        setCurrentLine({ ...currentLine, points: newPoints });
    };

    const handleMouseUp = () => {
        if (currentLine) {
            addLine(currentLine);
            setCurrentLine(null);
        }
    };

    if (!imageUrl || !imageSize) {
        return <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400">Map not loaded</div>;
    }

    return (
        <div className="w-full h-full bg-gray-100 overflow-hidden relative">
            <Stage
                ref={stageRef}
                width={window.innerWidth}
                height={window.innerHeight}
                draggable={toolMode === 'pointer' || isSpacePressed}
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onDragEnd={handleDragEnd}
                onClick={handleStageClick}
                scaleX={stageState.scale}
                scaleY={stageState.scale}
                x={stageState.x}
                y={stageState.y}
            >
                <Layer>
                    <Image image={img} width={imageSize.width} height={imageSize.height} alt="Map" />
                </Layer>
                <LineLayer currentLine={currentLine} />
                {/* CursorLayer handles displaying OTHER users' cursors from store */}
                {/* Now placed below PinLayer to prevent blocking clicks, and listening={false} ensures passthrough */}
                <CursorLayer />
                {/* PinLayer is now top-most to ensure dragging works reliably */}
                <PinLayer />
            </Stage>

            {/* Helper Text */}
            {isSpacePressed && (
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none bg-black/50 text-white px-4 py-2 rounded-full text-sm">
                    Panning Mode
                </div>
            )}
        </div>
    );
};
