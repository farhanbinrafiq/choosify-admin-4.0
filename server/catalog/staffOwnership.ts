import type { CatalogBrand } from '../../src/types/catalog';

/**
 * Architecture foundation for Sprint 2 Phase 11 (IS-002 §Staff/Moderator).
 * No live feature yet — no schema migration, no route, no UI. This exists so
 * a future sprint can implement Seller-appointed staff without redesigning
 * the ownership model this sprint already shipped.
 *
 * Model: Seller -> BrandStaffGrant[] -> one or more assigned Brand ids,
 * each with a limited permission set. A Staff member never owns a Brand
 * (CatalogBrand.sellerId always points at the Seller, never at staff) —
 * they only ever act through a grant scoped to specific brands/permissions.
 */

export type BrandStaffPermission =
  | 'products:edit'
  | 'orders:view'
  | 'orders:fulfill'
  | 'messages:respond'
  | 'brand_studio:edit';

export interface BrandStaffGrant {
  id: string;
  /** The Seller (owning userId) who appointed this staff member. */
  sellerId: string;
  /** The staff member's own userId — distinct from sellerId. */
  staffUserId: string;
  /** Brands this grant applies to. Never implies ownership of these brands. */
  brandIds: string[];
  permissions: BrandStaffPermission[];
  status: 'active' | 'revoked';
  createdAt: string;
}

/**
 * No staff grants exist yet (no store/table backs this). Always false today —
 * kept as the single extension point `sellerOwnsBrand`-adjacent authorization
 * checks should call once staff grants are real, so ownership logic in
 * server/catalog/brandOwnership.ts does not need to change shape later.
 */
export async function staffHasBrandPermission(
  _staffUserId: string,
  _brand: CatalogBrand,
  _permission: BrandStaffPermission,
): Promise<boolean> {
  return false;
}
