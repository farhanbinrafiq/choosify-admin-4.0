import React, { useEffect, useState } from 'react';
import { Facebook, Instagram, Music2 } from 'lucide-react';
import { resolveCreatorThumbnail } from '../../../lib/productVideo';
import { detectBrandablePlatform, extractUrlFromPastedInput, getTikTokThumbnail } from '../../../lib/creatorReviewPlatform';

const PLATFORM_STYLE: Record<
  'facebook' | 'instagram' | 'tiktok',
  { background: string; Icon: typeof Facebook; label: string }
> = {
  facebook: { background: 'linear-gradient(135deg, #1877F2 0%, #0C44AE 100%)', Icon: Facebook, label: 'Facebook' },
  instagram: {
    background: 'linear-gradient(135deg, #FEDA75 0%, #FA7E1E 30%, #D62976 60%, #4F5BD5 100%)',
    Icon: Instagram,
    label: 'Instagram',
  },
  tiktok: { background: 'linear-gradient(135deg, #010101 0%, #232323 100%)', Icon: Music2, label: 'TikTok' },
};

/**
 * Admin Product Studio Creator Reviews mini-preview thumbnail.
 *
 * Precedence (aligned with the storefront's canonical rule -- see
 * Choosify-Web src/lib/videoEmbed.ts): custom thumbnail (item.thumbnail,
 * via this repo's existing resolveCreatorThumbnail) -> provider-derived
 * thumbnail (YouTube always; TikTok via its public, credential-free
 * oEmbed) -> honest platform-branded placeholder. Never fabricates a
 * Facebook/Instagram thumbnail -- no credential-free source exists for
 * either, so an admin still sees a clearly-labeled, honest placeholder
 * instead of a blank generic box.
 */
export function CreatorReviewThumbnailPreview({
  videoUrl,
  thumbnail,
}: {
  videoUrl: string;
  thumbnail: string;
}) {
  const explicit = (thumbnail || '').trim();
  // A seller pasting a platform's Embed Code (raw HTML) instead of a plain
  // URL must not silently break platform detection -- extract the real URL
  // first, exactly like the storefront does before rendering.
  const cleanUrl = extractUrlFromPastedInput(videoUrl);
  const derived = resolveCreatorThumbnail(cleanUrl, explicit);
  const brandablePlatform = detectBrandablePlatform(cleanUrl);

  const needsTikTokFetch = !derived && brandablePlatform === 'tiktok';
  const [tiktokThumb, setTiktokThumb] = useState<string | null>(null);
  useEffect(() => {
    if (!needsTikTokFetch) {
      setTiktokThumb(null);
      return;
    }
    let cancelled = false;
    getTikTokThumbnail(cleanUrl).then((url) => {
      if (!cancelled) setTiktokThumb(url);
    });
    return () => {
      cancelled = true;
    };
  }, [needsTikTokFetch, cleanUrl]);

  const resolvedSrc = derived || (needsTikTokFetch ? tiktokThumb : null);

  if (resolvedSrc) {
    return <img src={resolvedSrc} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />;
  }

  if (brandablePlatform) {
    const { background, Icon, label } = PLATFORM_STYLE[brandablePlatform];
    return (
      <div
        className="w-full h-full flex flex-col items-center justify-center gap-1 text-white"
        style={{ background }}
      >
        <Icon size={16} strokeWidth={1.75} />
        <span className="text-[8px] font-extrabold uppercase tracking-wide">{label}</span>
        <span className="text-[7px] opacity-75">No thumbnail</span>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-400 font-bold uppercase">
      Thumbnail
    </div>
  );
}

export default CreatorReviewThumbnailPreview;
