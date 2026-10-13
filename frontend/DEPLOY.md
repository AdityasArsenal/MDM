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

## PWA

The site can be installed ("Add to Home screen") and then opens full-screen on `/dashboard`. No npm package is used.

What was added:

- `app/manifest.ts`: the web app manifest, served at `/manifest.webmanifest`.
- `public/icons/`: app icons (192, 512, maskable 512, apple-touch 180, favicon 48) and `logo-96.png` for the page header. They are generated from `public/logo.png`.
- `public/sw.js`: the service worker (plain JS, no build step).
- `public/offline.html`: shown when a page cannot be loaded and no stored copy exists.
- `app/components/ServiceWorkerRegister.tsx`: registers the worker in production only; in development it unregisters it.
- `app/components/InstallPrompt.tsx`: the "Install app" button on the dashboard (on iOS Safari, a one-line hint instead).
- `next.config.ts`: `/sw.js` is never cached and `/manifest.webmanifest` is cached for one hour.

Caching rules of the worker (same-origin GET only):

| Request | Rule |
|---------|------|
| Other origins (backend API, Google sign-in) and every POST/PUT/DELETE | Not touched |
| `/_next/static/*`, `/icons/*` | Cache-first, stored on first fetch |
| Page navigations | Network-first; a copy is stored (URLs with a query string are not); offline: stored copy of that page, otherwise `/offline.html` |
| Everything else | Not touched (normal network request) |

The worker never stores user data: all data comes from the backend on another origin. Offline, a page that was opened before shows its empty shell and the data calls fail; nothing can be entered or saved offline.

How to test:

- Chrome DevTools > Application > Manifest (no errors, icons shown) and Service Workers (`sw.js` activated and running).
- Lighthouse: the "Installable" check passes.
- DevTools > Network > Offline, then open a page never visited before: the offline page appears.
- The worker only runs in a production build (`pnpm build && pnpm start`, or the deployed site), over HTTPS or on localhost.

How to release a new version:

- Deploy as usual. Pages are network-first, so users get the new version the next time they open the app online.
- The browser re-checks `/sw.js` by itself; a changed worker installs and takes over at once.
- Bump `CACHE` in `public/sw.js` (`mdm-static-v1` -> `v2`) only when the caching rules or the precached files change, or when an icon is replaced. The old cache is deleted on activate, which also clears the build files of old deploys.

Phone checklist (manual, after each change to the PWA files):

- [ ] Install from Chrome on Android ("Install app" button on the dashboard, or the browser menu).
- [ ] The installed app opens full-screen on the dashboard.
- [ ] Google login works inside the installed app.
- [ ] A PhonePe payment returns into the app (success and failed).
- [ ] PDF download: the file saves or opens.
- [ ] Browser/hardware Back button with unsaved work shows the warning first.
- [ ] Airplane mode shows the offline page (for a page not opened before) or the stored page shell.
- [ ] After a new deploy the app shows the new version by the second open.
- [ ] iPhone: Safari > Share > Add to Home Screen; log in again inside the installed app.
