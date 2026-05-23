import re


def sanitize_patient_name(value: str | None) -> str:
    """
    Sanitizes a patient name for safe LLM prompt injection.
    - If value is None or empty after stripping, return "".
    - Strip leading/trailing whitespace.
    - Remove any characters that are not alphanumeric, spaces, hyphens, apostrophes, or dots.
    - Collapse multiple spaces into one.
    - Truncate to 100 characters.
    - Return the sanitized string.
    """
    if value is None:
        return ""
    value = value.strip()
    if not value:
        return ""
    # Keep only alphanumeric, space, hyphen, apostrophe, dot
    value = re.sub(r"[^A-Za-z0-9 \-'.]", "", value)
    # Collapse multiple spaces into one
    value = re.sub(r" {2,}", " ", value)
    # Truncate to 100 characters
    return value[:100]


def sanitize_free_text(value: str | None, max_length: int = 300) -> str:
    """
    Sanitizes a free-text clinical field for safe LLM prompt injection.
    - If value is None or empty after stripping, return "".
    - Strip leading/trailing whitespace.
    - Remove ASCII control characters (chars with ord < 32, except tab and newline).
    - Remove sequences that look like prompt injection attempts: strip any substring matching
      the pattern r'(?i)(ignore|disregard|forget|override)\\s+(previous|above|prior|all)\\s+(instructions?|rules?|context|guidelines?)'.
    - Truncate to max_length characters.
    - Return the sanitized string.
    """
    if value is None:
        return ""
    value = value.strip()
    if not value:
        return ""
    # Remove ASCII control characters (ord < 32) except tab (\x09) and newline (\x0a)
    value = re.sub(r"[\x00-\x08\x0b-\x1f]", "", value)
    # Remove prompt injection attempts
    injection_pattern = (
        r"(?i)(ignore|disregard|forget|override)"
        r"\s+(previous|above|prior|all)"
        r"\s+(instructions?|rules?|context|guidelines?)"
    )
    value = re.sub(injection_pattern, "", value)
    # Strip any extra whitespace introduced by the removal, but preserve intentional newlines
    value = value.strip()
    # Truncate to max_length
    return value[:max_length]
