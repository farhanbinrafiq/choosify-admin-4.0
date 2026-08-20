/**
 * Pre-VPS self-hosting pass — regression coverage for the application-owned
 * media storage pipeline (server/lib/mediaStorage.ts, server/media/*,
 * catalogRouter.ts POST/DELETE /catalog/media/upload, operationsRouter.ts
 * upload-resume / upload-verification).
 *
 * Usage: npx tsx scripts/probe-media-upload.ts
 */
import { spawn } from 'node:child_process';

const BASE = process.env.PROBE_BASE_URL_ROOT || 'http://localhost:3001';
const V1 = `${BASE}/api/v1`;
const ADMIN_EMAIL = 'admin@choosify.com.bd';
const DEV_PASS = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function killPort(port: number): Promise<void> {
  return new Promise((resolve) => {
    const ps = spawn(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        `$conns = Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique; foreach ($p in $conns) { if ($p -and $p -ne 0) { Stop-Process -Id $p -Force -ErrorAction SilentlyContinue } }`,
      ],
      { stdio: 'ignore' },
    );
    ps.on('exit', () => resolve());
    ps.on('error', () => resolve());
  });
}

async function waitForHealth(timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${BASE}/health`);
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await delay(500);
  }
  throw new Error('Server did not become healthy after restart');
}

const fails: string[] = [];
function assert(cond: unknown, label: string, detail?: unknown) {
  if (cond) console.log('PASS', label);
  else {
    fails.push(label);
    console.log('FAIL', label, detail ?? '');
  }
}

type Json = Record<string, unknown>;

// A genuinely valid, tiny 1x1 red PNG (so Sharp can actually decode it).
const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

async function post(path: string, body: unknown, token?: string) {
  const res = await fetch(`${V1}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Json;
  return { ok: res.ok, status: res.status, data };
}

