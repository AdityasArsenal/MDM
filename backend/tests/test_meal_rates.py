import math
import os
import sys
import unittest
from unittest.mock import patch

os.environ.setdefault("JWT_SECRET", "test-secret-test-secret-test-secret-123")
os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_KEY", "x")
os.environ["ENFORCE_SUBSCRIPTION"] = "false"
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app
from auth_session import issue_token
import meal_calc
from meal_calc import usage, validate_rates, rates_from_row, rates_to_row


def rates(scale=1.0):
    return {
        "g1_5": {"rice_g": 100 * scale, "wheat_g": 100 * scale, "oil_g": 5 * scale, "pulse_g": 20 * scale, "sadilvaru": 2.15},
        "g6_10": {"rice_g": 150 * scale, "wheat_g": 150 * scale, "oil_g": 7.5 * scale, "pulse_g": 30 * scale, "sadilvaru": 3.12},
    }


class FakeDb:
    """In-memory stand-in for the db.py functions, keyed by (user_id, year, month)."""

    def __init__(self):
        self.rows = {}
        self.writes = []   # (user, year, month)
        self.plans = []

    def get_meal_rates(self, user_id, year, month):
        return self.rows.get((user_id, year, month))

    def get_latest_meal_rates_before(self, user_id, year, month):
        cands = [(y, m) for (u, y, m) in self.rows if u == user_id and (y, m) < (year, month)]
        return self.rows[(user_id, *max(cands))] if cands else None

    def upsert_meal_rates(self, user_id, year, month, row):
        self.writes.append((user_id, year, month))
        self.rows[(user_id, year, month)] = {**row, "user_id": user_id, "year": year, "month": month}

    def insert_meal_plan(self, **kw):
        self.plans.append(kw)


class Base(unittest.TestCase):
    def setUp(self):
        self.db = FakeDb()
        names = ["get_meal_rates", "get_latest_meal_rates_before", "upsert_meal_rates", "insert_meal_plan"]
        self.patches = [patch(f"routes.meal.{n}", getattr(self.db, n)) for n in names]
        for p in self.patches:
            p.start()
        self.client = app.test_client()

    def tearDown(self):
        for p in self.patches:
            p.stop()

    def h(self, user="A"):
        return {"Authorization": f"Bearer {issue_token(user)}"}

    def get(self, y, m, user="A"):
        return self.client.get(f"/api/meal/rates/{y}/{m}", headers=self.h(user))

    def put(self, y, m, body, user="A"):
        return self.client.put(f"/api/meal/rates/{y}/{m}", json=body, headers=self.h(user))

    def save(self, recs, user="A"):
        return self.client.post("/api/meal/save", json={"records": recs}, headers=self.h(user))


