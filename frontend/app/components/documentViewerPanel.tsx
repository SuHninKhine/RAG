"use client";

import { X } from "lucide-react";
import { BACKEND_URL } from "../../lib/api";

type DocumentViewerPanelProps = {
  filename?: string;
  page?: number;
  snippet?: string;
  onClose: () => void;
};

export default function DocumentViewerPanel({ filename, page, snippet, onClose }: DocumentViewerPanelProps) {
  const fileUrl = filename ? `${BACKEND_URL}/documents/${encodeURIComponent(filename)}` : null;
  const pageNumber = page ?? 1;
  const searchTerm = snippet ? encodeURIComponent(snippet.slice(0, 80)) : "";
  // Default to direct inline PDF. If you add PDF.js under /public/pdfjs, swap viewerUrl to pdfjsUrl.
  const pdfjsUrl = fileUrl
    ? `/pdfjs/web/viewer.html?file=${encodeURIComponent(fileUrl)}#page=${pageNumber}${
        searchTerm ? `&search=${searchTerm}` : ""
      }`
    : null;
  const fallbackUrl = fileUrl ? `${fileUrl}#page=${pageNumber}` : null;
  const viewerUrl = fallbackUrl; // change to pdfjsUrl when PDF.js is available

  return (
    <aside className="w-[380px] h-full border-l border-neutral-200 bg-white flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200">
        <div>
          <div className="text-sm font-semibold text-neutral-900">Document viewer</div>
          <div className="text-xs text-neutral-500 truncate max-w-[220px]">
            {filename ? filename : "No document opened"}
          </div>
        </div>
        <button
          className="h-8 w-8 inline-flex items-center justify-center rounded-md text-neutral-600 hover:bg-neutral-100"
          onClick={onClose}
          aria-label="Close document panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 flex flex-col p-4">
        {snippet && (
          <div className="mb-2 rounded-md border border-neutral-200 bg-neutral-50 p-2 text-[11px] text-neutral-700">
            <span className="font-medium text-[10px] uppercase tracking-wide text-neutral-500">
              Highlighted text
            </span>
            <div className="mt-1 line-clamp-3">{snippet}</div>
          </div>
        )}
        {viewerUrl ? (
          <iframe
            key={`${filename ?? "doc"}-${page ?? 1}`}
            src={viewerUrl}
            className="w-full flex-1 border-0"
            title={filename ?? "Document viewer"}
          />
        ) : (
          <div className="text-center text-neutral-600 space-y-1">
            <p className="text-sm font-medium">No document opened yet.</p>
            <p className="text-sm">Click a source like [1] in an answer to open it here.</p>
          </div>
        )}
      </div>
    </aside>
  );
}
