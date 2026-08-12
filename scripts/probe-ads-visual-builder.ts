/**
 * Banner / Direct Ads Visual Builder probe — format×placement, RBAC, URL safety.
 * Requires running server (PROBE_BASE_URL).
 */
import { randomBytes } from 'node:crypto';

const BASE = (process.env.PROBE_BASE_URL || 'http://localhost:3001/api/v1').replace(/\/$/, '');
const ADMIN_EMAIL = process.env.PROBE_ADMIN_EMAIL || 'admin@choosify.com.bd';
const ADMIN_PASS = process.env.DEV_SEED_PASSWORD || process.env.PROBE_ADMIN_PASSWORD || 'ChoosifyDev!2026';

type Json = Record<string, unknown>;

async function req(
  method: string,
  path: string,
  opts?: { token?: string; body?: unknown; expect?: number[] },
): Promise<{ status: number; body: Json }> {
  let lastStatus = 0;
  let body: Json = {};
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(opts?.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      },
      body: opts?.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    lastStatus = res.status;
    body = (await res.json().catch(() => ({}))) as Json;
    if (res.status !== 429) break;
    await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
  }
  if (opts?.expect && !opts.expect.includes(lastStatus)) {
    throw new Error(`${method} ${path} expected ${opts.expect.join('|')} got ${lastStatus}: ${JSON.stringify(body)}`);
  }
  return { status: lastStatus, body };
}

async function login(email: string, password: string) {
  const res = await req('POST', '/auth/login', {
    body: { email, password },
    expect: [200],
  });
  const data = (res.body.data as Json) || res.body;
  const token = String(
    data.accessToken || data.token || res.body.accessToken || res.body.token || '',
  );
  const user = (data.user as Json) || data;
  if (!token) throw new Error(`no token for ${email}`);
  return {
    token,
    userId: String(user.uid || user.id || user.userId || res.body.uid || ''),
    role: String(user.role || ''),
  };
}

