import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const SYNC_API_KEY = Deno.env.get('SYNC_API_KEY') ?? '';

const TIE_WINDOW_MS = 2000;
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;
const MAX_PUSH_ITEMS = 200;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

interface DocumentRow {
  id: string;
  type: string;
  title: string;
  issue_date: string;
  expiry_date: string;
  notes: string | null;
  created_at: number;
  updated_at: number;
}

interface TombstoneRow {
  id: string;
  deleted_at: number;
}

interface PushItem {
  id: string;
  updatedAt: number;
  deleted?: boolean;
  deletedAt?: number;
  document?: {
    id: string;
    type: string;
    title: string;
    issueDate: string;
    expiryDate: string;
    notes?: string;
    createdAt: number;
    updatedAt: number;
  };
}

function isDocument(value: unknown): value is NonNullable<PushItem['document']> {
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

function toDocumentRow(doc: NonNullable<PushItem['document']>): DocumentRow {
  return {
    id: doc.id,
    type: doc.type,
    title: doc.title,
    issue_date: doc.issueDate,
    expiry_date: doc.expiryDate,
    notes: doc.notes ?? null,
    created_at: doc.createdAt,
    updated_at: doc.updatedAt,
  };
}

function toApiDocument(row: DocumentRow): NonNullable<PushItem['document']> {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    issueDate: row.issue_date,
    expiryDate: row.expiry_date,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

class BadRequestError extends Error {}

function requireAuth(request: Request): Response | null {
  if (!SYNC_API_KEY) return null; // dezactivat — doar pentru test local
  const header = request.headers.get('authorization') ?? '';
  if (header !== `Bearer ${SYNC_API_KEY}`) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }
  return null;
}

async function pushItems(
  supabase: ReturnType<typeof createClient>,
  items: PushItem[]
): Promise<{ accepted: string[]; conflicts: unknown[]; serverNow: number }> {
  const accepted: string[] = [];
  const conflicts: unknown[] = [];
  const serverNow = Date.now();

  const ids = items.map((item) => item.id);
  const { data: existingRows, error: fetchError } = await supabase
    .from('documents')
    .select('id, updated_at')
    .in('id', ids);

  if (fetchError) throw fetchError;

  const existingById = new Map<string, number>();
  for (const row of existingRows ?? []) {
    existingById.set(row.id, row.updated_at);
  }

  for (const item of items) {
    const existingUpdatedAt = existingById.get(item.id);

    if (item.deleted) {
      const deletedAt = typeof item.deletedAt === 'number' ? item.deletedAt : serverNow;
      if (existingUpdatedAt !== undefined && existingUpdatedAt > deletedAt) {
        const { data: existing } = await supabase
          .from('documents')
          .select('*')
          .eq('id', item.id)
          .maybeSingle();
        if (existing) {
          conflicts.push({ id: item.id, kind: 'server-wins', document: toApiDocument(existing as DocumentRow) });
          continue;
        }
      }
      const { error: deleteError } = await supabase
        .from('documents')
        .delete()
        .eq('id', item.id);
      if (deleteError) throw deleteError;

      const { error: tombstoneError } = await supabase
        .from('tombstones')
        .upsert({ id: item.id, deleted_at: deletedAt });
      if (tombstoneError) throw tombstoneError;

      accepted.push(item.id);
      continue;
    }

    const doc = item.document;
    if (!isDocument(doc)) {
      throw new BadRequestError(`Document invalid pentru id ${item.id}`);
    }

    if (existingUpdatedAt !== undefined && existingUpdatedAt > doc.updatedAt) {
      const { data: existing } = await supabase
        .from('documents')
        .select('*')
        .eq('id', doc.id)
        .maybeSingle();
      if (existing) {
        conflicts.push({ id: item.id, kind: 'server-wins', document: toApiDocument(existing as DocumentRow) });
        continue;
      }
    }

    if (
      existingUpdatedAt !== undefined &&
      Math.abs(existingUpdatedAt - doc.updatedAt) <= TIE_WINDOW_MS
    ) {
      const { data: existing } = await supabase
        .from('documents')
        .select('*')
        .eq('id', doc.id)
        .maybeSingle();
      if (existing) {
        const resolved: DocumentRow = { ...(existing as DocumentRow), updated_at: serverNow };
        const { error: updateError } = await supabase
          .from('documents')
          .upsert(resolved);
        if (updateError) throw updateError;
        conflicts.push({ id: item.id, kind: 'server-wins', document: toApiDocument(resolved) });
        continue;
      }
    }

    const { error: upsertError } = await supabase
      .from('documents')
      .upsert(toDocumentRow(doc));
    if (upsertError) throw upsertError;

    const { error: tombstoneDeleteError } = await supabase
      .from('tombstones')
      .delete()
      .eq('id', doc.id);
    if (tombstoneDeleteError) throw tombstoneDeleteError;

    accepted.push(item.id);
  }

  return { accepted, conflicts, serverNow };
}

async function pullChanges(
  supabase: ReturnType<typeof createClient>,
  since: number,
  limit: number
): Promise<{ items: unknown[]; tombstones: unknown[]; nextCursor: number; hasMore: boolean }> {
  const { data: docRows, error: docsError } = await supabase
    .from('documents')
    .select('*')
    .gt('updated_at', since)
    .order('updated_at', { ascending: true })
    .limit(limit + 1);

  if (docsError) throw docsError;

  const { data: tombstoneRows, error: tombstonesError } = await supabase
    .from('tombstones')
    .select('*')
    .gt('deleted_at', since)
    .order('deleted_at', { ascending: true })
    .limit(limit + 1);

  if (tombstonesError) throw tombstonesError;

  interface Change {
    ts: number;
    doc?: unknown;
    tombstone?: unknown;
  }

  const changes: Change[] = [
    ...(docRows ?? []).map((row) => ({ ts: row.updated_at, doc: toApiDocument(row as DocumentRow) })),
    ...(tombstoneRows ?? []).map((row) => ({ ts: row.deleted_at, tombstone: { id: row.id, deletedAt: row.deleted_at } })),
  ].sort((a, b) => a.ts - b.ts);

  const page = changes.slice(0, limit);
  const pageItems = page.filter((c) => c.doc).map((c) => c.doc);
  const pageTombstones = page.filter((c) => c.tombstone).map((c) => c.tombstone);
  const nextCursor = page.length > 0 ? Math.max(...page.map((c) => c.ts)) : since;
  const hasMore = changes.length > limit;

  return { items: pageItems, tombstones: pageTombstones, nextCursor, hasMore };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const authError = requireAuth(req);
  if (authError) return authError;

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const url = new URL(req.url);

    if (req.method === 'POST' && url.pathname.endsWith('/sync/push')) {
      const body = (await req.json()) as { items?: unknown };
      const items = body.items;
      if (!Array.isArray(items) || items.length === 0 || items.length > MAX_PUSH_ITEMS) {
        return jsonResponse(
          { error: `items trebuie să fie un array de max ${MAX_PUSH_ITEMS} elemente` },
          400
        );
      }
      const result = await pushItems(supabase, items as PushItem[]);
      return jsonResponse(result);
    }

    if (req.method === 'GET' && url.pathname.endsWith('/sync')) {
      const since = Number(url.searchParams.get('since') ?? 0);
      const limit = Number(url.searchParams.get('limit') ?? DEFAULT_LIMIT);
      if (!Number.isFinite(since) || since < 0) {
        return jsonResponse({ error: 'since trebuie să fie un număr >= 0' }, 400);
      }
      if (!Number.isFinite(limit) || limit <= 0) {
        return jsonResponse({ error: 'limit trebuie să fie un număr pozitiv' }, 400);
      }
      const result = await pullChanges(supabase, since, Math.min(limit, MAX_LIMIT));
      return jsonResponse(result);
    }

    return jsonResponse({ error: 'Not found' }, 404);
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : 'Internal error';
    const status = error instanceof BadRequestError ? 400 : 500;
    return jsonResponse({ error: message }, status);
  }
});
