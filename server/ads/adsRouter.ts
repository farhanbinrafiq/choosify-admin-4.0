/**
 * Ads & Deals HTTP API — pre-Sprint-9 stabilization.
 * Mounted under /api/v1.
 */

import { Router } from 'express';
import { authenticateRequest } from '../middleware/auth';
import { requireRole } from '../middleware/authorization';
import { requirePartnerEntitlement } from '../entitlements/entitlementMiddleware';
import { requireMarketplaceAccess } from '../entitlements/marketplaceAccessMiddleware';
import { Logger } from '../lib/logger';
import { ROLES } from '../permissions/roles';
import {
  AD_FORMATS,
  AD_PLACEMENTS,
  listPages,
  placementsForPage,
} from '../../shared/ads/placementRegistry';
import {
  AdsError,
  approveAd,
  approvePromotionRequest,
  archiveAd,
  cancelPromotionRequest,
  createBanner,
  createDeal,
  createDealFromListing,
  createPromotion,
  createPromotionRequest,
  deleteOwnAd,
  endDeal,
  getAdForActor,
  listAdminQueue,
  listBanners,
  listDealEligibleListings,
  listDealViews,
  listOwnedEligibleListings,
  listPromotionRequestViews,
  listPromotions,
  pauseAd,
  rejectAd,
  rejectPromotionRequest,
  resumeDeal,
  submitAdForApproval,
  updateOwnAd,
  updateOwnDeal,
  type AdsActor,
  type DealSubmission,
} from './adsService';
import type { AdCreative, AdRecord, AdsOwnerRole } from './types';
import { deliverableAdsBySlot, deliveryProblems, probeImageSize, ACTIVE_SLOT_IDS } from './adDelivery';
import { adsStore } from './adsStore';
import { checkCreativeFit, getAnyPlacementDef, getFormatDef, getPlacementDef, assertFormatPlacementCompatible, resolvePagePosition } from '../../shared/ads/placementRegistry';

/**
 * Measures the creative image on the SERVER (client-sent sizes are never trusted) and checks it
 * fits the slot. Returns the creative with imageWidth/imageHeight set; throws AdsError(400) when
 * the image is too small or the wrong shape for the slot.
 */
async function measuredCreative(creative: unknown, formatId: string | undefined, placementId: string | undefined): Promise<AdCreative | undefined> {
  if (!creative || typeof creative !== 'object') return creative as AdCreative | undefined;
  const c = { ...(creative as AdCreative) };
  delete c.imageWidth;
  delete c.imageHeight;
  const format = getFormatDef(formatId);
  const slot = getPlacementDef(placementId);
  if (c.pagePosition !== undefined) {
    const pos = typeof c.pagePosition === 'string' ? c.pagePosition.trim() : '';
    if (!pos || !slot?.positions?.length) delete c.pagePosition;
    else if (!slot.positions.some((p) => p.key === pos)) throw new AdsError(`"${pos}" is not a position on the ${slot.pageLabel} page`, 400);
    else c.pagePosition = pos;
  }
  if (!format?.imageLed || typeof c.imageUrl !== 'string' || !c.imageUrl) return c;
  const size = await probeImageSize(c.imageUrl);
  if (size) {
    c.imageWidth = size.width;
    c.imageHeight = size.height;
    if (slot) {
      const fit = checkCreativeFit(slot, size.width, size.height);
      if ('error' in fit) throw new AdsError(fit.error, 400);
    }
  }
  return c;
}

export const adsRouter = Router();

const requireAuth = [authenticateRequest, requirePartnerEntitlement, requireMarketplaceAccess];
const requireAdmin = [authenticateRequest, requireRole(ROLES.ADMIN)];

function actorOf(req: {
  userId?: string;
  user?: { uid?: string; role?: string };
  userRole?: string;
}): AdsActor {
  return {
    userId: req.userId || req.user?.uid || '',
    role: req.userRole || req.user?.role,
  };
}

