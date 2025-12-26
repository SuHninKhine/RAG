"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, HelpCircle, MessageCircle, Notebook, Tag } from "lucide-react";

const navItems = [
  { key: "Conversations", label: "Conversations", href: "/", icon: MessageCircle },
  { key: "Documents", label: "Documents", href: "/documents", icon: FileText },
  { key: "Notebook", label: "Notebook", href: "/notebook", icon: Notebook },
  { key: "Tags", label: "Tags", href: "/tags", icon: Tag },
  { key: "Help", label: "Help", href: "/help", icon: HelpCircle },
];

export default function Sidebar() {
  const pathname = usePathname();

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
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.key}
              href={item.href}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive
                  ? "bg-neutral-100 text-neutral-900 border-l-2 border-[#3b7f5c]"
                  : "text-neutral-700 hover:bg-neutral-100"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>

      <div className="border-t border-neutral-200 px-4 py-4 flex items-center gap-3">
        <div className="h-9 w-9 rounded-full bg-neutral-200 text-neutral-700 flex items-center justify-center text-sm font-semibold">
          Y
        </div>
        <div className="flex-1">
          <div className="text-sm font-medium text-neutral-900">You</div>
          <div className="text-xs text-neutral-500">Documents: —</div>
        </div>
      </div>
    </aside>
  );
}
