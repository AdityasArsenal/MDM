import logging
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

import auth_session
import db
import free_access
from app import app
from auth_session import issue_token
from routes import pay

IST = free_access.IST


def ist(y, m, d, hh=0, mm=0):
    return datetime(y, m, d, hh, mm, tzinfo=IST)


class _Tripwire:
    """Stands in for the Supabase client: any real table access fails the test."""
    def __init__(self, hits):
        self._hits = hits

    def __getattr__(self, name):
        if name not in ("table", "rpc", "from_", "auth", "storage", "functions", "postgrest"):
            raise AttributeError(name)  # probes by mock/inspect, not db use
        self._hits.append(f"db.supabase.{name}")
        raise RuntimeError("live db access blocked by test")


class Base(unittest.TestCase):
    def setUp(self):
        self.hits = []
        for p in (
            patch.object(db, "supabase", _Tripwire(self.hits)),
            patch.object(socket.socket, "connect", side_effect=lambda *a, **k: self.hits.append("socket")),
        ):
            p.start()
            self.addCleanup(p.stop)
        self.addCleanup(lambda: self.assertEqual(self.hits, [], "test touched the db or network"))
        free_access.reset_cache()
        self.addCleanup(free_access.reset_cache)
        auth_session._paid_until.clear()
        self.addCleanup(auth_session._paid_until.clear)
        self.client = app.test_client()
        self.auth = {"Authorization": "Bearer " + issue_token("user-1")}

    def setting(self, value, today=ist(2026, 10, 16, 12)):
        """Make the app_settings value and 'now in India' what we want."""
        p1 = patch.object(free_access, "get_app_setting", return_value=value)
        p2 = patch.object(free_access, "_now_ist", return_value=today)
        self.mock_setting = p1.start()
        p2.start()
        self.addCleanup(p1.stop)
        self.addCleanup(p2.stop)


class FreeAccessHelperTests(Base):
    def test_india_offset_is_fixed_530(self):
        self.assertEqual(free_access._now_ist().utcoffset(), timedelta(hours=5, minutes=30))

    def test_boundary_in_india_time(self):
        with patch.object(free_access, "get_app_setting", return_value="2026-12-31"):
            for now, expected in (
                (ist(2026, 12, 31, 23, 59), True),     # last minute of the free day
                (ist(2027, 1, 1, 0, 0), False),        # next day starts the paywall
                (ist(2026, 12, 31, 0, 0), True),
                (ist(2026, 10, 16), True),
                # 20:00 UTC on 31 Dec is already 1 Jan 01:30 in India: paid, not free
                (datetime(2026, 12, 31, 20, 0, tzinfo=timezone.utc).astimezone(IST), False),
            ):
                with patch.object(free_access, "_now_ist", return_value=now):
                    free_access.reset_cache()
                    self.assertEqual(free_access.is_free_now(), expected, now)

    def test_none_missing_and_garbage_mean_paid(self):
        with patch.object(free_access, "_now_ist", return_value=ist(2026, 10, 16)):
            for value in (None, "", "   ", "garbage", "2026-13-40", "31/12/2026", "2026-12-31T00:00:00"):
                with patch.object(free_access, "get_app_setting", return_value=value):
                    free_access.reset_cache()
                    self.assertFalse(free_access.is_free_now(), value)
                    self.assertEqual(free_access.free_info(), {"free_access": False, "free_until": None})

    def test_garbage_is_logged_once(self):
        with patch.object(free_access, "get_app_setting", return_value="garbage"), \
             patch.object(free_access, "_monotonic", side_effect=[0, 100, 200]):
            with self.assertLogs(free_access.logger, level="ERROR") as logs:
                for _ in range(3):  # each call is past the cache expiry, so each re-reads
                    free_access.get_free_until()
            self.assertEqual(len(logs.records), 1)

    def test_cache_reads_db_once_within_60_seconds_then_again(self):
        with patch.object(free_access, "get_app_setting", return_value="2026-12-31") as g, \
             patch.object(free_access, "_monotonic", side_effect=[0, 30, 59.9, 60.1]):
            free_access.get_free_until()
            free_access.get_free_until()
            free_access.get_free_until()
            self.assertEqual(g.call_count, 1)
            free_access.get_free_until()  # 60.1 s: expired
            self.assertEqual(g.call_count, 2)

    def test_none_is_cached_too(self):
        with patch.object(free_access, "get_app_setting", return_value=None) as g, \
             patch.object(free_access, "_monotonic", side_effect=[0, 10]):
            free_access.get_free_until()
            free_access.get_free_until()
            self.assertEqual(g.call_count, 1)

    def test_db_error_propagates_and_is_not_cached(self):
        with patch.object(free_access, "get_app_setting",
                          side_effect=[RuntimeError("db down"), "2026-12-31", "2026-12-31"]) as g, \
             patch.object(free_access, "_monotonic", return_value=0):
            with self.assertRaises(RuntimeError):
                free_access.get_free_until()
            self.assertEqual(free_access.get_free_until().isoformat(), "2026-12-31")  # next call reads again
            free_access.get_free_until()  # now cached
            self.assertEqual(g.call_count, 2)

    def test_stale_cache_is_not_used_after_error(self):
        with patch.object(free_access, "get_app_setting", side_effect=["2026-12-31", RuntimeError("down")]), \
             patch.object(free_access, "_monotonic", side_effect=[0, 100]):
            free_access.get_free_until()
            with self.assertRaises(RuntimeError):  # expired cache + failing db: error, not the old answer
                free_access.get_free_until()

    def test_format_date(self):
        self.assertEqual(free_access.format_date(datetime(2026, 12, 31)), "31 December 2026")
        self.assertEqual(free_access.format_date(datetime(2027, 1, 5)), "5 January 2027")

    def test_get_app_setting_query(self):
        with patch.object(db, "supabase") as sb:
            chain = sb.table.return_value.select.return_value.eq.return_value.limit.return_value.execute
            chain.return_value.data = [{"value": "2026-12-31"}]
            self.assertEqual(db.get_app_setting("free_until"), "2026-12-31")
            self.assertEqual(sb.table.call_args[0][0], "app_settings")
            sb.table.return_value.select.return_value.eq.assert_called_with("key", "free_until")
            chain.return_value.data = []
            self.assertIsNone(db.get_app_setting("free_until"))
            chain.return_value.data = [{"value": None}]
            self.assertIsNone(db.get_app_setting("free_until"))
            chain.side_effect = RuntimeError("down")
            with self.assertRaises(RuntimeError):
                db.get_app_setting("free_until")


