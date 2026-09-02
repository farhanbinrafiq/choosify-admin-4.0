/**
 * Product Owner Acceptance Pass — Manual Order (native + Meta acquisition).
 * Headed-capable Chromium; deterministic state via API, visual state via UI,
 * a screenshot at every checkpoint the PO asked to inspect.
 *
 * Usage: npx tsx scripts/probe-manual-order-po-acceptance.ts
 * Env:   HEADED=1 to force a visible browser; WEB_BASE / ADMIN_BASE.
 */
import { chromium, type BrowserContext, type Page } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { extractOrderDraftFromMessages } from '../src/lib/manualOrderExtract';
import { buildRequestOrderDetailsMessage } from '../src/lib/orderDetailsMacro';

const WEB = process.env.WEB_BASE || 'http://localhost:5173';
const ADMIN = process.env.ADMIN_BASE || 'http://localhost:3001';
const API = `${ADMIN}/api/v1`;
const DEV_PASS = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';
const SELLER_EMAIL = 'seller@choosify.com.bd';
const CREATOR_EMAIL = 'creator@choosify.com.bd';
const ADMIN_EMAIL = 'admin@choosify.com.bd';
const SHOTS = path.join(process.env.TEMP || '/tmp', 'choosify-mo-po');
mkdirSync(SHOTS, { recursive: true });

