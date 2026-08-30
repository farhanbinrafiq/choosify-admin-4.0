/**
 * Guide Studio editor model — pure mappers, no React.
 *
 * A Guide is a flexible editorial composition. Only identity, publisher and media
 * are structural; every editorial section is optional and author-controlled via
 * `sectionLayout` (order + enabled). Format only seeds an initial layout at
 * CREATE — it never permanently dictates which sections exist.
 *
 * Canonical `CatalogGuide.sections[]` ({id, enabled, order, data}) is the source
 * of truth for section presence/order/toggle — no schema replacement.
 *
 * Publisher identity, lifecycle, contentReferenceId, engagement and SEO metadata
 * are platform-authoritative / auto-derived — read for display, never emitted by
 * the editorial patch (SEO is auto-generated server-side from title/excerpt/media).
 */
import type {
  CatalogGuide,
  GuideEntityRef,
  GuideExternalRef,
  GuideLiveOffer,
  GuideSocialLink,
} from '../../types/catalog';

/** Structural sections — always present, cannot be removed. */
export type GuideCoreSection = 'media' | 'identity';
/** Optional editorial sections — author enables/reorders/removes freely. */
export type GuideOptionalSection =
  | 'description'
  | 'products'
  | 'brandMentions'
  | 'externalRefs'
  | 'picks'
  | 'winner'
  | 'whyWon'
  | 'verdict'
  | 'takeaways'
  | 'methodology'
  | 'liveOffers'
  | 'socialLinks';
export type GuideStudioSection = GuideCoreSection | GuideOptionalSection;

export type GuideMediaType = CatalogGuide['type'];
export type GuideFormat = NonNullable<CatalogGuide['format']>;

/** Canonical section-id (in `CatalogGuide.sections[]`) for each optional Studio section. */
export const OPTIONAL_SECTION_CANONICAL_ID: Record<GuideOptionalSection, string> = {
  description: 'description',
  products: 'items_mentioned',
  brandMentions: 'brands_mentioned',
  externalRefs: 'external_refs',
  picks: 'recommendations',
  winner: 'winner',
  whyWon: 'why_it_won',
  verdict: 'verdict',
  takeaways: 'takeaways',
  methodology: 'how_review_was_made',
  liveOffers: 'live_offers',
  socialLinks: 'social_links',
};
const CANONICAL_TO_OPTIONAL: Record<string, GuideOptionalSection> = Object.fromEntries(
  Object.entries(OPTIONAL_SECTION_CANONICAL_ID).map(([k, v]) => [v, k as GuideOptionalSection]),
) as Record<string, GuideOptionalSection>;

export const OPTIONAL_SECTIONS: GuideOptionalSection[] = [
  'description',
  'products',
  'brandMentions',
  'externalRefs',
  'picks',
  'winner',
  'whyWon',
  'verdict',
  'takeaways',
  'methodology',
  'liveOffers',
  'socialLinks',
];

export const GUIDE_SECTION_TITLE: Record<GuideStudioSection, string> = {
  media: 'Media',
  identity: 'Guide Identity',
  description: 'Description / Introduction',
  products: 'Products Mentioned',
  brandMentions: 'Brands Mentioned',
  externalRefs: 'Off-Platform References',
  picks: 'Recommendations / Picks',
  winner: 'Overall Winner',
  whyWon: 'Why This Won',
  verdict: 'Recommendation & Verdict',
  takeaways: 'Key Takeaways',
  methodology: 'How This Review Was Made',
  liveOffers: 'Live Offers',
  socialLinks: 'Continue Watching / Social Links',
};

export const GUIDE_SECTION_BLURB: Record<GuideOptionalSection, string> = {
  description: 'A short intro or event description in plain text.',
  products: 'Real Choosify products (and off-platform items) this guide discusses.',
  brandMentions: 'Brands this guide talks about — not the publisher.',
  externalRefs: 'Manually-described products / brands that are not on Choosify.',
  picks: 'Creator-labelled picks (Best Value, Editor’s Pick…) — no ranking implied.',
  winner: 'One overall winner. Only add this when a guide genuinely has one.',
  whyWon: 'Short reasons the winner came out on top.',
  verdict: 'Best For / Not For / Pros / Cons.',
  takeaways: 'The bottom-line takeaway.',
  methodology: 'How the review / test was done.',
  liveOffers: 'Time-boxed promotional pricing on tagged products (brand-authored only).',
  socialLinks: 'Continue-on-platform links for this guide (YouTube, TikTok…).',
};

