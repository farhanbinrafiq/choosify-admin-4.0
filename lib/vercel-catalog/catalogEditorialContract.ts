import type {
  CatalogCreator,
  CatalogGuide,
  CatalogPlacement,
  CatalogProductDetail,
  SiteSeoEntry,
} from './catalogEditorialTypes';

const nowIso = () => new Date().toISOString();

const toString = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value : fallback);
const toNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = Number(value.replace(/[^0-9.-]/g, ''));
    if (Number.isFinite(n)) return n;
  }
  return fallback;
};
const toBoolean = (value: unknown, fallback = false): boolean => (typeof value === 'boolean' ? value : fallback);
const toStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
const toBrandPartners = (
  value: unknown,
): { name: string; color?: string; brandId?: string; logo?: string }[] => {
  const logoOk = (v: unknown): string | undefined => {
    const s = typeof v === 'string' ? v.trim() : '';
    if (!s) return undefined;
    if (s.startsWith('/') && !s.startsWith('//')) return s.slice(0, 2000);
    return /^https?:\/\//i.test(s) && !/^\s*(javascript|data|vbscript|file):/i.test(s)
      ? s.slice(0, 2000)
      : undefined;
  };
  return Array.isArray(value)
    ? value
        .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
        .map((item) => ({
          name: toString(item.name).slice(0, 120),
          color: toString(item.color) || undefined,
          // Canonical Choosify brand reference when tagged from the directory.
          brandId: toString(item.brandId).slice(0, 80) || undefined,
          // Creator-uploaded logo for an off-directory collaboration.
          logo: logoOk(item.logo),
        }))
        .filter((item) => item.name)
        .slice(0, 24)
    : [];
};

export const slugify = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

/** http(s) URL, or an app-relative path ("/spotlight/…", "/media/…"). Else ''. */
const safeUrlOrPath = (value: unknown): string => {
  const s = typeof value === 'string' ? value.trim() : '';
  if (!s) return '';
  if (s.startsWith('/') && !s.startsWith('//')) return s.slice(0, 2000);
  return safeHttpUrl(s);
};

/** Creator-defined extra social links. Presence-aware (`[]` clears); max 8. */
const normalizeCreatorCustomSocial = (
  raw: unknown,
  existing: Array<{ label: string; url: string }> | undefined,
): Array<{ label: string; url: string }> => {
  if (!Array.isArray(raw)) return existing ?? [];
  return raw
    .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object')
    .map((r) => ({ label: clampStr(r.label, 40), url: safeHttpUrl(r.url) }))
    .filter((r) => r.label && r.url)
    .slice(0, 8);
};

/** Creator-curated Featured Content. Presence-aware (`[]` clears); max 12. */
const normalizeCreatorFeatured = (
  raw: unknown,
  existing: CatalogCreator['featuredContent'],
): NonNullable<CatalogCreator['featuredContent']> => {
  if (!Array.isArray(raw)) return existing ?? [];
  const KINDS = ['guide', 'video', 'reel', 'blog', 'link'];
  return raw
    .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object')
    .map((r, i) => {
      const source = clampStr(r.source, 12) === 'platform' ? ('platform' as const) : ('external' as const);
      const kindRaw = clampStr(r.kind, 10);
      return {
        id: clampStr(r.id, 40) || `cfc-${i}`,
        source,
        kind: (KINDS.includes(kindRaw) ? kindRaw : source === 'platform' ? 'guide' : 'link') as
          NonNullable<CatalogCreator['featuredContent']>[number]['kind'],
        contentId: source === 'platform' ? clampStr(r.contentId, 80) || undefined : undefined,
        title: clampStr(r.title, 160),
        thumbnail: safeUrlOrPath(r.thumbnail),
        url: safeUrlOrPath(r.url),
      };
    })
    .filter((r) => r.title && r.url)
    .slice(0, 12);
};

export const normalizeCreatorInput = (payload: unknown, existing?: CatalogCreator): CatalogCreator => {
  const raw = (payload ?? {}) as Record<string, unknown>;
  const name = toString(raw.name, existing?.name ?? 'Untitled Creator');
  const id = toString(raw.id, existing?.id ?? `creator-${Date.now()}`);
  const statusRaw = toString(raw.status, existing?.status ?? 'live').toLowerCase();
  const socialRaw =
    raw.socialLinks && typeof raw.socialLinks === 'object'
      ? (raw.socialLinks as Record<string, unknown>)
      : null;
  const customSocial = normalizeCreatorCustomSocial(socialRaw?.custom, existing?.socialLinks?.custom);
  const featuredContent = normalizeCreatorFeatured(raw.featuredContent, existing?.featuredContent);
  return {
    id,
    slug: toString(raw.slug, existing?.slug ?? slugify(name || id)),
    name,
    handle: toString(raw.handle, existing?.handle ?? `@${slugify(name)}`),
    avatar: toString(raw.avatar, existing?.avatar ?? ''),
    coverImage: toString(raw.coverImage, existing?.coverImage ?? '') || undefined,
    role: toString(raw.role, existing?.role ?? '') || undefined,
    location: toString(raw.location, existing?.location ?? '') || undefined,
    reviewVideoUrl: toString(raw.reviewVideoUrl, existing?.reviewVideoUrl ?? '') || undefined,
    score: toNumber(raw.score, existing?.score ?? 0),
    bestFor: toString(raw.bestFor, existing?.bestFor ?? 'General'),
    bestForTags: toStringArray(raw.bestForTags).length ? toStringArray(raw.bestForTags) : existing?.bestForTags ?? [],
    platforms: toStringArray(raw.platforms).length ? toStringArray(raw.platforms) : existing?.platforms ?? [],
    bio: toString(raw.bio, existing?.bio ?? ''),
    followers:
      raw.followers && typeof raw.followers === 'object'
        ? (raw.followers as Record<string, string>)
        : existing?.followers ?? {},
    socialLinks:
      socialRaw || existing?.socialLinks
        ? {
            facebook: toString(socialRaw?.facebook, existing?.socialLinks?.facebook ?? '') || undefined,
            instagram: toString(socialRaw?.instagram, existing?.socialLinks?.instagram ?? '') || undefined,
            youtube: toString(socialRaw?.youtube, existing?.socialLinks?.youtube ?? '') || undefined,
            tiktok: toString(socialRaw?.tiktok, existing?.socialLinks?.tiktok ?? '') || undefined,
            linkedin: toString(socialRaw?.linkedin, existing?.socialLinks?.linkedin ?? '') || undefined,
            ...(customSocial.length ? { custom: customSocial } : {}),
          }
        : undefined,
    featuredContent: featuredContent.length ? featuredContent : undefined,
    brandPartners: toBrandPartners(raw.brandPartners).length
      ? toBrandPartners(raw.brandPartners)
      : existing?.brandPartners,
    collabTypes: toStringArray(raw.collabTypes).length ? toStringArray(raw.collabTypes) : existing?.collabTypes,
    responseTime: toString(raw.responseTime, existing?.responseTime ?? '') || undefined,
    preferredContact: toString(raw.preferredContact, existing?.preferredContact ?? '') || undefined,
    email: toString(raw.email, existing?.email),
    phone: toString(raw.phone, existing?.phone),
    category: toString(raw.category, existing?.category),
    verifiedStatus: toBoolean(raw.verifiedStatus, existing?.verifiedStatus ?? false),
    featuredFlag: toBoolean(raw.featuredFlag, existing?.featuredFlag ?? false),
    videos: Array.isArray(raw.videos) ? (raw.videos as CatalogCreator['videos']) : existing?.videos ?? [],
    reels: Array.isArray(raw.reels) ? (raw.reels as CatalogCreator['reels']) : existing?.reels ?? [],
    blogs: Array.isArray(raw.blogs) ? (raw.blogs as CatalogCreator['blogs']) : existing?.blogs ?? [],
    status: statusRaw === 'draft' || statusRaw === 'archived' ? statusRaw : 'live',
    userId: toString(raw.userId, existing?.userId ?? '') || undefined,
    createdAt: existing?.createdAt ?? nowIso(),
    updatedAt: nowIso(),
  };
};

