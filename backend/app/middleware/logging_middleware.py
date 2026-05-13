"""Structured request/response logging middleware."""

import time
import logging
import uuid
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi import Request

logger = logging.getLogger("jarvis.access")


class LoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = str(uuid.uuid4())[:8]
        start = time.perf_counter()

        response = await call_next(request)

        elapsed = (time.perf_counter() - start) * 1000
        logger.info(
            f"[{request_id}] {request.method} {request.url.path} "
            f"-> {response.status_code} ({elapsed:.0f}ms)"
        )
        response.headers["X-Request-ID"] = request_id
        return response
