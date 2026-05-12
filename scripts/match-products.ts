/**
 * Claude API로 global(영어) ↔ co.kr(한국어) 상품 직접 매칭
 *
 * 리뷰 파일이 있는 47개 한국 상품과 249개 글로벌 상품을 Claude에게 직접 매칭 요청.
 * 번역→유사도 비교 대신 Claude의 다국어 이해력으로 직접 매칭.
 *
 * 사용법: npx tsx scripts/match-products.ts
 * 결과:   data/product-mapping.json
 */

import { writeFileSync, readFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '..', '.env.local') });

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_API_KEY) {
  console.error('Missing ANTHROPIC_API_KEY in .env.local');
  process.exit(1);
}

const DATA_DIR = join(__dirname, '..', 'data');

export interface ProductMapping {
  global_numeric_id: string;
  global_title: string;
  global_handle: string;
  kr_product_cd: string | null;
  kr_name: string | null;
  confidence: 'high' | 'medium' | 'low' | 'no_match';
}

interface GlobalProduct { id: string; numericId: string; title: string; handle: string }
interface KrProduct { product_cd: string; name: string }

function loadJson<T>(filename: string): T {
  const path = join(DATA_DIR, filename);
  if (!existsSync(path)) throw new Error(`File not found: ${path}\nRun fetch scripts first.`);
  return JSON.parse(readFileSync(path, 'utf-8'));
}

async function matchBatch(
  globalBatch: GlobalProduct[],
  krProducts: KrProduct[],
): Promise<{ global_numeric_id: string; kr_product_cd: string | null; confidence: string }[]> {
  const globalList = globalBatch.map((g, i) => `${i + 1}. [${g.numericId}] ${g.title}`).join('\n');
  const krList = krProducts.map(p => `[${p.product_cd}] ${p.name}`).join('\n');

  const prompt = `You are matching English pet product names (from a global Shopify store) to Korean product names (from biteme.co.kr).
Both stores sell BITE ME brand products. Match each global product to the Korean product that is the same item.

MATCHING RULES:
- Match based on product type, brand, and characteristics (size, color count, material)
- Brand names: "Biteme"/"BITE ME" = "바잇미", "Apple Cider Recipe" = "애플사이다레시피", "ComfyRavioli" = "컴피라비올리"
- Product types are translated: nosework=노즈워크, harness=하네스, toy=장난감, leash=리쉬, bag=백/가방, mat=매트, etc.
- If no confident match exists, use null for kr_product_cd
- Be conservative: only match if you're confident it's the same product

[GLOBAL PRODUCTS - English]
${globalList}

[KOREAN PRODUCTS - with product codes]
${krList}

Return ONLY a JSON array, no markdown code blocks:
[{"global_numeric_id":"...","kr_product_cd":"..." or null,"confidence":"high" or "medium" or "no_match"}]`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 8192,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error: ${res.status} ${err}`);
  }

  const data = await res.json();
  let text = data.content[0].text.trim();
  text = text.replace(/```json\s*/g, '').replace(/```\s*/g, '');
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error(`JSON parse failed:\n${text.substring(0, 500)}`);

  return JSON.parse(match[0]);
}

console.log('Starting product matching...');
const globalProducts: GlobalProduct[] = loadJson('global-products.json');
const allKrProducts: KrProduct[] = loadJson('kr-products.json');

const reviewFiles = new Set(
  readdirSync(join(DATA_DIR, 'reviews'))
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''))
);

const krWithReviews = allKrProducts.filter(p => reviewFiles.has(p.product_cd));
console.log(`Global products: ${globalProducts.length}`);
console.log(`KR products with reviews: ${krWithReviews.length}`);

const BATCH = 50;
const allResults: { global_numeric_id: string; kr_product_cd: string | null; confidence: string }[] = [];

for (let i = 0; i < globalProducts.length; i += BATCH) {
  const batch = globalProducts.slice(i, i + BATCH);
  const batchNum = Math.floor(i / BATCH) + 1;
  const totalBatches = Math.ceil(globalProducts.length / BATCH);
  console.log(`  Batch ${batchNum}/${totalBatches} (${batch.length} global products vs ${krWithReviews.length} KR products)...`);

  const results = await matchBatch(batch, krWithReviews);
  allResults.push(...results);

  if (i + BATCH < globalProducts.length) await new Promise(r => setTimeout(r, 500));
}

const krMap = new Map(krWithReviews.map(p => [p.product_cd, p.name]));
const allMappings: ProductMapping[] = globalProducts.map(g => {
  const result = allResults.find(r => r.global_numeric_id === g.numericId);
  const confidence = (result?.confidence ?? 'no_match') as ProductMapping['confidence'];
  const krCd = result?.kr_product_cd ?? null;

  return {
    global_numeric_id: g.numericId,
    global_title: g.title,
    global_handle: g.handle,
    kr_product_cd: confidence !== 'no_match' && krCd ? krCd : null,
    kr_name: confidence !== 'no_match' && krCd ? (krMap.get(krCd) ?? null) : null,
    confidence,
  };
});

const matched = allMappings.filter(m => m.confidence !== 'no_match');
console.log(`\nFinal results:`);
console.log(`  high:     ${allMappings.filter(m => m.confidence === 'high').length}`);
console.log(`  medium:   ${allMappings.filter(m => m.confidence === 'medium').length}`);
console.log(`  no_match: ${allMappings.filter(m => m.confidence === 'no_match').length}`);
console.log(`  total matched: ${matched.length}/${allMappings.length}`);

console.log('\nMatched products:');
matched.forEach(m => console.log(`  [${m.confidence}] ${m.global_title} -> ${m.kr_name}`));

writeFileSync(
  join(DATA_DIR, 'product-mapping.json'),
  JSON.stringify(allMappings, null, 2),
  'utf-8'
);
console.log(`\nDone -> data/product-mapping.json`);