const GUIDE_FORMATS = ['buying_guide', 'product_review', 'comparison', 'live', 'tutorial', 'tips'] as const;
const GUIDE_MEDIA_TYPES = ['article', 'reels', 'video', 'shorts'] as const;
const GUIDE_STATUSES = ['draft', 'live', 'archived'] as const;
const LIVE_STATUSES = ['live', 'upcoming', 'replay', 'ended'] as const;
const LIVE_PLATFORMS = ['youtube', 'facebook', 'tiktok', 'instagram', 'vimeo', 'native'] as const;

/** Known structured Guide section ids with typed `data` contracts. */
export const KNOWN_GUIDE_SECTION_IDS = [
  'winner',
  'why_it_won',
  'verdict',
  'takeaways',
  'items_mentioned',
  'brands_mentioned',
  'how_review_was_made',
  'recommendations',
] as const;
export type KnownGuideSectionId = (typeof KNOWN_GUIDE_SECTION_IDS)[number];

/** trim → drop empty → dedupe → cap. */
const strList = (value: unknown, cap = 60): string[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of value) {
    const s = typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '';
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
    if (out.length >= cap) break;
  }
  return out;
};
const clampStr = (value: unknown, cap: number): string =>
  (typeof value === 'string' ? value : '').trim().slice(0, cap);

/** Up to 4 short "why it's good for…" keyword chips. `#` prefix stripped, ≤24 chars. */
const highlightTagList = (value: unknown): string[] =>
  strList(value, 4).map((s) => s.replace(/^#+/, '').trim().slice(0, 24)).filter(Boolean).slice(0, 4);

/** `{ entityId: string[] }` map of per-entity highlight chips. Keys clamped, ≤4 tags each. */
const highlightTagMap = (value: unknown): Record<string, string[]> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const key = k.trim().slice(0, 80);
    const tags = highlightTagList(v);
    if (key && tags.length) out[key] = tags;
  }
  return out;
};

/** Only http(s); rejects javascript:/data:/vbscript:/file: etc. Returns '' if unsafe. */
export const safeHttpUrl = (value: unknown): string => {
  const s = typeof value === 'string' ? value.trim() : '';
  if (!s) return '';
  if (!/^https?:\/\//i.test(s)) return '';
  if (/^\s*(javascript|data|vbscript|file):/i.test(s)) return '';
  try {
    // eslint-disable-next-line no-new
    new URL(s);
    return s.slice(0, 2000);
  } catch {
    return '';
  }
};

const GUIDE_SOCIAL_PLATFORMS = [
  'youtube',
  'facebook',
  'tiktok',
  'instagram',
  'twitch',
  'vimeo',
  'other',
] as const;

const toNum = (v: unknown): number | undefined => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) return Number(v);
  return undefined;
};

/** Guide-scoped social / continue-on links. Presence-aware; `[]` clears. */
const normalizeGuideSocialLinks = (raw: unknown, existing: CatalogGuide | undefined) => {
  if (!Array.isArray(raw)) return existing?.socialLinks;
  const out = raw
    .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object')
    .map((r, i) => {
      const platformRaw = clampStr(r.platform, 20).toLowerCase();
      return {
        id: clampStr(r.id, 40) || `gsl-${i}`,
        platform: (GUIDE_SOCIAL_PLATFORMS as readonly string[]).includes(platformRaw)
          ? (platformRaw as (typeof GUIDE_SOCIAL_PLATFORMS)[number])
          : ('other' as const),
        url: safeHttpUrl(r.url),
        label: clampStr(r.label, 60) || undefined,
        enabled: r.enabled !== false,
        sortOrder: typeof r.sortOrder === 'number' ? r.sortOrder : i,
      };
    })
    .filter((s) => s.url)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .slice(0, 12);
  return out.length ? out : [];
};

/** Guide-editorial external product/brand references. Presence-aware; `[]` clears. */
const normalizeGuideExternalRefs = (raw: unknown, existing: CatalogGuide | undefined) => {
  if (!Array.isArray(raw)) return existing?.externalRefs;
  const out = raw
    .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object')
    .map((r, i) => {
      const kind = clampStr(r.kind, 12) === 'brand' ? ('brand' as const) : ('product' as const);
      return {
        id: clampStr(r.id, 40) || `gxr-${i}`,
        kind,
        title: clampStr(r.title, 160),
        imageUrl: safeHttpUrl(r.imageUrl) || undefined,
        externalUrl: safeHttpUrl(r.externalUrl),
        subtitle: clampStr(r.subtitle, 160) || undefined,
        brandName: kind === 'product' ? clampStr(r.brandName, 120) || undefined : undefined,
        commentary: clampStr(r.commentary, 600) || undefined,
        sortOrder: typeof r.sortOrder === 'number' ? r.sortOrder : i,
        highlightTags: highlightTagList(r.highlightTags).length ? highlightTagList(r.highlightTags) : undefined,
      };
    })
    .filter((r) => r.title && r.externalUrl)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .slice(0, 24);
  return out.length ? out : [];
};

