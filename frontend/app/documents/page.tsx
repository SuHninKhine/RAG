"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CheckSquare, Loader2, Square } from "lucide-react";
import { useRouter } from "next/navigation";

import Sidebar from "../components/sidebar";
import type { DocumentInfo } from "../../lib/api";
import { listDocuments, uploadGuides } from "../../lib/api";

export default function DocumentsPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const docs = await listDocuments();
        setDocuments(docs);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load documents.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === documents.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(documents.map((d) => d.filename)));
    }
  };

  const hasDocs = documents.length > 0;
  const ctaDisabled = selected.size === 0;
  const docsParam = useMemo(() => Array.from(selected).join(","), [selected]);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setUploadMessage(null);
    try {
      await uploadGuides(Array.from(files));
      const refreshed = await listDocuments();
      setDocuments(refreshed);
      setUploadMessage("Upload finished.");
    } catch (err) {
      setUploadMessage(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col bg-white">
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 bg-white/60 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-neutral-900">Documents</h1>
            {loading && <Loader2 className="h-4 w-4 animate-spin text-neutral-500" />}
          </div>
          <Link href="/" className="text-sm text-[#3b7f5c] hover:text-[#2f654a] font-medium">
            Back to chat
          </Link>
        </div>

        <div className="px-4 py-3 flex items-center gap-3 text-sm flex-wrap">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf"
              multiple
              className="hidden"
              onChange={(e) => handleUpload(e.target.files)}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-800 hover:bg-neutral-100"
              disabled={uploading}
            >
              {uploading ? "Uploading..." : "Upload PDFs"}
            </button>
            {uploadMessage && <span className="text-xs text-neutral-500">{uploadMessage}</span>}
          </div>
          <button
            type="button"
            onClick={selectAll}
            className="inline-flex items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-800 hover:bg-neutral-100 disabled:opacity-50"
            disabled={!hasDocs}
          >
            {selected.size === documents.length && documents.length > 0 ? "Clear selection" : "Select all"}
          </button>
          <button
            type="button"
            disabled={ctaDisabled}
            onClick={() => {
              localStorage.setItem("doc_selection", docsParam);
              router.push(`/?docs=${encodeURIComponent(docsParam)}`);
            }}
            className="inline-flex items-center gap-2 rounded-md border border-[#3b7f5c] bg-[#3b7f5c] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#346e51] disabled:opacity-50"
          >
            Ask with selected documents
          </button>
        </div>

        {error && <div className="px-4 text-sm text-rose-600">{error}</div>}

        <div className="flex-1 overflow-auto px-4 pb-6">
          {!hasDocs && !loading ? (
            <div className="mt-8 text-sm text-neutral-500">No documents uploaded.</div>
          ) : (
            <div className="overflow-hidden border border-neutral-200 rounded-lg">
              <div className="grid grid-cols-[40px_1fr_120px_140px_100px] bg-neutral-50 text-xs font-medium text-neutral-600 px-3 py-2">
                <div className="text-center">Select</div>
                <div>Filename</div>
                <div>Type</div>
                <div>Uploaded</div>
                <div className="text-right">Pages</div>
              </div>
              <div className="divide-y divide-neutral-200">
                {documents.map((doc) => {
                  const checked = selected.has(doc.filename);
                  const Icon = checked ? CheckSquare : Square;
                  return (
                    <div
                      key={doc.filename}
                      className="grid grid-cols-[40px_1fr_120px_140px_100px] items-center px-3 py-2 text-sm text-neutral-800 hover:bg-neutral-50"
                    >
                      <button
                        type="button"
                        className="flex items-center justify-center text-neutral-600 hover:text-neutral-800"
                        onClick={() => toggleSelect(doc.filename)}
                        aria-label={checked ? "Deselect document" : "Select document"}
                      >
                        <Icon className="h-4 w-4" />
                      </button>
                      <div className="truncate" title={doc.filename}>
                        {doc.filename}
                      </div>
                      <div className="text-neutral-600">PDF</div>
                      <div className="text-neutral-600">{new Date(doc.uploaded_at).toLocaleString()}</div>
                      <div className="text-right text-neutral-700">{doc.pages}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
