/**
 * Admin Invoice legacy-layout QA — verifies the invoice routes now render
 * inside the canonical AdminWorkspaceLayout shell (not the legacy
 * AdminLayout), Satoshi typography is applied, and print output hides the
 * dashboard chrome.
 *
 * Usage: npx tsx scripts/probe-invoice-dashboard-shell-qa.ts
 */
import { chromium } from 'playwright-core';
import { mkdirSync } from 'fs';
import { join } from 'path';

const API_BASE = process.env.PROBE_API_BASE || 'http://localhost:3001';
const WEB_BASE = process.env.PROBE_ADMIN_BASE || 'http://localhost:5173';
const PW = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';
const OUT = join(process.cwd(), 'scripts', '_tmp_invoice-shell-qa');
mkdirSync(OUT, { recursive: true });

let failed = 0;
function assert(cond: boolean, label: string, detail?: unknown) {
  if (cond) console.log('PASS', label);
  else { failed += 1; console.log('FAIL', label, detail ?? ''); }
}

async function api(path: string, init: RequestInit = {}, token?: string) {
  const r = await fetch(`${API_BASE}/api/v1${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers || {}) },
  });
  return { status: r.status, body: (await r.json().catch(() => ({}))) as any };
}

async function main() {
  const admin = (await api('/auth/login', { method: 'POST', body: JSON.stringify({ email: 'admin@choosify.com.bd', password: PW }) })).body;
  if (!admin.accessToken) throw new Error('admin login failed: ' + JSON.stringify(admin));

  const orders = (await api('/operations/orders', {}, admin.accessToken)).body;
  const list: any[] = orders.data || orders.orders || [];
  if (!list.length) throw new Error('no operations orders found to build an invoice URL from');
  // Prefer an order whose sub-order already has a minted invoiceId -- only
  // those actually render the real invoice card instead of the "awaiting
  // payment" placeholder.
  const invoiceEligible = list.find((o: any) =>
    (o.subOrders || o.subs || []).some((s: any) => s.invoiceId),
  ) || list[0];
  const order = invoiceEligible;
  const orderId = order.orderId || order.id;
  const sub = (order.subOrders || order.subs || []).find((s: any) => s.invoiceId) || (order.subOrders || order.subs || [])[0];
  const sellerId = sub?.sellerId || order.sellerId;
  if (!orderId || !sellerId) throw new Error('order missing orderId/sellerId: ' + JSON.stringify(order).slice(0, 300));
  console.log('using order:', orderId, 'seller:', sellerId, 'invoiceId:', sub?.invoiceId);

  const browser = await chromium.launch({ headless: true, channel: 'chrome' }).catch(() => chromium.launch({ headless: true }));
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.on('pageerror', (e) => console.log('pageerror:', String(e).slice(0, 200)));

  // Log in through the real UI so localStorage/session state matches a real browser session.
  await page.goto(`${WEB_BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 15000 }).catch(() => {});
  await page.fill('input[type="email"], input[name="email"]', 'admin@choosify.com.bd').catch(() => {});
  await page.fill('input[type="password"], input[name="password"]', PW).catch(() => {});
  await page.locator('button[type="submit"]').first().click().catch(() => {});
  await page.waitForURL('**/admin/dashboard', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);

  const invoiceUrl = `${WEB_BASE}/admin/invoice/op/${orderId}/${sellerId}`;
  await page.goto(invoiceUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: join(OUT, '1-invoice-admin-view.png'), fullPage: true });

  const shellCheck = await page.evaluate(() => {
    const content = document.querySelector('.admin-workspace__content');
    return {
      hasCanonicalSidebar: Boolean(document.querySelector('.admin-workspace__sidebar')),
      hasCanonicalTopbar: Boolean(document.querySelector('.admin-workspace__topbar')),
      hasLegacyGlassHeader: Boolean(document.querySelector('.glass-header')),
      hasLegacyAdminLayoutSidebar: Boolean(document.querySelector('.sidebar.w-\\[240px\\]')),
      hasInvoicePrintRoot: Boolean(document.querySelector('#invoice-print-root')),
      // .admin-workspace__content is the real governing element for this
      // shell's typography (--cms-font-sans) -- document.body's own
      // font-family is a separate, pre-existing, effectively-dead legacy
      // variable neutralized by Tailwind Preflight's `body{font-family:inherit}`,
      // not a meaningful signal here.
      contentFont: content ? getComputedStyle(content).fontFamily : null,
      sidebarFont: document.querySelector('.admin-workspace__sidebar')
        ? getComputedStyle(document.querySelector('.admin-workspace__sidebar')!).fontFamily
        : null,
    };
  });
  console.log('shellCheck:', JSON.stringify(shellCheck, null, 2));

  assert(shellCheck.hasCanonicalSidebar, 'A1: canonical AdminWorkspaceLayout sidebar is present');
  assert(shellCheck.hasCanonicalTopbar, 'A2: canonical AdminWorkspaceLayout topbar is present');
  assert(!shellCheck.hasLegacyGlassHeader, 'A3: legacy .glass-header is NOT present');
  assert(!shellCheck.hasLegacyAdminLayoutSidebar, 'A4: legacy AdminLayout sidebar is NOT present');
  assert(!!shellCheck.contentFont?.toLowerCase().includes('satoshi'), 'A5: dashboard content font-family includes Satoshi', shellCheck.contentFont);

  // Emulate print media and re-screenshot to confirm shell chrome disappears.
  await page.emulateMedia({ media: 'print' });
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(OUT, '2-invoice-print-emulated.png'), fullPage: true });
  const printCheck = await page.evaluate(() => {
    const sidebar = document.querySelector('.admin-workspace__sidebar');
    const topbar = document.querySelector('.admin-workspace__topbar');
    const noPrintEls = Array.from(document.querySelectorAll('.no-print'));
    return {
      sidebarHidden: sidebar ? getComputedStyle(sidebar).display === 'none' : true,
      topbarHidden: topbar ? getComputedStyle(topbar).display === 'none' : true,
      noPrintAllHidden: noPrintEls.every((el) => getComputedStyle(el).display === 'none'),
      noPrintCount: noPrintEls.length,
    };
  });
  console.log('printCheck:', JSON.stringify(printCheck, null, 2));
  assert(printCheck.sidebarHidden, 'B1: sidebar is display:none under print media');
  assert(printCheck.topbarHidden, 'B2: topbar is display:none under print media');
  assert(printCheck.noPrintAllHidden, 'B3: all .no-print elements are hidden under print media', printCheck);

  await page.emulateMedia({ media: 'screen' });

  // Back button behaves normally (no navigation crash).
  const urlBefore = page.url();
  await page.locator('button:has-text("Back")').first().click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(1000);
  console.log('C1: Back navigated away from invoice URL?', page.url() !== urlBefore, urlBefore, '->', page.url());

  await browser.close();
  console.log(failed === 0 ? '\nALL PASS' : `\n${failed} FAILURE(S)`);
  console.log('screenshots written to', OUT);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
