#!/bin/sh
# Start the API. Dependencies are installed at build time (never here).
# Keep this command identical to the Procfile and the Dockerfile CMD.
exec gunicorn app:app --bind 0.0.0.0:${PORT:-8000} --workers ${WORKERS:-2} --timeout ${TIMEOUT:-60} --access-logfile - --error-logfile - --no-control-socket
