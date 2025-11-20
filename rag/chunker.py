"""Utilities for turning PDF bytes into ordered text chunks."""
from __future__ import annotations

import io
from typing import List, Tuple

import PyPDF2
from langchain_text_splitters import RecursiveCharacterTextSplitter

from . import config
from .models import Chunk


def extract_pages_from_pdf_bytes(data: bytes) -> List[Tuple[int, str]]:
    """Extract page-wise text from PDF bytes.

    Args:
        data: Raw PDF bytes.

    Returns:
        List of (page_number, text) pairs preserving document order.
    """

    reader = PyPDF2.PdfReader(io.BytesIO(data))
    pages: List[Tuple[int, str]] = []
    for idx, page in enumerate(reader.pages, start=1):
        text = page.extract_text() or ""
        pages.append((idx, text))
    return pages


def chunk_text(pages: List[Tuple[int, str]]) -> List[Chunk]:
    """Split pages into overlapping character chunks.

    Args:
        pages: Sequence of (page_number, text) tuples.

    Returns:
        Ordered list of Chunk objects with sequential chunk_id values.
    """

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=config.CHUNK_SIZE, chunk_overlap=config.CHUNK_OVERLAP
    )
    chunks: List[Chunk] = []
    chunk_id = 0

    for page_number, text in pages:
        if not text.strip():
            continue
        for piece in splitter.split_text(text):
            chunks.append(
                Chunk(
                    text=piece,
                    source="",
                    page=page_number,
                    filepath="",
                    chunk_id=chunk_id,
                )
            )
            chunk_id += 1

    return chunks
