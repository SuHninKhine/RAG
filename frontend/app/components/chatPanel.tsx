"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SendHorizontal } from "lucide-react";

import ChatMessage from "./chatMessage";
import type { SourceInfo } from "../../lib/api";
import { askQuestion } from "../../lib/api";

type ChatMessageItem = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: SourceInfo[];
};

type ChatPanelProps = {
  onOpenDocument: (source: SourceInfo, page?: number) => void;
  onResetDocument?: () => void;
  selectedDocumentIds?: string[];
};

export default function ChatPanel({ onOpenDocument, onResetDocument, selectedDocumentIds }: ChatPanelProps) {
  const linkifyCitations = (answer: string, sources: SourceInfo[] | undefined): string => {
    if (!sources || sources.length === 0) return answer;
    let output = answer;
    for (const { id } of sources) {
      const cid = Number(id);
      if (Number.isNaN(cid)) continue;
      // Replace bracketed citations like [1]
      const bracketRe = new RegExp(`\\[${cid}\\]`, "g");
      output = output.replace(bracketRe, `[${cid}](citation://${cid})`);
      // Replace bare numbers at boundaries (start or whitespace) followed by non-digit
      const bareRe = new RegExp(`(^|\\s)${cid}(?=[^\\d]|$)`, "g");
      output = output.replace(bareRe, `$1[${cid}](citation://${cid})`);
    }
    return output;
  };

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
        content:
          "The document states that adult dental care is generally not covered by the plan. [1]\n\n_Pages: 5_",
        sources: [{ id: 1, filename: "BenefitsSummary.pdf", pages: [5], url: "/documents/BenefitsSummary.pdf" }],
      },
    ],
    []
  );

  const [messages, setMessages] = useState<ChatMessageItem[]>(initialMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    if (onResetDocument) {
      onResetDocument();
    }

    const userMessage: ChatMessageItem = {
      id: crypto.randomUUID(),
      role: "user",
      content: input,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const response = await askQuestion(userMessage.content, selectedDocumentIds);
      const linkedAnswer = linkifyCitations(response.answer, response.sources);
      const assistantMessage: ChatMessageItem = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: linkedAnswer,
        sources: response.sources,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
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
                {msg.role === "assistant" && msg.sources && msg.sources.length > 0 && (
                  <div className="mt-2 text-xs text-neutral-500 flex flex-wrap items-center gap-2">
                    <span className="uppercase tracking-wide text-[10px] text-neutral-400">Sources</span>
                    {msg.sources.map((src) => (
                      <button
                        key={src.id}
                        type="button"
                        className="inline-flex items-center justify-center rounded-full border border-neutral-300 px-2 py-0.5 text-[11px] font-medium text-neutral-700 hover:bg-neutral-100"
                        onClick={() => onOpenDocument(src, src.primaryPage ?? src.pages?.[0])}
                        title={`${src.filename}${src.primaryPage ?? src.pages?.[0] ? ` · p${src.primaryPage ?? src.pages?.[0]}` : ""}`}
                      >
                        [{src.id}]
                      </button>
                    ))}
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
                className="w-full border border-neutral-200 rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#3b7f5c] focus:border-transparent bg-white disabled:opacity-60"
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
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-[#3b7f5c] text-white hover:bg-[#346e51] disabled:opacity-60"
                  disabled={loading || !input.trim()}
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
