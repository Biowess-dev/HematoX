import unittest
from fastapi.testclient import TestClient
from unittest.mock import patch

from backend.validators import validate_cbc_inputs, validate_coag_inputs, validate_rotem_inputs
from backend.main import app

class TestClinicalValidators(unittest.TestCase):
    def test_validate_cbc_inputs(self):
        # Normal inputs (ratio = 6.0, which is between 5 and 10)
        warnings = validate_cbc_inputs({"hb": 10.0, "hct": 60.0, "mchc": 33.0, "rdw": 13.0})
        self.assertEqual(warnings, [])

        # Hgb/Hct ratio inconsistent
        warnings = validate_cbc_inputs({"hb": 14.0, "hct": 42.0}) # ratio is 3.0 (not between 5 and 10)
        self.assertIn("Hgb/Hct ratio appears inconsistent — verify units", warnings)
        
        # Hgb/Hct ratio consistent
        warnings = validate_cbc_inputs({"hb": 5.0, "hct": 30.0}) # ratio is 6.0
        self.assertNotIn("Hgb/Hct ratio appears inconsistent — verify units", warnings)

        # MCHC > 38.0
        warnings = validate_cbc_inputs({"mchc": 39.0})
        self.assertIn("MCHC > 38 g/dL — consider spherocytosis, lipemia, or spurious result", warnings)

        # RDW > 30.0
        warnings = validate_cbc_inputs({"rdw": 31.5})
        self.assertIn("RDW > 30% is extreme — verify result", warnings)

    def test_validate_coag_inputs(self):
        # Normal inputs
        warnings = validate_coag_inputs({"inr": 1.1, "aptt": 30.0})
        self.assertEqual(warnings, [])

        # INR > 10.0
        warnings = validate_coag_inputs({"inr": 12.5})
        self.assertIn("INR > 10 — critical coagulopathy; verify for dilutional or synthetic failure", warnings)

        # aPTT > 150
        warnings = validate_coag_inputs({"aptt": 160.0})
        self.assertIn("aPTT > 150s — consider presence of inhibitor or anticoagulant", warnings)

    def test_validate_rotem_inputs(self):
        # Normal inputs
        warnings = validate_rotem_inputs({
            "extem": {"mcf": 55.0},
            "intem": {"mcf": 60.0},
            "fibtem": {"mcf": 15.0},
            "aptem": {"mcf": 56.0}
        })
        self.assertEqual(warnings, [])

        # MCF < 5
        warnings = validate_rotem_inputs({
            "extem": {"mcf": 4.0},
            "fibtem": {"mcf": 3.0}
        })
        self.assertIn("EXTEM MCF < 5mm — severely impaired clot firmness", warnings)
        self.assertIn("FIBTEM MCF < 5mm — severely impaired clot firmness", warnings)
        self.assertNotIn("INTEM MCF < 5mm — severely impaired clot firmness", warnings)


class TestValidatorsIntegration(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app, raise_server_exceptions=False)

    @patch("backend.routers.analyze.generate")
    @patch("backend.routers.analyze.load_corpus")
    def test_cbc_endpoint_with_warnings(self, mock_load_corpus, mock_generate):
        mock_load_corpus.return_value = "Test CBC Guidelines"
        mock_generate.return_value = "Response"
        
        payload = {
            "hb": 14.0,
            "hct": 42.0,  # ratio 3.0 is inconsistent
            "mchc": 39.0  # > 38.0 is high
        }
        
        response = self.client.post("/api/analyze/cbc", json=payload)
        self.assertEqual(response.status_code, 200)
        
        # Verify the prompt had the warnings prepended
        called_prompt = mock_generate.call_args[0][0]
        self.assertTrue(called_prompt.startswith("## VALIDATION WARNINGS\n"))
        self.assertIn("- Hgb/Hct ratio appears inconsistent — verify units", called_prompt)
        self.assertIn("- MCHC > 38 g/dL — consider spherocytosis, lipemia, or spurious result", called_prompt)

    @patch("backend.routers.analyze.generate")
    @patch("backend.routers.analyze.load_corpus")
    def test_coag_endpoint_with_warnings(self, mock_load_corpus, mock_generate):
        mock_load_corpus.return_value = "Test Coag Guidelines"
        mock_generate.return_value = "Response"
        
        payload = {
            "inr": 11.0,
            "aptt": 160.0
        }
        
        response = self.client.post("/api/analyze/coag", json=payload)
        self.assertEqual(response.status_code, 200)
        
        called_prompt = mock_generate.call_args[0][0]
        self.assertTrue(called_prompt.startswith("## VALIDATION WARNINGS\n"))
        self.assertIn("- INR > 10 — critical coagulopathy; verify for dilutional or synthetic failure", called_prompt)
        self.assertIn("- aPTT > 150s — consider presence of inhibitor or anticoagulant", called_prompt)

    @patch("backend.routers.analyze.generate")
    @patch("backend.routers.analyze.load_corpus")
    def test_rotem_endpoint_with_warnings(self, mock_load_corpus, mock_generate):
        mock_load_corpus.return_value = "Test ROTEM Guidelines"
        mock_generate.return_value = "Response"
        
        payload = {
            "extem": {"mcf": 3.0},
            "intem": {"mcf": 60.0}
        }
        
        response = self.client.post("/api/analyze/rotem", json=payload)
        self.assertEqual(response.status_code, 200)
        
        called_prompt = mock_generate.call_args[0][0]
        self.assertTrue(called_prompt.startswith("## VALIDATION WARNINGS\n"))
        self.assertIn("- EXTEM MCF < 5mm — severely impaired clot firmness", called_prompt)
        self.assertNotIn("INTEM MCF < 5mm", called_prompt)


class TestGlobalExceptionHandlers(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app, raise_server_exceptions=False)

    def test_validation_error_handler(self):
        # Send an invalid payload to trigger RequestValidationError (e.g. string for patient_age)
        payload = {
            "patient_age": "not-a-number"
        }
        response = self.client.post("/api/analyze/cbc", json=payload)
        self.assertEqual(response.status_code, 422)
        resp_json = response.json()
        self.assertEqual(resp_json["detail"], "Validation error")
        self.assertIn("errors", resp_json)

    @patch("backend.routers.analyze.validate_cbc_inputs")
    def test_general_exception_handler(self, mock_validate):
        # Force a generic Exception to trigger the 500 exception handler
        mock_validate.side_effect = Exception("Unexpected server crash")
        
        payload = {
            "hb": 14.0
        }
        response = self.client.post("/api/analyze/cbc", json=payload)
        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.json(), {"detail": "Internal server error. See server logs."})
