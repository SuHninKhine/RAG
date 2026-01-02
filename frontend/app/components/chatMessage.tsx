"use client";

export type ChatMessageProps = {
  role: "user" | "assistant";
  content: string;
  citations?: { sentence_index: number; source_ids: number[] }[];
  onCitationClick?: (id: number) => void;
  getCitationMeta?: (id: number) => { filename?: string; page?: number } | undefined;
};

const splitSentences = (text: string): string[] =>
  text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

export default function ChatMessage({
  role,
  content,
  citations,
  onCitationClick,
  getCitationMeta,
}: ChatMessageProps) {
  const isUser = role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className="max-w-[80%]">
        <div className="text-[11px] uppercase tracking-wide text-neutral-500 mb-1">
          {isUser ? "You" : "Assistant"}
        </div>
        <div
          className={`${
            isUser ? "bg-neutral-100 text-neutral-900" : "bg-white border border-neutral-200 text-neutral-900"
          } rounded-lg px-4 py-3 text-sm`}
        >
          {isUser ? (
            <span>{content}</span>
          ) : (
            <div className="prose prose-neutral max-w-none text-sm">
              {splitSentences(content).map((sentence, idx) => {
                const citation = (citations || []).find((c) => c.sentence_index === idx);
                return (
                  <span key={idx} className="inline-block mb-1">
                    {sentence}
                    {citation &&
                      citation.source_ids.map((sid) => {
                        const meta = getCitationMeta ? getCitationMeta(sid) : undefined;
                        const title =
                          meta && meta.filename ? `${meta.filename}${meta.page ? ` p${meta.page}` : ""}` : undefined;
                        return (
                          <button
                            key={sid}
                            type="button"
                            className="ml-1 align-super inline-flex items-center justify-center rounded-full border border-neutral-300 px-1.5 py-0.5 text-[11px] font-medium text-neutral-700 hover:bg-neutral-100"
                            onClick={() => onCitationClick && onCitationClick(sid)}
                            title={title}
                          >
                            [{sid}]
                          </button>
                        );
                      })}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