/**
 * Guide-scoped temporary promo pricing. Presence-aware; `[]` clears. Each offer
 * must target one of the guide's tagged `productIds`; a valid time window; and
 * exactly one of {promoPrice} | {discountType + discountValue}. Route-level code
 * still enforces publisher authorization (brand-authored + owned product only).
 */
const normalizeGuideLiveOffers = (
  raw: unknown,
  existing: CatalogGuide | undefined,
  productIds: string[],
) => {
  if (!Array.isArray(raw)) return existing?.liveOffers;
  const tagged = new Set(productIds);
  const out = raw
    .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object')
    .map((r, i) => {
      const promoPrice = toNum(r.promoPrice);
      const discountValue = toNum(r.discountValue);
      const discountTypeRaw = clampStr(r.discountType, 10);
      const discountType =
        discountTypeRaw === 'percent' || discountTypeRaw === 'amount' ? discountTypeRaw : undefined;
      const startsAt = clampStr(r.startsAt, 40);
      const endsAt = clampStr(r.endsAt, 40);
      const entry: {
        id: string;
        productId: string;
        promoPrice?: number;
        discountType?: 'percent' | 'amount';
        discountValue?: number;
        startsAt: string;
        endsAt: string;
        enabled: boolean;
      } = {
        id: clampStr(r.id, 40) || `glo-${i}`,
        productId: clampStr(r.productId, 80),
        startsAt,
        endsAt,
        enabled: r.enabled !== false,
      };
      if (typeof promoPrice === 'number' && promoPrice >= 0) {
        entry.promoPrice = Math.round(promoPrice * 100) / 100;
      } else if (discountType && typeof discountValue === 'number' && discountValue > 0) {
        entry.discountType = discountType;
        entry.discountValue =
          discountType === 'percent' ? Math.min(90, discountValue) : discountValue;
      }
      return entry;
    })
    .filter((o) => {
      if (!o.productId || !tagged.has(o.productId)) return false;
      const s = Date.parse(o.startsAt);
      const e = Date.parse(o.endsAt);
      if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return false;
      return typeof o.promoPrice === 'number' || (o.discountType && typeof o.discountValue === 'number');
    })
    .slice(0, 24);
  return out.length ? out : [];
};

/** Typed winner / awards. Legacy `winnerIds: string[]` is read as an "overall" product ref. */
const normalizeWinnerSectionData = (data: Record<string, unknown>): Record<string, unknown> => {
  const ENTITY_TYPES = ['product', 'brand', 'external_product', 'external_brand'];
  const toRef = (v: unknown): { entityType: string; entityId: string } | undefined => {
    if (!v || typeof v !== 'object') return undefined;
    const r = v as Record<string, unknown>;
    const et = clampStr(r.entityType, 20);
    const eid = clampStr(r.entityId, 80);
    if (!ENTITY_TYPES.includes(et) || !eid) return undefined;
    return { entityType: et, entityId: eid };
  };
  let overall = toRef(data.overall);
  if (!overall && Array.isArray(data.winnerIds) && data.winnerIds.length) {
    const legacy = clampStr(data.winnerIds[0], 80);
    if (legacy) overall = { entityType: 'product', entityId: legacy };
  }
  const awards = Array.isArray(data.awards)
    ? data.awards
        .filter((a): a is Record<string, unknown> => !!a && typeof a === 'object')
        .map((a, i) => {
          const ref = toRef(a.ref);
          return ref
            ? { id: clampStr(a.id, 40) || `award-${i}`, label: clampStr(a.label, 60), ref }
            : null;
        })
        .filter((a): a is { id: string; label: string; ref: { entityType: string; entityId: string } } => !!a && !!a.label)
        .slice(0, 10)
    : [];
  return {
    ...(overall ? { overall } : {}),
    ...(awards.length ? { awards } : {}),
  };
};

/** Normalize one known section's `data` blob to its canonical contract. */
const normalizeKnownSectionData = (
  id: KnownGuideSectionId,
  data: Record<string, unknown>,
): Record<string, unknown> => {
  switch (id) {
    case 'winner':
      return normalizeWinnerSectionData(data);
    case 'why_it_won':
      return { whyWonChips: strList(data.whyWonChips, 12).map((s) => s.slice(0, 120)) };
    case 'verdict':
      return {
        bestFor: strList(data.bestFor, 20).map((s) => s.slice(0, 200)),
        notFor: strList(data.notFor, 20).map((s) => s.slice(0, 200)),
        whatWeLike: strList(data.whatWeLike, 20).map((s) => s.slice(0, 200)),
        whatToConsider: strList(data.whatToConsider, 20).map((s) => s.slice(0, 200)),
      };
    case 'takeaways':
      return {
        takeawayTitle: clampStr(data.takeawayTitle, 200),
        takeawayBody: clampStr(data.takeawayBody, 4000),
      };
    case 'items_mentioned':
      return {
        itemIds: strList(data.itemIds, 40),
        topPickIds: strList(data.topPickIds, 12),
        highlightTags: highlightTagMap(data.highlightTags),
      };
    case 'brands_mentioned':
      return { brandIds: strList(data.brandIds, 20), highlightTags: highlightTagMap(data.highlightTags) };
    case 'how_review_was_made':
      return {
        reviewMethodSteps: strList(data.reviewMethodSteps, 12).map((s) => s.slice(0, 240)),
      };
    case 'recommendations': {
      // Creator-labelled picks — typed EntityRef, NO ranking. Labels clamped.
      const ENTITY_TYPES = ['product', 'brand', 'external_product', 'external_brand'];
      const picks = Array.isArray(data.picks)
        ? data.picks
            .filter((p): p is Record<string, unknown> => !!p && typeof p === 'object')
            .map((p, i) => {
              const ref = p.ref as Record<string, unknown> | undefined;
              const et = clampStr(ref?.entityType, 20);
              const eid = clampStr(ref?.entityId, 80);
              if (!ENTITY_TYPES.includes(et) || !eid) return null;
              return {
                id: clampStr(p.id, 40) || `pick-${i}`,
                label: clampStr(p.label, 60),
                ref: { entityType: et, entityId: eid },
              };
            })
            .filter((p): p is { id: string; label: string; ref: { entityType: string; entityId: string } } => !!p && !!p.label)
            .slice(0, 24)
        : [];
      return { picks };
    }
    default:
      return data;
  }
};

/**
 * Resolve the canonical Guide brand relationship. Canonical `brandIds` wins;
 * an explicit `brandIds` array on the payload replaces it (`[]` clears);
 * otherwise the legacy `sections['brands_mentioned'].data.brandIds`
 * representation is read as a backward-compatible fallback.
 */
