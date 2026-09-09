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
};
