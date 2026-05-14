import { writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const SHOP = process.env.VITE_SHOPIFY_STORE_DOMAIN;
const CLIENT_ID = process.env.VITE_SHOPIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET;

if (!SHOP || !CLIENT_ID || !CLIENT_SECRET) {
  console.warn('[sync-og-image] Missing Shopify env vars, skipping OG image sync');
  process.exit(0);
}

const BANNER_QUERY = `{
  metaobjects(type: "main_banner", first: 1) {
    edges { node { fields { key value reference { ... on MediaImage { image { url } } } } } }
  }
}`;

async function getAccessToken() {
  const res = await fetch(`https://${SHOP}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: CLIENT_ID, client_secret: CLIENT_SECRET }),
  });
  if (!res.ok) throw new Error(`Token failed: ${res.status}`);
  return (await res.json()).access_token;
}

async function run() {
  console.log('[sync-og-image] Fetching first main_banner from Shopify...');
  const token = await getAccessToken();

  const gqlRes = await fetch(`https://${SHOP}/api/2025-07/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Shopify-Storefront-Private-Token': token },
    body: JSON.stringify({ query: BANNER_QUERY }),
  });

  const data = await gqlRes.json();
  const fields = data?.data?.metaobjects?.edges?.[0]?.node?.fields;
  const imgField = fields?.find(f => f.key === 'img');
  const imageUrl = imgField?.reference?.image?.url;

  if (!imageUrl) {
    console.warn('[sync-og-image] No banner image found, skipping');
    process.exit(0);
  }

  console.log(`[sync-og-image] Downloading: ${imageUrl}`);
  const imgRes = await fetch(imageUrl);
  const buffer = Buffer.from(await imgRes.arrayBuffer());
  writeFileSync(join(ROOT, 'public', 'og-image.jpg'), buffer);

  const dims = parseJpegDimensions(buffer);
  if (dims) {
    console.log(`[sync-og-image] Image size: ${dims.width}x${dims.height}`);
    const indexPath = join(ROOT, 'index.html');
    let html = readFileSync(indexPath, 'utf-8');
    html = html.replace(/og:image:width" content="\d+"/, `og:image:width" content="${dims.width}"`);
    html = html.replace(/og:image:height" content="\d+"/, `og:image:height" content="${dims.height}"`);
    writeFileSync(indexPath, html);
  }

  console.log('[sync-og-image] Done');
}

function parseJpegDimensions(buf) {
  let i = 2;
  while (i < buf.length - 1) {
    if (buf[i] !== 0xff) break;
    const marker = buf[i + 1];
    if (marker === 0xc0 || marker === 0xc2) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    if (marker === 0xd9) break;
    const len = buf.readUInt16BE(i + 2);
    i += 2 + len;
  }
  return null;
}

run().catch(err => {
  console.error('[sync-og-image] Error:', err.message);
  process.exit(0);
});
