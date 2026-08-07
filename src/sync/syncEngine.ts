import type { Document } from '../types/document';
import type {
  SyncApiClient,
  SyncPushItem,
  SyncState,
} from './types';
import {
  applyTombstones,
  deleteDocLocal,
  deleteOutboxEntry,
  getDocLocal,
  getMetaNumber,
  loadDocsLocal,
  loadOutbox,
  saveDocsLocal,
  saveTombstoneLocal,
  setMetaNumber,
  upsertDocLocal,
  upsertOutboxEntry,
} from './db';
import { createSyncApiClient, getSyncApiUrl } from './apiClient';

const LEGACY_STORAGE_KEY = 'driver-documents';
const SYNC_CURSOR_KEY = 'sync-cursor';
const FLUSH_DEBOUNCE_MS = 3000;
const SYNC_INTERVAL_MS = 15 * 60 * 1000;
const RETRY_BACKOFF_MS = 30 * 1000;

export interface SyncSnapshot {
  documents: Document[];
  state: SyncState;
  outboxCount: number;
  hasServer: boolean;
}

type Listener = (snapshot: SyncSnapshot) => void;

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

class SyncEngine {
  private api: SyncApiClient | null;
  private hasServer: boolean;
  private documents: Document[] = [];
  private state: SyncState = 'idle';
  private listeners = new Set<Listener>();
  private initialized = false;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private syncing = false;

  constructor() {
    const url = getSyncApiUrl();
    this.hasServer = Boolean(url);
    this.api = url ? createSyncApiClient() : null;
  }

  getSnapshot(): SyncSnapshot {
    return {
      documents: this.documents,
      state: this.state,
      outboxCount: 0,
      hasServer: this.hasServer,
    };
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    await this.migrateLegacyData();
    this.documents = await loadDocsLocal();
    this.broadcast();

    window.addEventListener('online', this.handleOnline);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);

    if (this.hasServer) {
      setInterval(() => {
        void this.syncNow();
      }, SYNC_INTERVAL_MS);
    }

