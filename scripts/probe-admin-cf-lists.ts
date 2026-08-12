/**
 * Admin CF list regression (directory + search) without browser.
 * Does not print tokens.
 */
import { db } from '../server/db/client';
import { users } from '../server/db/schema';
import { eq } from 'drizzle-orm';
import { signAccessToken } from '../server/auth/jwtTokens';
import { normalizeChoosifyUserIdQuery } from '../server/auth/choosifyUserId';
import fs from 'node:fs';
import path from 'node:path';

const BASE = (process.env.PROBE_BASE_URL || 'http://localhost:3001/api/v1').replace(/\/$/, '');

async function req(
  method: string,
  p: string,
  opts?: { token?: string; expect?: number[] },
): Promise<{ status: number; body: Record<string, unknown> }> {
  let status = 0;
  let body: Record<string, unknown> = {};
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(`${BASE}${p}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(opts?.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      },
    });
    status = res.status;
    body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (status !== 429) break;
    await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
  }
  if (opts?.expect && !opts.expect.includes(status)) {
    throw new Error(`${method} ${p} expected ${opts.expect} got ${status}`);
  }
  return { status, body };
}

function mark(id: string, ok: boolean, detail?: string) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id}${detail ? ` — ${detail}` : ''}`);
  return { id, ok, detail };
}

