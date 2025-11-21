"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export type ChatMessageProps = {
  role: "user" | "assistant";
  content: string;
  onCitationClick?: (id: number) => void;
};

export default function ChatMessage({ role, content, onCitationClick }: ChatMessageProps) {
  const isUser = role === "user";

  const handleBubbleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    const link = target.closest("a") as HTMLAnchorElement | null;
    if (!link || !link.href) return;
    if (link.href.startsWith("citation://")) {
      e.preventDefault();
      const idStr = link.href.replace("citation://", "");
      const id = Number(idStr);
      if (onCitationClick && !Number.isNaN(id)) {
        onCitationClick(id);
      }
    }
  };

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
          onClick={isUser ? undefined : handleBubbleClick}
        >
          {isUser ? (
            <span>{content}</span>
          ) : (
            <ReactMarkdown
              className="prose prose-neutral max-w-none text-sm"
              remarkPlugins={[remarkGfm]}
              components={{
                a: ({ href, children }) => {
                  const text = Array.isArray(children)
                    ? children.map((c: any) => (typeof c === "string" ? c : "")).join("")
                    : (children as any as string) ?? "";
                  const citationMatch = text.match(/\d+/);
                  if (onCitationClick && citationMatch) {
                    const id = Number(citationMatch[0]);
                    const handleClick = () => {
                      if (!Number.isNaN(id)) {
                        onCitationClick(id);
                      }
                    };
                    return (
                      <button
                        type="button"
                        onClick={handleClick}
                        className="inline-flex items-center justify-center rounded-full border border-neutral-300 px-1.5 py-0.5 text-[11px] font-medium text-neutral-700 hover:bg-neutral-100"
                      >
                        [{id}]
                      </button>
                    );
                  }
                  const handleExternal = (e: React.MouseEvent<HTMLAnchorElement>) => {
                    e.preventDefault();
                    if (href) {
                      window.open(href, "_blank");
                    }
                  };
                  return (
                    <a
                      href={href}
                      onClick={handleExternal}
                      className="underline text-blue-600 hover:text-blue-700"
                      rel="noreferrer"
                    >
                      {children}
                    </a>
                  );
                },
              }}
            >
              {content}
            </ReactMarkdown>
          )}
        </div>
      </div>
    </div>
  );
}
