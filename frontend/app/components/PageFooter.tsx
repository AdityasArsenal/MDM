'use client';

import { useRouter } from 'next/navigation';

export function PageFooter() {
  const router = useRouter();

  return (
    <div className="mt-6 flex flex-wrap gap-4 justify-center text-sm pb-4">
      <button 
        onClick={() => router.push('/instructions')}
        className="text-blue-600 hover:underline"
      >
        How to Use
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
        Terms & Refund
      </button>
    </div>
  );
}
