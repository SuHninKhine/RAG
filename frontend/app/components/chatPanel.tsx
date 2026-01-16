"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BookmarkPlus, SendHorizontal } from "lucide-react";

import ChatMessage from "./chatMessage";
import type { Citation, SourceInfo } from "../../lib/api";
import { askQuestion, listDocuments, saveNotebookEntry } from "../../lib/api";

type ChatMessageItem = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: SourceInfo[];
  citations?: Citation[];
};

type ChatPanelProps = {
  onOpenDocument: (source: SourceInfo, page?: number) => void;
  onResetDocument?: () => void;
  selectedDocumentIds?: string[];
  labelId?: string;
  canQuery?: boolean;
  onSelectionPrune?: (nextIds: string[]) => void;
};

export default function ChatPanel({
  onOpenDocument,
  onResetDocument,
  selectedDocumentIds,
  labelId,
  canQuery = true,
  onSelectionPrune,
}: ChatPanelProps) {
  const initialMessages = useMemo<ChatMessageItem[]>(
    () => [
      {
        id: "1",
        role: "user",
        content: "What are the limitations on covered services for adults?",
      },
      {
        id: "2",
        role: "assistant",
        content: "The document states that adult dental care is generally not covered by the plan.",
        sources: [{ id: 1, filename: "BenefitsSummary.pdf", pages: [5], url: "/documents/BenefitsSummary.pdf" }],
        citations: [{ sentence_index: 0, source_ids: [1] }],
      },
    ],
    []
  );

  const [messages, setMessages] = useState<ChatMessageItem[]>(initialMessages);
  const [lastQuestion, setLastQuestion] = useState<string>("");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading || !canQuery) return;
    if (onResetDocument) {
      onResetDocument();
    }

    const userMessage: ChatMessageItem = {
      id: crypto.randomUUID(),
      role: "user",
      content: input,
    };

    setMessages((prev) => [...prev, userMessage]);
    setLastQuestion(input);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const response = await askQuestion(userMessage.content, selectedDocumentIds, labelId);
      const assistantMessage: ChatMessageItem = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: response.answer,
        sources: response.sources,
        citations: response.citations,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      if (msg.includes("400")) {
        setError("Documents are not ready. Please refresh documents and try again.");
        try {
          const docs = await listDocuments();
          const ready = docs.filter((d) => d.status === "ready").map((d) => d.filename);
          const nextIds = (selectedDocumentIds || []).filter((id) => ready.includes(id));
          if (onSelectionPrune) {
            onSelectionPrune(nextIds);
          }
          if (ready.length === 0) {
            localStorage.removeItem("doc_selection");
          }
        } catch (loadErr) {
          console.error("Failed to refresh documents after error", loadErr);
        }
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (msg: ChatMessageItem) => {
    if (!lastQuestion || msg.role !== "assistant") return;
    setSavingId(msg.id);
    try {
      await saveNotebookEntry({
        question: lastQuestion,
        answer: msg.content,
        labelId: labelId,
        documentIds: selectedDocumentIds,
        sources: msg.sources,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save to notebook.");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 flex flex-col max-w-3xl w-full mx-auto my-8 px-4 overflow-hidden">
        <div className="bg-white border border-neutral-200 rounded-lg shadow-sm flex-1 flex flex-col h-[calc(100vh-6rem)] overflow-hidden">
          <div className="px-4 pt-5 pb-3 border-b border-neutral-200">
            <h1 className="text-xl font-semibold text-neutral-900">Chat with your documents</h1>
            <p className="text-sm text-neutral-600 mt-1">
              Ask questions and get answers based on the PDFs you&apos;ve uploaded.
            </p>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 px-4 pt-6 pb-4 pr-2">
            {messages.map((msg) => (
              <div key={msg.id} className="flex flex-col gap-2">
                <ChatMessage
                  role={msg.role}
                  content={msg.content}
                  citations={msg.citations}
                  onCitationClick={
                    msg.role === "assistant"
                      ? (id) => {
                          const source = msg.sources?.find((s) => s.id === id);
                          if (source) {
                            onOpenDocument(source, source.primaryPage ?? source.pages?.[0]);
                          }
                        }
                      : undefined
                  }
                  getCitationMeta={
                    msg.role === "assistant"
                      ? (id) => {
                          const source = msg.sources?.find((s) => s.id === id);
                          return source
                            ? { filename: source.filename, page: source.primaryPage ?? source.pages?.[0] }
                            : undefined;
                        }
                      : undefined
                  }
                />
                {msg.role === "assistant" && (
                  <div className="mt-2 text-xs text-neutral-500 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-full border border-neutral-300 px-2 py-0.5 text-[11px] font-medium text-neutral-700 hover:bg-neutral-100"
                      onClick={() => handleSave(msg)}
                      disabled={savingId === msg.id}
                    >
                      <BookmarkPlus className="h-3.5 w-3.5" />
                      {savingId === msg.id ? "Saving..." : "Save to notebook"}
                    </button>
                  </div>
                )}
              </div>
            ))}
            {loading && <div className="text-xs text-neutral-500">Thinking...</div>}
            <div ref={messagesEndRef} />
          </div>

          <div className="border-t border-neutral-200 p-4">
            <form className="space-y-3" onSubmit={handleSubmit}>
              <textarea
                className="w-full border border-neutral-200 rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1f3a8a] focus:border-transparent bg-white disabled:opacity-60"
                placeholder="Ask about your documents..."
                rows={3}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={loading}
              />
              {error && <div className="text-sm text-rose-600">{error}</div>}
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-[#1f3a8a] text-white hover:bg-[#152b66] disabled:opacity-60"
                  disabled={loading || !input.trim() || !canQuery}
                >
                  <SendHorizontal className="h-4 w-4" />
                  {loading ? "Sending" : "Send"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
