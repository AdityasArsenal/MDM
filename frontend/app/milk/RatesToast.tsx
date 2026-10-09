'use client';

import { useEffect, useState } from 'react';

interface RatesToastProps {
  text: string;
  onDone: () => void;
}

const SHOW_MS = 3500;
const FADE_MS = 300;

// Temporary message at the top center. Render with a new key to restart the timer.
export function RatesToast({ text, onDone }: RatesToastProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const fade = setTimeout(() => setVisible(false), SHOW_MS - FADE_MS);
    const done = setTimeout(onDone, SHOW_MS);
    return () => {
      clearTimeout(fade);
      clearTimeout(done);
    };
  }, [onDone]);

  return (
    <div
      role="status"
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] pointer-events-none max-w-[90vw] px-4 py-2 rounded border border-green-300 bg-green-100 text-green-900 text-sm font-semibold shadow-lg text-center transition-opacity duration-300 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {text}
    </div>
  );
}
