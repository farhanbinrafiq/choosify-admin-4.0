/**
 * Canonical Ads placement registry — the ONE list of ad slots, shared by the Ads API, the public
 * delivery endpoint and the Ads Visual Builder. Every ACTIVE slot is a real storefront component
 * (verified against Choosify-Web 2026-11-04); slots with no storefront component are retired
 * (active: false + retiredReason) and can no longer be chosen. The storefront refers to slots by
 * placementId only (Web src/lib/ads/adSlots.ts).
 *
 * `creative` says exactly what to upload and how the storefront shows it:
 *  - display 'natural': the image is shown whole, full width, at its own proportions (designed
 *    banners with text/logos baked in are never cropped); ratioRange bounds those proportions.
 *  - display 'cover': the image fills a fixed frame and is cropped to it; keep the subject in the
 *    middle. ratioRange bounds how far the upload may differ from the frame.
 */

export type AdFormatId =
  | 'hero_banner'
  | 'vertical_card'
  | 'gradient_promo'
  | 'deal_of_the_day'
  | 'follow_brands_banner'
  | 'category_promoted_slot'
  /** Sponsored Listing: promotes an EXISTING product / brand / deal / guide / creator; the card
   *  is drawn from that record (its own photo, name, price) with a Sponsored label. */
  | 'sponsored_listing';

export type AdPageKey =
  | 'homepage'
  | 'categories'
  | 'browse'
  | 'brands'
  | 'discover'
  | 'creators'
  | 'deals'
  | 'product_detail'
  | 'guide_detail'
  | 'guides'
  | 'search'
  | 'compare';

export type AdOrientation = 'horizontal' | 'vertical' | 'square' | 'embedded';

export type AdCreativeSpec = {
  display: 'natural' | 'cover';
  /** Recommended upload size in pixels. */
  recommended: { width: number; height: number };
  /** Smallest acceptable upload. */
  min: { width: number; height: number };
  /** Allowed width÷height range of the upload. */
  ratioRange: [number, number];
  /** Plain-language description of how it appears. */
  howShown: string;
};

export type AdPlacementDef = {
  placementId: string;
  pageKey: AdPageKey;
  pageLabel: string;
  slotKey: string;
  slotLabel: string;
  /** Where on the page the slot is (plain language). */
  sectionLabel: string;
  allowedFormats: AdFormatId[];
  orientation: AdOrientation;
  aspectRatio: string;
  embeddedMode?: boolean;
  mobileSupport: boolean;
  desktopSupport: boolean;
  /** Who may request this placement */
  ownerRoles: Array<'admin' | 'seller' | 'creator'>;
  active: boolean;
  /** Why an inactive slot was retired (shown to staff on ads still assigned to it). */
  retiredReason?: string;
  /** Image requirements (absent for text-only / listing-bound formats). */
  creative?: AdCreativeSpec;
  /** Sponsored Listing slots: which catalog records may be promoted here. */
  entityTypes?: SponsoredEntityType[];
  /** Density / frequency rule enforced by the storefront component (plain language). */
  frequency?: string;
  /** What shoppers see when nothing is booked. */
  fallback?: string;
};

export type SponsoredEntityType = 'product' | 'brand' | 'deal' | 'guide' | 'creator';

export type AdFormatDef = {
  formatId: AdFormatId;
  label: string;
  description: string;
  /** Formats whose look is the uploaded image (needs an image). */
  imageLed: boolean;
  fields: Array<
    | 'advertiser'
    | 'headline'
    | 'subtext'
    | 'ctaLabel'
    | 'image'
    | 'logo'
    | 'listing'
    | 'internalDest'
    | 'externalUrl'
    | 'hostCategory'
  >;
};

