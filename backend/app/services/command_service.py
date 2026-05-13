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