function handleError(res: import('express').Response, error: unknown): void {
  if (error instanceof AdsError) {
    res.status(error.statusCode).json({ success: false, error: error.message });
    return;
  }
  Logger.error('Ads API error', {
    error: error instanceof Error ? error.message : String(error),
  });
  res.status(500).json({
    success: false,
    error: error instanceof Error ? error.message : 'Ads error',
  });
}

function parseOwnerRole(raw: unknown, fallback: AdsOwnerRole): AdsOwnerRole {
  if (raw === 'seller' || raw === 'creator' || raw === 'admin') return raw;
  return fallback;
}

function defaultOwnerRole(role?: string): AdsOwnerRole {
  const r = (role || '').toLowerCase();
  if (r === 'creator') return 'creator';
  if (r === 'admin' || r === 'super_admin') return 'admin';
  return 'seller';
}

// —— Public delivery (storefront) ——

/**
 * GET /ads/delivery[?slot=ID] — PUBLIC, read-only. Deliverable ads grouped by slot, display fields
 * only. Short public cache so approvals / moves / pauses show within seconds.
 */
adsRouter.get('/ads/delivery', async (req, res) => {
  try {
    const slot = req.query.slot ? String(req.query.slot) : '';
    if (slot && !ACTIVE_SLOT_IDS.includes(slot)) {
      res.setHeader('Cache-Control', 'public, max-age=30');
      res.json({ success: true, data: { slots: {} } });
      return;
    }
    const all = await deliverableAdsBySlot(Date.now(), `${req.protocol}://${req.get('host') ?? ''}`);
    const slots = slot ? (all[slot] ? { [slot]: all[slot] } : {}) : all;
    res.setHeader('Cache-Control', 'public, max-age=30');
    res.json({ success: true, data: { slots } });
  } catch (error) {
    Logger.error('ads.delivery_failed', { error: error instanceof Error ? error.message : String(error) });
    res.setHeader('Cache-Control', 'no-store');
    res.status(500).json({ success: false, error: 'Ads unavailable' });
  }
});

/** Staff/owner: is this ad on the storefront right now, and if not, why. */
adsRouter.get('/ads/:id/delivery', ...requireAuth, async (req, res) => {
  try {
    const ad = await getAdForActor(req.params.id, actorOf(req));
    const problems = deliveryProblems(ad);
    const slot = getAnyPlacementDef(ad.placementId);
    res.json({ success: true, data: { delivered: problems.length === 0, problems, slot: slot ?? null } });
  } catch (error) {
    handleError(res, error);
  }
});

/**
 * Super Admin / Admin: move an ad to another slot. The creative is re-checked for the new slot
 * (format allowed + image size/shape). The ad's approval status is NOT changed — moving never
 * publishes an unapproved ad. Every move is recorded on the ad and in the audit log.
 */
