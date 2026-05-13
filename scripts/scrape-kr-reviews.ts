/**
 * biteme.co.kr 리뷰 스크래퍼 (토큰 최소화 버전)
 *
 * 최적화:
 *  - 단일 Playwright 세션으로 1회 Crema 토큰 취득 후 전체 제품에 재사용
 *  - review-product-mapping.json 기반 (Claude API 매칭 불필요)
 *  - 증분 크롤링: 기존 리뷰 파일이 24시간 이내면 스킵
 *
 * 사용법 A (매핑 파일 기반, 권장):
 *   npx tsx scripts/scrape-kr-reviews.ts
 *
 * 사용법 B (특정 상품만):
 *   npx tsx scripts/scrape-kr-reviews.ts 1000048009 1000003740
 *
 * 결과: data/reviews/{product_cd}.json
 */

import { chromium } from '@playwright/test';
import { writeFileSync, mkdirSync, existsSync, readFileSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const REVIEWS_DIR = join(DATA_DIR, 'reviews');
const CREMA_HOST = 'review6.cre.ma';
const SHOP_CODE = 'biteme.co.kr';
const WIDGET_ID = '25';
const MAX_REVIEWS_PER_PRODUCT = 50;
const SKIP_IF_RECENT_HOURS = 24;

export interface ScrapedReview {
  id: string;
  rating: number;
  name: string;
  content: string;
  date: string;
  images: string[];
}

export interface ProductReviewData {
  product_cd: string;
  scraped_at: string;
  total: number;
  reviews: ScrapedReview[];
}

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

async function fetchAllReviews(token: string, productCd: string): Promise<ScrapedReview[]> {
  const reviews: ScrapedReview[] = [];
  const seenIds = new Set<string>();
  let page = 1;

  while (reviews.length < MAX_REVIEWS_PER_PRODUCT) {
    const params = new URLSearchParams({
      secure_device_token: token,
      product_code: productCd,
      widget_id: WIDGET_ID,
      page: String(page),
      fields: 'reviews.evaluation_properties',
    });

    const res = await fetch(
      `https://${CREMA_HOST}/api/${SHOP_CODE}/reviews?${params}`,
      { headers: { Accept: 'application/json' } }
    );

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) return reviews;
      break;
    }

    const data = await res.json();
    const rawList: Record<string, unknown>[] = data.reviews || [];

    if (rawList.length === 0) break;

    for (const item of rawList) {
      const id = String(item.id);
      if (seenIds.has(id)) continue;
      seenIds.add(id);

      const review = parseCremaReview(item);
      if (review) reviews.push(review);
      if (reviews.length >= MAX_REVIEWS_PER_PRODUCT) break;
    }

    const pagy = data.pagy as Record<string, unknown> | undefined;
    if (!pagy?.next) break;

    page++;
    await new Promise((r) => setTimeout(r, 300));
  }

  return reviews;
}

function parseCremaReview(item: Record<string, unknown>): ScrapedReview | null {
  const id = String(item.id || '');
  const rating = Number(item.score || 0);
  const name = String(item.user_display_name || '').trim();
  const content = String(item.filtered_message || item.message || '').trim();
  const date = String(item.created_at || '').trim();

  const images: string[] = [];
  const imgList = item.images as Record<string, unknown>[] | undefined;
  if (Array.isArray(imgList)) {
    for (const img of imgList) {
      const src = String(img.url || img.gallery_url || '');
      if (src) images.push(src);
    }
  }

  if (!id) return null;
  return { id, rating, name, content, date, images };
}

function isRecentFile(filePath: string, hours: number): boolean {
  if (!existsSync(filePath)) return false;
  const stat = statSync(filePath);
  const ageMs = Date.now() - stat.mtimeMs;
  return ageMs < hours * 3600 * 1000;
}

// --- Main ---

let targetCodes: string[] = [];
const args = process.argv.slice(2);

if (args.length > 0) {
  targetCodes = args;
} else {
  const mappingPath = join(DATA_DIR, 'review-product-mapping.json');
  if (!existsSync(mappingPath)) {
    console.error('data/review-product-mapping.json not found. Run discover-product-cd.ts first.');
    process.exit(1);
  }
  const mapping: { product_cd: string | null; sku_name: string }[] = JSON.parse(
    readFileSync(mappingPath, 'utf-8')
  );
  targetCodes = [
    ...new Set(mapping.filter((m) => m.product_cd).map((m) => m.product_cd!)),
  ];
  console.log(`Loaded ${targetCodes.length} targets from review-product-mapping.json`);
}

if (!existsSync(REVIEWS_DIR)) mkdirSync(REVIEWS_DIR, { recursive: true });

// Skip recently scraped products
const toScrape = targetCodes.filter((cd) => {
  const file = join(REVIEWS_DIR, `${cd}.json`);
  if (isRecentFile(file, SKIP_IF_RECENT_HOURS)) {
    console.log(`  [${cd}] skipped (scraped within ${SKIP_IF_RECENT_HOURS}h)`);
    return false;
  }
  return true;
});

console.log(`\nScraping ${toScrape.length} products (${targetCodes.length - toScrape.length} skipped)...\n`);

if (toScrape.length === 0) {
  console.log('Nothing to scrape.');
  process.exit(0);
}

// Get ONE Crema token using the first valid product
console.log('Getting Crema token (single browser session)...');
let token: string | null = null;
for (const cd of toScrape) {
  token = await getCremaToken(cd);
  if (token) {
    console.log(`  Token acquired via product ${cd}\n`);
    break;
  }
}

if (!token) {
  console.error('Failed to get Crema token from any product.');
  process.exit(1);
}

// Scrape all products with the single token
let done = 0;
let totalReviews = 0;
let tokenExpired = false;

for (const productCd of toScrape) {
  if (tokenExpired) {
    console.log(`  Token expired, re-acquiring...`);
    token = await getCremaToken(productCd);
    if (!token) {
      console.log(`  [${productCd}] failed to re-acquire token, skipping`);
      continue;
    }
    tokenExpired = false;
    console.log(`  New token acquired`);
  }

  process.stdout.write(`  [${productCd}] fetching reviews...`);
  const reviews = await fetchAllReviews(token!, productCd);

  if (reviews.length === 0) {
    // Check if token expired by trying a known product
    const testParams = new URLSearchParams({
      secure_device_token: token!,
      product_code: productCd,
      widget_id: WIDGET_ID,
      page: '1',
    });
    const testRes = await fetch(
      `https://${CREMA_HOST}/api/${SHOP_CODE}/reviews?${testParams}`,
      { headers: { Accept: 'application/json' } }
    );
    if (testRes.status === 401 || testRes.status === 403) {
      tokenExpired = true;
      console.log(' token expired, will retry');
      continue;
    }
  }

  const data: ProductReviewData = {
    product_cd: productCd,
    scraped_at: new Date().toISOString(),
    total: reviews.length,
    reviews,
  };

  writeFileSync(join(REVIEWS_DIR, `${productCd}.json`), JSON.stringify(data, null, 2), 'utf-8');
  done++;
  totalReviews += reviews.length;
  console.log(` ${reviews.length} reviews (${done}/${toScrape.length})`);

  await new Promise((r) => setTimeout(r, 500));
}

console.log(`\nDone: ${done} products, ${totalReviews} reviews -> data/reviews/`);