class RatesApi(Base):
    def test_first_time_none_no_write(self):
        r = self.get(2026, 10)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.get_json(), {"source": "none", "year": 2026, "month": 10, "inherited_from": None, "rates": None})
        self.assertEqual(self.db.writes, [])

    def test_save_then_load(self):
        r = self.put(2026, 10, {"rates": rates()})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.get_json()["source"], "saved")
        j = self.get(2026, 10).get_json()
        self.assertEqual(j["source"], "saved")
        self.assertEqual(j["rates"], rates())
        self.assertIsNone(j["inherited_from"])

    def test_user_isolation(self):
        self.put(2026, 10, {"rates": rates()}, user="A")
        self.assertEqual(self.get(2026, 10, user="B").get_json()["source"], "none")
        self.put(2026, 10, {"rates": rates(2)}, user="B")
        self.assertEqual(self.get(2026, 10, user="A").get_json()["rates"], rates())
        self.assertEqual(self.get(2026, 10, user="B").get_json()["rates"], rates(2))

    def test_body_user_id_ignored(self):
        self.put(2026, 10, {"user_id": "B", "rates": rates()}, user="A")
        self.assertEqual(self.db.writes, [("A", 2026, 10)])

    def test_month_isolation(self):
        self.put(2026, 10, {"rates": rates()})
        self.put(2026, 11, {"rates": rates(2)})
        self.assertEqual(self.get(2026, 10).get_json()["rates"], rates())
        self.put(2026, 10, {"rates": rates(3)})
        self.assertEqual(self.get(2026, 11).get_json()["rates"], rates(2))
        self.assertEqual(self.get(2026, 10).get_json()["rates"], rates(3))

    def test_groups_independent(self):
        r = rates()
        r["g1_5"]["rice_g"] = 111
        r["g6_10"]["rice_g"] = 222
        self.put(2026, 10, {"rates": r})
        j = self.get(2026, 10).get_json()["rates"]
        self.assertEqual(j["g1_5"]["rice_g"], 111)
        self.assertEqual(j["g6_10"]["rice_g"], 222)

    def test_carry_forward_and_get_never_writes(self):
        self.put(2026, 10, {"rates": rates()})
        n = len(self.db.writes)
        j = self.get(2026, 12).get_json()
        self.assertEqual(j["source"], "inherited")
        self.assertEqual(j["inherited_from"], {"year": 2026, "month": 10})
        self.assertEqual(j["rates"], rates())
        self.assertEqual(len(self.db.writes), n)
        self.assertNotIn(("A", 2026, 12), self.db.rows)

    def test_carry_forward_across_year(self):
        self.put(2026, 12, {"rates": rates()})
        j = self.get(2027, 1).get_json()
        self.assertEqual(j["inherited_from"], {"year": 2026, "month": 12})

    def test_earlier_month_not_inherited_from_later(self):
        self.put(2026, 12, {"rates": rates()})
        self.assertEqual(self.get(2026, 10).get_json()["source"], "none")

    def test_resave_earlier_changes_only_that_month(self):
        self.put(2026, 10, {"rates": rates()})
        self.put(2026, 11, {"rates": rates(2)})
        self.db.writes.clear()
        self.put(2026, 10, {"rates": rates(5)})
        self.assertEqual(self.db.writes, [("A", 2026, 10)])
        self.assertEqual(self.get(2026, 11).get_json()["rates"], rates(2))

    def test_decimal_grams(self):
        r = rates()
        r["g1_5"]["rice_g"] = 102.5
        self.assertEqual(self.put(2026, 10, {"rates": r}).status_code, 200)
        self.assertEqual(self.get(2026, 10).get_json()["rates"]["g1_5"]["rice_g"], 102.5)

    def test_invalid_values(self):
        def with_(group, field, val):
            r = rates()
            r[group][field] = val
            return r
        bad = [-1, "5", None, True, [1], {}]
        for v in bad:
            r = self.put(2026, 10, {"rates": with_("g1_5", "oil_g", v)})
            self.assertEqual(r.status_code, 400, v)
            self.assertIn("error", r.get_json())
        # NaN / Infinity as raw JSON tokens (Python's json accepts them)
        for tok in ("NaN", "Infinity", "-Infinity"):
            raw = '{"rates": %s}' % __import__("json").dumps(rates()).replace('"rice_g": 100.0', '"rice_g": ' + tok, 1)
            r = self.client.put("/api/meal/rates/2026/10", data=raw, headers=self.h(), content_type="application/json")
            self.assertEqual(r.status_code, 400, tok)
        self.assertEqual(self.db.writes, [])

    def test_missing_field_group_and_shape(self):
        r = rates(); del r["g6_10"]["pulse_g"]
        self.assertEqual(self.put(2026, 10, {"rates": r}).status_code, 400)
        r = rates(); del r["g6_10"]
        self.assertEqual(self.put(2026, 10, {"rates": r}).status_code, 400)
        r = rates(); r["g1_5"]["extra"] = 1
        self.assertEqual(self.put(2026, 10, {"rates": r}).status_code, 400)
        r = rates(); r["g11_12"] = r["g1_5"]
        self.assertEqual(self.put(2026, 10, {"rates": r}).status_code, 400)
        self.assertEqual(self.put(2026, 10, {}).status_code, 400)
        self.assertEqual(self.put(2026, 10, {"rates": []}).status_code, 400)
        r = self.client.put("/api/meal/rates/2026/10", data="nope", headers=self.h(), content_type="text/plain")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(self.db.writes, [])

    def test_bad_year_month(self):
        for y, m in [(2026, 0), (2026, 13), (1999, 5), (2101, 5)]:
            self.assertEqual(self.get(y, m).status_code, 400, (y, m))
            self.assertEqual(self.put(y, m, {"rates": rates()}).status_code, 400, (y, m))

    def test_db_failure_500(self):
        with patch("routes.meal.get_meal_rates", side_effect=RuntimeError("boom")):
            r = self.get(2026, 10)
        self.assertEqual(r.status_code, 500)
        self.assertEqual(r.get_json(), {"error": "boom"})

    def test_requires_auth(self):
        self.assertEqual(self.client.get("/api/meal/rates/2026/10").status_code, 401)