class EnforceTests(Base):
    PATH = "/api/stock/nothing-here"  # a paid prefix; allowed requests end in 404, blocked ones earlier

    def setUp(self):
        super().setUp()
        p = patch.object(auth_session, "ENFORCE_SUBSCRIPTION", True)
        p.start()
        self.addCleanup(p.stop)

    def test_free_allows_without_subscription_lookup_and_does_not_fill_paid_cache(self):
        self.setting("2026-12-31")
        with patch.object(auth_session, "check_active_subscription") as chk:
            self.assertEqual(self.client.get(self.PATH, headers=self.auth).status_code, 404)
            chk.assert_not_called()
        self.assertEqual(auth_session._paid_until, {})

    def test_not_free_unpaid_is_402(self):
        self.setting("2026-10-01")
        with patch.object(auth_session, "check_active_subscription", return_value=False) as chk:
            r = self.client.get(self.PATH, headers=self.auth)
            self.assertEqual(r.status_code, 402)
            self.assertEqual(r.get_json()["code"], "subscription_required")
            chk.assert_called_once()

    def test_no_setting_unpaid_is_402_and_paid_is_allowed_and_cached(self):
        self.setting(None)
        with patch.object(auth_session, "check_active_subscription", return_value=False):
            self.assertEqual(self.client.get(self.PATH, headers=self.auth).status_code, 402)
        with patch.object(auth_session, "check_active_subscription", return_value=True) as chk:
            self.assertEqual(self.client.get(self.PATH, headers=self.auth).status_code, 404)
            self.assertEqual(self.client.get(self.PATH, headers=self.auth).status_code, 404)
            chk.assert_called_once()

    def test_setting_error_is_503_never_free_never_unpaid(self):
        with patch.object(free_access, "get_app_setting", side_effect=RuntimeError("down")), \
             patch.object(auth_session, "check_active_subscription", return_value=True) as chk:
            r = self.client.get(self.PATH, headers=self.auth)
            self.assertEqual(r.status_code, 503)
            self.assertEqual(r.get_json(), {"error": "Could not verify subscription"})
            chk.assert_not_called()

    def test_subscription_lookup_error_is_still_503(self):
        self.setting(None)
        with patch.object(auth_session, "check_active_subscription", side_effect=RuntimeError("down")):
            self.assertEqual(self.client.get(self.PATH, headers=self.auth).status_code, 503)

    def test_missing_or_bad_token_is_401_even_when_free(self):
        self.setting("2026-12-31")
        self.assertEqual(self.client.get(self.PATH).status_code, 401)
        self.assertEqual(self.client.get(self.PATH, headers={"Authorization": "Bearer nope"}).status_code, 401)

    def test_enforcement_off_is_unchanged(self):
        with patch.object(auth_session, "ENFORCE_SUBSCRIPTION", False), \
             patch.object(free_access, "get_app_setting", side_effect=AssertionError("must not be read")), \
             patch.object(auth_session, "check_active_subscription") as chk:
            self.assertEqual(self.client.get(self.PATH, headers=self.auth).status_code, 404)
            chk.assert_not_called()

    def test_non_paid_routes_and_options_pass(self):
        with patch.object(free_access, "get_app_setting", side_effect=AssertionError("must not be read")):
            self.assertEqual(self.client.get("/health").status_code, 200)
            self.assertNotIn(self.client.options(self.PATH).status_code, (401, 402, 503))


