/**
 * Website Studio — homepage content model (mirrors server/website/websiteContent.ts HomepageStudio).
 * SECTION_INFO describes what the storefront really renders for each section, so the editor only
 * offers controls the live homepage reads.
 */

export type HomepageSlide = {
  id: string;
  /** Accessible name of the slide and its link (the hero shows media only, no text overlay). */
  label: string;
  linkUrl: string;
  mediaType: 'image' | 'video';
  mediaUrl: string;
  mobileMediaUrl: string;
  posterUrl: string;
  alt: string;
  focalX: number;
  focalY: number;
  isActive: boolean;
};

export type HomepageSectionId =
  | 'categories'
  | 'spotlight'
  | 'trending'
  | 'deals'
  | 'compare'
  | 'recommended'
  | 'featured-brands'
  | 'services'
  | 'recently-viewed';

export type HomepageSection = { id: HomepageSectionId; isVisible: boolean; title: string; subtitle: string };

export type HomepageStudioContent = {
  version: 2;
  heroVisible: boolean;
  slides: HomepageSlide[];
  sections: HomepageSection[];
  topCategories: Array<{ id: string; label: string }>;
  featuredProductIds: string[];
  featuredBrandIds: string[];
  featuredGuideIds: string[];
};

export const HOMEPAGE_LIMITS = { slides: 6, categories: 6, products: 8, brands: 12, guides: 12 } as const;

export const SECTION_INFO: Record<
  HomepageSectionId,
  { name: string; defaultTitle: string; defaultSubtitle?: string; heading: boolean; note: string }
> = {
  categories: {
    name: 'Top Categories',
    defaultTitle: 'Top Categories',
    heading: true,
    note: 'Six category tiles (icons, not photos). Pick them below, or leave empty to show the categories with the most products.',
  },
  spotlight: {
    name: 'Viral Today',
    defaultTitle: 'Viral Today',
    heading: true,
    note: 'Filled automatically with creator videos, reels and live streams. While it is shown, Popular Products appears inside it.',
  },
  trending: {
    name: 'Popular Products',
    defaultTitle: 'Popular Products',
    defaultSubtitle: "Handpicked deals you'll love",
    heading: true,
    note: 'Shown inside Viral Today while Viral Today is visible; in its own place only when Viral Today is hidden. Pick up to 8 products, or leave empty for the newest products.',
  },
  deals: {
    name: "Today's Deals",
    defaultTitle: "Today's Deals",
    heading: true,
    note: 'Shows the active Deals Banners. Those are managed in the “Deals Banners” tab, which saves live (not versioned yet).',
  },
  compare: { name: 'Compare', defaultTitle: '', heading: false, note: 'The “Compare anything” block. It has no heading to edit.' },
  recommended: {
    name: 'Top Buying Guides',
    defaultTitle: 'Top Buying Guides',
    heading: true,
    note: 'Pick up to 12 guides, or leave empty for the newest guides.',
  },
  'featured-brands': {
    name: 'Featured Brands',
    defaultTitle: 'Featured Brands',
    heading: true,
    note: 'Pick up to 12 brands, or leave empty for the daily rotation (Super Admin pins and verified brands first). Active paid ad placements for this section are shown instead of your picks while they run.',
  },
  services: { name: 'Popular Services', defaultTitle: 'Popular Services', heading: true, note: 'Fixed service shortcuts that open the product list.' },
  'recently-viewed': {
    name: 'Recently Viewed',
    defaultTitle: 'Recently Viewed',
    heading: true,
    note: 'Personal to each signed-in shopper; hidden when they have viewed nothing.',
  },
};

export const moveItem = <T,>(list: T[], i: number, d: -1 | 1): T[] => {
  const j = i + d;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
};

export const newSlide = (existing: HomepageSlide[]): HomepageSlide => {
  let n = existing.length + 1;
  while (existing.some((s) => s.id === `slide-${n}`)) n++;
  return { id: `slide-${n}`, label: '', linkUrl: '', mediaType: 'image', mediaUrl: '', mobileMediaUrl: '', posterUrl: '', alt: '', focalX: 50, focalY: 50, isActive: true };
};