class SaveFreeze(Base):
    rec = {"date": "2026-11-03", "meal_type": "rice", "cnt_1to5": 2, "cnt_6to10": 3}

    def test_rates_not_configured_saves_nothing(self):
        r = self.save([self.rec])
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.get_json(), {"error": "Set the rates for this month first", "code": "rates_not_configured"})
        self.assertEqual(self.db.plans, [])
        self.assertEqual(self.db.writes, [])

    def test_freeze_inherited(self):
        self.put(2026, 10, {"rates": rates()})
        r = self.save([self.rec])
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(self.db.plans), 1)
        self.assertEqual(self.get(2026, 11).get_json()["source"], "saved")
        self.assertEqual(self.get(2026, 11).get_json()["rates"], rates())
        # later change to October no longer affects November
        self.put(2026, 10, {"rates": rates(9)})
        self.assertEqual(self.get(2026, 11).get_json()["rates"], rates())

    def test_saved_month_not_rewritten(self):
        self.put(2026, 11, {"rates": rates(2)})
        self.put(2026, 10, {"rates": rates()})
        self.db.writes.clear()
        self.assertEqual(self.save([self.rec]).status_code, 200)
        self.assertEqual(self.db.writes, [])

    def test_multiple_months(self):
        self.put(2026, 10, {"rates": rates()})
        recs = [self.rec, {"date": "2026-12-01", "meal_type": "wheat"}]
        self.assertEqual(self.save(recs).status_code, 200)
        self.assertIn(("A", 2026, 11), self.db.rows)
        self.assertIn(("A", 2026, 12), self.db.rows)

    def test_empty_records_no_extra(self):
        r = self.save([])
        self.assertEqual(r.status_code, 200)
        self.assertEqual(self.db.writes, [])

    def test_invalid_record_still_400_and_no_freeze(self):
        self.put(2026, 10, {"rates": rates()})
        self.db.writes.clear()
        r = self.save([self.rec, {"date": "2026-11-04", "meal_type": "tea"}])
        self.assertEqual(r.status_code, 400)
        self.assertEqual(self.db.writes, [])
        self.assertEqual(self.db.plans, [])

    def test_meals_key_fallback(self):
        self.put(2026, 10, {"rates": rates()})
        r = self.client.post("/api/meal/save", json={"meals": [self.rec]}, headers=self.h())
        self.assertEqual(r.status_code, 200)

    def test_no_freeze_for_other_user(self):
        self.put(2026, 10, {"rates": rates()}, user="B")
        self.assertEqual(self.save([self.rec], user="A").status_code, 400)


class Calc(unittest.TestCase):
    G = rates()["g1_5"]

    def test_rice_kg(self):
        g = {**self.G, "rice_g": 100}
        self.assertAlmostEqual(usage(g, 30, "rice", False)["rice"], 3.0)

    def test_wheat_day_rice_zero(self):
        u = usage(self.G, 30, "wheat", False)
        self.assertEqual(u["rice"], 0)
        self.assertAlmostEqual(u["wheat"], 3.0)

    def test_oil_always_pulse_conditional(self):
        u = usage(self.G, 100, "rice", False)
        self.assertAlmostEqual(u["oil"], 0.5)
        self.assertEqual(u["pulse"], 0)
        self.assertAlmostEqual(usage(self.G, 100, "rice", True)["pulse"], 2.0)

    def test_sadilvaru_not_divided(self):
        self.assertAlmostEqual(usage(self.G, 10, "rice", False)["sadilvaru"], 21.5)

    def test_no_meal_type_zeros(self):
        for mt in (None, ""):
            self.assertEqual(set(usage(self.G, 50, mt, True).values()), {0.0})

    def test_matches_frontend_defaults(self):
        # frontend 1-5: rice 0.1 kg/child == 100 g, 6-10: 0.15 == 150 g
        self.assertAlmostEqual(usage(rates()["g6_10"], 10, "rice", True)["rice"], 1.5)
        self.assertAlmostEqual(usage(rates()["g6_10"], 10, "rice", True)["oil"], 0.075)

    def test_row_roundtrip(self):
        row = rates_to_row(rates())
        self.assertEqual(row["g15_rice_g"], 100.0)
        self.assertEqual(row["g610_sadilvaru"], 3.12)
        self.assertEqual(rates_from_row(row), rates())
        # DB numeric may come back as string/Decimal-like
        row["g15_rice_g"] = "102.50"
        self.assertEqual(rates_from_row(row)["g1_5"]["rice_g"], 102.5)

    def test_validate_edge(self):
        self.assertEqual(validate_rates(rates())[1], None)
        r = rates(); r["g1_5"]["rice_g"] = 0
        self.assertIsNone(validate_rates(r)[1])
        r["g1_5"]["rice_g"] = math.nan
        self.assertIsNotNone(validate_rates(r)[1])


if __name__ == "__main__":
    unittest.main(verbosity=2)
