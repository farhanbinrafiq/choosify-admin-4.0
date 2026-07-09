import { catalogStore } from '../../lib/vercel-catalog/catalogStore';
import type { CatalogDeal, CatalogProduct } from '../../src/types/catalog';
import { operationsStore } from './operationsStore';
import type {
  SellerActionRecommendation,
  SellerDashboardNotification,
  SellerDashboardRange,
  SellerHealthScore,
  SellerInsight,
  SellerInventoryAlert,
  SellerOverviewMetrics,
  SellerPerformanceCharts,
  SellerProductIntelligence,
} from './sellerIntelligenceTypes';

export type SellerDashboardQuery = {
  sellerId: string;
  sellerName?: string;
  storeName?: string;
  range?: string;
};

function parseRange(range?: string): SellerDashboardRange {
  if (range === '7d' || range === '30d' || range === '90d') return range;
  return '7d';
}

function inRange(isoDate: string, range: SellerDashboardRange): boolean {
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
  const diff = (Date.now() - new Date(isoDate).getTime()) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= days;
}

function dayKey(isoDate: string): string {
  return isoDate.slice(0, 10);
}

function weekKey(isoDate: string): string {
  const date = new Date(isoDate);
  const start = new Date(date);
  start.setDate(date.getDate() - date.getDay());
  return start.toISOString().slice(0, 10);
}

function monthKey(isoDate: string): string {
  return isoDate.slice(0, 7);
}

function normalize(value: string | undefined): string {
  return (value || '').trim().toLowerCase();
}

function dealMatchesSeller(deal: CatalogDeal, query: SellerDashboardQuery): boolean {
  const sellerField = normalize(deal.seller);
  const sellerId = normalize(query.sellerId);
  const sellerName = normalize(query.sellerName);
  const storeName = normalize(query.storeName);

  if (sellerField.includes(sellerId)) return true;
  if (sellerName && sellerField.includes(sellerName)) return true;
  if (storeName) {
    const token = storeName.split(/\s+/)[0];
    if (token.length > 2 && sellerField.includes(token)) return true;
  }
  return false;
}

function productMatchesSeller(
  product: CatalogProduct,
  sellerBrandIds: Set<string>,
  sellerBrandNames: Set<string>,
  sellerProductIds: Set<string>,
): boolean {
  if (sellerProductIds.has(product.id)) return true;
  if (sellerBrandIds.has(product.brandId)) return true;
  const brandName = normalize(product.brandName);
  for (const name of sellerBrandNames) {
    if (brandName.includes(name) || name.includes(brandName)) return true;
  }
  return false;
}

// TODO: Replace with real product view telemetry when analytics pipeline is available.
function estimateProductViews(product: CatalogProduct, dealClicks: number): number {
  const base = product.isBestseller ? 140 : product.isNewArrival ? 95 : 55;
  const galleryBoost = (product.gallery?.length || 0) * 6;
  const featuredBoost = product.featuredFlag ? 25 : 0;
  const hashBoost = product.id.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % 40;
  return base + galleryBoost + featuredBoost + dealClicks + hashBoost;
}

// TODO: Replace with real wishlist events when wishlist service is integrated.
function estimateWishlist(product: CatalogProduct, views: number): number {
  const conversion = product.isBestseller ? 0.12 : 0.07;
  return Math.max(1, Math.round(views * conversion));
}

// TODO: Replace with real compare events when compare analytics are available.
function estimateCompare(product: CatalogProduct, views: number): number {
  return Math.max(0, Math.round(views * (product.isDeal ? 0.18 : 0.09)));
}

function stockStatus(stock: number): 'in_stock' | 'low_stock' | 'out_of_stock' {
  if (stock <= 0) return 'out_of_stock';
  if (stock <= 5) return 'low_stock';
  return 'in_stock';
}

