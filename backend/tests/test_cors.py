"""CORS must allow only the frontend origin(s) taken from the environment."""
import importlib
import os
import sys
import unittest
from unittest import mock

BASE_ENV = {
    "SUPABASE_URL": "https://example.supabase.co", "SUPABASE_KEY": "x",
    "JWT_SECRET": "j" * 40, "ONE_MONTH_PRICE": "10", "THREE_MONTH_PRICE": "25",
    "GOOGLE_CLIENT_ID": "g",
}


def load_app(extra):
    env = {**BASE_ENV, **extra}
    with mock.patch.dict(os.environ, env, clear=False):
        for name in ("FRONTEND_SUCCESS_URL", "FRONTEND_FAILED_URL", "CORS_ORIGINS"):
            if name not in extra:
                os.environ.pop(name, None)
        sys.modules.pop("app", None)
        return importlib.import_module("app")


def preflight(app_module, origin):
    return app_module.app.test_client().open(
        "/api/egg/2026/10", method="OPTIONS",
        headers={"Origin": origin, "Access-Control-Request-Method": "GET",
                 "Access-Control-Request-Headers": "authorization"},
    ).headers.get("Access-Control-Allow-Origin")


class CorsTests(unittest.TestCase):
    def test_frontend_origin_from_urls_is_allowed_and_others_are_not(self):
        m = load_app({"FRONTEND_SUCCESS_URL": "https://app.example.com/payment/success",
                      "FRONTEND_FAILED_URL": "https://app.example.com/payment/failed"})
        self.assertEqual(preflight(m, "https://app.example.com"), "https://app.example.com")
        self.assertIsNone(preflight(m, "https://evil.example.org"))

    def test_extra_origins_from_cors_origins(self):
        m = load_app({"FRONTEND_SUCCESS_URL": "https://app.example.com/ok",
                      "CORS_ORIGINS": "http://localhost:3000/, https://other.example.com"})
        self.assertEqual(preflight(m, "http://localhost:3000"), "http://localhost:3000")
        self.assertEqual(preflight(m, "https://other.example.com"), "https://other.example.com")

    def test_nothing_configured_allows_no_origin(self):
        m = load_app({})
        self.assertIsNone(preflight(m, "https://app.example.com"))

    def test_wildcard_is_gone(self):
        m = load_app({"FRONTEND_SUCCESS_URL": "https://app.example.com/ok"})
        self.assertIsNone(preflight(m, "https://anything.example.net"))


if __name__ == "__main__":
    unittest.main()