adsRouter.post('/ads/:id/move', ...requireAdmin, async (req, res) => {
  try {
    const actor = actorOf(req);
    const ad = (await adsStore.getAd(req.params.id)) as AdRecord | null;
    if (!ad) throw new AdsError('Ad not found', 404);
    if (ad.kind !== 'banner' && ad.kind !== 'external') throw new AdsError('Only banner / direct ads can be moved between slots', 400);
    const to = String(req.body?.placementId || ad.placementId || '');
    const wantPos = typeof req.body?.position === 'string' ? req.body.position.trim() : undefined;
    const fromPos = resolvePagePosition(getPlacementDef(ad.placementId), ad.creative?.pagePosition) ?? null;
    if (to === ad.placementId && (wantPos === undefined || wantPos === fromPos)) throw new AdsError('The ad is already in that slot', 409);
    const compat = assertFormatPlacementCompatible(ad.formatId, to);
    if ('error' in compat) throw new AdsError(compat.error, 400);
    const base: AdCreative = { ...(ad.creative || {}) };
    if (wantPos !== undefined) base.pagePosition = wantPos;
    // Moving to another page keeps the spot only when that page has the same spot.
    else if (base.pagePosition && !compat.placement.positions?.some((p) => p.key === base.pagePosition)) delete base.pagePosition;
    const creative = await measuredCreative(base, ad.formatId, to);
    const format = getFormatDef(ad.formatId);
    if (format?.imageLed && compat.placement.creative && !(Number(creative?.imageWidth) > 0)) {
      throw new AdsError('The image size could not be read, so it cannot be checked for the new slot — upload the image again first.', 400);
    }
    const now = new Date().toISOString();
    const meta = (ad.metadata || {}) as Record<string, unknown>;
    const history = Array.isArray(meta.placementHistory) ? (meta.placementHistory as unknown[]) : [];
    const toPos = resolvePagePosition(compat.placement, creative?.pagePosition) ?? null;
    const entry = { at: now, by: actor.userId, from: ad.placementId ?? null, to, fromPosition: fromPos, toPosition: toPos, statusAtMove: ad.status };
    const updated: AdRecord = {
      ...ad,
      placementId: to,
      pageKey: compat.placement.pageKey,
      creative,
      metadata: { ...meta, placementHistory: [...history, entry].slice(-50) },
      updatedAt: now,
    };
    await adsStore.upsertAd(updated);
    Logger.audit('ads.placement_moved', { actorId: actor.userId, adId: ad.id, from: entry.from, to, fromPosition: fromPos, toPosition: toPos, status: ad.status });
    res.json({ success: true, data: { ...updated, delivery: { problems: deliveryProblems(updated) } } });
  } catch (error) {
    handleError(res, error);
  }
});

// —— Placement registry ——

adsRouter.get('/ads/placements', ...requireAuth, async (req, res) => {
  try {
    const actor = actorOf(req);
    const pageKey = req.query.pageKey ? String(req.query.pageKey) : undefined;
    const placements = pageKey
      ? placementsForPage(pageKey, actor.role)
      : AD_PLACEMENTS.filter((p) => p.active);
    res.json({
      success: true,
      data: {
        formats: AD_FORMATS,
        pages: listPages(),
        placements,
      },
    });
  } catch (error) {
    handleError(res, error);
  }
});

// —— Deals ——

/** Only these client fields are read for Deals — owner/status/prices/review/metadata are server-derived. */
function dealSubmissionOf(body: Record<string, unknown> | undefined): DealSubmission {
  const b = body || {};
  return {
    listingType: b.listingType,
    listingId: b.listingId,
    pricingMode: b.pricingMode,
    pricingValue: b.pricingValue,
    startsAt: b.startsAt,
    endsAt: b.endsAt,
    title: b.title,
  };
}

