"""
Centralized structured logging for HematoX.

Environment variables:
    LOG_JSON=true   — emit JSON lines to console (default: human-readable)
                      The rotating log file always uses JSON.

Public API:
    get_logger(name)      — return a configured Logger
    set_request_id(rid)   — bind a request_id to the current async context
    get_request_id()      — read the current request_id (returns "-" if unset)
"""

import json
import logging
import logging.handlers
import os
import sys
from contextvars import ContextVar
from datetime import datetime, timezone
from pathlib import Path

# ---------------------------------------------------------------------------
# Request-ID context  (async-safe via contextvars)
# ---------------------------------------------------------------------------

_request_id_var: ContextVar[str] = ContextVar("request_id", default="-")


def set_request_id(rid: str) -> None:
    """Bind a request_id to the current async context."""
    _request_id_var.set(rid)


def get_request_id() -> str:
    """Return the request_id for the current async context ('-' if unset)."""
    return _request_id_var.get()


# ---------------------------------------------------------------------------
# Log record factory — injects request_id into every record automatically
# ---------------------------------------------------------------------------

_orig_factory = logging.getLogRecordFactory()


def _record_factory(*args, **kwargs):
    record = _orig_factory(*args, **kwargs)
    record.request_id = get_request_id()
    return record


logging.setLogRecordFactory(_record_factory)


# ---------------------------------------------------------------------------
# JSON formatter — used by the rotating file handler and optional console
# ---------------------------------------------------------------------------

class _JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict = {
            "ts": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "request_id": getattr(record, "request_id", "-"),
            "msg": record.getMessage(),
        }
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False)


# ---------------------------------------------------------------------------
# One-time configuration (idempotent — safe to call multiple times)
# ---------------------------------------------------------------------------

_configured = False


def _configure_logging() -> None:
    global _configured
    if _configured:
        return
    _configured = True

    root = logging.getLogger()
    root.setLevel(logging.INFO)

    use_json = os.getenv("LOG_JSON", "").lower() in ("1", "true", "yes")

    # ── Console handler ──────────────────────────────────────────────────────
    console = logging.StreamHandler(sys.stderr)
    if use_json:
        console.setFormatter(_JsonFormatter())
    else:
        console.setFormatter(
            logging.Formatter(
                fmt="%(asctime)s [%(levelname)-8s] [%(request_id)s] %(name)s — %(message)s",
                datefmt="%Y-%m-%dT%H:%M:%S",
            )
        )
    root.addHandler(console)

    # ── Rotating file handler (always JSON for machine-readable archiving) ───
    log_dir = Path("logs")
    log_dir.mkdir(exist_ok=True)
    file_handler = logging.handlers.RotatingFileHandler(
        log_dir / "app.log",
        maxBytes=5 * 1024 * 1024,   # 5 MB per file
        backupCount=3,               # keep app.log.1, .2, .3
        encoding="utf-8",
    )
    file_handler.setFormatter(_JsonFormatter())
    root.addHandler(file_handler)

    # Silence noisy third-party loggers
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    """Return a named logger, ensuring logging infrastructure is set up."""
    _configure_logging()
    return logging.getLogger(name)
