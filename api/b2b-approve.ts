import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';

const ALLOWED_ORIGINS = ['https://biteme.one', 'https://www.biteme.one', 'http://localhost:5173'];
function getCorsOrigin(req: VercelRequest): string {
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  if (/^https:\/\/smart-paw-finder[a-z0-9-]*\.vercel\.app$/.test(origin)) return origin;
  return ALLOWED_ORIGINS[0];
}

let cachedToken: string | null = null;
let tokenExpiresAt = 0;
async function getAdminToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt - 5 * 60 * 1000) return cachedToken;
  const shop = process.env.VITE_SHOPIFY_STORE_DOMAIN;
  const clientId = process.env.VITE_SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;
  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId!, client_secret: clientSecret! }),
  });
  if (!res.ok) throw new Error(`Token failed (${res.status})`);
  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiresAt = now + data.expires_in * 1000;
  return cachedToken!;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const cors = getCorsOrigin(req);
  res.setHeader('Access-Control-Allow-Origin', cors);
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-key');
    return res.status(200).end();
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const adminKey = (req.headers['x-admin-key'] as string) || '';
  if (adminKey !== process.env.B2B_ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { id, action, reason } = req.body || {};
  if (!id || !['approve', 'reject'].includes(action)) {
    return res.status(400).json({ error: 'Invalid request.' });
  }
  if (action === 'reject' && !reason?.trim()) {
    return res.status(400).json({ error: 'Rejection reason is required.' });
  }

  const appMeta = await kv.get<any>(`b2b:app:${id}`);
  if (!appMeta) return res.status(404).json({ error: 'Application not found' });

  const newStatus = action === 'approve' ? 'approved' : 'rejected';
  const updated = {
    ...appMeta,
    status: newStatus,
    rejectionReason: action === 'reject' ? reason.trim() : undefined,
    updatedAt: new Date().toISOString(),
  };
  await kv.set(`b2b:app:${id}`, updated);

  try {
    const token = await getAdminToken();
    const shop = process.env.VITE_SHOPIFY_STORE_DOMAIN;
    const custRes = await fetch(`https://${shop}/admin/api/2025-07/graphql.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
      body: JSON.stringify({
        query: `query($q:String!){customers(first:1,query:$q){edges{node{id}}}}`,
        variables: { q: `email:${appMeta.email}` },
      }),
    });
    const custData = await custRes.json();
    const customerId = custData.data?.customers?.edges?.[0]?.node?.id;
    if (customerId) {
      await fetch(`https://${shop}/admin/api/2025-07/graphql.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
        body: JSON.stringify({
          query: `mutation($id:ID!,$tags:[String!]!){tagsRemove(id:$id,tags:$tags){userErrors{message}}}`,
          variables: { id: customerId, tags: ['B2B-pending'] },
        }),
      });
      if (action === 'approve') {
        await fetch(`https://${shop}/admin/api/2025-07/graphql.json`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
          body: JSON.stringify({
            query: `mutation($id:ID!,$tags:[String!]!){tagsAdd(id:$id,tags:$tags){userErrors{message}}}`,
            variables: { id: customerId, tags: ['B2B-approved'] },
          }),
        });
      }
    }
  } catch (e) {
    console.error('[B2B Approve] Shopify tag error:', e);
  }

  return res.status(200).json({ success: true, status: newStatus });
}
