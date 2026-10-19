/**
 * Creator Studio integrity probe — input validation, explicit clears and
 * server-side authorization for every Creator profile mutation.
 *
 * Guarantees:
 *  - shared/creatorProfileRules: platform links must be absolute http(s) on the
 *    platform's own domain (no javascript:/data:, no look-alike hosts); other
 *    links need a name + http(s) URL; email / phone formats
 *  - normalizeCreatorInput: a new invalid value throws (→ 400) while unchanged
 *    legacy values never block an unrelated save; '' clears a link / contact
 *    field; `[]` clears expertise, platforms, collaboration types and partners;
 *    duplicate other-links collapse; no fabricated "General" default
 *  - creatorEditorModel: cleared fields go out as '' (and a removed photo sends
 *    `avatarCrop: null`) so the clear persists; Followers sum across platforms
 *  - API (dev stack, creator@ account): invalid input → 400 with nothing stored;
 *    valid edits persist and survive a reload; clears persist; unauthenticated,
 *    seller and cross-owner writes are refused
 *
 * Restores the creator profile at the end. Needs the dev API on :3001 and the
 * seeded dev accounts. Run against an isolated stack only.
 */
import {
  creatorCustomLinkProblem,
  creatorEmailProblem,
  creatorPhoneProblem,
  creatorSocialLinkProblem,
} from '../shared/creatorProfileRules';
import { normalizeCreatorInput } from '../lib/vercel-catalog/catalogEditorialContract';
import {
  editorModelToCreatorSectionPatch,
  mapCatalogCreatorToEditor,
} from '../src/pages/admin/creatorEditorModel';
import type { CatalogCreator } from '../src/types/catalog';

const BASE = process.env.PROBE_BASE_URL_ROOT || 'http://localhost:3001';
const API = `${BASE}/api/v1`;
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
const throws = (fn: () => unknown): string | null => {
  try {
    fn();
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
};
const j = async (r: Response) => {
  const t = await r.text();
  try {
    return t ? JSON.parse(t) : {};
  } catch {
    return { _raw: t };
  }
};
async function login(email: string, password = 'ChoosifyDev!2026') {
  const b = await j(
    await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }),
  );
  const token = b.accessToken || b.token || b.data?.accessToken;
  if (!token) throw new Error(`login failed for ${email}`);
  return token as string;
}
async function req(method: string, path: string, token?: string, body?: unknown) {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return { status: r.status, body: await j(r) };
}

function rules() {
  console.log('\n— shared rules —');
  const ok = (p: Parameters<typeof creatorSocialLinkProblem>[0], v: string) => creatorSocialLinkProblem(p, v) === null;
  check(ok('facebook', '') && ok('facebook', '   '), 'empty platform link = no link (valid)');
  check(ok('facebook', 'https://facebook.com/rifat') && ok('facebook', 'https://www.facebook.com/rifat') && ok('facebook', 'https://m.facebook.com/rifat') && ok('facebook', 'https://fb.com/x'), 'Facebook accepts facebook.com / www / m. / fb.com');
  check(ok('youtube', 'https://youtu.be/abc') && ok('youtube', 'https://www.youtube.com/@rifat'), 'YouTube accepts youtube.com + youtu.be');
  check(ok('instagram', 'https://instagram.com/rifat') && ok('linkedin', 'https://www.linkedin.com/in/rifat') && ok('tiktok', 'https://www.tiktok.com/@rifat'), 'Instagram / LinkedIn / TikTok accept their own domains');
  check(!ok('facebook', 'javascript:alert(1)') && !ok('facebook', 'data:text/html,hi') && !ok('youtube', 'vbscript:x'), 'javascript: / data: / vbscript: rejected');
  check(!ok('instagram', 'not a url') && !ok('instagram', 'instagram.com/rifat') && !ok('instagram', '//instagram.com/rifat'), 'malformed / scheme-less / protocol-relative rejected');
  check(!ok('facebook', 'https://youtube.com/@rifat') && !ok('youtube', 'https://facebook.com/x'), 'wrong-platform link rejected');
  check(!ok('facebook', 'https://evilfacebook.com/x') && !ok('facebook', 'https://facebook.com.evil.example/x'), 'look-alike hosts rejected');
  check(!ok('tiktok', `https://tiktok.com/${'a'.repeat(2100)}`), 'over-long link rejected');
  check(creatorCustomLinkProblem('', '') === null, 'blank other-link row ignored');
  check(!!creatorCustomLinkProblem('', 'https://twitch.tv/x') && !!creatorCustomLinkProblem('Twitch', '') && !!creatorCustomLinkProblem('Twitch', 'javascript:alert(1)'), 'other link needs a name + a safe URL');
  check(creatorCustomLinkProblem('Twitch', 'https://twitch.tv/rifat') === null, 'valid other link accepted');
  check(creatorEmailProblem('') === null && creatorEmailProblem('rifat@example.com') === null, 'email: empty or valid accepted');
  check(!!creatorEmailProblem('not-an-email') && !!creatorEmailProblem('a@b') && !!creatorEmailProblem('a b@example.com'), 'email: malformed rejected');
  check(creatorPhoneProblem('') === null && creatorPhoneProblem('+880 1711-000000') === null && creatorPhoneProblem('(02) 555 0101') === null, 'phone: empty or valid accepted');
  check(!!creatorPhoneProblem('<script>') && !!creatorPhoneProblem('12') && !!creatorPhoneProblem('call me'), 'phone: malformed rejected');
}

