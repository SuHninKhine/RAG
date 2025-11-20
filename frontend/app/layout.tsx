import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "../styles/globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "docRAG",
  description: "Notion-like document chat interface",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className={`bg-[#f5f5f4] text-neutral-900 antialiased ${inter.className}`}>
        {children}
      </body>
    </html>
  );
}
