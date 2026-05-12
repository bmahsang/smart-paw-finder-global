/**
 * 스프레드시트 기반 매핑으로 product-mapping.json 업데이트
 * npx tsx scripts/apply-sheet-mapping.ts
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');

// 스프레드시트 매핑 (Global Shopify numeric ID → KR product_cd)
const SHEET_MAPPING: Record<string, string | null> = {
  '8119201038390': '1000010997',  // [Bite Me X Choigosim] Lucky Squirrel Key Ring Toy
};

interface MappingEntry {
  global_numeric_id: string;
  global_title: string;
  global_handle: string;
  kr_product_cd: string | null;
  kr_name: string | null;
  confidence: string;
}

interface GlobalProduct {
  id: string;
  numericId: string;
  title: string;
  handle: string;
}

const productsPath = join(DATA_DIR, 'global-products.json');
const mappingPath = join(DATA_DIR, 'product-mapping.json');

const globalProducts: GlobalProduct[] = JSON.parse(readFileSync(productsPath, 'utf-8'));

const result: MappingEntry[] = globalProducts.map((p) => {
  const krCd = SHEET_MAPPING[p.numericId] ?? null;
  return {
    global_numeric_id: p.numericId,
    global_title: p.title,
    global_handle: p.handle,
    kr_product_cd: krCd,
    kr_name: null,
    confidence: krCd ? 'confirmed' : 'no_match',
  };
});

const confirmed = result.filter(e => e.confidence === 'confirmed');
writeFileSync(mappingPath, JSON.stringify(result, null, 2), 'utf-8');
console.log(`Done: ${confirmed.length} confirmed, ${result.length - confirmed.length} no_match`);

confirmed.forEach(e => console.log(`  ${e.global_numeric_id} -> ${e.kr_product_cd} (${e.global_title})`));
