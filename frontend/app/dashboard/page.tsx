'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { MonthYearPicker, MONTHS } from '@/app/components/MonthYearPicker';
import { AppHeader } from '@/app/components/AppHeader';
import { InstallPrompt } from '@/app/components/InstallPrompt';
import { authFetch } from '@/app/utils/api';
import { SheetCard, type SheetName } from './SheetCard';

const sheets: { name: SheetName; displayName: string; path: string }[] = [
  { name: 'egg', displayName: 'ಮೊಟ್ಟೆ ಮತ್ತು ಬಾಳೆ ನಿರ್ವಹಣಾ ವಹಿ (Egg & Banana)', path: '/egg' },
  { name: 'meals', displayName: 'MDM ದೈನಂದಿನ ದಾಸ್ತಾನು ನಿರ್ವಹಣಾ ವಹಿ (Meal Planning)', path: '/meals' },
  { name: 'milk', displayName: 'ಹಾಲು ಮತ್ತು ರಾಗಿ ಮಾಲ್ಟ್ ನಿರ್ವಹಣಾ ವಹಿ (Milk & Ragi)', path: '/milk' },
  { name: 'stock', displayName: 'ದಿನಸಿ ನಿರ್ವಹಣಾ ವಹಿ (Stock Management)', path: '/stock' },
];

export default function Dashboard() {
  const router = useRouter();
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  // Read from localStorage on the client only; the server snapshot is ''
  const userName = useSyncExternalStore(
    () => () => {},
    () => {
      try {
        const userData = JSON.parse(localStorage.getItem('user') || 'null');
        return userData ? userData.name || userData.email || 'User' : '';
      } catch {
        return '';
      }
    },
    () => ''
  );

  useEffect(() => {
    const user = localStorage.getItem('user');
    if (!user) {
      router.push('/');
      return;
    }

    // Check subscription status on every dashboard visit
    authFetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/sub/check`)
      .then(async res => {
        // Only redirect on a clear "no subscription" answer. 401 is handled by authFetch.
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        if (data && data.has_active_subscription === false) {
          router.push('/payment');
        }
      })
      .catch(() => {
        // On network error, fail open (don't block the user)
      });
  }, [router]);

  const openSheet = (path: string) => {
    // Store selected month/year in localStorage for the target page to use
    localStorage.setItem('selectedMonth', month.toString());
    localStorage.setItem('selectedYear', year.toString());
    router.push(path);
  };

  const period = `${MONTHS[month - 1]} ${year}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 pb-[env(safe-area-inset-bottom)]">
      <AppHeader
        title="MDM Management System"
        subtitle={`Welcome, ${userName}`}
        showBackButton={false}
        userName={userName}
      />

      <main className="mx-auto w-full max-w-2xl px-4 pb-8 pt-2">
        <InstallPrompt />
        <div className="rounded-xl bg-white p-4 shadow-lg sm:p-6">
          <h2 className="text-xl font-semibold text-gray-800">Choose a sheet</h2>
          <p className="mb-4 mt-1 text-base text-gray-600">Pick the month, then tap a sheet to open it.</p>

          {/* Period picker */}
          <MonthYearPicker
            selectedMonth={month}
            selectedYear={year}
            onMonthChange={setMonth}
            onYearChange={setYear}
          />

          {/* Quick Access cards: one tap opens the sheet */}
          <nav aria-label="Sheets" className="mt-5">
            <ul className="space-y-3">
              {sheets.map(sheet => (
                <li key={sheet.name}>
                  <SheetCard
                    name={sheet.name}
                    displayName={sheet.displayName}
                    period={period}
                    onOpen={() => openSheet(sheet.path)}
                  />
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {/* Info Card */}
        <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <h3 className="mb-2 text-base font-semibold text-blue-900">Quick Instructions</h3>
          <ul className="list-disc space-y-1 pl-5 text-base text-blue-900">
            <li>Choose the month and year you want to work with</li>
            <li>Tap a sheet card to open it</li>
            <li>Remember to save your changes before switching sheets</li>
          </ul>
        </div>

        {/* Footer Links */}
        <div className="mt-4 flex flex-col items-stretch gap-1 text-center text-base min-[420px]:flex-row min-[420px]:flex-wrap min-[420px]:justify-center">
          {[
            ['/instructions', 'How to Use This App'],
            ['/privacy', 'Privacy Policy'],
            ['/terms', 'Terms & Refund Policy'],
          ].map(([href, label]) => (
            <button
              key={href}
              type="button"
              onClick={() => router.push(href)}
              className="min-h-[44px] px-3 text-blue-700 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              {label}
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
