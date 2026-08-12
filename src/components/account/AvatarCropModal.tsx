import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';

type AvatarCropModalProps = {
  open: boolean;
  imageSrc: string;
  onCancel: () => void;
  onSave: (dataUrl: string) => void;
};

const OUTPUT_SIZE = 256;
const VIEW_SIZE = 280;

/**
 * Circular avatar cropper: drag to reposition, slider to zoom, export square PNG.
 */
export function AvatarCropModal({ open, imageSrc, onCancel, onSave }: AvatarCropModalProps) {
  const [natural, setNatural] = useState({ w: 1, h: 1 });
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const imgRef = useRef<HTMLImageElement | null>(null);

  const minCoverScale = Math.max(VIEW_SIZE / natural.w, VIEW_SIZE / natural.h);

  useEffect(() => {
    if (!open) return;
    const img = new Image();
    img.decoding = 'async';
    // Allow canvas export for same-origin / data / CORS-friendly hosts.
    if (!imageSrc.startsWith('data:') && !imageSrc.startsWith('blob:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => {
      const w = img.naturalWidth || 1;
      const h = img.naturalHeight || 1;
      setNatural({ w, h });
      const cover = Math.max(VIEW_SIZE / w, VIEW_SIZE / h);
      setScale(cover);
      setOffset({ x: 0, y: 0 });
      imgRef.current = img;
    };
    img.onerror = () => {
      imgRef.current = null;
    };
    img.src = imageSrc;
  }, [imageSrc, open]);

  const clampOffset = useCallback(
    (x: number, y: number, nextScale: number) => {
      const dispW = natural.w * nextScale;
      const dispH = natural.h * nextScale;
      const maxX = Math.max(0, (dispW - VIEW_SIZE) / 2);
      const maxY = Math.max(0, (dispH - VIEW_SIZE) / 2);
      return {
        x: Math.min(maxX, Math.max(-maxX, x)),
        y: Math.min(maxY, Math.max(-maxY, y)),
      };
    },
    [natural.h, natural.w],
  );

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
      window.alert('Unable to load this image for cropping. Try Replace with a local photo.');
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Map view-space crop circle (VIEW_SIZE) → source image pixels.
    const ratio = OUTPUT_SIZE / VIEW_SIZE;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
    ctx.beginPath();
    ctx.arc(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    const dispW = natural.w * scale;
    const dispH = natural.h * scale;
    const drawX = (VIEW_SIZE - dispW) / 2 + offset.x;
    const drawY = (VIEW_SIZE - dispH) / 2 + offset.y;

    try {
      ctx.drawImage(source, drawX * ratio, drawY * ratio, dispW * ratio, dispH * ratio);
      onSave(canvas.toDataURL('image/png'));
    } catch {
      window.alert('Unable to crop this image (browser blocked external image). Use Replace to upload a local photo.');
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
  const zoomMax = Math.max(zoomMin * 3, zoomMin + 0.01);

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
            aria-label="Edit profile photo"
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="relative w-full max-w-[360px] rounded-2xl border border-[#E8EDF2] bg-white shadow-[0_24px_60px_rgba(15,23,42,0.28)] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 pt-4 pb-2">
              <div className="text-[15px] font-extrabold text-[#111827]">Edit profile photo</div>
              <div className="text-[12px] text-[#6B7280] font-semibold mt-1">
                Drag to reposition. Use the slider to zoom.
              </div>
            </div>

            <div className="px-5 py-3 flex justify-center">
              <div
                className="relative overflow-hidden rounded-full bg-[#F3F4F6] touch-none select-none"
                style={{
                  width: VIEW_SIZE,
                  height: VIEW_SIZE,
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
                    left: (VIEW_SIZE - natural.w * scale) / 2 + offset.x,
                    top: (VIEW_SIZE - natural.h * scale) / 2 + offset.y,
                  }}
                />
                <div
                  className="pointer-events-none absolute inset-0 rounded-full"
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
                  className="flex-1 accent-[#EF3C23]"
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
                className="rounded-lg px-4 py-2.5 text-[12px] font-extrabold text-white"
                style={{ backgroundImage: 'linear-gradient(90deg,#C8321A,#EF3C23)' }}
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

export default AvatarCropModal;
