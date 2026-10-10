# Deploying the MDM backend

The backend is a Flask app served by gunicorn (`app:app`). It runs the same way on any host: as a Docker image, or from the `Procfile` / `start.sh`. Python is **3.10.19** everywhere (Dockerfile, `runtime.txt`, local venv).

Secrets are never part of the repo or the image. They are supplied by the host as environment variables (or with `docker run --env-file`). Never commit `.env`, `.env.*` or `.env.json`.

## Start command (identical in Dockerfile, Procfile and start.sh)

```
gunicorn app:app --bind 0.0.0.0:${PORT:-8000} --workers ${WORKERS:-2} --timeout ${TIMEOUT:-60} --access-logfile - --error-logfile - --no-control-socket
```

Logs go to stdout/stderr. Dependencies are installed at build time only (`pip install -r requirements.txt`); nothing installs at start.

## Docker: build and run locally

```bash
cd backend
docker build -t mdm-backend .

# Keep the env file OUTSIDE the repo or at least git-ignored. It is read at run time, not baked into the image.
docker run --rm -p 8000:8000 --env-file /path/to/mdm-backend.env mdm-backend

curl -s http://localhost:8000/health        # {"status":"ok"}
```

The image runs as a non-root user and has a `HEALTHCHECK` on `GET /health`. `.dockerignore` excludes env files, `menv/`, caches, `.git` and `tests/`.

## Procfile / buildpack style hosts

Build command: `pip install -r requirements.txt`. Run command: the `Procfile` `web:` line (or `./start.sh`). Set the variables below in the host's settings.

## Environment variables (names only, set values in the host)

| Name | Required | Default | Meaning |
|---|---|---|---|
| `SUPABASE_URL` | yes | none | Supabase project URL. App fails at import if missing. |
| `SUPABASE_KEY` | yes | none | Supabase API key used by the backend. Server-side only. |
| `JWT_SECRET` | yes | none | Signs session tokens (HS256). Use 32+ random characters. Changing it logs everyone out. |
| `GOOGLE_CLIENT_ID` | yes | none | Google OAuth client id used to verify login tokens. Without it `/api/auth/login` returns 500. |
| `ONE_MONTH_PRICE` | yes | none | 1-month plan price in rupees (number > 0). App fails at import if missing/invalid. |
| `THREE_MONTH_PRICE` | yes | none | 3-month plan price in rupees (number > 0). |
| `PHONEPE_CLIENT_ID` | yes (payments) | none | PhonePe merchant client id. Missing => payment routes return 503, app still starts. |
| `PHONEPE_CLIENT_SECRET` | yes (payments) | none | PhonePe client secret. |
| `CLIENT_VERSION` | yes (payments) | none | PhonePe client version (integer). |
| `PHONEPE_ENV` | optional | `production` | `production` or `sandbox`. Must match the PhonePe credentials used. |
| `BASE_URL` | yes (payments) | none | Public **https** URL of this backend, no trailing slash. PhonePe redirects the user to `BASE_URL/api/pay/status/<order>`. |
| `FRONTEND_SUCCESS_URL` | yes (payments) | none | Frontend page after a successful payment (https). |
| `FRONTEND_FAILED_URL` | yes (payments) | none | Frontend page after a failed/pending payment (https). |
| `CORS_ORIGINS` | optional | none | Extra browser origins allowed to call `/api/*`, comma-separated (for example `http://localhost:3000` for local development). The origins of `FRONTEND_SUCCESS_URL` and `FRONTEND_FAILED_URL` are always allowed; anything else is blocked. |
| `CRON_SECRET` | yes (expiry job) | none | Shared secret for `POST /api/sub/expire`. If unset the endpoint always returns 403. 32+ random characters. |
| `PORT` | optional | `8000` | Port gunicorn binds to (many hosts set it for you). |
| `WORKERS` | optional | `2` | gunicorn worker processes. |
| `TIMEOUT` | optional | `60` | gunicorn worker timeout, seconds. |
| `ENFORCE_SUBSCRIPTION` | **leave unset** | `true` | Setting it to `false` turns the paywall OFF for all data routes. Local development only. |

Not read by the code (do not bother setting): `HOST`, `FLASK_ENV`, `FLASK_DEBUG`, `DEBUG`, `WEBHOOK_USERNAME`, `WEBHOOK_PASSWORD`.

Generate secrets with: `python -c "import secrets; print(secrets.token_urlsafe(48))"`.

## Health check

`GET /health` returns `{"status":"ok"}` with HTTP 200. It does not touch the database or PhonePe, so it only proves the process is up. Point the host's health check at it.

## Daily subscription expiry job (NOT scheduled by anything yet)

`POST /api/sub/expire` marks lapsed subscriptions as expired. Nothing in the app schedules it, so **a scheduler on the host must call it once a day**. It requires the header `X-Cron-Secret` equal to `CRON_SECRET`.

```bash
# one-off test
curl -fsS -X POST -H "X-Cron-Secret: $CRON_SECRET" https://<BACKEND_DOMAIN>/api/sub/expire
# expected: {"status":"success"}

# crontab line (daily at 00:10 server time); keep the secret in the cron environment, not in the repo
10 0 * * * curl -fsS -X POST -H "X-Cron-Secret: ${CRON_SECRET}" https://<BACKEND_DOMAIN>/api/sub/expire >/dev/null
```

Any host scheduler works (cron, the host's scheduled jobs, GitHub Actions `schedule:` with `CRON_SECRET` stored as a repository secret). A 403 means the header does not match or `CRON_SECRET` is unset on the server.

## Pre-deploy checklist

- All required variables above are set in the host; `BASE_URL` and both `FRONTEND_*_URL` are production **https** domains (not localhost/ngrok).
- `PHONEPE_ENV` matches the credentials (`production` for live, `sandbox` for test).
- `ENFORCE_SUBSCRIPTION` is not set.
- CORS: only the origins of `FRONTEND_SUCCESS_URL` / `FRONTEND_FAILED_URL` (plus `CORS_ORIGINS`) are allowed. Check these two URLs use the real frontend domain, or the browser will block every API call.
- `/health` is wired to the host health check; the daily `/api/sub/expire` job is scheduled.
