import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Image as ImageIcon, Loader2, Upload } from 'lucide-react';
import {
  AD_FORMATS,
  AD_PLACEMENTS,
  assertFormatPlacementCompatible,
  getFormatDef,
  getPlacementDef,
  listPages,
  type AdFormatId,
} from '@/shared/ads/placementRegistry';
import { inferHeroMediaType, type HeroMediaType } from '@/shared/ads/heroMedia';
import { StorefrontAdPresentation } from '../../components/ads/storefront';
import { CategorySearchSelect } from '../../components/ads/CategorySearchSelect';
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

  const [formatId, setFormatId] = useState<AdFormatId>(DEFAULT_FORMAT);
  const [pageKey, setPageKey] = useState('homepage');
  const [placementId, setPlacementId] = useState('HOME_HERO');
  const [advertiserName, setAdvertiserName] = useState('');
  const [headline, setHeadline] = useState('');
  const [subtext, setSubtext] = useState('');
  const [ctaLabel, setCtaLabel] = useState('Shop Now');
  const [imageUrl, setImageUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [posterUrl, setPosterUrl] = useState('');
  const [mediaType, setMediaType] = useState<HeroMediaType>('image');
  const [logoUrl, setLogoUrl] = useState('');
  const [listingId, setListingId] = useState('');
  const [destMode, setDestMode] = useState<DestMode>('internal');
  const [internalEntityType, setInternalEntityType] = useState('product');
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
  const listingLocked = Boolean(listingId) && formatId === 'deal_of_the_day';

  const hydrateFromRecord = useCallback((ad: AdsApiRecord) => {
    setExisting(ad);
    const creative = (ad.creative || {}) as Record<string, string>;
    const cta = (ad.cta || {}) as Record<string, string>;
    if (ad.formatId) setFormatId(ad.formatId as AdFormatId);
    if (ad.pageKey) setPageKey(ad.pageKey);
    if (ad.placementId) setPlacementId(ad.placementId);
    setAdvertiserName(creative.advertiserName || '');
    setHeadline(creative.headline || ad.title || '');
    setSubtext(creative.body || creative.subtext || '');
    setCtaLabel(cta.label || 'Shop Now');
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
  useEffect(() => {
    const pagesForFormat = [...new Set(allFormatPlacements.map((p) => p.pageKey))];
    if (!pagesForFormat.includes(pageKey as never) && pagesForFormat[0]) {
      setPageKey(pagesForFormat[0]);
      return;
    }
    if (!availablePlacements.some((p) => p.placementId === placementId)) {
      if (availablePlacements[0]) setPlacementId(availablePlacements[0].placementId);
    }
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
      const url = await uploadProductImage(file);
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
      advertiserName: advertiserName || undefined,
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
        url: destMode === 'external' ? externalUrl.trim() : undefined,
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

  const save = async (mode: 'draft' | 'submit' | 'publish') => {
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
            onClick={() => navigate('/admin/ads-deals-studio')}
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
          <span className="rounded-full bg-[#F3F4F6] px-3 py-1 text-[10px] font-extrabold uppercase tracking-wide text-[#374151]">
            {existing.status}
          </span>
        ) : null}
      </div>

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
                <label className="block text-[11px] font-bold text-[#374151]">
                  Advertiser / Brand
                  <input
                    value={advertiserName}
                    onChange={(e) => setAdvertiserName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[#E8EDF2] px-3 py-2 text-[12px]"
                    placeholder="e.g. Samsung"
                  />
                </label>
              ) : null}
              {fields.has('headline') ? (
                <label className="block text-[11px] font-bold text-[#374151]">
                  Headline
                  <input
                    value={headline}
                    onChange={(e) => setHeadline(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[#E8EDF2] px-3 py-2 text-[12px]"
                  />
                </label>
              ) : null}
              {fields.has('subtext') ? (
                <label className="block sm:col-span-2 text-[11px] font-bold text-[#374151]">
                  Subtext
                  <textarea
                    value={subtext}
                    onChange={(e) => setSubtext(e.target.value)}
                    rows={2}
                    className="mt-1 w-full rounded-lg border border-[#E8EDF2] px-3 py-2 text-[12px]"
                  />
                </label>
              ) : null}
              {fields.has('ctaLabel') ? (
                <label className="block text-[11px] font-bold text-[#374151]">
                  CTA Label
                  <input
                    value={ctaLabel}
                    onChange={(e) => setCtaLabel(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[#E8EDF2] px-3 py-2 text-[12px]"
                  />
                </label>
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
                  <div className="text-[11px] font-bold text-[#374151] mb-1">
                    {mediaType === 'video' && formatId === 'hero_banner'
                      ? 'Hero Video URL (hosted mp4/webm)'
                      : `Creative ${mediaType === 'gif' ? 'GIF' : 'Image'} ${
                          placementDef ? `(${placementDef.aspectRatio})` : ''
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
                            accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
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
                      <div className="flex items-center gap-2">
                        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#E8EDF2] bg-[#F9FAFB] px-3 py-2 text-[11px] font-bold">
                          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                          Upload
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
                        {imageUrl ? (
                          <span className="truncate text-[10px] text-[#6B7280] max-w-[180px]">{imageUrl}</span>
                        ) : (
                          <span className="text-[10px] text-[#9CA3AF] inline-flex items-center gap-1">
                            <ImageIcon className="h-3 w-3" /> No image
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-[10px] text-[#9CA3AF]">
                        JPG/PNG/WEBP/GIF via existing upload policy (server MIME + size). GIF preview animates.
                        Cover/center crop — not stretched.
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
                      accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
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
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-[11px] font-bold text-[#374151]">
                  Entity type
                  <select
                    value={internalEntityType}
                    onChange={(e) => setInternalEntityType(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[#E8EDF2] px-3 py-2 text-[12px]"
                  >
                    <option value="product">Product</option>
                    <option value="brand">Brand</option>
                    <option value="deal">Deal</option>
                    <option value="category">Category</option>
                    <option value="guide">Guide</option>
                    <option value="creator">Creator</option>
                  </select>
                </label>
                <label className="block text-[11px] font-bold text-[#374151]">
                  Entity ID
                  <input
                    value={internalEntityId}
                    onChange={(e) => setInternalEntityId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[#E8EDF2] px-3 py-2 text-[12px]"
                    placeholder="Product / brand / deal id"
                  />
                </label>
              </div>
            ) : (
              <label className="block text-[11px] font-bold text-[#374151]">
                External URL (http/https only)
                <input
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#E8EDF2] px-3 py-2 text-[12px]"
                  placeholder="https://example.com/offer"
                />
              </label>
            )}
          </section>

          {/* 4. PLACEMENT */}
          <section className="rounded-xl border border-[#E8EDF2] bg-white p-4">
            <div className="mb-3 text-[10px] font-extrabold tracking-[0.08em] text-[#9CA3AF]">4 · PLACEMENT</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-[11px] font-bold text-[#374151]">
                Page
                <select
                  value={pageKey}
                  onChange={(e) => setPageKey(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#E8EDF2] px-3 py-2 text-[12px]"
                >
                  {pages
                    .filter((p) => pagesForFormat.includes(p.pageKey))
                    .map((p) => (
                      <option key={p.pageKey} value={p.pageKey}>
                        {p.pageLabel}
                      </option>
                    ))}
                </select>
              </label>
              <label className="block text-[11px] font-bold text-[#374151]">
                Position
                <select
                  value={placementId}
                  onChange={(e) => setPlacementId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#E8EDF2] px-3 py-2 text-[12px]"
                >
                  {availablePlacements.map((p) => (
                    <option key={p.placementId} value={p.placementId}>
                      {p.slotLabel}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-bold text-[#6B7280]">
              <span className="rounded bg-[#F3F4F6] px-2 py-1">
                Devices:{' '}
                {[placementDef?.desktopSupport ? 'Desktop' : null, placementDef?.mobileSupport ? 'Mobile' : null]
                  .filter(Boolean)
                  .join(' · ') || '—'}
              </span>
              {placementDef?.embeddedMode ? (
                <span className="rounded bg-amber-50 text-amber-800 px-2 py-1">Embedded sub-slot</span>
              ) : null}
              <span className="rounded bg-[#F3F4F6] px-2 py-1 font-mono">{placementId}</span>
            </div>
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
              {previewInPlacement && placementDef?.orientation === 'vertical' ? (
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
              Preview uses the shared StorefrontAdPresentation component (same formats as the Choosify
              storefront references). Badge wording: PROMOTED.
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
