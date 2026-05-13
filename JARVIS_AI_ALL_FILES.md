# Jarvis AI Assistant — Complete Source Code

**57 files | ~3,900 lines | Production-ready full-stack AI voice assistant**

---

## `.env.example`

```
# ═══════════════════════════════════════════════════════
# Jarvis AI Assistant — Root Environment Variables
# Used by docker-compose.yml
# Copy to .env before running: docker-compose up
# ═══════════════════════════════════════════════════════

DB_PASSWORD=change-me-strong-password

```

---

## `.github/workflows/ci.yml`

```yaml
name: Jarvis AI CI/CD

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_PREFIX: ${{ github.repository }}

jobs:
  # ── Backend Tests ──────────────────────────────────
  backend-test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: test
        ports: ["5432:5432"]
        options: >-
          --health-cmd pg_isready
          --health-interval 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
          cache: pip
          cache-dependency-path: backend/requirements.txt

      - name: Install dependencies
        working-directory: backend
        run: |
          pip install -r requirements.txt
          pip install aiosqlite

      - name: Run tests
        working-directory: backend
        env:
          DATABASE_URL: "sqlite+aiosqlite:///./test.db"
          SECRET_KEY: "test-secret"
          ANTHROPIC_API_KEY: "test-key"
        run: pytest tests/ -v --tb=short

  # ── Frontend Lint + Build ──────────────────────────
  frontend-build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: frontend/package.json

      - name: Install & Build
        working-directory: frontend
        run: |
          npm ci
          npm run build

  # ── Docker Build + Push ────────────────────────────
  docker-publish:
    needs: [backend-test, frontend-build]
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - uses: actions/checkout@v4

      - uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build & push backend
        uses: docker/build-push-action@v5
        with:
          context: ./backend
          push: true
          tags: ${{ env.REGISTRY }}/${{ env.IMAGE_PREFIX }}/backend:latest

      - name: Build & push frontend
        uses: docker/build-push-action@v5
        with:
          context: ./frontend
          push: true
          tags: ${{ env.REGISTRY }}/${{ env.IMAGE_PREFIX }}/frontend:latest

```

---

## `.gitignore`

```
.env
backend/.env
frontend/.env
__pycache__/
*.pyc
*.egg-info/
dist/
build/
.venv/
venv/
node_modules/
.next/
frontend/.next/
frontend/node_modules/
.vscode/
.idea/
*.swp
.DS_Store
Thumbs.db
*.log
*.db
*.sqlite3
*.pt

```

---

## `Makefile`

```
.PHONY: help up down build logs test

help:
	@echo "Usage:"
	@echo "  make up           Start all services"
	@echo "  make down         Stop all services"
	@echo "  make build        Rebuild containers"
	@echo "  make logs         Tail all logs"
	@echo "  make test         Run backend tests"
	@echo "  make dev-backend  Run backend locally"
	@echo "  make dev-frontend Run frontend locally"

up:
	docker-compose up -d

down:
	docker-compose down

build:
	docker-compose build --no-cache

logs:
	docker-compose logs -f

logs-backend:
	docker-compose logs -f backend

test:
	cd backend && pytest tests/ -v

dev-backend:
	cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

dev-frontend:
	cd frontend && npm run dev

clean:
	docker-compose down -v
	docker system prune -f

```

---

## `README.md`

```markdown
# Jarvis AI Assistant

A production-ready AI voice assistant rebuilt from a beginner Python script into a full-stack SaaS application with real-time voice interaction, streaming AI chat, authentication, and one-command Docker deployment.

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        Nginx (port 80)                       │
│              Reverse Proxy · Rate Limiting · TLS             │
├────────────────────────┬─────────────────────────────────────┤
│  Frontend (port 3000)  │       Backend (port 8000)           │
│  Next.js 14 + React    │       FastAPI + WebSocket           │
│  Tailwind CSS          │       ├─ Auth (JWT + bcrypt)        │
│  Voice Recorder        │       ├─ AI Service (Claude API)    │
│  WebSocket Client      │       ├─ Voice (Whisper + TTS)      │
│  Dark Mode             │       ├─ Command Engine             │
│                        │       └─ Rate Limiter               │
├────────────────────────┴─────────────────────────────────────┤
│  PostgreSQL (5432)              │     Redis (6379)           │
│  Users · Conversations ·       │     Rate limit cache        │
│  Messages · Chat History       │                             │
└─────────────────────────────────┴────────────────────────────┘
```

## What Changed From the Original

| Original jarvis.py                  | Production jarvis-ai/                            |
| ----------------------------------- | ------------------------------------------------ |
| Single 100-line script              | 30+ files, modular architecture                  |
| Hardcoded passwords in source       | Environment variables + .env files               |
| sapi5 Windows-only TTS              | edge-tts cross-platform neural voices            |
| Desktop microphone only             | Browser-based recording via WebSocket            |
| No auth, single user                | JWT authentication, user accounts, admin panel   |
| No history                          | PostgreSQL conversation + message storage        |
| if/elif command chain               | Plugin-style action registry with decorators     |
| No error handling                   | Try/catch everywhere, structured logging         |
| Not deployable                      | docker-compose up and running in production      |

## Quick Start

### Prerequisites

