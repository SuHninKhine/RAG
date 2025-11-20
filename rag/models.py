"""Data models used throughout the RAG system."""
from __future__ import annotations

from dataclasses import dataclass
from typing import List

import faiss


@dataclass
class Chunk:
    """A single chunk of text extracted from a PDF guide."""

    text: str
    source: str
    page: int
    filepath: str
    chunk_id: int


@dataclass
class Guide:
    """A loaded guide with its FAISS index and associated chunks."""

    filename: str
    filepath: str
    index: faiss.IndexFlatL2
    chunks: List[Chunk]
    summary: str
