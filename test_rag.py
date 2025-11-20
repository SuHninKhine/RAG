"""Minimal CLI to exercise the RAG pipeline with a single PDF."""
from __future__ import annotations

import argparse
from pathlib import Path

from rag import GuideManager


def main() -> None:
    parser = argparse.ArgumentParser(description="Simple RAG smoke test")
    parser.add_argument("pdf_path", help="Path to a PDF file to ingest")
    parser.add_argument("question", help="Question to ask about the PDF")
    args = parser.parse_args()

    pdf_path = Path(args.pdf_path)
    if not pdf_path.exists():
        raise FileNotFoundError(f"PDF not found: {pdf_path}")

    manager = GuideManager()
    data = pdf_path.read_bytes()
    manager.add_pdf(pdf_path.name, data)
    answer, sources = manager.answer_question(args.question)

    print("Answer:\n" + answer)
    print("Sources:")
    for src in sources:
        print(f"- {src['filename']} pages {src['pages']} ({src['filepath']})")


if __name__ == "__main__":
    main()
