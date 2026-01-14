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


# Storage backend selection
STORAGE_BACKEND: Literal["local", "supabase"] = os.getenv("STORAGE_BACKEND", "supabase")

# Paths (local temp only when using supabase storage)
BASE_DIR = Path(__file__).resolve().parent
DEFAULT_DATA_DIR = "/tmp/rag" if STORAGE_BACKEND == "supabase" else str(BASE_DIR)
DATA_DIR = Path(os.getenv("RAG_DATA_DIR", DEFAULT_DATA_DIR))
DOCUMENTS_DIR = DATA_DIR / "documents"
INDEX_DIR = DATA_DIR / "indexes"
DB_PATH = DATA_DIR / "rag.db"

DOCUMENTS_DIR.mkdir(parents=True, exist_ok=True)
INDEX_DIR.mkdir(parents=True, exist_ok=True)

# Database
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DB_PATH}")

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

# CORS
_cors_env = os.getenv("CORS_ALLOW_ORIGINS", "*")
CORS_ALLOW_ORIGINS = ["*"] if _cors_env.strip() == "*" else [o.strip() for o in _cors_env.split(",") if o.strip()]

# Supabase storage config (required when STORAGE_BACKEND=supabase)
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
SUPABASE_DOCS_BUCKET = os.getenv("SUPABASE_DOCS_BUCKET")
SUPABASE_INDEX_BUCKET = os.getenv("SUPABASE_INDEX_BUCKET")
if STORAGE_BACKEND == "supabase":
    if not SUPABASE_URL:
        raise RuntimeError("SUPABASE_URL environment variable must be set when using supabase storage.")
    if not SUPABASE_SERVICE_ROLE_KEY:
        raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY environment variable must be set when using supabase storage.")
    if not SUPABASE_DOCS_BUCKET:
        raise RuntimeError("SUPABASE_DOCS_BUCKET environment variable must be set when using supabase storage.")
    if not SUPABASE_INDEX_BUCKET:
        raise RuntimeError("SUPABASE_INDEX_BUCKET environment variable must be set when using supabase storage.")

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
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_DOCS_BUCKET",
    "SUPABASE_INDEX_BUCKET",
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
    "CORS_ALLOW_ORIGINS",
    "OPENAI_API_KEY",
    "logger",
]
