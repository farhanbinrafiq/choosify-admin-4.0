import { ilike, or } from 'drizzle-orm';
import type { DashboardSearchGroup, DashboardSearchItem } from './dashboardSearchTypes';
import { parseReferenceId } from '../../shared/referenceIds/registry';
import { lookupReferenceIndex, ensureReferenceIdSchema } from '../referenceIds/referenceIdService';
import { findUserByChoosifyUserId, normalizeChoosifyUserIdQuery } from '../auth/choosifyUserId';
import { catalogStore } from '../../lib/vercel-catalog/catalogStore';
import { adsStore } from '../ads/adsStore';
import { operationsStore } from '../operations/operationsStore';
import { commerceStore } from '../commerce/commerceStore';
import { searchConversationsForActor } from '../messaging/conversations/conversationService';
import { listMyCustomersForOwner } from '../catalog/sellerWorkspace';
import { getCashbookForOwner, listCashbooksForOwner } from '../cashbook/cashbookStore';
import { db } from '../db/client';
import { users } from '../db/schema';
import {
  NAV_DEFS,
  PAGE_META,
  allowedPageKeysForRole,
} from '../../src/cms-mirror/nav';

// NOTE: This service is intentionally conservative: it relies on existing
// domain stores/services that already implement ownership scoping, and only
// applies additional q filtering + output shaping here.

function isStaffRole(role?: string): boolean {
  const r = (role || '').toLowerCase();
  return r === 'admin' || r === 'super_admin' || r === 'superadmin' || r === 'moderator' || r === 'finance_manager' || r === 'support_agent' || r === 'marketing_manager';
}

function isSellerRole(role?: string): boolean {
  const r = (role || '').toLowerCase();
  return r === 'seller' || r === 'verified_seller';
}

function isCreatorRole(role?: string): boolean {
  const r = (role || '').toLowerCase();
  return r === 'creator';
}

function groupForResultType(type: DashboardSearchItem['type']): DashboardSearchGroup {
  switch (type) {
    case 'User':
      return 'Users';
    case 'Order':
      return 'Orders';
    case 'Product':
      return 'Products';
    case 'Brand':
      return 'Brands';
    case 'Customer':
      return 'Customers';
    case 'Guide':
      return 'Content';
    case 'Ad':
    case 'Deal':
      return 'Ads & Deals';
    case 'Cashbook':
      return 'Cashbooks';
    case 'Coupon':
      return 'Coupons';
    case 'FinanceAdjustment':
      return 'Finance';
    case 'MessageThread':
      return 'Messages';
    case 'Dispute':
      return 'Disputes / Moderation';
    case 'Page':
      return 'Pages';
    default:
      return 'Orders';
  }
}

function routeForUser(user: { id: string; role?: string | null }) {
  const role = (user.role || '').toLowerCase();
  if (role === 'seller' || role === 'verified_seller') {
    return `/admin/brand-studio?sellerId=${encodeURIComponent(user.id)}`;
  }
  if (role === 'creator') return `/admin/creators/${encodeURIComponent(user.id)}`;
  return `/admin/consumers/${encodeURIComponent(user.id)}`;
}