export type SectionLayoutEntry = { id: GuideOptionalSection; enabled: boolean };

export type GuidePick = { id: string; label: string; ref: GuideEntityRef };
export type GuideAward = { id: string; label: string; ref: GuideEntityRef };

export interface GuideStudioModel {
  id: string;
  slug: string;
  status: 'draft' | 'live' | 'archived';
  contentReferenceId?: string;
  updatedAt: string;
  publishedAt: string;

  publisherType: 'creator' | 'brand';
  creatorId: string;
  publisherBrandId: string;

  title: string;
  excerpt: string;
  category: string;
  tags: string[];
  type: GuideMediaType;
  format: GuideFormat;
  readTime: string;

  photos: string[];
  videoUrl: string;
  liveEmbedUrl: string;
  livePlatform: string;
  liveStatus: string;
  liveScheduledAt: string;

  body: string;

  // Which optional sections are present, in order, and whether each is enabled.
  sectionLayout: SectionLayoutEntry[];

  // Section payloads
  productIds: string[];
  topPickIds: string[];
  /** Up to 4 "why it's good for…" chips per product id. */
  productHighlights: Record<string, string[]>;
  brandIds: string[]; // brands MENTIONED (never authorship)
  /** Up to 4 "why it's good for…" chips per brand id. */
  brandHighlights: Record<string, string[]>;
  externalRefs: GuideExternalRef[];
  picks: GuidePick[];
  winnerOverall?: GuideEntityRef;
  awards: GuideAward[];
  whyWonChips: string[];
  bestFor: string[];
  notFor: string[];
  pros: string[];
  cons: string[];
  takeawayTitle: string;
  takeawayBody: string;
  reviewMethodSteps: string[];
  liveOffers: GuideLiveOffer[];
  socialLinks: GuideSocialLink[];

  // Auto-derived — kept for backend compatibility, NOT a visible Studio section.
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
  seoOgImage: string;
  seoCanonicalUrl: string;

  views: string; // preview only
}

const s = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const arr = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => (typeof x === 'string' ? x.trim() : String(x))).filter(Boolean) : [];

/** `{ entityId: string[] }` highlight-chip map; ≤4 chips each, `#` prefix stripped. */
const highlightMap = (v: unknown): Record<string, string[]> => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
  const out: Record<string, string[]> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    const tags = arr(val).map((t) => t.replace(/^#+/, '').trim().slice(0, 24)).filter(Boolean).slice(0, 4);
    if (k && tags.length) out[k] = tags;
  }
  return out;
};

function sectionData(guide: CatalogGuide, id: string): Record<string, unknown> {
  const sec = (guide.sections || []).find((x) => x.id === id);
  return sec?.data && typeof sec.data === 'object' ? (sec.data as Record<string, unknown>) : {};
}

export const GUIDE_FORMATS: GuideFormat[] = [
  'buying_guide',
  'product_review',
  'comparison',
  'live',
  'tutorial',
  'tips',
];
export const GUIDE_MEDIA_TYPES: GuideMediaType[] = ['article', 'video', 'reels', 'shorts'];

export const GUIDE_FORMAT_LABEL: Record<GuideFormat, string> = {
  buying_guide: 'Buying Guide',
  product_review: 'Product Review',
  comparison: 'Comparison',
  live: 'Live / Ask & Shop',
  tutorial: 'Tutorial',
  tips: 'Tips',
};

/** INITIAL recommended optional sections when a guide is first created. A preset,
 *  not a lock — the author edits the layout freely afterwards. */
export function defaultSectionLayoutForFormat(format: GuideFormat): SectionLayoutEntry[] {
  const on = (ids: GuideOptionalSection[]): SectionLayoutEntry[] =>
    ids.map((id) => ({ id, enabled: true }));
  switch (format) {
    case 'buying_guide':
    case 'comparison':
      return on(['description', 'products', 'brandMentions', 'picks', 'verdict', 'takeaways', 'methodology']);
    case 'product_review':
      return on(['description', 'products', 'brandMentions', 'verdict', 'takeaways', 'methodology']);
    case 'live':
      return on(['description', 'products', 'brandMentions', 'liveOffers', 'socialLinks']);
    case 'tutorial':
    case 'tips':
      return on(['description', 'products', 'brandMentions', 'takeaways']);
    default:
      return on(['description', 'products', 'brandMentions']);
  }
}

