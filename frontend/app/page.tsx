"use client";

import { useState } from "react";
import { PanelLeft, PanelRight, PanelRightOpen } from "lucide-react";

import Sidebar from "./components/sidebar";
import ChatPanel from "./components/chatPanel";
import DocumentViewerPanel from "./components/documentViewerPanel";
import type { GuideInfo } from "../lib/api";

export default function HomePage() {
  const [showSidebar, setShowSidebar] = useState(true);
  const [showDocPanel, setShowDocPanel] = useState(true);
  const [docMeta, setDocMeta] = useState<{ filename?: string; page?: number }>({});
  const [guides, setGuides] = useState<GuideInfo[]>([]);

  const handleOpenDocument = (filename: string, page?: number) => {
    setDocMeta({ filename, page });
    setShowDocPanel(true);
  };

  const handleGuidesUploaded = (newGuides: GuideInfo[]) => {
    setGuides((prev) => {
      const existing = new Set(prev.map((g) => g.filename));
      const merged = [...prev];
      for (const g of newGuides) {
        if (!existing.has(g.filename)) {
          merged.push(g);
        }
      }
      return merged;
    });
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {showSidebar && (
        <Sidebar guides={guides} onGuidesUploaded={handleGuidesUploaded} />
      )}

      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 bg-white/60 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-sm text-neutral-700">
            <button
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-100"
              onClick={() => setShowSidebar((prev) => !prev)}
              aria-label="Toggle sidebar"
            >
              <PanelLeft className="h-5 w-5" />
            </button>
            <span className="text-sm font-medium">Ask your documents</span>
          </div>
          <button
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-100"
            onClick={() => setShowDocPanel((prev) => !prev)}
            aria-label="Toggle document panel"
          >
            {showDocPanel ? <PanelRight className="h-5 w-5" /> : <PanelRightOpen className="h-5 w-5" />}
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <ChatPanel onOpenDocument={handleOpenDocument} />
        </div>
      </div>

      {showDocPanel && (
        <DocumentViewerPanel
          filename={docMeta.filename}
          page={docMeta.page}
          onClose={() => setShowDocPanel(false)}
        />
      )}
    </div>
  );
}