function formatUserRoleLabel(role?: string | null): string {
  const r = (role || 'user').toLowerCase();
  if (r === 'verified_seller') return 'Seller';
  if (r === 'user') return 'Consumer';
  return r.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

async function searchUsersForStaff(needle: string, limit: number): Promise<DashboardSearchItem[]> {
  const pattern = `%${needle}%`;
  const rows = await db
    .select()
    .from(users)
    .where(
      or(
        ilike(users.displayName, pattern),
        ilike(users.email, pattern),
        ilike(users.choosifyUserId, pattern),
      ),
    )
    .limit(limit);

  return rows.map((user) => ({
    type: 'User' as const,
    id: user.id,
    publicId: user.choosifyUserId || undefined,
    title: user.displayName || user.email,
    subtitle: [user.choosifyUserId, formatUserRoleLabel(user.role), user.email]
      .filter(Boolean)
      .join(' · '),
    group: 'Users' as const,
    route: routeForUser(user),
    exactMatch:
      user.choosifyUserId?.toUpperCase() === needle.toUpperCase() ||
      user.email.toLowerCase() === needle.toLowerCase(),
    score:
      (user.choosifyUserId?.toUpperCase() === needle.toUpperCase() ? 6000 : 0) +
      (user.email.toLowerCase() === needle.toLowerCase() ? 5500 : 0) +
      (user.displayName.toLowerCase().includes(needle) ? 300 : 80),
  }));
}

function searchDashboardPages(
  role: string | undefined,
  needle: string,
  limit: number,
): DashboardSearchItem[] {
  const allowed = allowedPageKeysForRole(role);
  const items: DashboardSearchItem[] = [];

  for (const group of NAV_DEFS) {
    for (const item of group.items) {
      if (allowed && !allowed.includes(item.key)) continue;
      const meta = PAGE_META[item.key];
      const hay = `${item.label} ${meta?.[0] || ''} ${meta?.[1] || ''} ${item.key}`.toLowerCase();
      if (!hay.includes(needle)) continue;
      items.push({
        type: 'Page',
        id: item.key,
        title: item.label,
        subtitle: meta?.[1] || 'Dashboard page',
        group: 'Pages',
        route: item.path,
        score: item.label.toLowerCase().includes(needle) ? 220 : 120,
      });
    }
  }

  return items
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, limit);
}

function formatOrderSubtitle(o: {
  brandName?: string;
  status?: string;
  grandTotal?: number;
  currency?: string;
  shipping?: { fullName?: string };
  items: Array<{ title?: string }>;
}): string {
  const parts: string[] = [];
  const firstItem = o.items[0]?.title;
  if (firstItem) parts.push(firstItem);
  const customer = o.shipping?.fullName;
  if (customer) parts.push(customer);
  if (o.status) parts.push(o.status);
  if (typeof o.grandTotal === 'number' && o.grandTotal > 0) {
    const sym = o.currency === 'BDT' || !o.currency ? '৳' : o.currency;
    parts.push(`${sym}${o.grandTotal.toLocaleString()}`);
  }
  if (parts.length === 0 && o.brandName) parts.push(o.brandName);
  return parts.join(' · ');
}

function scoreExactBoost(exact: boolean | undefined, base = 0): number {
  if (exact) return 1_000_000 + base;
  return base;
}

function routeForGuide(guideId: string) {
  return `/admin/guides/${encodeURIComponent(guideId)}/edit`;
}

function routeForProduct(productId: string) {
  return `/admin/products/${encodeURIComponent(productId)}/edit`;
}

function routeForBrand(brandId: string) {
  return `/admin/brand-studio/${encodeURIComponent(brandId)}/edit`;
}

function routeForCustomer(customerId: string) {
  return `/admin/consumers/${encodeURIComponent(customerId)}`;
}

function routeForOrder(orderId: string) {
  return `/upe/order/${encodeURIComponent(orderId)}`;
}

function routeForCashbook(cashbookId: string) {
  // Cashbooks are managed in CmsMirror; routing there is best-effort.
  return `/admin/cashbook?bookId=${encodeURIComponent(cashbookId)}`;
}

function routeForCoupon() {
  return `/admin/coupons`;
}

function routeForMessageThread(conversationId: string) {
  return `/admin/messages?thread=${encodeURIComponent(conversationId)}`;
}

function routeForAd(adId: string) {
  return `/admin/ads-deals-studio?adId=${encodeURIComponent(adId)}`;
}

function routeForDeal(adId: string) {
  return `/admin/ads-deals-studio?dealId=${encodeURIComponent(adId)}`;
}

