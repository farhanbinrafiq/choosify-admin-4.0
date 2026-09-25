/**
 * Storefront Curation — server-side entity validation and public resolution.
 *
 * Stored pins are editorial intent; eligibility is applied at READ time, so a
 * pinned coupon that later expires/deactivates (or a brand/category that is
 * hidden) disappears from the storefront automatically while the pin stays
 * stored for the Admin to see and clean up.
 */
import { catalogStore } from '../../lib/vercel-catalog/catalogStore';
import type { CatalogBrand, CatalogCategory, CatalogProduct, SiteConfig } from '../../lib/vercel-catalog/catalogTypes';
import { operationsStore } from '../operations/operationsStore';
import {
  ASSURANCE_PLACEMENTS,
  ASSURANCE_PLACEMENT_KEYS,
  COUPON_REASON_LABEL,
  CURATION_PLACEMENTS,
  brandLiveDealPercents,
  couponIneligibleReason,
  resolveAssurancePlacement,
  toPublicCoupon,
  type AssuranceItem,
  type AssuranceVariant,
  type CurationCoupon,
  type CurationPlacementConfig,
  type CurationPlacementKey,
  type PublicCoupon,
} from '../../shared/storefront/storefrontCuration';

export interface CurationEntities {
  coupons: CurationCoupon[];
  categories: CatalogCategory[];
  brands: CatalogBrand[];
  products: CatalogProduct[];
}

export async function loadCurationEntities(): Promise<CurationEntities> {
  const [categories, brands, products] = await Promise.all([
    catalogStore.listCategories(),
    catalogStore.listBrands(),
    catalogStore.listProducts(),
  ]);
  return { coupons: operationsStore.listCoupons() as CurationCoupon[], categories, brands, products };
}

const brandVisible = (b: CatalogBrand) => b.marketplaceAccess !== false;

/** Why an entity can't be newly pinned (null = OK). `liveDeals` = brandLiveDealPercents(ent.products). */
function entityProblem(
  key: CurationPlacementKey,
  entityId: string,
  ent: CurationEntities,
  now: number,
  liveDeals: Map<string, number>,
): string | null {
  const type = CURATION_PLACEMENTS[key].entityType;
  if (type === 'coupon') {
    const c = ent.coupons.find((x) => x.id === entityId);
    if (!c) return 'Coupon not found';
    const reason = couponIneligibleReason(c, now);
    return reason ? `Coupon ${c.code} is not eligible (${COUPON_REASON_LABEL[reason]})` : null;
  }
  if (type === 'category') {
    const c = ent.categories.find((x) => x.id === entityId);
    if (!c) return 'Category not found';
    return c.enabled ? null : `Category ${c.name} is disabled`;
  }
  const b = ent.brands.find((x) => x.id === entityId);
  if (!b) return 'Brand not found';
  if (!brandVisible(b)) return `Brand ${b.name} is not visible on the storefront`;
  return liveDeals.has(b.id) ? null : `Brand ${b.name} has no active deal`;
}

/**
 * Items that are NEW to the placement must exist and be eligible now. Items
 * already stored may stay even if they have since become ineligible (they are
 * simply not rendered) — but ones whose entity no longer exists are dropped.
 */
export function validateCurationChange(
  key: CurationPlacementKey,
  next: CurationPlacementConfig,
  prev: CurationPlacementConfig | undefined,
  ent: CurationEntities,
  now = Date.now(),
): { ok: true; value: CurationPlacementConfig; dropped: string[] } | { ok: false; errors: string[] } {
  const prevIds = new Set((prev?.items ?? []).map((i) => i.entityId));
  const errors: string[] = [];
  const dropped: string[] = [];
  const liveDeals = brandLiveDealPercents(ent.products, now);
  const items = next.items.filter((item) => {
    const problem = entityProblem(key, item.entityId, ent, now, liveDeals);
    if (!problem) return true;
    if (prevIds.has(item.entityId)) {
      if (problem.endsWith('not found')) {
        dropped.push(item.entityId);
        return false;
      }
      return true; // previously pinned, now ineligible: kept, hidden publicly
    }
    errors.push(problem);
    return false;
  });
  if (errors.length) return { ok: false, errors };
  return { ok: true, value: { enabled: next.enabled, items }, dropped };
}