export const AD_FORMATS: AdFormatDef[] = [
  {
    formatId: 'hero_banner',
    label: 'Hero / Wide Banner',
    description: 'Wide horizontal image banner. The uploaded design is the ad.',
    imageLed: true,
    fields: ['advertiser', 'headline', 'subtext', 'ctaLabel', 'image', 'logo', 'listing', 'internalDest', 'externalUrl'],
  },
  {
    formatId: 'vertical_card',
    label: 'Vertical Card',
    description: 'Tall card (image + headline + button) for side rails and feeds.',
    imageLed: true,
    fields: ['advertiser', 'headline', 'subtext', 'ctaLabel', 'image', 'listing', 'internalDest', 'externalUrl'],
  },
  {
    formatId: 'gradient_promo',
    label: 'Gradient Promo',
    description: 'Text card on a brand gradient with a logo — no photo needed.',
    imageLed: false,
    fields: ['advertiser', 'headline', 'subtext', 'ctaLabel', 'logo', 'listing', 'internalDest', 'externalUrl'],
  },
  {
    formatId: 'deal_of_the_day',
    label: 'Deal of the Day',
    description: 'Featured deal unit bound to a real Product/Deal listing.',
    imageLed: true,
    fields: ['advertiser', 'headline', 'subtext', 'ctaLabel', 'image', 'listing', 'internalDest'],
  },
  {
    formatId: 'follow_brands_banner',
    label: 'Wide Promo Banner',
    description: 'Wide banner image (designed artwork, shown uncropped) with a link.',
    imageLed: true,
    fields: ['headline', 'subtext', 'ctaLabel', 'image', 'internalDest', 'externalUrl'],
  },
  {
    formatId: 'category_promoted_slot',
    label: 'Category Promoted Slot',
    description: 'Embedded PROMOTED footer on an organic category card.',
    imageLed: false,
    fields: ['advertiser', 'logo', 'listing', 'internalDest', 'externalUrl', 'hostCategory'],
  },
];

/** Wide designed banner in a FIXED frame (4:1 desktop, 5:2 phone); the design is fitted whole. */
const WIDE_BANNER: AdCreativeSpec = {
  display: 'natural',
  recommended: { width: 2000, height: 500 },
  min: { width: 1200, height: 240 },
  ratioRange: [2, 8],
  howShown: 'Fixed banner frame: 4:1 across the content width on desktop (at most 300px tall) and 5:2 on phones. Your design is fitted whole — never cropped; any space it does not fill shows a soft blurred fill of the same image. Upload 4:1 (2000×500px) for an edge-to-edge banner. The orange CTA button sits on the right side, vertically centred — keep that area free of text.',
};

/** Wide sponsored banner slot above a listing grid (same 4:1 frame as Products / Deals). */
const wideSlot = (placementId: string, pageKey: AdPageKey, pageLabel: string, sectionLabel: string): AdPlacementDef => ({
  placementId,
  pageKey,
  pageLabel,
  slotKey: 'sponsored_banner',
  slotLabel: `${pageLabel} page sponsored banner`,
  sectionLabel,
  allowedFormats: ['follow_brands_banner', 'hero_banner'],
  orientation: 'horizontal',
  aspectRatio: '4:1',
  mobileSupport: true,
  desktopSupport: true,
  ownerRoles: ['admin', 'seller', 'creator'],
  active: true,
  creative: WIDE_BANNER,
});
/** Portrait card image in side rails / feeds, cropped to a 3:4 frame. */
const PORTRAIT_CARD: AdCreativeSpec = {
  display: 'cover',
  recommended: { width: 600, height: 800 },
  min: { width: 300, height: 400 },
  ratioRange: [0.6, 0.9],
  howShown: 'Fills a 3:4 portrait card above the headline and button; edges may be trimmed — keep the subject centred and avoid text near the edges.',
};
const SIDEBAR_NOTE = 'desktop only (rails are hidden on phones)';

const sidebar = (placementId: string, pageKey: AdPageKey, pageLabel: string): AdPlacementDef => ({
  placementId,
  pageKey,
  pageLabel,
  slotKey: 'right_sidebar',
  slotLabel: 'Sidebar card',
  sectionLabel: `${pageLabel} page — sponsored card in the side rail (${SIDEBAR_NOTE})`,
  allowedFormats: ['vertical_card', 'gradient_promo'],
  orientation: 'vertical',
  aspectRatio: '3:4',
  mobileSupport: false,
  desktopSupport: true,
  ownerRoles: ['admin', 'seller', 'creator'],
  active: true,
  creative: PORTRAIT_CARD,
});

