# Future list

- PhonePe webhook (after production launch).
- Deploy: set env vars in Elastic Beanstalk (JWT_SECRET, CRON_SECRET, ONE_MONTH_PRICE, THREE_MONTH_PRICE, PHONEPE_ENV, FRONTEND_SUCCESS_URL, FRONTEND_FAILED_URL); leave ENFORCE_SUBSCRIPTION unset.
- Cron job calling POST /api/sub/expire with X-Cron-Secret.
- "Clear a day": delete route or explicit empty row, so emptied saved rows are erased.
- Backend deploy cleanup: start.sh pip install, Python version mismatch, gunicorn WORKERS/TIMEOUT.
- Frontend lint: 47 errors.
- Git hygiene: untrack 17 __pycache__ files, remove `rought/.env` line in backend/.gitignore, remove duplicate `dotenv` in requirements.txt.
- Remove `meals` key fallback in backend/routes/meal.py.
- Save endpoints: DB error mid-save leaves partial data (use one batch upsert).
- Return generic errors instead of raw exception text in 500 responses.
- GET /api/stock/<y>/<m> has no error handling.
- Milk distribution choice cannot be un-picked once chosen.
- User to delete: agents/PROMPTS.md, agents/TASKS.md.
- Terms and Privacy pages: rewrite for MDM (they still say "Data Canvas", gov.nonexistential.dev, "user-uploaded spreadsheets"); review contact email and app metadata description later.
