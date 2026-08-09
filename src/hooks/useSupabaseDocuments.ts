import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Document } from '../types/document';
import { supabase } from '../lib/supabaseClient';

function toFriendlyMessage(message: string): string {
  if (/invalid input syntax for type uuid/i.test(message)) {
    return 'ID-ul documentului nu este valid. Încearcă să adaugi din nou documentul.';
  }
  if (/duplicate key value violates unique constraint/i.test(message)) {
    return 'Documentul există deja. Reîncarcă pagina și încearcă din nou.';
  }
  if (/row-level security/i.test(message)) {
    return 'Nu ai permisiunea de a modifica acest document.';
  }
  if (/could not find file|the resource was not found/i.test(message)) {
    return 'Resursa nu a fost găsită. Verifică conexiunea și încearcă din nou.';
  }
  if (/jwt|invalid api key|unauthorized/i.test(message)) {
    return 'Autentificarea a eșuat. Reautentifică-te și încearcă din nou.';
  }
  return message;
}

interface DocumentRow {
  id: string;
  type: Document['type'];
  title: string;
  issue_date: string;
  expiry_date: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  attachment_path: string | null;
}

function toDocument(row: DocumentRow): Document {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    issueDate: row.issue_date,
    expiryDate: row.expiry_date,
    notes: row.notes ?? undefined,
    attachmentPath: row.attachment_path ?? undefined,
    createdAt: Date.parse(row.created_at),
    updatedAt: Date.parse(row.updated_at),
  };
}

export interface UseSupabaseDocumentsResult {
  documents: Document[];
  isReady: boolean;
  error: string | null;
  addDocument: (doc: Document) => Promise<void>;
  updateDocument: (doc: Document) => Promise<void>;
  deleteDocument: (id: string) => Promise<void>;
}

export function useSupabaseDocuments(): UseSupabaseDocumentsResult {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDocuments = useCallback(async () => {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .order('expiry_date', { ascending: true });

    if (error) {
      setError(toFriendlyMessage(error.message));
      return;
    }

    const rows = (data ?? []) as unknown as DocumentRow[];
    setDocuments(rows.map(toDocument));
    setError(null);
  }, []);

  useEffect(() => {
    void loadDocuments().finally(() => setIsReady(true));
  }, [loadDocuments]);

  const addDocument = useCallback(
    async (doc: Document) => {
      const { error } = await supabase.from('documents').insert({
        id: doc.id,
        type: doc.type,
        title: doc.title,
        issue_date: doc.issueDate,
        expiry_date: doc.expiryDate,
        notes: doc.notes ?? null,
        attachment_path: doc.attachmentPath ?? null,
        created_at: new Date(doc.createdAt).toISOString(),
        updated_at: new Date(doc.updatedAt).toISOString(),
      });
      if (error) {
        setError(toFriendlyMessage(error.message));
        return;
      }
      await loadDocuments();
    },
    [loadDocuments]
  );

  const updateDocument = useCallback(
    async (doc: Document) => {
      const { error } = await supabase
        .from('documents')
        .update({
          type: doc.type,
          title: doc.title,
          issue_date: doc.issueDate,
          expiry_date: doc.expiryDate,
          notes: doc.notes ?? null,
          attachment_path: doc.attachmentPath ?? null,
          updated_at: new Date(doc.updatedAt).toISOString(),
        })
        .eq('id', doc.id);
      if (error) {
        setError(toFriendlyMessage(error.message));
        return;
      }
      await loadDocuments();
    },
    [loadDocuments]
  );

  const deleteDocument = useCallback(
    async (id: string) => {
      const { error } = await supabase.from('documents').delete().eq('id', id);
      if (error) {
        setError(toFriendlyMessage(error.message));
        return;
      }
      await loadDocuments();
    },
    [loadDocuments]
  );

  return useMemo(
    () => ({ documents, isReady, error, addDocument, updateDocument, deleteDocument }),
    [documents, isReady, error, addDocument, updateDocument, deleteDocument]
  );
}
