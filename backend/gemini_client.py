import os
import asyncio
from google import genai
from backend.logger import get_logger

logger = get_logger("hematox.gemini")


async def generate(prompt: str, model: str = "gemini-3.1-flash-lite") -> str:
    """
    Generate content using the Gemini API.

    Reads GEMINI_API_KEY from environment via os.environ.get("GEMINI_API_KEY", "") at call time.
    If key is empty or None: raises ValueError("GEMINI_API_KEY not configured").
    Calls genai.Client(api_key=key), then client.models.generate_content(model, prompt).
    Returns response.text as a string. If response.text is None or empty, returns "".
    Wraps entire API call in try/except; on any exception raises RuntimeError(f"Gemini API error: {str(e)}").
    """
    key = os.environ.get("GEMINI_API_KEY", "")
    if key is None or key == "":
        raise ValueError("GEMINI_API_KEY not configured")

    def _call_gemini() -> str:
        client = genai.Client(api_key=key)
        response = client.models.generate_content(
            model=model,
            contents=prompt,
        )

        # Log token usage if available
        usage = getattr(response, "usage_metadata", None)
        if usage:
            logger.info(
                f"Gemini token usage — prompt: {getattr(usage, 'prompt_token_count', '?')}, "
                f"candidates: {getattr(usage, 'candidates_token_count', '?')}, "
                f"total: {getattr(usage, 'total_token_count', '?')}"
            )

        if response and response.text:
            return response.text
        return ""

    try:
        return await asyncio.to_thread(_call_gemini)
    except Exception as e:
        raise RuntimeError(f"Gemini API error: {str(e)}")


async def generate_chat(
    contents: list[dict],
    system_prompt: str,
    model: str = "gemini-3.1-flash-lite",
) -> str:
    """
    Generate a chat response using the Gemini API with native multi-turn contents.

    Reads GEMINI_API_KEY from environment at call time.
    Raises ValueError if the key is absent or empty.
    Passes contents (list of {role, parts} dicts) and system_prompt via
    config.system_instruction to preserve turn-taking structure.
    Returns response.text or "" if the response is empty.
    Wraps the API call in try/except; raises RuntimeError on any failure.
    """
    key = os.environ.get("GEMINI_API_KEY", "")
    if not key:
        raise ValueError("GEMINI_API_KEY not configured")

    def _call_gemini() -> str:
        client = genai.Client(api_key=key)
        response = client.models.generate_content(
            model=model,
            contents=contents,
            config={"system_instruction": system_prompt},
        )

        # Log token usage if available
        usage = getattr(response, "usage_metadata", None)
        if usage:
            logger.info(
                f"Gemini token usage — prompt: {getattr(usage, 'prompt_token_count', '?')}, "
                f"candidates: {getattr(usage, 'candidates_token_count', '?')}, "
                f"total: {getattr(usage, 'total_token_count', '?')}"
            )

        return response.text if response and response.text else ""

    try:
        return await asyncio.to_thread(_call_gemini)
    except Exception as e:
        raise RuntimeError(f"Gemini API error: {str(e)}")


async def get_api_key_status() -> bool:
    """
    Check if the GEMINI_API_KEY environment variable is configured and non-empty.

    Returns True if os.environ.get("GEMINI_API_KEY", "") is non-empty, False otherwise.
    """
    key = os.environ.get("GEMINI_API_KEY", "")
    return bool(key)
