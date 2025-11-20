"""Centralized configuration and logging for the RAG backend."""
from __future__ import annotations

import logging
import os
from pathlib import Path

CHUNK_SIZE = 800
CHUNK_OVERLAP = 100
TOP_K_DOCS = 2
# Retrieve more chunks to widen context for grounding answers.
TOP_K_CHUNKS_PER_DOC = 12
# Allow a larger context window for the LLM.
MAX_CONTEXT_CHARS = 20000
EMBED_MODEL = "text-embedding-3-small"
LLM_MODEL = "gpt-4o-mini"

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    raise RuntimeError("OPENAI_API_KEY environment variable must be set.")

BASE_DIR = Path(__file__).resolve().parent
DOCUMENTS_DIR = BASE_DIR / "documents"
INDEX_DIR = BASE_DIR / "indexes"
DOCUMENTS_DIR.mkdir(parents=True, exist_ok=True)
INDEX_DIR.mkdir(parents=True, exist_ok=True)

logger = logging.getLogger("rag")
if not logger.handlers:
    logger.setLevel(logging.INFO)
    handler = logging.StreamHandler()
    formatter = logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s")
    handler.setFormatter(formatter)
    logger.addHandler(handler)

__all__ = [
    "CHUNK_SIZE",
    "CHUNK_OVERLAP",
    "TOP_K_DOCS",
    "TOP_K_CHUNKS_PER_DOC",
    "MAX_CONTEXT_CHARS",
    "EMBED_MODEL",
    "LLM_MODEL",
    "OPENAI_API_KEY",
    "DOCUMENTS_DIR",
    "INDEX_DIR",
    "logger",
]
