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
 */
export type ProductVideo =
  | { kind: 'youtube'; id: string; embedUrl: string; watchUrl: string }
  | { kind: 'file'; src: string }
  | { kind: 'invalid'; reason: string };

export function classifyProductVideo(raw: string | undefined | null): ProductVideo {
  const s = (raw ?? '').trim();
  if (!s) return { kind: 'invalid', reason: 'empty' };
  if (s.startsWith('/media/')) return { kind: 'file', src: s };

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
      ? { kind: 'youtube', id, embedUrl: `https://www.youtube-nocookie.com/embed/${id}`, watchUrl: `https://www.youtube.com/watch?v=${id}` }
      : { kind: 'invalid', reason: 'missing YouTube video id' };
  }
  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
    const fromPath = url.pathname.match(/\/(?:embed|shorts|v)\/([\w-]{6,})/);
    const id = url.searchParams.get('v') || fromPath?.[1] || '';
    return id
      ? { kind: 'youtube', id, embedUrl: `https://www.youtube-nocookie.com/embed/${id}`, watchUrl: `https://www.youtube.com/watch?v=${id}` }
      : { kind: 'invalid', reason: 'missing YouTube video id' };
  }
  if (/\.(mp4|webm|mov|m4v)(\?.*)?$/i.test(url.pathname)) {
    return { kind: 'file', src: url.toString() };
  }
  return { kind: 'invalid', reason: 'use a YouTube link or a direct .mp4/.webm/.mov URL' };
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