function normalizer() {
  console.log('\n— normalizeCreatorInput —');
  const legacy = normalizeCreatorInput({ name: 'Legacy' });
  check(legacy.bestFor === '' && (legacy.platforms ?? []).length === 0, 'no fabricated "General" / platform defaults', { bestFor: legacy.bestFor, platforms: legacy.platforms });
  // Simulate stored legacy data that predates validation.
  const existing = { ...legacy, socialLinks: { facebook: 'not a url', youtube: 'https://youtube.com/@ok' }, email: 'legacy-bad', phone: 'x' } as CatalogCreator;
  check(throws(() => normalizeCreatorInput({ ...existing, bio: 'new bio' }, existing)) === null, 'unchanged legacy values never block an unrelated save (PATCH merge)');
  check(!!throws(() => normalizeCreatorInput({ socialLinks: { instagram: 'javascript:alert(1)' } }, existing)), 'new unsafe platform link throws');
  check(!!throws(() => normalizeCreatorInput({ socialLinks: { instagram: 'https://facebook.com/x' } }, existing)), 'new wrong-platform link throws');
  check(!!throws(() => normalizeCreatorInput({ socialLinks: { custom: [{ label: 'X', url: 'data:text/html,1' }] } }, existing)), 'new unsafe other link throws');
  check(!!throws(() => normalizeCreatorInput({ email: 'nope' }, existing)) && !!throws(() => normalizeCreatorInput({ phone: '<b>' }, existing)), 'new malformed email / phone throws');
  const cleared = normalizeCreatorInput({ socialLinks: { facebook: '', youtube: '' }, email: '', phone: '' }, existing);
  check(!cleared.socialLinks?.facebook && !cleared.socialLinks?.youtube && cleared.email === '' && cleared.phone === '', "'' clears links and contact fields", cleared.socialLinks);
  const kept = normalizeCreatorInput({ socialLinks: { instagram: 'https://instagram.com/x' } }, existing);
  check(kept.socialLinks?.youtube === 'https://youtube.com/@ok' && kept.socialLinks?.instagram === 'https://instagram.com/x', 'absent link keys keep the stored value');
  const withLists = { ...existing, bestForTags: ['A'], platforms: ['YouTube'], collabTypes: ['Reviews'], brandPartners: [{ name: 'Walton' }] } as CatalogCreator;
  const emptied = normalizeCreatorInput({ bestForTags: [], platforms: [], collabTypes: [], brandPartners: [] }, withLists);
  check((emptied.bestForTags ?? []).length === 0 && (emptied.platforms ?? []).length === 0 && (emptied.collabTypes ?? []).length === 0 && (emptied.brandPartners ?? []).length === 0, '`[]` clears expertise, platforms, collab types and partners');
  const absent = normalizeCreatorInput({ bio: 'x' }, withLists);
  check(absent.bestForTags?.[0] === 'A' && absent.brandPartners?.[0]?.name === 'Walton', 'absent list keys keep the stored list');
  const deduped = normalizeCreatorInput({ socialLinks: { custom: [{ label: 'Site', url: 'https://a.example/' }, { label: 'Site 2', url: 'https://a.example' }, { label: 'B', url: 'https://b.example' }] } }, existing);
  check(deduped.socialLinks?.custom?.length === 2, 'duplicate other links collapse', deduped.socialLinks?.custom);
}

