import os
import unittest
import asyncio
from unittest.mock import MagicMock, patch

# Clear any existing GEMINI_API_KEY from environment first to ensure clean import testing
if "GEMINI_API_KEY" in os.environ:
    del os.environ["GEMINI_API_KEY"]

import backend.gemini_client as gemini_client

class TestGeminiClient(unittest.IsolatedAsyncioTestCase):
    async def test_get_api_key_status(self):
        # 1. Test key not set
        if "GEMINI_API_KEY" in os.environ:
            del os.environ["GEMINI_API_KEY"]
        self.assertFalse(await gemini_client.get_api_key_status())

        # 2. Test key empty string
        os.environ["GEMINI_API_KEY"] = ""
        self.assertFalse(await gemini_client.get_api_key_status())

        # 3. Test key non-empty string
        os.environ["GEMINI_API_KEY"] = "some-key"
        self.assertTrue(await gemini_client.get_api_key_status())

    async def test_generate_missing_key(self):
        # Test ValueError raised when key is empty
        os.environ["GEMINI_API_KEY"] = ""
        with self.assertRaises(ValueError) as ctx:
            await gemini_client.generate("hello")
        self.assertEqual(str(ctx.exception), "GEMINI_API_KEY not configured")

        # Test ValueError raised when key is None (not present)
        if "GEMINI_API_KEY" in os.environ:
            del os.environ["GEMINI_API_KEY"]
        with self.assertRaises(ValueError) as ctx:
            await gemini_client.generate("hello")
        self.assertEqual(str(ctx.exception), "GEMINI_API_KEY not configured")

    @patch("backend.gemini_client.genai")
    async def test_generate_success(self, mock_genai):
        os.environ["GEMINI_API_KEY"] = "test-api-key"
        
        # Mock response
        mock_response = MagicMock()
        mock_response.text = "Hello from Gemini!"
        
        mock_client_instance = MagicMock()
        mock_client_instance.models.generate_content.return_value = mock_response
        mock_genai.Client.return_value = mock_client_instance
        
        result = await gemini_client.generate("Say hello", model="gemini-3.1-flash-lite")
        
        # Assertions
        mock_genai.Client.assert_called_once_with(api_key="test-api-key")
        mock_client_instance.models.generate_content.assert_called_once_with(
            model="gemini-3.1-flash-lite",
            contents="Say hello"
        )
        self.assertEqual(result, "Hello from Gemini!")

    @patch("backend.gemini_client.genai")
    async def test_generate_empty_response(self, mock_genai):
        os.environ["GEMINI_API_KEY"] = "test-api-key"
        
        # Mock response with empty/None text
        mock_response = MagicMock()
        mock_response.text = None
        
        mock_client_instance = MagicMock()
        mock_client_instance.models.generate_content.return_value = mock_response
        mock_genai.Client.return_value = mock_client_instance
        
        result = await gemini_client.generate("Say hello")
        self.assertEqual(result, "")

    @patch("backend.gemini_client.genai")
    async def test_generate_api_error(self, mock_genai):
        os.environ["GEMINI_API_KEY"] = "test-api-key"
        
        # Mock error during API call
        mock_client_instance = MagicMock()
        mock_client_instance.models.generate_content.side_effect = Exception("Quota exceeded")
        mock_genai.Client.return_value = mock_client_instance
        
        with self.assertRaises(RuntimeError) as ctx:
            await gemini_client.generate("Say hello")
        self.assertEqual(str(ctx.exception), "Gemini API error: Quota exceeded")



    @patch("backend.gemini_client.genai")
    async def test_key_not_cached_at_import(self, mock_genai):
        # Initially key is not set
        if "GEMINI_API_KEY" in os.environ:
            del os.environ["GEMINI_API_KEY"]
            
        mock_response = MagicMock()
        mock_response.text = "Success after key change"
        mock_client_instance = MagicMock()
        mock_client_instance.models.generate_content.return_value = mock_response
        mock_genai.Client.return_value = mock_client_instance
        
        # First call should fail because no key in env
        with self.assertRaises(ValueError):
            await gemini_client.generate("hello")
            
        # Set key in env at call time
        os.environ["GEMINI_API_KEY"] = "dynamic-key"
        
        # Second call should now succeed without re-importing the module
        result = await gemini_client.generate("hello")
        self.assertEqual(result, "Success after key change")
        mock_genai.Client.assert_called_with(api_key="dynamic-key")

if __name__ == "__main__":
    unittest.main()