export const AD_PLACEMENTS: AdPlacementDef[] = [
  // —— Homepage ——
  {
    placementId: 'HOME_HERO',
    pageKey: 'homepage',
    pageLabel: 'Homepage',
    slotKey: 'hero',
    slotLabel: 'Hero carousel slide',
    sectionLabel: 'Homepage — top hero carousel, added as a "Sponsored" slide after the editorial slides',
    allowedFormats: ['hero_banner'],
    orientation: 'horizontal',
    aspectRatio: '3:1',
    mobileSupport: true,
    desktopSupport: true,
    ownerRoles: ['admin'],
    active: true,
    creative: {
      display: 'cover',
      recommended: { width: 1920, height: 620 },
      min: { width: 1280, height: 400 },
      ratioRange: [2.2, 4],
      howShown: 'Fills the full-width hero (about 3:1 on desktop; phones show the centre ~1.2:1 area). Keep logos and text in the middle third — the sides are cut on phones.',
    },
  },
  {
    placementId: 'HOME_FOLLOW_BRANDS',
    pageKey: 'homepage',
    pageLabel: 'Homepage',
    slotKey: 'sponsored_banner',
    slotLabel: 'Homepage sponsored banner',
    sectionLabel: 'Homepage — wide sponsored banner after the Viral Today / Popular Products block',
    allowedFormats: ['follow_brands_banner', 'hero_banner'],
    orientation: 'horizontal',
    aspectRatio: '4:1',
    mobileSupport: true,
    desktopSupport: true,
    ownerRoles: ['admin', 'seller', 'creator'],
    active: true,
    creative: WIDE_BANNER,
  },
  {
    placementId: 'HOME_RIGHT_RAIL',
    pageKey: 'homepage',
    pageLabel: 'Homepage',
    slotKey: 'right_sidebar',
    slotLabel: 'Right Sidebar',
    sectionLabel: 'Retired',
    allowedFormats: ['vertical_card', 'gradient_promo'],
    orientation: 'vertical',
    aspectRatio: '3:4',
    mobileSupport: false,
    desktopSupport: true,
    ownerRoles: ['admin', 'seller', 'creator'],
    active: false,
    retiredReason: 'The homepage has no sidebar — this slot never existed on the storefront.',
  },
  // —— Products (browse) ——
  {
    placementId: 'BROWSE_BANNER',
    pageKey: 'browse',
    pageLabel: 'Products & Services',
    slotKey: 'sponsored_banner',
    slotLabel: 'Products page sponsored banner',
    sectionLabel: 'Products & Services page — wide sponsored banner above the product grid',
    allowedFormats: ['follow_brands_banner', 'hero_banner'],
    orientation: 'horizontal',
    aspectRatio: '4:1',
    mobileSupport: true,
    desktopSupport: true,
    ownerRoles: ['admin', 'seller', 'creator'],
    active: true,
    creative: WIDE_BANNER,
  },
  sidebar('BROWSE_SIDEBAR', 'browse', 'Products & Services'),
  // —— Deals ——
  {
    placementId: 'DEALS_BANNER',
    pageKey: 'deals',
    pageLabel: 'Deals',
    slotKey: 'sponsored_banner',
    slotLabel: 'Deals page sponsored banner',
    sectionLabel: 'Deals page — wide sponsored banner in the deals feed',
    allowedFormats: ['follow_brands_banner', 'hero_banner'],
    orientation: 'horizontal',
    aspectRatio: '4:1',
    mobileSupport: true,
    desktopSupport: true,
    ownerRoles: ['admin', 'seller', 'creator'],
    active: true,
    creative: WIDE_BANNER,
  },
  sidebar('DEALS_SIDEBAR', 'deals', 'Deals'),
  {
    placementId: 'DEALS_FEATURED',
    pageKey: 'deals',
    pageLabel: 'Deals',
    slotKey: 'deal_of_day',
    slotLabel: 'Deal of the Day',
    sectionLabel: 'Retired',
    allowedFormats: ['deal_of_the_day'],
    orientation: 'horizontal',
    aspectRatio: '5:2',
    mobileSupport: true,
    desktopSupport: true,
    ownerRoles: ['admin', 'seller'],
    active: false,
    retiredReason: 'Deal of the Day is filled from live flash deals; paid Deal of the Day is handled by Deals → Promotion Requests, not banner ads.',
  },
  // —— Other listing pages with a real side rail ——
  sidebar('BRANDS_SIDEBAR', 'brands', 'Brands'),
  sidebar('CATEGORIES_SIDEBAR', 'categories', 'Categories'),
  sidebar('CREATORS_SIDEBAR', 'creators', 'Creators'),
  {
    ...sidebar('GUIDES_SIDEBAR', 'guides', 'Buying Guides'),
    sectionLabel: 'Retired',
    active: false,
    retiredReason: 'The old Buying Guides page is no longer routed (/guides opens Recommendations) — use the Recommendations banner or feed card.',
  },
  {
    placementId: 'CATEGORY_CARD_FOOTER',
    pageKey: 'categories',
    pageLabel: 'Categories',
    slotKey: 'card_footer',
    slotLabel: 'Category Card Footer (Embedded)',
    sectionLabel: 'Retired',
    allowedFormats: ['category_promoted_slot'],
    orientation: 'embedded',
    aspectRatio: 'auto',
    embeddedMode: true,
    mobileSupport: true,
    desktopSupport: true,
    ownerRoles: ['admin', 'seller'],
    active: false,
    retiredReason: 'Category cards on the storefront have no promoted footer.',
  },
  // Wide banners above the grid (mounted 2026-11-05 at the Super Admin's request).
  wideSlot('BRANDS_BANNER', 'brands', 'Brands', 'Brands page — wide sponsored banner above the brands grid'),
  wideSlot('CATEGORIES_BANNER', 'categories', 'Categories', 'Categories page — wide sponsored banner above the category grid'),
  wideSlot('CREATORS_BANNER', 'creators', 'Creators', 'Creators page — wide sponsored banner above the creators grid'),
  wideSlot('DISCOVER_BANNER', 'discover', 'Recommendations (Discover)', 'Recommendations page (also Buying Guides) — wide sponsored banner above the feed'),
  // —— Discover + product page ——
  {
    placementId: 'DISCOVER_FEED',
    pageKey: 'discover',
    pageLabel: 'Recommendations (Discover)',
    slotKey: 'feed',
    slotLabel: 'Sponsored feed card',
    sectionLabel: 'Recommendations / Discover feed — sponsored card between feed items',
    allowedFormats: ['vertical_card', 'gradient_promo'],
    orientation: 'vertical',
    aspectRatio: '3:4',
    mobileSupport: true,
    desktopSupport: true,
    ownerRoles: ['admin', 'seller', 'creator'],
    active: true,
    creative: PORTRAIT_CARD,
  },
  {
    placementId: 'PRODUCT_DETAIL_RAIL',
    pageKey: 'product_detail',
    pageLabel: 'Product Detail',
    slotKey: 'right_sidebar',
    slotLabel: 'Product page sponsored card',
    sectionLabel: 'Product page — sponsored card in the right column, under the product information (stacks below on phones)',
    allowedFormats: ['vertical_card', 'gradient_promo'],
    orientation: 'vertical',
    aspectRatio: '3:4',
    mobileSupport: true,
    desktopSupport: true,
    ownerRoles: ['admin', 'seller'],
    active: true,
    creative: PORTRAIT_CARD,
  },
];

