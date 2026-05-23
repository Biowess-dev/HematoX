"""
Request correlation ID middleware.

Generates a UUID4 for every incoming HTTP request and binds it via
set_request_id() so that all log lines emitted during the request
automatically carry the same request_id.

The ID is also echoed in the X-Request-ID response header for easy
log correlation from the client side.
"""

import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from backend.logger import get_logger, set_request_id

logger = get_logger("hematox.middleware")


class RequestIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        rid = str(uuid.uuid4())
        set_request_id(rid)
        response = await call_next(request)
        response.headers["X-Request-ID"] = rid
        return response
