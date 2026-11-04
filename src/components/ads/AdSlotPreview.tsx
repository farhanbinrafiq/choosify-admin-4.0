/**
 * Exact storefront preview of an Ads Studio ad in its slot — mirrors Choosify-Web
 * src/components/ads/AdSlot.tsx (AdSlotBanner / AdSlotCard) and the homepage Hero:
 *  - display 'natural' (wide banners): the uploaded design is shown WHOLE at its own proportions.
 *  - display 'cover' 3:4 cards (rails, product page, discover feed): image cropped to a 3:4 frame.
 *  - HOME_HERO: cropped to the full-width hero (≈3:1 desktop) and the phone hero (≈1.2:1).
 * Plus the slot's size spec and whether the uploaded image fits it.
 */
import React from 'react';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { checkCreativeFit, getFormatDef, type AdPlacementDef } from '@/shared/ads/placementRegistry';

export type AdPreviewInput = {
  formatId: string;
  imageUrl?: string;
  imageWidth?: number;
  imageHeight?: number;
  headline?: string;
  subtext?: string;
  ctaLabel?: string;
  advertiserName?: string;
  logoUrl?: string;
};

const chip = (name?: string) => (
  <span className="absolute left-2 top-2 z-[2] rounded-md px-1.5 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wide" style={{ background: 'rgba(0,0,0,.6)', color: '#FFFFFF' }}>
    {name ? `Sponsored · ${name}` : 'Sponsored'}
  </span>
);

/** Size + placement requirements for a slot. */
export function AdSlotSpec({ placement }: { placement: AdPlacementDef }) {
  const s = placement.creative;
  return (
    <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2.5 text-[11.5px] text-sky-900" data-testid="ad-slot-spec">
      <div className="flex items-start gap-1.5">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <div>
          <div className="font-extrabold">Where it appears</div>
          <div>{placement.sectionLabel}</div>
          {s ? (
            <>
              <div className="mt-1.5 font-extrabold">What to upload</div>
              <div data-testid="ad-slot-size">
                Recommended <b>{s.recommended.width}×{s.recommended.height}px</b> · minimum {s.min.width}×{s.min.height}px · proportions {s.ratioRange[0]}:1 to {s.ratioRange[1]}:1
              </div>
              <div className="mt-0.5">{s.howShown}</div>
            </>
          ) : (
            <div className="mt-1">No image needed for this format.</div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Result of checking the uploaded image against the slot. */
export function AdFitStatus({ placement, width, height }: { placement: AdPlacementDef; width?: number; height?: number }) {
  if (!placement.creative || !width || !height) return null;
  const fit = checkCreativeFit(placement, width, height);
  if ('error' in fit) {
    return (
      <div className="mt-2 flex items-start gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11.5px] font-semibold text-red-700" data-testid="ad-fit-error">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {fit.error}
      </div>
    );
  }
  return (
    <div className="mt-2 space-y-1" data-testid="ad-fit-ok">
      <div className="flex items-center gap-1.5 text-[11.5px] font-semibold text-emerald-700">
        <CheckCircle2 className="h-3.5 w-3.5" /> {width}×{height}px fits this slot ({(width / height).toFixed(2)}:1)
      </div>
      {fit.warnings.map((w) => (
        <div key={w} className="text-[11px] text-amber-700">{w}</div>
      ))}
    </div>
  );
}

export function AdSlotPreview({ placement, ad }: { placement: AdPlacementDef; ad: AdPreviewInput }) {
  const format = getFormatDef(ad.formatId);
  const img = ad.imageUrl;
  if (format?.imageLed && !img) {
    return <div className="rounded-lg border border-dashed border-slate-300 px-3 py-8 text-center text-[11.5px] text-slate-500">Upload the image to see exactly how it will look.</div>;
  }
  if (placement.placementId === 'HOME_HERO') {
    return (
      <div className="space-y-3" data-testid="ad-preview-hero">
        <div>
          <div className="mb-1 text-[10px] font-bold uppercase text-slate-500">Desktop hero (full width)</div>
          <div className="relative aspect-[3/1] w-full overflow-hidden rounded-lg">
            {chip(ad.advertiserName)}
            <img src={img} alt={ad.headline || ''} className="h-full w-full object-cover" />
          </div>
        </div>
        <div>
          <div className="mb-1 text-[10px] font-bold uppercase text-slate-500">Phone hero</div>
          <div className="relative mx-auto aspect-[39/32] w-[60%] overflow-hidden rounded-lg">
            {chip(ad.advertiserName)}
            <img src={img} alt="" className="h-full w-full object-cover" />
          </div>
        </div>
      </div>
    );
  }
  if (placement.creative?.display === 'natural') {
    return (
      <div className="space-y-3" data-testid="ad-preview-banner">
        <div>
          <div className="mb-1 text-[10px] font-bold uppercase text-slate-500">Desktop (content width)</div>
          <div className="relative mx-auto w-fit max-w-full overflow-hidden rounded-xl">
            {chip(ad.advertiserName)}
            <img src={img} alt={ad.headline || ''} className="block h-auto max-h-[360px] w-auto max-w-full object-contain" data-testid="ad-preview-image" />
          </div>
        </div>
        <div>
          <div className="mb-1 text-[10px] font-bold uppercase text-slate-500">Phone (390px)</div>
          <div className="relative mx-auto w-[60%] overflow-hidden rounded-xl">
            {chip(ad.advertiserName)}
            <img src={img} alt="" className="block h-auto w-full object-contain" />
          </div>
        </div>
        <div className="text-[10.5px] text-slate-500">Shown exactly as uploaded — nothing is cropped or overlaid, so the text in your design is what shoppers read.</div>
      </div>
    );
  }
  // 3:4 card (rails, product page, discover feed) — same as the storefront AdSlotCard
  return (
    <div className="mx-auto w-[240px]" data-testid="ad-preview-card">
      <div className="relative overflow-hidden rounded-xl border border-[#E8EDF2] bg-white">
        {chip(ad.advertiserName)}
        {format?.imageLed && img ? (
          <img src={img} alt="" className="block aspect-[3/4] w-full object-cover" />
        ) : (
          <div className="flex aspect-[3/4] w-full flex-col justify-end p-4" style={{ background: 'linear-gradient(135deg, #1A1D4E, #FF5B00)' }}>
            {ad.logoUrl && <img src={ad.logoUrl} alt="" className="mb-auto h-10 w-10 rounded-full bg-white object-contain p-1" />}
            <div className="text-[15px] font-extrabold leading-tight" style={{ color: '#FFFFFF' }}>{ad.headline || 'Your headline'}</div>
          </div>
        )}
        <div className="p-3">
          {format?.imageLed && ad.headline && <div className="text-[13px] font-extrabold text-[#1A1A2E]">{ad.headline}</div>}
          {ad.subtext && <div className="mt-0.5 text-[11.5px] text-[#6B7280]">{ad.subtext}</div>}
          {ad.ctaLabel && <span className="mt-2 inline-block rounded-lg px-3 py-1.5 text-[11px] font-extrabold" style={{ background: '#FF5B00', color: '#FFFFFF' }}>{ad.ctaLabel}</span>}
        </div>
      </div>
    </div>
  );
}

/** Natural pixel size of an image URL or File (browser). */
export function measureImage(src: string | File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = typeof src === 'string' ? src : URL.createObjectURL(src);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      if (typeof src !== 'string') URL.revokeObjectURL(url);
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}
