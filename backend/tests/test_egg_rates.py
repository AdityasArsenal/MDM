import json
import math
import os
import sys
import unittest
from unittest.mock import MagicMock, patch

os.environ.setdefault("JWT_SECRET", "test-secret-test-secret-test-secret-123")
os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_KEY", "x")
os.environ["ENFORCE_SUBSCRIPTION"] = "false"
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app
import db
from auth_session import issue_token
from egg_calc import validate_rates, rates_from_row, rates_to_row


def rates(scale=1.0):
    return {"egg_price": 6 * scale, "banana_price": 5 * scale}


class FakeDb:
    """In-memory stand-in for the db.py functions, keyed by (user_id, year, month)."""

    def __init__(self):
        self.rows = {}
        self.writes = []   # (user, year, month) rate writes
        self.records = []  # insert_egg_record kwargs

    def get_egg_rates(self, user_id, year, month):
        return self.rows.get((user_id, year, month))

    def get_latest_egg_rates_before(self, user_id, year, month):
        cands = [(y, m) for (u, y, m) in self.rows if u == user_id and (y, m) < (year, month)]
        return self.rows[(user_id, *max(cands))] if cands else None

    def upsert_egg_rates(self, user_id, year, month, row):
        self.writes.append((user_id, year, month))
        self.rows[(user_id, year, month)] = {**row, "user_id": user_id, "year": year, "month": month}

    def insert_egg_record(self, **kwargs):
        self.records.append(kwargs)


class Base(unittest.TestCase):
    def setUp(self):
        self.db = FakeDb()
        names = ["get_egg_rates", "get_latest_egg_rates_before", "upsert_egg_rates", "insert_egg_record"]
        self.patches = [patch(f"routes.egg.{n}", getattr(self.db, n)) for n in names]
        for p in self.patches:
            p.start()
        self.client = app.test_client()

    def tearDown(self):
        for p in self.patches:
            p.stop()

    def h(self, user="A"):
        return {"Authorization": f"Bearer {issue_token(user)}"}

    def get(self, y, m, user="A"):
        return self.client.get(f"/api/egg/rates/{y}/{m}", headers=self.h(user))

    def put(self, y, m, body, user="A"):
        return self.client.put(f"/api/egg/rates/{y}/{m}", json=body, headers=self.h(user))

    def save(self, recs, user="A"):
        return self.client.post("/api/egg/save", json={"records": recs}, headers=self.h(user))


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
        r = {"egg_price": 6.5, "banana_price": 4.25}
        self.assertEqual(self.put(2026, 10, {"rates": r}).status_code, 200)
        self.assertEqual(self.get(2026, 10).get_json()["rates"], r)

    def test_zero_allowed(self):
        r = {"egg_price": 0, "banana_price": 0}
        self.assertEqual(self.put(2026, 10, {"rates": r}).status_code, 200)
        self.assertEqual(self.get(2026, 10).get_json()["rates"], {"egg_price": 0.0, "banana_price": 0.0})

    def test_invalid_values(self):
        for field in ("egg_price", "banana_price"):
            for v in (-1, "5", None, True, False, [1], {}):
                r = rates()
                r[field] = v
                resp = self.put(2026, 10, {"rates": r})
                self.assertEqual(resp.status_code, 400, (field, v))
                self.assertIn("error", resp.get_json())
        # NaN / Infinity as raw JSON tokens (Python's json accepts them)
        for tok in ("NaN", "Infinity", "-Infinity"):
            raw = '{"rates": %s}' % json.dumps(rates()).replace('"egg_price": 6.0', '"egg_price": ' + tok, 1)
            self.assertIn(tok, raw)
            r = self.client.put("/api/egg/rates/2026/10", data=raw, headers=self.h(), content_type="application/json")
            self.assertEqual(r.status_code, 400, tok)
        self.assertEqual(self.db.writes, [])

    def test_missing_unknown_and_shape(self):
        r = rates(); del r["banana_price"]
        self.assertEqual(self.put(2026, 10, {"rates": r}).status_code, 400)
        r = rates(); r["extra"] = 1
        self.assertEqual(self.put(2026, 10, {"rates": r}).status_code, 400)
        self.assertEqual(self.put(2026, 10, {}).status_code, 400)
        self.assertEqual(self.put(2026, 10, {"rates": None}).status_code, 400)
        self.assertEqual(self.put(2026, 10, {"rates": []}).status_code, 400)
        self.assertEqual(self.put(2026, 10, {"rates": "x"}).status_code, 400)
        r = self.client.put("/api/egg/rates/2026/10", data="nope", headers=self.h(), content_type="text/plain")
        self.assertEqual(r.status_code, 400)
        r = self.client.put("/api/egg/rates/2026/10", json=[1], headers=self.h())
        self.assertEqual(r.status_code, 400)
        self.assertEqual(self.db.writes, [])

    def test_bad_year_month(self):
        for y, m in [(2026, 0), (2026, 13), (1999, 5), (2101, 5)]:
            self.assertEqual(self.get(y, m).status_code, 400, (y, m))
            self.assertEqual(self.put(y, m, {"rates": rates()}).status_code, 400, (y, m))

    def test_db_failure_500(self):
        with patch("routes.egg.get_egg_rates", side_effect=RuntimeError("boom")):
            r = self.get(2026, 10)
        self.assertEqual(r.status_code, 500)
        self.assertEqual(r.get_json(), {"error": "boom"})

    def test_put_db_failure_500(self):
        with patch("routes.egg.upsert_egg_rates", side_effect=RuntimeError("boom")):
            r = self.put(2026, 10, {"rates": rates()})
        self.assertEqual(r.status_code, 500)
        self.assertEqual(r.get_json(), {"error": "boom"})

    def test_requires_auth(self):
        self.assertEqual(self.client.get("/api/egg/rates/2026/10").status_code, 401)
        self.assertEqual(self.client.put("/api/egg/rates/2026/10", json={"rates": rates()}).status_code, 401)
        self.assertEqual(self.client.post("/api/egg/save", json={"records": []}).status_code, 401)
        self.assertEqual(self.client.get("/api/egg/2026/10").status_code, 401)


