"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Check, CheckSquare, Loader2, MoreVertical, Plus, Search, Square, Tag, Trash } from "lucide-react";
import { useRouter } from "next/navigation";

import Sidebar from "../components/sidebar";
import type { DocumentInfo, Label } from "../../lib/api";
import {
  createLabel,
  deleteDocument,
  listDocuments,
  listLabels,
  updateLabel,
  uploadGuides,
} from "../../lib/api";

type ApplyLabelsModalProps = {
  document: DocumentInfo | null;
  labels: Label[];
  onClose: () => void;
  onLabelsUpdated: (labels: Label[]) => void;
};

function ApplyLabelsModal({ document, labels, onClose, onLabelsUpdated }: ApplyLabelsModalProps) {
  const [filter, setFilter] = useState("");
  const [creating, setCreating] = useState(false);
  const [newLabelName, setNewLabelName] = useState("");

  if (!document) return null;

  const filtered = labels.filter((l) => l.name.toLowerCase().includes(filter.toLowerCase()));

  const toggleLabel = async (label: Label) => {
    const assigned = label.document_ids.includes(document.id);
    const nextDocs = assigned ? label.document_ids.filter((id) => id !== document.id) : [...label.document_ids, document.id];
    const updated = await updateLabel(label.id, label.name, nextDocs);
    onLabelsUpdated(labels.map((l) => (l.id === updated.id ? updated : l)));
  };

  const handleCreate = async () => {
    if (!newLabelName.trim()) return;
    setCreating(true);
    try {
      const created = await createLabel(newLabelName.trim(), [document.id]);
      onLabelsUpdated([...labels, created]);
      setNewLabelName("");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30">
      <div className="w-full max-w-lg bg-white rounded-lg shadow-lg border border-neutral-200">
        <div className="px-4 py-3 border-b border-neutral-200">
          <div className="text-lg font-semibold text-neutral-900">Apply Labels</div>
          <p className="text-sm text-neutral-600">
            A single document—or entire sets of them—can live under several labels at once.
          </p>
        </div>

        <div className="px-4 py-3 space-y-3">
          <div className="flex items-center gap-2 border border-neutral-200 rounded-md px-3 py-2">
            <Search className="h-4 w-4 text-neutral-500" />
            <input
              className="flex-1 outline-none text-sm"
              placeholder="Search labels"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              className="flex-1 border border-neutral-200 rounded-md px-3 py-2 text-sm"
              placeholder="Create new label"
              value={newLabelName}
              onChange={(e) => setNewLabelName(e.target.value)}
            />
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating || !newLabelName.trim()}
              className="inline-flex items-center gap-2 rounded-md border border-[#1f3a8a] bg-[#1f3a8a] px-3 py-2 text-sm font-medium text-white hover:bg-[#152b66] disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Create
            </button>
          </div>

          <div className="max-h-64 overflow-auto divide-y divide-neutral-100 border border-neutral-200 rounded-md">
            {filtered.length === 0 ? (
              <div className="p-3 text-sm text-neutral-500">No labels found.</div>
            ) : (
              filtered.map((label) => {
                const assigned = label.document_ids.includes(document.filename);
                return (
                  <button
                    key={label.id}
                    type="button"
                    onClick={() => toggleLabel(label)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-sm ${
                      assigned ? "bg-[#1f3a8a]/10 text-neutral-900" : "text-neutral-800 hover:bg-neutral-50"
                    }`}
                  >
                    <span className="truncate text-left">{label.name}</span>
                    {assigned && <Check className="h-4 w-4 text-[#1f3a8a]" />}
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="px-4 py-3 border-t border-neutral-200 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-100"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DocumentsPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [labels, setLabels] = useState<Label[]>([]);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [modalDoc, setModalDoc] = useState<DocumentInfo | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const docs = await listDocuments();
        const lbls = await listLabels();
        setDocuments(docs);
        setLabels(lbls);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load documents.");
      } finally {
        setLoading(false);
      }
    };
    load();
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, []);

  const toggleSelect = (id: string, status: string) => {
    if (status !== "ready") return;
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
    const readyDocs = documents.filter((d) => d.status === "ready");
    if (selected.size === readyDocs.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(readyDocs.map((d) => d.filename)));
    }
  };

  const hasDocs = documents.length > 0;
  const readyDocs = documents.filter((d) => d.status === "ready");
  const ctaDisabled = selected.size === 0;
  const docsParam = useMemo(() => Array.from(selected).join(","), [selected]);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setUploadMessage(null);
    try {
      await uploadGuides(Array.from(files));
      const refreshedDocs = await listDocuments();
      const refreshedLabels = await listLabels();
      setDocuments(refreshedDocs);
      setLabels(refreshedLabels);
      setUploadMessage("Upload queued.");
      // start polling for status changes if not already polling
      if (!pollRef.current) {
        pollRef.current = setInterval(async () => {
          try {
            const latest = await listDocuments();
            setDocuments(latest);
            const hasPending = latest.some((d) => d.status === "pending" || d.status === "processing");
            if (!hasPending && pollRef.current) {
              clearInterval(pollRef.current);
              pollRef.current = null;
            }
          } catch {
            if (pollRef.current) {
              clearInterval(pollRef.current);
              pollRef.current = null;
            }
          }
        }, 3000);
      }
    } catch (err) {
      setUploadMessage(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = async (filename: string) => {
    if (!confirm(`Delete ${filename}? This cannot be undone.`)) return;
    setDeleting(filename);
    try {
      await deleteDocument(filename);
      const refreshedDocs = await listDocuments();
      const refreshedLabels = await listLabels();
      setDocuments(refreshedDocs);
      setLabels(refreshedLabels);
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(filename);
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete document.");
    } finally {
      setDeleting(null);
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
          <Link href="/" className="text-sm text-[#1f3a8a] hover:text-[#152b66] font-medium">
            Back to chat
          </Link>
        </div>

        <div className="px-4 py-3 flex items-center gap-3 text-sm flex-wrap">
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="file"
                  accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
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
            {selected.size === readyDocs.length && readyDocs.length > 0 ? "Clear selection" : "Select ready"}
          </button>
          <button
            type="button"
            disabled={ctaDisabled}
            onClick={() => {
              localStorage.setItem("doc_selection", docsParam);
              router.push(`/?docs=${encodeURIComponent(docsParam)}`);
            }}
            className="inline-flex items-center gap-2 rounded-md border border-[#1f3a8a] bg-[#1f3a8a] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#152b66] disabled:opacity-50"
          >
            Ask with selected documents
          </button>
        </div>

        {error && <div className="px-4 text-sm text-rose-600">{error}</div>}

        <div className="flex-1 overflow-auto px-4 pb-6">
          {!hasDocs && !loading ? (
            <div className="mt-8 text-sm text-neutral-500">No documents uploaded.</div>
          ) : (
            <div className="border border-neutral-200 rounded-lg">
              <div className="grid grid-cols-[40px_1fr_120px_140px_100px_100px_60px] bg-neutral-50 text-xs font-medium text-neutral-600 px-3 py-2">
                <div className="text-center">Select</div>
                <div>Filename</div>
                <div>Type</div>
                <div>Uploaded</div>
                <div>Status</div>
                <div className="text-right">Pages</div>
                <div className="text-right">Actions</div>
              </div>
              <div className="divide-y divide-neutral-200">
                {documents.map((doc) => {
                  const checked = selected.has(doc.filename);
                  const Icon = checked ? CheckSquare : Square;
                  const isMenuOpen = menuOpen === doc.filename;
                  const selectable = doc.status === "ready";
                  return (
                    <div
                      key={doc.filename}
                      className="grid grid-cols-[40px_1fr_120px_140px_100px_100px_60px] items-center px-3 py-2 text-sm text-neutral-800 hover:bg-neutral-50 relative"
                    >
                      <button
                        type="button"
                        className={`flex items-center justify-center text-neutral-600 hover:text-neutral-800 ${!selectable ? "opacity-40 cursor-not-allowed" : ""}`}
                        onClick={() => toggleSelect(doc.filename, doc.status)}
                        aria-label={checked ? "Deselect document" : "Select document"}
                        disabled={!selectable}
                      >
                        <Icon className="h-4 w-4" />
                      </button>
                      <div className="truncate" title={doc.filename}>
                        {doc.filename}
                      </div>
                      <div className="text-neutral-600">{doc.filename.split(".").pop()?.toUpperCase() ?? ""}</div>
                      <div className="text-neutral-600">{new Date(doc.uploaded_at).toLocaleString()}</div>
                      <div className="text-neutral-700">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            doc.status === "ready"
                              ? "bg-green-50 text-green-700"
                              : doc.status === "failed"
                                ? "bg-rose-50 text-rose-700"
                                : doc.status === "pending" || doc.status === "processing"
                                  ? "bg-amber-50 text-amber-700"
                                  : "bg-neutral-100 text-neutral-600"
                          }`}
                          title={["pending", "processing", "ready", "failed"].includes(doc.status) ? "" : "Unknown status"}
                        >
                          {doc.status}
                        </span>
                      </div>
                      <div className="text-right text-neutral-700">{doc.pages ?? "—"}</div>
                      <div className="flex items-center justify-end relative">
                        <button
                          type="button"
                          className="p-1 text-neutral-600 hover:text-neutral-800"
                          onClick={() => setMenuOpen(isMenuOpen ? null : doc.filename)}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                        {isMenuOpen && (
                          <div className="absolute right-3 top-9 z-20 w-44 rounded-md border border-neutral-200 bg-white shadow-lg">
                            <button
                              type="button"
                              className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-50 flex items-center gap-2"
                              onClick={() => {
                                setModalDoc(doc);
                                setMenuOpen(null);
                              }}
                            >
                              <Tag className="h-4 w-4 text-neutral-500" />
                              Apply labels
                            </button>
                            <button
                              type="button"
                              className="w-full text-left px-3 py-2 text-sm text-rose-600 hover:bg-neutral-50 flex items-center gap-2"
                              onClick={() => {
                                setMenuOpen(null);
                                handleDeleteDocument(doc.filename);
                              }}
                              disabled={deleting === doc.filename}
                            >
                              <Trash className="h-4 w-4" />
                              {deleting === doc.filename ? "Deleting..." : "Delete document"}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
      {modalDoc && (
        <ApplyLabelsModal
          document={modalDoc}
          labels={labels}
          onClose={() => setModalDoc(null)}
          onLabelsUpdated={(next) => setLabels(next)}
        />
      )}
    </div>
  );
}
