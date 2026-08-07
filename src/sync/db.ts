import type { Document } from '../types/document';
import type { OutboxEntry, SyncTombstone } from './types';

const DB_NAME = 'driver-docs-sync';
const DB_VERSION = 1;

const STORES = {
  DOCS: 'documents',
  OUTBOX: 'outbox',
  META: 'meta',
  TOMBSTONES: 'tombstones',
} as const;

interface MetaRow {
  key: string;
  value: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;

export interface SyncTombstoneRow {
  id: string;
  deletedAt: number;
}

function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORES.DOCS)) {
        const docsStore = db.createObjectStore(STORES.DOCS, { keyPath: 'id' });
        docsStore.createIndex('updatedAt', 'updatedAt');
      }

      if (!db.objectStoreNames.contains(STORES.OUTBOX)) {
        db.createObjectStore(STORES.OUTBOX, { keyPath: 'documentId' });
      }

      if (!db.objectStoreNames.contains(STORES.META)) {
        db.createObjectStore(STORES.META, { keyPath: 'key' });
      }

      if (!db.objectStoreNames.contains(STORES.TOMBSTONES)) {
        db.createObjectStore(STORES.TOMBSTONES, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<any>
): Promise<T> {
  return openDatabase().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const store = tx.objectStore(storeName);
        const request = operation(store);

        request.onsuccess = () => resolve(request.result as T);
        request.onerror = () => reject(request.error);
      })
  );
}

async function readMeta(key: string): Promise<string | undefined> {
  const row = await withStore<MetaRow | undefined>(STORES.META, 'readonly', (store) =>
    store.get(key)
  );
  return row?.value;
}

async function writeMeta(key: string, value: string): Promise<void> {
  await withStore<void>(STORES.META, 'readwrite', (store) =>
    store.put({ key, value } satisfies MetaRow)
  );
}

export async function getMetaNumber(key: string): Promise<number | null> {
  const raw = await readMeta(key);
  if (raw === undefined) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export async function setMetaNumber(key: string, value: number): Promise<void> {
  await writeMeta(key, String(value));
}

export async function loadDocsLocal(): Promise<Document[]> {
  return withStore<Document[]>(STORES.DOCS, 'readonly', (store) => store.getAll());
}

export async function saveDocsLocal(docs: Document[]): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORES.DOCS, 'readwrite');
    const store = tx.objectStore(STORES.DOCS);
    store.clear();
    docs.forEach((doc) => store.put(doc));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function upsertDocLocal(doc: Document): Promise<void> {
  await withStore<void>(STORES.DOCS, 'readwrite', (store) => store.put(doc));
}

export async function deleteDocLocal(id: string): Promise<void> {
  await withStore<void>(STORES.DOCS, 'readwrite', (store) => store.delete(id));
}

export async function getDocLocal(id: string): Promise<Document | undefined> {
  return withStore<Document | undefined>(STORES.DOCS, 'readonly', (store) => store.get(id));
}

export async function loadOutbox(): Promise<OutboxEntry[]> {
  return withStore<OutboxEntry[]>(STORES.OUTBOX, 'readonly', (store) => store.getAll());
}

export async function upsertOutboxEntry(entry: OutboxEntry): Promise<void> {
  await withStore<void>(STORES.OUTBOX, 'readwrite', (store) => store.put(entry));
}

export async function deleteOutboxEntry(documentId: string): Promise<void> {
  await withStore<void>(STORES.OUTBOX, 'readwrite', (store) => store.delete(documentId));
}

export async function clearOutbox(): Promise<void> {
  await withStore<void>(STORES.OUTBOX, 'readwrite', (store) => store.clear());
}

export async function saveTombstoneLocal(tombstone: SyncTombstoneRow): Promise<void> {
  await withStore<void>(STORES.TOMBSTONES, 'readwrite', (store) => store.put(tombstone));
}

export async function applyTombstones(tombstones: SyncTombstone[]): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORES.DOCS, STORES.OUTBOX, STORES.TOMBSTONES], 'readwrite');
    const docsStore = tx.objectStore(STORES.DOCS);
    const outboxStore = tx.objectStore(STORES.OUTBOX);
    const tombstonesStore = tx.objectStore(STORES.TOMBSTONES);

    tombstones.forEach((tombstone) => {
      docsStore.delete(tombstone.id);
      outboxStore.delete(tombstone.id);
      tombstonesStore.put(tombstone);
    });

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearDatabase(): Promise<void> {
  if (!('indexedDB' in window)) return;
  dbPromise = null;
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}
