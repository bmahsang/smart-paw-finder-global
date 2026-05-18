/**
 * 기존 리뷰 JSON에 영상 URL만 병합하는 스크립트
 * - 기존 content_en 번역 유지
 * - 새로 스크랩한 데이터에서 ID 매칭되는 리뷰의 videos 필드만 복사
 */

import { chromium } from '@playwright/test';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const REVIEWS_DIR = join(DATA_DIR, 'reviews');
const CREMA_HOST = 'review6.cre.ma';
const SHOP_CODE = 'biteme.co.kr';
const WIDGET_ID = '25';
const MAX_REVIEWS = 50;

async function getCremaToken(productCd: string): Promise<string | null> {
  const url = `https://www.biteme.co.kr/shop/product/product_view?product_cd=${productCd}`;
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();
  let token: string | null = null;

  page.on('request', (req) => {
    if (req.url().includes(CREMA_HOST)) {
      const match = req.url().match(/secure_device_token=([^&]+)/);
      if (match) token = match[1];
    }
  });

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
  } finally {
    await browser.close();
  }
  return token;
}

async function fetchVideoMap(token: string, productCd: string): Promise<Map<string, string[]>> {
  const videoMap = new Map<string, string[]>();
  let page = 1;
  let count = 0;

  while (count < MAX_REVIEWS) {
    const params = new URLSearchParams({
      secure_device_token: token,
      product_code: productCd,
      widget_id: WIDGET_ID,
      page: String(page),
    });

    const res = await fetch(
      `https://${CREMA_HOST}/api/${SHOP_CODE}/reviews?${params}`,
      { headers: { Accept: 'application/json' } }
    );

    if (!res.ok) break;
    const data = await res.json();
    const rawList: Record<string, unknown>[] = data.reviews || [];
    if (rawList.length === 0) break;

    for (const item of rawList) {
      const id = String(item.id || '');
      const vidList = item.videos as Record<string, unknown>[] | undefined;
      if (id && Array.isArray(vidList) && vidList.length > 0) {
        const urls: string[] = [];
        for (const vid of vidList) {
          const src = String(vid.url || vid.video_url || vid.source_url || '');
          if (src) urls.push(src);
        }
        if (urls.length > 0) videoMap.set(id, urls);
      }
      count++;
      if (count >= MAX_REVIEWS) break;
    }

    const pagy = data.pagy as Record<string, unknown> | undefined;
    if (!pagy?.next) break;
    page++;
    await new Promise((r) => setTimeout(r, 300));
  }

  return videoMap;
}

// --- Main ---
const mappingPath = join(DATA_DIR, 'review-product-mapping.json');
const mapping: { product_cd: string | null }[] = JSON.parse(readFileSync(mappingPath, 'utf-8'));
const targetCodes = [...new Set(mapping.filter(m => m.product_cd).map(m => m.product_cd!))];

console.log(`Merging videos for ${targetCodes.length} products...\n`);

console.log('Getting Crema token...');
let token: string | null = null;
for (const cd of targetCodes) {
  token = await getCremaToken(cd);
  if (token) { console.log(`  Token acquired via ${cd}\n`); break; }
}
if (!token) { console.error('Failed to get token'); process.exit(1); }

let merged = 0;
let totalVideos = 0;

for (const productCd of targetCodes) {
  const filePath = join(REVIEWS_DIR, `${productCd}.json`);
  if (!existsSync(filePath)) {
    console.log(`  [${productCd}] no existing file, skipping`);
    continue;
  }

  process.stdout.write(`  [${productCd}] fetching videos...`);
  const videoMap = await fetchVideoMap(token!, productCd);

  if (videoMap.size === 0) {
    console.log(' 0 videos');
    // Still ensure all reviews have videos field
    const existing = JSON.parse(readFileSync(filePath, 'utf-8'));
    let changed = false;
    for (const r of existing.reviews) {
      if (!r.videos) { r.videos = []; changed = true; }
    }
    if (changed) writeFileSync(filePath, JSON.stringify(existing, null, 2), 'utf-8');
    await new Promise((r) => setTimeout(r, 500));
    continue;
  }

  const existing = JSON.parse(readFileSync(filePath, 'utf-8'));
  let matched = 0;
  for (const r of existing.reviews) {
    const vids = videoMap.get(r.id);
    if (vids) { r.videos = vids; matched++; totalVideos += vids.length; }
    else if (!r.videos) { r.videos = []; }
  }

  writeFileSync(filePath, JSON.stringify(existing, null, 2), 'utf-8');
  merged++;
  console.log(` ${videoMap.size} reviews with videos, ${matched} matched to existing`);

  await new Promise((r) => setTimeout(r, 500));
}

console.log(`\nDone: ${merged} products updated, ${totalVideos} total video URLs merged`);
