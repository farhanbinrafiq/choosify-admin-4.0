/**
 * Homepage hero slide editor: image or video, optional phone media, video poster, alt text,
 * focal point (crop position) and the link the whole slide opens. Uploads go through the
 * existing media pipeline (/catalog/media/upload or the configured Cloudinary preset).
 */
import React, { useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ImagePlus, Loader2, Trash2, Upload, Video } from 'lucide-react';
import { uploadProductVideoFile, uploadSiteAssetImage } from '../../../services/mediaUpload';
import type { HomepageSlide } from './homepageModel';

const inputCls =
  'w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-[12.5px] text-[#111827] outline-none focus:border-[#EF3C23] focus:ring-2 focus:ring-[#EF3C23]/15 disabled:bg-slate-50';
const labelCls = 'mb-1 block text-[10.5px] font-extrabold uppercase tracking-wide text-[#6B7280]';
const iconBtn = 'inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#E2E8F0] bg-white text-[#374151] hover:bg-slate-50 disabled:opacity-40';

function MediaField({
  label,
  hint,
  value,
  kind,
  disabled,
  testId,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  kind: 'image' | 'video';
  disabled: boolean;
  testId: string;
  onChange: (url: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <div className="flex gap-2">
        <input
          className={inputCls}
          value={value}
          disabled={disabled}
          placeholder={kind === 'video' ? 'https://… .mp4, /media/… or upload' : 'https://…, /media/… or upload'}
          aria-label={`${label} URL`}
          data-testid={testId}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[#E2E8F0] bg-white px-2.5 text-[11.5px] font-bold text-[#111827] hover:bg-slate-50 disabled:opacity-50"
          disabled={disabled || busy}
          onClick={() => fileRef.current?.click()}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Upload
        </button>
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          data-testid={`${testId}-file`}
          accept={kind === 'video' ? 'video/mp4,video/webm' : 'image/jpeg,image/png,image/webp,image/avif,image/gif'}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            setBusy(true);
            setErr(null);
            try {
              onChange(kind === 'video' ? await uploadProductVideoFile(file) : await uploadSiteAssetImage(file));
            } catch (x) {
              setErr(x instanceof Error ? x.message : 'Upload failed');
            } finally {
              setBusy(false);
            }
          }}
        />
      </div>
      {hint && <div className="mt-1 text-[10.5px] text-slate-500">{hint}</div>}
      {err && <div className="mt-1 text-[11px] font-semibold text-red-600">{err}</div>}
    </div>
  );
}

/** Click the image to choose which part stays visible when the banner crops it. */
function FocalPicker({ slide, disabled, onChange }: { slide: HomepageSlide; disabled: boolean; onChange: (x: number, y: number) => void }) {
  const src = slide.mediaType === 'image' ? slide.mediaUrl : slide.posterUrl;
  if (!src) return null;
  const pos = { objectPosition: `${slide.focalX}% ${slide.focalY}%` };
  return (
    <div>
      <label className={labelCls}>Focal point — click the part of the image that must stay visible</label>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
        <button
          type="button"
          disabled={disabled}
          className="relative block aspect-[16/7] w-full overflow-hidden rounded-lg border border-[#E2E8F0] bg-slate-100"
          data-testid={`ws-hp-focal-${slide.id}`}
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            onChange(Math.round(((e.clientX - r.left) / r.width) * 100), Math.round(((e.clientY - r.top) / r.height) * 100));
          }}
        >
          <img src={src} alt="" className="h-full w-full object-fill" />
          <span
            className="pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white"
            style={{ left: `${slide.focalX}%`, top: `${slide.focalY}%`, boxShadow: '0 0 0 2px #EF3C23' }}
          />
        </button>
        <div className="space-y-1.5">
          <div className="text-[10.5px] font-bold text-slate-500">Desktop crop</div>
          <div className="aspect-[16/5] overflow-hidden rounded-md border border-[#E2E8F0]">
            <img src={src} alt="" className="h-full w-full object-cover" style={pos} />
          </div>
          <div className="text-[10.5px] font-bold text-slate-500">Phone crop</div>
          <div className="mx-auto aspect-[39/32] w-[70%] overflow-hidden rounded-md border border-[#E2E8F0]">
            <img src={(slide.mediaType === 'image' && slide.mobileMediaUrl) || src} alt="" className="h-full w-full object-cover" style={pos} />
          </div>
          <div className="text-[10px] text-slate-400">
            {slide.focalX}% · {slide.focalY}%
          </div>
        </div>
      </div>
    </div>
  );
}