class SubCheckTests(Base):
    def test_free(self):
        self.setting("2026-12-31")
        with patch("routes.sub.reconcile_pending_payments") as rec, \
             patch("routes.sub.check_active_subscription") as chk:
            r = self.client.get("/api/sub/check", headers=self.auth)
            rec.assert_not_called()
            chk.assert_not_called()
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.get_json(), {"has_active_subscription": True, "free_access": True, "free_until": "2026-12-31"})

    def test_not_free_reconciles_then_checks(self):
        self.setting("2026-10-01")
        order = []
        with patch("routes.sub.reconcile_pending_payments", side_effect=lambda u: order.append("rec")), \
             patch("routes.sub.check_active_subscription", side_effect=lambda u: order.append("chk") or False):
            r = self.client.get("/api/sub/check", headers=self.auth)
        self.assertEqual(order, ["rec", "chk"])
        self.assertEqual(r.get_json(), {"has_active_subscription": False, "free_access": False, "free_until": "2026-10-01"})

    def test_no_setting(self):
        self.setting(None)
        with patch("routes.sub.reconcile_pending_payments"), patch("routes.sub.check_active_subscription", return_value=True):
            r = self.client.get("/api/sub/check", headers=self.auth)
        self.assertEqual(r.get_json(), {"has_active_subscription": True, "free_access": False, "free_until": None})

    def test_setting_error_is_503(self):
        with patch.object(free_access, "get_app_setting", side_effect=RuntimeError("down")), \
             patch("routes.sub.reconcile_pending_payments") as rec:
            r = self.client.get("/api/sub/check", headers=self.auth)
            rec.assert_not_called()
        self.assertEqual(r.status_code, 503)
        self.assertEqual(r.get_json(), {"error": "Could not verify subscription"})

    def test_login_still_required(self):
        self.setting("2026-12-31")
        self.assertEqual(self.client.get("/api/sub/check").status_code, 401)


class LoginTests(Base):
    USER = {"id": "u-1", "email": "a@b.c", "name": "A"}

    def login(self, sub):
        with patch.dict(os.environ, {"GOOGLE_CLIENT_ID": "cid"}), \
             patch("routes.auth.id_token.verify_oauth2_token",
                   return_value={"sub": "g1", "email": "a@b.c", "name": "A"}), \
             patch("routes.auth.get_user_by_google_id", return_value=self.USER), \
             patch("routes.auth.get_active_subscription", return_value=sub):
            return self.client.post("/api/auth/login", json={"credential": "x"})

    def test_free_unsubscribed_user(self):
        self.setting("2026-12-31")
        r = self.login(None)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.get_json()["user"], {
            "id": "u-1", "email": "a@b.c", "name": "A", "is_subscribed": True,
            "free_access": True, "free_until": "2026-12-31", "subscription_end": None})

    def test_not_free_unsubscribed_user(self):
        self.setting("2026-10-01")
        user = self.login(None).get_json()["user"]
        self.assertEqual(user, {
            "id": "u-1", "email": "a@b.c", "name": "A", "is_subscribed": False,
            "free_access": False, "free_until": "2026-10-01", "subscription_end": None})

    def test_not_free_subscribed_user(self):
        self.setting(None)
        user = self.login({"end_date": "2027-01-01T00:00:00+00:00"}).get_json()["user"]
        self.assertTrue(user["is_subscribed"])
        self.assertEqual(user["subscription_end"], "2027-01-01T00:00:00+00:00")
        self.assertEqual((user["free_access"], user["free_until"]), (False, None))

    def test_setting_error_is_503_and_creates_nothing(self):
        with patch.object(free_access, "get_app_setting", side_effect=RuntimeError("down")), \
             patch("routes.auth.insert_user") as ins:
            r = self.login(None)
            ins.assert_not_called()
        self.assertEqual(r.status_code, 503)
        self.assertEqual(r.get_json(), {"error": "Please try again"})


