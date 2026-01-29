'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useMapStore } from '@/store/mapStore';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { X, Trash2, Edit2, Check } from 'lucide-react';

interface PinPopoverProps {
    pinId: string;
}

export const PinPopover = ({ pinId }: PinPopoverProps) => {
    const pins = useMapStore((state) => state.pins);
    const imageSize = useMapStore((state) => state.imageSize);
    const stage = useMapStore((state) => state.stage);

    // Actions
    const updatePin = useMapStore((state) => state.updatePin);
    const removePin = useMapStore((state) => state.removePin);
    const closePin = useMapStore((state) => state.closePin);

    const selectedPin = pins.find((p) => p.id === pinId);

    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState('');

    // Sync init text
    useEffect(() => {
        if (selectedPin) {
            setEditText(selectedPin.text || '');
        }
    }, [selectedPin, isEditing]);

    if (!selectedPin || !imageSize) return null;

    // Calculate Screen Position
    const pinPixelX = selectedPin.x * imageSize.width;
    const pinPixelY = selectedPin.y * imageSize.height;

    // Apply Stage Transform
    const screenX = pinPixelX * stage.scale + stage.x;
    const screenY = pinPixelY * stage.scale + stage.y;

    // Config
    const offset = 40;

    // Auto-save on blur or explicitly? 
    // Sticky notes usually nice to just Edit. 

    const handleSave = () => {
        updatePin(pinId, { text: editText });
        setIsEditing(false);
    };

    return (
        <div
            className={`absolute z-40 flex flex-col rounded-md shadow-lg border transition-all duration-200 w-48
                ${isEditing ? 'bg-white border-gray-200 p-2 z-50 ring-2 ring-blue-400' : 'bg-[#fff7d1] border-yellow-200 p-2 hover:shadow-xl'}
            `}
            style={{
                left: screenX,
                top: screenY - offset,
                transform: 'translate(-50%, -100%)',
            }}
        >
            {/* Tail */}
            <div
                className={`absolute bottom-[-6px] left-1/2 -translate-x-1/2 w-3 h-3 border-b border-r rotate-45
                    ${isEditing ? 'bg-white border-gray-200' : 'bg-[#fff7d1] border-yellow-200'}
                `}
            />

            {!isEditing ? (
                // View Mode
                <div className="flex flex-col gap-1 group">
                    <div className="flex justify-between items-start">
                        <div
                            className="text-xs text-gray-800 break-words whitespace-pre-wrap cursor-pointer flex-grow min-h-[2rem] p-1 rounded hover:bg-yellow-100/50"
                            onClick={() => setIsEditing(true)}
                            title="クリックして編集"
                        >
                            {selectedPin.text || <span className="text-gray-400 italic">メモなし...</span>}
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity -mr-1 -mt-1 text-gray-500 hover:bg-yellow-200/50"
                            onClick={() => closePin(pinId)}
                        >
                            <X className="h-3 w-3" />
                        </Button>
                    </div>
                </div>
            ) : (
                // Edit Mode
                <div className="flex flex-col gap-2">
                    <Textarea
                        className="text-xs min-h-[80px] resize-none focus-visible:ring-0 p-1 bg-gray-50"
                        placeholder="メモを入力..."
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        autoFocus
                    />
                    <div className="flex justify-between items-center">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-[10px] text-red-500 hover:text-red-700 hover:bg-red-50 px-1"
                            onClick={() => {
                                if (confirm('このピンを削除しますか？')) {
                                    removePin(pinId);
                                    // Popover unmounts auto
                                }
                            }}
                        >
                            <Trash2 className="h-3 w-3 mr-1" />
                            削除
                        </Button>
                        <Button
                            variant="default"
                            size="sm"
                            className="h-6 text-[10px] bg-blue-500 hover:bg-blue-600 px-2"
                            onClick={handleSave}
                        >
                            <Check className="h-3 w-3 mr-1" />
                            完了
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
};
