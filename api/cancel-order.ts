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

const VERIFY_CUSTOMER_ORDER_QUERY = `
  query VerifyCustomerOrder {
    customer {
      orders(first: 50, sortKey: PROCESSED_AT, reverse: true) {
        edges {
          node {
            id
            financialStatus
            fulfillmentStatus
          }
        }
      }
    }
  }
`;

async function verifyOrderOwnership(
  customerAccountToken: string,
  orderId: string,
): Promise<{ owned: boolean; cancellable: boolean }> {
  const shopId = process.env.VITE_SHOPIFY_SHOP_ID;
  const response = await fetch(
    `https://shopify.com/${shopId}/account/customer/api/2025-07/graphql`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': customerAccountToken,
      },
      body: JSON.stringify({ query: VERIFY_CUSTOMER_ORDER_QUERY }),
    },
  );

  if (!response.ok) return { owned: false, cancellable: false };

  const data = await response.json();
  const orders = data.data?.customer?.orders?.edges || [];

  const targetIdClean = orderId.split('?')[0];
  const match = orders.find(
    (e: any) => e.node.id.split('?')[0] === targetIdClean,
  );

  if (!match) return { owned: false, cancellable: false };

  const cancellable =
    match.node.financialStatus === 'PAID' &&
    (!match.node.fulfillmentStatus || match.node.fulfillmentStatus === 'UNFULFILLED');

  return { owned: true, cancellable };
}

const ORDER_CANCEL_MUTATION = `
  mutation orderCancel($orderId: ID!, $reason: OrderCancelReason!, $refund: Boolean!, $restock: Boolean!, $staffNote: String) {
    orderCancel(orderId: $orderId, reason: $reason, refund: $refund, restock: $restock, staffNote: $staffNote) {
      job { id done }
      orderCancelUserErrors { field message code }
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

  const { orderId, customerAccountToken } = req.body || {};

  if (!orderId || !customerAccountToken) {
    return res.status(400).json({ success: false, error: 'Missing orderId or customerAccountToken' });
  }

  try {
    const { owned, cancellable } = await verifyOrderOwnership(customerAccountToken, orderId);

    if (!owned) {
      return res.status(403).json({ success: false, error: 'Order not found for this account' });
    }
    if (!cancellable) {
      return res.status(400).json({ success: false, error: 'This order cannot be cancelled. Only paid, unfulfilled orders are eligible.' });
    }

    const adminToken = await getAdminToken();
    const shop = process.env.VITE_SHOPIFY_STORE_DOMAIN;
    const adminOrderId = orderId.split('?')[0];

    const response = await fetch(`https://${shop}/admin/api/2025-07/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': adminToken,
      },
      body: JSON.stringify({
        query: ORDER_CANCEL_MUTATION,
        variables: {
          orderId: adminOrderId,
          reason: 'CUSTOMER',
          refund: true,
          restock: true,
          staffNote: 'Cancelled by customer via My Page',
        },
      }),
    });

    const data = await response.json();
    const errors = data.data?.orderCancel?.orderCancelUserErrors || [];

    if (errors.length > 0) {
      return res.status(400).json({ success: false, error: errors.map((e: any) => e.message).join(', ') });
    }

    if (data.errors) {
      return res.status(400).json({ success: false, error: data.errors.map((e: any) => e.message).join(', ') });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('[Cancel Order] Error:', error);
    return res.status(500).json({ success: false, error: 'Failed to cancel order. Please try again.' });
  }
}