const legacyBrandIdsFromSections = (sections: unknown): unknown => {
  if (!Array.isArray(sections)) return undefined;
  const bm = sections.find(
    (s): s is Record<string, unknown> =>
      !!s && typeof s === 'object' && (s as Record<string, unknown>).id === 'brands_mentioned',
  );
  const data = bm?.data;
  return data && typeof data === 'object' ? (data as Record<string, unknown>).brandIds : undefined;
};

const resolveGuideBrandIds = (
  raw: Record<string, unknown>,
  existing?: CatalogGuide,
): string[] => {
  if (Array.isArray(raw.brandIds)) return strList(raw.brandIds, 20);
  if (Array.isArray(existing?.brandIds)) return strList(existing!.brandIds, 20);
  const legacyIncoming = legacyBrandIdsFromSections(raw.sections);
  if (Array.isArray(legacyIncoming)) return strList(legacyIncoming, 20);
  const legacyStored = legacyBrandIdsFromSections(existing?.sections);
  if (Array.isArray(legacyStored)) return strList(legacyStored, 20);
  return [];
};

/**
 * Typed section normalizer. Known ids (KNOWN_GUIDE_SECTION_IDS) are validated to
 * their canonical `data` contract; unknown ids are passed through shallowly so
 * other consumers keep working but never become deeply-trusted blobs.
 * `brands_mentioned` is kept in sync with the canonical `brandIds` for
 * backward-compatible storefront reads.
 */
const normalizeGuideSections = (
  rawSections: unknown,
  existing: CatalogGuide | undefined,
  brandIds: string[],
): CatalogGuide['sections'] => {
  const source = Array.isArray(rawSections)
    ? rawSections
    : (existing?.sections ?? []);

  const seen = new Set<string>();
  const out: NonNullable<CatalogGuide['sections']> = [];
  source
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .forEach((item, i) => {
      const id = toString(item.id).trim();
      if (!id || seen.has(id)) return;
      seen.add(id);
      const dataIn =
        item.data && typeof item.data === 'object'
          ? (item.data as Record<string, unknown>)
          : {};
      const known = (KNOWN_GUIDE_SECTION_IDS as readonly string[]).includes(id);
      out.push({
        id,
        enabled: item.enabled !== false,
        order: typeof item.order === 'number' ? item.order : i,
        data: known
          ? normalizeKnownSectionData(id as KnownGuideSectionId, dataIn)
          : dataIn,
      });
    });

  // Keep the legacy brands_mentioned section synchronized with canonical brandIds
  // (preserving any per-brand highlight chips that survived normalization).
  const bmIdx = out.findIndex((s) => s.id === 'brands_mentioned');
  const bmHighlights =
    bmIdx >= 0 &&
    out[bmIdx].data &&
    typeof (out[bmIdx].data as Record<string, unknown>).highlightTags === 'object'
      ? (out[bmIdx].data as Record<string, unknown>).highlightTags
      : undefined;
  if (brandIds.length) {
    if (bmIdx >= 0) {
      out[bmIdx] = { ...out[bmIdx], data: { brandIds, ...(bmHighlights ? { highlightTags: bmHighlights } : {}) } };
    } else {
      out.push({
        id: 'brands_mentioned',
        enabled: true,
        order: out.length,
        data: { brandIds },
      });
    }
  } else if (bmIdx >= 0) {
    out[bmIdx] = { ...out[bmIdx], data: { brandIds: [], ...(bmHighlights ? { highlightTags: bmHighlights } : {}) } };
  }

  return out.length ? out : undefined;
};

const toGuideLive = (value: unknown): CatalogGuide['live'] => {
  if (!value || typeof value !== 'object') return undefined;
  const v = value as Record<string, unknown>;
  const statusRaw = toString(v.status);
  const platformRaw = toString(v.platform);
  return {
    status: (LIVE_STATUSES as readonly string[]).includes(statusRaw) ? (statusRaw as (typeof LIVE_STATUSES)[number]) : undefined,
    platform: (LIVE_PLATFORMS as readonly string[]).includes(platformRaw) ? (platformRaw as (typeof LIVE_PLATFORMS)[number]) : undefined,
    embedUrl: toString(v.embedUrl) || undefined,
    scheduledAt: toString(v.scheduledAt) || undefined,
  };
};

/** Presence-aware string-array merge: `[]` clears, omitted preserves `existing`. */
const mergeStrArray = (raw: unknown, existingValue: string[] | undefined): string[] =>
  Array.isArray(raw) ? toStringArray(raw) : existingValue ?? [];

export interface NormalizeGuideContext {
  /**
   * When true the caller is an authorized lifecycle transition (publish /
   * archive / unpublish endpoint) and MAY set `status`. Ordinary create / save
   * MUST NOT — a missing or arbitrary `status` never publishes content.
   */
  allowStatus?: boolean;
}