class SaveFreeze(Base):
    rec = {"date": "2026-11-03", "payer": "APF", "egg_m": 20, "egg_f": 18, "banana_m": 0, "banana_f": 0}

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

    def test_non_padded_date_month(self):
        self.put(2026, 10, {"rates": rates()})
        self.assertEqual(self.save([dict(self.rec, date="2026-11-3")]).status_code, 200)
        self.assertIn(("A", 2026, 11), self.db.rows)

    def test_empty_records_no_extra(self):
        r = self.save([])
        self.assertEqual(r.status_code, 200)
        self.assertEqual(self.db.writes, [])

    def test_invalid_record_still_400_and_no_freeze(self):
        self.put(2026, 10, {"rates": rates()})
        self.db.writes.clear()
        r = self.save([self.rec, {"date": "2026-11-04", "egg_m": 1.5}])
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
        self.assertEqual(self.db.records[0]["user_id"], "A")


class SaveNoPrices(Base):
    def setUp(self):
        super().setUp()
        self.put(2026, 10, {"rates": rates()})

    def test_record_call_has_no_price_args(self):
        r = self.save([{"date": "2026-10-05", "egg_m": 3, "egg_price": 99, "banana_price": 88}])
        self.assertEqual(r.status_code, 200)
        self.assertEqual(set(self.db.records[0]),
                         {"user_id", "date", "payer", "egg_m", "egg_f", "banana_m", "banana_f"})

    def test_old_client_invalid_prices_ignored(self):
        r = self.save([{"date": "2026-10-05", "egg_price": -5, "banana_price": "x"}])
        self.assertEqual(r.status_code, 200)

    def test_upsert_payload_has_no_price_keys(self):
        fake = MagicMock()
        with patch.object(db, "supabase", fake):
            db.insert_egg_record("A", "2026-10-05", "APF", 1, 2, 3, 4)
        payload = fake.table.call_args_list and fake.table.return_value.upsert.call_args[0][0]
        fake.table.assert_called_with("egg")
        self.assertEqual(payload, {"user_id": "A", "date": "2026-10-05", "payer": "APF",
                                   "egg_m": 1, "egg_f": 2, "banana_m": 3, "banana_f": 4})
        self.assertNotIn("egg_price", payload)
        self.assertNotIn("banana_price", payload)

    def test_insert_rejects_price_args(self):
        with self.assertRaises(TypeError):
            db.insert_egg_record("A", "2026-10-05", None, 0, 0, 0, 0, 6, 6)

    def test_rates_queries_filter_by_user(self):
        fake = MagicMock()
        with patch.object(db, "supabase", fake):
            db.get_egg_rates("A", 2026, 10)
            db.get_latest_egg_rates_before("A", 2026, 10)
            db.upsert_egg_rates("A", 2026, 10, {"egg_price": 6.0, "banana_price": 5.0})
        tbl = fake.table.return_value
        self.assertEqual(fake.table.call_args_list[0][0], ("egg_rates",))
        self.assertEqual(tbl.select.return_value.eq.call_args_list[0][0], ("user_id", "A"))
        self.assertEqual(tbl.select.return_value.eq.return_value.or_.call_count, 1)
        up = tbl.upsert.call_args
        self.assertEqual(up[0][0]["user_id"], "A")
        self.assertEqual(up[1], {"on_conflict": "user_id,year,month"})
        self.assertIn("updated_at", up[0][0])

    def test_get_rows_have_no_price_fields(self):
        rec = [{"id": 1, "user_id": 2, "date": "2026-10-05", "payer": None, "egg_m": 1,
                "egg_price": 6, "banana_price": 6}]
        with patch("routes.egg.get_egg_records", return_value=rec):
            r = self.client.get("/api/egg/2026/10", headers=self.h())
        self.assertEqual(r.status_code, 200)
        row = r.get_json()[0]
        self.assertNotIn("egg_price", row)
        self.assertNotIn("banana_price", row)
        self.assertEqual(row["egg_m"], 1)

    def test_get_empty(self):
        with patch("routes.egg.get_egg_records", return_value=[]):
            r = self.client.get("/api/egg/2026/10", headers=self.h())
        self.assertEqual((r.status_code, r.get_json()), (200, []))


