import { eq } from 'drizzle-orm';
import { catalogStore } from '../../lib/vercel-catalog/catalogStore';
import { normalizeCreatorInput } from '../../lib/vercel-catalog/catalogEditorialContract';
import { db } from '../db/client';
import { sellerProfiles, users } from '../db/schema';
import { operationsStore } from '../operations/operationsStore';
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

export type SellerCustomerRow = {
  id: string;
  name: string;
  email: string;
  segment: string;
  totalOrders: number;
  totalSpend: number;
  lastPurchase: string;
  flagged: boolean;
  orders: Array<{
    id: string;
    product: string;
    price: number;
    status: string;
    date: string;
  }>;
};

/** Consumers who purchased from this seller (from operations orders). */
export function listSellerCustomersFromOrders(sellerUserId: string): SellerCustomerRow[] {
  const orders = operationsStore.listOrders({ sellerId: sellerUserId });
  const byBuyer = new Map<string, SellerCustomerRow>();

  for (const order of orders) {
    if (!order.buyerId || order.buyerId === 'unclaimed') continue;
    const name =
      order.claimedByName ||
      order.shipping?.fullName ||
      `Buyer ${order.buyerId.slice(0, 8)}`;
    const productLabel =
      Array.isArray(order.subOrders) && order.subOrders.length
        ? String(
            (order.subOrders[0] as { title?: string; productTitle?: string })?.title ||
              (order.subOrders[0] as { productTitle?: string })?.productTitle ||
              'Order',
          )
        : 'Order';
    const statusMap: Record<string, string> = {
      completed: 'Delivered',
      active: 'Processing',
      confirmed: 'Processing',
      cancelled: 'Cancelled',
      pending_payment: 'Pending',
    };
    const line = {
      id: order.orderId,
      product: productLabel,
      price: order.overallTotal || 0,
      status: statusMap[order.status] || order.status,
      date: (order.createdAt || '').slice(0, 10),
    };
    const existing = byBuyer.get(order.buyerId);
    if (existing) {
      existing.totalOrders += 1;
      existing.totalSpend += order.overallTotal || 0;
      existing.orders.push(line);
      if ((order.createdAt || '') > (existing.lastPurchase || '')) {
        existing.lastPurchase = line.date;
      }
    } else {
      byBuyer.set(order.buyerId, {
        id: order.buyerId,
        name,
        email: '',
        segment: 'New',
        totalOrders: 1,
        totalSpend: order.overallTotal || 0,
        lastPurchase: line.date,
        flagged: false,
        orders: [line],
      });
    }
  }

  return Array.from(byBuyer.values()).map((row) => {
    let segment = 'New';
    if (row.totalOrders >= 3) segment = 'Repeat';
    else if (row.totalSpend >= 10000) segment = 'High Value';
    return { ...row, segment };
  });
}
