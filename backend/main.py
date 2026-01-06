"""FastAPI wrapper exposing the RAG core via HTTP endpoints.

Run with: uvicorn backend.main:app --reload --port 8000
"""
from __future__ import annotations

from pathlib import Path
from typing import List, Optional
from uuid import uuid4
from datetime import datetime

from fastapi import File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi import FastAPI
from pydantic import BaseModel

from rag import config
from rag.guide_manager import GuideManager


app = FastAPI(title="RAG Backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

guide_manager = GuideManager()
labels_store: dict[str, dict[str, object]] = {}
notebook_store: dict[str, dict[str, object]] = {}


class QueryRequest(BaseModel):
    """Request body for the /query endpoint."""

    question: str
    document_ids: Optional[List[str]] = None
    label_id: Optional[str] = None


class LabelBase(BaseModel):
    name: str
    document_ids: List[str] = []


class Label(LabelBase):
    id: str
    created_at: str


class NotebookEntryBase(BaseModel):
    question: str
    answer: str
    label_id: Optional[str] = None
    document_ids: Optional[List[str]] = None
    sources: Optional[List[dict]] = None


class NotebookEntry(NotebookEntryBase):
    id: str
    created_at: str


class DocumentInfo(BaseModel):
    id: str
    filename: str
    pages: int
    uploaded_at: str
    summary: str
    url: str


class SourceInfo(BaseModel):
    id: int
    filename: str
    pages: List[int]
    url: str
    snippet: Optional[str] = None
    primary_page: Optional[int] = None


class QueryResponse(BaseModel):
    answer: str
    citations: List[dict]
    sources: List[SourceInfo]


@app.post("/upload-guides")
async def upload_guides(files: List[UploadFile] = File(...)) -> dict:
    """Ingest one or more PDF guides into the RAG system."""

    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded.")

    uploaded = []
    for file in files:
        data = await file.read()
        if not data:
            continue
        lower = file.filename.lower()
        if not (lower.endswith(".pdf") or lower.endswith(".docx") or lower.endswith(".txt") or lower.endswith(".md")):
            raise HTTPException(status_code=400, detail="Unsupported file type. Allowed: pdf, docx, txt, md.")
        summary = guide_manager.add_pdf(file.filename, data)
        uploaded.append({"filename": file.filename, "summary": summary})

    if not uploaded:
        raise HTTPException(status_code=400, detail="No valid files provided.")

    return {
        "status": "ok",
        "message": f"Uploaded {len(uploaded)} guides.",
        "guides": uploaded,
    }


@app.get("/documents", response_model=List[DocumentInfo])
async def list_documents() -> List[DocumentInfo]:
    """List all uploaded documents with metadata."""

    documents = []
    for item in guide_manager.list_documents():
        documents.append(
            DocumentInfo(
                id=item["id"],
                filename=item["filename"],
                pages=item["pages"],
                uploaded_at=item["uploaded_at"],
                summary=item["summary"],
                url=f"/documents/{item['filename']}",
            )
        )
    return documents


@app.get("/labels", response_model=List[Label])
async def list_labels() -> List[Label]:
    """List all labels."""

    return [Label(**item) for item in labels_store.values()]


@app.post("/labels", response_model=Label)
async def create_label(payload: LabelBase) -> Label:
    """Create a new label with an optional set of document IDs."""

    label_id = str(uuid4())
    item = {
        "id": label_id,
        "name": payload.name.strip(),
        "document_ids": list(payload.document_ids),
        "created_at": datetime.utcnow().isoformat(),
    }
    labels_store[label_id] = item
    return Label(**item)


@app.put("/labels/{label_id}", response_model=Label)
async def update_label(label_id: str, payload: LabelBase) -> Label:
    """Update label name and document membership."""

    if label_id not in labels_store:
        raise HTTPException(status_code=404, detail="Label not found.")
    item = labels_store[label_id]
    item["name"] = payload.name.strip()
    item["document_ids"] = list(payload.document_ids)
    labels_store[label_id] = item
    return Label(**item)


@app.delete("/labels/{label_id}")
async def delete_label(label_id: str) -> dict:
    """Delete a label."""

    if label_id not in labels_store:
        raise HTTPException(status_code=404, detail="Label not found.")
    labels_store.pop(label_id, None)
    return {"status": "ok"}


@app.get("/notebook", response_model=List[NotebookEntry])
async def list_notebook() -> List[NotebookEntry]:
    """List saved notebook entries."""

    # Return newest first
    entries = sorted(notebook_store.values(), key=lambda x: x["created_at"], reverse=True)
    return [NotebookEntry(**item) for item in entries]


@app.post("/notebook", response_model=NotebookEntry)
async def create_notebook_entry(payload: NotebookEntryBase) -> NotebookEntry:
    """Save a QA pair to the notebook."""

    entry_id = str(uuid4())
    item = {
        "id": entry_id,
        "question": payload.question.strip(),
        "answer": payload.answer.strip(),
        "label_id": payload.label_id,
        "document_ids": payload.document_ids or [],
        "sources": payload.sources or [],
        "created_at": datetime.utcnow().isoformat(),
    }
    notebook_store[entry_id] = item
    return NotebookEntry(**item)


@app.delete("/notebook/{entry_id}")
async def delete_notebook_entry(entry_id: str) -> dict:
    """Delete a notebook entry."""

    if entry_id not in notebook_store:
        raise HTTPException(status_code=404, detail="Notebook entry not found.")
    notebook_store.pop(entry_id, None)
    return {"status": "ok"}


@app.post("/query", response_model=QueryResponse)
async def query(req: QueryRequest) -> QueryResponse:
    """Answer a user question using the loaded guides."""

    question = req.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question must not be empty.")

    document_ids = req.document_ids
    if req.label_id:
        label = labels_store.get(req.label_id)
        if not label:
            raise HTTPException(status_code=404, detail="Label not found.")
        document_ids = label.get("document_ids", [])

    answer, sources, citations = guide_manager.answer_question(question, document_ids=document_ids)
    source_models = []
    for src in sources:
        source_models.append(
            SourceInfo(
                id=int(src.get("id", 0)),
                filename=str(src.get("filename", "")),
                pages=list(src.get("pages", [])),
                url=f"/documents/{src.get('filename', '')}",
                snippet=src.get("snippet"),
                primary_page=src.get("primary_page"),
            )
        )
    return QueryResponse(answer=answer, citations=citations, sources=source_models)


@app.get("/documents/{filename}")
async def get_document(filename: str):
    """Serve a previously uploaded PDF from the documents directory."""

    safe_name = Path(filename).name
    path = config.DOCUMENTS_DIR / safe_name
    if not path.exists():
        raise HTTPException(status_code=404, detail="Document not found.")
    # Force inline display so the browser renders the PDF instead of downloading.
    return FileResponse(
        path,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{safe_name}"'},
    )


@app.delete("/documents/{filename}")
async def delete_document(filename: str) -> dict:
    """Delete a document and remove it from indexes and labels."""

    safe_name = Path(filename).name
    removed = guide_manager.remove_guide(safe_name)
    if not removed:
        raise HTTPException(status_code=404, detail="Document not found.")
    for label in labels_store.values():
        label["document_ids"] = [doc for doc in label.get("document_ids", []) if doc != safe_name]
    return {"status": "ok", "message": f"Deleted {safe_name}"}


@app.get("/documents/{filename}/text")
async def get_document_text(filename: str) -> dict:
    """Return extracted text for non-PDF documents or PDFs as plain text."""

    safe_name = Path(filename).name
    path = config.DOCUMENTS_DIR / safe_name
    if not path.exists():
        raise HTTPException(status_code=404, detail="Document not found.")
    data = path.read_bytes()
    try:
        from rag.chunker import extract_pages_from_bytes
        pages = extract_pages_from_bytes(safe_name, data)
    except ValueError:
        raise HTTPException(status_code=400, detail="Unsupported file type.")
    combined = "\n\n".join(text for _page, text, _stype in pages)
    return {"filename": safe_name, "text": combined}
