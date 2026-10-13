"use client";

import { useEffect, useRef } from "react";

// Warns when the user tries to leave a page that has unsaved work.
// - closing/refreshing the tab: the browser's own confirmation dialog (text cannot be changed)
// - browser Back: the first press is blocked and onBlocked() runs (show the "Please save the
//   work" toast); a second press leaves the page
// Call with dirty = true after the user changes something and false after a successful save/load.
export function useUnsavedGuard(dirty: boolean, onBlocked: () => void) {
  const dirtyRef = useRef(dirty);
  const blockedRef = useRef(onBlocked);
  // Keep the latest values for the event handlers (updated after render, not during it)
  useEffect(() => {
    dirtyRef.current = dirty;
    blockedRef.current = onBlocked;
  });

  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, []);

  useEffect(() => {
    if (!dirty) return;
    // One extra history entry so the first Back press stays on this page
    history.pushState({ unsavedGuard: true }, "", window.location.href);
    const onPop = () => {
      if (!dirtyRef.current) return;
      history.pushState({ unsavedGuard: true }, "", window.location.href);
      blockedRef.current();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [dirty]);
}
