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
