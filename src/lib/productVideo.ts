import { detectBrandablePlatform, isUnsupportedFacebookShareUrl } from './creatorReviewPlatform';

/**
 * Shared classifier for the single optional product video (CatalogProduct.videoUrl).
 * Used by the Product Studio editor and the storefront media carousel so both
 * agree on what is renderable. Mirrors server `normalizeProductVideoUrl`.
 *
 * Accepted:
 *  - `/media/...` — an app-owned upload (served from the local media disk)
 *  - a YouTube URL (youtube.com / m.youtube.com / youtu.be / youtube-nocookie.com,
 *    incl. /watch?v=, /embed/, /shorts/)
 *  - a direct HTTPS video file URL (.mp4 / .webm / .mov / .m4v)
 *  - a Facebook (Reel/video, not an opaque `/share/` link), Instagram, or
 *    TikTok video URL — the same platforms Creator Reviews already accepts
 *    (`detectBrandablePlatform`), so a seller isn't blocked from using the
 *    exact same link they'd already paste into a Creator Review.
 */
/**
 * Presentation geometry. 'unknown' is a real, distinct state — not a
 * synonym for 'landscape' — used whenever we cannot reliably determine the
 * video's actual orientation. Forcing an unverified guess into either
 * extreme (a landscape video crushed into a 9:16 box, or vice versa)
 * produces the exact bug this type exists to prevent: a canonical Facebook
 * Reel URL was found in real QA to contain genuinely LANDSCAPE content, so
 * "Reel" (a posting format) must never be treated as proof of orientation
 * (a pixel property of the underlying file). Renderers should only apply
 * portrait-specific geometry for the literal 'portrait' value; 'unknown'
 * falls back to the same neutral box used for 'landscape'.
 */
export type ProductVideoOrientation = 'landscape' | 'portrait' | 'unknown';

export type ProductVideo =
  | { kind: 'youtube'; id: string; embedUrl: string; watchUrl: string; orientation: ProductVideoOrientation }
  | { kind: 'file'; src: string; orientation: ProductVideoOrientation }
  | { kind: 'brandable'; platform: 'facebook' | 'instagram' | 'tiktok'; url: string; orientation: ProductVideoOrientation }
  | { kind: 'invalid'; reason: string };

/**
 * Orientation for Facebook/Instagram/TikTok. Provider/content-type is used
 * only as a DEFAULT for the one case where it's genuinely reliable (TikTok
 * has no landscape upload path, so "normally portrait" holds in practice)
 * — never as a universal rule. Facebook and Instagram do NOT get a
 * portrait default: a Reel/post being in that format says nothing
 * reliable about the underlying video's actual pixel orientation (proven
 * false by direct QA on a real canonical Facebook Reel URL), and neither
 * platform exposes real dimension metadata through a credential-free
 * endpoint (see server/catalogRouter.ts's existing finding that Facebook/
 * Instagram's tokenless oEmbed returns no usable thumbnail/dimension
 * data). Real per-video metadata, if a future credentialed integration
 * makes it available, would plug in here without changing this function's
 * callers — this is the one place orientation is decided.
 */
function brandableOrientation(_url: string, platform: 'facebook' | 'instagram' | 'tiktok'): ProductVideoOrientation {
  if (platform === 'tiktok') return 'portrait';
  return 'unknown';
}

export function classifyProductVideo(raw: string | undefined | null): ProductVideo {
  const s = (raw ?? '').trim();
  if (!s) return { kind: 'invalid', reason: 'empty' };
  if (s.startsWith('/media/')) return { kind: 'file', src: s, orientation: 'landscape' };

  let url: URL;
  try {
    url = new URL(s);
  } catch {
    return { kind: 'invalid', reason: 'not a valid URL' };
  }
  if (url.protocol !== 'https:') return { kind: 'invalid', reason: 'must use https' };

  const host = url.hostname.replace(/^www\./, '').toLowerCase();
  if (host === 'youtu.be') {
    const id = url.pathname.slice(1).split('/')[0];
    return id
      ? { kind: 'youtube', id, embedUrl: `https://www.youtube-nocookie.com/embed/${id}`, watchUrl: `https://www.youtube.com/watch?v=${id}`, orientation: 'landscape' }
      : { kind: 'invalid', reason: 'missing YouTube video id' };
  }
  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
    const fromPath = url.pathname.match(/\/(?:embed|shorts|v)\/([\w-]{6,})/);
    const id = url.searchParams.get('v') || fromPath?.[1] || '';
    // Shorts are portrait; a regular watch/embed link is landscape.
    const orientation: ProductVideoOrientation = /\/shorts\//i.test(url.pathname) ? 'portrait' : 'landscape';
    return id
      ? { kind: 'youtube', id, embedUrl: `https://www.youtube-nocookie.com/embed/${id}`, watchUrl: `https://www.youtube.com/watch?v=${id}`, orientation }
      : { kind: 'invalid', reason: 'missing YouTube video id' };
  }
  if (/\.(mp4|webm|mov|m4v)(\?.*)?$/i.test(url.pathname)) {
    // No reliable way to read a direct file's real orientation without
    // downloading/decoding it — landscape is the honest, sensible default.
    return { kind: 'file', src: url.toString(), orientation: 'landscape' };
  }
  const brandablePlatform = detectBrandablePlatform(s);
  if (brandablePlatform) {
    if (isUnsupportedFacebookShareUrl(s)) {
      return {
        kind: 'invalid',
        reason:
          'Facebook share links (facebook.com/share/...) can’t be embedded directly — paste the video’s canonical Facebook Reel/video URL instead (e.g. facebook.com/reel/123... or facebook.com/watch?v=123...).',
      };
    }
    return { kind: 'brandable', platform: brandablePlatform, url: s, orientation: brandableOrientation(s, brandablePlatform) };
  }
  return {
    kind: 'invalid',
    reason: 'use a YouTube, Facebook, Instagram, or TikTok video link, or a direct .mp4/.webm/.mov URL',
  };
}

export function isRenderableProductVideo(raw: string | undefined | null): boolean {
  return classifyProductVideo(raw).kind !== 'invalid';
}

/**
 * Poster image for a creator-review video card. Prefers an explicit thumbnail
 * (seller upload or pasted URL); otherwise derives one from the video link when
 * the platform exposes a public poster (YouTube). Returns '' when nothing can be
 * resolved so callers can fall back to a play-icon placeholder.
 */
export function resolveCreatorThumbnail(
  videoUrl: string | undefined | null,
  explicitThumbnail?: string | undefined | null,
): string {
  const explicit = (explicitThumbnail ?? '').trim();
  if (explicit) return explicit;
  const v = classifyProductVideo(videoUrl);
  if (v.kind === 'youtube') return `https://img.youtube.com/vi/${v.id}/hqdefault.jpg`;
  return '';
}