function performanceScore(input: {
  views: number;
  wishlist: number;
  compareCount: number;
  averageRating: number;
  reviewCount: number;
  stock: number;
  galleryCount: number;
}): number {
  const viewScore = Math.min(30, Math.round(input.views / 10));
  const engagementScore = Math.min(25, input.wishlist + input.compareCount);
  const ratingScore = Math.min(20, Math.round(input.averageRating * 4));
  const reviewScore = Math.min(10, input.reviewCount * 2);
  const stockScore = input.stock > 0 ? 10 : 0;
  const mediaScore = Math.min(5, input.galleryCount);
  return Math.min(100, viewScore + engagementScore + ratingScore + reviewScore + stockScore + mediaScore);
}

function buildProductIntelligence(
  products: CatalogProduct[],
  reviewsByProduct: Map<string, { ratings: number[]; count: number }>,
  dealClicksByProduct: Map<string, number>,
): SellerProductIntelligence[] {
  return products.map((product) => {
    const reviewData = reviewsByProduct.get(product.id);
    const ratings = reviewData?.ratings || [];
    const reviewCount = reviewData?.count || 0;
    const averageRating =
      ratings.length > 0 ? Number((ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)) : 0;
    const dealClicks = dealClicksByProduct.get(product.id) || 0;
    const views = estimateProductViews(product, dealClicks);
    const wishlist = estimateWishlist(product, views);
    const compareCount = estimateCompare(product, views);

    return {
      id: product.id,
      title: product.title,
      brandName: product.brandName,
      categoryName: product.categoryName,
      views,
      wishlist,
      compareCount,
      averageRating,
      reviewCount,
      stockStatus: stockStatus(product.stock),
      stock: product.stock,
      lastUpdated: product.updatedAt,
      approvalStatus: product.status,
      performanceScore: performanceScore({
        views,
        wishlist,
        compareCount,
        averageRating,
        reviewCount,
        stock: product.stock,
        galleryCount: product.gallery?.length || 0,
      }),
      isEstimated: true,
    };
  });
}

function buildOverview(
  products: SellerProductIntelligence[],
  reviews: ReturnType<typeof operationsStore.listReviews>,
  sellerName?: string,
  storeName?: string,
): SellerOverviewMetrics {
  const totalViews = products.reduce((sum, p) => sum + p.views, 0);
  const todaysViews = Math.max(0, Math.round(totalViews * 0.08));
  const productViews7d = totalViews;

  const sellerReviews = reviews.filter((review) => {
    const store = normalize(review.storeName);
    const name = normalize(sellerName);
    const storeLabel = normalize(storeName);
    return (name && store.includes(name)) || (storeLabel && store.includes(storeLabel.split(' ')[0]));
  });

  const averageRating =
    sellerReviews.length > 0
      ? Number(
          (
            sellerReviews.reduce((sum, review) => sum + review.rating, 0) / sellerReviews.length
          ).toFixed(1),
        )
      : 0;

  const unansweredReviews = sellerReviews.filter((review) => !review.response).length;

  // TODO: Wire unread message count from messaging conversations when seller-scoped inbox is available.
  const unreadMessages = Math.max(unansweredReviews, 2);

  // TODO: Wire support ticket count from operations ticket store when available.
  const supportTickets = sellerReviews.filter((review) => review.status === 'flagged').length;

  // TODO: Replace with seller profile completeness API when profile service exposes completion %.
  const profileCompletion = 72;

  return {
    todaysViews,
    productViews7d,
    totalProducts: products.length,
    activeProducts: products.filter((p) => p.approvalStatus === 'live').length,
    pendingProducts: products.filter((p) => p.approvalStatus === 'draft').length,
    outOfStockProducts: products.filter((p) => p.stockStatus === 'out_of_stock').length,
    wishlistCount: products.reduce((sum, p) => sum + p.wishlist, 0),
    compareCount: products.reduce((sum, p) => sum + p.compareCount, 0),
    averageRating,
    unreadMessages,
    supportTickets,
    profileCompletion,
  };
}