class PlansTests(Base):
    def test_free_has_no_plans_or_prices(self):
        self.setting("2026-12-31")
        r = self.client.get("/api/pay/plans")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.get_json(), {"free_access": True, "free_until": "2026-12-31", "plans": {}})

    def test_not_free_has_plans(self):
        self.setting("2026-10-01")
        body = self.client.get("/api/pay/plans").get_json()
        self.assertEqual(body["free_access"], False)
        self.assertEqual(body["free_until"], "2026-10-01")
        self.assertEqual(body["plans"], {"1_month": {"price": pay.PLAN_PRICES["1_month"], "months": 1},
                                         "3_month": {"price": pay.PLAN_PRICES["3_month"], "months": 3}})

    def test_no_setting(self):
        self.setting(None)
        body = self.client.get("/api/pay/plans").get_json()
        self.assertEqual((body["free_access"], body["free_until"]), (False, None))
        self.assertEqual(set(body["plans"]), {"1_month", "3_month"})

    def test_setting_error_is_503(self):
        with patch.object(free_access, "get_app_setting", side_effect=RuntimeError("down")):
            self.assertEqual(self.client.get("/api/pay/plans").status_code, 503)


class CreateTests(Base):
    def _create(self, **patches):
        with patch.object(pay, "get_client") as gc, \
             patch.object(pay, "get_recent_pending_payment", return_value=None) as pend, \
             patch.object(pay, "insert_payment") as ins, \
             patch.object(pay, "update_payment_status") as upd:
            gc.return_value.pay.return_value.redirect_url = "https://pp/x"
            r = self.client.post("/api/pay/create", json={"plan": "1_month"}, headers=self.auth)
            return r, gc, pend, ins, upd

    def test_free_returns_409_before_any_write_or_phonepe_call(self):
        self.setting("2026-12-31")
        r, gc, pend, ins, upd = self._create()
        self.assertEqual(r.status_code, 409)
        self.assertEqual(r.get_json(), {
            "error": "MDM is free until 31 December 2026. No payment is needed.", "code": "free_period"})
        gc.assert_not_called()
        gc.return_value.pay.assert_not_called()
        pend.assert_not_called()
        ins.assert_not_called()
        upd.assert_not_called()

    def test_not_free_creates_payment(self):
        self.setting("2026-10-01")
        r, gc, pend, ins, upd = self._create()
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.get_json()["payment_url"], "https://pp/x")
        ins.assert_called_once()

    def test_no_setting_creates_payment(self):
        self.setting(None)
        self.assertEqual(self._create()[0].status_code, 200)

    def test_setting_error_is_503_before_any_write(self):
        with patch.object(free_access, "get_app_setting", side_effect=RuntimeError("down")):
            r, gc, pend, ins, upd = self._create()
        self.assertEqual(r.status_code, 503)
        ins.assert_not_called()
        gc.return_value.pay.assert_not_called()

    def test_login_still_required(self):
        self.setting("2026-12-31")
        self.assertEqual(self.client.post("/api/pay/create", json={"plan": "1_month"}).status_code, 401)

    def test_status_route_unchanged_while_free(self):
        self.setting("2026-12-31")
        with patch.object(pay, "get_client") as gc, \
             patch.object(pay, "get_payment_by_order_id", return_value={"status": "COMPLETED"}):
            r = self.client.get("/api/pay/status/o1")
        self.assertEqual(r.status_code, 302)


if __name__ == "__main__":
    unittest.main()
