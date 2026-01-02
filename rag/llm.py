"""LLM calling utilities for grounded Q&A."""
from __future__ import annotations

from openai import OpenAI

from . import config

_SYSTEM_PROMPT = (
    "You are a question-answering assistant that answers ONLY using the provided context.\n\n"
    "You MUST return your response as valid JSON in the following format:\n\n"
    "{\n"
    '  \"answer\": \"<plain text answer>\",\n'
    '  \"citations\": [\n'
    "    {\n"
    '      \"sentence_index\": number,\n'
    '      \"source_ids\": [number]\n'
    "    }\n"
    "  ]\n"
    "}\n\n"
    "STRICT RULES:\n"
    "- Do NOT include any citation markers in the answer text.\n"
    "- Numbers, brackets, and formatting from the source text must be preserved exactly.\n"
    "- sentence_index is based on splitting the answer into sentences.\n"
    "- Each sentence may appear at most once in the citations array.\n"
    "- If multiple sources support a sentence, list all of them in source_ids.\n"
    "- If the answer is not explicitly stated in the context, respond exactly with:\n"
    "  \"I don't know.\"\n"
    "- The context is provided as:\n"
    "[id] chunk text\n"
    "- Use ONLY the provided ids in source_ids."
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
