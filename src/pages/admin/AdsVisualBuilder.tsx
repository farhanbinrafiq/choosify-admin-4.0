import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AdPaymentPanel } from '../../components/ads/AdPaymentPanel';
import { ArrowLeft, Image as ImageIcon, Loader2, Upload } from 'lucide-react';
import {
  AD_FORMATS,
  AD_PLACEMENTS,
  assertFormatPlacementCompatible,
  checkCreativeFit,
  getFormatDef,
  getPlacementDef,
  listPages,
  POPUP_PAGES,
  GRID_EVERY_CHOICES,
  GRID_ROW_CHOICES,
  IN_GRID_POSITION,
  type AdFormatId,
  type AdPlacementDef,
} from '@/shared/ads/placementRegistry';
import { inferHeroMediaType, type HeroMediaType } from '@/shared/ads/heroMedia';
import { RATE_TIER_LABEL, formatBdt, quoteAd } from '@/shared/ads/pricing';
import { StorefrontAdPresentation } from '../../components/ads/storefront';
import { AdFitStatus, AdSlotPreview, AdSlotSpec, measureImage } from '../../components/ads/AdSlotPreview';
import { CategorySearchSelect } from '../../components/ads/CategorySearchSelect';
import { EntityPicker, type PickableType } from '../../components/ads/EntityPicker';
import { SponsoredListingPreview } from '../../components/ads/SponsoredListingPreview';
import { LinkInput } from './website/StudioKit';
import { brandGradient, dominantColors, logoFrame } from '@/shared/ads/brandColor';
import { useAuth } from '../../contexts/AuthContext';
import { adsApi, type AdsApiRecord, type EligibleListing } from '../../services/adsApi';
import { catalogApi } from '../../services/catalogApi';
import { uploadProductImage } from '../../services/mediaUpload';
import type { CatalogCategory } from '../../types/catalog';

type DestMode = 'internal' | 'external';

const DEFAULT_FORMAT: AdFormatId = 'hero_banner';

function fieldsFor(formatId: AdFormatId) {
  return new Set(getFormatDef(formatId)?.fields || []);
}

function placementsForFormat(formatId: AdFormatId, role?: string) {
  const r = (role || 'admin').toLowerCase();
  const owner: 'admin' | 'seller' | 'creator' =
    r === 'seller' ? 'seller' : r === 'creator' ? 'creator' : 'admin';
  return AD_PLACEMENTS.filter(
    (p) => p.active && p.allowedFormats.includes(formatId) && p.ownerRoles.includes(owner),
  );
}

type FieldTone = 'advertiser' | 'headline' | 'subtext' | 'cta' | 'link';

/** Colour per kind of field, so each is easy to spot while editing (static classes for Tailwind). */
const TONES: Record<FieldTone, { box: string; dot: string; badge: string; input: string }> = {
  advertiser: { box: 'border-[#CBD5E1] bg-[#F8FAFC]', dot: 'bg-[#64748B]', badge: 'bg-[#E2E8F0] text-[#334155]', input: 'border-[#CBD5E1] focus:border-[#64748B]' },
  headline: { box: 'border-[#C4B5FD] bg-[#F5F3FF]', dot: 'bg-[#7C3AED]', badge: 'bg-[#EDE9FE] text-[#5B21B6]', input: 'border-[#C4B5FD] focus:border-[#7C3AED]' },
  subtext: { box: 'border-[#7DD3FC] bg-[#F0F9FF]', dot: 'bg-[#0284C7]', badge: 'bg-[#E0F2FE] text-[#075985]', input: 'border-[#7DD3FC] focus:border-[#0284C7]' },
  cta: { box: 'border-[#FDBA74] bg-[#FFF7ED]', dot: 'bg-[#FF5B00]', badge: 'bg-[#FFEDD5] text-[#9A3412]', input: 'border-[#FDBA74] focus:border-[#FF5B00]' },
  link: { box: 'border-[#93C5FD] bg-[#EFF6FF]', dot: 'bg-[#2563EB]', badge: 'bg-[#DBEAFE] text-[#1E40AF]', input: 'border-[#93C5FD] focus:border-[#2563EB]' },
};

