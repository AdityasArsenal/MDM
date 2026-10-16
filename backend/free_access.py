"""
"Free access until a date" switch.

The date lives in the database (app_settings, key 'free_until', value 'YYYY-MM-DD').
Until that date (inclusive, in India time) every logged-in user has full access and
no payment is asked or accepted. From the next day the normal paywall applies.
Login is always required; this module only decides whether payment is needed.

India time is a fixed UTC+05:30 (no DST), so no tz database is needed.
"""

import logging
import time
from datetime import date, datetime, timedelta, timezone

from db import get_app_setting

logger = logging.getLogger(__name__)

IST = timezone(timedelta(hours=5, minutes=30))
SETTING_KEY = "free_until"
CACHE_SECONDS = 60

_cache = None  # (expires_at on the monotonic clock, parsed date or None)
_warned_values = set()

_MONTHS = ["January", "February", "March", "April", "May", "June", "July",
           "August", "September", "October", "November", "December"]


def _now_ist():
    return datetime.now(IST)


def _monotonic():
    return time.monotonic()


def reset_cache():
    """Forget the cached setting (for tests)"""
    global _cache
    _cache = None
    _warned_values.clear()


def get_free_until():
    """
    The last free day as a date, or None. Cached for CACHE_SECONDS, None included.
    A value that is not a valid YYYY-MM-DD date is logged once and treated as None.
    Database errors are not cached and propagate to the caller.
    """
    global _cache
    now = _monotonic()
    cached = _cache
    if cached is not None and cached[0] > now:
        return cached[1]

    raw = get_app_setting(SETTING_KEY)  # may raise: deliberately not cached
    free_until = None
    if raw is not None and str(raw).strip():
        try:
            free_until = date.fromisoformat(str(raw).strip())
        except ValueError:
            if raw not in _warned_values:
                _warned_values.add(raw)
                logger.error("Setting %s has an invalid date, treating as no free access", SETTING_KEY)
    _cache = (now + CACHE_SECONDS, free_until)
    return free_until


def _is_free(free_until):
    return free_until is not None and _now_ist().date() <= free_until


def is_free_now():
    """True while today (India time) is on or before free_until"""
    return _is_free(get_free_until())


def free_info():
    """{'free_access': bool, 'free_until': 'YYYY-MM-DD' or None}, from a single read"""
    free_until = get_free_until()
    return {
        "free_access": _is_free(free_until),
        "free_until": free_until.isoformat() if free_until else None,
    }


def format_date(d):
    """'31 December 2026'. Not strftime, so it does not depend on the locale."""
    return f"{d.day} {_MONTHS[d.month - 1]} {d.year}"