const results: Array<{ id: string; ok: boolean; detail?: string }> = [];
function mark(id: string, ok: boolean, detail?: string) {
  results.push({ id, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id}${detail ? ` — ${detail}` : ''}`);
}

const FORMATS = [
  { formatId: 'hero_banner', placementId: 'HOME_HERO', pageKey: 'homepage' },
  { formatId: 'vertical_card', placementId: 'HOME_RIGHT_RAIL', pageKey: 'homepage' },
  { formatId: 'gradient_promo', placementId: 'BROWSE_SIDEBAR', pageKey: 'browse' },
  { formatId: 'deal_of_the_day', placementId: 'DEALS_FEATURED', pageKey: 'deals' },
  { formatId: 'follow_brands_banner', placementId: 'HOME_FOLLOW_BRANDS', pageKey: 'homepage' },
  { formatId: 'category_promoted_slot', placementId: 'CATEGORY_CARD_FOOTER', pageKey: 'categories' },
] as const;

async function main() {
  const suffix = randomBytes(3).toString('hex');
  try {
    const admin = await login(ADMIN_EMAIL, ADMIN_PASS);
    mark('admin-login', true);

    const sellerEmail = `ads.seller.${suffix}@example.com`;
    const sellerPass = `AdsPass1_${suffix}`;
    const apply = await req('POST', '/auth/partner-apply', {
      body: {
        applicantType: 'seller',
        email: sellerEmail,
        password: sellerPass,
        displayName: `Ads Seller ${suffix}`,
        businessOrChannelName: `Ads Store ${suffix}`,
        phone: '01700000000',
        category: 'Fashion',
        city: 'Dhaka',
      },
      expect: [201],
    });
    mark(
      'seller-partner-apply',
      apply.status === 201 && apply.body.accessGranted === false && !apply.body.accessToken,
      `status=${apply.status}`,
    );
    const pending = await req('GET', '/operations/partner-applications?status=pending', {
      token: admin.token,
      expect: [200],
    });
    const sellerApp = ((pending.body.applications as Json[]) || []).find((a) => a.email === sellerEmail);
    if (!sellerApp?.id) throw new Error('ads seller application missing');
    await req('POST', `/operations/partner-applications/${String(sellerApp.id)}/approve`, {
      token: admin.token,
      body: { note: 'ads probe' },
      expect: [200],
    });
    const logged = await login(sellerEmail, sellerPass);
    const sellerToken = logged.token;
    const me = await req('GET', '/auth/me', { token: sellerToken, expect: [200] });
    const sellerId = String(me.body.uid || me.body.id || '');
    mark('seller-provisioned', Boolean(sellerToken && sellerId));

    let creatorToken = '';
    try {
      const creator = await login('creator@choosify.com.bd', ADMIN_PASS);
      creatorToken = creator.token;
      mark('creator-login', true);
    } catch {
      mark('creator-login', false, 'seed creator unavailable — seller RBAC still covered');
    }

    const registry = await req('GET', '/ads/placements', { token: admin.token, expect: [200] });
    const formats = ((registry.body.data as Json)?.formats as unknown[]) || [];
    const placements = ((registry.body.data as Json)?.placements as unknown[]) || [];
    mark(
      'placements-registry',
      formats.length >= 6 && placements.length >= 6,
      `formats=${formats.length} placements=${placements.length}`,
    );

    const badCombo = await req('POST', '/ads/banners', {
      token: admin.token,
      body: {
        title: `Bad combo ${suffix}`,
        formatId: 'hero_banner',
        placementId: 'CATEGORY_CARD_FOOTER',
        pageKey: 'categories',
      },
    });
    mark('invalid-format-placement-rejected', badCombo.status === 400, `status=${badCombo.status}`);

    const force = await req('POST', '/ads/banners', {
      token: sellerToken,
      body: {
        title: `Force active ${suffix}`,
        formatId: 'hero_banner',
        placementId: 'HOME_HERO',
        pageKey: 'homepage',
        publishNow: true,
        creative: { headline: 'x' },
      },
    });
    mark('seller-cannot-publish-now', force.status === 403, `status=${force.status}`);

    const pendingBanner = await req('POST', '/ads/banners', {
      token: sellerToken,
      body: {
        title: `Seller banner ${suffix}`,
        formatId: 'hero_banner',
        placementId: 'HOME_HERO',
        pageKey: 'homepage',
        creative: { headline: 'Seller hero', advertiserName: 'Seller Co' },
      },
      expect: [201],
    });
    const pendingStatus = String(((pendingBanner.body.data as Json) || {}).status || '');
    const pendingId = String(((pendingBanner.body.data as Json) || {}).id || '');
    mark('seller-banner-pending', pendingStatus === 'pending', `status=${pendingStatus}`);

    const selfApprove = await req('POST', `/ads/banners/${encodeURIComponent(pendingId)}/approve`, {
      token: sellerToken,
    });
    mark(
      'seller-cannot-approve-own',
      selfApprove.status === 401 || selfApprove.status === 403,
      `status=${selfApprove.status}`,
    );

    const restricted = await req('POST', '/ads/banners', {
      token: sellerToken,
      body: {
        title: `Follow brands seller ${suffix}`,
        formatId: 'follow_brands_banner',
        placementId: 'HOME_FOLLOW_BRANDS',
        pageKey: 'homepage',
      },
    });
    mark('seller-restricted-placement', restricted.status === 403, `status=${restricted.status}`);

    const forceStatus = await req('PATCH', `/ads/${encodeURIComponent(pendingId)}`, {
      token: sellerToken,
      body: { status: 'active' },
    });
    mark('seller-cannot-force-status', forceStatus.status === 403, `status=${forceStatus.status}`);

    const approve = await req('POST', `/ads/banners/${encodeURIComponent(pendingId)}/approve`, {
      token: admin.token,
      expect: [200],
    });
    mark('admin-approve-seller-banner', String(((approve.body.data as Json) || {}).status) === 'active');

    if (creatorToken) {
      const cBanner = await req('POST', '/ads/banners', {
        token: creatorToken,
        body: {
          title: `Creator banner ${suffix}`,
          formatId: 'vertical_card',
          placementId: 'DISCOVER_FEED',
          pageKey: 'discover',
          creative: { headline: 'Creator promo' },
        },
        expect: [201],
      });
      mark('creator-banner-pending', String(((cBanner.body.data as Json) || {}).status) === 'pending');
      const cid = String(((cBanner.body.data as Json) || {}).id || '');
      const cSelf = await req('POST', `/ads/banners/${encodeURIComponent(cid)}/approve`, {
        token: creatorToken,
      });
      mark(
        'creator-cannot-approve-own',
        cSelf.status === 401 || cSelf.status === 403,
        `status=${cSelf.status}`,
      );
    }

    // Resolve an eligible catalog category for Category Promoted Slot (authoritative source).
    let eligibleCategoryId = '';
    let eligibleCategoryName = '';
    {
      const cats = await req('GET', '/catalog/categories', { token: admin.token, expect: [200] });
      const rows = ((cats.body.data as Json[]) || cats.body || []) as Json[];
      const list = Array.isArray(rows) ? rows : [];
      const enabled = list.find((c) => c && c.enabled !== false && c.id && c.name);
      if (enabled) {
        eligibleCategoryId = String(enabled.id);
        eligibleCategoryName = String(enabled.name);
      }
      mark(
        'catalog-categories-available',
        Boolean(eligibleCategoryId),
        eligibleCategoryId ? `id=${eligibleCategoryId}` : 'no enabled categories',
      );
    }

    for (const f of FORMATS) {
      const creative: Json = {
        headline: f.formatId,
        advertiserName: 'Choosify',
        body: 'Preview body',
      };
      if (f.formatId === 'category_promoted_slot') {
        creative.categoryId = eligibleCategoryId;
        creative.hostCategoryName = 'Client Spoofed Name Should Be Overwritten';
      }
      const created = await req('POST', '/ads/banners', {
        token: admin.token,
        body: {
          title: `Admin ${f.formatId} ${suffix}`,
          formatId: f.formatId,
          placementId: f.placementId,
          pageKey: f.pageKey,
          publishNow: true,
          creative,
          cta: { label: 'Shop Now', destinationType: 'internal', internalEntityType: 'product' },
        },
      });
      const data = (created.body.data as Json) || {};
      const ok =
        created.status === 201 &&
        String(data.status) === 'active' &&
        (f.formatId !== 'category_promoted_slot' ||
          String(((data.creative as Json) || {}).categoryId || '') === eligibleCategoryId);
      mark(
        `admin-create-${f.formatId}`,
        ok,
        `status=${created.status}/${data.status}`,
      );
      if (f.formatId === 'category_promoted_slot' && created.status === 201) {
        const cr = (data.creative as Json) || {};
        mark(
          'category-promoted-persists-categoryId',
          String(cr.categoryId || '') === eligibleCategoryId,
          `categoryId=${cr.categoryId}`,
        );
        mark(
          'category-promoted-label-from-catalog',
          String(cr.categoryName || cr.hostCategoryName || '') === eligibleCategoryName,
          `label=${cr.categoryName || cr.hostCategoryName}`,
        );
      }
    }

    // Server must reject Category Promoted Slot without / with invalid categoryId.
    {
      const missing = await req('POST', '/ads/banners', {
        token: admin.token,
        body: {
          title: `Missing cat ${suffix}`,
          formatId: 'category_promoted_slot',
          placementId: 'CATEGORY_CARD_FOOTER',
          pageKey: 'categories',
          asDraft: true,
          creative: { headline: 'x', hostCategoryName: 'Travel & Hospitality' },
        },
      });
      mark(
        'category-promoted-rejects-missing-id',
        missing.status === 400,
        `status=${missing.status}`,
      );

      const bogus = await req('POST', '/ads/banners', {
        token: admin.token,
        body: {
          title: `Bogus cat ${suffix}`,
          formatId: 'category_promoted_slot',
          placementId: 'CATEGORY_CARD_FOOTER',
          pageKey: 'categories',
          asDraft: true,
          creative: { headline: 'x', categoryId: `cat_does_not_exist_${suffix}` },
        },
      });
      mark(
        'category-promoted-rejects-unknown-id',
        bogus.status === 400,
        `status=${bogus.status}`,
      );
    }

    for (const url of ['javascript:alert(1)', 'data:text/html,hi', 'file:///etc/passwd']) {
      const bad = await req('POST', '/ads/banners', {
        token: admin.token,
        body: {
          title: `unsafe ${suffix}`,
          formatId: 'hero_banner',
          placementId: 'HOME_HERO',
          pageKey: 'homepage',
          externalUrl: url,
        },
      });
      mark(`unsafe-url-${url.split(':')[0]}`, bad.status === 400, `status=${bad.status}`);
    }

    const ext = await req('POST', '/ads/banners', {
      token: admin.token,
      body: {
        title: `External ${suffix}`,
        formatId: 'hero_banner',
        placementId: 'HOME_HERO',
        pageKey: 'homepage',
        kind: 'external',
        externalUrl: 'https://example.com/offer',
        asDraft: true,
        creative: { headline: 'External' },
      },
      expect: [201],
    });
    mark('external-https-ok', String(((ext.body.data as Json) || {}).status) === 'draft');

    const list = await req('GET', '/ads/banners', { token: admin.token, expect: [200] });
    const rows = (list.body.data as Json[]) || [];
    const adminOwned = rows.find((r) => r.ownerId && r.ownerId !== sellerId && r.status === 'draft');
    if (adminOwned?.id) {
      const hijack = await req('PATCH', `/ads/${encodeURIComponent(String(adminOwned.id))}`, {
        token: sellerToken,
        body: { title: 'hijacked' },
      });
      mark('cross-owner-edit-denied', hijack.status === 403, `status=${hijack.status}`);
    } else {
      mark('cross-owner-edit-denied', true, 'skipped-no-draft');
    }

    const deal = await req('POST', '/ads/deals', {
      token: sellerToken,
      body: { title: `Deal policy ${suffix}` },
      expect: [201],
    });
    mark(
      'deals-auto-approve-preserved',
      String(((deal.body.data as Json) || {}).status) === 'active',
      `status=${((deal.body.data as Json) || {}).status}`,
    );

    {
      const fs = await import('node:fs');
      const app = fs.readFileSync('src/App.tsx', 'utf8');
      const builder = fs.readFileSync('src/pages/admin/AdsVisualBuilder.tsx', 'utf8');
      const presentation = fs.readFileSync('src/components/ads/storefront/index.tsx', 'utf8');
      const picker = fs.readFileSync('src/components/ads/CategorySearchSelect.tsx', 'utf8');
      const adsService = fs.readFileSync('server/ads/adsService.ts', 'utf8');
      mark('route-ads-studio-new', app.includes('/admin/ads-studio/new') && app.includes('AdsVisualBuilder'));
      mark('builder-uses-storefront-presentation', builder.includes('StorefrontAdPresentation'));
      mark(
        'builder-category-search-select',
        builder.includes('CategorySearchSelect') &&
          builder.includes('categoryId') &&
          !builder.includes('Host Category Name (organic card)'),
      );
      mark(
        'category-picker-uses-catalog-api',
        picker.includes('catalogApi') &&
          picker.includes('listCategories') &&
          picker.includes('No matching categories found.') &&
          !picker.includes('Create new category'),
      );
      mark(
        'server-validates-category-promoted',
        adsService.includes('resolveCategoryPromotedCreative') &&
          adsService.includes('categoryId is required for Category Promoted Slot'),
      );
      mark(
        'presentation-all-formats',
        presentation.includes('HeroBannerAd') &&
          presentation.includes('CategoryPromotedSlot') &&
          presentation.includes('DealOfTheDayAd') &&
          presentation.includes('FollowBrandsBanner'),
      );
      mark(
        'cms-create-ad-wired',
        fs.readFileSync('public/cms-mirror/app.html', 'utf8').includes('openAdsVisualBuilder'),
      );
      const mirror = fs.readFileSync('public/cms-mirror/app.html', 'utf8');
      mark(
        'cms-landing-quick-create-ad',
        mirror.includes('Ads &amp; Deals Management Studio') &&
          mirror.includes('openAdsVisualBuilder') &&
          mirror.includes('adsManageBannersLabel'),
      );
      mark(
        'cms-landing-manage-banners-label',
        mirror.includes('Manage My Ads') && mirror.includes('Manage Banner / Direct Ads'),
      );
      const hero = fs.readFileSync('src/components/ads/storefront/HeroBannerAd.tsx', 'utf8');
      mark('hero-supports-video-tag', hero.includes('<video') && hero.includes('autoPlay') && hero.includes('muted'));
      mark('hero-supports-gif-img', hero.includes('<img') && hero.includes('object-cover'));
      mark(
        'builder-hero-media-types',
        builder.includes("['image', 'gif', 'video']") || builder.includes("'gif'"),
      );
      mark(
        'hero-media-helper',
        fs.existsSync('shared/ads/heroMedia.ts') &&
          fs.readFileSync('shared/ads/heroMedia.ts', 'utf8').includes('inferHeroMediaType'),
      );
    }
  } catch (error) {
    console.error('PROBE FATAL', error);
    process.exitCode = 1;
  }

  const failed = results.filter((r) => !r.ok);
  console.log('\n--- SUMMARY ---');
  console.log(`PASS ${results.filter((r) => r.ok).length} / ${results.length}`);
  if (failed.length) {
    console.log(
      'FAILED:',
      failed.map((f) => `${f.id}${f.detail ? `(${f.detail})` : ''}`).join(', '),
    );
    process.exitCode = 1;
  }
}

main();