export const normalizeGuideInput = (
  payload: unknown,
  existing?: CatalogGuide,
  context?: NormalizeGuideContext,
): CatalogGuide => {
  const raw = (payload ?? {}) as Record<string, unknown>;
  const title = toString(raw.title, existing?.title ?? 'Untitled Guide');
  const id = toString(raw.id, existing?.id ?? `guide-${Date.now()}`);
  const typeRaw = toString(raw.type, existing?.type ?? 'article').toLowerCase();
  const statusRaw = toString(raw.status).toLowerCase();
  const formatRaw = toString(raw.format, existing?.format ?? '');

  // Lifecycle is explicit-only. Ordinary create/save keeps the existing status
  // (new guide ⇒ 'draft'); only an authorized lifecycle transition may change it.
  const status: (typeof GUIDE_STATUSES)[number] =
    context?.allowStatus && (GUIDE_STATUSES as readonly string[]).includes(statusRaw)
      ? (statusRaw as (typeof GUIDE_STATUSES)[number])
      : existing?.status ?? 'draft';

  const brandIds = resolveGuideBrandIds(raw, existing);

  // Hero photos — ordered list, primary first. `image` stays synced to gallery[0].
  // Photos and `videoUrl` are independent (both / either / neither is valid).
  const gallery = (() => {
    const src = Array.isArray(raw.gallery)
      ? raw.gallery
      : Array.isArray(existing?.gallery)
        ? existing!.gallery
        : existing?.image
          ? [existing.image]
          : [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const v of src) {
      const u = typeof v === 'string' ? v.trim() : '';
      if (!u || seen.has(u)) continue;
      seen.add(u);
      out.push(u);
      if (out.length >= 12) break;
    }
    // An explicit `image` on the payload becomes / moves to the primary slot.
    const rawImage = typeof raw.image === 'string' ? raw.image.trim() : '';
    if (rawImage) {
      const rest = out.filter((u) => u !== rawImage);
      return [rawImage, ...rest].slice(0, 12);
    }
    return out;
  })();
  const primaryImage = gallery[0] || (typeof raw.image === 'string' ? raw.image.trim() : existing?.image ?? '');
  const mergedProductIds = mergeStrArray(raw.productIds, existing?.productIds);

  // Publisher identity. 'brand' requires a publisherBrandId; anything else is a
  // creator publisher. Route-level authorization verifies brand ownership before
  // this is trusted — `brandIds` (mentions) is never promoted to authorship here.
  const publisherTypeRaw = toString(raw.publisherType, existing?.publisherType ?? '').toLowerCase();
  const rawPublisherBrandId = toString(raw.publisherBrandId, existing?.publisherBrandId ?? '');
  const publisherType: 'creator' | 'brand' =
    publisherTypeRaw === 'brand' && rawPublisherBrandId ? 'brand' : 'creator';
  const publisherBrandId = publisherType === 'brand' ? rawPublisherBrandId : undefined;

  return {
    id,
    slug: toString(raw.slug, existing?.slug ?? slugify(title || id)),
    title,
    author: toString(raw.author, existing?.author ?? 'Choosify Editorial'),
    authorAvatar: toString(raw.authorAvatar, existing?.authorAvatar),
    category: toString(raw.category, existing?.category ?? 'General'),
    excerpt: toString(raw.excerpt, existing?.excerpt),
    image: primaryImage,
    gallery: gallery.length ? gallery : undefined,
    videoUrl: toString(raw.videoUrl, existing?.videoUrl),
    duration: toString(raw.duration, existing?.duration),
    type: (GUIDE_MEDIA_TYPES as readonly string[]).includes(typeRaw)
      ? (typeRaw as (typeof GUIDE_MEDIA_TYPES)[number])
      : 'article',
    readTime: toString(raw.readTime, existing?.readTime ?? '5 MIN READ'),
    views: toString(raw.views, existing?.views ?? '0'),
    shares: toString(raw.shares, existing?.shares),
    tags: mergeStrArray(raw.tags, existing?.tags),
    // A brand-authored guide has no creator author identity.
    creatorId:
      publisherType === 'brand' ? undefined : toString(raw.creatorId, existing?.creatorId),
    publisherType,
    publisherBrandId,
    productIds: mergedProductIds,
    brandIds,
    body: toString(raw.body, existing?.body ?? '') || undefined,
    socialLinks: normalizeGuideSocialLinks(raw.socialLinks, existing),
    externalRefs: normalizeGuideExternalRefs(raw.externalRefs, existing),
    liveOffers: normalizeGuideLiveOffers(raw.liveOffers, existing, mergedProductIds),
    verdict: toString(raw.verdict, existing?.verdict),
    whatWeLike: mergeStrArray(raw.whatWeLike, existing?.whatWeLike),
    whatToConsider: mergeStrArray(raw.whatToConsider, existing?.whatToConsider),
    seoTitle: toString(raw.seoTitle, existing?.seoTitle),
    seoDescription: toString(raw.seoDescription, existing?.seoDescription),
    seoKeywords: toString(raw.seoKeywords, existing?.seoKeywords),
    seoOgImage: toString(raw.seoOgImage, existing?.seoOgImage),
    seoCanonicalUrl: toString(raw.seoCanonicalUrl, existing?.seoCanonicalUrl),
    status,
    publishedAt: existing?.publishedAt || (status === 'live' ? nowIso() : ''),
    updatedAt: nowIso(),
    sections: normalizeGuideSections(raw.sections, existing, brandIds),
    format: (GUIDE_FORMATS as readonly string[]).includes(formatRaw)
      ? (formatRaw as (typeof GUIDE_FORMATS)[number])
      : existing?.format,
    live: toGuideLive(raw.live) ?? existing?.live,
  };
};

export const normalizePlacementInput = (payload: unknown, existing?: CatalogPlacement): CatalogPlacement => {
  const raw = (payload ?? {}) as Record<string, unknown>;
  const id = toString(raw.id, existing?.id ?? `placement-${Date.now()}`);
  const entityTypeRaw = toString(raw.entityType, existing?.entityType ?? 'product').toLowerCase();
  const sponsorTypeRaw = toString(raw.sponsorType, existing?.sponsorType ?? 'sponsored_product');
  return {
    id,
    entityType:
      entityTypeRaw === 'brand' ||
      entityTypeRaw === 'deal' ||
      entityTypeRaw === 'guide' ||
      entityTypeRaw === 'creator'
        ? entityTypeRaw
        : 'product',
    entityId: toString(raw.entityId, existing?.entityId ?? ''),
    sponsorType:
      sponsorTypeRaw === 'sponsored_brand' ||
      sponsorTypeRaw === 'spotlight_brand' ||
      sponsorTypeRaw === 'sponsored_deal' ||
      sponsorTypeRaw === 'sponsored_recommendation'
        ? sponsorTypeRaw
        : 'sponsored_product',
    placement: toString(raw.placement, existing?.placement ?? 'homepage_sponsored_ads'),
    title: toString(raw.title, existing?.title),
    image: toString(raw.image, existing?.image),
    startDate: toString(raw.startDate, existing?.startDate ?? nowIso()),
    endDate: toString(raw.endDate, existing?.endDate ?? nowIso()),
    hasCountdown: toBoolean(raw.hasCountdown, existing?.hasCountdown ?? false),
    dealPrice: raw.dealPrice !== undefined ? toNumber(raw.dealPrice) : existing?.dealPrice,
    originalPrice: raw.originalPrice !== undefined ? toNumber(raw.originalPrice) : existing?.originalPrice,
    priority: Math.floor(toNumber(raw.priority, existing?.priority ?? 0)),
    isActive: toBoolean(raw.isActive, existing?.isActive ?? true),
    createdAt: existing?.createdAt ?? nowIso(),
    updatedAt: nowIso(),
  };
};

type NormalizedVariant = NonNullable<CatalogProductDetail['productVariants']>[number];
type NormalizedAddon = NonNullable<CatalogProductDetail['addonItems']>[number];

/**
 * Normalize one product variant. Additive canonical fields (variants sprint):
 *  - `originalPrice` — per-variant MRP / strike price.
 *  - `status` — explicit 'active' | 'inactive'. Backward compatible: when the
 *    payload omits `status`, it is derived from the legacy `enabled` flag
 *    (`enabled === false` ⇒ 'inactive', otherwise 'active'). `enabled` is always
 *    written back in sync so older readers keep working.
 */
