'use client';

import { useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  showBackButton?: boolean;
  userName?: string;
}

const getInitials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .map(word => word.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);

const tapButton =
  'inline-flex min-h-[44px] items-center justify-center rounded-lg border border-gray-300 bg-white px-3 text-base font-medium text-gray-800 active:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2';

export function AppHeader({ showBackButton = true, userName }: AppHeaderProps) {
  const router = useRouter();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleLogout = () => {
    localStorage.removeItem('user');
    router.push('/');
  };

  // Close the menu on any outside tap/click (touch + mouse) or Escape.
  useEffect(() => {
    if (!showDropdown) return;
    const handleOutside = (event: Event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowDropdown(false);
    };
    document.addEventListener('pointerdown', handleOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('pointerdown', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [showDropdown]);

  return (
    <header className="mb-4 border-b bg-white shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-2 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" width={40} height={40} className="h-9 w-9 shrink-0 sm:h-10 sm:w-10" />
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold leading-tight text-gray-800 sm:text-2xl">
              MDM Calculator
            </h1>
            {userName && (
              <p className="truncate text-base leading-tight text-gray-600">
                Welcome, {userName.toLowerCase()}
              </p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {showBackButton && (
            <button type="button" onClick={() => router.push('/dashboard')} className={tapButton}>
              ← Dashboard
            </button>
          )}

          {userName ? (
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setShowDropdown(v => !v)}
                aria-label="Account menu"
                aria-haspopup="menu"
                aria-expanded={showDropdown}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-600 text-base font-semibold text-white active:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
              >
                {getInitials(userName)}
              </button>

              {showDropdown && (
                <div
                  role="menu"
                  className="absolute right-0 z-50 mt-2 w-56 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg"
                >
                  <p className="truncate border-b border-gray-100 px-4 py-3 text-base text-gray-600">
                    {userName}
                  </p>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleLogout}
                    className="min-h-[48px] w-full px-4 text-left text-base font-medium text-red-700 active:bg-gray-100 focus-visible:bg-gray-100 focus-visible:outline-none"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button type="button" onClick={handleLogout} className={tapButton}>
              Logout
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
