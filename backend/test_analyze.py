import unittest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
import json

from backend.prompt_builder import build_analysis_prompt, flag_outliers
from backend.main import app

class TestPromptBuilder(unittest.TestCase):
    def test_build_analysis_prompt_no_reports(self):
        corpus = "Some corpus content"
        inputs = {"hb": 13.5, "wbc": 7.0}
        prompt = build_analysis_prompt("cbc", corpus, inputs)
        
        # Verify exact system rules block
        self.assertIn("You are HEMATOX, a domain-locked hematology reasoning engine for educational and clinical decision-support use.", prompt)
        self.assertIn("CONTEXT PRIORITY LAW (strictly enforced):", prompt)
        self.assertIn("1. LOCAL GUIDELINES (corpus below) = your primary reasoning authority. Never contradict them.", prompt)
        self.assertIn("2. Search grounding or external knowledge = second source when corpus is incomplete. (use gemini-3.1-flash-lite for this specific task)", prompt)
        self.assertIn("3. General model knowledge = fallback only. Never override corpus with it.", prompt)
        self.assertIn("4. Chat context (summary + messages) = situational context only. Not a reasoning authority.", prompt)
        self.assertIn("Frame all conclusions as differential hypotheses. Never issue definitive diagnoses.", prompt)
        self.assertIn("Respond in strict academic and clinical tone. No casual language.", prompt)
        
        # Verify Domain Knowledge
        self.assertIn("## DOMAIN KNOWLEDGE\nSome corpus content", prompt)
        
        # Verify Style Guide
        self.assertIn("## Observed Data", prompt)
        self.assertIn("## Physiological Interpretation", prompt)
        self.assertIn("## Differential Diagnoses", prompt)
        self.assertIn("## Severity Assessment", prompt)
        self.assertIn("## Clinical Correlation", prompt)
        self.assertIn("## Limitations", prompt)
        
        # Verify Patient Inputs
        self.assertIn("## PATIENT INPUTS\n{\n  \"hb\": 13.5,\n  \"wbc\": 7.0\n}", prompt)
        
        # Verify no attached historical reports header when empty
        self.assertNotIn("## ATTACHED HISTORICAL REPORTS", prompt)
        
        # Verify Output Contract
        self.assertIn("Respond ONLY in structured Markdown. Do not add disclaimers outside the Limitations section.", prompt)

    def test_build_analysis_prompt_with_reports(self):
        corpus = "Some corpus content"
        inputs = {"hb": 13.5}
        attached = ["Report 1 text", "Report 2 text"]
        prompt = build_analysis_prompt("cbc", corpus, inputs, attached_reports=attached)
        
        self.assertIn("## ATTACHED HISTORICAL REPORTS\nReport 1 text\n---\nReport 2 text", prompt)

    def test_build_analysis_prompt_with_patient_context(self):
        corpus = "Some corpus content"
        inputs = {"hb": 13.5}
        prompt = build_analysis_prompt("cbc", corpus, inputs, patient_name="John Doe", display_id="REP123")
        
        # Verify PATIENT CONTEXT
        self.assertIn("## PATIENT CONTEXT\nPatient: John Doe\nReport ID: REP123", prompt)
        self.assertIn("The patient name is for labeling only — do not use it for medical inference.", prompt)
        
        # Verify position (before PATIENT INPUTS block)
        context_idx = prompt.index("## PATIENT CONTEXT")
        inputs_idx = prompt.index("## PATIENT INPUTS")
        self.assertTrue(context_idx < inputs_idx)



