import 'dotenv/config';
import { connectDb } from '../../server/db.js';
import { pushItems, requireAuth, MAX_PUSH_ITEMS } from '../../server/sync.js';
import { jsonResponse, corsHeaders, readBody } from '../_utils.js';

const AUTH_TOKEN = process.env.AUTH_TOKEN ?? '';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    for (const [key, value] of Object.entries(corsHeaders)) {
      res.setHeader(key, value);
    }
    res.end('ok');
    return;
  }

  if (req.method !== 'POST') {
    jsonResponse(res, { error: 'Method not allowed' }, 405);
    return;
  }

  const authHeader = req.headers.authorization ?? '';
  if (!requireAuth(authHeader, AUTH_TOKEN)) {
    jsonResponse(res, { error: 'Unauthorized' }, 401);
    return;
  }

  let body;
  try {
    body = await readBody(req);
  } catch {
    jsonResponse(res, { error: 'Body JSON invalid' }, 400);
    return;
  }

  const { items } = body ?? {};
  if (!Array.isArray(items) || items.length === 0 || items.length > MAX_PUSH_ITEMS) {
    jsonResponse(
      res,
      { error: `items trebuie să fie un array de max ${MAX_PUSH_ITEMS} elemente` },
      400
    );
    return;
  }

  const db = await connectDb();
  try {
    await db.query('BEGIN');
    const result = await pushItems(db, items);
    await db.query('COMMIT');
    jsonResponse(res, result);
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('[api/sync/push] error:', error);
    const status = error.message?.startsWith('Document invalid') ? 400 : 500;
    jsonResponse(
      res,
      { error: error instanceof Error ? error.message : 'Internal error' },
      status
    );
  }
}