function FieldBox({ tone, label, where, className = '', children }: { tone: FieldTone; label: string; where?: string; className?: string; children: React.ReactNode }) {
  const t = TONES[tone];
  return (
    <div className={`rounded-lg border-2 px-3 py-2.5 ${t.box} ${className}`} data-testid={`field-${tone}`}>
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${t.dot}`} />
        <span className="text-[11.5px] font-extrabold text-[#111827]">{label}</span>
        {where ? <span className={`rounded px-1.5 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wide ${t.badge}`}>{where}</span> : null}
      </div>
      {children}
    </div>
  );
}

const fieldInput = (tone: FieldTone) => `w-full rounded-md border-2 bg-white px-3 py-2 text-[12.5px] outline-none ${TONES[tone].input}`;

type PageRow = { key: string; placement: AdPlacementDef; position: string; label: string; order: number };

/** Every place an ad can go on one page, in page order (wide banners expand to their spots). */
function pageRowsFor(pageKey: string, role?: string): PageRow[] {
  const r = (role || 'admin').toLowerCase();
  const owner: 'admin' | 'seller' | 'creator' = r === 'seller' ? 'seller' : r === 'creator' ? 'creator' : 'admin';
  const rows: PageRow[] = [];
  for (const p of AD_PLACEMENTS) {
    if (!p.active || p.pageKey !== pageKey || !p.ownerRoles.includes(owner)) continue;
    if (p.positions?.length) {
      p.positions.forEach((pos, i) =>
        rows.push({ key: `${p.placementId}:${pos.key}`, placement: p, position: pos.key, label: pos.label, order: pos.order ?? (p.pageOrder ?? 50) + i / 100 }),
      );
    } else {
      rows.push({ key: p.placementId, placement: p, position: '', label: p.sectionLabel.replace(/^[^:—]*[:—]\s*/, ''), order: p.pageOrder ?? 50 });
    }
  }
  return rows.sort((a, b) => a.order - b.order);
}

/** Plain-language shape of a place (what the advertiser needs to design). */
function shapeOf(p: AdPlacementDef): string {
  if (p.placementId === 'HOME_HERO') return 'Hero slide';
  if (p.allowedFormats.includes('sponsored_listing')) return 'In-list card';
  if (p.orientation === 'horizontal') return 'Wide banner';
  if (p.orientation === 'embedded') return 'Card footer strip';
  if (p.slotKey === 'popup') return 'Pop-up';
  if (p.slotKey === 'grid_card') return 'Grid card';
  if (p.slotKey === 'feed') return 'Feed card';
  return 'Side card';
}

export default function AdsVisualBuilder() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const payMode = searchParams.get('pay') === '1';
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { profile } = useAuth();
  const role = profile?.role || 'seller';
  const isAdmin = role === 'admin' || role === 'super_admin';

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  /** Status shown next to the upload button (not only at the top of the page). */
  const [uploadNote, setUploadNote] = useState<{ kind: 'busy' | 'ok' | 'error' | 'tip'; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [existing, setExisting] = useState<AdsApiRecord | null>(null);
  const [listings, setListings] = useState<EligibleListing[]>([]);
  const [previewInPlacement, setPreviewInPlacement] = useState(true);
  /** Natural size of the current creative image (measured in the browser; the server re-measures). */
  const [imageDims, setImageDims] = useState<{ width: number; height: number } | null>(null);

  const [formatId, setFormatId] = useState<AdFormatId>(DEFAULT_FORMAT);
  const [pageKey, setPageKey] = useState('homepage');
  const [placementId, setPlacementId] = useState('HOME_HERO');
  /** Exact spot on the page for wide banners ('' = the slot's default spot). */
  const [pagePosition, setPagePosition] = useState('');
  /** Other banner ads, to show which spots are already taken. */
  const [otherAds, setOtherAds] = useState<AdsApiRecord[]>([]);
  const [advertiserName, setAdvertiserName] = useState('');
  const [headline, setHeadline] = useState('');
  const [subtext, setSubtext] = useState('');
  const [ctaLabel, setCtaLabel] = useState('Shop Now');
  /** Image banners: draw headline + subtext over the image on the storefront. */
  const [showText, setShowText] = useState(false);
  /** Wide banners on desktop: whole design (side fill) or fill edge to edge (crop top/bottom). */
  const [fit, setFit] = useState<'whole' | 'fill'>('whole');
  const [focusY, setFocusY] = useState<'top' | 'center' | 'bottom'>('center');
  /** Pop-up rules. */
  const [popupPages, setPopupPages] = useState<string[]>(['all']);
  const [popupMax, setPopupMax] = useState(1);
  const [popupDelay, setPopupDelay] = useState(3);
  /** In-grid cards: after every N cards (0 = once at the end). */
  const [gridEvery, setGridEvery] = useState(8);
  /** In-grid card: show only once (after the Nth card) instead of repeating. */
  const [gridOnce, setGridOnce] = useState(false);
  const [listRow, setListRow] = useState(2);
  const [imageUrl, setImageUrl] = useState('');
  /** Optional taller picture shown on phones (wide banners / pop-ups). */
  const [mobileImageUrl, setMobileImageUrl] = useState('');
  const [mobileUploading, setMobileUploading] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [posterUrl, setPosterUrl] = useState('');
  const [mediaType, setMediaType] = useState<HeroMediaType>('image');
  const [logoUrl, setLogoUrl] = useState('');
  /** Card colour from the logo (on by default when a logo is set). */
  const [logoColor, setLogoColor] = useState('');
  const [logoColor2, setLogoColor2] = useState('');
  const [useLogoColor, setUseLogoColor] = useState(true);
  /** Zoom that crops the logo's own white margin so it fills its round frame. */
  const [logoZoom, setLogoZoom] = useState(1);
  /** 'fill' = round/square logo fills the circle; 'fit' = wide/tall logo shown whole on white. */
  const [logoFit, setLogoFit] = useState<'fill' | 'fit'>('fill');
  const [listingId, setListingId] = useState('');
  const [destMode, setDestMode] = useState<DestMode>('internal');
  const [internalEntityType, setInternalEntityType] = useState('product');
  /** Category links go to /categories?category=<slug>. */
  const [internalEntitySlug, setInternalEntitySlug] = useState('');
  /** "A Choosify page" destination (About, Terms, /pages/…): its path. */
  const [pagePath, setPagePath] = useState('');
  const [internalEntityId, setInternalEntityId] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [hostCategoryId, setHostCategoryId] = useState('');
  const [hostCategoryName, setHostCategoryName] = useState('');
  const [hostCategoryImageUrl, setHostCategoryImageUrl] = useState('');
  const [hostSubcategories, setHostSubcategories] = useState<string[]>([]);
  const [catalogCategories, setCatalogCategories] = useState<CatalogCategory[]>([]);
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [salePriceLabel, setSalePriceLabel] = useState('');
  const [previousPriceLabel, setPreviousPriceLabel] = useState('');
  const [discountLabel, setDiscountLabel] = useState('');
  const [productTitle, setProductTitle] = useState('');

  const fields = useMemo(() => fieldsFor(formatId), [formatId]);
  const pages = useMemo(() => listPages(), []);
  const availablePlacements = useMemo(
    () => placementsForFormat(formatId, role).filter((p) => p.pageKey === pageKey),
    [formatId, pageKey, role],
  );
  const allFormatPlacements = useMemo(() => placementsForFormat(formatId, role), [formatId, role]);
  const placementDef = getPlacementDef(placementId);
  const formatDef = getFormatDef(formatId);
  useEffect(() => {
    if (!logoUrl) return;
    let alive = true;
    void dominantColors(logoUrl).then((c) => {
      if (alive && c) {
        setLogoColor(c.first);
        setLogoColor2(c.second || '');
      }
    });
    void logoFrame(logoUrl).then((f) => {
      if (alive && f) {
        setLogoFit(f.fit);
        setLogoZoom(f.zoom);
      }
    });
    return () => {
      alive = false;
    };
  }, [logoUrl]);
  /** Sponsored Listing: promotes one product / brand (internal only, types the slot lists). */
  const isListing = formatId === 'sponsored_listing';
  /** Wide banner placed inside a results grid (between two rows of cards). */
  const isInGrid = !isListing && formatId !== 'popup' && pagePosition === IN_GRID_POSITION;
  useEffect(() => {
    if (!isListing) return;
    if (destMode !== 'internal') setDestMode('internal');
    const allowed = (placementDef?.entityTypes ?? ['product', 'brand']).filter((t) => t === 'product' || t === 'brand');
    if (allowed.length && !allowed.includes(internalEntityType as 'product' | 'brand')) {
      setInternalEntityType(allowed[0]);
      setInternalEntityId('');
      setInternalEntitySlug('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isListing, placementDef?.placementId]);
  const fitError =
    placementDef && formatDef?.imageLed && imageDims
      ? (() => {
          const fit = checkCreativeFit(placementDef, imageDims.width, imageDims.height);
          return 'error' in fit ? fit.error : null;
        })()
      : null;
  const listingLocked = Boolean(listingId) && formatId === 'deal_of_the_day';

  useEffect(() => {
    let alive = true;
    adsApi.listBanners().then((rows) => alive && setOtherAds(rows)).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  // Spot list follows the chosen slot: drop a spot that the new slot does not have.
  useEffect(() => {
    if (pagePosition && !placementDef?.positions?.some((p) => p.key === pagePosition)) setPagePosition('');
  }, [placementDef, pagePosition]);

  /** Every place on the chosen page, in page order. */
  const pageRows = useMemo(() => pageRowsFor(pageKey, role), [pageKey, role]);

  /** Live ads already in each place (key = placementId or placementId:spot; this ad excluded). */
  const placeOccupancy = useMemo(() => {
    const map: Record<string, AdsApiRecord[]> = {};
    for (const a of otherAds) {
      if (a.id === id || a.status !== 'active') continue; // only ads shoppers can see right now
      const slot = AD_PLACEMENTS.find((p) => p.placementId === a.placementId);
      if (!slot) continue;
      const c = (a.creative || {}) as Record<string, unknown>;
      const key = slot.positions?.length
        ? `${slot.placementId}:${slot.positions.some((p) => p.key === c.pagePosition) ? String(c.pagePosition) : slot.defaultPosition}`
        : slot.placementId;
      (map[key] ||= []).push(a);
    }
    return map;
  }, [otherAds, id]);

  const isRowChosen = (row: PageRow) =>
    row.placement.placementId === placementId &&
    (!row.position || (pagePosition || row.placement.defaultPosition) === row.position);

  /** Choose a place; switches to a format the place accepts when the current one does not fit. */
  const chooseRow = (row: PageRow) => {
    if (!row.placement.allowedFormats.includes(formatId)) setFormatId(row.placement.allowedFormats[0] as AdFormatId);
    setPlacementId(row.placement.placementId);
    if (row.position === IN_GRID_POSITION && pagePosition !== IN_GRID_POSITION) setListRow(1);
    setPagePosition(row.position);
  };

  const choosePage = (next: string) => {
    setPageKey(next);
    const rows = pageRowsFor(next, role);
    const first = rows.find((r) => r.placement.allowedFormats.includes(formatId)) ?? rows[0];
    if (first) chooseRow(first);
  };

  // A success note from an earlier save must not sit next to a new, unsaved shape / position.
  useEffect(() => {
    setMessage(null);
    setError(null);
  }, [formatId, placementId, pagePosition]);

  const hydrateFromRecord = useCallback((ad: AdsApiRecord) => {
    setExisting(ad);
    const creative = (ad.creative || {}) as Record<string, string>;
    const cta = (ad.cta || {}) as Record<string, string>;
    if (ad.formatId) setFormatId(ad.formatId as AdFormatId);
    if (ad.pageKey) setPageKey(ad.pageKey);
    if (ad.placementId) setPlacementId(ad.placementId);
    setPagePosition(creative.pagePosition || '');
    setAdvertiserName(creative.advertiserName || '');
    setHeadline(creative.headline || ad.title || '');
    setSubtext(creative.body || creative.subtext || '');
    setCtaLabel(cta.label || 'Shop Now');
    setShowText((ad.creative as Record<string, unknown> | undefined)?.showText === true);
    setFit((ad.creative as Record<string, unknown> | undefined)?.fit === 'fill' ? 'fill' : 'whole');
    {
      const c = (ad.creative || {}) as Record<string, unknown>;
      setPopupPages(Array.isArray(c.popupPages) && c.popupPages.length ? (c.popupPages as string[]) : ['all']);
      setPopupMax(Number(c.popupMaxPerSession) || 1);
      setPopupDelay(c.popupDelaySec === undefined ? 3 : Number(c.popupDelaySec) || 0);
      setGridEvery(c.gridEvery === undefined ? 8 : Number(c.gridEvery));
      setGridOnce(c.gridOnce === true);
      setListRow(Number(c.listRow) >= 1 ? Number(c.listRow) : 2);
    }
    {
      const f = (ad.creative as Record<string, unknown> | undefined)?.focusY;
      setFocusY(f === 'top' || f === 'bottom' ? f : 'center');
    }
    setImageUrl(creative.imageUrl || '');
    setMobileImageUrl(typeof creative.mobileImageUrl === 'string' ? creative.mobileImageUrl : '');
    setVideoUrl(creative.videoUrl || '');
    setPosterUrl(creative.posterUrl || '');
    setMediaType(
      inferHeroMediaType(
        creative.videoUrl || creative.imageUrl,
        creative.mediaType as HeroMediaType | undefined,
      ),
    );
    setLogoUrl(creative.logoUrl || '');
    setLogoColor(typeof creative.logoColor === 'string' && creative.logoColor !== 'none' ? creative.logoColor : '');
    // On unless the advertiser turned it off ('none').
    setUseLogoColor(creative.logoColor !== 'none');
    setListingId(ad.listingId || '');
    setProductTitle(creative.productTitle || '');
    setSalePriceLabel(creative.salePriceLabel || '');
    setPreviousPriceLabel(creative.previousPriceLabel || '');
    setDiscountLabel(creative.discountLabel || '');
    setHostCategoryId(String(creative.categoryId || ''));
    setHostCategoryName(creative.hostCategoryName || creative.categoryName || '');
    setHostCategoryImageUrl(creative.hostCategoryImageUrl || '');
    setStartsAt(ad.startsAt ? ad.startsAt.slice(0, 16) : '');
    setEndsAt(ad.endsAt ? ad.endsAt.slice(0, 16) : '');
    if (ad.externalUrl) {
      setDestMode('external');
      setExternalUrl(ad.externalUrl);
    } else {
      setDestMode('internal');
      const isPage = !cta.internalEntityType && !ad.listingId && typeof cta.url === 'string' && cta.url.startsWith('/') && !/^\/categories\?category=/.test(cta.url);
      setInternalEntityType(isPage ? 'page' : cta.internalEntityType || 'product');
      setPagePath(isPage ? String(cta.url) : '');
      setInternalEntityId(cta.internalEntityId || ad.listingId || '');
      {
        const m = /^\/categories\?category=([^&]+)/.exec(cta.url || '');
        setInternalEntitySlug(m ? decodeURIComponent(m[1]) : '');
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const eligible = await adsApi.listEligibleListings().catch(() => [] as EligibleListing[]);
        if (!cancelled) setListings(eligible);
        const cats = await catalogApi.listCategories().catch(() => [] as CatalogCategory[]);
        if (!cancelled) setCatalogCategories(Array.isArray(cats) ? cats : []);
        if (isEdit && id) {
          const ad = await adsApi.getAd(id);
          if (!cancelled) hydrateFromRecord(ad);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load ad');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrateFromRecord, id, isEdit]);

  // Keep subcategory chips in sync with selected category (children of categoryId).
  useEffect(() => {
    if (!hostCategoryId || !catalogCategories.length) {
      setHostSubcategories([]);
      return;
    }
    const children = catalogCategories
      .filter((c) => c.parentId === hostCategoryId && c.enabled !== false)
      .sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name))
      .map((c) => c.name)
      .slice(0, 6);
    setHostSubcategories(children);

    // Resolve presentation name from catalog when we have an id.
    const match = catalogCategories.find((c) => c.id === hostCategoryId);
    if (match) {
      setHostCategoryName((prev) => (prev === match.name ? prev : match.name));
    }
  }, [hostCategoryId, catalogCategories]);

  // Legacy creatives stored only hostCategoryName — map to authoritative id when possible.
  useEffect(() => {
    if (hostCategoryId || !hostCategoryName || !catalogCategories.length) return;
    const byName = catalogCategories.find(
      (c) => c.enabled !== false && c.name.toLowerCase() === hostCategoryName.trim().toLowerCase(),
    );
    if (byName) setHostCategoryId(byName.id);
  }, [hostCategoryId, hostCategoryName, catalogCategories]);

  // Keep placement valid when format/page changes
  // (format changed from the format cards: stay on this page when it has a place for the format,
  //  otherwise go to the first page that does)
  useEffect(() => {
    if (availablePlacements.some((p) => p.placementId === placementId)) return;
    if (availablePlacements[0]) {
      setPlacementId(availablePlacements[0].placementId);
      return;
    }
    const pagesForFormat = [...new Set(allFormatPlacements.map((p) => p.pageKey))];
    if (pagesForFormat[0] && pagesForFormat[0] !== pageKey) setPageKey(pagesForFormat[0]);
  }, [allFormatPlacements, availablePlacements, pageKey, placementId]);

  const onSelectListing = (lid: string) => {
    setListingId(lid);
    const listing = listings.find((l) => l.id === lid);
    if (!listing) return;
    if (!headline) setHeadline(listing.title);
    if (!productTitle) setProductTitle(listing.title);
    if (!imageUrl && listing.image) setImageUrl(listing.image);
    if (!advertiserName && listing.brandId) setAdvertiserName(listing.brandId);
    setInternalEntityType('product');
    setInternalEntityId(lid);
    // Prices hydrate from server on save when linked
    setSalePriceLabel('');
    setPreviousPriceLabel('');
    setDiscountLabel('');
  };

  const uploadCreative = async (file: File | null, kind: 'image' | 'logo' | 'poster') => {
    if (!file) return;
    setUploading(true);
    setError(null);
    const mb = (file.size / 1024 / 1024).toFixed(1);
    setUploadNote({ kind: 'busy', text: `Uploading ${file.name} (${mb} MB)… large photos are shrunk first, this can take a few seconds.` });
    try {
      if (!file.type.startsWith('image/')) {
        throw new Error('Only image/GIF files can be uploaded. For Hero video, paste a hosted mp4/webm URL.');
      }
      let dims: { width: number; height: number } | null = null;
      if (kind === 'image') {
        dims = await measureImage(file);
        if (placementDef && dims) {
          const fit = checkCreativeFit(placementDef, dims.width, dims.height);
          if ('error' in fit) throw new Error(fit.error);
        }
        if (!dims) throw new Error('This image could not be read — try saving it again as JPG or PNG.');
      }
      const url = await uploadProductImage(file);
      if (kind === 'image') setImageDims(dims);
      if (kind === 'logo') {
        setLogoUrl(url);
      } else if (kind === 'poster') {
        setPosterUrl(url);
      } else {
        setImageUrl(url);
        if (formatId === 'hero_banner') {
          const inferred = inferHeroMediaType(url, file.type === 'image/gif' ? 'gif' : 'image');
          setMediaType(inferred === 'video' ? 'image' : inferred);
        }
      }
      setMessage('Creative uploaded');
      const tip =
        kind === 'image' && placementDef && dims
          ? (() => {
              const fit = checkCreativeFit(placementDef, dims.width, dims.height);
              return 'warnings' in fit && fit.warnings.length ? fit.warnings[0] : null;
            })()
          : null;
      setUploadNote(tip ? { kind: 'tip', text: `Uploaded. ${tip}` } : { kind: 'ok', text: 'Uploaded ✓' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      const friendly = /413|too large|entity too large|payload/i.test(msg)
        ? 'This file is too large to upload. Save it smaller (under about 5 MB, e.g. JPG or WebP) and try again.'
        : /network|failed to fetch/i.test(msg)
          ? 'Upload failed — the connection dropped. Check your internet and try again.'
          : msg;
      setError(friendly);
      setUploadNote({ kind: 'error', text: `Not uploaded — ${friendly}` });
    } finally {
      setUploading(false);
    }
  };

  const buildPayload = (opts: { asDraft: boolean; publishNow?: boolean }) => {
    const compat = assertFormatPlacementCompatible(formatId, placementId);
    if (compat.ok === false) {
      throw new Error(compat.error);
    }
    if (fields.has('hostCategory') && !hostCategoryId.trim()) {
      throw new Error('Select an existing Choosify category for Category Promoted Slot');
    }

    const title = (headline || advertiserName || formatDef?.label || 'Banner Ad').trim();
    const resolvedMediaType =
      formatId === 'hero_banner'
        ? inferHeroMediaType(videoUrl || imageUrl, mediaType)
        : undefined;
    const creative: Record<string, unknown> = {
      pagePosition: placementDef?.positions?.length ? pagePosition || placementDef.defaultPosition : undefined,
      showText: formatDef?.imageLed && fields.has('headline') ? showText : undefined,
      fit: placementDef?.creative?.display === 'natural' && placementDef.slotKey !== 'popup' ? fit : undefined,
      gridEvery: placementDef?.slotKey === 'grid_card' ? gridEvery : undefined,
      gridOnce: placementDef?.slotKey === 'grid_card' && gridEvery > 0 && gridOnce ? true : undefined,
      listRow: formatId === 'sponsored_listing' || isInGrid ? listRow : undefined,
      popupPages: formatId === 'popup' ? popupPages : undefined,
      popupMaxPerSession: formatId === 'popup' ? popupMax : undefined,
      popupDelaySec: formatId === 'popup' ? popupDelay : undefined,
      focusY: placementDef?.creative?.display === 'natural' && placementDef.slotKey !== 'popup' && fit === 'fill' ? focusY : undefined,
      advertiserName: fields.has('advertiser') ? advertiserName || undefined : undefined,
      headline: headline || undefined,
      body: subtext || undefined,
      subtext: subtext || undefined,
      imageUrl: imageUrl || undefined,
      mobileImageUrl: formatDef?.imageLed && formatId !== 'hero_banner' && mobileImageUrl ? mobileImageUrl : undefined,
      videoUrl: formatId === 'hero_banner' && resolvedMediaType === 'video' ? videoUrl || undefined : undefined,
      posterUrl: formatId === 'hero_banner' && resolvedMediaType === 'video' ? posterUrl || imageUrl || undefined : undefined,
      mediaType: formatId === 'hero_banner' ? resolvedMediaType : undefined,
      logoUrl: logoUrl || undefined,
      logoColor: !logoUrl ? undefined : !useLogoColor ? 'none' : logoColor || undefined,
      logoColor2: logoUrl && useLogoColor && logoColor2 ? logoColor2 : undefined,
      logoZoom: logoUrl && logoFit === 'fill' && logoZoom > 1 ? logoZoom : undefined,
      logoFit: logoUrl ? logoFit : undefined,
      hostCategoryName: fields.has('hostCategory') ? hostCategoryName || undefined : undefined,
      categoryId: fields.has('hostCategory') ? hostCategoryId || undefined : undefined,
      categoryName: fields.has('hostCategory') ? hostCategoryName || undefined : undefined,
      hostCategoryImageUrl: fields.has('hostCategory') ? hostCategoryImageUrl || undefined : undefined,
      hostSubcategories: fields.has('hostCategory') && hostSubcategories.length ? hostSubcategories : undefined,
      productTitle: productTitle || undefined,
      salePriceLabel: listingLocked ? undefined : salePriceLabel || undefined,
      previousPriceLabel: listingLocked ? undefined : previousPriceLabel || undefined,
      discountLabel: listingLocked ? undefined : discountLabel || undefined,
    };

    if (destMode === 'external') {
      const url = externalUrl.trim();
      if (!url) throw new Error('External URL is required');
      if (!/^https?:\/\//i.test(url)) throw new Error('External URL must start with http:// or https://');
    }

    return {
      title,
      kind: destMode === 'external' ? 'external' : 'banner',
      formatId,
      placementId,
      pageKey: placementDef?.pageKey || pageKey,
      listingId: listingId || undefined,
      creative,
      cta: {
        label: ctaLabel || undefined,
        destinationType: destMode,
        url:
          destMode === 'external'
            ? externalUrl.trim()
            : internalEntityType === 'page'
              ? pagePath.trim() || undefined
              : internalEntityType === 'category' && (internalEntitySlug || internalEntityId)
                ? `/categories?category=${encodeURIComponent(internalEntitySlug || internalEntityId)}`
                : undefined,
        internalEntityType: destMode === 'internal' && internalEntityType !== 'page' ? internalEntityType : undefined,
        internalEntityId: destMode === 'internal' && internalEntityType !== 'page' ? internalEntityId || listingId || undefined : undefined,
      },
      externalUrl: destMode === 'external' ? externalUrl.trim() : undefined,
      startsAt: startsAt ? new Date(startsAt).toISOString() : undefined,
      endsAt: endsAt ? new Date(endsAt).toISOString() : undefined,
      asDraft: opts.asDraft,
      publishNow: opts.publishNow === true,
      metadata: {
        builder: 'ads-visual-builder',
        aspectRatio: placementDef?.aspectRatio,
      },
    };
  };

  useEffect(() => {
    let alive = true;
    if (!imageUrl) {
      setImageDims(null);
      return;
    }
    measureImage(imageUrl).then((d) => alive && setImageDims(d));
    return () => {
      alive = false;
    };
  }, [imageUrl]);

  const [askDuplicate, setAskDuplicate] = useState(false);
  /** Delete: confirmation dialog with a required reason (kept in the audit log). */
  const [askDelete, setAskDelete] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleting, setDeleting] = useState(false);
  /** Pause (off the storefront) / Resume (back on) straight from the builder — admins. */
  const [statusBusy, setStatusBusy] = useState(false);
  const [askPause, setAskPause] = useState(false);
  const [pauseReason, setPauseReason] = useState('');
  const changeStatus = async (to: 'pause' | 'resume') => {
    if (!existing) return;
    if (to === 'pause' && pauseReason.trim().length < 5) return;
    setStatusBusy(true);
    setError(null);
    try {
      const saved = to === 'pause' ? await adsApi.pauseAd(existing.id, pauseReason.trim()) : await adsApi.publishAd(existing.id);
      setAskPause(false);
      setExisting(saved);
      setMessage(to === 'pause' ? 'Paused — the ad is off the storefront until you resume it.' : 'Live again on the storefront.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change the status');
    } finally {
      setStatusBusy(false);
    }
  };
  const removeAd = async () => {
    if (!existing || deleteReason.trim().length < 5) return;
    setDeleting(true);
    try {
      await adsApi.deleteAd(existing.id, deleteReason.trim());
      navigate('/admin/ads-studio');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
      setAskDelete(false);
    } finally {
      setDeleting(false);
    }
  };
  const [askCancel, setAskCancel] = useState(false);
  const [payMethod, setPayMethod] = useState('bKash');
  const [payRef, setPayRef] = useState('');
  /** Admin: record payment / waive the charge of a seller or creator ad. */
  const billingAction = async (kind: 'paid' | 'waive') => {
    if (!id) return;
    let note = '';
    if (kind === 'waive') {
      note = window.prompt('Why is the charge waived? (shown in the history)') || '';
      if (note.trim().length < 3) return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const saved = kind === 'paid' ? await adsApi.markAdPaid(id, payMethod, payRef) : await adsApi.waiveAdCharge(id, note);
      setExisting(saved);
      setMessage(kind === 'paid' ? 'Payment recorded — the ad can now be approved / published.' : 'Charge waived — the ad can now be approved / published.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the payment');
    } finally {
      setSaving(false);
    }
  };
  /** Draft copy of this ad; opens it so the copy can be placed somewhere else, then published. */
  const duplicate = async () => {
    setAskDuplicate(false);
    if (!id) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const copy = await adsApi.duplicateAd(id);
      navigate(`/admin/ads-studio/${encodeURIComponent(copy.id)}/edit`);
      window.setTimeout(
        () => setMessage(`Copy created as a draft (${copy.advertisementReferenceId || copy.id}). Choose where it goes, then publish.`),
        600,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not duplicate the ad');
    } finally {
      setSaving(false);
    }
  };

  const save = async (mode: 'draft' | 'submit' | 'publish') => {
    if (formatId === 'popup' && !popupPages.length) {
      setMessage(null);
      setError('Choose at least one page for the pop-up (or tick All pages).');
      return;
    }
    if (mode !== 'draft' && formatDef?.imageLed && !imageUrl && !(formatId === 'hero_banner' && mediaType === 'video' && videoUrl)) {
      setMessage(null);
      setError('Upload an image first — this format shows your image, so it cannot go live without one. (Save Draft keeps it without an image.)');
      return;
    }
    if (fitError && mode !== 'draft') {
      setError(fitError);
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const asDraft = mode === 'draft';
      const publishNow = mode === 'publish';
      const payload = buildPayload({ asDraft, publishNow });

      let saved: AdsApiRecord;
      if (isEdit && id) {
        const { asDraft: _d, publishNow: _p, ...patch } = payload;
        void _d;
        void _p;
        saved = await adsApi.updateAd(id, patch);
        if (mode === 'submit' && saved.status === 'draft') {
          saved = await adsApi.submitForApproval(id);
        }
        // Saving alone never changes the status: Publish must also make a draft / paused ad live.
        if (mode === 'publish' && saved.status !== 'active') {
          saved = await adsApi.publishAd(id);
        }
      } else {
        if (mode === 'submit') {
          payload.asDraft = false;
          payload.publishNow = false;
        }
        saved = await adsApi.createBanner(payload);
      }

      setExisting(saved);
      setMessage(
        mode === 'draft'
          ? 'Draft saved'
          : mode === 'publish'
            ? 'Ad published'
            : 'Submitted for approval',
      );
      if (!isEdit) {
        navigate(`/admin/ads-studio/${encodeURIComponent(saved.id)}/edit`, { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const previewProps = {
    formatId,
    advertiserName: advertiserName || undefined,
    advertiserLogoUrl: logoUrl || undefined,
    headline: headline || undefined,
    subtext: subtext || undefined,
    ctaLabel: ctaLabel || undefined,
    imageUrl: imageUrl || undefined,
    videoUrl: formatId === 'hero_banner' && mediaType === 'video' ? videoUrl || undefined : undefined,
    posterUrl: formatId === 'hero_banner' && mediaType === 'video' ? posterUrl || imageUrl || undefined : undefined,
    mediaType: formatId === 'hero_banner' ? mediaType : undefined,
    productTitle: productTitle || headline || undefined,
    salePriceLabel: salePriceLabel || (listingLocked ? '—' : undefined),
    previousPriceLabel: previousPriceLabel || undefined,
    discountLabel: discountLabel || undefined,
    hostCategoryName: hostCategoryName || undefined,
    hostCategoryImageUrl: hostCategoryImageUrl || undefined,
    hostSubcategories: hostSubcategories.length ? hostSubcategories : undefined,
    showPromotedBadge: true,
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-[11px] font-mono uppercase tracking-[3px] text-[#EF3C23]">
        Loading Ads Visual Builder…
      </div>
    );
  }

  const pagesForFormat = [...new Set(allFormatPlacements.map((p) => p.pageKey))];

  // "Pay now" (ads list / cost box) opens the payment page for this ad.
  if (payMode && existing) {
    return (
      <AdPaymentPanel
        ad={existing}
        isAdmin={isAdmin}
        onUpdated={(next) => setExisting(next)}
        onBack={() => setSearchParams({}, { replace: true })}
      />
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-5 md:px-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            // Return to the canonical Ads & Deals Studio page (the one the seller
            // nav and "Create Ad" come from). The legacy /admin/ads-deals-studio
            // path has no React route and falls through to the cms-mirror
            // prototype, which has no real Ads/Deals tabs.
            onClick={() => navigate('/admin/ads-studio')}
            className="inline-flex items-center gap-1 rounded-lg border border-[#E8EDF2] bg-white px-3 py-2 text-[11px] font-bold text-[#374151]"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>
          <div>
            <div className="text-[15px] font-extrabold text-[#111827]">
              {isEdit ? 'Edit Banner / Direct Ad' : 'Create Ad Creative'}
            </div>
            <div className="text-[11px] text-[#6B7280] font-semibold">
              Banner / Direct Ads Visual Builder · storefront-parity preview
              {existing?.dealReferenceId || existing?.advertisementReferenceId ? (
                <span className="ml-2 font-mono font-extrabold text-[#111827]">
                  {existing.dealReferenceId || existing.advertisementReferenceId}
                </span>
              ) : null}
            </div>
          </div>
        </div>
        {existing ? (
          <div className="flex items-center gap-2">
            {existing.kind === 'banner' || existing.kind === 'external' ? (
              <button
                type="button"
                disabled={saving}
                onClick={() => setAskDuplicate(true)}
                className="rounded-lg border border-[#E8EDF2] bg-white px-3 py-1.5 text-[11px] font-extrabold text-[#374151] hover:bg-[#F9FAFB]"
                data-testid="ad-duplicate"
                title="Make a draft copy to place on another page or section"
              >
                Duplicate
              </button>
            ) : null}
            <span className="rounded-full bg-[#F3F4F6] px-3 py-1 text-[10px] font-extrabold uppercase tracking-wide text-[#374151]">
              {existing.status}
            </span>
          </div>
        ) : null}
      </div>

      {askCancel && existing ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" data-testid="ad-cancel-confirm">
          <div className="w-full max-w-[420px] rounded-xl bg-white p-5 shadow-xl">
            <div className="text-[15px] font-extrabold text-[#111827]">Cancel your changes?</div>
            <p className="mt-1.5 text-[12.5px] text-[#4B5563]">
              Everything you changed since the last save is undone, and the ad goes back to how it was last saved. The live ad is not affected.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setAskCancel(false)} className="rounded-lg border border-[#E8EDF2] px-3.5 py-2 text-[12px] font-extrabold text-[#374151]">
                Keep editing
              </button>
              <button
                type="button"
                onClick={() => {
                  hydrateFromRecord(existing);
                  setAskCancel(false);
                  setError(null);
                  setMessage('Changes cancelled — back to the last saved version.');
                }}
                className="rounded-lg bg-[#EF3C23] px-3.5 py-2 text-[12px] font-extrabold text-white"
                data-testid="ad-cancel-ok"
              >
                Cancel changes
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {askPause && existing ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" data-testid="ad-pause-confirm">
          <div className="w-full max-w-[460px] rounded-xl bg-white p-5 shadow-xl">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-50 text-[16px] font-extrabold text-amber-600">!</span>
              <div className="min-w-0 flex-1 space-y-1 text-[12.5px] text-[#4B5563]">
                <div className="text-[15px] font-extrabold text-[#111827]">Pause {existing.advertisementReferenceId || 'this ad'}?</div>
                <p className="font-semibold text-[#92400E]">It is live now and comes off the storefront at once — shoppers stop seeing it until someone resumes it.</p>
                <p>Nothing is deleted: the design, settings, booking and reports stay, and you can resume it any time.</p>
                <label className="mt-2 block text-[11.5px] font-bold text-[#111827]">
                  Reason for pausing <span className="text-red-600">*</span>
                  <textarea
                    value={pauseReason}
                    onChange={(e) => setPauseReason(e.target.value)}
                    rows={3}
                    maxLength={500}
                    placeholder="e.g. Advertiser asked to stop for a week / payment pending / design needs fixing"
                    className="mt-1 w-full rounded-lg border border-[#E8EDF2] px-3 py-2 text-[12px] font-normal"
                    data-testid="ad-pause-reason"
                  />
                  <span className="text-[10.5px] font-normal text-[#6B7280]">Shown on the ad and saved in the activity log with your name.</span>
                </label>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setAskPause(false)} className="rounded-lg border border-[#E8EDF2] px-3.5 py-2 text-[12px] font-extrabold text-[#374151]">
                Keep it live
              </button>
              <button
                type="button"
                disabled={statusBusy || pauseReason.trim().length < 5}
                onClick={() => void changeStatus('pause')}
                className="rounded-lg bg-amber-600 px-3.5 py-2 text-[12px] font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-40"
                data-testid="ad-pause-ok"
              >
                {statusBusy ? 'Pausing…' : 'Pause the ad'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {askDelete && existing ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" data-testid="ad-delete-confirm">
          <div className="w-full max-w-[460px] rounded-xl bg-white p-5 shadow-xl">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-50 text-[16px] font-extrabold text-red-600">!</span>
              <div className="min-w-0 flex-1 space-y-1 text-[12.5px] text-[#4B5563]">
                <div className="text-[15px] font-extrabold text-[#111827]">Delete {existing.advertisementReferenceId || 'this ad'}?</div>
                <p>
                  {existing.status === 'active' ? <b className="text-red-700">It is live now and disappears from the storefront at once. </b> : null}
                  The ad, its design and its settings are removed for good — this cannot be undone. Its past views and clicks stay in the reports.
                </p>
                <p className="text-[11.5px]">Only want it off the storefront for a while? Use <b>Pause</b> in the ads list instead.</p>
                <label className="mt-2 block text-[11.5px] font-bold text-[#111827]">
                  Reason for deleting <span className="text-red-600">*</span>
                  <textarea
                    value={deleteReason}
                    onChange={(e) => setDeleteReason(e.target.value)}
                    rows={3}
                    maxLength={500}
                    placeholder="e.g. Advertiser cancelled the campaign / wrong design uploaded / duplicate ad"
                    className="mt-1 w-full rounded-lg border border-[#E8EDF2] px-3 py-2 text-[12px] font-normal"
                    data-testid="ad-delete-reason"
                  />
                  <span className="text-[10.5px] font-normal text-[#6B7280]">Saved in the activity log with your name.</span>
                </label>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => { setAskDelete(false); setDeleteReason(''); }} className="rounded-lg border border-[#E8EDF2] px-3.5 py-2 text-[12px] font-extrabold text-[#374151]">
                Keep the ad
              </button>
              <button
                type="button"
                disabled={deleting || deleteReason.trim().length < 5}
                onClick={() => void removeAd()}
                className="rounded-lg bg-red-600 px-3.5 py-2 text-[12px] font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-40"
                data-testid="ad-delete-ok"
              >
                {deleting ? 'Deleting…' : 'Delete for good'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {askDuplicate ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" data-testid="ad-duplicate-confirm">
          <div className="w-full max-w-[440px] rounded-xl bg-white p-5 shadow-xl">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-50 text-[16px] font-extrabold text-amber-600">!</span>
              <div className="space-y-1 text-[12.5px] text-[#4B5563]">
                <div className="text-[15px] font-extrabold text-[#111827]">Duplicate {existing?.advertisementReferenceId || 'this ad'}?</div>
                <p>A copy is made with the same design, text, link and place, and its own AD number.</p>
                <p className="font-semibold text-[#92400E]">The copy is saved as a draft and is NOT on the storefront. It opens next: choose the page and place it should go, then publish it.</p>
                <p>Unsaved changes on this page are not copied — save first if you want them in the copy.</p>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setAskDuplicate(false)} className="rounded-lg border border-[#E8EDF2] px-3.5 py-2 text-[12px] font-extrabold text-[#374151]">
                Cancel
              </button>
              <button type="button" onClick={() => void duplicate()} className="rounded-lg bg-[#EF3C23] px-3.5 py-2 text-[12px] font-extrabold text-white" data-testid="ad-duplicate-ok">
                Duplicate
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-700">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] font-semibold text-emerald-700">
          {message}
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1fr_420px]">
        <div className="space-y-4">
          {/* 1. FORMAT & PLACEMENT — side by side: a format greys out places that do not take it; a page greys out formats it has no place for */}
          <section className="rounded-xl border border-[#E8EDF2] bg-white p-4">
            <div className="mb-3 text-[10px] font-extrabold tracking-[0.08em] text-[#9CA3AF]">1 · PAGE, FORMAT &amp; PLACEMENT</div>
            <label className="block text-[11px] font-bold text-[#374151]">
              Page
              <select
                value={pageKey}
                onChange={(e) => choosePage(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E8EDF2] px-3 py-2 text-[12px]"
                data-testid="ad-page-select"
              >
                {pages.map((p) => (
                  <option key={p.pageKey} value={p.pageKey}>
                    {p.pageLabel}
                  </option>
                ))}
              </select>
            </label>
            <div className="mt-3 grid gap-4 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
            <div data-testid="ad-format-list">
              <div className="text-[11px] font-bold text-[#374151]">Format</div>
              <div className="mt-0.5 text-[10.5px] text-[#6B7280]">Greyed out = this page has no place for it.</div>
              <div className="mt-2 grid gap-1.5">
                {AD_FORMATS.map((f) => {
                  const anywhere = placementsForFormat(f.formatId, role).length > 0;
                  const pageRow = pageRows.find((r) => r.placement.allowedFormats.includes(f.formatId));
                  const allowed = anywhere && Boolean(pageRow);
                  const active = formatId === f.formatId;
                  const inChosen = Boolean(placementDef?.allowedFormats.includes(f.formatId));
                  return (
                    <button
                      key={f.formatId}
                      type="button"
                      disabled={!allowed}
                      onClick={() => setFormatId(f.formatId)}
                      data-testid={`ad-format-${f.formatId}`}
                      aria-pressed={active}
                      title={!anywhere ? 'Not available for your account' : !pageRow ? `No place for ${f.label} on this page — choose another page` : f.description}
                      className={`rounded-lg border px-3 py-2 text-left transition ${
                        active ? 'border-[#EF3C23] bg-[#FFF5F3] ring-1 ring-[#EF3C23]/30' : 'border-[#E8EDF2] bg-white hover:border-[#FDBA74]'
                      } ${!allowed ? 'cursor-not-allowed bg-[#F9FAFB] opacity-45 hover:border-[#E8EDF2]' : ''}`}
                    >
                      <div className="text-[12px] font-extrabold text-[#111827]">{f.label}</div>
                      <div className="mt-0.5 text-[10px] leading-snug text-[#6B7280]">{f.description}</div>
                      {!allowed ? (
                        <div className="mt-0.5 text-[10px] font-bold text-[#9CA3AF]">{anywhere ? 'Not on this page' : 'Not available'}</div>
                      ) : !active && !inChosen && pageRow ? (
                        <div className="mt-0.5 text-[10px] font-bold text-[#7C3AED]">Moves the place to: {pageRow.label}</div>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
            <div data-testid="ad-page-map">
              <div className="text-[11px] font-bold text-[#374151]">Where on this page</div>
              <div className="mt-0.5 text-[10.5px] text-[#6B7280]">
                Every place on the page, top to bottom. Different places show separately; ads in the same place are stacked and slide (round switch icons).
              </div>
              <div className="mt-2 overflow-hidden rounded-lg border border-[#E8EDF2]">
                {pageRows.map((row, idx) => {
                  const chosen = isRowChosen(row);
                  const taken = placeOccupancy[row.key] || [];
                  const fits = row.placement.allowedFormats.includes(formatId);
                  const takes = fits ? null : row.placement.allowedFormats.map((f) => getFormatDef(f as AdFormatId)?.label || f).join(' / ');
                  return (
                    <button
                      key={row.key}
                      type="button"
                      disabled={!fits}
                      title={fits ? undefined : `Not for ${formatDef?.label || 'this format'} — this place takes: ${takes}`}
                      onClick={() => chooseRow(row)}
                      data-testid={`ad-place-${row.key.replace(':', '--')}`}
                      aria-pressed={chosen}
                      className={`flex w-full items-center gap-3 px-3 py-2 text-left text-[11.5px] ${idx ? 'border-t border-[#E8EDF2]' : ''} ${
                        chosen ? 'bg-[#FFF4EE]' : fits ? 'bg-white hover:bg-[#F9FAFB]' : 'cursor-not-allowed bg-[#F9FAFB] opacity-45'
                      }`}
                    >
                      <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${chosen ? 'border-[#EF3C23] bg-[#EF3C23]' : 'border-[#CBD5E1]'}`}>
                        {chosen ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : null}
                      </span>
                      <span className="w-[92px] shrink-0 rounded bg-[#EEF2FF] px-1.5 py-0.5 text-center text-[9.5px] font-extrabold uppercase tracking-wide text-[#3730A3]">
                        {shapeOf(row.placement)}
                      </span>
                      <span className={`min-w-0 flex-1 ${chosen ? 'font-extrabold text-[#111827]' : 'font-semibold text-[#374151]'}`}>
                        {row.label}
                        {takes ? <span className="block text-[10px] font-semibold text-[#9CA3AF]">Takes: {takes}</span> : null}
                        {!row.placement.mobileSupport ? <span className="block text-[10px] font-semibold text-[#9CA3AF]">Desktop only</span> : null}
                      </span>
                      {taken.length ? (
                        <span className="shrink-0 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-800" title={taken.map((a) => a.advertisementReferenceId || a.title).join(', ')}>
                          {taken.length} live ad{taken.length > 1 ? 's' : ''}{chosen ? ' — will be stacked' : ''}
                        </span>
                      ) : (
                        <span className="shrink-0 text-[10px] font-semibold text-[#9CA3AF]">free</span>
                      )}
                    </button>
                  );
                })}
              </div>
              </div>
            </div>
            <div>
              <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-bold text-[#6B7280]">
                <span className="rounded bg-[#F3F4F6] px-2 py-1 font-mono">{placementId}{pagePosition ? ` · ${pagePosition}` : ''}</span>
              </div>
            </div>
            {placementDef?.slotKey === 'grid_card' ? (
              <div className="mt-3 rounded-lg border-2 border-[#C4B5FD] bg-[#F5F3FF] px-3 py-2.5" data-testid="grid-rules">
                <label className="block text-[11.5px] font-extrabold text-[#111827]">
                  Where in the grid
                  <select value={gridEvery} onChange={(e) => setGridEvery(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-[#E8EDF2] bg-white px-3 py-2 text-[12px] font-semibold" data-testid="grid-every">
                    {GRID_EVERY_CHOICES.map((n) => (
                      <option key={n} value={n}>
                        {n === 0 ? 'Once, after the last card' : gridOnce ? `After card ${n}` : `After every ${n} cards`}
                      </option>
                    ))}
                  </select>
                </label>
                {gridEvery > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Repeat" data-testid="grid-once">
                    {[
                      { v: false, label: 'Repeat through the list' },
                      { v: true, label: `Only once (after card ${gridEvery})` },
                    ].map((o) => (
                      <button
                        key={String(o.v)}
                        type="button"
                        role="radio"
                        aria-checked={gridOnce === o.v}
                        onClick={() => setGridOnce(o.v)}
                        className={`rounded-lg border px-3 py-1.5 text-[11.5px] font-bold ${gridOnce === o.v ? 'border-[#7C3AED] bg-white text-[#5B21B6] shadow-sm' : 'border-[#E8EDF2] bg-white/60 text-[#6B7280]'}`}
                        data-testid={o.v ? 'grid-once-yes' : 'grid-once-no'}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                ) : null}
                <div className="mt-1.5 text-[10.5px] text-[#6B7280]">
                  {gridEvery > 0 && gridOnce
                    ? `Shows one time only, right after card ${gridEvery}, and not again further down.`
                    : 'Repeats through the list (e.g. every 8 cards = about every 2 rows on desktop).'}{' '}
                  Several ads in the same spot are stacked into one card that slides between them (small round switches). With fewer cards than that, it shows after the last card.
                </div>
              </div>
            ) : null}
            {isListing ? (
              <div className="mt-3 rounded-lg border-2 border-[#C4B5FD] bg-[#F5F3FF] px-3 py-2.5" data-testid="list-row-rules">
                <label className="block text-[11.5px] font-extrabold text-[#111827]">
                  Which row
                  <select value={listRow} onChange={(e) => setListRow(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-[#E8EDF2] bg-white px-3 py-2 text-[12px] font-semibold" data-testid="list-row">
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <option key={n} value={n}>
                        {n === 1 ? 'Row 1 — the very first card of the list' : `Row ${n} — first card of row ${n}`}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="mt-1 text-[10.5px] text-[#6B7280]">
                  The sponsored card always starts the row you pick — whether the screen shows 4, 6 or 8 cards per row. If the list is shorter, it shows as the first card of the last row.
                </div>
              </div>
            ) : null}
            {isInGrid ? (
              <div className="mt-3 rounded-lg border-2 border-[#C4B5FD] bg-[#F5F3FF] px-3 py-2.5" data-testid="grid-row-rules">
                <label className="block text-[11.5px] font-extrabold text-[#111827]">
                  After which row of cards
                  <select value={listRow} onChange={(e) => setListRow(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-[#E8EDF2] bg-white px-3 py-2 text-[12px] font-semibold" data-testid="grid-row">
                    {GRID_ROW_CHOICES.map((n) => (
                      <option key={n} value={n}>
                        {n === 1 ? 'After row 1 — between the first and second row' : `After row ${n}`}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="mt-1 text-[10.5px] text-[#6B7280]">
                  The banner takes a full row inside the grid: cards above it, cards below it. It is as wide as the grid only, so the side menu stays where it is. A row is however many cards fit across the screen (fewer on phones). If the list has fewer rows, it shows after the last card.
                </div>
              </div>
            ) : null}
            {formatId === 'popup' ? (
              <div className="mt-3 rounded-lg border-2 border-[#C4B5FD] bg-[#F5F3FF] px-3 py-2.5" data-testid="popup-rules">
                <div className="text-[11.5px] font-extrabold text-[#111827]">Pop-up rules</div>
                <div className="mt-0.5 text-[10.5px] text-[#6B7280]">
                  Once a shopper closes it, it does not come back in that browser tab — closing and reopening the tab starts fresh.
                </div>
                <div className="mt-2 text-[11px] font-bold text-[#374151]">Show on</div>
                <label className="mt-1 flex items-center gap-2 text-[11.5px] font-semibold">
                  <input
                    type="checkbox"
                    checked={popupPages.includes('all')}
                    onChange={(e) => setPopupPages(e.target.checked ? ['all'] : [])}
                    data-testid="popup-all"
                  />
                  All pages
                </label>
                {!popupPages.includes('all') ? (
                  <div className="mt-1 grid gap-1 sm:grid-cols-2" data-testid="popup-pages">
                    {POPUP_PAGES.map((pg) => (
                      <label key={pg.key} className="flex items-center gap-2 text-[11.5px]">
                        <input
                          type="checkbox"
                          checked={popupPages.includes(pg.key)}
                          onChange={(e) =>
                            setPopupPages((prev) => (e.target.checked ? [...prev.filter((k) => k !== 'all'), pg.key] : prev.filter((k) => k !== pg.key)))
                          }
                          data-testid={`popup-page-${pg.key}`}
                        />
                        {pg.label}
                      </label>
                    ))}
                    {!popupPages.length ? <div className="text-[10.5px] font-semibold text-amber-800 sm:col-span-2">Pick at least one page (or tick All pages).</div> : null}
                  </div>
                ) : null}
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  <label className="block text-[11px] font-bold text-[#374151]">
                    Times per visit (browser tab)
                    <select value={popupMax} onChange={(e) => setPopupMax(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-[#E8EDF2] bg-white px-3 py-2 text-[12px]" data-testid="popup-max">
                      {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
                        <option key={n} value={n}>
                          {n === 1 ? 'Once' : `Up to ${n} times`}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-[11px] font-bold text-[#374151]">
                    Wait before showing
                    <select value={popupDelay} onChange={(e) => setPopupDelay(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-[#E8EDF2] bg-white px-3 py-2 text-[12px]" data-testid="popup-delay">
                      {[0, 1, 2, 3, 5, 8, 10, 15, 20, 30, 45, 60].map((n) => (
                        <option key={n} value={n}>
                          {n === 0 ? 'Show straight away' : `${n} second${n === 1 ? '' : 's'}`}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="mt-1.5 text-[10.5px] text-[#6B7280]">
                  “Times per visit” counts page opens: with “Up to 3 times” it shows on up to 3 page views in the same tab, unless the shopper closes it.
                </div>
              </div>
            ) : null}
          </section>

          {/* 2. CONTENT */}
          <section className="rounded-xl border border-[#E8EDF2] bg-white p-4">
            <div className="mb-3 text-[10px] font-extrabold tracking-[0.08em] text-[#9CA3AF]">2 · CONTENT</div>
            {isListing ? (
              <div className="rounded-lg bg-[#F9FAFB] px-3 py-2 text-[11.5px] text-[#6B7280]" data-testid="listing-no-content">
                Nothing to write here — a Sponsored Listing shows the item’s own photo, name and price with a “Sponsored” label. Choose the item below.
              </div>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              {fields.has('advertiser') ? (
                <FieldBox tone="advertiser" label="Advertiser / Brand" where="Who the ad is for">
                  <input
                    value={advertiserName}
                    onChange={(e) => setAdvertiserName(e.target.value)}
                    className={fieldInput('advertiser')}
                    placeholder="e.g. Samsung"
                  />
                </FieldBox>
              ) : null}
              {fields.has('headline') ? (
                <FieldBox
                  tone="headline"
                  label="Headline"
                  where={formatDef?.imageLed && !showText ? 'Image description (not shown)' : 'Big text on the ad'}
                >
                  <input
                    value={headline}
                    onChange={(e) => setHeadline(e.target.value)}
                    className={fieldInput('headline')}
                    placeholder="e.g. Membership is open"
                    data-testid="input-headline"
                  />
                </FieldBox>
              ) : null}
              {fields.has('subtext') ? (
                <FieldBox
                  tone="subtext"
                  label="Subtext"
                  where={formatDef?.imageLed && !showText ? 'Not shown on image banners unless ticked below' : 'Small line under the headline'}
                  className="sm:col-span-2"
                >
                  <textarea
                    value={subtext}
                    onChange={(e) => setSubtext(e.target.value)}
                    rows={2}
                    className={fieldInput('subtext')}
                    placeholder="e.g. Special discount for Choosify customers"
                    data-testid="input-subtext"
                  />
                </FieldBox>
              ) : null}
              {formatDef?.imageLed && fields.has('headline') && formatId !== 'hero_banner' ? (
                <label className="flex items-start gap-2 sm:col-span-2 rounded-lg border border-[#E8EDF2] bg-[#F9FAFB] px-3 py-2 text-[11.5px] font-semibold text-[#374151]">
                  <input type="checkbox" className="mt-0.5" checked={showText} onChange={(e) => setShowText(e.target.checked)} data-testid="ad-show-text" />
                  <span>
                    Show the headline and subtext on the banner
                    <span className="block text-[10.5px] font-normal text-[#6B7280]">
                      Off: your design is shown as it is and the headline is only its description for screen readers — use this when the artwork already contains its text.
                    </span>
                  </span>
                </label>
              ) : null}
              {fields.has('ctaLabel') ? (
                <FieldBox tone="cta" label="CTA button text" where="The orange button">
                  <div className="flex items-center gap-2">
                    <input
                      value={ctaLabel}
                      onChange={(e) => setCtaLabel(e.target.value)}
                      className={fieldInput('cta')}
                      placeholder="e.g. Apply now, Shop now, Visit"
                      maxLength={30}
                      data-testid="input-cta"
                    />
                    {ctaLabel ? (
                      <span className="shrink-0 rounded-lg bg-[#FF5B00] px-3 py-1.5 text-[10.5px] font-extrabold uppercase tracking-wide text-white shadow" data-testid="cta-chip">
                        {ctaLabel} →
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {['Shop now', 'Apply now', 'Buy now', 'Visit', 'Learn more', 'Book now'].map((s) => (
                      <button key={s} type="button" onClick={() => setCtaLabel(s)} className="rounded-full border border-[#FDBA74] bg-white px-2 py-0.5 text-[10px] font-bold text-[#9A3412] hover:bg-[#FFEDD5]">
                        {s}
                      </button>
                    ))}
                  </div>
                </FieldBox>
              ) : null}
              {fields.has('listing') ? (
                <label className="block text-[11px] font-bold text-[#374151]">
                  Linked Product / Listing
                  <select
                    value={listingId}
                    onChange={(e) => onSelectListing(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[#E8EDF2] px-3 py-2 text-[12px]"
                  >
                    <option value="">None</option>
                    {listings.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.title}
                      </option>
                    ))}
                  </select>
                  {listingLocked ? (
                    <div className="mt-1 text-[10px] font-semibold text-amber-700">
                      Prices hydrate from the linked product and cannot be faked.
                    </div>
                  ) : null}
                </label>
              ) : null}
              {fields.has('hostCategory') ? (
                <>
                  <div className="sm:col-span-2">
                    <CategorySearchSelect
                      label="Category"
                      value={
                        hostCategoryId
                          ? { categoryId: hostCategoryId, categoryName: hostCategoryName || hostCategoryId }
                          : null
                      }
                      onChange={(next) => {
                        setHostCategoryId(next?.categoryId || '');
                        setHostCategoryName(next?.categoryName || '');
                      }}
                    />
                  </div>
                  <label className="block text-[11px] font-bold text-[#374151]">
                    Host Category Image URL (optional preview)
                    <input
                      value={hostCategoryImageUrl}
                      onChange={(e) => setHostCategoryImageUrl(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-[#E8EDF2] px-3 py-2 text-[12px]"
                      placeholder="Optional organic-card image for preview"
                    />
                  </label>
                </>
              ) : null}
            </div>

          </section>

          {/* 3. DESTINATION */}
          <section className="rounded-xl border border-[#E8EDF2] bg-white p-4">
            <div className="mb-3 text-[10px] font-extrabold tracking-[0.08em] text-[#9CA3AF]">{isListing ? '3 · WHAT YOU ARE PROMOTING' : '3 · DESTINATION'}</div>
            {isListing ? (
              <div className="mb-3 rounded-lg bg-[#F5F3FF] px-3 py-2 text-[11px] font-semibold text-[#5B21B6]" data-testid="listing-explainer">
                Shown as the item's normal card with a “Sponsored” label, inside the {placementDef?.pageLabel ?? ''} list
                {placementDef?.entityTypes?.length ? ` (${placementDef.entityTypes.join(' / ')})` : ''}. Only shown while it is live on Choosify.
              </div>
            ) : null}
            <div className={`flex gap-2 mb-3 ${isListing ? 'hidden' : ''}`}>
              <button
                type="button"
                onClick={() => setDestMode('internal')}
                className={`rounded-lg px-3 py-1.5 text-[11px] font-extrabold ${
                  destMode === 'internal' ? 'bg-[#111827] text-white' : 'bg-[#F3F4F6] text-[#374151]'
                }`}
              >
                Internal Choosify
              </button>
              <button
                type="button"
                onClick={() => setDestMode('external')}
                className={`rounded-lg px-3 py-1.5 text-[11px] font-extrabold ${
                  destMode === 'external' ? 'bg-[#111827] text-white' : 'bg-[#F3F4F6] text-[#374151]'
                }`}
              >
                External URL
              </button>
            </div>
            {destMode === 'internal' ? (
              <FieldBox tone="link" label={isListing ? 'Item to promote' : 'Where the button goes'} where={isListing ? 'Your product or brand' : 'A page on Choosify'}>
              <div className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
                <label className="block text-[11px] font-bold text-[#374151]">
                  Link to a
                  <select
                    value={internalEntityType}
                    onChange={(e) => {
                      setInternalEntityType(e.target.value);
                      setInternalEntityId('');
                      setInternalEntitySlug('');
                    }}
                    className={`mt-1 ${fieldInput('link')}`}
                    data-testid="entity-type"
                  >
                    {(isListing
                      ? (placementDef?.entityTypes ?? ['product', 'brand']).filter((t) => t === 'product' || t === 'brand')
                      : ['page', 'product', 'brand', 'deal', 'category', 'guide', 'creator']
                    ).map((t) => (
                      <option key={t} value={t}>
                        {t === 'page' ? 'Choosify page (About, Terms…)' : t.charAt(0).toUpperCase() + t.slice(1)}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="block text-[11px] font-bold text-[#374151]">
                  Choose it
                  {internalEntityType === 'page' ? (
                    <div className="mt-1" data-testid="ad-dest-page">
                      <LinkInput value={pagePath} onChange={setPagePath} disabled={false} testId="ad-dest-page-input" placeholder="Start typing: /about, /terms, /privacy, /pages/…" />
                      <div className="mt-1 text-[10.5px] text-[#6B7280]">Pick from the list or type any Choosify address starting with /.</div>
                    </div>
                  ) : (
                  <EntityPicker
                    type={internalEntityType as PickableType}
                    value={internalEntityType === 'category' ? internalEntityId || internalEntitySlug : internalEntityId}
                    onPick={(e) => {
                      setInternalEntityId(e?.id || '');
                      setInternalEntitySlug(e?.slug || '');
                    }}
                  />
                  )}
                </div>
              </div>
              </FieldBox>
            ) : (
              <FieldBox tone="link" label="Where the button goes" where="Another website (opens in a new tab)">
                <input
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value)}
                  className={fieldInput('link')}
                  placeholder="https://example.com/offer"
                  data-testid="input-external-url"
                />
                {externalUrl.trim() && !/^https:\/\//i.test(externalUrl.trim()) ? (
                  <div className="mt-1 text-[10.5px] font-semibold text-amber-800" data-testid="external-url-warning">
                    Use a full secure address starting with https:// — other links are not shown on the storefront.
                  </div>
                ) : null}
              </FieldBox>
            )}
          </section>

          {/* 4. DATES & COST — last step, right above Save / Submit */}
          <section className="rounded-xl border border-[#E8EDF2] bg-white p-4" data-testid="ad-dates">
            <div className="mb-3 text-[10px] font-extrabold tracking-[0.08em] text-[#9CA3AF]">4 · DATES &amp; COST</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-[11px] font-bold text-[#374151]">
                {isAdmin ? 'Start (optional)' : 'Start date'}
                <input
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#E8EDF2] px-3 py-2 text-[12px]"
                />
              </label>
              <label className="block text-[11px] font-bold text-[#374151]">
                {isAdmin ? 'End (optional)' : 'End date'}
                <input
                  type="datetime-local"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#E8EDF2] px-3 py-2 text-[12px]"
                />
              </label>
            </div>
            {(() => {
              // Paid ads: sellers / creators pay per day; Super Admin / Admin ads are free.
              const ownerPays = !isAdmin || existing?.ownerRole === 'seller' || existing?.ownerRole === 'creator';
              if (!ownerPays || formatId === 'popup') return null;
              const billing = ((existing?.metadata || {}) as Record<string, unknown>).billing as
                | { status: string; amount: number; days: number; ratePerDay: number; tier: string; method?: string; reference?: string; note?: string }
                | undefined;
              const q = quoteAd(placementId, startsAt || undefined, endsAt || undefined);
              return (
                <div className="mt-3 rounded-lg border-2 border-[#FDBA74] bg-[#FFF7ED] px-3 py-2.5" data-testid="ad-cost">
                  <div className="text-[11.5px] font-extrabold text-[#111827]">Cost</div>
                  {'error' in q ? (
                    <div className="mt-0.5 text-[11.5px] font-semibold text-amber-800" data-testid="ad-cost-missing">{q.error}.</div>
                  ) : (
                    <div className="mt-0.5 text-[12.5px] text-[#374151]" data-testid="ad-cost-quote">
                      {RATE_TIER_LABEL[q.tier]}: {formatBdt(q.ratePerDay)} / day × {q.days} day{q.days === 1 ? '' : 's'} ={' '}
                      <span className="text-[14px] font-extrabold text-[#111827]">{formatBdt(q.amount)}</span>
                    </div>
                  )}
                  <div className="mt-0.5 text-[10.5px] text-[#6B7280]">
                    Prices: homepage hero ৳100 / day · other homepage places ৳50 / day · any other page ৳30 / day.
                  </div>
                  {billing ? (
                    <div className="mt-1.5 text-[11.5px] font-bold" data-testid="ad-billing-status">
                      {billing.status === 'paid' ? (
                        <span className="text-emerald-700">Paid {formatBdt(billing.amount)}{billing.method ? ` · ${billing.method}` : ''}{billing.reference ? ` · ref ${billing.reference}` : ''} — place and dates are locked.</span>
                      ) : billing.status === 'waived' ? (
                        <span className="text-emerald-700">Charge waived by Choosify{billing.note ? ` (${billing.note})` : ''}.</span>
                      ) : (billing as { submitted?: { method: string; reference: string } }).submitted ? (
                        <span className="text-blue-700" data-testid="ad-billing-sent">
                          Payment sent ({(billing as { submitted?: { method: string; reference: string } }).submitted!.method}, ref {(billing as { submitted?: { method: string; reference: string } }).submitted!.reference}) — {isAdmin ? 'check it on the payment page.' : 'Choosify is checking it.'}{' '}
                          {existing ? (
                            <button type="button" onClick={() => setSearchParams({ pay: '1' })} className="font-extrabold underline">
                              {isAdmin ? 'Check payment' : 'View payment'}
                            </button>
                          ) : null}
                        </span>
                      ) : existing && existing.status === 'approved' && !isAdmin ? (
                        <span className="flex flex-wrap items-center gap-2 text-amber-800">
                          Approved — pay {formatBdt(billing.amount)} to put the ad live.
                          <button type="button" onClick={() => setSearchParams({ pay: '1' })} className="rounded-lg bg-[#FF5B00] px-3 py-1.5 text-[11px] font-extrabold text-white" data-testid="ad-pay-now">
                            Pay now
                          </button>
                        </span>
                      ) : (
                        <span className="text-amber-800">
                          {formatBdt(billing.amount)} to pay. {existing?.status === 'approved' ? 'Approved — waiting for the advertiser to pay; it goes live when the payment is confirmed.' : 'You pay after Choosify approves the ad; it goes live as soon as the payment is confirmed.'}
                        </span>
                      )}
                    </div>
                  ) : (
                    !isAdmin && <div className="mt-1.5 text-[10.5px] text-[#6B7280]">Submit the ad for approval. Once Choosify approves it you pay, and it goes live as soon as the payment is confirmed.</div>
                  )}
                  {isAdmin && existing && billing?.status === 'unpaid' ? (
                    <div className="mt-2 flex flex-wrap items-end gap-2" data-testid="ad-billing-admin">
                      <label className="text-[10.5px] font-bold text-[#374151]">
                        Paid by
                        <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className="mt-0.5 block rounded border border-[#E8EDF2] bg-white px-2 py-1 text-[11.5px]" data-testid="ad-pay-method">
                          {['bKash', 'Nagad', 'Bank transfer', 'Cash', 'Other'].map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </label>
                      <label className="text-[10.5px] font-bold text-[#374151]">
                        Reference
                        <input value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="Transaction ID" className="mt-0.5 block rounded border border-[#E8EDF2] bg-white px-2 py-1 text-[11.5px]" data-testid="ad-pay-ref" />
                      </label>
                      <button type="button" disabled={saving} onClick={() => void billingAction('paid')} className="rounded-md bg-emerald-600 px-2.5 py-1.5 text-[11px] font-extrabold text-white" data-testid="ad-mark-paid">
                        Mark as paid
                      </button>
                      <button type="button" disabled={saving} onClick={() => void billingAction('waive')} className="rounded-md border border-[#E8EDF2] bg-white px-2.5 py-1.5 text-[11px] font-extrabold text-[#374151]" data-testid="ad-waive">
                        Waive
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })()}
          </section>

          {/* Ready check — every problem is shown and fixable HERE, next to the buttons (no scrolling up). */}
          {(() => {
            const needsImage = Boolean(formatDef?.imageLed) && !imageUrl && !(formatId === 'hero_banner' && mediaType === 'video' && videoUrl);
            const needsItem = isListing && !internalEntityId;
            const needsPages = formatId === 'popup' && !popupPages.length;
            if (!needsImage && !needsItem && !needsPages && !fitError) return null;
            return (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5" data-testid="ad-ready-check">
                <div className="mb-1.5 text-[11.5px] font-extrabold text-amber-900">Before it can go live</div>
                <div className="space-y-1.5">
                  {needsImage ? (
                    <div className="flex flex-wrap items-center gap-2 text-[11.5px] text-amber-900">
                      <span>• This format shows your image — none uploaded yet.</span>
                      <label className="inline-flex cursor-pointer items-center gap-1 rounded-md bg-[#EF3C23] px-2.5 py-1 text-[11px] font-extrabold text-white" data-testid="ad-ready-upload">
                        {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Upload image here
                        <input
                          type="file"
                          accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0] || null;
                            e.target.value = '';
                            void uploadCreative(f, 'image');
                          }}
                        />
                      </label>
                    </div>
                  ) : null}
                  {needsItem ? (
                    <div className="flex flex-wrap items-center gap-2 text-[11.5px] text-amber-900">
                      <span>• Choose the product or brand you are promoting.</span>
                      <button type="button" className="rounded-md border border-amber-300 bg-white px-2.5 py-1 text-[11px] font-extrabold" onClick={() => document.querySelector('[data-testid="entity-type"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>
                        Choose it
                      </button>
                    </div>
                  ) : null}
                  {needsPages ? <div className="text-[11.5px] text-amber-900">• Pick the pages the pop-up shows on (Pop-up rules above).</div> : null}
                  {fitError ? <div className="text-[11.5px] text-amber-900">• {fitError}</div> : null}
                </div>
                {uploadNote ? (
                  <div className={`mt-2 rounded-md px-2.5 py-1.5 text-[11px] font-semibold ${uploadNote.kind === 'error' ? 'bg-red-50 text-red-700' : uploadNote.kind === 'busy' ? 'bg-blue-50 text-blue-700' : 'bg-white text-[#374151]'}`}>
                    {uploadNote.text}
                  </div>
                ) : null}
              </div>
            );
          })()}

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            {isEdit && existing ? (
              <button
                type="button"
                disabled={saving}
                onClick={() => setAskCancel(true)}
                className="rounded-lg border border-[#E8EDF2] bg-white px-4 py-2.5 text-[11px] font-extrabold text-[#6B7280]"
                data-testid="ad-cancel-edits"
              >
                Cancel changes
              </button>
            ) : null}
            <button
              type="button"
              disabled={saving}
              onClick={() => void save('draft')}
              className="rounded-lg border border-[#E8EDF2] bg-white px-4 py-2.5 text-[11px] font-extrabold text-[#374151]"
            >
              Save Draft
            </button>
            {!isAdmin ? (
              <button
                type="button"
                disabled={saving}
                onClick={() => void save('submit')}
                className="rounded-lg bg-[#EF3C23] px-4 py-2.5 text-[11px] font-extrabold text-white"
              >
                {(() => {
                  const q = quoteAd(placementId, startsAt || undefined, endsAt || undefined);
                  return 'error' in q ? 'Submit for Approval' : `Submit for Approval · ${formatBdt(q.amount)}`;
                })()}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void save('submit')}
                  className="rounded-lg border border-[#E8EDF2] bg-white px-4 py-2.5 text-[11px] font-extrabold text-[#374151]"
                >
                  Save as Pending
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void save('publish')}
                  className="rounded-lg bg-[#EF3C23] px-4 py-2.5 text-[11px] font-extrabold text-white"
                >
                  Publish / Activate
                </button>
              </>
            )}
            {saving ? <Loader2 className="h-5 w-5 animate-spin text-[#EF3C23]" /> : null}
            {isEdit && existing ? (
              <div className="ml-auto flex flex-wrap gap-2" data-testid="ad-status-actions">
                {isAdmin && existing.status === 'active' ? (
                  <button
                    type="button"
                    disabled={saving || statusBusy}
                    onClick={() => {
                      setPauseReason('');
                      setAskPause(true);
                    }}
                    className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-[11px] font-extrabold text-amber-800"
                    title="Take it off the storefront for now (can be resumed)"
                    data-testid="ad-pause"
                  >
                    Pause
                  </button>
                ) : null}
                {isAdmin && (existing.status === 'paused' || existing.status === 'disabled') ? (
                  <button
                    type="button"
                    disabled={saving || statusBusy}
                    onClick={() => void changeStatus('resume')}
                    className="rounded-lg bg-emerald-600 px-4 py-2.5 text-[11px] font-extrabold text-white"
                    title="Put the last saved version back on the storefront (save first if you changed anything)"
                    data-testid="ad-resume"
                  >
                    Resume (activate)
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={saving || statusBusy}
                  onClick={() => {
                    setDeleteReason('');
                    setAskDelete(true);
                  }}
                  className="rounded-lg border border-red-200 bg-white px-4 py-2.5 text-[11px] font-extrabold text-red-600 hover:bg-red-50"
                  data-testid="ad-delete"
                >
                  Delete
                </button>
              </div>
            ) : null}
          </div>
          {!saving && (error || message) ? (
            <div
              role="status"
              aria-live="polite"
              data-testid="ad-action-result"
              className={`rounded-lg border px-3 py-2 text-[12px] font-semibold ${
                error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'
              }`}
            >
              {error ? `Not saved — ${error}` : `✓ ${message}`}
            </div>
          ) : null}
        </div>

        {/* LIVE PREVIEW */}
        <aside className="h-fit space-y-3 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:pr-1">
          <div className="rounded-xl border border-[#E8EDF2] bg-white p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="text-[10px] font-extrabold tracking-[0.08em] text-[#9CA3AF]">LIVE PREVIEW</div>
              <label className="flex items-center gap-1.5 text-[10px] font-bold text-[#6B7280]">
                <input
                  type="checkbox"
                  checked={previewInPlacement}
                  onChange={(e) => setPreviewInPlacement(e.target.checked)}
                />
                Preview in placement
              </label>
            </div>
            {fields.has('hostCategory') ? (
              <div className="mb-3 rounded-lg border border-[#E8EDF2] bg-[#F9FAFB] px-3 py-2.5">
                <div className="text-[9px] font-extrabold tracking-[0.08em] text-[#9CA3AF]">
                  PLACEMENT PREVIEW
                </div>
                <div className="mt-1.5 space-y-1 text-[11px] font-semibold text-[#374151]">
                  <div>
                    Category:{' '}
                    <span className="font-extrabold text-[#111827]">
                      {hostCategoryName || (hostCategoryId ? hostCategoryId : '— select a category')}
                    </span>
                  </div>
                  <div>
                    Placement:{' '}
                    <span className="font-extrabold text-[#111827]">Category Promoted Slot</span>
                  </div>
                </div>
              </div>
            ) : null}
            <div
              className={
                previewInPlacement
                  ? placementDef?.orientation === 'vertical'
                    ? 'rounded-lg bg-[#F3F4F6] p-4 flex justify-end'
                    : placementDef?.embeddedMode
                      ? 'rounded-lg bg-[#F9FAFB] p-4'
                      : 'rounded-lg bg-[#F3F4F6] p-3'
                  : ''
              }
            >
              {previewInPlacement && placementDef ? (
                <div className="rounded-lg border border-dashed border-[#D1D5DB] bg-white p-3" data-testid="ad-preview-in-slot">
                  <div className="mb-2 text-[9px] font-bold uppercase tracking-wide text-[#9CA3AF]">
                    {placementDef.pageLabel} · {placementDef.slotLabel}
                  </div>
                  {isListing ? (
                    <SponsoredListingPreview type={internalEntityType === 'product' ? 'product' : 'brand'} id={internalEntityId} />
                  ) : (
                  <AdSlotPreview
                    placement={placementDef}
                    ad={{
                      formatId,
                      imageUrl: imageUrl || undefined,
                      imageWidth: imageDims?.width,
                      imageHeight: imageDims?.height,
                      headline: headline || undefined,
                      subtext: subtext || undefined,
                      ctaLabel: ctaLabel || undefined,
                      advertiserName: advertiserName || undefined,
                      logoUrl: logoUrl || undefined,
                      brandColor: logoUrl && useLogoColor && logoColor ? logoColor : undefined,
                      brandColor2: logoUrl && useLogoColor && logoColor2 ? logoColor2 : undefined,
                      logoZoom: logoUrl && logoFit === 'fill' ? logoZoom : undefined,
                      logoFit: logoUrl ? logoFit : undefined,
                      hasDestination: destMode === 'external' ? Boolean(externalUrl.trim()) : internalEntityType === 'page' ? Boolean(pagePath.trim()) : Boolean(internalEntityId || listingId),
                      showText: formatDef?.imageLed ? showText : false,
                      fit,
                      focusY,
                    }}
                  />
                  )}
                  <AdFitStatus placement={placementDef} width={imageDims?.width} height={imageDims?.height} />
                </div>
              ) : previewInPlacement && placementDef?.orientation === 'vertical' ? (
                <div className="w-[280px] rounded-lg border border-dashed border-[#D1D5DB] bg-white p-3">
                  <div className="mb-2 text-[9px] font-bold uppercase tracking-wide text-[#9CA3AF]">
                    {placementDef.pageLabel} · {placementDef.slotLabel}
                  </div>
                  <StorefrontAdPresentation {...previewProps} />
                </div>
              ) : (
                <>
                  {previewInPlacement ? (
                    <div className="mb-2 text-[9px] font-bold uppercase tracking-wide text-[#9CA3AF]">
                      {placementDef?.pageLabel} · {placementDef?.slotLabel}
                    </div>
                  ) : null}
                  <StorefrontAdPresentation {...previewProps} />
                </>
              )}
            </div>
            <div className="mt-3 text-[10px] text-[#9CA3AF] leading-snug">
              “Preview in placement” draws the ad exactly as the storefront slot does (same sizing and
              cropping). Untick it to see the format on its own.
            </div>
          </div>
          {/* Image + logo uploads sit with the preview, so you see the result as you upload. */}
          {fields.has('image') || fields.has('logo') ? (
            <section className="rounded-xl border border-[#E8EDF2] bg-white p-4" data-testid="ad-uploads">
              <div className="mb-3 text-[10px] font-extrabold tracking-[0.08em] text-[#9CA3AF]">IMAGE &amp; LOGO</div>
              <div className="grid gap-3">
                {fields.has('image') ? (
                  <div className="sm:col-span-2">
                    {formatId === 'hero_banner' ? (
                      <div className="mb-3">
                        <div className="text-[11px] font-bold text-[#374151] mb-1.5">Creative Type</div>
                        <div className="flex flex-wrap gap-2">
                          {(['image', 'gif', 'video'] as HeroMediaType[]).map((t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => setMediaType(t)}
                              className={`rounded-lg px-3 py-1.5 text-[11px] font-extrabold capitalize ${
                                mediaType === t ? 'bg-[#111827] text-white' : 'bg-[#F3F4F6] text-[#374151]'
                              }`}
                            >
                              {t === 'gif' ? 'GIF' : t === 'video' ? 'Video' : 'Image'}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {placementDef?.creative?.display === 'natural' && placementDef.slotKey !== 'popup' && imageDims ? (
                      <div className="mb-2 rounded-lg border border-[#E8EDF2] bg-[#F9FAFB] px-3 py-2 text-[11.5px] text-[#374151]" data-testid="ad-fit-choice">
                        <div className="font-bold">How it fills the banner on desktop</div>
                        {Math.abs(imageDims.width / imageDims.height - 4) < 0.15 ? (
                          <div className="mt-0.5 text-[10.5px] text-emerald-700 font-semibold">Your design is 4:1 — it fills the frame edge to edge on every screen.</div>
                        ) : (
                          <>
                            <div className="mt-0.5 text-[10.5px] text-[#6B7280]">
                              Your design is {(imageDims.width / imageDims.height).toFixed(2)}:1 and the desktop frame is 4:1. Phones always show it whole, edge to edge.
                            </div>
                            <label className="mt-1.5 flex items-start gap-2">
                              <input type="radio" name="ad-fit" checked={fit === 'whole'} onChange={() => setFit('whole')} data-testid="ad-fit-whole" />
                              <span>Show the whole design <span className="text-[#6B7280]">— nothing cut off; a soft blurred fill covers the {imageDims.width / imageDims.height < 4 ? 'sides' : 'top and bottom'}</span></span>
                            </label>
                            <label className="mt-1 flex items-start gap-2">
                              <input type="radio" name="ad-fit" checked={fit === 'fill'} onChange={() => setFit('fill')} data-testid="ad-fit-fill" />
                              <span>
                                Fill edge to edge <span className="text-[#6B7280]">— no gaps; about {Math.round(Math.abs(1 - Math.min(imageDims.width / imageDims.height, 4) / Math.max(imageDims.width / imageDims.height, 4)) * 100)}% of the design is cut off ({imageDims.width / imageDims.height < 4 ? 'top and bottom' : 'sides'}). Check the preview so no text is lost.</span>
                              </span>
                            </label>
                            {fit === 'fill' && imageDims.width / imageDims.height < 4 ? (
                              <label className="mt-1.5 ml-6 flex items-center gap-2 text-[11px]">
                                Keep
                                <select value={focusY} onChange={(e) => setFocusY(e.target.value as 'top' | 'center' | 'bottom')} className="rounded border border-[#E8EDF2] px-1.5 py-0.5 text-[11px]" data-testid="ad-fit-focus">
                                  <option value="top">the top</option>
                                  <option value="center">the middle</option>
                                  <option value="bottom">the bottom</option>
                                </select>
                                of the design
                              </label>
                            ) : null}
                          </>
                        )}
                      </div>
                    ) : null}
                    {fitError && imageDims && placementDef?.creative ? (
                      <div className="mb-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[11.5px] font-semibold leading-snug text-amber-900" data-testid="ad-artwork-needed">
                        New artwork needed for this shape. The current design is {imageDims.width}×{imageDims.height}px
                        ({(imageDims.width / imageDims.height).toFixed(2)}:1) and cannot be shown in “{placementDef.slotLabel}”. Upload a{' '}
                        {placementDef.creative.recommended.width}×{placementDef.creative.recommended.height}px version below, or switch back to a
                        wide format. {isEdit ? 'The live ad keeps running unchanged until this is saved.' : ''}
                      </div>
                    ) : null}
                    <div className="text-[11px] font-bold text-[#374151] mb-1">
                      {mediaType === 'video' && formatId === 'hero_banner'
                        ? 'Hero Video URL (hosted mp4/webm)'
                        : `Creative ${mediaType === 'gif' ? 'GIF' : 'Image'}${
                            placementDef?.creative ? ` — ${placementDef.creative.recommended.width}×${placementDef.creative.recommended.height}px recommended` : ''
                          }`}
                    </div>
                    {mediaType === 'video' && formatId === 'hero_banner' ? (
                      <div className="space-y-2">
                        <input
                          value={videoUrl}
                          onChange={(e) => {
                            setVideoUrl(e.target.value);
                            setMediaType('video');
                          }}
                          className="w-full rounded-lg border border-[#E8EDF2] px-3 py-2 text-[12px]"
                          placeholder="https://…/hero.mp4"
                        />
                        <div className="text-[10px] text-[#9CA3AF] leading-snug">
                          Video uses existing media limits: hosted http(s) URL only. Platform has no Hero video
                          upload/transcoder — paste an mp4/webm URL. Playback: muted autoplay loop playsInline,
                          no controls.
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#E8EDF2] bg-[#F9FAFB] px-3 py-2 text-[11px] font-bold">
                            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                            Poster image (optional)
                            <input
                              type="file"
                              accept="image/jpeg,image/jpg,image/png,image/webp,image/gif,image/avif"
                              className="hidden"
                              onChange={(e) => void uploadCreative(e.target.files?.[0] || null, 'poster')}
                            />
                          </label>
                          {posterUrl || imageUrl ? (
                            <span className="truncate text-[10px] text-[#6B7280] max-w-[220px]">
                              {posterUrl || imageUrl}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    ) : (
                      <>
                        {imageUrl ? (
                          <div className="mb-2 flex items-center gap-3 rounded-lg border border-[#E8EDF2] bg-white p-2" data-testid="ad-image-current">
                            <a href={imageUrl} target="_blank" rel="noreferrer" className="block shrink-0 overflow-hidden rounded-md border border-[#E8EDF2] bg-[#0F1238]" title="Open the full image">
                              <img src={imageUrl} alt="Current creative" className="block h-16 w-auto max-w-[220px] object-contain" />
                            </a>
                            <div className="min-w-0 flex-1 text-[11px]">
                              <div className="font-bold text-[#111827]">Current image</div>
                              <div className="text-[#6B7280]">
                                {imageDims ? `${imageDims.width}×${imageDims.height}px · ${(imageDims.width / imageDims.height).toFixed(2)}:1` : 'Reading size…'}
                              </div>
                              <div className="truncate text-[10px] text-[#9CA3AF]">{imageUrl.split('/').pop()}</div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setImageUrl('');
                                setImageDims(null);
                                setMessage(null);
                              }}
                              className="shrink-0 rounded-md border border-red-200 px-2.5 py-1.5 text-[10.5px] font-extrabold text-red-700 hover:bg-red-50"
                              data-testid="ad-image-remove"
                            >
                              Remove
                            </button>
                          </div>
                        ) : null}
                        <div className="flex items-center gap-2">
                          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#E8EDF2] bg-[#F9FAFB] px-3 py-2 text-[11px] font-bold">
                            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                            {imageUrl ? 'Replace image' : 'Upload'}
                            <input
                              type="file"
                              accept={
                                mediaType === 'gif'
                                  ? 'image/gif'
                                  : 'image/jpeg,image/jpg,image/png,image/webp,image/gif'
                              }
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0] || null;
                                // allow picking the same file again after a failure
                                e.target.value = '';
                                void uploadCreative(f, 'image');
                              }}
                              data-testid="ad-image-file"
                            />
                          </label>
                          {imageUrl ? null : (
                            <span className="text-[10px] text-[#9CA3AF] inline-flex items-center gap-1" data-testid="ad-image-none">
                              <ImageIcon className="h-3 w-3" /> No image — upload one before publishing
                            </span>
                          )}
                        </div>
                        {uploadNote ? (
                          <div
                            className={`mt-2 rounded-md px-2.5 py-1.5 text-[11px] font-semibold ${uploadNote.kind === 'error' ? 'bg-red-50 text-red-700' : uploadNote.kind === 'busy' ? 'bg-blue-50 text-blue-700' : uploadNote.kind === 'tip' ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-700'}`}
                            data-testid="ad-upload-note"
                            role="status"
                          >
                            {uploadNote.text}
                          </div>
                        ) : null}
                        <div className="mt-1 text-[10px] text-[#9CA3AF]">
                          JPG/PNG/WEBP/GIF, any shape — it is fitted into the frame (best: the recommended size). Big photos are shrunk automatically.
                        </div>
                        {formatId !== 'hero_banner' ? (
                          <div className="mt-3 rounded-lg border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-2.5" data-testid="ad-phone-image">
                            <div className="text-[11.5px] font-extrabold text-[#111827]">Phone image (optional)</div>
                            <div className="mb-2 text-[10.5px] text-[#6B7280]">
                              Phones are narrow, so a wide banner looks thin there. Upload a taller version — e.g. 1080×1080 (square) or 1080×1350 — and phones show it instead. Without one, phones show the wide design whole.
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              {mobileImageUrl ? <img src={mobileImageUrl} alt="" className="h-16 w-16 rounded-md border border-[#E8EDF2] object-cover" /> : null}
                              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#E8EDF2] bg-white px-3 py-1.5 text-[11px] font-bold">
                                {mobileUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                                {mobileImageUrl ? 'Replace phone image' : 'Upload phone image'}
                                <input
                                  type="file"
                                  accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                                  className="hidden"
                                  data-testid="ad-phone-image-file"
                                  onChange={async (e) => {
                                    const f = e.target.files?.[0];
                                    e.target.value = '';
                                    if (!f) return;
                                    setMobileUploading(true);
                                    try {
                                      setMobileImageUrl(await uploadProductImage(f));
                                    } catch (err) {
                                      setError(err instanceof Error ? err.message : 'Upload failed');
                                    } finally {
                                      setMobileUploading(false);
                                    }
                                  }}
                                />
                              </label>
                              {mobileImageUrl ? (
                                <button type="button" onClick={() => setMobileImageUrl('')} className="rounded-md border border-red-200 px-2.5 py-1.5 text-[10.5px] font-extrabold text-red-700">
                                  Remove
                                </button>
                              ) : null}
                            </div>
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>
                ) : null}
                {fields.has('logo') ? (
                  <div>
                    <div className="text-[11px] font-bold text-[#374151] mb-1">Logo / Avatar</div>
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#E8EDF2] bg-[#F9FAFB] px-3 py-2 text-[11px] font-bold">
                      {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                      Upload logo
                      <input
                        type="file"
                        accept="image/jpeg,image/jpg,image/png,image/webp,image/gif,image/avif"
                        className="hidden"
                        onChange={(e) => void uploadCreative(e.target.files?.[0] || null, 'logo')}
                      />
                    </label>
                    {logoUrl ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11.5px]" data-testid="logo-color">
                        <img src={logoUrl} alt="" className="h-9 w-9 rounded-full border border-[#E8EDF2] bg-white object-cover" />
                        <span
                          className="inline-block h-7 w-16 rounded-md border border-[#E8EDF2]"
                          style={{ background: (useLogoColor && brandGradient(logoColor, 110, logoColor2)) || 'linear-gradient(110deg,#3B1E3F,#2A1846,#2B1A4A)' }}
                          title={logoColor || 'Choosify colours'}
                        />
                        <label className="inline-flex items-center gap-1.5 font-semibold text-[#374151]">
                          <input type="checkbox" checked={useLogoColor} onChange={(e) => setUseLogoColor(e.target.checked)} data-testid="logo-color-on" />
                          Colour the card from the logo{logoColor ? ` (${logoColor})` : ''}
                        </label>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}
          {/* Where it appears + what to upload, under the preview (moved from the upload area). */}
          {placementDef ? <div className="mt-3" data-testid="ad-spec-under-preview"><AdSlotSpec placement={placementDef} /></div> : null}
        </aside>
      </div>
    </div>
  );
}