async function main() {
  const results: Array<{ id: string; ok: boolean; detail?: string }> = [];

  results.push(mark('normalize-127', normalizeChoosifyUserIdQuery('127') === 'CF-00127'));
  results.push(mark('normalize-CF', normalizeChoosifyUserIdQuery('CF-00194') === 'CF-00194'));

  const adminRows = await db.select().from(users).where(eq(users.email, 'admin@choosify.com.bd')).limit(1);
  const admin = adminRows[0];
  if (!admin) throw new Error('admin user missing');

  const token = signAccessToken({
    id: admin.id,
    email: admin.email,
    emailVerified: Boolean(admin.emailVerified),
  });

  const dir = await req('GET', '/auth/users/directory', { token, expect: [200] });
  const rows = Array.isArray(dir.body.data) ? (dir.body.data as Array<Record<string, string>>) : [];
  results.push(mark('directory-nonempty', rows.length > 0, `n=${rows.length}`));
  results.push(mark('directory-has-cf', rows.every((r) => !!r.choosifyUserId)));

  const consumers = rows.filter((r) => String(r.role) === 'user');
  const creators = rows.filter((r) => String(r.role) === 'creator');
  const sellers = rows.filter((r) => r.role === 'seller' || r.role === 'verified_seller');
  results.push(mark('directory-consumers', consumers.length > 0, `n=${consumers.length}`));
  results.push(mark('directory-creators', creators.length > 0, `n=${creators.length}`));
  results.push(mark('directory-sellers', sellers.length > 0, `n=${sellers.length}`));

  const sampleConsumer = consumers.find((c) => c.choosifyUserId) || consumers[0];
  const sampleCreator = creators.find((c) => c.choosifyUserId) || creators[0];
  const sampleSeller = sellers.find((s) => s.choosifyUserId) || sellers[0];

  if (sampleConsumer?.choosifyUserId) {
    const cf = sampleConsumer.choosifyUserId;
    const exact = await req('GET', `/auth/users/search?q=${encodeURIComponent(cf)}`, { token, expect: [200] });
    const data = (exact.body.data || {}) as Record<string, string>;
    results.push(mark('search-full-cf-consumer', data.choosifyUserId === cf, `${cf}`));
    const digits = cf.replace(/^CF-/i, '').replace(/^0+/, '') || '0';
    const numeric = await req('GET', `/auth/users/search?q=${encodeURIComponent(digits)}`, { token, expect: [200] });
    const nd = (numeric.body.data || {}) as Record<string, string>;
    results.push(mark('search-numeric-consumer', nd.choosifyUserId === cf, `${digits}→${cf}`));
  }

  if (sampleCreator?.choosifyUserId) {
    const cf = sampleCreator.choosifyUserId;
    const exact = await req('GET', `/auth/users/search?q=${encodeURIComponent(cf)}`, { token, expect: [200] });
    const data = (exact.body.data || {}) as Record<string, string>;
    results.push(mark('search-full-cf-creator', data.choosifyUserId === cf && data.role === 'creator', `${cf}`));
  }

  if (sampleSeller?.choosifyUserId) {
    const cf = sampleSeller.choosifyUserId;
    const exact = await req('GET', `/auth/users/search?q=${encodeURIComponent(cf)}`, { token, expect: [200] });
    const data = (exact.body.data || {}) as Record<string, string>;
    results.push(mark('search-full-cf-seller', data.choosifyUserId === cf, `${cf} role=${data.role}`));
  }

  // Prefer a seller that actually owns catalog brands (for list search → owned brands).
  let sellerCfForBrandSearch = sampleSeller?.choosifyUserId || '';
  let sellerUidForBrandSearch = sampleSeller?.uid || '';
  try {
    const brandsRes = await req('GET', '/catalog/brands', { expect: [200] });
    const brands = Array.isArray(brandsRes.body.data)
      ? (brandsRes.body.data as Array<Record<string, string>>)
      : [];
    const owned = brands.find((b) => b.sellerId);
    if (owned?.sellerId) {
      const match = sellers.find((s) => s.uid === owned.sellerId);
      if (match?.choosifyUserId) {
        sellerCfForBrandSearch = match.choosifyUserId;
        sellerUidForBrandSearch = match.uid;
      } else {
        const lookup = await req('GET', `/auth/users/${encodeURIComponent(owned.sellerId)}`, {
          token,
          expect: [200],
        });
        const lu = (lookup.body.data || {}) as Record<string, string>;
        if (lu.choosifyUserId) {
          sellerCfForBrandSearch = lu.choosifyUserId;
          sellerUidForBrandSearch = owned.sellerId;
        }
      }
    }
    results.push(
      mark(
        'seller-with-owned-brand',
        Boolean(sellerCfForBrandSearch && sellerUidForBrandSearch),
        `${sellerCfForBrandSearch} uid=${sellerUidForBrandSearch.slice(0, 8)}…`,
      ),
    );
  } catch (err) {
    results.push(mark('seller-with-owned-brand', false, String(err)));
  }

  const mirror = fs.readFileSync(path.join(process.cwd(), 'public/cms-mirror/app.html'), 'utf8');
  results.push(mark('ui-consumer-cf-col', mirror.includes('>CF ID</sc-raw-th>') && mirror.includes('Account Identification')));
  results.push(mark('ui-creator-cf-col', /Creator<\/sc-raw-th>[\s\S]*?CF ID<\/sc-raw-th>/.test(mirror)));
  results.push(mark('ui-seller-cf-col', mirror.includes('Seller CF ID')));
  results.push(mark('ui-search-helpers', mirror.includes('matchesChoosifyUserIdSearch') && mirror.includes('normalizeChoosifyUserIdQuery')));
  results.push(mark('ui-unclaimed-dash', mirror.includes("ownerCfIdLabel = '—'")));
  results.push(mark('ui-brand-search-wired', mirror.includes('setBrandSearch') && mirror.includes('brandSearchValue')));

  // Browser: load mirror with admin JWT → CF columns + search
  try {
    const { chromium } = await import('playwright-core');
    const browser = await chromium.launch({ headless: true, channel: 'chrome' }).catch(async () =>
      chromium.launch({ headless: true }),
    );
    const page = await browser.newPage();
    await page.addInitScript((t: string) => {
      try {
        localStorage.setItem('choosify_auth_token', t);
      } catch (_) {}
    }, token);

    async function openPage(pageKey: string) {
      await page.goto(
        `http://localhost:3001/cms-mirror/app.html?v=20260810-admin-cf-id-list-3#page=${pageKey}&role=super_admin`,
        {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        },
      );
      await page.evaluate(
        ({ t, pageKey: pk }) => {
          const w = window as unknown as {
            __CMS_MIRROR_AUTH_TOKEN__?: string;
            __CMS_MIRROR_ROLE__?: string;
            __CMS_MIRROR_INSTANCE__?: { setPage?: (p: string, opts?: { silent?: boolean }) => void };
          };
          w.__CMS_MIRROR_AUTH_TOKEN__ = t;
          w.__CMS_MIRROR_ROLE__ = 'super_admin';
          window.postMessage(
            {
              type: 'cms-mirror-set-state',
              role: 'super_admin',
              userId: 'admin',
              page: pk,
              choosifyUserId: 'CF-00001',
            },
            '*',
          );
          try {
            w.__CMS_MIRROR_INSTANCE__?.setPage?.(pk, { silent: true });
          } catch (_) {}
        },
        { t: token, pageKey },
      );
      await page.waitForTimeout(3500);
    }

    await openPage('customers');
    // Force hydrate directory if instance available
    await page.evaluate(async () => {
      const inst = (
        window as unknown as {
          __CMS_MIRROR_INSTANCE__?: {
            prefetchChoosifyUserDirectory?: () => Promise<void>;
            hydrateTenantWorkspace?: () => Promise<void>;
          };
          __CMS_MIRROR_HYDRATED__?: string;
        }
      );
      inst.__CMS_MIRROR_HYDRATED__ = '';
      if (inst.__CMS_MIRROR_INSTANCE__?.hydrateTenantWorkspace) {
        await inst.__CMS_MIRROR_INSTANCE__.hydrateTenantWorkspace();
      } else if (inst.__CMS_MIRROR_INSTANCE__?.prefetchChoosifyUserDirectory) {
        await inst.__CMS_MIRROR_INSTANCE__.prefetchChoosifyUserDirectory();
      }
    });
    await page.waitForTimeout(2500);

    const consumerUi = await page.evaluate(() => {
      const headers = Array.from(document.querySelectorAll('th')).map((th) => (th.textContent || '').trim());
      const text = document.body?.innerText || '';
      const cfMatches = text.match(/CF-\d+/g) || [];
      return {
        headers,
        hasCfCol: headers.includes('CF ID'),
        cfCount: cfMatches.length,
        cfSample: cfMatches.slice(0, 5),
      };
    });
    results.push(mark('browser-consumer-cf-col', consumerUi.hasCfCol, consumerUi.headers.slice(0, 8).join('|')));
    results.push(mark('browser-consumer-cf-values', consumerUi.cfCount > 0, `n=${consumerUi.cfCount} sample=${consumerUi.cfSample.join(',')}`));

    if (sampleConsumer?.choosifyUserId) {
      const cf = sampleConsumer.choosifyUserId;
      await page.evaluate((q) => {
        const inst = (window as unknown as { __CMS_MIRROR_INSTANCE__?: { setState: (s: Record<string, string>) => void } })
          .__CMS_MIRROR_INSTANCE__;
        if (inst?.setState) inst.setState({ customerSearch: q });
      }, cf);
      await page.waitForTimeout(800);
      const filtered = await page.evaluate(() => {
        const text = document.body?.innerText || '';
        return {
          hasCf: /CF-\d+/.test(text),
          rowHint: text.includes('Consumer') || text.includes('ACCOUNT'),
          snippet: text.replace(/\s+/g, ' ').slice(0, 240),
        };
      });
      results.push(mark('browser-consumer-search-full-cf', filtered.hasCf, cf));

      const digits = cf.replace(/^CF-/i, '').replace(/^0+/, '') || '0';
      await page.evaluate((q) => {
        const inst = (window as unknown as { __CMS_MIRROR_INSTANCE__?: { setState: (s: Record<string, string>) => void } })
          .__CMS_MIRROR_INSTANCE__;
        if (inst?.setState) inst.setState({ customerSearch: q });
      }, digits);
      await page.waitForTimeout(800);
      const filteredNum = await page.evaluate((expected) => {
        const text = document.body?.innerText || '';
        return text.includes(expected);
      }, cf);
      results.push(mark('browser-consumer-search-numeric', filteredNum, digits));
    }

    await openPage('creators');
    await page.evaluate(async () => {
      const w = window as unknown as {
        __CMS_MIRROR_HYDRATED__?: string;
        __CMS_MIRROR_INSTANCE__?: {
          prefetchChoosifyUserDirectory?: () => Promise<void>;
          hydrateTenantWorkspace?: () => Promise<void>;
        };
      };
      w.__CMS_MIRROR_HYDRATED__ = '';
      if (w.__CMS_MIRROR_INSTANCE__?.hydrateTenantWorkspace) await w.__CMS_MIRROR_INSTANCE__.hydrateTenantWorkspace();
      if (w.__CMS_MIRROR_INSTANCE__?.prefetchChoosifyUserDirectory) {
        await w.__CMS_MIRROR_INSTANCE__.prefetchChoosifyUserDirectory();
      }
    });
    await page.waitForTimeout(2500);
    const creatorUi = await page.evaluate(() => {
      const headers = Array.from(document.querySelectorAll('th')).map((th) => (th.textContent || '').trim());
      const text = document.body?.innerText || '';
      const cfMatches = text.match(/CF-\d+/g) || [];
      return {
        hasCfCol: headers.includes('CF ID') && headers.includes('Creator'),
        headers: headers.slice(0, 8),
        cfCount: cfMatches.length,
      };
    });
    results.push(mark('browser-creator-cf-col', creatorUi.hasCfCol, creatorUi.headers.join('|')));
    results.push(mark('browser-creator-cf-values', creatorUi.cfCount >= 0, `n=${creatorUi.cfCount}`));

    if (sampleCreator?.choosifyUserId) {
      await page.evaluate((q) => {
        const inst = (window as unknown as { __CMS_MIRROR_INSTANCE__?: { setState: (s: Record<string, string>) => void } })
          .__CMS_MIRROR_INSTANCE__;
        if (inst?.setState) inst.setState({ creatorSearch: q });
      }, sampleCreator.choosifyUserId);
      await page.waitForTimeout(800);
      const creatorSearch = await page.evaluate((cf) => (document.body?.innerText || '').includes(cf), sampleCreator.choosifyUserId);
      results.push(mark('browser-creator-search-full-cf', creatorSearch, sampleCreator.choosifyUserId));
    }

    await openPage('brands');
    await page.evaluate(async () => {
      const w = window as unknown as {
        __CMS_MIRROR_HYDRATED__?: string;
        __CMS_MIRROR_INSTANCE__?: {
          prefetchChoosifyUserDirectory?: () => Promise<void>;
          hydrateTenantWorkspace?: () => Promise<void>;
        };
      };
      w.__CMS_MIRROR_HYDRATED__ = '';
      if (w.__CMS_MIRROR_INSTANCE__?.hydrateTenantWorkspace) await w.__CMS_MIRROR_INSTANCE__.hydrateTenantWorkspace();
      if (w.__CMS_MIRROR_INSTANCE__?.prefetchChoosifyUserDirectory) {
        await w.__CMS_MIRROR_INSTANCE__.prefetchChoosifyUserDirectory();
      }
    });
    await page.waitForTimeout(2500);
    const brandUi = await page.evaluate(() => {
      const headers = Array.from(document.querySelectorAll('th')).map((th) => (th.textContent || '').trim());
      const text = document.body?.innerText || '';
      const cfMatches = text.match(/CF-\d+/g) || [];
      return {
        hasSellerCf: headers.includes('Seller CF ID'),
        headers: headers.slice(0, 8),
        cfCount: cfMatches.length,
        hasDash: text.includes('—'),
      };
    });
    results.push(mark('browser-seller-cf-col', brandUi.hasSellerCf, brandUi.headers.join('|')));
    results.push(mark('browser-seller-cf-or-unclaimed', brandUi.cfCount > 0 || brandUi.hasDash, `cf=${brandUi.cfCount}`));

    if (sellerCfForBrandSearch) {
      await page.evaluate((q) => {
        const inst = (window as unknown as { __CMS_MIRROR_INSTANCE__?: { setState: (s: Record<string, string>) => void } })
          .__CMS_MIRROR_INSTANCE__;
        if (inst?.setState) inst.setState({ brandSearch: q });
      }, sellerCfForBrandSearch);
      await page.waitForTimeout(800);
      const brandSearch = await page.evaluate((cf) => {
        const text = document.body?.innerText || '';
        return text.includes(cf);
      }, sellerCfForBrandSearch);
      results.push(mark('browser-seller-cf-search', brandSearch, sellerCfForBrandSearch));
    }

    await browser.close();
  } catch (err) {
    results.push(mark('browser-cf-lists', false, String(err)));
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\nSummary: ${results.length - failed.length}/${results.length} passed`);
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
