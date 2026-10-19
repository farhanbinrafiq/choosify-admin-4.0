/**
 * Studio readiness / profile-health checklists (Phase D). Pure: no React, no
 * network. Every rule here mirrors an existing server rule or an existing
 * field — nothing new is enforced. "blocker" items are what the server itself
 * refuses or hides; "todo" items are recommendations only.
 */

export type ReadinessState = 'done' | 'todo' | 'blocker' | 'info';

export type ReadinessItem = {
  id: string;
  label: string;
  state: ReadinessState;
  detail?: string;
  /** The Studio section that fixes / edits this item — StudioChecklist offers a "go" action for it. */
  section?: string;
};

/** Tag every item whose id is in `map` with that Studio section key. */
const withSections = (items: ReadinessItem[], map: Record<string, string>): ReadinessItem[] =>
  items.map((i) => (map[i.id] && !i.section ? { ...i, section: map[i.id] } : i));

const filled = (v: unknown) => typeof v === 'string' && v.trim().length > 0;

/** Brand fields the visibility rule reads (catalog record or Studio model). */
export type BrandVisibilityFacts = {
  marketplaceStatus?: string | null;
  marketplaceAccess?: boolean | null;
  sellerId?: string | null;
};

/**
 * Client mirror of server `brandIsMarketplaceVisible`
 * (server/catalog/sellerWorkspace.ts): marketplaceStatus decides when present;
 * otherwise the access flag; legacy rows with neither stay public unless
 * seller-owned. Kept in lock-step by scripts/probe-studio-readiness.ts.
 */
export function isBrandMarketplaceVisible(b: BrandVisibilityFacts): boolean {
  if (b.marketplaceStatus) return b.marketplaceStatus === 'granted' || b.marketplaceStatus === 'restored';
  if (b.marketplaceAccess === false) return false;
  if (b.marketplaceAccess === true) return true;
  return !b.sellerId;
}

const RESTRICTED_BRAND_STATUSES = new Set(['restricted', 'suspended', 'revoked']);

/** Owner-facing sentence for a brand's storefront visibility. */
export function brandVisibilityExplanation(b: BrandVisibilityFacts): { visible: boolean; text: string } {
  if (isBrandMarketplaceVisible(b)) {
    return { visible: true, text: 'Your brand page is public on the Choosify storefront.' };
  }
  if (b.marketplaceStatus && RESTRICTED_BRAND_STATUSES.has(b.marketplaceStatus)) {
    return {
      visible: false,
      text: 'Choosify has restricted this brand — its page and products are hidden from the storefront. Contact Choosify support to resolve it.',
    };
  }
  return {
    visible: false,
    text: 'Marketplace Access has not been granted yet — your brand page and products stay hidden from the storefront until Choosify grants it. You can keep editing in the meantime.',
  };
}

// ── Product ──────────────────────────────────────────────────────────────

export type ProductReadinessInput = {
  title: string;
  brandId: string;
  categoryId: string;
  image: string;
  gallery: string[];
  price: number;
  stock: number;
  description: string;
  /** Editor status: DRAFT | LIVE | OUT_OF_STOCK | SUSPENDED | ARCHIVED. */
  status: string;
  /** Optional detail sections (recommendations; omitted → not listed). */
  specsCount?: number;
  overviewCount?: number;
  bestForTagsCount?: number;
  hasDelivery?: boolean;
  hasWarranty?: boolean;
};

/**
 * `brand` is the authoritative catalog record (undefined = not loaded / not
 * found, in which case access is reported as unknown, never as granted).
 */
