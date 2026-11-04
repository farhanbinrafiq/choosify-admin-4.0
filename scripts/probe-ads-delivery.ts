/**
 * Ads Studio → storefront delivery probe: eligibility rules, public payload allowlist, slot
 * registry (retired / unknown slots), creative size checks, Super Admin moves (re-check + audit,
 * no silent publish), permissions, and the Deals Banners read-timestamp fix.
 *
 * ISOLATED STACK ONLY (localhost API + :55499 database).
 *   API_BASE=http://localhost:3001/api/v1 npx tsx scripts/probe-ads-delivery.ts
 */
import { deflateSync } from 'node:zlib';

const API = process.env.API_BASE || 'http://localhost:3001/api/v1';
const DB = process.env.DATABASE_URL || '';
if (!/^http:\/\/localhost:/.test(API) || !DB.includes(':55499/')) {
  console.error('REFUSE: run only against the isolated stack (localhost API + :55499 database)');
  process.exit(2);
}
const PASSWORD = process.env.DEV_PASSWORD || 'ChoosifyDev!2026';
let pass = 0;
let fail = 0;
const check = (label: string, ok: boolean, detail?: unknown) => {
  if (ok) pass++;
  else fail++;
  console.log(ok ? 'PASS' : 'FAIL', label, ok ? '' : JSON.stringify(detail ?? '').slice(0, 500));
};
async function login(email: string) {
  const r = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: PASSWORD }) });
  const j = (await r.json()) as { accessToken?: string };
  if (!j.accessToken) throw new Error(`login failed for ${email}`);
  return j.accessToken;
}
async function call(token: string | null, method: string, path: string, body?: unknown) {
  const r = await fetch(`${API}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  let json: any = null;
  try {
    json = await r.json();
  } catch {
    /* empty */
  }
  return { status: r.status, json, headers: r.headers };
}

/** Solid-colour PNG of the given size (valid file; the server reads IHDR for the size). */
function png(width: number, height: number): string {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (b: Buffer) => {
    let c = 0xffffffff;
    for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(width * 3, 0x40)]);
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]).toString('base64');
}

async function main() {
  const sa = await login('admin@choosify.com.bd');
  const seller = await login('seller@choosify.com.bd');
  const upload = async (w: number, h: number) => {
    const r = await call(sa, 'POST', '/catalog/media/upload', { fileName: `probe-${w}x${h}.png`, mimeType: 'image/png', data: png(w, h), category: 'products' });
    // The isolated server returns relative /media URLs (production returns absolute https ones).
    if (typeof r.json?.url === 'string' && r.json.url.startsWith('/')) r.json.url = API.replace(/\/api\/v1$/, '') + r.json.url;
    if (!r.json?.url) throw new Error(`upload failed ${r.status} ${JSON.stringify(r.json)}`);
    return r.json.url as string;
  };
  const wide = await upload(2000, 740); // like AD-00001 (2.7:1)
  const tiny = await upload(600, 150);
  const square = await upload(1300, 1300);
  const portrait = await upload(600, 800);
  const ultraWide = await upload(2000, 420); // 4.8:1 — fits wide banner slots (≤8:1), too wide for the hero (≤4:1)

  const delivery = async (slot?: string) => (await call(null, 'GET', `/ads/delivery${slot ? `?slot=${slot}` : ''}`)).json?.data?.slots ?? {};
  const base = (over: Record<string, unknown>) => ({
    title: 'Probe ad',
    formatId: 'follow_brands_banner',
    placementId: 'HOME_FOLLOW_BRANDS',
    creative: { headline: 'Probe headline', imageUrl: wide, advertiserName: 'Probe Brand' },
    cta: { label: 'Visit', url: '/deals', destinationType: 'internal' },
    ...over,
  });
  const create = async (token: string, over: Record<string, unknown>) => call(token, 'POST', '/ads/banners', base(over));

  // --- Registry: retired / unknown slots -------------------------------------------------------------
  check('retired slot (HOME_RIGHT_RAIL) cannot be chosen', (await create(sa, { formatId: 'vertical_card', placementId: 'HOME_RIGHT_RAIL', creative: { headline: 'x', imageUrl: portrait }, publishNow: true })).status === 400);
  check('retired slot (GUIDES_SIDEBAR) cannot be chosen', (await create(sa, { placementId: 'GUIDES_SIDEBAR', formatId: 'vertical_card', publishNow: true })).status === 400);
  check('unknown slot cannot be chosen', (await create(sa, { placementId: 'NOPE_SLOT', publishNow: true })).status === 400);
  check('public delivery for an unknown slot returns nothing', JSON.stringify(await delivery('NOPE_SLOT')) === '{}');
  const placements = (await call(sa, 'GET', '/ads/placements')).json?.data?.placements ?? [];
  check('placement picker lists only real (active) slots', placements.length > 0 && placements.every((p: any) => p.active) && !placements.some((p: any) => ['HOME_RIGHT_RAIL', 'GUIDES_SIDEBAR', 'DEALS_FEATURED'].includes(p.placementId)));
  check('every active slot states section + recommended size', placements.every((p: any) => p.sectionLabel && (p.creative ? p.creative.recommended.width > 0 : true)));

  // --- Creative size checks ----------------------------------------------------------------------------
  const small = await create(sa, { creative: { headline: 'x', imageUrl: tiny }, publishNow: true });
  check('too-small image refused with the required size', small.status === 400 && /at least 1200×240/.test(small.json?.error || ''), small.json);
  const sq = await create(sa, { creative: { headline: 'x', imageUrl: square }, publishNow: true });
  check('wrong proportions (square in a wide banner slot) refused', sq.status === 400 && /proportions/.test(sq.json?.error || ''), sq.json);
  const spoof = await create(sa, { creative: { headline: 'x', imageUrl: tiny, imageWidth: 2000, imageHeight: 600 }, publishNow: true });
  check('client-sent image sizes are ignored (server measures)', spoof.status === 400, spoof.json);

  // --- Active ad delivered with display fields only -------------------------------------------------------
  const live = await create(sa, { publishNow: true });
  check('super admin publishes a fitting banner → active', live.status === 201 && live.json?.data?.status === 'active', live.json);
  const liveId = live.json?.data?.id;
  check('server stored the measured size (2000×740)', live.json?.data?.creative?.imageWidth === 2000 && live.json?.data?.creative?.imageHeight === 740);
  const d1 = await call(null, 'GET', '/ads/delivery');
  const hb = d1.json?.data?.slots?.HOME_FOLLOW_BRANDS ?? [];
  const pub = hb.find((a: any) => a.id === liveId);
  check('public delivery includes the active ad in HOME_FOLLOW_BRANDS', Boolean(pub), d1.json);
  check('delivered as a whole (natural) banner with link + sponsor', pub?.display === 'natural' && pub?.link?.url === '/deals' && pub?.sponsorName === 'Probe Brand');
  const leaked = ['ownerId', 'ownerRole', 'status', 'metadata', 'review', 'sellerNote', 'advertisementReferenceId', 'dealTerms', 'createdAt'].filter((k) => pub && k in pub);
  check('public payload has NO private fields (owner, status, metadata, review, reference id…)', pub && leaked.length === 0, leaked);
  check('public delivery is cacheable for 30s', /max-age=30/.test(d1.headers.get('cache-control') || ''));
  check('delivery needs no login (storefront)', d1.status === 200);

  // --- Not delivered: pending / rejected / paused / disabled / dates / missing image -------------------
  const pending = await create(seller, { ownerRole: 'seller' });
  const pendingId = pending.json?.data?.id;
  check('seller ad is created PENDING (cannot self-publish)', pending.status === 201 && pending.json?.data?.status === 'pending', pending.json);
  const notIn = async (id: string) => !JSON.stringify(await delivery()).includes(id);
  check('pending ad is NOT delivered', await notIn(pendingId));
  const rej = await create(seller, { ownerRole: 'seller' });
  await call(sa, 'POST', `/ads/banners/${rej.json?.data?.id}/reject`, { reason: 'probe' });
  check('rejected ad is NOT delivered', await notIn(rej.json?.data?.id));
  const future = await create(sa, { publishNow: true, startsAt: new Date(Date.now() + 86400000).toISOString() });
  check('future campaign (starts tomorrow) is NOT delivered', future.status === 201 && (await notIn(future.json?.data?.id)), future.json);
  const expired = await create(sa, { publishNow: true, startsAt: new Date(Date.now() - 172800000).toISOString(), endsAt: new Date(Date.now() - 86400000).toISOString() });
  check('expired campaign is NOT delivered', expired.status === 201 && (await notIn(expired.json?.data?.id)), expired.json);
  const noImg = await create(sa, { publishNow: true, creative: { headline: 'no image' } });
  check('ad without an image is NOT delivered', noImg.status === 201 && (await notIn(noImg.json?.data?.id)), noImg.json);
  const toPause = await create(sa, { publishNow: true });
  await call(sa, 'POST', `/ads/${toPause.json?.data?.id}/pause`);
  check('paused ad is NOT delivered', await notIn(toPause.json?.data?.id));
  const toDisable = await create(sa, { publishNow: true });
  await call(sa, 'POST', `/ads/${toDisable.json?.data?.id}/disable`);
  check('disabled ad is NOT delivered', await notIn(toDisable.json?.data?.id));
  const list = (await call(sa, 'GET', '/ads/banners')).json?.data ?? [];
  const why = (id: string) => list.find((a: any) => a.id === id)?.delivery?.problems?.[0] || '';
  check('admin list explains why: pending → "Waiting for approval"', /Waiting for approval/.test(why(pendingId)), why(pendingId));
  check('admin list explains why: future → "Scheduled"', /Scheduled/.test(why(future.json?.data?.id)));
  check('admin list explains why: expired → "Campaign ended"', /Campaign ended/.test(why(expired.json?.data?.id)));
  check('admin list marks the live ad as delivered', list.find((a: any) => a.id === liveId)?.delivery?.delivered === true);

  // --- Approval publishes (pending → active) ----------------------------------------------------------
  await call(sa, 'POST', `/ads/banners/${pendingId}/approve`);
  check('approving (with publish) puts the ad on the storefront', !(await notIn(pendingId)));

  // --- Moves ---------------------------------------------------------------------------------------------
  check('seller cannot move ads (403)', (await call(seller, 'POST', `/ads/${liveId}/move`, { placementId: 'BROWSE_BANNER' })).status === 403);
  check('signed-out cannot move ads (401)', (await call(null, 'POST', `/ads/${liveId}/move`, { placementId: 'BROWSE_BANNER' })).status === 401);
  const bad = await call(sa, 'POST', `/ads/${liveId}/move`, { placementId: 'BROWSE_SIDEBAR' });
  check('move into a slot that does not accept the format is refused', bad.status === 400 && /not allowed/.test(bad.json?.error || ''), bad.json);
  check('move into a retired slot is refused', (await call(sa, 'POST', `/ads/${liveId}/move`, { placementId: 'HOME_RIGHT_RAIL' })).status === 400);
  const mv = await call(sa, 'POST', `/ads/${liveId}/move`, { placementId: 'BROWSE_BANNER' });
  check('super admin moves the ad to the Products page banner', mv.status === 200 && mv.json?.data?.placementId === 'BROWSE_BANNER' && mv.json?.data?.status === 'active', mv.json);
  const hist = mv.json?.data?.metadata?.placementHistory ?? [];
  check('move is recorded (audit trail: from, to, who, when)', hist.length === 1 && hist[0].from === 'HOME_FOLLOW_BRANDS' && hist[0].to === 'BROWSE_BANNER' && hist[0].by && hist[0].at);
  const after = await delivery();
  check('delivery follows the move immediately (no stale server cache)', (after.BROWSE_BANNER ?? []).some((a: any) => a.id === liveId) && !(after.HOME_FOLLOW_BRANDS ?? []).some((a: any) => a.id === liveId));
  const pend2 = await create(seller, { ownerRole: 'seller' });
  const mv2 = await call(sa, 'POST', `/ads/${pend2.json?.data?.id}/move`, { placementId: 'DEALS_BANNER' });
  check('moving a PENDING ad keeps it pending and off the storefront (no silent publish)', mv2.status === 200 && mv2.json?.data?.status === 'pending' && (await notIn(pend2.json?.data?.id)), mv2.json);
  const hero = await create(sa, { formatId: 'hero_banner', creative: { headline: 'wide', imageUrl: ultraWide }, publishNow: true });
  const mvHero = await call(sa, 'POST', `/ads/${hero.json?.data?.id}/move`, { placementId: 'HOME_HERO' });
  check('move re-checks the creative: a 4.8:1 image is refused for the hero (max 4:1)', hero.status === 201 && mvHero.status === 400 && /proportions/.test(mvHero.json?.error || ''), mvHero.json);

  // --- Other permissions ---------------------------------------------------------------------------------
  check('signed-out cannot list ads (401)', (await call(null, 'GET', '/ads/banners')).status === 401);
  check('signed-out cannot read an ad delivery check (401)', (await call(null, 'GET', `/ads/${liveId}/delivery`)).status === 401);
  const own = await call(sa, 'GET', `/ads/${liveId}/delivery`);
  check('staff delivery check explains status', own.status === 200 && own.json?.data?.delivered === true, own.json);

  // --- Deals Banners: reading must not change timestamps -----------------------------------------------
  const b1 = (await call(null, 'GET', '/catalog/deals-banners?active=false')).json?.data ?? [];
  await new Promise((r) => setTimeout(r, 1200));
  const b2 = (await call(null, 'GET', '/catalog/deals-banners?active=false')).json?.data ?? [];
  check('Deals Banners: two reads return identical updatedAt (no re-stamping on read)', b1.length > 0 && JSON.stringify(b1.map((b: any) => b.updatedAt)) === JSON.stringify(b2.map((b: any) => b.updatedAt)), [b1[0]?.updatedAt, b2[0]?.updatedAt]);
  check('Deals Banners: the stored timestamps are returned (not "now")', b1.every((b: any) => Date.now() - Date.parse(b.updatedAt) > 5000), b1.map((b: any) => b.updatedAt));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => {
  console.error('PROBE CRASHED', e);
  process.exit(1);
});
