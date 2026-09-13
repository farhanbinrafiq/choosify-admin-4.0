import type { CtaPageKey, CtaPosition } from '../types/catalog';

/**
 * The single source of truth for where an editorial CTA can be placed.
 * Mirrors the storefront's src/lib/ctaPlacementRegistry.ts exactly -- kept as
 * a separate copy since these are two independently-deployed apps with no
 * shared package. Every entry here corresponds to a real, hand-wired anchor
 * point in a real storefront page component; if a section isn't listed here,
 * the storefront has no matching <CtaAnchor/> for it and it would render
 * nowhere even if the Admin editor could pick it (it can't).
 */
export interface CtaPlacementSection {
  section: string;
  label: string;
  positions: CtaPosition[];
}

export const CTA_PLACEMENT_REGISTRY: Record<CtaPageKey, { label: string; route: string; sections: CtaPlacementSection[] }> = {
  home: {
    label: 'Home',
    route: '/',
    sections: [
      { section: 'home-deals', label: "Today's Deals section", positions: ['before', 'after'] },
      { section: 'home-featured-brands', label: 'Featured Brands section', positions: ['before', 'after'] },
      { section: 'home-end', label: 'End of page', positions: ['after'] },
    ],
  },
  brands: {
    label: 'Brands',
    route: '/brands',
    sections: [
      { section: 'brands-grid', label: 'Brand card grid', positions: ['before', 'after'] },
      { section: 'brands-follow-cta-strip', label: '"Want exclusive brand deals?" strip', positions: ['before', 'after'] },
    ],
  },
  deals: {
    label: 'Deals',
    route: '/deals',
    sections: [
      { section: 'deals-flash-dotd', label: 'Flash Deals & Deal of the Day', positions: ['before', 'after'] },
      { section: 'deals-subscribe-banner', label: 'Newsletter subscribe banner', positions: ['before', 'after'] },
    ],
  },
  categories: {
    label: 'Categories',
    route: '/categories',
    sections: [
      { section: 'categories-feed-header', label: 'Page header', positions: ['before', 'after'] },
      { section: 'categories-browse-body', label: 'Category browse grid', positions: ['after'] },
    ],
  },
  products: {
    label: 'Products & Services',
    route: '/products',
    sections: [
      { section: 'products-grid', label: 'Product grid', positions: ['before', 'after'] },
      { section: 'products-end', label: 'End of page', positions: ['after'] },
    ],
  },
  search: {
    label: 'Search',
    route: '/search',
    sections: [
      { section: 'search-pill-tabs', label: 'Result-type tabs', positions: ['before', 'after'] },
      { section: 'search-end', label: 'End of results', positions: ['after'] },
    ],
  },
  creators: {
    label: 'Creators',
    route: '/creators',
    sections: [
      { section: 'creators-feed-header', label: 'Page header', positions: ['before', 'after'] },
      { section: 'creators-grid', label: 'Creator card grid', positions: ['before', 'after'] },
    ],
  },
};

export function getPageSections(page: CtaPageKey): CtaPlacementSection[] {
  return CTA_PLACEMENT_REGISTRY[page]?.sections ?? [];
}

export function getSectionPositions(page: CtaPageKey, section: string): CtaPosition[] {
  return CTA_PLACEMENT_REGISTRY[page]?.sections.find((s) => s.section === section)?.positions ?? [];
}

export function isValidPlacement(page: CtaPageKey, section: string, position: CtaPosition): boolean {
  return getSectionPositions(page, section).includes(position);
}

export function sectionLabel(page: CtaPageKey, section: string): string {
  return CTA_PLACEMENT_REGISTRY[page]?.sections.find((s) => s.section === section)?.label ?? section;
}

export function defaultPlacementFor(page: CtaPageKey): { section: string; position: CtaPosition } {
  const sections = getPageSections(page);
  const first = sections[0];
  return { section: first?.section ?? '', position: first?.positions[0] ?? 'after' };
}
