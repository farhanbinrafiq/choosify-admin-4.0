/**
 * Website Studio Phase 3 client model — mirrors server/website/siteContent.ts.
 * Only settings the storefront header / footer really render.
 */

export type NavItem = { id: string; label: string; url: string; external: boolean; showOnDesktop: boolean; showOnMobile: boolean };
export type NavigationContent = { version: 2; items: NavItem[]; announcement: { enabled: boolean; text: string; linkUrl: string } };

export type FooterLinkItem = { label: string; url: string; external?: boolean };
export type FooterColumn = { id: string; title: string; links: FooterLinkItem[] };
export type DeliveryPartner = { id: string; name: string; logoUrl: string; confirmed: boolean };
export type AppLink = { platform: 'android' | 'ios'; url: string };
export type FooterContent = {
  version: 2;
  description: string;
  columns: FooterColumn[];
  showOffices: boolean;
  showBusinessIds: boolean;
  paymentMethods: string[];
  deliveryPartners: DeliveryPartner[];
  apps: AppLink[];
};

export type SocialLink = { platform: string; url: string; visible: boolean };
export type SocialContent = { version: 2; links: SocialLink[] };

export const NAV_LIMITS = { items: 10, label: 24, announcement: 140 } as const;
export const FOOTER_LIMITS = { columns: 4, links: 8, description: 300, partners: 6 } as const;

/** Storefront pages a menu / footer link may open (server enforces the same list). */
export const SITE_PAGES: Array<{ path: string; label: string }> = [
  { path: '/', label: 'Home' },
  { path: '/categories', label: 'Categories' },
  { path: '/products', label: 'Products & Services' },
  { path: '/brands', label: 'Brands' },
  { path: '/spotlight', label: 'Recommendations' },
  { path: '/guides', label: 'Buying guides' },
  { path: '/deals', label: 'Deals' },
  { path: '/brand-deals', label: 'Brand deals' },
  { path: '/creators', label: 'Creators' },
  { path: '/compare', label: 'Compare' },
  { path: '/emi', label: 'Emi assistant' },
  { path: '/search', label: 'Search' },
  { path: '/reviews', label: 'Reviews' },
  { path: '/blogs', label: 'Blogs' },
  { path: '/customer-favorite', label: 'Customer favourites' },
  { path: '/warranty-claims', label: 'Warranty claims' },
  { path: '/about', label: 'About' },
  { path: '/contact', label: 'Contact' },
  { path: '/faq', label: 'FAQ' },
  { path: '/careers', label: 'Careers' },
  { path: '/partnership', label: 'Partnership' },
  { path: '/advertise', label: 'Advertise' },
  { path: '/suggest-brand', label: 'Suggest a brand' },
  { path: '/terms', label: 'Terms' },
  { path: '/privacy', label: 'Privacy' },
];

export const SOCIAL_PLATFORMS: Array<{ id: string; label: string; example: string }> = [
  { id: 'facebook', label: 'Facebook', example: 'https://www.facebook.com/choosify.bd' },
  { id: 'instagram', label: 'Instagram', example: 'https://www.instagram.com/choosify.bd/' },
  { id: 'youtube', label: 'YouTube', example: 'https://www.youtube.com/@choosifybd' },
  { id: 'linkedin', label: 'LinkedIn', example: 'https://www.linkedin.com/company/…' },
  { id: 'tiktok', label: 'TikTok', example: 'https://www.tiktok.com/@choosify.bd' },
  { id: 'x', label: 'X (Twitter)', example: 'https://x.com/…' },
  { id: 'whatsapp', label: 'WhatsApp', example: 'https://wa.me/8801…' },
];

export const APP_STORES: Record<AppLink['platform'], { label: string; hint: string }> = {
  android: { label: 'Google Play (Android)', hint: 'https://play.google.com/store/apps/details?id=bd.choosify.app' },
  ios: { label: 'App Store (iPhone)', hint: 'https://apps.apple.com/bd/app/choosify/id1234567890' },
};

export const isExternal = (url: string) => /^https:\/\//i.test(url);

export const moveIn = <T,>(list: T[], i: number, d: -1 | 1): T[] => {
  const j = i + d;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
};

export const nextId = (base: string, taken: string[]) => {
  const root = base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'item';
  let id = root;
  for (let n = 2; taken.includes(id); n++) id = `${root}-${n}`;
  return id;
};
