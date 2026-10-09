# Check before backend deployment

- NEXT_PUBLIC_BACKEND_URL (frontend): change it to the production backend URL (https). User will do this while production is being deployed. Set it in the Vercel project env vars (Production, and Preview if used) BEFORE the build, then redeploy; NEXT_PUBLIC_* values are baked in at build time.
