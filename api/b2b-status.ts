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
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const email = req.query.email as string;
  if (!email) return res.status(200).json({ status: 'none' });

  const appId = await kv.get<string>(`b2b:email:${email.toLowerCase()}`);
  if (!appId) return res.status(200).json({ status: 'none' });

  const app = await kv.get<any>(`b2b:app:${appId}`);
  if (!app) return res.status(200).json({ status: 'none' });

  return res.status(200).json({
    status: app.status,
    rejectionReason: app.rejectionReason || null,
    companyName: app.companyName,
    createdAt: app.createdAt,
  });
}
