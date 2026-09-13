import type { CtaAudienceRule, CtaBannerItem, CtaDestinationType, CtaPageKey, CtaPosition } from '../types/catalog';
import { CTA_PLACEMENT_REGISTRY, defaultPlacementFor, getPageSections, isValidPlacement, sectionLabel } from './ctaPlacementRegistry';

/**
 * Editorial CTA/banner placements (Storefront Curation -> CTA & Banners).
 * Mirrors the storefront's src/lib/ctaBanners.ts seed content exactly --
 * kept as a separate copy since these are two independently-deployed apps
 * with no shared package (same duplication pattern already used for the
 * partner signup origin resolver across this codebase).
 */

export { CTA_PLACEMENT_REGISTRY, getPageSections, getSectionPositions, sectionLabel } from './ctaPlacementRegistry';

/** Pages with a real, wired placement registry -- Admin can only create a CTA for one of these. */
export const CTA_PAGE_OPTIONS: Array<{ value: CtaPageKey; label: string; route: string }> = (
  Object.entries(CTA_PLACEMENT_REGISTRY) as Array<[CtaPageKey, (typeof CTA_PLACEMENT_REGISTRY)[CtaPageKey]]>
).map(([value, def]) => ({ value, label: def.label, route: def.route }));

/** Internal routes an Admin may pick without typing a path by hand -- mirrors PRIMARY_NAV_ITEMS + other known-real static pages. */
export const CTA_INTERNAL_ROUTE_PRESETS: Array<{ value: string; label: string }> = [
  { value: '/', label: 'Home' },
  { value: '/categories', label: 'Categories' },
  { value: '/products', label: 'Products & Services' },
  { value: '/brands', label: 'Brands' },
  { value: '/spotlight', label: 'Recommendations' },
  { value: '/deals', label: 'Deals' },
  { value: '/creators', label: 'Creators' },
  { value: '/compare', label: 'Compare' },
  { value: '/search', label: 'Search' },
  { value: '/suggest-brand', label: 'Suggest a Brand' },
  { value: '/advertise', label: 'Advertise' },
  { value: '/partnership', label: 'Partnership' },
  { value: '/post-offer', label: 'Post an Offer (seller)' },
  { value: '/login', label: 'Login / Register' },
  { value: '/contact', label: 'Contact' },
  { value: '/about', label: 'About' },
];

export const CTA_AUDIENCE_RULE_OPTIONS: Array<{ value: CtaAudienceRule; label: string }> = [
  { value: 'none', label: 'Everyone' },
  { value: 'guests_only', label: 'Guests only (not logged in)' },
  { value: 'logged_in_only', label: 'Logged-in users only' },
  { value: 'hide_if_has_creator_account', label: 'Hide from existing Creators' },
  { value: 'hide_if_has_seller_account', label: 'Hide from existing Sellers' },
];

export const CTA_DESTINATION_TYPE_OPTIONS: Array<{ value: CtaDestinationType; label: string }> = [
  { value: 'internal', label: 'Internal route' },
  { value: 'creator_signup', label: 'Creator Signup (canonical)' },
  { value: 'seller_signup', label: 'Seller Signup (canonical)' },
  { value: 'external', label: 'External URL' },
  { value: 'none', label: 'No action' },
];

/** Reserved ids with their own dedicated storefront component / behavior -- placement and (for one) destination are locked in the editor. */
export const CTA_RESERVED_NOTES: Record<string, { note?: string; lockPlacement?: boolean; lockDestination?: boolean }> = {
  'creators.join_cta': {
    note: 'Hidden automatically from visitors who already have a creator account.',
    lockPlacement: true,
  },
  'deals.subscribe_cta': {
    note: 'Destination is fixed to "No action" — this CTA submits a local form, it does not navigate.',
    lockPlacement: true,
    lockDestination: true,
  },
};

