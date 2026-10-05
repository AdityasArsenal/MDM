// Session helper: keeps the backend session token and attaches it to every API call.
// Use authFetch() for all requests to BACKEND_URL. Do not send user_id in the URL or body.
// The backend reads the user from the token.

const TOKEN_KEY = 'sessionToken';

export function saveToken(token: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Storage can be blocked (private mode). The next API call will then get a 401.
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('user');
  } catch {
    // Ignore storage errors
  }
}

export async function authFetch(url: string, init: RequestInit = {}): Promise<Response> {
  let token: string | null = null;
  try {
    token = localStorage.getItem(TOKEN_KEY);
  } catch {
    token = null;
  }

  const headers = new Headers(init.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(url, { ...init, headers });

  // Session expired or missing: clear it and send the user back to login
  if (res.status === 401 && typeof window !== 'undefined') {
    clearSession();
    window.location.href = '/';
  }

  return res;
}
