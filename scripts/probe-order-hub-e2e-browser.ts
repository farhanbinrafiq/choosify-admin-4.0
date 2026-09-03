/**
 * Order Hub hybrid Quick View / Full Details — browser E2E + screenshots.
 *
 *   Admin  : Hub loads · no CmsMirror iframe · card → Quick View modal ·
 *            "Open Full Details" → /admin/orders/:id · full page renders ·
 *            Back → Order Hub.
 *   Seller : same flow on /admin/platform-orders · a forged other-seller
 *            order route shows the "not available" state (no order content) ·
 *            the full page shows the seller-scoped value ("Your items value")
 *            and NOT the whole-order total · shipment tracking editor present.
 *
 * Screens written to scripts/_tmp_order-hub-artifacts/ : order-hub-{admin,seller}-{hub,quick,full}.png
 *
 * Usage: npx tsx scripts/probe-order-hub-e2e-browser.ts   (needs dev server :3001)
 */
import { chromium, type Browser, type Page } from 'playwright-core';
import { mkdirSync } from 'fs';
import { join } from 'path';

const BASE = process.env.PROBE_BASE_URL_ROOT || 'http://localhost:3001';
const API = `${BASE}/api/v1`;
const PASS_ = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';
const OUT = join(process.cwd(), 'scripts', '_tmp_order-hub-artifacts');
mkdirSync(OUT, { recursive: true });

const PASS: string[] = [];
const FAIL: string[] = [];
function check(c: unknown, label: string, detail?: unknown) {
  (c ? PASS : FAIL).push(label);
  console.log(c ? 'PASS' : 'FAIL', label, c ? '' : JSON.stringify(detail ?? '').slice(0, 300));
}

async function login(email: string) {
  const r = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASS_ }),
  });
  const b = await r.json();
  return { token: b.accessToken || b.token || b.data?.accessToken || '', uid: b.uid || b.data?.uid || '' };
}
async function listOrders(token: string, qs = '') {
  const r = await fetch(`${API}/operations/orders${qs}`, { headers: { Authorization: `Bearer ${token}` } });
  const b = await r.json().catch(() => ({}));
  return { status: r.status, rows: (b.data || []) as Array<Record<string, any>> };
}