async function del(path: string, token?: string) {
  const res = await fetch(`${V1}${path}`, {
    method: 'DELETE',
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  const data = (await res.json().catch(() => ({}))) as Json;
  return { ok: res.ok, status: res.status, data };
}

async function login(email: string, password: string): Promise<string> {
  const res = await post('/auth/login', { email, password });
  if (!res.ok || typeof res.data.accessToken !== 'string') throw new Error(`login failed: ${res.status}`);
  return res.data.accessToken as string;
}

async function register(email: string): Promise<string> {
  await post('/auth/register', { email, password: 'RoleTest!2026', fullName: 'Media Probe' });
  return login(email, 'RoleTest!2026');
}

async function main() {
  const stamp = Date.now();
  const admin = await login(ADMIN_EMAIL, DEV_PASS);

  // --- 1. Admin CMS / product image upload succeeds, produces a real local URL ---
  const uploadRes = await post(
    '/catalog/media/upload',
    { data: TINY_PNG_BASE64, mimeType: 'image/png', fileName: 'test.png', category: 'products' },
    admin,
  );
  assert(uploadRes.ok, 'Admin: product image upload succeeds', uploadRes);
  const mediaUrl = uploadRes.data.url as string | undefined;
  const mediaId = uploadRes.data.mediaId as string | undefined;
  assert(!!mediaUrl && mediaUrl.startsWith('/media/products/'), 'uploaded file gets a local /media/products/... URL', mediaUrl);
  assert(!!uploadRes.data.thumbnailUrl, 'a thumbnail variant is produced for image uploads', uploadRes.data);

  // --- 2. The uploaded file is actually retrievable over HTTP (real bytes on disk) ---
  if (mediaUrl) {
    const fetchRes = await fetch(`${BASE}${mediaUrl}`);
    assert(fetchRes.ok, 'uploaded local media URL is fetchable and returns real bytes', fetchRes.status);
    const contentType = fetchRes.headers.get('content-type') || '';
    assert(contentType.includes('webp'), 'stored image was re-encoded to webp', contentType);
  }

  // --- 3. Seller/Creator/CMS category uploads (same endpoint, different category) ---
  for (const category of ['brands', 'creators', 'cms', 'ads'] as const) {
    const res = await post('/catalog/media/upload', { data: TINY_PNG_BASE64, mimeType: 'image/png', fileName: 'x.png', category }, admin);
    assert(res.ok && (res.data.url as string)?.includes(`/media/${category}/`), `${category} category upload lands in the right folder`, res.data);
  }

  // --- 4. Unauthorized cross-account: a plain consumer cannot use the catalog-media upload gate ---
  const consumer = await register(`media-probe-consumer-${stamp}@test.choosify.bd`);
  const consumerUpload = await post(
    '/catalog/media/upload',
    { data: TINY_PNG_BASE64, mimeType: 'image/png', fileName: 'x.png', category: 'products' },
    consumer,
  );
  assert(consumerUpload.status === 403, 'a plain consumer without catalog-media permission is denied (403)', consumerUpload.status);

  // --- 5. Invalid MIME type is rejected ---
  const badMime = await post(
    '/catalog/media/upload',
    { data: TINY_PNG_BASE64, mimeType: 'application/octet-stream', fileName: 'x.bin', category: 'products' },
    admin,
  );
  assert(badMime.status === 400, 'unsupported MIME type is rejected with 400', badMime.status);

  // --- 6. Executable/script file rejected (by MIME + extension, whatever the caller claims) ---
  const exeAttempt = await post(
    '/catalog/media/upload',
    { data: Buffer.from('MZ fake exe header').toString('base64'), mimeType: 'application/x-msdownload', fileName: 'virus.exe', category: 'products' },
    admin,
  );
  assert(exeAttempt.status === 400, 'an .exe upload is rejected outright', exeAttempt.status);

  const svgAttempt = await post(
    '/catalog/media/upload',
    { data: Buffer.from('<svg onload=alert(1)></svg>').toString('base64'), mimeType: 'image/svg+xml', fileName: 'x.svg', category: 'products' },
    admin,
  );
  assert(svgAttempt.status === 400, 'SVG upload is rejected (not in the allowed MIME set)', svgAttempt.status);

  // --- 7. Filename/path traversal attempt cannot escape the category folder ---
  const traversalAttempt = await post(
    '/catalog/media/upload',
    { data: TINY_PNG_BASE64, mimeType: 'image/png', fileName: '../../../../etc/passwd.png', category: 'products' },
    admin,
  );
  assert(traversalAttempt.ok, 'a malicious filename does not crash the upload (server-generated filenames ignore it)', traversalAttempt.status);
  const traversalUrl = traversalAttempt.data.url as string | undefined;
  assert(
    !!traversalUrl && !traversalUrl.includes('..') && traversalUrl.startsWith('/media/products/'),
    'the resulting URL is a clean, server-generated path with no trace of the malicious filename',
    traversalUrl,
  );

  // --- 8. Oversized file is rejected ---
  const oversized = Buffer.alloc(6 * 1024 * 1024, 1).toString('base64'); // ~6MB, default cap is 5MB
  const oversizedRes = await post(
    '/catalog/media/upload',
    { data: oversized, mimeType: 'image/png', fileName: 'huge.png', category: 'products' },
    admin,
  );
  assert(
    oversizedRes.status === 400 || oversizedRes.status === 413,
    'an oversized upload is rejected (400 from validation, or 413 from the body-size limit)',
    oversizedRes.status,
  );

  // --- 9. Deletion: uploader can delete their own media; another actor cannot ---
  if (mediaId) {
    const otherSeller = await register(`media-probe-other-${stamp}@test.choosify.bd`);
    const foreignDelete = await del(`/catalog/media/${mediaId}`, otherSeller);
    assert(foreignDelete.status === 403 || foreignDelete.status === 401, 'a different actor cannot delete someone else\'s media', foreignDelete.status);

    const ownDelete = await del(`/catalog/media/${mediaId}`, admin);
    assert(ownDelete.ok, 'the original uploader (here, admin) can delete their own media', ownDelete.status);

    if (mediaUrl) {
      const afterDelete = await fetch(`${BASE}${mediaUrl}`);
      assert(afterDelete.status === 404, 'the physical file is actually gone after deletion, not just the DB record', afterDelete.status);
    }
  }

  // --- 10. Verification upload endpoint (brand/creator claim docs) is now PRIVATE end-to-end ---
  const verificationRes = await post(
    '/operations/media/upload-verification',
    { data: TINY_PNG_BASE64, mimeType: 'image/png', fileName: 'nid.png' },
    consumer,
  );
  assert(verificationRes.ok, 'verification image upload (claim flow) succeeds', verificationRes);
  const verificationUrl = verificationRes.data.url as string | undefined;
  assert(
    !!verificationUrl && verificationUrl.startsWith('/api/v1/catalog/media/private/'),
    'verification upload returns a private reference URL, not a public /media/ URL',
    verificationRes.data,
  );

  // --- 10b. Private document: unauthenticated access denied ---
  if (verificationUrl) {
    const unauthPrivate = await fetch(`${BASE}${verificationUrl}`);
    assert(unauthPrivate.status === 401, 'private document: unauthenticated access is denied (401)', unauthPrivate.status);

    // --- 10c. Private document: a different, unrelated user is denied ---
    const otherUser = await register(`media-probe-private-other-${stamp}@test.choosify.bd`);
    const crossUserPrivate = await fetch(`${BASE}${verificationUrl}`, { headers: { Authorization: `Bearer ${otherUser}` } });
    assert(crossUserPrivate.status === 403, 'private document: a different user is denied (403)', crossUserPrivate.status);

    // --- 10d. Private document: the uploader themselves CAN access it ---
    const ownerPrivate = await fetch(`${BASE}${verificationUrl}`, { headers: { Authorization: `Bearer ${consumer}` } });
    assert(ownerPrivate.ok, 'private document: the uploader can access their own document', ownerPrivate.status);

    // --- 10e. Private document: an admin CAN access it (claim review) ---
    const adminPrivate = await fetch(`${BASE}${verificationUrl}`, { headers: { Authorization: `Bearer ${admin}` } });
    assert(adminPrivate.ok, 'private document: an admin can access it for claim review', adminPrivate.status);
  }

  // --- 11. Server-restart persistence: an uploaded file + its DB record both survive ---
  const restartUpload = await post(
    '/catalog/media/upload',
    { data: TINY_PNG_BASE64, mimeType: 'image/png', fileName: 'restart-test.png', category: 'products' },
    admin,
  );
  assert(restartUpload.ok, 'restart-durability: pre-restart upload succeeds', restartUpload);
  const restartUrl = restartUpload.data.url as string | undefined;

  if (restartUrl && process.env.PROBE_BASE_URL_ROOT === undefined) {
    // Only restart the actual local process — never attempt this against a
    // remote PROBE_BASE_URL_ROOT target.
    await delay(500); // let the debounced-nothing (media writes are synchronous) settle either way
    console.log('Restarting API server on port 3001 for media restart-durability check…');
    await killPort(3001);
    await delay(2000);
    const child = spawn('npm', ['run', 'dev'], { cwd: process.cwd(), stdio: 'ignore', shell: true, detached: true });
    child.unref();
    await waitForHealth();
    console.log('Server healthy after restart');

    const afterRestart = await fetch(`${BASE}${restartUrl}`);
    assert(afterRestart.ok, 'restart-durability: uploaded file is still fetchable after a real server restart', afterRestart.status);
    const restartContentType = afterRestart.headers.get('content-type') || '';
    assert(restartContentType.includes('webp'), 'restart-durability: it is still the real image, not a fallback/placeholder', restartContentType);
  } else if (restartUrl) {
    console.log('SKIP restart-durability check (running against a remote PROBE_BASE_URL_ROOT — not restarting a remote process)');
  }

  console.log('\n=== MEDIA UPLOAD PROBE SUMMARY ===');
  if (fails.length) {
    console.error('FAILS:', fails);
    console.error(`RESULT: FAILED (${fails.length})`);
    process.exit(1);
  }
  console.log('RESULT: ALL PASSED');
}

main().catch((e) => {
  console.error('CRASH', e);
  process.exit(1);
});
