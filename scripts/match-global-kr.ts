/**
 * 글로벌 Shopify 상품 → 한국 product_cd 매칭 (Claude Haiku, strict)
 *
 * npx tsx scripts/match-global-kr.ts
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
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

interface GlobalProduct {
  global_numeric_id: string;
  global_title: string;
  global_handle: string;
  kr_product_cd: string | null;
  kr_name: string | null;
  confidence: string;
}

interface KrProduct {
  product_cd: string;
  name: string;
}

const globalProducts: GlobalProduct[] = JSON.parse(readFileSync(join(DATA_DIR, 'product-mapping.json'), 'utf-8'));
const krProducts: KrProduct[] = JSON.parse(readFileSync(join(DATA_DIR, 'kr-products.json'), 'utf-8'));

const reviewCds = new Set(
  readdirSync(join(DATA_DIR, 'reviews'))
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''))
);

const krWithReviews = krProducts.filter(p => reviewCds.has(p.product_cd));

// Reset all haiku matches to re-do
for (const g of globalProducts) {
  if (g.confidence === 'haiku_match') {
    g.kr_product_cd = null;
    g.kr_name = null;
    g.confidence = 'no_match';
  }
}

const unmatched = globalProducts.filter(g => !g.kr_product_cd);

console.log(`Global unmatched: ${unmatched.length}`);
console.log(`KR products with reviews: ${krWithReviews.length}`);

const BATCH_SIZE = 20;

async function matchBatch(batch: GlobalProduct[]): Promise<Record<string, { cd: string; name: string } | null>> {
  const globalList = batch.map(g => `${g.global_numeric_id}|${g.global_title}`).join('\n');
  const krList = krWithReviews.map(k => `${k.product_cd}|${k.name}`).join('\n');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: `You are matching GLOBAL (English) pet products to their EXACT Korean counterparts.

CRITICAL RULES:
1. Only match if it is DEFINITELY the same product (same brand, same product line, same type)
2. "Dry Me" = "드라이미" (towel), "Lick Mat" = "릭매트", "Nose Work Playbook" = "노즈워크 플레이북"
3. Do NOT match different products in the same category (e.g., different nosework toys)
4. Do NOT match "Original" size with "Mini" size unless titles clearly indicate same variant
5. A nosework toy is NOT a nosework playbook
6. A latex toy model X is NOT latex toy model Y
7. When in doubt, output null — false negatives are OK, false positives are NOT
8. Each KR product can match at most ONE global product (prefer the closer match)

Output ONLY valid JSON: {"matches":{"global_id":"kr_cd_or_null"}}

GLOBAL:
${globalList}

KR:
${krList}`
      }]
    })
  });

  if (!res.ok) throw new Error(`API error ${res.status}`);

  const data = await res.json() as any;
  const text = data.content[0].text;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return {};

  const parsed = JSON.parse(jsonMatch[0]);
  const result: Record<string, { cd: string; name: string } | null> = {};

  for (const [gid, kcd] of Object.entries(parsed.matches || {})) {
    if (kcd && typeof kcd === 'string' && kcd !== 'null') {
      const kr = krWithReviews.find(k => k.product_cd === kcd);
      result[gid] = kr ? { cd: kcd, name: kr.name } : null;
    } else {
      result[gid] = null;
    }
  }

  return result;
}

let totalMatched = 0;

for (let i = 0; i < unmatched.length; i += BATCH_SIZE) {
  const batch = unmatched.slice(i, i + BATCH_SIZE);
  process.stdout.write(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(unmatched.length / BATCH_SIZE)}...`);

  try {
    const matches = await matchBatch(batch);
    let batchMatched = 0;

    for (const g of batch) {
      const match = matches[g.global_numeric_id];
      if (match) {
        g.kr_product_cd = match.cd;
        g.kr_name = match.name;
        g.confidence = 'haiku_match';
        batchMatched++;
      }
    }

    totalMatched += batchMatched;
    console.log(` ${batchMatched}/${batch.length} matched`);
  } catch (err) {
    console.log(` error: ${(err as Error).message}`);
  }

  await new Promise(r => setTimeout(r, 500));
}

writeFileSync(join(DATA_DIR, 'product-mapping.json'), JSON.stringify(globalProducts, null, 2), 'utf-8');

const finalMatched = globalProducts.filter(g => g.kr_product_cd).length;
console.log(`\nDone: ${finalMatched}/${globalProducts.length} matched (${totalMatched} new)`);

// Print matches for verification
console.log('\n=== All matches ===');
globalProducts.filter(g => g.kr_product_cd).forEach(g =>
  console.log(`  ${g.global_title} -> ${g.kr_name}`)
);
