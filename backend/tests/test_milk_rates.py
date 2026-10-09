import json
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
from milk_calc import validate_rates, rates_from_row, rates_to_row


def rates(scale=1.0):
    return {"milk_ml": 150 * scale, "ragi_g": 20 * scale, "sugar_rupees": 0.5 * scale}


class FakeDb:
    """In-memory stand-in for the db.py functions, keyed by (user_id, year, month)."""

    def __init__(self):
        self.rows = {}
        self.writes = []   # (user, year, month)
        self.records = []  # insert_milk_record args

    def get_milk_rates(self, user_id, year, month):
        return self.rows.get((user_id, year, month))

    def get_latest_milk_rates_before(self, user_id, year, month):
        cands = [(y, m) for (u, y, m) in self.rows if u == user_id and (y, m) < (year, month)]
        return self.rows[(user_id, *max(cands))] if cands else None

    def upsert_milk_rates(self, user_id, year, month, row):
        self.writes.append((user_id, year, month))
        self.rows[(user_id, year, month)] = {**row, "user_id": user_id, "year": year, "month": month}

    def insert_milk_record(self, *args):
        self.records.append(args)


class Base(unittest.TestCase):
    def setUp(self):
        self.db = FakeDb()
        names = ["get_milk_rates", "get_latest_milk_rates_before", "upsert_milk_rates", "insert_milk_record"]
        self.patches = [patch(f"routes.milk.{n}", getattr(self.db, n)) for n in names]
        for p in self.patches:
            p.start()
        self.client = app.test_client()

    def tearDown(self):
        for p in self.patches:
            p.stop()

    def h(self, user="A"):
        return {"Authorization": f"Bearer {issue_token(user)}"}

    def get(self, y, m, user="A"):
        return self.client.get(f"/api/milk/rates/{y}/{m}", headers=self.h(user))

    def put(self, y, m, body, user="A"):
        return self.client.put(f"/api/milk/rates/{y}/{m}", json=body, headers=self.h(user))

    def save(self, recs, user="A"):
        return self.client.post("/api/milk/save", json={"records": recs}, headers=self.h(user))


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

    def test_decimals(self):
        r = {"milk_ml": 18.5, "ragi_g": 12.25, "sugar_rupees": 0.35}
        self.assertEqual(self.put(2026, 10, {"rates": r}).status_code, 200)
        self.assertEqual(self.get(2026, 10).get_json()["rates"], r)

    def test_zero_allowed(self):
        r = {"milk_ml": 0, "ragi_g": 0, "sugar_rupees": 0}
        self.assertEqual(self.put(2026, 10, {"rates": r}).status_code, 200)

    def test_invalid_values(self):
        for field in ("milk_ml", "ragi_g", "sugar_rupees"):
            for v in (-1, "5", None, True, False, [1], {}):
                r = rates()
                r[field] = v
                resp = self.put(2026, 10, {"rates": r})
                self.assertEqual(resp.status_code, 400, (field, v))
                self.assertIn("error", resp.get_json())
        # NaN / Infinity as raw JSON tokens (Python's json accepts them)
        for tok in ("NaN", "Infinity", "-Infinity"):
            raw = '{"rates": %s}' % json.dumps(rates()).replace('"milk_ml": 150.0', '"milk_ml": ' + tok, 1)
            self.assertIn(tok, raw)
            r = self.client.put("/api/milk/rates/2026/10", data=raw, headers=self.h(), content_type="application/json")
            self.assertEqual(r.status_code, 400, tok)
        self.assertEqual(self.db.writes, [])

    def test_missing_unknown_and_shape(self):
        r = rates(); del r["ragi_g"]
        self.assertEqual(self.put(2026, 10, {"rates": r}).status_code, 400)
        r = rates(); r["extra"] = 1
        self.assertEqual(self.put(2026, 10, {"rates": r}).status_code, 400)
        self.assertEqual(self.put(2026, 10, {}).status_code, 400)
        self.assertEqual(self.put(2026, 10, {"rates": None}).status_code, 400)
        self.assertEqual(self.put(2026, 10, {"rates": []}).status_code, 400)
        self.assertEqual(self.put(2026, 10, {"rates": "x"}).status_code, 400)
        r = self.client.put("/api/milk/rates/2026/10", data="nope", headers=self.h(), content_type="text/plain")
        self.assertEqual(r.status_code, 400)
        r = self.client.put("/api/milk/rates/2026/10", json=[1], headers=self.h())
        self.assertEqual(r.status_code, 400)
        self.assertEqual(self.db.writes, [])

    def test_bad_year_month(self):
        for y, m in [(2026, 0), (2026, 13), (1999, 5), (2101, 5)]:
            self.assertEqual(self.get(y, m).status_code, 400, (y, m))
            self.assertEqual(self.put(y, m, {"rates": rates()}).status_code, 400, (y, m))

    def test_db_failure_500(self):
        with patch("routes.milk.get_milk_rates", side_effect=RuntimeError("boom")):
            r = self.get(2026, 10)
        self.assertEqual(r.status_code, 500)
        self.assertEqual(r.get_json(), {"error": "boom"})

    def test_put_db_failure_500(self):
        with patch("routes.milk.upsert_milk_rates", side_effect=RuntimeError("boom")):
            r = self.put(2026, 10, {"rates": rates()})
        self.assertEqual(r.status_code, 500)
        self.assertEqual(r.get_json(), {"error": "boom"})

    def test_requires_auth(self):
        self.assertEqual(self.client.get("/api/milk/rates/2026/10").status_code, 401)
        self.assertEqual(self.client.put("/api/milk/rates/2026/10", json={"rates": rates()}).status_code, 401)
        self.assertEqual(self.client.post("/api/milk/save", json={"records": []}).status_code, 401)


