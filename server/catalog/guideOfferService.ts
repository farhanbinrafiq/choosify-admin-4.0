/**
 * Guide LIVE offers — server-authoritative resolution of a guide-scoped
 * temporary promotional price for a tagged canonical product.
 *
 * The underlying CatalogProduct price is NEVER mutated. Checkout calls
 * `resolveActiveGuideOffer` with the server clock; an expired / disabled /
 * mismatched offer resolves to null and the canonical price stands.
 */
import { catalogStore } from '../../lib/vercel-catalog/catalogStore';
import { isProductLifecyclePubliclyListable } from './productLifecycle';

export type ResolvedGuideOffer = {
  guideId: string;
  offerId: string;
  /** The promotional unit price to charge (>= 0, <= basePrice). */
  unitPrice: number;
  /** Canonical product price the offer discounts from (for snapshot / display). */
  basePrice: number;
};

/**
 * A guide referenced a `productId` with a `guideOfferRef` but no ACTIVE offer
 * resolved. `true` means the guide *does* carry an offer entry for the product
 * (so it likely expired / was disabled / left its window) — useful for a
 * "the LIVE offer has changed or expired" message; `false` means there was
 * never an offer to speak of (stale / forged ref).
 */
export async function guideOfferWasPresent(guideId: string, productId: string): Promise<boolean> {
  if (!guideId || !productId) return false;
  const guide = await catalogStore.getGuide(guideId);
  return Boolean((guide?.liveOffers ?? []).some((o) => o.productId === productId));
}

/**
 * Resolve an ACTIVE guide offer for `productId`, or null. Validates:
 *  - guide exists and is live
 *  - an offer for exactly this productId exists and is enabled
 *  - productId is one of the guide's tagged productIds
 *  - server time is within [startsAt, endsAt)
 *  - computed price is a sane discount off the current canonical price
 */
export async function resolveActiveGuideOffer(
  guideId: string,
  productId: string,
  basePrice: number,
  nowMs: number = Date.now(),
  /**
   * True when the cart line is for a specific product VARIANT. The current
   * `GuideLiveOffer` model is product-level (no `variantId`), so an *absolute*
   * `promoPrice` was set against the base product and cannot be safely applied
   * to a variant that may carry its own price premium — that path is skipped
   * (canonical variant price stands). A relative `percent` / `amount` discount
   * still applies proportionally to the variant's own price.
   */
  hasVariant = false,
): Promise<ResolvedGuideOffer | null> {
  if (!guideId || !productId) return null;
  const guide = await catalogStore.getGuide(guideId);
  if (!guide || guide.status !== 'live') return null;
  if (!Array.isArray(guide.productIds) || !guide.productIds.includes(productId)) return null;

  // V1 authority: only a brand-authored guide may carry promotional pricing, and
  // only for a product owned by the publishing brand's seller. This mirrors the
  // write-time check in persistGuideStudioWrite — re-verified here at read time
  // in case ownership changed after the offer was saved.
  if (guide.publisherType !== 'brand' || !guide.publisherBrandId) return null;
  const [publisherBrand, product] = await Promise.all([
    catalogStore.getBrand(guide.publisherBrandId),
    catalogStore.getProduct(productId),
  ]);
  if (!product || !isProductLifecyclePubliclyListable(product.status)) return null;
  if (!publisherBrand?.sellerId || product.sellerId !== publisherBrand.sellerId) return null;

  const offer = (guide.liveOffers ?? []).find(
    (o) => o.productId === productId && o.enabled !== false,
  );
  if (!offer) return null;

  const s = Date.parse(offer.startsAt);
  const e = Date.parse(offer.endsAt);
  if (!Number.isFinite(s) || !Number.isFinite(e)) return null;
  if (nowMs < s || nowMs >= e) return null;

  let price: number;
  if (typeof offer.promoPrice === 'number' && offer.promoPrice >= 0) {
    // Absolute promo price is base-product-scoped; never apply it to a variant line.
    if (hasVariant) return null;
    price = offer.promoPrice;
  } else if (offer.discountType && typeof offer.discountValue === 'number') {
    price =
      offer.discountType === 'percent'
        ? basePrice * (1 - Math.min(90, offer.discountValue) / 100)
        : basePrice - offer.discountValue;
  } else {
    return null;
  }
  price = Math.max(0, Math.round(price * 100) / 100);
  // A "promotion" that isn't cheaper is ignored — never raise the price.
  if (price >= basePrice) return null;

  return { guideId, offerId: offer.id, unitPrice: price, basePrice };
}
