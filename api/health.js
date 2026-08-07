import { jsonResponse, corsHeaders } from './_utils.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    for (const [key, value] of Object.entries(corsHeaders)) {
      res.setHeader(key, value);
    }
    res.end('ok');
    return;
  }

  jsonResponse(res, { ok: true });
}
