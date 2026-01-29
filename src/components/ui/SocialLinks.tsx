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
            {/* Ko-fi Button */}
            <a
                href='https://ko-fi.com/W7W71T8OVD'
                target='_blank'
                rel='noopener noreferrer'
                className='hover:opacity-80 transition-opacity mr-2 flex items-center'
            >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    height='36'
                    style={{ border: '0px', height: '36px' }}
                    src='https://storage.ko-fi.com/cdn/kofi6.png?v=6'
                    alt='Buy Me a Coffee at ko-fi.com'
                />
            </a>
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
