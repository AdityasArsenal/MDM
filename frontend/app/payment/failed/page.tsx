'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PaymentFailed() {
  const router = useRouter();

  useEffect(() => {
    if (!localStorage.getItem('user')) {
      router.push('/');
      return;
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-lg shadow-sm border p-6">
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-1">Payment not completed</h2>
          <p className="text-sm text-gray-600">We could not confirm your payment.</p>
        </div>

        <div className="mb-6 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-gray-700">
            If money was deducted from your account, your payment may still be processing.
            Please check your account again in a few minutes. If it is not reflected, contact support.
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => router.push('/payment')}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
          >
            Try again
          </button>
          <button
            onClick={() => router.push('/dashboard')}
            className="w-full bg-white hover:bg-gray-50 text-gray-700 font-medium py-3 px-4 rounded-lg border border-gray-200 transition-colors"
          >
            Go to dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
