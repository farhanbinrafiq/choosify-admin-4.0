/**
 * Studio readiness / guidance probe (pure logic, no server / DB).
 *
 *   npx tsx scripts/probe-studio-readiness.ts
 *
 * - isBrandMarketplaceVisible stays in lock-step with the server rule: the
 *   server's brandIsMarketplaceVisible source is read (not imported — that
 *   module opens the database / catalog store) and transpiled in isolation.
 * - Product / Guide / Brand / Creator checklists reflect their inputs and only
 *   flag as "blocker" what the server itself refuses or hides.
 * - Public profile URLs use the storefront host + handle, never the Admin host.
 */
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import {
  brandHealth,
  brandVisibilityExplanation,
  creatorReadiness,
  guideReadiness,
  isBrandMarketplaceVisible,
  productReadiness,
  readinessSummary,
  type BrandVisibilityFacts,
  type ReadinessItem,
} from '../src/components/studio/readiness';
import { guideSectionHelp, GUIDE_SECTION_TITLE } from '../src/pages/admin/guideStudioModel';

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.log(`  ✗ ${name}`, detail ?? '');
  }
}
const state = (items: ReadinessItem[], id: string) => items.find((i) => i.id === id)?.state;

console.log('brand visibility — parity with server brandIsMarketplaceVisible');
const src = readFileSync(new URL('../server/catalog/sellerWorkspace.ts', import.meta.url), 'utf8').split(String.fromCharCode(13)).join('');
const m = /export function brandIsMarketplaceVisible\([\s\S]*?\n}\n/.exec(src);
check('server function found', !!m);
const js = ts.transpileModule(m ? m[0].replace(/^export /, '') : '', { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
// eslint-disable-next-line no-new-func
const serverRule = new Function(`${js}; return brandIsMarketplaceVisible;`)() as (b: BrandVisibilityFacts) => boolean;
const fixtures: BrandVisibilityFacts[] = [];
for (const marketplaceStatus of [undefined, 'granted', 'restored', 'not_granted', 'pending', 'restricted', 'suspended', 'revoked']) {
  for (const marketplaceAccess of [undefined, true, false]) {
    for (const sellerId of [undefined, 'seller-1']) fixtures.push({ marketplaceStatus, marketplaceAccess, sellerId });
  }
}
const mismatches = fixtures.filter((f) => serverRule(f) !== isBrandMarketplaceVisible(f));
check(`client rule == server rule on ${fixtures.length} combinations`, mismatches.length === 0, mismatches.slice(0, 3));
check('not_granted + access missing → hidden (the case the old pill showed as "On")', !isBrandMarketplaceVisible({ marketplaceStatus: 'not_granted' }));
check('restricted explanation names Choosify support', /support/i.test(brandVisibilityExplanation({ marketplaceStatus: 'suspended' }).text));
check('granted explanation says public', brandVisibilityExplanation({ marketplaceStatus: 'granted' }).visible);

console.log('product readiness');
const baseProduct = { title: 'Lamp', brandId: 'b1', categoryId: 'c1', image: 'x.jpg', gallery: [], price: 100, stock: 5, description: 'd', status: 'DRAFT' };
const ready = productReadiness(baseProduct, { marketplaceStatus: 'granted' });
check('complete product + granted brand → no blockers, all done', readinessSummary(ready).blockers === 0 && readinessSummary(ready).done === readinessSummary(ready).total, ready);
check('brand without Marketplace Access → blocker', state(productReadiness(baseProduct, { marketplaceStatus: 'not_granted', sellerId: 's' }), 'access') === 'blocker');
check('brand record unknown → info, never "granted"', state(productReadiness(baseProduct, undefined), 'access') === 'info');
check('missing brand / category → blockers (server requires both)',
  state(productReadiness({ ...baseProduct, brandId: '' }, null), 'brand') === 'blocker' && state(productReadiness({ ...baseProduct, categoryId: '' }, { marketplaceStatus: 'granted' }), 'category') === 'blocker');
check('suspended → blocker', state(productReadiness({ ...baseProduct, status: 'SUSPENDED' }, { marketplaceStatus: 'granted' }), 'suspended') === 'blocker');
const noStock = productReadiness({ ...baseProduct, stock: 0 }, { marketplaceStatus: 'granted' });
check('zero stock → info (Out of stock), not a blocker', state(noStock, 'stock') === 'info' && readinessSummary(noStock).blockers === 0);
check('missing photo / price / description → recommendations only',
  ['photo', 'price', 'description'].every((id) => state(productReadiness({ ...baseProduct, image: '', price: 0, description: '' }, { marketplaceStatus: 'granted' }), id) === 'todo'));

console.log('guide readiness (recommendations only)');
const emptyGuide = guideReadiness({ title: 'Untitled Guide', excerpt: '', photos: [], videoUrl: '', productIds: [], brandIds: [] });
check('server has no publish requirements → never a blocker', readinessSummary(emptyGuide).blockers === 0 && emptyGuide.every((i) => i.state === 'todo'));
const fullGuide = guideReadiness({ title: 'Best lamps', excerpt: 's', photos: ['p.jpg'], videoUrl: '', productIds: ['p1'], brandIds: [] });
check('complete guide → all done', fullGuide.every((i) => i.state === 'done'), fullGuide);
check('video alone counts as cover media', state(guideReadiness({ title: 'T', excerpt: '', photos: [], videoUrl: 'https://youtu.be/x', productIds: [], brandIds: [] }), 'media') === 'done');
const sections = Object.keys(GUIDE_SECTION_TITLE) as Array<keyof typeof GUIDE_SECTION_TITLE>;
check(`every Guide section (${sections.length}) has a description`, sections.every((s) => guideSectionHelp(s).trim().length > 10), sections.filter((s) => !guideSectionHelp(s)));

console.log('brand health');
const brandIn = { brandName: 'Artveen', logo: 'l.png', coverImage: 'c.jpg', category: 'Art', tagline: 't', description: 'd', website: '', socials: ['https://fb.com/a'] };
check('complete + granted → no blockers, all done', readinessSummary(brandHealth(brandIn, { marketplaceStatus: 'granted' })).blockers === 0
  && brandHealth(brandIn, { marketplaceStatus: 'granted' }).every((i) => i.state === 'done'));
check('not granted → visibility blocker with explanation', state(brandHealth(brandIn, { marketplaceStatus: 'not_granted', sellerId: 's' }), 'access') === 'blocker');
check('"Untitled Brand" is not a name', state(brandHealth({ ...brandIn, brandName: 'Untitled Brand' }, null), 'name') === 'todo');
check('website OR a social link satisfies links', state(brandHealth({ ...brandIn, socials: [], website: 'https://a.bd' }, null), 'links') === 'done'
  && state(brandHealth({ ...brandIn, socials: ['', ''], website: '' }, null), 'links') === 'todo');

console.log('creator readiness');
const creatorIn = { name: 'Nusrat', avatar: 'a.jpg', coverImage: 'c.jpg', bio: 'b', socials: ['https://yt.com/n'], email: 'n@x.bd', phone: '', status: 'LIVE' };
check('complete live profile → all done', creatorReadiness(creatorIn).every((i) => i.state === 'done'));
check('draft → visibility info (not a blocker)', state(creatorReadiness({ ...creatorIn, status: 'DRAFT' }), 'visibility') === 'info');
check('missing contact → recommendation', state(creatorReadiness({ ...creatorIn, email: '', phone: '' }), 'contact') === 'todo');

console.log('public profile links (source)');
{
  // The URL helper reads Vite's import.meta.env, so the real URLs are checked in
  // the browser probe; here: no Studio builds a public link from a hard-coded or
  // Admin-relative host any more.
  const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');
  const creator = read('../src/pages/admin/CreatorEditStudio.tsx');
  const brand = read('../src/pages/admin/BrandEditStudio.tsx');
  const brandPres = read('../src/components/brand-profile/BrandProfilePresentation.tsx');
  check('Creator Studio: no hard-coded localhost origin', !creator.includes('localhost:5173'));
  check("Creator Studio: public link built with publicProfileUrl('creator', …)", creator.includes("publicProfileUrl('creator'"));
  check('Brand Studio: no Admin-relative /brands/ link', !brand.includes('href={`/brands/'));
  check("Brand Studio: public link built with publicProfileUrl('brand', …)", brand.includes("publicProfileUrl('brand'"));
  check('Brand copy-link no longer uses window.location.origin', !brandPres.includes('window.location.origin'));
}


console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
