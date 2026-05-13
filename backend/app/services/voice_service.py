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