class SaveValidationStillWorks(Base):
    def setUp(self):
        super().setUp()
        self.put(2026, 10, {"rates": rates()})
        self.db.writes.clear()

    def test_payer(self):
        for bad in ("XYZ", "apf", "", 5):
            r = self.save([{"date": "2026-10-05", "payer": bad}])
            self.assertEqual(r.status_code, 400, bad)
            self.assertEqual(r.get_json()["error"], "Record 0: payer must be 'APF' or 'GOV'")
        for ok in (None, "APF", "GOV"):
            self.assertEqual(self.save([{"date": "2026-10-05", "payer": ok}]).status_code, 200, ok)
        self.assertEqual(self.save([{"date": "2026-10-06"}]).status_code, 200)

    def test_counts(self):
        for k in ("egg_m", "egg_f", "banana_m", "banana_f"):
            for bad in (1.5, -1, "3", True, math.nan, math.inf):
                r = self.save([{"date": "2026-10-05", k: bad}])
                self.assertEqual(r.status_code, 400, (k, bad))
        self.assertEqual(self.db.records, [])

    def test_whole_float_converted_and_null_is_zero(self):
        r = self.save([{"date": "2026-10-05", "egg_m": 2.0, "banana_f": 4.0, "egg_f": None}])
        self.assertEqual(r.status_code, 200)
        rec = self.db.records[0]
        self.assertEqual((rec["egg_m"], rec["banana_f"], rec["egg_f"], rec["banana_m"]), (2, 4, 0, 0))
        self.assertIsInstance(rec["egg_m"], int)

    def test_bad_date_and_body(self):
        for rec in ({"date": "2026-02-30"}, {"date": "x"}, {"date": 20261005}, {"egg_m": 1}, 5):
            self.assertEqual(self.save([rec]).status_code, 400, rec)
        r = self.client.post("/api/egg/save", data="x", headers=self.h(), content_type="text/plain")
        self.assertEqual(r.status_code, 400)
        r = self.client.post("/api/egg/save", json={"records": {"a": 1}}, headers=self.h())
        self.assertEqual(r.status_code, 400)
        self.assertEqual(self.db.records, [])

    def test_error_names_record_index_and_inserts_nothing(self):
        r = self.save([{"date": "2026-10-05"}, {"date": "2026-10-06", "payer": "ZZZ"}])
        self.assertEqual(r.status_code, 400)
        self.assertTrue(r.get_json()["error"].startswith("Record 1:"))
        self.assertEqual(self.db.records, [])

    def test_insert_db_error_500(self):
        with patch("routes.egg.insert_egg_record", side_effect=RuntimeError("boom")):
            r = self.save([{"date": "2026-10-05"}])
        self.assertEqual((r.status_code, r.get_json()), (500, {"error": "boom"}))


class Calc(unittest.TestCase):
    def test_row_roundtrip(self):
        row = rates_to_row(rates())
        self.assertEqual(row, {"egg_price": 6.0, "banana_price": 5.0})
        self.assertEqual(rates_from_row(row), rates())
        # DB numeric may come back as a string
        self.assertEqual(rates_from_row({"egg_price": "6.50", "banana_price": "5"})["egg_price"], 6.5)

    def test_validate_edge(self):
        self.assertEqual(validate_rates(rates()), (rates(), None))
        for bad in (math.nan, math.inf, -math.inf, -0.01, True, "1", None):
            r = rates(); r["banana_price"] = bad
            self.assertIsNotNone(validate_rates(r)[1], bad)
        self.assertIsNotNone(validate_rates(None)[1])
        self.assertIsNotNone(validate_rates({"egg_price": 1})[1])
        self.assertIsNotNone(validate_rates({**rates(), "x": 1})[1])


if __name__ == "__main__":
    unittest.main(verbosity=2)
