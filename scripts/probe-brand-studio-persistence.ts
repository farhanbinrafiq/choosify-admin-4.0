/**
 * Brand Studio — canonical persistence regression.
 *
 * The old drawer Brand Studio only PATCHed { name, category, description, logo,
 * faq, stores, promoCodes } — so coverImage / tagline / website / socialLinks /
 * story / storyVideoUrl / overview / credentials were entered in the UI but
 * NEVER persisted (they only reached localStorage).
 *
 * This proves the inline Brand Studio's single write path
 * (`brandModelToCanonicalPatch` → PATCH /catalog/brands/:id):
 *   1. persists every canonical seller-owned field
 *   2. an unrelated section save preserves the other lists (promoCodes)
 *   3. NEVER writes platform-owned fields (verifiedStatus / claimStatus /
 *      marketplaceAccess / followers / ratings / featuredFlag / sponsoredFlag)
 *
 * Requires a running local server (:3001) + seeded dev admin.
 * Usage: npx tsx scripts/probe-brand-studio-persistence.ts
 * Or:    npm run test:brand-studio-persistence
 */
import dotenv from 'dotenv';
import { existsSync } from 'fs';
import {
  brandModelToCanonicalPatch,
  mapCatalogBrandToModel,
} from '../src/pages/admin/brandEditorModel';
import type { CatalogBrand } from '../src/types/catalog';

dotenv.config({ path: '.env' });
if (existsSync('.env.local')) dotenv.config({ path: '.env.local', override: true });

const base = process.env.PROBE_BASE_URL || 'http://localhost:3001/api/v1';
const ADMIN_EMAIL = process.env.PROBE_ADMIN_EMAIL || 'admin@choosify.com.bd';
const ADMIN_PASSWORD =
  process.env.PROBE_ADMIN_PASSWORD || process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';

let failed = 0;
function assert(cond: boolean, label: string, detail?: unknown) {
  if (cond) console.log('PASS', label);
  else {
    failed += 1;
    console.log('FAIL', label, detail ?? '');
  }
}
const j = (r: Response) => r.json().catch(() => ({}));

