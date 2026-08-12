export type DashboardSearchActorRole = 'admin' | 'seller' | 'creator' | 'other';

export type DashboardSearchGroup =
  | 'Users'
  | 'Orders'
  | 'Products'
  | 'Brands'
  | 'Customers'
  | 'Content'
  | 'Ads & Deals'
  | 'Cashbooks'
  | 'Coupons'
  | 'Finance'
  | 'Messages'
  | 'Disputes / Moderation'
  | 'Pages';

export type DashboardSearchResultType =
  | 'User'
  | 'Order'
  | 'Product'
  | 'Brand'
  | 'Customer'
  | 'Guide'
  | 'Ad'
  | 'Deal'
  | 'Cashbook'
  | 'Coupon'
  | 'FinanceAdjustment'
  | 'MessageThread'
  | 'Dispute'
  | 'Page';

export type DashboardSearchItem = {
  type: DashboardSearchResultType;
  id: string;
  publicId?: string;
  title: string;
  subtitle?: string;
  group: DashboardSearchGroup;
  route: string;
  score?: number;
  exactMatch?: boolean;
};

export type DashboardSearchResponse = {
  success: true;
  query: string;
  groups: Array<{
    group: DashboardSearchGroup;
    items: DashboardSearchItem[];
  }>;
  total: number;
};

