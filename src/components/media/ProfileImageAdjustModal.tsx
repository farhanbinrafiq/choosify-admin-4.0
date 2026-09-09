import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Minus, Plus, RotateCcw } from 'lucide-react';
import type { ProfileImageCropParams } from '../../../shared/media/profileImageCrop';

export type { ProfileImageCropParams };

/**
 * ONE Choosify profile-image adjustment mechanism, shared by User Profile,
 * Brand Studio, and Creator Studio. Originally three near-duplicate crop
 * modals existed (AvatarCropModal for the user avatar, BrandLogoCropModal
 * for the brand logo, and no cropper at all for the Creator avatar) — this
 * component is the single behavioral implementation all three now delegate
 * to (AvatarCropModal / BrandLogoCropModal became thin wrappers around it;
 * Creator Studio's avatar field uses it directly).
 *
 * Persistence is deliberately NOT this component's concern: it only reports
 * `{ dataUrl, crop }` on save — `crop` are the raw scale/position parameters
 * against the ORIGINAL (uncropped) image, so a caller can store the original
 * upload *and* the crop parameters separately (never destroying the source),
 * and later reopen this same modal against that original with `initialCrop`
 * to resume editing exactly where the user left off, instead of re-cropping
 * an already-cropped image (which is what the old destructive save-only-the-
 * output pattern did).
 */
export type ProfileImageAspectPreset = { id: string; label: string; ratio: number };

export type ProfileImageAdjustResult = {
  dataUrl: string;
  crop: ProfileImageCropParams;
};

export type ProfileImageAdjustModalProps = {
  open: boolean;
  imageSrc: string;
  /** Modal heading, e.g. "Edit profile photo" / "Edit brand logo" / "Edit creator avatar". */
  title: string;
  helpText?: string;
  /** 'circle' = fixed 1:1 avatar frame; 'rect' = a chosen aspect (see aspectPresets). */
  shape: 'circle' | 'rect';
  /** Only used when shape === 'rect'. Defaults to a single 1:1 preset when omitted. */
  aspectPresets?: ProfileImageAspectPreset[];
  /** Longest output side in px. Default 256 for circle, 800 for rect. */
  outputLongSide?: number;
  /** Preserve source transparency instead of matting to white. Default: true for rect, false for circle. */
  transparentOutput?: boolean;
  /** Resume a previous adjustment against this SAME source image (see module doc). */
  initialCrop?: ProfileImageCropParams | null;
  accentColor?: string;
  onCancel: () => void;
  onSave: (result: ProfileImageAdjustResult) => void;
};

const DEFAULT_PRESETS: ProfileImageAspectPreset[] = [{ id: 'square', label: 'Square', ratio: 1 }];

/** Base view size at comfortable desktop width; shrinks to fit narrow viewports (see useViewSize). */
const BASE_VIEW_MAX = 320;

