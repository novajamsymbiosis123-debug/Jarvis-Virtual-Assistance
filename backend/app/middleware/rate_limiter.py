"""
Rate limiting middleware.
Uses an in-memory sliding window; swap to Redis for multi-process.
"""

import time
import logging
from collections import defaultdict
from fastapi import Request, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class RateLimitStore:
    """Simple in-memory sliding window rate limiter."""

    def __init__(self):
        self._hits: dict[str, list[float]] = defaultdict(list)

    def is_allowed(self, key: str, limit: int, window: int = 60) -> bool:
        now = time.time()
        hits = self._hits[key]
        # Purge old entries
        self._hits[key] = [t for t in hits if now - t < window]
        if len(self._hits[key]) >= limit:
            return False
        self._hits[key].append(now)
        return True


_store = RateLimitStore()


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Skip rate limiting for health check and docs
        if request.url.path in ("/health", "/docs", "/openapi.json"):
            return await call_next(request)

        # Identify client by IP (in production use X-Forwarded-For behind proxy)
        client_ip = request.client.host if request.client else "unknown"
        key = f"global:{client_ip}"

        if not _store.is_allowed(key, settings.RATE_LIMIT_PER_MINUTE):
            logger.warning(f"Rate limit hit: {client_ip}")
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests. Please slow down.",
            )

        return await call_next(request)


def check_ai_rate_limit(user_id: str) -> bool:
    """Separate, stricter limit for AI endpoints."""
    key = f"ai:{user_id}"
    return _store.is_allowed(key, settings.RATE_LIMIT_AI_PER_MINUTE)
