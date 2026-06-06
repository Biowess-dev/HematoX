"""
Input sanitizers for HematoX LLM prompt injection.

All functions are safe to call with None values and always return str.
They are intentionally conservative: when in doubt, they remove rather
than transform, to prevent prompt injection and malformed prompts.
"""

import re

# Maximum character lengths applied by the sanitizers below.
_PATIENT_NAME_MAX_LEN: int = 100
_FREE_TEXT_DEFAULT_MAX_LEN: int = 300

# Prompt injection pattern: matches phrases like
# "ignore previous instructions", "disregard all rules", etc.
_INJECTION_PATTERN: re.Pattern = re.compile(
    r"(?i)(ignore|disregard|forget|override)"
    r"\s+(previous|above|prior|all)"
    r"\s+(instructions?|rules?|context|guidelines?)"
)


def sanitize_patient_name(value: str | None) -> str:
    """Sanitize a patient name for safe LLM prompt injection.

    - Returns ``""`` if *value* is None or blank after stripping.
    - Strips leading/trailing whitespace.
    - Removes any characters that are not alphanumeric, spaces, hyphens,
      apostrophes, or dots.
    - Collapses multiple consecutive spaces into one.
    - Truncates to :data:`_PATIENT_NAME_MAX_LEN` characters.
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
    return value[:_PATIENT_NAME_MAX_LEN]


def sanitize_free_text(value: str | None, max_length: int = _FREE_TEXT_DEFAULT_MAX_LEN) -> str:
    """Sanitize a free-text clinical field for safe LLM prompt injection.

    - Returns ``""`` if *value* is None or blank after stripping.
    - Strips leading/trailing whitespace.
    - Removes ASCII control characters (``ord < 32``) except tab (``\\x09``)
      and newline (``\\x0a``).
    - Removes sequences matching :data:`_INJECTION_PATTERN` (prompt injection
      attempts).
    - Truncates to *max_length* characters.
    """
    if value is None:
        return ""
    value = value.strip()
    if not value:
        return ""
    # Remove ASCII control characters (ord < 32) except tab (\x09) and newline (\x0a)
    value = re.sub(r"[\x00-\x08\x0b-\x1f]", "", value)
    # Remove prompt injection attempts
    value = _INJECTION_PATTERN.sub("", value)
    # Strip any extra whitespace introduced by the removal, but preserve intentional newlines
    value = value.strip()
    return value[:max_length]
