'use client';

import React, { useRef } from 'react';
import { useMapStore } from '@/store/mapStore';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';

export const ImageUploader = () => {
    const setImage = useMapStore((state) => state.setImage);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const result = event.target?.result as string;
            if (result) {
                // Load image to get dimensions
                const img = new Image();
                img.onload = () => {
                    setImage(result, { width: img.width, height: img.height });
                };
                img.src = result;
            }
        };
        reader.readAsDataURL(file);
    };

    const handleClick = () => {
        fileInputRef.current?.click();
    };

    return (
        <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer" onClick={handleClick}>
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
            />
            <Upload className="w-12 h-12 text-gray-400 mb-4" />
            <p className="text-lg font-medium text-gray-700">画像を選択またはドロップ</p>
            <p className="text-sm text-gray-500 mt-2">マップとして使用する画像をアップロードしてください</p>
            <Button className="mt-4" variant="default">
                ファイルを選択
            </Button>
        </div>
    );
};
