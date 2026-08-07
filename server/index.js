import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { connectDb, initDb } from './db.js';

const PORT = Number(process.env.PORT ?? 3001);
const AUTH_TOKEN = process.env.AUTH_TOKEN ?? '';
const TIE_WINDOW_MS = 2000;
const DEFAULT_LIMIT = 100;

function isDocument(value) {
  if (!value || typeof value !== 'object') return false;
  const doc = value;
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

function requireAuth(req, res, next) {
  if (!AUTH_TOKEN) return next();
  const header = req.headers.authorization ?? '';
  if (header !== `Bearer ${AUTH_TOKEN}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

function toRow(doc) {
  return [
    doc.id,
    doc.type,
    doc.title,
    doc.issueDate,
    doc.expiryDate,
    doc.notes ?? null,
    doc.createdAt,
    doc.updatedAt,
  ];
}

function fromRow(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    issueDate: row.issue_date,
    expiryDate: row.expiry_date,
    notes: row.notes ?? undefined,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/sync/push', requireAuth, async (req, res) => {
  const { items } = req.body ?? {};
  if (!Array.isArray(items) || items.length > 200) {
    return res.status(400).json({ error: 'items trebuie să fie un array de max 200 elemente' });
  }

  const db = await connectDb();
  const accepted = [];
  const conflicts = [];
  const serverNow = Date.now();

  try {
    await db.query('BEGIN');

    const ids = items.map((item) => item.id);
    const existingResult = await db.query(
      'select id, updated_at from public.documents where id = any($1)',
      [ids]
    );
    const existingById = new Map(existingResult.rows.map((row) => [row.id, Number(row.updated_at)]));

    for (const item of items) {
      const existingUpdatedAt = existingById.get(item.id);

      if (item.deleted) {
        const deletedAt = typeof item.deletedAt === 'number' ? item.deletedAt : serverNow;

        if (existingUpdatedAt !== undefined && existingUpdatedAt > deletedAt) {
          const existingResult = await db.query(
            'select * from public.documents where id = $1',
            [item.id]
          );
          if (existingResult.rows[0]) {
            conflicts.push({
              id: item.id,
              kind: 'server-wins',
              document: fromRow(existingResult.rows[0]),
            });
            continue;
          }
        }

        await db.query('delete from public.documents where id = $1', [item.id]);
        await db.query(
          `insert into public.tombstones (id, deleted_at)
           values ($1, $2)
           on conflict (id) do update set deleted_at = excluded.deleted_at`,
          [item.id, deletedAt]
        );
        accepted.push(item.id);
        continue;
      }

      const doc = item.document;
      if (!isDocument(doc)) {
        await db.query('ROLLBACK');
        return res.status(400).json({ error: `Document invalid pentru id ${item.id}` });
      }

      if (existingUpdatedAt !== undefined && existingUpdatedAt > doc.updatedAt) {
        const existingResult = await db.query(
          'select * from public.documents where id = $1',
          [doc.id]
        );
        if (existingResult.rows[0]) {
          conflicts.push({
            id: item.id,
            kind: 'server-wins',
            document: fromRow(existingResult.rows[0]),
          });
          continue;
        }
      }

      if (
        existingUpdatedAt !== undefined &&
        Math.abs(existingUpdatedAt - doc.updatedAt) <= TIE_WINDOW_MS
      ) {
        const existingResult = await db.query(
          'select * from public.documents where id = $1',
          [doc.id]
        );
        if (existingResult.rows[0]) {
          const resolved = { ...fromRow(existingResult.rows[0]), updatedAt: serverNow };
          await db.query(
            `insert into public.documents (id, type, title, issue_date, expiry_date, notes, created_at, updated_at)
             values ($1, $2, $3, $4, $5, $6, $7, $8)
             on conflict (id) do update set
               type = excluded.type,
               title = excluded.title,
               issue_date = excluded.issue_date,
               expiry_date = excluded.expiry_date,
               notes = excluded.notes,
               updated_at = excluded.updated_at`,
            toRow(resolved)
          );
          conflicts.push({ id: item.id, kind: 'server-wins', document: resolved });
          continue;
        }
      }

      await db.query(
        `insert into public.documents (id, type, title, issue_date, expiry_date, notes, created_at, updated_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8)
         on conflict (id) do update set
           type = excluded.type,
           title = excluded.title,
           issue_date = excluded.issue_date,
           expiry_date = excluded.expiry_date,
           notes = excluded.notes,
           updated_at = excluded.updated_at`,
        toRow(doc)
      );
      await db.query('delete from public.tombstones where id = $1', [doc.id]);
      accepted.push(item.id);
    }

    await db.query('COMMIT');
    res.json({ accepted, conflicts, serverNow });
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('[sync/push] error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal error' });
  }
});

app.get('/sync', requireAuth, async (req, res) => {
  const since = Number(req.query.since ?? 0);
  const limit = Math.min(Number(req.query.limit ?? DEFAULT_LIMIT), 500);

  if (!Number.isFinite(since) || since < 0) {
    return res.status(400).json({ error: 'since trebuie să fie un număr >= 0' });
  }
  if (!Number.isFinite(limit) || limit <= 0) {
    return res.status(400).json({ error: 'limit trebuie să fie un număr pozitiv' });
  }

  try {
    const db = await connectDb();

    const docsResult = await db.query(
      'select * from public.documents where updated_at > $1 order by updated_at asc limit $2',
      [since, limit + 1]
    );

    const tombstonesResult = await db.query(
      'select * from public.tombstones where deleted_at > $1 order by deleted_at asc limit $2',
      [since, limit + 1]
    );

    const changes = [
      ...docsResult.rows.map((row) => ({ ts: Number(row.updated_at), doc: fromRow(row) })),
      ...tombstonesResult.rows.map((row) => ({
        ts: Number(row.deleted_at),
        tombstone: { id: row.id, deletedAt: Number(row.deleted_at) },
      })),
    ].sort((a, b) => a.ts - b.ts);

    const page = changes.slice(0, limit);
    const pageItems = page.filter((c) => c.doc).map((c) => c.doc);
    const pageTombstones = page.filter((c) => c.tombstone).map((c) => c.tombstone);
    const nextCursor = page.length > 0 ? Math.max(...page.map((c) => c.ts)) : since;
    const hasMore = changes.length > limit;

    res.json({
      items: pageItems,
      tombstones: pageTombstones,
      nextCursor,
      hasMore,
    });
  } catch (error) {
    console.error('[sync] error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal error' });
  }
});

await initDb();
app.listen(PORT, () => {
  console.log(`[sync-server] listening on http://localhost:${PORT}`);
});