const normalizeVariant = (raw: unknown, idx: number): NormalizedVariant | null => {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;

  const options: Record<string, string> = {};
  if (r.options && typeof r.options === 'object') {
    for (const [k, v] of Object.entries(r.options as Record<string, unknown>)) {
      if (k && k.trim() && (typeof v === 'string' || typeof v === 'number')) {
        options[k.trim()] = String(v).trim();
      }
    }
  }

  const has = (v: unknown) => v !== undefined && v !== null && String(v).trim() !== '';
  const price = has(r.price) ? Math.max(0, toNumber(r.price)) : undefined;
  const originalPrice = has(r.originalPrice) ? Math.max(0, toNumber(r.originalPrice)) : undefined;
  // Canonical pricing rule: a supplied variant MRP must be >= the variant price.
  if (
    typeof originalPrice === 'number' &&
    originalPrice > 0 &&
    typeof price === 'number' &&
    originalPrice < price
  ) {
    throw new Error(
      `Variant originalPrice (${originalPrice}) cannot be lower than variant price (${price}).`,
    );
  }
  const stock = has(r.stock) ? Math.max(0, Math.floor(toNumber(r.stock))) : undefined;
  const images = toStringArray(r.images);

  const enabledRaw = typeof r.enabled === 'boolean' ? r.enabled : undefined;
  const statusRaw = toString(r.status).toLowerCase();
  const status: NonNullable<NormalizedVariant['status']> =
    statusRaw === 'inactive'
      ? 'inactive'
      : statusRaw === 'active'
        ? 'active'
        : enabledRaw === false
          ? 'inactive'
          : 'active';

  return {
    id: toString(r.id) || `var-${Date.now()}-${idx}`,
    sku: toString(r.sku),
    ...(price !== undefined ? { price } : {}),
    ...(originalPrice !== undefined ? { originalPrice } : {}),
    ...(stock !== undefined ? { stock } : {}),
    options,
    ...(images.length ? { images } : {}),
    enabled: status === 'active',
    status,
  };
};

/**
 * Normalize one add-on item (distinct from variants). Additive canonical fields
 * (add-ons sprint): `enabled` (absent ⇒ true), `sortOrder`, `badge`,
 * `maxQuantity` (≥1 when set). A row with no title is dropped.
 */
const normalizeAddon = (raw: unknown, idx: number): NormalizedAddon | null => {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const title = toString(r.title, toString(r.name)).trim();
  if (!title) return null;
  const description = toString(r.description).trim();
  const badge = toString(r.badge).trim().slice(0, 40);
  const hasMax = r.maxQuantity !== undefined && r.maxQuantity !== null && String(r.maxQuantity).trim() !== '';
  return {
    id: toString(r.id) || `addon-${Date.now()}-${idx}`,
    title,
    ...(description ? { description } : {}),
    price: Math.max(0, toNumber(r.price, 0)),
    enabled: typeof r.enabled === 'boolean' ? r.enabled : true,
    sortOrder: r.sortOrder !== undefined ? Math.floor(toNumber(r.sortOrder, idx)) : idx,
    ...(badge ? { badge } : {}),
    ...(hasMax ? { maxQuantity: Math.max(1, Math.floor(toNumber(r.maxQuantity, 1))) } : {}),
  };
};

type RelatedStore = NonNullable<CatalogProductDetail['adminPromotedStores']>[number];

/**
 * Normalize one "Where to Buy" row. `forcedSource` pins ownership so a seller
 * payload can never mint an `admin` row and admin-list writes are always
 * `admin`. Admin-only decoration (`promoLabel`, `priority`, `adRef`) is stripped
 * from `seller` rows.
 */
const normalizeStoreEntry = (
  raw: unknown,
  idx: number,
  forcedSource: 'seller' | 'admin',
): RelatedStore | null => {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const storeName = toString(r.storeName, toString(r.name)).trim();
  if (!storeName) return null;
  const has = (v: unknown) => v !== undefined && v !== null && String(v).trim() !== '';
  const entry: RelatedStore = {
    id: toString(r.id) || `${forcedSource === 'admin' ? 'ap' : 'sc'}-${Date.now()}-${idx}`,
    storeName,
    price: Math.max(0, toNumber(r.price, 0)),
    availability: toString(r.availability).trim() || 'See store',
    ...(has(r.storeRating) ? { storeRating: Math.max(0, Math.min(5, toNumber(r.storeRating))) } : {}),
    ...(has(r.storeUrl) ? { storeUrl: toString(r.storeUrl).trim() } : {}),
    ...(has(r.storeLocation) ? { storeLocation: toString(r.storeLocation).trim() } : {}),
    ...(has(r.logoUrl) ? { logoUrl: toString(r.logoUrl).trim() } : {}),
    ...(r.isFeatured === true ? { isFeatured: true } : {}),
    source: forcedSource,
  };
  if (forcedSource === 'admin') {
    if (has(r.promoLabel)) entry.promoLabel = toString(r.promoLabel).trim().slice(0, 40);
    if (has(r.priority)) entry.priority = Math.floor(toNumber(r.priority));
    if (has(r.adRef)) entry.adRef = toString(r.adRef).trim().slice(0, 40);
  }
  return entry;
};

const normalizeStoreList = (
  value: unknown,
  forcedSource: 'seller' | 'admin',
): RelatedStore[] =>
  Array.isArray(value)
    ? value
        .map((v, i) => normalizeStoreEntry(v, i, forcedSource))
        .filter((v): v is RelatedStore => v !== null)
    : [];

const GUIDE_TYPES = ['size', 'measurement', 'compatibility', 'fitment', 'feature', 'custom'] as const;

/**
 * Seller product guide (sizing / measurement / fitment / compatibility / feature).
 * Presentation metadata only. `imageUrl` is URL-safety filtered; strings clamped;
 * `guideType` constrained. Omitted from the payload ⇒ preserve `existing`. Legacy
 * table fields (`rows` / `columnHeaders` / `unitLabel` / `htmlContent`) pass
 * through so existing fashion size charts keep working.
 */