function useViewportWidth() {
  const [w, setW] = useState(() => (typeof window === 'undefined' ? 640 : window.innerWidth));
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onResize = () => setW(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return w;
}

/**
 * Circular/rectangular image cropper: drag to reposition, zoom via buttons
 * or slider, Reset to the default centered fit, canvas export on Save.
 */
export function ProfileImageAdjustModal({
  open,
  imageSrc,
  title,
  helpText,
  shape,
  aspectPresets = DEFAULT_PRESETS,
  outputLongSide,
  transparentOutput,
  initialCrop,
  accentColor = '#EF3C23',
  onCancel,
  onSave,
}: ProfileImageAdjustModalProps) {
  const presets = shape === 'circle' ? [DEFAULT_PRESETS[0]] : aspectPresets;
  const [natural, setNatural] = useState({ w: 1, h: 1 });
  const [preset, setPreset] = useState<ProfileImageAspectPreset>(presets[0]);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  // Surfaces a load failure immediately (e.g. a stored image hosted somewhere
  // that doesn't permit cross-origin reads) instead of leaving a silent blank
  // frame until the user clicks Save and hits a native alert.
  const [loadFailed, setLoadFailed] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const imgRef = useRef<HTMLImageElement | null>(null);

  const viewportWidth = useViewportWidth();
  // Fit inside the dialog with room for padding/controls on narrow phones (e.g. 320px viewports).
  const viewMax = Math.max(160, Math.min(BASE_VIEW_MAX, viewportWidth - 96));

  const viewW = preset.ratio >= 1 ? viewMax : viewMax * preset.ratio;
  const viewH = preset.ratio >= 1 ? viewMax / preset.ratio : viewMax;

  const minCoverScale = useMemo(
    () => Math.max(viewW / natural.w, viewH / natural.h),
    [viewW, viewH, natural.w, natural.h],
  );

  const applyDefaultFit = useCallback((w: number, h: number, nextPreset: ProfileImageAspectPreset) => {
    const vw = nextPreset.ratio >= 1 ? viewMax : viewMax * nextPreset.ratio;
    const vh = nextPreset.ratio >= 1 ? viewMax / nextPreset.ratio : viewMax;
    const cover = Math.max(vw / w, vh / h);
    setScale(cover);
    setOffset({ x: 0, y: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMax]);

  useEffect(() => {
    if (!open) return;
    setLoadFailed(false);
    const img = new Image();
    img.decoding = 'async';
    if (!imageSrc.startsWith('data:') && !imageSrc.startsWith('blob:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => {
      const w = img.naturalWidth || 1;
      const h = img.naturalHeight || 1;
      setNatural({ w, h });
      imgRef.current = img;

      // Resume a prior adjustment against this same original when the caller
      // supplies one (and it looks like it belongs to this image) — otherwise
      // start from the default centered "cover" fit.
      if (
        initialCrop &&
        initialCrop.naturalW === w &&
        initialCrop.naturalH === h &&
        Number.isFinite(initialCrop.scale) &&
        initialCrop.scale > 0
      ) {
        setPreset(presets[0]);
        setScale(initialCrop.scale);
        setOffset({ x: initialCrop.x, y: initialCrop.y });
      } else {
        const guess =
          shape === 'rect'
            ? presets.reduce((best, p) => {
                const ratio = w / Math.max(1, h);
                return Math.abs(Math.log(p.ratio / ratio)) < Math.abs(Math.log(best.ratio / ratio)) ? p : best;
              }, presets[0])
            : presets[0];
        setPreset(guess);
        applyDefaultFit(w, h, guess);
      }
    };
    img.onerror = () => {
      // The CORS-mode load can fail even for a perfectly viewable image, when
      // the host doesn't send permissive CORS headers (some external/legacy
      // URLs). Retry once without it — the picture can then still be viewed
      // and positioned; export only needs CORS to avoid a tainted canvas, and
      // that failure (if it happens) is handled separately in handleSave.
      if (img.crossOrigin) {
        const retry = new Image();
        retry.decoding = 'async';
        retry.onload = () => {
          const w = retry.naturalWidth || 1;
          const h = retry.naturalHeight || 1;
          setNatural({ w, h });
          imgRef.current = retry;
          applyDefaultFit(w, h, presets[0]);
        };
        retry.onerror = () => {
          imgRef.current = null;
          setLoadFailed(true);
        };
        retry.src = imageSrc;
        return;
      }
      imgRef.current = null;
      setLoadFailed(true);
    };
    img.src = imageSrc;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageSrc, open]);

  const clampOffset = useCallback(
    (x: number, y: number, nextScale: number, vw = viewW, vh = viewH) => {
      const dispW = natural.w * nextScale;
      const dispH = natural.h * nextScale;
      const maxX = Math.max(0, (dispW - vw) / 2);
      const maxY = Math.max(0, (dispH - vh) / 2);
      return {
        x: Math.min(maxX, Math.max(-maxX, x)),
        y: Math.min(maxY, Math.max(-maxY, y)),
      };
    },
    [natural.h, natural.w, viewW, viewH],
  );

  const onPickPreset = (next: ProfileImageAspectPreset) => {
    setPreset(next);
    applyDefaultFit(natural.w, natural.h, next);
  };

  const onPointerDown = (event: React.PointerEvent) => {
    event.preventDefault();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    setDragging(true);
    dragStart.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y };
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (!dragging) return;
    const dx = event.clientX - dragStart.current.x;
    const dy = event.clientY - dragStart.current.y;
    setOffset(clampOffset(dragStart.current.ox + dx, dragStart.current.oy + dy, scale));
  };

  const onPointerUp = (event: React.PointerEvent) => {
    try {
      (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
    } catch {
      // ignore
    }
    setDragging(false);
  };

  const zoomMin = minCoverScale;
  const zoomMax = Math.max(zoomMin * 4, zoomMin + 0.01);

  const setScaleClamped = useCallback(
    (next: number) => {
      const clamped = Math.min(zoomMax, Math.max(zoomMin, next));
      setScale(clamped);
      setOffset((prev) => clampOffset(prev.x, prev.y, clamped));
    },
    [zoomMax, zoomMin, clampOffset],
  );

  const onZoomSlider = (event: React.ChangeEvent<HTMLInputElement>) => setScaleClamped(Number(event.target.value));
  const zoomStep = Math.max(0.02, (zoomMax - zoomMin) / 12 || 0.05);
  const onZoomIn = () => setScaleClamped(scale + zoomStep);
  const onZoomOut = () => setScaleClamped(scale - zoomStep);
  const onReset = () => applyDefaultFit(natural.w, natural.h, preset);

  const handleSave = () => {
    const source = imgRef.current;
    if (!source) {
      window.alert('Unable to load this image for adjustment. Try uploading again.');
      return;
    }
    const outLong = outputLongSide ?? (shape === 'circle' ? 256 : 800);
    const outW = preset.ratio >= 1 ? outLong : Math.round(outLong * preset.ratio);
    const outH = preset.ratio >= 1 ? Math.round(outLong / preset.ratio) : outLong;
    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const useTransparent = transparentOutput ?? shape === 'rect';
    if (!useTransparent) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, outW, outH);
    }
    if (shape === 'circle') {
      ctx.beginPath();
      ctx.arc(outW / 2, outH / 2, outW / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
    }

    const ratio = outW / viewW;
    const dispW = natural.w * scale;
    const dispH = natural.h * scale;
    const drawX = (viewW - dispW) / 2 + offset.x;
    const drawY = (viewH - dispH) / 2 + offset.y;

    try {
      ctx.drawImage(source, drawX * ratio, drawY * ratio, dispW * ratio, dispH * ratio);
      onSave({
        dataUrl: canvas.toDataURL('image/png'),
        crop: { scale, x: offset.x, y: offset.y, naturalW: natural.w, naturalH: natural.h },
      });
    } catch {
      window.alert('Unable to adjust this image (browser blocked the source). Try uploading a local file instead of a URL.');
    }
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onCancel();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onCancel, open]);

  if (typeof document === 'undefined') return null;

  const frameBg =
    (transparentOutput ?? shape === 'rect')
      ? { backgroundImage: 'repeating-conic-gradient(#f3f4f6 0% 25%, #ffffff 0% 50%)', backgroundSize: '16px 16px' }
      : { backgroundColor: '#F3F4F6' };

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <div className="absolute inset-0 bg-[rgba(17,24,39,0.55)]" onClick={onCancel} aria-hidden />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="relative w-full max-w-[420px] max-h-[92vh] overflow-y-auto rounded-2xl border border-[#E8EDF2] bg-white shadow-[0_24px_60px_rgba(15,23,42,0.28)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 pt-4 pb-2">
              <div className="text-[15px] font-extrabold text-[#111827]">{title}</div>
              {helpText ? <div className="text-[12px] text-[#6B7280] font-semibold mt-1">{helpText}</div> : null}
            </div>

            {presets.length > 1 && (
              <div className="px-5 pt-1 pb-2 flex flex-wrap gap-1.5">
                {presets.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onPickPreset(p)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                      preset.id === p.id
                        ? 'border-current'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                    style={preset.id === p.id ? { backgroundColor: `${accentColor}1A`, color: accentColor, borderColor: accentColor } : undefined}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}

            <div className="px-5 py-3 flex justify-center">
              <div
                className={`relative overflow-hidden touch-none select-none ${shape === 'circle' ? 'rounded-full' : 'rounded-xl'}`}
                style={{
                  width: viewW,
                  height: viewH,
                  cursor: dragging ? 'grabbing' : 'grab',
                  boxShadow: 'inset 0 0 0 1px rgba(15,23,42,0.08)',
                  ...frameBg,
                }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
              >
                {!loadFailed && (
                  <img
                    src={imageSrc}
                    alt=""
                    draggable={false}
                    className="pointer-events-none absolute max-w-none"
                    style={{
                      width: natural.w * scale,
                      height: natural.h * scale,
                      left: (viewW - natural.w * scale) / 2 + offset.x,
                      top: (viewH - natural.h * scale) / 2 + offset.y,
                    }}
                  />
                )}
                {loadFailed && (
                  <div className="absolute inset-0 flex items-center justify-center px-4 text-center">
                    <span className="text-[11px] font-bold text-[#9CA3AF]">Couldn't load this image for editing.</span>
                  </div>
                )}
                <div
                  className={`pointer-events-none absolute inset-0 ${shape === 'circle' ? 'rounded-full' : 'rounded-xl'}`}
                  style={{ boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.85)' }}
                  aria-hidden
                />
              </div>
            </div>

            {loadFailed && (
              <div className="px-5 pb-2 -mt-1 text-[11px] font-semibold text-[#B91C1C]">
                This image couldn't be loaded for editing (the source may be unavailable). Cancel and try Replace instead.
              </div>
            )}

            <div className="px-5 pb-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onZoomOut}
                  disabled={loadFailed}
                  aria-label="Zoom out"
                  title="Zoom out"
                  className="inline-flex items-center justify-center w-7 h-7 rounded-lg border border-slate-200 text-slate-600 hover:border-slate-300 shrink-0 disabled:opacity-40"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <input
                  type="range"
                  min={zoomMin}
                  max={zoomMax}
                  step={0.01}
                  value={scale}
                  disabled={loadFailed}
                  onChange={onZoomSlider}
                  aria-label="Zoom"
                  className="flex-1"
                  style={{ accentColor }}
                />
                <button
                  type="button"
                  onClick={onZoomIn}
                  disabled={loadFailed}
                  aria-label="Zoom in"
                  title="Zoom in"
                  className="inline-flex items-center justify-center w-7 h-7 rounded-lg border border-slate-200 text-slate-600 hover:border-slate-300 shrink-0 disabled:opacity-40"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={onReset}
                  disabled={loadFailed}
                  aria-label="Reset"
                  title="Reset"
                  className="inline-flex items-center justify-center w-7 h-7 rounded-lg border border-slate-200 text-slate-600 hover:border-slate-300 shrink-0 disabled:opacity-40"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="text-[10px] text-[#9CA3AF] font-semibold mt-1.5 text-center sm:text-left">
                Drag the photo to reposition. Zoom with the buttons or slider.
              </div>
            </div>

            <div className="px-5 py-4 flex justify-end gap-2 border-t border-[#F1F5F9] sticky bottom-0 bg-white">
              <button
                type="button"
                onClick={onCancel}
                className="rounded-lg bg-[#F3F4F6] px-4 py-2.5 text-[12px] font-extrabold text-[#374151] hover:bg-[#E5E7EB]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={loadFailed}
                className="rounded-lg px-4 py-2.5 text-[12px] font-extrabold text-white disabled:opacity-40"
                style={{ backgroundColor: accentColor }}
              >
                Save
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export default ProfileImageAdjustModal;