export function productReadiness(p: ProductReadinessInput, brand: BrandVisibilityFacts | null | undefined): ReadinessItem[] {
  const items: ReadinessItem[] = [];
  items.push(
    p.brandId
      ? { id: 'brand', label: 'Brand selected', state: 'done' }
      : { id: 'brand', label: 'Choose a brand', state: 'blocker', detail: 'Choosify requires a brand for every product.' },
  );
  items.push(
    p.categoryId
      ? { id: 'category', label: 'Category selected', state: 'done' }
      : { id: 'category', label: 'Choose a category', state: 'blocker', detail: 'Choosify requires a category for every product.' },
  );
  if (p.brandId) {
    if (brand === undefined || brand === null) {
      items.push({ id: 'access', label: 'Brand Marketplace Access could not be checked', state: 'info', detail: 'Reload the page to check whether the brand can publish.' });
    } else if (isBrandMarketplaceVisible(brand)) {
      items.push({ id: 'access', label: 'Brand has Marketplace Access', state: 'done' });
    } else {
      items.push({
        id: 'access',
        label: 'Brand has no Marketplace Access yet',
        state: 'blocker',
        detail: 'The product cannot go live and stays hidden from the storefront until Choosify grants the brand Marketplace Access.',
      });
    }
  }
  if (p.status === 'SUSPENDED') {
    items.push({ id: 'suspended', label: 'Suspended by Choosify', state: 'blocker', detail: 'Only Choosify can lift a suspension — contact support.' });
  }
  const photos = [p.image, ...(p.gallery || [])].filter(filled);
  items.push(photos.length ? { id: 'photo', label: 'Main photo added', state: 'done' } : { id: 'photo', label: 'Add a main photo', state: 'todo' });
  items.push(Number(p.price) > 0 ? { id: 'price', label: 'Price set', state: 'done' } : { id: 'price', label: 'Set a price', state: 'todo' });
  items.push(filled(p.description) ? { id: 'description', label: 'Description written', state: 'done' } : { id: 'description', label: 'Write a description', state: 'todo' });
  if (p.specsCount !== undefined) {
    items.push(p.specsCount > 0 ? { id: 'specs', label: 'Specifications added', state: 'done' } : { id: 'specs', label: 'Add specifications', state: 'todo' });
  }
  if (p.overviewCount !== undefined) {
    items.push(p.overviewCount > 0 ? { id: 'overview', label: 'Product overview written', state: 'done' } : { id: 'overview', label: 'Write the product overview', state: 'todo' });
  }
  if (p.bestForTagsCount !== undefined) {
    items.push(p.bestForTagsCount > 0 ? { id: 'tags', label: '“Best for” tags added', state: 'done' } : { id: 'tags', label: 'Add “Best for” tags', state: 'todo' });
  }
  if (p.hasDelivery !== undefined) {
    items.push(p.hasDelivery ? { id: 'delivery', label: 'Delivery information added', state: 'done' } : { id: 'delivery', label: 'Add delivery information', state: 'todo' });
  }
  if (p.hasWarranty !== undefined) {
    items.push(p.hasWarranty ? { id: 'warranty', label: 'Warranty & after-sales added', state: 'done' } : { id: 'warranty', label: 'Add warranty & after-sales details', state: 'todo' });
  }
  if (!(Number(p.stock) > 0) && p.status !== 'SUSPENDED' && p.status !== 'ARCHIVED') {
    items.push({
      id: 'stock',
      label: 'No stock',
      state: 'info',
      detail: 'Published with zero stock, the product is listed as Out of stock until you restock it.',
    });
  }
  return withSections(items, {
    brand: 'basic', category: 'basic', photo: 'core', price: 'pricing', description: 'description', stock: 'inventory',
    specs: 'specs', overview: 'overview', tags: 'tags', delivery: 'delivery', warranty: 'warranty',
  });
}

// ── Guide ────────────────────────────────────────────────────────────────

export type GuideReadinessInput = {
  title: string;
  excerpt: string;
  photos: string[];
  videoUrl: string;
  productIds: string[];
  brandIds: string[];
};