// ── Public resolution ───────────────────────────────────────────────────────

export interface PublicDealsCuration {
  topCoupons: PublicCoupon[];
  popularCategories: Array<{ id: string; name: string; slug: string; icon: string }>;
  brandDeals: Array<{ id: string; name: string; slug: string; logo: string | null; upToPercent: number | null }>;
}

const activeItems = (cfg: CurationPlacementConfig | undefined) =>
  cfg && cfg.enabled ? cfg.items.filter((i) => i.enabled).map((i) => i.entityId) : [];

const isHttpUrl = (v: string | undefined) => !!v && /^https?:\/\//i.test(v);

/** Admin picker: brandId → "Up to X%" for every brand that currently has an active Deal. */
export function brandDealEligibility(ent: Pick<CurationEntities, 'products'>, now = Date.now()): Record<string, number> {
  return Object.fromEntries(brandLiveDealPercents(ent.products, now));
}

export function resolveDealsCuration(site: SiteConfig | null, ent: CurationEntities, now = Date.now()): PublicDealsCuration {
  const cfg = site?.storefrontCuration ?? {};
  const couponById = new Map(ent.coupons.map((c) => [c.id, c]));
  const catById = new Map(ent.categories.map((c) => [c.id, c]));
  const brandById = new Map(ent.brands.map((b) => [b.id, b]));
  const pct = brandLiveDealPercents(ent.products, now);

  const topCoupons = activeItems(cfg['deals.top_coupons'])
    .map((id) => couponById.get(id))
    .filter((c): c is CurationCoupon => !!c && couponIneligibleReason(c, now) === null)
    .map(toPublicCoupon);

  const popularCategories = activeItems(cfg['deals.popular_categories'])
    .map((id) => catById.get(id))
    .filter((c): c is CatalogCategory => !!c && c.enabled)
    .map((c) => ({ id: c.id, name: c.name, slug: c.slug, icon: c.icon || '' }));

  const brandDeals = activeItems(cfg['deals.brand_deals'])
    .map((id) => brandById.get(id))
    // Brand Deal = a real, visible brand with an active Deal; pins without one stay stored but hidden.
    .filter((b): b is CatalogBrand => !!b && brandVisible(b) && pct.has(b.id))
    .map((b) => ({ id: b.id, name: b.name, slug: b.slug, logo: isHttpUrl(b.logo) ? b.logo : null, upToPercent: pct.get(b.id) ?? null }));

  return { topCoupons, popularCategories, brandDeals };
}

/** Every coupon currently valid for storefront display (the full "View All Coupons" set). */
export function listEligibleCoupons(ent: Pick<CurationEntities, 'coupons'>, now = Date.now()): PublicCoupon[] {
  return ent.coupons.filter((c) => couponIneligibleReason(c, now) === null).map(toPublicCoupon);
}

export interface PublicAssurance {
  placements: Record<string, { variant: AssuranceVariant; items: Array<Omit<AssuranceItem, 'enabled'>> }>;
}

export function resolveAssurance(site: SiteConfig | null): PublicAssurance {
  const placements: PublicAssurance['placements'] = {};
  for (const key of ASSURANCE_PLACEMENT_KEYS) {
    const cfg = resolveAssurancePlacement(site?.assuranceStrips, key);
    placements[key] = {
      variant: ASSURANCE_PLACEMENTS[key].variant,
      items: cfg.enabled ? cfg.items.filter((i) => i.enabled).map(({ enabled: _e, ...rest }) => rest) : [],
    };
  }
  return { placements };
}
