/**
 * Cashbook rebuild (Sprint 15) — browser E2E + screenshots.
 *
 * Proves the single-Hub architecture:
 *   /admin/cashbook            → the ONE primary hub (seller grid / admin oversight)
 *   /admin/cashbook/:bookId    → that book's ledger — NOT another hub, NOT CmsMirror
 * plus: rounded-corner design language, Cash In/Out + running balance, manual
 * edit, immutable imports, Import Orders flow (canonical data), and the
 * strictly read-only Super Admin oversight (Brand → Books → Ledger).
 *
 * Usage: npx tsx scripts/probe-cashbook-e2e-browser.ts   (dev server on :3001)
 */
import { chromium, type Browser, type Page } from 'playwright-core';
import { mkdirSync } from 'fs';
import { join } from 'path';

const BASE = process.env.PROBE_BASE_URL_ROOT || 'http://localhost:3001';
const API = `${BASE}/api/v1`;
const DEV_PASS = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';
const OUT = join(process.cwd(), 'scripts', '_tmp_cashbook-artifacts');
mkdirSync(OUT, { recursive: true });

const PASS: string[] = [];
const FAIL: string[] = [];
function check(c: unknown, label: string, detail?: unknown) {
  (c ? PASS : FAIL).push(label);
  console.log(c ? 'PASS' : 'FAIL', label, c ? '' : JSON.stringify(detail ?? '').slice(0, 240));
}
async function jsonOf(r: Response) {
  const t = await r.text();
  try { return t ? JSON.parse(t) : {}; } catch { return {}; }
}
async function api(path: string, init?: RequestInit, token?: string) {
  const r = await fetch(`${API}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init?.headers || {}) },
  });
  return { status: r.status, body: await jsonOf(r) };
}
async function login(email: string) {
  const r = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password: DEV_PASS }) });
  return { token: r.body.accessToken || r.body.token || r.body.data?.accessToken || '', uid: r.body.uid || r.body.data?.uid || '' };
}
async function registerBuyer(tag: string) {
  const email = `cbe2e.${tag}.${Date.now()}.${Math.random().toString(36).slice(2, 5)}@buyer.choosify`;
  const reg = await api('/auth/register', { method: 'POST', body: JSON.stringify({ email, password: 'CbE2e!2026', fullName: `CB E2E ${tag}` }) });
  const { db } = await import('../server/db/client');
  const { users } = await import('../server/db/schema');
  const { eq } = await import('drizzle-orm');
  await db.update(users).set({ emailVerified: true, updatedAt: new Date() }).where(eq(users.email, email.toLowerCase()));
  const li = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password: 'CbE2e!2026' }) });
  return { token: li.body.accessToken || li.body.token || li.body.data?.accessToken || '', uid: String(reg.body.uid || reg.body.data?.uid) };
}
async function makeDeliveredOrder(sellerTok: string, adminTok: string, listingId: string, tag: string) {
  const buyer = await registerBuyer(tag);
  await api('/cart/clear', { method: 'POST' }, buyer.token);
  await api('/cart/items', { method: 'POST', body: JSON.stringify({ listingType: 'product', listingId, quantity: 1 }) }, buyer.token);
  const idem = `cbe2e-${tag}-${Date.now()}`;
  const co = await api('/checkout', { method: 'POST', headers: { 'Idempotency-Key': idem }, body: JSON.stringify({ shipping: { fullName: 'CB E2E', phone: '+8801711221100', address: 'Dhaka Rd', region: 'Dhaka' } }) }, buyer.token);
  const order = co.body?.data?.orders?.[0];
  const checkoutId = co.body?.data?.checkout?.id;
  await api('/commerce/payments/initiate', { method: 'POST', body: JSON.stringify({ checkoutId, paymentMethod: 'cod', idempotencyKey: `${idem}-cod` }) }, buyer.token);
  await api(`/orders/${encodeURIComponent(order.id)}/transition`, { method: 'POST', body: JSON.stringify({ status: 'confirmed' }) }, sellerTok);
  await api(`/orders/${encodeURIComponent(order.id)}/transition`, { method: 'POST', body: JSON.stringify({ status: 'packed' }) }, sellerTok);
  await api(`/orders/${encodeURIComponent(order.id)}/dispatch`, { method: 'POST', body: JSON.stringify({ fulfillmentMethod: 'courier', courier: 'Pathao', trackingNumber: `TRK-CBE2E-${Date.now()}` }) }, sellerTok);
  await api(`/orders/${encodeURIComponent(order.id)}/transition`, { method: 'POST', body: JSON.stringify({ status: 'delivered' }) }, sellerTok);
  return order.orderNumber as string;
}

async function ctx(browser: Browser, token: string) {
  const c = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  await c.addInitScript((t) => {
    try { localStorage.setItem('choosify_auth_token', t as string); } catch {}
  }, token);
  return c;
}
const settle = (p: Page) => p.waitForTimeout(2600);
const bodyText = (p: Page) => p.evaluate(() => document.body.innerText);

async function main() {
  const admin = await login('admin@choosify.com.bd');
  const seller = await login('seller@choosify.com.bd');
  check(!!admin.token && !!seller.token, 'seed logins');
  if (!seller.token) return finish();

  const prods = await api('/catalog/products?limit=200', {}, seller.token);
  const p = (prods.body.data || []).find(
    (x: Record<string, unknown>) => x.sellerId === seller.uid && x.productType !== 'service' && (x.status === 'live' || x.status === 'active'),
  );
  check(!!p, 'seller has a live product');
  if (!p) return finish();
  await api(`/catalog/products/${p.id}/inventory`, { method: 'PATCH', body: JSON.stringify({ quantity: 999, reservedQuantity: 0 }) }, admin.token);
  const importable = await makeDeliveredOrder(seller.token, admin.token, String(p.id), 'imp');

  const browser = await chromium.launch({ headless: true, channel: 'chrome' }).catch(() => chromium.launch({ headless: true }));

  // ═══════════════ SELLER ═══════════════
  const sctx = await ctx(browser, seller.token);
  const page = await sctx.newPage();
  const errs: string[] = [];
  page.on('pageerror', (e) => errs.push(String(e)));

  await page.goto(`${BASE}/admin/cashbook`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => document.body.innerText.includes('My Cashbook'), { timeout: 25000 }).catch(() => {});
  await settle(page);
  let t = await bodyText(page);
  check(/My Cashbook/.test(t), 'seller: primary hub renders "My Cashbook"');
  check(/TOTAL CASH IN/i.test(t) && /TOTAL CASH OUT/i.test(t) && /NET BALANCE/i.test(t) && /TOTAL BOOKS/i.test(t), 'seller: KPI strip = Cash In / Cash Out / Net Balance / Total Books');
  check(!/TOTAL REVENUE IMPORTED/i.test(t), 'seller: no legacy "Total Revenue Imported" KPI');
  check((await page.locator('button:has-text("New Book")').count()) > 0, 'seller: New Book button present');
  check((await page.locator('button:has-text("Import Orders")').count()) > 0, 'seller: Import Orders button present');
  check((await page.locator('iframe').count()) === 0, 'seller: no CmsMirror iframe on the hub');
  await page.screenshot({ path: join(OUT, 'cashbook-seller-hub.png'), fullPage: true });

  // create a book
  await page.locator('button:has-text("New Book")').first().click();
  await settle(page);
  const bookName = `E2E Book ${Date.now()}`;
  await page.locator('input[placeholder*="Outlet Sales"]').first().fill(bookName);
  await page.locator('button[type="submit"]:has-text("Create book")').first().click();
  await page.waitForFunction((n) => !!document.querySelector(`[role="button"][aria-label="${n}"]`), bookName, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(4600); // let the success toast auto-dismiss
  check((await page.locator(`[role="button"][aria-label="${bookName}"]`).count()) > 0, 'seller: created book appears in the grid');

  // rounded-corner language spot check on the actual folder card
  const radius = await page.evaluate((n) => {
    const el = document.querySelector(`[role="button"][aria-label="${n}"]`) as HTMLElement | null;
    return el ? getComputedStyle(el).borderTopLeftRadius : '';
  }, bookName);
  check(/\d/.test(radius) && parseInt(radius) >= 10, 'seller: folder cards use a soft (>=10px) corner radius', radius);

  // click the book card → LEDGER (not another hub)
  await page.locator(`[role="button"][aria-label="${bookName}"]`).first().click();
  await page.waitForFunction(() => /Net Ledger Balance/i.test(document.body.innerText), { timeout: 15000 }).catch(() => {});
  await settle(page);
  t = await bodyText(page);
  check(new URL(page.url()).pathname.startsWith('/admin/cashbook/'), 'seller: card click navigates to /admin/cashbook/:bookId', page.url());
  check(/Net Ledger Balance/i.test(t) && /TOTAL INFLOW/i.test(t) && /TOTAL OUTFLOW/i.test(t), 'seller: ledger shows Inflow / Outflow / Net Ledger Balance');
  check(!/My Cashbook/.test(t.replace(bookName, '')) || /All Books/.test(t), 'seller: ledger is NOT another "My Cashbook" hub');
  check((await page.locator('button:has-text("Cash In")').count()) > 0 && (await page.locator('button:has-text("Cash Out")').count()) > 0, 'seller: ledger has Cash In / Cash Out');
  check((await page.locator('iframe').count()) === 0, 'seller: no CmsMirror iframe on the ledger (routing fixed)');

  // add a Cash In
  await page.locator('button:has-text("Cash In")').first().click();
  await settle(page);
  await page.locator('input[placeholder="0.00"]').first().fill('12000');
  await page.locator('input[placeholder*="Apex Hub"]').first().fill('Weekend stall');
  await page.locator('button[type="submit"]:has-text("Save entry")').first().click();
  await page.waitForFunction(() => document.body.innerText.includes('Weekend stall'), { timeout: 15000 }).catch(() => {});
  await settle(page);
  t = await bodyText(page);
  check(t.includes('Weekend stall'), 'seller: Cash In entry shows in the ledger');
  check(/12,000/.test(t), 'seller: inflow total reflects the new entry');

  // add a Cash Out
  await page.locator('button:has-text("Cash Out")').first().click();
  await settle(page);
  await page.locator('input[placeholder="0.00"]').first().fill('4500');
  await page.locator('input[placeholder*="Apex Hub"]').first().fill('Packaging');
  await page.locator('button[type="submit"]:has-text("Save entry")').first().click();
  await page.waitForFunction(() => document.body.innerText.includes('Packaging'), { timeout: 15000 }).catch(() => {});
  await settle(page);
  t = await bodyText(page);
  check(t.includes('Packaging') && /7,500/.test(t), 'seller: Cash Out recorded, net = 12,000 − 4,500 = 7,500', t.match(/7,500/)?.[0]);
  await page.screenshot({ path: join(OUT, 'cashbook-seller-ledger.png'), fullPage: true });

  // edit the manual entry
  await page.locator('text=Packaging').first().click();
  await page.waitForFunction(() => /Entry detail/i.test(document.body.innerText), { timeout: 10000 }).catch(() => {});
  await settle(page);
  await page.locator('button:has-text("Edit record")').first().click();
  await settle(page);
  await page.locator('input[placeholder="0.00"]').first().fill('5000');
  await page.locator('button[type="submit"]:has-text("Save changes")').first().click();
  await page.waitForFunction(() => /7,000/.test(document.body.innerText), { timeout: 12000 }).catch(() => {});
  await settle(page);
  check(/7,000/.test(await bodyText(page)), 'seller: editing a manual entry recalculates the balance (net 7,000)');

  // Import Orders flow
  await page.locator('button:has-text("All Books")').first().click();
  await page.waitForFunction(() => document.body.innerText.includes('My Cashbook'), { timeout: 15000 }).catch(() => {});
  await settle(page);
  await page.locator('button:has-text("Import Orders")').first().click();
  await page.waitForFunction(() => /Import orders into a cashbook/i.test(document.body.innerText), { timeout: 12000 }).catch(() => {});
  await settle(page);
  check(/delivered \/ completed/i.test(await bodyText(page)), 'seller: Import modal states only delivered/completed orders are eligible');
  const orderRow = page.locator(`label:has-text("${importable}")`).first();
  check((await orderRow.count()) > 0, 'seller: the delivered order is listed as importable', importable);
  if ((await orderRow.count()) > 0) {
    await orderRow.locator('input[type="checkbox"]').check().catch(() => {});
    // the newest book (our E2E book) is pre-selected as the destination
    await page.screenshot({ path: join(OUT, 'cashbook-import-modal.png') });
    await page.locator('button:has-text("Import selected")').first().click();
    await page.waitForFunction(() => /Net Ledger Balance/i.test(document.body.innerText), { timeout: 15000 }).catch(() => {});
    await settle(page);
    t = await bodyText(page);
    check(new RegExp(`Order #${importable}`).test(t) || /imported/i.test(t), 'seller: imported order line lands in the ledger', t.slice(0, 200));
    // imported entry is immutable — open its audit modal (click the date cell,
    // NOT the "Order #" deep-link which navigates away)
    const impRow = page.locator('tr', { hasText: `Order #${importable}` }).first();
    if ((await impRow.count()) > 0) {
      await impRow.locator('td').first().click();
      await page.waitForFunction(() => /Entry detail/i.test(document.body.innerText), { timeout: 10000 }).catch(() => {});
      await settle(page);
      const auditText = await bodyText(page);
      check(/Imported order/i.test(auditText), 'seller: audit modal opens for the imported entry');
      const editBtn = page.locator('button:has-text("Edit record")').first();
      const disabled = await editBtn.isDisabled().catch(() => false);
      check(disabled, 'seller: imported entry Edit is disabled (immutable history)');
      await page.keyboard.press('Escape').catch(() => {});
    }
  }

  check(errs.length === 0, 'seller: no page errors', errs.slice(0, 3));
  await sctx.close();

  // ═══════════════ SUPER ADMIN OVERSIGHT ═══════════════
  const actx = await ctx(browser, admin.token);
  const apage = await actx.newPage();
  const aerrs: string[] = [];
  apage.on('pageerror', (e) => aerrs.push(String(e)));

  await apage.goto(`${BASE}/admin/cashbook`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await apage.waitForFunction(() => /Cashbook Oversight/i.test(document.body.innerText), { timeout: 25000 }).catch(() => {});
  await settle(apage);
  let at = await bodyText(apage);
  check(/Cashbook Oversight/i.test(at), 'admin: hub is "Cashbook Oversight" (not "My Cashbook")');
  check(!/New Book/.test(at) && !/Import Orders/.test(at), 'admin: no New Book / Import Orders on the oversight index');
  check((await apage.locator('iframe').count()) === 0, 'admin: no CmsMirror iframe');
  await apage.screenshot({ path: join(OUT, 'cashbook-admin-oversight.png'), fullPage: true });

  // open a seller folder (the seed seller has our E2E books)
  const sellerCard = apage.locator('[role="button"][aria-label]').first();
  if ((await sellerCard.count()) > 0) {
    await sellerCard.click();
    await apage.waitForFunction(() => /Read-only · Managed by Seller/i.test(document.body.innerText), { timeout: 15000 }).catch(() => {});
    await settle(apage);
    at = await bodyText(apage);
    check(/Read-only · Managed by Seller/i.test(at), 'admin: seller view shows the read-only badge');
    check(new URL(apage.url()).search.includes('seller='), 'admin: seller view carries ?seller= (no giant flat list)', apage.url());
    // open a book → read-only ledger
    const bookCard = apage.locator('[role="button"][aria-label]').first();
    if ((await bookCard.count()) > 0) {
      await bookCard.click();
      await apage.waitForFunction(() => /Net Ledger Balance/i.test(document.body.innerText), { timeout: 15000 }).catch(() => {});
      await settle(apage);
      at = await bodyText(apage);
      check(/Net Ledger Balance/i.test(at), 'admin: opens the seller book ledger');
      check(/Read-only · Managed by Seller/i.test(at), 'admin: ledger shows the read-only badge');
      const forbidden = ['+ Cash In', '− Cash Out', 'New Book', 'Import Orders', 'Rename', 'Delete book'];
      const present = forbidden.filter((f) => at.includes(f));
      check(present.length === 0, 'admin: NO mutation controls on the oversight ledger', present);
      check(new URL(apage.url()).search.includes('owner='), 'admin: ledger route carries ?owner=', apage.url());
      await apage.screenshot({ path: join(OUT, 'cashbook-admin-ledger-readonly.png'), fullPage: true });
    }
  }
  check(aerrs.length === 0, 'admin: no page errors', aerrs.slice(0, 3));
  await actx.close();

  await browser.close();
  finish();
}

function finish() {
  console.log(`\n=== ${PASS.length} passed, ${FAIL.length} failed ===`);
  console.log(`screens in ${OUT}`);
  if (FAIL.length) { for (const f of FAIL) console.log(' -', f); process.exit(1); }
  console.log('ALL CASHBOOK E2E CHECKS PASSED');
}
main().catch((e) => { console.error(e); process.exit(1); });
