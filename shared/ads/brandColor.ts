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

/** Gradient for an ad card from a brand colour (white text stays readable); null → caller default. */
export function brandGradient(hex: string | undefined | null, angle = 110): string | null {
  if (!hex || !HEX_RE.test(hex)) return null;
  // darken until white text has at least ~7:1 contrast
  let base = hex;
  for (let i = 0; i < 12 && lum(toRgb(base)) > 0.1; i++) base = mix(base, 0.85);
  return `linear-gradient(${angle}deg, ${mix(base, 0.75)} 0%, ${base} 55%, ${mix(base, 0.6)} 100%)`;
}

/** Main colour of a picture (browser only): saturated, non-white, non-black pixels win. */
export async function dominantColor(src: string): Promise<string | null> {
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
    let best: { n: number; r: number; g: number; b: number } | null = null;
    for (const e of buckets.values()) if (!best || e.n > best.n) best = e;
    if (!best) return null;
    return toHex(best.r / best.n, best.g / best.n, best.b / best.n);
  } catch {
    return null; // canvas tainted (logo on another site without CORS)
  }
}
