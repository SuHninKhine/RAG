"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Trash2 } from "lucide-react";

import Sidebar from "../components/sidebar";
import type { NotebookEntry } from "../../lib/api";
import { deleteNotebookEntry, listNotebook } from "../../lib/api";

export default function NotebookPage() {
  const [entries, setEntries] = useState<NotebookEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const loadEntries = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listNotebook();
      setEntries(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load notebook.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEntries();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this entry?")) return;
    setDeleting(id);
    try {
      await deleteNotebookEntry(id);
      await loadEntries();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete entry.");
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
            <h1 className="text-lg font-semibold text-neutral-900">Notebook</h1>
            {loading && <Loader2 className="h-4 w-4 animate-spin text-neutral-500" />}
          </div>
          <Link href="/" className="text-sm text-[#1f3a8a] hover:text-[#152b66] font-medium">
            Back to chat
          </Link>
        </div>

        {error && <div className="px-4 py-2 text-sm text-rose-600">{error}</div>}

        <div className="flex-1 overflow-auto px-4 pb-6">
          {entries.length === 0 && !loading ? (
            <div className="mt-8 text-sm text-neutral-500">No saved answers yet. Save from chat to see them here.</div>
          ) : (
            <div className="space-y-3 py-3">
              {entries.map((entry) => (
                <div key={entry.id} className="border border-neutral-200 rounded-lg p-3 bg-white shadow-sm">
                  <div className="flex items-center justify-between text-xs text-neutral-500 mb-2">
                    <div>{new Date(entry.created_at).toLocaleString()}</div>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-rose-600 hover:text-rose-700"
                      onClick={() => handleDelete(entry.id)}
                      disabled={deleting === entry.id}
                    >
                      <Trash2 className="h-4 w-4" />
                      {deleting === entry.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                  <div className="text-xs uppercase tracking-wide text-neutral-400 mb-1">Question</div>
                  <div className="text-sm text-neutral-900 mb-2 whitespace-pre-wrap">{entry.question}</div>
                  <div className="text-xs uppercase tracking-wide text-neutral-400 mb-1">Answer</div>
                  <div className="text-sm text-neutral-900 whitespace-pre-wrap">{entry.answer}</div>
                  {entry.document_ids && entry.document_ids.length > 0 && (
                    <div className="mt-2 text-xs text-neutral-500">
                      Document links unavailable (source may be deleted or not ready).
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
