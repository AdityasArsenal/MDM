'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SheetSelector } from '@/app/components/SheetSelector';
import { MonthYearPicker } from '@/app/components/MonthYearPicker';
import { Button } from '@/app/components/ui/button';
import { AppHeader } from '@/app/components/AppHeader';

const sheets = [
  { name: 'meals', displayName: 'MDM ದೈನಂದಿನ ದಾಸ್ತಾನು ನಿರ್ವಹಣಾ ವಹಿ (Meal Planning)', path: '/meals' },
  { name: 'milk', displayName: 'ಹಾಲು ಮತ್ತು ರಾಗಿ ಮಾಲ್ಟ್ ನಿರ್ವಹಣಾ ವಹಿ (Milk & Ragi)', path: '/milk' },
  { name: 'stock', displayName: 'ದಿನಸಿ ನಿರ್ವಹಣಾ ವಹಿ (Stock Management)', path: '/stock' },
  { name: 'egg', displayName: 'ಮೊಟ್ಟೆ ಮತ್ತು ಬಾಳೆ ನಿರ್ವಹಣಾ ವಹಿ (Egg & Banana)', path: '/egg' },
];

export default function Dashboard() {
  const router = useRouter();
  const [selectedSheet, setSelectedSheet] = useState('');
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [userName, setUserName] = useState('');

  useEffect(() => {
    const user = localStorage.getItem('user');
    if (!user) {
      router.push('/');
      return;
    }
    const userData = JSON.parse(user);
    setUserName(userData.name || userData.email || 'User');

    // Check subscription status on every dashboard visit
    fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/sub/check?user_id=${userData.id}`)
      .then(res => res.json())
      .then(data => {
        if (!data.has_active_subscription) {
          router.push('/payment');
        }
        else{
          console.log("sub is ac")
        }
      })
      .catch(() => {
        // On network error, fail open (don't block the user)
      });
  }, [router]);

  const handleNavigate = () => {
    if (!selectedSheet) {
      alert('Please select a sheet');
      return;
    }

    const sheet = sheets.find(s => s.name === selectedSheet);
    if (sheet) {
      // Store selected month/year in localStorage for the target page to use
      localStorage.setItem('selectedMonth', month.toString());
      localStorage.setItem('selectedYear', year.toString());
      router.push(sheet.path);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <AppHeader 
        title="MDM Management System" 
        subtitle={`Welcome, ${userName}`}
        showBackButton={false}
        userName={userName}
      />

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-2 text-gray-800">Control Panel</h2>
            <p className="text-gray-600">Select a sheet and date range to view and edit your data.</p>
          </div>

          <div className="space-y-6">
            {/* Sheet Selector */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700">
                Select Sheet
              </label>
              <SheetSelector
                sheets={sheets}
                value={selectedSheet}
                onValueChange={setSelectedSheet}
              />
            </div>

            {/* Month/Year Picker */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700">
                Select Period
              </label>
              <MonthYearPicker
                selectedMonth={month}
                selectedYear={year}
                onMonthChange={setMonth}
                onYearChange={setYear}
              />
            </div>

            {/* Navigate Button */}
            <Button
              onClick={handleNavigate}
              disabled={!selectedSheet}
              className="w-full py-6 text-lg"
            >
              Open Selected Sheet
            </Button>
          </div>

          {/* Quick Access Cards */}
          <div className="mt-8 pt-8 border-t">
            <h3 className="text-lg font-semibold mb-4 text-gray-800">Quick Access</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sheets.map((sheet) => (
                <button
                  key={sheet.name}
                  onClick={() => {
                    setSelectedSheet(sheet.name);
                    localStorage.setItem('selectedMonth', month.toString());
                    localStorage.setItem('selectedYear', year.toString());
                    router.push(sheet.path);
                  }}
                  className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-left"
                >
                  <div className="font-medium text-gray-800 text-sm">
                    {sheet.displayName}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Info Card */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 mb-2">📋 Quick Instructions</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Select a sheet type from the dropdown</li>
            <li>• Choose the month and year you want to work with</li>
            <li>• Click "Open Selected Sheet" or use Quick Access cards</li>
            <li>• Remember to save your changes before switching sheets</li>
          </ul>
        </div>

        {/* Footer Links */}
        <div className="mt-6 flex flex-wrap gap-4 justify-center text-sm">
          <button 
            onClick={() => router.push('/instructions')}
            className="text-blue-600 hover:underline"
          >
            How to Use This App
          </button>
          <span className="text-gray-400">|</span>
          <button 
            onClick={() => router.push('/privacy')}
            className="text-blue-600 hover:underline"
          >
            Privacy Policy
          </button>
          <span className="text-gray-400">|</span>
          <button 
            onClick={() => router.push('/terms')}
            className="text-blue-600 hover:underline"
          >
            Terms & Refund Policy
          </button>
        </div>
      </div>
    </div>
  );
}
