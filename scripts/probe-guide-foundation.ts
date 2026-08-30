/**
 * Guide Foundation Remediation probe.
 *
 * Proves the server-side guarantees the storefront-parity Guide Studio will be
 * built on: dedicated creator ownership authorization, explicit lifecycle,
 * presence-aware array clearing, canonical brand/body persistence, typed section
 * normalization, catalog-id validation, an authenticated ownership-scoped
 * management list, and no draft leak through the public endpoint.
 *
 *   npm run test:guide-foundation
 */
const BASE = process.env.PROBE_BASE_URL_ROOT || 'http://localhost:3001';
const API = `${BASE}/api/v1`;
const PASS: string[] = [];
const FAIL: string[] = [];

function check(cond: unknown, label: string, detail?: unknown) {
  if (cond) {
    PASS.push(label);
    console.log('PASS', label);
  } else {
    FAIL.push(label);
    console.log('FAIL', label, detail !== undefined ? JSON.stringify(detail) : '');
  }
}

const j = async (r: Response) => {
  const t = await r.text();
  try {
    return t ? JSON.parse(t) : {};
  } catch {
    return { _raw: t };
  }
};

async function login(email: string, password = 'ChoosifyDev!2026') {
  const r = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const b = await j(r);
  const token = b.accessToken || b.token || b.data?.accessToken;
  if (!token) throw new Error(`login failed for ${email}: ${r.status} ${JSON.stringify(b).slice(0, 200)}`);
  const me = await j(await fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } }));
  return {
    token,
    userId: me.uid || me.id || me.userId || me.data?.id || me.data?.uid,
    role: me.role || me.data?.role,
  };
}

