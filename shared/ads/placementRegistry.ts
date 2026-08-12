/**
 * Canonical Ads placement registry — shared by Ads API and Ads Visual Builder.
 * Format × page × slot combinations are validated against this list only.
 */

export type AdFormatId =
  | 'hero_banner'
  | 'vertical_card'
  | 'gradient_promo'
  | 'deal_of_the_day'
  | 'follow_brands_banner'
  | 'category_promoted_slot';

export type AdPageKey =
  | 'homepage'
  | 'categories'
  | 'browse'
  | 'brands'
  | 'discover'
  | 'creators'
  | 'deals'
  | 'product_detail'
  | 'guide_detail';

export type AdOrientation = 'horizontal' | 'vertical' | 'square' | 'embedded';

export type AdPlacementDef = {
  placementId: string;
  pageKey: AdPageKey;
  pageLabel: string;
  slotKey: string;
  slotLabel: string;
  allowedFormats: AdFormatId[];
  orientation: AdOrientation;
  aspectRatio: string;
  embeddedMode?: boolean;
  mobileSupport: boolean;
  desktopSupport: boolean;
  /** Who may request this placement */
  ownerRoles: Array<'admin' | 'seller' | 'creator'>;
  active: boolean;
};

export type AdFormatDef = {
  formatId: AdFormatId;
  label: string;
  description: string;
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
    label: 'Hero Banner',
    description: 'Wide horizontal hero with creative, identity, and CTA.',
    fields: ['advertiser', 'headline', 'subtext', 'ctaLabel', 'image', 'logo', 'listing', 'internalDest', 'externalUrl'],
  },
  {
    formatId: 'vertical_card',
    label: 'Vertical Card',
    description: 'Tall promotional unit for sidebar placements.',
    fields: ['advertiser', 'headline', 'subtext', 'ctaLabel', 'image', 'listing', 'internalDest', 'externalUrl'],
  },
  {
    formatId: 'gradient_promo',
    label: 'Gradient Promo',
    description: 'Compact gradient promotional card with identity mark.',
    fields: ['advertiser', 'headline', 'subtext', 'ctaLabel', 'logo', 'listing', 'internalDest', 'externalUrl'],
  },
  {
    formatId: 'deal_of_the_day',
    label: 'Deal of the Day',
    description: 'Featured deal unit bound to a real Product/Deal listing.',
    fields: ['advertiser', 'headline', 'subtext', 'ctaLabel', 'image', 'listing', 'internalDest'],
  },
  {
    formatId: 'follow_brands_banner',
    label: 'Follow Brands Banner',
    description: 'Wide CTA banner encouraging brand follows.',
    fields: ['headline', 'subtext', 'ctaLabel', 'image', 'internalDest', 'externalUrl'],
  },
  {
    formatId: 'category_promoted_slot',
    label: 'Category Promoted Slot',
    description: 'Embedded PROMOTED footer on an organic category card.',
    fields: ['advertiser', 'logo', 'listing', 'internalDest', 'externalUrl', 'hostCategory'],
  },
];

