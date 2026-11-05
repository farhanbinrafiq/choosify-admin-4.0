/**
 * Public ad delivery (Ads Studio → storefront).
 *
 * An ad is delivered only when ALL of these hold:
 *   kind banner|external · status 'active' (published by an admin, or approved-and-published) ·
 *   placement is an ACTIVE registry slot · format allowed in that slot · inside startsAt/endsAt ·
 *   image-led formats have a valid image (https or /media) whose size fits the slot when known.
 * 'approved' (approved but not published), pending, draft, rejected, paused, disabled and
 * cancelled ads are never served.
 *
 * The public payload is an allowlist of display fields only — no owner ids, reference ids,
 * approval notes, metadata, pricing or review data.
 */
import { readFile } from 'node:fs/promises';
import { join, normalize, sep } from 'node:path';
import type { AdRecord } from './types';
import { adsStore } from './adsStore';
import { billingBlocker, withBilling } from './adBilling';
import { getMediaStaticMount } from '../lib/mediaStorage';
import { AD_PLACEMENTS, checkCreativeFit, getAnyPlacementDef, getFormatDef, getPlacementDef, resolvePagePosition } from '../../shared/ads/placementRegistry';

export type PublicAdLink = { type: 'product' | 'brand' | 'creator' | 'guide' | 'deal' | 'url'; id?: string; url?: string; external: boolean };

export type PublicAd = {
  id: string;
  slot: string;
  format: string;
  display: 'natural' | 'cover' | 'text';
  image?: string;
  imageWidth?: number;
  imageHeight?: number;
  /** Accessible description of the creative (headline). */
  alt: string;
  headline?: string;
  subtext?: string;
  ctaLabel?: string;
  sponsorName?: string;
  sponsorLogoUrl?: string;
  /** Wide banners: the exact spot on the page (slot default when none chosen). */
  position?: string;
  /** Pop-up rules (pages it shows on, times per visit, delay). */
  popup?: { pages: string[]; maxPerSession: number; delaySec: number };
  /** In-grid cards: after every N cards (0 = once, after the last card). */
  gridEvery?: number;
  /** Image banners: draw headline + subtext over the image. */
  showText?: boolean;
  /** Wide banners on desktop: fill the frame edge to edge (crop top/bottom) instead of showing the whole design. */
  fit?: 'fill';
  focusY?: 'top' | 'center' | 'bottom';
  /** Category Promoted Slot: the category card this sponsor footer belongs to. */
  categoryId?: string;
  categoryName?: string;
  link: PublicAdLink | null;
};

