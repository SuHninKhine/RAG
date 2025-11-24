"""Guide manager orchestrating ingestion, retrieval, and QA."""
from __future__ import annotations

from collections import defaultdict
from dataclasses import replace
from pathlib import Path
from typing import Dict, List, Tuple

import faiss
import numpy as np

from . import config
from .chunker import chunk_text, extract_pages_from_pdf_bytes
from .embeddings import embed_texts
from .llm import call_llm
from .models import Chunk, Guide


class GuideManager:
    """Load PDF guides, build indexes, and answer questions."""

    def __init__(self) -> None:
        self.guides: Dict[str, Guide] = {}
        self.root_index: faiss.IndexFlatL2 | None = None
        self.root_index_items: List[str] = []

    def add_pdf(self, filename: str, data: bytes) -> str:
        """Ingest a PDF, build its chunk index, and register the guide.

        Args:
            filename: Name to assign to the PDF on disk.
            data: Raw PDF bytes.

        Returns:
            A lightweight summary derived from the guide's content.
        """

        path = Path(config.DOCUMENTS_DIR, filename)
        path.write_bytes(data)

        pages = extract_pages_from_pdf_bytes(data)
        chunks = chunk_text(pages)
        if not chunks:
            raise ValueError(f"No extractable text found in {filename}")

        for chunk in chunks:
            chunk.source = filename
            chunk.filepath = str(path)

        embeddings = embed_texts([c.text for c in chunks])
        if embeddings.size == 0:
            raise ValueError("Embedding service returned an empty matrix for chunks.")

        index = faiss.IndexFlatL2(embeddings.shape[1])
        index.add(embeddings)

        combined_text = "\n".join(c.text for c in chunks)
        summary = combined_text[:400]

        guide = Guide(
            filename=filename,
            filepath=str(path),
            index=index,
            chunks=chunks,
            summary=summary,
        )
        self.guides[filename] = guide
        self.build_root_index()
        return summary

    def build_root_index(self) -> None:
        """Build a top-level FAISS index over guide summaries for routing."""

        if not self.guides:
            self.root_index = None
            self.root_index_items = []
            return

        summaries = [guide.summary for guide in self.guides.values()]
        summary_vectors = embed_texts(summaries)
        if summary_vectors.size == 0:
            self.root_index = None
            self.root_index_items = []
            return

        self.root_index = faiss.IndexFlatL2(summary_vectors.shape[1])
        self.root_index.add(summary_vectors)
        self.root_index_items = [guide.filename for guide in self.guides.values()]

    def route_query(self, question: str) -> List[Tuple[Guide, float]]:
        """Select the most relevant guides for a question."""

        if len(self.guides) == 1:
            # Short-circuit routing when only one guide is loaded.
            guide = next(iter(self.guides.values()))
            return [(guide, 0.0)]

        if not self.root_index or self.root_index.ntotal == 0:
            return []

        query_vec = embed_texts([question]).astype("float32")
        distances, indices = self.root_index.search(
            query_vec, min(config.TOP_K_DOCS, self.root_index.ntotal)
        )

        routed: List[Tuple[Guide, float]] = []
        for dist, idx in zip(distances[0], indices[0]):
            if idx == -1:
                continue
            filename = self.root_index_items[idx]
            routed.append((self.guides[filename], float(dist)))
        return routed

    def retrieve_chunks(
        self, filename: str, question: str
    ) -> List[Tuple[Chunk, float]]:
        """Pull the most relevant chunks from a specific guide."""

        guide = self.guides[filename]
        if guide.index.ntotal == 0:
            return []

        query_vec = embed_texts([question]).astype("float32")
        distances, indices = guide.index.search(
            query_vec,
            min(config.TOP_K_CHUNKS_PER_DOC, guide.index.ntotal),
        )

        scored = []
        for dist, idx in zip(distances[0], indices[0]):
            if idx == -1:
                continue
            scored.append((guide.chunks[idx], float(dist)))

        return self._rerank_chunks(scored)

    def answer_question(self, question: str) -> Tuple[str, List[Dict[str, object]]]:
        """Answer a user question using the routed guides and chunk retrieval."""

        routed_guides = self.route_query(question)
        if not routed_guides:
            return "I don't know", []

        all_scored: List[Tuple[Chunk, float]] = []
        for guide, _distance in routed_guides:
            all_scored.extend(self.retrieve_chunks(guide.filename, question))

        all_scored.sort(key=lambda item: item[1])

        context_parts = [chunk.text for chunk, _ in all_scored]
        merged_context = "\n\n---\n\n".join(context_parts)

        # Treat each retrieved chunk as its own source to make citations granular
        # and label context sections with the same ids shown to the LLM.
        source_entries: List[Dict[str, object]] = []
        seen_chunks: set[int] = set()
        for chunk, _ in all_scored:
            if chunk.chunk_id in seen_chunks:
                continue
            seen_chunks.add(chunk.chunk_id)
            source_entries.append(
                {
                    "id": len(source_entries) + 1,
                    "chunk": chunk,
                    "filename": chunk.source,
                    "pages": [chunk.page],
                    "filepath": chunk.filepath,
                    "snippet": chunk.text.replace("\n", " ").strip()[:200],
                    "primary_page": chunk.page,
                }
            )

        # Build labeled context so inline citations map to the right chunk ids.
        if source_entries:
            labeled_parts = [f"[{entry['id']}] {entry['chunk'].text}" for entry in source_entries]
            merged_context = "\n\n---\n\n".join(labeled_parts)
            lines = []
            for entry in source_entries:
                pages_str = ", ".join(str(p) for p in entry["pages"])
                lines.append(f"[{entry['id']}] {entry['filename']} (pages: {pages_str})")
            sources_index = "SOURCE INDEX:\n" + "\n".join(lines)
            merged_context = merged_context + "\n\n" + sources_index

        # Strip chunk objects for the response payload.
        source_list = [
            {
                "id": entry["id"],
                "filename": entry["filename"],
                "pages": entry["pages"],
                "filepath": entry["filepath"],
                "snippet": entry["snippet"],
                "primary_page": entry["primary_page"],
            }
            for entry in source_entries
        ]

        answer = call_llm(merged_context, question)

        return answer, source_list

    def _rerank_chunks(self, scored: List[Tuple[Chunk, float]]) -> List[Tuple[Chunk, float]]:
        """Hook for future reranking; currently preserves FAISS order."""

        return scored

    def persist_indexes(self) -> None:
        """Placeholder for index persistence; currently a no-op."""

        config.logger.debug("Index persistence not enabled; skipping save.")
