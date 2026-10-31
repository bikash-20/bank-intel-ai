'use client';

import React from 'react';

const PETALS_CONFIG = [
  { left: '8%', duration: '18s', delay: '-2s', scale: 1.1 },
  { left: '19%', duration: '24s', delay: '-11s', scale: 0.8 },
  { left: '31%', duration: '15s', delay: '-7s', scale: 1.3 },
  { left: '44%', duration: '22s', delay: '-16s', scale: 0.7 },
  { left: '56%', duration: '17s', delay: '-4s', scale: 1.2 },
  { left: '68%', duration: '26s', delay: '-19s', scale: 0.9 },
  { left: '79%', duration: '20s', delay: '-13s', scale: 1.4 },
  { left: '89%', duration: '16s', delay: '-5s', scale: 0.6 },
  { left: '95%', duration: '23s', delay: '-9s', scale: 1.0 },
];

export const Petals: React.FC = () => {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden transition-opacity duration-350"
      style={{ opacity: 'var(--petal)' }}
    >
      {PETALS_CONFIG.map((p, idx) => (
        <span
          key={idx}
          className="petal-particle absolute"
          style={{
            left: p.left,
            animationDuration: p.duration,
            animationDelay: p.delay,
            transform: `scale(${p.scale})`,
          }}
        />
      ))}
    </div>
  );
};