export async function searchDashboardForActor(params: {
  actor: { userId: string; role?: string };
  q: string;
  limitPerGroup?: number;
}): Promise<{ groups: Array<{ group: DashboardSearchGroup; items: DashboardSearchItem[] }>; total: number }> {
  const { actor, q } = params;
  const limitPerGroup = params.limitPerGroup ?? 5;

  const needle = String(q || '')
    .trim()
    .replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g, '-')
    .replace(/\s*-\s*/g, '-');
  const lower = needle.toLowerCase();
  if (!needle) {
    return { groups: [], total: 0 };
  }

  // Exact ID resolution (Choosify Reference IDs + CF IDs).
  await ensureReferenceIdSchema();
  const parsedRef = parseReferenceId(needle);
  if (parsedRef) {
    const resolved = await resolveByReferenceIdForActor({ actor, refId: parsedRef.canonical, parsed: parsedRef });
    if (resolved) {
      return { groups: [resolved], total: 1 };
    }
  }

  // Exact CF-ID (legacy “CF-00001” path)
  const canonicalCf = normalizeChoosifyUserIdQuery(lower);
  if (canonicalCf) {
    const user = await findUserByChoosifyUserId(canonicalCf);
    if (user) {
      const staff = isStaffRole(actor.role);
      const allow = staff || user.id === actor.userId;
      if (allow) {
        const item: DashboardSearchItem = {
          type: 'User',
          id: user.id,
          publicId: user.choosifyUserId,
          title: user.displayName || user.email,
          subtitle: [user.choosifyUserId, formatUserRoleLabel(user.role), staff ? user.email : undefined]
            .filter(Boolean)
            .join(' · '),
          group: 'Users',
          route: routeForUser(user),
          exactMatch: true,
          score: scoreExactBoost(true),
        };
        return { groups: [{ group: 'Users', items: [item] }], total: 1 };
      }
    }
  }

  // Keyword match across scoped lists.
  const groupsMap = new Map<DashboardSearchGroup, DashboardSearchItem[]>();
  const push = (item: DashboardSearchItem) => {
    const g = item.group;
    const arr = groupsMap.get(g) || [];
    arr.push(item);
    groupsMap.set(g, arr);
  };

  const staff = isStaffRole(actor.role);

  // Users (admin/staff directory — keyword match)
  if (staff && needle.length >= 2) {
    const userHits = await searchUsersForStaff(lower, limitPerGroup);
    for (const item of userHits) push(item);
  }

  // Orders
  if (staff || isSellerRole(actor.role)) {
    const orders = await commerceStore.listOrders();
    const scoped = staff ? orders : orders.filter((o) => o.sellerId === actor.userId);
    const orderNeedle = lower;
    for (const o of scoped) {
      const itemMatches =
        (o.orderNumber && o.orderNumber.toLowerCase().includes(orderNeedle)) ||
        (o.orderReferenceId && o.orderReferenceId.toLowerCase().includes(orderNeedle)) ||
        (o.invoiceReferenceId && o.invoiceReferenceId.toLowerCase().includes(orderNeedle)) ||
        (o.consumerId && o.consumerId.toLowerCase().includes(orderNeedle)) ||
        (o.brandName && o.brandName.toLowerCase().includes(orderNeedle)) ||
        o.items.some((it) => {
          const hay =
            `${it.title} ${it.sku || ''} ${it.listingId} ${it.variantId || ''} ${it.brandName || ''}`.toLowerCase();
          return hay.includes(orderNeedle);
        });
      if (!itemMatches) continue;
      push({
        type: 'Order',
        id: o.id,
        publicId: o.orderReferenceId,
        title: o.orderNumber.startsWith('#') ? o.orderNumber : `#${o.orderNumber}`,
        subtitle: formatOrderSubtitle(o),
        group: 'Orders',
        route: routeForOrder(o.id),
        score: (o.orderNumber.toLowerCase() === orderNeedle ? 5000 : 0) + (o.invoiceReferenceId?.toLowerCase() === orderNeedle ? 4000 : 0) + 100,
        exactMatch:
          o.orderNumber.toLowerCase() === orderNeedle ||
          (o.orderReferenceId && o.orderReferenceId.toLowerCase() === orderNeedle) ||
          (o.invoiceReferenceId && o.invoiceReferenceId.toLowerCase() === orderNeedle),
      });
      if ((groupsMap.get('Orders')?.length ?? 0) >= limitPerGroup) break;
    }
  }

  // Products + Brands + Content
  if (staff || isSellerRole(actor.role)) {
    const products = await catalogStore.listProducts();
    const scopedProducts = staff ? products : products.filter((p) => p.sellerId === actor.userId);
    for (const p of scopedProducts) {
      const hay = `${p.title} ${p.productReferenceId || ''} ${p.sku || ''} ${p.brandName || ''}`.toLowerCase();
      if (!hay.includes(lower)) continue;
      push({
        type: 'Product',
        id: p.id,
        publicId: p.productReferenceId || undefined,
        title: p.title,
        subtitle: [p.productReferenceId, p.sku, p.brandName].filter(Boolean).join(' · ') || 'Product',
        group: 'Products',
        route: routeForProduct(p.id),
        exactMatch: p.productReferenceId?.toUpperCase() === needle.toUpperCase(),
        score: p.productReferenceId && p.productReferenceId.toUpperCase() === needle.toUpperCase() ? 5000 : 120,
      });
      if (groupsMap.get('Products')?.length >= limitPerGroup) break;
    }

    const brands = await catalogStore.listBrands();
    const scopedBrands = staff ? brands : brands.filter((b) => b.sellerId === actor.userId);
    for (const b of scopedBrands) {
      const hay = `${b.name} ${b.category || ''} ${b.brandReferenceId || ''}`.toLowerCase();
      if (!hay.includes(lower)) continue;
      push({
        type: 'Brand',
        id: b.id,
        publicId: b.brandReferenceId || undefined,
        title: b.name,
        subtitle: `Brand · ${b.category || '—'}`,
        group: 'Brands',
        route: routeForBrand(b.id),
        exactMatch: b.brandReferenceId?.toUpperCase() === needle.toUpperCase(),
        score: b.brandReferenceId && b.brandReferenceId.toUpperCase() === needle.toUpperCase() ? 4000 : 110,
      });
      if (groupsMap.get('Brands')?.length >= limitPerGroup) break;
    }
  }

  if (staff || isCreatorRole(actor.role) || isSellerRole(actor.role)) {
    const guides = await catalogStore.listGuides();
    const scopedGuides = staff
      ? guides
      : isCreatorRole(actor.role)
        ? guides.filter((g) => g.creatorId === actor.userId)
        : (() => {
            // Seller: include guides that reference at least one seller-owned product.
            // This prevents accidental leakage of guides that are unrelated to this Seller.
            // (We approximate “seller-owned” by `product.sellerId === actor.userId`.)
            return null as unknown as typeof guides;
          })();

    if (!staff && isSellerRole(actor.role)) {
      const products = await catalogStore.listProducts();
      const sellerProductIds = new Set(products.filter((p) => p.sellerId === actor.userId).map((p) => p.id));
      const filtered = guides.filter((g) => (g.productIds || []).some((pid) => sellerProductIds.has(pid)));
      for (const g of filtered) {
        const hay = `${g.title} ${g.tags?.join(' ') || ''} ${g.contentReferenceId || ''} ${g.author || ''}`.toLowerCase();
        if (!hay.includes(lower)) continue;
        push({
          type: 'Guide',
          id: g.id,
          publicId: g.contentReferenceId || undefined,
          title: g.title,
          subtitle: `${g.type || 'Guide'} · ${g.author || '—'}`,
          group: 'Content',
          route: routeForGuide(g.id),
          exactMatch: g.contentReferenceId?.toUpperCase() === needle.toUpperCase(),
          score: g.contentReferenceId && g.contentReferenceId.toUpperCase() === needle.toUpperCase() ? 3500 : 100,
        });
        if (groupsMap.get('Content')?.length >= limitPerGroup) break;
      }
    } else {
    for (const g of scopedGuides) {
      const hay = `${g.title} ${g.tags?.join(' ') || ''} ${g.contentReferenceId || ''} ${g.author || ''}`.toLowerCase();
      if (!hay.includes(lower)) continue;
      push({
        type: 'Guide',
        id: g.id,
        publicId: g.contentReferenceId || undefined,
        title: g.title,
        subtitle: `${g.type || 'Guide'} · ${g.author || '—'}`,
        group: 'Content',
        route: routeForGuide(g.id),
        exactMatch: g.contentReferenceId?.toUpperCase() === needle.toUpperCase(),
        score: g.contentReferenceId && g.contentReferenceId.toUpperCase() === needle.toUpperCase() ? 3500 : 100,
      });
      if (groupsMap.get('Content')?.length >= limitPerGroup) break;
    }
    }
  }

  // Customers (seller-scoped; admin best-effort)
  if (staff || isSellerRole(actor.role) || isCreatorRole(actor.role)) {
    // Seller/Creator: use workspace customers (already privacy limited).
    if (!staff) {
      const ownerId = actor.userId;
      const customers = await listMyCustomersForOwner(ownerId);
      for (const c of customers) {
        const hay = `${c.name} ${c.email || ''} ${c.choosifyUserId || ''}`.toLowerCase();
        if (!hay.includes(lower)) continue;
        push({
          type: 'Customer',
          id: c.id,
          publicId: c.choosifyUserId || undefined,
          title: c.name,
          subtitle: c.email,
          group: 'Customers',
          route: routeForCustomer(c.id),
          exactMatch: c.choosifyUserId?.toUpperCase() === needle.toUpperCase(),
          score: c.choosifyUserId && c.choosifyUserId.toUpperCase() === needle.toUpperCase() ? 3000 : 90,
        });
        if ((groupsMap.get('Customers')?.length ?? 0) >= limitPerGroup) break;
      }
    }
  }

  // Cashbooks (owner-scoped workspace)
  if (isSellerRole(actor.role) || isCreatorRole(actor.role) || staff) {
    const books = listCashbooksForOwner(actor.userId);
    for (const book of books) {
      const hay = `${book.name} ${book.icon}`.toLowerCase();
      if (!hay.includes(lower)) continue;
      push({
        type: 'Cashbook',
        id: book.id,
        title: book.name,
        subtitle: `Cashbook · ${book.icon}`,
        group: 'Cashbooks',
        route: routeForCashbook(book.id),
        score: book.name.toLowerCase() === lower ? 2800 : 110,
        exactMatch: book.name.toLowerCase() === lower,
      });
      if ((groupsMap.get('Cashbooks')?.length ?? 0) >= limitPerGroup) break;
    }
  }

  // Dashboard pages (role-filtered nav index)
  {
    const pageHits = searchDashboardPages(actor.role, lower, limitPerGroup);
    for (const item of pageHits) push(item);
  }

  // Ads & Deals
  if (staff || isSellerRole(actor.role) || isCreatorRole(actor.role)) {
    const ads = await adsStore.listAds();
    const scopedAds = staff ? ads : ads.filter((a) => a.ownerId === actor.userId);
    for (const a of scopedAds) {
      const hay = `${a.title} ${a.status} ${a.advertisementReferenceId || ''} ${a.dealReferenceId || ''}`.toLowerCase();
      if (!hay.includes(lower)) continue;
      const isDeal = a.kind === 'deal';
      push({
        type: isDeal ? 'Deal' : 'Ad',
        id: a.id,
        publicId: isDeal ? a.dealReferenceId : a.advertisementReferenceId,
        title: a.title,
        subtitle: `${isDeal ? 'Deal' : 'Ad'} · ${a.status}`,
        group: 'Ads & Deals',
        route: isDeal ? routeForDeal(a.id) : routeForAd(a.id),
        exactMatch: (isDeal ? a.dealReferenceId : a.advertisementReferenceId)?.toUpperCase() === needle.toUpperCase(),
        score: 130,
      });
      if (groupsMap.get('Ads & Deals')?.length >= limitPerGroup) break;
    }
  }

  // Coupons (seller/admin/marketing only)
  const canManageCoupons = (role?: string) => {
    const r = (role || '').toLowerCase();
    return r === 'admin' || r === 'super_admin' || r === 'superadmin' || r === 'seller' || r === 'verified_seller' || r === 'marketing_manager';
  };
  if (staff || canManageCoupons(actor.role)) {
    const coupons = operationsStore.listCoupons();
    const scopedCoupons = staff ? coupons : coupons.filter(() => true);
    for (const c of scopedCoupons) {
      const hay = `${c.code} ${c.description || ''} ${c.type || ''}`.toLowerCase();
      if (!hay.includes(lower)) continue;
      push({
        type: 'Coupon',
        id: c.id,
        publicId: c.code,
        title: c.code,
        subtitle: c.description || c.type,
        group: 'Coupons',
        route: routeForCoupon(),
        exactMatch: c.code?.toUpperCase() === needle.toUpperCase(),
        score: c.code?.toUpperCase() === needle.toUpperCase() ? 2500 : 90,
      });
      if (groupsMap.get('Coupons')?.length >= limitPerGroup) break;
    }
  }

  // Returns/Refunds (seller-scoped + admin best-effort)
  if (staff || isSellerRole(actor.role)) {
    const returns = operationsStore.listReturns({ sellerId: staff ? undefined : actor.userId });
    for (const r of returns) {
      const hay = `${r.id} ${r.orderId || ''} ${r.itemId || ''} ${r.reason || ''} ${r.description || ''} ${r.status || ''}`.toLowerCase();
      if (!hay.includes(lower)) continue;
      push({
        type: 'Dispute',
        id: r.id,
        publicId: r.disputeId || undefined,
        title: r.id,
        subtitle: `${r.status || '—'}`,
        group: 'Disputes / Moderation',
        route: `/admin/returns`,
        exactMatch: r.id.toUpperCase() === needle.toUpperCase() || (r.disputeId && r.disputeId.toUpperCase() === needle.toUpperCase()),
        score: 160,
      });
      if (groupsMap.get('Disputes / Moderation')?.length >= limitPerGroup) break;
    }
  }

  // Messages (conversation search is already actor-scoped in the service)
  {
    const convRows = await searchConversationsForActor(
      { userId: actor.userId, role: actor.role },
      lower,
    );
    for (const c of convRows.slice(0, limitPerGroup * 2)) {
      const thread = c.conversationReferenceId || c.id;
      push({
        type: 'MessageThread',
        id: c.id,
        title: thread,
        subtitle: c.lastMessagePreview || undefined,
        group: 'Messages',
        route: routeForMessageThread(thread),
        score: 140,
      });
    }
  }

  const groups = Array.from(groupsMap.entries())
    .map(([group, items]) => ({
      group,
      items: items
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, limitPerGroup),
    }))
    .filter((g) => g.items.length > 0);

  const total = groups.reduce((sum, g) => sum + g.items.length, 0);
  return { groups, total };
}