const normalizeSizeGuide = (
  raw: unknown,
  existing: CatalogProductDetail['sizeGuide'],
): CatalogProductDetail['sizeGuide'] => {
  if (!raw || typeof raw !== 'object') return existing;
  const r = raw as Record<string, unknown>;
  const guideTypeRaw = clampStr(r.guideType, 20).toLowerCase();
  const contentTypeRaw = clampStr(r.type, 10).toLowerCase();
  const imageUrl = safeHttpUrl(r.imageUrl) || undefined;
  const rows = Array.isArray(r.rows)
    ? (r.rows as Array<Record<string, unknown>>)
        .filter((row) => row && typeof row === 'object')
        .slice(0, 60)
        .map((row) => {
          const out: Record<string, string> = { size: clampStr(row.size, 40) };
          for (const [k, v] of Object.entries(row)) {
            if (k === 'size') continue;
            out[k.slice(0, 40)] = clampStr(v, 40);
          }
          return out as { size: string; [m: string]: string };
        })
    : undefined;
  const out: NonNullable<CatalogProductDetail['sizeGuide']> = {
    enabled: toBoolean(r.enabled, false),
    guideType: (GUIDE_TYPES as readonly string[]).includes(guideTypeRaw)
      ? (guideTypeRaw as NonNullable<CatalogProductDetail['sizeGuide']>['guideType'])
      : 'size',
    label: clampStr(r.label, 40) || undefined,
    type: ['table', 'image', 'html'].includes(contentTypeRaw)
      ? (contentTypeRaw as 'table' | 'image' | 'html')
      : imageUrl
        ? 'image'
        : rows && rows.length
          ? 'table'
          : undefined,
    title: clampStr(r.title, 120) || undefined,
    description: clampStr(r.description, 600) || undefined,
    imageUrl,
    htmlContent: clampStr(r.htmlContent, 8000) || undefined,
    unitLabel: clampStr(r.unitLabel, 24) || undefined,
    columnHeaders: Array.isArray(r.columnHeaders)
      ? (r.columnHeaders as unknown[]).map((h) => clampStr(h, 40)).filter(Boolean).slice(0, 12)
      : undefined,
    rows: rows && rows.length ? rows : undefined,
  };
  return out;
};

/** Order-independent identity for a variant's option combination — mirrors
 *  the admin Studio's own variantKey() so "the same combination" means the
 *  same thing on both sides. */
const variantCombinationKey = (options: Record<string, string> | undefined): string =>
  Object.keys(options || {})
    .sort()
    .map((k) => `${k}=${(options as Record<string, string>)[k]}`)
    .join('|');

/**
 * Rejects two variants that resolve to the exact same option combination —
 * the server-side backstop for the Studio's own client-side duplicate check.
 * Two rows sharing a combination would make storefront variant resolution
 * ambiguous (only the first is ever reachable), which is exactly the silent
 * merge this canonical model must never allow.
 */
const assertNoDuplicateVariantCombinations = (variants: NormalizedVariant[]): void => {
  const seen = new Map<string, string>();
  for (const v of variants) {
    const key = variantCombinationKey(v.options);
    if (!key) continue; // a row with no options set at all has nothing to collide on
    const priorId = seen.get(key);
    if (priorId && priorId !== v.id) {
      throw new Error(
        `Duplicate variant combination: "${v.id}" and "${priorId}" both resolve to the same option values.`,
      );
    }
    seen.set(key, v.id);
  }
};

