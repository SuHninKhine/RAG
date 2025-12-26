"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PanelLeft, PanelRight, PanelRightOpen } from "lucide-react";
import { useSearchParams } from "next/navigation";

import Sidebar from "./components/sidebar";
import ChatPanel from "./components/chatPanel";
import DocumentViewerPanel from "./components/documentViewerPanel";
import type { SourceInfo } from "../lib/api";

export default function HomePage() {
  const searchParams = useSearchParams();
  const [showSidebar, setShowSidebar] = useState(true);
  const [showDocPanel, setShowDocPanel] = useState(true);
  const [docExpanded, setDocExpanded] = useState(false);
  const [docMeta, setDocMeta] = useState<{ filename?: string; page?: number; snippet?: string }>({});
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [docWidth, setDocWidth] = useState<number>(380);
  const dragRaf = useRef<number | null>(null);
  const dragActive = useRef(false);

  useEffect(() => {
    const docsParam = searchParams.get("docs");
    if (docsParam) {
      const docs = docsParam
        .split(",")
        .map((d) => d.trim())
        .filter(Boolean);
      setSelectedDocumentIds(docs);
      if (docs.length > 0) {
        localStorage.setItem("doc_selection", docs.join(","));
      }
    } else {
      const stored = localStorage.getItem("doc_selection");
      if (stored) {
        setSelectedDocumentIds(
          stored
            .split(",")
            .map((d) => d.trim())
            .filter(Boolean)
        );
      }
    }
  }, [searchParams]);

  const handleOpenDocument = (source: SourceInfo, page?: number) => {
    setDocMeta({
      filename: source.filename,
      page: page ?? source.primaryPage ?? source.pages?.[0],
      snippet: source.snippet,
    });
    setShowDocPanel(true);
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

  const contextLabel =
    selectedDocumentIds.length > 0
      ? `Asking across ${selectedDocumentIds.length} document${selectedDocumentIds.length > 1 ? "s" : ""}`
      : "Auto-routing across all documents";

  return (
    <div className="flex h-screen overflow-hidden">
      {showSidebar && <Sidebar />}

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

        <div className="flex items-center gap-3 px-4 pt-3 text-xs text-neutral-600">
          <span className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1">
            {contextLabel}
          </span>
          <Link
            href="/documents"
            className="text-[#3b7f5c] hover:text-[#2f654a] font-medium"
            aria-label="Change documents"
          >
            Change documents
          </Link>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <ChatPanel
            onOpenDocument={handleOpenDocument}
            onResetDocument={handleResetDocument}
            selectedDocumentIds={selectedDocumentIds}
          />
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
