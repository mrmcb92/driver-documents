import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { connectDb, initDb } from './db.js';
import {
  pullChanges,
  pushItems,
  requireAuth,
  isDocument,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  MAX_PUSH_ITEMS,
} from './sync.js';

const PORT = Number(process.env.PORT ?? 3001);
const AUTH_TOKEN = process.env.AUTH_TOKEN ?? '';

function authMiddleware(req, res, next) {
  if (!requireAuth(req.headers.authorization ?? '', AUTH_TOKEN)) {
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

app.post('/sync/push', authMiddleware, async (req, res) => {
  const { items } = req.body ?? {};
  if (!Array.isArray(items) || items.length === 0 || items.length > MAX_PUSH_ITEMS) {
    return res.status(400).json({
      error: `items trebuie să fie un array de max ${MAX_PUSH_ITEMS} elemente`,
    });
  }

  const db = await connectDb();
  try {
    await db.query('BEGIN');
    const result = await pushItems(db, items);
    await db.query('COMMIT');
    res.json(result);
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('[sync/push] error:', error);
    const status = error.message?.startsWith('Document invalid') ? 400 : 500;
    res.status(status).json({ error: error instanceof Error ? error.message : 'Internal error' });
  }
});

app.get('/sync', authMiddleware, async (req, res) => {
  const since = Number(req.query.since ?? 0);
  const limit = Math.min(Number(req.query.limit ?? DEFAULT_LIMIT), MAX_LIMIT);

  if (!Number.isFinite(since) || since < 0) {
    return res.status(400).json({ error: 'since trebuie să fie un număr >= 0' });
  }
  if (!Number.isFinite(limit) || limit <= 0) {
    return res.status(400).json({ error: 'limit trebuie să fie un număr pozitiv' });
  }

  try {
    const db = await connectDb();
    const result = await pullChanges(db, since, limit);
    res.json(result);
  } catch (error) {
    console.error('[sync] error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal error' });
  }
});

await initDb();
app.listen(PORT, () => {
  console.log(`[sync-server] listening on http://localhost:${PORT}`);
});
