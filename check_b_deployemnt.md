# Check before backend deployment

- NEXT_PUBLIC_BACKEND_URL (frontend): change it to the production backend URL (https). User will do this while production is being deployed. Set it in the Vercel project env vars (Production, and Preview if used) BEFORE the build, then redeploy; NEXT_PUBLIC_* values are baked in at build time.
- Backend env: set FRONTEND_SUCCESS_URL and FRONTEND_FAILED_URL to the real production frontend https domain (CORS now allows only these origins; add CORS_ORIGINS=http://localhost:3000 locally for local dev).
- Backend env: set PHONEPE_ENV explicitly (production or sandbox); unset defaults to production.
- Backend env: leave ENFORCE_SUBSCRIPTION unset; set BASE_URL to the public https backend URL.
- Schedule POST /api/sub/expire daily with header X-Cron-Secret (see backend/DEPLOY.md).
- User to delete backend/.env.json (nothing reads it; second copy of live secrets).
- User to run: git rm -r --cached --ignore-unmatch -- backend/__pycache__ backend/routes/__pycache__ (untrack 17 .pyc files).
