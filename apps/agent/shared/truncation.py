"""Message truncation middleware — condense + prune to protect token budget."""

from __future__ import annotations

import logging
from typing import Any

from langchain.agents.middleware import before_model
from langchain_core.messages import HumanMessage, SystemMessage

logger = logging.getLogger("neuma.agent.truncation")

# Keep last N messages after prune; condense when count exceeds threshold
KEEP_RECENT = 12
CONDENSE_EVERY = 20


def _message_text(m: Any) -> str:
    content = getattr(m, "content", None)
    if isinstance(content, str):
        return content
    if content is not None:
        return str(content)
    return str(m)


def _condense_blob(messages: list) -> str:
    parts: list[str] = []
    for m in messages[:-KEEP_RECENT]:
        role = getattr(m, "type", None) or getattr(m, "role", "msg")
        parts.append(f"[{role}] {_message_text(m)[:400]}")
    return "\n".join(parts)[:6000]


def make_truncation_middleware(*, mentor_id: str, thread_id: str):
    """
    before_model middleware: when message count exceeds CONDENSE_EVERY,
    upsert a key-value memory summary and prune older messages from state.
    """

    @before_model
    def truncate_messages(state, runtime):  # noqa: ARG001
        messages = list(state.get("messages") or [])
        if len(messages) < CONDENSE_EVERY:
            return None

        older = messages[:-KEEP_RECENT]
        recent = messages[-KEEP_RECENT:]
        blob = _condense_blob(messages)

        try:
            from tools.write import upsert_agent_memory

            upsert_agent_memory.invoke(
                {
                    "mentor_id": mentor_id,
                    "scope": f"thread:{thread_id}",
                    "key": "conversation_digest",
                    "value": blob,
                }
            )
        except Exception as exc:
            logger.warning("[truncation] upsert_agent_memory falhou: %s", exc)

        digest_msg = SystemMessage(
            content=(
                "Resumo condensado do histórico anterior desta thread "
                f"(gravado em agent_memories):\n{blob[:2500]}"
            )
        )
        # Preserve a human anchor if recent starts with assistant noise
        new_messages = [digest_msg, *recent]
        if not any(isinstance(m, HumanMessage) for m in recent):
            new_messages.append(
                HumanMessage(content="(continua a conversa com o contexto condensado)")
            )

        logger.info(
            "[truncation] pruned %s → %s messages (thread=%s)",
            len(messages),
            len(new_messages),
            thread_id[:8],
        )
        return {"messages": new_messages}

    return truncate_messages
