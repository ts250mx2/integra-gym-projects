'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';

interface Feature {
    id: string;
    title: string;
    desc: string;
    image: string;
}

interface Props {
    features: Feature[];
}

export default function FeatureCarousel({ features }: Props) {
    const [activeIndex, setActiveIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setActiveIndex((prev) => (prev + 1) % features.length);
        }, 5000);
        return () => clearInterval(interval);
    }, [features.length]);

    return (
        <div style={{
            position: 'relative',
            width: '100%',
            maxWidth: '1000px',
            height: '500px',
            margin: '2rem auto',
            overflow: 'hidden',
            borderRadius: '20px',
            boxShadow: '0 0 30px rgba(0, 243, 255, 0.2)'
        }}>
            {features.map((feature, index) => (
                <div
                    key={feature.id}
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        opacity: activeIndex === index ? 1 : 0,
                        transition: 'opacity 1s ease-in-out',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'flex-end',
                    }}
                >
                    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: -1 }}>
                        <Image
                            src={feature.image}
                            alt={feature.title}
                            fill
                            style={{ objectFit: 'cover' }}
                            priority={index === 0}
                        />
                        <div style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            background: 'linear-gradient(to top, rgba(10,10,10,0.95) 0%, rgba(10,10,10,0.4) 50%, rgba(10,10,10,0.1) 100%)'
                        }} />
                    </div>

                    <div style={{ padding: '3rem', textAlign: 'left' }}>
                        <h2 className="neon-text-blue" style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>
                            {feature.title}
                        </h2>
                        <p style={{ fontSize: '1.2rem', color: 'var(--light-gray)', maxWidth: '600px' }}>
                            {feature.desc}
                        </p>
                    </div>
                </div>
            ))}

            <div style={{
                position: 'absolute',
                bottom: '1.5rem',
                right: '3rem',
                display: 'flex',
                gap: '0.8rem'
            }}>
                {features.map((_, index) => (
                    <button
                        key={index}
                        onClick={() => setActiveIndex(index)}
                        style={{
                            width: '12px',
                            height: '12px',
                            borderRadius: '50%',
                            border: 'none',
                            background: activeIndex === index ? 'var(--neon-blue)' : 'rgba(255,255,255,0.3)',
                            cursor: 'pointer',
                            transition: 'background 0.3s ease'
                        }}
                    />
                ))}
            </div>
        </div>
    );
}