export function createBlankGuideStudioModel(): GuideStudioModel {
  return {
    id: 'new',
    slug: '',
    status: 'draft',
    updatedAt: '',
    publishedAt: '',
    publisherType: 'creator',
    creatorId: '',
    publisherBrandId: '',
    title: '',
    excerpt: '',
    category: '',
    tags: [],
    type: 'article',
    format: 'buying_guide',
    readTime: '5 MIN READ',
    photos: [],
    videoUrl: '',
    liveEmbedUrl: '',
    livePlatform: '',
    liveStatus: '',
    liveScheduledAt: '',
    body: '',
    sectionLayout: defaultSectionLayoutForFormat('buying_guide'),
    productIds: [],
    topPickIds: [],
    productHighlights: {},
    brandIds: [],
    brandHighlights: {},
    externalRefs: [],
    picks: [],
    winnerOverall: undefined,
    awards: [],
    whyWonChips: [],
    bestFor: [],
    notFor: [],
    pros: [],
    cons: [],
    takeawayTitle: '',
    takeawayBody: '',
    reviewMethodSteps: [],
    liveOffers: [],
    socialLinks: [],
    seoTitle: '',
    seoDescription: '',
    seoKeywords: '',
    seoOgImage: '',
    seoCanonicalUrl: '',
    views: '0',
  };
}

function toRef(v: unknown): GuideEntityRef | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const r = v as Record<string, unknown>;
  const et = s(r.entityType);
  const eid = s(r.entityId);
  if (!['product', 'brand', 'external_product', 'external_brand'].includes(et) || !eid) return undefined;
  return { entityType: et as GuideEntityRef['entityType'], entityId: eid };
}