export function getFormatDef(formatId: string | undefined | null): AdFormatDef | undefined {
  return AD_FORMATS.find((f) => f.formatId === formatId);
}

/** Active (selectable, deliverable) slot. */
export function getPlacementDef(placementId: string | undefined | null): AdPlacementDef | undefined {
  return AD_PLACEMENTS.find((p) => p.placementId === placementId && p.active);
}

/** Any slot, including retired ones (to explain why an older ad is not shown). */
export function getAnyPlacementDef(placementId: string | undefined | null): AdPlacementDef | undefined {
  return AD_PLACEMENTS.find((p) => p.placementId === placementId);
}

export function listPages(): Array<{ pageKey: AdPageKey; pageLabel: string }> {
  const map = new Map<AdPageKey, string>();
  for (const p of AD_PLACEMENTS) {
    if (!p.active) continue;
    if (!map.has(p.pageKey)) map.set(p.pageKey, p.pageLabel);
  }
  return [...map.entries()].map(([pageKey, pageLabel]) => ({ pageKey, pageLabel }));
}

export function placementsForPage(pageKey: string, role?: string): AdPlacementDef[] {
  const r = (role || 'admin').toLowerCase();
  const owner: 'admin' | 'seller' | 'creator' =
    r === 'seller' ? 'seller' : r === 'creator' ? 'creator' : 'admin';
  return AD_PLACEMENTS.filter(
    (p) => p.active && p.pageKey === pageKey && p.ownerRoles.includes(owner),
  );
}

