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
