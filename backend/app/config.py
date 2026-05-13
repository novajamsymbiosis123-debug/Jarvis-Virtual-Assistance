"""
Centralized application configuration.
All settings are loaded from environment variables with sensible defaults.
"""

from functools import lru_cache
from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    # ── App ──────────────────────────────────────────────
    APP_NAME: str = "Jarvis AI Assistant"
    APP_VERSION: str = "2.0.0"
    DEBUG: bool = False
    ENVIRONMENT: str = "production"
    LOG_LEVEL: str = "INFO"
    ALLOWED_ORIGINS: str = "http://localhost:3000"

    # ── Database ─────────────────────────────────────────
    DATABASE_URL: str = "postgresql+asyncpg://jarvis:jarvis@db:5432/jarvis"
    DATABASE_ECHO: bool = False

    # ── Redis ────────────────────────────────────────────
    REDIS_URL: str = "redis://redis:6379/0"

    # ── Auth ─────────────────────────────────────────────
    SECRET_KEY: str = "change-me-in-production-use-openssl-rand-hex-32"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ── AI ───────────────────────────────────────────────
    ANTHROPIC_API_KEY: str = ""
    AI_MODEL: str = "claude-sonnet-4-20250514"
    AI_MAX_TOKENS: int = 1024
    AI_SYSTEM_PROMPT: str = (
        "You are Jarvis, an intelligent AI voice assistant. "
        "You are helpful, concise, and friendly. "
        "When the user asks you to perform actions like opening websites, "
        "searching Wikipedia, sending emails, or playing music, respond with "
        "a JSON action block so the system can execute the command. "
        "Format: {\"action\": \"action_name\", \"params\": {...}}. "
        "Available actions: open_website, wikipedia_search, send_email, "
        "play_music, get_time, get_weather, general_answer. "
        "For general questions, just answer normally without an action block."
    )

    # ── Email ────────────────────────────────────────────
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""

    # ── Voice ────────────────────────────────────────────
    WHISPER_MODEL: str = "base"
    TTS_VOICE: str = "alloy"

    # ── Rate Limiting ────────────────────────────────────
    RATE_LIMIT_PER_MINUTE: int = 30
    RATE_LIMIT_AI_PER_MINUTE: int = 10

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": True,
    }


@lru_cache()
def get_settings() -> Settings:
    return Settings()
