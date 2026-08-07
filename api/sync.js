import 'dotenv/config';
import { connectDb } from '../server/db.js';
import {
  pullChanges,
  requireAuth,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} from '../server/sync.js';
import { jsonResponse, corsHeaders } from './_utils.js';

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

  if (req.method !== 'GET') {
    jsonResponse(res, { error: 'Method not allowed' }, 405);
    return;
  }

  const authHeader = req.headers.authorization ?? '';
  if (!requireAuth(authHeader, AUTH_TOKEN)) {
    jsonResponse(res, { error: 'Unauthorized' }, 401);
    return;
  }

  const since = Number(req.query?.since ?? 0);
  const limit = Math.min(Number(req.query?.limit ?? DEFAULT_LIMIT), MAX_LIMIT);

  if (!Number.isFinite(since) || since < 0) {
    jsonResponse(res, { error: 'since trebuie să fie un număr >= 0' }, 400);
    return;
  }
  if (!Number.isFinite(limit) || limit <= 0) {
    jsonResponse(res, { error: 'limit trebuie să fie un număr pozitiv' }, 400);
    return;
  }

  try {
    const db = await connectDb();
    const result = await pullChanges(db, since, limit);
    jsonResponse(res, result);
  } catch (error) {
    console.error('[api/sync] error:', error);
    jsonResponse(
      res,
      { error: error instanceof Error ? error.message : 'Internal error' },
      500
    );
  }
}