function buildPerformanceCharts(
  products: SellerProductIntelligence[],
  range: SellerDashboardRange,
  orders: ReturnType<typeof operationsStore.listOrders>,
  sellerId: string,
): SellerPerformanceCharts {
  const sellerOrders = orders.filter((order) =>
    (order.subOrders as { sellerId?: string }[] | undefined)?.some(
      (sub) => normalize(sub.sellerId) === normalize(sellerId),
    ),
  );

  const filteredOrders = sellerOrders.filter((order) => inRange(order.createdAt, range));

  const dailyMap = new Map<string, { date: string; views: number }>();
  const weeklyMap = new Map<string, { week: string; views: number; orders: number }>();
  const monthlyMap = new Map<string, { month: string; views: number; orders: number }>();

  for (const product of products) {
    const perDay = Math.max(1, Math.round(product.views / (range === '7d' ? 7 : range === '30d' ? 30 : 90)));
    for (let i = 0; i < (range === '7d' ? 7 : range === '30d' ? 30 : 14); i += 1) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const key = dayKey(date.toISOString());
      const row = dailyMap.get(key) || { date: key, views: 0 };
      row.views += perDay;
      dailyMap.set(key, row);
    }
  }

  for (const order of filteredOrders) {
    const week = weekKey(order.createdAt);
    const month = monthKey(order.createdAt);
    const weekRow = weeklyMap.get(week) || { week, views: 0, orders: 0 };
    weekRow.orders += 1;
    weekRow.views += 20;
    weeklyMap.set(week, weekRow);

    const monthRow = monthlyMap.get(month) || { month, views: 0, orders: 0 };
    monthRow.orders += 1;
    monthRow.views += 20;
    monthlyMap.set(month, monthRow);
  }

  const sortedProducts = [...products].sort((a, b) => b.performanceScore - a.performanceScore);
  const topPerformingProducts = sortedProducts.slice(0, 5).map((p) => ({
    id: p.id,
    title: p.title,
    views: p.views,
    score: p.performanceScore,
  }));
  const worstPerformingProducts = [...sortedProducts]
    .reverse()
    .slice(0, 5)
    .map((p) => ({
      id: p.id,
      title: p.title,
      views: p.views,
      score: p.performanceScore,
    }));

  const categoryMap = new Map<string, { category: string; views: number; products: number }>();
  const brandMap = new Map<string, { brand: string; views: number; products: number }>();

  for (const product of products) {
    const categoryRow = categoryMap.get(product.categoryName) || {
      category: product.categoryName,
      views: 0,
      products: 0,
    };
    categoryRow.views += product.views;
    categoryRow.products += 1;
    categoryMap.set(product.categoryName, categoryRow);

    const brandRow = brandMap.get(product.brandName) || {
      brand: product.brandName,
      views: 0,
      products: 0,
    };
    brandRow.views += product.views;
    brandRow.products += 1;
    brandMap.set(product.brandName, brandRow);
  }

  return {
    dailyProductViews: [...dailyMap.values()].sort((a, b) => (a.date < b.date ? -1 : 1)),
    weeklyTraffic: [...weeklyMap.values()].sort((a, b) => (a.week < b.week ? -1 : 1)),
    monthlyProductPerformance: [...monthlyMap.values()].sort((a, b) => (a.month < b.month ? -1 : 1)),
    topPerformingProducts,
    worstPerformingProducts,
    categoryPerformance: [...categoryMap.values()].sort((a, b) => b.views - a.views),
    brandPerformance: [...brandMap.values()].sort((a, b) => b.views - a.views),
    trafficSources: [
      { source: 'Organic Search', share: 42, isPlaceholder: true },
      { source: 'Direct', share: 28, isPlaceholder: true },
      { source: 'Choosify Homepage', share: 18, isPlaceholder: true },
      { source: 'Social', share: 12, isPlaceholder: true },
    ],
  };
}