- Docker and Docker Compose
- An Anthropic API key (https://console.anthropic.com/)

### 1. Clone and configure

```bash
git clone <your-repo-url> jarvis-ai
cd jarvis-ai

cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# REQUIRED: edit backend/.env and set ANTHROPIC_API_KEY and SECRET_KEY
nano backend/.env
```

### 2. Launch

```bash
docker-compose up -d
```

Open http://localhost in your browser.

### 3. Create an admin user

```bash
docker-compose exec backend python -c "
import asyncio
from app.database import AsyncSessionLocal, init_db
from app.models.user import User
from app.utils.security import hash_password

async def seed():
    await init_db()
    async with AsyncSessionLocal() as db:
        u = User(
            email='admin@jarvis.ai', username='admin',
            hashed_password=hash_password('admin123'),
            full_name='Admin', is_admin=True
        )
        db.add(u)
        await db.commit()
        print('Admin: admin@jarvis.ai / admin123')

asyncio.run(seed())
"
```

### 4. Use it

1. Register or login with the admin credentials
2. Type a message or press the mic button to talk
3. Toggle auto-speak with the speaker icon in the header

## Project Structure

```
jarvis-ai/
├── backend/
│   ├── app/
│   │   ├── main.py                 # FastAPI app + lifespan
│   │   ├── config.py               # Pydantic settings from env
│   │   ├── database.py             # Async SQLAlchemy engine
│   │   ├── models/
│   │   │   ├── user.py             # User model
│   │   │   └── chat.py             # Conversation + Message
│   │   ├── routers/
│   │   │   ├── auth.py             # Register, login, profile
│   │   │   ├── chat.py             # REST + WebSocket chat
│   │   │   ├── voice.py            # STT upload, TTS synth
│   │   │   └── admin.py            # Stats, user mgmt
│   │   ├── services/
│   │   │   ├── ai_service.py       # Claude API streaming
│   │   │   ├── voice_service.py    # Whisper + edge-tts
│   │   │   ├── auth_service.py     # Auth business logic
│   │   │   └── command_service.py  # Action registry
│   │   ├── middleware/
│   │   │   ├── rate_limiter.py     # Sliding window limiter
│   │   │   └── logging_middleware.py
│   │   └── utils/
│   │       ├── security.py         # JWT, bcrypt, deps
│   │       └── helpers.py          # Sanitize, parse
│   ├── tests/                      # pytest async tests
│   ├── alembic/                    # DB migrations
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
├── frontend/
│   ├── src/app/
│   │   ├── layout.js               # Dark mode + auth
│   │   ├── page.js                 # Landing page
│   │   ├── login/page.js           # Login
│   │   ├── register/page.js        # Register
│   │   ├── dashboard/page.js       # Chat + voice UI
│   │   └── admin/page.js           # Admin dashboard
│   ├── src/lib/
│   │   ├── api.js                  # REST client
│   │   ├── auth.js                 # Auth context
│   │   └── websocket.js            # WS streaming
│   ├── package.json
│   ├── tailwind.config.js
│   ├── Dockerfile
│   └── .env.example
├── nginx/nginx.conf
├── docker-compose.yml
├── Makefile
├── .github/workflows/ci.yml
└── README.md
```

## Features

### Voice Interaction
- Speech-to-Text via OpenAI Whisper (local, no API key)
- Text-to-Speech via Microsoft Edge neural voices (free)
- Browser-based recording with MediaRecorder API
- Auto-send on voice input, auto-speak toggleable

### AI Chat
- Claude API with streaming responses via WebSocket
- Full conversation history in PostgreSQL
- Plugin-style action system (Wikipedia, URLs, email, time)
- Per-user AI personality customization
- REST fallback if WebSocket unavailable

### Security
- JWT access + refresh tokens with auto-renewal
- bcrypt password hashing
- Rate limiting (30 req/min general, 10 req/min AI)
- Input sanitization and length limits
- Non-root Docker containers
- Nginx security headers

### Admin Dashboard
- User/message/conversation stats
- User list with activate/deactivate
- Admin-only route protection

## API Endpoints

With DEBUG=true, Swagger docs are at http://localhost:8000/docs.

| Method | Path                                    | Auth     | Description            |
| ------ | --------------------------------------- | -------- | ---------------------- |
| POST   | /api/auth/register                      | No       | Create account         |
| POST   | /api/auth/login                         | No       | Get tokens             |
| POST   | /api/auth/refresh                       | No       | Refresh tokens         |
| GET    | /api/auth/me                            | User     | Get profile            |
| PATCH  | /api/auth/me                            | User     | Update profile         |
| GET    | /api/chat/conversations                 | User     | List conversations     |
| POST   | /api/chat/conversations                 | User     | Create conversation    |
| GET    | /api/chat/conversations/{id}/messages   | User     | Get messages           |
| DELETE | /api/chat/conversations/{id}            | User     | Delete conversation    |
| POST   | /api/chat/send                          | User     | Send message (REST)    |
| WS     | /api/chat/ws                            | Token    | Streaming chat         |
| POST   | /api/voice/transcribe                   | User     | Audio to text          |
| POST   | /api/voice/synthesize                   | User     | Text to audio          |
| GET    | /api/admin/stats                        | Admin    | Dashboard stats        |
| GET    | /api/admin/users                        | Admin    | List all users         |
| PATCH  | /api/admin/users/{id}/toggle-active     | Admin    | Toggle user status     |
| GET    | /health                                 | No       | Health check           |

## Adding Voice Commands

The command system uses a decorator registry in `backend/app/services/command_service.py`:

```python
from app.services.command_service import register_action

@register_action("get_joke")
async def _get_joke(params: dict) -> str:
    import random
    jokes = ["Why do programmers prefer dark mode? Light attracts bugs."]
    return random.choice(jokes)
```

Then add `get_joke` to the available actions list in the AI system prompt (in config.py).

## Deployment

### Railway / Render

1. Push to GitHub
2. Connect Railway/Render, create services for backend + frontend + PostgreSQL
3. Set environment variables
4. Deploy

### AWS / VPS

```bash
ssh your-server
git clone <repo> jarvis-ai && cd jarvis-ai
# Configure .env files
docker-compose up -d
# Optional: TLS with certbot
certbot --nginx -d yourdomain.com
```

## Environment Variables

| Variable                   | Required | Default                    |
| -------------------------- | -------- | -------------------------- |
| ANTHROPIC_API_KEY          | Yes      | —                          |
| SECRET_KEY                 | Yes      | —                          |
| DATABASE_URL               | No       | postgresql+asyncpg://...   |
| ALLOWED_ORIGINS            | No       | http://localhost:3000      |
| DEBUG                      | No       | false                      |
| AI_MODEL                   | No       | claude-sonnet-4-20250514   |
| WHISPER_MODEL              | No       | base                       |
| RATE_LIMIT_PER_MINUTE      | No       | 30                         |
| RATE_LIMIT_AI_PER_MINUTE   | No       | 10                         |
| SMTP_USER                  | No       | —                          |
| SMTP_PASSWORD              | No       | —                          |

## Testing

```bash
cd backend
pip install -r requirements.txt aiosqlite
pytest tests/ -v
```

## Scaling Recommendations

1. Replace in-memory rate limiter with Redis (connection already configured)
2. Increase --workers in backend Dockerfile for CPU parallelism
3. Mount GPU for Whisper CUDA acceleration
4. Add Cloudflare/CDN in front of Nginx
5. Use PgBouncer for database connection pooling
6. Add Celery + Redis for async tasks (email, bulk TTS)
7. Run multiple backend replicas behind a load balancer

## License

MIT

```

---

## `backend/.env.example`

```
# ═══════════════════════════════════════════════════════
# Jarvis AI Assistant — Backend Environment Variables
# Copy to .env and fill in real values before running
# ═══════════════════════════════════════════════════════

# ── App ───────────────────────────────────────────────
DEBUG=true
ENVIRONMENT=development
LOG_LEVEL=DEBUG
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8000

# ── Database ──────────────────────────────────────────
DATABASE_URL=postgresql+asyncpg://jarvis:jarvis@db:5432/jarvis

# ── Redis (optional) ─────────────────────────────────
REDIS_URL=redis://redis:6379/0

# ── Auth — CHANGE THESE IN PRODUCTION ────────────────
SECRET_KEY=dev-secret-change-me-run-openssl-rand-hex-32
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=7

# ── AI — REQUIRED ────────────────────────────────────
ANTHROPIC_API_KEY=sk-ant-your-key-here
AI_MODEL=claude-sonnet-4-20250514
AI_MAX_TOKENS=1024

# ── Email (optional) ─────────────────────────────────
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=

# ── Voice ─────────────────────────────────────────────
WHISPER_MODEL=base

# ── Rate Limiting ─────────────────────────────────────
RATE_LIMIT_PER_MINUTE=30
RATE_LIMIT_AI_PER_MINUTE=10

```

---

## `backend/Dockerfile`

```
FROM python:3.12-slim AS base

# System dependencies for Whisper + audio processing
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps (cached layer)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Non-root user for security
RUN useradd -m appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# Preload Whisper model at build time (optional, speeds up cold start)
# RUN python -c "import whisper; whisper.load_model('base')"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]

```

---

## `backend/alembic.ini`

```ini
[alembic]
script_location = alembic
sqlalchemy.url = postgresql+asyncpg://jarvis:jarvis@db:5432/jarvis

[loggers]
keys = root,sqlalchemy,alembic

[handlers]
keys = console

[formatters]
keys = generic

[logger_root]
level = WARN
handlers = console

[logger_sqlalchemy]
level = WARN
handlers =
qualname = sqlalchemy.engine

[logger_alembic]
level = INFO
handlers =
qualname = alembic

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
datefmt = %H:%M:%S

```

---

## `backend/alembic/env.py`

```python
"""Alembic environment configuration for async SQLAlchemy."""

import asyncio
from logging.config import fileConfig
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import create_async_engine
from alembic import context

from app.config import get_settings
from app.database import Base
from app.models import User, Conversation, Message  # noqa: ensure models registered

settings = get_settings()
config = context.config
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline():
    url = config.get_main_option("sqlalchemy.url")
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations():
    connectable = create_async_engine(
        config.get_main_option("sqlalchemy.url"),
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online():
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()

```

---

## `backend/alembic/script.py.mako`

```mako
"""${message}

Revision ID: ${up_revision}
Revises: ${down_revision | comma,n}
Create Date: ${create_date}
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
${imports if imports else ""}

revision: str = ${repr(up_revision)}
down_revision: Union[str, None] = ${repr(down_revision)}
branch_labels: Union[str, Sequence[str], None] = ${repr(branch_labels)}
depends_on: Union[str, Sequence[str], None] = ${repr(depends_on)}


def upgrade() -> None:
    ${upgrades if upgrades else "pass"}


def downgrade() -> None:
    ${downgrades if downgrades else "pass"}

```

---

## `backend/app/__init__.py`

```python

```

---

## `backend/app/config.py`

```python
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

```

---

## `backend/app/database.py`

```python
"""
Async database engine, session factory, and base model.
"""

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.config import get_settings

settings = get_settings()

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DATABASE_ECHO,
    pool_size=20,
    max_overflow=10,
    pool_pre_ping=True,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def close_db():
    await engine.dispose()

```

---

## `backend/app/main.py`

```python
"""
Jarvis AI Assistant — FastAPI Application
Production-ready voice + chat AI assistant with WebSocket streaming.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.database import init_db, close_db
from app.middleware.rate_limiter import RateLimitMiddleware
from app.middleware.logging_middleware import LoggingMiddleware
from app.routers import auth, chat, voice, admin

settings = get_settings()

# ── Logging ──────────────────────────────────────────────────
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


# ── Lifespan ─────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    await init_db()
    logger.info("Database initialized")
    yield
    await close_db()
    logger.info("Shutdown complete")


# ── App ──────────────────────────────────────────────────────
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Production AI voice assistant with real-time streaming, authentication, and extensible command system.",
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    lifespan=lifespan,
)

# ── Middleware (order matters: last added = first executed) ───
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(LoggingMiddleware)
app.add_middleware(RateLimitMiddleware)

# ── Routers ──────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(chat.router)
app.include_router(voice.router)
app.include_router(admin.router)


# ── Health check ─────────────────────────────────────────────
@app.get("/health", tags=["System"])
async def health_check():
    return {
        "status": "healthy",
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
    }

```

---

## `backend/app/middleware/__init__.py`

```python

```

---

## `backend/app/middleware/logging_middleware.py`

```python
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

```

---

## `backend/app/middleware/rate_limiter.py`

```python
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

```

---

## `backend/app/models/__init__.py`

```python
from app.models.user import User
from app.models.chat import Conversation, Message

__all__ = ["User", "Conversation", "Message"]

```

---

## `backend/app/models/chat.py`

```python
"""Conversation and Message models for chat history storage."""

import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, Text, ForeignKey, Integer, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
import enum
from app.database import Base


class MessageRole(str, enum.Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class MessageType(str, enum.Enum):
    TEXT = "text"
    VOICE = "voice"
    ACTION = "action"


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(255), default="New Conversation")
    message_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    user = relationship("User", back_populates="conversations")
    messages = relationship(
        "Message", back_populates="conversation", cascade="all, delete-orphan",
        order_by="Message.created_at"
    )


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role: Mapped[MessageRole] = mapped_column(
        SAEnum(MessageRole), nullable=False
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    message_type: Mapped[MessageType] = mapped_column(
        SAEnum(MessageType), default=MessageType.TEXT
    )
    tokens_used: Mapped[int] = mapped_column(Integer, default=0)
    audio_duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    action_result: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    conversation = relationship("Conversation", back_populates="messages")

```

---

## `backend/app/models/user.py`

```python
"""User model with authentication fields and preferences."""

import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Boolean, DateTime, Text, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True
    )
    username: Mapped[str] = mapped_column(
        String(80), unique=True, nullable=False, index=True
    )
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    ai_personality: Mapped[str] = mapped_column(
        Text, default="You are Jarvis, a helpful and friendly AI assistant."
    )
    voice_preference: Mapped[str] = mapped_column(String(50), default="alloy")
    message_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    conversations = relationship(
        "Conversation", back_populates="user", cascade="all, delete-orphan"
    )

```

---

## `backend/app/routers/__init__.py`

```python

```

---

## `backend/app/routers/admin.py`

```python
"""Admin API: dashboard stats, user listing, user management."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession
import uuid

from app.database import get_db
from app.models.user import User
from app.models.chat import Conversation, Message
from app.utils.security import get_current_admin

router = APIRouter(prefix="/api/admin", tags=["Admin"])


@router.get("/stats")
async def dashboard_stats(
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    total_users = await db.scalar(select(func.count(User.id))) or 0
    active_users = await db.scalar(
        select(func.count(User.id)).where(User.is_active == True)
    ) or 0
    total_conversations = await db.scalar(select(func.count(Conversation.id))) or 0
    total_messages = await db.scalar(select(func.count(Message.id))) or 0

    return {
        "total_users": total_users,
        "active_users": active_users,
        "total_conversations": total_conversations,
        "total_messages": total_messages,
    }


@router.get("/users")
async def list_users(
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
    limit: int = 50,
    offset: int = 0,
):
    result = await db.execute(
        select(User).order_by(desc(User.created_at)).limit(limit).offset(offset)
    )
    users = result.scalars().all()
    return [
        {
            "id": str(u.id),
            "email": u.email,
            "username": u.username,
            "full_name": u.full_name,
            "is_active": u.is_active,
            "is_admin": u.is_admin,
            "message_count": u.message_count,
            "created_at": u.created_at.isoformat(),
        }
        for u in users
    ]


@router.patch("/users/{user_id}/toggle-active")
async def toggle_user_active(
    user_id: str,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = not user.is_active
    await db.commit()
    return {"id": str(user.id), "is_active": user.is_active}

```

---

## `backend/app/routers/auth.py`

```python
"""Authentication API endpoints."""

from pydantic import BaseModel, EmailStr, Field
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.utils.security import get_current_user
from app.services.auth_service import register_user, login_user, refresh_tokens

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


# ── Schemas ──────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: EmailStr
    username: str = Field(min_length=3, max_length=80)
    password: str = Field(min_length=8, max_length=128)
    full_name: str | None = None

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class RefreshRequest(BaseModel):
    refresh_token: str

class UpdateProfileRequest(BaseModel):
    full_name: str | None = None
    ai_personality: str | None = None
    voice_preference: str | None = None


# ── Endpoints ────────────────────────────────────────────────

@router.post("/register")
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    return await register_user(db, body.email, body.username, body.password, body.full_name)


@router.post("/login")
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    return await login_user(db, body.email, body.password)


@router.post("/refresh")
async def refresh(body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    return await refresh_tokens(db, body.refresh_token)


@router.get("/me")
async def get_profile(user: User = Depends(get_current_user)):
    return {
        "id": str(user.id),
        "email": user.email,
        "username": user.username,
        "full_name": user.full_name,
        "is_admin": user.is_admin,
        "voice_preference": user.voice_preference,
        "ai_personality": user.ai_personality,
        "message_count": user.message_count,
        "created_at": user.created_at.isoformat(),
    }


@router.patch("/me")
async def update_profile(
    body: UpdateProfileRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.full_name is not None:
        user.full_name = body.full_name
    if body.ai_personality is not None:
        user.ai_personality = body.ai_personality
    if body.voice_preference is not None:
        user.voice_preference = body.voice_preference
    await db.commit()
    return {"status": "updated"}

```

---

## `backend/app/routers/chat.py`

```python
"""
Chat API: REST endpoints + WebSocket for real-time streaming.
Handles conversation CRUD and AI message exchange.
"""

import json
import uuid
import logging
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db, AsyncSessionLocal
from app.models.user import User
from app.models.chat import Conversation, Message, MessageRole, MessageType
from app.utils.security import get_current_user, decode_token
from app.services.ai_service import ai_service
from app.services.command_service import execute_action
from app.utils.helpers import extract_action_from_response, sanitize_input
from app.middleware.rate_limiter import check_ai_rate_limit

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/chat", tags=["Chat"])


# ── Schemas ──────────────────────────────────────────────────

class SendMessageRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    conversation_id: str | None = None

class CreateConversationRequest(BaseModel):
    title: str = Field(default="New Conversation", max_length=255)


# ── REST Endpoints ───────────────────────────────────────────

@router.get("/conversations")
async def list_conversations(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Conversation)
        .where(Conversation.user_id == user.id)
        .order_by(desc(Conversation.updated_at))
        .limit(50)
    )
    convos = result.scalars().all()
    return [
        {
            "id": str(c.id),
            "title": c.title,
            "message_count": c.message_count,
            "updated_at": c.updated_at.isoformat(),
        }
        for c in convos
    ]


@router.post("/conversations")
async def create_conversation(
    body: CreateConversationRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    convo = Conversation(user_id=user.id, title=body.title)
    db.add(convo)
    await db.commit()
    await db.refresh(convo)
    return {"id": str(convo.id), "title": convo.title}


@router.get("/conversations/{convo_id}/messages")
async def get_messages(
    convo_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Conversation)
        .options(selectinload(Conversation.messages))
        .where(Conversation.id == uuid.UUID(convo_id), Conversation.user_id == user.id)
    )
    convo = result.scalar_one_or_none()
    if not convo:
        raise HTTPException(status_code=404, detail="Conversation not found")

    return [
        {
            "id": str(m.id),
            "role": m.role.value,
            "content": m.content,
            "message_type": m.message_type.value,
            "action_result": m.action_result,
            "created_at": m.created_at.isoformat(),
        }
        for m in convo.messages
    ]


@router.delete("/conversations/{convo_id}")
async def delete_conversation(
    convo_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Conversation).where(
            Conversation.id == uuid.UUID(convo_id), Conversation.user_id == user.id
        )
    )
    convo = result.scalar_one_or_none()
    if not convo:
        raise HTTPException(status_code=404, detail="Conversation not found")
    await db.delete(convo)
    await db.commit()
    return {"status": "deleted"}


@router.post("/send")
async def send_message(
    body: SendMessageRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Send a message via REST and get a complete AI response."""
    if not check_ai_rate_limit(str(user.id)):
        raise HTTPException(status_code=429, detail="AI rate limit exceeded")

    message_text = sanitize_input(body.message)

    # Get or create conversation
    if body.conversation_id:
        result = await db.execute(
            select(Conversation)
            .options(selectinload(Conversation.messages))
            .where(
                Conversation.id == uuid.UUID(body.conversation_id),
                Conversation.user_id == user.id,
            )
        )
        convo = result.scalar_one_or_none()
        if not convo:
            raise HTTPException(status_code=404, detail="Conversation not found")
    else:
        convo = Conversation(
            user_id=user.id,
            title=message_text[:60] + ("..." if len(message_text) > 60 else ""),
        )
        db.add(convo)
        await db.flush()

    # Build conversation history
    history = [{"role": m.role.value, "content": m.content} for m in convo.messages]

    # Save user message
    user_msg = Message(
        conversation_id=convo.id,
        role=MessageRole.USER,
        content=message_text,
        message_type=MessageType.TEXT,
    )
    db.add(user_msg)

    # Get AI response
    ai_response = await ai_service.chat(message_text, history, user.ai_personality)

    # Check for action commands
    clean_text, action = extract_action_from_response(ai_response)
    action_result = None
    if action:
        action_result = await execute_action(action)
        if clean_text:
            clean_text = f"{clean_text}\n\n{action_result}"
        else:
            clean_text = action_result

    # Save assistant message
    assistant_msg = Message(
        conversation_id=convo.id,
        role=MessageRole.ASSISTANT,
        content=clean_text or ai_response,
        message_type=MessageType.ACTION if action else MessageType.TEXT,
        action_result=action_result,
    )
    db.add(assistant_msg)

    convo.message_count += 2
    user.message_count += 1
    await db.commit()

    return {
        "conversation_id": str(convo.id),
        "response": clean_text or ai_response,
        "action": action,
        "action_result": action_result,
    }


# ── WebSocket for streaming ─────────────────────────────────

@router.websocket("/ws")
async def websocket_chat(ws: WebSocket):
    """
    WebSocket endpoint for real-time streaming chat.
    Client sends: {"token": "...", "message": "...", "conversation_id": "..."}
    Server streams: {"type": "token|done|error", "data": "..."}
    """
    await ws.accept()
    logger.info("WebSocket connection opened")

    try:
        while True:
            raw = await ws.receive_text()
            data = json.loads(raw)

            # Authenticate
            token = data.get("token", "")
            try:
                payload = decode_token(token)
                user_id = payload.get("sub")
            except Exception:
                await ws.send_json({"type": "error", "data": "Invalid token"})
                continue

            if not check_ai_rate_limit(user_id):
                await ws.send_json({"type": "error", "data": "Rate limit exceeded"})
                continue

            message_text = sanitize_input(data.get("message", ""))
            convo_id = data.get("conversation_id")

            async with AsyncSessionLocal() as db:
                # Load user
                result = await db.execute(
                    select(User).where(User.id == uuid.UUID(user_id))
                )
                user = result.scalar_one_or_none()
                if not user:
                    await ws.send_json({"type": "error", "data": "User not found"})
                    continue

                # Load or create conversation
                if convo_id:
                    result = await db.execute(
                        select(Conversation)
                        .options(selectinload(Conversation.messages))
                        .where(
                            Conversation.id == uuid.UUID(convo_id),
                            Conversation.user_id == user.id,
                        )
                    )
                    convo = result.scalar_one_or_none()
                else:
                    convo = Conversation(
                        user_id=user.id,
                        title=message_text[:60],
                    )
                    db.add(convo)
                    await db.flush()

                history = (
                    [{"role": m.role.value, "content": m.content} for m in convo.messages]
                    if convo and convo.messages
                    else []
                )

                # Save user message
                db.add(Message(
                    conversation_id=convo.id,
                    role=MessageRole.USER,
                    content=message_text,
                ))

                # Stream AI response
                full_response = ""
                await ws.send_json({
                    "type": "start",
                    "data": str(convo.id),
                })

                async for token in ai_service.chat_stream(
                    message_text, history, user.ai_personality
                ):
                    full_response += token
                    await ws.send_json({"type": "token", "data": token})

                # Process actions
                clean_text, action = extract_action_from_response(full_response)
                action_result = None
                if action:
                    action_result = await execute_action(action)

                # Save assistant message
                db.add(Message(
                    conversation_id=convo.id,
                    role=MessageRole.ASSISTANT,
                    content=clean_text or full_response,
                    action_result=action_result,
                ))
                convo.message_count += 2
                user.message_count += 1
                await db.commit()

                await ws.send_json({
                    "type": "done",
                    "data": {
                        "conversation_id": str(convo.id),
                        "action": action,
                        "action_result": action_result,
                    },
                })

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        try:
            await ws.send_json({"type": "error", "data": str(e)})
        except Exception:
            pass

```

---

## `backend/app/routers/voice.py`

```python
"""Voice API: speech-to-text upload, text-to-speech generation."""

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from fastapi.responses import Response

from app.models.user import User
from app.utils.security import get_current_user
from app.services.voice_service import speech_to_text, text_to_speech
from app.middleware.rate_limiter import check_ai_rate_limit

router = APIRouter(prefix="/api/voice", tags=["Voice"])


@router.post("/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
):
    """Upload audio file → get transcribed text."""
    if not check_ai_rate_limit(str(user.id)):
        raise HTTPException(status_code=429, detail="Rate limit exceeded")

    # Validate file
    max_size = 10 * 1024 * 1024  # 10MB
    content = await file.read()
    if len(content) > max_size:
        raise HTTPException(status_code=413, detail="File too large (max 10MB)")

    allowed = {
        "audio/webm", "audio/wav", "audio/mpeg", "audio/mp3",
        "audio/ogg", "audio/mp4", "audio/x-m4a", "video/webm",
    }
    if file.content_type and file.content_type not in allowed:
        raise HTTPException(status_code=415, detail=f"Unsupported audio format: {file.content_type}")

    text = await speech_to_text(content, file.filename or "audio.webm")
    return {"text": text}


@router.post("/synthesize")
async def synthesize_speech(
    text: str,
    user: User = Depends(get_current_user),
):
    """Convert text → MP3 audio bytes."""
    if not text.strip():
        raise HTTPException(status_code=400, detail="Empty text")

    if len(text) > 5000:
        raise HTTPException(status_code=400, detail="Text too long (max 5000 chars)")

    audio = await text_to_speech(text, user.voice_preference or "alloy")
    return Response(content=audio, media_type="audio/mpeg")

```

---

## `backend/app/services/__init__.py`

```python

```

---

## `backend/app/services/ai_service.py`

```python
"""
AI service: Anthropic Claude API integration with conversation memory.
Handles chat completions with system prompts and function-calling style actions.
"""

import logging
from typing import AsyncGenerator
import anthropic
from app.config import get_settings
from app.utils.helpers import truncate_conversation

logger = logging.getLogger(__name__)
settings = get_settings()


class AIService:
    def __init__(self):
        self.client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
        self.model = settings.AI_MODEL
        self.max_tokens = settings.AI_MAX_TOKENS

    async def chat(
        self,
        user_message: str,
        conversation_history: list[dict],
        system_prompt: str | None = None,
    ) -> str:
        """Send a message and get a complete response."""
        system = system_prompt or settings.AI_SYSTEM_PROMPT
        messages = truncate_conversation(conversation_history)
        messages.append({"role": "user", "content": user_message})

        try:
            response = await self.client.messages.create(
                model=self.model,
                max_tokens=self.max_tokens,
                system=system,
                messages=[m for m in messages if m["role"] in ("user", "assistant")],
            )
            return response.content[0].text
        except anthropic.APIError as e:
            logger.error(f"Anthropic API error: {e}")
            raise
        except Exception as e:
            logger.error(f"AI service error: {e}")
            raise

    async def chat_stream(
        self,
        user_message: str,
        conversation_history: list[dict],
        system_prompt: str | None = None,
    ) -> AsyncGenerator[str, None]:
        """Stream a response token-by-token."""
        system = system_prompt or settings.AI_SYSTEM_PROMPT
        messages = truncate_conversation(conversation_history)
        messages.append({"role": "user", "content": user_message})

        try:
            async with self.client.messages.stream(
                model=self.model,
                max_tokens=self.max_tokens,
                system=system,
                messages=[m for m in messages if m["role"] in ("user", "assistant")],
            ) as stream:
                async for text in stream.text_stream:
                    yield text
        except Exception as e:
            logger.error(f"AI stream error: {e}")
            yield f"I'm sorry, I encountered an error: {str(e)}"


ai_service = AIService()

```

---

## `backend/app/services/auth_service.py`

```python
"""Authentication service: register, login, refresh tokens."""

import uuid
import logging
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.models.user import User
from app.utils.security import hash_password, verify_password, create_access_token, create_refresh_token, decode_token

logger = logging.getLogger(__name__)


async def register_user(
    db: AsyncSession, email: str, username: str, password: str, full_name: str | None = None
) -> dict:
    """Create a new user account."""
    existing = await db.execute(
        select(User).where((User.email == email) | (User.username == username))
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email or username already taken")

    user = User(
        email=email.lower().strip(),
        username=username.strip(),
        hashed_password=hash_password(password),
        full_name=full_name,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    logger.info(f"New user registered: {user.email}")
    return _build_token_response(user)


async def login_user(db: AsyncSession, email: str, password: str) -> dict:
    """Authenticate and return tokens."""
    result = await db.execute(select(User).where(User.email == email.lower().strip()))
    user = result.scalar_one_or_none()

    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated")

    logger.info(f"User logged in: {user.email}")
    return _build_token_response(user)


async def refresh_tokens(db: AsyncSession, refresh_token: str) -> dict:
    """Issue new access + refresh tokens from a valid refresh token."""
    payload = decode_token(refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    user_id = payload.get("sub")
    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found")

    return _build_token_response(user)


async def get_admin_stats(db: AsyncSession) -> dict:
    """Dashboard statistics for admin."""
    total_users = await db.scalar(select(func.count(User.id)))
    active_users = await db.scalar(select(func.count(User.id)).where(User.is_active == True))
    total_messages = await db.scalar(select(func.sum(User.message_count)))

    return {
        "total_users": total_users or 0,
        "active_users": active_users or 0,
        "total_messages": total_messages or 0,
    }


def _build_token_response(user: User) -> dict:
    uid = str(user.id)
    return {
        "access_token": create_access_token(uid),
        "refresh_token": create_refresh_token(uid),
        "token_type": "bearer",
        "user": {
            "id": uid,
            "email": user.email,
            "username": user.username,
            "full_name": user.full_name,
            "is_admin": user.is_admin,
        },
    }

```

---

## `backend/app/services/command_service.py`

```python
"""
Command execution service.
When the AI returns an action JSON, this service handles it.
Replaces the original hardcoded if/elif chain with a plugin-style registry.
"""

import logging
import smtplib
from datetime import datetime
from email.mime.text import MIMEText
from typing import Callable, Awaitable

import wikipedia

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# ── Action registry ──────────────────────────────────────────

ActionHandler = Callable[[dict], Awaitable[str]]
_registry: dict[str, ActionHandler] = {}


def register_action(name: str):
    """Decorator to register a command handler."""
    def wrapper(fn: ActionHandler):
        _registry[name] = fn
        return fn
    return wrapper


async def execute_action(action: dict) -> str:
    """Dispatch an action dict to the registered handler."""
    name = action.get("action", "")
    params = action.get("params", {})
    handler = _registry.get(name)
    if not handler:
        return f"Unknown action: {name}"
    try:
        return await handler(params)
    except Exception as e:
        logger.error(f"Action '{name}' failed: {e}")
        return f"Action failed: {str(e)}"


# ── Built-in actions ─────────────────────────────────────────

@register_action("wikipedia_search")
async def _wikipedia_search(params: dict) -> str:
    query = params.get("query", "")
    sentences = params.get("sentences", 3)
    try:
        result = wikipedia.summary(query, sentences=sentences)
        return f"📚 Wikipedia: {result}"
    except wikipedia.exceptions.DisambiguationError as e:
        options = ", ".join(e.options[:5])
        return f"Multiple results found. Did you mean: {options}?"
    except wikipedia.exceptions.PageError:
        return f"No Wikipedia page found for '{query}'."


@register_action("open_website")
async def _open_website(params: dict) -> str:
    url = params.get("url", "")
    # Server-side: return instruction for frontend to open
    return f"🌐 OPEN_URL:{url}"


@register_action("get_time")
async def _get_time(params: dict) -> str:
    now = datetime.now()
    return f"🕐 The current time is {now.strftime('%I:%M %p')} on {now.strftime('%A, %B %d, %Y')}."


@register_action("send_email")
async def _send_email(params: dict) -> str:
    to = params.get("to", "")
    subject = params.get("subject", "Message from Jarvis")
    body = params.get("body", "")

    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        return "⚠️ Email not configured. Set SMTP_USER and SMTP_PASSWORD."

    if not to or not body:
        return "⚠️ Missing recipient or body for email."

    msg = MIMEText(body)
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_USER
    msg["To"] = to

    try:
        server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT)
        server.ehlo()
        server.starttls()
        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.send_message(msg)
        server.close()
        return f"✅ Email sent to {to}."
    except smtplib.SMTPAuthenticationError:
        return "⚠️ Email auth failed. Check SMTP credentials."


@register_action("play_music")
async def _play_music(params: dict) -> str:
    query = params.get("query", "music")
    return f"🌐 OPEN_URL:https://www.youtube.com/results?search_query={query}"


@register_action("get_weather")
async def _get_weather(params: dict) -> str:
    location = params.get("location", "")
    return f"🌐 OPEN_URL:https://wttr.in/{location}?format=3"


@register_action("general_answer")
async def _general_answer(params: dict) -> str:
    return params.get("answer", "")

```

---

## `backend/app/services/voice_service.py`

```python
"""
Voice processing service.
- STT: OpenAI Whisper (local, runs on CPU/GPU)
- TTS: edge-tts (free, high-quality Microsoft voices)
"""

import io
import logging
import tempfile
from pathlib import Path

logger = logging.getLogger(__name__)

# Lazy-load whisper to avoid slow import at startup
_whisper_model = None


def _get_whisper_model():
    global _whisper_model
    if _whisper_model is None:
        import whisper
        from app.config import get_settings
        settings = get_settings()
        logger.info(f"Loading Whisper model: {settings.WHISPER_MODEL}")
        _whisper_model = whisper.load_model(settings.WHISPER_MODEL)
    return _whisper_model


async def speech_to_text(audio_bytes: bytes, filename: str = "audio.webm") -> str:
    """
    Transcribe audio bytes to text using Whisper.
    Accepts webm, wav, mp3, ogg, m4a formats.
    """
    import whisper
    import numpy as np
    import subprocess

    suffix = Path(filename).suffix or ".webm"

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp_in:
        tmp_in.write(audio_bytes)
        tmp_in.flush()
        input_path = tmp_in.name

    # Convert to 16kHz mono WAV for Whisper using ffmpeg
    wav_path = input_path + ".wav"
    try:
        proc = subprocess.run(
            [
                "ffmpeg", "-y", "-i", input_path,
                "-ar", "16000", "-ac", "1", "-f", "wav", wav_path,
            ],
            capture_output=True,
            timeout=30,
        )
        if proc.returncode != 0:
            logger.error(f"ffmpeg error: {proc.stderr.decode()}")
            raise RuntimeError("Audio conversion failed")

        model = _get_whisper_model()
        result = model.transcribe(wav_path, language="en")
        text = result.get("text", "").strip()
        logger.info(f"Transcribed: {text[:80]}...")
        return text

    except Exception as e:
        logger.error(f"STT error: {e}")
        raise
    finally:
        Path(input_path).unlink(missing_ok=True)
        Path(wav_path).unlink(missing_ok=True)


async def text_to_speech(text: str, voice: str = "en-US-GuyNeural") -> bytes:
    """
    Convert text to speech audio (MP3 bytes) using edge-tts.
    Free, no API key needed, high-quality Microsoft neural voices.
    Voices: en-US-GuyNeural, en-US-JennyNeural, en-GB-RyanNeural, etc.
    """
    import edge_tts

    voice_map = {
        "alloy": "en-US-GuyNeural",
        "nova": "en-US-JennyNeural",
        "british": "en-GB-RyanNeural",
        "indian": "en-IN-PrabhatNeural",
    }
    voice = voice_map.get(voice, voice)

    communicate = edge_tts.Communicate(text, voice)
    audio_buffer = io.BytesIO()

    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio_buffer.write(chunk["data"])

    audio_buffer.seek(0)
    return audio_buffer.read()

```

---

## `backend/app/utils/__init__.py`

```python

```

---

## `backend/app/utils/helpers.py`

```python
"""Shared helper functions."""

import re
import json
from typing import Optional


def extract_action_from_response(text: str) -> tuple[str, Optional[dict]]:
    """
    Parse AI response text looking for a JSON action block.
    Returns (clean_text, action_dict_or_None).
    """
    pattern = r'\{["\s]*action["\s]*:.*?\}'
    match = re.search(pattern, text, re.DOTALL)
    if match:
        try:
            action = json.loads(match.group())
            clean = text[: match.start()].strip() + text[match.end() :].strip()
            return clean.strip(), action
        except json.JSONDecodeError:
            pass
    return text.strip(), None


def truncate_conversation(
    messages: list[dict], max_messages: int = 20
) -> list[dict]:
    """Keep the most recent messages, always preserving the system prompt."""
    if len(messages) <= max_messages:
        return messages
    system = [m for m in messages if m["role"] == "system"]
    recent = [m for m in messages if m["role"] != "system"][-max_messages:]
    return system + recent


def sanitize_input(text: str, max_length: int = 2000) -> str:
    """Basic input sanitization."""
    text = text.strip()
    text = text[:max_length]
    return text

```

---

## `backend/app/utils/security.py`

```python
"""JWT token management, password hashing, and auth dependency."""

import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models.user import User

settings = get_settings()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security_scheme = HTTPBearer()


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(
    user_id: str, expires_delta: Optional[timedelta] = None
) -> str:
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    return jwt.encode(
        {"sub": user_id, "exp": expire, "type": "access"},
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )


def create_refresh_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        days=settings.REFRESH_TOKEN_EXPIRE_DAYS
    )
    return jwt.encode(
        {"sub": user_id, "exp": expire, "type": "refresh"},
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    payload = decode_token(credentials.credentials)
    user_id = payload.get("sub")
    if not user_id or payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Invalid token")

    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    return user


async def get_current_admin(user: User = Depends(get_current_user)) -> User:
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

```

---

## `backend/requirements.txt`

```text
# ── Core ──────────────────────────────────────────────
fastapi==0.115.6
uvicorn[standard]==0.34.0
pydantic[email]==2.10.4
pydantic-settings==2.7.1

# ── Database ──────────────────────────────────────────
sqlalchemy[asyncio]==2.0.36
asyncpg==0.30.0
alembic==1.14.1

# ── Auth ──────────────────────────────────────────────
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
bcrypt==4.2.1

# ── AI ────────────────────────────────────────────────
anthropic==0.42.0

# ── Voice ─────────────────────────────────────────────
openai-whisper==20240930
edge-tts==6.1.20

# ── Utilities ─────────────────────────────────────────
wikipedia==1.4.0
python-multipart==0.0.20
python-dotenv==1.0.1
redis==5.2.1

# ── Testing ───────────────────────────────────────────
pytest==8.3.4
pytest-asyncio==0.25.0
httpx==0.28.1

```

---

## `backend/tests/__init__.py`

```python

```

---

## `backend/tests/conftest.py`

```python
"""Shared test fixtures."""

import asyncio
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.database import Base, get_db
from app.main import app

# Use SQLite for tests
TEST_DB_URL = "sqlite+aiosqlite:///./test.db"
test_engine = create_async_engine(TEST_DB_URL, echo=False)
TestSession = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(autouse=True)
async def setup_db():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


async def override_get_db():
    async with TestSession() as session:
        yield session

app.dependency_overrides[get_db] = override_get_db


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c

```

---

## `backend/tests/test_auth.py`

```python
"""Tests for authentication endpoints."""

import pytest


@pytest.mark.asyncio
async def test_register(client):
    resp = await client.post("/api/auth/register", json={
        "email": "test@example.com",
        "username": "testuser",
        "password": "securepass123",
        "full_name": "Test User",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["user"]["email"] == "test@example.com"


@pytest.mark.asyncio
async def test_register_duplicate(client):
    payload = {
        "email": "dup@example.com",
        "username": "dupuser",
        "password": "securepass123",
    }
    await client.post("/api/auth/register", json=payload)
    resp = await client.post("/api/auth/register", json=payload)
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_login(client):
    await client.post("/api/auth/register", json={
        "email": "login@example.com",
        "username": "loginuser",
        "password": "securepass123",
    })
    resp = await client.post("/api/auth/login", json={
        "email": "login@example.com",
        "password": "securepass123",
    })
    assert resp.status_code == 200
    assert "access_token" in resp.json()


@pytest.mark.asyncio
async def test_login_wrong_password(client):
    await client.post("/api/auth/register", json={
        "email": "wrong@example.com",
        "username": "wronguser",
        "password": "securepass123",
    })
    resp = await client.post("/api/auth/login", json={
        "email": "wrong@example.com",
        "password": "badpassword",
    })
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_get_profile(client):
    reg = await client.post("/api/auth/register", json={
        "email": "profile@example.com",
        "username": "profileuser",
        "password": "securepass123",
    })
    token = reg.json()["access_token"]
    resp = await client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["email"] == "profile@example.com"


@pytest.mark.asyncio
async def test_protected_route_no_token(client):
    resp = await client.get("/api/auth/me")
    assert resp.status_code == 403

```

---

## `backend/tests/test_chat.py`

```python
"""Tests for chat endpoints."""

import pytest


async def _get_auth_token(client) -> str:
    resp = await client.post("/api/auth/register", json={
        "email": "chattest@example.com",
        "username": "chattester",
        "password": "securepass123",
    })
    return resp.json()["access_token"]


@pytest.mark.asyncio
async def test_create_conversation(client):
    token = await _get_auth_token(client)
    resp = await client.post(
        "/api/chat/conversations",
        json={"title": "Test Chat"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["title"] == "Test Chat"


@pytest.mark.asyncio
async def test_list_conversations(client):
    token = await _get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    await client.post("/api/chat/conversations", json={"title": "Chat 1"}, headers=headers)
    await client.post("/api/chat/conversations", json={"title": "Chat 2"}, headers=headers)

    resp = await client.get("/api/chat/conversations", headers=headers)
    assert resp.status_code == 200
    assert len(resp.json()) >= 2


@pytest.mark.asyncio
async def test_delete_conversation(client):
    token = await _get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    create_resp = await client.post(
        "/api/chat/conversations", json={"title": "To Delete"}, headers=headers
    )
    convo_id = create_resp.json()["id"]

    del_resp = await client.delete(f"/api/chat/conversations/{convo_id}", headers=headers)
    assert del_resp.status_code == 200


@pytest.mark.asyncio
async def test_health_check(client):
    resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "healthy"

```

---

## `docker-compose.yml`

```yaml
version: "3.9"

services:
  # ── PostgreSQL ──────────────────────────────────────
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: jarvis
      POSTGRES_PASSWORD: ${DB_PASSWORD:-jarvis}
      POSTGRES_DB: jarvis
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U jarvis"]
      interval: 5s
      retries: 5

  # ── Redis ───────────────────────────────────────────
  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --maxmemory 64mb --maxmemory-policy allkeys-lru
    ports:
      - "6379:6379"

  # ── Backend (FastAPI) ───────────────────────────────
  backend:
    build: ./backend
    restart: unless-stopped
    env_file: ./backend/.env
    environment:
      DATABASE_URL: postgresql+asyncpg://jarvis:${DB_PASSWORD:-jarvis}@db:5432/jarvis
      REDIS_URL: redis://redis:6379/0
    ports:
      - "8000:8000"
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_started
    volumes:
      - whisper_cache:/home/appuser/.cache

  # ── Frontend (Next.js) ─────────────────────────────
  frontend:
    build: ./frontend
    restart: unless-stopped
    environment:
      NEXT_PUBLIC_API_URL: ""
    ports:
      - "3000:3000"
    depends_on:
      - backend

  # ── Nginx Reverse Proxy ─────────────────────────────
  nginx:
    image: nginx:alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - frontend
      - backend

volumes:
  pgdata:
  whisper_cache:

```

---

## `frontend/.env.example`

```
# ── Jarvis AI Frontend ──────────────────────────────
# API base URL (empty = same origin via Next.js rewrites)
NEXT_PUBLIC_API_URL=

# WebSocket URL (empty = auto-detect from window.location)
NEXT_PUBLIC_WS_URL=

```

---

## `frontend/Dockerfile`

```
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json ./
RUN npm install --frozen-lockfile 2>/dev/null || npm install

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000

CMD ["node", "server.js"]

```

---

## `frontend/next.config.js`

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL || "http://backend:8000"}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;

```

---

## `frontend/package.json`

```json
{
  "name": "jarvis-ai-frontend",
  "version": "2.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "^14.2.21",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "lucide-react": "^0.468.0",
    "clsx": "^2.1.1"
  },
  "devDependencies": {
    "tailwindcss": "^3.4.17",
    "postcss": "^8.4.49",
    "autoprefixer": "^10.4.20",
    "eslint": "^8.57.1",
    "eslint-config-next": "^14.2.21",
    "@types/node": "^22.10.2",
    "@types/react": "^18.3.18"
  }
}

```

---

## `frontend/postcss.config.js`

```javascript
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};

```

---

## `frontend/public/.gitkeep`

```


```

---

## `frontend/src/app/admin/page.js`

```javascript
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../lib/auth";
import { apiAdminStats, apiAdminUsers, apiAdminToggleUser } from "../../lib/api";
import { ArrowLeft, Users, MessageSquare, BarChart3, ToggleLeft, ToggleRight, Loader2, Shield } from "lucide-react";

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && (!user || !user.is_admin)) {
      router.push("/dashboard");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user?.is_admin) return;
    (async () => {
      try {
        const [s, u] = await Promise.all([apiAdminStats(), apiAdminUsers()]);
        setStats(s);
        setUsers(u);
      } catch (err) {
        console.error("Admin load error:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const toggleUser = async (userId) => {
    try {
      const result = await apiAdminToggleUser(userId);
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, is_active: result.is_active } : u))
      );
    } catch (err) {
      console.error("Toggle error:", err);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-jarvis-600" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-50">
      {/* Header */}
      <header className="bg-white dark:bg-surface-100 border-b border-surface-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <button onClick={() => router.push("/dashboard")} className="p-2 hover:bg-surface-100 rounded-lg transition">
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-jarvis-600" />
            <h1 className="font-display font-bold text-lg">Admin Dashboard</h1>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Stats cards */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { icon: Users, label: "Total Users", value: stats.total_users, sub: `${stats.active_users} active` },
              { icon: MessageSquare, label: "Total Messages", value: stats.total_messages, sub: "all time" },
              { icon: BarChart3, label: "Conversations", value: stats.total_conversations, sub: "all time" },
            ].map(({ icon: Icon, label, value, sub }) => (
              <div
                key={label}
                className="p-6 bg-white dark:bg-surface-100 rounded-2xl border border-surface-200"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-jarvis-100 dark:bg-jarvis-950 flex items-center justify-center">
                    <Icon size={18} className="text-jarvis-600" />
                  </div>
                  <span className="text-sm text-surface-700">{label}</span>
                </div>
                <p className="font-display font-bold text-3xl">{value?.toLocaleString() || 0}</p>
                <p className="text-xs text-surface-700 mt-1">{sub}</p>
              </div>
            ))}
          </div>
        )}

        {/* Users table */}
        <div className="bg-white dark:bg-surface-100 rounded-2xl border border-surface-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-surface-200">
            <h2 className="font-display font-bold">Users ({users.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 bg-surface-50 dark:bg-surface-200">
                  <th className="text-left px-6 py-3 font-medium text-surface-700">User</th>
                  <th className="text-left px-6 py-3 font-medium text-surface-700">Email</th>
                  <th className="text-left px-6 py-3 font-medium text-surface-700">Messages</th>
                  <th className="text-left px-6 py-3 font-medium text-surface-700">Joined</th>
                  <th className="text-left px-6 py-3 font-medium text-surface-700">Status</th>
                  <th className="text-left px-6 py-3 font-medium text-surface-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-surface-200 last:border-0 hover:bg-surface-50 dark:hover:bg-surface-200 transition">
                    <td className="px-6 py-3 font-medium">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-jarvis-200 dark:bg-jarvis-900 flex items-center justify-center text-xs font-bold text-jarvis-700 dark:text-jarvis-300">
                          {u.username[0].toUpperCase()}
                        </div>
                        {u.username}
                        {u.is_admin && (
                          <span className="px-1.5 py-0.5 text-[10px] bg-jarvis-100 dark:bg-jarvis-950 text-jarvis-700 dark:text-jarvis-300 rounded font-medium">
                            ADMIN
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-3 text-surface-700">{u.email}</td>
                    <td className="px-6 py-3">{u.message_count}</td>
                    <td className="px-6 py-3 text-surface-700">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          u.is_active
                            ? "bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400"
                            : "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400"
                        }`}
                      >
                        {u.is_active ? "Active" : "Disabled"}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      {!u.is_admin && (
                        <button
                          onClick={() => toggleUser(u.id)}
                          className="p-1.5 hover:bg-surface-200 rounded transition"
                          title={u.is_active ? "Disable user" : "Enable user"}
                        >
                          {u.is_active ? (
                            <ToggleRight size={18} className="text-green-600" />
                          ) : (
                            <ToggleLeft size={18} className="text-surface-700" />
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

```

---

## `frontend/src/app/dashboard/page.js`

```javascript
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../lib/auth";
import { useTheme } from "../layout";
import {
  apiListConversations,
  apiGetMessages,
  apiSendMessage,
  apiCreateConversation,
  apiDeleteConversation,
  apiTranscribeAudio,
  apiSynthesizeSpeech,
  apiLogout,
  getTokens,
} from "../../lib/api";
import { JarvisWebSocket } from "../../lib/websocket";
import {
  Mic, MicOff, Send, Plus, Trash2, Sun, Moon, LogOut,
  Loader2, Zap, Volume2, VolumeX, Menu, X, Settings, BarChart3,
} from "lucide-react";

export default function Dashboard() {
  const { user, loading: authLoading, logout: authLogout } = useAuth();
  const { dark, setDark } = useTheme();
  const router = useRouter();

  // Chat state
  const [conversations, setConversations] = useState([]);
  const [activeConvo, setActiveConvo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [streaming, setStreaming] = useState("");

  // Voice state
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // UI state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // WebSocket ref
  const wsRef = useRef(null);

  // ── Auth guard ────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  // ── Load conversations ────────────────────────────────
  const loadConversations = useCallback(async () => {
    try {
      const data = await apiListConversations();
      setConversations(data);
    } catch (err) {
      console.error("Failed to load conversations:", err);
    }
  }, []);

  useEffect(() => {
    if (user) loadConversations();
  }, [user, loadConversations]);

  // ── Load messages for active conversation ─────────────
  useEffect(() => {
    if (!activeConvo) {
      setMessages([]);
      return;
    }
    (async () => {
      try {
        const data = await apiGetMessages(activeConvo);
        setMessages(data);
      } catch (err) {
        console.error("Failed to load messages:", err);
      }
    })();
  }, [activeConvo]);

  // ── Auto-scroll ───────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  // ── WebSocket setup ───────────────────────────────────
  useEffect(() => {
    const ws = new JarvisWebSocket({
      onToken: (token) => setStreaming((prev) => prev + token),
      onDone: (data) => {
        setStreaming((prev) => {
          const finalText = prev;
          setMessages((msgs) => [
            ...msgs,
            {
              id: Date.now().toString(),
              role: "assistant",
              content: finalText,
              action_result: data?.action_result,
              created_at: new Date().toISOString(),
            },
          ]);

          // Auto-speak response
          if (autoSpeak && finalText) {
            speakText(finalText);
          }
          return "";
        });
        setSending(false);
        if (data?.conversation_id && !activeConvo) {
          setActiveConvo(data.conversation_id);
        }
        loadConversations();
      },
      onError: (err) => {
        console.error("WS error:", err);
        setSending(false);
        setStreaming("");
      },
    });
    ws.connect();
    wsRef.current = ws;
    return () => ws.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Send message via WebSocket ────────────────────────
  const sendMessage = async (text = input) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    // Add user message immediately
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        role: "user",
        content: trimmed,
        created_at: new Date().toISOString(),
      },
    ]);
    setInput("");
    setSending(true);
    setStreaming("");

    const { access } = getTokens();
    if (wsRef.current) {
      wsRef.current.send(access, trimmed, activeConvo);
    } else {
      // Fallback to REST
      try {
        const res = await apiSendMessage(trimmed, activeConvo);
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: "assistant",
            content: res.response,
            action_result: res.action_result,
            created_at: new Date().toISOString(),
          },
        ]);
        if (!activeConvo && res.conversation_id) {
          setActiveConvo(res.conversation_id);
        }
        if (autoSpeak && res.response) speakText(res.response);
        loadConversations();
      } catch (err) {
        console.error("Send failed:", err);
      } finally {
        setSending(false);
      }
    }
  };

  // ── Voice recording ───────────────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setTranscribing(true);
        try {
          const { text } = await apiTranscribeAudio(blob);
          if (text) {
            setInput(text);
            // Auto-send voice input
            sendMessage(text);
          }
        } catch (err) {
          console.error("Transcription failed:", err);
        } finally {
          setTranscribing(false);
        }
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
    } catch (err) {
      console.error("Mic access denied:", err);
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  // ── TTS ───────────────────────────────────────────────
  const speakText = async (text) => {
    try {
      // Strip action markers and markdown
      const clean = text.replace(/🌐 OPEN_URL:\S+/g, "").replace(/[*_`#]/g, "").trim();
      if (!clean) return;
      const blob = await apiSynthesizeSpeech(clean.slice(0, 500));
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.play();
    } catch (err) {
      console.error("TTS error:", err);
    }
  };

  // ── Handle URL actions in messages ────────────────────
  const handleActionResult = (result) => {
    if (!result) return null;
    const urlMatch = result.match(/OPEN_URL:(\S+)/);
    if (urlMatch) {
      const url = urlMatch[1].startsWith("http") ? urlMatch[1] : `https://${urlMatch[1]}`;
      return (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mt-2 px-4 py-2 bg-jarvis-100 dark:bg-jarvis-950 text-jarvis-700 dark:text-jarvis-300 rounded-lg text-sm font-medium hover:bg-jarvis-200 transition"
        >
          Open Link →
        </a>
      );
    }
    return <p className="text-sm text-surface-700 mt-1 italic">{result}</p>;
  };

  // ── New conversation ──────────────────────────────────
  const newConversation = () => {
    setActiveConvo(null);
    setMessages([]);
    setStreaming("");
    inputRef.current?.focus();
  };

  // ── Delete conversation ───────────────────────────────
  const deleteConvo = async (id, e) => {
    e.stopPropagation();
    try {
      await apiDeleteConversation(id);
      if (activeConvo === id) newConversation();
      loadConversations();
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  // ── Logout ────────────────────────────────────────────
  const handleLogout = () => {
    apiLogout();
    authLogout();
    router.push("/");
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-jarvis-600" size={32} />
      </div>
    );
  }

  const sidebarContent = (
    <>
      {/* Sidebar header */}
      <div className="p-4 border-b border-surface-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-jarvis-600 flex items-center justify-center">
              <Zap size={14} className="text-white" />
            </div>
            <span className="font-display font-bold text-sm tracking-tight">JARVIS</span>
          </div>
          <button
            onClick={() => setDark(!dark)}
            className="p-1.5 rounded-lg hover:bg-surface-200 transition"
          >
            {dark ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </div>
        <button
          onClick={newConversation}
          className="w-full flex items-center justify-center gap-2 py-2.5 border border-surface-300 rounded-lg text-sm font-medium hover:bg-surface-100 transition"
        >
          <Plus size={16} /> New Chat
        </button>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {conversations.map((c) => (
          <button
            key={c.id}
            onClick={() => { setActiveConvo(c.id); setMobileSidebar(false); }}
            className={`w-full text-left px-3 py-2.5 rounded-lg text-sm truncate group flex items-center justify-between transition ${
              activeConvo === c.id
                ? "bg-jarvis-100 dark:bg-jarvis-950 text-jarvis-700 dark:text-jarvis-300 font-medium"
                : "hover:bg-surface-100 text-surface-700"
            }`}
          >
            <span className="truncate flex-1">{c.title}</span>
            <button
              onClick={(e) => deleteConvo(c.id, e)}
              className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition"
            >
              <Trash2 size={13} />
            </button>
          </button>
        ))}
      </div>

      {/* Sidebar footer */}
      <div className="p-4 border-t border-surface-200 space-y-2">
        {user?.is_admin && (
          <button
            onClick={() => router.push("/admin")}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-surface-100 transition text-surface-700"
          >
            <BarChart3 size={15} /> Admin Panel
          </button>
        )}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-full bg-jarvis-200 dark:bg-jarvis-900 flex items-center justify-center text-xs font-bold text-jarvis-700 dark:text-jarvis-300 flex-shrink-0">
              {user?.username?.[0]?.toUpperCase() || "?"}
            </div>
            <span className="text-sm truncate">{user?.username}</span>
          </div>
          <button onClick={handleLogout} className="p-2 hover:text-red-500 transition">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Desktop sidebar */}
      <aside
        className={`hidden md:flex flex-col bg-white dark:bg-surface-100 border-r border-surface-200 transition-all ${
          sidebarOpen ? "w-72" : "w-0 overflow-hidden"
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileSidebar && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileSidebar(false)} />
          <aside className="relative w-72 flex flex-col bg-white dark:bg-surface-100 z-10">
            <button
              onClick={() => setMobileSidebar(false)}
              className="absolute top-4 right-4 p-1"
            >
              <X size={18} />
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main chat area */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="flex items-center gap-3 px-4 py-3 border-b border-surface-200 bg-white dark:bg-surface-100">
          <button onClick={() => setMobileSidebar(true)} className="md:hidden p-1">
            <Menu size={20} />
          </button>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="hidden md:block p-1 hover:bg-surface-200 rounded-lg transition"
          >
            <Menu size={18} />
          </button>
          <h1 className="font-display font-semibold text-sm flex-1 truncate">
            {activeConvo
              ? conversations.find((c) => c.id === activeConvo)?.title || "Chat"
              : "New Conversation"}
          </h1>
          <button
            onClick={() => setAutoSpeak(!autoSpeak)}
            className={`p-2 rounded-lg transition ${
              autoSpeak ? "text-jarvis-600 bg-jarvis-100 dark:bg-jarvis-950" : "text-surface-700 hover:bg-surface-100"
            }`}
            title={autoSpeak ? "Auto-speak on" : "Auto-speak off"}
          >
            {autoSpeak ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-6">
          {messages.length === 0 && !streaming && (
            <div className="flex-1 flex flex-col items-center justify-center text-center pt-20 animate-fade-in">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-jarvis-500 to-jarvis-700 flex items-center justify-center mb-4 shadow-lg shadow-jarvis-500/20">
                <Zap size={28} className="text-white" />
              </div>
              <h2 className="font-display font-bold text-2xl mb-2">Hello{user?.full_name ? `, ${user.full_name.split(" ")[0]}` : ""}!</h2>
              <p className="text-surface-700 max-w-md text-sm leading-relaxed">
                I&apos;m Jarvis, your AI assistant. Type a message or press the microphone
                button to talk. I can search Wikipedia, open websites, send emails, and much more.
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex animate-slide-up ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] md:max-w-[65%] rounded-2xl px-5 py-3 ${
                  msg.role === "user"
                    ? "bg-jarvis-600 text-white rounded-br-md"
                    : "bg-surface-100 dark:bg-surface-200 rounded-bl-md"
                }`}
              >
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                {msg.role === "assistant" && handleActionResult(msg.action_result)}
              </div>
            </div>
          ))}

          {/* Streaming response */}
          {streaming && (
            <div className="flex justify-start animate-slide-up">
              <div className="max-w-[80%] md:max-w-[65%] rounded-2xl rounded-bl-md px-5 py-3 bg-surface-100 dark:bg-surface-200">
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{streaming}</p>
              </div>
            </div>
          )}

          {/* Typing indicator */}
          {sending && !streaming && (
            <div className="flex justify-start">
              <div className="bg-surface-100 dark:bg-surface-200 rounded-2xl rounded-bl-md px-5 py-3 flex items-center gap-1">
                <div className="typing-dot w-2 h-2 rounded-full bg-surface-700" />
                <div className="typing-dot w-2 h-2 rounded-full bg-surface-700" />
                <div className="typing-dot w-2 h-2 rounded-full bg-surface-700" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input bar */}
        <div className="px-4 md:px-8 py-4 border-t border-surface-200 bg-white dark:bg-surface-100">
          <div className="max-w-3xl mx-auto flex items-center gap-3">
            {/* Voice button */}
            <button
              onClick={recording ? stopRecording : startRecording}
              disabled={transcribing}
              className={`flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-all ${
                recording
                  ? "bg-red-500 text-white voice-recording"
                  : transcribing
                  ? "bg-surface-200 text-surface-700"
                  : "bg-surface-100 dark:bg-surface-200 text-surface-700 hover:bg-jarvis-100 hover:text-jarvis-600"
              }`}
            >
              {transcribing ? (
                <Loader2 size={18} className="animate-spin" />
              ) : recording ? (
                <MicOff size={18} />
              ) : (
                <Mic size={18} />
              )}
            </button>

            {/* Text input */}
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                placeholder={recording ? "Listening..." : "Type a message or use your voice..."}
                disabled={recording || transcribing}
                className="w-full px-4 py-3 pr-12 rounded-xl border border-surface-300 bg-surface-50 focus:outline-none focus:ring-2 focus:ring-jarvis-500 focus:border-transparent text-sm transition disabled:opacity-50"
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || sending}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-jarvis-600 text-white disabled:opacity-30 hover:bg-jarvis-700 transition"
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

```

---

## `frontend/src/app/layout.js`

```javascript
"use client";

import "../styles/globals.css";
import { useState, useEffect } from "react";
import { AuthProvider } from "../lib/auth";

export default function RootLayout({ children }) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("jarvis_theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDark(stored === "dark" || (!stored && prefersDark));
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("jarvis_theme", dark ? "dark" : "light");
  }, [dark]);

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>Jarvis AI Assistant</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="Production AI voice assistant" />
      </head>
      <body className="bg-surface-50 text-surface-900 transition-colors duration-300">
        <AuthProvider>
          <ThemeContext.Provider value={{ dark, setDark }}>
            {children}
          </ThemeContext.Provider>
        </AuthProvider>
      </body>
    </html>
  );
}

import { createContext, useContext } from "react";
export const ThemeContext = createContext({ dark: false, setDark: () => {} });
export const useTheme = () => useContext(ThemeContext);

```

---

## `frontend/src/app/login/page.js`

```javascript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiLogin } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { Zap, Loader2 } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { setUser } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await apiLogin(email, password);
      setUser(data.user);
      router.push("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-xl bg-jarvis-600 flex items-center justify-center">
            <Zap size={22} className="text-white" />
          </div>
          <span className="font-display font-bold text-2xl tracking-tight">JARVIS</span>
        </div>

        <div className="p-8 rounded-2xl border border-surface-200 bg-white dark:bg-surface-100">
          <h2 className="font-display font-bold text-xl mb-1">Welcome back</h2>
          <p className="text-sm text-surface-700 mb-6">Sign in to your account</p>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-surface-300 bg-surface-50 focus:outline-none focus:ring-2 focus:ring-jarvis-500 focus:border-transparent transition text-sm"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-surface-300 bg-surface-50 focus:outline-none focus:ring-2 focus:ring-jarvis-500 focus:border-transparent transition text-sm"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-jarvis-600 text-white rounded-lg font-semibold text-sm hover:bg-jarvis-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              Sign In
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-surface-700 mt-6">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-jarvis-600 font-medium hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}

```

---

## `frontend/src/app/page.js`

```javascript
"use client";

import Link from "next/link";
import { useAuth } from "../lib/auth";
import { useTheme } from "./layout";
import { Mic, MessageSquare, Shield, Zap, Sun, Moon } from "lucide-react";

export default function Home() {
  const { user } = useAuth();
  const { dark, setDark } = useTheme();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 md:px-12 py-4 border-b border-surface-200">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-jarvis-600 flex items-center justify-center">
            <Zap size={18} className="text-white" />
          </div>
          <span className="font-display font-bold text-lg tracking-tight">JARVIS</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setDark(!dark)}
            className="p-2 rounded-lg hover:bg-surface-200 transition-colors"
          >
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          {user ? (
            <Link
              href="/dashboard"
              className="px-5 py-2 bg-jarvis-600 text-white rounded-lg font-medium text-sm hover:bg-jarvis-700 transition-colors"
            >
              Dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className="px-4 py-2 text-sm font-medium hover:text-jarvis-600 transition-colors">
                Sign In
              </Link>
              <Link
                href="/register"
                className="px-5 py-2 bg-jarvis-600 text-white rounded-lg font-medium text-sm hover:bg-jarvis-700 transition-colors"
              >
                Get Started
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="max-w-3xl animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-jarvis-100 dark:bg-jarvis-950 text-jarvis-700 dark:text-jarvis-300 text-xs font-medium mb-8 tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            AI-POWERED VOICE ASSISTANT
          </div>
          <h1 className="font-display text-5xl md:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
            Your intelligent
            <br />
            <span className="bg-gradient-to-r from-jarvis-500 to-jarvis-700 bg-clip-text text-transparent">
              voice companion
            </span>
          </h1>
          <p className="text-lg md:text-xl text-surface-700 max-w-xl mx-auto mb-10 leading-relaxed">
            Speak naturally, get things done. Jarvis understands your voice, executes commands,
            and remembers your conversations — all in real time.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href={user ? "/dashboard" : "/register"}
              className="px-8 py-3.5 bg-jarvis-600 text-white rounded-xl font-semibold hover:bg-jarvis-700 transition-all shadow-lg shadow-jarvis-600/25 hover:shadow-jarvis-600/40"
            >
              Start Talking to Jarvis
            </Link>
            <Link
              href="#features"
              className="px-8 py-3.5 border border-surface-300 rounded-xl font-semibold hover:bg-surface-100 transition-all"
            >
              See Features
            </Link>
          </div>
        </div>
      </main>

      {/* Features */}
      <section id="features" className="px-6 md:px-12 py-24">
        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-8">
          {[
            {
              icon: Mic,
              title: "Voice First",
              desc: "Speak naturally with real-time speech recognition and neural text-to-speech responses.",
            },
            {
              icon: MessageSquare,
              title: "Smart Chat",
              desc: "Powered by Claude AI with streaming responses, conversation memory, and action execution.",
            },
            {
              icon: Shield,
              title: "Production Ready",
              desc: "JWT auth, rate limiting, encrypted credentials, Docker deployment, and full API documentation.",
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="p-6 rounded-2xl border border-surface-200 hover:border-jarvis-300 transition-all group"
            >
              <div className="w-12 h-12 rounded-xl bg-jarvis-100 dark:bg-jarvis-950 flex items-center justify-center mb-4 group-hover:bg-jarvis-200 transition-colors">
                <Icon size={22} className="text-jarvis-600" />
              </div>
              <h3 className="font-display font-bold text-lg mb-2">{title}</h3>
              <p className="text-surface-700 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-6 border-t border-surface-200 text-center text-sm text-surface-700">
        Jarvis AI Assistant &copy; {new Date().getFullYear()} &middot; Built with FastAPI, Next.js, and Claude AI
      </footer>
    </div>
  );
}

```

---

## `frontend/src/app/register/page.js`

```javascript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiRegister } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { Zap, Loader2 } from "lucide-react";

export default function RegisterPage() {
  const [form, setForm] = useState({ email: "", username: "", password: "", fullName: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { setUser } = useAuth();

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    try {
      const data = await apiRegister(form.email, form.username, form.password, form.fullName);
      setUser(data.user);
      router.push("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-xl bg-jarvis-600 flex items-center justify-center">
            <Zap size={22} className="text-white" />
          </div>
          <span className="font-display font-bold text-2xl tracking-tight">JARVIS</span>
        </div>

        <div className="p-8 rounded-2xl border border-surface-200 bg-white dark:bg-surface-100">
          <h2 className="font-display font-bold text-xl mb-1">Create account</h2>
          <p className="text-sm text-surface-700 mb-6">Start your AI assistant experience</p>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Full Name</label>
              <input
                type="text"
                value={form.fullName}
                onChange={update("fullName")}
                className="w-full px-4 py-2.5 rounded-lg border border-surface-300 bg-surface-50 focus:outline-none focus:ring-2 focus:ring-jarvis-500 transition text-sm"
                placeholder="Tony Stark"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Username</label>
              <input
                type="text"
                required
                value={form.username}
                onChange={update("username")}
                className="w-full px-4 py-2.5 rounded-lg border border-surface-300 bg-surface-50 focus:outline-none focus:ring-2 focus:ring-jarvis-500 transition text-sm"
                placeholder="ironman"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Email</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={update("email")}
                className="w-full px-4 py-2.5 rounded-lg border border-surface-300 bg-surface-50 focus:outline-none focus:ring-2 focus:ring-jarvis-500 transition text-sm"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Password</label>
              <input
                type="password"
                required
                value={form.password}
                onChange={update("password")}
                className="w-full px-4 py-2.5 rounded-lg border border-surface-300 bg-surface-50 focus:outline-none focus:ring-2 focus:ring-jarvis-500 transition text-sm"
                placeholder="••••••••"
              />
              <p className="text-xs text-surface-700 mt-1">Minimum 8 characters</p>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-jarvis-600 text-white rounded-lg font-semibold text-sm hover:bg-jarvis-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              Create Account
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-surface-700 mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-jarvis-600 font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

```

---

## `frontend/src/lib/api.js`

```javascript
/**
 * API client for the Jarvis backend.
 * Handles token storage, auto-refresh, and request helpers.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

// ── Token management ───────────────────────────────────────

export function getTokens() {
  if (typeof window === "undefined") return {};
  return {
    access: localStorage.getItem("jarvis_access_token"),
    refresh: localStorage.getItem("jarvis_refresh_token"),
  };
}

export function setTokens(access, refresh) {
  localStorage.setItem("jarvis_access_token", access);
  localStorage.setItem("jarvis_refresh_token", refresh);
}

export function clearTokens() {
  localStorage.removeItem("jarvis_access_token");
  localStorage.removeItem("jarvis_refresh_token");
}

// ── Request helper ─────────────────────────────────────────

async function request(path, options = {}) {
  const { access } = getTokens();
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };
  if (access) {
    headers["Authorization"] = `Bearer ${access}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  // Auto-refresh on 401
  if (res.status === 401 && !options._retried) {
    const refreshed = await refreshToken();
    if (refreshed) {
      return request(path, { ...options, _retried: true });
    }
    clearTokens();
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    throw new Error("Session expired");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed: ${res.status}`);
  }

  return res.json();
}

async function refreshToken() {
  const { refresh } = getTokens();
  if (!refresh) return false;
  try {
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refresh }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    setTokens(data.access_token, data.refresh_token);
    return true;
  } catch {
    return false;
  }
}

// ── Auth API ───────────────────────────────────────────────

export async function apiRegister(email, username, password, fullName) {
  const data = await request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, username, password, full_name: fullName }),
  });
  setTokens(data.access_token, data.refresh_token);
  return data;
}

export async function apiLogin(email, password) {
  const data = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setTokens(data.access_token, data.refresh_token);
  return data;
}

export function apiLogout() {
  clearTokens();
}

export async function apiGetProfile() {
  return request("/api/auth/me");
}

export async function apiUpdateProfile(updates) {
  return request("/api/auth/me", {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

// ── Chat API ───────────────────────────────────────────────

export async function apiListConversations() {
  return request("/api/chat/conversations");
}

export async function apiCreateConversation(title) {
  return request("/api/chat/conversations", {
    method: "POST",
    body: JSON.stringify({ title }),
  });
}

export async function apiGetMessages(conversationId) {
  return request(`/api/chat/conversations/${conversationId}/messages`);
}

export async function apiDeleteConversation(conversationId) {
  return request(`/api/chat/conversations/${conversationId}`, { method: "DELETE" });
}

export async function apiSendMessage(message, conversationId = null) {
  return request("/api/chat/send", {
    method: "POST",
    body: JSON.stringify({ message, conversation_id: conversationId }),
  });
}

// ── Voice API ──────────────────────────────────────────────

export async function apiTranscribeAudio(audioBlob) {
  const { access } = getTokens();
  const formData = new FormData();
  formData.append("file", audioBlob, "recording.webm");

  const res = await fetch(`${API_BASE}/api/voice/transcribe`, {
    method: "POST",
    headers: { Authorization: `Bearer ${access}` },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Transcription failed");
  }
  return res.json();
}

export async function apiSynthesizeSpeech(text) {
  const { access } = getTokens();
  const res = await fetch(
    `${API_BASE}/api/voice/synthesize?text=${encodeURIComponent(text)}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${access}` },
    }
  );
  if (!res.ok) throw new Error("Speech synthesis failed");
  return res.blob();
}

// ── Admin API ──────────────────────────────────────────────

export async function apiAdminStats() {
  return request("/api/admin/stats");
}

export async function apiAdminUsers() {
  return request("/api/admin/users");
}

export async function apiAdminToggleUser(userId) {
  return request(`/api/admin/users/${userId}/toggle-active`, { method: "PATCH" });
}

```

---

## `frontend/src/lib/auth.js`

```javascript
"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { apiGetProfile, getTokens, clearTokens } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    const { access } = getTokens();
    if (!access) {
      setLoading(false);
      return;
    }
    try {
      const profile = await apiGetProfile();
      setUser(profile);
    } catch {
      clearTokens();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const logout = () => {
    clearTokens();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, logout, reload: loadUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

```

---

## `frontend/src/lib/websocket.js`

```javascript
/**
 * WebSocket client for real-time AI chat streaming.
 * Handles connection, reconnection, and message dispatch.
 */

const WS_BASE =
  process.env.NEXT_PUBLIC_WS_URL ||
  (typeof window !== "undefined"
    ? `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}`
    : "ws://localhost:8000");

export class JarvisWebSocket {
  constructor({ onToken, onDone, onError, onOpen, onClose }) {
    this.onToken = onToken;
    this.onDone = onDone;
    this.onError = onError;
    this.onOpen = onOpen;
    this.onClose = onClose;
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnect = 5;
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.ws = new WebSocket(`${WS_BASE}/api/chat/ws`);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.onOpen?.();
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case "token":
            this.onToken?.(msg.data);
            break;
          case "done":
            this.onDone?.(msg.data);
            break;
          case "start":
            // conversation started, data = conversation_id
            break;
          case "error":
            this.onError?.(msg.data);
            break;
        }
      } catch (e) {
        console.error("WS parse error:", e);
      }
    };

    this.ws.onclose = () => {
      this.onClose?.();
      this._tryReconnect();
    };

    this.ws.onerror = () => {
      this.onError?.("Connection error");
    };
  }

  send(token, message, conversationId = null) {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      this.onError?.("Not connected");
      return;
    }
    this.ws.send(
      JSON.stringify({
        token,
        message,
        conversation_id: conversationId,
      })
    );
  }

  disconnect() {
    this.maxReconnect = 0; // prevent reconnect
    this.ws?.close();
  }

  _tryReconnect() {
    if (this.reconnectAttempts >= this.maxReconnect) return;
    this.reconnectAttempts++;
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 10000);
    setTimeout(() => this.connect(), delay);
  }
}

```

---

## `frontend/src/styles/globals.css`

```css
@import url("https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300..800;1,9..40,300..800&family=JetBrains+Mono:wght@400;500&display=swap");

@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --surface-50:  #f8fafc;
  --surface-100: #f1f5f9;
  --surface-200: #e2e8f0;
  --surface-300: #cbd5e1;
  --surface-700: #334155;
  --surface-800: #1e293b;
  --surface-900: #0f172a;
  --surface-950: #020617;
}

.dark {
  --surface-50:  #1e293b;
  --surface-100: #162032;
  --surface-200: #1a2740;
  --surface-300: #2a3a52;
  --surface-700: #94a3b8;
  --surface-800: #cbd5e1;
  --surface-900: #e2e8f0;
  --surface-950: #f8fafc;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: "DM Sans", system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Scrollbar styling */
::-webkit-scrollbar {
  width: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: var(--surface-300);
  border-radius: 3px;
}
.dark ::-webkit-scrollbar-thumb {
  background: var(--surface-300);
}

/* Voice recording pulse animation */
@keyframes voice-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(92, 124, 250, 0.4); }
  50% { box-shadow: 0 0 0 20px rgba(92, 124, 250, 0); }
}
.voice-recording {
  animation: voice-pulse 1.5s ease-in-out infinite;
}

/* Typing indicator */
.typing-dot {
  animation: typing 1.4s infinite;
}
.typing-dot:nth-child(2) { animation-delay: 0.2s; }
.typing-dot:nth-child(3) { animation-delay: 0.4s; }

@keyframes typing {
  0%, 60%, 100% { transform: translateY(0); }
  30% { transform: translateY(-4px); }
}

```

---

## `frontend/tailwind.config.js`

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        jarvis: {
          50:  "#f0f4ff",
          100: "#dbe4ff",
          200: "#bac8ff",
          300: "#91a7ff",
          400: "#748ffc",
          500: "#5c7cfa",
          600: "#4c6ef5",
          700: "#4263eb",
          800: "#3b5bdb",
          900: "#364fc7",
          950: "#1e3a8a",
        },
        surface: {
          50:  "var(--surface-50)",
          100: "var(--surface-100)",
          200: "var(--surface-200)",
          300: "var(--surface-300)",
          700: "var(--surface-700)",
          800: "var(--surface-800)",
          900: "var(--surface-900)",
          950: "var(--surface-950)",
        },
      },
      fontFamily: {
        display: ["'DM Sans'", "system-ui", "sans-serif"],
        body: ["'DM Sans'", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      animation: {
        "pulse-ring": "pulse-ring 1.5s ease-in-out infinite",
        "fade-in": "fade-in 0.5s ease-out",
        "slide-up": "slide-up 0.4s ease-out",
      },
      keyframes: {
        "pulse-ring": {
          "0%": { transform: "scale(0.9)", opacity: 1 },
          "50%": { transform: "scale(1.1)", opacity: 0.5 },
          "100%": { transform: "scale(0.9)", opacity: 1 },
        },
        "fade-in": {
          from: { opacity: 0 },
          to: { opacity: 1 },
        },
        "slide-up": {
          from: { opacity: 0, transform: "translateY(10px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

```

---

## `nginx/nginx.conf`

```nginx
events {
    worker_connections 1024;
}

http {
    # ── Security headers ─────────────────────────────
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;

    # ── Rate limiting zones ──────────────────────────
    limit_req_zone $binary_remote_addr zone=api:10m rate=30r/m;
    limit_req_zone $binary_remote_addr zone=general:10m rate=60r/m;

    # ── Upstream servers ─────────────────────────────
    upstream backend {
        server backend:8000;
    }

    upstream frontend {
        server frontend:3000;
    }

    # ── Gzip compression ─────────────────────────────
    gzip on;
    gzip_types text/plain application/json application/javascript text/css;
    gzip_min_length 1000;

    server {
        listen 80;
        server_name _;

        client_max_body_size 10M;

        # ── API routes → Backend ─────────────────────
        location /api/ {
            limit_req zone=api burst=10 nodelay;
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;

            # WebSocket support
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_read_timeout 86400;
        }

        # Health check (no rate limit)
        location /health {
            proxy_pass http://backend;
        }

        # Docs (dev only)
        location /docs {
            proxy_pass http://backend;
        }
        location /openapi.json {
            proxy_pass http://backend;
        }

        # ── Everything else → Frontend ───────────────
        location / {
            limit_req zone=general burst=20 nodelay;
            proxy_pass http://frontend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }
    }
}

```

---

