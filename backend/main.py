"""FastAPI wrapper exposing the RAG core via HTTP endpoints.

Run with: uvicorn backend.main:app --reload --port 8000
"""
from __future__ import annotations

from pathlib import Path
from typing import List, Optional

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


class QueryRequest(BaseModel):
    """Request body for the /query endpoint."""

    question: str


class SourceInfo(BaseModel):
    id: int
    filename: str
    pages: List[int]
    url: str
    snippet: Optional[str] = None
    primary_page: Optional[int] = None


class QueryResponse(BaseModel):
    answer: str
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
        summary = guide_manager.add_pdf(file.filename, data)
        uploaded.append({"filename": file.filename, "summary": summary})

    if not uploaded:
        raise HTTPException(status_code=400, detail="No valid files provided.")

    return {
        "status": "ok",
        "message": f"Uploaded {len(uploaded)} guides.",
        "guides": uploaded,
    }


@app.post("/query", response_model=QueryResponse)
async def query(req: QueryRequest) -> QueryResponse:
    """Answer a user question using the loaded guides."""

    question = req.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question must not be empty.")

    answer, sources = guide_manager.answer_question(question)
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
    return QueryResponse(answer=answer, sources=source_models)


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
