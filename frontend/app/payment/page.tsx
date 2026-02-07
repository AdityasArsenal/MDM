'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

export default function Payment() {
  const router = useRouter();
  const [userId, setUserId] = useState<string>('');
  const [plan, setPlan] = useState<string>('');
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

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!plan) {
      setError('Please select a plan');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${BACKEND_URL}/api/pay/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({ user_id: userId, plan })
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      
      if (data.payment_url) {
        window.location.href = data.payment_url;
      } else {
        setError('No payment URL received');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-6 text-center">Subscribe</h2>
        
        <form onSubmit={handlePayment} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Select Plan</label>
            <select 
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              className="w-full p-3 border rounded-lg text-base"
              required
            >
              <option value="">Choose a plan</option>
              <option value="1_month">1 Month (₹1)</option>
              <option value="3_month">3 Months (₹2)</option>
            </select>
          </div>

          {error && (
            <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white p-3 rounded-lg font-medium disabled:bg-gray-400"
          >
            {loading ? 'Processing...' : 'Continue to Payment'}
          </button>
        </form>
      </div>
    </div>
  );
}
