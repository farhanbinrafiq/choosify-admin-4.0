/**
 * Canonical seller Deals — open-marketplace lifecycle + Promotion Requests probe.
 *
 * Deals: seller-created on own live listings, stored `active` immediately (no
 * approval), time state derived from dates (Scheduled / Active / Expired),
 * overlap protection (409), Scheduled edit / Active lock / End Now / Withdraw,
 * admin moderation (Pause / Resume / Disable).
 * Promotion Requests: only for the seller's own currently Active deal;
 * pending → approved | rejected | cancelled; server-derived fields; approval
 * re-validation; generic ad routes cannot manipulate deal-linked requests.
 * Legacy + "no pricing effect" (product/service/cart prices unchanged).
 *
 * Requires a running local server (:3001) with the seeded admin.
 * Usage: npx tsx scripts/probe-deals-phase1.ts
 */
import { randomBytes } from 'node:crypto';

const BASE = (process.env.PROBE_BASE_URL || 'http://localhost:3001/api/v1').replace(/\/$/, '');
const ADMIN_EMAIL = process.env.PROBE_ADMIN_EMAIL || 'admin@choosify.com.bd';
const ADMIN_PASS = process.env.DEV_SEED_PASSWORD || process.env.PROBE_ADMIN_PASSWORD || 'ChoosifyDev!2026';
const RUN = randomBytes(3).toString('hex');
const PASSWORD = `ProbeDeal1_${RUN}`;

type Json = Record<string, any>;
let failed = 0;
let passed = 0;
function check(cond: unknown, label: string, detail?: unknown) {
  if (cond) {
    passed += 1;
    console.log('PASS', label);
  } else {
    failed += 1;
    console.log('FAIL', label, detail === undefined ? '' : JSON.stringify(detail).slice(0, 300));
  }
}

async function req(method: string, path: string, token?: string, body?: unknown): Promise<{ status: number; body: Json }> {
  let status = 0;
  let parsed: Json = {};
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    status = res.status;
    parsed = (await res.json().catch(() => ({}))) as Json;
    if (status !== 429) break;
    await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
  }
  return { status, body: parsed };
}

