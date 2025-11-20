"use client";

import { X } from "lucide-react";

type DocumentViewerPanelProps = {
  filename?: string;
  page?: number;
  onClose: () => void;
};

export default function DocumentViewerPanel({ filename, page, onClose }: DocumentViewerPanelProps) {
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
        {filename ? (
          <div className="w-full h-full border border-dashed border-neutral-200 rounded-lg flex flex-col items-center justify-center text-center px-4 py-6">
            <p className="text-sm font-medium text-neutral-900">Preview for {filename}</p>
            <p className="text-sm text-neutral-600 mt-1">Jumped to page {page ?? 1} (placeholder)</p>
            <div className="mt-4 w-full h-48 bg-neutral-50 border border-neutral-200 rounded-md" />
          </div>
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
