import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Document } from '../types/document';

const STORAGE_KEY = 'driver-documents';

function loadDocuments(): Document[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown[]) : [];
    return Array.isArray(parsed) ? parsed.filter(isDocumentLike) : [];
  } catch {
    return [];
  }
}

function saveDocuments(docs: Document[]): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
}

function isDocumentLike(value: unknown): value is Document {
  if (!value || typeof value !== 'object') return false;
  const doc = value as Record<string, unknown>;
  return (
    typeof doc.id === 'string' &&
    typeof doc.type === 'string' &&
    typeof doc.title === 'string' &&
    typeof doc.issueDate === 'string' &&
    typeof doc.expiryDate === 'string' &&
    typeof doc.createdAt === 'number' &&
    typeof doc.updatedAt === 'number'
  );
}

export interface UseLocalDocumentsResult {
  documents: Document[];
  isReady: boolean;
  addDocument: (doc: Document) => Promise<void>;
  updateDocument: (doc: Document) => Promise<void>;
  deleteDocument: (id: string) => Promise<void>;
}

export function useLocalDocuments(): UseLocalDocumentsResult {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setDocuments(loadDocuments());
    setIsReady(true);
  }, []);

  useEffect(() => {
    if (isReady) saveDocuments(documents);
  }, [documents, isReady]);

  const addDocument = useCallback(async (doc: Document) => {
    setDocuments((prev) => [...prev, doc]);
  }, []);

  const updateDocument = useCallback(async (doc: Document) => {
    setDocuments((prev) =>
      prev.map((existing) => (existing.id === doc.id ? doc : existing))
    );
  }, []);

  const deleteDocument = useCallback(async (id: string) => {
    setDocuments((prev) => prev.filter((doc) => doc.id !== id));
  }, []);

  return useMemo(
    () => ({ documents, isReady, addDocument, updateDocument, deleteDocument }),
    [documents, isReady, addDocument, updateDocument, deleteDocument]
  );
}
