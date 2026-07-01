import type { CatalogCreator, CatalogGuide, CatalogPlacement, CatalogProductDetail } from './catalogEditorialTypes';

const nowIso = () => new Date().toISOString();

export const defaultCreators = (): CatalogCreator[] => {
  const ts = nowIso();
  return [
    {
      id: 'creator-farhan',
      slug: 'farhan-bin-rafiq',
      name: 'Farhan Bin Rafiq',
      handle: '@farhan_tech',
      avatar: 'https://res.cloudinary.com/djdyqr8yd/image/upload/v1781880900/FBR_n3eycm.png',
      score: 96,
      bestFor: 'Tech',
      bestForTags: ['Smartphones', 'Laptops', 'Gadget Guides'],
      platforms: ['YouTube', 'Facebook'],
      bio: 'Senior Tech Analyst & Digital Product Researcher covering electronics in Bangladesh.',
      followers: { YouTube: '450K', Facebook: '120K' },
      email: 'farhan.outreach@choosify.bd',
      phone: '+880 1712-345678',
      category: 'Tech',
      verifiedStatus: true,
      featuredFlag: true,
      videos: [],
      reels: [],
      blogs: [],
      status: 'live',
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: 'creator-sarah',
      slug: 'sarah-jenkins',
      name: 'Sarah Jenkins',
      handle: '@sarah_style',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop',
      score: 92,
      bestFor: 'Fashion',
      bestForTags: ['Fashion', 'Beauty', 'Lifestyle'],
      platforms: ['Instagram', 'YouTube'],
      bio: 'Fashion and lifestyle reviewer focused on Bangladesh brands.',
      followers: { Instagram: '210K', YouTube: '85K' },
      category: 'Fashion',
      verifiedStatus: true,
      featuredFlag: true,
      videos: [],
      reels: [],
      blogs: [],
      status: 'live',
      createdAt: ts,
      updatedAt: ts,
    },
  ];
};

export const defaultGuides = (): CatalogGuide[] => {
  const ts = nowIso();
  return [
    {
      id: 'guide-top-smartphones-2026',
      slug: 'top-10-smartphones-2026',
      title: 'Top 10 Smartphones to Buy in 2026',
      author: 'Farhan Rafiq',
      authorAvatar: 'https://res.cloudinary.com/djdyqr8yd/image/upload/v1781880900/FBR_n3eycm.png',
      category: 'MOBILE',
      excerpt: 'The best options available right now, from titanium flagships to budget-friendly powerhouses.',
      image: 'https://images.unsplash.com/photo-1556656793-062ff9f1b74b?w=1200&h=800&fit=crop',
      type: 'article',
      readTime: '15 MIN READ',
      views: '125K',
      shares: '12K',
      tags: ['smartphones', 'flagship', 'budget'],
      creatorId: 'creator-farhan',
      productIds: ['prod-s24-ultra'],
      whatWeLike: ['Excellent camera', 'Long battery life'],
      whatToConsider: ['Premium pricing'],
      status: 'live',
      publishedAt: ts,
      updatedAt: ts,
    },
    {
      id: 'guide-s24-ultra-review',
      slug: 's24-ultra-still-worth-it',
      title: 'Is the S24 Ultra Still Worth It in Late 2026?',
      author: 'Sarah Jenkins',
      category: 'MOBILE',
      excerpt: 'We revisit Samsung\'s titanium giant after 6 months of heavy usage.',
      image: 'https://images.unsplash.com/photo-1707251759491-18d48607ea0c?w=1200&h=675&fit=crop',
      videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-taking-photos-with-a-smartphone-34356-large.mp4',
      duration: '12:45',
      type: 'video',
      readTime: '12 MIN VIDEO',
      views: '540K',
      shares: '45K',
      tags: ['samsung', 'review'],
      creatorId: 'creator-sarah',
      productIds: ['prod-s24-ultra'],
      whatWeLike: ['Display quality', 'Build'],
      whatToConsider: ['Weight'],
      status: 'live',
      publishedAt: ts,
      updatedAt: ts,
    },
  ];
};

export const defaultPlacements = (): CatalogPlacement[] => {
  const ts = nowIso();
  const end = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  return [
    {
      id: 'placement-samsung-spotlight',
      entityType: 'brand',
      entityId: 'brand-samsung',
      sponsorType: 'spotlight_brand',
      placement: 'spotlight_section',
      startDate: ts,
      endDate: end,
      hasCountdown: false,
      priority: 10,
      isActive: true,
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: 'placement-s24-deal',
      entityType: 'product',
      entityId: 'prod-s24-ultra',
      sponsorType: 'sponsored_deal',
      placement: 'deals_section',
      startDate: ts,
      endDate: end,
      hasCountdown: true,
      dealPrice: 145000,
      originalPrice: 155000,
      priority: 20,
      isActive: true,
      createdAt: ts,
      updatedAt: ts,
    },
  ];
};

export const defaultProductDetails = (): CatalogProductDetail[] => {
  const ts = nowIso();
  return [
    {
      productId: 'prod-s24-ultra',
      about: 'Flagship Samsung phone with advanced camera features and titanium frame.',
      specs: [
        { key: 'Display', value: '6.8" Dynamic AMOLED 2X' },
        { key: 'Storage', value: '256GB' },
        { key: 'Camera', value: '200MP main sensor' },
      ],
      pros: ['Excellent camera', 'Premium build', 'Long software support'],
      cons: ['Heavy', 'High price'],
      bestForTags: ['Photography', 'Power users', 'Premium buyers'],
      storeComparisonList: [],
      physicalStores: [],
      overviewBlocks: [],
      optionGroups: [],
      productVariants: [],
      creatorContent: [],
      seoTitle: 'Samsung Galaxy S24 Ultra Price in Bangladesh',
      seoDescription: 'Compare Samsung Galaxy S24 Ultra prices and verified sellers on Choosify.',
      seoKeywords: 's24 ultra, samsung bangladesh, smartphone',
      updatedAt: ts,
    },
  ];
};
