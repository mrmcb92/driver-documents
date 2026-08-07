import type {
  SyncApiClient,
  SyncPullResponse,
  SyncPushItem,
  SyncPushResponse,
} from './types';

const PUSH_BATCH_LIMIT = 100;
const PULL_PAGE_LIMIT = 100;

const SYNC_API_URL: string | undefined =
  (import.meta.env.VITE_SYNC_API_URL as string | undefined) || undefined;

function buildUrl(path: string): string {
  if (!SYNC_API_URL) {
    throw new Error(
      'URL-ul API-ului de sincronizare nu este configurat. Setează VITE_SYNC_API_URL.'
    );
  }
  return `${SYNC_API_URL.replace(/\/+$/, '')}${path}`;
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `Sync API error ${response.status}`;
    try {
      const body = (await response.json()) as { error?: string; message?: string };
      message = body.error ?? body.message ?? message;
    } catch {
      // non-JSON error body — keep default message
    }
    throw new Error(message);
  }
  return (await response.json()) as T;
}

async function push(items: SyncPushItem[]): Promise<SyncPushResponse> {
  // Idempotency per id: keep only the latest payload per document.
  const latestById = new Map<string, SyncPushItem>();
  items.forEach((item) => {
    const existing = latestById.get(item.id);
    if (!existing || item.updatedAt >= existing.updatedAt) {
      latestById.set(item.id, item);
    }
  });

  const uniqueItems = Array.from(latestById.values());
  const batches: SyncPushItem[][] = [];
  for (let i = 0; i < uniqueItems.length; i += PUSH_BATCH_LIMIT) {
    batches.push(uniqueItems.slice(i, i + PUSH_BATCH_LIMIT));
  }

  if (batches.length === 0) {
    return { accepted: [], conflicts: [], serverNow: Date.now() };
  }

  let accepted: string[] = [];
  let conflicts: SyncPushResponse['conflicts'] = [];
  let serverNow = Date.now();

  for (const batch of batches) {
    const response = await fetch(buildUrl('/sync/push'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: batch }),
    });
    const result = await parseResponse<SyncPushResponse>(response);
    accepted = accepted.concat(result.accepted);
    conflicts = conflicts.concat(result.conflicts);
    serverNow = result.serverNow;
  }

  return { accepted, conflicts, serverNow };
}

async function pull(since: number, limit: number = PULL_PAGE_LIMIT): Promise<SyncPullResponse> {
  const response = await fetch(buildUrl(`/sync?since=${since}&limit=${limit}`), {
    headers: { Accept: 'application/json' },
  });
  return parseResponse<SyncPullResponse>(response);
}

export function createSyncApiClient(): SyncApiClient {
  return { push, pull };
}

export function getSyncApiUrl(): string | undefined {
  return SYNC_API_URL;
}
