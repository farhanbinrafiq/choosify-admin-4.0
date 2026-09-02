import { operationsStore, DEFAULT_ROLE_PERMISSIONS } from './operationsStore';
import { shipmentStore } from './shipmentStore';
import type { PermissionKey } from './types';

export type AnalyticsRange = '7d' | '30d' | '90d' | 'all';

function parseRange(range: string | undefined): AnalyticsRange {
  if (range === '7d' || range === '30d' || range === '90d') return range;
  return 'all';
}

function inRange(isoDate: string, range: AnalyticsRange): boolean {
  if (range === 'all') return true;
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
  const diff = (Date.now() - new Date(isoDate).getTime()) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= days;
}

function dayKey(isoDate: string): string {
  return isoDate.slice(0, 10);
}

function buildDailySeries(range: AnalyticsRange) {
  const orders = operationsStore.listOrders().filter((o) => inRange(o.createdAt, range));
  const map = new Map<string, { date: string; orders: number; revenue: number; leads: number }>();

  for (const order of orders) {
    const key = dayKey(order.createdAt);
    const row = map.get(key) || { date: key, orders: 0, revenue: 0, leads: 0 };
    row.orders += 1;
    row.revenue += Number(order.overallTotal || 0);
    map.set(key, row);
  }

  for (const lead of operationsStore.listLeads().filter((l) => inRange(l.createdAt, range))) {
    const key = dayKey(lead.createdAt);
    const row = map.get(key) || { date: key, orders: 0, revenue: 0, leads: 0 };
    row.leads += 1;
    map.set(key, row);
  }

  return [...map.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}

export function getAnalyticsSummary(rangeInput?: string) {
  const range = parseRange(rangeInput);
  const orders = operationsStore.listOrders().filter((o) => inRange(o.createdAt, range));
  const leads = operationsStore.listLeads().filter((l) => inRange(l.createdAt, range));
  const reviews = operationsStore.listReviews().filter((r) => inRange(r.createdAt, range));
  const shipments = shipmentStore.listShipments().filter((s) => inRange(s.createdAt, range));
  const coupons = operationsStore.listCoupons();

  const revenue = orders.reduce((sum, o) => sum + Number(o.overallTotal || 0), 0);
  const promoDiscount = orders.reduce((sum, o) => sum + Number(o.promoDiscount || 0), 0);
  const pendingReviews = reviews.filter((r) => r.status === 'pending' || r.status === 'flagged').length;
  const newLeads = leads.filter((l) => l.status === 'new').length;
  const pendingShipments = shipments.filter(
    (s) => s.status === 'pending_pickup' || s.status === 'picked_up' || s.status === 'in_transit',
  ).length;

  return {
    range,
    generatedAt: new Date().toISOString(),
    orders: {
      total: orders.length,
      revenue,
      promoDiscount,
      cod: orders.filter((o) => o.isCOD).length,
    },
    leads: {
      total: leads.length,
      new: newLeads,
      contacted: leads.filter((l) => l.status === 'contacted').length,
      qualified: leads.filter((l) => l.status === 'qualified').length,
    },
    reviews: {
      total: reviews.length,
      pending: pendingReviews,
      published: reviews.filter((r) => r.status === 'published').length,
    },
    shipments: {
      total: shipments.length,
      pending: pendingShipments,
      delivered: shipments.filter((s) => s.status === 'delivered').length,
    },
    coupons: {
      active: coupons.filter((c) => c.active).length,
      totalRedemptions: coupons.reduce((sum, c) => sum + c.totalRedemptions, 0),
      totalDiscountGiven: coupons.reduce((sum, c) => sum + c.totalDiscountGiven, 0),
    },
    daily: buildDailySeries(range),
  };
}

export type RoleAnalyticsOptions = {
  ownerId?: string;
  activeBrandId?: string | null;
  /** Precomputed owned brand IDs for seller scoping */
  ownedBrandIds?: string[];
};

function normalizeId(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function orderBelongsToOwner(
  order: { subOrders?: { sellerId?: string; brandId?: string; productId?: string }[] },
  ownerId: string,
  brandIds: Set<string>,
  activeBrandId?: string | null,
): boolean {
  const subs = order.subOrders || [];
  if (!subs.length) return false;
  return subs.some((sub) => {
    const sellerMatch = normalizeId(sub.sellerId) === normalizeId(ownerId);
    const brandMatch = sub.brandId ? brandIds.has(normalizeId(sub.brandId)) : false;
    if (!sellerMatch && !brandMatch) return false;
    if (activeBrandId) {
      return normalizeId(sub.brandId) === normalizeId(activeBrandId);
    }
    return true;
  });
}

export function getRoleAnalytics(
  role: string,
  rangeInput?: string,
  options?: RoleAnalyticsOptions,
) {
  const summary = getAnalyticsSummary(rangeInput);
  const permissions: Record<PermissionKey, boolean> =
    operationsStore.getPermissions()[role] ||
    DEFAULT_ROLE_PERMISSIONS[role] ||
    DEFAULT_ROLE_PERMISSIONS.admin;

  const quickLinks: { label: string; path: string }[] = [];

  if (permissions.content) {
    quickLinks.push({ label: 'Products', path: '/admin/products' });
    quickLinks.push({ label: 'Reviews', path: '/admin/reviews' });
  }
  if (permissions.users) {
    quickLinks.push({ label: 'Platform Orders', path: '/admin/platform-orders' });
    quickLinks.push({ label: 'Consumers', path: '/admin/consumers' });
  }
  if (permissions.finance) {
    quickLinks.push({ label: 'Payouts', path: '/admin/payouts' });
    quickLinks.push({ label: 'Cash Book', path: '/admin/cashbook' });
  }
  if (permissions.brand) {
    quickLinks.push({ label: 'Brand Posts', path: '/admin/brand-posts' });
    quickLinks.push({ label: 'Leads', path: '/admin/leads' });
  }
  if (permissions.analytics) {
    quickLinks.push({ label: 'Analytics', path: '/admin/analytics' });
  }
  // Seller/creator have their own real conversation view -- the shared
  // 'messages' page key still points staff at the legacy CmsMirror-hosted
  // /admin/messages screen on purpose (see App.tsx route comment).
  const isPartnerRole = role === 'seller' || role === 'verified_seller' || role === 'creator';
  quickLinks.push({ label: 'Messages', path: isPartnerRole ? '/admin/conversations' : '/admin/messages' });

  const cards: { label: string; value: string; sub?: string }[] = [];
  const ownerId = options?.ownerId?.trim() || '';
  const activeBrandId = options?.activeBrandId || null;
  const ownedBrandIds = new Set(
    (options?.ownedBrandIds || []).map((id) => normalizeId(id)).filter(Boolean),
  );
  if (activeBrandId) ownedBrandIds.add(normalizeId(activeBrandId));

  if (role === 'seller' && ownerId) {
    const range = parseRange(rangeInput);
    const orders = operationsStore
      .listOrders()
      .filter((o) => inRange(o.createdAt, range))
      .filter((o) => orderBelongsToOwner(o, ownerId, ownedBrandIds, activeBrandId));
    const revenue = orders.reduce((sum, o) => sum + Number(o.overallTotal || 0), 0);
    cards.push(
      {
        label: 'Your Orders',
        value: String(orders.length),
        sub: activeBrandId ? 'Active Brand scoped' : 'All owned Brands',
      },
      {
        label: 'Your Revenue',
        value: `৳ ${revenue.toLocaleString()}`,
        sub: orders.length ? `${orders.length} orders` : 'No data yet',
      },
      {
        label: 'Owned Brands',
        value: String(ownedBrandIds.size || (activeBrandId ? 1 : 0)),
        sub: activeBrandId ? 'Filtered to Active Brand' : 'Aggregated',
      },
      {
        label: 'Insights',
        value: orders.length ? 'Available' : 'No data',
        sub: 'Ownership-scoped only',
      },
    );
  } else if (role === 'creator' && ownerId) {
    // No canonical Creator-attribution analytics exists (guides, engagement,
    // earnings). The Creator dashboard reads canonical guide/profile data
    // directly (GET /catalog/guides/manage, /catalog/creators) — this endpoint
    // must not hand back fabricated placeholder KPI strings.
    // cards stays [].
  } else {
    switch (role) {
      case 'finance_manager':
        cards.push(
          { label: 'Platform Revenue', value: `৳ ${summary.orders.revenue.toLocaleString()}`, sub: `${summary.orders.total} orders` },
          { label: 'Promo Discounts', value: `৳ ${summary.orders.promoDiscount.toLocaleString()}`, sub: 'Redeemed at checkout' },
          { label: 'Coupon Savings', value: `৳ ${summary.coupons.totalDiscountGiven.toLocaleString()}`, sub: `${summary.coupons.totalRedemptions} redemptions` },
          { label: 'COD Orders', value: String(summary.orders.cod), sub: 'Cash on delivery' },
        );
        break;
      case 'support_agent':
        cards.push(
          { label: 'Platform Orders', value: String(summary.orders.total), sub: 'Storefront checkout' },
          { label: 'Open Shipments', value: String(summary.shipments.pending), sub: `${summary.shipments.delivered} delivered` },
          { label: 'Pending Reviews', value: String(summary.reviews.pending), sub: 'Needs moderation' },
          { label: 'New Leads', value: String(summary.leads.new), sub: `${summary.leads.total} total leads` },
        );
        break;
      case 'marketing_manager':
        cards.push(
          { label: 'Advertise Leads', value: String(summary.leads.total), sub: `${summary.leads.new} new` },
          { label: 'Active Coupons', value: String(summary.coupons.active), sub: `${summary.coupons.totalRedemptions} uses` },
          { label: 'Orders (Campaign)', value: String(summary.orders.total), sub: `৳ ${summary.orders.revenue.toLocaleString()} revenue` },
          { label: 'Promo Savings', value: `৳ ${summary.orders.promoDiscount.toLocaleString()}`, sub: 'Attributed discounts' },
        );
        break;
      case 'moderator':
        cards.push(
          { label: 'Pending Reviews', value: String(summary.reviews.pending), sub: 'Awaiting action' },
          { label: 'Published Reviews', value: String(summary.reviews.published), sub: 'Live on site' },
          { label: 'Total Reviews', value: String(summary.reviews.total), sub: 'In pipeline' },
          { label: 'Platform Orders', value: String(summary.orders.total), sub: 'For dispute context' },
        );
        break;
      case 'admin':
        cards.push(
          { label: 'Storefront Orders', value: String(summary.orders.total), sub: `৳ ${summary.orders.revenue.toLocaleString()}` },
          { label: 'Shipments', value: String(summary.shipments.total), sub: `${summary.shipments.pending} in transit` },
          { label: 'Leads Inbox', value: String(summary.leads.new), sub: `${summary.leads.total} total` },
          { label: 'Review Queue', value: String(summary.reviews.pending), sub: 'Needs moderation' },
        );
        break;
      default:
        cards.push(
          { label: 'Orders', value: String(summary.orders.total), sub: `৳ ${summary.orders.revenue.toLocaleString()}` },
          { label: 'Leads', value: String(summary.leads.total), sub: `${summary.leads.new} new` },
          { label: 'Reviews', value: String(summary.reviews.total), sub: `${summary.reviews.pending} pending` },
          { label: 'Shipments', value: String(summary.shipments.total), sub: `${summary.shipments.pending} active` },
        );
    }
  }

  const scopedSummary =
    (role === 'seller' || role === 'creator') && ownerId
      ? {
          ...summary,
          orders: {
            total: cards[0]?.value === String(Number(cards[0]?.value)) ? Number(cards[0].value) : 0,
            revenue: 0,
            promoDiscount: 0,
            cod: 0,
          },
          // A partner-scoped payload must never carry the platform-wide daily
          // series — that would render as a "your orders" trend built from
          // every seller's checkout. Partner dashboards build their own trend
          // from actor-scoped orders instead.
          daily: [],
          scoped: true,
          ownerId,
          activeBrandId: activeBrandId || null,
        }
      : summary;

  return {
    role,
    permissions: permissions as Record<PermissionKey, boolean>,
    cards,
    quickLinks,
    summary: scopedSummary,
  };
}
