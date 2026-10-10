/**
 * Shrinks a large photo in the browser before upload so it fits the server's
 * upload limit (UPLOAD_MAX_BYTES, 5 MB in production). Phone and camera photos
 * are often 6–15 MB; without this they were rejected by the server.
 *
 * Files already under the target, GIFs (may be animated) and environments
 * without canvas support are returned unchanged. If no step gets under the
 * target, the original is returned and the server's own size error applies.
 */

/** Stay safely under the 5 MB server limit. */
export const UPLOAD_TARGET_BYTES = Math.floor(4.5 * 1024 * 1024);

/** Longest edge / encoder quality, tried in order until the result fits. */
export const COMPRESSION_STEPS: ReadonlyArray<{ maxEdge: number; quality: number }> = [
  { maxEdge: 2560, quality: 0.86 },
  { maxEdge: 2048, quality: 0.8 },
  { maxEdge: 1600, quality: 0.75 },
  { maxEdge: 1280, quality: 0.7 },
];

/** Output size for an image scaled so its longest edge is at most maxEdge. */
export function scaledSize(width: number, height: number, maxEdge: number): { width: number; height: number } {
  const scale = Math.min(1, maxEdge / Math.max(width, height, 1));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export function needsCompression(file: { size: number; type: string }, targetBytes = UPLOAD_TARGET_BYTES): boolean {
  const type = (file.type || '').toLowerCase();
  if (type === 'image/gif') return false;
  return file.size > targetBytes;
}

function encode(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function prepareImageForUpload(file: File, targetBytes = UPLOAD_TARGET_BYTES): Promise<File> {
  if (!needsCompression(file, targetBytes)) return file;
  if (typeof document === 'undefined' || typeof createImageBitmap !== 'function') return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }
  try {
    const base = file.name.replace(/\.[^.]+$/, '') || 'photo';
    for (const step of COMPRESSION_STEPS) {
      const { width, height } = scaledSize(bitmap.width, bitmap.height, step.maxEdge);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return file;
      ctx.drawImage(bitmap, 0, 0, width, height);
      // WebP where the browser can encode it, JPEG otherwise (canvas falls back to PNG for unknown types).
      let blob = await encode(canvas, 'image/webp', step.quality);
      if (!blob || blob.type !== 'image/webp') blob = await encode(canvas, 'image/jpeg', step.quality);
      if (blob && blob.size <= targetBytes) {
        const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
        return new File([blob], `${base}.${ext}`, { type: blob.type, lastModified: Date.now() });
      }
    }
  } finally {
    bitmap.close?.();
  }
  return file;
}