class TestAnalyzeEndpoint(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    @patch("backend.routers.analyze.generate")
    @patch("backend.routers.analyze.load_corpus")
    def test_analyze_cbc_success(self, mock_load_corpus, mock_generate):
        mock_load_corpus.return_value = "Test Guidelines Content"
        mock_generate.return_value = "Gemini Simulated Response"
        
        payload = {
            "hb": 12.0,
            "blasts": True,
            "patient_age": 45,
            "patient_sex": "female"
        }
        
        response = self.client.post("/api/analyze/cbc", json=payload)
        
        self.assertEqual(response.status_code, 200)
        resp_json = response.json()
        self.assertIsNotNone(resp_json["report_id"])
        self.assertEqual(resp_json["markdown"], "Gemini Simulated Response")
        
        mock_load_corpus.assert_called_once_with("cbc")
        
        # Verify prompt builder call inputs
        mock_generate.assert_called_once()
        called_prompt = mock_generate.call_args[0][0]
        self.assertIn("Test Guidelines Content", called_prompt)
        self.assertIn("blasts", called_prompt)
        self.assertIn("true", called_prompt)

    @patch("backend.routers.analyze.generate")
    @patch("backend.routers.analyze.load_corpus")
    def test_analyze_cbc_patient_name_and_display_id(self, mock_load_corpus, mock_generate):
        mock_load_corpus.return_value = "Test Guidelines Content"
        mock_generate.return_value = "Gemini Simulated Response"

        payload = {
            "hb": 12.0,
            "blasts": True,
            "patient_age": 45,
            "patient_sex": "female",
            "patient_name": "Jane Doe"
        }

        response = self.client.post("/api/analyze/cbc", json=payload)
        self.assertEqual(response.status_code, 200)
        resp_json = response.json()
        self.assertIsNotNone(resp_json["report_id"])
        self.assertIsNotNone(resp_json["display_id"])
        self.assertTrue(resp_json["display_id"].startswith("cbc-"))
        self.assertEqual(resp_json["markdown"], "Gemini Simulated Response")

        # Verify that patient_name was stripped from inputs passed to build_analysis_prompt
        called_prompt = mock_generate.call_args[0][0]
        self.assertIn("Jane Doe", called_prompt)  # Patient Name should be in the PATIENT CONTEXT
        self.assertNotIn('"patient_name": "Jane Doe"', called_prompt)  # But stripped from PATIENT INPUTS

    @patch("backend.routers.analyze.load_corpus")
    def test_analyze_cbc_value_error_in_loader(self, mock_load_corpus):
        mock_load_corpus.side_effect = ValueError("Unknown module type: cbc")
        
        payload = {"hb": 12.0}
        response = self.client.post("/api/analyze/cbc", json=payload)
        
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json(), {"detail": "Unknown module type: cbc"})

    @patch("backend.routers.analyze.generate")
    @patch("backend.routers.analyze.load_corpus")
    def test_analyze_cbc_runtime_error_in_generate(self, mock_load_corpus, mock_generate):
        mock_load_corpus.return_value = "Test Guidelines Content"
        mock_generate.side_effect = RuntimeError("Gemini API error: Quota exceeded")
        
        payload = {"hb": 12.0}
        response = self.client.post("/api/analyze/cbc", json=payload)
        
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json(), {"detail": "Gemini API error: Quota exceeded"})

    @patch("backend.routers.analyze.generate")
    @patch("backend.routers.analyze.load_corpus")
    def test_analyze_coag_success(self, mock_load_corpus, mock_generate):
        mock_load_corpus.return_value = "Coag Guidelines Content"
        mock_generate.return_value = "Gemini Coag Response"
        
        payload = {
            "inr": 2.5,
            "pt_activity": 45.0,
            "patient_age": 60,
            "patient_sex": "male"
        }
        
        response = self.client.post("/api/analyze/coag", json=payload)
        
        self.assertEqual(response.status_code, 200)
        resp_json = response.json()
        self.assertIsNotNone(resp_json["report_id"])
        self.assertEqual(resp_json["markdown"], "Gemini Coag Response")
        
        mock_load_corpus.assert_called_once_with("coag")
        
        # Verify prompt builder call inputs
        mock_generate.assert_called_once()
        called_prompt = mock_generate.call_args[0][0]
        self.assertIn("Coag Guidelines Content", called_prompt)
        self.assertIn("inr", called_prompt)
        self.assertIn("pt_activity", called_prompt)
        # Verify null values are retained in the JSON prompt
        self.assertIn('"fibrinogen": null', called_prompt)

    def test_analyze_coag_validation_failure(self):
        # Even if patient metadata is provided, if all coag values are None, it should fail
        payload = {
            "patient_age": 60,
            "patient_sex": "male"
        }
        response = self.client.post("/api/analyze/coag", json=payload)
        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json(), {"detail": "No coagulation values provided"})

    @patch("backend.routers.analyze.load_corpus")
    def test_analyze_coag_value_error_in_loader(self, mock_load_corpus):
        mock_load_corpus.side_effect = ValueError("Unknown module type: coag")
        
        payload = {"inr": 1.1}
        response = self.client.post("/api/analyze/coag", json=payload)
        
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json(), {"detail": "Unknown module type: coag"})

    @patch("backend.routers.analyze.generate")
    @patch("backend.routers.analyze.load_corpus")
    def test_analyze_coag_runtime_error_in_generate(self, mock_load_corpus, mock_generate):
        mock_load_corpus.return_value = "Coag Guidelines Content"
        mock_generate.side_effect = RuntimeError("Gemini API error: Quota exceeded")
        
        payload = {"inr": 1.1}
        response = self.client.post("/api/analyze/coag", json=payload)
        
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json(), {"detail": "Gemini API error: Quota exceeded"})

    def test_flag_outliers_cbc(self):
        # Normal
        self.assertEqual(flag_outliers("cbc", {"hb": 14.0, "wbc": 7.0, "platelets": 250}), [])
        # Outliers
        self.assertEqual(
            flag_outliers("cbc", {"hb": 1.5, "wbc": 550, "platelets": 3500}),
            [
                "Hemoglobin value is extreme (< 2 or > 25 g/dL) — verify",
                "WBC > 500 × 10⁹/L — verify for leukostasis or lab error",
                "Platelets > 3000 × 10⁹/L — verify for extreme thrombocytosis"
            ]
        )
        self.assertEqual(
            flag_outliers("cbc", {"hb": 26.0}),
            ["Hemoglobin value is extreme (< 2 or > 25 g/dL) — verify"]
        )

    def test_flag_outliers_coag(self):
        # Normal
        self.assertEqual(flag_outliers("coag", {"inr": 1.5, "aptt": 35, "fibrinogen": 2.5}), [])
        # Outliers
        self.assertEqual(
            flag_outliers("coag", {"inr": 25.0, "aptt": 320, "fibrinogen": 0.05}),
            [
                "INR > 20 — extreme coagulopathy; verify",
                "aPTT > 300s — extreme prolongation; verify",
                "Fibrinogen < 0.1 g/L — critical hypofibrinogenemia"
            ]
        )

    def test_flag_outliers_rotem(self):
        # Normal / None
        self.assertEqual(flag_outliers("rotem", {"extem": {"mcf": 60}, "intem": None}), [])
        # Outliers
        inputs = {
            "extem": {"mcf": -5.0},
            "intem": {"mcf": -2.0, "ct": 80},
            "fibtem": {"mcf": 10},
            "aptem": {"mcf": -0.5}
        }
        self.assertEqual(
            flag_outliers("rotem", inputs),
            [
                "EXTEM MCF < 0 — invalid value",
                "INTEM MCF < 0 — invalid value",
                "APTEM MCF < 0 — invalid value"
            ]
        )

    def test_prompt_includes_outlier_flags(self):
        corpus = "Some corpus guidelines"
        inputs = {"hb": 1.5, "wbc": 600}
        prompt = build_analysis_prompt("cbc", corpus, inputs)
        
        # Verify warnings are present
        self.assertIn("## OUTLIER FLAGS", prompt)
        self.assertIn("Hemoglobin value is extreme (< 2 or > 25 g/dL) — verify", prompt)
        self.assertIn("WBC > 500 × 10⁹/L — verify for leukostasis or lab error", prompt)
        
        # Verify it is positioned before the output contract section
        sections = prompt.split("\n\n")
        self.assertEqual(sections[-1], "Respond ONLY in structured Markdown. Do not add disclaimers outside the Limitations section.")
        self.assertTrue(sections[-2].startswith("## OUTLIER FLAGS"))

    @patch("backend.routers.analyze.generate")
    @patch("backend.routers.analyze.load_corpus")
    def test_analyze_rotem_success(self, mock_load_corpus, mock_generate):
        mock_load_corpus.return_value = "ROTEM Guidelines Content"
        mock_generate.return_value = "Gemini ROTEM Response"
        
        payload = {
            "extem": {"ct": 80.0, "mcf": 55.0},
            "patient_age": 45,
            "patient_sex": "female"
        }
        
        response = self.client.post("/api/analyze/rotem", json=payload)
        
        self.assertEqual(response.status_code, 200)
        resp_json = response.json()
        self.assertIsNotNone(resp_json["report_id"])
        self.assertEqual(resp_json["markdown"], "Gemini ROTEM Response")
        
        mock_load_corpus.assert_called_once_with("rotem")
        
        # Verify prompt builder call inputs
        mock_generate.assert_called_once()
        called_prompt = mock_generate.call_args[0][0]
        self.assertIn("ROTEM Guidelines Content", called_prompt)
        self.assertIn('"extem"', called_prompt)
        self.assertIn('"ct": 80.0', called_prompt)
        # Verify null values are retained in the JSON prompt
        self.assertIn('"intem": null', called_prompt)
        self.assertIn('"fibtem": null', called_prompt)
        self.assertIn('"aptem": null', called_prompt)

    def test_analyze_rotem_validation_failure(self):
        # Even if patient metadata is provided, if all ROTEM assays are None, it should fail
        payload = {
            "patient_age": 45,
            "patient_sex": "female"
        }
        response = self.client.post("/api/analyze/rotem", json=payload)
        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json(), {"detail": "At least one ROTEM assay must be provided"})

    @patch("backend.routers.analyze.load_corpus")
    def test_analyze_rotem_value_error_in_loader(self, mock_load_corpus):
        mock_load_corpus.side_effect = ValueError("Unknown module type: rotem")
        
        payload = {"extem": {"ct": 80.0}}
        response = self.client.post("/api/analyze/rotem", json=payload)
        
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json(), {"detail": "Unknown module type: rotem"})

    @patch("backend.routers.analyze.generate")
    @patch("backend.routers.analyze.load_corpus")
    def test_analyze_rotem_runtime_error_in_generate(self, mock_load_corpus, mock_generate):
        mock_load_corpus.return_value = "ROTEM Guidelines Content"
        mock_generate.side_effect = RuntimeError("Gemini API error: Quota exceeded")
        
        payload = {"extem": {"ct": 80.0}}
        response = self.client.post("/api/analyze/rotem", json=payload)
        
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json(), {"detail": "Gemini API error: Quota exceeded"})

    @patch("backend.routers.analyze.save_report")
    @patch("backend.routers.analyze.generate")
    @patch("backend.routers.analyze.load_corpus")
    def test_analyze_cbc_save_report_exception_graceful(self, mock_load_corpus, mock_generate, mock_save_report):
        mock_load_corpus.return_value = "Test Guidelines Content"
        mock_generate.return_value = "Gemini Simulated Response"
        mock_save_report.side_effect = Exception("Database connection failure")
        
        payload = {"hb": 12.0}
        response = self.client.post("/api/analyze/cbc", json=payload)
        
        self.assertEqual(response.status_code, 200)
        resp_json = response.json()
        self.assertIsNone(resp_json["report_id"])
        self.assertEqual(resp_json["markdown"], "Gemini Simulated Response")

    @patch("backend.routers.analyze.generate")
    @patch("backend.routers.analyze.load_corpus")
    def test_analyze_cbc_persistence(self, mock_load_corpus, mock_generate):
        mock_load_corpus.return_value = "Test Guidelines Content"
        mock_generate.return_value = "Gemini Simulated Response"
        
        payload = {"hb": 12.0}
        response = self.client.post("/api/analyze/cbc", json=payload)
        self.assertEqual(response.status_code, 200)
        resp_json = response.json()
        report_id = resp_json["report_id"]
        self.assertIsNotNone(report_id)
        
        import sqlite3
        conn = sqlite3.connect("./hematox.db")
        cursor = conn.cursor()
        cursor.execute("SELECT id, module_type, generated_report, is_bookmarked FROM reports WHERE id = ?", (report_id,))
        row = cursor.fetchone()
        self.assertIsNotNone(row)
        self.assertEqual(row[0], report_id)
        self.assertEqual(row[1], "cbc")
        self.assertEqual(row[2], "Gemini Simulated Response")
        self.assertEqual(row[3], 0)
        
        cursor.execute("SELECT report_id, source_type, source_name FROM grounding_sources WHERE report_id = ?", (report_id,))
        source_row = cursor.fetchone()
        self.assertIsNotNone(source_row)
        self.assertEqual(source_row[0], report_id)
        self.assertEqual(source_row[1], "local_md")
        self.assertEqual(source_row[2], "cbc_guidelines.md")
        conn.close()

    @patch("backend.routers.analyze.generate")
    @patch("backend.routers.analyze.load_corpus")
    def test_analyze_cbc_language_french(self, mock_load_corpus, mock_generate):
        mock_load_corpus.return_value = "Test Guidelines Content"
        mock_generate.return_value = "French Response"
        
        payload = {
            "hb": 12.0,
            "patient_age": 45,
            "patient_sex": "female",
            "language": "fr"
        }
        
        response = self.client.post("/api/analyze/cbc", json=payload)
        self.assertEqual(response.status_code, 200)
        
        # Verify that French prompt instructions were appended
        called_prompt = mock_generate.call_args[0][0]
        self.assertIn("CRITICAL: You must generate the entire report output and markdown text in French.", called_prompt)

    @patch("backend.routers.analyze.generate")
    @patch("backend.routers.analyze.load_corpus")
    def test_analyze_cbc_language_english(self, mock_load_corpus, mock_generate):
        mock_load_corpus.return_value = "Test Guidelines Content"
        mock_generate.return_value = "English Response"
        
        payload = {
            "hb": 12.0,
            "patient_age": 45,
            "patient_sex": "female",
            "language": "en"
        }
        
        response = self.client.post("/api/analyze/cbc", json=payload)
        self.assertEqual(response.status_code, 200)
        
        # Verify that English prompt instructions were appended
        called_prompt = mock_generate.call_args[0][0]
        self.assertIn("CRITICAL: You must generate the entire report output and markdown text in English.", called_prompt)

if __name__ == "__main__":
    unittest.main()

