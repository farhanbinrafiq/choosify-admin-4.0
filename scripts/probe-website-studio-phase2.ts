/**
 * Website Studio Phase 2 (Homepage Studio) probe — server-side permissions, validation, draft
 * isolation, the storefront preview session, publish/rollback, the /catalog/home switch-over,
 * the legacy-editor guard, and publish blocking for deleted catalog records.
 *
 * ISOLATED STACK ONLY (localhost API + :55499 database). Needs a FRESH backfill: the homepage must
 * be the unpublished v1 baseline (scripts/website-backfill.ts --apply on a reset QA database).
 *
 *   API_BASE=http://localhost:3001/api/v1 npx tsx scripts/probe-website-studio-phase2.ts
 */
const API = process.env.API_BASE || 'http://localhost:3001/api/v1';
const DB = process.env.DATABASE_URL || '';
if (!/^http:\/\/localhost:/.test(API) || !DB.includes(':55499/')) {
  console.error('REFUSE: run only against the isolated stack (localhost API + :55499 database)');
  process.exit(2);
}
const PASSWORD = process.env.DEV_PASSWORD || 'ChoosifyDev!2026';

let pass = 0;
let fail = 0;
const check = (label: string, ok: boolean, detail?: unknown) => {
  if (ok) pass++;
  else fail++;
  console.log(ok ? 'PASS' : 'FAIL', label, ok ? '' : JSON.stringify(detail ?? '').slice(0, 500));
};

async function login(email: string): Promise<string> {
  const r = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: PASSWORD }) });
  const j = (await r.json()) as { accessToken?: string };
  if (!j.accessToken) throw new Error(`login failed for ${email}`);
  return j.accessToken;
}

async function call(token: string | null, method: string, path: string, body?: unknown) {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json: any = null;
  try {
    json = await r.json();
  } catch {
    /* empty */
  }
  return { status: r.status, json, headers: r.headers };
}

const SECTION_ORDER_BEFORE = ['categories', 'trending', 'featured-brands', 'deals', 'recommended', 'spotlight', 'compare', 'services', 'recently-viewed'];

