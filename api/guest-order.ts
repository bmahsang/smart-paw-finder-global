import type { VercelRequest, VercelResponse } from '@vercel/node';

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

let cachedAdminToken: string | null = null;
let adminTokenExpiresAt: number = 0;

async function getAdminToken(): Promise<string> {
  const now = Date.now();
  if (cachedAdminToken && now < adminTokenExpiresAt - 5 * 60 * 1000) {
    return cachedAdminToken;
  }

  const shop = process.env.VITE_SHOPIFY_STORE_DOMAIN;
  const clientId = process.env.VITE_SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;

  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId!,
      client_secret: clientSecret!,
    }),
  });

  if (!response.ok) {
    throw new Error(`Token request failed (${response.status})`);
  }

  const data = await response.json();
  cachedAdminToken = data.access_token;
  adminTokenExpiresAt = now + data.expires_in * 1000;
  return cachedAdminToken!;
}

const ORDERS_BY_EMAIL_QUERY = `
  query OrdersByEmail($query: String!) {
    orders(first: 10, query: $query, sortKey: PROCESSED_AT, reverse: true) {
      edges {
        node {
          id
          name
          email
          processedAt
          displayFinancialStatus
          displayFulfillmentStatus
          totalPriceSet { shopMoney { amount currencyCode } }
          statusPageUrl
          shippingAddress { city province countryCode }
          fulfillments(first: 5) {
            trackingInfo { company number url }
          }
          lineItems(first: 10) {
            edges {
              node {
                title
                quantity
                image { url }
              }
            }
          }
        }
      }
    }
  }
`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const corsOrigin = getCorsOrigin(req);
  res.setHeader('Access-Control-Allow-Origin', corsOrigin);

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, orderNumber } = req.body || {};

  if (!email || !orderNumber) {
    return res.status(400).json({ success: false, error: 'Email and order number are required.' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ success: false, error: 'Invalid email format.' });
  }

  const cleanOrderNumber = orderNumber.replace(/^#/, '').trim();
  if (!cleanOrderNumber) {
    return res.status(400).json({ success: false, error: 'Invalid order number.' });
  }

  try {
    const adminToken = await getAdminToken();
    const shop = process.env.VITE_SHOPIFY_STORE_DOMAIN;

    const queryString = `email:${email} name:#${cleanOrderNumber}`;

    const response = await fetch(`https://${shop}/admin/api/2025-07/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': adminToken,
      },
      body: JSON.stringify({
        query: ORDERS_BY_EMAIL_QUERY,
        variables: { query: queryString },
      }),
    });

    if (!response.ok) {
      return res.status(500).json({ success: false, error: 'Failed to query orders.' });
    }

    const data = await response.json();

    if (data.errors) {
      console.error('[Guest Order] GraphQL errors:', data.errors);
      return res.status(500).json({ success: false, error: 'Failed to query orders.' });
    }

    const orders = (data.data?.orders?.edges || []).map((edge: any) => {
      const node = edge.node;
      return {
        id: node.id,
        name: node.name,
        processedAt: node.processedAt,
        financialStatus: node.displayFinancialStatus,
        fulfillmentStatus: node.displayFulfillmentStatus,
        totalPrice: node.totalPriceSet.shopMoney,
        statusPageUrl: node.statusPageUrl,
        shippingAddress: node.shippingAddress ? {
          city: node.shippingAddress.city,
          province: node.shippingAddress.province,
          country: node.shippingAddress.countryCode,
        } : null,
        fulfillments: (node.fulfillments || []).map((f: any) => {
          const info = f.trackingInfo?.[0] || {};
          return {
            trackingCompany: info.company || null,
            trackingNumber: info.number || null,
            trackingUrl: info.url || null,
          };
        }),
        lineItems: (node.lineItems?.edges || []).map((li: any) => ({
          title: li.node.title,
          quantity: li.node.quantity,
          image: li.node.image,
        })),
      };
    });

    if (orders.length === 0) {
      return res.status(404).json({ success: false, error: 'No order found. Please check your email and order number.' });
    }

    return res.status(200).json({ success: true, orders });
  } catch (error) {
    console.error('[Guest Order] Error:', error);
    return res.status(500).json({ success: false, error: 'Failed to look up order. Please try again.' });
  }
}
