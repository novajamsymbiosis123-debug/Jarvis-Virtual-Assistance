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
