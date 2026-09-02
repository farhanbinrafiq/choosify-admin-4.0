/**
 * Brand-gradient visual capture — headed before/after screenshots for the
 * Choosify global brand-gradient pass. Presentation only; sets no state, changes
 * nothing. Run once before the CSS changes and once after:
 *
 *   $env:SHOT_DIR="brand-before"; npx tsx scripts/probe-brand-visual.ts
 *   $env:SHOT_DIR="brand-after";  npx tsx scripts/probe-brand-visual.ts
 *
 * Screenshots → %TEMP%/choosify-brand/<SHOT_DIR>/*.png
 */
import { chromium, type Page, type BrowserContext } from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const WEB = process.env.WEB_BASE || 'http://localhost:5173';
const ADMIN = process.env.ADMIN_BASE || 'http://localhost:3001';
const DEV_PASS = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';
const DIR = process.env.SHOT_DIR || 'brand-before';
const SHOTS = path.join(os.tmpdir(), 'choosify-brand', DIR);
fs.mkdirSync(SHOTS, { recursive: true });

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const done: string[] = [];

async function shot(pg: Page, name: string, full = true) {
  try {
    await pg.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: full });
    done.push(name);
    console.log('shot', name);
  } catch (e) {
    console.log('MISS', name, (e as Error).message.slice(0, 120));
  }
}

async function healthy() {
  for (let i = 0; i < 30; i += 1) {
    try {
      if ((await fetch(`${ADMIN}/api/health`)).ok) return;
    } catch { /* retry */ }
    await wait(1000);
  }
}

async function goto(pg: Page, url: string) {
  for (let i = 0; i < 3; i += 1) {
    try {
      await pg.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
      return;
    } catch { await wait(2500); }
  }
}

async function loginAdmin(pg: Page, email: string) {
  await goto(pg, `${ADMIN}/login`);
  await pg.waitForTimeout(700);
  await pg.fill('input[type="email"], input[name="email"]', email).catch(() => undefined);
  await pg.fill('input[type="password"], input[name="password"]', DEV_PASS).catch(() => undefined);
  await Promise.all([
    pg.waitForURL('**/admin/**', { timeout: 15000 }).catch(() => undefined),
    pg.locator('form button[type="submit"]').first().click().catch(() => pg.keyboard.press('Enter')),
  ]);
  await pg.waitForTimeout(2500);
}

async function loginWeb(pg: Page, email: string) {
  await goto(pg, `${WEB}/login`);
  await pg.waitForTimeout(900);
  await pg.fill('#email, input[type="email"]', email).catch(() => undefined);
  await pg.fill('#password, input[type="password"]', DEV_PASS).catch(() => undefined);
  await pg.locator('form button[type="submit"]').first().click().catch(() => pg.keyboard.press('Enter'));
  // wait for the SPA to persist the logged-in flag (in-memory token + refresh cookie)
  for (let i = 0; i < 24; i += 1) {
    const ok = await pg
      .evaluate(() => localStorage.getItem('choosify_is_logged_in') === 'true')
      .catch(() => false);
    if (ok) break;
    await pg.waitForTimeout(500);
  }
  await pg.waitForTimeout(1500);
}

async function adminSurface(ctx: BrowserContext, email: string, route: string, name: string) {
  const pg = await ctx.newPage();
  await loginAdmin(pg, email);
  await goto(pg, `${ADMIN}${route}`);
  await pg.waitForTimeout(3200);
  await shot(pg, name);
  await pg.close();
}

async function main() {
  await healthy();
  const browser = await chromium
    .launch({ headless: !process.env.HEADED, channel: 'chrome' })
    .catch(() => chromium.launch({ headless: true }));

  // ---------- Storefront ----------
  const webDesk = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const wp = await webDesk.newPage();
  await goto(wp, `${WEB}/`);
  await wp.waitForTimeout(4000);
  await shot(wp, 'web-01-home-desktop');
  // footer
  await wp.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await wp.waitForTimeout(1500);
  await shot(wp, 'web-02-footer', false);
  // product detail — first product card from the products listing
  await goto(wp, `${WEB}/products`);
  await wp.waitForTimeout(3500);
  await shot(wp, 'web-03-products-listing', false);
  // deterministic product detail — resolve an id from the catalog API
  let pid = '';
  try {
    const r = await fetch(`${ADMIN}/api/v1/catalog/products?limit=12`);
    const j = await r.json();
    pid = String((j.data || j.items || [])[0]?.id || (j.data || [])[0]?.slug || '');
  } catch { /* best effort */ }
  if (pid) {
    await goto(wp, `${WEB}/products/${encodeURIComponent(pid)}`);
    await wp.waitForTimeout(4500);
    await shot(wp, 'web-04-product-detail');
  }
  await wp.close();

  // buyer inbox (compact toolbar must stay compact)
  const buyerCtx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const bp = await buyerCtx.newPage();
  await loginWeb(bp, 'consumer@choosify.com.bd');
  await goto(bp, `${WEB}/messages`);
  await bp.waitForTimeout(3500);
  await shot(bp, 'web-05-buyer-inbox');
  await bp.close();
  await buyerCtx.close();

  // home mobile
  const webMob = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 2 });
  const mp = await webMob.newPage();
  await goto(mp, `${WEB}/`);
  await mp.waitForTimeout(4000);
  await shot(mp, 'web-06-home-mobile');
  await mp.close();
  await webMob.close();
  await webDesk.close();

  // ---------- Admin ----------
  const a = await browser.newContext({ viewport: { width: 1560, height: 1000 } });
  await adminSurface(a, 'admin@choosify.com.bd', '/admin/dashboard', 'admin-01-dashboard');
  await adminSurface(a, 'admin@choosify.com.bd', '/admin/messages', 'admin-02-crm-messages');
  await a.close();

  const s = await browser.newContext({ viewport: { width: 1560, height: 1000 } });
  await adminSurface(s, 'seller@choosify.com.bd', '/admin/dashboard', 'admin-03-seller-dashboard');
  await adminSurface(s, 'seller@choosify.com.bd', '/admin/products', 'admin-04-product-studio');
  await adminSurface(s, 'seller@choosify.com.bd', '/admin/orders-overview', 'admin-05-seller-order-hub');
  await adminSurface(s, 'seller@choosify.com.bd', '/admin/conversations', 'admin-06-seller-my-customers');
  await s.close();

  const c = await browser.newContext({ viewport: { width: 1560, height: 1000 } });
  await adminSurface(c, 'creator@choosify.com.bd', '/admin/dashboard', 'admin-07-creator-dashboard');
  await c.close();

  await browser.close();
  console.log(`\n=== ${done.length} screenshots → ${SHOTS} ===`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