export const AD_PLACEMENTS: AdPlacementDef[] = [
  {
    placementId: 'HOME_HERO',
    pageKey: 'homepage',
    pageLabel: 'Homepage',
    slotKey: 'hero',
    slotLabel: 'Hero Banner',
    allowedFormats: ['hero_banner'],
    orientation: 'horizontal',
    aspectRatio: '21:9',
    mobileSupport: true,
    desktopSupport: true,
    ownerRoles: ['admin', 'seller', 'creator'],
    active: true,
  },
  {
    placementId: 'HOME_RIGHT_RAIL',
    pageKey: 'homepage',
    pageLabel: 'Homepage',
    slotKey: 'right_sidebar',
    slotLabel: 'Right Sidebar',
    allowedFormats: ['vertical_card', 'gradient_promo'],
    orientation: 'vertical',
    aspectRatio: '3:4',
    mobileSupport: false,
    desktopSupport: true,
    ownerRoles: ['admin', 'seller', 'creator'],
    active: true,
  },
  {
    placementId: 'HOME_FOLLOW_BRANDS',
    pageKey: 'homepage',
    pageLabel: 'Homepage',
    slotKey: 'follow_brands',
    slotLabel: 'Follow Brands Banner',
    allowedFormats: ['follow_brands_banner'],
    orientation: 'horizontal',
    aspectRatio: '5:1',
    mobileSupport: true,
    desktopSupport: true,
    ownerRoles: ['admin'],
    active: true,
  },
  {
    placementId: 'DEALS_FEATURED',
    pageKey: 'deals',
    pageLabel: 'Deals',
    slotKey: 'deal_of_day',
    slotLabel: 'Deal of the Day',
    allowedFormats: ['deal_of_the_day'],
    orientation: 'horizontal',
    aspectRatio: '5:2',
    mobileSupport: true,
    desktopSupport: true,
    ownerRoles: ['admin', 'seller'],
    active: true,
  },
  {
    placementId: 'DEALS_BANNER',
    pageKey: 'deals',
    pageLabel: 'Deals',
    slotKey: 'banner',
    slotLabel: 'Deals Page Banner',
    allowedFormats: ['hero_banner'],
    orientation: 'horizontal',
    aspectRatio: '21:9',
    mobileSupport: true,
    desktopSupport: true,
    ownerRoles: ['admin', 'seller', 'creator'],
    active: true,
  },
  {
    placementId: 'CATEGORY_CARD_FOOTER',
    pageKey: 'categories',
    pageLabel: 'Categories',
    slotKey: 'card_footer',
    slotLabel: 'Category Card Footer (Embedded)',
    allowedFormats: ['category_promoted_slot'],
    orientation: 'embedded',
    aspectRatio: 'auto',
    embeddedMode: true,
    mobileSupport: true,
    desktopSupport: true,
    ownerRoles: ['admin', 'seller'],
    active: true,
  },
  {
    placementId: 'BROWSE_SIDEBAR',
    pageKey: 'browse',
    pageLabel: 'Browse',
    slotKey: 'right_sidebar',
    slotLabel: 'Right Sidebar',
    allowedFormats: ['vertical_card', 'gradient_promo'],
    orientation: 'vertical',
    aspectRatio: '3:4',
    mobileSupport: false,
    desktopSupport: true,
    ownerRoles: ['admin', 'seller', 'creator'],
    active: true,
  },
  {
    placementId: 'DISCOVER_FEED',
    pageKey: 'discover',
    pageLabel: 'Discover',
    slotKey: 'feed',
    slotLabel: 'Sponsored Feed',
    allowedFormats: ['vertical_card', 'gradient_promo'],
    orientation: 'vertical',
    aspectRatio: '3:4',
    mobileSupport: true,
    desktopSupport: true,
    ownerRoles: ['admin', 'seller', 'creator'],
    active: true,
  },
  {
    placementId: 'BRANDS_BANNER',
    pageKey: 'brands',
    pageLabel: 'Brands',
    slotKey: 'banner',
    slotLabel: 'Brands Banner',
    allowedFormats: ['hero_banner', 'follow_brands_banner'],
    orientation: 'horizontal',
    aspectRatio: '21:9',
    mobileSupport: true,
    desktopSupport: true,
    ownerRoles: ['admin'],
    active: true,
  },
  {
    placementId: 'PRODUCT_DETAIL_RAIL',
    pageKey: 'product_detail',
    pageLabel: 'Product Detail',
    slotKey: 'right_sidebar',
    slotLabel: 'Product Sidebar',
    allowedFormats: ['vertical_card', 'gradient_promo'],
    orientation: 'vertical',
    aspectRatio: '3:4',
    mobileSupport: false,
    desktopSupport: true,
    ownerRoles: ['admin', 'seller'],
    active: true,
  },
];

export function getFormatDef(formatId: string | undefined | null): AdFormatDef | undefined {
  return AD_FORMATS.find((f) => f.formatId === formatId);
}

export function getPlacementDef(placementId: string | undefined | null): AdPlacementDef | undefined {
  return AD_PLACEMENTS.find((p) => p.placementId === placementId && p.active);
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
