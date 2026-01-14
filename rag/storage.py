"""Storage abstractions for documents and FAISS indexes."""
from __future__ import annotations

import json
import tempfile
import urllib.error
import urllib.request
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

    def read_bytes(self, filename: str) -> bytes:
        raise NotImplementedError

    def exists(self, filename: str) -> bool:
        raise NotImplementedError


class LocalDocumentStorage(DocumentStorage):
    def __init__(self, base_dir: Path) -> None:
        self.base_dir = base_dir
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def save(self, filename: str, data: bytes) -> Path:
        safe_name = Path(filename).name
        path = self.base_dir / safe_name
        path.write_bytes(data)
        return path

    def delete(self, filename: str) -> None:
        path = self.base_dir / Path(filename).name
        if path.exists():
            path.unlink()

    def path_for(self, filename: str) -> Path:
        return self.base_dir / Path(filename).name

    def read_bytes(self, filename: str) -> bytes:
        path = self.path_for(filename)
        return path.read_bytes()

    def exists(self, filename: str) -> bool:
        return self.path_for(filename).exists()


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

    def write_text(self, filename: str, text: str) -> None:
        raise NotImplementedError

    def read_text(self, filename: str) -> Optional[str]:
        raise NotImplementedError

    def exists(self, filename: str) -> bool:
        raise NotImplementedError

    def move(self, src: str, dst: str) -> None:
        raise NotImplementedError


class LocalIndexStorage(IndexStorage):
    def __init__(self, base_dir: Path) -> None:
        self.base_dir = base_dir
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def _path(self, filename: str) -> Path:
        return self.base_dir / Path(filename).name

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

    def write_text(self, filename: str, text: str) -> None:
        self._path(filename).write_text(text, encoding="utf-8")

    def read_text(self, filename: str) -> Optional[str]:
        path = self._path(filename)
        if not path.exists():
            return None
        return path.read_text(encoding="utf-8")

    def exists(self, filename: str) -> bool:
        return self._path(filename).exists()

    def move(self, src: str, dst: str) -> None:
        dst_path = self._path(dst)
        if dst_path.exists():
            dst_path.unlink()
        self._path(src).rename(dst_path)


class _SupabaseStorageClient:
    def __init__(self, base_url: str, api_key: str, bucket: str) -> None:
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.bucket = bucket

    def _headers(self, content_type: Optional[str] = None) -> dict[str, str]:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "apikey": self.api_key,
        }
        if content_type:
            headers["Content-Type"] = content_type
        return headers

    def _object_url(self, key: str) -> str:
        return f"{self.base_url}/storage/v1/object/{self.bucket}/{key}"

    def _request(self, method: str, url: str, data: Optional[bytes] = None, content_type: Optional[str] = None) -> bytes:
        req = urllib.request.Request(url, data=data, method=method, headers=self._headers(content_type))
        try:
            with urllib.request.urlopen(req) as resp:
                return resp.read()
        except urllib.error.HTTPError as exc:
            if exc.code == 404:
                raise FileNotFoundError(url) from exc
            raise

    def upload_bytes(self, key: str, data: bytes, content_type: str = "application/octet-stream") -> None:
        self._request("PUT", self._object_url(key), data=data, content_type=content_type)

    def download_bytes(self, key: str) -> bytes:
        return self._request("GET", self._object_url(key))

    def delete(self, key: str) -> None:
        try:
            self._request("DELETE", self._object_url(key))
        except FileNotFoundError:
            return

    def exists(self, key: str) -> bool:
        url = self._object_url(key)
        req = urllib.request.Request(url, method="HEAD", headers=self._headers())
        try:
            with urllib.request.urlopen(req):
                return True
        except urllib.error.HTTPError as exc:
            if exc.code == 404:
                return False
            return False

    def move(self, src: str, dst: str) -> None:
        url = f"{self.base_url}/storage/v1/object/move"
        payload = json.dumps(
            {"bucketId": self.bucket, "sourceKey": src, "destinationKey": dst}
        ).encode("utf-8")
        self._request("POST", url, data=payload, content_type="application/json")