class SaveFreeze(Base):
    rec = {"date": "2026-11-03", "children": 20, "milk_open": 0, "ragi_open": 0,
           "milk_rcpt": 5, "ragi_rcpt": 0, "dist_type": "milk & ragi"}

    def test_rates_not_configured_saves_nothing(self):
        r = self.save([self.rec])
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.get_json(), {"error": "Set the rates for this month first", "code": "rates_not_configured"})
        self.assertEqual(self.db.records, [])
        self.assertEqual(self.db.writes, [])

    def test_not_configured_is_all_or_nothing_across_months(self):
        # October has rates: November would inherit, but September has no earlier rates.
        # The request fails and November is not frozen either.
        self.put(2026, 10, {"rates": rates()})
        self.db.writes.clear()
        r = self.save([self.rec, dict(self.rec, date="2026-09-03")])
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.get_json()["code"], "rates_not_configured")
        self.assertEqual(self.db.records, [])
        self.assertEqual(self.db.writes, [])

    def test_freeze_inherited(self):
        self.put(2026, 10, {"rates": rates()})
        r = self.save([self.rec])
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(self.db.records), 1)
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
        recs = [self.rec, dict(self.rec, date="2026-12-01")]
        self.assertEqual(self.save(recs).status_code, 200)
        self.assertIn(("A", 2026, 11), self.db.rows)
        self.assertIn(("A", 2026, 12), self.db.rows)

    def test_untouched_rows_do_not_trigger_gate(self):
        r = self.save([{"date": "2026-11-03"}, {"date": "2026-11-04", "dist_type": None}])
        self.assertEqual(r.status_code, 200)
        self.assertEqual(self.db.writes, [])
        self.assertEqual(self.db.records, [])

    def test_untouched_row_month_not_frozen(self):
        self.put(2026, 10, {"rates": rates()})
        self.db.writes.clear()
        # November row is untouched (skipped); only the October row is written
        r = self.save([{"date": "2026-11-03"}, dict(self.rec, date="2026-10-05")])
        self.assertEqual(r.status_code, 200)
        self.assertEqual(self.db.writes, [])
        self.assertEqual(len(self.db.records), 1)

    def test_all_zero_with_dist_type_is_written_and_gated(self):
        row = {"date": "2026-11-03", "dist_type": "only milk"}
        self.assertEqual(self.save([row]).status_code, 400)
        self.put(2026, 10, {"rates": rates()})
        self.assertEqual(self.save([row]).status_code, 200)
        self.assertEqual(len(self.db.records), 1)

    def test_empty_records_no_extra(self):
        r = self.save([])
        self.assertEqual(r.status_code, 200)
        self.assertEqual(self.db.writes, [])

    def test_invalid_record_still_400_and_no_freeze(self):
        self.put(2026, 10, {"rates": rates()})
        self.db.writes.clear()
        r = self.save([self.rec, {"date": "2026-11-04", "children": 1.5}])
        self.assertEqual(r.status_code, 400)
        self.assertTrue(r.get_json()["error"].startswith("Record 1:"))
        self.assertEqual(self.db.writes, [])
        self.assertEqual(self.db.records, [])

    def test_no_freeze_from_other_user(self):
        self.put(2026, 10, {"rates": rates()}, user="B")
        self.assertEqual(self.save([self.rec], user="A").status_code, 400)

    def test_rates_queries_use_session_user(self):
        self.put(2026, 10, {"rates": rates()}, user="A")
        self.save([self.rec], user="A")
        self.assertIn(("A", 2026, 11), self.db.rows)
        self.assertNotIn(("B", 2026, 11), self.db.rows)


