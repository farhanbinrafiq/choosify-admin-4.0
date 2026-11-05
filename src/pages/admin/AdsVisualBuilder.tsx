import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
  type AdFormatId,
  type AdPlacementDef,
} from '@/shared/ads/placementRegistry';
import { inferHeroMediaType, type HeroMediaType } from '@/shared/ads/heroMedia';
import { StorefrontAdPresentation } from '../../components/ads/storefront';
import { AdFitStatus, AdSlotPreview, AdSlotSpec, measureImage } from '../../components/ads/AdSlotPreview';
import { CategorySearchSelect } from '../../components/ads/CategorySearchSelect';
import { EntityPicker, type PickableType } from '../../components/ads/EntityPicker';
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
  if (p.orientation === 'horizontal') return 'Wide banner';
  if (p.orientation === 'embedded') return 'Card footer strip';
  if (p.slotKey === 'popup') return 'Pop-up';
  if (p.slotKey === 'grid_card') return 'Grid card';
  if (p.slotKey === 'feed') return 'Feed card';
  return 'Side card';
}

export default function AdsVisualBuilder() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { profile } = useAuth();
  const role = profile?.role || 'seller';
  const isAdmin = role === 'admin' || role === 'super_admin';

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
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
  const [imageUrl, setImageUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [posterUrl, setPosterUrl] = useState('');
  const [mediaType, setMediaType] = useState<HeroMediaType>('image');
  const [logoUrl, setLogoUrl] = useState('');
  const [listingId, setListingId] = useState('');
  const [destMode, setDestMode] = useState<DestMode>('internal');
  const [internalEntityType, setInternalEntityType] = useState('product');
  /** Category links go to /categories?category=<slug>. */
  const [internalEntitySlug, setInternalEntitySlug] = useState('');
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
    }
    {
      const f = (ad.creative as Record<string, unknown> | undefined)?.focusY;
      setFocusY(f === 'top' || f === 'bottom' ? f : 'center');
    }
    setImageUrl(creative.imageUrl || '');
    setVideoUrl(creative.videoUrl || '');
    setPosterUrl(creative.posterUrl || '');
    setMediaType(
      inferHeroMediaType(
        creative.videoUrl || creative.imageUrl,
        creative.mediaType as HeroMediaType | undefined,
      ),
    );
    setLogoUrl(creative.logoUrl || '');
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
      setInternalEntityType(cta.internalEntityType || 'product');
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
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
      popupPages: formatId === 'popup' ? popupPages : undefined,
      popupMaxPerSession: formatId === 'popup' ? popupMax : undefined,
      popupDelaySec: formatId === 'popup' ? popupDelay : undefined,
      focusY: placementDef?.creative?.display === 'natural' && placementDef.slotKey !== 'popup' && fit === 'fill' ? focusY : undefined,
      advertiserName: fields.has('advertiser') ? advertiserName || undefined : undefined,
      headline: headline || undefined,
      body: subtext || undefined,
      subtext: subtext || undefined,
      imageUrl: imageUrl || undefined,
      videoUrl: formatId === 'hero_banner' && resolvedMediaType === 'video' ? videoUrl || undefined : undefined,
      posterUrl: formatId === 'hero_banner' && resolvedMediaType === 'video' ? posterUrl || imageUrl || undefined : undefined,
      mediaType: formatId === 'hero_banner' ? resolvedMediaType : undefined,
      logoUrl: logoUrl || undefined,
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
            : internalEntityType === 'category' && (internalEntitySlug || internalEntityId)
              ? `/categories?category=${encodeURIComponent(internalEntitySlug || internalEntityId)}`
              : undefined,
        internalEntityType: destMode === 'internal' ? internalEntityType : undefined,
        internalEntityId: destMode === 'internal' ? internalEntityId || listingId || undefined : undefined,
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
  const [askCancel, setAskCancel] = useState(false);
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
          {/* 1. FORMAT */}
          <section className="rounded-xl border border-[#E8EDF2] bg-white p-4">
            <div className="mb-3 text-[10px] font-extrabold tracking-[0.08em] text-[#9CA3AF]">1 · FORMAT</div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {AD_FORMATS.map((f) => {
                const allowed = placementsForFormat(f.formatId, role).length > 0;
                const active = formatId === f.formatId;
                return (
                  <button
                    key={f.formatId}
                    type="button"
                    disabled={!allowed}
                    onClick={() => setFormatId(f.formatId)}
                    className={`rounded-lg border px-3 py-3 text-left transition ${
                      active
                        ? 'border-[#EF3C23] bg-[#FFF5F3] ring-1 ring-[#EF3C23]/30'
                        : 'border-[#E8EDF2] bg-white hover:border-[#FDBA74]'
                    } ${!allowed ? 'opacity-40 cursor-not-allowed' : ''}`}
                  >
                    <div className="text-[12px] font-extrabold text-[#111827]">{f.label}</div>
                    <div className="mt-1 text-[10px] text-[#6B7280] leading-snug">{f.description}</div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* 2. CONTENT */}
          <section className="rounded-xl border border-[#E8EDF2] bg-white p-4">
            <div className="mb-3 text-[10px] font-extrabold tracking-[0.08em] text-[#9CA3AF]">2 · CONTENT</div>
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

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
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
                  {placementDef ? <div className="mb-2"><AdSlotSpec placement={placementDef} /></div> : null}
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
                            onChange={(e) => void uploadCreative(e.target.files?.[0] || null, 'image')}
                          />
                        </label>
                        {imageUrl ? null : (
                          <span className="text-[10px] text-[#9CA3AF] inline-flex items-center gap-1" data-testid="ad-image-none">
                            <ImageIcon className="h-3 w-3" /> No image — upload one before publishing
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-[10px] text-[#9CA3AF]">
                        JPG/PNG/WEBP/GIF. The size is checked against this slot before uploading.
                      </div>
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
                </div>
              ) : null}
            </div>
          </section>

          {/* 3. DESTINATION */}
          <section className="rounded-xl border border-[#E8EDF2] bg-white p-4">
            <div className="mb-3 text-[10px] font-extrabold tracking-[0.08em] text-[#9CA3AF]">3 · DESTINATION</div>
            <div className="flex gap-2 mb-3">
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
              <FieldBox tone="link" label="Where the button goes" where="A page on Choosify">
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
                    <option value="product">Product</option>
                    <option value="brand">Brand</option>
                    <option value="deal">Deal</option>
                    <option value="category">Category</option>
                    <option value="guide">Guide</option>
                    <option value="creator">Creator</option>
                  </select>
                </label>
                <div className="block text-[11px] font-bold text-[#374151]">
                  Choose it
                  <EntityPicker
                    type={internalEntityType as PickableType}
                    value={internalEntityType === 'category' ? internalEntityId || internalEntitySlug : internalEntityId}
                    onPick={(e) => {
                      setInternalEntityId(e?.id || '');
                      setInternalEntitySlug(e?.slug || '');
                    }}
                  />
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

          {/* 4. PLACEMENT */}
          <section className="rounded-xl border border-[#E8EDF2] bg-white p-4">
            <div className="mb-3 text-[10px] font-extrabold tracking-[0.08em] text-[#9CA3AF]">4 · PLACEMENT</div>
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
            <div className="mt-3" data-testid="ad-page-map">
              <div className="text-[11px] font-bold text-[#374151]">Where on this page</div>
              <div className="mt-0.5 text-[10.5px] text-[#6B7280]">
                Every place on the page, top to bottom. Different places show separately; ads in the same place take turns (round switch icons).
              </div>
              <div className="mt-2 overflow-hidden rounded-lg border border-[#E8EDF2]">
                {pageRows.map((row, idx) => {
                  const chosen = isRowChosen(row);
                  const taken = placeOccupancy[row.key] || [];
                  const fits = row.placement.allowedFormats.includes(formatId);
                  const switchTo = fits ? null : getFormatDef(row.placement.allowedFormats[0] as AdFormatId)?.label;
                  return (
                    <button
                      key={row.key}
                      type="button"
                      onClick={() => chooseRow(row)}
                      data-testid={`ad-place-${row.key.replace(':', '--')}`}
                      aria-pressed={chosen}
                      className={`flex w-full items-center gap-3 px-3 py-2 text-left text-[11.5px] ${idx ? 'border-t border-[#E8EDF2]' : ''} ${
                        chosen ? 'bg-[#FFF4EE]' : 'bg-white hover:bg-[#F9FAFB]'
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
                        {switchTo ? <span className="block text-[10px] font-semibold text-[#9CA3AF]">Switches the format to {switchTo}</span> : null}
                        {!row.placement.mobileSupport ? <span className="block text-[10px] font-semibold text-[#9CA3AF]">Desktop only</span> : null}
                      </span>
                      {taken.length ? (
                        <span className="shrink-0 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-800" title={taken.map((a) => a.advertisementReferenceId || a.title).join(', ')}>
                          {taken.length} live ad{taken.length > 1 ? 's' : ''}{chosen ? ' — will take turns' : ''}
                        </span>
                      ) : (
                        <span className="shrink-0 text-[10px] font-semibold text-[#9CA3AF]">free</span>
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-bold text-[#6B7280]">
                <span className="rounded bg-[#F3F4F6] px-2 py-1 font-mono">{placementId}{pagePosition ? ` · ${pagePosition}` : ''}</span>
              </div>
            </div>
            {placementDef?.slotKey === 'grid_card' ? (
              <div className="mt-3 rounded-lg border-2 border-[#C4B5FD] bg-[#F5F3FF] px-3 py-2.5" data-testid="grid-rules">
                <label className="block text-[11.5px] font-extrabold text-[#111827]">
                  How often in the grid
                  <select value={gridEvery} onChange={(e) => setGridEvery(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-[#E8EDF2] bg-white px-3 py-2 text-[12px] font-semibold" data-testid="grid-every">
                    {GRID_EVERY_CHOICES.map((n) => (
                      <option key={n} value={n}>
                        {n === 0 ? 'Once, after the last card' : `After every ${n} cards`}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="mt-1 text-[10.5px] text-[#6B7280]">
                  The ad repeats through the list (e.g. after every 8 cards = about every 2 rows on desktop). If several ads are booked here they take turns. With fewer cards than that, it shows once after the last card.
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
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block text-[11px] font-bold text-[#374151]">
                Start (optional)
                <input
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#E8EDF2] px-3 py-2 text-[12px]"
                />
              </label>
              <label className="block text-[11px] font-bold text-[#374151]">
                End (optional)
                <input
                  type="datetime-local"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#E8EDF2] px-3 py-2 text-[12px]"
                />
              </label>
            </div>
          </section>

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
                Submit for Approval
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
        <aside className="lg:sticky lg:top-4 h-fit space-y-3">
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
                      hasDestination: destMode === 'external' ? Boolean(externalUrl.trim()) : Boolean(internalEntityId || listingId),
                      showText: formatDef?.imageLed ? showText : false,
                      fit,
                      focusY,
                    }}
                  />
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
        </aside>
      </div>
    </div>
  );
}
