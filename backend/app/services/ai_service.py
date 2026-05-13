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
