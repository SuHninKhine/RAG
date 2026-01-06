"""Database setup and models for persistence (SQLite by default, swappable via DATABASE_URL)."""
from __future__ import annotations

import enum
from datetime import datetime
from typing import List, Optional

from sqlalchemy import (
    JSON,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Table,
    Text,
    create_engine,
)
from sqlalchemy.orm import declarative_base, relationship, sessionmaker

from . import config


engine = create_engine(config.DATABASE_URL, connect_args={"check_same_thread": False} if "sqlite" in config.DATABASE_URL else {})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class DocumentStatus(str, enum.Enum):
    pending = "pending"
    processing = "processing"
    ready = "ready"
    failed = "failed"


label_documents = Table(
    "label_documents",
    Base.metadata,
    Column("label_id", Integer, ForeignKey("labels.id", ondelete="CASCADE"), primary_key=True),
    Column("document_id", Integer, ForeignKey("documents.id", ondelete="CASCADE"), primary_key=True),
)


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, unique=True, nullable=False)
    file_type = Column(String, nullable=False)
    pages = Column(Integer, nullable=True)
    status = Column(Enum(DocumentStatus), default=DocumentStatus.pending, nullable=False)
    summary = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    labels = relationship("Label", secondary=label_documents, back_populates="documents")
    notebook_entries = relationship("NotebookEntry", back_populates="document", cascade="all, delete")


class Label(Base):
    __tablename__ = "labels"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    documents = relationship("Document", secondary=label_documents, back_populates="labels")


class NotebookEntry(Base):
    __tablename__ = "notebook_entries"

    id = Column(Integer, primary_key=True, index=True)
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    label_id = Column(Integer, ForeignKey("labels.id"), nullable=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=True)
    document_ids = Column(JSON, nullable=True)
    sources = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    label = relationship("Label", foreign_keys=[label_id])
    document = relationship("Document", foreign_keys=[document_id])


def init_db() -> None:
    """Create tables if they don't exist."""

    Base.metadata.create_all(bind=engine)


__all__ = [
    "SessionLocal",
    "Base",
    "Document",
    "Label",
    "NotebookEntry",
    "DocumentStatus",
    "init_db",
]
