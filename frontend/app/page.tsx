"use client";

import { useRef, useState } from "react";
import { PanelLeft, PanelRight, PanelRightOpen } from "lucide-react";

import Sidebar from "./components/sidebar";
import ChatPanel from "./components/chatPanel";
import DocumentViewerPanel from "./components/documentViewerPanel";
import type { GuideInfo, SourceInfo } from "../lib/api";

export default function HomePage() {
  const [showSidebar, setShowSidebar] = useState(true);
  const [showDocPanel, setShowDocPanel] = useState(true);
  const [docExpanded, setDocExpanded] = useState(false);
  const [docMeta, setDocMeta] = useState<{ filename?: string; page?: number; snippet?: string }>({});
  const [guides, setGuides] = useState<GuideInfo[]>([]);
  const [docWidth, setDocWidth] = useState<number>(380);
  const dragRaf = useRef<number | null>(null);
  const dragActive = useRef(false);

  const handleOpenDocument = (source: SourceInfo, page?: number) => {
    setDocMeta({
      filename: source.filename,
      page: page ?? source.primaryPage ?? source.pages?.[0],
      snippet: source.snippet,
    });
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

  const handleResetDocument = () => {
    setDocMeta({});
  };

  const handleResizeMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = docWidth;
    const minWidth = 280;
    const maxWidth = 900;
    dragActive.current = true;
    const body = document.body;
    const prevUserSelect = body.style.userSelect;
    body.style.userSelect = "none";

    const handleMove = (ev: MouseEvent) => {
      if (!dragActive.current) return;
      const delta = startX - ev.clientX;
      const next = Math.min(Math.max(startWidth + delta, minWidth), maxWidth);
      if (dragRaf.current !== null) {
        return;
      }
      dragRaf.current = window.requestAnimationFrame(() => {
        setDocWidth(next);
        setDocExpanded(false);
        dragRaf.current = null;
      });
    };

    const handleUp = () => {
      dragActive.current = false;
      body.style.userSelect = prevUserSelect;
      if (dragRaf.current !== null) {
        window.cancelAnimationFrame(dragRaf.current);
        dragRaf.current = null;
      }
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
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
          <ChatPanel onOpenDocument={handleOpenDocument} onResetDocument={handleResetDocument} />
          {showDocPanel && (
            <>
              <div
                className="w-1 cursor-col-resize bg-neutral-200 hover:bg-neutral-300"
                onMouseDown={handleResizeMouseDown}
                title="Drag to resize"
              />
              <DocumentViewerPanel
                filename={docMeta.filename}
                page={docMeta.page}
                snippet={docMeta.snippet}
                expanded={docExpanded}
                width={docWidth}
                onToggleExpand={() =>
                  setDocExpanded((prev) => {
                    if (!prev) {
                      const target = Math.max(Math.min(window.innerWidth * 0.6, 1000), 400);
                      setDocWidth(target);
                      return true;
                    }
                    setDocWidth(380);
                    return false;
                  })
                }
                onClose={() => setShowDocPanel(false)}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
