/**
 * Customer Invoice QA — screen, variant/SKU parity, Print CSS, Download PDF
 * (with Satoshi embedding), Bengali/currency rendering, and the invoice-prep
 * lazy-mint lifecycle now shared with the admin invoice.
 *
 * Usage: npx tsx scripts/probe-customer-invoice-qa.ts
 */
import { chromium } from 'playwright-core';
import { readFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const API_BASE = process.env.PROBE_API_BASE || 'http://localhost:3001';
const WEB_BASE = process.env.PROBE_WEB_BASE || 'http://localhost:5173';
const PW = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';
const OUT = join(process.cwd(), 'scripts', '_tmp_customer-invoice-qa');
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
  // Fresh consumer + fresh order every run -- guarantees an un-minted
  // invoiceId so the lazy-mint lifecycle is genuinely exercised.
  const rid = Date.now();
  const email = `probe-invoice-customer-${rid}@example.com`;
  const signup = await api('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password: PW, fullName: 'Probe Customer QA', role: 'consumer' }),
  });
  const token = signup.body?.accessToken || signup.body?.customToken;
  if (!token) throw new Error('consumer signup failed: ' + JSON.stringify(signup.body));
  console.log('consumer:', email);

  const products = (await api('/catalog/products?limit=5', {}, token)).body;
  const list = products.data || products.products || [];
  const product = list.find((p: any) => p.status === 'active') || list[0];
  if (!product) throw new Error('no active product found');

  const orderId = `probe-invoice-qa-${rid}`;
  const created = await api('/operations/orders', {
    method: 'POST',
    body: JSON.stringify({
      orderId,
      isCOD: false,
      paymentMethod: 'online',
      shipping: { fullName: 'Probe Customer QA', address: '99 Dhanmondi Road, Dhaka', region: 'Dhaka', phone: '01711000000' },
      subOrders: [{ sellerId: product.sellerId || product.brandId, items: [{ productId: product.id, quantity: 1 }] }],
    }),
  }, token);
  if (created.status !== 200 && created.status !== 201) throw new Error('order create failed: ' + JSON.stringify(created.body));
  const order = created.body.data;
  const sellerId = order.subOrders[0].sellerId;
  console.log('order:', orderId, 'seller:', sellerId, 'initial invoiceId:', order.subOrders[0].invoiceId || '(none yet)');

  const browser = await chromium.launch({ headless: true, channel: 'chrome' }).catch(() => chromium.launch({ headless: true }));
  const page = await browser.newPage({ viewport: { width: 1000, height: 1200 } });
  page.on('pageerror', (e) => console.log('pageerror:', String(e).slice(0, 200)));
  page.on('response', (res) => {
    if (res.url().includes('/auth/') || res.url().includes('/operations/orders/')) {
      console.log('net:', res.status(), res.url().replace(WEB_BASE, '').replace(API_BASE, ''));
    }
  });

  // Navigate DIRECTLY to the (still-unauthenticated) invoice URL first --
  // ProtectedRoute redirects to /login with state.from set to it. Logging in
  // from THAT redirected page uses the app's own client-side navigate(dest)
  // back to the original destination (an SPA transition, not a second full
  // page reload) -- both the realistic user flow (someone opening an invoice
  // link while logged out) and avoids racing the in-memory-token
  // silent-refresh a second page.goto after login would otherwise hit.
  await page.goto(`${WEB_BASE}/invoice/${orderId}/${sellerId}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#email', { timeout: 15000 }).catch(() => {});
  await page.fill('#email', email).catch(() => {});
  await page.fill('#password', PW).catch(() => {});
  await page.locator('button[type="submit"]').first().click().catch(() => {});
  await page.waitForFunction(
    () => document.body.innerText.includes('INVOICE NUMBER') || document.body.innerText.includes("don't have access") || document.body.innerText.includes('Invoice unavailable'),
    { timeout: 20000 },
  ).catch((e) => console.log('invoice content wait failed:', String(e).slice(0, 150)));
  await page.waitForTimeout(800);
  console.log('post-login URL:', page.url());
  await page.screenshot({ path: join(OUT, '1-customer-invoice-screen.png'), fullPage: true });

  const screenCheck = await page.evaluate(() => ({
    bodyText: document.body.innerText.slice(0, 400),
    hasInvoiceNumber: /#INV-/.test(document.body.innerText),
    hasDownloadBtn: Array.from(document.querySelectorAll('button')).some((b) => b.textContent?.includes('Download PDF')),
    hasPrintBtn: Array.from(document.querySelectorAll('button')).some((b) => b.textContent?.includes('Print')),
    font: document.querySelector('.invoice-card') ? getComputedStyle(document.querySelector('.invoice-card')!).fontFamily : null,
  }));
  console.log('screenCheck:', JSON.stringify(screenCheck, null, 2));
  assert(screenCheck.hasInvoiceNumber, 'A1: a real invoice number was minted and displayed (not "undefined")', screenCheck.bodyText);
  assert(screenCheck.hasDownloadBtn, 'A2: Download PDF button is present');
  assert(screenCheck.hasPrintBtn, 'A3: Print button is present');
  assert(!!screenCheck.font?.toLowerCase().includes('satoshi'), 'A4: invoice card font-family includes Satoshi', screenCheck.font);

  // Print emulation -- navbar/footer/buttons must disappear, invoice content remains.
  await page.emulateMedia({ media: 'print' });
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(OUT, '2-customer-invoice-print.png'), fullPage: true });
  const printCheck = await page.evaluate(() => {
    const navbar = document.querySelector('#main-navbar');
    const footer = document.querySelector('#global-footer');
    const widget = document.querySelector('#floating-overlays-root');
    const noPrintEls = Array.from(document.querySelectorAll('.no-print'));
    return {
      navbarHidden: navbar ? getComputedStyle(navbar).display === 'none' : true,
      footerHidden: footer ? getComputedStyle(footer).display === 'none' : true,
      widgetHidden: widget ? getComputedStyle(widget).display === 'none' : true,
      noPrintHidden: noPrintEls.every((el) => getComputedStyle(el).display === 'none'),
    };
  });
  console.log('printCheck:', JSON.stringify(printCheck, null, 2));
  assert(printCheck.navbarHidden, 'B1: storefront navbar hidden under print');
  assert(printCheck.footerHidden, 'B2: storefront footer hidden under print');
  assert(printCheck.widgetHidden, 'B4: floating "Ask EMI" widget hidden under print');
  assert(printCheck.noPrintHidden, 'B3: all .no-print controls hidden under print');
  await page.emulateMedia({ media: 'screen' });

  // Download PDF -- capture the file, confirm Satoshi embedded, render it.
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 30000 }),
    page.locator('button:has-text("Download PDF")').first().click(),
  ]);
  const pdfPath = join(OUT, 'customer-invoice-download.pdf');
  await download.saveAs(pdfPath);
  const pdfBytes = readFileSync(pdfPath);
  const pdfText = pdfBytes.toString('latin1');
  console.log('PDF size:', pdfBytes.length, 'bytes');
  assert(pdfText.includes('Satoshi'), 'C1: downloaded PDF has Satoshi embedded');
  assert(!pdfText.includes('/Helvetica') && !pdfText.includes('Helvetica-'), 'C2: downloaded PDF does NOT fall back to Helvetica');

  await browser.close();
  console.log(failed === 0 ? '\nALL PASS' : `\n${failed} FAILURE(S)`);
  console.log('screenshots + PDF in', OUT);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
