"use client";

import { X, Maximize2, Minimize2 } from "lucide-react";
import { BACKEND_URL } from "../../lib/api";

type DocumentViewerPanelProps = {
  filename?: string;
  page?: number;
  snippet?: string;
  expanded?: boolean;
  onToggleExpand?: () => void;
  width?: number;
  onClose: () => void;
};

export default function DocumentViewerPanel({
  filename,
  page,
  snippet,
  expanded = false,
  onToggleExpand,
  width,
  onClose,
}: DocumentViewerPanelProps) {
  const fileUrl = filename ? `${BACKEND_URL}/documents/${encodeURIComponent(filename)}` : null;
  const pageNumber = page ?? 1;
  const rawSearch = snippet ? snippet.replace(/\s+/g, " ").trim().slice(0, 80) : "";
  const searchTerm = rawSearch ? encodeURIComponent(rawSearch) : "";
  const pdfjsUrl = fileUrl
    ? `/pdfjs/web/viewer.html?file=${encodeURIComponent(fileUrl)}#page=${pageNumber}${
        searchTerm ? `&search=${searchTerm}&phrase=true` : ""
      }`
    : null;
  // Use PDF.js only when explicitly enabled; otherwise fall back to direct PDF to avoid 404s/invalid file errors.
  const fallbackUrl = fileUrl ? `${fileUrl}#page=${pageNumber}` : null;
  const usePdfjs = process.env.NEXT_PUBLIC_USE_PDFJS === "true";
  const viewerUrl = usePdfjs ? pdfjsUrl ?? fallbackUrl : fallbackUrl;
  const displayPage = page ?? undefined;

  return (
    <aside
      className={`h-full border-l border-neutral-200 bg-white flex flex-col ${
        expanded ? "w-[60vw]" : ""
      }`}
      style={!expanded && width ? { width } : expanded && width ? { width } : undefined}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200">
        <div>
          <div className="text-sm font-semibold text-neutral-900">Document viewer</div>
          <div className="text-xs text-neutral-500 truncate max-w-[220px]">
            {filename ? filename : "No document opened"}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            className="h-8 w-8 inline-flex items-center justify-center rounded-md text-neutral-600 hover:bg-neutral-100"
            onClick={onToggleExpand}
            aria-label={expanded ? "Collapse document panel" : "Expand document panel"}
          >
            {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <button
            className="h-8 w-8 inline-flex items-center justify-center rounded-md text-neutral-600 hover:bg-neutral-100"
            onClick={onClose}
            aria-label="Close document panel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col p-4">
        {filename && (
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-[11px] text-neutral-700">
            <span className="font-medium text-neutral-800">Source</span>
            <span className="truncate max-w-[220px]">{filename}</span>
            {displayPage ? <span className="text-neutral-500">· p{displayPage}</span> : null}
          </div>
        )}
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
