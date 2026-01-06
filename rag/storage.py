"""Storage abstractions for documents and FAISS indexes."""
from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

import faiss

from . import config


class DocumentStorage:
    """Abstraction for storing and deleting raw documents."""

    def save(self, filename: str, data: bytes) -> Path:
        raise NotImplementedError

    def delete(self, filename: str) -> None:
        raise NotImplementedError

    def path_for(self, filename: str) -> Path:
        raise NotImplementedError


class LocalDocumentStorage(DocumentStorage):
    def __init__(self, base_dir: Path) -> None:
        self.base_dir = base_dir
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def save(self, filename: str, data: bytes) -> Path:
        path = self.base_dir / filename
        path.write_bytes(data)
        return path

    def delete(self, filename: str) -> None:
        path = self.base_dir / filename
        if path.exists():
            path.unlink()

    def path_for(self, filename: str) -> Path:
        return self.base_dir / filename


class IndexStorage:
    """Abstraction for saving/loading FAISS indexes."""

    def save(self, filename: str, index: faiss.Index) -> Path:
        raise NotImplementedError

    def load(self, filename: str) -> Optional[faiss.Index]:
        raise NotImplementedError

    def delete(self, filename: str) -> None:
        raise NotImplementedError

    def path_for(self, filename: str) -> Path:
        raise NotImplementedError


class LocalIndexStorage(IndexStorage):
    def __init__(self, base_dir: Path) -> None:
        self.base_dir = base_dir
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def _path(self, filename: str) -> Path:
        return self.base_dir / filename

    def save(self, filename: str, index: faiss.Index) -> Path:
        path = self._path(filename)
        faiss.write_index(index, str(path))
        return path

    def load(self, filename: str) -> Optional[faiss.Index]:
        path = self._path(filename)
        if not path.exists():
            return None
        return faiss.read_index(str(path))

    def delete(self, filename: str) -> None:
        path = self._path(filename)
        if path.exists():
            path.unlink()

    def path_for(self, filename: str) -> Path:
        return self._path(filename)


# Factories (prepare for future backends)
def get_document_storage() -> DocumentStorage:
    return LocalDocumentStorage(config.DOCUMENTS_DIR)


def get_index_storage() -> IndexStorage:
    return LocalIndexStorage(config.INDEX_DIR)


__all__ = [
    "DocumentStorage",
    "LocalDocumentStorage",
    "IndexStorage",
    "LocalIndexStorage",
    "get_document_storage",
    "get_index_storage",
]