async function main() {
  const superAdmin = await login('admin@choosify.com.bd');
  const admin = await login('admin-role@choosify.test');
  const moderator = await login('moderator@choosify.com.bd');
  const marketing = await login('marketing@choosify.com.bd');
  const seller = await login('seller@choosify.com.bd');

  // --- Baseline: nothing published, storefront unchanged -----------------------------------------
  const doc0 = (await call(superAdmin, 'GET', '/website/documents/homepage')).json?.data;
  check('homepage is editable, v1 baseline recorded, NOT published', doc0?.editable === true && doc0?.latestVersion === 1 && doc0?.publishedVersion === null && doc0?.hasDraft, doc0);
  const homeBefore = (await call(null, 'GET', '/catalog/home')).json?.homepage;
  check('/catalog/home still serves the catalog homepage before any publish', homeBefore?.source === 'catalog' && homeBefore?.sections?.some((s: any) => s.id === 'newsletter'), homeBefore?.source);
  check('public published homepage → 404 before publish', (await call(null, 'GET', '/website/published/homepage')).status === 404);

  // The imported (legacy-shaped) baseline converts to the Studio shape without changing the page.
  const validated = await call(superAdmin, 'PUT', '/website/documents/homepage/draft', { content: doc0.draft, expectedRevision: doc0.draftRevision });
  const d1 = validated.json?.data?.draft;
  check('legacy baseline normalises to the Studio shape (version 2)', validated.status === 200 && d1?.version === 2, validated.json);
  check('…keeping the storefront\'s effective section order', JSON.stringify(d1?.sections?.map((s: any) => s.id)) === JSON.stringify(SECTION_ORDER_BEFORE), d1?.sections?.map((s: any) => s.id));
  check('…dropping sections the storefront never renders (creators, newsletter)', !d1?.sections?.some((s: any) => ['creators', 'newsletter', 'hero'].includes(s.id)));
  check('…with the media-less legacy hero banner switched off (storefront skipped it)', d1?.slides?.length === 1 && d1.slides[0].isActive === false && d1.heroVisible === true, d1?.slides);
  check('…and no headings overridden (built-in headings stay)', d1?.sections?.every((s: any) => s.title === '' && s.subtitle === ''));
  let rev = validated.json.data.draftRevision;

  // --- Authorization ---------------------------------------------------------------------------
  check('seller cannot edit the homepage (403)', (await call(seller, 'PUT', '/website/documents/homepage/draft', { content: d1, expectedRevision: rev })).status === 403);
  check('signed-out cannot edit the homepage (401)', (await call(null, 'PUT', '/website/documents/homepage/draft', { content: d1, expectedRevision: rev })).status === 401);
  check('seller cannot get a preview token (403)', (await call(seller, 'POST', '/website/documents/homepage/preview-token')).status === 403);

  // --- Validation --------------------------------------------------------------------------------
  const bad = async (patch: Record<string, unknown>) => (await call(superAdmin, 'PUT', '/website/documents/homepage/draft', { content: { ...d1, ...patch }, expectedRevision: rev })).json;
  const slide = (p: Record<string, unknown> = {}) => ({ id: 's1', label: 'Eid', linkUrl: '/deals', mediaType: 'image', mediaUrl: 'https://images.example.com/eid.jpg', alt: 'Eid offers', isActive: true, ...p });
  check('active slide without media is refused', (await bad({ slides: [slide({ mediaUrl: '' })] }))?.field === 'slides[0].mediaUrl');
  check('active image slide without alt text is refused', (await bad({ slides: [slide({ alt: '' })] }))?.field === 'slides[0].alt');
  check('active slide without a name is refused', (await bad({ slides: [slide({ label: '' })] }))?.field === 'slides[0].label');
  check('javascript: link is refused', (await bad({ slides: [slide({ linkUrl: 'javascript:alert(1)' })] }))?.code === 'INVALID_CONTENT');
  check('http:// link is refused (https only)', (await bad({ slides: [slide({ linkUrl: 'http://evil.example' })] }))?.field === 'slides[0].linkUrl');
  check('protocol-relative //evil link is refused', (await bad({ slides: [slide({ linkUrl: '//evil.example' })] }))?.code === 'INVALID_CONTENT');
  check('video file on an image slide is refused', (await bad({ slides: [slide({ mediaUrl: 'https://cdn.example.com/a.mp4' })] }))?.field === 'slides[0].mediaUrl');
  check('image file on a video slide is refused', (await bad({ slides: [slide({ mediaType: 'video', mediaUrl: 'https://cdn.example.com/a.jpg' })] }))?.field === 'slides[0].mediaUrl');
  check('more than 6 slides is refused', (await bad({ slides: Array.from({ length: 7 }, (_, i) => slide({ id: `s${i}` })) }))?.field === 'slides');
  check('unknown section id is refused', (await bad({ sections: [...d1.sections, { id: 'casino', isVisible: true, title: '', subtitle: '' }] }))?.code === 'INVALID_CONTENT');
  check('HTML in a heading is refused', (await bad({ sections: d1.sections.map((s: any, i: number) => (i ? s : { ...s, title: '<img src=x onerror=alert(1)>' })) }))?.code === 'INVALID_CONTENT');
  check('more than 6 categories is refused', (await bad({ topCategories: Array.from({ length: 7 }, (_, i) => ({ id: `c${i}`, label: '' })) }))?.field === 'topCategories');
  check('more than 8 products is refused', (await bad({ featuredProductIds: Array.from({ length: 9 }, (_, i) => `p${i}`) }))?.field === 'featuredProductIds');
  check('unknown top-level setting is refused', (await bad({ dealsBanners: [] }))?.code === 'INVALID_CONTENT');

  // --- Real catalog records -------------------------------------------------------------------------
  const products = (await call(superAdmin, 'GET', '/catalog/products')).json?.data ?? [];
  const brands = (await call(superAdmin, 'GET', '/catalog/brands')).json?.data ?? [];
  const categories = (await call(superAdmin, 'GET', '/catalog/categories')).json?.data ?? [];
  const guides = (await call(superAdmin, 'GET', '/catalog/guides')).json?.data ?? [];
  check('isolated catalog has records to pick from', products.length > 0 && brands.length > 0 && categories.length > 0, { p: products.length, b: brands.length, c: categories.length });

  const order = ['spotlight', 'categories', ...SECTION_ORDER_BEFORE.filter((x) => x !== 'spotlight' && x !== 'categories')];
  const draft = {
    ...d1,
    slides: [slide({ id: 'eid', label: 'Eid offers', focalX: 30, focalY: 70, mobileMediaUrl: 'https://images.example.com/eid-phone.jpg' })],
    sections: order.map((id) => ({ id, isVisible: id !== 'services', title: id === 'featured-brands' ? 'Brands we love' : '', subtitle: id === 'featured-brands' ? 'Hand-picked by Choosify' : '' })),
    topCategories: [{ id: String(categories[0].id), label: 'Gadgets' }],
    featuredProductIds: [String(products[0].id)],
    featuredBrandIds: brands.slice(0, 2).map((b: any) => String(b.id)),
    featuredGuideIds: guides.slice(0, 1).map((g: any) => String(g.id)),
  };

  // --- Draft isolation -----------------------------------------------------------------------------
  const saved = await call(marketing, 'PUT', '/website/documents/homepage/draft', { content: draft, expectedRevision: rev });
  check('marketing manager can save a homepage draft', saved.status === 200 && saved.json?.data?.hasDraft, saved.json);
  rev = saved.json.data.draftRevision;
  const homeAfterDraft = (await call(null, 'GET', '/catalog/home')).json?.homepage;
  check('Save Draft does NOT change /catalog/home (storefront)', homeAfterDraft?.source === 'catalog' && JSON.stringify(homeAfterDraft?.sections) === JSON.stringify(homeBefore?.sections));
  check('draft content never appears in the public response', !JSON.stringify(homeAfterDraft).includes('Brands we love'));

  // --- Storefront preview session (Web /cms-preview) ------------------------------------------------
  const tok = (await call(marketing, 'POST', '/website/documents/homepage/preview-token')).json?.data?.token as string;
  const sess = await call(null, 'GET', `/catalog/cms-preview/session/${encodeURIComponent(tok)}`);
  const ph = sess.json?.preview?.homepage;
  check('preview session returns the DRAFT mapped for the storefront', sess.status === 200 && ph?.source === 'website-studio' && ph?.sections?.find((s: any) => s.id === 'featured-brands')?.title === 'Brands we love', sess.json);
  check('preview session includes site settings + expiry', !!sess.json?.preview?.site && !!sess.json?.preview?.expiresAt && sess.json?.preview?.token === tok);
  check('preview session: no-store + noindex', /no-store/.test(sess.headers.get('cache-control') || '') && /noindex/.test(sess.headers.get('x-robots-tag') || ''));
  check('preview maps hero focal point + phone media + alt', ph?.heroBanners?.[0]?.focalX === 30 && ph?.heroBanners?.[0]?.mobileMediaUrl?.includes('eid-phone') && ph?.heroBanners?.[0]?.alt === 'Eid offers', ph?.heroBanners);
  // Any OTHER document with a draft (the backfill gives every document one) issues a token that must not open the homepage.
  let otherTok: string | undefined;
  for (const k of ['navigation', 'footer', 'company', 'brand_assets']) {
    otherTok = (await call(superAdmin, 'POST', `/website/documents/${k}/preview-token`)).json?.data?.token;
    if (otherTok) break;
  }
  const companyTok = otherTok;
  check('found another document draft to mint a token for', !!companyTok);
  if (companyTok) check('a preview token for another document cannot open the homepage preview', (await call(null, 'GET', `/catalog/cms-preview/session/${encodeURIComponent(companyTok)}`)).status === 401);
  check('garbage token → 401', (await call(null, 'GET', '/catalog/cms-preview/session/' + 'x'.repeat(40))).status === 401);
  check('a login token is not a preview token', (await call(null, 'GET', `/catalog/cms-preview/session/${encodeURIComponent(superAdmin)}`)).status === 401);
  check('a preview token is not a login (staff API rejects it)', (await call(tok, 'GET', '/website/documents')).status === 401);

  // --- Publish permissions + reference checks ----------------------------------------------------------
  for (const [name, t] of [['admin', admin], ['moderator', moderator], ['marketing manager', marketing]] as const) {
    check(`${name} cannot publish the homepage (403)`, (await call(t, 'POST', '/website/documents/homepage/publish', { changeNote: 'try', expectedRevision: rev })).status === 403);
  }
  const ghost = await call(superAdmin, 'PUT', '/website/documents/homepage/draft', { content: { ...draft, featuredProductIds: ['deleted-product-404'], featuredBrandIds: [...draft.featuredBrandIds, 'gone-brand'] }, expectedRevision: rev });
  check('a draft may reference a missing record (drafts are work in progress)', ghost.status === 200, ghost.json);
  rev = ghost.json.data.draftRevision;
  const blocked = await call(superAdmin, 'POST', '/website/documents/homepage/publish', { changeNote: 'Should be blocked', expectedRevision: rev });
  check('publishing a deleted/unavailable product or brand is BLOCKED (422)', blocked.status === 422 && blocked.json?.code === 'PUBLISH_BLOCKED' && /Popular Products/.test(blocked.json?.error) && /Featured Brands/.test(blocked.json?.error), blocked.json);
  check('…and nothing went public', (await call(null, 'GET', '/catalog/home')).json?.homepage?.source === 'catalog');
  const fixed = await call(superAdmin, 'PUT', '/website/documents/homepage/draft', { content: draft, expectedRevision: rev });
  rev = fixed.json.data.draftRevision;

  // --- Publish → storefront switches over immediately ---------------------------------------------------
  const pub = await call(superAdmin, 'POST', '/website/documents/homepage/publish', { changeNote: 'Homepage Studio: first publish (probe)', expectedRevision: rev });
  check('super admin publishes → version 2 (v1 stays the baseline)', pub.status === 200 && pub.json?.data?.published?.version === 2, pub.json);
  const live = (await call(null, 'GET', '/catalog/home')).json;
  const lh = live?.homepage;
  check('/catalog/home now serves the published Studio homepage at once (cache cleared)', lh?.source === 'website-studio');
  check('live order = published order (hero first)', JSON.stringify(lh?.sections?.map((s: any) => s.id)) === JSON.stringify(['hero', ...order]), lh?.sections?.map((s: any) => s.id));
  check('live headings + hidden section applied', lh?.sections?.find((s: any) => s.id === 'featured-brands')?.title === 'Brands we love' && lh?.sections?.find((s: any) => s.id === 'services')?.isVisible === false);
  check('live picks: featured products / brands resolved by /catalog/home', live?.featuredProducts?.length === 1 && live?.featuredBrands?.length === 2, { p: live?.featuredProducts?.length, b: live?.featuredBrands?.length });
  check('live Today\'s Deals banners still come from the Deals Banners store', Array.isArray(lh?.dealsBanners));
  check('top categories mapped (label + order, no image)', lh?.topCategories?.[0]?.label === 'Gadgets' && lh?.topCategories?.[0]?.image === '');

  // --- Legacy editor can no longer overwrite Studio content ---------------------------------------------
  const legacy = await call(superAdmin, 'PUT', '/catalog/home', { ...homeBefore, sections: [] });
  check('legacy PUT /catalog/home is refused once the Studio owns the homepage (409)', legacy.status === 409 && legacy.json?.code === 'MANAGED_IN_WEBSITE_STUDIO', legacy.json);
  check('…and the live homepage is untouched', (await call(null, 'GET', '/catalog/home')).json?.homepage?.source === 'website-studio');

  // --- Rollback to the v1 baseline = new version, identical page to before -----------------------------
  check('admin (edit only) cannot roll back (403)', (await call(admin, 'POST', '/website/documents/homepage/rollback', { version: 1, changeNote: 'nope' })).status === 403);
  const rb = await call(superAdmin, 'POST', '/website/documents/homepage/rollback', { version: 1, changeNote: 'Back to the imported homepage (probe)' });
  check('rollback to v1 creates NEW version 3', rb.status === 200 && rb.json?.data?.published?.version === 3, rb.json);
  const lh3 = (await call(null, 'GET', '/catalog/home')).json?.homepage;
  check('after rollback the storefront order equals the pre-Studio effective order', JSON.stringify(lh3?.sections?.map((s: any) => s.id)) === JSON.stringify(['hero', ...SECTION_ORDER_BEFORE]), lh3?.sections?.map((s: any) => s.id));
  check('after rollback no custom headings remain', lh3?.sections?.every((s: any) => !s.title));
  const v2 = (await call(superAdmin, 'GET', '/website/documents/homepage/versions/2')).json?.data;
  check('v2 is unchanged in history after rollback', v2?.content?.sections?.find((s: any) => s.id === 'featured-brands')?.title === 'Brands we love');
  const hist = (await call(superAdmin, 'GET', '/website/documents/homepage/versions')).json?.data ?? [];
  check('history: v3 rollback ← v1, v2 publish, v1 backfill', hist[0]?.source === 'rollback' && hist[0]?.restoredFromVersion === 1 && hist[1]?.source === 'publish' && hist[2]?.source === 'backfill', hist);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error('PROBE CRASHED', e);
  process.exit(1);
});
