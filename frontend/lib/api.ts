export const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";

export type DocumentInfo = {
  id: number;
  filename: string;
  pages: number | null;
  uploaded_at: string;
  summary: string | null;
  status: string;
  url: string;
};

export type Label = {
  id: number;
  name: string;
  document_ids: number[];
  created_at: string;
};

export type SourceInfo = {
  id: number;
  filename: string;
  pages: number[];
  url: string;
  snippet?: string | null;
  primary_page?: number | null;
  primaryPage?: number | null;
};

export type Citation = {
  sentence_index: number;
  source_ids: number[];
};

export type QueryResponse = {
  answer: string;
  citations: Citation[];
  sources: SourceInfo[];
};

export type NotebookEntry = {
  id: string;
  question: string;
  answer: string;
  label_id?: number | null;
  document_id?: number | null;
  document_ids?: string[] | null;
  sources?: Record<string, unknown>[] | null;
  created_at: string;
};

const buildUrl = (path: string) => `${BACKEND_URL}${path}`;

const readError = async (res: Response): Promise<string> => {
  try {
    const data = await res.json();
    if (data && typeof data.detail === "string") {
      return `${res.status} ${data.detail}`;
    }
  } catch {
    // ignore
  }
  return `${res.status} ${res.statusText}`;
};

const ensureOk = async <T>(res: Response): Promise<T> => {
  if (!res.ok) {
    throw new Error(await readError(res));
  }
  return (await res.json()) as T;
};

export const listDocuments = async (): Promise<DocumentInfo[]> => {
  const res = await fetch(buildUrl("/documents"));
  return ensureOk<DocumentInfo[]>(res);
};

export const uploadGuides = async (files: File[]): Promise<void> => {
  const form = new FormData();
  files.forEach((file) => form.append("files", file));
  const res = await fetch(buildUrl("/upload-guides"), {
    method: "POST",
    body: form,
  });
  await ensureOk(res);
};

export const deleteDocument = async (filename: string): Promise<void> => {
  const res = await fetch(buildUrl(`/documents/${encodeURIComponent(filename)}`), {
    method: "DELETE",
  });
  await ensureOk(res);
};

export const listLabels = async (): Promise<Label[]> => {
  const res = await fetch(buildUrl("/labels"));
  return ensureOk<Label[]>(res);
};

export const createLabel = async (name: string, documentIds: number[]): Promise<Label> => {
  const res = await fetch(buildUrl("/labels"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, document_ids: documentIds }),
  });
  return ensureOk<Label>(res);
};

export const updateLabel = async (id: number, name: string, documentIds: number[]): Promise<Label> => {
  const res = await fetch(buildUrl(`/labels/${id}`), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, document_ids: documentIds }),
  });
  return ensureOk<Label>(res);
};

export const askQuestion = async (
  question: string,
  documentIds?: string[],
  labelId?: string
): Promise<QueryResponse> => {
  const payload: Record<string, unknown> = { question };
  if (labelId) {
    payload.label_id = labelId;
  } else if (documentIds && documentIds.length > 0) {
    payload.document_ids = documentIds;
  }
  const res = await fetch(buildUrl("/query"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await ensureOk<QueryResponse>(res);
  data.sources = data.sources.map((src) => ({
    ...src,
    primaryPage: src.primaryPage ?? src.primary_page ?? null,
  }));
  return data;
};

export const saveNotebookEntry = async (payload: {
  question: string;
  answer: string;
  labelId?: string;
  documentIds?: string[];
  sources?: Record<string, unknown>[];
}): Promise<NotebookEntry> => {
  const res = await fetch(buildUrl("/notebook"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question: payload.question,
      answer: payload.answer,
      label_id: payload.labelId,
      document_ids: payload.documentIds,
      sources: payload.sources,
    }),
  });
  return ensureOk<NotebookEntry>(res);
};

export const listNotebook = async (): Promise<NotebookEntry[]> => {
  const res = await fetch(buildUrl("/notebook"));
  return ensureOk<NotebookEntry[]>(res);
};

export const deleteNotebookEntry = async (id: string): Promise<void> => {
  const res = await fetch(buildUrl(`/notebook/${encodeURIComponent(id)}`), {
    method: "DELETE",
  });
  await ensureOk(res);
};