function buildHealthScore(
  overview: SellerOverviewMetrics,
  products: SellerProductIntelligence[],
  reviews: ReturnType<typeof operationsStore.listReviews>,
): SellerHealthScore {
  const verifiedStatus = 80;
  const responsePenalty = Math.min(20, overview.unreadMessages * 3);
  const responseTime = Math.max(0, 100 - responsePenalty);
  const activeListings =
    overview.totalProducts > 0
      ? Math.round((overview.activeProducts / overview.totalProducts) * 100)
      : 0;
  const ratingScore = Math.round((overview.averageRating / 5) * 100);
  const pendingComplaints = reviews.filter((review) => review.status === 'flagged').length;
  const complaintPenalty = Math.min(25, pendingComplaints * 5);
  const rejectedProducts = products.filter((p) => p.approvalStatus === 'archived').length;
  const rejectedPenalty = Math.min(20, rejectedProducts * 4);
  const missingInformation = products.filter(
    (p) => p.reviewCount === 0 || p.stockStatus === 'out_of_stock',
  ).length;
  const missingPenalty = Math.min(15, missingInformation * 2);

  const factors = {
    profileCompletion: overview.profileCompletion,
    verifiedStatus,
    responseTime,
    activeListings,
    averageRating: ratingScore,
    pendingComplaints: Math.max(0, 100 - complaintPenalty),
    rejectedProducts: Math.max(0, 100 - rejectedPenalty),
    missingInformation: Math.max(0, 100 - missingPenalty),
  };

  const score = Math.round(
    factors.profileCompletion * 0.15 +
      factors.verifiedStatus * 0.1 +
      factors.responseTime * 0.15 +
      factors.activeListings * 0.2 +
      factors.averageRating * 0.2 +
      factors.pendingComplaints * 0.1 +
      factors.rejectedProducts * 0.05 +
      factors.missingInformation * 0.05,
  );

  const grade =
    score >= 85 ? 'excellent' : score >= 70 ? 'good' : score >= 50 ? 'fair' : 'needs_attention';

  return {
    score: Math.min(100, Math.max(0, score)),
    grade,
    factors,
    isPartiallyEstimated: true,
  };
}

function buildActionCenter(
  overview: SellerOverviewMetrics,
  products: SellerProductIntelligence[],
): SellerActionRecommendation[] {
  const actions: SellerActionRecommendation[] = [];

  if (overview.profileCompletion < 90) {
    actions.push({
      id: 'complete-profile',
      priority: 'high',
      title: 'Complete Profile',
      reason: `Profile is ${overview.profileCompletion}% complete.`,
      suggestedAction: 'Add business details, contact info, and store branding.',
    });
  }

  if (overview.outOfStockProducts > 0) {
    actions.push({
      id: 'restock-products',
      priority: 'high',
      title: 'Restock Product',
      reason: `${overview.outOfStockProducts} products are out of stock.`,
      suggestedAction: 'Update inventory for out-of-stock listings.',
    });
  }

  if (overview.unreadMessages > 0) {
    actions.push({
      id: 'respond-customer',
      priority: 'high',
      title: 'Respond to Customer',
      reason: `${overview.unreadMessages} unread messages or unanswered reviews.`,
      suggestedAction: 'Reply to buyer messages and product reviews.',
    });
  }

  const lowImageProduct = products.find((p) => p.performanceScore < 50);
  if (lowImageProduct) {
    actions.push({
      id: 'add-product-images',
      priority: 'medium',
      title: 'Add Product Images',
      reason: `"${lowImageProduct.title}" has a low performance score.`,
      suggestedAction: 'Upload at least 5 high-quality product images.',
    });
  }

  const weakDescription = products.find((p) => p.reviewCount === 0 && p.views > 50);
  if (weakDescription) {
    actions.push({
      id: 'improve-description',
      priority: 'medium',
      title: 'Improve Product Description',
      reason: `"${weakDescription.title}" gets views but no reviews.`,
      suggestedAction: 'Expand specifications, sizing, and care instructions.',
    });
  }

  actions.push({
    id: 'verify-business',
    priority: 'medium',
    title: 'Verify Business',
    reason: 'Verified sellers receive higher trust placement.',
    suggestedAction: 'Submit business verification documents.',
  });

  actions.push({
    id: 'upload-cover-image',
    priority: 'low',
    title: 'Upload Cover Image',
    reason: 'Storefront cover images improve brand recall.',
    suggestedAction: 'Add a branded cover image to your seller profile.',
  });

  return actions.slice(0, 8);
}

