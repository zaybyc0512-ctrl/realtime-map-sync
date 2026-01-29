'use client';

import React from 'react';
import { Image as KonvaImage } from 'react-konva';
import useImage from 'use-image';
import { useMapStore } from '@/store/mapStore';

export const MapImage = () => {
    const imageSrc = useMapStore((state) => state.image);
    const imageSize = useMapStore((state) => state.imageSize);
    const [image] = useImage(imageSrc || '', 'anonymous');

    if (!image || !imageSize) return null;

    return (
        <KonvaImage
            image={image}
            width={imageSize.width}
            height={imageSize.height}
        />
    );
};
