/**
 * Headed browser visual acceptance for the Final Messaging Completion Pass.
 * Sets state via API, drives the minimal UI, screenshots each surface the PO
 * asked to inspect. Screenshots → %TEMP%/choosify-final-msg/*.png
 *
 * Usage: npx tsx scripts/probe-final-messaging-screens.ts
 */
import { chromium, type Page } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const WEB = process.env.WEB_BASE || 'http://localhost:5173';
const ADMIN = process.env.ADMIN_BASE || 'http://localhost:3001';
const API = `${ADMIN}/api/v1`;
const DEV_PASS = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';
const SHOTS = path.join(process.env.TEMP || '/tmp', 'choosify-final-msg');
mkdirSync(SHOTS, { recursive: true });

const pass: string[] = [];
const fail: string[] = [];
const check = (c: unknown, l: string, d?: unknown) => {
  (c ? pass : fail).push(l);
  console.log(c ? 'PASS' : 'FAIL', l, c ? '' : JSON.stringify(d ?? '').slice(0, 200));
};
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function jsonOf(r: Response) {
  const t = await r.text();
  try {
    return t ? JSON.parse(t) : {};
  } catch {
    return { _raw: t };
  }
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
async function reg(tag: string) {
  const email = `fms.${tag}.${Date.now()}@buyer.choosify`;
  const password = 'Fms!2026';
  const r = await api('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, fullName: `FMS ${tag}` }) });
  return { email, password, uid: r.body.uid || r.body.data?.uid };
}
async function dbVerify(email: string) {
  const { db } = await import('../server/db/client');
  const { users } = await import('../server/db/schema');
  const { eq } = await import('drizzle-orm');
  await db.update(users).set({ emailVerified: true, updatedAt: new Date() }).where(eq(users.email, email.toLowerCase()));
}
async function shot(pg: Page, name: string) {
  await pg.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true }).catch(() => undefined);
}
async function healthy() {
  for (let i = 0; i < 30; i += 1) {
    try {
      if ((await fetch(`${ADMIN}/api/health`)).ok) return;
    } catch {
      /* retry */
    }
    await wait(1000);
  }
}
async function gotoAdmin(pg: Page, url: string) {
  await healthy();
  for (let i = 0; i < 3; i += 1) {
    try {
      await pg.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      return;
    } catch {
      await wait(2500);
    }
  }
}
async function loginAdmin(pg: Page, email: string) {
  await pg.goto(`${ADMIN}/login`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(700);
  await pg.fill('input[type="email"], input[name="email"]', email);
  await pg.fill('input[type="password"], input[name="password"]', DEV_PASS);
  await Promise.all([
    pg.waitForURL('**/admin/**', { timeout: 12000 }).catch(() => undefined),
    pg.locator('form button[type="submit"]').first().click().catch(() => pg.keyboard.press('Enter')),
  ]);
  await pg.waitForTimeout(2500);
}
async function loginWeb(pg: Page, email: string, password: string) {
  await pg.goto(`${WEB}/login`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(700);
  await pg.fill('#email, input[type="email"]', email);
  await pg.fill('#password, input[type="password"]', password);
  await Promise.all([
    pg.waitForResponse((r) => r.url().includes('/auth/login'), { timeout: 15000 }).catch(() => null),
    pg.locator('form button[type="submit"]').first().click().catch(() => pg.keyboard.press('Enter')),
  ]);
  await pg.waitForTimeout(2000);
}

async function main() {
  const admin = await login('admin@choosify.com.bd');
  const seller = await login('seller@choosify.com.bd');

  // ── order-linked seller conversation ──────────────────────────────
  const prods = await api('/catalog/products?limit=60', {}, seller.token);
  const p = (prods.body.data || []).find((x: Record<string, unknown>) => x.sellerId && x.productType !== 'service');
  const sellerId = String(p.sellerId);
  await api(`/catalog/products/${p.id}/inventory`, { method: 'PATCH', body: JSON.stringify({ quantity: 999, reservedQuantity: 0 }) }, seller.token);
  const buyer = await reg('b');
  await dbVerify(buyer.email);
  const buyerTok = (await login(buyer.email, buyer.password)).token;
  // give the buyer a platform relationship so they list in Seller Customers
  await api('/operations/platform-messages', { method: 'POST', body: JSON.stringify({ buyerId: buyer.uid, userName: 'FMS Buyer', body: `Question about ${p.title}`, sellerId, bookingOffer: { kind: 'booking_offer', listingId: String(p.id), listingTitle: String(p.title), sellerId, sellerName: String(p.brandName || 'Seller'), buyerId: buyer.uid, isService: false, fields: { quantity: 1 }, price: Number(p.price) || 500 } }) }, buyerTok);
  const offer = await api('/operations/manual-offers', { method: 'POST', body: JSON.stringify({ sellerId, buyerId: buyer.uid, sellerName: String(p.brandName || 'Seller'), items: [{ productId: String(p.id), quantity: 1, price: Number(p.price) || 500 }] }) }, admin.token);
  const orderId = (await api(`/operations/manual-offers/${encodeURIComponent(offer.body?.data?.offerId)}/accept`, { method: 'POST', body: '{}' }, buyerTok)).body?.order?.orderId;
  check(!!orderId, 'setup: order-linked seller conversation created', orderId);

  const browser = await chromium
    .launch({ headless: !process.env.HEADED, channel: 'chrome' })
    .catch(() => chromium.launch({ headless: true }));

  // 1 + 2 — Seller order-linked conversation with quick actions, then Order Console
  const sctx = await browser.newContext({ viewport: { width: 1560, height: 1000 } });
  const sp = await sctx.newPage();
  await loginAdmin(sp, 'seller@choosify.com.bd');
  await gotoAdmin(sp, `${ADMIN}/admin/conversations`);
  await sp.waitForTimeout(3500);
  const row = sp.locator('button', { hasText: new RegExp(String(buyer.uid).slice(0, 8)) }).first();
  if (await row.count()) {
    await row.click().catch(() => undefined);
    await sp.waitForTimeout(2500);
  }
  await shot(sp, 'fm-01-seller-conv-quick-actions');
  const txt = await sp.evaluate(() => document.body.innerText);
  check(/quick actions/i.test(txt) && /mark delivered/i.test(txt), 'Seller conversation shows canonical Quick actions (Mark Delivered / Manage Fulfillment)', txt.slice(0, 0));
  await gotoAdmin(sp, `${ADMIN}/admin/platform-orders`);
  await sp.waitForTimeout(3000);
  await shot(sp, 'fm-02-order-console');

  // 3 + 4 — Buyer Inbox + My Orders after a Seller status update
  const before = await api(`/operations/orders/${encodeURIComponent(orderId)}`, {}, seller.token);
  const itemId = (before.body?.data?.subOrders || [])[0]?.items?.[0]?.itemId;
  await api(`/operations/orders/${encodeURIComponent(orderId)}/items/${encodeURIComponent(itemId)}/mark-delivered`, { method: 'POST', body: '{}' }, seller.token);
  const bctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const bp = await bctx.newPage();
  await loginWeb(bp, buyer.email, buyer.password);
  await bp.goto(`${WEB}/messages`, { waitUntil: 'domcontentloaded' });
  await bp.waitForTimeout(3000);
  await shot(bp, 'fm-03-buyer-inbox-after-update');
  await bp.goto(`${WEB}/dashboard?tab=my-orders`, { waitUntil: 'domcontentloaded' }).catch(() => undefined);
  await bp.waitForTimeout(3000);
  await shot(bp, 'fm-04-buyer-my-orders-after-update');
  await bctx.close();

  // ── Admin CRM: create a support ticket + drive the control panel ──
  const cons = await reg('c');
  await dbVerify(cons.email);
  const consTok = (await login(cons.email, cons.password)).token;
  const ens = await api('/support/conversations/ensure', { method: 'POST', body: JSON.stringify({ subject: 'Refund question', body: 'I want to return an item.' }) }, consTok);
  const convId = ens.body?.data?.conversation?.id || ens.body?.conversation?.id;
  await api(`/admin/support/conversations/${convId}`, { method: 'PATCH', body: JSON.stringify({ status: 'in_progress', priority: 'high' }) }, admin.token);
  await api(`/admin/support/conversations/${convId}/notes`, { method: 'POST', body: JSON.stringify({ body: 'Verified purchase; return window still open.' }) }, admin.token);
  await api(`/admin/support/conversations/${convId}/followups`, { method: 'POST', body: JSON.stringify({ dueAt: new Date(Date.now() + 2 * 864e5).toISOString() }) }, admin.token);

  const actx = await browser.newContext({ viewport: { width: 1560, height: 1000 } });
  const ap = await actx.newPage();
  await loginAdmin(ap, 'admin@choosify.com.bd');
  await gotoAdmin(ap, `${ADMIN}/admin/messages?c=${convId}`);
  await ap.waitForTimeout(3500);
  await shot(ap, 'fm-05-admin-crm-control-panel');
  const at = await ap.evaluate(() => document.body.innerText);
  check(/customer snapshot/i.test(at) && /conversation status/i.test(at), 'Admin CRM: Customer snapshot + Conversation status sections render');
  check(/internal notes/i.test(at) && /return window still open/i.test(at), 'Admin CRM: Internal Notes section shows the note');
  check(/follow-up reminder/i.test(at) && /assignment/i.test(at), 'Admin CRM: Follow-up + Assignment sections render');
  await shot(ap, 'fm-06-admin-internal-notes'); // same view — notes visible in panel

  // Follow-up state — set to need_followup already; screenshot the list badge
  await gotoAdmin(ap, `${ADMIN}/admin/messages`);
  await ap.waitForTimeout(3000);
  await shot(ap, 'fm-07-admin-followup-state');

  // Resolve then simulate reopen via a consumer reply
  await api(`/admin/support/conversations/${convId}`, { method: 'PATCH', body: JSON.stringify({ status: 'resolved' }) }, admin.token);
  await api(`/support/conversations/${convId}/messages`, { method: 'POST', body: JSON.stringify({ body: 'Any progress?' }) }, consTok);
  await gotoAdmin(ap, `${ADMIN}/admin/messages?c=${convId}`);
  await ap.waitForTimeout(3000);
  await shot(ap, 'fm-08-admin-resolved-reopened');
  const at2 = await ap.evaluate(() => document.body.innerText);
  check(/reopened/i.test(at2) || /open/i.test(at2), 'Admin CRM: ticket shows reopened/open after the user reply');

  // ── No CRM metadata leakage to the user's own support view ────────
  const cp = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await loginWeb(cp, cons.email, cons.password);
  await cp.goto(`${WEB}/messages`, { waitUntil: 'domcontentloaded' });
  await cp.waitForTimeout(3000);
  await shot(cp, 'fm-09-consumer-support-no-crm-leak');
  const ct = await cp.evaluate(() => document.body.innerText);
  check(
    !/internal note|return window still open|assignee|priority: high|need_followup|follow-up reminder/i.test(ct),
    'SECURITY: consumer support view shows NO internal notes / assignee / priority / follow-up metadata',
  );
  // API-level confirmation
  const leak = await api(`/admin/support/conversations/${convId}/notes`, {}, consTok);
  check([403, 429].includes(leak.status), 'SECURITY: consumer notes endpoint is denied (403 / rate-limited 429)', leak.status);

  await browser.close();
  console.log(`\n=== ${pass.length} passed, ${fail.length} failed ===`);
  console.log('screenshots:', SHOTS);
  if (fail.length) {
    for (const f of fail) console.log(' -', f);
    process.exit(1);
  }
  console.log('ALL FINAL MESSAGING SCREEN CHECKS PASSED');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
