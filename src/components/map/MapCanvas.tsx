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
import { usePeer } from '@/hooks/usePeer';

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
        exportImageTrigger
    } = useMapStore();

    const [img] = useImage(imageUrl || '');
    const stageRef = useRef<Konva.Stage>(null);

    // Export Logic
    useEffect(() => {
        if (exportImageTrigger && stageRef.current) {
            const stage = stageRef.current;
            // Deselect logic removed for popovers

            // Wait a tick for deselect to render? 
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [exportImageTrigger]);

    // ... rest of code

    // FIX 1: P2P hooks called at top level
    const { broadcastCursor, sendCursor, peerId } = usePeer();

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
        if (e.target === stageRef.current) {
            updateStage({
                x: e.target.x(),
                y: e.target.y()
            });
        }
    };

    const handleClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
        const currentRole = useMapStore.getState().role;
        const perm = useMapStore.getState().permissionStatus;
        if (currentRole === 'GUEST' && perm !== 'GRANTED') return;

        if (!imageSize || !e.evt.altKey) {
            // If click background (not pin), do nothing or close all?
            // "Viewer" usually expects clicking background to NOT close sticky notes unless specific constraint.
            // Let's keep it simple: click background does nothing to pins now. User closes them explicitly.
            return;
        }

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
        addPin(newPin); // AddPin now auto-opens it
    };

    const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
        if (isSpacePressed) return;
        if (e.evt.button === 1) return;

        if (toolMode === 'pen') {
            const currentRole = useMapStore.getState().role;
            const perm = useMapStore.getState().permissionStatus;
            if (currentRole === 'GUEST' && perm !== 'GRANTED') return;

            const stage = e.target.getStage();
            if (!stage) return;
            const pos = stage.getRelativePointerPosition();
            if (!pos) return;

            const newLine: LineData = {
                id: uuidv4(),
                points: [pos.x, pos.y],
                color: penColor,
                strokeWidth: penWidth
            };
            setCurrentLine(newLine);
        }
    };

    const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
        const stage = e.target.getStage();
        if (!stage) return;

        const relPos = stage.getRelativePointerPosition();
        // FIX 1: Use destructured hooks values
        if (relPos) {
            const cursorData = {
                userId: peerId || 'anon',
                x: relPos.x,
                y: relPos.y,
                color: role === 'HOST' ? '#ef4444' : '#3b82f6',
                label: role
            };

            if (role === 'HOST') broadcastCursor(cursorData);
            else if (role === 'GUEST') sendCursor(cursorData);
        }

        if (currentLine) {
            if (!relPos) return;
            const newPoints = currentLine.points.concat([relPos.x, relPos.y]);
            setCurrentLine({ ...currentLine, points: newPoints });
        }
    };

    const handleMouseUp = () => {
        if (currentLine) {
            addLine(currentLine);
            setCurrentLine(null);
        }
    };

    const isDraggable = (toolMode === 'pointer' || isSpacePressed) && !currentLine;

    useEffect(() => {
        if (!stageRef.current) return;
        const container = stageRef.current.container();
        if (isSpacePressed) {
            container.style.cursor = 'grab';
        } else if (toolMode === 'pen') {
            container.style.cursor = 'crosshair';
        } else {
            container.style.cursor = 'default';
        }
    }, [isSpacePressed, toolMode]);

    if (!imageUrl || !imageSize) return null;

    return (
        <Stage
            width={typeof window !== 'undefined' ? window.innerWidth : 800} // Safe window check
            height={typeof window !== 'undefined' ? window.innerHeight : 600}
            onWheel={handleWheel}
            draggable={isDraggable}
            onDragEnd={handleDragEnd}
            onDragMove={(e) => {
                if (e.target === stageRef.current) {
                    updateStage({
                        x: e.target.x(),
                        y: e.target.y(),
                        scale: stageRef.current?.scaleX() || 1
                    });
                }
            }}
            x={stageState?.x ?? 0}

            y={stageState?.y ?? 0}
            scaleX={stageState?.scale ?? 1}
            scaleY={stageState?.scale ?? 1}
            onClick={handleClick}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            ref={stageRef}
            style={{ backgroundColor: '#e5e7eb' }}
        >
            <Layer>
                <Image image={img} width={imageSize.width} height={imageSize.height} />
            </Layer>

            <LineLayer />

            {/* FIX 2: PinLayer returns Fragment in previous view, so wrap in Layer */}
            <Layer>
                <PinLayer />
            </Layer>

            {currentLine && (
                <Layer>
                    <Line
                        points={currentLine.points}
                        stroke={currentLine.color}
                        strokeWidth={currentLine.strokeWidth}
                        tension={0.5}
                        lineCap="round"
                        lineJoin="round"
                        listening={false}
                    />
                </Layer>
            )}

            <CursorLayer />
        </Stage>
    );
};