async function main() {
  console.log('=== Brand Studio persistence probe ===');
  const login = (await j(
    await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    }),
  )) as { accessToken?: string };
  if (!login.accessToken) throw new Error('admin login failed');
  const H = { Authorization: `Bearer ${login.accessToken}`, 'Content-Type': 'application/json' };

  // throwaway brand
  const created = (await j(
    await fetch(`${base}/catalog/brands`, {
      method: 'POST',
      headers: H,
      body: JSON.stringify({ name: `Probe Brand ${Date.now()}`, category: 'Test Category' }),
    }),
  )) as { data?: CatalogBrand };
  const brand = created.data;
  if (!brand?.id) throw new Error('brand create failed');
  const brandId = brand.id;
  console.log('brand:', brandId, brand.slug);

  const getBrand = async () => {
    const list = (await j(await fetch(`${base}/catalog/brands`))) as { data?: CatalogBrand[] };
    return (list.data || []).find((b) => b.id === brandId)!;
  };

  try {
    // seed platform-owned + promoCodes state directly (simulates an admin having
    // verified the brand and a promo campaign existing)
    await fetch(`${base}/catalog/brands/${brandId}`, {
      method: 'PATCH',
      headers: H,
      body: JSON.stringify({
        verifiedStatus: true,
        claimStatus: 'verified',
        followers: 4210,
        ratings: 4.6,
        featuredFlag: true,
        promoCodes: [
          {
            id: 'promo-1',
            code: 'PROBE10',
            discountType: 'Percentage',
            discountValue: 10,
            startDate: '2026-01-01',
            endDate: '2026-12-31',
            usageLimit: 100,
            enabled: true,
          },
        ],
      }),
    });
    let stored = await getBrand();
    assert(stored.verifiedStatus === true && (stored.promoCodes || []).length === 1, 'seed applied', {
      verified: stored.verifiedStatus,
      promos: (stored.promoCodes || []).length,
    });

    // ---- Studio edit: mutate every canonical seller-owned field ----
    const model = mapCatalogBrandToModel(stored);
    model.coverImage = 'https://cdn.example/probe-cover.jpg';
    model.logo = 'https://cdn.example/probe-logo.png';
    model.logoUrl = model.logo;
    model.tagline = 'Persisted tagline ✓';
    model.website = 'https://probe-brand.example';
    model.socialFbUrl = 'https://facebook.com/probebrand';
    model.socialInstaUrl = 'https://instagram.com/probebrand';
    model.socialYtUrl = 'https://youtube.com/@probebrand';
    model.socialTiktokUrl = 'https://tiktok.com/@probebrand';
    model.customSocials = [
      { id: 'c1', label: 'Discord', url: 'https://discord.gg/probebrand' },
      { id: 'c2', label: 'Threads', url: 'https://threads.net/@probebrand' },
    ];
    model.description = 'Persisted description body.';
    model.brandStory = 'Founded in Dhaka. This story must persist.';
    model.storyBlocks = [
      { id: 'sb-1', heading: 'Our Beginnings', body: 'Started in a Gulshan garage.', kind: 'text' },
      { id: 'sb-2', heading: 'Featured in the press', body: 'A profile piece', kind: 'link', url: 'https://news.example/walton', thumbnail: 'https://cdn.example/press.jpg' },
      { id: 'sb-3', heading: '', body: '', kind: 'content', contentId: 'guide-abc' },
      { id: 'sb-4', heading: 'Today', body: 'Nationwide service network.', kind: 'text' },
      { id: 'sb-5', heading: '', body: '', kind: 'content', contentId: 'guide-xyz' },
    ];
    model.storyVideoUrl = 'https://youtube.com/watch?v=probe123';
    model.credentials = 'BSTI approved · 2-year official warranty';
    model.address = 'Level 4, Probe Tower, Gulshan-1, Dhaka';
    model.mapLink = 'https://maps.google.com/?q=Probe+Tower+Gulshan';
    model.contactEmail = 'care@probe-brand.example';
    model.phone = '+8801700000000';
    model.priceRange = '৳1,000 – ৳50,000';
    model.ageRange = '18–45';
    model.audienceType = 'Urban professionals';
    model.services = ['Free delivery', 'Official warranty'];
    model.bestForTags = ['Premium', 'Durable'];
    model.faq = [{ id: 'f1', q: 'Is it genuine?', a: 'Yes, 100% authentic.' }];
    model.stores = {
      authorized: [{ id: 'a1', name: 'Probe Flagship', sub: 'Bashundhara City' }],
      distributors: [{ id: 'd1', name: 'Probe Distribution Ltd', sub: 'Nationwide' }],
      serviceCenters: [{ id: 's1', name: 'Probe Care Dhaka', sub: 'Banani', hours: '10AM – 7PM' }],
    };
    model.pinnedProductIds = ['prod-zzz-2', 'prod-zzz-1', 'prod-zzz-3'];
    model.pinnedShowcaseProductIds = ['prod-show-5', 'prod-show-9'];

    const patch = brandModelToCanonicalPatch(model);
    assert(
      !('verifiedStatus' in patch) &&
        !('claimStatus' in patch) &&
        !('marketplaceAccess' in patch) &&
        !('followers' in patch) &&
        !('ratings' in patch) &&
        !('featuredFlag' in patch) &&
        !('sponsoredFlag' in patch) &&
        !('promoCodes' in patch),
      'patch omits every platform-owned field',
      Object.keys(patch),
    );
    assert('pinnedProductIds' in patch, 'patch carries seller-owned pinnedProductIds', Object.keys(patch));

    const saveRes = await fetch(`${base}/catalog/brands/${brandId}`, {
      method: 'PATCH',
      headers: H,
      body: JSON.stringify(patch),
    });
    assert(saveRes.status === 200, 'canonical PATCH accepted', saveRes.status);

    stored = await getBrand();
    assert(stored.coverImage === model.coverImage, 'coverImage persisted', stored.coverImage);
    assert(stored.logo === model.logo, 'logo persisted', stored.logo);
    assert(stored.tagline === model.tagline, 'tagline persisted', stored.tagline);
    assert(stored.website === model.website, 'website persisted', stored.website);
    assert(
      stored.socialLinks?.facebook === model.socialFbUrl &&
        stored.socialLinks?.instagram === model.socialInstaUrl &&
        stored.socialLinks?.youtube === model.socialYtUrl &&
        stored.socialLinks?.tiktok === model.socialTiktokUrl,
      'socialLinks persisted (fb/ig/yt/tiktok)',
      stored.socialLinks,
    );
    assert(
      (stored.socialLinks?.custom || []).length === 2 &&
        stored.socialLinks!.custom![0].label === 'Discord' &&
        stored.socialLinks!.custom![0].url === 'https://discord.gg/probebrand' &&
        stored.socialLinks!.custom![1].label === 'Threads',
      'socialLinks.custom (seller-added links) persisted',
      stored.socialLinks?.custom,
    );
    assert(stored.description === model.description, 'description persisted', stored.description);
    assert(
      (stored.storyBlocks || []).length === 5 &&
        stored.storyBlocks!.map((b) => b.kind).join(',') === 'text,link,content,text,content' &&
        stored.storyBlocks![1].url === 'https://news.example/walton' &&
        stored.storyBlocks![1].thumbnail === 'https://cdn.example/press.jpg' &&
        stored.storyBlocks![2].contentId === 'guide-abc',
      'hybrid storyBlocks (text / link+thumbnail / content) persisted in order',
      stored.storyBlocks,
    );
    assert(
      // legacy `story` kept in sync with the first TEXT block body
      stored.story === 'Started in a Gulshan garage.',
      'legacy `story` stays in sync with the first text story block',
      stored.story,
    );
    assert(
      JSON.stringify(stored.pinnedStoryContentIds) === JSON.stringify(['guide-abc', 'guide-xyz']),
      'pinnedStoryContentIds derived from the content story sections, in order',
      stored.pinnedStoryContentIds,
    );
    assert(stored.storyVideoUrl === model.storyVideoUrl, 'storyVideoUrl persisted', stored.storyVideoUrl);
    assert(stored.credentials === model.credentials, 'credentials persisted', stored.credentials);
    assert(
      stored.overview?.address === model.address &&
        stored.overview?.mapLink === model.mapLink &&
        stored.overview?.email === model.contactEmail &&
        stored.overview?.phone === model.phone &&
        stored.overview?.priceRange === model.priceRange &&
        stored.overview?.ageFocus === model.ageRange &&
        stored.overview?.audience === model.audienceType,
      'overview (address/mapLink/email/phone/priceRange/ageFocus/audience) persisted',
      stored.overview,
    );
    assert(
      JSON.stringify(stored.overview?.services) === JSON.stringify(model.services) &&
        JSON.stringify(stored.overview?.tags) === JSON.stringify(model.bestForTags),
      'overview services + tags persisted',
      { services: stored.overview?.services, tags: stored.overview?.tags },
    );
    assert(
      (stored.faq || []).length === 1 && stored.faq![0].q === 'Is it genuine?',
      'faq persisted',
      stored.faq,
    );
    assert(
      JSON.stringify(stored.pinnedProductIds) === JSON.stringify(['prod-zzz-2', 'prod-zzz-1', 'prod-zzz-3']),
      'pinnedProductIds persisted in the seller-curated order',
      stored.pinnedProductIds,
    );
    assert(
      JSON.stringify(stored.pinnedShowcaseProductIds) === JSON.stringify(['prod-show-5', 'prod-show-9']),
      'pinnedShowcaseProductIds (Products grid pins) persisted in order',
      stored.pinnedShowcaseProductIds,
    );
    assert(
      (stored.stores?.authorized || []).length === 1 &&
        (stored.stores?.distributors || []).length === 1 &&
        (stored.stores?.serviceCenters || []).length === 1 &&
        stored.stores?.serviceCenters?.[0].hours === '10AM – 7PM',
      'stores (authorized/distributors/serviceCenters + hours) persisted',
      stored.stores,
    );

    // ---- platform-owned fields untouched ----
    assert(
      stored.verifiedStatus === true &&
        stored.claimStatus === 'verified' &&
        stored.followers === 4210 &&
        stored.ratings === 4.6 &&
        stored.featuredFlag === true,
      'platform-owned fields unchanged by the Studio save',
      {
        verified: stored.verifiedStatus,
        claim: stored.claimStatus,
        followers: stored.followers,
        ratings: stored.ratings,
        featured: stored.featuredFlag,
      },
    );
    // ---- unrelated list preserved ----
    assert(
      (stored.promoCodes || []).length === 1 && stored.promoCodes![0].code === 'PROBE10',
      'promoCodes preserved through an unrelated Studio save',
      stored.promoCodes,
    );

    // ---- a second save of an unrelated field (tagline) leaves everything else ----
    const m2 = mapCatalogBrandToModel(await getBrand());
    m2.tagline = 'Second edit tagline';
    await fetch(`${base}/catalog/brands/${brandId}`, {
      method: 'PATCH',
      headers: H,
      body: JSON.stringify(brandModelToCanonicalPatch(m2)),
    });
    stored = await getBrand();
    assert(
      stored.tagline === 'Second edit tagline' &&
        stored.credentials === model.credentials &&
        stored.storyVideoUrl === model.storyVideoUrl &&
        (stored.stores?.authorized || []).length === 1 &&
        (stored.promoCodes || []).length === 1,
      'a later unrelated save preserves the earlier canonical edits + promoCodes',
      { tagline: stored.tagline, credentials: stored.credentials },
    );
  } finally {
    await fetch(`${base}/catalog/brands/${brandId}`, { method: 'DELETE', headers: H }).catch(() => {});
  }

  console.log(failed === 0 ? '\nALL BRAND STUDIO PERSISTENCE CHECKS PASSED' : `\n${failed} CHECK(S) FAILED`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
