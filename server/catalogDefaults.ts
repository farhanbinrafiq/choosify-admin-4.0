import type {
  CatalogBrand,
  CatalogDeal,
  CatalogProduct,
  HomepageConfig,
} from '../src/types/catalog';
import { buildDefaultCatalogCategories } from '../lib/vercel-catalog/storefrontCategories';

const nowIso = () => new Date().toISOString();

export const defaultCategories = () => buildDefaultCatalogCategories();

export const defaultBrands = (): CatalogBrand[] => {
  const ts = nowIso();
  return [
    {
      id: 'brand-samsung',
      slug: 'samsung',
      name: 'Samsung',
      category: 'Electronics',
      description: 'Samsung Bangladesh official storefront',
      logo: 'S',
      verifiedStatus: true,
      claimStatus: 'verified',
      followers: 12400,
      ratings: 4.8,
      featuredFlag: true,
      sponsoredFlag: false,
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: 'brand-apple',
      slug: 'apple',
      name: 'Apple',
      category: 'Tech',
      description: 'Apple products and ecosystem',
      logo: 'A',
      verifiedStatus: true,
      claimStatus: 'verified',
      followers: 8920,
      ratings: 4.9,
      featuredFlag: true,
      sponsoredFlag: true,
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: 'brand-apex',
      slug: 'apex',
      name: 'Apex',
      category: 'Fashion',
      description: 'Bangladesh fashion and footwear',
      logo: 'Ap',
      verifiedStatus: true,
      claimStatus: 'verified',
      followers: 5400,
      ratings: 4.6,
      featuredFlag: false,
      sponsoredFlag: false,
      createdAt: ts,
      updatedAt: ts,
    },
  ];
};

export const defaultProducts = (): CatalogProduct[] => {
  const ts = nowIso();
  return [
    {
      id: 'prod-s24-ultra',
      slug: 'samsung-galaxy-s24-ultra',
      title: 'Samsung Galaxy S24 Ultra',
      description: 'Flagship Samsung phone with advanced camera features.',
      brandId: 'brand-samsung',
      brandName: 'Samsung',
      categoryId: 'cat-mobile',
      categoryName: 'Mobile & Phones',
      image:
        'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400&h=400&fit=crop',
      gallery: [],
      modeType: 'retail',
      price: 145000,
      originalPrice: 155000,
      stock: 42,
      status: 'live',
      tags: ['NEW'],
      isDeal: true,
      dealType: 'flash',
      discountPercent: 6.5,
      promoCode: 'S24FLASH',
      dealValidUntil: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
      featuredFlag: true,
      isNewArrival: true,
      isBestseller: true,
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: 'prod-macbook-air-m3',
      slug: 'apple-macbook-air-m3',
      title: 'Apple MacBook Air M3',
      description: 'Lightweight laptop for creators and professionals.',
      brandId: 'brand-apple',
      brandName: 'Apple',
      categoryId: 'cat-tech',
      categoryName: 'Tech & Electronics',
      image:
        'https://images.unsplash.com/photo-1496181133227-f83bb023945d?w=400&h=400&fit=crop',
      gallery: [],
      modeType: 'retail',
      price: 128000,
      stock: 18,
      status: 'live',
      tags: ['HOT'],
      isDeal: false,
      featuredFlag: true,
      isNewArrival: false,
      isBestseller: true,
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: 'prod-apex-loafer',
      slug: 'apex-mens-royal-loafer',
      title: "Apex Men's Royal Loafer",
      description: 'Comfortable premium loafers for everyday style.',
      brandId: 'brand-apex',
      brandName: 'Apex',
      categoryId: 'cat-fashion',
      categoryName: 'Fashion & Lifestyle',
      image:
        'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=400&h=400&fit=crop',
      gallery: [],
      modeType: 'retail',
      price: 3200,
      originalPrice: 4500,
      stock: 120,
      status: 'live',
      tags: ['SALE'],
      isDeal: true,
      dealType: 'brand',
      discountPercent: 28,
      promoCode: 'APEXFLAT400',
      dealValidUntil: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      featuredFlag: false,
      isNewArrival: true,
      isBestseller: false,
      createdAt: ts,
      updatedAt: ts,
    },
  ];
};

export const defaultDeals = (): CatalogDeal[] => {
  const ts = nowIso();
  return [
    {
      id: 'deal-s24-flash',
      slug: 's24-flash-deal',
      name: 'S24 Ultra Flash Deal',
      seller: 'Samsung Bangladesh',
      category: 'Electronics',
      status: 'live',
      type: 'retail',
      discountType: 'percentage',
      discountValue: 8,
      promoCode: 'S24FLASH',
      productId: 'prod-s24-ultra',
      brandId: 'brand-samsung',
      clicks: 0,
      validFrom: ts,
      validUntil: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: 'deal-apex-eid',
      slug: 'apex-eid-deal',
      name: 'Apex Eid Special',
      seller: 'Apex',
      category: 'Fashion',
      status: 'pending',
      type: 'retail',
      discountType: 'flat',
      discountValue: 400,
      promoCode: 'APEXFLAT400',
      productId: 'prod-apex-loafer',
      brandId: 'brand-apex',
      clicks: 0,
      validFrom: ts,
      validUntil: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: ts,
      updatedAt: ts,
    },
  ];
};

export const defaultHomepage = (): HomepageConfig => {
  const ts = nowIso();
  return {
    id: 'default',
    heroBanners: [
      {
        id: 'hero-main',
        headline: "Bangladesh's Most Trusted Product Discovery Platform",
        subtitle: 'Manage this content from admin dashboard CMS.',
        ctaText: 'Explore Products',
        ctaUrl: '/products',
        backgroundImage: '',
        isActive: true,
        order: 0,
      },
    ],
    sections: [
      { id: 'featured-products', label: 'Featured Products', isVisible: true, order: 0, itemIds: ['prod-s24-ultra', 'prod-macbook-air-m3'] },
      { id: 'featured-brands', label: 'Featured Brands', isVisible: true, order: 1, itemIds: ['brand-samsung', 'brand-apple'] },
      { id: 'featured-deals', label: 'Featured Deals', isVisible: true, order: 2, itemIds: ['deal-s24-flash'] },
    ],
    featuredProductIds: ['prod-s24-ultra', 'prod-macbook-air-m3'],
    featuredBrandIds: ['brand-samsung', 'brand-apple'],
    featuredDealIds: ['deal-s24-flash'],
    featuredCreatorIds: ['creator-farhan', 'creator-sarah'],
    featuredGuideIds: ['guide-top-smartphones-2026', 'guide-s24-ultra-review'],
    updatedAt: ts,
  };
};
