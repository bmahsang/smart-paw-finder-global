import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';

const ALLOWED_ORIGINS = ['https://biteme.one', 'https://www.biteme.one', 'http://localhost:5173'];
function getCorsOrigin(req: VercelRequest): string {
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  if (/^https:\/\/smart-paw-finder[a-z0-9-]*\.vercel\.app$/.test(origin)) return origin;
  return ALLOWED_ORIGINS[0];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const cors = getCorsOrigin(req);
  res.setHeader('Access-Control-Allow-Origin', cors);
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-key');
    return res.status(200).end();
  }
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const adminKey = (req.headers['x-admin-key'] as string) || '';
  if (adminKey !== process.env.B2B_ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const id = req.query.id as string;
  if (!id) return res.status(400).json({ error: 'Missing id' });

  const [appMeta, docData] = await Promise.all([
    kv.get(`b2b:app:${id}`),
    kv.get(`b2b:doc:${id}`),
  ]);

  if (!appMeta) return res.status(404).json({ error: 'Application not found' });

  return res.status(200).json({
    application: { ...(appMeta as any), document: docData },
  });
}
