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
    <div className="flex flex-col items-center mt-12 font-sans">
      <Script 
        src="https://accounts.google.com/gsi/client" 
        strategy="afterInteractive"
      />
      
      <h2 className="text-2xl font-semibold mb-8">Flask Auth Testing</h2>
      
      <div 
        id="g_id_onload"
        data-client_id={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID}
        data-callback="handleCredentialResponse"
        data-auto_prompt="false"
      />
      <div className="g_id_signin" data-type="standard" />

      {response && (
        <div className="mt-5 p-4 bg-gray-100 rounded-md w-4/5 overflow-x-auto">
          <h3 className="text-lg font-medium mb-2">Backend Response:</h3>
          <pre className="text-sm whitespace-pre-wrap">{response}</pre>
        </div>
      )}
    </div>
  );
}
