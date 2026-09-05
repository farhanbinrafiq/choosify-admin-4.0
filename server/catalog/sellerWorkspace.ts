import { eq, inArray } from 'drizzle-orm';
import { catalogStore } from '../../lib/vercel-catalog/catalogStore';
import { normalizeCreatorInput } from '../../lib/vercel-catalog/catalogEditorialContract';
import { db } from '../db/client';
import { sellerProfiles, users } from '../db/schema';
import { operationsStore } from '../operations/operationsStore';
import { listBookingRequests } from '../booking/bookingStore';
import type { CatalogBrand } from '../../src/types/catalog';
import type { CatalogCreator } from '../../src/types/catalog';

export type SellerProfileRow = {
  userId: string;
  displayName: string;
  email: string;
  storeName: string;
  phone: string;
  category: string;
  city: string;
  website: string | null;
};

export async function loadSellerProfileRow(userId: string): Promise<SellerProfileRow | null> {
  const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const user = userRows[0];
  if (!user) return null;

  const profileRows = await db
    .select()
    .from(sellerProfiles)
    .where(eq(sellerProfiles.userId, userId))
    .limit(1);
  const profile = profileRows[0];

  return {
    userId: user.id,
    displayName: user.displayName || user.email,
    email: user.email,
    storeName: profile?.storeName || user.displayName || 'My Brand',
    phone: profile?.phone || '',
    category: profile?.category || 'General',
    city: profile?.city || '',
    website: profile?.website || null,
  };
}

/** Brands owned by this seller (never seeded platform brands). */
export async function listOwnedBrands(sellerUserId: string): Promise<CatalogBrand[]> {
  const brands = await catalogStore.listBrands();
  return brands.filter((b) => b.sellerId === sellerUserId);
}

/**
 * Seller workspace entry: return this seller's owned brands only.
 * Per BP-004 §7, Brand creation is never automatic — a seller with zero
 * brands gets an empty list; Brand Studio must trigger an explicit
 * POST /catalog/brands to create the first Brand.
 */
export async function ensureSellerBrandWorkspace(
  sellerUserId: string,
): Promise<{ brands: CatalogBrand[]; created: boolean }> {
  const owned = await listOwnedBrands(sellerUserId);
  return { brands: owned, created: false };
}

export async function listOwnedProducts(sellerUserId: string) {
  const products = await catalogStore.listProducts();
  return products.filter((p) => p.sellerId === sellerUserId);
}

export async function ensureCreatorWorkspace(
  userId: string,
  hints?: { displayName?: string; email?: string },
): Promise<{ creators: CatalogCreator[]; created: boolean }> {
  const all = await catalogStore.listCreators();
  const owned = all.filter((c) => c.userId === userId);
  if (owned.length > 0) {
    return { creators: owned, created: false };
  }

  const name = (hints?.displayName || 'Creator').trim();
  const handle = '@' + name.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 24);
  const created = normalizeCreatorInput({
    name,
    handle,
    avatar: '',
    bio: '',
    score: 0,
    bestFor: 'General',
    bestForTags: [],
    platforms: ['YouTube'],
    followers: { YouTube: '0' },
    email: hints?.email || '',
    userId,
    verifiedStatus: false,
    featuredFlag: false,
    videos: [],
    reels: [],
    blogs: [],
    status: 'draft',
  });
  const saved = await catalogStore.upsertCreator(created);
  return { creators: [saved], created: true };
}

/** Storefront / public visibility. Marketplace Access controls visibility only, never ownership/editing. */
export function brandIsMarketplaceVisible(brand: CatalogBrand): boolean {
  if (brand.marketplaceStatus) {
    return brand.marketplaceStatus === 'granted' || brand.marketplaceStatus === 'restored';
  }
  if (brand.marketplaceAccess === false) return false;
  if (brand.marketplaceAccess === true) return true;
  // Legacy seeded rows without the field stay public; seller-owned drafts stay private.
  return !brand.sellerId;
}

export type MyCustomerOrderLine = {
  id: string;
  product: string;
  price: number;
  status: string;
  date: string;
  qty?: number;
  bill?: string;
  carrier?: string;
};

export type MyCustomerReviewLine = {
  id: string;
  productName: string;
  rating: number;
  comment: string;
  date: string;
  status?: string;
};