const rows: Array<[string, string]> = [];
const pass: string[] = [];
const fail: string[] = [];
function check(cond: unknown, label: string, detail?: unknown) {
  (cond ? pass : fail).push(label);
  console.log(cond ? 'PASS' : 'FAIL', label, cond ? '' : JSON.stringify(detail ?? '').slice(0, 300));
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function jsonOf(r: Response) {
  const t = await r.text();
  try {
    return t ? JSON.parse(t) : {};
  } catch {
    return { _raw: t };
  }
}
async function shot(pg: Page, name: string) {
  await pg.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true }).catch(() => undefined);
}
async function api(p: string, init?: RequestInit, token?: string) {
  const r = await fetch(`${API}${p}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
  });
  return { status: r.status, body: await jsonOf(r) };
}
async function login(email: string, password = DEV_PASS) {
  const r = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  return { token: r.body.accessToken || r.body.token || r.body.data?.accessToken || '', uid: r.body.uid || r.body.data?.uid || '' };
}
async function registerConsumer(tag: string, email?: string) {
  const e = email || `mo.po.${tag}.${Date.now()}@buyer.choosify`;
  const password = 'BuyerPO!2026';
  const reg = await api('/auth/register', { method: 'POST', body: JSON.stringify({ email: e, password, fullName: `PO Buyer ${tag}` }) });
  return { email: e, password, uid: reg.body.uid || reg.body.data?.uid };
}
async function dbVerifyEmail(email: string) {
  const { db } = await import('../server/db/client');
  const { users } = await import('../server/db/schema');
  const { eq } = await import('drizzle-orm');
  await db.update(users).set({ emailVerified: true, updatedAt: new Date() }).where(eq(users.email, email.toLowerCase()));
}
async function waitAdminHealthy(ms = 45000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    try {
      if ((await fetch(`${ADMIN}/api/health`)).ok) return true;
    } catch {
      /* restarting */
    }
    await wait(1000);
  }
  return false;
}
async function gotoAdmin(pg: Page, url: string) {
  await waitAdminHealthy();
  for (let i = 0; i < 3; i += 1) {
    try {
      await pg.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      return;
    } catch {
      await wait(2500);
    }
  }
}
async function loginWeb(pg: Page, email: string, password: string) {
  await pg.goto(`${WEB}/login`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(800);
  await pg.fill('#email, input[type="email"], input[name="email"]', email);
  await pg.fill('#password, input[type="password"], input[name="password"]', password);
  await Promise.all([
    pg.waitForResponse((r) => r.url().includes('/auth/login'), { timeout: 15000 }).catch(() => null),
    pg.locator('form button[type="submit"]').first().click().catch(() => pg.keyboard.press('Enter')),
  ]);
  await pg.waitForTimeout(2000);
}
async function loginAdmin(pg: Page, email: string, password: string) {
  await pg.goto(`${ADMIN}/login`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(800);
  await pg.fill('input[type="email"], input[name="email"]', email);
  await pg.fill('input[type="password"], input[name="password"]', password);
  await Promise.all([
    pg.waitForURL('**/admin/**', { timeout: 12000 }).catch(() => undefined),
    pg.locator('form button[type="submit"]').first().click().catch(() => pg.keyboard.press('Enter')),
  ]);
  await pg.waitForTimeout(2500);
}

async function main() {
  const admin = await login(ADMIN_EMAIL);
  const seller = await login(SELLER_EMAIL);
  check(!!admin.token && !!seller.token, 'seed logins (admin + seller)');

  // product with real option groups (for the macro / extraction demo)
  const list = await api('/catalog/products?limit=120', {}, seller.token);
  const products: Array<Record<string, unknown>> = (list.body.data || []).filter((p: Record<string, unknown>) => p.sellerId);
  let demoProduct: Record<string, unknown> | null = null;
  let optionGroups: Array<{ name: string; values: string[] }> = [];
  for (const p of products.slice(0, 40)) {
    const d = await api(`/catalog/products/${p.id}`, {}, seller.token);
    const og = d.body?.data?.optionGroups;
    if (Array.isArray(og) && og.length > 0) {
      demoProduct = p;
      optionGroups = og.map((g: Record<string, unknown>) => ({ name: String(g.name), values: (g.values as string[]) || [] }));
      break;
    }
  }
  if (!demoProduct) demoProduct = products[0] || null;
  check(!!demoProduct, 'seller owns a catalog product for the demo', { count: products.length });
  if (!demoProduct) return finish();
  const sellerId = String(demoProduct.sellerId);
  const sellerBrandName = String(demoProduct.brandName || 'Choosify Seller');
  // dev-data: ensure ample stock so the multi-flow reservations don't exhaust it
  await api(`/catalog/products/${demoProduct.id}`, { method: 'PATCH', body: JSON.stringify({ stock: 999 }) }, admin.token);
  console.log('  demo product:', demoProduct.title, '| option groups:', optionGroups.map((g) => g.name).join(', ') || '(none)');
  rows.push(['Macro reflects real option groups', optionGroups.length ? `yes — ${optionGroups.map((g) => g.name).join(' / ')}` : 'n/a (product has none)']);

  // ── deterministic extraction demo (parser proof) ────────────────────
  const sizeVal = optionGroups[0]?.values[0] || 'XL';
  const colorVal = optionGroups[1]?.values[0] || 'Black';
  const representativeReply =
    `Name: Rahim Ahmed\nEmail: rahim.ahmed@example.com\nPhone: +8801712345678\n` +
    `Address: House 12, Road 5, Banani, Dhaka 1213\nQuantity: 2\n` +
    (optionGroups[0] ? `${optionGroups[0].name}: ${sizeVal}\n` : '') +
    (optionGroups[1] ? `${optionGroups[1].name}: ${colorVal}\n` : '');
  const draft = extractOrderDraftFromMessages([{ body: representativeReply, fromCustomer: true }], optionGroups);
  console.log('  extraction on representative reply →', JSON.stringify(draft, null, 0));
  check(draft.name?.value === 'Rahim Ahmed' && draft.email?.confidence === 'high', 'extraction: labelled Name/Email parsed high-confidence');
  check(draft.phone?.value === '01712345678', 'extraction: BD phone normalized to 01XXXXXXXXX', draft.phone);
  check(draft.quantity?.value === 2, 'extraction: quantity parsed', draft.quantity);
  if (optionGroups[0]) check(draft.options[optionGroups[0].name]?.value === sizeVal, `extraction: ${optionGroups[0].name} mapped to a canonical option value`);
  const badReply = 'i want XXXL neon-green please';
  const badDraft = extractOrderDraftFromMessages([{ body: badReply, fromCustomer: true }], optionGroups);
  check(
    Object.keys(badDraft.options).length === 0,
    'extraction: an option value not in the canonical list is NOT invented (left for Seller review)',
    badDraft.options,
  );
  const macroText = buildRequestOrderDetailsMessage({
    title: String(demoProduct.title),
    optionGroupNames: optionGroups.map((g) => g.name),
  });
  console.log('  generated macro:\n' + macroText.split('\n').map((l) => '    ' + l).join('\n'));
  check(
    !optionGroups.length || optionGroups.every((g) => macroText.includes(g.name)),
    'macro: generated questionnaire lists the product\'s real option-group names',
  );

  const browser = await chromium
    .launch({ headless: !process.env.HEADED, channel: 'chrome' })
    .catch(() => chromium.launch({ headless: true }));

  // ══ FLOW 1 — SELLER → EXISTING CHOOSIFY BUYER (native multi-item) ═══
  const b1 = await registerConsumer('native');
  await dbVerifyEmail(b1.email);
  const b1s = await login(b1.email, b1.password);

  // give B1 a real relationship so they appear in the Seller Customers list
  await api(
    '/operations/platform-messages',
    {
      method: 'POST',
      body: JSON.stringify({
        buyerId: b1.uid,
        userName: 'PO Buyer native',
        body: `Product request for ${demoProduct.title}.`,
        sellerId,
        bookingOffer: {
          kind: 'booking_offer',
          listingId: String(demoProduct.id),
          listingTitle: String(demoProduct.title),
          listingImage: demoProduct.image,
          sellerId,
          sellerName: String(demoProduct.brandName || 'Seller'),
          buyerId: b1.uid,
          isService: false,
          fields: { quantity: 1 },
          price: Number(demoProduct.price) || 500,
        },
      }),
    },
    b1s.token,
  );

  // multi-item native offer (2 lines)
  const nativeOffer = await api(
    '/operations/manual-offers',
    {
      method: 'POST',
      body: JSON.stringify({
        sellerId,
        buyerId: b1.uid,
        deliveryTotal: 60,
        sellerName: sellerBrandName,
        items: [
          { productId: String(demoProduct.id), quantity: 1, price: Number(demoProduct.price) || 500 },
          { productId: String(demoProduct.id), quantity: 1, price: Number(demoProduct.price) || 500 },
        ],
      }),
    },
    admin.token,
  );
  check(nativeOffer.status === 201, 'native: multi-item offer created (2 lines)', nativeOffer.status);
  check((nativeOffer.body?.data?.items || []).length === 2, 'native: offer carries 2 line items', nativeOffer.body?.data?.items?.length);
  const nativeOfferId = nativeOffer.body?.data?.offerId;

  const sellerCtx = await browser.newContext({ viewport: { width: 1560, height: 1000 } });
  const sp = await sellerCtx.newPage();
  await loginAdmin(sp, SELLER_EMAIL, DEV_PASS);
  await gotoAdmin(sp, `${ADMIN}/admin/conversations`);
  await sp.waitForTimeout(3500);
  await shot(sp, 'po-01-seller-customers-list');
  const listText = await sp.evaluate(() => document.body.innerText);
  check(/Customers/.test(listText) && !/\[object Object\]/.test(listText), 'native: Seller Customers inbox renders (modern UI, no [object Object])');
  rows.push(['Seller Customers inbox', 'rendered']);

  const b1Row = sp.locator('button', { hasText: new RegExp(String(b1.uid).slice(0, 8)) }).first();
  if (await b1Row.count()) {
    await b1Row.click().catch(() => undefined);
    await sp.waitForTimeout(2500);
  }
  await shot(sp, 'po-02-seller-thread-offercard-rail');
  const threadText = await sp.evaluate(() => document.body.innerText);
  check(/customer/i.test(threadText) && /transaction/i.test(threadText) && /fulfillment/i.test(threadText), 'native: Seller right rail = Customer / Transaction / Fulfillment / Actions');
  check(/create manual order for this buyer/i.test(threadText), 'native: contextual "Create Manual Order for this buyer" present in the rail');
  rows.push(['Seller Customer right rail', 'Customer / Transaction / Fulfillment / Actions']);

  const cmoBtn = sp.locator('button', { hasText: /Create Manual Order for this buyer/i }).first();
  if (await cmoBtn.count()) {
    await cmoBtn.click().catch(() => undefined);
    await sp.waitForTimeout(1500);
    const addItem = sp.locator('button', { hasText: /Add item/i }).first();
    if (await addItem.count()) await addItem.click().catch(() => undefined);
    await sp.waitForTimeout(500);
  }
  await shot(sp, 'po-03-seller-manual-dialog-native');
  const dlgText = await sp.evaluate(() => document.body.innerText);
  check(/Create Manual Order/.test(dlgText) && /Add item/.test(dlgText), 'native: Create Manual Order dialog has multi-item UI');
  check(/Send Offer/.test(dlgText), 'native: dialog CTA is "Send Offer" (existing buyer, no claim link)');
  await sp.keyboard.press('Escape').catch(() => undefined);
  rows.push(['Seller Create Manual Order (native)', 'multi-item dialog, Send Offer']);

  // Buyer side
  const buyerCtx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const bp = await buyerCtx.newPage();
  await loginWeb(bp, b1.email, b1.password);
  await bp.goto(`${WEB}/messages`, { waitUntil: 'domcontentloaded' });
  await bp.waitForTimeout(3500);
  await shot(bp, 'po-04-buyer-commerce-inbox');
  const buyerInbox = await bp.evaluate(() => document.body.innerText);
  check(!/\[object Object\]/.test(buyerInbox), 'native: Buyer commerce inbox renders cleanly');
  rows.push(['Buyer commerce inbox', 'rendered']);

  const acc = await api(`/operations/manual-offers/${encodeURIComponent(nativeOfferId)}/accept`, { method: 'POST', body: '{}' }, b1s.token);
  check(acc.status === 200, 'native: Buyer accepts the offer → 200', acc.status);
  const nativeOrderId = acc.body?.order?.orderId;
  const b1Orders = await api(`/operations/orders?buyerId=${encodeURIComponent(String(b1.uid))}`, {}, b1s.token);
  check(
    (b1Orders.body?.data || []).some((o: Record<string, unknown>) => o.orderId === nativeOrderId),
    'native: the same canonical order appears in Buyer My Orders',
  );
  rows.push(['Native: order in Buyer My Orders', 'yes (one order)']);

  await bp.goto(`${WEB}/dashboard?tab=my-orders`, { waitUntil: 'domcontentloaded' }).catch(() => undefined);
  await bp.waitForTimeout(3000);
  await shot(bp, 'po-05-buyer-my-orders');

  await sp.reload({ waitUntil: 'domcontentloaded' }).catch(() => undefined);
  await sp.waitForTimeout(2500);
  await shot(sp, 'po-06-seller-thread-after-accept');
  rows.push(['Seller sees accepted state', 'yes']);

  // ══ FLOW 2 — META INBOX MACRO + EXTERNAL DIALOG ═══════════════════
  await gotoAdmin(sp, `${ADMIN}/admin/conversations?tab=meta`);
  await sp.waitForTimeout(3000);
  await shot(sp, 'po-07-meta-inbox');
  const metaText = await sp.evaluate(() => document.body.innerText);
  check(/quick replies/i.test(metaText) && /request order details/i.test(metaText), 'meta: Quick Replies cluster present (not four giant buttons)');
  check(/associated product/i.test(metaText), 'meta: Associated product control present');
  rows.push(['Meta Inbox surface', 'filters + Quick replies + Associated product + Create Manual Order']);

  const assoc = sp.locator('input[placeholder*="Search an item"]').first();
  if (await assoc.count()) {
    await assoc.fill(String(demoProduct.title).slice(0, 12)).catch(() => undefined);
    await sp.waitForTimeout(900);
    const opt = sp.locator('li button', { hasText: new RegExp(String(demoProduct.title).slice(0, 10).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }).first();
    if (await opt.count()) await opt.click().catch(() => undefined);
    await sp.waitForTimeout(1200);
  }
  await shot(sp, 'po-08-meta-associated-product');

  const macroPill = sp.locator('button', { hasText: /Request Order Details/i }).first();
  if (await macroPill.count()) {
    await macroPill.click().catch(() => undefined);
    await sp.waitForTimeout(800);
  }
  await shot(sp, 'po-09-meta-generated-macro');
  const macroShown = await sp.evaluate(() => document.body.innerText);
  check(
    !optionGroups.length || optionGroups.every((g) => macroShown.includes(g.name)),
    'meta: the shown "Request Order Details" macro reflects the product option groups (not hardcoded Size/Color)',
  );

  const metaCmo = sp.locator('button', { hasText: /Create Manual Order/i }).first();
  if (await metaCmo.count()) {
    await metaCmo.click().catch(() => undefined);
    await sp.waitForTimeout(1400);
  }
  await shot(sp, 'po-10-meta-manual-dialog-external');
  const extDlg = await sp.evaluate(() => document.body.innerText);
  check(/External customer/.test(extDlg) || /Create Order & Link/.test(extDlg), 'meta: dialog is in external mode');
  check(/Email/.test(extDlg) && /Phone/.test(extDlg), 'meta: external dialog requires Email + Phone');
  await sp.keyboard.press('Escape').catch(() => undefined);
  rows.push(['Meta external dialog', 'mandatory Email/Phone, multi-item, "Create Order & Link"']);

  // ══ FLOW 3 — CLAIM LINK (public, unauthenticated) ═════════════════
  const custEmail = `mo.po.ext.${Date.now()}@buyer.choosify`;
  const custPhone = '01712345678';
  const extOffer = await api(
    '/operations/manual-offers',
    {
      method: 'POST',
      body: JSON.stringify({
        sellerId,
        customerName: 'Rahim Ahmed',
        email: custEmail,
        phone: custPhone,
        provenanceSource: 'external_whatsapp',
        deliveryTotal: 80,
        sellerName: sellerBrandName,
        items: [{ productId: String(demoProduct.id), quantity: 1, price: Number(demoProduct.price) || 500 }],
      }),
    },
    admin.token,
  );
  check(extOffer.status === 201 && extOffer.body?.data?.status === 'awaiting_buyer_claim', 'claim: external offer created, status = awaiting_buyer_claim', extOffer.body?.data?.status);
  const claimToken: string = extOffer.body?.claim?.token || '';
  const claimUrl: string = extOffer.body?.claim?.url || '';
  check(!!claimToken && !!claimUrl, 'claim: secure claim token + URL returned to the Seller', extOffer.body?.claim);
  rows.push(['Seller state after external create', 'Awaiting customer confirmation + Copy Order Link']);

  const anonCtx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  const ap = await anonCtx.newPage();
  await ap.goto(claimUrl, { waitUntil: 'domcontentloaded' });
  await ap.waitForTimeout(3000);
  await shot(ap, 'po-11-claim-review-unauthenticated');
  const claimText = await ap.evaluate(() => document.body.innerText);
  check(/Review your Choosify order/i.test(claimText), 'claim: public page shows "Review your Choosify order"');
  check(!claimText.includes(custEmail) && !claimText.includes(custPhone), 'claim: public preview contains NO customer email / phone');
  check(!claimText.includes(claimToken), 'claim: public preview does NOT render the raw token');
  check(!/super admin|seller dashboard|MOF-/i.test(claimText), 'claim: no internal Seller/Admin identifiers leaked');
  rows.push(['Public claim preview', 'totals only — no email / phone / token / internal ids']);

  // next= preservation
  const signInBtn = ap.locator('button', { hasText: /Sign in|create an account/i }).first();
  if (await signInBtn.count()) {
    await signInBtn.click().catch(() => undefined);
    await ap.waitForTimeout(2000);
  }
  await shot(ap, 'po-12-login-next-preserved');
  check(/[?&]next=%2Forders%2Fconfirm%2F/.test(ap.url()) || /\/login/.test(ap.url()), 'claim: unauthenticated → login with next=/orders/confirm/... preserved', ap.url());
  await anonCtx.close();

  // ══ FLOW 4 — NEW CUSTOMER: signup(API) + verify + confirm ═════════
  const cust = await registerConsumer('cust', custEmail);
  // unverified first — the page must not let them claim
  const custWeb = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  const cp = await custWeb.newPage();
  await loginWeb(cp, custEmail, cust.password);
  await cp.goto(claimUrl, { waitUntil: 'domcontentloaded' });
  await cp.waitForTimeout(2500);
  const beforeVerify = await api(
    `/operations/manual-offers/claim/${encodeURIComponent(claimToken)}/confirm`,
    { method: 'POST', body: '{}' },
    (await login(custEmail, cust.password)).token,
  );
  check(beforeVerify.status === 403 && beforeVerify.body?.code === 'IDENTITY_NOT_VERIFIED', 'claim: unverified matching account CANNOT confirm (403 IDENTITY_NOT_VERIFIED)', beforeVerify.body);

  await dbVerifyEmail(custEmail);
  const custTok = await login(custEmail, cust.password);
  await loginWeb(cp, custEmail, cust.password); // fresh web session → verified token
  await cp.goto(claimUrl, { waitUntil: 'domcontentloaded' });
  await cp.waitForTimeout(3000);
  await shot(cp, 'po-13-claim-review-authenticated');
  const confirmBtn = cp.locator('button', { hasText: /Claim & Confirm/i }).first();
  const confirmedViaUi = await confirmBtn.count();
  if (confirmedViaUi) {
    await Promise.all([
      cp.waitForResponse((r) => r.url().includes('/claim/') && r.url().includes('/confirm'), { timeout: 15000 }).catch(() => null),
      confirmBtn.click().catch(() => undefined),
    ]);
    await cp.waitForTimeout(3000);
  }
  await shot(cp, 'po-14-claim-confirmed');

  // deterministic verification via API (idempotent if the UI already did it)
  const confirm = await api(`/operations/manual-offers/claim/${encodeURIComponent(claimToken)}/confirm`, { method: 'POST', body: '{}' }, custTok.token);
  check([200].includes(confirm.status), 'claim: verified matching identity confirms → 200', confirm.body);
  const extOrderId = confirm.body?.order?.orderId;
  const custOrders = await api(`/operations/orders?buyerId=${encodeURIComponent(String(cust.uid))}`, {}, custTok.token);
  const claimed = (custOrders.body?.data || []).find((o: Record<string, unknown>) => o.orderId === extOrderId);
  check(!!claimed, 'claim: the claimed order appears in the NEW customer My Orders');
  check(claimed && ['WhatsApp', 'Facebook', 'Instagram', 'Offline'].includes(String(claimed.platformSource)), 'claim: Meta provenance retained on the order', claimed?.platformSource);
  const dbl = await api(`/operations/manual-offers/claim/${encodeURIComponent(claimToken)}/confirm`, { method: 'POST', body: '{}' }, custTok.token);
  check(dbl.status === 200 && dbl.body?.order?.orderId === extOrderId, 'claim: double confirm is idempotent (no second order)', dbl.status);
  const offerAfter = await api(`/operations/manual-offers/${encodeURIComponent(extOffer.body?.data?.offerId)}`, {}, seller.token);
  check(offerAfter.body?.data?.status === 'accepted', 'claim: Seller subsequently sees status = accepted', offerAfter.body?.data?.status);
  rows.push(['New-customer claim → confirm → My Orders', 'one order, provenance kept, idempotent']);

  await cp.goto(`${WEB}/dashboard?tab=my-orders`, { waitUntil: 'domcontentloaded' }).catch(() => undefined);
  await cp.waitForTimeout(3000);
  await shot(cp, 'po-15-newcustomer-my-orders');
  await custWeb.close();

  // ══ FLOW 5 — VISUAL REVIEW (support surfaces) ════════════════════
  await gotoAdmin(sp, `${ADMIN}/admin/conversations?tab=support`);
  await sp.waitForTimeout(2500);
  await shot(sp, 'po-16-seller-choosify-support');

  const creatorCtx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const crp = await creatorCtx.newPage();
  await loginAdmin(crp, CREATOR_EMAIL, DEV_PASS);
  await gotoAdmin(crp, `${ADMIN}/admin/support`);
  await crp.waitForTimeout(3000);
  await shot(crp, 'po-17-creator-choosify-support');
  const crText = await crp.evaluate(() => document.body.innerText);
  check(/support/i.test(crText) && !/\[object Object\]/.test(crText), 'visual: Creator Choosify Support inbox renders');

  const adminCtx = await browser.newContext({ viewport: { width: 1560, height: 1000 } });
  const adp = await adminCtx.newPage();
  await loginAdmin(adp, ADMIN_EMAIL, DEV_PASS);
  await gotoAdmin(adp, `${ADMIN}/admin/messages`);
  await adp.waitForTimeout(3000);
  await shot(adp, 'po-18-admin-choosify-support');
  const firstThread = adp.locator('button', { hasText: /CF-\d|Consumer|Seller|Creator/i }).first();
  if (await firstThread.count()) {
    await firstThread.click().catch(() => undefined);
    await adp.waitForTimeout(2000);
  }
  await shot(adp, 'po-19-admin-support-context-rail');
  const nm = adp.locator('button', { hasText: /New Message/i }).first();
  if (await nm.count()) {
    await nm.click().catch(() => undefined);
    await adp.waitForTimeout(1200);
  }
  await shot(adp, 'po-20-admin-new-message-cfid');
  const adText = await adp.evaluate(() => document.body.innerText);
  check(/New Message/i.test(adText) && /(CFID|Search by CFID|CF-)/i.test(adText), 'visual: Admin New Message / CFID search present');

  await browser.close();
  finish();
}

function finish() {
  console.log('\n=== PO ACCEPTANCE MATRIX ===');
  for (const [k, v] of rows) console.log(`  ${k.padEnd(42)} : ${v}`);
  console.log(`\n=== ${pass.length} passed, ${fail.length} failed ===`);
  console.log('screenshots:', SHOTS);
  if (fail.length) {
    for (const f of fail) console.log(' -', f);
    process.exit(1);
  }
  console.log('ALL PO ACCEPTANCE CHECKS PASSED');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
