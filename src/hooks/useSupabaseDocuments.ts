import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Document } from '../types/document';
import { supabase } from '../lib/supabaseClient';
import { removeDocumentScan } from '../utils/storageService';

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

export function useSupabaseDocuments(
  userId: string | null
): UseSupabaseDocumentsResult {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keeps the latest userId addressable from the stable realtime subscription
  // callback without re-subscribing on every user change.
  const userIdRef = useRef<string | null>(userId);
  userIdRef.current = userId;

  const loadDocuments = useCallback(async () => {
    const client = supabase;
    if (!client) return;

    const { data, error } = await client
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

  // Reset local state whenever the authenticated user changes so that one
  // account's documents can never leak into another account's session.
  useEffect(() => {
    setIsReady(false);
    setDocuments([]);
    setError(null);
    void loadDocuments().finally(() => setIsReady(true));
  }, [loadDocuments, userId]);

  // Real-time sync: apply inserts/updates/deletes pushed by Supabase instead
  // of waiting for a manual page reload. RLS filters the stream server-side,
  // so only this user's documents arrive.
  useEffect(() => {
    const client = supabase;
    if (!client) return;

    const channel = client
      .channel('documents-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'documents' },
        (payload) => {
          const currentUserId = userIdRef.current;
          if (!currentUserId) return;

          if (payload.eventType === 'INSERT') {
            const row = payload.new as DocumentRow;
            setDocuments((prev) => {
              if (prev.some((doc) => doc.id === row.id)) return prev;
              return [...prev, toDocument(row)].sort(
                (a, b) =>
                  Date.parse(a.expiryDate) - Date.parse(b.expiryDate)
              );
            });
          } else if (payload.eventType === 'UPDATE') {
            const row = payload.new as DocumentRow;
            setDocuments((prev) =>
              prev.map((doc) => (doc.id === row.id ? toDocument(row) : doc))
            );
          } else if (payload.eventType === 'DELETE') {
            const row = payload.old as DocumentRow;
            setDocuments((prev) => prev.filter((doc) => doc.id !== row.id));
          }
        }
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, []);

  // Helpers throw on failure so callers (e.g. the modal) can react, while the
  // friendly error text is still surfaced in the banner through setError.
  function fail(message: string): never {
    const friendly = toFriendlyMessage(message);
    setError(friendly);
    throw new Error(friendly);
  }

  const addDocument = useCallback(
    async (doc: Document) => {
      const client = supabase;
      if (!client) return fail('Aplicația nu este configurată corect.');

      const { error } = await client.from('documents').insert({
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
      if (error) fail(error.message);
      await loadDocuments();
    },
    [loadDocuments]
  );

  const updateDocument = useCallback(
    async (doc: Document) => {
      const client = supabase;
      if (!client) return fail('Aplicația nu este configurată corect.');

      const { error } = await client
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
      if (error) fail(error.message);
      await loadDocuments();
    },
    [loadDocuments]
  );

  const deleteDocument = useCallback(
    async (id: string) => {
      const client = supabase;
      if (!client) return fail('Aplicația nu este configurată corect.');

      // Remove the scan from storage first so a failed delete below can't
      // orphan the file. If the storage delete fails the document row is
      // kept too — the user can retry.
      const manifest = documents.find((doc) => doc.id === id);
      if (manifest?.attachmentPath) {
        try {
          await removeDocumentScan(id);
        } catch {
          return fail(
            'Scanul atașat nu a putut fi șters din stocare. Încearcă din nou.'
          );
        }
      }

      const { error } = await client.from('documents').delete().eq('id', id);
      if (error) fail(error.message);
      await loadDocuments();
    },
    [documents, loadDocuments]
  );

  return useMemo(
    () => ({ documents, isReady, error, addDocument, updateDocument, deleteDocument }),
    [documents, isReady, error, addDocument, updateDocument, deleteDocument]
  );
}