/** Recommendations only — the server has no publish requirements for guides. */
export function guideReadiness(g: GuideReadinessInput): ReadinessItem[] {
  const titled = filled(g.title) && g.title.trim() !== 'Untitled Guide';
  return withSections([
    titled ? { id: 'title', label: 'Title set', state: 'done' } : { id: 'title', label: 'Give the guide a title', state: 'todo' },
    (g.photos || []).some(filled) || filled(g.videoUrl)
      ? { id: 'media', label: 'Cover photo or video added', state: 'done' }
      : { id: 'media', label: 'Add a cover photo or video', state: 'todo' },
    filled(g.excerpt) ? { id: 'excerpt', label: 'Short summary written', state: 'done' } : { id: 'excerpt', label: 'Write a short summary', state: 'todo' },
    (g.productIds || []).length + (g.brandIds || []).length > 0
      ? { id: 'mentions', label: 'Products or brands mentioned', state: 'done' }
      : { id: 'mentions', label: 'Mention at least one product or brand', state: 'todo' },
  ], { title: 'identity', media: 'media', excerpt: 'identity' });
}

// ── Brand ────────────────────────────────────────────────────────────────

export type BrandHealthInput = {
  brandName: string;
  logo: string;
  coverImage: string;
  category: string;
  tagline: string;
  description: string;
  website: string;
  socials: string[];
  /** Optional overview sections (recommendations; omitted → not listed). */
  contact?: string[];
  address?: string;
  story?: boolean;
  faqCount?: number;
  storesCount?: number;
};

export function brandHealth(b: BrandHealthInput, visibility: BrandVisibilityFacts | null | undefined): ReadinessItem[] {
  const items: ReadinessItem[] = [];
  if (visibility) {
    const v = brandVisibilityExplanation(visibility);
    items.push(v.visible
      ? { id: 'access', label: 'Marketplace Access granted — page is public', state: 'done' }
      : { id: 'access', label: 'Storefront page hidden', state: 'blocker', detail: v.text });
  }
  const named = filled(b.brandName) && b.brandName.trim() !== 'Untitled Brand';
  items.push(named ? { id: 'name', label: 'Brand name set', state: 'done' } : { id: 'name', label: 'Add your brand name', state: 'todo' });
  items.push(filled(b.logo) ? { id: 'logo', label: 'Logo added', state: 'done' } : { id: 'logo', label: 'Add a logo', state: 'todo' });
  items.push(filled(b.coverImage) ? { id: 'cover', label: 'Cover image added', state: 'done' } : { id: 'cover', label: 'Add a cover image', state: 'todo' });
  items.push(filled(b.category) ? { id: 'category', label: 'Category chosen', state: 'done' } : { id: 'category', label: 'Choose a category', state: 'todo' });
  items.push(filled(b.description) ? { id: 'about', label: 'About section written', state: 'done' } : { id: 'about', label: 'Write the About section', state: 'todo' });
  items.push(
    filled(b.website) || (b.socials || []).some(filled)
      ? { id: 'links', label: 'Website or social link added', state: 'done' }
      : { id: 'links', label: 'Add a website or social link', state: 'todo' },
  );
  if (b.contact !== undefined) {
    items.push(b.contact.some(filled) ? { id: 'contact', label: 'Contact information added', state: 'done' } : { id: 'contact', label: 'Add contact information', state: 'todo' });
  }
  if (b.address !== undefined) {
    items.push(filled(b.address) ? { id: 'address', label: 'Shop address added', state: 'done' } : { id: 'address', label: 'Add your shop address', state: 'todo' });
  }
  if (b.story !== undefined) {
    items.push(b.story ? { id: 'story', label: 'Brand story added', state: 'done' } : { id: 'story', label: 'Tell your brand story', state: 'todo' });
  }
  if (b.storesCount !== undefined) {
    items.push(b.storesCount > 0 ? { id: 'stores', label: 'Where to buy listed', state: 'done' } : { id: 'stores', label: 'List where to buy', state: 'todo' });
  }
  if (b.faqCount !== undefined) {
    items.push(b.faqCount > 0 ? { id: 'faq', label: 'FAQ added', state: 'done' } : { id: 'faq', label: 'Answer common questions (FAQ)', state: 'todo' });
  }
  return withSections(items, {
    name: 'identity', logo: 'logo', cover: 'cover', category: 'identity', about: 'brandAbout', links: 'identity',
    contact: 'brandContact', address: 'brandAddress', story: 'story', stores: 'stores', faq: 'faq',
  });
}

