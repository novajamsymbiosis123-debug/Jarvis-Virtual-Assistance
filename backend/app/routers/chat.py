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
