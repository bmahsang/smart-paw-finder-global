/**
 * JP 매핑의 kr_product_cd 기준으로 global 매핑 생성
 *
 * 전략: kr_product_cd별 리뷰 파일이 있는 한국 상품명(kr-products.json)과
 * global 영어 상품명의 핵심 키워드를 비교합니다.
 * JP와 global은 같은 BITE ME 상품을 판매하므로 상품명 패턴이 유사합니다.
 *
 * 사용법: npx tsx scripts/build-mapping-from-jp.ts
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const JP_DATA_DIR = join(__dirname, '..', '..', 'bitemejp', 'data');

interface JpMapping {
  jp_numeric_id: string;
  jp_title: string;
  jp_handle: string;
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

interface KrProduct {
  product_cd: string;
  name: string;
}

const jpMappings: JpMapping[] = JSON.parse(readFileSync(join(JP_DATA_DIR, 'product-mapping.json'), 'utf-8'));
const globalProducts: GlobalProduct[] = JSON.parse(readFileSync(join(DATA_DIR, 'global-products.json'), 'utf-8'));
const krProducts: KrProduct[] = JSON.parse(readFileSync(join(DATA_DIR, 'kr-products.json'), 'utf-8'));

const reviewFiles = new Set(
  readdirSync(join(DATA_DIR, 'reviews'))
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''))
);

const jpConfirmed = jpMappings.filter(m =>
  m.kr_product_cd &&
  m.confidence !== 'no_match' &&
  reviewFiles.has(m.kr_product_cd)
);

console.log(`JP confirmed mappings (with review files): ${jpConfirmed.length}`);
console.log(`Global products: ${globalProducts.length}`);
console.log(`Review files: ${reviewFiles.size}`);

const krMap = new Map(krProducts.map(p => [p.product_cd, p.name]));

// 영어→한국어 키워드 매핑 (바잇미 상품 패턴)
const enToKrKeywords: [RegExp, string][] = [
  [/comfort\s*lead/i, '컴포트리드'],
  [/comfort\s*harness/i, '컴포트하네스'],
  [/flat\s*latex/i, '납작 라텍스'],
  [/brainy.*spin.*snack/i, '브레이닝토이 스핀'],
  [/bouncy\s*ball/i, '통통볼'],
  [/jelly\s*bear/i, '젤리베어'],
  [/crinkle.*pocket.*cape/i, '크링클 포켓 케이프'],
  [/catch.*tug.*fishing/i, '캐치미 턱 낚싯대'],
  [/poki.*pocket.*nosework/i, '포키포켓 노즈워크'],
  [/crinkle.*vinyl/i, '크링클 비닐'],
  [/long\s*long.*tug/i, '롱롱 턱'],
  [/tug\s*toy/i, '턱토이'],
  [/nosework/i, '노즈워크'],
  [/harness/i, '하네스'],
  [/lead|leash/i, '리드'],
  [/collar/i, '칼라'],
  [/padding|puffer/i, '패딩'],
  [/raincoat/i, '레인코트'],
  [/t-?shirt/i, '티셔츠'],
  [/hoodie/i, '후디'],
  [/sweater/i, '스웨터'],
  [/coat/i, '코트'],
  [/vest/i, '베스트'],
  [/bandana/i, '반다나'],
  [/toy/i, '토이'],
  [/treat/i, '간식'],
  [/snack/i, '스낵'],
  [/bowl/i, '볼'],
  [/bed/i, '베드'],
  [/blanket/i, '블랭킷'],
  [/bag/i, '백'],
  [/pouch/i, '파우치'],
  [/mat/i, '매트'],
];

function extractEnKeywords(title: string): string[] {
  const keywords: string[] = [];
  for (const [regex, kr] of enToKrKeywords) {
    if (regex.test(title)) keywords.push(kr);
  }
  // handle에서 핵심 단어 추출
  const words = title.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2 && !['the', 'and', 'for', 'with', 'types', 'type', 'colors', 'biteme', 'bite'].includes(w));
  return [...keywords, ...words];
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
}

function scoreMatch(globalTitle: string, krName: string | null, jpTitle: string): number {
  if (!krName) return 0;
  const enKw = extractEnKeywords(globalTitle);
  const krNorm = normalize(krName);
  const jpNorm = normalize(jpTitle);
  const globalNorm = normalize(globalTitle);

  let score = 0;
  for (const kw of enKw) {
    if (krNorm.includes(normalize(kw))) score += 2;
  }

  // 영어 단어가 한국어 상품명에도 있는 경우 (영어 차용어)
  const globalWords = globalTitle.toLowerCase().match(/[a-z]{3,}/g) || [];
  for (const w of globalWords) {
    if (krNorm.includes(w) || jpNorm.includes(w)) score += 1.5;
  }

  return score;
}

const globalMappings: {
  global_numeric_id: string;
  global_title: string;
  global_handle: string;
  kr_product_cd: string | null;
  kr_name: string | null;
  confidence: string;
}[] = [];

let matchCount = 0;

for (const g of globalProducts) {
  let bestKrCd: string | null = null;
  let bestKrName: string | null = null;
  let bestScore = 0;
  let bestConfidence = 'no_match';

  for (const jp of jpConfirmed) {
    const krName = jp.kr_name || krMap.get(jp.kr_product_cd!) || null;
    const s = scoreMatch(g.title, krName, jp.jp_title);
    if (s > bestScore) {
      bestScore = s;
      bestKrCd = jp.kr_product_cd;
      bestKrName = krName;
      bestConfidence = jp.confidence;
    }
  }

  if (bestScore < 2) {
    bestKrCd = null;
    bestKrName = null;
    bestConfidence = 'no_match';
  } else if (bestScore < 4) {
    bestConfidence = 'low';
  } else if (bestScore < 6) {
    bestConfidence = 'medium';
  } else {
    bestConfidence = 'high';
  }

  if (bestKrCd) matchCount++;

  globalMappings.push({
    global_numeric_id: g.numericId,
    global_title: g.title,
    global_handle: g.handle,
    kr_product_cd: bestKrCd,
    kr_name: bestKrName,
    confidence: bestConfidence,
  });
}

console.log(`\nResults:`);
console.log(`  matched:  ${matchCount}/${globalProducts.length}`);
console.log(`  high:     ${globalMappings.filter(m => m.confidence === 'high').length}`);
console.log(`  medium:   ${globalMappings.filter(m => m.confidence === 'medium').length}`);
console.log(`  low:      ${globalMappings.filter(m => m.confidence === 'low').length}`);
console.log(`  no_match: ${globalMappings.filter(m => m.confidence === 'no_match').length}`);

console.log('\nSample matches:');
globalMappings
  .filter(m => m.kr_product_cd)
  .sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2, confirmed: 0, no_match: 3 };
    return (order[a.confidence as keyof typeof order] ?? 3) - (order[b.confidence as keyof typeof order] ?? 3);
  })
  .slice(0, 15)
  .forEach(m => console.log(`  [${m.confidence}] ${m.global_title} -> ${m.kr_name || m.kr_product_cd}`));

writeFileSync(
  join(DATA_DIR, 'product-mapping.json'),
  JSON.stringify(globalMappings, null, 2),
  'utf-8'
);
console.log(`\nDone -> data/product-mapping.json`);
