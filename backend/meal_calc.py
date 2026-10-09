"""
Shared meal-rate calculation layer (pure, no I/O).

Units: rice_g / wheat_g / pulse_g are GRAMS PER CHILD; oil_ml is MILLILITRES PER
CHILD; sadilvaru is RUPEES PER CHILD. Usage: rice/wheat/pulse in kg =
grams * children / 1000; oil in litres = oil_ml * children / 1000;
sadilvaru (rupees) = rate * children (not divided by 1000).
"""

import math

RATE_FIELDS = ('rice_g', 'wheat_g', 'oil_ml', 'pulse_g', 'sadilvaru')
GROUPS = ('g1_5', 'g6_10')

# DB column prefix for each group
_PREFIX = {'g1_5': 'g15_', 'g6_10': 'g610_'}


def rates_from_row(row):
    """DB row (g15_*, g610_* columns) -> {'g1_5': {...}, 'g6_10': {...}} with floats"""
    return {
        group: {f: float(row[_PREFIX[group] + f]) for f in RATE_FIELDS}
        for group in GROUPS
    }


def rates_to_row(rates):
    """{'g1_5': {...}, 'g6_10': {...}} -> flat dict of DB columns"""
    row = {}
    for group in GROUPS:
        for f in RATE_FIELDS:
            row[_PREFIX[group] + f] = float(rates[group][f])
    return row


def _is_rate(v):
    return (
        isinstance(v, (int, float))
        and not isinstance(v, bool)
        and math.isfinite(v)
        and v >= 0
    )


def validate_rates(obj):
    """Return (clean, None) or (None, reason). Unknown keys are rejected."""
    if not isinstance(obj, dict):
        return None, 'rates must be an object'

    unknown = set(obj) - set(GROUPS)
    if unknown:
        return None, f'Unknown group: {sorted(unknown)[0]}'

    clean = {}
    for group in GROUPS:
        g = obj.get(group)
        if not isinstance(g, dict):
            return None, f'{group} is required and must be an object'
        unknown = set(g) - set(RATE_FIELDS)
        if unknown:
            return None, f'{group}: unknown field {sorted(unknown)[0]}'
        clean[group] = {}
        for f in RATE_FIELDS:
            if f not in g:
                return None, f'{group}.{f} is required'
            v = g[f]
            if not _is_rate(v):
                return None, f'{group}.{f} must be a finite number >= 0'
            clean[group][f] = float(v)
    return clean, None


def usage(group_rates, count, meal_type, has_pulses):
    """Per-day usage for one group. rice/wheat/pulse in kg, oil in LITRES, sadilvaru in rupees (rate*count)."""
    if not meal_type:
        return {'rice': 0.0, 'wheat': 0.0, 'oil': 0.0, 'pulse': 0.0, 'sadilvaru': 0.0}

    count = count or 0
    per_1000 = lambda field: group_rates[field] * count / 1000  # g -> kg, ml -> L
    return {
        'rice': per_1000('rice_g') if meal_type == 'rice' else 0.0,
        'wheat': per_1000('wheat_g') if meal_type == 'wheat' else 0.0,
        'oil': per_1000('oil_ml'),
        'pulse': per_1000('pulse_g') if has_pulses else 0.0,
        'sadilvaru': group_rates['sadilvaru'] * count,
    }