async function apic(path: string, init: RequestInit, token?: string) {
  const r = await fetch(`${API}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers || {}) },
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
async function registerVerifiedBuyer() {
  const email = `ohube2e.${Date.now()}.${Math.random().toString(36).slice(2, 6)}@buyer.choosify`;
  const password = 'OhubE2e!2026';
  const reg = await apic('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, fullName: 'OHub E2E Buyer' }) });
  const { db } = await import('../server/db/client');
  const { users } = await import('../server/db/schema');
  const { eq } = await import('drizzle-orm');
  await db.update(users).set({ emailVerified: true, updatedAt: new Date() }).where(eq(users.email, email.toLowerCase()));
  const login = await apic('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  return { token: login.body.accessToken || login.body.token || login.body.data?.accessToken, uid: reg.body.uid || reg.body.data?.uid };
}
/** Create a real order and drive it to Packed. Returns { opsId }. */
async function makePackedOrder(sellerTok: string, sellerUid: string, adminTok: string) {
  const prods = await apic('/catalog/products?limit=150', { method: 'GET' }, sellerTok);
  const p = (prods.body.data || []).find(
    (x: any) => x.sellerId === sellerUid && x.productType !== 'service' && (x.status === 'live' || x.status === 'active'),
  );
  if (!p) return null;
  await apic(`/catalog/products/${p.id}/inventory`, { method: 'PATCH', body: JSON.stringify({ quantity: 999, reservedQuantity: 0 }) }, adminTok);
  const buyer = await registerVerifiedBuyer();
  await apic('/cart/clear', { method: 'POST', body: '{}' }, buyer.token);
  await apic('/cart/items', { method: 'POST', body: JSON.stringify({ listingType: 'product', listingId: p.id, quantity: 1 }) }, buyer.token);
  const idem = `ohube2e-${Date.now()}`;
  const co = await apic('/checkout', { method: 'POST', headers: { 'Idempotency-Key': idem }, body: JSON.stringify({ shipping: { fullName: 'OHub E2E', phone: '+8801711220099', address: 'Dhaka Rd', region: 'Dhaka' } }) }, buyer.token);
  const order = co.body?.data?.orders?.[0];
  const checkoutId = co.body?.data?.checkout?.id;
  await apic('/commerce/payments/initiate', { method: 'POST', body: JSON.stringify({ checkoutId, paymentMethod: 'cod', idempotencyKey: `${idem}-cod` }) }, buyer.token);
  await apic(`/orders/${encodeURIComponent(order.id)}/transition`, { method: 'POST', body: JSON.stringify({ status: 'confirmed' }) }, sellerTok);
  await apic(`/orders/${encodeURIComponent(order.id)}/transition`, { method: 'POST', body: JSON.stringify({ status: 'packed' }) }, sellerTok);
  return { opsId: order.orderNumber as string, buyerUid: String(buyer.uid) };
}

async function dispatchFlow(browser: Browser, sellerTok: string, sellerUid: string, adminTok: string) {
  const made = await makePackedOrder(sellerTok, sellerUid, adminTok);
  if (!made) {
    check(false, 'dispatch E2E: could not build a packed order (skipped)');
    return;
  }
  const ctx = await ctxFor(browser, sellerTok);
  const page = await ctx.newPage();
  const errs: string[] = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`${BASE}/admin/platform-orders/${encodeURIComponent(made.opsId)}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => document.body.innerText.includes('Order Details:'), { timeout: 25000 }).catch(() => {});
  await settle(page);

  // primary CTA is "Mark dispatched" for a packed order
  const primary = page.locator('button:has-text("Mark dispatched")').first();
  check((await primary.count()) > 0, 'dispatch E2E: Processing order shows "Mark dispatched" primary');
  await primary.click({ timeout: 10000 }).catch(() => {});
  await page.waitForFunction(() => document.body.innerText.includes('Dispatch details'), { timeout: 10000 }).catch(() => {});
  await settle(page);
  check((await page.locator('text=Dispatch details').count()) > 0, 'dispatch E2E: clicking "Mark dispatched" opens the Dispatch Details sheet (no blind advance)');
  check(
    (await page.locator('text=Courier / logistics provider').count()) > 0 &&
      (await page.locator('text=Tracking / consignment number').count()) > 0,
    'dispatch E2E: sheet requires courier + tracking for courier fulfillment',
  );

  // try to confirm with nothing filled → inline errors, order not advanced
  await page.locator('button:has-text("Confirm dispatch")').first().click({ timeout: 8000 }).catch(() => {});
  await settle(page);
  check((await page.locator('text=Courier / logistics provider is required').count()) > 0, 'dispatch E2E: empty submit shows inline validation, no advance');

  const trk = `TRK-E2E-${Date.now()}`;
  await page.locator('input[placeholder*="Pathao, RedX"]').first().fill('Pathao').catch(() => {});
  await page.locator('input[placeholder*="consignment"]').first().fill(trk).catch(() => {});
  await page.screenshot({ path: join(OUT, 'order-hub-dispatch-sheet.png') });
  await page.locator('button:has-text("Confirm dispatch")').first().click({ timeout: 10000 }).catch(() => {});
  await page.waitForFunction(() => document.body.innerText.includes('Mark delivered'), { timeout: 15000 }).catch(() => {});
  await settle(page);
  const bodyText = await page.evaluate(() => document.body.innerText);
  check(/Mark delivered/i.test(bodyText), 'dispatch E2E: after Confirm dispatch the primary CTA becomes the next step ("Mark delivered")');
  check(/Dispatched/i.test(bodyText) && bodyText.includes(trk), 'dispatch E2E: Full Details now shows the dispatched shipment + tracking number');
  check(new URL(page.url()).pathname.startsWith('/admin/platform-orders/'), 'dispatch E2E: stayed on the same Order Details page');
  await page.screenshot({ path: join(OUT, 'order-hub-dispatch-after.png') });

  // the buyer's System-B thread got the dispatch card
  const sb = await apic(`/operations/platform-messages?userId=${encodeURIComponent(made.buyerUid)}`, { method: 'GET' }, sellerTok);
  const cards = (sb.body?.data || []).filter((m: any) => m.dispatchEvent);
  check(cards.length === 1 && cards[0].dispatchEvent.trackingNumber === trk, 'dispatch E2E: exactly one structured dispatch card in the correct buyer conversation');

  check(errs.length === 0, 'dispatch E2E: no page errors', errs.slice(0, 3));
  await ctx.close();
}

