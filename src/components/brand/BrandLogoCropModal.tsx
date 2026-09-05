import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';

type BrandLogoCropModalProps = {
  open: boolean;
  imageSrc: string;
  onCancel: () => void;
  /** Normalized logo as a PNG data URL (transparent margins preserved, not matted). */
  onSave: (dataUrl: string) => void;
};

type AspectPreset = { id: string; label: string; ratio: number };

// Logos are naturally square, horizontal (wordmarks), or vertical — unlike
// an avatar, there is no single "correct" shape to force. These presets
// cover the realistic range without needing a full free-form resizable
// crop rectangle (which the existing AvatarCropModal architecture this is
// modeled on does not support and would be a much larger, riskier UI to
// introduce for this).
const ASPECT_PRESETS: AspectPreset[] = [
  { id: 'square', label: 'Square', ratio: 1 },
  { id: 'wide', label: 'Wide', ratio: 2 },
  { id: 'x-wide', label: 'Extra wide', ratio: 3 },
  { id: 'tall', label: 'Tall', ratio: 1 / 2 },
];

const VIEW_MAX = 320;
const OUTPUT_LONG_SIDE = 800;

function closestPresetFor(naturalW: number, naturalH: number): AspectPreset {
  const ratio = naturalW / Math.max(1, naturalH);
  return ASPECT_PRESETS.reduce((best, p) => (Math.abs(Math.log(p.ratio / ratio)) < Math.abs(Math.log(best.ratio / ratio)) ? p : best), ASPECT_PRESETS[0]);
}

/**
 * Brand logo framing tool: reuses the AvatarCropModal pattern (load image,
 * drag to reposition, slider to zoom, canvas export) but with a
 * rectangular viewport whose aspect ratio the seller picks — never a
 * forced 1:1 destructive crop — and no circular clip / opaque background
 * fill on export, so a source image's transparent margins stay
 * transparent in the normalized output instead of being matted white.
 */
