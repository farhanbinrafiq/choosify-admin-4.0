import { catalogStore } from '../../lib/vercel-catalog/catalogStore';
import { normalizeBrandInput } from '../catalogContract';
import { operationsStore } from '../operations/operationsStore';
import type { CatalogBrand } from '../../src/types/catalog';

/**
 * Seller ↔ brand ownership for Brand Studio writes.
 * 1. CatalogBrand.sellerId — set on create / claim approval
 * 2. Approved brand verification claim submitted by this seller
 *
 * Seeded platform brands stay read-only until claim approval assigns sellerId.
 */
export async function sellerOwnsBrand(
  sellerUserId: string,
  brandId: string,
): Promise<boolean> {
  if (!sellerUserId || !brandId) return false;

  const brand = await catalogStore.getBrand(brandId);
  if (!brand) return false;

  if (brand.sellerId && brand.sellerId === sellerUserId) {
    return true;
  }

  const approvedClaims = operationsStore.listVerifications({
    submittedBy: sellerUserId,
    entityType: 'brand',
    entityId: brandId,
    status: 'approved',
  });
  return approvedClaims.length > 0;
}

/** Stamp seller ownership on a brand (e.g. after verification approve). */
export async function linkBrandSellerOwnership(
  brand: CatalogBrand,
  sellerUserId: string,
): Promise<CatalogBrand> {
  if (brand.sellerId === sellerUserId) return brand;
  const normalized = normalizeBrandInput(
    { ...brand, sellerId: sellerUserId },
    brand,
  );
  return catalogStore.upsertBrand(normalized);
}
