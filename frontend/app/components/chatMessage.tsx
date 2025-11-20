"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export type ChatMessageProps = {
  role: "user" | "assistant";
  content: string;
};

export default function ChatMessage({ role, content }: ChatMessageProps) {
  const isUser = role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className="max-w-[80%]">
        <div className="text-[11px] uppercase tracking-wide text-neutral-500 mb-1">
          {isUser ? "You" : "Assistant"}
        </div>
        <div
          className={`${
            isUser
              ? "bg-neutral-100 text-neutral-900"
              : "bg-white border border-neutral-200 text-neutral-900"
          } rounded-lg px-4 py-3 text-sm`}
        >
          {isUser ? (
            <span>{content}</span>
          ) : (
            <ReactMarkdown className="prose prose-neutral max-w-none text-sm" remarkPlugins={[remarkGfm]}>
              {content}
            </ReactMarkdown>
          )}
        </div>
      </div>
    </div>
  );
}