async function resolveByReferenceIdForActor(params: {
  actor: { userId: string; role?: string };
  refId: string;
  parsed: ReturnType<typeof parseReferenceId>;
}): Promise<{ group: DashboardSearchGroup; items: DashboardSearchItem[] } | null> {
  const { actor, refId, parsed } = params;
  const staff = isStaffRole(actor.role);

  const indexed = lookupReferenceIndex(refId);
  const internalId = indexed?.internalId || null;

  const toExactItem = (item: DashboardSearchItem) => ({
    group: item.group,
    items: [item],
  });

  if (parsed.entityType === 'user') {
    const user = await findUserByChoosifyUserId(refId);
    if (!user) return null;
    if (!staff && user.id !== actor.userId) return null;
    const item: DashboardSearchItem = {
      type: 'User',
      id: user.id,
      publicId: user.choosifyUserId,
      title: user.displayName || user.email,
      subtitle: [user.choosifyUserId, formatUserRoleLabel(user.role), staff ? user.email : undefined]
        .filter(Boolean)
        .join(' · '),
      group: 'Users',
      route: routeForUser(user),
      exactMatch: true,
      score: 9_000_000,
    };
    return toExactItem(item);
  }

  if (parsed.entityType === 'brand') {
    const brand =
      internalId ? await catalogStore.getBrand(internalId) : (await catalogStore.listBrands()).find((b) => b.brandReferenceId === refId) || null;
    if (!brand) return null;
    if (!staff && brand.sellerId && brand.sellerId !== actor.userId) return null;
    const item: DashboardSearchItem = {
      type: 'Brand',
      id: brand.id,
      publicId: brand.brandReferenceId || refId,
      title: brand.name,
      subtitle: brand.category ? `Brand · ${brand.category}` : 'Brand',
      group: 'Brands',
      route: routeForBrand(brand.id),
      exactMatch: true,
      score: 8_000_000,
    };
    return toExactItem(item);
  }

  if (parsed.entityType === 'product') {
    const product =
      internalId ? await catalogStore.getProduct(internalId) : (await catalogStore.listProducts()).find((p) => p.productReferenceId === refId) || null;
    if (!product) return null;
    if (!staff && product.sellerId && product.sellerId !== actor.userId) return null;
    const item: DashboardSearchItem = {
      type: 'Product',
      id: product.id,
      publicId: product.productReferenceId || refId,
      title: product.title,
      subtitle: `Product`,
      group: 'Products',
      route: routeForProduct(product.id),
      exactMatch: true,
      score: 7_000_000,
    };
    return toExactItem(item);
  }

  if (parsed.entityType === 'content') {
    const guide =
      internalId
        ? await catalogStore.getGuide(internalId)
        : (await catalogStore.listGuides()).find((g) => g.contentReferenceId === refId) || null;
    if (!guide) return null;
    if (!staff && guide.creatorId && guide.creatorId !== actor.userId) return null;
    const item: DashboardSearchItem = {
      type: 'Guide',
      id: guide.id,
      publicId: guide.contentReferenceId || refId,
      title: guide.title,
      subtitle: `${guide.type || 'Guide'} · ${guide.author || '—'}`,
      group: 'Content',
      route: routeForGuide(guide.id),
      exactMatch: true,
      score: 6_000_000,
    };
    return toExactItem(item);
  }

  if (parsed.entityType === 'order' || parsed.entityType === 'invoice') {
    const orders = await commerceStore.listOrders();
    const order =
      (internalId ? await commerceStore.getOrder(internalId) : null) ||
      orders.find((o) =>
        parsed.entityType === 'order' ? o.orderReferenceId === refId : o.invoiceReferenceId === refId,
      ) ||
      null;
    if (!order) return null;
    if (!staff && order.sellerId !== actor.userId) return null;
    const item: DashboardSearchItem = {
      type: 'Order',
      id: order.id,
      publicId: parsed.entityType === 'order' ? order.orderReferenceId : order.invoiceReferenceId,
      title: `Order ${order.orderNumber}`,
      subtitle: `${order.brandName} · ${order.status}`,
      group: 'Orders',
      route: routeForOrder(order.id),
      exactMatch: true,
      score: 5_500_000,
    };
    return toExactItem(item);
  }

  if (parsed.entityType === 'advertisement' || parsed.entityType === 'deal') {
    const ad = internalId ? await adsStore.getAd(internalId) : (await adsStore.listAds()).find((a) =>
      parsed.entityType === 'deal' ? a.dealReferenceId === refId : a.advertisementReferenceId === refId,
    ) || null;
    if (!ad) return null;
    if (!staff && ad.ownerId !== actor.userId) return null;
    const isDeal = parsed.entityType === 'deal' || ad.kind === 'deal';
    const item: DashboardSearchItem = {
      type: isDeal ? 'Deal' : 'Ad',
      id: ad.id,
      publicId: isDeal ? ad.dealReferenceId : ad.advertisementReferenceId,
      title: ad.title,
      subtitle: `${isDeal ? 'Deal' : 'Ad'} · ${ad.status}`,
      group: 'Ads & Deals',
      route: isDeal ? routeForDeal(ad.id) : routeForAd(ad.id),
      exactMatch: true,
      score: 5_000_000,
    };
    return toExactItem(item);
  }

  if (parsed.entityType === 'cashbook') {
    if (!internalId) return null;
    // getCashbookForOwner is owner-gated; for staff we allow null names.
    const book = getCashbookForOwner(internalId, actor.userId);
    if (!book && !staff) return null;
    const item: DashboardSearchItem = {
      type: 'Cashbook',
      id: internalId,
      publicId: refId,
      title: book?.name || 'Cashbook',
      subtitle: book ? `Cashbook · ${book.icon}` : undefined,
      group: 'Cashbooks',
      route: routeForCashbook(internalId),
      exactMatch: true,
      score: 4_800_000,
    };
    return toExactItem(item);
  }

  if (parsed.entityType === 'conversation') {
    if (!staff) return null;
    // conversation resolver is already admin-only in referenceIdRouter; we mirror that.
    // We keep it best-effort for exact reference.
    return null;
  }

  if (parsed.entityType === 'return' || parsed.entityType === 'refund') {
    if (!staff) return null; // disallow non-staff in exact resolution for now
    return null;
  }

  return null;
}