export function assertFormatPlacementCompatible(
  formatId: string | undefined,
  placementId: string | undefined,
): { ok: true; placement: AdPlacementDef } | { ok: false; error: string } {
  if (!formatId) return { ok: false, error: 'formatId is required' };
  if (!placementId) return { ok: false, error: 'placementId is required' };
  const format = getFormatDef(formatId);
  if (!format) return { ok: false, error: `Unsupported format: ${formatId}` };
  const retired = getAnyPlacementDef(placementId);
  if (retired && !retired.active) return { ok: false, error: `Placement ${placementId} is retired: ${retired.retiredReason ?? 'not on the storefront'}` };
  const placement = getPlacementDef(placementId);
  if (!placement) return { ok: false, error: `Unsupported or inactive placement: ${placementId}` };
  if (!placement.allowedFormats.includes(format.formatId)) {
    return {
      ok: false,
      error: `Format "${format.label}" is not allowed in placement "${placement.slotLabel}"`,
    };
  }
  return { ok: true, placement };
}

export function assertRoleCanUsePlacement(
  placementId: string,
  role?: string,
): { ok: true } | { ok: false; error: string } {
  const placement = getPlacementDef(placementId);
  if (!placement) return { ok: false, error: `Unknown placement: ${placementId}` };
  const r = (role || '').toLowerCase();
  const owner: 'admin' | 'seller' | 'creator' =
    r === 'seller' ? 'seller' : r === 'creator' ? 'creator' : r === 'admin' || r === 'super_admin' ? 'admin' : 'seller';
  if (!placement.ownerRoles.includes(owner)) {
    return { ok: false, error: `Role ${owner} cannot use placement ${placementId}` };
  }
  return { ok: true };
}

export type CreativeFit = { ok: true; warnings: string[] } | { ok: false; error: string };

/**
 * Does an image of width×height suit this slot? Used at upload time (builder), on save, and when a
 * Super Admin moves an ad to another slot. Too small or wrong proportions → refused with the reason.
 */
export function checkCreativeFit(placement: AdPlacementDef, width: number | undefined, height: number | undefined): CreativeFit {
  const spec = placement.creative;
  if (!spec) return { ok: true, warnings: [] };
  if (!width || !height || width <= 0 || height <= 0) return { ok: false, error: 'The image size could not be read — upload the image again.' };
  const ratio = width / height;
  const [lo, hi] = spec.ratioRange;
  if (width < spec.min.width || height < spec.min.height) {
    return {
      ok: false,
      error: `Image is ${width}×${height}px — "${placement.slotLabel}" needs at least ${spec.min.width}×${spec.min.height}px (recommended ${spec.recommended.width}×${spec.recommended.height}px).`,
    };
  }
  if (ratio < lo || ratio > hi) {
    return {
      ok: false,
      error: `Image proportions ${ratio.toFixed(2)}:1 don't fit "${placement.slotLabel}" (allowed ${lo}:1 to ${hi}:1; recommended ${spec.recommended.width}×${spec.recommended.height}px).`,
    };
  }
  const rec = spec.recommended.width / spec.recommended.height;
  const warnings = spec.display === 'cover' && Math.abs(ratio - rec) / rec > 0.15 ? [`Edges will be trimmed: your image is ${ratio.toFixed(2)}:1, the frame is about ${rec.toFixed(2)}:1.`] : [];
  return { ok: true, warnings };
}