function buildInventoryAlerts(products: CatalogProduct[]): SellerInventoryAlert[] {
  const alerts: SellerInventoryAlert[] = [];

  for (const product of products) {
    if (product.stock <= 0) {
      alerts.push({
        id: `oos-${product.id}`,
        type: 'out_of_stock',
        productId: product.id,
        productTitle: product.title,
        detail: 'No units available',
      });
    } else if (product.stock <= 5) {
      alerts.push({
        id: `low-${product.id}`,
        type: 'low_stock',
        productId: product.id,
        productTitle: product.title,
        detail: `${product.stock} units remaining`,
      });
    }

    if (product.status === 'draft') {
      alerts.push({
        id: `draft-${product.id}`,
        type: 'draft',
        productId: product.id,
        productTitle: product.title,
        detail: 'Draft listing not visible to buyers',
      });
    }

    if (product.status === 'archived') {
      alerts.push({
        id: `rejected-${product.id}`,
        type: 'rejected',
        productId: product.id,
        productTitle: product.title,
        detail: 'Archived or rejected listing',
      });
    }
  }

  return alerts.slice(0, 20);
}

function buildNotifications(
  products: CatalogProduct[],
  reviews: ReturnType<typeof operationsStore.listReviews>,
  sellerName?: string,
): SellerDashboardNotification[] {
  const notifications: SellerDashboardNotification[] = [];
  const liveProducts = products.filter((p) => p.status === 'live').slice(0, 2);

  for (const product of liveProducts) {
    notifications.push({
      id: `approval-${product.id}`,
      type: 'approval',
      title: 'Product Approved',
      body: `${product.title} is live on Choosify.`,
      createdAt: product.updatedAt,
      read: false,
    });
  }

  const flagged = reviews.filter((review) => review.status === 'flagged').slice(0, 2);
  for (const review of flagged) {
    notifications.push({
      id: `rejection-${review.id}`,
      type: 'rejection',
      title: 'Review Flagged',
      body: `Review for ${review.productTitle} needs attention.`,
      createdAt: review.updatedAt,
      read: false,
    });
  }

  const unanswered = reviews.filter((review) => !review.response).slice(0, 2);
  for (const review of unanswered) {
    notifications.push({
      id: `message-${review.id}`,
      type: 'message',
      title: 'New Customer Feedback',
      body: `${review.userName} left a ${review.rating}-star review.`,
      createdAt: review.createdAt,
      read: false,
    });
  }

  notifications.push({
    id: 'announcement-platform',
    type: 'announcement',
    title: 'Choosify Seller Update',
    body: `${sellerName || 'Seller'}, new visibility tools are available in your dashboard.`,
    createdAt: new Date().toISOString(),
    read: true,
  });

  return notifications
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 10);
}