export function mapCatalogGuideToStudioModel(guide: CatalogGuide): GuideStudioModel {
  const verdict = sectionData(guide, 'verdict');
  const takeaways = sectionData(guide, 'takeaways');
  const winner = sectionData(guide, 'winner');
  const items = sectionData(guide, 'items_mentioned');
  const why = sectionData(guide, 'why_it_won');
  const method = sectionData(guide, 'how_review_was_made');
  const picksData = sectionData(guide, 'recommendations');
  const brandsMentioned =
    Array.isArray(guide.brandIds) && guide.brandIds.length
      ? guide.brandIds.map(String)
      : arr(sectionData(guide, 'brands_mentioned').brandIds);

  const format = guide.format && GUIDE_FORMATS.includes(guide.format) ? guide.format : 'buying_guide';

  // sectionLayout from stored sections[] (order + enabled). If none stored → format preset.
  const storedOptional = (guide.sections || [])
    .map((sec) => ({ sec, opt: CANONICAL_TO_OPTIONAL[sec.id] }))
    .filter((x): x is { sec: NonNullable<CatalogGuide['sections']>[number]; opt: GuideOptionalSection } => !!x.opt)
    .sort((a, b) => (a.sec.order ?? 0) - (b.sec.order ?? 0));
  const sectionLayout: SectionLayoutEntry[] = storedOptional.length
    ? Array.from(new Map(storedOptional.map((x) => [x.opt, { id: x.opt, enabled: x.sec.enabled !== false }])).values())
    : defaultSectionLayoutForFormat(format);

  // legacy winner ids → overall product ref
  let winnerOverall = toRef(winner.overall);
  if (!winnerOverall && Array.isArray(winner.winnerIds) && winner.winnerIds.length) {
    const legacy = s(winner.winnerIds[0]);
    if (legacy) winnerOverall = { entityType: 'product', entityId: legacy };
  }

  return {
    ...createBlankGuideStudioModel(),
    id: guide.id,
    slug: guide.slug || '',
    status: guide.status === 'live' ? 'live' : guide.status === 'archived' ? 'archived' : 'draft',
    contentReferenceId: guide.contentReferenceId,
    updatedAt: guide.updatedAt || '',
    publishedAt: guide.publishedAt || '',
    publisherType: guide.publisherType === 'brand' ? 'brand' : 'creator',
    creatorId: guide.creatorId || '',
    publisherBrandId: guide.publisherBrandId || '',
    title: guide.title || '',
    excerpt: guide.excerpt || '',
    category: guide.category || '',
    tags: Array.isArray(guide.tags) ? guide.tags.map(String) : [],
    type: GUIDE_MEDIA_TYPES.includes(guide.type) ? guide.type : 'article',
    format,
    readTime: guide.readTime || '5 MIN READ',
    photos:
      Array.isArray(guide.gallery) && guide.gallery.length
        ? guide.gallery.map(String).filter(Boolean)
        : guide.image
          ? [guide.image]
          : [],
    videoUrl: guide.videoUrl || '',
    liveEmbedUrl: guide.live?.embedUrl || '',
    livePlatform: guide.live?.platform || '',
    liveStatus: guide.live?.status || '',
    liveScheduledAt: guide.live?.scheduledAt || '',
    body: guide.body || '',
    sectionLayout,
    productIds: Array.isArray(guide.productIds) ? guide.productIds.map(String) : arr(items.itemIds),
    topPickIds: arr(items.topPickIds),
    productHighlights: highlightMap(items.highlightTags),
    brandIds: brandsMentioned,
    brandHighlights: highlightMap(
      sectionData(guide, 'brands_mentioned').highlightTags,
    ),
    externalRefs: Array.isArray(guide.externalRefs) ? guide.externalRefs : [],
    picks: Array.isArray(picksData.picks)
      ? (picksData.picks as unknown[])
          .map((p, i) => {
            const r = (p ?? {}) as Record<string, unknown>;
            const ref = toRef(r.ref);
            return ref ? { id: s(r.id) || `pick-${i}`, label: s(r.label), ref } : null;
          })
          .filter((p): p is GuidePick => !!p && !!p.label)
      : [],
    winnerOverall,
    awards: Array.isArray(winner.awards)
      ? (winner.awards as unknown[])
          .map((a, i) => {
            const r = (a ?? {}) as Record<string, unknown>;
            const ref = toRef(r.ref);
            return ref ? { id: s(r.id) || `award-${i}`, label: s(r.label), ref } : null;
          })
          .filter((a): a is GuideAward => !!a && !!a.label)
      : [],
    whyWonChips: arr(why.whyWonChips),
    bestFor: arr(verdict.bestFor),
    notFor: arr(verdict.notFor),
    pros: arr(verdict.whatWeLike).length ? arr(verdict.whatWeLike) : arr(guide.whatWeLike),
    cons: arr(verdict.whatToConsider).length ? arr(verdict.whatToConsider) : arr(guide.whatToConsider),
    takeawayTitle: s(takeaways.takeawayTitle),
    takeawayBody: s(takeaways.takeawayBody),
    reviewMethodSteps: arr(method.reviewMethodSteps),
    liveOffers: Array.isArray(guide.liveOffers) ? guide.liveOffers : [],
    socialLinks: Array.isArray(guide.socialLinks) ? guide.socialLinks : [],
    seoTitle: guide.seoTitle || '',
    seoDescription: guide.seoDescription || '',
    seoKeywords: guide.seoKeywords || '',
    seoOgImage: guide.seoOgImage || '',
    seoCanonicalUrl: guide.seoCanonicalUrl || '',
    views: guide.views || '0',
  };
}