async function must(method: string, path: string, token: string | undefined, body: unknown, ok: number[]): Promise<Json> {
  const r = await req(method, path, token, body);
  if (!ok.includes(r.status)) throw new Error(`${method} ${path} → ${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
  return r.body;
}

async function login(email: string, password: string) {
  const b = await must('POST', '/auth/login', undefined, { email, password }, [200]);
  return { token: b.accessToken as string, uid: b.uid as string };
}

async function provisionPartner(adminToken: string, type: 'seller' | 'creator', label: string) {
  const email = `probe.deals.${type}.${label}.${RUN}@example.com`;
  await must(
    'POST',
    '/auth/partner-apply',
    undefined,
    {
      applicantType: type,
      email,
      password: PASSWORD,
      displayName: `Deals Probe ${type} ${label}`,
      businessOrChannelName: `Deals Probe ${label} ${RUN}`,
      phone: '+8801711000123',
      category: 'General',
      city: 'Dhaka',
      niche: 'General',
    },
    [200, 201],
  );
  const list = await must('GET', '/operations/partner-applications?status=pending', adminToken, undefined, [200]);
  const app = ((list.applications as Json[]) || []).find((a) => a.email === email);
  if (!app) throw new Error(`pending application missing for ${email}`);
  await must('POST', `/operations/partner-applications/${encodeURIComponent(app.id)}/approve`, adminToken, { note: 'deals probe' }, [200]);
  return login(email, PASSWORD);
}

async function sellerFixture(adminToken: string, label: string) {
  const seller = await provisionPartner(adminToken, 'seller', label);
  const own = await must('GET', '/catalog/brands', seller.token, undefined, [200]);
  for (const b of (own.data as Json[]) || []) {
    await req('PATCH', `/catalog/brands/${encodeURIComponent(b.id)}/marketplace-access`, adminToken, { status: 'granted' });
  }
  const brand = await must('POST', '/catalog/brands', seller.token, { name: `Deals Probe Brand ${label} ${RUN}`, category: 'General', description: 'probe' }, [200, 201]);
  const brandId = brand.data.id as string;
  await must('PATCH', `/catalog/brands/${brandId}/marketplace-access`, adminToken, { status: 'granted' }, [200]);
  return { ...seller, brandId };
}

async function createProduct(token: string, brandId: string, categoryId: string, title: string, price: number) {
  const p = await must(
    'POST',
    '/catalog/products',
    token,
    { brandId, categoryId, title, price, stock: 20, status: 'draft', category: 'General', description: 'Deals probe product', image: 'https://example.com/probe.jpg' },
    [200, 201],
  );
  await must('PATCH', `/catalog/products/${p.data.id}`, token, { status: 'live' }, [200]);
  await req('PATCH', `/catalog/products/${p.data.id}/inventory`, token, { quantity: 20 });
  return p.data.id as string;
}

async function createService(token: string, brandId: string, categoryId: string, title: string, price: number) {
  const s = await must(
    'POST',
    '/catalog/services',
    token,
    { brandId, categoryId, title, price, currency: 'BDT', status: 'draft', category: 'General', description: 'Deals probe service', durationMinutes: 60, serviceArea: 'Dhaka' },
    [200, 201],
  );
  await must('PATCH', `/catalog/services/${s.data.id}`, token, { status: 'live' }, [200]);
  return s.data.id as string;
}

const iso = (msFromNow: number) => new Date(Date.now() + msFromNow).toISOString();
const DAY = 86_400_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function dealBody(listingType: string, listingId: string, mode: string, value: number, start = iso(-60_000), end = iso(7 * DAY)) {
  return { listingType, listingId, pricingMode: mode, pricingValue: value, startsAt: start, endsAt: end };
}

async function dealView(token: string, id: string): Promise<Json | undefined> {
  return ((await must('GET', '/ads/deals', token, undefined, [200])).data as Json[]).find((d) => d.id === id);
}

async function requestView(token: string, id: string): Promise<Json | undefined> {
  return ((await must('GET', '/ads/promotion-requests', token, undefined, [200])).data as Json[]).find((r) => r.id === id);
}

async function main() {
  const admin = await login(ADMIN_EMAIL, ADMIN_PASS);
  const cats = await must('GET', '/catalog/categories', admin.token, undefined, [200]);
  const categoryId = (cats.data as Json[])[0].id as string;

  const A = await sellerFixture(admin.token, 'a');
  const B = await sellerFixture(admin.token, 'b');
  const creator = await provisionPartner(admin.token, 'creator', 'c');

  const prodA = await createProduct(A.token, A.brandId, categoryId, `Deals Probe Phone ${RUN}`, 100000);
  const prodA2 = await createProduct(A.token, A.brandId, categoryId, `Deals Probe Laptop ${RUN}`, 100000);
  const prodA3 = await createProduct(A.token, A.brandId, categoryId, `Deals Probe Tablet ${RUN}`, 50000);
  const prodA4 = await createProduct(A.token, A.brandId, categoryId, `Deals Probe Watch ${RUN}`, 20000);
  const prodA5 = await createProduct(A.token, A.brandId, categoryId, `Deals Probe Camera ${RUN}`, 80000);
  const svcA = await createService(A.token, A.brandId, categoryId, `Deals Probe Repair ${RUN}`, 5000);
  const prodB = await createProduct(B.token, B.brandId, categoryId, `Deals Probe B Product ${RUN}`, 20000);
  const svcB = await createService(B.token, B.brandId, categoryId, `Deals Probe B Service ${RUN}`, 3000);
  console.log('fixtures ready', { prodA, prodA2, prodA3, prodA4, prodA5, svcA, prodB, svcB });

  // ── 1–6 NORMAL DEAL: created enabled, no approval ──
  const created = await req('POST', '/ads/deals', A.token, dealBody('product', prodA, 'percentage', 20));
  const dealA = created.body.data as Json;
  check(created.status === 201, '1. seller creates valid deal', created.body);
  check(dealA?.status === 'active', '2. new deal stored active (enabled) — no pending', dealA?.status);
  const viewA = await dealView(A.token, dealA.id);
  check(viewA?.timeState === 'active' && viewA?.filterKey === 'active', '4. current-start deal calculates Active', viewA?.timeState);
  check(!('review' in (dealA || {})), '6. no approval/review trail on a deal');
  const approveRoute = await req('POST', `/ads/deals/${dealA.id}/approve`, admin.token);
  const rejectRoute = await req('POST', `/ads/deals/${dealA.id}/reject`, admin.token, { reason: 'x' });
  check(approveRoute.status === 404 && rejectRoute.status === 404, '6. no deal approve/reject routes exist (404)', [approveRoute.status, rejectRoute.status]);
  const bannerApproveDeal = await req('POST', `/ads/banners/${dealA.id}/approve`, admin.token);
  const promoRejectDeal = await req('POST', `/ads/promotions/${dealA.id}/reject`, admin.token, { reason: 'x' });
  check(bannerApproveDeal.status === 400 && promoRejectDeal.status === 400, '6. generic approve/reject routes refuse deals (deals are never approved)', [bannerApproveDeal.body, promoRejectDeal.body]);

  const future = await req('POST', '/ads/deals', A.token, dealBody('product', prodA2, 'amount', 10000, iso(3 * DAY), iso(10 * DAY)));
  const dealFuture = future.body.data as Json;
  check(future.status === 201 && dealFuture.status === 'active', 'future-start deal created enabled', future.body);
  check((await dealView(A.token, dealFuture.id))?.timeState === 'scheduled', '3. future-start deal calculates Scheduled');

  const shortDeal = await must('POST', '/ads/deals', A.token, dealBody('product', prodA4, 'percentage', 12, iso(-60_000), iso(5_000)), [201]);
  await sleep(6_000);
  const expView = await dealView(A.token, shortDeal.data.id);
  check(expView?.timeState === 'expired' && expView?.status === 'active', '5. deal expires automatically (stored status stays active)', expView);

  // ── 7 / 9 OWNERSHIP ──
  const ownService = await req('POST', '/ads/deals', A.token, dealBody('service', svcA, 'amount', 1000));
  const dealSvc = ownService.body.data as Json;
  check(ownService.status === 201 && dealSvc.dealTerms?.dealPriceAtSubmit === 4000, '7. seller can use own service (fixed ৳1,000 off ৳5,000 = ৳4,000)', ownService.body);
  const otherProduct = await req('POST', '/ads/deals', A.token, dealBody('product', prodB, 'percentage', 10));
  check(otherProduct.status === 403, "9. seller cannot create a deal on another seller's product", otherProduct);
  const otherService = await req('POST', '/ads/deals', A.token, dealBody('service', svcB, 'percentage', 10));
  check(otherService.status === 403, "9. seller cannot create a deal on another seller's service", otherService);
  const fromListingOther = await req('POST', '/ads/deals/from-listing', A.token, dealBody('product', prodB, 'percentage', 10));
  check(fromListingOther.status === 403, "9. from-listing also refuses another seller's listing", fromListingOther);
  const creatorTry = await req('POST', '/ads/deals', creator.token, dealBody('product', prodA3, 'percentage', 10));
  check(creatorTry.status === 403, '7. creator gets 403', creatorTry);
  const adminTry = await req('POST', '/ads/deals', admin.token, dealBody('product', prodA3, 'percentage', 10));
  check(adminTry.status === 403, '7. admin gets 403 for deal creation (no platform deals in v1)', adminTry);
  const forged = await req('POST', '/ads/deals', A.token, {
    ...dealBody('product', prodA3, 'special_price', 44999),
    ownerId: B.uid, ownerRole: 'admin', sellerId: B.uid, status: 'paused', dealPrice: 1, basePrice: 1, metadata: { approvedBy: 'x' },
  });
  const f = forged.body.data as Json;
  check(
    forged.status === 201 && f.ownerId === A.uid && f.ownerRole === 'seller' && f.status === 'active' &&
      f.dealTerms?.dealPriceAtSubmit === 44999 && f.dealTerms?.basePriceAtSubmit === 50000 && !f.metadata?.approvedBy,
    '7. owner/status/price/metadata from request body ignored (server-derived)',
    f,
  );

  // ── 8 / 10 PRICING ──
  check(dealA.dealTerms?.dealPriceAtSubmit === 80000, '8. percentage: 20% of ৳100,000 = ৳80,000', dealA.dealTerms);
  check(dealFuture.dealTerms?.dealPriceAtSubmit === 90000, '8. fixed amount: ৳10,000 off ৳100,000 = ৳90,000', dealFuture.dealTerms);
  check(f?.dealTerms?.mode === 'special_price', '10. special price accepted below base (৳44,999 < ৳50,000)');
  for (const [mode, value, label] of [
    ['percentage', 0, 'percentage 0'], ['percentage', 100, 'percentage 100'], ['percentage', -5, 'percentage negative'],
    ['percentage', 'abc', 'non-numeric'], ['amount', 0, 'fixed 0'], ['amount', 100000, 'fixed = base'], ['amount', 150000, 'fixed > base'],
    ['special_price', 100000, 'special = base'], ['special_price', 120000, 'special > base'], ['special_price', 0, 'special 0'],
    ['special_price', -1, 'special negative'], ['special_price', 0.5, 'special below ৳1'], ['bogus', 10, 'unknown mode'],
  ] as Array<[string, unknown, string]>) {
    const r = await req('POST', '/ads/deals', A.token, { ...dealBody('product', prodA5, mode, 0), pricingValue: value });
    check(r.status === 400, `${label.startsWith('special') ? '10' : '8'}. ${label} rejected (400)`, r);
  }
  const clientPrice = await req('POST', '/ads/deals', A.token, { ...dealBody('product', prodA5, 'percentage', 10, iso(20 * DAY), iso(21 * DAY)), dealPrice: 1 });
  check(clientPrice.status === 201 && clientPrice.body.data.dealTerms.dealPriceAtSubmit === 72000, '8. client-supplied dealPrice ignored (server computed ৳72,000)', clientPrice.body);

  // ── DATES ──
  for (const [label, s, e] of [
    ['invalid ISO', '2026-13-45', iso(DAY)],
    ['timestamp without timezone', '2026-10-01T10:00', iso(DAY)],
    ['start >= end', iso(5 * DAY), iso(2 * DAY)],
    ['start == end', iso(2 * DAY), iso(2 * DAY)],
    ['past end', iso(-5 * DAY), iso(-1 * DAY)],
  ]) {
    const r = await req('POST', '/ads/deals', A.token, dealBody('product', prodA5, 'percentage', 10, s, e));
    check(r.status === 400, `9. dates: ${label} rejected`, r);
  }
  const longDeal = await req('POST', '/ads/deals', A.token, dealBody('product', prodA5, 'percentage', 5, iso(30 * DAY), iso(430 * DAY)));
  check(longDeal.status === 201, 'dates: 400-day deal accepted (no max duration)', longDeal);

  // ── 11 OVERLAP ──
  const overlap = await req('POST', '/ads/deals', A.token, dealBody('product', prodA, 'percentage', 30, iso(DAY), iso(2 * DAY)));
  check(overlap.status === 409 && /already occupies/.test(String(overlap.body.error)), '11. overlapping deal on same listing → 409 with clear error', overlap);
  const nonOverlap = await req('POST', '/ads/deals', A.token, dealBody('product', prodA, 'percentage', 30, iso(8 * DAY), iso(9 * DAY)));
  check(nonOverlap.status === 201, '11. non-overlapping window on same listing allowed', nonOverlap);
  const afterExpired = await req('POST', '/ads/deals', A.token, dealBody('product', prodA4, 'percentage', 15, iso(-60_000), iso(3 * DAY)));
  check(afterExpired.status === 201, '11. expired deal does not block a new deal on that listing', afterExpired);

  // ── 13–15 EDITING / END NOW / WITHDRAW ──
  const editScheduled = await req('PATCH', `/ads/deals/${dealFuture.id}`, A.token, { pricingMode: 'percentage', pricingValue: 25, startsAt: iso(4 * DAY) });
  check(editScheduled.status === 200 && editScheduled.body.data.dealTerms.dealPriceAtSubmit === 75000, '13. scheduled deal: pricing + dates editable (25% → ৳75,000)', editScheduled.body);
  const editListing = await req('PATCH', `/ads/deals/${dealFuture.id}`, A.token, { listingId: prodA3 });
  check(editListing.status === 403, '13. scheduled deal: listing cannot be changed', editListing);
  const editOverlap = await req('PATCH', `/ads/deals/${nonOverlap.body.data.id}`, A.token, { startsAt: iso(5 * DAY) });
  check(editOverlap.status === 409, '13. scheduled edit re-checks overlap (409)', editOverlap);
  const editOther = await req('PATCH', `/ads/deals/${dealFuture.id}`, B.token, { pricingValue: 5 });
  check(editOther.status === 403, "13. another seller cannot edit someone else's deal", editOther);
  const patchStatus = await req('PATCH', `/ads/deals/${dealFuture.id}`, A.token, { status: 'paused' });
  check(patchStatus.status === 403, 'seller cannot set deal status', patchStatus);
  const activePrice = await req('PATCH', `/ads/deals/${dealA.id}`, A.token, { pricingValue: 30 });
  check(activePrice.status === 403, '14. active deal price cannot be changed', activePrice);
  const activeStart = await req('PATCH', `/ads/deals/${dealA.id}`, A.token, { startsAt: iso(DAY) });
  check(activeStart.status === 403, '14. active deal start cannot be changed', activeStart);
  const activeExtend = await req('PATCH', `/ads/deals/${dealA.id}`, A.token, { endsAt: iso(30 * DAY) });
  check(activeExtend.status === 403, '14. active deal end cannot be extended', activeExtend);
  const activeShorten = await req('PATCH', `/ads/deals/${dealA.id}`, A.token, { endsAt: iso(6 * DAY) });
  check(activeShorten.status === 200, '14. active deal end can be moved earlier', activeShorten);
  const genericPatchDeal = await req('PATCH', `/ads/${dealA.id}`, admin.token, { status: 'paused' });
  check(genericPatchDeal.status === 400, 'generic PATCH /ads/:id refuses deals', genericPatchDeal);

  const withdrawActive = await req('DELETE', `/ads/${dealA.id}`, A.token);
  check(withdrawActive.status === 403, '15. active deal cannot be withdrawn (use End Now)', withdrawActive);
  const withdrawOther = await req('DELETE', `/ads/${dealFuture.id}`, B.token);
  check(withdrawOther.status === 403, "15. another seller cannot withdraw someone else's deal", withdrawOther);
  const adminDelete = await req('DELETE', `/ads/${dealFuture.id}`, admin.token);
  check(adminDelete.status === 403, 'admin cannot delete deals (disable instead)', adminDelete);
  const withdraw = await req('DELETE', `/ads/${nonOverlap.body.data.id}`, A.token);
  check(withdraw.status === 200 && !(await dealView(A.token, nonOverlap.body.data.id)), '15. scheduled deal can be withdrawn');

  const endScheduled = await req('POST', `/ads/deals/${dealFuture.id}/end`, A.token);
  const endSchedView = await dealView(A.token, dealFuture.id);
  check(endScheduled.status === 200 && endSchedView?.timeState === 'expired', '12. End Now on a scheduled deal → Expired (record kept)', endSchedView?.timeState);
  const endOther = await req('POST', `/ads/deals/${afterExpired.body.data.id}/end`, B.token);
  check(endOther.status === 403, "12. End Now is owner-only", endOther);
  const endAgain = await req('POST', `/ads/deals/${dealFuture.id}/end`, A.token);
  check(endAgain.status === 409, '12. End Now on an expired deal → 409', endAgain);
  const editExpired = await req('PATCH', `/ads/deals/${dealFuture.id}`, A.token, { pricingValue: 5 });
  check(editExpired.status === 403, 'expired deal is read-only', editExpired);

  // ── 16–19 ADMIN MODERATION ──
  const sellerPause = await req('POST', `/ads/deals/${dealSvc.id}/pause`, A.token);
  const sellerResume = await req('POST', `/ads/deals/${dealSvc.id}/resume`, A.token);
  const sellerDisable = await req('POST', `/ads/deals/${dealSvc.id}/disable`, A.token);
  check(sellerPause.status === 403 && sellerResume.status === 403 && sellerDisable.status === 403, '19. seller cannot Pause / Resume / Disable', [sellerPause.status, sellerResume.status, sellerDisable.status]);
  const paused = await req('POST', `/ads/deals/${dealSvc.id}/pause`, admin.token);
  const pausedView = await dealView(admin.token, dealSvc.id);
  check(paused.status === 200 && paused.body.data.status === 'paused' && pausedView?.timeState === null && pausedView?.filterKey === 'paused', '16. admin can Pause (active → paused)', pausedView?.filterKey);
  const editPaused = await req('PATCH', `/ads/deals/${dealSvc.id}`, A.token, { endsAt: iso(DAY) });
  check(editPaused.status === 403, 'paused deal is read-only for the seller', editPaused);
  const resumed = await req('POST', `/ads/deals/${dealSvc.id}/resume`, admin.token);
  check(resumed.status === 200 && resumed.body.data.status === 'active' && (await dealView(admin.token, dealSvc.id))?.timeState === 'active', '17. admin can Resume (paused → active, dates decide Active)');
  const resumeActive = await req('POST', `/ads/deals/${dealSvc.id}/resume`, admin.token);
  check(resumeActive.status === 409, '17. only paused deals can be resumed', resumeActive);
  const disabled = await req('POST', `/ads/deals/${f.id}/disable`, admin.token);
  check(disabled.status === 200 && disabled.body.data.status === 'disabled', '18. admin can Disable', disabled.body);
  const resumeDisabled = await req('POST', `/ads/deals/${f.id}/resume`, admin.token);
  check(resumeDisabled.status === 409, '18. disabled deal cannot be resumed (final)', resumeDisabled);

  // ── 20–30 PROMOTION REQUESTS ──
  const promoWin = { startsAt: iso(60_000), endsAt: iso(5 * DAY) };
  const otherSellerPromo = await req('POST', `/ads/deals/${dealA.id}/promotion-requests`, B.token, { promotionType: 'featured', ...promoWin });
  check(otherSellerPromo.status === 403, "21. seller cannot request promotion for another seller's deal", otherSellerPromo);
  const adminPromo = await req('POST', `/ads/deals/${dealA.id}/promotion-requests`, admin.token, { promotionType: 'featured', ...promoWin });
  check(adminPromo.status === 403, 'admin cannot submit promotion requests', adminPromo);
  const schedDeal = await must('POST', '/ads/deals', A.token, dealBody('product', prodA3, 'percentage', 5, iso(2 * DAY), iso(6 * DAY)), [201]);
  const schedPromo = await req('POST', `/ads/deals/${schedDeal.data.id}/promotion-requests`, A.token, { promotionType: 'featured', startsAt: iso(2 * DAY), endsAt: iso(3 * DAY) });
  check(schedPromo.status === 409, '22. scheduled deal cannot request promotion', schedPromo);
  const expPromo = await req('POST', `/ads/deals/${shortDeal.data.id}/promotion-requests`, A.token, { promotionType: 'featured', ...promoWin });
  check(expPromo.status === 409, '23. expired deal cannot request promotion', expPromo);
  await must('POST', `/ads/deals/${dealSvc.id}/pause`, admin.token, {}, [200]);
  const pausedPromo = await req('POST', `/ads/deals/${dealSvc.id}/promotion-requests`, A.token, { promotionType: 'featured', startsAt: iso(60_000), endsAt: iso(2 * DAY) });
  check(pausedPromo.status === 409, '24. paused deal cannot request promotion', pausedPromo);
  await must('POST', `/ads/deals/${dealSvc.id}/resume`, admin.token, {}, [200]);
  const disabledPromo = await req('POST', `/ads/deals/${f.id}/promotion-requests`, A.token, { promotionType: 'featured', startsAt: iso(60_000), endsAt: iso(2 * DAY) });
  check(disabledPromo.status === 409, '25. disabled deal cannot request promotion', disabledPromo);
  const badType = await req('POST', `/ads/deals/${dealA.id}/promotion-requests`, A.token, { promotionType: 'homepage', ...promoWin });
  check(badType.status === 400, '28. promotion type allow-list enforced (homepage → 400)', badType);
  const dotd = await req('POST', `/ads/deals/${dealA.id}/promotion-requests`, A.token, { promotionType: 'deal_of_the_day', ...promoWin });
  check(dotd.status === 400, '28. deal_of_the_day not an allowed promotion type', dotd);
  const outside = await req('POST', `/ads/deals/${dealA.id}/promotion-requests`, A.token, { promotionType: 'featured', startsAt: iso(60_000), endsAt: iso(20 * DAY) });
  check(outside.status === 400, '29. promotion period must be inside the deal period (end beyond deal → 400)', outside);
  const badPeriod = await req('POST', `/ads/deals/${dealA.id}/promotion-requests`, A.token, { promotionType: 'featured', startsAt: iso(2 * DAY), endsAt: iso(DAY) });
  check(badPeriod.status === 400, '29. promotion start must be before end', badPeriod);
  const longNote = await req('POST', `/ads/deals/${dealA.id}/promotion-requests`, A.token, { promotionType: 'featured', ...promoWin, sellerNote: 'x'.repeat(501) });
  check(longNote.status === 400, 'seller note limited to 500 characters', longNote);

  const promo1 = await req('POST', `/ads/deals/${dealA.id}/promotion-requests`, A.token, {
    promotionType: 'featured', ...promoWin, sellerNote: 'Eid campaign <b>push</b>',
    ownerId: B.uid, ownerRole: 'admin', listingId: prodB, listingType: 'service', brandId: B.brandId, title: 'Forged', status: 'approved', dealId: 'x',
  });
  const p1 = promo1.body.data as Json;
  check(promo1.status === 201, '20. seller can request promotion for own ACTIVE deal', promo1.body);
  check(p1?.status === 'pending', '26. promotion request starts pending', p1?.status);
  check(
    p1?.ownerId === A.uid && p1?.ownerRole === 'seller' && p1?.listingId === prodA && p1?.listingType === 'product' &&
      p1?.brandId === dealA.brandId && p1?.title === dealA.title && p1?.dealId === dealA.id && p1?.kind === 'promotion' &&
      /^AD-/.test(String(p1?.advertisementReferenceId || '')),
    '27. owner/listing/brand/title/dealId server-derived; AD reference assigned',
    p1,
  );
  check(p1?.sellerNote === 'Eid campaign <b>push</b>', 'seller note stored as plain text');
  check((await dealView(A.token, dealA.id))?.status === 'active', 'promotion request does not change the deal status');
  const dupPending = await req('POST', `/ads/deals/${dealA.id}/promotion-requests`, A.token, { promotionType: 'sponsored', startsAt: iso(6 * DAY - 2 * DAY), endsAt: iso(5 * DAY) });
  check(dupPending.status === 409, '30. conflicting open request rejected (one pending request per deal)', dupPending);
  const cancelOther = await req('POST', `/ads/promotion-requests/${p1.id}/cancel`, B.token);
  check(cancelOther.status === 403, "31. another seller cannot cancel someone else's request", cancelOther);
  const cancel = await req('POST', `/ads/promotion-requests/${p1.id}/cancel`, A.token);
  check(cancel.status === 200 && cancel.body.data.status === 'cancelled' && !!cancel.body.data.review?.cancelledAt, '31. seller can cancel a pending request (kept as cancelled)', cancel.body);
  const cancelAgain = await req('POST', `/ads/promotion-requests/${p1.id}/cancel`, A.token);
  check(cancelAgain.status === 409, '31. only pending requests can be cancelled', cancelAgain);

  // Starts at the deal's own start (already past) so it runs as soon as it is approved.
  const promo2 = await must('POST', `/ads/deals/${dealA.id}/promotion-requests`, A.token, { promotionType: 'featured', startsAt: dealA.startsAt, endsAt: iso(3 * DAY) }, [201]);
  const p2 = promo2.data as Json;
  const adminList = (await must('GET', '/ads/promotion-requests', admin.token, undefined, [200])).data as Json[];
  check(adminList.some((r) => r.id === p2.id && r.status === 'pending' && r.deal?.id === dealA.id), '16(PR). admin can view pending promotion requests with the underlying deal');
  const sellerApprove = await req('POST', `/ads/promotion-requests/${p2.id}/approve`, A.token);
  check(sellerApprove.status === 403, 'seller cannot approve a promotion request', sellerApprove);
  for (const [label, method, path, body] of [
    ['generic promotion approve', 'POST', `/ads/promotions/${p2.id}/approve`, {}],
    ['generic promotion reject', 'POST', `/ads/promotions/${p2.id}/reject`, { reason: 'x' }],
    ['generic banner approve', 'POST', `/ads/banners/${p2.id}/approve`, {}],
    ['generic PATCH', 'PATCH', `/ads/${p2.id}`, { title: 'hijack', status: 'approved' }],
    ['generic pause', 'POST', `/ads/${p2.id}/pause`, {}],
    ['generic disable', 'POST', `/ads/${p2.id}/disable`, {}],
    ['generic submit', 'POST', `/ads/${p2.id}/submit`, {}],
  ] as Array<[string, string, string, unknown]>) {
    const r = await req(method, path, admin.token, body);
    check(r.status === 400, `39. ${label} cannot manipulate a deal-linked promotion`, r);
  }
  const genericDelete = await req('DELETE', `/ads/${p2.id}`, A.token);
  check(genericDelete.status === 400, '39. generic DELETE cannot remove a deal-linked promotion', genericDelete);
  check((await requestView(admin.token, p2.id))?.status === 'pending', '39. request still pending after all generic attempts');

  // Unlinked legacy promotions keep working through the generic routes.
  const legacyPromo = await must('POST', '/ads/promotions', A.token, { title: `Legacy promo ${RUN}` }, [201]);
  const legacyApprove = await req('POST', `/ads/promotions/${legacyPromo.data.id}/approve`, admin.token);
  check(legacyApprove.status === 200 && legacyApprove.body.data.status === 'active', 'unlinked legacy promotions still approvable via generic route', legacyApprove.body);

  const approved = await req('POST', `/ads/promotion-requests/${p2.id}/approve`, admin.token);
  check(approved.status === 200 && approved.body.data.status === 'approved' && !!approved.body.data.review?.decidedBy, '32. admin can approve a promotion request', approved.body);
  await sleep(1_500);
  const running = await requestView(admin.token, p2.id);
  const promotedDeal = await dealView(A.token, dealA.id);
  check(running?.runState === 'running' && promotedDeal?.promotion?.promotedNow === true && promotedDeal?.promotion?.latest?.id === p2.id, '36. approved promotion associated with the deal and running', { run: running?.runState, promo: promotedDeal?.promotion });
  check(promotedDeal?.status === 'active' && promotedDeal?.timeState === 'active', 'approval leaves the deal lifecycle unchanged');
  const reApprove = await req('POST', `/ads/promotion-requests/${p2.id}/approve`, admin.token);
  check(reApprove.status === 409, 'only pending requests can be approved', reApprove);
  const overlapApproved = await req('POST', `/ads/deals/${dealA.id}/promotion-requests`, A.token, { promotionType: 'sponsored', startsAt: iso(DAY), endsAt: iso(4 * DAY) });
  check(overlapApproved.status === 409, '30. request overlapping an approved promotion rejected', overlapApproved);

  // Sponsored: reject needs reason; rejection leaves the deal alone.
  const sp = await must('POST', `/ads/deals/${dealA.id}/promotion-requests`, A.token, { promotionType: 'sponsored', startsAt: iso(3 * DAY + 60_000), endsAt: iso(4 * DAY), sellerNote: 'Paid slot please' }, [201]);
  const noReason = await req('POST', `/ads/promotion-requests/${sp.data.id}/reject`, admin.token, {});
  const blankReason = await req('POST', `/ads/promotion-requests/${sp.data.id}/reject`, admin.token, { reason: '   ' });
  const hugeReason = await req('POST', `/ads/promotion-requests/${sp.data.id}/reject`, admin.token, { reason: 'x'.repeat(501) });
  check(noReason.status === 400 && blankReason.status === 400 && hugeReason.status === 400, '34. rejection requires a 1–500 character reason', [noReason.status, blankReason.status, hugeReason.status]);
  const REASON = `Sponsored slots are full this week (${RUN})`;
  const rejected = await req('POST', `/ads/promotion-requests/${sp.data.id}/reject`, admin.token, { reason: REASON });
  check(rejected.status === 200 && rejected.body.data.status === 'rejected', '33. admin can reject a promotion request', rejected.body);
  const afterReject = await dealView(A.token, dealA.id);
  check(afterReject?.status === 'active' && afterReject?.timeState === 'active' && afterReject?.promotion?.promotedNow === true, '35. rejected promotion does not affect the deal (still active, earlier approval still running)', afterReject);
  const sellerSees = await requestView(A.token, sp.data.id);
  check(sellerSees?.review?.rejectionReason === REASON && afterReject?.promotion?.latest?.rejectionReason === REASON, 'seller sees the promotion rejection reason');
  const sellerBList = (await must('GET', '/ads/promotion-requests', B.token, undefined, [200])).data as Json[];
  check(!sellerBList.some((r) => r.ownerId === A.uid), "sellers only see their own promotion requests");

  // Sponsored approval never pretends payment happened.
  const sp2 = await must('POST', `/ads/deals/${dealA.id}/promotion-requests`, A.token, { promotionType: 'sponsored', startsAt: iso(4 * DAY + 60_000), endsAt: iso(5 * DAY) }, [201]);
  await must('POST', `/ads/promotion-requests/${sp2.data.id}/approve`, admin.token, {}, [200]);
  const spView = await requestView(admin.token, sp2.data.id);
  check(spView?.status === 'approved' && spView?.runState === 'awaiting_fulfillment', 'sponsored approval stays "awaiting fulfillment" (no payment implied)', spView?.runState);

  // 38. promotion stops applying while the deal is paused; resumes with it.
  await must('POST', `/ads/deals/${dealA.id}/pause`, admin.token, {}, [200]);
  const whilePaused = await requestView(admin.token, p2.id);
  const pausedDealView = await dealView(admin.token, dealA.id);
  check(whilePaused?.status === 'approved' && whilePaused?.runState === 'inactive' && pausedDealView?.promotion?.promotedNow === false, '38. promotion stops applying while the deal is paused (stored approval unchanged)', whilePaused?.runState);
  await must('POST', `/ads/deals/${dealA.id}/resume`, admin.token, {}, [200]);
  check((await requestView(admin.token, p2.id))?.runState === 'running', '38. promotion runs again after the deal resumes');

  // 37. promotion stops applying once the deal expires (End Now).
  const pBefore = await must('GET', `/catalog/products/${prodA}`, admin.token, undefined, [200]);
  const priceBefore = Number((pBefore.data || pBefore).price);
  await must('POST', `/ads/deals/${dealA.id}/end`, A.token, {}, [200]);
  const afterEnd = await requestView(admin.token, p2.id);
  const endedDeal = await dealView(admin.token, dealA.id);
  check(endedDeal?.timeState === 'expired' && afterEnd?.status === 'approved' && afterEnd?.runState !== 'running' && endedDeal?.promotion?.promotedNow === false, '37. promotion stops applying when the deal expires', { deal: endedDeal?.timeState, run: afterEnd?.runState });

  // Approval re-validation: request on a deal whose base price later breaks it.
  const dealRe = await must('POST', '/ads/deals', A.token, dealBody('product', prodA5, 'special_price', 70000, iso(-60_000), iso(10 * DAY)), [201]);
  const reqRe = await must('POST', `/ads/deals/${dealRe.data.id}/promotion-requests`, A.token, { promotionType: 'featured', startsAt: iso(60_000), endsAt: iso(2 * DAY) }, [201]);
  await must('PATCH', `/catalog/products/${prodA5}`, A.token, { price: 60000 }, [200]);
  const staleApprove = await req('POST', `/ads/promotion-requests/${reqRe.data.id}/approve`, admin.token);
  check(staleApprove.status === 409, 'approval re-validates the deal price vs the current base (special ≥ base → refused)', staleApprove);
  const reView = await dealView(A.token, dealRe.data.id);
  check(!!reView?.currentPriceInvalidReason && reView?.dealTerms?.basePriceAtSubmit === 80000 && reView?.listing?.currentBasePrice === 60000, 'deal shows base at creation vs current and flags "not applied"', reView);
  await must('PATCH', `/catalog/products/${prodA5}`, A.token, { price: 80000 }, [200]);

  // ── 40 LEGACY ──
  const all = (await must('GET', '/ads/deals', admin.token, undefined, [200])).data as Json[];
  const legacyRows = all.filter((d) => d.legacy);
  check(legacyRows.length > 0 && legacyRows.every((d) => d.filterKey === 'legacy' && d.timeState === null && !d.promotion), '40. pre-canonical ad deals stay flagged legacy (no time state, no promotion)', legacyRows.length);
  const legacyOne = legacyRows.find((d) => d.status !== 'disabled');
  if (legacyOne) {
    const lp = await req('POST', `/ads/deals/${legacyOne.id}/pause`, admin.token);
    check(lp.status === 409, '40. legacy deal cannot be paused (disable only)', lp);
    const lpr = await req('POST', `/ads/deals/${legacyOne.id}/promotion-requests`, A.token, { promotionType: 'featured', ...promoWin });
    check(lpr.status === 403 || lpr.status === 409, '40. legacy deal cannot enter the promotion workflow', lpr);
  }
  const catGet = await req('GET', '/catalog/deals');
  check(catGet.status === 200 && Array.isArray(catGet.body.data), '40. GET /catalog/deals still readable', catGet.status);
  const catPost = await req('POST', '/catalog/deals', admin.token, { name: 'x', seller: 'y', discountValue: 5, validUntil: iso(DAY) });
  check(catPost.status === 410, '40. POST /catalog/deals → 410', catPost);
  const someLegacy = (catGet.body.data as Json[])[0];
  if (someLegacy) {
    const put = await req('PUT', `/catalog/deals/${someLegacy.id}`, admin.token, { name: 'changed' });
    const patch = await req('PATCH', `/catalog/deals/${someLegacy.id}`, admin.token, { status: 'live' });
    const del = await req('DELETE', `/catalog/deals/${someLegacy.id}`, admin.token);
    check(put.status === 410 && patch.status === 410 && del.status === 410, '40. PUT/PATCH/DELETE /catalog/deals → 410', [put.status, patch.status, del.status]);
  }
  const legacyButton = await req('POST', '/ads/deals/from-listing', A.token, { listingId: prodA3 });
  check(legacyButton.status === 400 && /pricing and schedule/i.test(String(legacyButton.body.error)), '40. protected legacy page listing-only request → clear 400, nothing created', legacyButton);

  // ── 41–42 NO PRICING EFFECT ──
  const pA = await must('GET', `/catalog/products/${prodA}`, admin.token, undefined, [200]);
  check(Number((pA.data || pA).price) === 100000 && priceBefore === 100000, '41. base catalog price never changes (product ৳100,000 after deal + promotion)', (pA.data || pA).price);
  const sA = await must('GET', `/catalog/services/${svcA}`, admin.token, undefined, [200]);
  check(Number((sA.data || sA).price) === 5000, '41. service base price unchanged (৳5,000)', (sA.data || sA).price);
  const consumerEmail = `probe.deals.consumer.${RUN}@example.com`;
  const reg = await must('POST', '/auth/register', undefined, { email: consumerEmail, password: PASSWORD, fullName: 'Deals Probe Consumer' }, [200, 201]);
  const consumerToken = (reg.customToken || reg.accessToken) as string;
  const cart = await req('POST', '/cart/items', consumerToken, { listingType: 'service', listingId: svcA, quantity: 1 });
  const items = (cart.body.data?.cart?.items || cart.body.data?.items || []) as Json[];
  const line = items.find((i) => i.listingId === svcA);
  check(cart.status < 300 && Number(line?.unitPrice) === 5000, '42. deal price never becomes the canonical price (cart = base ৳5,000 while deal Active)', { status: cart.status, unitPrice: line?.unitPrice });

  // picker
  const eligible = (await must('GET', '/ads/listings/eligible?purpose=deal', A.token, undefined, [200])).data as Json[];
  check(
    eligible.some((l) => l.id === prodA && l.listingType === 'product' && l.basePrice === 100000) &&
      eligible.some((l) => l.id === svcA && l.listingType === 'service') &&
      !eligible.some((l) => l.id === prodB || l.id === svcB),
    'picker: own products + services only',
  );

  console.log(`\nfixtures: sellerA=${A.uid} sellerB=${B.uid}`);
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('PROBE ERROR', err);
  process.exit(1);
});
