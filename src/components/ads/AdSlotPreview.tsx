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
import { brandGradient } from '@/shared/ads/brandColor';

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
  /** Card colour from the logo. */
  brandColor?: string;
  logoZoom?: number;
  brandColor2?: string;
  /** false = no link set, so the storefront hides the CTA button. */
  hasDestination?: boolean;
  /** Draw headline + subtext over the image (storefront parity). */
  showText?: boolean;
  /** Desktop wide banner: 'fill' crops top/bottom to fill the frame. */
  fit?: 'whole' | 'fill';
  focusY?: 'top' | 'center' | 'bottom';
};

// Same label as the storefront: always just "Sponsored" (the design itself names the advertiser).
const chip = (_name?: string) => (
  <span className="absolute left-2 top-2 z-[2] rounded-md px-1.5 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wide" style={{ background: 'rgba(0,0,0,.6)', color: '#FFFFFF' }} data-testid="ad-preview-chip">
    Sponsored
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
  if (ad.formatId === 'popup') {
    // Same as the storefront pop-up: design shown whole over a dimmed page, × top-right.
    const box = (phone: boolean) => (
      <div className="relative flex items-center justify-center overflow-hidden rounded-lg" style={{ height: phone ? 220 : 200, background: 'linear-gradient(180deg,#E2E8F0,#CBD5E1)' }}>
        <div className="absolute inset-0" style={{ background: 'rgba(15,18,56,.55)' }} />
        <div className="relative" style={{ width: phone ? '88%' : '62%' }}>
          <img src={img} alt="" className="block w-full rounded-lg object-contain shadow-xl" style={{ maxHeight: phone ? 190 : 170 }} />
          <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-white text-[12px] font-extrabold shadow" style={{ color: '#111827' }}>×</span>
          {ad.ctaLabel && ad.hasDestination !== false ? (
            <span className="absolute bottom-1.5 right-1.5 rounded px-1.5 py-0.5 text-[8px] font-extrabold uppercase" style={{ background: '#FF5B00', color: '#FFFFFF' }} data-testid={phone ? undefined : 'ad-preview-cta'}>
              {ad.ctaLabel} →
            </span>
          ) : null}
          <span className="absolute left-1.5 top-1.5 rounded px-1 py-px text-[7.5px] font-extrabold uppercase" style={{ background: 'rgba(0,0,0,.6)', color: '#FFFFFF' }}>
            Sponsored
          </span>
        </div>
      </div>
    );
    return (
      <div className="space-y-3" data-testid="ad-preview-popup">
        <div>
          <div className="mb-1 text-[10px] font-bold uppercase text-slate-500">Desktop — pops up over the page</div>
          {box(false)}
        </div>
        <div>
          <div className="mb-1 text-[10px] font-bold uppercase text-slate-500">Phone</div>
          <div className="mx-auto w-[60%]">{box(true)}</div>
        </div>
      </div>
    );
  }
  if (ad.formatId === 'cta_strip') {
    // Same as the storefront CTA strip: dark gradient, headline + line left, orange button right.
    const strip = (phone: boolean) => (
      <div
        className="relative flex gap-3 overflow-hidden rounded-xl"
        style={{
          background: brandGradient(ad.brandColor, 110, ad.brandColor2) ?? 'linear-gradient(110deg, #3B1E3F 0%, #2A1846 55%, #2B1A4A 100%)',
          padding: phone ? '26px 12px 10px' : '28px 20px 16px',
          flexDirection: phone ? 'column' : 'row',
          alignItems: phone ? 'flex-start' : 'center',
        }}
      >
        {chip(ad.advertiserName)}
        {ad.logoUrl ? (
          <span className="shrink-0 overflow-hidden rounded-full" style={{ width: phone ? 48 : 56, height: phone ? 48 : 56, boxShadow: '0 4px 14px rgba(0,0,0,.35)', alignSelf: phone ? 'center' : undefined }}><img src={ad.logoUrl} alt="" className="h-full w-full object-cover" style={{ transform: ad.logoZoom ? `scale(${ad.logoZoom})` : undefined }} /></span>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="font-extrabold leading-tight" style={{ color: '#FFFFFF', fontSize: phone ? 12 : 14 }}>{ad.headline || 'Your headline'}</div>
          {ad.subtext ? <div style={{ color: 'rgba(255,255,255,.7)', fontSize: phone ? 10 : 11.5, marginTop: 2 }}>{ad.subtext}</div> : null}
        </div>
        {ad.ctaLabel && ad.hasDestination !== false ? (
          <span
            className="shrink-0 font-extrabold uppercase tracking-wide"
            style={{ background: '#FF5B00', color: '#FFFFFF', borderRadius: 8, fontSize: phone ? 9.5 : 11, padding: phone ? '5px 10px' : '8px 14px', alignSelf: phone ? 'stretch' : 'center', textAlign: 'center' }}
            data-testid={phone ? undefined : 'ad-preview-cta'}
          >
            {ad.ctaLabel}
          </span>
        ) : null}
      </div>
    );
    return (
      <div className="space-y-3" data-testid="ad-preview-strip">
        <div>
          <div className="mb-1 text-[10px] font-bold uppercase text-slate-500">Desktop: full content width</div>
          {strip(false)}
        </div>
        <div>
          <div className="mb-1 text-[10px] font-bold uppercase text-slate-500">Phone (390px)</div>
          <div className="mx-auto w-[60%]">{strip(true)}</div>
        </div>
        <div className="text-[10.5px] text-slate-500">A text banner drawn by the storefront: no artwork, always sharp, never cropped.</div>
      </div>
    );
  }
  if (ad.formatId === 'category_promoted_slot') {
    return (
      <div className="mx-auto w-[260px]" data-testid="ad-preview-category-footer">
        <div className="overflow-hidden rounded-xl border border-[#E8EDF2] bg-white">
          <div className="h-16 bg-slate-100" />
          <div className="px-4 py-3 text-[13px] font-extrabold text-[#1A1A2E]">Category card</div>
          <div className="flex items-center gap-2.5 px-4 py-3" style={{ background: '#3B1E3F' }}>
            <div className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full text-[10px] font-extrabold" style={{ background: 'rgba(255,255,255,.2)', color: '#FFFFFF' }}>
              {ad.logoUrl ? <img src={ad.logoUrl} alt="" className="h-full w-full object-cover" /> : (ad.advertiserName || 'S').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1 truncate text-[11px] font-extrabold" style={{ color: '#FFFFFF' }}>{ad.advertiserName || 'Advertiser name'}</div>
            <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide" style={{ background: '#2323FF', color: '#FFFFFF' }}>Promoted</span>
          </div>
        </div>
        <div className="mt-2 text-[10.5px] text-slate-500">
          Shown at the bottom of the chosen category card. Without a booking the footer shows the category top brand, labelled "Top brand".
        </div>
      </div>
    );
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
    // Same fixed frame as the storefront AdSlotBanner: 4:1 desktop / 5:2 phone, design fitted whole.
    const fill = (phone: boolean) => !phone && ad.fit === 'fill';
    // Phones: the frame takes the design's own shape (between 2:1 and 4:1), so it fills edge to edge.
    const ratio = ad.imageWidth && ad.imageHeight ? ad.imageWidth / ad.imageHeight : 2.5;
    const phoneAspect = `${Math.min(4, Math.max(2, ratio)).toFixed(3)} / 1`;
    const frame = (aspect: string, testId?: string, phone = false) => (
      <div className="relative w-full overflow-hidden rounded-xl" style={{ aspectRatio: aspect, background: '#0F1238' }}>
        {fill(phone) ? null : <img src={img} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-110 object-cover blur-xl" style={{ opacity: 0.6 }} />}
        <img
          src={img}
          alt={ad.headline || ''}
          className={`relative block h-full w-full ${fill(phone) ? 'object-cover' : 'object-contain'}`}
          style={fill(phone) ? { objectPosition: `center ${ad.focusY || 'center'}` } : undefined}
          data-testid={testId}
        />
        {ad.showText && (ad.headline || ad.subtext) ? (
          <div
            className="absolute inset-y-0 left-0 z-[1] flex flex-col justify-center"
            style={{ width: phone ? '62%' : '55%', padding: phone ? '10px 8px 0' : '12px 14px 0', background: 'linear-gradient(90deg, rgba(0,0,0,.7), rgba(0,0,0,.4) 55%, transparent)' }}
            data-testid={testId ? 'ad-preview-text' : undefined}
          >
            {ad.headline ? <div className="font-extrabold leading-tight" style={{ color: '#FFFFFF', fontSize: phone ? 8 : 12 }}>{ad.headline}</div> : null}
            {ad.subtext ? <div style={{ color: 'rgba(255,255,255,.85)', fontSize: phone ? 6.5 : 8.5, marginTop: 2 }}>{ad.subtext}</div> : null}
          </div>
        ) : null}
        {chip(ad.advertiserName)}
        {ad.ctaLabel && ad.hasDestination !== false ? (
          <span
            className="absolute z-[2] inline-flex items-center gap-1 font-extrabold uppercase tracking-wide shadow-md"
            style={{
              background: '#FF5B00',
              color: '#FFFFFF',
              // Phones: small pill in the bottom-right corner; larger screens: right, vertically centred.
              ...(phone ? { bottom: 4, right: 4 } : { top: '50%', transform: 'translateY(-50%)', right: 10 }),
              fontSize: phone ? 6 : 8.5,
              padding: phone ? '1px 5px' : '4px 9px',
              borderRadius: phone ? 4 : 6,
            }}
            data-testid={testId ? 'ad-preview-cta' : undefined}
          >
            {ad.ctaLabel} →
          </span>
        ) : null}
      </div>
    );
    return (
      <div className="space-y-3" data-testid="ad-preview-banner">
        <div>
          <div className="mb-1 text-[10px] font-bold uppercase text-slate-500">Desktop — fixed 4:1 frame (max 300px tall)</div>
          {frame('4 / 1', 'ad-preview-image')}
        </div>
        <div>
          <div className="mb-1 text-[10px] font-bold uppercase text-slate-500">Phone (390px) — frame follows your design's shape</div>
          <div className="mx-auto w-[60%]">{frame(phoneAspect, undefined, true)}</div>
        </div>
        <div className="text-[10.5px] text-slate-500">
          Your design is fitted whole (never cropped) inside the fixed frame; space it does not fill shows a blurred fill. The orange CTA button sits on the right, vertically centred (on phones: a small button in the bottom-right corner), when a label and destination are set.
          {ad.ctaLabel && ad.hasDestination === false ? (
            <span className="mt-1 block font-semibold text-amber-700" data-testid="ad-preview-cta-hint">
              The “{ad.ctaLabel}” button is hidden until you set a destination (step 3).
            </span>
          ) : null}
        </div>
      </div>
    );
  }
  if (placement.slotKey === 'grid_card') {
    // Same as the storefront AdGridCard: the size of the cards around it, image on top (~4:3).
    return (
      <div className="mx-auto w-[260px]" data-testid="ad-preview-grid-card">
        <div className="relative flex min-h-[300px] flex-col overflow-hidden rounded-[10px]" style={{ background: 'linear-gradient(160deg, #3B1E3F, #1E1B4B)' }}>
          <div className="relative min-h-0 flex-[7] overflow-hidden" style={{ background: brandGradient(ad.brandColor, 135, ad.brandColor2) ?? 'linear-gradient(135deg, #FF5B00, #2323FF)' }}>
            {format?.imageLed && img ? <img src={img} alt="" className="absolute inset-0 h-full w-full object-cover" /> : null}
            {chip(ad.advertiserName)}
          </div>
          <div className="flex min-h-0 flex-[3] flex-col justify-center p-3.5">
            <div className="mb-1 text-[13.5px] font-bold leading-snug" style={{ color: '#FFFFFF' }}>{ad.headline || 'Your headline'}</div>
            {ad.subtext ? <div className="mb-3 text-[11px] leading-snug" style={{ color: 'rgba(255,255,255,.6)' }}>{ad.subtext}</div> : null}
            {ad.ctaLabel && ad.hasDestination !== false ? (
              <span className="mt-auto w-full rounded-md py-2.5 text-center text-[11.5px] font-extrabold uppercase" style={{ background: '#FF5B00', color: '#FFFFFF' }} data-testid="ad-preview-cta">
                {ad.ctaLabel} →
              </span>
            ) : null}
          </div>
        </div>
        <div className="mt-2 text-[10.5px] text-slate-500">Sits in the grid at the same size as the cards around it.</div>
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
          <div className="flex aspect-[3/4] w-full flex-col justify-end p-4" style={{ background: brandGradient(ad.brandColor, 160, ad.brandColor2) ?? 'linear-gradient(135deg, #1A1D4E, #FF5B00)' }}>
            {ad.logoUrl && <img src={ad.logoUrl} alt="" className="mb-auto h-12 w-12 rounded-full object-cover" style={{ boxShadow: '0 4px 14px rgba(0,0,0,.35)' }} />}
            <div className="text-[15px] font-extrabold leading-tight" style={{ color: '#FFFFFF' }}>{ad.headline || 'Your headline'}</div>
          </div>
        )}
        <div className="p-3">
          {format?.imageLed && ad.headline && <div className="text-[13px] font-extrabold text-[#1A1A2E]">{ad.headline}</div>}
          {ad.subtext && <div className="mt-0.5 text-[11.5px] text-[#6B7280]">{ad.subtext}</div>}
          {ad.ctaLabel && ad.hasDestination !== false ? (
            <span className="mx-auto mt-2.5 flex w-fit items-center gap-1 rounded-lg px-4 py-1.5 text-[11px] font-extrabold uppercase tracking-wide" style={{ background: '#FF5B00', color: '#FFFFFF' }} data-testid="ad-preview-card-cta">
              {ad.ctaLabel} →
            </span>
          ) : null}
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
