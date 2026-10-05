'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
const ONE_MONTH_PRICE = process.env.ONE_MONTH_PRICE;
const THREE_MONTH_PRICE = process.env.THREE_MONTH_PRICE;

if (!BACKEND_URL) {
  throw new Error("NEXT_PUBLIC_BACKEND_URL is undefined. App cannot start.");
}

export default function Payment() {
  const router = useRouter();
  const [userId, setUserId] = useState<string>('');
  const [selectedPlan, setSelectedPlan] = useState<'1_month' | '3_month'>('1_month');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const user = localStorage.getItem('user');
    if (!user) {
      router.push('/');
      return;
    }
    const userData = JSON.parse(user);
    setUserId(userData.id);
  }, [router]);

  const handlePayment = async () => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${BACKEND_URL}/api/pay/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({ user_id: userId, plan: selectedPlan })
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      
      if (data.payment_url) {
        window.location.href = data.payment_url;
      } else if (data.success) {
        router.push('/dashboard');
      } else {
        setError('Payment processing failed');
      }
    } catch (err: any) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const plans = {
    '1_month': { price: '₹19', label: '1 Month' },
    '3_month': { price: '₹45', label: '3 Months' }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-lg shadow-sm border p-6">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-1">Upgrade to Pro</h2>
          <p className="text-sm text-gray-600">Get access to all premium features</p>
        </div>

        {/* Plan Selection */}
        <div className="mb-6">
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(plans).map(([key, plan]) => (
              <button
                key={key}
                onClick={() => setSelectedPlan(key as '1_month' | '3_month')}
                className={`p-3 text-sm rounded-lg border-2 transition-colors ${
                  selectedPlan === key
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-medium">{plan.label}</div>
                <div className="text-lg font-bold">{plan.price}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Features */}
        <div className="mb-6">
          <div className="text-xs text-gray-600 mb-2">What's included:</div>
          <div className="space-y-2">
            {['PDF Export', 'Data Analytics', 'Cloud Sync', 'Priority Support'].map((feature) => (
              <div key={feature} className="flex items-center text-sm">
                <svg className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span className="text-gray-700">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="text-sm text-red-600">{error}</div>
          </div>
        )}

        {/* CTA */}
        <button
          onClick={handlePayment}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Processing...' : `Subscribe for ${plans[selectedPlan].price}`}
        </button>

        <p className="text-xs text-gray-500 text-center mt-3">
          Cancel anytime • No hidden fees
        </p>
      </div>
    </div>
  );
}