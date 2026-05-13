/**
 * 리뷰연동 탭의 바코드 스큐 이름으로 biteme.co.kr에서 product_cd를 찾는 스크립트
 * 단일 브라우저 세션으로 모든 검색 수행 (토큰 최소화)
 *
 * npx tsx scripts/discover-product-cd.ts
 */

import { chromium } from '@playwright/test';
import { writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');

interface DiscoveredProduct {
  sku_name: string;
  sheet_no: number[];
  product_cd: string | null;
  full_name: string | null;
  source: string;
}

// 리뷰연동 탭 전체 목록 (kr-products.json 매칭 결과 포함)
const REVIEW_PRODUCTS: DiscoveredProduct[] = [
  { sku_name: '드라이미', sheet_no: [60], product_cd: '1000000757', full_name: '바잇미 마이크로화이버 펫타올 드라이미', source: 'kr-products.json' },
  { sku_name: '장튼튼', sheet_no: [76], product_cd: '1000001377', full_name: '바잇미 닥터이너피스 장튼튼 유산균', source: 'kr-products.json' },
  { sku_name: '버섯 노즈워크', sheet_no: [142], product_cd: null, full_name: null, source: 'unmatched' },
  { sku_name: '베이글쿠키', sheet_no: [231], product_cd: null, full_name: null, source: 'unmatched' },
  { sku_name: '크로와상', sheet_no: [290], product_cd: null, full_name: null, source: 'unmatched' },
  { sku_name: '손가락칫솔', sheet_no: [296], product_cd: '1000031437', full_name: '핏펫 플라고 손가락칫솔 패드', source: 'kr-products.json' },
  { sku_name: '고양이참', sheet_no: [311], product_cd: '1000008117', full_name: '바잇미 고양이참 장난감/키링', source: 'kr-products.json' },
  { sku_name: '양배추 킁킁볼', sheet_no: [312], product_cd: '1000026262', full_name: '바잇미 양배추 킁킁볼 장난감', source: 'kr-products.json' },
  { sku_name: '플레이북-버스데이', sheet_no: [356], product_cd: '1000045750', full_name: '바잇미 마이버스데이 노즈워크 플레이북', source: 'kr-products.json' },
  { sku_name: '뉴 마카롱 방수줄', sheet_no: [357, 358], product_cd: null, full_name: null, source: 'unmatched' },
  { sku_name: '드라이미 미니', sheet_no: [385, 657], product_cd: '1000014311', full_name: '바잇미 마이크로화이버 펫타올 드라이미 미니 (2개입)', source: 'kr-products.json' },
  { sku_name: '크런치팝', sheet_no: [387, 720, 775], product_cd: null, full_name: null, source: 'unmatched' },
  { sku_name: '얼레벌레', sheet_no: [425], product_cd: null, full_name: null, source: 'unmatched' },
  { sku_name: '안티버그 쿨가드 올인원', sheet_no: [441], product_cd: null, full_name: null, source: 'unmatched' },
  { sku_name: '뉴 XO 방수줄', sheet_no: [446, 447], product_cd: '1000037028', full_name: '바잇미 new XO 핸즈프리 워터프루프 목줄&리쉬', source: 'kr-products.json' },
  { sku_name: '컴포트', sheet_no: [482], product_cd: null, full_name: null, source: 'unmatched' },
  { sku_name: '릭매트', sheet_no: [493], product_cd: '1000018908', full_name: '바잇미 실리콘 릭매트', source: 'kr-products.json' },
  { sku_name: '아랑 슬리커', sheet_no: [650], product_cd: '1000006613', full_name: '바잇미 타이니 슬리커 브러쉬', source: 'kr-products.json' },
  { sku_name: '파티카드', sheet_no: [655], product_cd: null, full_name: null, source: 'unmatched' },
  { sku_name: '크런치팝', sheet_no: [720], product_cd: null, full_name: null, source: 'duplicate_387' },
  { sku_name: '덴티스틱', sheet_no: [730, 733], product_cd: null, full_name: null, source: 'unmatched' },
  { sku_name: '헤잇미 밴드', sheet_no: [765, 1012], product_cd: null, full_name: null, source: 'unmatched' },
  { sku_name: '스쿠티 쿨매트', sheet_no: [772], product_cd: '1000037774', full_name: '바잇미X포코리프렌즈 쿨매트', source: 'kr-products.json' },
  { sku_name: '붕어빵 메이커', sheet_no: [774], product_cd: null, full_name: null, source: 'unmatched' },
  { sku_name: '크런치팝', sheet_no: [775], product_cd: null, full_name: null, source: 'duplicate_387' },
  { sku_name: '언더더씨', sheet_no: [818], product_cd: null, full_name: null, source: 'unmatched' },
  { sku_name: '빅터그 오리너구리', sheet_no: [848], product_cd: null, full_name: null, source: 'unmatched' },
  { sku_name: '코인칩-북어', sheet_no: [937], product_cd: null, full_name: null, source: 'unmatched' },
  { sku_name: '오모오모 장난감', sheet_no: [939], product_cd: null, full_name: null, source: 'unmatched' },
  { sku_name: '필소굿 펫티슈', sheet_no: [1024], product_cd: '1000018627', full_name: '바잇미 필소굿 저자극 펫티슈 휴대용 50매 세트', source: 'kr-products.json' },
  { sku_name: '농장타이쿤', sheet_no: [1032], product_cd: '1000035855', full_name: '바잇미 농장타이쿤 노즈워크 장난감', source: 'kr-products.json' },
  { sku_name: '라운드 페이스콤', sheet_no: [1037], product_cd: '1000035324', full_name: '바잇미 젤리곰 라운드 페이스콤', source: 'kr-products.json' },
  { sku_name: '헤잇미 패치 포코리', sheet_no: [1061], product_cd: null, full_name: null, source: 'unmatched' },
  { sku_name: '멜로우백 글로시', sheet_no: [1099], product_cd: null, full_name: null, source: 'unmatched' },
];

async function discoverProductCodes() {
  const unmatched = REVIEW_PRODUCTS.filter(p => p.source === 'unmatched');
  console.log(`\n=== Discovering product_cd for ${unmatched.length} unmatched products ===\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  for (const product of unmatched) {
    const searchTerms = product.sku_name.replace(/[-_]/g, ' ').split(' ').filter(s => s.length >= 2);
    const searchQuery = searchTerms.join(' ');

    console.log(`Searching: "${searchQuery}" (sheet_no: ${product.sheet_no.join(',')})`);

    try {
      const searchUrl = `https://www.biteme.co.kr/shop/product/product_lists?keyword=${encodeURIComponent(searchQuery)}`;
      await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForTimeout(3000);

      // Extract search results from product grid (not sidebar recommendations)
      const results = await page.evaluate((query: string) => {
        const items: { cd: string; name: string; section: string }[] = [];

        // Look for product items within search results section
        const productEls = document.querySelectorAll('.prd_basic_list li, .product_list li, .product_item, [class*="product"] li, .list_product li');

        for (const el of productEls) {
          const link = el.querySelector('a[href*="product_cd="]') as HTMLAnchorElement;
          if (!link) continue;
          const match = link.href.match(/product_cd=(\d+)/);
          if (!match) continue;
          const cd = match[1];

          // Try multiple selectors for product name
          const nameEl = el.querySelector('.prd_name, .name, .product_name, .tit, h3, h4, .title');
          const name = nameEl?.textContent?.trim() || '';

          if (name && !items.find(i => i.cd === cd)) {
            items.push({ cd, name, section: 'list' });
          }
        }

        // Also try getting names from all links with product_cd
        if (items.length === 0) {
          const allLinks = document.querySelectorAll('a[href*="product_cd="]');
          for (const link of allLinks) {
            const href = (link as HTMLAnchorElement).href;
            const match = href.match(/product_cd=(\d+)/);
            if (!match) continue;
            const cd = match[1];
            const text = link.textContent?.trim() || '';
            if (text && text.length > 2 && text.length < 200 && !items.find(i => i.cd === cd)) {
              items.push({ cd, name: text, section: 'fallback' });
            }
          }
        }

        return items;
      }, searchQuery);

      if (results.length > 0) {
        const keywords = searchTerms.filter(k => k.length >= 2);
        // Require "바잇미" in name for PB products, and at least one keyword match
        const bitemePBMatch = results.find(r =>
          r.name.includes('바잇미') && keywords.every(kw => r.name.includes(kw))
        );
        const allKeywordMatch = results.find(r =>
          keywords.every(kw => r.name.includes(kw))
        );
        const partialMatch = results.find(r =>
          keywords.filter(k => k.length >= 3).some(kw => r.name.includes(kw)) && r.name.includes('바잇미')
        );

        const bestMatch = bitemePBMatch || allKeywordMatch || partialMatch;

        if (bestMatch) {
          product.product_cd = bestMatch.cd;
          product.full_name = bestMatch.name;
          product.source = 'playwright_search';
          console.log(`  ✓ Found: ${bestMatch.cd} | ${bestMatch.name}`);
        } else {
          console.log(`  ✗ ${results.length} results but no valid match. Top 3:`);
          results.slice(0, 3).forEach(r => console.log(`    [${r.section}] ${r.cd} | ${r.name}`));
        }
      } else {
        console.log(`  ✗ No results found`);
      }
    } catch (err) {
      console.log(`  ✗ Error: ${(err as Error).message}`);
    }
  }

  await browser.close();

  // Save results
  const outputPath = join(DATA_DIR, 'review-product-mapping.json');
  const output = REVIEW_PRODUCTS.filter(p => p.source !== 'duplicate_387');
  writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');

  const matched = output.filter(p => p.product_cd);
  const still_unmatched = output.filter(p => !p.product_cd);
  console.log(`\n=== Results ===`);
  console.log(`Matched: ${matched.length}/${output.length}`);
  if (still_unmatched.length > 0) {
    console.log(`Still unmatched:`);
    still_unmatched.forEach(p => console.log(`  - ${p.sku_name} (sheet_no: ${p.sheet_no.join(',')})`));
  }

  console.log(`\nSaved to: ${outputPath}`);
}

discoverProductCodes().catch(console.error);
