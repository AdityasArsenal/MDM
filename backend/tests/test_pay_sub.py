import os
import socket
import sys
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

os.environ.setdefault("JWT_SECRET", "test-secret-test-secret-test-secret-123")
os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_KEY", "x")
os.environ.setdefault("ONE_MONTH_PRICE", "99")
os.environ.setdefault("THREE_MONTH_PRICE", "249")
os.environ["ENFORCE_SUBSCRIPTION"] = "false"
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import db
from app import app
from auth_session import issue_token
from routes import pay


class _Tripwire:
    """Stands in for the Supabase client: any real table access fails the test."""
    def __init__(self, hits):
        self._hits = hits

    def __getattr__(self, name):
        if name not in ("table", "rpc", "from_", "auth", "storage", "functions", "postgrest"):
            raise AttributeError(name)  # probes by mock/inspect, not db use
        self._hits.append(f"db.supabase.{name}")
        raise RuntimeError("live db access blocked by test")


class PaySubTestBase(unittest.TestCase):
    def setUp(self):
        self.hits = []
        for p in (
            patch.object(db, "supabase", _Tripwire(self.hits)),
            patch.object(socket.socket, "connect", side_effect=lambda *a, **k: self.hits.append("socket")),
        ):
            p.start()
            self.addCleanup(p.stop)
        self.addCleanup(lambda: self.assertEqual(self.hits, [], "test touched the db or network"))
        self.client = app.test_client()
        self.auth = {"Authorization": "Bearer " + issue_token("user-1")}


class InsertSubscriptionTests(PaySubTestBase):
    def test_payload_has_no_plan_type(self):
        start = datetime(2026, 1, 1, tzinfo=timezone.utc)
        end = start + timedelta(days=30)
        with patch.object(db, "supabase") as sb:
            db.insert_subscription("u1", "p1", start, end)
        row = sb.table.return_value.insert.call_args[0][0]
        self.assertEqual(sb.table.call_args[0][0], "subscriptions")
        self.assertNotIn("plan_type", row)
        self.assertEqual(set(row), {"user_id", "payment_id", "start_date", "end_date", "status"})
        self.assertEqual(row["status"], "active")
        self.assertTrue(row["start_date"].endswith("+00:00"))

    def test_no_query_selects_or_writes_plan_type(self):
        with open(db.__file__) as f:
            self.assertNotIn("plan_type", f.read())


class CompletionTests(PaySubTestBase):
    def _complete(self, plan):
        payment = {"id": "p1", "user_id": "u1", "plan": plan, "status": "pending"}
        subs = []
        with patch.object(pay, "get_payment_by_order_id", return_value=payment), \
             patch.object(pay, "get_subscription_by_payment_id", side_effect=lambda pid: subs[0] if subs else None), \
             patch.object(pay, "insert_subscription", side_effect=lambda *a: subs.append(a)), \
             patch.object(pay, "update_payment_status"):
            payload = {"merchantOrderId": "o1", "state": "COMPLETED"}
            self.assertTrue(pay.process_payment_completion(payload))
            self.assertTrue(pay.process_payment_completion(payload))  # repeat: must not insert again
        return subs

    def test_one_month_is_30_days_and_inserted_once(self):
        subs = self._complete("1_month")
        self.assertEqual(len(subs), 1)
        user_id, payment_id, start, end = subs[0]  # no plan argument any more
        self.assertEqual((user_id, payment_id), ("u1", "p1"))
        self.assertEqual((end - start).days, 30)
        self.assertEqual(start.utcoffset(), timedelta(0))

    def test_three_month_is_90_days_and_inserted_once(self):
        subs = self._complete("3_month")
        self.assertEqual(len(subs), 1)
        self.assertEqual((subs[0][3] - subs[0][2]).days, 90)


class PlanFromPaymentTests(PaySubTestBase):
    def test_active_returns_plan_type_from_payment_without_payments_key(self):
        sub = {"id": 1, "user_id": 2, "payment_id": 3, "start_date": "s", "end_date": "e",
               "created_at": "c", "status": "active", "payments": {"plan": "3_month"}}
        with patch("routes.sub.get_subscription_by_user_id", return_value=sub):
            body = self.client.get("/api/sub/active", headers=self.auth).get_json()
        self.assertEqual(body["plan_type"], "3_month")
        self.assertNotIn("payments", body)

    def test_active_with_no_subscription_is_null(self):
        with patch("routes.sub.get_subscription_by_user_id", return_value=None):
            self.assertIsNone(self.client.get("/api/sub/active", headers=self.auth).get_json())

    def test_history_returns_plan_type_from_payment_and_keeps_payments(self):
        row = {"id": 1, "user_id": 2, "payment_id": 3, "start_date": "s", "end_date": "e", "created_at": "c",
               "status": "expired", "payments": {"order_id": "o", "amount": 99, "status": "COMPLETED", "plan": "1_month"}}
        with patch("routes.sub.get_subscription_history", return_value=[row]):
            body = self.client.get("/api/sub/history", headers=self.auth).get_json()
        self.assertEqual(body[0]["plan_type"], "1_month")
        self.assertEqual(body[0]["payments"]["order_id"], "o")

    def test_queries_join_the_payment_plan(self):
        with patch.object(db, "supabase") as sb:
            db.get_subscription_by_user_id("u")
            self.assertEqual(sb.table.return_value.select.call_args[0][0], "*, payments(plan)")
            db.get_subscription_history("u")
            self.assertIn("plan", sb.table.return_value.select.call_args[0][0])


if __name__ == "__main__":
    unittest.main()
