import type {
  CatalogBrand,
  CatalogCategory,
  CatalogDeal,
  CatalogProduct,
  HomepageConfig,
} from './catalogTypes';

const nowIso = () => new Date().toISOString();

export const defaultCategories = (): CatalogCategory[] => {
  const ts = nowIso();
  return [
    {
      id: 'cat-mobile',
      slug: 'mobile-phones',
      name: 'Mobile & Phones',
      description: 'Smartphones and accessories',
      icon: 'Smartphone',
      parentId: null,
      enabled: true,
      displayOrder: 0,
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: 'cat-fashion',
      slug: 'fashion-lifestyle',
      name: 'Fashion & Lifestyle',
      description: 'Apparel and fashion accessories',
      icon: 'Shirt',
      parentId: null,
      enabled: true,
      displayOrder: 1,
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: 'cat-tech',
      slug: 'tech-electronics',
      name: 'Tech & Electronics',
      description: 'Laptops, accessories and gadgets',
      icon: 'Cpu',
      parentId: null,
      enabled: true,
      displayOrder: 2,
      createdAt: ts,
      updatedAt: ts,
    },
  ];
};

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
      { id: 'hero', label: 'Hero Banner', isVisible: true, order: 0, itemIds: [] },
      { id: 'categories', label: 'Featured Categories', isVisible: true, order: 1, itemIds: [] },
      { id: 'trending', label: 'Trending Products', isVisible: true, order: 2, itemIds: ['prod-s24-ultra', 'prod-macbook-air-m3'] },
      { id: 'featured-brands', label: 'Featured Brands', isVisible: true, order: 3, itemIds: ['brand-samsung', 'brand-apple'] },
      { id: 'deals', label: 'Flash Deals', isVisible: true, order: 4, itemIds: ['deal-s24-flash'] },
      { id: 'creators', label: 'Featured Creators', isVisible: true, order: 5, itemIds: ['creator-farhan', 'creator-sarah'] },
      { id: 'recommended', label: 'Recommended For You', isVisible: true, order: 6, itemIds: ['guide-top-smartphones-2026'] },
      { id: 'newsletter', label: 'Newsletter Banner', isVisible: true, order: 7, itemIds: [] },
    ],
    featuredProductIds: ['prod-s24-ultra', 'prod-macbook-air-m3'],
    featuredBrandIds: ['brand-samsung', 'brand-apple'],
    featuredDealIds: ['deal-s24-flash'],
    featuredCreatorIds: ['creator-farhan', 'creator-sarah'],
    featuredGuideIds: ['guide-top-smartphones-2026', 'guide-s24-ultra-review'],
    updatedAt: ts,
  };
};

export const defaultSiteConfig = (): import('./catalogTypes').SiteConfig => {
  const ts = nowIso();
  return {
    id: 'default',
    navigation: [
      { id: 'nav-home', label: 'Home', path: '/', order: 0 },
      { id: 'nav-categories', label: 'Categories', path: '/categories', order: 1 },
      { id: 'nav-products', label: 'Products', path: '/products', order: 2 },
      { id: 'nav-brands', label: 'Brands', path: '/brands', order: 3 },
      { id: 'nav-guides', label: 'Recommendations', path: '/guides', order: 4 },
      { id: 'nav-deals', label: 'Deals', path: '/deals', order: 5 },
      { id: 'nav-creators', label: 'Creators', path: '/creators', order: 6 },
    ],
    footer: {
      description:
        "Bangladesh's Smartest Product Discovery Platform. Find the best brands, compare prices, and shop with confidence.",
      copyrightText: '© 2025 Choosify Bangladesh. All rights reserved.',
      columns: [
        {
          id: 'discover',
          title: 'Discover',
          links: [
            { label: 'Top Brands', url: '/brands' },
            { label: 'New Arrivals', url: '/products' },
            { label: 'Compare', url: '/compare' },
            { label: 'Best Deals', url: '/deals' },
          ],
        },
        {
          id: 'company',
          title: 'Company',
          links: [
            { label: 'Suggest a Brand', url: '/suggest-brand' },
            { label: 'Partnership', url: '/partnership' },
            { label: 'Advertise', url: '/advertise' },
          ],
        },
        {
          id: 'legal',
          title: 'Legal',
          links: [
            { label: 'Terms', url: '/terms' },
            { label: 'Privacy', url: '/privacy' },
            { label: 'Contact', url: '/contact' },
            { label: 'About', url: '/about' },
          ],
        },
      ],
      newsletterEnabled: true,
    },
    socialLinks: [
      { id: 'social-fb', platform: 'Facebook', url: 'https://www.facebook.com/choosify.bd', isVisible: true, order: 0 },
      { id: 'social-ig', platform: 'Instagram', url: 'https://www.instagram.com/choosify.bd/', isVisible: true, order: 1 },
      { id: 'social-tt', platform: 'TikTok', url: 'https://www.tiktok.com/@choosify5', isVisible: true, order: 2 },
      { id: 'social-yt', platform: 'YouTube', url: 'https://www.youtube.com/@choosify5', isVisible: true, order: 3 },
    ],
    popularSearches: [
      { id: 'ps-samsung', term: 'Samsung', order: 0, isActive: true },
      { id: 'ps-apple', term: 'Apple', order: 1, isActive: true },
      { id: 'ps-aarong', term: 'Aarong', order: 2, isActive: true },
      { id: 'ps-sailor', term: 'Sailor', order: 3, isActive: true },
    ],
    seoEntries: [
      {
        pageId: 'home',
        pageLabel: 'Homepage',
        title: 'Choosify Bangladesh — Smart Product Discovery',
        metaDescription: "Bangladesh's most trusted product discovery platform. Compare prices, read guides, and shop with confidence.",
        keywords: 'choosify, bangladesh, product discovery, compare prices',
        ogImage: '',
        canonicalUrl: 'https://www.choosify.bd/',
      },
      {
        pageId: 'guides',
        pageLabel: 'Recommendations',
        title: 'Buying Guides & Recommendations | Choosify',
        metaDescription: 'Expert buying guides, reviews, and recommendations for Bangladesh shoppers.',
        keywords: 'buying guides, reviews, recommendations',
        ogImage: '',
        canonicalUrl: 'https://www.choosify.bd/guides',
      },
      {
        pageId: 'creators',
        pageLabel: 'Creators',
        title: 'Verified Creators | Choosify',
        metaDescription: 'Discover verified creators producing trusted reviews and buying insights.',
        keywords: 'creators, influencers, tech reviews',
        ogImage: '',
        canonicalUrl: 'https://www.choosify.bd/creators',
      },
    ],
    announcementBarText: '',
    announcementBarEnabled: false,
    updatedAt: ts,
  };
};
