/**
 * Facebook share-link (`/share/v/<token>/`, `/share/r/<token>/`) resolver.
 *
 * These links are opaque, session-resolved redirect tokens -- Meta's own
 * embed mechanisms (the fb-video/XFBML SDK, the plugins/video.php iframe)
 * do not resolve them into playable content (confirmed by direct testing,
 * see `src/lib/creatorReviewPlatform.ts` / `src/lib/videoEmbed.ts`). A plain
 * unauthenticated HTTP client, however, gets an ordinary 3xx redirect from
 * Facebook straight to the canonical `/reel/<id>/` or `/videos/<id>/` URL --
 * this module follows exactly that redirect chain and nothing else.
 *
 * Hard boundaries (do not weaken without re-reading the security review this
 * shipped with):
 *  - The only host this will ever request is an exact match against
 *    ALLOWED_HOSTS (`facebook.com` / `www.facebook.com`) -- never a
 *    substring/suffix match, which would also match `evilfacebook.com`.
 *  - Every redirect target is re-validated against the same host allowlist
 *    and must be `https:` before it is ever fetched -- a Location header
 *    pointing anywhere else aborts resolution immediately.
 *  - The response body is NEVER read for any request this module makes --
 *    only `status` and the `location` header. No HTML parsing, no scraping.
 *  - Only the resolved URL *string* is ever returned to the caller -- never
 *    proxied response content.
 *  - Bounded redirect count, bounded overall timeout, redirect-loop
 *    detection -- this can only ever make a handful of small, header-only
 *    requests to facebook.com before giving up.
 */
import { isCanonicalFacebookVideoUrl } from '../../src/lib/creatorReviewPlatform';

const ALLOWED_HOSTS = new Set(['facebook.com', 'www.facebook.com']);
const MAX_REDIRECTS = 5;
const OVERALL_TIMEOUT_MS = 8000;

export type FacebookShareResolverErrorCode =
  | 'INVALID_URL'
  | 'UNSUPPORTED_HOST'
  | 'MISSING_LOCATION'
  | 'INVALID_REDIRECT_TARGET'
  | 'UNSUPPORTED_REDIRECT_TARGET'
  | 'REDIRECT_LOOP'
  | 'TOO_MANY_REDIRECTS'
  | 'UNRESOLVED'
  | 'TIMEOUT'
  | 'NETWORK_ERROR';

export type FacebookShareResolution =
  | { ok: true; canonicalUrl: string }
  | { ok: false; code: FacebookShareResolverErrorCode; message: string };

function parseAllowedFacebookUrl(raw: string): URL | null {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:') return null;
  if (!ALLOWED_HOSTS.has(parsed.hostname.toLowerCase())) return null;
  return parsed;
}

/** Only `/share/v/<token>/` and `/share/r/<token>/` -- this resolver is not
 *  a generic Facebook URL handler, see module doc. */
function isSupportedShareUrl(parsed: URL): boolean {
  return /^\/share\/[rv]\/[^/]+\/?$/i.test(parsed.pathname);
}

export async function resolveFacebookShareUrl(inputUrl: string): Promise<FacebookShareResolution> {
  const initial = parseAllowedFacebookUrl((inputUrl || '').trim());
  if (!initial) {
    return { ok: false, code: 'UNSUPPORTED_HOST', message: 'Only https://www.facebook.com URLs are supported.' };
  }
  if (!isSupportedShareUrl(initial)) {
    return {
      ok: false,
      code: 'INVALID_URL',
      message: 'Expected a Facebook share link in the form /share/v/<token>/ or /share/r/<token>/.',
    };
  }

  const controller = new AbortController();
  const overallTimer = setTimeout(() => controller.abort(), OVERALL_TIMEOUT_MS);

  try {
    let currentUrl = initial.toString();
    const visited = new Set<string>([currentUrl]);

    for (let hop = 0; hop < MAX_REDIRECTS; hop++) {
      let response: Response;
      try {
        response = await fetch(currentUrl, {
          method: 'GET',
          redirect: 'manual',
          signal: controller.signal,
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ChoosifyLinkResolver/1.0)' },
        });
      } catch (err) {
        if (controller.signal.aborted) {
          return { ok: false, code: 'TIMEOUT', message: 'Resolving the Facebook link took too long.' };
        }
        return { ok: false, code: 'NETWORK_ERROR', message: 'Could not reach Facebook to resolve this link.' };
      }
      // Never read the body -- only status/headers are inspected. Explicitly
      // release the stream so an unread body is never left dangling.
      void response.body?.cancel().catch(() => {});

      if (response.status < 300 || response.status >= 400) {
        return {
          ok: false,
          code: 'UNRESOLVED',
          message: 'Facebook did not redirect this share link to a supported canonical URL.',
        };
      }

      const location = response.headers.get('location');
      if (!location) {
        return { ok: false, code: 'MISSING_LOCATION', message: 'Facebook responded with a redirect but no destination.' };
      }

      let nextUrl: URL;
      try {
        nextUrl = new URL(location, currentUrl);
      } catch {
        return { ok: false, code: 'INVALID_REDIRECT_TARGET', message: 'Facebook returned an invalid redirect destination.' };
      }
      if (nextUrl.protocol !== 'https:' || !ALLOWED_HOSTS.has(nextUrl.hostname.toLowerCase())) {
        return {
          ok: false,
          code: 'UNSUPPORTED_REDIRECT_TARGET',
          message: 'Facebook redirected to a host outside the allowed list.',
        };
      }

      const nextUrlString = nextUrl.toString();
      if (isCanonicalFacebookVideoUrl(nextUrlString)) {
        // Strip Facebook's own tracking params (`rdid`, `share_url`, ...) off
        // the redirect target -- only the bare canonical shape is returned,
        // matching what Facebook's own embed generator produces and what
        // `canonicalizeFacebookUrl` (storefront) would derive anyway. The
        // `/watch` shape is the one exception -- its `v=<id>` query param
        // IS the content identifier, not tracking cruft, so it's kept.
        const isWatch = nextUrl.pathname === '/watch' || nextUrl.pathname === '/watch/';
        const canonicalUrl = isWatch
          ? `${nextUrl.origin}${nextUrl.pathname}?v=${nextUrl.searchParams.get('v')}`
          : `${nextUrl.origin}${nextUrl.pathname}`;
        return { ok: true, canonicalUrl };
      }
      if (visited.has(nextUrlString)) {
        return { ok: false, code: 'REDIRECT_LOOP', message: 'Facebook redirected back to a URL already visited.' };
      }
      visited.add(nextUrlString);
      currentUrl = nextUrlString;
    }

    return {
      ok: false,
      code: 'TOO_MANY_REDIRECTS',
      message: 'Facebook redirected too many times without reaching a canonical URL.',
    };
  } finally {
    clearTimeout(overallTimer);
  }
}
