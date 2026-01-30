import React from 'react';
import Image from 'next/image';

const SOCIAL_LINKS = [
    {
        name: 'Note',
        url: 'https://note.com/vast_acacia502',
        image: '/icon-note.png',
    },
    {
        name: 'Wick',
        url: 'https://wick-sns.com/sns/profile/00477145-972e-4882-b38a-c0b01aeadb8b',
        image: '/icon-wick.png',
    },
    {
        name: 'X',
        url: 'https://x.com/Xv2UFh3LZzGJAqH',
        image: '/icon-x.jpg',
    },
];

export const SocialLinks = () => {
    return (
        <div className="fixed bottom-4 right-4 z-50 flex items-center space-x-3 rounded-lg bg-white/90 p-2 shadow-md backdrop-blur-sm transition-opacity hover:opacity-100 opacity-80">
            {SOCIAL_LINKS.map((link) => (
                <a
                    key={link.name}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transition-transform hover:scale-110 hover:opacity-80"
                    title={link.name}
                >
                    <Image
                        src={link.image}
                        alt={link.name}
                        width={32}
                        height={32}
                        className="rounded-full object-cover"
                    />
                </a>
            ))}
        </div>
    );
};