function model() {
  console.log('\n— creatorEditorModel —');
  const base = normalizeCreatorInput({ name: 'Model', avatar: 'https://cdn.example/a.png', socialLinks: { facebook: 'https://facebook.com/m' }, followers: { YouTube: '1.2K', Instagram: '300', TikTok: '' } });
  const m = mapCatalogCreatorToEditor(base);
  check(m.followerTotal === '1.5K', 'Followers sum across platforms (1.2K + 300 = 1.5K)', m.followerTotal);
  check(mapCatalogCreatorToEditor(normalizeCreatorInput({ name: 'N', followers: { YouTube: '0' } })).followerTotal === '', 'zero followers render as not recorded, not "0"');
  const patch = editorModelToCreatorSectionPatch({ ...m, avatar: '', avatarOriginal: '', avatarCrop: undefined, title: '', location: '', socialLinks: { ...m.socialLinks, facebook: '' }, email: '' }) as Record<string, any>;
  check(patch.avatar === '' && patch.avatarCrop === null, 'removed photo → avatar "" + avatarCrop null', { avatar: patch.avatar, crop: patch.avatarCrop });
  check(patch.socialLinks.facebook === '' && patch.role === '' && patch.location === '' && patch.email === '', 'cleared fields go out as "" (persisted clears)');
  check(!('status' in patch) && !('verifiedStatus' in patch), 'section patch never carries status / verifiedStatus');
}

