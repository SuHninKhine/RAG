"use client";

import { useMemo } from "react";
import { SendHorizontal } from "lucide-react";

import ChatMessage from "./chatMessage";

type ChatPanelProps = {
  onOpenDocument: (filename: string, page?: number) => void;
};

export default function ChatPanel({ onOpenDocument }: ChatPanelProps) {
  const messages = useMemo(
    () => [
      {
        role: "user" as const,
        content: "What are the limitations on covered services for adults?",
      },
      {
        role: "assistant" as const,
        content:
          "The document states that adult dental care is generally not covered by the plan. [1]\n\n_Pages: 5_",
        source: { filename: "BenefitsSummary.pdf", page: 5, label: "View source [1]" },
      },
      {
        role: "user" as const,
        content: "Can you summarize the renewal process?",
      },
      {
        role: "assistant" as const,
        content:
          "Renewal typically occurs automatically if the account remains in good standing, otherwise a standard acceptance flow applies. [2]",
        source: { filename: "CSPNavigationTraining.pdf", page: 3, label: "View source [2]" },
      },
    ],
    []
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 flex flex-col max-w-3xl w-full mx-auto my-8 px-4">
        <div className="bg-white border border-neutral-200 rounded-lg shadow-sm flex-1 flex flex-col h-[calc(100vh-6rem)]">
          <div className="px-4 pt-5 pb-3 border-b border-neutral-200">
            <h1 className="text-xl font-semibold text-neutral-900">Chat with your documents</h1>
            <p className="text-sm text-neutral-600 mt-1">
              Ask questions and get answers based on the PDFs you&apos;ve uploaded.
            </p>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 px-4 pt-6 pb-4">
            {messages.map((msg, idx) => (
              <div key={idx} className="flex flex-col gap-2">
                <ChatMessage role={msg.role} content={msg.content} />
                {msg.role === "assistant" && msg.source && (
                  <button
                    className="self-start text-sm text-[#0f766e] hover:underline"
                    onClick={() => onOpenDocument(msg.source!.filename, msg.source!.page)}
                  >
                    {msg.source.label}
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="border-t border-neutral-200 p-4">
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                // placeholder
                console.log("Send message");
              }}
            >
              <textarea
                className="w-full border border-neutral-200 rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#3b7f5c] focus:border-transparent bg-white"
                placeholder="Ask about your documents..."
                rows={3}
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-[#3b7f5c] text-white hover:bg-[#346e51]"
                >
                  <SendHorizontal className="h-4 w-4" />
                  Send
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