/** Data payload for one optional section id (canonical `sections[].data`). */
function payloadFor(id: GuideOptionalSection, m: GuideStudioModel): Record<string, unknown> {
  switch (id) {
    case 'products': {
      const highlightTags: Record<string, string[]> = {};
      for (const pid of m.productIds) if (m.productHighlights[pid]?.length) highlightTags[pid] = m.productHighlights[pid].slice(0, 4);
      return { itemIds: m.productIds, topPickIds: m.topPickIds, highlightTags };
    }
    case 'brandMentions': {
      const highlightTags: Record<string, string[]> = {};
      for (const bid of m.brandIds) if (m.brandHighlights[bid]?.length) highlightTags[bid] = m.brandHighlights[bid].slice(0, 4);
      return { brandIds: m.brandIds, highlightTags };
    }
    case 'externalRefs':
      return {}; // authoritative list is top-level externalRefs[]
    case 'picks':
      return { picks: m.picks.map((p) => ({ id: p.id, label: s(p.label).slice(0, 60), ref: p.ref })) };
    case 'winner':
      return {
        ...(m.winnerOverall ? { overall: m.winnerOverall } : {}),
        ...(m.awards.length
          ? { awards: m.awards.map((a) => ({ id: a.id, label: s(a.label).slice(0, 60), ref: a.ref })) }
          : {}),
      };
    case 'whyWon':
      return { whyWonChips: m.whyWonChips };
    case 'verdict':
      return { bestFor: m.bestFor, notFor: m.notFor, whatWeLike: m.pros, whatToConsider: m.cons };
    case 'takeaways':
      return { takeawayTitle: s(m.takeawayTitle), takeawayBody: s(m.takeawayBody) };
    case 'methodology':
      return { reviewMethodSteps: m.reviewMethodSteps };
    case 'liveOffers':
      return {}; // authoritative list is top-level liveOffers[]
    case 'socialLinks':
      return {}; // authoritative list is top-level socialLinks[]
    case 'description':
      return {}; // body is top-level
    default:
      return {};
  }
}

/** Auto-generated SEO/social metadata from canonical guide info (no manual section). */
function deriveSeo(m: GuideStudioModel): {
  seoTitle: string;
  seoDescription: string;
  seoOgImage: string;
} {
  return {
    seoTitle: (s(m.seoTitle) || s(m.title)).slice(0, 160),
    seoDescription: (s(m.seoDescription) || s(m.excerpt)).slice(0, 320),
    seoOgImage: s(m.seoOgImage) || m.photos.find(Boolean) || '',
  };
}

/**
 * The ONE canonical write path for a Guide Studio save. Section presence + order
 * + enabled come straight from `sectionLayout`; nothing is inferred from format.
 */
export function guideStudioModelToPatch(m: GuideStudioModel): Partial<CatalogGuide> {
  const sections: NonNullable<CatalogGuide['sections']> = m.sectionLayout.map((entry, i) => ({
    id: OPTIONAL_SECTION_CANONICAL_ID[entry.id],
    enabled: entry.enabled,
    order: i,
    data: payloadFor(entry.id, m),
  }));

  const seo = deriveSeo(m);

  const patch: Partial<CatalogGuide> = {
    title: s(m.title),
    excerpt: s(m.excerpt),
    category: s(m.category),
    tags: m.tags.map(s).filter(Boolean),
    type: m.type,
    format: m.format,
    readTime: s(m.readTime),
    image: m.photos.map(s).filter(Boolean)[0] || '',
    gallery: m.photos.map(s).filter(Boolean),
    videoUrl: s(m.videoUrl),
    body: s(m.body) || undefined,
    brandIds: m.brandIds.map(s).filter(Boolean),
    productIds: m.productIds.map(s).filter(Boolean),
    externalRefs: m.externalRefs,
    socialLinks: m.socialLinks,
    liveOffers: m.liveOffers,
    // storefront fallback readers still use these top-level fields
    whatWeLike: m.pros.map(s).filter(Boolean),
    whatToConsider: m.cons.map(s).filter(Boolean),
    // auto-derived SEO — no visible Studio section
    seoTitle: seo.seoTitle,
    seoDescription: seo.seoDescription,
    seoOgImage: seo.seoOgImage,
    seoKeywords: s(m.seoKeywords),
    seoCanonicalUrl: s(m.seoCanonicalUrl),
    sections,
  };

  if (m.format === 'live') {
    patch.live = {
      platform: (s(m.livePlatform) || 'youtube') as NonNullable<CatalogGuide['live']>['platform'],
      status: (s(m.liveStatus) || 'replay') as NonNullable<CatalogGuide['live']>['status'],
      ...(s(m.liveEmbedUrl) ? { embedUrl: s(m.liveEmbedUrl) } : {}),
      ...(s(m.liveScheduledAt) ? { scheduledAt: s(m.liveScheduledAt) } : {}),
    };
  }

  return patch;
}
