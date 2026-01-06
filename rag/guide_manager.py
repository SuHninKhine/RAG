"""Guide manager orchestrating ingestion, retrieval, and QA."""
from __future__ import annotations

from __future__ import annotations

"""Guide manager orchestrating ingestion, retrieval, and QA with persistence."""

import asyncio
import json
from dataclasses import replace
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import faiss
import numpy as np

from . import config
from .chunker import chunk_text, extract_pages_from_bytes
from .db import Document, DocumentStatus, SessionLocal
from .embeddings import embed_texts
from .llm import call_llm
from .models import Chunk, Guide
from .storage import get_document_storage, get_index_storage


class GuideManager:
    """Load guides, build indexes, and answer questions.

    This manager now:
    - Persists guides/indices across restarts.
    - Uses async locks to guard mutations.
    - Treats DB as source of truth for document metadata/status.
    """

    def __init__(self) -> None:
        self.guides: Dict[str, Guide] = {}
        self.root_index: faiss.IndexFlatL2 | None = None
        self.root_index_items: List[str] = []
        self.doc_storage = get_document_storage()
        self.index_storage = get_index_storage()
        self._lock = asyncio.Lock()

    async def load_indexes_on_startup(self) -> None:
        """Load all ready documents and indexes from storage on startup."""

        from .db import SessionLocal  # local import to avoid circular at import time

        async with self._lock:
            self.guides.clear()
            self.root_index = None
            self.root_index_items = []
            with SessionLocal() as session:
                ready_docs = (
                    session.query(Document)
                    .filter(Document.status == DocumentStatus.ready)
                    .order_by(Document.id.asc())
                    .all()
                )
                for doc in ready_docs:
                    index = self.index_storage.load(f"{doc.filename}.faiss")
                    if not index:
                        # Index missing; mark as failed for safety.
                        doc.status = DocumentStatus.failed
                        session.add(doc)
                        continue
                    # Load chunks metadata
                    meta_path = self.index_storage.path_for(f"{doc.filename}.meta.json")
                    if not meta_path.exists():
                        doc.status = DocumentStatus.failed
                        session.add(doc)
                        continue
                    meta = json.loads(meta_path.read_text())
                    chunks = [
                        Chunk(
                            text=item["text"],
                            source=item["source"],
                            page=item["page"],
                            filepath=item["filepath"],
                            chunk_id=item["chunk_id"],
                        )
                        for item in meta.get("chunks", [])
                    ]
                    guide = Guide(
                        filename=doc.filename,
                        filepath=str(self.doc_storage.path_for(doc.filename)),
                        index=index,
                        chunks=chunks,
                        summary=doc.summary or "",
                        uploaded_at=doc.created_at,
                        pages=doc.pages or 0,
                    )
                    self.guides[doc.filename] = guide
                session.commit()
            # Rebuild root index from loaded guides
            self._build_root_index_locked()

    def _build_root_index_locked(self) -> None:
        """Build root index; caller must hold lock."""

        if not self.guides:
            self.root_index = None
            self.root_index_items = []
            return
        summaries = [g.summary for g in self.guides.values()]
        summary_vectors = embed_texts(summaries)
        if summary_vectors.size == 0:
            self.root_index = None
            self.root_index_items = []
            return
        self.root_index = faiss.IndexFlatL2(summary_vectors.shape[1])
        self.root_index.add(summary_vectors)
        self.root_index_items = [guide.filename for guide in self.guides.values()]

    async def ingest_document(self, filename: str, data: bytes, file_type: str) -> None:
        """Run ingestion in background: extract -> chunk -> embed -> index -> persist."""

        async with self._lock:
            path = self.doc_storage.save(filename, data)
        try:
            pages_with_type = extract_pages_from_bytes(filename, data, max_pages=config.MAX_PDF_PAGES)
            pages = [(page, text) for page, text, _stype in pages_with_type]
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

            # Persist index and metadata atomically
            tmp_index_name = f"{filename}.faiss.tmp"
            final_index_name = f"{filename}.faiss"
            tmp_meta = self.index_storage.path_for(f"{filename}.meta.json.tmp")
            final_meta = self.index_storage.path_for(f"{filename}.meta.json")
            faiss.write_index(index, str(self.index_storage.path_for(tmp_index_name)))
            tmp_meta.write_text(
                json.dumps(
                    {
                        "filename": filename,
                        "chunks": [
                            {
                                "text": c.text,
                                "source": c.source,
                                "page": c.page,
                                "filepath": c.filepath,
                                "chunk_id": c.chunk_id,
                            }
                            for c in chunks
                        ],
                        "summary": summary,
                        "pages": len(pages),
                        "file_type": file_type,
                    }
                )
            )
            # Atomic rename
            self.index_storage.path_for(tmp_index_name).rename(self.index_storage.path_for(final_index_name))
            tmp_meta.rename(final_meta)

            with SessionLocal() as session:
                doc = session.query(Document).filter_by(filename=filename).first()
                if doc:
                    doc.status = DocumentStatus.ready
                    doc.pages = len(pages)
                    doc.summary = summary
                    doc.file_type = file_type
                    session.add(doc)
                    session.commit()

            async with self._lock:
                guide = Guide(
                    filename=filename,
                    filepath=str(path),
                    index=index,
                    chunks=chunks,
                    summary=summary,
                    uploaded_at=datetime.now(),
                    pages=len(pages),
                )
                self.guides[filename] = guide
                self._build_root_index_locked()
        except Exception as exc:
            config.logger.exception("Ingestion failed for %s: %s", filename, exc)
            with SessionLocal() as session:
                doc = session.query(Document).filter_by(filename=filename).first()
                if doc:
                    doc.status = DocumentStatus.failed
                    session.add(doc)
                    session.commit()
            # Cleanup partial files
            async with self._lock:
                self.doc_storage.delete(filename)
                self.index_storage.delete(f"{filename}.faiss")
                meta_path = self.index_storage.path_for(f"{filename}.meta.json")
                if meta_path.exists():
                    meta_path.unlink()
                self.guides.pop(filename, None)
                self._build_root_index_locked()

    def route_query(self, question: str) -> List[Tuple[Guide, float]]:
        """Select the most relevant guides for a question."""

        if len(self.guides) == 1:
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

    def retrieve_chunks(self, filename: str, question: str) -> List[Tuple[Chunk, float]]:
        """Pull the most relevant chunks from a specific guide."""

        guide = self.guides.get(filename)
        if not guide or guide.index.ntotal == 0:
            return []
        query_vec = embed_texts([question]).astype("float32")
        distances, indices = guide.index.search(
            query_vec, min(config.TOP_K_CHUNKS_PER_DOC, guide.index.ntotal)
        )
        scored = []
        for dist, idx in zip(distances[0], indices[0]):
            if idx == -1:
                continue
            scored.append((guide.chunks[idx], float(dist)))
        return self._rerank_chunks(scored)

    def answer_question(
        self, question: str, document_ids: Optional[List[str]] = None
    ) -> Tuple[str, List[Dict[str, object]], List[Dict[str, object]]]:
        """Answer a user question using the routed guides and chunk retrieval."""

        guides_to_query: List[Guide] = []
        if document_ids:
            # Respect limit
            if len(document_ids) > config.MAX_DOCS_PER_QUERY:
                document_ids = document_ids[: config.MAX_DOCS_PER_QUERY]
            for doc_id in document_ids:
                guide = self.guides.get(doc_id)
                if guide:
                    guides_to_query.append(guide)
        else:
            routed_guides = self.route_query(question)
            guides_to_query = [guide for guide, _distance in routed_guides]

        if not guides_to_query:
            return "I don't know.", [], []

        all_scored: List[Tuple[Chunk, float]] = []
        for guide in guides_to_query:
            all_scored.extend(self.retrieve_chunks(guide.filename, question))

        all_scored.sort(key=lambda item: item[1])

        context_parts = [chunk.text for chunk, _ in all_scored]
        merged_context = "\n\n---\n\n".join(context_parts)

        source_entries: List[Dict[str, object]] = []
        seen_chunks: set[tuple[str, int]] = set()
        for chunk, _ in all_scored:
            chunk_key = (chunk.source, chunk.chunk_id)
            if chunk_key in seen_chunks:
                continue
            seen_chunks.add(chunk_key)
            is_pdf = str(chunk.source).lower().endswith(".pdf")
            source_entries.append(
                {
                    "id": len(source_entries) + 1,
                    "chunk": chunk,
                    "filename": chunk.source,
                    "pages": [chunk.page] if is_pdf and chunk.page else [],
                    "filepath": chunk.filepath,
                    "snippet": chunk.text.replace("\n", " ").strip()[:200],
                    "primary_page": chunk.page if is_pdf else None,
                }
            )

        if source_entries:
            labeled_parts = [f"[{entry['id']}] {entry['chunk'].text}" for entry in source_entries]
            merged_context = "\n\n---\n\n".join(labeled_parts)
            lines = []
            for entry in source_entries:
                pages_str = ", ".join(str(p) for p in entry["pages"])
                lines.append(f"[{entry['id']}] {entry['filename']} (pages: {pages_str})")
            sources_index = "SOURCE INDEX:\n" + "\n".join(lines)
            merged_context = merged_context + "\n\n" + sources_index

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

        raw_answer = call_llm(merged_context, question)
        if raw_answer.strip() == "I don't know.":
            return "I don't know.", source_list, []

        answer_text = ""
        citations: List[Dict[str, object]] = []
        try:
            parsed = json.loads(raw_answer)
            answer_text = str(parsed.get("answer", "")).strip()
            citations_raw = parsed.get("citations") or []
            valid_ids = {entry["id"] for entry in source_entries}
            for item in citations_raw:
                try:
                    sentence_index = int(item.get("sentence_index"))
                    source_ids = [int(sid) for sid in item.get("source_ids", []) if int(sid) in valid_ids]
                    if source_ids:
                        citations.append({"sentence_index": sentence_index, "source_ids": source_ids})
                except Exception:
                    continue
        except Exception:
            answer_text = raw_answer.strip()

        return answer_text, source_list, citations

    def _rerank_chunks(self, scored: List[Tuple[Chunk, float]]) -> List[Tuple[Chunk, float]]:
        """Hook for future reranking; currently preserves FAISS order."""

        if config.SIMILARITY_THRESHOLD > 0:
            scored = [item for item in scored if item[1] <= config.SIMILARITY_THRESHOLD]
        return scored

    async def delete_document(self, filename: str) -> bool:
        """Delete document, indexes, and rebuild root index."""

        async with self._lock:
            self.guides.pop(filename, None)
            self.doc_storage.delete(filename)
            self.index_storage.delete(f"{filename}.faiss")
            meta_path = self.index_storage.path_for(f"{filename}.meta.json")
            if meta_path.exists():
                meta_path.unlink()
            self._build_root_index_locked()
        return True
