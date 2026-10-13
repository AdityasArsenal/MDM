"use client";

import { ReactNode, useCallback, useEffect, useState } from "react";

const SHOW_MS = 3500;
const FADE_MS = 300;

// Temporary light-green message at the top center. Render with a new key to restart the timer.
export function Toast({ text, onDone }: { text: string; onDone: () => void }) {
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
      data-pdf-ignore
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] pointer-events-none max-w-[90vw] px-4 py-2 rounded border border-green-300 bg-green-100 text-green-900 text-sm font-semibold shadow-lg text-center transition-opacity duration-300 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      {text}
    </div>
  );
}

// const { toast, showToast } = useToast();  ...  {toast}   (a new call replaces the current message)
export function useToast(): { toast: ReactNode; showToast: (text: string) => void } {
  const [msg, setMsg] = useState<{ id: number; text: string } | null>(null);
  const showToast = useCallback((text: string) => setMsg({ id: Date.now(), text }), []);
  const clear = useCallback(() => setMsg(null), []);
  return { toast: msg ? <Toast key={msg.id} text={msg.text} onDone={clear} /> : null, showToast };
}
