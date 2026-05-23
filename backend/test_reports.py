import unittest
import sqlite3
import uuid
import json
from fastapi.testclient import TestClient
from backend.main import app

class TestReportsRouter(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        # We can insert a few test reports into `./hematox.db`
        self.conn = sqlite3.connect("./hematox.db")
        self.cursor = self.conn.cursor()
        
        # Ensure database tables exist by calling init_db from lifespan startup context
        # (FastAPI TestClient triggers lifespan automatically when using "with TestClient(app)")
        # We can also do a quick SELECT to be sure reports table is present
        self.cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='reports'")
        if not self.cursor.fetchone():
            # If not created yet, create table directly
            self.cursor.execute("""
                CREATE TABLE IF NOT EXISTS reports (
                    id TEXT PRIMARY KEY,
                    module_type TEXT NOT NULL,
                    input_parameters TEXT NOT NULL,
                    generated_report TEXT NOT NULL,
                    title TEXT NOT NULL,
                    is_bookmarked INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    display_id TEXT,
                    patient_name TEXT,
                    is_deleted INTEGER DEFAULT 0,
                    category TEXT,
                    is_saved INTEGER DEFAULT 0
                )
            """)
            self.conn.commit()

        # Let's generate a couple of unique IDs
        self.report_id_1 = f"test-report-{uuid.uuid4()}"
        self.report_id_2 = f"test-report-{uuid.uuid4()}"
        
        self.cursor.execute(
            "INSERT INTO reports (id, module_type, input_parameters, generated_report, title, is_bookmarked, created_at, is_saved) VALUES (?, ?, ?, ?, ?, ?, ?, 1)",
            (self.report_id_1, "cbc", json.dumps({"hb": 14.5}), "Generated CBC report markdown", "CBC Test Title 1", 0, "2026-05-19 01:00:00")
        )
        self.cursor.execute(
            "INSERT INTO reports (id, module_type, input_parameters, generated_report, title, is_bookmarked, created_at, is_saved) VALUES (?, ?, ?, ?, ?, ?, ?, 1)",
            (self.report_id_2, "coag", json.dumps({"inr": 2.0}), "Generated Coag report markdown", "Coag Test Title 2", 1, "2026-05-19 02:00:00")
        )
        self.conn.commit()

    def tearDown(self):
        # Clean up inserted test records
        self.cursor.execute("DELETE FROM reports WHERE id IN (?, ?)", (self.report_id_1, self.report_id_2))
        self.conn.commit()
        self.conn.close()

    def test_list_reports(self):
        response = self.client.get("/api/reports")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        # Verify the structure is a list
        self.assertIsInstance(data, list)
        
        # Verify that our inserted test records are present
        filtered = [r for r in data if r["id"] in (self.report_id_1, self.report_id_2)]
        self.assertEqual(len(filtered), 2)
        
        # The one with created_at "2026-05-19 02:00:00" (report_id_2) should come first in DESC order
        self.assertEqual(filtered[0]["id"], self.report_id_2)
        self.assertEqual(filtered[1]["id"], self.report_id_1)
        
        # Verify allowed keys ONLY: id, module_type, title, is_bookmarked, created_at, display_id, patient_name
        allowed_keys = {"id", "module_type", "title", "is_bookmarked", "created_at", "display_id", "patient_name"}
        for item in filtered:
            self.assertEqual(set(item.keys()), allowed_keys)
            self.assertIsInstance(item["is_bookmarked"], int)

    def test_get_report_success(self):
        # Fetch report 1
        response = self.client.get(f"/api/reports/{self.report_id_1}")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        # Verify all columns present
        self.assertEqual(data["id"], self.report_id_1)
        self.assertEqual(data["module_type"], "cbc")
        self.assertEqual(data["title"], "CBC Test Title 1")
        self.assertEqual(data["is_bookmarked"], 0)
        self.assertEqual(data["generated_report"], "Generated CBC report markdown")
        self.assertEqual(data["input_parameters"], {"hb": 14.5})
        self.assertIn("created_at", data)

    def test_get_report_not_found(self):
        response = self.client.get("/api/reports/nonexistent-id")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {"detail": "Report not found"})

    def test_update_report_both_null(self):
        payload = {"title": None, "is_bookmarked": None}
        response = self.client.post(f"/api/reports/{self.report_id_1}", json=payload)
        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json(), {"detail": "No fields to update"})

    def test_update_report_not_found(self):
        payload = {"title": "Updated Title"}
        response = self.client.post("/api/reports/nonexistent-id", json=payload)
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {"detail": "Report not found"})

    def test_update_report_title_only(self):
        # Update title only
        payload = {"title": "Brand New CBC Title"}
        response = self.client.post(f"/api/reports/{self.report_id_1}", json=payload)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "updated"})
        
        # Verify in DB that title changed, but is_bookmarked remained 0
        self.cursor.execute("SELECT title, is_bookmarked FROM reports WHERE id = ?", (self.report_id_1,))
        row = self.cursor.fetchone()
        self.assertEqual(row[0], "Brand New CBC Title")
        self.assertEqual(row[1], 0)

    def test_update_report_bookmark_only(self):
        # Update bookmark only
        payload = {"is_bookmarked": 1}
        response = self.client.post(f"/api/reports/{self.report_id_1}", json=payload)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "updated"})
        
        # Verify in DB that is_bookmarked changed, but title remained CBC Test Title 1
        self.cursor.execute("SELECT title, is_bookmarked FROM reports WHERE id = ?", (self.report_id_1,))
        row = self.cursor.fetchone()
        self.assertEqual(row[0], "CBC Test Title 1")
        self.assertEqual(row[1], 1)

    def test_update_report_both(self):
        # Update both
        payload = {"title": "Fully Updated Title", "is_bookmarked": 1}
        response = self.client.post(f"/api/reports/{self.report_id_1}", json=payload)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "updated"})
        
        # Verify in DB that both changed
        self.cursor.execute("SELECT title, is_bookmarked FROM reports WHERE id = ?", (self.report_id_1,))
        row = self.cursor.fetchone()
        self.assertEqual(row[0], "Fully Updated Title")
        self.assertEqual(row[1], 1)

    def test_delete_report_success(self):
        # Soft delete report 1
        response = self.client.delete(f"/api/reports/{self.report_id_1}")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "deleted"})

        # Verify in SQLite directly that is_deleted is 1
        self.cursor.execute("SELECT is_deleted FROM reports WHERE id = ?", (self.report_id_1,))
        row = self.cursor.fetchone()
        self.assertEqual(row[0], 1)

        # Verify that GET /reports/report_id_1 returns 404
        response_get = self.client.get(f"/api/reports/{self.report_id_1}")
        self.assertEqual(response_get.status_code, 404)

        # Verify that listing reports doesn't contain report_id_1
        response_list = self.client.get("/api/reports")
        data = response_list.json()
        ids = [item["id"] for item in data]
        self.assertNotIn(self.report_id_1, ids)

    def test_delete_report_not_found(self):
        response = self.client.delete("/api/reports/nonexistent-id")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {"detail": "Report not found"})

    def test_unsaved_report_filtering_and_saving(self):
        # 1. Insert an unsaved report (is_saved = 0)
        unsaved_id = f"test-unsaved-{uuid.uuid4()}"
        self.cursor.execute(
            "INSERT INTO reports (id, module_type, input_parameters, generated_report, title, is_bookmarked, created_at, is_saved) VALUES (?, ?, ?, ?, ?, ?, ?, 0)",
            (unsaved_id, "cbc", json.dumps({"hb": 10.0}), "Unsaved CBC report", "Unsaved Title", 0, "2026-05-19 03:00:00")
        )
        self.conn.commit()

        try:
            # 2. Verify it does not appear in listing
            response = self.client.get("/api/reports")
            self.assertEqual(response.status_code, 200)
            data = response.json()
            ids = [r["id"] for r in data]
            self.assertNotIn(unsaved_id, ids)

            # 3. Verify it returns 404 on individual GET
            response_get = self.client.get(f"/api/reports/{unsaved_id}")
            self.assertEqual(response_get.status_code, 404)

            # 4. Save it (update is_saved to 1)
            payload = {"is_saved": 1}
            response_post = self.client.post(f"/api/reports/{unsaved_id}", json=payload)
            self.assertEqual(response_post.status_code, 200)
            self.assertEqual(response_post.json(), {"status": "updated"})

            # 5. Verify it now appears in listing
            response = self.client.get("/api/reports")
            self.assertEqual(response.status_code, 200)
            data = response.json()
            ids = [r["id"] for r in data]
            self.assertIn(unsaved_id, ids)

            # 6. Verify it now succeeds on individual GET
            response_get = self.client.get(f"/api/reports/{unsaved_id}")
            self.assertEqual(response_get.status_code, 200)
            self.assertEqual(response_get.json()["id"], unsaved_id)
            self.assertEqual(response_get.json()["generated_report"], "Unsaved CBC report")
        finally:
            self.cursor.execute("DELETE FROM reports WHERE id = ?", (unsaved_id,))
            self.conn.commit()

if __name__ == "__main__":
    unittest.main()