adsRouter.get('/ads/deals', ...requireAuth, async (req, res) => {
  try {
    const data = await listDealViews(actorOf(req));
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
});

adsRouter.post('/ads/deals', ...requireAuth, async (req, res) => {
  try {
    const data = await createDeal(dealSubmissionOf(req.body), actorOf(req));
    res.status(201).json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
});

adsRouter.post('/ads/deals/from-listing', ...requireAuth, async (req, res) => {
  try {
    const data = await createDealFromListing(dealSubmissionOf(req.body), actorOf(req));
    res.status(201).json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
});

adsRouter.patch('/ads/deals/:id', ...requireAuth, async (req, res) => {
  try {
    const data = await updateOwnDeal(req.params.id, actorOf(req), {
      ...dealSubmissionOf(req.body),
      status: req.body?.status,
    });
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
});

// Deals are open marketplace inventory: no approve/reject routes. Owner End Now;
// admin Pause / Resume / Disable are exceptional moderation.
adsRouter.post('/ads/deals/:id/end', ...requireAuth, async (req, res) => {
  try {
    const data = await endDeal(req.params.id, actorOf(req));
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
});

adsRouter.post('/ads/deals/:id/pause', ...requireAdmin, async (req, res) => {
  try {
    const data = await pauseAd(req.params.id, actorOf(req));
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
});

adsRouter.post('/ads/deals/:id/resume', ...requireAdmin, async (req, res) => {
  try {
    const data = await resumeDeal(req.params.id, actorOf(req));
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
});

adsRouter.post('/ads/deals/:id/disable', ...requireAdmin, async (req, res) => {
  try {
    const data = await archiveAd(req.params.id, actorOf(req));
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
});

// —— Deal Promotion Requests (the only admin-reviewed Deal workflow) ——

adsRouter.post('/ads/deals/:id/promotion-requests', ...requireAuth, async (req, res) => {
  try {
    const b = req.body || {};
    // Only these client fields are read; owner/listing/brand/title come from the Deal.
    const data = await createPromotionRequest(
      req.params.id,
      { promotionType: b.promotionType, startsAt: b.startsAt, endsAt: b.endsAt, sellerNote: b.sellerNote },
      actorOf(req),
    );
    res.status(201).json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
});

adsRouter.get('/ads/promotion-requests', ...requireAuth, async (req, res) => {
  try {
    const data = await listPromotionRequestViews(actorOf(req));
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
});

adsRouter.post('/ads/promotion-requests/:id/cancel', ...requireAuth, async (req, res) => {
  try {
    const data = await cancelPromotionRequest(req.params.id, actorOf(req));
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
});

adsRouter.post('/ads/promotion-requests/:id/approve', ...requireAdmin, async (req, res) => {
  try {
    const data = await approvePromotionRequest(req.params.id, actorOf(req));
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
});

adsRouter.post('/ads/promotion-requests/:id/reject', ...requireAdmin, async (req, res) => {
  try {
    const data = await rejectPromotionRequest(req.params.id, actorOf(req), req.body?.reason);
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
});

adsRouter.get('/ads/listings/eligible', ...requireAuth, async (req, res) => {
  try {
    const actor = actorOf(req);
    // ?purpose=deal → the seller's own products + services with base price for Create Deal.
    const data =
      req.query.purpose === 'deal'
        ? await listDealEligibleListings(actor)
        : await listOwnedEligibleListings(actor);
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
});

adsRouter.patch('/ads/:id', ...requireAuth, async (req, res) => {
  try {
    const body = req.body || {};
    // Strip status from non-admin paths inside service; never accept active from body blindly
    const current = await getAdForActor(req.params.id, actorOf(req));
    const creative =
      body.creative !== undefined
        ? await measuredCreative(body.creative, body.formatId !== undefined ? String(body.formatId) : current.formatId, body.placementId !== undefined ? String(body.placementId) : current.placementId)
        : undefined;
    const data = await updateOwnAd(req.params.id, actorOf(req), {
      title: body.title !== undefined ? String(body.title) : undefined,
      creative,
      cta: body.cta,
      externalUrl: body.externalUrl !== undefined ? String(body.externalUrl) : undefined,
      placement: body.placement !== undefined ? String(body.placement) : undefined,
      placementId: body.placementId !== undefined ? String(body.placementId) : undefined,
      formatId: body.formatId !== undefined ? String(body.formatId) : undefined,
      pageKey: body.pageKey !== undefined ? String(body.pageKey) : undefined,
      listingId: body.listingId !== undefined ? String(body.listingId) : undefined,
      brandId: body.brandId !== undefined ? String(body.brandId) : undefined,
      startsAt: body.startsAt !== undefined ? String(body.startsAt) : undefined,
      endsAt: body.endsAt !== undefined ? String(body.endsAt) : undefined,
      metadata: body.metadata,
      status: body.status,
    });
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
});

adsRouter.post('/ads/:id/submit', ...requireAuth, async (req, res) => {
  try {
    const data = await submitAdForApproval(req.params.id, actorOf(req));
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
});

adsRouter.post('/ads/:id/pause', ...requireAdmin, async (req, res) => {
  try {
    const data = await pauseAd(req.params.id, actorOf(req));
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
});

adsRouter.post('/ads/:id/disable', ...requireAdmin, async (req, res) => {
  try {
    const data = await archiveAd(req.params.id, actorOf(req));
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
});

adsRouter.delete('/ads/:id', ...requireAuth, async (req, res) => {
  try {
    const data = await deleteOwnAd(req.params.id, actorOf(req));
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
});

// —— Promotions ——

adsRouter.get('/ads/promotions', ...requireAuth, async (req, res) => {
  try {
    const data = await listPromotions(actorOf(req));
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
});

adsRouter.post('/ads/promotions', ...requireAuth, async (req, res) => {
  try {
    const actor = actorOf(req);
    const body = req.body || {};
    const data = await createPromotion(
      {
        ownerId: actor.userId,
        ownerRole: parseOwnerRole(body.ownerRole, defaultOwnerRole(actor.role)),
        listingId: body.listingId ? String(body.listingId) : undefined,
        brandId: body.brandId ? String(body.brandId) : undefined,
        title: String(body.title || ''),
        creative: body.creative,
        cta: body.cta,
        externalUrl: body.externalUrl ? String(body.externalUrl) : undefined,
        placement: body.placement ? String(body.placement) : undefined,
        metadata: body.metadata,
        asDraft: body.asDraft === true,
      },
      actor,
    );
    res.status(201).json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
});

adsRouter.post('/ads/promotions/:id/approve', ...requireAdmin, async (req, res) => {
  try {
    const data = await approveAd(req.params.id, actorOf(req), { publish: true });
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
});

adsRouter.post('/ads/promotions/:id/reject', ...requireAdmin, async (req, res) => {
  try {
    const reason = req.body?.reason ? String(req.body.reason) : undefined;
    const data = await rejectAd(req.params.id, actorOf(req), reason);
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
});

// —— Banners / External ——

adsRouter.get('/ads/banners', ...requireAuth, async (req, res) => {
  try {
    const rows = await listBanners(actorOf(req));
    // Each row says whether it is on the storefront right now, and if not, why.
    const data = rows.map((ad) => {
      const problems = deliveryProblems(ad);
      return { ...ad, delivery: { delivered: problems.length === 0, problems } };
    });
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
});

adsRouter.post('/ads/banners', ...requireAuth, async (req, res) => {
  try {
    const actor = actorOf(req);
    const body = req.body || {};
    const data = await createBanner(
      {
        ownerId: actor.userId,
        ownerRole: parseOwnerRole(body.ownerRole, defaultOwnerRole(actor.role)),
        listingId: body.listingId ? String(body.listingId) : undefined,
        brandId: body.brandId ? String(body.brandId) : undefined,
        title: String(body.title || ''),
        kind: body.kind === 'external' ? 'external' : 'banner',
        formatId: body.formatId ? String(body.formatId) : undefined,
        placementId: body.placementId ? String(body.placementId) : undefined,
        pageKey: body.pageKey ? String(body.pageKey) : undefined,
        creative: await measuredCreative(body.creative, body.formatId ? String(body.formatId) : undefined, body.placementId ? String(body.placementId) : undefined),
        cta: body.cta,
        externalUrl: body.externalUrl ? String(body.externalUrl) : undefined,
        placement: body.placement ? String(body.placement) : undefined,
        startsAt: body.startsAt ? String(body.startsAt) : undefined,
        endsAt: body.endsAt ? String(body.endsAt) : undefined,
        metadata: body.metadata,
        asDraft: body.asDraft === true,
        publishNow: body.publishNow === true,
      },
      actor,
    );
    res.status(201).json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
});

adsRouter.post('/ads/banners/:id/approve', ...requireAdmin, async (req, res) => {
  try {
    const data = await approveAd(req.params.id, actorOf(req), { publish: true });
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
});

adsRouter.post('/ads/banners/:id/reject', ...requireAdmin, async (req, res) => {
  try {
    const reason = req.body?.reason ? String(req.body.reason) : undefined;
    const data = await rejectAd(req.params.id, actorOf(req), reason);
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
});

// —— Admin queue ——

adsRouter.get('/ads/admin/queue', ...requireAdmin, async (req, res) => {
  try {
    const data = await listAdminQueue(actorOf(req));
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
});

// GET by id must be registered after all /ads/<literal> routes
adsRouter.get('/ads/:id', ...requireAuth, async (req, res) => {
  try {
    const data = await getAdForActor(req.params.id, actorOf(req));
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
});