// ── Creator ──────────────────────────────────────────────────────────────

export type CreatorReadinessInput = {
  name: string;
  avatar: string;
  coverImage: string;
  bio: string;
  socials: string[];
  email: string;
  phone: string;
  status: string;
  /** Any creator-defined contact method value (also counts as contact details). */
  otherContacts?: string[];
  /** Optional sections (recommendations; omitted → not listed). */
  username?: string | null;
  expertiseCount?: number;
  featuredCount?: number;
  partnershipCount?: number;
};

export function creatorReadiness(c: CreatorReadinessInput): ReadinessItem[] {
  const status = String(c.status || '').toUpperCase();
  const optional: ReadinessItem[] = [];
  if (c.username !== undefined) {
    optional.push(filled(c.username || '') ? { id: 'username', label: 'Public username set', state: 'done' } : { id: 'username', label: 'Choose a public username', state: 'todo' });
  }
  if (c.expertiseCount !== undefined) {
    optional.push(c.expertiseCount > 0 ? { id: 'expertise', label: 'Areas of expertise added', state: 'done' } : { id: 'expertise', label: 'Add your areas of expertise', state: 'todo' });
  }
  if (c.featuredCount !== undefined) {
    optional.push(c.featuredCount > 0 ? { id: 'featured', label: 'Featured content picked', state: 'done' } : { id: 'featured', label: 'Feature your best content', state: 'todo' });
  }
  if (c.partnershipCount !== undefined) {
    optional.push(c.partnershipCount > 0 ? { id: 'partnerships', label: 'Partnerships listed', state: 'done' } : { id: 'partnerships', label: 'List brand partners or collaboration types', state: 'todo' });
  }
  return withSections([
    filled(c.name) ? { id: 'name', label: 'Display name set', state: 'done' } : { id: 'name', label: 'Add your display name', state: 'todo' },
    filled(c.avatar) ? { id: 'avatar', label: 'Profile photo added', state: 'done' } : { id: 'avatar', label: 'Add a profile photo', state: 'todo' },
    filled(c.coverImage) ? { id: 'cover', label: 'Cover image added', state: 'done' } : { id: 'cover', label: 'Add a cover image', state: 'todo' },
    filled(c.bio) ? { id: 'bio', label: 'Bio written', state: 'done' } : { id: 'bio', label: 'Write a short bio', state: 'todo' },
    (c.socials || []).some(filled)
      ? { id: 'socials', label: 'Social link added', state: 'done' }
      : { id: 'socials', label: 'Add at least one social link', state: 'todo' },
    filled(c.email) || filled(c.phone) || (c.otherContacts || []).some(filled)
      ? { id: 'contact', label: 'Contact details added', state: 'done' }
      : { id: 'contact', label: 'Add contact details for brands', state: 'todo' },
    ...optional,
    status === 'LIVE'
      ? { id: 'visibility', label: 'Profile is live on the storefront', state: 'done' }
      : status === 'ARCHIVED'
        ? { id: 'visibility', label: 'Profile is archived — hidden from the storefront', state: 'info' }
        : { id: 'visibility', label: 'Profile is a draft — hidden from the storefront', state: 'info' },
  ], {
    name: 'identity', avatar: 'avatar', cover: 'cover', bio: 'overview', socials: 'social', contact: 'contact',
    username: 'identity', expertise: 'expertise', featured: 'featured', partnerships: 'partnerships',
  });
}

/** Count for a checklist summary line ("3 of 6 done"). Info items are not counted. */
export function readinessSummary(items: ReadinessItem[]): { done: number; total: number; blockers: number } {
  const counted = items.filter((i) => i.state !== 'info');
  return {
    done: counted.filter((i) => i.state === 'done').length,
    total: counted.length,
    blockers: items.filter((i) => i.state === 'blocker').length,
  };
}
