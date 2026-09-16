/**
 * Platform detection + TikTok thumbnail lookup for the Creator Reviews admin
 * preview (ProductStudio.tsx). Admin and Web (the storefront) are separate
 * repositories with no shared package, so this is a small, deliberately
 * duplicated subset of the storefront's `src/lib/videoEmbed.ts` /
 * `src/lib/tiktokOembed.ts`, kept intentionally narrow and aligned with the
 * same canonical precedence used there: custom thumbnail (already handled
 * by this repo's own `lib/productVideo.ts` `resolveCreatorThumbnail`) ->
 * provider-derived thumbnail -> honest platform-branded fallback. This file
 * only adds the two things `resolveCreatorThumbnail` doesn't cover:
 * identifying Facebook/Instagram/TikTok for branding purposes, and TikTok's
 * real (credential-free) oEmbed thumbnail.
 */

export type CreatorReviewBrandablePlatform = 'facebook' | 'instagram' | 'tiktok' | null;

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function detectBrandablePlatform(url: string | undefined | null): CreatorReviewBrandablePlatform {
  const clean = (url ?? '').trim();
  if (!clean) return null;
  const host = safeHostname(clean);
  if (host.endsWith('facebook.com') || host === 'fb.watch') return 'facebook';
  if (host.endsWith('instagram.com')) return 'instagram';
  if (host.endsWith('tiktok.com')) return 'tiktok';
  return null;
}

/**
 * Facebook share links (`/share/r/<token>/`, `/share/v/<token>/`) are opaque,
 * session-resolved redirect tokens, not embeddable content URLs -- confirmed
 * by direct testing: an unauthenticated fetch returns HTTP 400 with no
 * redirect, and Meta's tokenless oEmbed echoes the same unresolved URL back
 * rather than resolving it. There is no legitimate, credential-free way to
 * turn the opaque token into a real Reel/video id, so these must be caught
 * here at input time rather than silently saved and left to fail on the
 * storefront. Mirrors the identical check in the storefront's
 * `src/lib/videoEmbed.ts` (`isUnsupportedFacebookShareUrl`) -- kept in sync
 * by hand since the two repos share no package.
 */
export function isUnsupportedFacebookShareUrl(url: string | undefined | null): boolean {
  const clean = (url ?? '').trim();
  if (!clean) return false;
  const host = safeHostname(clean);
  if (!host.endsWith('facebook.com')) return false;
  return /\/share\/[rv]\//i.test(clean);
}

/**
 * The Facebook URL shapes this app actually knows how to embed -- numeric
 * Reel/video ids, mirroring the shapes the storefront's `canonicalizeFacebookUrl`
 * (`src/lib/videoEmbed.ts`) recognizes. Used by the server-side share-link
 * resolver (`server/lib/facebookShareResolver.ts`) to recognize when a
 * redirect chain has reached a real, embeddable destination rather than
 * another opaque hop -- one canonical-shape definition, reused instead of a
 * second Facebook URL parser.
 */
export function isCanonicalFacebookVideoUrl(url: string | undefined | null): boolean {
  const clean = (url ?? '').trim();
  if (!clean) return false;
  let parsed: URL;
  try {
    parsed = new URL(clean);
  } catch {
    return false;
  }
  if (parsed.hostname.toLowerCase() !== 'www.facebook.com' && parsed.hostname.toLowerCase() !== 'facebook.com') {
    return false;
  }
  if (/^\/reel\/\d+\/?$/.test(parsed.pathname)) return true;
  // `/videos/<id>/` may be prefixed by a page/profile name segment
  // (e.g. `/facebook/videos/10153231379946729/`).
  if (/^\/(?:[^/]+\/)?videos\/\d+\/?$/.test(parsed.pathname)) return true;
  if (parsed.pathname === '/watch' || parsed.pathname === '/watch/') {
    return /^\d+$/.test(parsed.searchParams.get('v') || '');
  }
  return false;
}

const pending = new Map<string, Promise<string | null>>();

async function fetchTikTokThumbnail(url: string): Promise<string | null> {
  try {
    const res = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`, {
      mode: 'cors',
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { thumbnail_url?: unknown };
    return typeof data.thumbnail_url === 'string' ? data.thumbnail_url : null;
  } catch {
    // Network failure / CORS block / malformed response -- caller falls
    // back to the honest branded placeholder, never a fabricated image.
    return null;
  }
}

/** Public, credential-free oEmbed endpoint (verified reachable directly
 *  from the browser, no CORS block, no app token). Returns a short-lived
 *  signed CDN URL -- resolved fresh at render time here, never persisted. */
export function getTikTokThumbnail(url: string): Promise<string | null> {
  let promise = pending.get(url);
  if (!promise) {
    promise = fetchTikTokThumbnail(url);
    pending.set(url, promise);
  }
  return promise;
}