class SupabaseDocumentStorage(DocumentStorage):
    def __init__(self, base_dir: Path, client: _SupabaseStorageClient) -> None:
        self.base_dir = base_dir
        self.base_dir.mkdir(parents=True, exist_ok=True)
        self.client = client

    def save(self, filename: str, data: bytes) -> Path:
        safe_name = Path(filename).name
        self.client.upload_bytes(safe_name, data)
        local_path = self.base_dir / safe_name
        local_path.write_bytes(data)
        return local_path

    def delete(self, filename: str) -> None:
        safe_name = Path(filename).name
        self.client.delete(safe_name)
        local_path = self.base_dir / safe_name
        if local_path.exists():
            local_path.unlink()

    def path_for(self, filename: str) -> Path:
        return self.base_dir / Path(filename).name

    def read_bytes(self, filename: str) -> bytes:
        safe_name = Path(filename).name
        return self.client.download_bytes(safe_name)

    def exists(self, filename: str) -> bool:
        safe_name = Path(filename).name
        return self.client.exists(safe_name)


class SupabaseIndexStorage(IndexStorage):
    def __init__(self, base_dir: Path, client: _SupabaseStorageClient) -> None:
        self.base_dir = base_dir
        self.base_dir.mkdir(parents=True, exist_ok=True)
        self.client = client

    def _safe(self, filename: str) -> str:
        return Path(filename).name

    def save(self, filename: str, index: faiss.Index) -> Path:
        safe_name = self._safe(filename)
        with tempfile.NamedTemporaryFile(delete=False, dir=self.base_dir, suffix=".faiss") as tmp:
            faiss.write_index(index, tmp.name)
            tmp_path = Path(tmp.name)
        data = tmp_path.read_bytes()
        self.client.upload_bytes(safe_name, data)
        if tmp_path.exists():
            tmp_path.unlink()
        return tmp_path

    def load(self, filename: str) -> Optional[faiss.Index]:
        safe_name = self._safe(filename)
        try:
            data = self.client.download_bytes(safe_name)
        except FileNotFoundError:
            return None
        with tempfile.NamedTemporaryFile(delete=False, dir=self.base_dir, suffix=".faiss") as tmp:
            tmp.write(data)
            tmp.flush()
            path = tmp.name
        try:
            return faiss.read_index(path)
        finally:
            Path(path).unlink(missing_ok=True)

    def delete(self, filename: str) -> None:
        safe_name = self._safe(filename)
        self.client.delete(safe_name)

    def path_for(self, filename: str) -> Path:
        return self.base_dir / self._safe(filename)

    def write_text(self, filename: str, text: str) -> None:
        safe_name = self._safe(filename)
        self.client.upload_bytes(safe_name, text.encode("utf-8"), content_type="application/json")

    def read_text(self, filename: str) -> Optional[str]:
        safe_name = self._safe(filename)
        try:
            data = self.client.download_bytes(safe_name)
        except FileNotFoundError:
            return None
        return data.decode("utf-8")

    def exists(self, filename: str) -> bool:
        safe_name = self._safe(filename)
        return self.client.exists(safe_name)

    def move(self, src: str, dst: str) -> None:
        self.client.move(self._safe(src), self._safe(dst))


# Factories (prepare for future backends)
def get_document_storage() -> DocumentStorage:
    if config.STORAGE_BACKEND == "supabase":
        client = _SupabaseStorageClient(
            config.SUPABASE_URL,
            config.SUPABASE_SERVICE_ROLE_KEY,
            config.SUPABASE_DOCS_BUCKET,
        )
        return SupabaseDocumentStorage(config.DOCUMENTS_DIR, client)
    return LocalDocumentStorage(config.DOCUMENTS_DIR)


def get_index_storage() -> IndexStorage:
    if config.STORAGE_BACKEND == "supabase":
        client = _SupabaseStorageClient(
            config.SUPABASE_URL,
            config.SUPABASE_SERVICE_ROLE_KEY,
            config.SUPABASE_INDEX_BUCKET,
        )
        return SupabaseIndexStorage(config.INDEX_DIR, client)
    return LocalIndexStorage(config.INDEX_DIR)


__all__ = [
    "DocumentStorage",
    "LocalDocumentStorage",
    "IndexStorage",
    "LocalIndexStorage",
    "SupabaseDocumentStorage",
    "SupabaseIndexStorage",
    "get_document_storage",
    "get_index_storage",
]
