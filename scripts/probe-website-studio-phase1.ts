/**
 * Website Studio Phase 1 probe — API authorization, draft/publish/version/rollback semantics,
 * preview tokens, public read isolation, validation and DB immutability.
 *
 * ISOLATED STACK ONLY: refuses to run unless API_BASE is localhost and DATABASE_URL points at
 * the isolated QA database (port 55499). Needs a FRESH backfill (unpublished baselines) first.
 *
 *   API_BASE=http://localhost:3001/api/v1 npx tsx scripts/probe-website-studio-phase1.ts
 */
import pg from 'pg';

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
  console.log(ok ? 'PASS' : 'FAIL', label, ok ? '' : JSON.stringify(detail ?? '').slice(0, 400));
};

async function login(email: string): Promise<string> {
  const r = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: PASSWORD }) });
  const j = (await r.json()) as { accessToken?: string };
  if (!j.accessToken) throw new Error(`login failed for ${email}`);
  return j.accessToken;
}

async function call(token: string | null, method: string, path: string, body?: unknown) {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json: any = null;
  try {
    json = await r.json();
  } catch {
    /* empty body */
  }
  return { status: r.status, json, headers: r.headers };
}

const company = (overrides: Record<string, unknown> = {}) => ({
  displayName: 'Choosify',
  legalName: '',
  supportEmail: 'support@choosify.bd',
  supportPhone: '+88 0141 0474014',
  offices: [{ id: 'bangladesh', label: 'Bangladesh Office', lines: ['Mirpur DOHS, Dhaka-1216', 'Bangladesh'], enabled: true }],
  identifiers: { dbid: { value: '', verified: false }, tradeLicense: { value: '', verified: false } },
  copyrightText: '',
  ...overrides,
});

