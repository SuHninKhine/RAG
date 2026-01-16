"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PanelLeft, PanelRight, PanelRightOpen } from "lucide-react";
import { useSearchParams } from "next/navigation";

import Sidebar from "./components/sidebar";
import ChatPanel from "./components/chatPanel";
import DocumentViewerPanel from "./components/documentViewerPanel";
import type { Label, SourceInfo } from "../lib/api";
import { listDocuments, listLabels } from "../lib/api";

export default function HomePage() {
  const searchParams = useSearchParams();
  const [showSidebar, setShowSidebar] = useState(true);
  const [showDocPanel, setShowDocPanel] = useState(true);
  const [docExpanded, setDocExpanded] = useState(false);
  const [docMeta, setDocMeta] = useState<{ filename?: string; page?: number; snippet?: string }>({});
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [readyDocuments, setReadyDocuments] = useState<Set<string>>(new Set());
  const [docIdToFilename, setDocIdToFilename] = useState<Record<number, string>>({});
  const [labels, setLabels] = useState<Label[]>([]);
  const [activeLabelId, setActiveLabelId] = useState<string | "all">("all");
  const [docWidth, setDocWidth] = useState<number>(380);
  const dragRaf = useRef<number | null>(null);
  const dragActive = useRef(false);

  useEffect(() => {
    const docsParam = searchParams.get("docs");
    const labelParam = searchParams.get("label");
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
    if (labelParam) {
      setActiveLabelId(labelParam);
    }
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    const reconcileSelection = async () => {
      try {
        const docs = await listDocuments();
        if (cancelled) return;
        const ready = docs.filter((d) => d.status === "ready").map((d) => d.filename);
        const existing = new Set(ready);
        const map: Record<number, string> = {};
        docs.forEach((d) => {
          map[d.id] = d.filename;
        });
        setDocIdToFilename(map);
        setReadyDocuments(new Set(ready));
        setSelectedDocumentIds((prev) => {
          const next = prev.filter((id) => existing.has(id));
          if (next.length !== prev.length) {
            if (next.length > 0) {
              localStorage.setItem("doc_selection", next.join(","));
            } else {
              localStorage.removeItem("doc_selection");
            }
          }
          return next;
        });
      } catch (err) {
        console.error("Failed to reconcile document selection", err);
      }
    };
    reconcileSelection();
    const interval = setInterval(reconcileSelection, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const loadLabels = async () => {
      try {
        const data = await listLabels();
        setLabels(data);
        if (activeLabelId !== "all" && !data.find((l) => String(l.id) === String(activeLabelId))) {
          setActiveLabelId("all");
        }
      } catch (err) {
        console.error("Failed to load labels", err);
      }
    };
    loadLabels();
  }, [activeLabelId]);

  const handleOpenDocument = (source: SourceInfo, page?: number) => {
    setDocMeta({
      filename: source.filename,
      page: page ?? source.primaryPage ?? source.pages?.[0],
      snippet: source.snippet ?? undefined,
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

  const labelObj = labels.find((l) => String(l.id) === String(activeLabelId));
  const readyForLabel =
    labelObj && Object.keys(docIdToFilename).length > 0
      ? labelObj.document_ids
          .map((id) => docIdToFilename[id])
          .filter((name): name is string => !!name)
          .filter((name) => readyDocuments.has(name))
      : [];
  const hasReady = readyDocuments.size > 0;
  const contextLabel =
    activeLabelId !== "all"
      ? readyForLabel.length > 0
        ? `Label: ${labelObj?.name ?? "Unknown"} (${readyForLabel.length} ready)`
        : `Label: ${labelObj?.name ?? "Unknown"} (no ready documents)`
      : selectedDocumentIds.length > 0
        ? `Asking across ${selectedDocumentIds.length} document${selectedDocumentIds.length > 1 ? "s" : ""}`
        : hasReady
          ? "Please choose document to ask"
          : "No ready documents available";

  const chatSessionKey =
    activeLabelId !== "all"
      ? `label-${activeLabelId}`
      : selectedDocumentIds.length > 0
        ? `docs-${selectedDocumentIds.join(",")}`
        : "all-docs";

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
          <div className="flex items-center gap-2 text-sm">
            <label className="text-neutral-700 text-xs">Label</label>
            <select
              className="border border-neutral-200 rounded-md bg-white px-2 py-1 text-sm text-neutral-800"
              value={activeLabelId}
              onChange={(e) => {
                setActiveLabelId(e.target.value as string | "all");
                setSelectedDocumentIds([]);
              }}
            >
              <option value="all">All documents (auto)</option>
              {labels.map((label) => (
                <option key={label.id} value={String(label.id)}>
                  {label.name} ({label.document_ids.length})
                </option>
              ))}
            </select>
          <Link
            href="/documents"
            className="text-[#1f3a8a] hover:text-[#152b66] font-medium text-xs"
            aria-label="Manage labels and documents"
          >
            Manage documents & labels
          </Link>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <ChatPanel
            key={chatSessionKey}
            onOpenDocument={handleOpenDocument}
            onResetDocument={handleResetDocument}
            selectedDocumentIds={selectedDocumentIds}
            labelId={activeLabelId !== "all" ? activeLabelId : undefined}
            onSelectionPrune={(next) => {
              setSelectedDocumentIds(next);
              if (next.length > 0) {
                localStorage.setItem("doc_selection", next.join(","));
              }
            }}
            canQuery={
              activeLabelId !== "all"
                ? readyForLabel.length > 0
                : selectedDocumentIds.length > 0
                  ? true
                  : readyDocuments.size > 0
            }
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
