# Frontend deployment

Next.js 16 app (App Router). Host-agnostic: any host that can run Node.js (`pnpm start`) or a Next.js-capable platform works.

## Environment variables

Only names are listed here. Never commit values; `.env*` is git-ignored.

| Name | Required | Meaning |
|------|----------|---------|
| `NEXT_PUBLIC_BACKEND_URL` | Yes | Base URL of the backend API (https, no trailing slash). Every API call is made against it. The app throws at startup if it is missing. |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Yes | Google OAuth Web client ID used by the Sign in with Google button. Must be the same client ID as the backend's `GOOGLE_CLIENT_ID`. |

**Build-time note:** `NEXT_PUBLIC_*` values are inlined into the JavaScript bundle during `pnpm build`. Set the production values in the build environment BEFORE building. Changing them afterwards on the running server has no effect; rebuild instead. Do not reuse a build made with local/dev values.

Before building, check that `NEXT_PUBLIC_BACKEND_URL` is an `https://` production URL (not localhost, 127.0.0.1, ngrok or plain http), and that it is the only active definition of that name in the build environment.

Other names that may exist in a local `.env.local` (for example price settings) are not read by the frontend; prices come from the backend.

## Commands

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm start        # serves on port 3000; use PORT=<n> to change
```

Optional checks before building:

```bash
node_modules/.bin/tsc --noEmit -p .
node_modules/.bin/eslint app
```

## Security headers

`next.config.ts` sets `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options: SAMEORIGIN` and a `Permissions-Policy` (camera, microphone, geolocation denied), disables `X-Powered-By`, and enables React strict mode.

No Content-Security-Policy is set on purpose: it needs a manual allowlist (Google Sign-In scripts/frames from accounts.google.com, the backend origin for `connect-src`, PhonePe redirects) and a wrong policy would break login or payment. Add one only after testing it.

## Post-deploy checklist

- [ ] Google Cloud Console, OAuth Web client: the production domain is listed under Authorized JavaScript origins (https, exact origin).
- [ ] Backend `FRONTEND_SUCCESS_URL` and `FRONTEND_FAILED_URL` point at the production frontend `/payment` pages (the success target and `/payment/failed`).
- [ ] Backend CORS allows only the production frontend origin (a backend change, to be decided by the owner).
- [ ] Backend `GOOGLE_CLIENT_ID` equals the frontend `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.
- [ ] HTTPS everywhere: frontend, backend and the PhonePe callback/redirect URLs.
- [ ] Smoke test: sign in with Google, open each sheet, save, start a payment and check both the success and failed return pages.
