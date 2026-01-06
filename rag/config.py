"""Configuration and logging for the RAG backend.

All tunables are centralized here and pull from environment variables with sensible
local defaults so swapping SQLite -> Postgres or local FS -> cloud storage is simple.
"""
from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Literal


def _env(name: str, default: str | None = None) -> str:
    val = os.getenv(name, default)
    if val is None:
        raise RuntimeError(f"{name} environment variable must be set.")
    return val


# Paths
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = Path(os.getenv("RAG_DATA_DIR", BASE_DIR))
DOCUMENTS_DIR = DATA_DIR / "documents"
INDEX_DIR = DATA_DIR / "indexes"
DB_PATH = DATA_DIR / "rag.db"

DOCUMENTS_DIR.mkdir(parents=True, exist_ok=True)
INDEX_DIR.mkdir(parents=True, exist_ok=True)

# Database
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DB_PATH}")

# Storage backend (placeholder for future swaps, currently only "local")
STORAGE_BACKEND: Literal["local"] = os.getenv("STORAGE_BACKEND", "local")  # noqa: ARG001

# Chunking / retrieval
CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", "800"))
CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", "100"))
TOP_K_DOCS = int(os.getenv("TOP_K_DOCS", "2"))
TOP_K_CHUNKS_PER_DOC = int(os.getenv("TOP_K_CHUNKS_PER_DOC", "12"))
MAX_CONTEXT_CHARS = int(os.getenv("MAX_CONTEXT_CHARS", "20000"))
SIMILARITY_THRESHOLD = float(os.getenv("SIMILARITY_THRESHOLD", "0.0"))  # 0 disables thresholding

# Models
EMBED_MODEL = os.getenv("EMBED_MODEL", "text-embedding-3-small")
LLM_MODEL = os.getenv("LLM_MODEL", "gpt-4o-mini")

# Limits / validation
MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", str(20 * 1024 * 1024)))  # 20 MB
MAX_PDF_PAGES = int(os.getenv("MAX_PDF_PAGES", "500"))
MAX_DOCS_PER_QUERY = int(os.getenv("MAX_DOCS_PER_QUERY", "5"))

# Keys
OPENAI_API_KEY = _env("OPENAI_API_KEY", os.getenv("OPENAI_API_KEY"))

# Logging
logger = logging.getLogger("rag")
if not logger.handlers:
    logger.setLevel(logging.INFO)
    handler = logging.StreamHandler()
    formatter = logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s")
    handler.setFormatter(formatter)
    logger.addHandler(handler)


__all__ = [
    "BASE_DIR",
    "DATA_DIR",
    "DOCUMENTS_DIR",
    "INDEX_DIR",
    "DB_PATH",
    "DATABASE_URL",
    "STORAGE_BACKEND",
    "CHUNK_SIZE",
    "CHUNK_OVERLAP",
    "TOP_K_DOCS",
    "TOP_K_CHUNKS_PER_DOC",
    "MAX_CONTEXT_CHARS",
    "SIMILARITY_THRESHOLD",
    "EMBED_MODEL",
    "LLM_MODEL",
    "MAX_UPLOAD_BYTES",
    "MAX_PDF_PAGES",
    "MAX_DOCS_PER_QUERY",
    "OPENAI_API_KEY",
    "logger",
]