async function api() {
  console.log('\n— API (dev stack) —');
  const admin = await login('admin@choosify.com.bd');
  const creator = await login('creator@choosify.com.bd');
  const seller = await login('seller@choosify.com.bd');
  const own = (await req('POST', '/catalog/workspace/creator/ensure', creator, {})).body.creators?.[0] as CatalogCreator;
  check(!!own?.id, 'creator resolves their own profile', own?.id);
  const id = own.id;
  const getMine = async () => ((await req('GET', '/catalog/creators', creator)).body.data as CatalogCreator[]).find((c) => c.id === id)!;
  const snap = await getMine();
  const restore = {
    socialLinks: {
      facebook: snap.socialLinks?.facebook || '', instagram: snap.socialLinks?.instagram || '', youtube: snap.socialLinks?.youtube || '',
      linkedin: snap.socialLinks?.linkedin || '', tiktok: snap.socialLinks?.tiktok || '', custom: snap.socialLinks?.custom || [],
    },
    bestForTags: snap.bestForTags || [], platforms: snap.platforms || [], collabTypes: snap.collabTypes || [], brandPartners: snap.brandPartners || [],
    avatar: snap.avatar || '', avatarOriginal: snap.avatarOriginal || '', avatarCrop: snap.avatarCrop ?? null, coverImage: snap.coverImage || '',
    email: snap.email || '', phone: snap.phone || '', role: snap.role || '', location: snap.location || '', bio: snap.bio || '',
  };
  const patch = (body: unknown, token = creator, cid = id) => req('PATCH', `/catalog/creators/${cid}`, token, body);

  try {
    for (const [label, body] of [
      ['javascript: link', { socialLinks: { facebook: 'javascript:alert(1)' } }],
      ['malformed link', { socialLinks: { instagram: 'not a url' } }],
      ['wrong-platform link', { socialLinks: { youtube: 'https://facebook.com/x' } }],
      ['unsafe other link', { socialLinks: { custom: [{ label: 'X', url: 'data:text/html,1' }] } }],
      ['other link without a name', { socialLinks: { custom: [{ label: '', url: 'https://x.example' }] } }],
      ['malformed email', { email: 'not-an-email' }],
      ['malformed phone', { phone: '<script>' }],
    ] as const) {
      const before = JSON.stringify(await getMine());
      const r = await patch(body);
      const after = await getMine();
      check(r.status === 400 && typeof r.body.error === 'string' && r.body.error.length > 0, `API rejects ${label} (400 + message)`, r);
      check(JSON.stringify({ ...after, updatedAt: '' }) === JSON.stringify({ ...JSON.parse(before), updatedAt: '' }), `nothing stored for ${label}`);
    }

    const good = await patch({
      socialLinks: { facebook: 'https://facebook.com/probe', youtube: 'https://www.youtube.com/@probe', custom: [{ label: 'Website', url: 'https://probe.example' }] },
      email: 'probe@example.com', phone: '+880 1711-000000', bestForTags: ['Phones'], platforms: ['YouTube'], collabTypes: ['Reviews'],
      avatar: 'https://cdn.example/probe-avatar.png', avatarOriginal: 'https://cdn.example/probe-original.png', avatarCrop: { scale: 1.2, x: 4, y: -2, naturalW: 800, naturalH: 600, frameW: 300, frameH: 300 },
    });
    check(good.status === 200, 'valid social / contact / lists / photo save → 200', good.body.error);
    let c = await getMine();
    check(c.socialLinks?.facebook === 'https://facebook.com/probe' && c.socialLinks?.custom?.[0]?.url === 'https://probe.example' && c.email === 'probe@example.com'
      && c.phone === '+880 1711-000000' && c.avatarCrop?.frameW === 300, 'valid values persist and survive a reload');

    check((await patch({ socialLinks: { facebook: '', custom: [] }, email: '', phone: '' })).status === 200, 'clearing links + contact → 200');
    c = await getMine();
    check(!c.socialLinks?.facebook && !(c.socialLinks?.custom || []).length && c.socialLinks?.youtube === 'https://www.youtube.com/@probe' && !c.email && !c.phone,
      'cleared links / contact persist; untouched YouTube kept', { fb: c.socialLinks?.facebook, yt: c.socialLinks?.youtube, email: c.email });

    check((await patch({ bestForTags: [], platforms: [], collabTypes: [] })).status === 200, 'emptying lists → 200');
    c = await getMine();
    check(!(c.bestForTags || []).length && !(c.platforms || []).length && !(c.collabTypes || []).length, 'emptied lists persist');

    check((await patch({ avatar: '', avatarOriginal: '', avatarCrop: null })).status === 200, 'removing the profile photo → 200');
    c = await getMine();
    check(!c.avatar && !c.avatarOriginal && !c.avatarCrop, 'removed photo + framing persist as cleared', { avatar: c.avatar, crop: c.avatarCrop });

    const forged = await patch({ score: 99, followers: { YouTube: '1M' }, verifiedStatus: true, featuredFlag: true });
    c = await getMine();
    check(c.score === snap.score && JSON.stringify(c.followers || {}) === JSON.stringify(snap.followers || {}) && c.verifiedStatus === snap.verifiedStatus && c.featuredFlag === snap.featuredFlag,
      'creator cannot set trust score / followers / verification / featured', forged.status);

    // Lifecycle for a creator whose Marketplace Access is pending (the dev creator): can take the
    // profile down (Unpublish / Archive) but never put it live.
    if ((await req('PATCH', `/catalog/creators/${id}`, admin, { status: 'live' })).status === 200) {
      const down = await patch({ status: 'draft' });
      const up = await patch({ status: 'live' });
      const arch = (await patch({ status: 'archived' })).body.data?.status;
      const now = (await getMine()).status;
      check(down.body.data?.status === 'draft' && up.body.data?.status === 'draft' && arch === 'archived',
        'pending creator: Unpublish + Archive apply, self-publish refused', { down: down.body.data?.status, up: up.body.data?.status, arch, now });
    }
    const anon = await patch({ bio: 'anon' }, ''); // '' = no Authorization header
    check(anon.status === 401, 'unauthenticated write → 401', anon.status);
    const bySeller = await patch({ bio: 'seller' }, seller);
    check(bySeller.status === 403, 'seller write to a creator profile → 403', bySeller.status);
    const others = ((await req('GET', '/catalog/creators', admin)).body.data as CatalogCreator[]).find((x) => x.id !== id && x.userId !== snap.userId);
    if (others) {
      const cross = await patch({ bio: 'hijack' }, creator, others.id);
      const after = ((await req('GET', '/catalog/creators', admin)).body.data as CatalogCreator[]).find((x) => x.id === others.id);
      check(cross.status === 403 && after?.bio === others.bio, 'creator write to another creator’s profile → 403, unchanged', cross.status);
    } else {
      check(false, 'cross-owner check needs a second creator in the dev catalog');
    }
  } finally {
    const r = await patch(restore);
    if ((await getMine()).status !== snap.status) await req('PATCH', `/catalog/creators/${id}`, admin, { status: snap.status });
    console.log('restore →', r.status, r.body.error || '');
  }
}

async function main() {
  rules();
  normalizer();
  model();
  await api();
  console.log(`\n=== ${PASS.length} passed, ${FAIL.length} failed ===`);
  if (FAIL.length) {
    for (const f of FAIL) console.log(' -', f);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
