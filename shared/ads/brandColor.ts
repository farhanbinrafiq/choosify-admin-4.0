/**
 * Ad cards coloured by the advertiser's logo: the logo's main colour (white / near-black /
 * see-through pixels ignored) becomes the card gradient, darkened until white text reads clearly.
 * A copy lives in Choosify-Web src/lib/ads/brandColor.ts — keep the two in step.
 */

export const HEX_RE = /^#[0-9a-f]{6}$/i;

function toRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const toHex = (r: number, g: number, b: number) => `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
const lum = ([r, g, b]: [number, number, number]) => {
  const c = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const mix = (hex: string, k: number) => {
  const [r, g, b] = toRgb(hex);
  return toHex(r * k, g * k, b * k);
};

const lighten = (hex: string, k: number) => {
  const [r, g, b] = toRgb(hex);
  return toHex(r + (255 - r) * k, g + (255 - g) * k, b + (255 - b) * k);
};
/** Darken until white text has strong contrast (luminance ≤ max). */
const readable = (hex: string, max: number) => {
  let c = hex;
  for (let i = 0; i < 16 && lum(toRgb(c)) > max; i++) c = mix(c, 0.85);
  return c;
};

/**
 * Card gradient from the logo's colours (white text stays readable); null → caller default.
 * Two colours: deep first colour flowing into the second. One colour: deep → brighter shade of it.
 */
export function brandGradient(hex: string | undefined | null, angle = 110, hex2?: string | null): string | null {
  if (!hex || !HEX_RE.test(hex)) return null;
  const a = readable(hex, 0.08);
  const b = hex2 && HEX_RE.test(hex2) ? readable(hex2, 0.2) : readable(lighten(hex, 0.35), 0.16);
  return `linear-gradient(${angle}deg, ${mix(a, 0.8)} 0%, ${a} 40%, ${b} 100%)`;
}

/** Main colour of a picture (browser only): saturated, non-white, non-black pixels win. */
export async function dominantColors(src: string): Promise<{ first: string; second: string | null } | null> {
  if (typeof document === 'undefined') return null;
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.decoding = 'async';
  const loaded = new Promise<boolean>((resolve) => {
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
  });
  img.src = src;
  if (!(await loaded)) return null;
  try {
    const size = 48;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, size, size);
    const px = ctx.getImageData(0, 0, size, size).data;
    const buckets = new Map<string, { n: number; r: number; g: number; b: number }>();
    for (let i = 0; i < px.length; i += 4) {
      const [r, g, b, a] = [px[i], px[i + 1], px[i + 2], px[i + 3]];
      if (a < 128) continue;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      if (max > 235 && min > 225) continue; // white / paper
      if (max < 22) continue; // black outline
      const sat = max === 0 ? 0 : (max - min) / max;
      const key = `${r >> 4}-${g >> 4}-${b >> 4}`;
      const w = 1 + sat * 3;
      const e = buckets.get(key) || { n: 0, r: 0, g: 0, b: 0 };
      e.n += w;
      e.r += r * w;
      e.g += g * w;
      e.b += b * w;
      buckets.set(key, e);
    }
    const ranked = [...buckets.values()].sort((x, y) => y.n - x.n).map((e) => toHex(e.r / e.n, e.g / e.n, e.b / e.n));
    if (!ranked.length) return null;
    let second: string | null = null;
    const [r1, g1, b1] = toRgb(ranked[0]);
    // second colour: the strongest one clearly different from the first
    for (const c of ranked.slice(1, 40)) {
      const [r, g, b] = toRgb(c);
      if (Math.abs(r - r1) + Math.abs(g - g1) + Math.abs(b - b1) > 120) {
        second = c;
        break;
      }
    }
    return { first: ranked[0], second };
  } catch {
    return null; // canvas tainted (logo on another site without CORS)
  }
}

/**
 * How much to zoom a logo so its content fills a round frame: finds the box of non-white,
 * non-transparent pixels and returns the zoom (1 = no margin; capped at 1.8). Browser only.
 */
export async function logoFillZoom(src: string): Promise<number | null> {
  if (typeof document === 'undefined') return null;
  const img = new Image();
  img.crossOrigin = 'anonymous';
  const ok = await new Promise<boolean>((resolve) => {
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = src;
  });
  if (!ok) return null;
  try {
    const n = 96;
    const c = document.createElement('canvas');
    c.width = n;
    c.height = n;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    // same framing as object-fit: cover in a square
    const s = Math.min(img.naturalWidth, img.naturalHeight);
    ctx.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, n, n);
    const px = ctx.getImageData(0, 0, n, n).data;
    let minX = n, minY = n, maxX = -1, maxY = -1;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const i = (y * n + x) * 4;
        const a = px[i + 3];
        const white = px[i] > 232 && px[i + 1] > 232 && px[i + 2] > 232;
        if (a > 40 && !white) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return 1;
    const w = maxX - minX + 1;
    const h = maxY - minY + 1;
    const zoom = n / Math.max(w, h);
    return Math.round(Math.min(1.8, Math.max(1, zoom * 0.98)) * 100) / 100;
  } catch {
    return null;
  }
}

/** The logo's main colour only. */
export async function dominantColor(src: string): Promise<string | null> {
  return (await dominantColors(src))?.first ?? null;
}

/**
 * How a logo should sit in a round frame. Round / square content (emblems, icons) → 'fill' with a
 * zoom that crops only empty margin; wide or tall content (wordmarks) → 'fit' whole inside a white
 * circle with padding, so nothing is cut off. Browser only.
 */
export async function logoFrame(src: string): Promise<{ fit: 'fill' | 'fit'; zoom: number } | null> {
  if (typeof document === 'undefined') return null;
  const img = new Image();
  img.crossOrigin = 'anonymous';
  const ok = await new Promise<boolean>((resolve) => {
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = src;
  });
  if (!ok || !img.naturalWidth || !img.naturalHeight) return null;
  try {
    const n = 128;
    const k = n / Math.max(img.naturalWidth, img.naturalHeight);
    const w0 = Math.max(1, Math.round(img.naturalWidth * k));
    const h0 = Math.max(1, Math.round(img.naturalHeight * k));
    const c = document.createElement('canvas');
    c.width = w0;
    c.height = h0;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w0, h0);
    const px = ctx.getImageData(0, 0, w0, h0).data;
    let minX = w0, minY = h0, maxX = -1, maxY = -1;
    for (let y = 0; y < h0; y++) {
      for (let x = 0; x < w0; x++) {
        const i = (y * w0 + x) * 4;
        if (px[i + 3] > 40 && !(px[i] > 232 && px[i + 1] > 232 && px[i + 2] > 232)) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return { fit: 'fit', zoom: 1 };
    const cw = maxX - minX + 1;
    const ch = maxY - minY + 1;
    const shape = cw / ch;
    if (shape < 0.8 || shape > 1.25) return { fit: 'fit', zoom: 1 };
    // round / square content: zoom so the content fills the (square-cropped) circle
    const side = Math.min(w0, h0);
    const zoom = side / Math.max(cw, ch);
    return { fit: 'fill', zoom: Math.round(Math.min(1.8, Math.max(1, zoom * 0.98)) * 100) / 100 };
  } catch {
    return null;
  }
}