export function HeroSlideEditor({
  slide,
  index,
  count,
  disabled,
  onChange,
  onMove,
  onRemove,
}: {
  slide: HomepageSlide;
  index: number;
  count: number;
  disabled: boolean;
  onChange: (s: HomepageSlide) => void;
  onMove: (d: -1 | 1) => void;
  onRemove: () => void;
}) {
  const set = (patch: Partial<HomepageSlide>) => onChange({ ...slide, ...patch });
  return (
    <div className={`rounded-xl border p-3 ${slide.isActive ? 'border-[#E8EDF2] bg-white' : 'border-dashed border-[#E2E8F0] bg-slate-50'}`} data-testid={`ws-hp-slide-${slide.id}`}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-[12px] font-extrabold text-[#111827]">Slide {index + 1}</span>
        <label className="ml-1 inline-flex items-center gap-1.5 text-[11.5px] font-bold text-[#374151]">
          <input type="checkbox" checked={slide.isActive} disabled={disabled} data-testid={`ws-hp-slide-active-${slide.id}`} onChange={(e) => set({ isActive: e.target.checked })} /> Show on the website
        </label>
        <div className="ml-auto flex gap-1.5">
          <button type="button" className={iconBtn} disabled={disabled || index === 0} aria-label="Move slide up" onClick={() => onMove(-1)}>
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
          <button type="button" className={iconBtn} disabled={disabled || index === count - 1} aria-label="Move slide down" onClick={() => onMove(1)}>
            <ArrowDown className="h-3.5 w-3.5" />
          </button>
          <button type="button" className={iconBtn} disabled={disabled} aria-label="Delete slide" data-testid={`ws-hp-slide-delete-${slide.id}`} onClick={onRemove}>
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className={labelCls}>Media type</label>
          <div className="flex gap-2">
            {(['image', 'video'] as const).map((t) => (
              <button
                key={t}
                type="button"
                disabled={disabled}
                data-testid={`ws-hp-slide-type-${t}-${slide.id}`}
                onClick={() => t !== slide.mediaType && set({ mediaType: t, mediaUrl: '', mobileMediaUrl: '', posterUrl: '' })}
                className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-[11.5px] font-bold ${slide.mediaType === t ? 'border-[#EF3C23] bg-orange-50 text-[#EF3C23]' : 'border-[#E2E8F0] bg-white text-[#374151]'}`}
              >
                {t === 'image' ? <ImagePlus className="h-3.5 w-3.5" /> : <Video className="h-3.5 w-3.5" />} {t === 'image' ? 'Image' : 'Video'}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className={labelCls}>Slide name (announced by screen readers)</label>
          <input
            className={inputCls}
            value={slide.label}
            disabled={disabled}
            maxLength={120}
            placeholder="e.g. Eid collection from verified brands"
            data-testid={`ws-hp-slide-label-${slide.id}`}
            onChange={(e) => set({ label: e.target.value })}
          />
        </div>
        <MediaField
          label={slide.mediaType === 'image' ? 'Image (desktop)' : 'Video (desktop)'}
          hint={slide.mediaType === 'image' ? 'Wide image, at least 1600×700. JPG, PNG, WEBP or AVIF.' : 'Short muted loop, MP4 or WebM. It plays without sound.'}
          value={slide.mediaUrl}
          kind={slide.mediaType}
          disabled={disabled}
          testId={`ws-hp-slide-media-${slide.id}`}
          onChange={(url) => set({ mediaUrl: url })}
        />
        <MediaField
          label={slide.mediaType === 'image' ? 'Image for phones (optional)' : 'Video for phones (optional)'}
          hint="Leave empty to use the desktop media on phones too."
          value={slide.mobileMediaUrl}
          kind={slide.mediaType}
          disabled={disabled}
          testId={`ws-hp-slide-mobile-${slide.id}`}
          onChange={(url) => set({ mobileMediaUrl: url })}
        />
        {slide.mediaType === 'video' ? (
          <MediaField
            label="Poster image (optional)"
            hint="Shown before the video plays and when autoplay is blocked."
            value={slide.posterUrl}
            kind="image"
            disabled={disabled}
            testId={`ws-hp-slide-poster-${slide.id}`}
            onChange={(url) => set({ posterUrl: url })}
          />
        ) : (
          <div>
            <label className={labelCls}>Alt text</label>
            <input
              className={inputCls}
              value={slide.alt}
              disabled={disabled}
              maxLength={160}
              placeholder="Describe the image"
              data-testid={`ws-hp-slide-alt-${slide.id}`}
              onChange={(e) => set({ alt: e.target.value })}
            />
          </div>
        )}
        <div>
          <label className={labelCls}>Link (CTA) when clicked</label>
          <input
            className={inputCls}
            value={slide.linkUrl}
            disabled={disabled}
            maxLength={500}
            placeholder="/deals or https://…"
            data-testid={`ws-hp-slide-link-${slide.id}`}
            onChange={(e) => set({ linkUrl: e.target.value })}
          />
          <div className="mt-1 text-[10.5px] text-slate-500">The whole slide is clickable. Leave empty for no link.</div>
        </div>
      </div>
      <div className="mt-3">
        <FocalPicker slide={slide} disabled={disabled} onChange={(x, y) => set({ focalX: x, focalY: y })} />
      </div>
    </div>
  );
}
