import type { RelatedStoreEntry } from './catalogEditorialTypes';

export type MergedRelatedStore = RelatedStoreEntry & {
  /** true ⇒ Choosify/admin-promoted; render a "Promoted / Sponsored" badge. */
  sponsored: boolean;
  promoLabel?: string;
};

const byPriority = (a: RelatedStoreEntry, b: RelatedStoreEntry): number => {
  const pa = typeof a.priority === 'number' ? a.priority : Number.POSITIVE_INFINITY;
  const pb = typeof b.priority === 'number' ? b.priority : Number.POSITIVE_INFINITY;
  return pa - pb;
};

/**
 * Deterministic storefront merge of the two independently-owned lists.
 *
 * Order:
 *   1. admin-promoted rows that carry an explicit `priority` (ascending)
 *   2. seller rows flagged `isFeatured` (seller's own order)
 *   3. remaining seller rows (seller's own order)
 *   4. remaining admin-promoted rows (array order)
 *
 * A seller reorder only ever reorders the seller array, so it can only move
 * items within slots 2–3; it can never affect admin ordering.
 */
export function mergeRelatedStores(
  sellerRows: RelatedStoreEntry[] | undefined | null,
  adminRows: RelatedStoreEntry[] | undefined | null,
): MergedRelatedStore[] {
  const seller: MergedRelatedStore[] = (sellerRows ?? [])
    .filter((r): r is RelatedStoreEntry => !!r && typeof r.storeName === 'string' && r.storeName.trim() !== '')
    .map((r) => ({ ...r, source: 'seller', sponsored: false }));

  const admin: MergedRelatedStore[] = (adminRows ?? [])
    .filter((r): r is RelatedStoreEntry => !!r && typeof r.storeName === 'string' && r.storeName.trim() !== '')
    .map((r) => ({
      ...r,
      source: 'admin',
      sponsored: true,
      promoLabel: (r.promoLabel && r.promoLabel.trim()) || 'Promoted by Choosify',
    }));

  const adminPrioritized = admin.filter((r) => typeof r.priority === 'number').sort(byPriority);
  const adminRest = admin.filter((r) => typeof r.priority !== 'number');
  const sellerFeatured = seller.filter((r) => r.isFeatured);
  const sellerRest = seller.filter((r) => !r.isFeatured);

  return [...adminPrioritized, ...sellerFeatured, ...sellerRest, ...adminRest];
}
