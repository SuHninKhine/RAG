"use client";

import { useRef, useState } from "react";
import { FileText, HelpCircle, MessageCircle, Notebook, Tag, Upload } from "lucide-react";
import type { GuideInfo } from "../../lib/api";
import { uploadGuides } from "../../lib/api";

const navItems = [
  { key: "Library", label: "Library", icon: FileText },
  { key: "Conversations", label: "Conversations", icon: MessageCircle },
  { key: "Notebook", label: "Notebook", icon: Notebook },
  { key: "Tags", label: "Tags", icon: Tag },
  { key: "Help", label: "Help", icon: HelpCircle },
];

type SidebarProps = {
  guides: GuideInfo[];
  onGuidesUploaded: (guides: GuideInfo[]) => void;
};

export default function Sidebar({ guides, onGuidesUploaded }: SidebarProps) {
  const [active, setActive] = useState<string>("Library");
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setUploadMessage(null);
    try {
      const { guides: newGuides, message } = await uploadGuides(Array.from(files));
      onGuidesUploaded(newGuides);
      setUploadMessage(message);
    } catch (err) {
      setUploadMessage(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <aside className="w-64 h-full bg-[#f7f7f5] border-r border-neutral-200 flex flex-col">
      <div className="px-4 py-4 border-b border-neutral-200">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-[#3b7f5c]/15 text-[#3b7f5c] flex items-center justify-center font-semibold text-sm">
            dR
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold text-neutral-900">docRAG</span>
            <span className="text-xs text-neutral-500">Personal workspace</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.key;
          return (
            <div key={item.key} className="space-y-2">
              <button
                onClick={() => setActive(item.key)}
                className={`flex w-full items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? "bg-neutral-100 text-neutral-900 border-l-2 border-[#3b7f5c]"
                    : "text-neutral-700 hover:bg-neutral-100"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </button>

              {item.key === "Library" && (
                <div className="pl-3 pr-2 space-y-2 text-xs text-neutral-600">
                  <div className="flex items-center gap-2">
                    <input
                      ref={inputRef}
                      type="file"
                      accept="application/pdf"
                      multiple
                      className="hidden"
                      onChange={(e) => handleUpload(e.target.files)}
                    />
                    <button
                      type="button"
                      onClick={() => inputRef.current?.click()}
                      className="inline-flex items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-800 hover:bg-neutral-100"
                      disabled={uploading}
                    >
                      <Upload className="h-3.5 w-3.5" />
                      {uploading ? "Uploading..." : "Upload PDFs"}
                    </button>
                  </div>

                  {uploadMessage && <div className="text-[11px] text-neutral-500">{uploadMessage}</div>}

                  <div className="mt-2 max-h-32 overflow-y-auto space-y-1">
                    {guides.length === 0 ? (
                      <p className="italic text-neutral-500">No documents yet.</p>
                    ) : (
                      guides.map((g) => (
                        <div key={g.filename} className="truncate">
                          • {g.filename}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="border-t border-neutral-200 px-4 py-4 flex items-center gap-3">
        <div className="h-9 w-9 rounded-full bg-neutral-200 text-neutral-700 flex items-center justify-center text-sm font-semibold">
          Y
        </div>
        <div className="flex-1">
          <div className="text-sm font-medium text-neutral-900">You</div>
          <div className="text-xs text-neutral-500">Guides: {guides.length} • Chunks: 0</div>
        </div>
      </div>
    </aside>
  );
}
