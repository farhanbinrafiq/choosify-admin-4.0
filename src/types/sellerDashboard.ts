export type SellerDashboardRange = '7d' | '30d' | '90d';

export type SellerOverviewMetrics = {
  todaysViews: number;
  productViews7d: number;
  totalProducts: number;
  activeProducts: number;
  pendingProducts: number;
  outOfStockProducts: number;
  wishlistCount: number;
  compareCount: number;
  averageRating: number;
  unreadMessages: number;
  supportTickets: number;
  profileCompletion: number;
};

export type SellerProductIntelligence = {
  id: string;
  title: string;
  brandName: string;
  categoryName: string;
  views: number;
  wishlist: number;
  compareCount: number;
  averageRating: number;
  reviewCount: number;
  stockStatus: 'in_stock' | 'low_stock' | 'out_of_stock';
  stock: number;
  lastUpdated: string;
  approvalStatus: string;
  performanceScore: number;
  isEstimated: boolean;
};

export type SellerPerformanceCharts = {
  dailyProductViews: { date: string; views: number }[];
  weeklyTraffic: { week: string; views: number; orders: number }[];
  monthlyProductPerformance: { month: string; views: number; orders: number }[];
  topPerformingProducts: { id: string; title: string; views: number; score: number }[];
  worstPerformingProducts: { id: string; title: string; views: number; score: number }[];
  categoryPerformance: { category: string; views: number; products: number }[];
  brandPerformance: { brand: string; views: number; products: number }[];
  trafficSources: { source: string; share: number; isPlaceholder: boolean }[];
};

export type SellerHealthScore = {
  score: number;
  grade: 'excellent' | 'good' | 'fair' | 'needs_attention';
  factors: {
    profileCompletion: number;
    verifiedStatus: number;
    responseTime: number;
    activeListings: number;
    averageRating: number;
    pendingComplaints: number;
    rejectedProducts: number;
    missingInformation: number;
  };
  isPartiallyEstimated: boolean;
};

export type SellerActionRecommendation = {
  id: string;
  priority: 'high' | 'medium' | 'low';
  title: string;
  reason: string;
  suggestedAction: string;
};

export type SellerInventoryAlert = {
  id: string;
  type: 'low_stock' | 'out_of_stock' | 'hidden' | 'rejected' | 'pending_review' | 'draft';
  productId: string;
  productTitle: string;
  detail: string;
};

export type SellerDashboardNotification = {
  id: string;
  type: 'approval' | 'rejection' | 'message' | 'system' | 'announcement';
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
};

export type SellerInsight = {
  id: string;
  message: string;
  productId?: string;
  productTitle?: string;
  isPlaceholder: boolean;
};

export type SellerDashboardPayload = {
  sellerId: string;
  sellerName?: string;
  storeName?: string;
  generatedAt: string;
  range: SellerDashboardRange;
  overview: SellerOverviewMetrics;
  performance: SellerPerformanceCharts;
  products: SellerProductIntelligence[];
  healthScore: SellerHealthScore;
  actionCenter: SellerActionRecommendation[];
  inventoryAlerts: SellerInventoryAlert[];
  notifications: SellerDashboardNotification[];
  insights: SellerInsight[];
};
