import type { VercelRequest, VercelResponse } from '@vercel/node';

const SHOP_ID = process.env.VITE_SHOPIFY_SHOP_ID;
const TOKEN_ENDPOINT = `https://shopify.com/authentication/${SHOP_ID}/oauth/token`;

const ALLOWED_ORIGINS = [
  'https://biteme.one',
  'https://www.biteme.one',
  'http://localhost:5173',
];

function isAllowedOrigin(origin: string): boolean {
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (/^https:\/\/smart-paw-finder[a-z0-9-]*\.vercel\.app$/.test(origin)) return true;
  return false;
}

function getCorsOrigin(req: VercelRequest): string {
  const origin = req.headers.origin || '';
  return isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const corsOrigin = getCorsOrigin(req);

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', corsOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { grant_type, code, redirect_uri, code_verifier, refresh_token } = req.body || {};
  const clientId = process.env.VITE_SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID;

  if (!clientId || !SHOP_ID) {
    return res.status(500).json({ error: 'Missing server configuration' });
  }

  const body = new URLSearchParams({ grant_type, client_id: clientId });

  if (grant_type === 'authorization_code') {
    if (!code || !redirect_uri || !code_verifier) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    body.set('code', code);
    body.set('redirect_uri', redirect_uri);
    body.set('code_verifier', code_verifier);
  } else if (grant_type === 'refresh_token') {
    if (!refresh_token) {
      return res.status(400).json({ error: 'Missing refresh_token' });
    }
    body.set('refresh_token', refresh_token);
  } else {
    return res.status(400).json({ error: 'Unsupported grant_type' });
  }

  try {
    const response = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    const data = await response.text();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', corsOrigin);
    return res.status(response.status).send(data);
  } catch (error) {
    console.error('[Customer Token Proxy] Error:', error);
    return res.status(500).json({ error: 'Token exchange failed' });
  }
}