const DEV_HOST = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//i;
/** https images, our own /media files, or (development only) http://localhost media. */
const SAFE_IMAGE = (u: unknown): u is string =>
  typeof u === 'string' && (/^https:\/\//i.test(u) || /^\/media\/[\w./-]+$/.test(u) || (process.env.NODE_ENV !== 'production' && DEV_HOST.test(u)));

/** The /media path of a URL served by THIS server (relative, production host, configured origin or localhost). */
function localMediaPath(url: string): string | null {
  if (url.startsWith('/media/')) return url;
  try {
    const u = new URL(url);
    const own = new Set(['dashboard.choosify.bd', 'localhost', '127.0.0.1']);
    const origin = process.env.MEDIA_PUBLIC_ORIGIN?.trim();
    if (origin) {
      try {
        own.add(new URL(origin).hostname);
      } catch {
        /* ignore */
      }
    }
    return own.has(u.hostname) && /^\/media\/[\w./-]+$/.test(u.pathname) ? u.pathname : null;
  } catch {
    return null;
  }
}

/** Destination of the ad, or null when none is set (the ad is then shown without a link). */
export function adLink(ad: AdRecord): PublicAdLink | null {
  const cta = ad.cta || {};
  const ext = (typeof ad.externalUrl === 'string' && ad.externalUrl) || (cta.destinationType === 'external' && typeof cta.url === 'string' ? cta.url : '');
  if (ext && /^https:\/\//i.test(ext)) return { type: 'url', url: ext, external: true };
  if (typeof cta.url === 'string' && /^\/(?!\/)[\w\-./?=&%#]*$/.test(cta.url)) return { type: 'url', url: cta.url, external: false };
  const t = String(cta.internalEntityType || '');
  const id = typeof cta.internalEntityId === 'string' ? cta.internalEntityId.trim() : '';
  if (id && ['product', 'brand', 'creator', 'guide', 'deal'].includes(t)) return { type: t as PublicAdLink['type'], id, external: false };
  if (ad.listingId) return { type: 'product', id: ad.listingId, external: false };
  return null;
}

/** Why an ad is (not) on the storefront right now. Empty list = delivered. */
export function deliveryProblems(ad: AdRecord, now = Date.now()): string[] {
  const out: string[] = [];
  if (ad.kind !== 'banner' && ad.kind !== 'external') out.push('Only banner / direct ads are shown in ad slots');
  if (ad.status !== 'active') {
    out.push(
      ad.status === 'approved'
        ? 'Approved but not published yet'
        : ad.status === 'pending'
          ? 'Waiting for approval'
          : `Status is ${ad.status}`,
    );
  }
  const any = getAnyPlacementDef(ad.placementId);
  const slot = getPlacementDef(ad.placementId);
  if (!any) out.push('No valid placement assigned');
  else if (!slot) out.push(`Placement ${any.placementId} is retired: ${any.retiredReason ?? 'not on the storefront'} — move this ad`);
  const format = getFormatDef(ad.formatId);
  if (!format) out.push('Unknown ad format');
  else if (slot && !slot.allowedFormats.includes(format.formatId)) out.push(`Format "${format.label}" is not allowed in ${slot.slotLabel}`);
  const start = ad.startsAt ? Date.parse(ad.startsAt) : NaN;
  const end = ad.endsAt ? Date.parse(ad.endsAt) : NaN;
  if (Number.isFinite(start) && start > now) out.push(`Scheduled — starts ${new Date(start).toISOString()}`);
  if (Number.isFinite(end) && end <= now) out.push(`Campaign ended ${new Date(end).toISOString()}`);
  const img = ad.creative?.imageUrl;
  if (format?.imageLed && !SAFE_IMAGE(img)) out.push('Missing or invalid image');
  const unpaid = billingBlocker(withBilling(ad));
  if (unpaid) out.push(unpaid);
  if (format?.formatId === 'cta_strip' && !String(ad.creative?.headline ?? '').trim()) out.push('CTA strip needs a headline');
  const chosen = ad.creative?.pagePosition;
  if (slot && chosen && !slot.positions?.some((p) => p.key === chosen)) out.push(`Position "${chosen}" does not exist on ${slot.pageLabel}`);
  if (format?.formatId === 'category_promoted_slot') {
    if (!String(ad.creative?.categoryId ?? '').trim()) out.push('Choose the category card this sponsor appears on');
    if (!String(ad.creative?.advertiserName ?? '').trim()) out.push('Category sponsor needs an advertiser name');
  }
  if (slot && format?.imageLed && SAFE_IMAGE(img)) {
    const w = Number(ad.creative?.imageWidth);
    const h = Number(ad.creative?.imageHeight);
    if (w > 0 && h > 0) {
      const fit = checkCreativeFit(slot, w, h);
      if ('error' in fit) out.push(fit.error);
    }
  }
  return out;
}

/** Our relative /media paths → absolute (the storefront runs on another domain). */
function absoluteMedia(url: string | undefined, origin: string): string | undefined {
  if (!url) return url;
  if (!url.startsWith('/media/')) return url;
  const base = (process.env.MEDIA_PUBLIC_ORIGIN?.trim() || origin).replace(/\/$/, '');
  return base ? `${base}${url}` : url;
}

export function toPublicAd(ad: AdRecord, origin = ''): PublicAd {
  const slot = getPlacementDef(ad.placementId)!;
  const format = getFormatDef(ad.formatId)!;
  const c = ad.creative || {};
  const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined);
  const headline = str(c.headline, 120) ?? str(ad.title, 120);
  return {
    id: ad.id,
    slot: slot.placementId,
    format: format.formatId,
    display: format.imageLed ? slot.creative?.display ?? 'cover' : 'text',
    image: SAFE_IMAGE(c.imageUrl) ? absoluteMedia(c.imageUrl, origin) : undefined,
    imageWidth: Number(c.imageWidth) > 0 ? Number(c.imageWidth) : undefined,
    imageHeight: Number(c.imageHeight) > 0 ? Number(c.imageHeight) : undefined,
    alt: headline ?? 'Sponsored',
    headline,
    subtext: str(c.subtext ?? c.body, 200),
    ctaLabel: str(ad.cta?.label, 30),
    // Only formats that ask for an advertiser carry one (a stale name never leaks onto other formats).
    sponsorName: format.fields.includes('advertiser') ? str(c.advertiserName, 60) : undefined,
    showText: format.imageLed && c.showText === true ? true : undefined,
    fit: slot.creative?.display === 'natural' && c.fit === 'fill' ? 'fill' : undefined,
    focusY: slot.creative?.display === 'natural' && c.fit === 'fill' && (c.focusY === 'top' || c.focusY === 'bottom') ? c.focusY : undefined,
    sponsorLogoUrl: SAFE_IMAGE(c.logoUrl) ? absoluteMedia(c.logoUrl, origin) : undefined,
    position: resolvePagePosition(slot, c.pagePosition),
    gridEvery: slot.slotKey === 'grid_card' ? (Number.isFinite(Number(c.gridEvery)) ? Number(c.gridEvery) : 8) : undefined,
    popup:
      format.formatId === 'popup'
        ? {
            pages: Array.isArray(c.popupPages) && c.popupPages.length ? c.popupPages.map(String) : ['all'],
            maxPerSession: Math.min(10, Math.max(1, Number(c.popupMaxPerSession) || 1)),
            delaySec: Math.min(60, Math.max(0, Number(c.popupDelaySec ?? 3) || 0)),
          }
        : undefined,
    categoryId: format.formatId === 'category_promoted_slot' ? str(c.categoryId, 80) : undefined,
    categoryName: format.formatId === 'category_promoted_slot' ? str(c.categoryName ?? c.hostCategoryName, 120) : undefined,
    link: adLink(ad),
  };
}

/** Every deliverable ad, grouped by slot (newest first). Slots with nothing are omitted. */
export async function deliverableAdsBySlot(now = Date.now(), origin = ''): Promise<Record<string, PublicAd[]>> {
  const rows = await adsStore.listAds({ statuses: ['active'] });
  const out: Record<string, PublicAd[]> = {};
  rows
    .filter((ad) => deliveryProblems(ad, now).length === 0)
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
    .forEach((ad) => {
      const p = toPublicAd(ad, origin);
      (out[p.slot] ||= []).push(p);
    });
  return out;
}

export const ACTIVE_SLOT_IDS = AD_PLACEMENTS.filter((p) => p.active).map((p) => p.placementId);

// ---------------------------------------------------------------------------------------------
// Image size (PNG / JPEG / WebP / GIF headers) — local /media files or https (size-capped)
// ---------------------------------------------------------------------------------------------

export function imageSizeFromBytes(b: Buffer): { width: number; height: number } | null {
  if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  if (b.length > 10 && b.toString('ascii', 0, 3) === 'GIF') return { width: b.readUInt16LE(6), height: b.readUInt16LE(8) };
  if (b.length > 30 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
    const chunk = b.toString('ascii', 12, 16);
    if (chunk === 'VP8X') return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
    if (chunk === 'VP8 ') return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
    if (chunk === 'VP8L') {
      const bits = b.readUInt32LE(21);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
  }
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) {
        i++;
        continue;
      }
      const marker = b[i + 1];
      const len = b.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) };
      i += 2 + len;
    }
  }
  return null;
}

/** Reads the pixel size of an ad image, or null when it cannot be determined. */
export async function probeImageSize(url: string | undefined): Promise<{ width: number; height: number } | null> {
  if (!url || !SAFE_IMAGE(url)) return null;
  try {
    const local = localMediaPath(url);
    if (local) {
      const { root, urlPrefix } = getMediaStaticMount();
      const rel = local.slice(urlPrefix.length).replace(/^\/+/, '');
      const full = normalize(join(root, rel));
      if (!full.startsWith(normalize(root) + sep)) return null;
      return imageSizeFromBytes(await readFile(full));
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    try {
      const r = await fetch(url, { signal: ctrl.signal, headers: { Range: 'bytes=0-131071' } });
      if (!r.ok && r.status !== 206) return null;
      const buf = Buffer.from(await r.arrayBuffer());
      return imageSizeFromBytes(buf.subarray(0, 4 * 1024 * 1024));
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return null;
  }
}
