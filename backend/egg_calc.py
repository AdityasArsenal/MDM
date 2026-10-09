"""
Egg-page rate layer (pure, no I/O).

Units as stored and entered: egg_price and banana_price are rupees per egg / per
banana. Nothing is converted on the backend.
"""

import math

RATE_FIELDS = ('egg_price', 'banana_price')


def rates_from_row(row):
    """DB row -> {'egg_price': float, 'banana_price': float}"""
    return {f: float(row[f]) for f in RATE_FIELDS}


def rates_to_row(rates):
    """Rates dict -> dict of DB columns (floats)"""
    return {f: float(rates[f]) for f in RATE_FIELDS}


def _is_rate(v):
    return (
        isinstance(v, (int, float))
        and not isinstance(v, bool)
        and math.isfinite(v)
        and v >= 0
    )


def validate_rates(obj):
    """Return (clean, None) or (None, reason). Unknown or missing keys are rejected."""
    if not isinstance(obj, dict):
        return None, 'rates must be an object'

    unknown = set(obj) - set(RATE_FIELDS)
    if unknown:
        return None, f'Unknown field: {sorted(unknown)[0]}'

    clean = {}
    for f in RATE_FIELDS:
        if f not in obj:
            return None, f'{f} is required'
        v = obj[f]
        if not _is_rate(v):
            return None, f'{f} must be a finite number >= 0'
        clean[f] = float(v)
    return clean, None