function buildInsights(products: SellerProductIntelligence[]): SellerInsight[] {
  const insights: SellerInsight[] = [];

  const highViewsLowWishlist = products.find((p) => p.views > 80 && p.wishlist < 8);
  if (highViewsLowWishlist) {
    insights.push({
      id: 'views-wishlist-gap',
      message: `"${highViewsLowWishlist.title}" receives many views but few wishlists.`,
      productId: highViewsLowWishlist.id,
      productTitle: highViewsLowWishlist.title,
      isPlaceholder: false,
    });
  }

  const highCompare = products.find((p) => p.compareCount > 10);
  if (highCompare) {
    insights.push({
      id: 'compare-heavy',
      message: 'Customers compare this product often.',
      productId: highCompare.id,
      productTitle: highCompare.title,
      isPlaceholder: false,
    });
  }

  const richGalleryPerformer = products.find((p) => p.performanceScore >= 70);
  if (richGalleryPerformer) {
    insights.push({
      id: 'image-performance',
      message: 'Products with richer media and complete details perform better.',
      productId: richGalleryPerformer.id,
      productTitle: richGalleryPerformer.title,
      isPlaceholder: true,
    });
  }

  if (insights.length === 0) {
    insights.push({
      id: 'placeholder-insight',
      message: 'Add more live products to unlock personalized seller insights.',
      isPlaceholder: true,
    });
  }

  return insights;
}

export async function getSellerDashboardIntelligence(query: SellerDashboardQuery) {
  const range = parseRange(query.range);
  const [allProducts, allDeals] = await Promise.all([
    catalogStore.listProducts(),
    catalogStore.listDeals(),
  ]);

  const sellerDeals = allDeals.filter((deal) => dealMatchesSeller(deal, query));
  const sellerBrandIds = new Set(
    sellerDeals.map((deal) => deal.brandId).filter((id): id is string => Boolean(id)),
  );
  const sellerBrandNames = new Set(
    [
      ...sellerDeals.map((deal) => normalize(deal.seller)),
      normalize(query.sellerName),
      normalize(query.storeName),
    ].filter(Boolean),
  );

  const orders = operationsStore.listOrders();
  const sellerProductIds = new Set<string>();
  for (const order of orders) {
    for (const sub of (order.subOrders as { sellerId?: string; productId?: string }[]) || []) {
      if (normalize(sub.sellerId) === normalize(query.sellerId) && sub.productId) {
        sellerProductIds.add(sub.productId);
      }
    }
  }

  let sellerProducts = allProducts.filter((product) =>
    productMatchesSeller(product, sellerBrandIds, sellerBrandNames, sellerProductIds),
  );

  if (sellerProducts.length === 0) {
    sellerProducts = allProducts.slice(0, Math.min(8, allProducts.length));
  }

  const reviews = operationsStore.listReviews();
  const reviewsByProduct = new Map<string, { ratings: number[]; count: number }>();
  for (const review of reviews) {
    const row = reviewsByProduct.get(review.productId) || { ratings: [], count: 0 };
    row.ratings.push(review.rating);
    row.count += 1;
    reviewsByProduct.set(review.productId, row);
  }

  const dealClicksByProduct = new Map<string, number>();
  for (const deal of sellerDeals) {
    if (!deal.productId) continue;
    dealClicksByProduct.set(
      deal.productId,
      (dealClicksByProduct.get(deal.productId) || 0) + Number(deal.clicks || 0),
    );
  }

  const productIntelligence = buildProductIntelligence(sellerProducts, reviewsByProduct, dealClicksByProduct);
  const overview = buildOverview(productIntelligence, reviews, query.sellerName, query.storeName);
  const performance = buildPerformanceCharts(productIntelligence, range, orders, query.sellerId);
  const healthScore = buildHealthScore(overview, productIntelligence, reviews);
  const actionCenter = buildActionCenter(overview, productIntelligence);
  const inventoryAlerts = buildInventoryAlerts(sellerProducts);
  const notifications = buildNotifications(sellerProducts, reviews, query.sellerName);
  const insights = buildInsights(productIntelligence);

  return {
    sellerId: query.sellerId,
    sellerName: query.sellerName,
    storeName: query.storeName,
    generatedAt: new Date().toISOString(),
    range,
    overview,
    performance,
    products: productIntelligence,
    healthScore,
    actionCenter,
    inventoryAlerts,
    notifications,
    insights,
  };
}
