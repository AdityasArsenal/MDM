'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Script from 'next/script';

declare global {
  interface Window {
    google: any;
    handleCredentialResponse: (response: any) => void;
  }
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

if (!BACKEND_URL) {
  throw new Error("NEXT_PUBLIC_BACKEND_URL is undefined. App cannot start.");
}

export default function Home() {
  const router = useRouter();
  const [response, setResponse] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const handleCredentialResponse = async (response: any) => {
    setLoading(true);
    setResponse("Sending to backend...");

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
      setResponse("Error connecting to backend: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    window.handleCredentialResponse = handleCredentialResponse;
  }, []);

  return (
    <div className="bg-white w-full h-screen min-h-screen overflow-hidden flex flex-col relative font-sans">
      
      <Script 
        src="https://accounts.google.com/gsi/client" 
        strategy="afterInteractive"
      />
      
      {/* Top Image Section with Curved Bottom Edge */}
      <div 
        className="w-full h-[55%] relative overflow-hidden bg-[#fadce2]"
        style={{
          borderBottomLeftRadius: '50% 12%',
          borderBottomRightRadius: '50% 12%'
        }}
      >
        <img 
          src="/MDM.jpeg" 
          alt="MDM Background" 
          className="w-full h-full object-cover"
        />
      </div>

      {/* Bottom Content Section */}
      <div className="flex-1 flex flex-col items-center pt-8 px-6 pb-6 text-center">
        <h2 className="text-3xl font-bold text-[#2D314E] mb-3 tracking-tight">
          MDM System
        </h2>
        
        <p className="text-[#898E9E] font-medium text-[15px] leading-snug px-2 mb-10">
          Every meal counted and <br/>  Every child served.
        </p>
        
        <div 
          id="g_id_onload"
          data-client_id={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID}
          data-callback="handleCredentialResponse"
          data-auto_prompt="false"
        />
        
        {/* Google Sign-in Button customized to mimic the "Pill" design */}
        <div 
          className="g_id_signin transform scale-110" 
          data-type="standard"
          data-shape="pill"
          data-theme="filled_blue"
          data-text="continue_with"
          data-size="large"
        />

        {/* Backend Response Logs (only visible when active) */}
        {response && (
          <div className="mt-auto w-full pt-6">
            <div className="p-3 bg-gray-50 rounded-xl w-full overflow-x-auto border border-gray-100 max-h-[120px] overflow-y-auto">
              <pre className="text-[10px] whitespace-pre-wrap text-gray-500 text-left font-mono">
                {response}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}