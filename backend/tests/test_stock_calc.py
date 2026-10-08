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
from tests.test_meal_rates import FakeDb, rates


class StockDb(FakeDb):
    """FakeDb plus stock records and meal plans, keyed by user."""

    def __init__(self):
        super().__init__()
        self.stock = {}   # user -> list of rows
        self.meals = {}   # user -> list of rows
        self.fail = False

    def get_stock_records(self, user_id, year, month):
        if self.fail:
            raise RuntimeError("db down")
        return list(self.stock.get(user_id, []))

    def get_meal_plans(self, user_id, year, month):
        if self.fail:
            raise RuntimeError("db down")
        return list(self.meals.get(user_id, []))


def meal(date, meal_type="rice", c15=30, c610=20, pulses=False):
    return {"date": date, "meal_type": meal_type, "has_pulses": pulses, "cnt_1to5": c15, "cnt_6to10": c610}


class StockCalc(unittest.TestCase):
    def setUp(self):
        self.db = StockDb()
        self.patches = [
            patch(f"routes.stock.{n}", getattr(self.db, n))
            for n in ["get_meal_rates", "get_latest_meal_rates_before", "get_stock_records", "get_meal_plans"]
        ] + [
            patch(f"routes.meal.{n}", getattr(self.db, n))
            for n in ["get_meal_rates", "get_latest_meal_rates_before", "upsert_meal_rates", "insert_meal_plan"]
        ]
        for p in self.patches:
            p.start()
        self.client = app.test_client()

    def tearDown(self):
        for p in self.patches:
            p.stop()

    def h(self, user="A"):
        return {"Authorization": f"Bearer {issue_token(user)}"}

    def calc(self, y=2026, m=10, user="A"):
        return self.client.get(f"/api/stock/calc/{y}/{m}", headers=self.h(user))

    def row(self, date, grade, y=2026, m=10, user="A"):
        j = self.calc(y, m, user).get_json()
        return next(r for r in j["rows"] if r["date"] == date and r["grade"] == grade)

    def set_rates(self, y, m, r, user="A"):
        self.db.upsert_meal_rates(user, y, m, {
            **{"g15_" + k: v for k, v in r["g1_5"].items()},
            **{"g610_" + k: v for k, v in r["g6_10"].items()},
        })

    def test_uses_configured_rates_per_group(self):
        self.set_rates(2026, 10, rates())
        self.db.meals["A"] = [meal("2026-10-05")]
        self.assertEqual(self.row("2026-10-05", "1-5")["rice_used"], 3.0)
        self.assertEqual(self.row("2026-10-05", "6-10")["rice_used"], 3.0)  # 150g * 20

    def test_groups_independent(self):
        r = rates()
        r["g1_5"]["rice_g"] = 111
        r["g6_10"]["rice_g"] = 222
        self.set_rates(2026, 10, r)
        self.db.meals["A"] = [meal("2026-10-05", c15=10, c610=10)]
        self.assertEqual(self.row("2026-10-05", "1-5")["rice_used"], 1.11)
        self.assertEqual(self.row("2026-10-05", "6-10")["rice_used"], 2.22)

    def test_wheat_day_has_no_rice(self):
        self.set_rates(2026, 10, rates())
        self.db.meals["A"] = [meal("2026-10-05", "wheat")]
        r = self.row("2026-10-05", "1-5")
        self.assertEqual(r["rice_used"], 0)
        self.assertEqual(r["wheat_used"], 3.0)

    def test_pulses_only_when_flag(self):
        self.set_rates(2026, 10, rates())
        self.db.meals["A"] = [meal("2026-10-05", pulses=False), meal("2026-10-06", pulses=True)]
        self.assertEqual(self.row("2026-10-05", "1-5")["pulse_used"], 0)
        self.assertEqual(self.row("2026-10-06", "1-5")["pulse_used"], 0.6)

    def test_oil_always(self):
        self.set_rates(2026, 10, rates())
        self.db.meals["A"] = [meal("2026-10-05", "wheat")]
        self.assertEqual(self.row("2026-10-05", "1-5")["oil_used"], 0.15)

    def test_no_meal_zeros(self):
        self.set_rates(2026, 10, rates())
        r = self.row("2026-10-07", "1-5")
        self.assertEqual([r[k] for k in ("rice_used", "wheat_used", "oil_used", "pulse_used")], [0, 0, 0, 0])

    def test_inherited_rates_used_and_reported(self):
        self.set_rates(2026, 10, rates())
        self.db.meals["A"] = [meal("2026-12-05")]
        j = self.calc(2026, 12).get_json()
        self.assertEqual(j["rates"], {"source": "inherited", "inherited_from": {"year": 2026, "month": 10}})
        self.assertEqual(self.row("2026-12-05", "1-5", 2026, 12)["rice_used"], 3.0)

    def test_none_source_zero_and_no_write(self):
        self.db.meals["A"] = [meal("2026-10-05", pulses=True)]
        j = self.calc().get_json()
        self.assertEqual(j["rates"], {"source": "none", "inherited_from": None})
        for r in j["rows"]:
            self.assertEqual([r[k] for k in ("rice_used", "wheat_used", "oil_used", "pulse_used")], [0, 0, 0, 0])
        self.assertEqual(self.db.writes, [])

    def test_saved_source_and_reading_never_writes(self):
        self.set_rates(2026, 10, rates())
        n = len(self.db.writes)
        j = self.calc().get_json()
        self.assertEqual(j["rates"], {"source": "saved", "inherited_from": None})
        self.calc(2026, 12)
        self.assertEqual(len(self.db.writes), n)

    def test_user_isolation(self):
        self.set_rates(2026, 10, rates(), user="A")
        self.set_rates(2026, 10, rates(2), user="B")
        self.db.meals["A"] = [meal("2026-10-05")]
        self.db.meals["B"] = [meal("2026-10-05", c15=100)]
        self.assertEqual(self.row("2026-10-05", "1-5", user="A")["rice_used"], 3.0)
        # user C has no rates, A/B data must not leak
        self.assertEqual(self.calc(user="C").get_json()["rates"]["source"], "none")

    def test_month_isolation(self):
        self.set_rates(2026, 10, rates())
        self.set_rates(2026, 11, rates(2))
        self.db.meals["A"] = [meal("2026-11-05")]
        self.set_rates(2026, 10, rates(5))
        self.assertEqual(self.row("2026-11-05", "1-5", 2026, 11)["rice_used"], 6.0)

    def test_put_through_meal_route_reflects(self):
        self.set_rates(2026, 10, rates())
        self.db.meals["A"] = [meal("2026-10-05")]
        self.assertEqual(self.row("2026-10-05", "1-5")["rice_used"], 3.0)
        r = self.client.put("/api/meal/rates/2026/10", json={"rates": rates(2)}, headers=self.h())
        self.assertEqual(r.status_code, 200)
        self.assertEqual(self.row("2026-10-05", "1-5")["rice_used"], 6.0)

    def test_decimal_grams(self):
        r = rates()
        r["g1_5"]["rice_g"] = 102.5
        self.set_rates(2026, 10, r)
        self.db.meals["A"] = [meal("2026-10-05", c15=30)]
        self.assertEqual(self.row("2026-10-05", "1-5")["rice_used"], 3.075)

    def test_response_shape(self):
        self.set_rates(2026, 10, rates())
        j = self.calc().get_json()
        self.assertEqual(set(j), {"rates", "rows"})
        self.assertEqual(len(j["rows"]), 62)
        self.assertEqual(set(j["rows"][0]), {
            "date", "grade", "rice_add", "wheat_add", "oil_add", "pulse_add",
            "rice_open", "wheat_open", "oil_open", "pulse_open",
            "rice_used", "wheat_used", "oil_used", "pulse_used"})
        self.assertEqual(j["rows"][0]["rice_open"], 0)
        self.assertIsNone(j["rows"][2]["rice_open"])

    def test_negative_opening_passes_through(self):
        self.db.stock["A"] = [{"date": "2026-10-05", "grade": "1-5", "rice_open": -3.5}]
        self.assertEqual(self.row("2026-10-05", "1-5")["rice_open"], -3.5)

    def test_bad_month_and_year(self):
        for y, m in [(2026, 0), (2026, 13), (1999, 10), (2101, 10)]:
            r = self.calc(y, m)
            self.assertEqual(r.status_code, 400)
            self.assertIn("error", r.get_json())

    def test_db_error_500(self):
        self.db.fail = True
        r = self.calc()
        self.assertEqual(r.status_code, 500)
        self.assertEqual(r.get_json(), {"error": "Failed to load stock data"})

    def test_requires_auth(self):
        self.assertEqual(self.client.get("/api/stock/calc/2026/10").status_code, 401)


if __name__ == "__main__":
    unittest.main()
