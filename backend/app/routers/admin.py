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