export function BrandLogoCropModal({ open, imageSrc, onCancel, onSave }: BrandLogoCropModalProps) {
  const [natural, setNatural] = useState({ w: 1, h: 1 });
  const [preset, setPreset] = useState<AspectPreset>(ASPECT_PRESETS[0]);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const imgRef = useRef<HTMLImageElement | null>(null);

  const viewW = preset.ratio >= 1 ? VIEW_MAX : VIEW_MAX * preset.ratio;
  const viewH = preset.ratio >= 1 ? VIEW_MAX / preset.ratio : VIEW_MAX;

  const minCoverScale = useMemo(
    () => Math.max(viewW / natural.w, viewH / natural.h),
    [viewW, viewH, natural.w, natural.h],
  );

  const resetForPreset = useCallback(
    (w: number, h: number, nextPreset: AspectPreset) => {
      const vw = nextPreset.ratio >= 1 ? VIEW_MAX : VIEW_MAX * nextPreset.ratio;
      const vh = nextPreset.ratio >= 1 ? VIEW_MAX / nextPreset.ratio : VIEW_MAX;
      const cover = Math.max(vw / w, vh / h);
      setScale(cover);
      setOffset({ x: 0, y: 0 });
    },
    [],
  );

  useEffect(() => {
    if (!open) return;
    const img = new Image();
    img.decoding = 'async';
    if (!imageSrc.startsWith('data:') && !imageSrc.startsWith('blob:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => {
      const w = img.naturalWidth || 1;
      const h = img.naturalHeight || 1;
      setNatural({ w, h });
      const guess = closestPresetFor(w, h);
      setPreset(guess);
      resetForPreset(w, h, guess);
      imgRef.current = img;
    };
    img.onerror = () => {
      imgRef.current = null;
    };
    img.src = imageSrc;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageSrc, open]);

  const clampOffset = useCallback(
    (x: number, y: number, nextScale: number) => {
      const dispW = natural.w * nextScale;
      const dispH = natural.h * nextScale;
      const maxX = Math.max(0, (dispW - viewW) / 2);
      const maxY = Math.max(0, (dispH - viewH) / 2);
      return {
        x: Math.min(maxX, Math.max(-maxX, x)),
        y: Math.min(maxY, Math.max(-maxY, y)),
      };
    },
    [natural.h, natural.w, viewW, viewH],
  );

  const onPickPreset = (next: AspectPreset) => {
    setPreset(next);
    resetForPreset(natural.w, natural.h, next);
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

  const onZoomChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = Number(event.target.value);
    setScale(next);
    setOffset((prev) => clampOffset(prev.x, prev.y, next));
  };

  const handleSave = () => {
    const source = imgRef.current;
    if (!source) {
      window.alert('Unable to load this image for framing. Try uploading again.');
      return;
    }
    const outW = preset.ratio >= 1 ? OUTPUT_LONG_SIDE : Math.round(OUTPUT_LONG_SIDE * preset.ratio);
    const outH = preset.ratio >= 1 ? Math.round(OUTPUT_LONG_SIDE / preset.ratio) : OUTPUT_LONG_SIDE;
    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // No background fill — any part of the viewport not covered by the
    // source image (e.g. the seller zoomed out) stays transparent, rather
    // than being matted to an arbitrary color. A source image's own
    // transparent pixels are preserved the same way.
    const ratio = outW / viewW;
    const dispW = natural.w * scale;
    const dispH = natural.h * scale;
    const drawX = (viewW - dispW) / 2 + offset.x;
    const drawY = (viewH - dispH) / 2 + offset.y;

    try {
      ctx.drawImage(source, drawX * ratio, drawY * ratio, dispW * ratio, dispH * ratio);
      onSave(canvas.toDataURL('image/png'));
    } catch {
      window.alert('Unable to frame this image (browser blocked the source). Try uploading a local file instead of a URL.');
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

  const zoomMin = minCoverScale;
  const zoomMax = Math.max(zoomMin * 4, zoomMin + 0.01);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <div className="absolute inset-0 bg-[rgba(17,24,39,0.55)]" onClick={onCancel} aria-hidden />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Edit brand logo"
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="relative w-full max-w-[420px] rounded-2xl border border-[#E8EDF2] bg-white shadow-[0_24px_60px_rgba(15,23,42,0.28)] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 pt-4 pb-2">
              <div className="text-[15px] font-extrabold text-[#111827]">Edit brand logo</div>
              <div className="text-[12px] text-[#6B7280] font-semibold mt-1">
                Frame the useful logo area. Pick a shape, zoom, and drag to reposition — nothing outside the frame is saved.
              </div>
            </div>

            <div className="px-5 pt-1 pb-2 flex flex-wrap gap-1.5">
              {ASPECT_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onPickPreset(p)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                    preset.id === p.id
                      ? 'bg-[#FF5B00]/10 border-[#FF5B00] text-[#FF5B00]'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="px-5 py-3 flex justify-center">
              <div
                className="relative overflow-hidden rounded-xl bg-[repeating-conic-gradient(#f3f4f6_0%_25%,#ffffff_0%_50%)] touch-none select-none"
                style={{
                  width: viewW,
                  height: viewH,
                  backgroundSize: '16px 16px',
                  cursor: dragging ? 'grabbing' : 'grab',
                  boxShadow: 'inset 0 0 0 1px rgba(15,23,42,0.08)',
                }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
              >
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
                <div
                  className="pointer-events-none absolute inset-0 rounded-xl"
                  style={{ boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.85)' }}
                  aria-hidden
                />
              </div>
            </div>

            <div className="px-5 pb-2">
              <label className="flex items-center gap-3">
                <span className="text-[11px] font-extrabold text-[#6B7280] tracking-wide">ZOOM</span>
                <input
                  type="range"
                  min={zoomMin}
                  max={zoomMax}
                  step={0.01}
                  value={scale}
                  onChange={onZoomChange}
                  className="flex-1 accent-[#FF5B00]"
                />
              </label>
            </div>

            <div className="px-5 py-4 flex justify-end gap-2 border-t border-[#F1F5F9]">
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
                className="rounded-lg px-4 py-2.5 text-[12px] font-extrabold text-white bg-[#FF5B00] hover:brightness-110"
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

export default BrandLogoCropModal;
