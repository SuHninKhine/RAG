"use client";

import Link from "next/link";

import Sidebar from "../components/sidebar";

export default function HelpPage() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col bg-white">
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 bg-white/60 backdrop-blur-sm">
          <h1 className="text-lg font-semibold text-neutral-900">Help</h1>
          <Link href="/" className="text-sm text-[#1f3a8a] hover:text-[#152b66] font-medium">
            Back to chat
          </Link>
        </div>
        <div className="flex-1 overflow-auto px-4 py-6">
          <div className="max-w-3xl space-y-4 text-sm text-neutral-800">
            <p className="text-base font-semibold text-neutral-900">Getting Started</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Upload documents on the Documents page, then ask questions from Chat.</li>
              <li>Use labels to scope questions to specific document sets.</li>
              <li>Save useful answers to the Notebook for later reference.</li>
            </ul>

            <p className="text-base font-semibold text-neutral-900">Tips</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Keep questions specific for better grounding.</li>
              <li>If you see “I don’t know,” check that documents are uploaded/selected.</li>
              <li>Manage documents & labels via the Documents page overflow menus.</li>
            </ul>

            <p className="text-base font-semibold text-neutral-900">Need more?</p>
            <p className="text-neutral-700">
              This is a placeholder help page. Add your own FAQs, guides, or links to support resources here.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
