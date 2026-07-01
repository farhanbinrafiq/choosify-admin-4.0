import type { VercelRequest, VercelResponse } from '@vercel/node';

const products = [
  {
    id: 'prod-s24-ultra',
    slug: 'samsung-galaxy-s24-ultra',
    title: 'Samsung Galaxy S24 Ultra',
    description: 'Flagship Samsung phone with advanced camera features.',
    brandId: 'brand-samsung',
    brandName: 'Samsung',
    categoryId: 'cat-mobile',
    categoryName: 'Mobile & Phones',
    image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400&h=400&fit=crop',
    gallery: [] as string[],
    modeType: 'retail' as const,
    price: 145000,
    originalPrice: 155000,
    stock: 42,
    status: 'live' as const,
    tags: ['NEW'],
    isDeal: true,
    dealType: 'flash' as const,
    discountPercent: 6.5,
    promoCode: 'S24FLASH',
    featuredFlag: true,
    isNewArrival: true,
    isBestseller: true,
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
    image: 'https://images.unsplash.com/photo-1496181133227-f83bb023945d?w=400&h=400&fit=crop',
    gallery: [] as string[],
    modeType: 'retail' as const,
    price: 128000,
    stock: 18,
    status: 'live' as const,
    tags: ['HOT'],
    isDeal: false,
    featuredFlag: true,
    isNewArrival: false,
    isBestseller: true,
  },
];

const categories = [
  { id: 'cat-mobile', slug: 'mobile-phones', name: 'Mobile & Phones', description: 'Smartphones and accessories', icon: 'Smartphone', parentId: null, enabled: true, displayOrder: 0 },
  { id: 'cat-fashion', slug: 'fashion-lifestyle', name: 'Fashion & Lifestyle', description: 'Apparel and fashion accessories', icon: 'Shirt', parentId: null, enabled: true, displayOrder: 1 },
  { id: 'cat-tech', slug: 'tech-electronics', name: 'Tech & Electronics', description: 'Laptops, accessories and gadgets', icon: 'Cpu', parentId: null, enabled: true, displayOrder: 2 },
];

const brands = [
  { id: 'brand-samsung', slug: 'samsung', name: 'Samsung', category: 'Electronics', description: 'Samsung Bangladesh official storefront', logo: 'S', verifiedStatus: true, claimStatus: 'verified' as const, followers: 12400, ratings: 4.8, featuredFlag: true, sponsoredFlag: false },
  { id: 'brand-apple', slug: 'apple', name: 'Apple', category: 'Tech', description: 'Apple products and ecosystem', logo: 'A', verifiedStatus: true, claimStatus: 'verified' as const, followers: 8920, ratings: 4.9, featuredFlag: true, sponsoredFlag: true },
];

const deals = [
  { id: 'deal-s24-flash', slug: 's24-flash-deal', name: 'S24 Ultra Flash Deal', seller: 'Samsung Bangladesh', category: 'Electronics', status: 'live' as const, type: 'retail' as const, discountType: 'percentage' as const, discountValue: 8, promoCode: 'S24FLASH', productId: 'prod-s24-ultra', brandId: 'brand-samsung', clicks: 0 },
];

const homepage = {
  id: 'default',
  heroBanners: [{ id: 'hero-main', headline: "Bangladesh's Most Trusted Product Discovery Platform", subtitle: 'Manage this content from admin dashboard CMS.', ctaText: 'Explore Products', ctaUrl: '/products', backgroundImage: '', isActive: true, order: 0 }],
  sections: [
    { id: 'featured-products', label: 'Featured Products', isVisible: true, order: 0, itemIds: ['prod-s24-ultra', 'prod-macbook-air-m3'] },
    { id: 'featured-brands', label: 'Featured Brands', isVisible: true, order: 1, itemIds: ['brand-samsung', 'brand-apple'] },
    { id: 'featured-deals', label: 'Featured Deals', isVisible: true, order: 2, itemIds: ['deal-s24-flash'] },
  ],
  featuredProductIds: ['prod-s24-ultra', 'prod-macbook-air-m3'],
  featuredBrandIds: ['brand-samsung', 'brand-apple'],
  featuredDealIds: ['deal-s24-flash'],
};

const getCatalogPath = (req: VercelRequest) => {
  const catalogPath = req.query.catalogPath;
  if (typeof catalogPath === 'string') return catalogPath.replace(/^\/+|\/+$/g, '');
  if (Array.isArray(catalogPath) && catalogPath[0]) return catalogPath[0].replace(/^\/+|\/+$/g, '');
  return '';
};

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const catalogPath = getCatalogPath(req);
  if (catalogPath) {
    if (catalogPath === 'products' && req.method === 'GET') {
      res.status(200).json({ data: products, meta: { total: products.length, limit: 100, offset: 0 } });
      return;
    }
    if (catalogPath === 'categories' && req.method === 'GET') {
      res.status(200).json({ data: categories });
      return;
    }
    if (catalogPath === 'brands' && req.method === 'GET') {
      res.status(200).json({ data: brands });
      return;
    }
    if (catalogPath === 'deals' && req.method === 'GET') {
      res.status(200).json({ data: deals });
      return;
    }
    if (catalogPath === 'home' && req.method === 'GET') {
      res.status(200).json({
        homepage,
        featuredProducts: products.filter((item) => homepage.featuredProductIds.includes(item.id)),
        featuredBrands: brands.filter((item) => homepage.featuredBrandIds.includes(item.id)),
        featuredDeals: deals.filter((item) => homepage.featuredDealIds.includes(item.id)),
      });
      return;
    }
    if (catalogPath === 'snapshot' && req.method === 'GET') {
      res.status(200).json({ products, categories, brands, deals, homepage });
      return;
    }
    res.status(404).json({ error: 'Catalog route not found', path: catalogPath });
    return;
  }

  res.status(200).json({ ok: true, service: 'choosify-catalog-api' });
}