export const normalizeProductDetailInput = (
  payload: unknown,
  productId: string,
  existing?: CatalogProductDetail,
): CatalogProductDetail => {
  const raw = (payload ?? {}) as Record<string, unknown>;
  const relatedInfoTypeRaw = toString(raw.relatedInfoType, existing?.relatedInfoType);
  const productVariants = Array.isArray(raw.productVariants)
    ? raw.productVariants.map((v, i) => normalizeVariant(v, i)).filter((v): v is NormalizedVariant => v !== null)
    : (existing?.productVariants ?? []);
  assertNoDuplicateVariantCombinations(productVariants);
  return {
    productId,
    relatedInfoType:
      relatedInfoTypeRaw === 'price_across_stores' ||
      relatedInfoTypeRaw === 'whats_nearby' ||
      relatedInfoTypeRaw === 'before_your_visit' ||
      relatedInfoTypeRaw === 'custom'
        ? relatedInfoTypeRaw
        : existing?.relatedInfoType,
    customRelatedInfo: (() => {
      const c = raw.customRelatedInfo;
      if (c && typeof c === 'object' && !Array.isArray(c)) {
        const cc = c as Record<string, unknown>;
        const title = toString(cc.title).trim().slice(0, 120);
        const blocks = Array.isArray(cc.blocks)
          ? cc.blocks
              .filter((b): b is Record<string, unknown> => !!b && typeof b === 'object')
              .map((b, i) => ({
                id: toString(b.id) || `crb-${i}`,
                heading: toString(b.heading).trim().slice(0, 80),
                items: Array.isArray(b.items)
                  ? b.items.map((x) => String(x).trim()).filter(Boolean).slice(0, 20)
                  : [],
              }))
              .filter((b) => b.heading || b.items.length)
              .slice(0, 8)
          : [];
        return title || blocks.length ? { ...(title ? { title } : {}), blocks } : undefined;
      }
      return existing?.customRelatedInfo;
    })(),
    priceAcrossStoresEnabled:
      raw.priceAcrossStoresEnabled !== undefined
        ? toBoolean(raw.priceAcrossStoresEnabled)
        : existing?.priceAcrossStoresEnabled,
    whatsNearby:
      raw.whatsNearby && typeof raw.whatsNearby === 'object'
        ? (raw.whatsNearby as CatalogProductDetail['whatsNearby'])
        : existing?.whatsNearby,
    beforeYourVisit: (() => {
      const bv = raw.beforeYourVisit;
      if (!bv || typeof bv !== 'object' || Array.isArray(bv)) return existing?.beforeYourVisit;
      const b = bv as Record<string, unknown>;
      const out: NonNullable<CatalogProductDetail['beforeYourVisit']> = {
        parkingAvailability: toString(b.parkingAvailability) || undefined,
        cancellationPolicy: toString(b.cancellationPolicy) || undefined,
        whatToBring: toString(b.whatToBring) || undefined,
        wheelchairAccess: toString(b.wheelchairAccess) || undefined,
        insuranceAccepted: toString(b.insuranceAccepted) || undefined,
      };
      if (Array.isArray(b.customFields)) {
        const cf = b.customFields
          .filter((f): f is Record<string, unknown> => !!f && typeof f === 'object')
          .map((f, i) => ({
            id: toString(f.id) || `bvc-${i}`,
            label: toString(f.label).trim().slice(0, 60),
            value: toString(f.value).trim().slice(0, 400),
          }))
          .filter((f) => f.label || f.value)
          .slice(0, 12);
        if (cf.length) out.customFields = cf;
      }
      return out;
    })(),
    about: toString(raw.about, existing?.about),
    specs: Array.isArray(raw.specs) ? (raw.specs as CatalogProductDetail['specs']) : existing?.specs ?? [],
    pros: toStringArray(raw.pros).length ? toStringArray(raw.pros) : existing?.pros ?? [],
    cons: toStringArray(raw.cons).length ? toStringArray(raw.cons) : existing?.cons ?? [],
    bestForTags: toStringArray(raw.bestForTags).length ? toStringArray(raw.bestForTags) : existing?.bestForTags ?? [],
    // Seller-owned rows — every entry is pinned `source: 'seller'` so a payload
    // can never smuggle in an admin/sponsored row here.
    storeComparisonList: Array.isArray(raw.storeComparisonList)
      ? normalizeStoreList(raw.storeComparisonList, 'seller')
      : existing?.storeComparisonList ?? [],
    // Admin-owned promoted rows — independent list, always `source: 'admin'`.
    adminPromotedStores: Array.isArray(raw.adminPromotedStores)
      ? normalizeStoreList(raw.adminPromotedStores, 'admin')
      : existing?.adminPromotedStores,
    relatedInfoLockedByAdmin:
      raw.relatedInfoLockedByAdmin !== undefined
        ? toBoolean(raw.relatedInfoLockedByAdmin)
        : existing?.relatedInfoLockedByAdmin,
    physicalStores: Array.isArray(raw.physicalStores)
      ? (raw.physicalStores as CatalogProductDetail['physicalStores'])
      : existing?.physicalStores ?? [],
    overviewBlocks: Array.isArray(raw.overviewBlocks)
      ? (raw.overviewBlocks as CatalogProductDetail['overviewBlocks'])
      : existing?.overviewBlocks ?? [],
    optionGroups: Array.isArray(raw.optionGroups)
      ? (raw.optionGroups as CatalogProductDetail['optionGroups'])
      : existing?.optionGroups ?? [],
    productVariants,
    creatorContent: Array.isArray(raw.creatorContent)
      ? (raw.creatorContent as CatalogProductDetail['creatorContent'])
      : existing?.creatorContent ?? [],
    seoTitle: toString(raw.seoTitle, existing?.seoTitle),
    seoDescription: toString(raw.seoDescription, existing?.seoDescription),
    seoKeywords: toString(raw.seoKeywords, existing?.seoKeywords),
    sizeGuide: normalizeSizeGuide(raw.sizeGuide, existing?.sizeGuide),
    updatedAt: nowIso(),
    enableSpecs: raw.enableSpecs !== undefined ? toBoolean(raw.enableSpecs) : existing?.enableSpecs,
    enableStoreComparison:
      raw.enableStoreComparison !== undefined ? toBoolean(raw.enableStoreComparison) : existing?.enableStoreComparison,
    enableInfluencerReviews:
      raw.enableInfluencerReviews !== undefined ? toBoolean(raw.enableInfluencerReviews) : existing?.enableInfluencerReviews,
    enableOverviewSection:
      raw.enableOverviewSection !== undefined ? toBoolean(raw.enableOverviewSection) : existing?.enableOverviewSection,
    enableBestForTags:
      raw.enableBestForTags !== undefined ? toBoolean(raw.enableBestForTags) : existing?.enableBestForTags,
    enablePhysicalStores:
      raw.enablePhysicalStores !== undefined ? toBoolean(raw.enablePhysicalStores) : existing?.enablePhysicalStores,
    enableBoxContents:
      raw.enableBoxContents !== undefined ? toBoolean(raw.enableBoxContents) : existing?.enableBoxContents,
    enableOptions: raw.enableOptions !== undefined ? toBoolean(raw.enableOptions) : existing?.enableOptions,
    enableActiveVariantSpecs:
      raw.enableActiveVariantSpecs !== undefined ? toBoolean(raw.enableActiveVariantSpecs) : existing?.enableActiveVariantSpecs,
    enableAdditionalSpecs:
      raw.enableAdditionalSpecs !== undefined ? toBoolean(raw.enableAdditionalSpecs) : existing?.enableAdditionalSpecs,
    enablePublicReviews:
      raw.enablePublicReviews !== undefined ? toBoolean(raw.enablePublicReviews) : existing?.enablePublicReviews,
    enableAddonItems:
      raw.enableAddonItems !== undefined ? toBoolean(raw.enableAddonItems) : existing?.enableAddonItems,
    enableDeliveryInfo:
      raw.enableDeliveryInfo !== undefined ? toBoolean(raw.enableDeliveryInfo) : existing?.enableDeliveryInfo,
    enableWarrantyInfo:
      raw.enableWarrantyInfo !== undefined ? toBoolean(raw.enableWarrantyInfo) : existing?.enableWarrantyInfo,
    deliveryInfo: (() => {
      const di = raw.deliveryInfo;
      if (di && typeof di === 'object' && !Array.isArray(di)) {
        const d = di as Record<string, unknown>;
        const region = toString(d.region).trim();
        const bullets = Array.isArray(d.bullets)
          ? d.bullets.map((b) => String(b).trim()).filter(Boolean).slice(0, 12)
          : [];
        return region || bullets.length ? { ...(region ? { region } : {}), bullets } : undefined;
      }
      return existing?.deliveryInfo;
    })(),
    afterSalesInfo: (() => {
      const ai = raw.afterSalesInfo;
      if (ai && typeof ai === 'object' && !Array.isArray(ai)) {
        const a = ai as Record<string, unknown>;
        const bullets = Array.isArray(a.bullets)
          ? a.bullets.map((b) => String(b).trim()).filter(Boolean).slice(0, 12)
          : [];
        return bullets.length ? { bullets } : undefined;
      }
      return existing?.afterSalesInfo;
    })(),
    boxContents: Array.isArray(raw.boxContents)
      ? (raw.boxContents as CatalogProductDetail['boxContents'])
      : existing?.boxContents ?? [],
    additionalSpecs: Array.isArray(raw.additionalSpecs)
      ? (raw.additionalSpecs as CatalogProductDetail['additionalSpecs'])
      : existing?.additionalSpecs ?? [],
    publicReviews: Array.isArray(raw.publicReviews)
      ? (raw.publicReviews as CatalogProductDetail['publicReviews'])
      : existing?.publicReviews ?? [],
    addonItems: Array.isArray(raw.addonItems)
      ? raw.addonItems
          .map((a, i) => normalizeAddon(a, i))
          .filter((a): a is NormalizedAddon => a !== null)
          .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      : existing?.addonItems ?? [],
  };
};

export const normalizeSeoEntryInput = (payload: unknown, idx: number): SiteSeoEntry => {
  const raw = (payload ?? {}) as Record<string, unknown>;
  return {
    pageId: toString(raw.pageId, `page-${idx + 1}`),
    pageLabel: toString(raw.pageLabel, 'Page'),
    title: toString(raw.title),
    metaDescription: toString(raw.metaDescription),
    keywords: toString(raw.keywords),
    ogImage: toString(raw.ogImage),
    canonicalUrl: toString(raw.canonicalUrl),
  };
};