function defaultCtaBanners(): CtaBannerItem[] {
  return [
    {
      id: 'creators.join_cta',
      page: 'creators',
      section: 'creators-grid',
      position: 'after',
      title: 'Are you a creator?',
      subtitle: 'Join Choosify and grow your audience by sharing honest reviews.',
      buttonLabel: 'JOIN AS CREATOR',
      destinationType: 'creator_signup',
      destinationValue: '',
      openInNewTab: true,
      enabled: true,
      order: 0,
      style: 'navy',
      audienceRule: 'hide_if_has_creator_account',
    },
    {
      id: 'deals.subscribe_cta',
      page: 'deals',
      section: 'deals-subscribe-banner',
      position: 'after',
      title: '🎁 NEVER MISS A DEAL!',
      subtitle: 'Subscribe and get top deals straight to your inbox.',
      buttonLabel: 'SUBSCRIBE',
      destinationType: 'none',
      destinationValue: '',
      openInNewTab: false,
      enabled: true,
      order: 0,
      style: 'navy',
      audienceRule: 'none',
    },
  ];
}

/**
 * Defensively repairs a record that predates the placement registry
 * (destinationType "external" with a "creator_signup"/"seller_signup"
 * sentinel value, and/or a missing/stale section+position) so the edit form
 * never receives an invalid draft even before the backend has re-saved it
 * once under the current schema.
 */
function repairLegacyItem(item: CtaBannerItem): CtaBannerItem {
  let next = item;
  if ((next.destinationType as string) === 'external' && ((next.destinationValue as string) === 'creator_signup' || (next.destinationValue as string) === 'seller_signup')) {
    next = { ...next, destinationType: next.destinationValue as CtaDestinationType, destinationValue: '' };
  }
  if (!next.section || !isValidPlacement(next.page, next.section, next.position)) {
    next = { ...next, ...defaultPlacementFor(next.page) };
  }
  if (typeof next.openInNewTab !== 'boolean') {
    next = { ...next, openInNewTab: next.destinationType !== 'none' };
  }
  return next;
}

/** Merge stored config over seed defaults so every known placement always has a row to edit, even before first Save. */
export function resolveCtaBanners(stored?: CtaBannerItem[] | null): CtaBannerItem[] {
  const defaults = defaultCtaBanners();
  const byId = new Map((stored ?? []).map((item) => [item.id, item]));
  const merged = defaults.map((fb) => repairLegacyItem(byId.get(fb.id) ?? fb));
  defaults.forEach((fb) => byId.delete(fb.id));
  const extras = Array.from(byId.values()).map(repairLegacyItem);
  return [...merged, ...extras];
}

/** A fresh, unsaved draft for the "Create CTA" flow. */
export function newCtaBannerDraft(page: CtaPageKey): CtaBannerItem {
  const placement = defaultPlacementFor(page);
  return {
    id: `${page}.custom_${Date.now()}`,
    page,
    section: placement.section,
    position: placement.position,
    title: '',
    subtitle: '',
    buttonLabel: '',
    destinationType: 'internal',
    destinationValue: CTA_PLACEMENT_REGISTRY[page]?.route ?? '/',
    openInNewTab: false,
    enabled: true,
    order: 0,
    style: 'navy',
    audienceRule: 'none',
  };
}

/** Items sharing the exact same (page, section, position) bucket -- ordering is only ever compared within this group, never globally. */
export function placementGroupKey(item: CtaBannerItem): string {
  return `${item.page}::${item.section}::${item.position}`;
}

export function placementSummary(item: CtaBannerItem): string {
  const page = CTA_PLACEMENT_REGISTRY[item.page]?.label ?? item.page;
  const section = sectionLabel(item.page, item.section);
  const positionLabel = item.position === 'before' ? 'Before' : 'After';
  return `${page} → ${section} → ${positionLabel}`;
}

export function placementPreviewText(item: CtaBannerItem): string {
  const section = sectionLabel(item.page, item.section);
  return item.position === 'before'
    ? `The CTA will appear immediately before ${section}.`
    : `The CTA will appear immediately after ${section}.`;
}

export { isValidPlacement };