/**
 * Fulfillment-aware delivery — drive one order per method to Delivered / Collected
 * and screenshot the Full Details lifecycle panel for each.
 *   • courier        → courier webhook "delivered" (canonical settlement)
 *   • seller_delivery → manual "Mark delivered" CTA (no webhook)
 *   • pickup         → "Mark collected" CTA; badge reads Ready for pickup / Collected
 */
async function deliveryFlow(browser: Browser, sellerTok: string, sellerUid: string, adminTok: string) {
  const ctx = await ctxFor(browser, sellerTok);
  const page = await ctx.newPage();
  const errs: string[] = [];
  page.on('pageerror', (e) => errs.push(String(e)));

  const shot = async (opsId: string, name: string) => {
    await page.goto(`${BASE}/admin/platform-orders/${encodeURIComponent(opsId)}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => document.body.innerText.includes('Order status'), { timeout: 25000 }).catch(() => {});
    await settle(page);
    await page.screenshot({ path: join(OUT, name), fullPage: true });
    return page.evaluate(() => document.body.innerText);
  };
  const cId = async (opsId: string) =>
    (await apic(`/orders/by-number/${encodeURIComponent(opsId)}`, { method: 'GET' }, sellerTok)).body?.data?.id as string;

  // ── courier: webhook-driven delivery ────────────────────────────────
  const c = await makePackedOrder(sellerTok, sellerUid, adminTok);
  if (c) {
    const commerceId = await cId(c.opsId);
    const trk = `TRK-DELV-${Date.now()}`;
    await apic(`/orders/${encodeURIComponent(commerceId)}/dispatch`, { method: 'POST', body: JSON.stringify({ fulfillmentMethod: 'courier', courier: 'Pathao', trackingNumber: trk }) }, sellerTok);
    await fetch(`${BASE}/api/logistics/simulate-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminTok}` },
      body: JSON.stringify({ courier: 'generic', payload: { trackingNumber: trk, status: 'delivered', location: 'Dhaka', description: 'Delivered to recipient' } }),
    });
    const text = await shot(c.opsId, 'order-hub-delivery-courier.png');
    check(/Delivered/i.test(text) && /Complete order/i.test(text), 'delivery E2E (courier): webhook "delivered" → Full Details shows Delivered + "Complete order" next');
    check(!/Mark delivered/i.test(text), 'delivery E2E (courier): no stale "Mark delivered" CTA after canonical delivery');
  }

  // ── seller delivery: manual CTA ────────────────────────────────────
  const s = await makePackedOrder(sellerTok, sellerUid, adminTok);
  if (s) {
    const commerceId = await cId(s.opsId);
    await apic(`/orders/${encodeURIComponent(commerceId)}/dispatch`, { method: 'POST', body: JSON.stringify({ fulfillmentMethod: 'seller_delivery', courier: 'Own rider — Karim' }) }, sellerTok);
    const pre = await shot(s.opsId, 'order-hub-delivery-seller-predeliver.png');
    check(/Mark delivered/i.test(pre), 'delivery E2E (seller delivery): manual "Mark delivered" CTA available (no webhook)');
    await apic(`/orders/${encodeURIComponent(commerceId)}/transition`, { method: 'POST', body: JSON.stringify({ status: 'delivered' }) }, sellerTok);
    const text = await shot(s.opsId, 'order-hub-delivery-seller.png');
    check(/Delivered/i.test(text) && /Complete order/i.test(text), 'delivery E2E (seller delivery): manual delivery settles → Delivered + "Complete order"');
  }

  // ── pickup: "Mark collected" / "Ready for pickup" / "Collected" ─────
  const p = await makePackedOrder(sellerTok, sellerUid, adminTok);
  if (p) {
    const commerceId = await cId(p.opsId);
    await apic(`/orders/${encodeURIComponent(commerceId)}/dispatch`, { method: 'POST', body: JSON.stringify({ fulfillmentMethod: 'pickup' }) }, sellerTok);
    const pre = await shot(p.opsId, 'order-hub-delivery-pickup-ready.png');
    check(/Ready for pickup/i.test(pre) && /Mark collected/i.test(pre), 'delivery E2E (pickup): reads "Ready for pickup" + "Mark collected"');
    check(!/In transit/i.test(pre) && !/\bDispatched\b/.test(pre.replace(/dispatch details/i, '')), 'delivery E2E (pickup): never shows "Dispatched" / "In transit" to the user');
    await apic(`/orders/${encodeURIComponent(commerceId)}/transition`, { method: 'POST', body: JSON.stringify({ status: 'delivered' }) }, sellerTok);
    const text = await shot(p.opsId, 'order-hub-delivery-pickup.png');
    check(/Collected/i.test(text), 'delivery E2E (pickup): after collection reads "Collected"');
  }

  check(errs.length === 0, 'delivery E2E: no page errors', errs.slice(0, 3));
  await ctx.close();
}

async function ctxFor(browser: Browser, token: string) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 }, deviceScaleFactor: 1 });
  await ctx.addInitScript((t) => {
    try {
      localStorage.setItem('choosify_auth_token', t as string);
    } catch {}
  }, token);
  return ctx;
}
const settle = (p: Page) => p.waitForTimeout(2800);

async function run(
  browser: Browser,
  role: 'admin' | 'seller',
  token: string,
  hubPath: string,
  ownOrderId: string,
  foreignOrderId: string | null,
) {
  const ctx = await ctxFor(browser, token);
  const page = await ctx.newPage();
  const errs: string[] = [];
  page.on('pageerror', (e) => errs.push(String(e)));

  // ── Hub ──────────────────────────────────────────────────────────────
  await page.goto(`${BASE}${hubPath}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => document.body.innerText.includes('Order Hub'), { timeout: 30000 }).catch(() => {});
  await settle(page);
  await page.screenshot({ path: join(OUT, `order-hub-${role}-hub.png`) });
  check(
    (await page.locator('text=Order Hub').count()) > 0,
    `${role}: Order Hub list renders`,
  );
  check((await page.locator('iframe').count()) === 0, `${role}: no CmsMirror iframe on the Hub`);

  // ── workflow tabs = real lifecycle ──────────────────────────────────
  const stripText = await page.evaluate(() => document.body.innerText);
  check(
    /ACTIVE ORDERS/i.test(stripText) && /\bPENDING\b/i.test(stripText),
    `${role}: workflow strip has distinct "Active Orders" and "Pending" tabs`,
  );

  // ── advanced filters (role-aware) ──────────────────────────────────
  await page.locator('button:has-text("Advanced Filters")').first().click({ timeout: 10000 }).catch(() => {});
  await page.waitForFunction(() => document.body.innerText.includes('ADVANCED ORDER FILTERS'), { timeout: 8000 }).catch(() => {});
  await settle(page);
  check(
    (await page.locator('text=APPLY FILTERS').count()) > 0 && (await page.locator('text=RESET FILTERS').count()) > 0,
    `${role}: advanced filter panel opens with Apply + Reset`,
  );
  const hasSellerSelector = (await page.locator('text=Seller / merchant').count()) > 0;
  if (role === 'admin') check(hasSellerSelector, 'admin: filter panel has a Seller / merchant selector');
  else check(!hasSellerSelector, 'seller: filter panel has NO Seller / merchant selector (business-scoped)');
  check(
    (await page.locator('text=BD division / region').count()) > 0 && (await page.locator('text=Payment status').count()) > 0,
    `${role}: shared filter controls present (region, payment status)`,
  );
  await page.screenshot({ path: join(OUT, `order-hub-${role}-filters.png`) });
  // apply a status tab and confirm the URL carries it (query-state survives nav)
  await page.locator('button:has-text("Pending")').first().click({ timeout: 8000 }).catch(() => {});
  await settle(page);
  check(new URL(page.url()).searchParams.get('tab') === 'pending', `${role}: selecting a tab writes ?tab= to the URL`);
  await page.goto(`${BASE}${hubPath}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.body.innerText.includes('Order Hub'), { timeout: 20000 }).catch(() => {});
  await settle(page);

  // ── card → Quick View ────────────────────────────────────────────────
  // click the clickable 3-col grid inside the first order card
  const firstGrid = page.locator('[role="button"][tabindex="0"]').first();
  await firstGrid.click({ timeout: 15000 }).catch(() => {});
  await page.waitForFunction(() => document.body.innerText.includes('Quick View'), { timeout: 15000 }).catch(() => {});
  await settle(page);
  const quickOpen =
    (await page.locator('text=Open Full Details').count()) > 0 &&
    (await page.locator('text=Quick View').count()) > 0;
  check(quickOpen, `${role}: card click opens the Quick View modal with "Open Full Details"`);
  await page.screenshot({ path: join(OUT, `order-hub-${role}-quick.png`) });

  // ── Quick View → Full Details ────────────────────────────────────────
  await page.locator('button:has-text("Open Full Details")').first().click({ timeout: 15000 }).catch(() => {});
  await page.waitForFunction(() => /\/(admin\/orders|admin\/platform-orders)\/[^/]+$/.test(location.pathname), {
    timeout: 15000,
  }).catch(() => {});
  await page.waitForFunction(() => document.body.innerText.includes('Order Details:'), { timeout: 20000 }).catch(() => {});
  await settle(page);
  const url = new URL(page.url());
  check(
    url.pathname === `${hubPath}/${encodeURIComponent(ownOrderId)}` ||
      url.pathname.startsWith(`${hubPath}/`),
    `${role}: Open Full Details navigates to ${hubPath}/:orderId`,
    url.pathname,
  );
  check(
    (await page.locator('text=Order Details:').count()) > 0 &&
      (await page.locator('text=Operations Timeline').count()) > 0,
    `${role}: full Order Details page renders (command bar + Operations Timeline)`,
  );
  check(
    (await page.locator('text=Logistics & Fulfillment').count()) > 0,
    `${role}: full page has the deep Logistics & Fulfillment section`,
  );
  {
    const ft = await page.evaluate(() => document.body.innerText);
    check(/Order status \/ fulfillment lifecycle/i.test(ft), `${role}: full page has the Order Lifecycle panel`);
    // dynamic primary CTA — one of the friendly labels, or an honest terminal/no-op line,
    // or the "no linked commerce order" gap note. Never a permanent "Mark Delivered".
    const primaryOk =
      /Accept order|Start processing|Mark dispatched|Mark delivered|Complete order/i.test(ft) ||
      /terminal state|No forward action|not available for this order type/i.test(ft);
    check(primaryOk, `${role}: lifecycle primary action derives from canonical state`);
    // "Modify status" secondary menu present whenever a correction is available
    check(
      /Modify status/i.test(ft) || /not available for this order type|terminal state/i.test(ft),
      `${role}: secondary "Modify status" control present (or none, at a terminal / unlinked state)`,
    );
    // Conversation link → canonical Seller-Inbox route, NOT the storefront
    const convHref = await page
      .locator('a:has-text("Conversation")')
      .first()
      .getAttribute('href')
      .catch(() => null);
    check(
      !!convHref && convHref.includes('/admin/conversations?buyerId='),
      `${role}: Conversation link targets /admin/conversations?buyerId= (not the storefront)`,
      convHref,
    );
    if (role === 'admin') {
      check(/Internal notes/i.test(ft) && /Staff only/i.test(ft), 'admin: full page shows the staff-only Internal Notes section');
    } else {
      check(!/Internal notes/i.test(ft), 'seller: no Internal Notes section (staff-only)');
    }

    // ── large ordered-item media + visibly-clickable product identity ──
    const mediaBox = await page.locator('.ordhub-media').first().boundingBox().catch(() => null);
    check(!!mediaBox && mediaBox.width >= 92 && mediaBox.width <= 120, `${role}: Full Details ordered-item media is large (~96–112px)`, mediaBox?.width);
    const identityLink = page.locator('a.ordhub-identity').first();
    const identityCount = await page.locator('a.ordhub-identity').count();
    if (identityCount > 0) {
      const href = await identityLink.getAttribute('href');
      check(!!href && /^\/admin\/products\/[^/]+\/edit$/.test(href), `${role}: product identity block links to /admin/products/:id/edit`, href);
      // affordance visible WITHOUT hover
      const hint = await page.locator('.ordhub-idhint').first().innerText().catch(() => '');
      check(/Open in Products & Inventory/i.test(hint), `${role}: "Open in Products & Inventory" hint is visible (not hover-only)`, hint);
      check((await page.locator('.ordhub-idopenicon').count()) > 0, `${role}: an open/external icon sits beside the product title`);
      // ACTUAL navigation — click the media, verify the URL, verify Studio load, then Back
      const expectId = decodeURIComponent(href!.replace(/^\/admin\/products\//, '').replace(/\/edit$/, ''));
      await page.locator('a.ordhub-identity .ordhub-media').first().click();
      await page.waitForFunction(
        (id) => location.pathname === `/admin/products/${encodeURIComponent(id)}/edit` || location.pathname === `/admin/products/${id}/edit`,
        expectId,
        { timeout: 15000 },
      ).catch(() => {});
      await settle(page);
      check(new URL(page.url()).pathname.replace(/^\/admin\/products\//, '').replace(/\/edit$/, '') === encodeURIComponent(expectId) ||
            new URL(page.url()).pathname === `/admin/products/${expectId}/edit`,
        `${role}: clicking the product media NAVIGATES to that exact product's Studio route`, page.url());
      const studioText = await page.evaluate(() => document.body.innerText);
      check(!/Order Details:/i.test(studioText), `${role}: Product Studio (not Order Details) is now rendered`);
      check(errs.length === 0, `${role}: Product Studio route loaded without a page error`, errs.slice(0, 2));
      await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {});
      await page.waitForFunction(() => document.body.innerText.includes('Order Details:'), { timeout: 15000 }).catch(() => {});
      await settle(page);
      check(/\/(admin\/orders|admin\/platform-orders)\/[^/]+$/.test(new URL(page.url()).pathname), `${role}: browser Back returns to the same Order Details page`, page.url());
    } else {
      check((await page.locator('.ordhub-identity').count()) > 0, `${role}: ordered items with no productId still render a (non-linked) identity block`);
    }

    // ── responsive: Order Details CONTENT fits + collapses ─────────────
    // (AdminWorkspaceLayout is a fixed-sidebar desktop shell — at true phone
    //  widths it squeezes its own main pane; that shell limit is out of scope.
    //  We assert this page's own container.)
    await page.setViewportSize({ width: 900, height: 950 });
    await settle(page);
    const resp = await page.evaluate(() => {
      const pg = document.querySelector('.ohd-page') as HTMLElement | null;
      const grid = document.querySelector('.ohd-grid') as HTMLElement | null;
      return {
        overflow: pg ? pg.scrollWidth - pg.clientWidth : 0,
        cols: grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length : 0,
      };
    });
    check(resp.overflow <= 2, `${role}: Order Details content has no horizontal overflow (tablet)`, resp.overflow);
    check(resp.cols === 1, `${role}: two-column layout collapses to one column below desktop`, resp.cols);
    const mMedia = await page.locator('.ordhub-media').first().boundingBox().catch(() => null);
    check(!mMedia || (mMedia.width >= 56 && mMedia.width <= 84), `${role}: ordered-item media shrinks on tablet (~72–80px)`, mMedia?.width);
    await page.setViewportSize({ width: 1440, height: 950 });
    await settle(page);
  }
  if (role === 'seller') {
    const bodyText = await page.evaluate(() => document.body.innerText);
    check(bodyText.includes('Your items value'), 'seller: full page shows seller-scoped "Your items value"');
    check(!bodyText.includes('Whole-order total'), 'seller: full page does NOT show the whole-order total');
    check(
      (await page.locator('input[placeholder*="Pathao"]').count()) > 0 ||
        bodyText.includes('No shipment record'),
      'seller: shipment tracking control present (editable) or honest empty state',
    );
  } else {
    check(
      (await page.locator('text=Whole-order total').count()) > 0,
      'admin: full page shows the whole-order total',
    );
  }
  await page.screenshot({ path: join(OUT, `order-hub-${role}-full.png`) });

  // ── Back → Hub ───────────────────────────────────────────────────────
  await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForFunction(() => document.body.innerText.includes('Order Hub'), { timeout: 20000 }).catch(() => {});
  await settle(page);
  check(new URL(page.url()).pathname === hubPath, `${role}: browser Back returns to the Order Hub`, page.url());

  // ── seller: forged other-seller order route is inert ─────────────────
  if (role === 'seller' && foreignOrderId) {
    await page.goto(`${BASE}${hubPath}/${encodeURIComponent(foreignOrderId)}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await settle(page);
    const t = await page.evaluate(() => document.body.innerText);
    const blocked =
      t.includes('not available to you') || t.includes('not found') || !t.includes('Operations Timeline');
    check(blocked, 'seller: forged other-seller order route cannot expose order content', t.slice(0, 160));
  }

  check(errs.length === 0, `${role}: no page errors during the flow`, errs.slice(0, 3));
  await ctx.close();
}

async function main() {
  const admin = await login('admin@choosify.com.bd');
  const seller = await login('seller@choosify.com.bd');
  check(!!admin.token && !!seller.token, 'seed logins (admin, seller)');
  if (!admin.token || !seller.token) return finish();

  const adminList = await listOrders(admin.token);
  const sellerList = await listOrders(seller.token);
  check(adminList.status === 200 && adminList.rows.length > 0, 'admin has orders to inspect', adminList.status);
  check(sellerList.status === 200 && sellerList.rows.length > 0, 'seller has orders to inspect', sellerList.status);
  if (!adminList.rows.length || !sellerList.rows.length) return finish();

  const sellerOwnIds = new Set(sellerList.rows.map((o) => o.orderId));
  const foreign = adminList.rows.find((o) => !sellerOwnIds.has(o.orderId))?.orderId || null;
  check(!!foreign, 'found an order NOT in the seller list (for the forged-route check)');

  const browser = await chromium
    .launch({ headless: true, channel: 'chrome' })
    .catch(() => chromium.launch({ headless: true }));

  await run(browser, 'admin', admin.token, '/admin/orders', adminList.rows[0].orderId, null);
  await run(browser, 'seller', seller.token, '/admin/platform-orders', sellerList.rows[0].orderId, foreign);
  await dispatchFlow(browser, seller.token, seller.uid, admin.token);
  await deliveryFlow(browser, seller.token, seller.uid, admin.token);

  await browser.close();
  finish();
}

function finish() {
  console.log(`\n=== ${PASS.length} passed, ${FAIL.length} failed ===`);
  console.log(`screens in ${OUT}`);
  if (FAIL.length) {
    for (const f of FAIL) console.log(' -', f);
    process.exit(1);
  }
  console.log('ALL ORDER-HUB HYBRID E2E CHECKS PASSED');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