const authH = (token?: string) => ({
  'Content-Type': 'application/json',
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

async function req(
  method: string,
  path: string,
  token?: string,
  body?: unknown,
): Promise<{ status: number; body: any }> {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: authH(token),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return { status: r.status, body: await j(r) };
}

async function main() {
  console.log('=== Guide Foundation probe ===');

  const admin = await login('admin@choosify.com.bd');
  const marketing = await login('marketing@choosify.com.bd');
  const creatorA = await login('creator@choosify.com.bd');
  const seller = await login('seller@choosify.com.bd');

  // throwaway consumer
  const consumerEmail = `guide-probe-consumer-${Date.now()}@test.choosify.bd`;
  await fetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: consumerEmail, password: 'GuideProbe!2026', fullName: 'Guide Probe Consumer' }),
  });
  const consumer = await login(consumerEmail, 'GuideProbe!2026');

  // real catalog references
  const products = (await j(await fetch(`${API}/catalog/products`))).data || [];
  const brands = (await j(await fetch(`${API}/catalog/brands`))).data || [];
  const realProductId = products[0]?.id;
  const realProductId2 = products[1]?.id;
  const realBrandId = brands[0]?.id;
  check(realProductId && realBrandId, 'catalog fixtures available (product + brand)', { realProductId, realBrandId });

  // ── 1. Creator create → server-authoritative draft ───────────────────────
  const createRes = await req('POST', '/catalog/guides', creatorA.token, {
    title: '[probe] Creator A buying guide',
    format: 'buying_guide',
    type: 'article',
    excerpt: 'Probe draft',
    status: 'live', // must be ignored
    creatorId: 'spoofed-creator-id', // must be ignored
    publishedAt: '2020-01-01T00:00:00.000Z', // must be ignored
  });
  check(createRes.status === 200, 'creator can create own guide (POST 200)', createRes.status);
  const gA = createRes.body.data;
  check(gA?.status === 'draft', 'new guide defaults to draft (status not client-controlled)', gA?.status);
  check(!!gA?.creatorId && gA.creatorId !== 'spoofed-creator-id', 'creatorId is server-authoritative (spoof ignored)', gA?.creatorId);
  const creatorAId = gA.creatorId;
  const idA = gA.id;

  // ── 2. Owner can read own draft ─────────────────────────────────────────
  const readOwn = await req('GET', `/catalog/guides/${idA}`, creatorA.token);
  check(readOwn.status === 200 && readOwn.body?.id === idA, 'creator A can reload own draft', readOwn.status);

  // ── 3. Draft is not leaked publicly ────────────────────────────────────
  const readAnon = await req('GET', `/catalog/guides/${idA}`);
  check(readAnon.status === 404, 'unauthenticated GET of a draft guide → 404 (no leak)', readAnon.status);
  const pubList = await req('GET', '/catalog/guides');
  check(
    Array.isArray(pubList.body?.data) && !pubList.body.data.some((g: any) => g.id === idA),
    'public /catalog/guides does not include the draft',
  );
  const pubListForced = await req('GET', '/catalog/guides?status=draft');
  check(
    Array.isArray(pubListForced.body?.data) && pubListForced.body.data.every((g: any) => g.status === 'live'),
    'public /catalog/guides?status=draft still returns live-only (no override)',
  );

  // ── 4. Management list — auth + ownership scope ────────────────────────
  const manageAnon = await req('GET', '/catalog/guides/manage');
  check(manageAnon.status === 401, 'GET /catalog/guides/manage unauthenticated → 401', manageAnon.status);
  const manageSeller = await req('GET', '/catalog/guides/manage', seller.token);
  check(
    manageSeller.status === 200 &&
      manageSeller.body?.scope === 'seller' &&
      !manageSeller.body.data.some((r: any) => r.id === idA),
    'seller management list has seller scope and excludes another owner’s guide',
    { status: manageSeller.status, scope: manageSeller.body?.scope },
  );
  const manageConsumer = await req('GET', '/catalog/guides/manage', consumer.token);
  check(manageConsumer.status === 403, 'GET /catalog/guides/manage as consumer → 403', manageConsumer.status);
  const manageA = await req('GET', '/catalog/guides/manage', creatorA.token);
  check(
    manageA.status === 200 && manageA.body?.scope === 'creator' && manageA.body.data.some((r: any) => r.id === idA),
    'creator A management list is scoped to own guides and includes the new draft',
    { status: manageA.status, scope: manageA.body?.scope },
  );
  const manageStaff = await req('GET', '/catalog/guides/manage', admin.token);
  check(
    manageStaff.status === 200 && manageStaff.body?.scope === 'staff' && manageStaff.body.data.some((r: any) => r.id === idA),
    'staff management list has staff scope and sees all guides',
  );

  // ── 5. Edit own draft + empty-array clear / omit-preserve ─────────────
  const edit1 = await req('PATCH', `/catalog/guides/${idA}`, creatorA.token, {
    title: '[probe] Creator A buying guide (edited)',
    tags: ['alpha', 'beta'],
    whatWeLike: ['good screen'],
  });
  check(
    edit1.status === 200 &&
      edit1.body.data.title.includes('(edited)') &&
      JSON.stringify(edit1.body.data.tags) === JSON.stringify(['alpha', 'beta']),
    'creator A can edit own draft; populated array stored',
  );
  const editOmit = await req('PATCH', `/catalog/guides/${idA}`, creatorA.token, { excerpt: 'changed excerpt' });
  check(
    JSON.stringify(editOmit.body.data.tags) === JSON.stringify(['alpha', 'beta']),
    'omitted array field on PATCH preserves existing value',
    editOmit.body.data.tags,
  );
  const editClear = await req('PATCH', `/catalog/guides/${idA}`, creatorA.token, { tags: [], whatWeLike: [] });
  check(
    Array.isArray(editClear.body.data.tags) && editClear.body.data.tags.length === 0 && editClear.body.data.whatWeLike.length === 0,
    'explicit [] clears the array (not "preserve existing")',
    { tags: editClear.body.data.tags, whatWeLike: editClear.body.data.whatWeLike },
  );

  // ── 6. Canonical brandIds + body round-trip ───────────────────────────
  const relRes = await req('PATCH', `/catalog/guides/${idA}`, creatorA.token, {
    brandIds: [realBrandId, 'brand-does-not-exist-xyz'],
    body: 'The canonical article body lives here now.',
    productIds: [realProductId, 'prod-does-not-exist-xyz'],
  });
  check(
    JSON.stringify(relRes.body.data.brandIds) === JSON.stringify([realBrandId]),
    'brandIds round-trips canonically; unknown brand id dropped',
    relRes.body.data.brandIds,
  );
  check(
    JSON.stringify(relRes.body.data.productIds) === JSON.stringify([realProductId]),
    'productIds validated against the catalog; unknown id dropped',
    relRes.body.data.productIds,
  );
  check(
    relRes.body.data.body === 'The canonical article body lives here now.',
    'canonical body field round-trips independently',
    relRes.body.data.body,
  );
  const bm = (relRes.body.data.sections || []).find((s: any) => s.id === 'brands_mentioned');
  check(
    bm && JSON.stringify(bm.data?.brandIds) === JSON.stringify([realBrandId]),
    'legacy sections["brands_mentioned"].data.brandIds is kept in sync with canonical brandIds',
    bm?.data,
  );
  const takeaway = (relRes.body.data.sections || []).find((s: any) => s.id === 'takeaways');
  check(
    !takeaway || takeaway.data?.takeawayBody !== 'The canonical article body lives here now.',
    'article body does NOT bleed into the Key Takeaways section',
  );

  // ── 7. Typed section normalization ────────────────────────────────────
  const secRes = await req('PATCH', `/catalog/guides/${idA}`, creatorA.token, {
    sections: [
      {
        id: 'verdict',
        enabled: true,
        order: 1,
        data: { bestFor: ['pros'], notFor: ['cons'], whatWeLike: ['a'], whatToConsider: ['b'], junkField: 'x' },
      },
      { id: 'winner', enabled: true, order: 2, data: { winnerIds: [realProductId], junkField: 1 } },
      { id: 'how_review_was_made', enabled: true, order: 3, data: { reviewMethodSteps: ['tested 30d'], evil: true } },
      { id: 'totally_unknown_section', enabled: true, order: 4, data: { keep: 'passthrough' } },
    ],
  });
  const secById = Object.fromEntries((secRes.body.data.sections || []).map((s: any) => [s.id, s.data]));
  check(
    secById.verdict &&
      !('junkField' in secById.verdict) &&
      JSON.stringify(secById.verdict.bestFor) === JSON.stringify(['pros']),
    'verdict section normalized to its typed contract (junk stripped)',
    secById.verdict,
  );
  check(
    secById.winner &&
      !('junkField' in secById.winner) &&
      // legacy winnerIds[0] is migrated to a typed `overall` ref (backward-compatible, not frozen)
      secById.winner.overall?.entityType === 'product' &&
      secById.winner.overall?.entityId === realProductId,
    'winner section normalized (legacy winnerIds → typed overall ref, junk stripped)',
    secById.winner,
  );
  check(
    secById.how_review_was_made && !('evil' in secById.how_review_was_made),
    'how_review_was_made normalized (unknown keys stripped)',
  );
  check(
    secById.totally_unknown_section?.keep === 'passthrough',
    'unknown section id passed through shallowly (not destroyed)',
  );

  // ── 8. Lifecycle: explicit only ──────────────────────────────────────
  const saveNoPublish = await req('PATCH', `/catalog/guides/${idA}`, creatorA.token, { status: 'live', title: '[probe] still draft' });
  check(saveNoPublish.body.data.status === 'draft', 'ordinary save cannot publish (status stays draft)', saveNoPublish.body.data.status);

  const publishRes = await req('POST', `/catalog/guides/${idA}/publish`, creatorA.token);
  check(publishRes.status === 200 && publishRes.body.data.status === 'live', 'explicit publish → live', publishRes.body.data?.status);
  check(!!publishRes.body.data.publishedAt, 'publishedAt stamped on publish', publishRes.body.data.publishedAt);

  const pubList2 = await req('GET', '/catalog/guides');
  check(pubList2.body.data.some((g: any) => g.id === idA), 'published guide now appears in public /catalog/guides');
  const readAnon2 = await req('GET', `/catalog/guides/${idA}`);
  check(readAnon2.status === 200, 'published guide is publicly readable by id');

  const saveAfterPublish = await req('PATCH', `/catalog/guides/${idA}`, creatorA.token, { status: 'draft', excerpt: 'post-publish edit' });
  check(saveAfterPublish.body.data.status === 'live', 'ordinary save after publish does not unpublish', saveAfterPublish.body.data.status);

  const archiveRes = await req('POST', `/catalog/guides/${idA}/archive`, creatorA.token);
  check(archiveRes.status === 200 && archiveRes.body.data.status === 'archived', 'explicit archive → archived', archiveRes.body.data?.status);
  const pubList3 = await req('GET', '/catalog/guides');
  check(!pubList3.body.data.some((g: any) => g.id === idA), 'archived guide removed from public list');

  // ── 9. Cross-owner + unauthorized mutation rejected (server-enforced) ─
  // Staff seeds a guide owned by a different (synthetic) creator identity.
  const staffSeed = await req('POST', '/catalog/guides', admin.token, {
    title: '[probe] Creator B guide (staff-seeded)',
    format: 'product_review',
    type: 'article',
    creatorId: 'probe-synthetic-creator-B',
  });
  check(staffSeed.status === 200 && staffSeed.body.data.creatorId === 'probe-synthetic-creator-B', 'staff may set an explicit creatorId', staffSeed.body.data?.creatorId);
  const idB = staffSeed.body.data.id;

  const aToB = await req('PATCH', `/catalog/guides/${idB}`, creatorA.token, { title: 'hijack' });
  check(aToB.status === 403, 'creator A cannot mutate another creator’s guide by id → 403', aToB.status);
  const aPublishB = await req('POST', `/catalog/guides/${idB}/publish`, creatorA.token);
  check(aPublishB.status === 403, 'creator A cannot publish another creator’s guide → 403', aPublishB.status);

  const sellerEdit = await req('PATCH', `/catalog/guides/${idB}`, seller.token, { title: 'seller edit' });
  check(sellerEdit.status === 403, 'seller cannot edit a guide → 403 (nav visibility ≠ authority)', sellerEdit.status);
  const consumerEdit = await req('PATCH', `/catalog/guides/${idB}`, consumer.token, { title: 'consumer edit' });
  check(consumerEdit.status === 403, 'consumer cannot edit a guide → 403', consumerEdit.status);
  const anonEdit = await req('PATCH', `/catalog/guides/${idB}`, undefined, { title: 'anon edit' });
  check(anonEdit.status === 401, 'unauthenticated guide edit → 401', anonEdit.status);

  const staffEdit = await req('PATCH', `/catalog/guides/${idB}`, admin.token, { title: '[probe] Creator B guide (staff edited)' });
  check(staffEdit.status === 200, 'authorized staff (cms:edit) may edit any guide → 200', staffEdit.status);
  const marketingPublish = await req('POST', `/catalog/guides/${idB}/publish`, marketing.token);
  check(marketingPublish.status === 200 && marketingPublish.body.data.status === 'live', 'marketing_manager (cms:edit) may publish → live', marketingPublish.body.data?.status);

  // ── 9b. Publisher identity (Creator-vs-Brand) — server-authoritative ──
  // A brand owned by the seed seller (admin mints ownership).
  const sellerBrandRes = await req('POST', '/catalog/brands', admin.token, {
    name: `[probe] Seller Publisher Brand ${Date.now()}`,
    category: 'Electronics',
    sellerId: seller.userId,
  });
  const sellerBrandId = sellerBrandRes.body?.data?.id;
  check(!!sellerBrandId && sellerBrandRes.body.data.sellerId === seller.userId, 'seed: seller-owned brand created', {
    id: sellerBrandId,
  });

  // Creator cannot spoof a brand publisher — server coerces to creator.
  const spoof = await req('POST', '/catalog/guides', creatorA.token, {
    title: '[probe] creator spoof brand publisher',
    format: 'buying_guide',
    type: 'article',
    publisherType: 'brand',
    publisherBrandId: sellerBrandId,
  });
  check(
    spoof.status === 403 || (spoof.status === 200 && spoof.body.data.publisherType === 'creator'),
    'creator cannot self-declare a brand publisher (coerced to creator or 403)',
    { status: spoof.status, publisherType: spoof.body?.data?.publisherType },
  );
  const spoofId = spoof.status === 200 ? spoof.body.data.id : null;

  // Seller authors a brand guide for a brand they DON'T own → 403.
  const wrongBrand = await req('POST', '/catalog/guides', seller.token, {
    title: '[probe] seller wrong brand',
    format: 'buying_guide',
    type: 'article',
    publisherType: 'brand',
    publisherBrandId: realBrandId, // seeded brand, not owned by the seed seller
  });
  check(wrongBrand.status === 403, 'seller cannot publish as a brand they do not own → 403', wrongBrand.status);

  // Seller authors a brand guide for their OWN brand → ok, publisherType brand, no creatorId.
  const brandGuide = await req('POST', '/catalog/guides', seller.token, {
    title: '[probe] brand-authored guide',
    format: 'product_review',
    type: 'article',
    publisherType: 'brand',
    publisherBrandId: sellerBrandId,
  });
  check(
    brandGuide.status === 200 &&
      brandGuide.body.data.publisherType === 'brand' &&
      brandGuide.body.data.publisherBrandId === sellerBrandId &&
      !brandGuide.body.data.creatorId,
    'seller publishes as their own brand → publisherType brand, no creator author',
    { status: brandGuide.status, pt: brandGuide.body?.data?.publisherType, cid: brandGuide.body?.data?.creatorId },
  );
  const brandGuideId = brandGuide.body?.data?.id;

  // Creator cannot edit a brand-authored guide.
  const creatorEditsBrandGuide = await req('PATCH', `/catalog/guides/${brandGuideId}`, creatorA.token, { title: 'x' });
  check(creatorEditsBrandGuide.status === 403, 'creator cannot mutate a brand-authored guide → 403', creatorEditsBrandGuide.status);

  // Seller owner CAN edit + publish their brand-authored guide.
  const sellerEditsBrandGuide = await req('PATCH', `/catalog/guides/${brandGuideId}`, seller.token, {
    title: '[probe] brand-authored guide (edited)',
  });
  check(sellerEditsBrandGuide.status === 200, 'brand owner can edit their brand-authored guide → 200', sellerEditsBrandGuide.status);
  const sellerPublishesBrandGuide = await req('POST', `/catalog/guides/${brandGuideId}/publish`, seller.token);
  check(
    sellerPublishesBrandGuide.status === 200 && sellerPublishesBrandGuide.body.data.status === 'live',
    'brand owner can publish their brand-authored guide → live',
  );

  // brandIds are MENTIONS, never authorship: a creator guide with brandIds stays creator-authored.
  const mentionGuide = await req('PATCH', `/catalog/guides/${idA}`, creatorA.token, { brandIds: [realBrandId] });
  check(
    mentionGuide.body.data.publisherType === 'creator' && !mentionGuide.body.data.publisherBrandId,
    'brandIds (mentions) never promote a guide to brand-authored',
    { pt: mentionGuide.body?.data?.publisherType, pbid: mentionGuide.body?.data?.publisherBrandId },
  );

  for (const id of [spoofId, brandGuideId].filter(Boolean)) {
    await req('POST', `/catalog/guides/${id}/archive`, admin.token);
  }

  // ── 10. Legacy record shape remains readable / migrates on write ──────
  const legacySeed = await req('POST', '/catalog/guides', admin.token, {
    title: '[probe] legacy-shape guide',
    format: 'comparison',
    type: 'article',
    creatorId: 'probe-synthetic-creator-B',
    // brand relation only expressed the old way; no top-level brandIds
    sections: [{ id: 'brands_mentioned', enabled: true, order: 1, data: { brandIds: [realBrandId] } }],
  });
  check(
    legacySeed.status === 200 && JSON.stringify(legacySeed.body.data.brandIds) === JSON.stringify([realBrandId]),
    'legacy brands_mentioned section is read up into canonical brandIds on write',
    legacySeed.body.data?.brandIds,
  );

  // archive probe guides (no hard delete in V1)
  for (const id of [idB, legacySeed.body.data?.id].filter(Boolean)) {
    await req('POST', `/catalog/guides/${id}/archive`, admin.token);
  }

  console.log(`\n=== ${PASS.length} passed, ${FAIL.length} failed ===`);
  if (FAIL.length) {
    console.error('FAILURES:\n - ' + FAIL.join('\n - '));
    process.exit(1);
  }
  console.log('ALL GUIDE FOUNDATION CHECKS PASSED');
}

main().catch((e) => {
  console.error('CRASH', e);
  process.exit(1);
});
