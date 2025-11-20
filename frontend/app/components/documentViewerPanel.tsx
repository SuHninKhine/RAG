"use client";

import { X } from "lucide-react";
import { BACKEND_URL } from "../../lib/api";

type DocumentViewerPanelProps = {
  filename?: string;
  page?: number;
  onClose: () => void;
};

export default function DocumentViewerPanel({ filename, page, onClose }: DocumentViewerPanelProps) {
  const fileUrl = filename ? `${BACKEND_URL}/documents/${encodeURIComponent(filename)}` : null;
  const pageParam = page ?? 1;
  // Use direct file URL for now; if PDF.js is added under /public/pdfjs/, swap to the viewer path.
  const viewerUrl = fileUrl ? `${fileUrl}#page=${pageParam}` : null;

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

      <div className="flex-1 flex items-center justify-center p-4">
        {viewerUrl ? (
          <iframe src={viewerUrl} className="w-full h-full border-0" title={filename ?? "Document viewer"} />
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
