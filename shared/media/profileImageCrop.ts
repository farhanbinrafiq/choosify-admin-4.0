/**
 * Shared profile-image adjustment parameters — used by User Profile, Brand
 * Studio, and Creator Studio alike (see src/components/media/
 * ProfileImageAdjustModal). Lives outside src/ and server/ so both the React
 * component and the plain server/catalog type files can import it without
 * either pulling in the other's dependency tree.
 *
 * `scale`/`x`/`y` describe how the rendered (cropped/output) image was framed
 * against the ORIGINAL upload at its `naturalW`×`naturalH` — never re-derived,
 * always exactly what ProfileImageAdjustModal reported on save.
 */
export type ProfileImageCropParams = {
  scale: number;
  x: number;
  y: number;
  naturalW: number;
  naturalH: number;
  /**
   * The editor frame's size (px) when the crop was saved. `scale`/`x`/`y` are
   * in that frame's pixels, and the frame shrinks on narrow screens, so these
   * let a later "Adjust" — on any screen — rescale the stored framing and pick
   * the same aspect preset. Absent on crops saved before this was recorded
   * (those were made in the 320px desktop frame).
   */
  frameW?: number;
  frameH?: number;
};

/** Keep only finite, positive frame dimensions (shared by every crop validator). */
export function cropFrameFields(value: Record<string, unknown>): { frameW?: number; frameH?: number } {
  const ok = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;
  return ok(value.frameW) && ok(value.frameH) ? { frameW: value.frameW, frameH: value.frameH } : {};
}
