'use client';

import { useEffect } from 'react';
import { watchInstallPrompt } from './InstallPrompt';

// Registers /sw.js in production. In development it removes any registration
// so local work is never served from a cache. Renders nothing.
export function ServiceWorkerRegister() {
  useEffect(() => {
    // The install event can fire on any page, before the dashboard is open
    watchInstallPrompt();

    if (!('serviceWorker' in navigator)) return;

    if (process.env.NODE_ENV !== 'production') {
      navigator.serviceWorker
        .getRegistrations()
        .then(registrations => registrations.forEach(registration => registration.unregister()))
        .catch(() => {});
      return;
    }

    const register = () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => {
        // The app works without the worker; nothing to do
      });
    };

    if (document.readyState === 'complete') {
      register();
      return;
    }
    window.addEventListener('load', register, { once: true });
    return () => window.removeEventListener('load', register);
  }, []);

  return null;
}