/** Privacy-limited customer row for Seller/Creator "My Customers" (no phone/address/KYC). */
export type SellerCustomerRow = {
  id: string;
  name: string;
  email: string;
  /** Authoritative Choosify User ID (CF-#####). */
  choosifyUserId: string | null;
  /** Real uploaded profile photo URL, or null — never a logo/placeholder. */
  avatarUrl?: string | null;
  segment: string;
  totalOrders: number;
  totalSpend: number;
  lastPurchase: string;
  flagged: boolean;
  orders: MyCustomerOrderLine[];
  reviews: MyCustomerReviewLine[];
};

function formatCustomerPurchaseDate(isoOrDate: string): string {
  if (!isoOrDate) return '—';
  const d = new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) {
    return isoOrDate.length >= 10 ? isoOrDate.slice(0, 10) : isoOrDate;
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function orderStatusLabel(status: string): string {
  const statusMap: Record<string, string> = {
    completed: 'Delivered',
    active: 'Processing',
    confirmed: 'Processing',
    cancelled: 'Cancelled',
    pending_payment: 'Pending',
  };
  return statusMap[status] || status;
}

function deriveCustomerSegment(row: Pick<SellerCustomerRow, 'totalOrders' | 'totalSpend' | 'lastPurchase' | 'flagged'>): string {
  if (row.flagged) return 'Inactive';
  const lastMs = Date.parse(row.lastPurchase);
  if (!Number.isNaN(lastMs) && Date.now() - lastMs > 120 * 24 * 60 * 60 * 1000) {
    return 'Inactive';
  }
  if (row.totalOrders >= 2) return 'Repeat';
  if (row.totalSpend >= 10000) return 'High Value';
  return 'New';
}

type SubOrderLike = {
  sellerId?: string;
  brandId?: string;
  title?: string;
  productTitle?: string;
  quantity?: number;
  qty?: number;
};

function orderTouchesOwner(
  order: { subOrders?: unknown[] },
  ownerUserId: string,
  brandId?: string | null,
): boolean {
  const subs = (order.subOrders || []) as SubOrderLike[];
  const owned = subs.filter((sub) => sub.sellerId === ownerUserId);
  if (!owned.length) return false;
  if (!brandId) return true;
  const withBrand = owned.filter((sub) => Boolean(sub.brandId));
  // Legacy lines without brandId stay visible when brand filter cannot be applied.
  if (!withBrand.length) return true;
  return withBrand.some((sub) => sub.brandId === brandId);
}

function scopedOrderTotal(order: { overallTotal?: number; subOrders?: unknown[] }, ownerUserId: string, brandId?: string | null): number {
  const subs = (order.subOrders || []) as Array<SubOrderLike & { lineTotal?: number; total?: number; price?: number }>;
  const owned = subs.filter((sub) => {
    if (sub.sellerId !== ownerUserId) return false;
    if (brandId && sub.brandId !== brandId) return false;
    return true;
  });
  if (!owned.length) return order.overallTotal || 0;
  const sum = owned.reduce((acc, sub) => {
    const line = Number(sub.lineTotal ?? sub.total ?? sub.price ?? 0);
    return acc + (Number.isFinite(line) ? line : 0);
  }, 0);
  return sum > 0 ? sum : order.overallTotal || 0;
}

function productLabelFromOrder(order: { subOrders?: unknown[] }, ownerUserId: string, brandId?: string | null): string {
  const subs = (order.subOrders || []) as SubOrderLike[];
  const match =
    subs.find((sub) => sub.sellerId === ownerUserId && (!brandId || sub.brandId === brandId)) ||
    subs.find((sub) => sub.sellerId === ownerUserId) ||
    subs[0];
  if (!match) return 'Order';
  return String(match.title || match.productTitle || 'Order');
}

function qtyFromOrder(order: { subOrders?: unknown[] }, ownerUserId: string, brandId?: string | null): number {
  const subs = (order.subOrders || []) as SubOrderLike[];
  const owned = subs.filter((sub) => {
    if (sub.sellerId !== ownerUserId) return false;
    if (brandId && sub.brandId !== brandId) return false;
    return true;
  });
  if (!owned.length) return 1;
  return Math.max(
    1,
    owned.reduce((acc, sub) => acc + (Number(sub.quantity ?? sub.qty ?? 1) || 1), 0),
  );
}

/** Consumers served by this owner via Commerce Orders (relationship-scoped totals only). */
export function listSellerCustomersFromOrders(
  ownerUserId: string,
  opts?: { brandId?: string | null },
): SellerCustomerRow[] {
  const brandId = opts?.brandId || null;
  const orders = operationsStore
    .listOrders({ sellerId: ownerUserId })
    .filter((order) => orderTouchesOwner(order, ownerUserId, brandId));
  const byBuyer = new Map<string, SellerCustomerRow>();

  for (const order of orders) {
    if (!order.buyerId || order.buyerId === 'unclaimed') continue;
    const name =
      order.claimedByName ||
      order.shipping?.fullName ||
      `Buyer ${order.buyerId.slice(0, 8)}`;
    const spend = scopedOrderTotal(order, ownerUserId, brandId);
    const line: MyCustomerOrderLine = {
      id: order.orderId,
      product: productLabelFromOrder(order, ownerUserId, brandId),
      price: spend,
      status: orderStatusLabel(order.status),
      date: formatCustomerPurchaseDate(order.createdAt || ''),
      qty: qtyFromOrder(order, ownerUserId, brandId),
      bill: order.isCOD ? 'COD' : order.paymentStatus === 'paid' || order.status === 'completed' ? 'Paid' : 'Unpaid',
      carrier: '',
    };
    const existing = byBuyer.get(order.buyerId);
    if (existing) {
      existing.totalOrders += 1;
      existing.totalSpend += spend;
      existing.orders.push(line);
      if ((order.createdAt || '') > (existing.lastPurchase || '')) {
        existing.lastPurchase = order.createdAt || line.date;
      }
    } else {
      byBuyer.set(order.buyerId, {
        id: order.buyerId,
        name,
        email: '',
        choosifyUserId: null,
        segment: 'New',
        totalOrders: 1,
        totalSpend: spend,
        lastPurchase: order.createdAt || line.date,
        flagged: false,
        orders: [line],
        reviews: [],
      });
    }
  }

  return Array.from(byBuyer.values()).map((row) => ({
    ...row,
    lastPurchase: formatCustomerPurchaseDate(row.lastPurchase),
    segment: deriveCustomerSegment(row),
    orders: row.orders.sort((a, b) => String(b.date).localeCompare(String(a.date))),
  }));
}

const QUALIFYING_BOOKING_STATUSES = new Set([
  'accepted',
  'buyer_accepted',
  'paid',
  'countered',
]);

/** Merge eligible booking/service relationships into customer rows (Creator/Seller services). */
export async function mergeBookingCustomers(
  ownerUserId: string,
  rows: SellerCustomerRow[],
): Promise<SellerCustomerRow[]> {
  const byBuyer = new Map(rows.map((r) => [r.id, { ...r, orders: [...r.orders], reviews: [...(r.reviews || [])] }]));
  try {
    const bookings = await listBookingRequests({ sellerId: ownerUserId });
    for (const br of bookings) {
      if (!br.buyerId || br.buyerId === 'unclaimed') continue;
      if (!QUALIFYING_BOOKING_STATUSES.has(br.status) && !br.orderId) continue;
      // Skip bookings already represented by a linked Commerce order line.
      if (br.orderId) {
        const existing = byBuyer.get(br.buyerId);
        if (existing?.orders.some((o) => o.id === br.orderId)) continue;
      }
      const line: MyCustomerOrderLine = {
        id: br.orderId || br.id,
        product: br.listingTitle || 'Service booking',
        price: Number(br.price) || 0,
        status: br.status === 'paid' ? 'Delivered' : 'Processing',
        date: formatCustomerPurchaseDate(br.updatedAt || br.createdAt),
        qty: 1,
        bill: br.status === 'paid' ? 'Paid' : 'Unpaid',
        carrier: 'Service',
      };
      const existing = byBuyer.get(br.buyerId);
      if (existing) {
        existing.totalOrders += 1;
        existing.totalSpend += line.price;
        existing.orders.push(line);
        if ((br.updatedAt || br.createdAt || '') > (existing.lastPurchase || '')) {
          existing.lastPurchase = br.updatedAt || br.createdAt;
        }
        if (br.buyerName && (!existing.name || existing.name.startsWith('Buyer '))) {
          existing.name = br.buyerName;
        }
      } else {
        byBuyer.set(br.buyerId, {
          id: br.buyerId,
          name: br.buyerName || `Buyer ${br.buyerId.slice(0, 8)}`,
          email: '',
          choosifyUserId: null,
          segment: 'New',
          totalOrders: 1,
          totalSpend: line.price,
          lastPurchase: br.updatedAt || br.createdAt,
          flagged: false,
          orders: [line],
          reviews: [],
        });
      }
    }
  } catch {
    /* booking store optional — orders alone remain authoritative */
  }

  return Array.from(byBuyer.values()).map((row) => ({
    ...row,
    lastPurchase: formatCustomerPurchaseDate(row.lastPurchase),
    segment: deriveCustomerSegment(row),
    orders: row.orders.sort((a, b) => String(b.date).localeCompare(String(a.date))),
  }));
}

/** Attach relationship-scoped reviews (buyer reviews on owner's products/brands only). */
export async function attachScopedReviews(
  ownerUserId: string,
  rows: SellerCustomerRow[],
): Promise<SellerCustomerRow[]> {
  const products = await listOwnedProducts(ownerUserId);
  const productIds = new Set(products.map((p) => p.id));
  const brandNames = new Set(
    products
      .map((p) => String((p as { brandName?: string }).brandName || (p as { brand?: string }).brand || '').trim().toLowerCase())
      .filter(Boolean),
  );
  const ownedBrands = await listOwnedBrands(ownerUserId);
  for (const b of ownedBrands) {
    if (b.name) brandNames.add(b.name.trim().toLowerCase());
  }

  const allReviews = operationsStore.listReviews();
  return rows.map((row) => {
    const reviews: MyCustomerReviewLine[] = allReviews
      .filter((rev) => {
        if (rev.userId !== row.id) return false;
        if (productIds.has(rev.productId)) return true;
        const brand = (rev.brandName || '').trim().toLowerCase();
        return Boolean(brand && brandNames.has(brand));
      })
      .map((rev) => ({
        id: rev.id,
        productName: rev.productTitle || 'Product',
        rating: rev.rating,
        comment: rev.comment || '',
        date: formatCustomerPurchaseDate(rev.createdAt),
        status: rev.status,
      }));
    return { ...row, reviews };
  });
}

/** Enrich name/email/choosifyUserId from authoritative users table. Never expose phone. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function enrichCustomerIdentities(rows: SellerCustomerRow[]): Promise<SellerCustomerRow[]> {
  if (!rows.length) return rows;
  // Some rows are synthetic pending-claim buyers (id like
  // "pending:claim-<ts>-<rand>") that never correspond to a real `users`
  // row. Passing a non-UUID string into `inArray(users.id, ids)` (a UUID
  // column) throws a Postgres type-cast error for the WHOLE batched query —
  // silently degrading every OTHER, real customer in the same list back to
  // unenriched placeholder name/email/CF-ID/avatar (via the catch-all
  // fallback below) because of one unrelated row. Filter to real UUIDs
  // before querying; non-UUID rows simply keep their existing placeholder
  // fields, same as if no match had been found for them individually.
  const ids = [...new Set(rows.map((r) => r.id).filter((id) => Boolean(id) && UUID_RE.test(id)))];
  if (!ids.length) return rows;

  let userRows: Array<{
    id: string;
    email: string;
    displayName: string;
    choosifyUserId: string | null;
    avatarUrl: string | null;
  }> = [];
  try {
    userRows = await db
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        choosifyUserId: users.choosifyUserId,
        avatarUrl: users.avatarUrl,
      })
      .from(users)
      .where(inArray(users.id, ids));
  } catch {
    return rows.map((r) => ({ ...r, choosifyUserId: r.choosifyUserId ?? null, reviews: r.reviews || [] }));
  }

  const map = new Map(userRows.map((u) => [u.id, u]));
  return rows.map((r) => {
    const u = map.get(r.id);
    return {
      ...r,
      name: (u?.displayName || r.name || '').trim() || r.name,
      email: (u?.email || r.email || '').trim(),
      choosifyUserId: u?.choosifyUserId || null,
      avatarUrl: u?.avatarUrl || null,
      reviews: r.reviews || [],
    };
  });
}

export async function listMyCustomersForOwner(
  ownerUserId: string,
  opts?: { brandId?: string | null; includeBookings?: boolean },
): Promise<SellerCustomerRow[]> {
  let rows = listSellerCustomersFromOrders(ownerUserId, { brandId: opts?.brandId });
  if (opts?.includeBookings !== false) {
    rows = await mergeBookingCustomers(ownerUserId, rows);
  }
  rows = await attachScopedReviews(ownerUserId, rows);
  rows = await enrichCustomerIdentities(rows);
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getMyCustomerForOwner(
  ownerUserId: string,
  customerId: string,
  opts?: { brandId?: string | null; includeBookings?: boolean },
): Promise<SellerCustomerRow | null> {
  const rows = await listMyCustomersForOwner(ownerUserId, opts);
  return rows.find((r) => r.id === customerId) || null;
}
