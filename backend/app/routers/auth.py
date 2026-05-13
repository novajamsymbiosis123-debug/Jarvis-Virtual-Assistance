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