class SaveValidationStillWorks(Base):
    def setUp(self):
        super().setUp()
        self.put(2026, 10, {"rates": rates()})
        self.db.writes.clear()

    def test_negative_opening_stock_allowed(self):
        r = self.save([{"date": "2026-10-05", "children": 10, "milk_open": -3.5, "ragi_open": -1}])
        self.assertEqual(r.status_code, 200)
        self.assertEqual(self.db.records[0][3:5], (-3.5, -1))

    def test_negative_receipt_rejected(self):
        for k in ("children", "milk_rcpt", "ragi_rcpt"):
            r = self.save([{"date": "2026-10-05", k: -1}])
            self.assertEqual(r.status_code, 400, k)
        self.assertEqual(self.db.records, [])

    def test_bad_date_and_types(self):
        for rec in ({"date": "2026-02-30"}, {"date": "x"}, {"date": "2026-10-05", "milk_rcpt": "3"},
                    {"date": "2026-10-05", "children": 1.5}, {"date": "2026-10-05", "dist_type": 5}):
            self.assertEqual(self.save([rec]).status_code, 400, rec)
        self.assertEqual(self.db.records, [])

    def test_whole_float_children_and_null_dist_type(self):
        r = self.save([{"date": "2026-10-05", "children": 30.0, "dist_type": ""}])
        self.assertEqual(r.status_code, 200)
        self.assertEqual(self.db.records[0][2], 30)
        self.assertIsInstance(self.db.records[0][2], int)
        self.assertIsNone(self.db.records[0][7])

    def test_non_json_and_non_list(self):
        r = self.client.post("/api/milk/save", data="x", headers=self.h(), content_type="text/plain")
        self.assertEqual(r.status_code, 400)
        r = self.client.post("/api/milk/save", json={"records": {"a": 1}}, headers=self.h())
        self.assertEqual(r.status_code, 400)

    def test_get_missing_numeric_key(self):
        rec = [{"id": 1, "user_id": 2, "date": "2026-10-05", "milk_open": "1.5", "dist_type": None}]
        with patch("routes.milk.get_milk_records", return_value=rec):
            r = self.client.get("/api/milk/2026/10", headers=self.h())
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.get_json()[0]["milk_open"], 1.5)
        self.assertIsNone(r.get_json()[0]["dist_type"])


class Calc(unittest.TestCase):
    def test_row_roundtrip(self):
        row = rates_to_row(rates())
        self.assertEqual(row, {"milk_ml": 150.0, "ragi_g": 20.0, "sugar_rupees": 0.5})
        self.assertEqual(rates_from_row(row), rates())
        # DB numeric may come back as a string
        self.assertEqual(rates_from_row({"milk_ml": "18.50", "ragi_g": "20", "sugar_rupees": "0.5"})["milk_ml"], 18.5)

    def test_validate_edge(self):
        self.assertEqual(validate_rates(rates()), (rates(), None))
        for bad in (math.nan, math.inf, -math.inf, -0.01, True, "1", None):
            r = rates(); r["ragi_g"] = bad
            self.assertIsNotNone(validate_rates(r)[1], bad)
        self.assertIsNotNone(validate_rates(None)[1])


if __name__ == "__main__":
    unittest.main(verbosity=2)
