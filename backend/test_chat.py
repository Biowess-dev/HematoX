import unittest
import sqlite3
import uuid
from unittest.mock import patch
from fastapi.testclient import TestClient
from backend.main import app


class TestChatRouter(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.conn = sqlite3.connect("./hematox.db")
        self.cursor = self.conn.cursor()

        # Ensure database tables exist by calling init_db from lifespan startup context
        # (FastAPI TestClient triggers lifespan automatically when using "with TestClient(app)")
        # We can also do a quick SELECT to be sure chat_sessions table is present
        self.cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='chat_sessions'")
        if not self.cursor.fetchone():
            # If not created yet, create table directly
            self.cursor.execute("""
                CREATE TABLE IF NOT EXISTS chat_sessions (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            self.conn.commit()

        # Let's generate a couple of unique IDs
        self.session_id_1 = f"test-session-{uuid.uuid4()}"
        self.session_id_2 = f"test-session-{uuid.uuid4()}"

        self.cursor.execute(
            "INSERT INTO chat_sessions (id, title, created_at) VALUES (?, ?, ?)",
            (self.session_id_1, "Chat Session 1", "2026-05-19 01:00:00")
        )
        self.cursor.execute(
            "INSERT INTO chat_sessions (id, title, created_at) VALUES (?, ?, ?)",
            (self.session_id_2, "Chat Session 2", "2026-05-19 02:00:00")
        )
        self.conn.commit()

    def tearDown(self):
        # Clean up inserted test records
        self.cursor.execute("DELETE FROM chat_sessions WHERE id IN (?, ?)", (self.session_id_1, self.session_id_2))
        self.conn.commit()
        self.conn.close()

    def test_list_sessions(self):
        response = self.client.get("/api/chat/sessions")
        self.assertEqual(response.status_code, 200)
        data = response.json()

        self.assertIsInstance(data, list)

        # Verify that our inserted test records are present
        filtered = [s for s in data if s["id"] in (self.session_id_1, self.session_id_2)]
        self.assertEqual(len(filtered), 2)

        # The one with created_at "2026-05-19 02:00:00" (session_id_2) should come first in DESC order
        self.assertEqual(filtered[0]["id"], self.session_id_2)
        self.assertEqual(filtered[1]["id"], self.session_id_1)

        # Verify keys
        allowed_keys = {"id", "title", "created_at"}
        for item in filtered:
            self.assertEqual(set(item.keys()), allowed_keys)

    def test_create_session_default(self):
        # POST with empty body (should use default title)
        response = self.client.post("/api/chat/sessions", json={})
        self.assertEqual(response.status_code, 200)
        data = response.json()

        self.assertIn("session_id", data)
        self.assertEqual(data["title"], "New Chat Session")

        # Verify in DB
        new_id = data["session_id"]
        self.cursor.execute("SELECT title FROM chat_sessions WHERE id = ?", (new_id,))
        row = self.cursor.fetchone()
        self.assertIsNotNone(row)
        self.assertEqual(row[0], "New Chat Session")

        # Clean up
        self.cursor.execute("DELETE FROM chat_sessions WHERE id = ?", (new_id,))
        self.conn.commit()

    def test_create_session_custom(self):
        # POST with custom title
        payload = {"title": "My Custom Title"}
        response = self.client.post("/api/chat/sessions", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()

        self.assertIn("session_id", data)
        self.assertEqual(data["title"], "My Custom Title")

        # Verify in DB
        new_id = data["session_id"]
        self.cursor.execute("SELECT title FROM chat_sessions WHERE id = ?", (new_id,))
        row = self.cursor.fetchone()
        self.assertIsNotNone(row)
        self.assertEqual(row[0], "My Custom Title")

        # Clean up
        self.cursor.execute("DELETE FROM chat_sessions WHERE id = ?", (new_id,))
        self.conn.commit()

    def test_delete_session_success(self):
        # DELETE session 1
        response = self.client.delete(f"/api/chat/sessions/{self.session_id_1}")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "deleted"})

        # Verify not in DB
        self.cursor.execute("SELECT 1 FROM chat_sessions WHERE id = ?", (self.session_id_1,))
        row = self.cursor.fetchone()
        self.assertIsNone(row)

    def test_delete_session_not_found(self):
        response = self.client.delete("/api/chat/sessions/nonexistent-session")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {"detail": "Session not found"})

    def test_update_session_success(self):
        # PATCH session 1
        payload = {"title": "Updated Chat Title"}
        response = self.client.patch(f"/api/chat/sessions/{self.session_id_1}", json=payload)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "updated"})

        # Verify in DB
        self.cursor.execute("SELECT title FROM chat_sessions WHERE id = ?", (self.session_id_1,))
        row = self.cursor.fetchone()
        self.assertEqual(row[0], "Updated Chat Title")

    def test_update_session_not_found(self):
        payload = {"title": "Updated Chat Title"}
        response = self.client.patch("/api/chat/sessions/nonexistent-session", json=payload)
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {"detail": "Session not found"})

    def test_get_messages_empty(self):
        # Session 1 exists but has no messages.
        response = self.client.get(f"/api/chat/sessions/{self.session_id_1}/messages")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), [])

    def test_get_messages_not_found(self):
        response = self.client.get("/api/chat/sessions/nonexistent-session/messages")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {"detail": "Session not found"})

    def test_get_messages_success(self):
        # Let's insert some messages for session 1
        self.cursor.execute(
            "INSERT INTO chat_messages (session_id, role, content, created_at) VALUES (?, ?, ?, ?)",
            (self.session_id_1, "user", "Hello", "2026-05-19 03:00:00")
        )
        self.cursor.execute(
            "INSERT INTO chat_messages (session_id, role, content, created_at) VALUES (?, ?, ?, ?)",
            (self.session_id_1, "model", "Hi there!", "2026-05-19 03:01:00")
        )
        self.conn.commit()

        try:
            response = self.client.get(f"/api/chat/sessions/{self.session_id_1}/messages")
            self.assertEqual(response.status_code, 200)
            data = response.json()
            self.assertEqual(len(data), 2)
            self.assertEqual(data[0]["role"], "user")
            self.assertEqual(data[0]["content"], "Hello")
            self.assertEqual(data[1]["role"], "model")
            self.assertEqual(data[1]["content"], "Hi there!")
        finally:
            self.cursor.execute("DELETE FROM chat_messages WHERE session_id = ?", (self.session_id_1,))
            self.conn.commit()

    def test_append_message_helper_success(self):
        import asyncio
        from backend.routers.chat import append_message
        from backend.database import get_db

        async def run_append_helper():
            async with get_db() as db:
                await append_message(self.session_id_1, "user", "Test helper", db)
                await db.commit()

        asyncio.run(run_append_helper())

        # Verify using our cursor
        self.cursor.execute("SELECT role, content FROM chat_messages WHERE session_id = ?", (self.session_id_1,))
        rows = self.cursor.fetchall()
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0][0], "user")
        self.assertEqual(rows[0][1], "Test helper")

        # Cleanup
        self.cursor.execute("DELETE FROM chat_messages WHERE session_id = ?", (self.session_id_1,))
        self.conn.commit()

    def test_append_message_helper_assert_role(self):
        import asyncio
        from backend.routers.chat import append_message
        from backend.database import get_db

        async def run_append_invalid_role():
            async with get_db() as db:
                await append_message(self.session_id_1, "invalid_role", "Test helper", db)

        with self.assertRaises(ValueError):
            asyncio.run(run_append_invalid_role())

    def test_send_message_session_not_found(self):
        response = self.client.post(
            "/api/chat/sessions/nonexistent-session/send",
            json={"message": "Hello"}
        )
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {"detail": "Session not found"})

    def test_send_message_empty(self):
        response = self.client.post(
            f"/api/chat/sessions/{self.session_id_1}/send",
            json={"message": "   "}
        )
        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json(), {"detail": "Message cannot be empty"})

    @patch("backend.routers.chat.generate_chat")
    def test_send_message_success(self, mock_generate):
        mock_generate.return_value = "Mocked Gemini Response"
        
        # Clear messages
        self.cursor.execute("DELETE FROM chat_messages WHERE session_id = ?", (self.session_id_1,))
        self.conn.commit()
        
        # Insert a previous message to test conversation history concatenation
        self.cursor.execute(
            "INSERT INTO chat_messages (session_id, role, content, created_at) VALUES (?, ?, ?, ?)",
            (self.session_id_1, "user", "Previous query", "2026-05-19 03:00:00")
        )
        self.conn.commit()
        
        payload = {
            "message": "New query",
            "attached_report_ids": []
        }
        
        response = self.client.post(
            f"/api/chat/sessions/{self.session_id_1}/send",
            json=payload
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"answer": "Mocked Gemini Response"})
        
        # Verify prompt build
        mock_generate.assert_called_once()
        called_contents = mock_generate.call_args[0][0]
        called_system_prompt = mock_generate.call_args[0][1]
        
        # Check system prompt is present in system prompt
        self.assertIn("You are HematoX, a domain-locked hematology reasoning assistant", called_system_prompt)
        # Check history contains the previous message
        self.assertEqual(called_contents[0]["parts"][0]["text"], "Previous query")
        # Check current query is present
        self.assertEqual(called_contents[1]["parts"][0]["text"], "New query")
        
        # Verify both user and model messages saved in DB
        self.cursor.execute("SELECT role, content FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC", (self.session_id_1,))
        rows = self.cursor.fetchall()
        self.assertEqual(len(rows), 3)
        self.assertEqual(rows[1][0], "user")
        self.assertEqual(rows[1][1], "New query")
        self.assertEqual(rows[2][0], "model")
        self.assertEqual(rows[2][1], "Mocked Gemini Response")

        # Cleanup test messages
        self.cursor.execute("DELETE FROM chat_messages WHERE session_id = ?", (self.session_id_1,))
        self.conn.commit()

    @patch("backend.routers.chat.generate_chat")
    def test_send_message_with_reports(self, mock_generate):
        mock_generate.return_value = "Mock response"
        
        # Insert dummy report
        report_id = "test-report-abc"
        self.cursor.execute(
            "INSERT INTO reports (id, module_type, input_parameters, generated_report, title) VALUES (?, ?, ?, ?, ?)",
            (report_id, "cbc", "{}", "## TEST REPORT CONTENT", "Test Title")
        )
        self.conn.commit()
        
        try:
            # Clear messages
            self.cursor.execute("DELETE FROM chat_messages WHERE session_id = ?", (self.session_id_1,))
            self.conn.commit()
            
            payload = {
                "message": "Query with report",
                "attached_report_ids": [report_id, "non-existent-report-id"]
            }
            
            response = self.client.post(
                f"/api/chat/sessions/{self.session_id_1}/send",
                json=payload
            )
            self.assertEqual(response.status_code, 200)
            
            called_contents = mock_generate.call_args[0][0]
            called_system_prompt = mock_generate.call_args[0][1]
            
            # Check report is in system prompt
            self.assertIn("## ATTACHED CASE REPORTS\n## TEST REPORT CONTENT", called_system_prompt)
            # Check current query is present in contents
            self.assertEqual(called_contents[0]["parts"][0]["text"], "Query with report")

            # Verify both user and model messages saved in DB with referenced_reports
            self.cursor.execute("SELECT role, content, referenced_reports FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC", (self.session_id_1,))
            rows = self.cursor.fetchall()
            self.assertEqual(len(rows), 2)
            self.assertEqual(rows[0][0], "user")
            self.assertEqual(rows[0][1], "Query with report")
            
            import json
            ref_reports_user = json.loads(rows[0][2])
            self.assertEqual(len(ref_reports_user), 1)
            self.assertEqual(ref_reports_user[0]["id"], report_id)
            self.assertEqual(ref_reports_user[0]["title"], "Test Title")

            self.assertEqual(rows[1][0], "model")
            self.assertEqual(rows[1][1], "Mock response")
            ref_reports_model = json.loads(rows[1][2])
            self.assertEqual(len(ref_reports_model), 1)
            self.assertEqual(ref_reports_model[0]["id"], report_id)
        finally:
            # Cleanup report and messages
            self.cursor.execute("DELETE FROM chat_messages WHERE session_id = ?", (self.session_id_1,))
            self.cursor.execute("DELETE FROM reports WHERE id = ?", (report_id,))
            self.conn.commit()

    @patch("backend.routers.chat.generate_chat")
    def test_send_message_gemini_error(self, mock_generate):
        mock_generate.side_effect = RuntimeError("Gemini is down")
        
        # Clear existing messages for session 1
        self.cursor.execute("DELETE FROM chat_messages WHERE session_id = ?", (self.session_id_1,))
        self.conn.commit()
        
        response = self.client.post(
            f"/api/chat/sessions/{self.session_id_1}/send",
            json={"message": "Help me with anemia"}
        )
        self.assertEqual(response.status_code, 503)
        self.assertIn("Gemini is down", response.json()["detail"])
        
        # Verify that ONLY the user message is saved
        self.cursor.execute("SELECT role, content FROM chat_messages WHERE session_id = ?", (self.session_id_1,))
        rows = self.cursor.fetchall()
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0][0], "user")
        self.assertEqual(rows[0][1], "Help me with anemia")

        # Cleanup test messages
        self.cursor.execute("DELETE FROM chat_messages WHERE session_id = ?", (self.session_id_1,))
        self.conn.commit()


if __name__ == "__main__":
    unittest.main()

