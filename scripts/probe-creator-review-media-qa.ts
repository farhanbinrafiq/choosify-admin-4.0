/**
 * Creator Review media player QA — platform detection, orientation, inline
 * playback, double-navigation fix.
 *
 * Creates a synthetic product with creatorContent covering a YouTube regular
 * video, a YouTube Short, a TikTok video and an Instagram Reel, then drives
 * the real Product Details page.
 *
 * Usage: npx tsx scripts/probe-creator-review-media-qa.ts
 */
import { chromium } from 'playwright-core';
import { mkdirSync } from 'fs';
import { join } from 'path';

const API_BASE = process.env.PROBE_API_BASE || 'http://localhost:3001';
const WEB_BASE = process.env.PROBE_WEB_BASE || 'http://localhost:5173';
const PW = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';
const OUT = join(process.cwd(), 'scripts', '_tmp_creator-review-qa');
mkdirSync(OUT, { recursive: true });
const RID = Date.now();

async function api(path: string, init: RequestInit, token?: string) {
  const r = await fetch(`${API_BASE}/api/v1${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers || {}) },
  });
  return { status: r.status, body: (await r.json().catch(() => ({}))) as any };
}

async function main() {
  const seller = (await api('/auth/login', { method: 'POST', body: JSON.stringify({ email: 'seller@choosify.com.bd', password: PW }) })).body;
  if (!seller.accessToken) throw new Error('seller login failed');

  const brands = (await api('/catalog/brands', { method: 'GET' }, seller.accessToken)).body;
  const ownBrand = (brands.data || []).find((b: any) => b.sellerId === seller.uid);
  if (!ownBrand) throw new Error('seller has no own brand to attach a product to');
  console.log('using brand:', ownBrand.id);

  const created = await api('/catalog/products', {
    method: 'POST',
    body: JSON.stringify({
      title: `Creator Review QA Product ${RID}`,
      brandId: ownBrand.id,
      categoryId: 'cat-mobile',
      category: 'Mobile & Phones',
      price: 1999,
      description: 'QA product for creator review media player',
      image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800&q=80',
      stock: 10,
    }),
  }, seller.accessToken);
  if (created.status !== 200 && created.status !== 201) throw new Error(`create product failed: ${created.status} ${JSON.stringify(created.body)}`);
  const productId: string = created.body?.data?.id || created.body?.id;
  console.log('created product:', productId);

  const creatorContent = [
    {
      id: 'cc-yt-regular',
      platform: 'YouTube', // deliberately a manual label, must be IGNORED for detection
      videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      thumbnail: '',
      title: 'YouTube regular review',
      creatorHandle: '@qa_creator',
      views: '12K views',
    },
    {
      id: 'cc-yt-short',
      platform: 'YouTube', // same manual label as the regular video, on purpose —
      // proves detection comes from the URL (/shorts/), not this field.
      videoUrl: 'https://www.youtube.com/shorts/dQw4w9WgXcQ',
      thumbnail: '',
      title: 'YouTube Shorts review',
      creatorHandle: '@qa_creator',
      views: '8K views',
    },
    {
      id: 'cc-tiktok',
      platform: 'Other',
      videoUrl: 'https://www.tiktok.com/@qa_creator/video/7123456789012345678',
      thumbnail: '',
      title: 'TikTok review',
      creatorHandle: '@qa_creator',
      views: '3K views',
    },
    {
      id: 'cc-ig-reel',
      platform: 'Other',
      videoUrl: 'https://www.instagram.com/reel/C1AbcDEfGhI/',
      thumbnail: '',
      title: 'Instagram Reel review',
      creatorHandle: '@qa_creator',
      views: '5K views',
    },
  ];

  const activated = await api(`/catalog/products/${productId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'active' }),
  }, seller.accessToken);
  console.log('activate product status:', activated.status);

  const patched = await api(`/catalog/product-details/${productId}`, {
    method: 'PUT',
    body: JSON.stringify({ creatorContent }),
  }, seller.accessToken);
  if (patched.status !== 200) throw new Error(`put product-details failed: ${patched.status} ${JSON.stringify(patched.body)}`);
  console.log('creatorContent saved:', (patched.body?.creatorContent || []).length, 'items');

  // ---- Browser QA ----
  const browser = await chromium.launch({ headless: true, channel: 'chrome' }).catch(() => chromium.launch({ headless: true }));
  const context = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  const page = await context.newPage();
  page.on('pageerror', (e) => console.log('pageerror:', String(e).slice(0, 200)));

  const popupPromise = context.waitForEvent('page', { timeout: 8000 }).catch(() => null);

  await page.goto(`${WEB_BASE}/products/${productId}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);
  await page.locator('#product-creator-reviews, [id*="creator-reviews"]').first().scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(1000);
  await page.screenshot({ path: join(OUT, '1-product-page-reviews-section.png'), fullPage: false });

  const badges = await page.evaluate(() => {
    const section = document.querySelector('#influencer-reviews-section');
    if (!section) return [];
    return Array.from(section.querySelectorAll('span')).map((s) => (s.textContent || '').trim()).filter(Boolean).slice(0, 20);
  });
  console.log('badges/labels found in reviews section:', JSON.stringify(badges));

  const urlBeforeClick = page.url();

  // Click the first review's PLAY button (the VideoEmbedCard clickable
  // thumbnail wrapper) — must NOT navigate the page and must NOT open a new
  // tab.
  const firstCard = page.locator('#influencer-reviews-section .cursor-pointer').first();
  await firstCard.click({ timeout: 8000, force: true }).catch((e) => console.log('click error:', String(e).slice(0, 200)));
  await page.waitForTimeout(2500);
  await page.screenshot({ path: join(OUT, '2-after-play-click.png'), fullPage: false });

  const urlAfterClick = page.url();
  console.log('A1: URL unchanged after Play click (no accidental navigation)?', urlBeforeClick === urlAfterClick, urlBeforeClick, '->', urlAfterClick);

  const popupAfterPlay = await Promise.race([popupPromise, new Promise((r) => setTimeout(() => r(null), 1500))]);
  console.log('A2: no new tab/window opened by Play click?', !popupAfterPlay);

  const iframePresent = await page.evaluate(() => Boolean(document.querySelector('#influencer-reviews-section iframe')));
  console.log('A3: an inline iframe player is now present?', iframePresent);

  // Click "Open on <Platform>" — must open a NEW tab, and must NOT navigate
  // the current page.
  const openOnPopupPromise = context.waitForEvent('page', { timeout: 8000 }).catch(() => null);
  const openOnLink = page.locator('#influencer-reviews-section a[target="_blank"]').first();
  await openOnLink.click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const popupFromOpenOn = await openOnPopupPromise;
  console.log('B1: "Open on Platform" opened a new tab?', Boolean(popupFromOpenOn));
  console.log('B2: current page URL unchanged after "Open on Platform"?', page.url() === urlAfterClick);
  if (popupFromOpenOn) {
    console.log('B3: new tab points at the external platform URL?', popupFromOpenOn.url());
    await popupFromOpenOn.close().catch(() => {});
  }

  await page.screenshot({ path: join(OUT, '3-final-state.png'), fullPage: true });

  await browser.close();
  console.log('screens written to', OUT);
  console.log('product id (for manual re-check):', productId);
}

main().catch((e) => { console.error(e); process.exit(1); });
