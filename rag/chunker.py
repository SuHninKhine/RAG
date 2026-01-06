"""Utilities for turning PDF bytes into ordered text chunks."""
from __future__ import annotations

import io
from typing import List, Tuple, Optional

import PyPDF2
import docx
from langchain_text_splitters import RecursiveCharacterTextSplitter

from . import config
from .models import Chunk


def _extract_pdf(data: bytes, max_pages: int) -> List[Tuple[Optional[int], str]]:
    reader = PyPDF2.PdfReader(io.BytesIO(data))
    if len(reader.pages) > max_pages:
        raise ValueError(f"PDF has too many pages ({len(reader.pages)} > {max_pages}).")
    pages: List[Tuple[Optional[int], str]] = []
    for idx, page in enumerate(reader.pages, start=1):
        text = page.extract_text() or ""
        pages.append((idx, text))
    return pages


def _extract_docx(data: bytes) -> List[Tuple[Optional[int], str]]:
    document = docx.Document(io.BytesIO(data))
    text = "\n".join(p.text for p in document.paragraphs if p.text)
    return [(1, text)]


def _extract_text(data: bytes) -> List[Tuple[Optional[int], str]]:
    text = data.decode("utf-8", errors="replace")
    return [(1, text)]


def extract_pages_from_bytes(
    filename: str, data: bytes, max_pages: Optional[int] = None
) -> List[Tuple[Optional[int], str, str]]:
    """Extract text with page info and source type based on file extension."""

    lower = filename.lower()
    if lower.endswith(".pdf"):
        pages = _extract_pdf(data, max_pages or config.MAX_PDF_PAGES)
        source_type = "pdf"
    elif lower.endswith(".docx"):
        pages = _extract_docx(data)
        source_type = "docx"
    elif lower.endswith(".txt"):
        pages = _extract_text(data)
        source_type = "txt"
    elif lower.endswith(".md"):
        pages = _extract_text(data)
        source_type = "md"
    else:
        raise ValueError("Unsupported file type.")

    return [(page, text, source_type) for page, text in pages]


def chunk_text(pages: List[Tuple[Optional[int], str]]) -> List[Chunk]:
    """Split pages into overlapping character chunks."""

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
                    page=page_number if page_number is not None else 1,
                    filepath="",
                    chunk_id=chunk_id,
                )
            )
            chunk_id += 1

    return chunks
