import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, 'data.json');
const PORT = Number(process.env.PORT ?? 3001);
const AUTH_TOKEN = process.env.AUTH_TOKEN ?? '';
const TIE_WINDOW_MS = 2000;
const DEFAULT_LIMIT = 100;

/**
 * Storage layout:
 * {
 *   documents: { [id]: Document },
 *   tombstones: { [id]: { id, deletedAt } }
 * }
 */
let storage = { documents: {}, tombstones: {} };

function loadStorage() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      storage.documents = parsed.documents ?? {};
      storage.tombstones = parsed.tombstones ?? {};
    }
  } catch {
    // Corrupt data file — start fresh.
    storage = { documents: {}, tombstones: {} };
  }
}

function saveStorage() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(storage, null, 2));
}

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

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/sync/push', requireAuth, (req, res) => {
  const { items } = req.body ?? {};
  if (!Array.isArray(items) || items.length > 200) {
    return res.status(400).json({ error: 'items trebuie să fie un array de max 200 elemente' });
  }

  const accepted = [];
  const conflicts = [];
  const serverNow = Date.now();

  for (const item of items) {
    const existing = storage.documents[item.id];

    if (item.deleted) {
      const deletedAt = typeof item.deletedAt === 'number' ? item.deletedAt : serverNow;
      // Delete-vs-edit: a newer edit on the server wins over the delete.
      if (existing && existing.updatedAt > deletedAt) {
        conflicts.push({ id: item.id, kind: 'server-wins', document: existing });
        continue;
      }
      delete storage.documents[item.id];
      storage.tombstones[item.id] = { id: item.id, deletedAt };
      accepted.push(item.id);
      continue;
    }

    const doc = item.document;
    if (!isDocument(doc)) {
      return res.status(400).json({ error: `Document invalid pentru id ${item.id}` });
    }

    if (existing && existing.updatedAt > doc.updatedAt) {
      conflicts.push({ id: item.id, kind: 'server-wins', document: existing });
      continue;
    }

    // Near-tie resolution: if the incoming write is within the tie window of
    // the existing one, the server wins and stamps a deterministic timestamp.
    if (existing && Math.abs(existing.updatedAt - doc.updatedAt) <= TIE_WINDOW_MS) {
      const resolved = { ...existing, updatedAt: serverNow };
      storage.documents[item.id] = resolved;
      conflicts.push({ id: item.id, kind: 'server-wins', document: resolved });
      continue;
    }

    storage.documents[item.id] = doc;
    delete storage.tombstones[item.id];
    accepted.push(item.id);
  }

  saveStorage();
  res.json({ accepted, conflicts, serverNow });
});

app.get('/sync', requireAuth, (req, res) => {
  const since = Number(req.query.since ?? 0);
  const limit = Math.min(Number(req.query.limit ?? DEFAULT_LIMIT), 500);

  const items = Object.values(storage.documents)
    .filter((doc) => doc.updatedAt > since)
    .sort((a, b) => a.updatedAt - b.updatedAt);

  const tombstones = Object.values(storage.tombstones)
    .filter((t) => t.deletedAt > since)
    .sort((a, b) => a.deletedAt - b.deletedAt);

  const allChanges = [
    ...items.map((doc) => ({ ts: doc.updatedAt, doc })),
    ...tombstones.map((t) => ({ ts: t.deletedAt, tombstone: t })),
  ].sort((a, b) => a.ts - b.ts);

  const page = allChanges.slice(0, limit);
  const pageItems = page.filter((c) => c.doc).map((c) => c.doc);
  const pageTombstones = page.filter((c) => c.tombstone).map((c) => c.tombstone);
  const nextCursor = page.length > 0 ? Math.max(...page.map((c) => c.ts)) : since;
  const hasMore = allChanges.length > limit;

  res.json({
    items: pageItems,
    tombstones: pageTombstones,
    nextCursor,
    hasMore,
  });
});

loadStorage();
app.listen(PORT, () => {
  console.log(`[sync-server] listening on http://localhost:${PORT} (data file: ${DATA_FILE})`);
});
