'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authFetch } from '@/app/utils/api';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

if (!BACKEND_URL) {
  throw new Error("NEXT_PUBLIC_BACKEND_URL is undefined. App cannot start.");
}

type PlanId = '1_month' | '3_month';

// Display labels live here; prices come from the backend.
const PLAN_LABELS: Record<PlanId, string> = {
  '1_month': '1 Month',
  '3_month': '3 Months',
};
const PLAN_IDS = Object.keys(PLAN_LABELS) as PlanId[];

const GENERIC_ERROR = 'Something went wrong. Please try again.';

function formatPrice(price: number): string {
  return Number.isInteger(price) ? `₹${price}` : `₹${price.toFixed(2)}`;
}

export default function Payment() {
  const router = useRouter();
  const [selectedPlan, setSelectedPlan] = useState<PlanId>('1_month');
  const [prices, setPrices] = useState<Record<PlanId, number> | null>(null);
  const [pricesLoading, setPricesLoading] = useState(true);
  const [pricesError, setPricesError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const loadPrices = useCallback(async () => {
    setPricesLoading(true);
    setPricesError(false);
    try {
      const res = await authFetch(`${BACKEND_URL}/api/pay/plans`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json().catch(() => null);
      const next = {} as Record<PlanId, number>;
      for (const id of PLAN_IDS) {
        const price = data?.[id]?.price;
        if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) {
          throw new Error('Invalid plans response');
        }
        next[id] = price;
      }
      setPrices(next);
    } catch {
      setPrices(null);
      setPricesError(true);
    } finally {
      setPricesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!localStorage.getItem('user')) {
      router.push('/');
      return;
    }
    loadPrices();
  }, [router, loadPrices]);

  const handlePayment = async () => {
    if (!prices || loading) return;
    setLoading(true);
    setError('');

    try {
      const res = await authFetch(`${BACKEND_URL}/api/pay/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({ plan: selectedPlan })
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const serverMsg = typeof data?.error === 'string' && data.error ? data.error : '';
        if (serverMsg) {
          setError(serverMsg);
        } else if (res.status === 503) {
          setError('Payments are unavailable right now. Please try again later.');
        } else {
          setError(GENERIC_ERROR);
        }
        setLoading(false);
        return;
      }

      if (typeof data?.payment_url === 'string' && data.payment_url) {
        // Keep the button disabled: the browser is leaving for PhonePe.
        window.location.href = data.payment_url;
        return;
      }

      setError(GENERIC_ERROR);
      setLoading(false);
    } catch {
      setError(GENERIC_ERROR);
      setLoading(false);
    }
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
          {pricesLoading ? (
            <div className="text-sm text-gray-600 text-center py-6">Loading prices...</div>
          ) : pricesError || !prices ? (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-center">
              <div className="text-sm text-red-600 mb-2">Could not load prices. Please try again.</div>
              <button
                onClick={loadPrices}
                className="text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                Retry
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {PLAN_IDS.map((key) => (
                <button
                  key={key}
                  onClick={() => setSelectedPlan(key)}
                  disabled={loading}
                  className={`p-3 text-sm rounded-lg border-2 transition-colors ${
                    selectedPlan === key
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-medium">{PLAN_LABELS[key]}</div>
                  <div className="text-lg font-bold">{formatPrice(prices[key])}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Features */}
        <div className="mb-6">
          <div className="text-xs text-gray-600 mb-2">What&apos;s included:</div>
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
          disabled={loading || !prices}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Processing...' : prices ? `Subscribe for ${formatPrice(prices[selectedPlan])}` : 'Subscribe'}
        </button>

        <p className="text-xs text-gray-500 text-center mt-3">
          Cancel anytime • No hidden fees
        </p>
      </div>
    </div>
  );
}