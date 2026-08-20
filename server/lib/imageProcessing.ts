/**
 * Pre-VPS self-hosting pass — practical, non-overengineered image pipeline.
 * Every accepted image is re-encoded as WebP (never trust/store the
 * original codec as-is) and capped to a sane maximum dimension; a small
 * thumbnail variant is produced for list/card UI. Sharp also strips EXIF/
 * metadata by default on re-encode, which is the desired behavior here
 * (no need to preserve camera/location metadata on marketplace photos).
 */
import sharp from 'sharp';

const MAX_DIMENSION = 2000;
const THUMBNAIL_DIMENSION = 400;
const WEBP_QUALITY = 82;
const THUMBNAIL_QUALITY = 72;

export type ProcessedImage = {
  full: { buffer: Buffer; width: number; height: number };
  thumbnail: { buffer: Buffer; width: number; height: number };
};

/**
 * Re-encodes an uploaded image buffer to WebP, capped at MAX_DIMENSION on
 * the long edge (aspect ratio preserved, never upscaled), plus a smaller
 * thumbnail variant. Throws if Sharp can't parse the buffer as an image —
 * callers should treat that as a validation failure, not a 500.
 */
export async function processImage(buffer: Buffer): Promise<ProcessedImage> {
  const pipeline = sharp(buffer, { failOn: 'error' }).rotate(); // .rotate() auto-orients from EXIF before stripping it

  const full = await pipeline
    .clone()
    .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer({ resolveWithObject: true });

  const thumbnail = await pipeline
    .clone()
    .resize({ width: THUMBNAIL_DIMENSION, height: THUMBNAIL_DIMENSION, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: THUMBNAIL_QUALITY })
    .toBuffer({ resolveWithObject: true });

  return {
    full: { buffer: full.data, width: full.info.width, height: full.info.height },
    thumbnail: { buffer: thumbnail.data, width: thumbnail.info.width, height: thumbnail.info.height },
  };
}
