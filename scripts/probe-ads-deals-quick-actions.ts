/**
 * Ads & Deals landing quick actions + Hero media static/browser checks.
 */
import fs from 'node:fs';
import { chromium } from 'playwright-core';
import { eq } from 'drizzle-orm';
import { db } from '../server/db/client';
import { users } from '../server/db/schema';
import { signAccessToken } from '../server/auth/jwtTokens';
import { inferHeroMediaType } from '../shared/ads/heroMedia';

const results: Array<{ id: string; ok: boolean; detail?: string }> = [];
const mark = (id: string, ok: boolean, detail?: string) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id}${detail ? ` — ${detail}` : ''}`);
};

function staticChecks() {
  const mirror = fs.readFileSync('public/cms-mirror/app.html', 'utf8');
  const host = fs.readFileSync('src/cms-mirror/CmsMirrorHost.tsx', 'utf8');
  const hero = fs.readFileSync('src/components/ads/storefront/HeroBannerAd.tsx', 'utf8');
  const builder = fs.readFileSync('src/pages/admin/AdsVisualBuilder.tsx', 'utf8');
  const list = fs.readFileSync('src/pages/admin/BannerDirectAdsStudio.tsx', 'utf8');
  const svc = fs.readFileSync('server/ads/adsService.ts', 'utf8');
  const app = fs.readFileSync('src/App.tsx', 'utf8');

  mark(
    'landing-header-create',
    /Ads &amp; Deals Management Studio[\s\S]{0,900}openAdsVisualBuilder/.test(mirror),
  );
  mark('landing-header-manage', mirror.includes('adsManageBannersLabel'));
  mark(
    'role-manage-labels',
    mirror.includes('Manage My Ads') && mirror.includes('Manage Banner / Direct Ads'),
  );
  mark('placements-tab-kept', mirror.includes('isPlacementsTab'));
  mark(
    'same-routes',
    mirror.includes('/admin/ads-studio/new') && mirror.includes("path: '/admin/ads-studio'"),
  );
  mark('asset-bump', host.includes('20260810-ads-deals-quick-actions-1'));
  mark(
    'hero-video-behavior',
    hero.includes('<video') &&
      hero.includes('autoPlay') &&
      hero.includes('muted') &&
      hero.includes('loop') &&
      hero.includes('playsInline') &&
      hero.includes('controls={false}'),
  );
  mark('hero-img-object-cover', hero.includes('<img') && hero.includes('object-cover'));
  mark('builder-creative-type', builder.includes('Creative Type') && builder.includes("'gif'"));
  mark('builder-hosted-video-url', builder.includes('videoUrl') && builder.includes('hosted mp4'));
  mark('list-media-chip', list.includes('mediaLabel'));
  mark('server-media-normalize', svc.includes('normalizeCreativeMedia'));
  mark('single-builder-component', fs.existsSync('src/pages/admin/AdsVisualBuilder.tsx'));
  mark('app-uses-same-builder', app.includes("import('./pages/admin/AdsVisualBuilder')"));
  mark('infer-gif', inferHeroMediaType('https://cdn.example/a.gif') === 'gif');
  mark('infer-video', inferHeroMediaType('https://cdn.example/a.mp4') === 'video');
}

async function browserChecks() {
  const admin = (
    await db.select().from(users).where(eq(users.email, 'admin@choosify.com.bd')).limit(1)
  )[0];
  if (!admin) {
    mark('browser-admin-user', false, 'missing');
    return;
  }
  const token = signAccessToken({
    id: admin.id,
    email: admin.email,
    emailVerified: Boolean(admin.emailVerified),
  });

  let browser;
  try {
    browser = await chromium.launch({ headless: true, channel: 'chrome' }).catch(async () =>
      chromium.launch({ headless: true }),
    );
  } catch (err) {
    mark('browser-launch', false, String(err));
    return;
  }

  const page = await browser.newPage();
  await page.addInitScript((t: string) => {
    localStorage.setItem('choosify_auth_token', t);
    localStorage.removeItem('choosify_mock_role');
  }, token);

  await page.goto(
    'http://localhost:3001/cms-mirror/app.html?v=20260810-ads-deals-quick-actions-1#page=adsDealsStudio&role=super_admin',
    { waitUntil: 'domcontentloaded', timeout: 60000 },
  );
  await page.evaluate((t) => {
    (window as unknown as { __CMS_MIRROR_AUTH_TOKEN__?: string }).__CMS_MIRROR_AUTH_TOKEN__ = t;
    (window as unknown as { __CMS_MIRROR_ROLE__?: string }).__CMS_MIRROR_ROLE__ = 'super_admin';
    window.postMessage(
      { type: 'cms-mirror-set-state', role: 'super_admin', page: 'adsDealsStudio' },
      '*',
    );
    try {
      (
        window as unknown as {
          __CMS_MIRROR_INSTANCE__?: { setPage?: (p: string, o?: { silent?: boolean }) => void };
        }
      ).__CMS_MIRROR_INSTANCE__?.setPage?.('adsDealsStudio', { silent: true });
    } catch {
      /* ignore */
    }
  }, token);
  await page.waitForTimeout(2500);

  const landing = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button')).map((b) =>
      (b.textContent || '').trim(),
    );
    const text = document.body?.innerText || '';
    return {
      hasCreate: buttons.some((b) => b.includes('+ Create Ad')),
      hasManage: buttons.some((b) => b.includes('Manage Banner / Direct Ads')),
      createBeforePromo:
        text.indexOf('+ Create Ad') > -1 &&
        text.indexOf('Promotion Requests') > -1 &&
        text.indexOf('+ Create Ad') < text.indexOf('Promotion Requests'),
    };
  });
  mark('browser-landing-create', landing.hasCreate);
  mark('browser-landing-manage', landing.hasManage);
  mark('browser-actions-above-tabs', landing.createBeforePromo);

  await page.evaluate(() => {
    (window as unknown as { __CMS_MIRROR_ROLE__?: string }).__CMS_MIRROR_ROLE__ = 'seller';
    try {
      (
        window as unknown as { __CMS_MIRROR_INSTANCE__?: { setState?: (s: object) => void } }
      ).__CMS_MIRROR_INSTANCE__?.setState?.({});
    } catch {
      /* ignore */
    }
  });
  await page.waitForTimeout(1200);
  const seller = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button')).map((b) =>
      (b.textContent || '').trim(),
    );
    return {
      hasCreate: buttons.some((b) => b.includes('+ Create Ad')),
      hasMine: buttons.some((b) => b.includes('Manage My Ads')),
    };
  });
  mark('browser-seller-create', seller.hasCreate);
  mark('browser-seller-manage-mine', seller.hasMine);

  await page.goto('http://localhost:3001/admin/ads-studio/new', {
    waitUntil: 'domcontentloaded',
    timeout: 90000,
  });
  for (let i = 0; i < 40; i++) {
    const ready = await page.evaluate(() => {
      const text = document.body?.innerText || '';
      return /Create Ad Creative|Hero Banner/i.test(text) && !/AUTHENTICATING/i.test(text);
    });
    if (ready) break;
    await page.waitForTimeout(500);
  }
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) =>
      /Hero Banner/i.test(b.textContent || ''),
    );
    btn?.click();
  });
  await page.waitForTimeout(700);
  const builder = await page.evaluate(() => {
    const text = document.body?.innerText || '';
    return {
      authenticating: /AUTHENTICATING/i.test(text),
      hasCreativeType: /Creative Type/i.test(text),
      hasGif: /\bGIF\b/.test(text),
      hasVideo: /\bVideo\b/.test(text),
      hasImage: /\bImage\b/.test(text),
    };
  });
  mark(
    'browser-builder-media-types',
    !builder.authenticating && builder.hasCreativeType && builder.hasGif && builder.hasVideo,
    JSON.stringify(builder),
  );

  await browser.close();
}

async function main() {
  staticChecks();
  try {
    await browserChecks();
  } catch (err) {
    mark('browser-checks', false, String(err));
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\nSummary: ${results.length - failed.length}/${results.length} passed`);
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
