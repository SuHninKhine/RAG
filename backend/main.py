from __future__ import annotations

import asyncio
from pathlib import Path
from typing import List, Optional

from fastapi import BackgroundTasks, Depends, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from fastapi import FastAPI
from pydantic import BaseModel

from rag import config
from rag.config import logger
from rag.db import (
    Document,
    DocumentStatus,
    Label,
    NotebookEntry,
    SessionLocal,
    init_db,
)
from rag.guide_manager import GuideManager
from rag.storage import get_document_storage


app = FastAPI(title="RAG Backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ALLOW_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

guide_manager = GuideManager()
doc_storage = get_document_storage()
ingest_lock = asyncio.Lock()


class QueryRequest(BaseModel):
    """Request body for the /query endpoint."""

    question: str
    document_ids: Optional[List[str]] = None
    label_id: Optional[str] = None


class DocumentInfo(BaseModel):
    id: int
    filename: str
    pages: int | None
    uploaded_at: str
    summary: str | None
    status: str
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


class LabelBase(BaseModel):
    name: str
    document_ids: List[int] = []


class LabelModel(LabelBase):
    id: int
    created_at: str


class NotebookEntryBase(BaseModel):
    question: str
    answer: str
    label_id: Optional[int] = None
    document_id: Optional[int] = None
    document_ids: Optional[List[str]] = None
    sources: Optional[List[dict]] = None


class NotebookEntryModel(NotebookEntryBase):
    id: int
    created_at: str


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


async def reconcile_processing(db) -> None:
    """Mark any stuck pending/processing docs as failed on startup."""

    stuck = (
        db.query(Document)
        .filter(Document.status.in_([DocumentStatus.processing, DocumentStatus.pending]))
        .all()
    )
    for doc in stuck:
        doc.status = DocumentStatus.failed
        db.add(doc)
    db.commit()


@app.on_event("startup")
async def on_startup() -> None:
    try:
        await asyncio.wait_for(
            asyncio.to_thread(init_db),
            timeout=config.STARTUP_DB_TIMEOUT_SECONDS,
        )
    except Exception as exc:
        logger.exception("Startup DB init failed or timed out: %s", exc)
    else:
        try:
            with SessionLocal() as db:
                await reconcile_processing(db)
        except Exception as exc:
            logger.exception("Startup reconciliation failed: %s", exc)
    try:
        await asyncio.wait_for(
            guide_manager.load_indexes_on_startup(),
            timeout=config.STARTUP_INDEX_TIMEOUT_SECONDS,
        )
    except Exception as exc:
        logger.exception("Startup index load failed or timed out: %s", exc)


@app.get("/health")
@app.head("/health")
async def health_check() -> dict:
    """Basic health check for load balancers."""

    return {"status": "ok"}


def _validate_upload(file: UploadFile):
    safe_name = Path(file.filename or "").name
    if not safe_name:
        raise HTTPException(status_code=400, detail="Invalid filename.")
    logger.info(
        "Upload received",
        extra={
            "upload_filename": safe_name,
            "content_type": file.content_type,
            "size": getattr(file, "size", None),
        },
    )
    lower = safe_name.lower()
    if not (lower.endswith(".pdf") or lower.endswith(".docx") or lower.endswith(".txt") or lower.endswith(".md")):
        logger.warning(
            "Upload rejected: unsupported file type",
            extra={"upload_filename": safe_name},
        )
        raise HTTPException(status_code=400, detail="Unsupported file type. Allowed: pdf, docx, txt, md.")
    return safe_name


async def _ingest_background(filename: str, data: bytes, file_type: str) -> None:
    """Background ingestion wrapper with status transitions and locking."""

    async with ingest_lock:
        with SessionLocal() as db:
            doc = db.query(Document).filter_by(filename=filename).first()
            if doc:
                doc.status = DocumentStatus.processing
                db.add(doc)
                db.commit()
        await guide_manager.ingest_document(filename, data, file_type)


@app.post("/upload-guides")
async def upload_guides(
    files: List[UploadFile] = File(...),
    background_tasks: BackgroundTasks = None,
    db=Depends(get_db),
) -> dict:
    """Ingest one or more guides into the RAG system asynchronously."""

    if not files:
        logger.warning("Upload rejected: no files provided")
        raise HTTPException(status_code=400, detail="No files uploaded.")

    uploaded = []
    for file in files:
        safe_name = _validate_upload(file)
        data = await file.read()
        if len(data) > config.MAX_UPLOAD_BYTES:
            logger.warning(
                "Upload rejected: file too large",
                extra={
                    "upload_filename": safe_name,
                    "size": len(data),
                    "max_upload_bytes": config.MAX_UPLOAD_BYTES,
                },
            )
            raise HTTPException(status_code=413, detail="File too large.")
        logger.info(
            "Upload payload read",
            extra={"upload_filename": safe_name, "bytes": len(data)},
        )
        if not data:
            logger.warning("Upload skipped: empty file", extra={"upload_filename": safe_name})
            continue
        # create DB row
        doc = Document(
            filename=safe_name,
            file_type=Path(safe_name).suffix.lower().lstrip("."),
            status=DocumentStatus.pending,
            pages=None,
            summary=None,
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)
        # schedule ingestion
        if background_tasks is not None:
            background_tasks.add_task(_ingest_background, safe_name, data, doc.file_type)
        uploaded.append({"filename": safe_name, "summary": None, "status": doc.status.value})

    if not uploaded:
        logger.warning("Upload rejected: no valid files after validation/read")
        raise HTTPException(status_code=400, detail="No valid files provided.")

    return {
        "status": "ok",
        "message": f"Queued {len(uploaded)} guides for ingestion.",
        "guides": uploaded,
    }


@app.get("/documents", response_model=List[DocumentInfo])
async def list_documents(db=Depends(get_db)) -> List[DocumentInfo]:
    """List all uploaded documents with metadata and ingestion status."""

    docs = db.query(Document).order_by(Document.created_at.desc()).all()
    items = []
    for doc in docs:
        items.append(
            DocumentInfo(
                id=doc.id,
                filename=doc.filename,
                pages=doc.pages,
                uploaded_at=doc.created_at.isoformat(),
                summary=doc.summary,
                status=doc.status.value,
                url=f"/documents/{doc.filename}",
            )
        )
    return items


@app.get("/documents/{filename}")
async def get_document(filename: str):
    """Serve a previously uploaded document from storage."""

    safe_name = Path(filename).name
    media_type = "application/pdf" if safe_name.lower().endswith(".pdf") else "application/octet-stream"
    try:
        data = doc_storage.read_bytes(safe_name)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Document not found.")
    return Response(
        content=data,
        media_type=media_type,
        headers={"Content-Disposition": f'inline; filename="{safe_name}"'},
    )


@app.delete("/documents/{filename}")
async def delete_document(filename: str, db=Depends(get_db)) -> dict:
    """Delete a document and all related artifacts."""

    safe_name = Path(filename).name
    doc = db.query(Document).filter_by(filename=safe_name).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")
    # Remove label associations explicitly
    labels = db.query(Label).filter(Label.documents.any(id=doc.id)).all()
    for lbl in labels:
        lbl.documents = [d for d in lbl.documents if d.id != doc.id]
        db.add(lbl)
    # Remove notebook refs
    entries = db.query(NotebookEntry).filter(
        (NotebookEntry.document_id == doc.id) | (NotebookEntry.document_ids != None)
    ).all()
    for entry in entries:
        if entry.document_id == doc.id:
            db.delete(entry)
            continue
        if entry.document_ids:
            entry.document_ids = [d for d in entry.document_ids if d != safe_name]
            db.add(entry)
    db.delete(doc)
    db.commit()
    await guide_manager.delete_document(safe_name)
    return {"status": "ok", "message": f"Deleted {safe_name}"}


@app.get("/documents/{filename}/text")
async def get_document_text(filename: str):
    """Return extracted text for non-PDF documents or PDFs as plain text."""

    safe_name = Path(filename).name
    try:
        data = doc_storage.read_bytes(safe_name)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Document not found.")
    try:
        from rag.chunker import extract_pages_from_bytes

        pages = extract_pages_from_bytes(safe_name, data, max_pages=config.MAX_PDF_PAGES)
    except ValueError:
        raise HTTPException(status_code=400, detail="Unsupported file type.")
    combined = "\n\n".join(text for _page, text, _stype in pages)
    return {"filename": safe_name, "text": combined}


@app.get("/labels", response_model=List[LabelModel])
async def list_labels(db=Depends(get_db)) -> List[LabelModel]:
    """List all labels."""

    labels = db.query(Label).order_by(Label.created_at.desc()).all()
    result = []
    for label in labels:
        result.append(
          LabelModel(
              id=label.id,
              name=label.name,
              document_ids=[doc.id for doc in label.documents],
              created_at=label.created_at.isoformat(),
          )
        )
    return result


@app.post("/labels", response_model=LabelModel)
async def create_label(payload: LabelBase, db=Depends(get_db)) -> LabelModel:
    """Create a new label with an optional set of document IDs."""

    label = Label(name=payload.name.strip())
    if payload.document_ids:
        docs = db.query(Document).filter(Document.id.in_(payload.document_ids)).all()
        label.documents = docs
    db.add(label)
    db.commit()
    db.refresh(label)
    return LabelModel(
        id=label.id,
        name=label.name,
        document_ids=[doc.id for doc in label.documents],
        created_at=label.created_at.isoformat(),
    )


@app.put("/labels/{label_id}", response_model=LabelModel)
async def update_label(label_id: int, payload: LabelBase, db=Depends(get_db)) -> LabelModel:
    """Update label name and document membership."""

    label = db.query(Label).filter_by(id=label_id).first()
    if not label:
        raise HTTPException(status_code=404, detail="Label not found.")
    label.name = payload.name.strip()
    docs = db.query(Document).filter(Document.id.in_(payload.document_ids)).all()
    label.documents = docs
    db.add(label)
    db.commit()
    db.refresh(label)
    return LabelModel(
        id=label.id,
        name=label.name,
        document_ids=[doc.id for doc in label.documents],
        created_at=label.created_at.isoformat(),
    )


@app.delete("/labels/{label_id}")
async def delete_label(label_id: int, db=Depends(get_db)) -> dict:
    """Delete a label."""

    label = db.query(Label).filter_by(id=label_id).first()
    if not label:
        raise HTTPException(status_code=404, detail="Label not found.")
    db.delete(label)
    db.commit()
    return {"status": "ok"}


@app.get("/notebook", response_model=List[NotebookEntryModel])
async def list_notebook(db=Depends(get_db)) -> List[NotebookEntryModel]:
    """List saved notebook entries."""

    entries = db.query(NotebookEntry).order_by(NotebookEntry.created_at.desc()).all()
    result = []
    for entry in entries:
        result.append(
            NotebookEntryModel(
                id=entry.id,
                question=entry.question,
                answer=entry.answer,
                label_id=entry.label_id,
                document_id=entry.document_id,
                document_ids=entry.document_ids,
                sources=entry.sources,
                created_at=entry.created_at.isoformat(),
            )
        )
    return result


@app.post("/notebook", response_model=NotebookEntryModel)
async def create_notebook_entry(payload: NotebookEntryBase, db=Depends(get_db)) -> NotebookEntryModel:
    """Save a QA pair to the notebook."""

    entry = NotebookEntry(
        question=payload.question.strip(),
        answer=payload.answer.strip(),
        label_id=payload.label_id,
        document_id=payload.document_id,
        document_ids=payload.document_ids,
        sources=payload.sources,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return NotebookEntryModel(
        id=entry.id,
        question=entry.question,
        answer=entry.answer,
        label_id=entry.label_id,
        document_id=entry.document_id,
        document_ids=entry.document_ids,
        sources=entry.sources,
        created_at=entry.created_at.isoformat(),
    )


@app.delete("/notebook/{entry_id}")
async def delete_notebook_entry(entry_id: int, db=Depends(get_db)) -> dict:
    """Delete a notebook entry."""

    entry = db.query(NotebookEntry).filter_by(id=entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Notebook entry not found.")
    db.delete(entry)
    db.commit()
    return {"status": "ok"}


@app.post("/query", response_model=QueryResponse)
async def query(req: QueryRequest, db=Depends(get_db)) -> QueryResponse:
    """Answer a user question using the loaded guides."""

    question = req.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question must not be empty.")

    # Resolve documents by label if provided
    document_ids: List[str] = []
    if req.label_id:
        label = db.query(Label).filter_by(id=req.label_id).first()
        if not label:
            raise HTTPException(status_code=404, detail="Label not found.")
        document_ids = [doc.filename for doc in label.documents if doc.status == DocumentStatus.ready]
    elif req.document_ids:
        docs = (
            db.query(Document)
            .filter(Document.filename.in_(req.document_ids), Document.status == DocumentStatus.ready)
            .all()
        )
        document_ids = [doc.filename for doc in docs][: config.MAX_DOCS_PER_QUERY]
    else:
        # auto-route over ready docs; already handled in guide_manager
        document_ids = None

    # Ensure selected docs are loaded and ready
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
