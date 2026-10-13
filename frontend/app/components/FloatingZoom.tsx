"use client";

import { useEffect, useRef, useState } from "react";
import { MinusIcon, PlusIcon, UndoIcon, ZoomIcon } from "./icons";

interface FloatingZoomProps {
  zoom: number;
  setZoom: (updater: (z: number) => number) => void;
}

const STEP = 0.1;
const MIN = 0.5;
const MAX = 2;

const round = (n: number) => Math.round(n * 100) / 100;

// One floating button at the bottom left. Tap it: "+" pops out above and "-" below, and the
// button itself becomes an undo button that resets the table size. While the user is typing in
// a table the whole control is hidden; it returns when the field loses focus.
export function FloatingZoom({ zoom, setZoom }: FloatingZoomProps) {
  const [open, setOpen] = useState(false);
  const [typing, setTyping] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const inTable = (t: EventTarget | null) =>
      t instanceof HTMLElement && !!t.closest("table") && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName);
    const onIn = (e: FocusEvent) => {
      if (inTable(e.target)) {
        setTyping(true);
        setOpen(false);
      }
    };
    const onOut = (e: FocusEvent) => {
      if (inTable(e.target)) setTyping(false);
    };
    // Touching or clicking anywhere else closes the popped buttons again
    const onPointer = (e: Event) => {
      if (rootRef.current && e.target instanceof Node && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("focusin", onIn);
    document.addEventListener("focusout", onOut);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("focusin", onIn);
      document.removeEventListener("focusout", onOut);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, []);

  if (typing) return null;

  const circle =
    "absolute left-0 flex h-8 w-8 items-center justify-center rounded-full bg-gray-700 shadow-md active:bg-gray-900 disabled:opacity-40";

  return (
    <div ref={rootRef} className="fixed bottom-14 left-1.5 z-40 h-8 w-8" data-pdf-ignore>
      {open && (
        <button
          type="button"
          aria-label="Zoom in"
          className={`${circle} -top-10`}
          disabled={zoom >= MAX}
          onClick={() => setZoom((z) => Math.min(MAX, round(z + STEP)))}
        >
          <PlusIcon className="h-3.5 w-3.5" />
        </button>
      )}
      <button
        type="button"
        aria-label={open ? "Reset table size" : "Change table size"}
        className={`${circle} top-0`}
        onClick={() => {
          if (open) {
            setZoom(() => 1);
            setOpen(false);
          } else {
            setOpen(true);
          }
        }}
      >
        {open ? <UndoIcon className="h-3.5 w-3.5" /> : <ZoomIcon className="h-3.5 w-3.5" />}
      </button>
      {open && (
        <button
          type="button"
          aria-label="Zoom out"
          className={`${circle} top-10`}
          disabled={zoom <= MIN}
          onClick={() => setZoom((z) => Math.max(MIN, round(z - STEP)))}
        >
          <MinusIcon className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
