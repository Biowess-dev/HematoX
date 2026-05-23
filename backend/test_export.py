import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient
from backend.main import app


class TestExportRouter(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_export_pdf_success(self):
        # Sample markdown with tables and fenced code blocks
        test_markdown = (
            "# Test Title\n"
            "This is some paragraph text.\n\n"
            "| Header 1 | Header 2 |\n"
            "| --- | --- |\n"
            "| Cell 1 | Cell 2 |\n\n"
            "```python\n"
            "print('Hello World')\n"
            "```"
        )
        payload = {
            "markdown": test_markdown,
            "title": "Custom Test Report"
        }

        response = self.client.post("/api/export/pdf", json=payload)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers.get("content-type"), "application/pdf")
        from datetime import datetime, timezone
        file_date = datetime.now(timezone.utc).strftime("%Y%m%d")
        expected_disposition = f'attachment; filename="hematox_report_{file_date}.pdf"'
        self.assertEqual(
            response.headers.get("content-disposition"),
            expected_disposition
        )
        # Verify we received non-empty pdf bytes
        self.assertGreater(len(response.content), 0)

    def test_export_pdf_default_title(self):
        payload = {
            "markdown": "# Header\nHello world"
        }
        response = self.client.post("/api/export/pdf", json=payload)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers.get("content-type"), "application/pdf")
        self.assertGreater(len(response.content), 0)

    def test_export_pdf_with_metadata(self):
        payload = {
            "markdown": "# Header\nHello world",
            "title": "CBC Report",
            "patient_name": "Alice Smith",
            "display_id": "REP-9999",
            "module_type": "cbc"
        }
        response = self.client.post("/api/export/pdf", json=payload)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers.get("content-type"), "application/pdf")
        self.assertGreater(len(response.content), 0)


    def test_export_pdf_exception_returns_503(self):
        # Mock SimpleDocTemplate build to raise an exception
        payload = {
            "markdown": "Some markdown",
            "title": "Error Report"
        }
        with patch("backend.routers.export.SimpleDocTemplate.build") as mock_build:
            mock_build.side_effect = Exception("Simulated Reportlab failure")
            response = self.client.post("/api/export/pdf", json=payload)
            self.assertEqual(response.status_code, 503)
            self.assertEqual(
                response.json(),
                {"detail": "PDF generation failed: Simulated Reportlab failure"}
            )

    def test_numbered_canvas_headers(self):
        from backend.routers.export import NumberedCanvas
        import io
        
        buf = io.BytesIO()
        c = NumberedCanvas(buf)
        c.report_type = "cbc"
        c.display_id = "REP-1234"
        c.patient_name = "John Doe"
        c._pageNumber = 1
        
        with patch.object(c, "drawString") as mock_draw_string, \
             patch.object(c, "drawRightString") as mock_draw_right_string, \
             patch.object(c, "line") as mock_line:
            c.draw_page_decorations(1)
            # Should draw footer (drawString at y=34)
            mock_draw_string.assert_any_call(56.69, 34.0, c.drawString.call_args_list[0][0][2])
            # Should not draw header (y=805)
            for call in mock_draw_string.call_args_list:
                self.assertNotEqual(call[0][1], 805.0)
            mock_line.assert_not_called()
            
        c2 = NumberedCanvas(buf)
        c2.report_type = "cbc"
        c2.display_id = "REP-1234"
        c2.patient_name = "John Doe"
        c2._pageNumber = 2
        
        with patch.object(c2, "drawString") as mock_draw_string, \
             patch.object(c2, "drawRightString") as mock_draw_right_string, \
             patch.object(c2, "line") as mock_line:
            c2.draw_page_decorations(2)
            # Should draw footer (y=34)
            mock_draw_string.assert_any_call(56.69, 34.0, c2.drawString.call_args_list[0][0][2])
            # Should draw header (y=805)
            mock_draw_string.assert_any_call(56.69, 805.0, "CBC REPORT · Patient: John Doe")
            mock_draw_right_string.assert_any_call(538.58, 805.0, "ID: REP-1234")
            mock_line.assert_called_once_with(56.69, 797.0, 538.58, 797.0)



if __name__ == "__main__":
    unittest.main()