async function main() {
  const superAdmin = await login('admin@choosify.com.bd');
  const admin = await login('admin-role@choosify.test');
  const moderator = await login('moderator@choosify.com.bd');
  const marketing = await login('marketing@choosify.com.bd');
  const seller = await login('seller@choosify.com.bd');

  // --- Capabilities + authorization matrix ---------------------------------------------------
  const caps = async (t: string) => (await call(t, 'GET', '/website/capabilities')).json?.data;
  const sa = await caps(superAdmin);
  check('super admin: can edit, publish and publish legal', sa?.canEdit && sa?.canPublish && sa?.canPublishLegal, sa);
  for (const [name, t] of [['admin', admin], ['moderator', moderator], ['marketing manager', marketing]] as const) {
    const c = await caps(t);
    check(`${name}: can edit drafts but NOT publish or publish legal (cms:edit does not imply publish)`, c?.canEdit === true && c?.canPublish === false && c?.canPublishLegal === false, c);
  }
  check('seller: no Website Studio access at all (403)', (await call(seller, 'GET', '/website/documents')).status === 403);
  check('signed-out: no staff access (401)', (await call(null, 'GET', '/website/documents')).status === 401);

  // --- Backfill = UNPUBLISHED baseline (v1 + identical draft, nothing public) ----------------
  const KEYS = ['company', 'brand_assets', 'navigation', 'footer', 'social', 'seo', 'homepage'];
  const baseline = await Promise.all(KEYS.map(async (k) => (await call(superAdmin, 'GET', `/website/documents/${k}`)).json?.data));
  check('backfill: all 7 documents have version 1 recorded but NOT published', baseline.every((d: any) => d?.latestVersion === 1 && d?.publishedVersion === null && d?.hasDraft === true), baseline.map((d: any) => [d?.key, d?.latestVersion, d?.publishedVersion, d?.hasDraft]));
  const v1 = (await call(superAdmin, 'GET', '/website/documents/company/versions/1')).json?.data;
  check('backfill: draft equals version 1 content', v1?.source === 'backfill' && JSON.stringify(v1?.content) === JSON.stringify(baseline[0]?.draft), v1);
  check('backfill: nothing is public yet (404)', (await call(null, 'GET', '/website/published/company')).status === 404);

  // --- First publish of the baseline (go-live) -------------------------------------------------
  const goLive = await call(superAdmin, 'POST', '/website/documents/company/publish', { changeNote: 'Go live with the imported settings', expectedRevision: baseline[0].draftRevision });
  check('publishing the baseline draft creates version 2 (v1 stays history)', goLive.status === 200 && goLive.json?.data?.published?.version === 2 && goLive.json?.data?.hasDraft === false, goLive.json);

  // --- Draft never changes public content ---------------------------------------------------
  const pubBefore = await call(null, 'GET', '/website/published/company');
  check('public: published company readable', pubBefore.status === 200 && pubBefore.json?.data?.content?.supportEmail === 'support@choosify.bd' && pubBefore.json?.data?.version === 2, pubBefore.json);
  const doc0 = (await call(superAdmin, 'GET', '/website/documents/company')).json?.data;
  const rev0 = doc0.draftRevision;
  const save = await call(marketing, 'PUT', '/website/documents/company/draft', { content: company({ supportEmail: 'hello-draft@choosify.bd' }), expectedRevision: rev0 });
  check('marketing manager can save a draft', save.status === 200 && save.json?.data?.hasDraft === true, save.json);
  const pubAfterDraft = await call(null, 'GET', '/website/published/company');
  check('Save Draft does NOT change public content', pubAfterDraft.json?.data?.content?.supportEmail === 'support@choosify.bd' && pubAfterDraft.json?.data?.version === pubBefore.json?.data?.version, pubAfterDraft.json);
  check('public published response is never the draft', !JSON.stringify(pubAfterDraft.json).includes('hello-draft'));
  check('public reads have a short cache; drafts are not exposed', /max-age=30/.test(pubAfterDraft.headers.get('cache-control') || ''));

  // --- Stale-write guard ----------------------------------------------------------------------
  const stale = await call(moderator, 'PUT', '/website/documents/company/draft', { content: company({ supportEmail: 'other@choosify.bd' }), expectedRevision: rev0 });
  check('a second editor with an old revision gets 409 STALE_DRAFT', stale.status === 409 && stale.json?.code === 'STALE_DRAFT', stale.json);

  // --- Publish permissions ------------------------------------------------------------------
  const rev1 = save.json.data.draftRevision;
  for (const [name, t] of [['admin', admin], ['moderator', moderator], ['marketing manager', marketing]] as const) {
    const r = await call(t, 'POST', '/website/documents/company/publish', { changeNote: 'Try publish', expectedRevision: rev1 });
    check(`${name} cannot publish (403 PUBLISH_FORBIDDEN)`, r.status === 403 && r.json?.code === 'PUBLISH_FORBIDDEN', r.json);
  }
  const noNote = await call(superAdmin, 'POST', '/website/documents/company/publish', { expectedRevision: rev1 });
  check('publish requires a change note', noNote.status === 400 && noNote.json?.code === 'CHANGE_NOTE_REQUIRED', noNote.json);
  const pub = await call(superAdmin, 'POST', '/website/documents/company/publish', { changeNote: 'Update support email', expectedRevision: rev1 });
  check('super admin publishes → version 3, draft cleared', pub.status === 200 && pub.json?.data?.published?.version === 3 && pub.json?.data?.hasDraft === false, pub.json);
  const pubNow = await call(null, 'GET', '/website/published/company');
  check('public now shows version 3 content', pubNow.json?.data?.version === 3 && pubNow.json?.data?.content?.supportEmail === 'hello-draft@choosify.bd', pubNow.json);
  const republish = await call(superAdmin, 'POST', '/website/documents/company/publish', { changeNote: 'Again', expectedRevision: pub.json.data.draftRevision });
  check('publishing with no draft → 409 NO_DRAFT', republish.status === 409 && republish.json?.code === 'NO_DRAFT', republish.json);

  // --- Versions + rollback ------------------------------------------------------------------
  const versions = (await call(admin, 'GET', '/website/documents/company/versions')).json?.data ?? [];
  check('history lists v3 (publish), v2 (publish), v1 (backfill), newest first, with notes', versions[0]?.version === 3 && versions[0]?.source === 'publish' && versions[2]?.source === 'backfill' && versions[0]?.changeNote === 'Update support email', versions);
  check('admin (edit only) cannot roll back', (await call(admin, 'POST', '/website/documents/company/rollback', { version: 2, changeNote: 'Back' })).status === 403);
  const rb = await call(superAdmin, 'POST', '/website/documents/company/rollback', { version: 2, changeNote: 'Restore original support email' });
  check('rollback to v2 creates a NEW version 4 (history kept)', rb.status === 200 && rb.json?.data?.published?.version === 4, rb.json);
  const v4 = (await call(superAdmin, 'GET', '/website/documents/company/versions/4')).json?.data;
  check('v4 is a rollback copied from v2', v4?.source === 'rollback' && v4?.restoredFromVersion === 2 && v4?.content?.supportEmail === 'support@choosify.bd', v4);
  check('v3 still exists unchanged after rollback', (await call(superAdmin, 'GET', '/website/documents/company/versions/3')).json?.data?.content?.supportEmail === 'hello-draft@choosify.bd');
  check('public shows the rolled-back content', (await call(null, 'GET', '/website/published/company')).json?.data?.content?.supportEmail === 'support@choosify.bd');

  // --- Restore defaults goes to DRAFT only ----------------------------------------------------
  const before = (await call(null, 'GET', '/website/published/company')).json?.data;
  const docR = (await call(superAdmin, 'GET', '/website/documents/company')).json?.data;
  const rd = await call(marketing, 'POST', '/website/documents/company/restore-defaults', { expectedRevision: docR.draftRevision });
  check('Reset Defaults puts defaults into the draft', rd.status === 200 && rd.json?.data?.hasDraft === true && rd.json?.data?.draft?.supportEmail === '', rd.json);
  const after = (await call(null, 'GET', '/website/published/company')).json?.data;
  check('Reset Defaults does NOT change public content', after?.version === before?.version && after?.content?.supportEmail === 'support@choosify.bd', after);
  const dd = await call(marketing, 'DELETE', `/website/documents/company/draft?expectedRevision=${rd.json.data.draftRevision}`);
  check('draft can be discarded', dd.status === 200 && dd.json?.data?.hasDraft === false, dd.json);

  // --- Preview tokens -------------------------------------------------------------------------
  const docP = (await call(superAdmin, 'GET', '/website/documents/brand_assets')).json?.data;
  await call(marketing, 'PUT', '/website/documents/brand_assets/draft', {
    content: { primaryLogo: { url: '/media/cms/logo-draft.png', alt: 'Choosify logo' } },
    expectedRevision: docP.draftRevision,
  });
  const tok = await call(marketing, 'POST', '/website/documents/brand_assets/preview-token');
  check('editor gets a short-lived preview token (15 min)', tok.status === 200 && tok.json?.data?.ttlSeconds === 900 && typeof tok.json?.data?.token === 'string', tok.json);
  const t = tok.json.data.token as string;
  const prev = await call(null, 'GET', `/website/preview/brand_assets?token=${encodeURIComponent(t)}`);
  check('preview token opens the draft without login', prev.status === 200 && prev.json?.data?.content?.primaryLogo?.url === '/media/cms/logo-draft.png', prev.json);
  check('preview response: no-store + noindex', /no-store/.test(prev.headers.get('cache-control') || '') && /noindex/.test(prev.headers.get('x-robots-tag') || ''));
  check('preview token is scoped: cannot open another document', (await call(null, 'GET', `/website/preview/company?token=${encodeURIComponent(t)}`)).status === 401);
  check('no/garbage token → 401', (await call(null, 'GET', '/website/preview/brand_assets?token=abc')).status === 401 && (await call(null, 'GET', '/website/preview/brand_assets')).status === 401);
  check('preview token is not a login token (staff API rejects it)', (await call(t, 'GET', '/website/documents')).status === 401);
  check('login token is not a preview token', (await call(null, 'GET', `/website/preview/brand_assets?token=${encodeURIComponent(superAdmin)}`)).status === 401);
  check('public published brand assets still the backfill (draft not leaked)', !JSON.stringify((await call(null, 'GET', '/website/published/brand_assets')).json).includes('logo-draft'));

  // --- Validation -----------------------------------------------------------------------------
  const docV = (await call(superAdmin, 'GET', '/website/documents/brand_assets')).json?.data;
  const bad = async (content: unknown) => (await call(superAdmin, 'PUT', '/website/documents/brand_assets/draft', { content, expectedRevision: docV.draftRevision })).json;
  check('rejects javascript: URLs', (await bad({ primaryLogo: { url: 'javascript:alert(1)', alt: 'x' } }))?.code === 'INVALID_CONTENT');
  check('rejects http (non-https) URLs', (await bad({ primaryLogo: { url: 'http://evil.example/logo.png', alt: 'x' } }))?.code === 'INVALID_CONTENT');
  check('rejects HTML in text', (await bad({ primaryLogo: { url: '/media/cms/a.png', alt: '<img src=x onerror=alert(1)>' } }))?.code === 'INVALID_CONTENT');
  check('requires alt text for public images', (await bad({ primaryLogo: { url: '/media/cms/a.png', alt: '' } }))?.field === 'primaryLogo.alt');
  check('rejects unknown asset slots', (await bad({ hackSlot: { url: '/media/cms/a.png', alt: 'x' } }))?.code === 'INVALID_CONTENT');
  const docC = (await call(superAdmin, 'GET', '/website/documents/company')).json?.data;
  const badC = async (overrides: Record<string, unknown>) =>
    (await call(superAdmin, 'PUT', '/website/documents/company/draft', { content: company(overrides), expectedRevision: docC.draftRevision })).json;
  check('company: rejects invalid email', (await badC({ supportEmail: 'not-an-email' }))?.field === 'supportEmail');
  check('company: a verified identifier needs a value', (await badC({ identifiers: { dbid: { value: '', verified: true }, tradeLicense: { value: '', verified: false } } }))?.code === 'INVALID_CONTENT');
  check('read-only kinds cannot be edited yet (409)', (await call(superAdmin, 'PUT', '/website/documents/filters/draft', { content: {}, expectedRevision: 0 })).json?.code === 'NOT_EDITABLE_YET');
  check('unknown document key → 404', (await call(superAdmin, 'GET', '/website/documents/not:valid key')).status === 404);

  // --- Legal documents --------------------------------------------------------------------------
  check('an unpublished legal document is not public (404)', (await call(null, 'GET', '/website/published/legal:terms')).status === 404);
  const legalPub = await call(superAdmin, 'POST', '/website/documents/legal:terms/publish', { changeNote: 'x x x', expectedRevision: 0 });
  check('legal: nothing to publish without a draft (and never auto-published)', legalPub.status === 409 || legalPub.status === 404, legalPub.json);
  check('legal publish is refused for admin role (403)', (await call(admin, 'POST', '/website/documents/legal:terms/publish', { changeNote: 'try', expectedRevision: 0 })).status === 403);

  // --- DB immutability --------------------------------------------------------------------------
  const client = new pg.Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    let updateBlocked = false;
    try {
      await client.query("UPDATE website_versions SET change_note = 'tamper' WHERE document_key = 'company' AND version = 1");
    } catch {
      updateBlocked = true;
    }
    check('DB: UPDATE on website_versions is rejected (immutable)', updateBlocked);
    let deleteBlocked = false;
    try {
      await client.query("DELETE FROM website_versions WHERE document_key = 'company' AND version = 1");
    } catch {
      deleteBlocked = true;
    }
    check('DB: DELETE on website_versions is rejected (immutable)', deleteBlocked);
    let docDeleteBlocked = false;
    try {
      await client.query("DELETE FROM website_documents WHERE key = 'company'");
    } catch {
      docDeleteBlocked = true;
    }
    check('DB: a document with versions cannot be deleted (RESTRICT)', docDeleteBlocked);
    let badSlug = false;
    try {
      await client.query("INSERT INTO website_pages (slug, document_key, page_type) VALUES ('Bad Slug', 'company', 'custom')");
    } catch {
      badSlug = true;
    }
    check('DB: invalid page slug rejected', badSlug);
  } finally {
    await client.end();
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error('PROBE CRASHED', e);
  process.exit(1);
});
