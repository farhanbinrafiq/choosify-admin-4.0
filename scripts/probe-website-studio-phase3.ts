/**
 * Website Studio Phase 3 probe — Header & Navigation, Footer, Social Links, the /catalog/site
 * switch-over, legacy write guards, payment-availability publish checks, preview scoping, and
 * Today's Deals banners moving into the versioned homepage.
 *
 * ISOLATED STACK ONLY (localhost API + :55499 database), on a FRESH backfill.
 *   API_BASE=http://localhost:3001/api/v1 npx tsx scripts/probe-website-studio-phase3.ts
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
async function login(email: string) {
  const r = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: PASSWORD }) });
  const j = (await r.json()) as { accessToken?: string };
  if (!j.accessToken) throw new Error(`login failed for ${email}`);
  return j.accessToken;
}
async function call(token: string | null, method: string, path: string, body?: unknown) {
  const r = await fetch(`${API}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  let json: any = null;
  try {
    json = await r.json();
  } catch {
    /* empty */
  }
  return { status: r.status, json, headers: r.headers };
}
const site = async () => (await call(null, 'GET', '/catalog/site')).json?.site;

async function main() {
  const sa = await login('admin@choosify.com.bd');
  const admin = await login('admin-role@choosify.test');
  const marketing = await login('marketing@choosify.com.bd');
  const seller = await login('seller@choosify.com.bd');
  const doc = async (k: string) => (await call(sa, 'GET', `/website/documents/${k}`)).json?.data;

  // --- Baseline -----------------------------------------------------------------------------------
  const s0 = await site();
  check('storefront /catalog/site carries NO Studio parts before any publish', s0 && JSON.stringify(s0.websiteStudio) === '{}', s0?.websiteStudio);
  const nav0 = await doc('navigation');
  const foot0 = await doc('footer');
  const soc0 = await doc('social');
  check('navigation/footer/social are editable and unpublished v1 baselines', [nav0, foot0, soc0].every((d) => d?.editable && d?.latestVersion === 1 && d?.publishedVersion === null), [nav0?.editable, foot0?.editable, soc0?.editable]);
  check('navigation baseline shown in the Studio shape = the 8 live menu items, Home first', nav0?.draft?.version === 2 && nav0.draft.items.length === 8 && nav0.draft.items[0].url === '/' && nav0.draft.items.every((i: any) => i.showOnDesktop && i.showOnMobile), nav0?.draft);
  check('footer baseline keeps the live columns but imports NO payments / apps / couriers (none are backed)', foot0?.draft?.columns?.length === 3 && foot0.draft.paymentMethods.length === 0 && foot0.draft.apps.length === 0 && foot0.draft.deliveryPartners.length === 0, foot0?.draft);
  check('social baseline = 5 live networks', soc0?.draft?.links?.length === 5 && soc0.draft.links.every((l: any) => l.url.startsWith('https://')), soc0?.draft);

  // --- Authorization --------------------------------------------------------------------------------
  check('seller cannot edit navigation (403)', (await call(seller, 'PUT', '/website/documents/navigation/draft', { content: nav0.draft, expectedRevision: nav0.draftRevision })).status === 403);
  check('signed-out cannot edit the footer (401)', (await call(null, 'PUT', '/website/documents/footer/draft', { content: foot0.draft, expectedRevision: foot0.draftRevision })).status === 401);
  check('signed-out cannot read capabilities (401)', (await call(null, 'GET', '/website/capabilities')).status === 401);
  const caps = (await call(sa, 'GET', '/website/capabilities')).json?.data;
  const cod = caps?.paymentMethods?.find((p: any) => p.id === 'cod');
  const visa = caps?.paymentMethods?.find((p: any) => p.id === 'visa');
  check('capabilities: Cash on Delivery available; card/mobile methods NOT (SSLCommerz not live here)', cod?.available === true && visa?.available === false, caps?.paymentMethods);

  // --- Navigation validation ----------------------------------------------------------------------
  let navRev = nav0.draftRevision;
  const items = nav0.draft.items;
  const badNav = async (content: unknown) => (await call(sa, 'PUT', '/website/documents/navigation/draft', { content, expectedRevision: navRev })).json;
  const withItem = (i: Record<string, unknown>) => ({ ...nav0.draft, items: [...items, { id: 'x', label: 'X', showOnDesktop: true, showOnMobile: true, ...i }] });
  for (const [url, why] of [['/admin', 'reserved staff route'], ['/checkout', 'reserved checkout route'], ['/cms-preview', 'reserved preview route'], ['/api/v1/x', 'API path'], ['/casino', 'not a page'], ['javascript:alert(1)', 'script link'], ['http://evil.example', 'non-https'], ['//evil.example', 'protocol-relative'], ['https://choosify.bd/deals', 'own site as full URL']] as const) {
    check(`navigation refuses ${why} (${url})`, (await badNav(withItem({ url })))?.code === 'INVALID_CONTENT');
  }
  check('navigation refuses removing Home', (await badNav({ ...nav0.draft, items: items.filter((i: any) => i.url !== '/') }))?.code === 'INVALID_CONTENT');
  check('navigation refuses hiding Home on phones', (await badNav({ ...nav0.draft, items: items.map((i: any) => (i.url === '/' ? { ...i, showOnMobile: false } : i)) }))?.code === 'INVALID_CONTENT');
  check('navigation refuses more than 10 items', (await badNav({ ...nav0.draft, items: [...items, ...[1, 2, 3].map((n) => ({ id: `e${n}`, label: `E${n}`, url: '/faq' }))] }))?.field === 'items');
  check('navigation refuses a too-long label', (await badNav(withItem({ url: '/faq', label: 'x'.repeat(25) })))?.code === 'INVALID_CONTENT');
  check('announcement on without text is refused', (await badNav({ ...nav0.draft, announcement: { enabled: true, text: '', linkUrl: '' } }))?.field === 'announcement.text');

  // --- Draft isolation + preview ------------------------------------------------------------------
  const navDraft = {
    ...nav0.draft,
    items: [...items.filter((i: any) => i.id !== 'compare'), { id: 'faq', label: 'Help', url: '/faq', showOnDesktop: false, showOnMobile: true }, { id: 'blog', label: 'Blog', url: 'https://medium.com/@choosify', showOnDesktop: true, showOnMobile: true }],
    announcement: { enabled: true, text: 'Eid deals are live', linkUrl: '/deals' },
  };
  const savedNav = await call(marketing, 'PUT', '/website/documents/navigation/draft', { content: navDraft, expectedRevision: navRev });
  check('marketing manager can save a navigation draft', savedNav.status === 200, savedNav.json);
  navRev = savedNav.json?.data?.draftRevision;
  check('external link stored as external (opens in a new tab)', savedNav.json?.data?.draft?.items?.find((i: any) => i.id === 'blog')?.external === true);
  check('Save Draft does NOT reach the storefront', JSON.stringify((await site()).websiteStudio) === '{}');
  const navTok = (await call(marketing, 'POST', '/website/documents/navigation/preview-token')).json?.data?.token;
  const pv = await call(null, 'GET', `/catalog/cms-preview/session/${encodeURIComponent(navTok)}`);
  check('preview session (navigation token) shows the navigation DRAFT in the storefront site settings', pv.status === 200 && pv.json?.preview?.document === 'navigation' && pv.json?.preview?.site?.websiteStudio?.navigation?.announcement?.text === 'Eid deals are live', pv.json);
  check('preview session: no-store + noindex', /no-store/.test(pv.headers.get('cache-control') || '') && /noindex/.test(pv.headers.get('x-robots-tag') || ''));
  check('a navigation token cannot open the footer draft (scoped)', (await call(null, 'GET', `/website/preview/footer?token=${encodeURIComponent(navTok)}`)).status === 401);

  // --- Publish navigation → header switches over ----------------------------------------------------
  check('marketing manager cannot publish navigation (403)', (await call(marketing, 'POST', '/website/documents/navigation/publish', { changeNote: 'try', expectedRevision: navRev })).status === 403);
  check('admin (edit only) cannot publish navigation (403)', (await call(admin, 'POST', '/website/documents/navigation/publish', { changeNote: 'try', expectedRevision: navRev })).status === 403);
  const pubNav = await call(sa, 'POST', '/website/documents/navigation/publish', { changeNote: 'Header: Help + Blog, Eid bar (probe)', expectedRevision: navRev });
  check('super admin publishes navigation → version 2', pubNav.status === 200 && pubNav.json?.data?.published?.version === 2, pubNav.json);
  const s1 = await site();
  check('/catalog/site serves the published navigation immediately (cache cleared)', s1?.websiteStudio?.navigation?.items?.some((i: any) => i.label === 'Help') && s1.websiteStudio.navigation.announcement.enabled);
  check('…and only navigation (footer/social/company still built-in)', !s1?.websiteStudio?.footer && !s1?.websiteStudio?.social && !s1?.websiteStudio?.company);

  // --- Legacy site editor guard ----------------------------------------------------------------------
  const legacyNav = await call(sa, 'PUT', '/catalog/site', { announcementBarText: 'legacy write', announcementBarEnabled: true });
  check('legacy PUT /catalog/site refuses fields the Studio now owns (409)', legacyNav.status === 409 && legacyNav.json?.code === 'MANAGED_IN_WEBSITE_STUDIO' && legacyNav.json?.fields?.includes('announcementBarText'), legacyNav.json);

  // --- Social ---------------------------------------------------------------------------------------
  let socRev = soc0.draftRevision;
  const badSoc = async (links: unknown[]) => (await call(sa, 'PUT', '/website/documents/social/draft', { content: { version: 2, links }, expectedRevision: socRev })).json;
  check('social: a link on the wrong network domain is refused', (await badSoc([{ platform: 'facebook', url: 'https://evil.example/choosify', visible: true }]))?.code === 'INVALID_CONTENT');
  check('social: unknown network refused', (await badSoc([{ platform: 'myspace', url: 'https://myspace.com/x', visible: true }]))?.code === 'INVALID_CONTENT');
  check('social: duplicate network refused', (await badSoc([{ platform: 'youtube', url: 'https://youtube.com/@a', visible: true }, { platform: 'youtube', url: 'https://youtube.com/@b', visible: true }]))?.code === 'INVALID_CONTENT');

  // --- Footer validation + payment availability ------------------------------------------------------
  let ftRev = foot0.draftRevision;
  const f0 = foot0.draft;
  const badFt = async (patch: Record<string, unknown>) => (await call(sa, 'PUT', '/website/documents/footer/draft', { content: { ...f0, ...patch }, expectedRevision: ftRev })).json;
  check('footer: unknown payment method refused', (await badFt({ paymentMethods: ['paypal'] }))?.code === 'INVALID_CONTENT');
  check('footer: generic Google Play link (no real app) refused', (await badFt({ apps: [{ platform: 'android', url: 'https://play.google.com/store' }] }))?.field === 'apps[0].url');
  check('footer: generic App Store link refused', (await badFt({ apps: [{ platform: 'ios', url: 'https://apps.apple.com/' }] }))?.field === 'apps[0].url');
  check('footer: courier without confirmation refused', (await badFt({ deliveryPartners: [{ name: 'Pathao', logoUrl: '/icons/trust/pathao.png', confirmed: false }] }))?.field === 'deliveryPartners[0].confirmed');
  check('footer: more than 4 columns refused', (await badFt({ columns: [1, 2, 3, 4, 5].map((n) => ({ title: `C${n}`, links: [{ label: 'a', url: '/faq' }] })) }))?.field === 'columns');
  check('footer: a column with no links refused', (await badFt({ columns: [{ title: 'Empty', links: [] }] }))?.code === 'INVALID_CONTENT');
  check('footer: reserved route in a column refused', (await badFt({ columns: [{ title: 'Bad', links: [{ label: 'Admin', url: '/admin' }] }] }))?.code === 'INVALID_CONTENT');
  const ftVisa = await call(sa, 'PUT', '/website/documents/footer/draft', { content: { ...f0, paymentMethods: ['cod', 'visa'] }, expectedRevision: ftRev });
  check('a draft may list Visa (work in progress)…', ftVisa.status === 200, ftVisa.json);
  ftRev = ftVisa.json.data.draftRevision;
  const blockedFt = await call(sa, 'POST', '/website/documents/footer/publish', { changeNote: 'should be blocked', expectedRevision: ftRev });
  check('…but publishing a payment method checkout cannot take is BLOCKED (422)', blockedFt.status === 422 && /Visa/.test(blockedFt.json?.error || ''), blockedFt.json);
  const ftOk = await call(sa, 'PUT', '/website/documents/footer/draft', {
    content: { ...f0, description: 'Find the best brands in Bangladesh.', paymentMethods: ['cod'], apps: [{ platform: 'android', url: 'https://play.google.com/store/apps/details?id=bd.choosify.app' }], showBusinessIds: false },
    expectedRevision: ftRev,
  });
  check('footer draft with COD + a real-format store listing is valid', ftOk.status === 200, ftOk.json);
  ftRev = ftOk.json.data.draftRevision;
  const pubFt = await call(sa, 'POST', '/website/documents/footer/publish', { changeNote: 'Footer: COD only (probe)', expectedRevision: ftRev });
  check('footer publishes → version 2', pubFt.status === 200 && pubFt.json?.data?.published?.version === 2, pubFt.json);
  const s2 = await site();
  check('/catalog/site footer: COD only, app badge, business ids hidden', JSON.stringify(s2?.websiteStudio?.footer?.paymentMethods) === '["cod"]' && s2.websiteStudio.footer.apps.length === 1 && s2.websiteStudio.footer.showBusinessIds === false, s2?.websiteStudio?.footer);

  // --- Company: only VERIFIED identifiers reach the public footer -----------------------------------
  const comp = await doc('company');
  const compDraft = { ...(comp.draft ?? comp.published?.content), identifiers: { dbid: { value: 'DBID-123', verified: false }, tradeLicense: { value: 'TL-9', verified: true } } };
  const cs = await call(sa, 'PUT', '/website/documents/company/draft', { content: compDraft, expectedRevision: comp.draftRevision });
  const cp = await call(sa, 'POST', '/website/documents/company/publish', { changeNote: 'Company: identifiers (probe)', expectedRevision: cs.json?.data?.draftRevision });
  const pubCompany = (await site())?.websiteStudio?.company;
  check('company publishes; public footer gets the VERIFIED trade licence only (unverified DBID withheld)', cp.status === 200 && pubCompany?.tradeLicense === 'TL-9' && pubCompany?.dbid === '', pubCompany);
  check('public company view has no unverified/raw identifier objects', !JSON.stringify(pubCompany).includes('DBID-123') && !('identifiers' in (pubCompany || {})));

  // --- Rollback navigation → new version, baseline content --------------------------------------------
  const rb = await call(sa, 'POST', '/website/documents/navigation/rollback', { version: 1, changeNote: 'Back to the imported menu (probe)' });
  check('restore navigation v1 → NEW version 3', rb.status === 200 && rb.json?.data?.published?.version === 3, rb.json);
  const s3 = await site();
  check('storefront navigation back to the 8 original items, no announcement', s3?.websiteStudio?.navigation?.items?.length === 8 && !s3.websiteStudio.navigation.announcement.enabled);

  // --- Today's Deals banners inside the versioned homepage ---------------------------------------------
  const hp = await doc('homepage');
  check('homepage baseline imports the 4 setup sample banners switched OFF (storefront hid them)', hp?.draft?.dealsBanners?.length === 4 && hp.draft.dealsBanners.every((b: any) => b.isActive === false), hp?.draft?.dealsBanners);
  const products = (await call(sa, 'GET', '/catalog/products')).json?.data ?? [];
  const banner = { id: 'eid-banner', image: 'https://images.unsplash.com/photo-1607083206869-4c7672e72a8a?w=800&h=320&fit=crop&v=2', destinationType: 'product', destinationRef: String(products[0]?.id), brandName: 'Samsung', brandLogoUrl: '', isActive: true };
  check('more than 5 banners switched on is refused', (await call(sa, 'PUT', '/website/documents/homepage/draft', { content: { ...hp.draft, dealsBanners: Array.from({ length: 6 }, (_, i) => ({ ...banner, id: `b${i}` })) }, expectedRevision: hp.draftRevision })).json?.field === 'dealsBanners');
  const ghost = await call(sa, 'PUT', '/website/documents/homepage/draft', { content: { ...hp.draft, dealsBanners: [{ ...banner, destinationRef: 'deleted-product' }] }, expectedRevision: hp.draftRevision });
  const gblocked = await call(sa, 'POST', '/website/documents/homepage/publish', { changeNote: 'should be blocked', expectedRevision: ghost.json?.data?.draftRevision });
  check('a banner linking to a deleted product blocks publishing (422)', gblocked.status === 422 && /Deals banner/.test(gblocked.json?.error || ''), gblocked.json);
  const good = await call(sa, 'PUT', '/website/documents/homepage/draft', { content: { ...hp.draft, dealsBanners: [banner, ...hp.draft.dealsBanners] }, expectedRevision: ghost.json?.data?.draftRevision });
  check('before the homepage is published, /catalog/deals-banners still serves the catalog banners', (await call(null, 'GET', '/catalog/deals-banners?active=false')).json?.data?.[0]?.id === 'deals-banner-1');
  const pubHp = await call(sa, 'POST', '/website/documents/homepage/publish', { changeNote: 'Homepage with an Eid banner (probe)', expectedRevision: good.json?.data?.draftRevision });
  check('homepage publishes → version 2', pubHp.status === 200 && pubHp.json?.data?.published?.version === 2, pubHp.json);
  const live = (await call(null, 'GET', '/catalog/deals-banners')).json?.data ?? [];
  check('Today\'s Deals now serves the PUBLISHED Studio banners (only the active one)', live.length === 1 && live[0].id === 'eid-banner' && live[0].brandName === 'Samsung', live);
  const legacyPost = await call(sa, 'POST', '/catalog/deals-banners', { image: banner.image, destinationType: 'custom-url', destinationRef: '/deals' });
  check('legacy live Deals Banners writes are refused once the Studio owns the homepage (409)', legacyPost.status === 409 && legacyPost.json?.code === 'MANAGED_IN_WEBSITE_STUDIO', legacyPost.json);
  check('…including delete (409)', (await call(sa, 'DELETE', '/catalog/deals-banners/deals-banner-1')).status === 409);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => {
  console.error('PROBE CRASHED', e);
  process.exit(1);
});
