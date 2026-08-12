/**
 * Hero Banner creative media helpers — image / gif / hosted video URL.
 * Video binary upload/transcoding is NOT part of existing media infra;
 * hosted https URLs (mp4/webm) are supported for Hero video creatives.
 */

export type HeroMediaType = 'image' | 'gif' | 'video';

export function inferHeroMediaType(
  url: string | undefined | null,
  explicit?: string | null,
): HeroMediaType {
  const ex = String(explicit || '').trim().toLowerCase();
  if (ex === 'image' || ex === 'gif' || ex === 'video') return ex;
  const u = String(url || '').trim().toLowerCase();
  if (!u) return 'image';
  if (/\.(mp4|webm|ogg)(\?|#|$)/i.test(u) || u.includes('/video/upload/')) return 'video';
  if (/\.gif(\?|#|$)/i.test(u)) return 'gif';
  return 'image';
}

/** Safe http(s) media URL for creative image/gif/video/poster. */
export function assertSafeMediaUrl(url: string | undefined | null, field = 'mediaUrl'): string | undefined {
  if (url === undefined || url === null || String(url).trim() === '') return undefined;
  const trimmed = String(url).trim();
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('file:')
  ) {
    throw new Error(`${field} must not use javascript: or unsafe schemes`);
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(`${field} must be http(s)`);
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes(field)) throw error;
    throw new Error(`${field} is invalid`);
  }
  return trimmed;
}

export function normalizeHeroCreativeMedia(creative: Record<string, unknown> | undefined | null): {
  mediaType: HeroMediaType;
  imageUrl?: string;
  videoUrl?: string;
  posterUrl?: string;
} {
  const c = creative || {};
  const imageUrl = typeof c.imageUrl === 'string' ? c.imageUrl : undefined;
  const videoUrl = typeof c.videoUrl === 'string' ? c.videoUrl : undefined;
  const posterUrl =
    typeof c.posterUrl === 'string'
      ? c.posterUrl
      : typeof c.posterImageUrl === 'string'
        ? c.posterImageUrl
        : undefined;
  const mediaType = inferHeroMediaType(
    videoUrl || imageUrl,
    typeof c.mediaType === 'string' ? c.mediaType : undefined,
  );
  return { mediaType, imageUrl, videoUrl, posterUrl };
}
