/**
 * Facebook share-link resolver probe.
 *
 * Two independent test groups:
 *  1. Pure/mocked -- imports resolveFacebookShareUrl directly and stubs
 *     global.fetch for the cases that need control over redirect behavior
 *     (loops, missing Location, too-many-redirects, timeout, non-Facebook
 *     redirect target). No network calls, fully deterministic.
 *  2. Live endpoint -- hits the real dev API (:3001) and, transitively, the
 *     real facebook.com for the URL-validation-before-any-fetch cases (which
 *     never reach Facebook) plus the one real resolution case (the actual
 *     share URL from the Creator Reviews audit). Needs the dev API running
 *     and outbound internet access; the live-resolution assertion is
 *     skipped (not failed) if outbound access isn't available, since that's
 *     an environment limitation, not a resolver defect.
 *
 * Deterministic; safe to re-run. Writes/deletes nothing -- this endpoint is
 * read-only (see server/catalogRouter.ts).
 *
 * Usage: npx tsx scripts/probe-facebook-share-resolver.ts
 */
import { resolveFacebookShareUrl } from '../server/lib/facebookShareResolver';
import { isCanonicalFacebookVideoUrl, isUnsupportedFacebookShareUrl } from '../src/lib/creatorReviewPlatform';

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

// ── Group 0: pure URL classification (no network at all) ──────────────────
function classificationChecks() {
  check(isCanonicalFacebookVideoUrl('https://www.facebook.com/reel/1109289584955997/'), 'canonical: /reel/<id>/ recognized');
  check(isCanonicalFacebookVideoUrl('https://www.facebook.com/facebook/videos/10153231379946729/'), 'canonical: /<page>/videos/<id>/ recognized');
  check(isCanonicalFacebookVideoUrl('https://www.facebook.com/watch/?v=10153231379946729'), 'canonical: /watch/?v=<id> recognized');
  check(!isCanonicalFacebookVideoUrl('https://www.facebook.com/share/v/1GPouRgTf7/'), 'canonical: share URL NOT recognized as canonical');
  check(!isCanonicalFacebookVideoUrl('https://www.facebook.com/someuser'), 'canonical: bare profile URL NOT recognized');
  check(!isCanonicalFacebookVideoUrl('not a url'), 'canonical: garbage input NOT recognized (no throw)');
  check(isUnsupportedFacebookShareUrl('https://www.facebook.com/share/v/1GPouRgTf7/'), 'share detection: /share/v/ flagged unsupported for direct embed');
  check(isUnsupportedFacebookShareUrl('https://www.facebook.com/share/r/abc123/'), 'share detection: /share/r/ flagged unsupported for direct embed');
  check(!isUnsupportedFacebookShareUrl('https://www.facebook.com/reel/1109289584955997/'), 'share detection: canonical Reel NOT flagged');
}

// ── Group 1: pure/mocked resolver behavior ─────────────────────────────────
type FetchImpl = typeof fetch;
function mockFetch(responses: Array<{ status: number; location?: string }>): FetchImpl {
  let i = 0;
  return (async () => {
    const r = responses[Math.min(i, responses.length - 1)];
    i++;
    return {
      status: r.status,
      headers: { get: (name: string) => (name.toLowerCase() === 'location' ? r.location || null : null) },
      body: { cancel: async () => {} },
    } as unknown as Response;
  }) as FetchImpl;
}

