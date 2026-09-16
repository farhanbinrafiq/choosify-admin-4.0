/**
 * Creator Review thumbnail requirement probe — server-side enforcement that
 * Facebook/Instagram Creator Reviews must carry a custom thumbnail (neither
 * platform exposes a reliable credential-free provider thumbnail), while
 * YouTube/YouTube Shorts/TikTok remain optional because their provider
 * thumbnail is reliable. Also guarantees existing legacy Facebook/Instagram
 * entries with no thumbnail are never retroactively blocked by an unrelated
 * save.
 *
 * Deterministic; safe to re-run. Needs the dev API on :3001 + a seller
 * account that owns at least one brand (`seller@choosify.com.bd`).
 *
 * Usage: npx tsx scripts/probe-creator-review-thumbnail-requirement.ts
 */
const BASE = process.env.PROBE_BASE_URL_ROOT || 'http://localhost:3001';
const API = `${BASE}/api/v1`;
const PW = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';
const PASS: string[] = [];
const FAIL: string[] = [];
function check(cond: unknown, label: string, detail?: unknown) {
  if (cond) {
    PASS.push(label);
    console.log('PASS', label);
  } else {
    FAIL.push(label);
    console.log('FAIL', label, detail !== undefined ? JSON.stringify(detail) : '');
  }
}
async function api(path: string, init: RequestInit, token?: string) {
  const r = await fetch(`${API}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers || {}) },
  });
  return { status: r.status, body: (await r.json().catch(() => ({}))) as any };
}

const RID = Date.now();
const YT_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const YT_SHORT_URL = 'https://www.youtube.com/shorts/dQw4w9WgXcQ';
const TIKTOK_URL = 'https://www.tiktok.com/@qa_creator/video/7123456789012345678';
const FB_URL = 'https://www.facebook.com/reel/1627788202100973/';
const IG_URL = 'https://www.instagram.com/reel/C1AbcDEfGhI/';
const THUMB = 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800&q=80';

async function main() {
  const seller = (await api('/auth/login', { method: 'POST', body: JSON.stringify({ email: 'seller@choosify.com.bd', password: PW }) })).body;
  if (!seller.accessToken) throw new Error('seller login failed');
  // Sellers don't carry PRODUCT_DELETE by default (confirmed: a seller
  // deleting their own probe-created product → 403 AUTH_FORBIDDEN), so
  // cleanup uses an admin session instead, matching the cleanup pattern in
  // sibling probes (e.g. probe-profile-image-adjustment.ts's admin-token
  // brand delete).
  const admin = (await api('/auth/login', { method: 'POST', body: JSON.stringify({ email: 'admin@choosify.com.bd', password: PW }) })).body;
  if (!admin.accessToken) throw new Error('admin login failed (needed for probe-product cleanup)');

  const brands = (await api('/catalog/brands', { method: 'GET' }, seller.accessToken)).body;
  const ownBrand = (brands.data || []).find((b: any) => b.sellerId === seller.uid);
  if (!ownBrand) throw new Error('seller has no own brand to attach a product to');

  const created = await api('/catalog/products', {
    method: 'POST',
    body: JSON.stringify({
      title: `Thumbnail Requirement QA Product ${RID}`,
      brandId: ownBrand.id,
      categoryId: 'cat-mobile',
      category: 'Mobile & Phones',
      price: 1999,
      description: 'QA product for creator review thumbnail requirement',
      image: THUMB,
      stock: 10,
    }),
  }, seller.accessToken);
  if (created.status !== 200 && created.status !== 201) throw new Error(`create product failed: ${created.status} ${JSON.stringify(created.body)}`);
  const productId: string = created.body?.data?.id || created.body?.id;

  try {
    await runChecks(productId, seller.accessToken);
  } finally {
    // Cleanup runs even if an assertion above throws, so the probe never
    // leaves a synthetic product behind on a failed run either.
    const del = await api(`/catalog/products/${productId}`, { method: 'DELETE' }, admin.accessToken);
    if (del.status !== 200 && del.status !== 204) {
      console.log('WARN: cleanup delete of probe product failed', productId, del.status, JSON.stringify(del.body));
    }
  }

  console.log(`\n=== ${PASS.length} passed, ${FAIL.length} failed ===`);
  if (FAIL.length) {
    console.log('FAILURES:\n - ' + FAIL.join('\n - '));
    process.exit(1);
  }
  console.log('ALL CREATOR REVIEW THUMBNAIL REQUIREMENT CHECKS PASSED');
}

async function runChecks(productId: string, token: string) {
  const put = (creatorContent: unknown[]) =>
    api(`/catalog/product-details/${productId}`, { method: 'PUT', body: JSON.stringify({ creatorContent }) }, token);
  const patch = (creatorContent: unknown[]) =>
    api(`/catalog/product-details/${productId}`, { method: 'PATCH', body: JSON.stringify({ creatorContent }) }, token);
  const patch2Field = (pid: string, tok: string, body: Record<string, unknown>) =>
    api(`/catalog/product-details/${pid}`, { method: 'PATCH', body: JSON.stringify(body) }, tok);

  const item = (id: string, videoUrl: string, thumbnail: string, title: string) => ({
    id, videoUrl, thumbnail, title, creatorHandle: '@qa_creator', views: '1K views', platform: 'Other',
  });

  // ── Facebook ────────────────────────────────────────────────────────
  const fbNoThumb = await put([item('cc-fb-1', FB_URL, '', 'FB no thumbnail')]);
  check(fbNoThumb.status === 400 && fbNoThumb.body?.code === 'CREATOR_REVIEW_THUMBNAIL_REQUIRED', 'Facebook + no thumbnail → validation failure', fbNoThumb);

  const fbEmpty = await put([item('cc-fb-2', FB_URL, '', 'FB empty string')]);
  check(fbEmpty.status === 400, 'Facebook + empty string thumbnail → validation failure', fbEmpty.status);

  const fbWhitespace = await put([item('cc-fb-3', FB_URL, '   ', 'FB whitespace')]);
  check(fbWhitespace.status === 400, 'Facebook + whitespace thumbnail → validation failure', fbWhitespace.status);

  const fbWithThumb = await put([item('cc-fb-4', FB_URL, THUMB, 'FB with thumbnail')]);
  check(fbWithThumb.status === 200, 'Facebook + thumbnail → PASS', fbWithThumb.status);

  // ── Instagram ───────────────────────────────────────────────────────
  const igNoThumb = await put([item('cc-ig-1', IG_URL, '', 'IG no thumbnail')]);
  check(igNoThumb.status === 400 && igNoThumb.body?.code === 'CREATOR_REVIEW_THUMBNAIL_REQUIRED', 'Instagram + no thumbnail → validation failure', igNoThumb);

  const igEmpty = await put([item('cc-ig-2', IG_URL, '', 'IG empty string')]);
  check(igEmpty.status === 400, 'Instagram + empty thumbnail → validation failure', igEmpty.status);

  const igWhitespace = await put([item('cc-ig-3', IG_URL, '  \t ', 'IG whitespace')]);
  check(igWhitespace.status === 400, 'Instagram + whitespace thumbnail → validation failure', igWhitespace.status);

  const igWithThumb = await put([item('cc-ig-4', IG_URL, THUMB, 'IG with thumbnail')]);
  check(igWithThumb.status === 200, 'Instagram + thumbnail → PASS', igWithThumb.status);

  // ── Optional-thumbnail platforms remain unaffected ─────────────────
  const ytNoThumb = await put([item('cc-yt-1', YT_URL, '', 'YT no thumbnail')]);
  check(ytNoThumb.status === 200, 'YouTube + no custom thumbnail → PASS (provider thumbnail)', ytNoThumb.status);

  const ytShortNoThumb = await put([item('cc-yts-1', YT_SHORT_URL, '', 'YT Shorts no thumbnail')]);
  check(ytShortNoThumb.status === 200, 'YouTube Shorts + no custom thumbnail → PASS (provider thumbnail)', ytShortNoThumb.status);

  const tiktokNoThumb = await put([item('cc-tt-1', TIKTOK_URL, '', 'TikTok no thumbnail')]);
  check(tiktokNoThumb.status === 200, 'TikTok + no custom thumbnail → PASS (provider thumbnail)', tiktokNoThumb.status);

  // ── Custom thumbnail wins everywhere ────────────────────────────────
  const allWithThumb = await put([
    item('cc-fb-5', FB_URL, THUMB, 'FB custom'),
    item('cc-ig-5', IG_URL, THUMB, 'IG custom'),
    item('cc-yt-2', YT_URL, THUMB, 'YT custom'),
    item('cc-tt-2', TIKTOK_URL, THUMB, 'TT custom'),
  ]);
  check(allWithThumb.status === 200, 'All platforms + custom thumbnail → custom thumbnail wins, save succeeds', allWithThumb.status);
  const savedThumbs = (allWithThumb.body?.creatorContent || allWithThumb.body?.data?.creatorContent || []).map((c: any) => c.thumbnail);
  check(savedThumbs.every((t: string) => t === THUMB), 'saved items all carry the exact custom thumbnail (no silent override)', savedThumbs);

  // ── Never-before-seen FB/IG items with no thumbnail are rejected via
  // PATCH too, not just PUT (id-based new-vs-existing identity) ─────────
  const newViaPatch = await patch([item('cc-new-fb', FB_URL, '', 'Brand-new FB item via PATCH')]);
  check(newViaPatch.status === 400, 'a never-before-seen FB item with no thumbnail is rejected via PATCH too', newViaPatch.status);

  // ── Legacy record safety net: this rule only inspects `creatorContent`
  // when the caller actually includes it in the request body. An unrelated
  // PATCH that never touches creatorContent must succeed regardless of what
  // legacy Facebook/Instagram content (with or without a thumbnail) already
  // exists on the product — mirrors the real "editing an unrelated Product
  // Studio section" path, which never sends creatorContent at all. ──────
  const unrelatedPatch = await patch2Field(productId, token, { description: `updated ${RID}` });
  check(unrelatedPatch.status === 200, 'an unrelated PATCH that omits creatorContent entirely always succeeds (existing legacy Facebook/Instagram content, thumbnail or not, is never retroactively blocked)', unrelatedPatch.status);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
