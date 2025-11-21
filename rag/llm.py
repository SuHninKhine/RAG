"""LLM calling utilities for grounded Q&A."""
from __future__ import annotations

from openai import OpenAI

from . import config

_SYSTEM_PROMPT = (
    "You must answer ONLY from the provided context. If the answer is not present, say 'I don't know'. "
    "You will be given a list of numbered sources [1], [2], etc. When you use information from a source, "
    "append the corresponding bracketed numbers at the end of the relevant sentence(s), e.g. "
    "\"... not covered by the plan. [1]\". If unsure which source, say \"I don't know\" instead of guessing."
)
_client = OpenAI(api_key=config.OPENAI_API_KEY)


def _truncate_context(context: str) -> str:
    """Trim context to stay within the configured character budget."""

    if len(context) <= config.MAX_CONTEXT_CHARS:
        return context
    return context[-config.MAX_CONTEXT_CHARS :]


def call_llm(context: str, question: str) -> str:
    """Call the chat model with a grounded context window."""

    context_block = _truncate_context(context)
    messages = [
        {"role": "system", "content": _SYSTEM_PROMPT},
        {
            "role": "user",
            "content": f"Context:\n{context_block}\n\nQuestion: {question}",
        },
    ]
    response = _client.chat.completions.create(
        model=config.LLM_MODEL, messages=messages, temperature=0
    )
    return response.choices[0].message.content.strip()
