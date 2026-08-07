import type { Document } from '../types/document';

export type SyncAction = 'upsert' | 'delete';

export interface OutboxEntry {
  documentId: string;
  action: SyncAction;
  updatedAt: number;
  queuedAt: number;
  deletedAt?: number;
}

export interface SyncPushItem {
  id: string;
  updatedAt: number;
  deleted?: boolean;
  deletedAt?: number;
  document?: Document;
}

export type SyncConflictKind = 'server-wins' | 'client-wins';

export interface SyncConflict {
  id: string;
  kind: SyncConflictKind;
  document: Document | null;
}

export interface SyncPushResponse {
  accepted: string[];
  conflicts: SyncConflict[];
  serverNow: number;
}

export interface SyncTombstone {
  id: string;
  deletedAt: number;
}

export interface SyncPullResponse {
  items: Document[];
  tombstones: SyncTombstone[];
  nextCursor: number;
  hasMore: boolean;
}

export interface SyncApiClient {
  push(items: SyncPushItem[]): Promise<SyncPushResponse>;
  pull(since: number, limit?: number): Promise<SyncPullResponse>;
}

export type SyncState = 'idle' | 'syncing' | 'offline' | 'error';
