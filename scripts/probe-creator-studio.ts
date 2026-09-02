/**
 * Creator Studio probe — canonical PATCH persistence + platform-field lockdown.
 * Permanent suite member — `npm run test:creator-studio`.
 *
 * Guarantees:
 *  - a Creator PATCHing their OWN profile round-trips every editable field
 *  - forged `userId` cannot transfer ownership
 *  - cross-owner PATCH → 403
 *  - a Creator can never set Trust score / followers / verifiedStatus / featuredFlag
 *  - a marketplace-pending Creator cannot self-publish (status stays); staff can,
 *    and the public list then resolves the creator
 *  - `editorModelToCreatorSectionPatch` omits status / verifiedStatus but keeps
 *    the complete nested objects the normalizer needs
 *  - the creator version/snapshot endpoint records a save
 *
 * Deterministic; safe to re-run. Needs the dev API on :3001 + the seeded
 * `creator@choosify.com.bd` account.
 */
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
  return { token };
}
const H = (t?: string) => ({ 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) });
async function req(method: string, path: string, token?: string, body?: unknown) {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: H(token),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return { status: r.status, body: await j(r) };
}

async function main() {
  const admin = await login('admin@choosify.com.bd');
  const creator = await login('creator@choosify.com.bd');

  const ensure = await req('POST', '/catalog/workspace/creator/ensure', creator.token, {});
  const own = ensure.body.creators?.[0];
  check(!!own?.id, 'ensureCreatorWorkspace resolves the creator’s own row', own?.id);
  const cid = own.id;
  const baseline = {
    score: own.score,
    followers: JSON.stringify(own.followers || {}),
    verifiedStatus: own.verifiedStatus,
    featuredFlag: own.featuredFlag,
    userId: own.userId,
    status: own.status,
  };

  // scoped list → the creator only ever sees their own row
  const getMine = async () => {
    const list = (await req('GET', '/catalog/creators', creator.token)).body.data || [];
    return list.find((x: any) => x.id === cid);
  };

  // ── 1. Own PATCH round-trips editable fields ───────────────────────────
  const marker = `probe-${Date.now()}`;
  const patch1 = await req('PATCH', `/catalog/creators/${cid}`, creator.token, {
    bio: `${marker} bio`,
    role: `${marker} role`,
    location: 'Probe City',
    socialLinks: { youtube: 'https://youtube.com/@probe', instagram: 'https://instagram.com/probe' },
    bestForTags: ['Probe Topic A', 'Probe Topic B'],
    platforms: ['YouTube', 'Instagram'],
    brandPartners: [{ name: 'ProbeBrand' }],
    collabTypes: ['Sponsored review'],
    email: 'probe@creator.test',
    responseTime: 'Within 12 hours',
  });
  check(patch1.status === 200, 'own creator PATCH → 200', patch1.status);
  const c1 = patch1.body?.data;
  check(c1?.bio === `${marker} bio` && c1?.role === `${marker} role`, 'PATCH: bio + role round-trip', { bio: c1?.bio, role: c1?.role });
  check(
    c1?.socialLinks?.youtube === 'https://youtube.com/@probe' &&
      c1?.socialLinks?.instagram === 'https://instagram.com/probe',
    'PATCH: full socialLinks object preserved (no key erased)',
    c1?.socialLinks,
  );
  check(
    JSON.stringify(c1?.bestForTags) === JSON.stringify(['Probe Topic A', 'Probe Topic B']) &&
      JSON.stringify(c1?.collabTypes) === JSON.stringify(['Sponsored review']) &&
      JSON.stringify(c1?.brandPartners?.map((b: any) => b.name)) === JSON.stringify(['ProbeBrand']),
    'PATCH: expertise / collab / brandPartners arrays round-trip',
    { bestForTags: c1?.bestForTags, collabTypes: c1?.collabTypes },
  );
  const reload1 = await getMine();
  check(reload1?.bio === `${marker} bio`, 'PATCH: survives a fresh GET (persisted, not just echoed)', reload1?.bio);

  // ── 1b. Custom social links + brand-partner logo/brandId + Featured Content ──
  const anyBrand = (await req('GET', '/catalog/brands', creator.token)).body.data?.[0];
  const patchRich = await req('PATCH', `/catalog/creators/${cid}`, creator.token, {
    socialLinks: {
      youtube: 'https://youtube.com/@probe',
      custom: [
        { label: 'Twitch', url: 'https://twitch.tv/probe' },
        { label: 'Bad', url: 'javascript:alert(1)' }, // dropped: unsafe
        { label: '', url: 'https://x.com/probe' }, // dropped: no label
      ],
    },
    brandPartners: [
      ...(anyBrand ? [{ name: anyBrand.name, brandId: anyBrand.id }] : []),
      { name: 'Custom Co', logo: 'https://cdn.example.com/customco.png' },
      { name: 'Evil Co', logo: 'javascript:alert(1)' }, // logo dropped, name kept
    ],
    featuredContent: [
      { id: 'f-ext', source: 'external', kind: 'link', title: 'My best video', url: 'https://youtube.com/watch?v=x', thumbnail: 'https://cdn.example.com/t.jpg' },
      { id: 'f-bad', source: 'external', kind: 'link', title: 'No URL' }, // dropped: no url
    ],
  });
  const cr = patchRich.body?.data;
  check(
    JSON.stringify(cr?.socialLinks?.custom) === JSON.stringify([{ label: 'Twitch', url: 'https://twitch.tv/probe' }]),
    'social: only a valid { label, url } custom link survives (unsafe / unlabelled dropped)',
    cr?.socialLinks?.custom,
  );
  const cco = (cr?.brandPartners || []).find((b: any) => b.name === 'Custom Co');
  const evil = (cr?.brandPartners || []).find((b: any) => b.name === 'Evil Co');
  check(cco?.logo === 'https://cdn.example.com/customco.png', 'partnerships: custom brand keeps an https logo', cco);
  check(evil && !evil.logo, 'partnerships: unsafe brand logo dropped, name kept', evil);
  if (anyBrand) {
    const tagged = (cr?.brandPartners || []).find((b: any) => b.brandId === anyBrand.id);
    check(!!tagged, 'partnerships: a tagged Choosify brand carries its brandId', tagged);
  }
  check(
    Array.isArray(cr?.featuredContent) &&
      cr.featuredContent.length === 1 &&
      cr.featuredContent[0].title === 'My best video' &&
      cr.featuredContent[0].source === 'external',
    'featured: a valid external item round-trips; an item with no url is dropped',
    cr?.featuredContent,
  );
  const reloadRich = await getMine();
  check(
    reloadRich?.socialLinks?.custom?.[0]?.label === 'Twitch' && reloadRich?.featuredContent?.[0]?.title === 'My best video',
    'social.custom + featuredContent survive a fresh GET',
    { custom: reloadRich?.socialLinks?.custom, featured: reloadRich?.featuredContent },
  );

  // ── 2. Platform-owned fields cannot be set by the creator ──────────────
  const patchPlat = await req('PATCH', `/catalog/creators/${cid}`, creator.token, {
    score: 100,
    followers: { YouTube: '99999999' },
    verifiedStatus: !baseline.verifiedStatus,
    featuredFlag: !baseline.featuredFlag,
    userId: 'attacker-user-id',
    bio: `${marker} bio 2`,
  });
  check(patchPlat.status === 200, 'creator PATCH with platform fields still → 200 (fields ignored, not rejected)', patchPlat.status);
  const c2 = patchPlat.body?.data;
  check(c2?.score === baseline.score, 'creator cannot change Trust score', { was: baseline.score, now: c2?.score });
  check(JSON.stringify(c2?.followers || {}) === baseline.followers, 'creator cannot change followers', c2?.followers);
  check(c2?.verifiedStatus === baseline.verifiedStatus, 'creator cannot self-verify', { was: baseline.verifiedStatus, now: c2?.verifiedStatus });
  check(c2?.featuredFlag === baseline.featuredFlag, 'creator cannot set featured flag', c2?.featuredFlag);
  check(c2?.userId === baseline.userId, 'forged userId cannot transfer ownership', { was: baseline.userId, now: c2?.userId });
  check(c2?.bio === `${marker} bio 2`, 'a legit field in the same body still saves', c2?.bio);

  // ── 3. Cross-owner PATCH → 403 ────────────────────────────────────────
  const otherId = `creator-probe-other-${Date.now()}`;
  await req('PUT', `/catalog/creators/${otherId}`, admin.token, {
    id: otherId,
    name: '[probe] Other Owner',
    handle: '@probeother',
    userId: 'a-different-user',
    status: 'draft',
  });
  const cross = await req('PATCH', `/catalog/creators/${otherId}`, creator.token, { bio: 'hijack attempt' });
  check(cross.status === 403, 'cross-owner PATCH → 403', cross.status);

  // ── 4. Lifecycle is server-authoritative ─────────────────────────────
  // Marketplace access for a grandfathered creator is derived from its own
  // published state, so force draft first to guarantee the "pending" lock is
  // in effect regardless of leftover state from an earlier run.
  await req('PATCH', `/catalog/creators/${cid}`, admin.token, { status: 'draft' });
  const selfPublish = await req('PATCH', `/catalog/creators/${cid}`, creator.token, { status: 'live' });
  check(
    (selfPublish.body?.data?.status ?? 'draft') !== 'live',
    'a marketplace-pending creator cannot self-publish (status stays)',
    selfPublish.body?.data?.status,
  );
  // staff can publish → public list resolves it
  await req('PATCH', `/catalog/creators/${cid}`, admin.token, { status: 'live' });
  const anonLive = (await req('GET', '/catalog/creators')).body.data || [];
  check(anonLive.some((x: any) => x.id === cid), 'after a staff publish the public list resolves the creator', anonLive.length);
  await req('PATCH', `/catalog/creators/${cid}`, admin.token, { status: baseline.status });
  const anonDraft = (await req('GET', '/catalog/creators')).body.data || [];
  check(
    baseline.status === 'live' || !anonDraft.some((x: any) => x.id === cid),
    'reverting to draft removes it from the public list again',
    anonDraft.length,
  );

  // ── 5. Section-patch payload shape ───────────────────────────────────
  const { editorModelToCreatorSectionPatch, mapCatalogCreatorToEditor } = await import(
    '../src/pages/admin/creatorEditorModel'
  );
  const sectionPayload = editorModelToCreatorSectionPatch(mapCatalogCreatorToEditor(c2 || own)) as Record<string, unknown>;
  check(
    !('status' in sectionPayload) && !('verifiedStatus' in sectionPayload),
    'editorModelToCreatorSectionPatch omits status + verifiedStatus',
    Object.keys(sectionPayload),
  );
  check(
    'socialLinks' in sectionPayload && 'brandPartners' in sectionPayload && 'collabTypes' in sectionPayload,
    'section patch still carries the complete nested objects the normalizer needs',
    Object.keys(sectionPayload),
  );

  // ── 6. Snapshot history records a save ───────────────────────────────
  const mkVersion = await req('POST', `/catalog/creator/${cid}/versions`, creator.token, {
    label: `probe snapshot ${Date.now()}`,
    snapshot: { bio: 'snapshot body' },
  });
  const vlist = await req('GET', `/catalog/creator/${cid}/versions`, creator.token);
  check(
    (mkVersion.status === 200 || mkVersion.status === 201) && Array.isArray(vlist.body?.data),
    'creator version/snapshot endpoint records + lists a save (history not silently dropped)',
    { mk: mkVersion.status, listCount: Array.isArray(vlist.body?.data) ? vlist.body.data.length : vlist.status },
  );

  // cleanup — restore platform fields + a sane demo profile for visual review
  await req('DELETE', `/catalog/creators/${otherId}`, admin.token).catch(() => {});
  await req('PATCH', `/catalog/creators/${cid}`, admin.token, {
    score: baseline.score,
    followers: JSON.parse(baseline.followers),
    verifiedStatus: baseline.verifiedStatus,
    featuredFlag: baseline.featuredFlag,
  });
  await req('PATCH', `/catalog/creators/${cid}`, creator.token, {
    bio: 'Consumer tech reviewer in Dhaka. Six years testing phones, laptops and audio for Bangladeshi buyers.',
    role: 'Senior Reviewer',
    location: 'Dhaka, Bangladesh',
    bestForTags: ['Phones', 'Laptops', 'Audio'],
    platforms: ['YouTube', 'Instagram'],
    email: 'rifat@example.com',
    responseTime: 'Within 24 hours',
    preferredContact: 'Email',
    collabTypes: ['Sponsored review', 'Long-term ambassador'],
    brandPartners: [
      { name: 'Samsung' },
      { name: 'Walton' },
      { name: 'Independent Import Co', logo: 'https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=80&q=80' },
    ],
    socialLinks: {
      youtube: 'https://youtube.com/@rifathasan',
      instagram: 'https://instagram.com/rifathasan',
      custom: [{ label: 'Twitch', url: 'https://twitch.tv/rifathasan' }],
    },
    featuredContent: [
      {
        id: 'demo-ext-1',
        source: 'external',
        kind: 'link',
        title: 'My 2026 flagship shootout (YouTube)',
        url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
        thumbnail: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400&q=80',
      },
    ],
  });

  console.log(`\n=== ${PASS.length} passed, ${FAIL.length} failed ===`);
  if (FAIL.length) {
    console.log('FAILURES:\n - ' + FAIL.join('\n - '));
    process.exit(1);
  }
  console.log('ALL CREATOR STUDIO CHECKS PASSED');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
