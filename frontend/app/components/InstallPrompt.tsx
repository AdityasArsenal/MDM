'use client';

import { useEffect, useSyncExternalStore } from 'react';

// Chrome/Edge/Samsung Internet only; not in the DOM typings.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<unknown>;
}

type Mode = 'hidden' | 'prompt' | 'ios';

const DISMISS_KEY = 'installPromptDismissedAt';
const DISMISS_MS = 14 * 24 * 60 * 60 * 1000;

// The browser fires beforeinstallprompt once per page load, often on the login
// page before the dashboard is shown, so the event is kept here for the whole
// page lifetime (see watchInstallPrompt, called from the root layout).
let installEvent: BeforeInstallPromptEvent | null = null;
let closed = false;
let watching = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach(listener => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function watchInstallPrompt() {
  if (watching || typeof window === 'undefined') return;
  watching = true;
  window.addEventListener('beforeinstallprompt', event => {
    // Keep the event so the button can open the browser's install dialog
    event.preventDefault();
    installEvent = event as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    installEvent = null;
    closed = true;
    notify();
  });
}

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isDismissed() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return at > 0 && Date.now() - at < DISMISS_MS;
  } catch {
    return false;
  }
}

// iOS Safari has no beforeinstallprompt; other iOS browsers are left out.
function isIosSafari() {
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  return ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
}

function getMode(): Mode {
  if (closed || isStandalone() || isDismissed()) return 'hidden';
  if (installEvent) return 'prompt';
  return isIosSafari() ? 'ios' : 'hidden';
}

function install() {
  const event = installEvent;
  if (!event) return;
  // The event can be used once; hide the button straight away
  installEvent = null;
  notify();
  event.prompt().catch(() => {
    // Dialog could not be shown; nothing to do
  });
}

function dismiss() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    // Storage unavailable: hidden for this visit only
  }
  closed = true;
  notify();
}

const notNowLink =
  'min-h-[44px] px-3 text-base text-blue-700 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600';

export function InstallPrompt() {
  // Decided on the client only; the server snapshot is 'hidden'
  const mode = useSyncExternalStore(subscribe, getMode, (): Mode => 'hidden');

  useEffect(() => {
    watchInstallPrompt();
  }, []);

  if (mode === 'hidden') return null;

  if (mode === 'ios') {
    return (
      <div className="mb-3 flex items-center justify-between gap-2 rounded-xl border border-blue-200 bg-blue-50 py-1 pl-4 pr-1">
        <p className="text-base text-blue-900">To install: tap Share, then Add to Home Screen</p>
        <button type="button" onClick={dismiss} className={`shrink-0 ${notNowLink}`}>
          Not now
        </button>
      </div>
    );
  }

  return (
    <div className="mb-3 text-center">
      <button
        type="button"
        onClick={install}
        className="flex min-h-[48px] w-full items-center justify-center rounded-xl bg-blue-600 px-4 text-base font-semibold text-white shadow-sm active:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
      >
        Install app
      </button>
      <button type="button" onClick={dismiss} className={notNowLink}>
        Not now
      </button>
    </div>
  );
}
