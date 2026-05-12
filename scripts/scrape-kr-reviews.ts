/**
 * biteme.co.kr 리뷰 스크래퍼 (Crema API 직접 호출 방식)
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
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const REVIEWS_DIR = join(DATA_DIR, 'reviews');
const CREMA_HOST = 'review6.cre.ma';
const SHOP_CODE = 'biteme.co.kr';
const WIDGET_ID = '25';

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

  while (reviews.length < 50) {
    const params = new URLSearchParams({
      secure_device_token: token,
      product_code: productCd,
      widget_id: WIDGET_ID,
      page: String(page),
      fields: 'reviews.evaluation_properties',
    });

    const res = await fetch(
      `https://${CREMA_HOST}/api/${SHOP_CODE}/reviews?${params}`,
      { headers: { 'Accept': 'application/json' } }
    );

    if (!res.ok) break;
    const data = await res.json();
    const rawList: Record<string, unknown>[] = data.reviews || [];

    if (rawList.length === 0) break;

    for (const item of rawList) {
      const id = String(item.id);
      if (seenIds.has(id)) continue;
      seenIds.add(id);

      const review = parseCremaReview(item);
      if (review) reviews.push(review);
      if (reviews.length >= 50) break;
    }

    const pagy = data.pagy as Record<string, unknown> | undefined;
    if (!pagy?.next) break;

    page++;
    await new Promise(r => setTimeout(r, 300));
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

async function scrapeReviews(productCd: string): Promise<ProductReviewData> {
  process.stdout.write(`  [${productCd}] getting token...`);
  const token = await getCremaToken(productCd);

  if (!token) {
    console.log(' failed (no token)');
    return { product_cd: productCd, scraped_at: new Date().toISOString(), total: 0, reviews: [] };
  }

  process.stdout.write(' fetching reviews...');
  const reviews = await fetchAllReviews(token, productCd);
  console.log(` ${reviews.length} reviews`);

  return {
    product_cd: productCd,
    scraped_at: new Date().toISOString(),
    total: reviews.length,
    reviews,
  };
}

let targetCodes: string[] = [];
const args = process.argv.slice(2);

if (args.length > 0) {
  targetCodes = args;
} else {
  const mappingPath = join(DATA_DIR, 'product-mapping.json');
  if (!existsSync(mappingPath)) {
    console.error('data/product-mapping.json not found. Run apply-sheet-mapping.ts first.');
    process.exit(1);
  }
  const mapping: { kr_product_cd: string | null; confidence: string }[] =
    JSON.parse(readFileSync(mappingPath, 'utf-8'));
  targetCodes = [...new Set(
    mapping
      .filter(m => m.kr_product_cd && m.confidence !== 'no_match')
      .map(m => m.kr_product_cd!)
  )];
  console.log(`Loaded ${targetCodes.length} targets from mapping`);
}

if (!existsSync(REVIEWS_DIR)) mkdirSync(REVIEWS_DIR, { recursive: true });

console.log(`Scraping reviews (${targetCodes.length} products)...`);
let done = 0;
for (const productCd of targetCodes) {
  const data = await scrapeReviews(productCd);
  writeFileSync(
    join(REVIEWS_DIR, `${productCd}.json`),
    JSON.stringify(data, null, 2),
    'utf-8'
  );
  done++;
  console.log(`  progress: ${done}/${targetCodes.length}`);
}

console.log(`\nDone: ${done} products -> data/reviews/`);
