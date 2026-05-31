'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import Image from 'next/image';

declare global {
  interface Window {
    google: any;
    handleCredentialResponse: (response: any) => void;
  }
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

if (!BACKEND_URL) {
  throw new Error('NEXT_PUBLIC_BACKEND_URL is undefined. App cannot start.');
}

export default function Home() {
  const router = useRouter();
  const [response, setResponse] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const handleCredentialResponse = async (response: any) => {
    setLoading(true);
    setResponse('Sending to backend...');

    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          credential: response.credential
        })
      });

      const data = await res.json();
      setResponse(JSON.stringify(data, null, 2));

      if (data.user) {
        localStorage.setItem('user', JSON.stringify(data.user));

        if (!data.user.is_subscribed) {
          router.push('/payment');
        } else {
          router.push('/dashboard');
        }
      }
    } catch (error: any) {
      setResponse('Error connecting to backend: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    window.handleCredentialResponse = handleCredentialResponse;
  }, []);

  return (
    <div className="min-h-screen w-full bg-[#EAF1FF] flex items-center justify-center px-4 py-10 font-sans">
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />

      <div className="w-full max-w-[420px] rounded-[28px] bg-white overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.12)] border border-[#D6E4FF]">
        {/* Top illustration */}
        <div className="relative h-[360px] w-full bg-[#EAF1FF]">
          <Image
            src="/MDM.jpeg"
            alt="MDM"
            fill
            priority
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 420px"
          />
        </div>

        {/* Content */}
        <div className="px-8 pt-8 pb-10 text-center">
          <h2 className="text-[44px] leading-[1.05] font-extrabold tracking-tight text-[#1F2A4A]">
            Unite
          </h2>
          <p className="mt-3 text-[16px] leading-6 text-[#8A94A6]">
            MDM Management System Login
          </p>

          <div className="mt-8 flex flex-col items-center">
            <div
              id="g_id_onload"
              data-client_id={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID}
              data-callback="handleCredentialResponse"
              data-auto_prompt="false"
            />

            {/* Styled Google button container (keeps logic same; Google renders inside) */}
            <div
              className={`w-full max-w-[260px] rounded-full bg-[#3D7BFF] shadow-[0_10px_20px_rgba(61,123,255,0.35)] transition-opacity ${
                loading ? 'opacity-70 pointer-events-none' : 'opacity-100'
              }`}
            >
              <div
                className="g_id_signin flex justify-center"
                data-type="standard"
                data-size="large"
                data-shape="pill"
                data-theme="filled_blue"
                data-text="continue_with"
              />
            </div>

            {loading && (
              <div className="mt-4 text-sm text-[#8A94A6]">Signing you in…</div>
            )}
          </div>

          {response && (
            <div className="mt-6 rounded-2xl bg-[#F4F7FF] p-4 text-left">
              <h3 className="text-sm font-semibold text-[#1F2A4A]">Backend Response:</h3>
              <pre className="mt-2 text-xs whitespace-pre-wrap text-[#1F2A4A] overflow-x-auto">
                {response}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
