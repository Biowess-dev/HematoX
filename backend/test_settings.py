import unittest
import sqlite3
import os
from fastapi.testclient import TestClient
from backend.main import app
from backend.corpus_loader import CORPUS_MAP


class TestSettingsRouter(unittest.TestCase):
    def setUp(self):
        # Backup the original environment variable if exists
        self.original_key = os.environ.get("GEMINI_API_KEY")
        if "GEMINI_API_KEY" in os.environ:
            del os.environ["GEMINI_API_KEY"]

        self.conn = sqlite3.connect("./hematox.db")
        self.cursor = self.conn.cursor()
        
        # Ensure database tables exist
        self.cursor.execute("""
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT
            )
        """)
        self.conn.commit()

        # Clean settings row before each test
        self.cursor.execute("DELETE FROM settings WHERE key = ?", ("GEMINI_API_KEY",))
        self.conn.commit()

        self.client = TestClient(app)

    def tearDown(self):
        # Restore environment variable
        if self.original_key is not None:
            os.environ["GEMINI_API_KEY"] = self.original_key
        elif "GEMINI_API_KEY" in os.environ:
            del os.environ["GEMINI_API_KEY"]

        # Clean settings row
        self.cursor.execute("DELETE FROM settings WHERE key = ?", ("GEMINI_API_KEY",))
        self.conn.commit()
        self.conn.close()

    def test_post_key_empty(self):
        response = self.client.post("/api/settings/key", json={"api_key": ""})
        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json(), {"detail": "API key cannot be empty"})

        response = self.client.post("/api/settings/key", json={"api_key": "   "})
        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json(), {"detail": "API key cannot be empty"})

    def test_post_key_success(self):
        test_key = "AIzaSyTestApiKey12345"
        response = self.client.post("/api/settings/key", json={"api_key": test_key})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "saved"})

        # Check that it's persisted in SQLite settings table
        self.cursor.execute("SELECT value FROM settings WHERE key = ?", ("GEMINI_API_KEY",))
        row = self.cursor.fetchone()
        self.assertIsNotNone(row)
        self.assertEqual(row[0], test_key)

        # Check that it's set in os.environ immediately
        self.assertEqual(os.environ.get("GEMINI_API_KEY"), test_key)

    def test_get_key_status_unconfigured(self):
        response = self.client.get("/api/settings/key/status")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"configured": False})

    def test_get_key_status_configured(self):
        # Insert raw row into database
        self.cursor.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
            ("GEMINI_API_KEY", "SomePreExistingKey")
        )
        self.conn.commit()

        response = self.client.get("/api/settings/key/status")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"configured": True})

    def test_get_assets(self):
        response = self.client.get("/api/settings/assets")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("files", data)
        files = data["files"]

        # Ensure all mapping files are represented
        names = {f["name"] for f in files}
        self.assertEqual(names, set(CORPUS_MAP.keys()))

        for f in files:
            self.assertIn("name", f)
            self.assertIn("path", f)
            self.assertIn("available", f)
            self.assertIn("size_bytes", f)
            self.assertEqual(f["path"], CORPUS_MAP[f["name"]])
            # Since create_corpus_stubs runs on corpus import time, files should be available
            self.assertTrue(os.path.exists(f["path"]))
            self.assertEqual(f["available"], True)
            self.assertGreater(f["size_bytes"], 0)

    def test_lifespan_restores_api_key(self):
        # Set a key in the database directly
        self.cursor.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
            ("GEMINI_API_KEY", "RestoredLifespanKey999")
        )
        self.conn.commit()

        # Triggers lifespan setup
        with TestClient(app) as client:
            self.assertEqual(os.environ.get("GEMINI_API_KEY"), "RestoredLifespanKey999")


if __name__ == "__main__":
    unittest.main()
