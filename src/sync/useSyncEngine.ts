import { useCallback, useEffect, useState } from 'react';
import type { Document } from '../types/document';
import { getSyncEngine, type SyncSnapshot } from './syncEngine';

export interface UseSyncEngineResult {
  documents: Document[];
  state: SyncSnapshot['state'];
  hasServer: boolean;
  isReady: boolean;
  addDocument: (doc: Document) => Promise<void>;
  updateDocument: (doc: Document) => Promise<void>;
  deleteDocument: (id: string) => Promise<void>;
  syncNow: () => Promise<void>;
}

export function useSyncEngine(): UseSyncEngineResult {
  const engine = getSyncEngine();
  const [snapshot, setSnapshot] = useState<SyncSnapshot>(() => engine.getSnapshot());
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    const unsubscribe = engine.subscribe((next) => {
      if (mounted) setSnapshot(next);
    });

    void engine.init().finally(() => {
      if (mounted) setIsReady(true);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [engine]);

  const addDocument = useCallback(
    (doc: Document) => engine.addDocument(doc),
    [engine]
  );
  const updateDocument = useCallback(
    (doc: Document) => engine.updateDocument(doc),
    [engine]
  );
  const deleteDocument = useCallback(
    (id: string) => engine.deleteDocument(id),
    [engine]
  );
  const syncNow = useCallback(() => engine.syncNow(), [engine]);

  return {
    documents: snapshot.documents,
    state: snapshot.state,
    hasServer: snapshot.hasServer,
    isReady,
    addDocument,
    updateDocument,
    deleteDocument,
    syncNow,
  };
}
