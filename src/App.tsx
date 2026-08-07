import { useEffect, useMemo, useState } from 'react';
import type { Document } from './types/document';
import AddDocumentModal from './components/AddDocumentModal';
import DocumentCard from './components/DocumentCard';
import { useTheme } from './contexts/ThemeContext';
import {
  checkAndSendNotifications,
  clearNotificationCacheForDocument,
  getNotificationPermission,
  requestNotificationPermission,
} from './utils/notificationService';
import {
  getDocumentsExpiringThisMonthCount,
  sortDocumentsByUrgency,
} from './utils/documentUtils';
import { useSyncEngine } from './sync/useSyncEngine';

function SunIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function MoonIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

const SYNC_STATE_LABELS: Record<string, string> = {
  idle: 'Sincronizat',
  syncing: 'Se sincronizează…',
  offline: 'Offline',
  error: 'Eroare sincronizare',
};

export default function App() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState<Document | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | null>(null);
  const { theme, toggleTheme } = useTheme();

  const {
    documents,
    state: syncState,
    hasServer,
    isReady,
    addDocument,
    updateDocument,
    deleteDocument,
    syncNow,
  } = useSyncEngine();

  useEffect(() => {
    setPermission(getNotificationPermission());
  }, []);

  useEffect(() => {
    if (!isReady) return;
    void checkAndSendNotifications(documents);
  }, [documents, isReady]);

  const sortedDocuments = useMemo(
    () => sortDocumentsByUrgency(documents),
    [documents]
  );

  const expiringThisMonth = useMemo(
    () => getDocumentsExpiringThisMonthCount(documents),
    [documents]
  );

  function handleAddClick() {
    setEditingDocument(null);
    setIsModalOpen(true);
  }

  function handleEdit(document: Document) {
    setEditingDocument(document);
    setIsModalOpen(true);
  }

  async function handleSave(document: Document) {
    const exists = documents.some((d) => d.id === document.id);
    if (exists) {
      clearNotificationCacheForDocument(document.id);
      await updateDocument(document);
    } else {
      await addDocument(document);
    }
  }

  async function handleDelete(id: string) {
    if (window.confirm('Sigur dorești să ștergi acest document?')) {
      clearNotificationCacheForDocument(id);
      await deleteDocument(id);
    }
  }

  async function handleEnableNotifications() {
    try {
      const result = await requestNotificationPermission();
      setPermission(result);
      if (result === 'granted') {
        await checkAndSendNotifications(documents);
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Eroare la activarea notificărilor.');
    }
  }

  const statusLabel = SYNC_STATE_LABELS[syncState] ?? 'Sincronizat';

  return (
    <div className="min-h-screen bg-zinc-50 pb-24 transition-colors duration-200 dark:bg-zinc-950">
      <header className="sticky top-0 z-30 border-b-2 border-black bg-zinc-50/95 px-4 py-4 backdrop-blur transition-colors duration-200 dark:border-white dark:bg-zinc-950/95">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-black uppercase tracking-tight text-zinc-900 dark:text-zinc-100">
              Driver Documents
            </h1>
            <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Gestionare documente șofer
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-black bg-white text-zinc-900 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all duration-100 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none dark:border-white dark:bg-zinc-900 dark:text-zinc-100 dark:shadow-[3px_3px_0px_0px_rgba(255,255,255,1)] dark:hover:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)]"
              aria-label={theme === 'light' ? 'Comută la modul întunecat' : 'Comută la modul luminos'}
            >
              {theme === 'light' ? <MoonIcon className="h-5 w-5" /> : <SunIcon className="h-5 w-5" />}
            </button>

            <button
              type="button"
              onClick={handleEnableNotifications}
              className={`rounded-full border-2 px-4 py-2 text-xs font-bold uppercase tracking-wide shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all duration-100 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none dark:shadow-[3px_3px_0px_0px_rgba(255,255,255,1)] dark:hover:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] ${
                permission === 'granted'
                  ? 'border-black bg-black text-white dark:border-white dark:bg-white dark:text-black'
                  : 'border-black bg-white text-zinc-900 dark:border-white dark:bg-zinc-900 dark:text-zinc-100'
              }`}
            >
              {permission === 'granted' ? 'Alerte active' : 'Activează alerte'}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pt-5">
        {hasServer && (
          <div className="mb-5 flex items-center justify-between rounded-2xl border-2 border-black bg-white p-4 text-zinc-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-colors duration-200 dark:border-white dark:bg-zinc-900 dark:text-zinc-100 dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]">
            <div className="flex items-center gap-2">
              <span
                className={`inline-block h-3 w-3 rounded-full border-2 border-black dark:border-white ${
                  syncState === 'syncing'
                    ? 'bg-yellow-400'
                    : syncState === 'offline' || syncState === 'error'
                    ? 'bg-red-500'
                    : 'bg-green-500'
                }`}
              />
              <p className="text-sm font-black uppercase tracking-wide">{statusLabel}</p>
            </div>
            <button
              type="button"
              onClick={() => void syncNow()}
              disabled={syncState === 'syncing'}
              className="rounded-lg border-2 border-black bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-zinc-900 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all duration-100 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-white dark:bg-zinc-900 dark:text-zinc-100 dark:shadow-[3px_3px_0px_0px_rgba(255,255,255,1)] dark:hover:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)]"
            >
              Sincronizează
            </button>
          </div>
        )}

        {expiringThisMonth > 0 && (
          <div className="mb-5 rounded-2xl border-2 border-black bg-white p-4 text-zinc-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-colors duration-200 dark:border-white dark:bg-zinc-900 dark:text-zinc-100 dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]">
            <div className="flex items-start gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <p className="font-black uppercase tracking-tight">Atenție la documente</p>
                <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                  Ai {expiringThisMonth}{' '}
                  {expiringThisMonth === 1 ? 'document care expiră' : 'documente care expiră'} luna
                  aceasta.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-black text-zinc-900 dark:text-zinc-100">
            Documentele tale ({documents.length})
          </h2>
        </div>

        {sortedDocuments.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-zinc-400 bg-white p-8 text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-colors duration-200 dark:border-zinc-600 dark:bg-zinc-900 dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]">
            <div className="mb-3 text-5xl">📁</div>
            <h3 className="text-lg font-black text-zinc-900 dark:text-zinc-100">Niciun document adăugat</h3>
            <p className="mt-1 text-sm font-medium text-zinc-600 dark:text-zinc-400">
              Adaugă primul document pentru a primi alerte înainte de expirare.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedDocuments.map((doc) => (
              <DocumentCard
                key={doc.id}
                document={doc}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </main>

      <button
        type="button"
        onClick={handleAddClick}
        className="fixed bottom-6 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full border-2 border-black bg-black text-3xl text-white shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] transition-all duration-100 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none dark:border-white dark:bg-white dark:text-black dark:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] sm:right-6"
        aria-label="Adaugă document"
      >
        +
      </button>

      <AddDocumentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        editingDocument={editingDocument}
      />
    </div>
  );
}