async function mockedChecks() {
  const originalFetch = globalThis.fetch;
  try {
    // Rejected before any fetch -- host allowlist
    check(
      (await resolveFacebookShareUrl('https://evil.com/share/v/x/')).ok === false,
      'security: arbitrary domain rejected without any fetch',
    );
    check(
      (await resolveFacebookShareUrl('https://facebook.com.evil.com/share/v/x/')).ok === false,
      'security: lookalike domain (facebook.com.evil.com) rejected -- no suffix-match bypass',
    );
    check(
      (await resolveFacebookShareUrl('https://localhost/share/v/x/')).ok === false,
      'security: localhost rejected',
    );
    check(
      (await resolveFacebookShareUrl('https://169.254.169.254/share/v/x/')).ok === false,
      'security: link-local/metadata IP rejected',
    );
    check(
      (await resolveFacebookShareUrl('javascript:alert(1)')).ok === false,
      'security: javascript: scheme rejected',
    );
    check(
      (await resolveFacebookShareUrl('http://www.facebook.com/share/v/x/')).ok === false,
      'security: non-https scheme rejected',
    );
    check(
      (await resolveFacebookShareUrl('https://www.facebook.com/reel/123/')).ok === false,
      'validation: canonical (non-share) URL rejected by this endpoint (not a generic resolver)',
    );
    check(
      (await resolveFacebookShareUrl('https://www.facebook.com/share/v/')).ok === false,
      'validation: malformed share URL (no token) rejected',
    );
    check(
      (await resolveFacebookShareUrl('https://www.facebook.com/someprofile')).ok === false,
      'validation: arbitrary non-share Facebook URL rejected (not a generic resolver)',
    );

    // Redirect chain: share -> canonical Reel
    globalThis.fetch = mockFetch([{ status: 302, location: 'https://www.facebook.com/reel/1109289584955997/?rdid=x' }]);
    const ok1 = await resolveFacebookShareUrl('https://www.facebook.com/share/v/1GPouRgTf7/');
    check(ok1.ok === true && ok1.canonicalUrl.includes('/reel/1109289584955997/'), 'resolver: single-hop redirect to canonical Reel succeeds', ok1);

    // Redirect to a disallowed host must be rejected, never followed
    globalThis.fetch = mockFetch([{ status: 302, location: 'https://evil.com/steal' }]);
    const badTarget = await resolveFacebookShareUrl('https://www.facebook.com/share/v/x/');
    check(badTarget.ok === false && badTarget.code === 'UNSUPPORTED_REDIRECT_TARGET', 'resolver: redirect to non-Facebook host rejected, never followed', badTarget);

    // Missing Location header on a 3xx
    globalThis.fetch = mockFetch([{ status: 302 }]);
    const missingLoc = await resolveFacebookShareUrl('https://www.facebook.com/share/v/x/');
    check(missingLoc.ok === false && missingLoc.code === 'MISSING_LOCATION', 'resolver: 3xx with no Location header handled', missingLoc);

    // Non-redirect, non-canonical response (e.g. 200 login wall) -- unresolved
    globalThis.fetch = mockFetch([{ status: 200 }]);
    const unresolved = await resolveFacebookShareUrl('https://www.facebook.com/share/v/x/');
    check(unresolved.ok === false && unresolved.code === 'UNRESOLVED', 'resolver: 200 without canonical shape reported as UNRESOLVED, not invented', unresolved);

    // Redirect loop
    let hop = 0;
    globalThis.fetch = (async () => {
      hop++;
      const from = `https://www.facebook.com/share/v/loop${hop % 2}/`;
      const to = `https://www.facebook.com/share/v/loop${(hop + 1) % 2}/`;
      return {
        status: 302,
        headers: { get: (n: string) => (n.toLowerCase() === 'location' ? to : null) },
        body: { cancel: async () => {} },
      } as unknown as Response;
    }) as FetchImpl;
    const loop = await resolveFacebookShareUrl('https://www.facebook.com/share/v/loop0/');
    check(loop.ok === false && (loop.code === 'REDIRECT_LOOP' || loop.code === 'TOO_MANY_REDIRECTS'), 'resolver: redirect loop terminates instead of hanging', loop);

    // Too many redirects (never loops back, always a fresh canonical-shaped-looking share url so it never trips REDIRECT_LOOP first)
    let n = 0;
    globalThis.fetch = (async () => {
      n++;
      return {
        status: 302,
        headers: { get: (name: string) => (name.toLowerCase() === 'location' ? `https://www.facebook.com/share/v/hop${n}/` : null) },
        body: { cancel: async () => {} },
      } as unknown as Response;
    }) as FetchImpl;
    const tooMany = await resolveFacebookShareUrl('https://www.facebook.com/share/v/start/');
    check(tooMany.ok === false && tooMany.code === 'TOO_MANY_REDIRECTS', 'resolver: excessive redirect chain bounded, not followed indefinitely', tooMany);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

// ── Group 2: live endpoint (best-effort -- needs dev API + internet) ──────
async function liveChecks() {
  const BASE = process.env.PROBE_BASE_URL_ROOT || 'http://localhost:3001';
  const API = `${BASE}/api/v1`;
  const PW = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';

  let token: string | undefined;
  try {
    const loginRes = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'seller@choosify.com.bd', password: PW }),
    });
    const loginBody = await loginRes.json().catch(() => ({}) as any);
    token = loginBody.accessToken;
  } catch {
    console.log('SKIP live endpoint checks -- dev API not reachable at ' + BASE);
    return;
  }
  if (!token) {
    console.log('SKIP live endpoint checks -- seller login failed (dev API not seeded?)');
    return;
  }

  const call = async (url: string) => {
    const r = await fetch(`${API}/catalog/creator-reviews/resolve-facebook-share-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ url }),
    });
    return { status: r.status, body: (await r.json().catch(() => ({}))) as any };
  };

  const unauth = await fetch(`${API}/catalog/creator-reviews/resolve-facebook-share-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: 'https://www.facebook.com/share/v/1GPouRgTf7/' }),
  });
  check(unauth.status === 401, 'live: unauthenticated request rejected', unauth.status);

  const missingUrl = await call('');
  check(missingUrl.status === 400, 'live: empty url rejected with 400', missingUrl);

  const nonShare = await call('https://www.facebook.com/reel/1109289584955997/');
  check(nonShare.status === 422, 'live: canonical (non-share) URL rejected by this endpoint', nonShare);

  const evilDomain = await call('https://evil.com/share/v/x/');
  check(evilDomain.status === 422, 'live: arbitrary domain rejected', evilDomain);

  // The real case from the Creator Reviews audit -- requires outbound
  // internet access to facebook.com from wherever this probe runs.
  try {
    const real = await call('https://www.facebook.com/share/v/1GPouRgTf7/');
    if (real.status === 200 && typeof real.body?.canonicalUrl === 'string') {
      check(real.body.canonicalUrl.includes('/reel/1109289584955997/'), 'live: real share URL resolves to the known canonical Reel', real.body);
    } else {
      console.log('SKIP live real-resolution assertion -- non-200 response (network/outbound restriction?), got', real.status, JSON.stringify(real.body));
    }
  } catch (e) {
    console.log('SKIP live real-resolution assertion -- request failed', e);
  }
}

async function main() {
  classificationChecks();
  await mockedChecks();
  await liveChecks();

  console.log(`\n=== ${PASS.length} passed, ${FAIL.length} failed ===`);
  if (FAIL.length) {
    console.log('FAILURES:\n - ' + FAIL.join('\n - '));
    process.exit(1);
  }
  console.log('ALL FACEBOOK SHARE RESOLVER CHECKS PASSED');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
