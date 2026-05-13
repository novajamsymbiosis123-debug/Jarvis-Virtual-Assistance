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