    // Trigger pull on startup and flush any leftover offline writes.
    await this.syncNow();
  }

  async addDocument(doc: Document): Promise<void> {
    await this.applyLocalUpsert(doc);
  }

  async updateDocument(doc: Document): Promise<void> {
    await this.applyLocalUpsert(doc);
  }

  async deleteDocument(id: string): Promise<void> {
    const deletedAt = Date.now();
    await deleteDocLocal(id);
    await saveTombstoneLocal({ id, deletedAt });
    await upsertOutboxEntry({
      documentId: id,
      action: 'delete',
      updatedAt: deletedAt,
      queuedAt: deletedAt,
      deletedAt,
    });
    this.documents = this.documents.filter((doc) => doc.id !== id);
    this.broadcast();
    this.scheduleFlush();
  }

  async syncNow(): Promise<void> {
    if (this.syncing || !this.api) return;

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.setState('offline');
      this.scheduleRetry();
      return;
    }

    this.syncing = true;
    this.setState('syncing');
    try {
      await this.pushOutbox();
      await this.pullAll();
      this.setState('idle');
    } catch (error) {
      const offline = typeof navigator !== 'undefined' && !navigator.onLine;
      this.setState(offline ? 'offline' : 'error');
      this.scheduleRetry();
    } finally {
      this.syncing = false;
    }
  }

  private async applyLocalUpsert(doc: Document): Promise<void> {
    await upsertDocLocal(doc);
    await upsertOutboxEntry({
      documentId: doc.id,
      action: 'upsert',
      updatedAt: doc.updatedAt,
      queuedAt: Date.now(),
    });

    const exists = this.documents.some((existing) => existing.id === doc.id);
    this.documents = exists
      ? this.documents.map((existing) => (existing.id === doc.id ? doc : existing))
      : [...this.documents, doc];
    this.broadcast();
    this.scheduleFlush();
  }

  private scheduleFlush(): void {
    if (!this.api) return;
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      void this.syncNow();
    }, FLUSH_DEBOUNCE_MS);
  }

  private scheduleRetry(): void {
    if (!this.api || this.retryTimer) return;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.syncNow();
    }, RETRY_BACKOFF_MS);
  }

  private handleOnline = (): void => {
    if (!this.api) return;
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    void this.syncNow();
  };

  private handleVisibilityChange = (): void => {
    if (document.visibilityState !== 'visible') return;
    if (!this.api) return;
    void this.syncNow();
  };

  private async pushOutbox(): Promise<void> {
    const outbox = await loadOutbox();
    if (outbox.length === 0) return;

    const outboxById = new Map(outbox.map((entry) => [entry.documentId, entry]));

    const items: SyncPushItem[] = [];
    for (const entry of outbox) {
      if (entry.action === 'delete') {
        items.push({
          id: entry.documentId,
          updatedAt: entry.updatedAt,
          deleted: true,
          deletedAt: entry.deletedAt,
        });
        continue;
      }
      const doc = await getDocLocal(entry.documentId);
      if (doc) {
        items.push({ id: doc.id, updatedAt: doc.updatedAt, document: doc });
      }
    }

    const response = await this.api!.push(items);

    for (const id of response.accepted) {
      await deleteOutboxEntry(id);
      outboxById.delete(id);
    }

    // Conflicts carry the resolved state; adopt it and drop the queued write.
    for (const conflict of response.conflicts) {
      const entry = outboxById.get(conflict.id);
      if (!entry) continue;
      if (conflict.document) {
        const serverDoc = conflict.document;
        const pending = outboxById.get(serverDoc.id);
        const localDoc = this.documents.find((doc) => doc.id === serverDoc.id);
        if (!pending || serverDoc.updatedAt >= pending.updatedAt) {
          await upsertDocLocal(serverDoc);
          this.documents = localDoc
            ? this.documents.map((doc) => (doc.id === serverDoc.id ? serverDoc : doc))
            : [...this.documents, serverDoc];
        }
      } else {
        await deleteDocLocal(conflict.id);
        await saveTombstoneLocal({ id: conflict.id, deletedAt: Date.now() });
        this.documents = this.documents.filter((doc) => doc.id !== conflict.id);
      }
      await deleteOutboxEntry(conflict.id);
      outboxById.delete(conflict.id);
    }

    // Recompute outbox count for the snapshot.
    this.broadcast();
  }

  private async pullAll(): Promise<void> {
    let cursor = (await getMetaNumber(SYNC_CURSOR_KEY)) ?? 0;
    let hasMore = true;

    while (hasMore) {
      const page = await this.api!.pull(cursor);
      const outbox = await loadOutbox();
      const outboxById = new Map(outbox.map((entry) => [entry.documentId, entry]));

      for (const item of page.items) {
        const pending = outboxById.get(item.id);
        if (pending && pending.updatedAt > item.updatedAt) continue; // local newer
        await this.applyRemoteDoc(item);
      }

      if (page.tombstones.length > 0) {
        const filtered = page.tombstones.filter((tombstone) => {
          const pending = outboxById.get(tombstone.id);
          return !(pending && pending.updatedAt > tombstone.deletedAt);
        });
        if (filtered.length > 0) {
          await applyTombstones(filtered);
          const tombstonedIds = new Set(filtered.map((t) => t.id));
          this.documents = this.documents.filter((doc) => !tombstonedIds.has(doc.id));
        }
      }

      cursor = page.nextCursor;
      hasMore = page.hasMore;

      // Safety: never loop forever if the server echoes stale cursors.
      if (page.items.length === 0 && page.tombstones.length === 0 && !page.hasMore) {
        hasMore = false;
      }
    }

    await setMetaNumber(SYNC_CURSOR_KEY, cursor);
    this.broadcast();
  }

  private async applyRemoteDoc(doc: Document): Promise<void> {
    await upsertDocLocal(doc);
    const exists = this.documents.some((existing) => existing.id === doc.id);
    this.documents = exists
      ? this.documents.map((existing) => (existing.id === doc.id ? doc : existing))
      : [...this.documents, doc];
  }

  private migrateLegacyData = async (): Promise<void> => {
    if (typeof localStorage === 'undefined') return;
    const existing = await loadDocsLocal();
    if (existing.length > 0) return;

    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return;

    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const legacyDocs = parsed.filter(isDocumentLike);
        if (legacyDocs.length > 0) {
          await saveDocsLocal(legacyDocs);
          this.documents = legacyDocs;
        }
      }
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      // Corrupt legacy data — ignore and start fresh.
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    }
  };

  private setState(next: SyncState): void {
    if (this.state === next) return;
    this.state = next;
    this.broadcast();
  }

  private broadcast(): void {
    const snapshot: SyncSnapshot = {
      documents: this.documents,
      state: this.state,
      outboxCount: 0,
      hasServer: this.hasServer,
    };
    this.listeners.forEach((listener) => listener(snapshot));
  }
}

let engine: SyncEngine | null = null;

export function getSyncEngine(): SyncEngine {
  if (!engine) {
    engine = new SyncEngine();
  }
  return engine;
}

export type { Listener };
