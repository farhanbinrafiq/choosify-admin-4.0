/**
 * Ads & Deals HTTP API — pre-Sprint-9 stabilization.
 * Mounted under /api/v1.
 */

import express, { Router } from 'express';
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
import { metricsFor, rateLimited, recordEvent } from './adMetrics';
import { billingBlocker, billingOf, changesPaidTerms, isPaidAd, stripBilling, withBilling } from './adBilling';
import { AD_DAILY_RATES_BDT, RATE_TIER_LABEL, quoteAd } from '../../shared/ads/pricing';
import { checkCreativeFit, getAnyPlacementDef, getFormatDef, getPlacementDef, assertFormatPlacementCompatible, resolvePagePosition, POPUP_PAGES, GRID_EVERY_CHOICES, GRID_ROW_CHOICES, IN_GRID_POSITION } from '../../shared/ads/placementRegistry';

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
  delete c.mobileImageWidth;
  delete c.mobileImageHeight;
  const format = getFormatDef(formatId);
  // Optional taller picture for phones (wide banners / pop-ups).
  if (typeof c.mobileImageUrl === 'string' && c.mobileImageUrl && format?.imageLed) {
    const ms = await probeImageSize(c.mobileImageUrl);
    if (ms) {
      c.mobileImageWidth = ms.width;
      c.mobileImageHeight = ms.height;
    }
  } else {
    delete c.mobileImageUrl;
  }
  const slot = getPlacementDef(placementId);
  if (c.pagePosition !== undefined) {
    const pos = typeof c.pagePosition === 'string' ? c.pagePosition.trim() : '';
    if (!pos || !slot?.positions?.length) delete c.pagePosition;
    else if (!slot.positions.some((p) => p.key === pos)) throw new AdsError(`"${pos}" is not a position on the ${slot.pageLabel} page`, 400);
    else c.pagePosition = pos;
  }
  if (c.fit !== undefined && c.fit !== 'fill' && c.fit !== 'whole') delete c.fit;
  // Card colour taken from the logo (builder); only a plain #RRGGBB is kept.
  if (c.logoColor2 !== undefined && !(typeof c.logoColor2 === 'string' && /^#[0-9a-f]{6}$/i.test(c.logoColor2))) delete c.logoColor2;
  if (c.logoFit !== undefined && c.logoFit !== 'fill' && c.logoFit !== 'fit') delete c.logoFit;
  if (c.logoZoom !== undefined) {
    const z = Number(c.logoZoom);
    if (Number.isFinite(z) && z >= 1 && z <= 1.8) c.logoZoom = Math.round(z * 100) / 100;
    else delete c.logoZoom;
  }
  if (c.logoColor !== undefined && !(typeof c.logoColor === 'string' && (/^#[0-9a-f]{6}$/i.test(c.logoColor) || c.logoColor === 'none'))) delete c.logoColor;
  if (slot?.slotKey === 'grid_card') {
    const n = Math.round(Number(c.gridEvery));
    c.gridEvery = GRID_EVERY_CHOICES.includes(n) ? n : 8;
    if (c.gridOnce === true && c.gridEvery > 0) c.gridOnce = true;
    else delete c.gridOnce;
  } else {
    delete c.gridEvery;
    delete c.gridOnce;
  }
  // Sponsored Listing: the row it starts (it is always the FIRST card of that row).
  if (format?.formatId === 'sponsored_listing') {
    const r = Math.round(Number(c.listRow));
    c.listRow = r >= 1 && r <= 10 ? r : 2;
  } else if (c.pagePosition === IN_GRID_POSITION && format?.formatId !== 'popup') {
    // Wide banner inside the grid: the row of cards it follows.
    const r = Math.round(Number(c.listRow));
    c.listRow = GRID_ROW_CHOICES.includes(r) ? r : 1;
  } else {
    delete c.listRow;
  }
  if (format?.formatId === 'popup') {
    const allowed = new Set(['all', ...POPUP_PAGES.map((p) => p.key)]);
    const pages = Array.isArray(c.popupPages) ? [...new Set(c.popupPages.map(String).filter((k) => allowed.has(k)))] : [];
    c.popupPages = pages.includes('all') || !pages.length ? ['all'] : pages;
    const n = Math.round(Number(c.popupMaxPerSession));
    c.popupMaxPerSession = Number.isFinite(n) ? Math.min(10, Math.max(1, n)) : 1;
    const d = Math.round(Number(c.popupDelaySec));
    c.popupDelaySec = Number.isFinite(d) ? Math.min(60, Math.max(0, d)) : 3;
  } else {
    delete c.popupPages;
    delete c.popupMaxPerSession;
    delete c.popupDelaySec;
  }
  if (c.focusY !== undefined && c.focusY !== 'top' && c.focusY !== 'center' && c.focusY !== 'bottom') delete c.focusY;
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

// ---------------------------------------------------------------------------------------------
// Impressions + clicks (storefront → POST /ads/events; reports → GET /ads/metrics)
// ---------------------------------------------------------------------------------------------

/** "slot:adId" pairs that are live right now (30 s cache) — events for anything else are ignored. */
let liveCache: { at: number; keys: Set<string> } | null = null;
async function liveAdKeys(force = false): Promise<Set<string>> {
  if (!force && liveCache && Date.now() - liveCache.at < 30_000) return liveCache.keys;
  const all = await deliverableAdsBySlot(Date.now());
  const keys = new Set<string>();
  for (const [slot, ads] of Object.entries(all)) for (const a of ads) keys.add(`${slot}:${a.id}`);
  liveCache = { at: Date.now(), keys };
  return keys;
}

const PAGE_VIEW_RE = /^[A-Za-z0-9_-]{8,64}$/;

/**
 * Public. Body (JSON or text/plain from navigator.sendBeacon):
 *   { pageViewId, events: [{ adId, slot, type: 'i' | 'c' }] }   (≤ 50 events)
 * Counted only for ads live in that slot, once per page view; no personal data is stored.
 */
adsRouter.post('/ads/events', express.text({ type: 'text/plain', limit: '16kb' }), async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  let body: unknown = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = null;
    }
  }
  const b = (body && typeof body === 'object' ? body : {}) as { pageViewId?: unknown; events?: unknown };
  const pageViewId = typeof b.pageViewId === 'string' ? b.pageViewId : '';
  const events = Array.isArray(b.events) ? b.events.slice(0, 50) : [];
  if (!PAGE_VIEW_RE.test(pageViewId) || !events.length) {
    res.status(400).json({ success: false, error: 'Invalid events' });
    return;
  }
  if (rateLimited(req.ip || 'unknown', events.length)) {
    res.status(429).json({ success: false, error: 'Too many events' });
    return;
  }
  try {
    let live = await liveAdKeys();
    // A just-published ad is not in the cached list yet: refresh once (at most every 3 s).
    const unknown = events.some((raw) => {
      const e = (raw && typeof raw === 'object' ? raw : {}) as { adId?: unknown; slot?: unknown };
      return typeof e.adId === 'string' && typeof e.slot === 'string' && !live.has(`${e.slot}:${e.adId}`);
    });
    if (unknown && liveCache && Date.now() - liveCache.at > 3000) live = await liveAdKeys(true);
    let counted = 0;
    for (const raw of events) {
      const e = (raw && typeof raw === 'object' ? raw : {}) as { adId?: unknown; slot?: unknown; type?: unknown };
      const adId = typeof e.adId === 'string' ? e.adId.slice(0, 80) : '';
      const slot = typeof e.slot === 'string' ? e.slot.slice(0, 60) : '';
      const type = e.type === 'c' ? 'c' : e.type === 'i' ? 'i' : null;
      if (!adId || !slot || !type || !live.has(`${slot}:${adId}`)) continue;
      if (recordEvent(pageViewId, adId, slot, type)) counted++;
    }
    res.status(200).json({ success: true, data: { counted } });
  } catch (error) {
    Logger.error('ads.events_failed', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ success: false, error: 'Events unavailable' });
  }
});

/** Views / clicks per ad (admin: every ad; seller / creator: their own). ?from=&to= (YYYY-MM-DD, Dhaka). */
adsRouter.get('/ads/metrics', ...requireAuth, async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const actor = actorOf(req);
    const role = String(actor.role || '').toLowerCase();
    const admin = role === 'admin' || role === 'super_admin';
    const DATE = /^\d{4}-\d{2}-\d{2}$/;
    const from = typeof req.query.from === 'string' && DATE.test(req.query.from) ? req.query.from : undefined;
    const to = typeof req.query.to === 'string' && DATE.test(req.query.to) ? req.query.to : undefined;
    const ads = await adsStore.listAds({});
    const mine = admin ? ads : ads.filter((a) => a.ownerId === actor.userId);
    const out = metricsFor(mine.map((a) => a.id), from, to);
    res.json({ success: true, data: { since: out.since, from: from ?? null, to: to ?? null, rows: out.rows } });
  } catch (error) {
    handleError(res, error);
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

/**
 * Duplicate a banner / direct ad as a DRAFT copy (same design, text, link and place), so the same
 * creative can run on several pages / places. The copy gets its own reference id and history and
 * is never live until it is published; the original is untouched. Admin, or the ad's owner.
 */
adsRouter.post('/ads/:id/duplicate', ...requireAuth, async (req, res) => {
  try {
    const actor = actorOf(req);
    const ad = (await adsStore.getAd(req.params.id)) as AdRecord | null;
    if (!ad) throw new AdsError('Ad not found', 404);
    if (ad.kind !== 'banner' && ad.kind !== 'external') throw new AdsError('Only banner / direct ads can be duplicated', 400);
    const role = String(actor.role || '').toLowerCase();
    const admin = role === 'admin' || role === 'super_admin';
    if (!admin && ad.ownerId !== actor.userId) throw new AdsError('You can only duplicate your own ads', 403);
    const meta = { ...((ad.metadata || {}) as Record<string, unknown>) };
    delete meta.auditLog;
    delete meta.placementHistory;
    delete meta.billing; // a copy is a new campaign: quoted afresh, unpaid
    const data = await createBanner(
      {
        ownerId: admin ? ad.ownerId : actor.userId,
        ownerRole: ad.ownerRole,
        listingId: ad.listingId,
        brandId: ad.brandId,
        title: `${ad.title || 'Ad'} (copy)`.slice(0, 160),
        kind: ad.kind,
        formatId: ad.formatId,
        placementId: ad.placementId,
        pageKey: ad.pageKey,
        creative: await measuredCreative(ad.creative, ad.formatId, ad.placementId),
        cta: ad.cta,
        externalUrl: ad.externalUrl,
        placement: ad.placement,
        startsAt: ad.startsAt,
        endsAt: ad.endsAt,
        metadata: { ...meta, duplicatedFrom: ad.id, duplicatedFromRef: ad.advertisementReferenceId ?? null },
        asDraft: true,
        publishNow: false,
      },
      actor,
    );
    const billedCopy = withBilling(data as AdRecord);
    if (billedCopy !== data) await adsStore.upsertAd(billedCopy);
    Logger.audit('ads.duplicated', { actorId: actor.userId, from: ad.id, to: (data as { id?: string }).id });
    res.status(201).json({ success: true, data: billedCopy });
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
    const role = String(actorOf(req).role || '').toLowerCase();
    const staff = role === 'admin' || role === 'super_admin';
    if (!staff && changesPaidTerms(current as AdRecord, {
      placementId: body.placementId !== undefined ? String(body.placementId) : undefined,
      startsAt: body.startsAt !== undefined ? String(body.startsAt) : undefined,
      endsAt: body.endsAt !== undefined ? String(body.endsAt) : undefined,
    })) {
      throw new AdsError('This ad is paid for: its place and dates are locked. Contact Choosify to change them.', 409);
    }
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
      metadata: stripBilling(body.metadata) ?? (body.metadata === undefined ? undefined : {}),
      status: body.status,
    });
    const billed = withBilling(data as AdRecord, current as AdRecord);
    if (billed !== data) await adsStore.upsertAd(billed);
    res.json({ success: true, data: billed });
  } catch (error) {
    handleError(res, error);
  }
});

adsRouter.post('/ads/:id/submit', ...requireAuth, async (req, res) => {
  try {
    const before = (await adsStore.getAd(req.params.id)) as AdRecord | null;
    if (before && isPaidAd(before) && !billingOf(withBilling(before))) {
      throw new AdsError('Choose a start and an end date — ads are charged per day', 400);
    }
    const data = await submitAdForApproval(req.params.id, actorOf(req));
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
});

/** Daily ad prices for sellers / creators (builder shows the cost as dates change). */
adsRouter.get('/ads/pricing', ...requireAuth, (_req, res) => {
  res.json({ success: true, data: { currency: 'BDT', ratesPerDay: AD_DAILY_RATES_BDT, labels: RATE_TIER_LABEL } });
});

/** Admin: record the advertiser's payment for a seller / creator ad (no online ad payment yet). */
adsRouter.post('/ads/:id/billing/paid', ...requireAdmin, async (req, res) => {
  try {
    const actor = actorOf(req);
    const ad = (await adsStore.getAd(req.params.id)) as AdRecord | null;
    if (!ad) throw new AdsError('Ad not found', 404);
    const billed = withBilling(ad);
    const b = billingOf(billed);
    if (!isPaidAd(ad) || !b) throw new AdsError('This ad has no charge to pay', 400);
    if (b.status !== 'unpaid') throw new AdsError(`Already ${b.status}`, 409);
    const method = String(req.body?.method || '').trim().slice(0, 40);
    const reference = String(req.body?.reference || '').trim().slice(0, 80);
    if (!method) throw new AdsError('Say how it was paid (e.g. bKash, bank transfer, cash)', 400);
    const now = new Date().toISOString();
    const updated: AdRecord = {
      ...billed,
      updatedAt: now,
      metadata: { ...((billed.metadata || {}) as Record<string, unknown>), billing: { ...b, status: 'paid', paidAt: now, paidBy: actor.userId, method, reference } },
    };
    await adsStore.upsertAd(updated);
    Logger.audit('ads.billing_paid', { actorId: actor.userId, adId: ad.id, amount: b.amount, method, reference });
    res.json({ success: true, data: updated });
  } catch (error) {
    handleError(res, error);
  }
});

/** Admin: waive the charge (Choosify's own decision, e.g. a partner promotion). */
adsRouter.post('/ads/:id/billing/waive', ...requireAdmin, async (req, res) => {
  try {
    const actor = actorOf(req);
    const ad = (await adsStore.getAd(req.params.id)) as AdRecord | null;
    if (!ad) throw new AdsError('Ad not found', 404);
    const billed = withBilling(ad);
    const b = billingOf(billed);
    if (!isPaidAd(ad) || !b) throw new AdsError('This ad has no charge to waive', 400);
    if (b.status !== 'unpaid') throw new AdsError(`Already ${b.status}`, 409);
    const note = String(req.body?.note || '').trim().slice(0, 200);
    if (note.length < 3) throw new AdsError('Add a short reason for waiving the charge', 400);
    const now = new Date().toISOString();
    const updated: AdRecord = {
      ...billed,
      updatedAt: now,
      metadata: { ...((billed.metadata || {}) as Record<string, unknown>), billing: { ...b, status: 'waived', paidAt: now, paidBy: actor.userId, note } },
    };
    await adsStore.upsertAd(updated);
    Logger.audit('ads.billing_waived', { actorId: actor.userId, adId: ad.id, amount: b.amount, note });
    res.json({ success: true, data: updated });
  } catch (error) {
    handleError(res, error);
  }
});

/**
 * Publish (or resume) a banner / direct ad: draft, approved, paused, disabled or pending → active.
 * Admin only. Refused — with the reason — when the ad could not actually be shown (no image, a
 * retired place, wrong shape, campaign already ended…), so "Publish" never silently does nothing.
 */
adsRouter.post('/ads/:id/publish', ...requireAdmin, async (req, res) => {
  try {
    const actor = actorOf(req);
    const ad = (await adsStore.getAd(req.params.id)) as AdRecord | null;
    if (!ad) throw new AdsError('Ad not found', 404);
    if (ad.kind !== 'banner' && ad.kind !== 'external') throw new AdsError('Only banner / direct ads can be published here', 400);
    if (ad.status === 'rejected' || ad.status === 'cancelled') throw new AdsError(`A ${ad.status} ad cannot be published — duplicate it to start again`, 400);
    const unpaid = billingBlocker(withBilling(ad));
    if (unpaid) throw new AdsError(`Not published: ${unpaid}`, 400);
    const problems = deliveryProblems({ ...ad, status: 'active' }).filter((p) => !p.startsWith('Scheduled'));
    if (problems.length) throw new AdsError(`Not published: ${problems[0]}`, 400);
    const now = new Date().toISOString();
    const meta = (ad.metadata || {}) as Record<string, unknown>;
    const updated: AdRecord = {
      ...ad,
      status: 'active',
      updatedAt: now,
      metadata: { ...meta, publishedBy: actor.userId, publishedAt: now, publishedFrom: ad.status },
    };
    await adsStore.upsertAd(updated);
    Logger.audit('ads.publish', { actorId: actor.userId, adId: ad.id, from: ad.status });
    res.json({ success: true, data: { ...updated, delivery: { problems: deliveryProblems(updated) } } });
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
    const role = String(actor.role || '').toLowerCase();
    const staff = role === 'admin' || role === 'super_admin';
    if (!staff) {
      const q = quoteAd(body.placementId ? String(body.placementId) : undefined, body.startsAt ? String(body.startsAt) : undefined, body.endsAt ? String(body.endsAt) : undefined);
      if ('error' in q) throw new AdsError(q.error, 400);
    }
    body.metadata = stripBilling(body.metadata);
    const created = await createBanner(
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
    const data = withBilling(created as AdRecord);
    if (data !== created) await adsStore.upsertAd(data);
    res.status(201).json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
});

adsRouter.post('/ads/banners/:id/approve', ...requireAdmin, async (req, res) => {
  try {
    const pending = (await adsStore.getAd(req.params.id)) as AdRecord | null;
    const unpaid = pending ? billingBlocker(withBilling(pending)) : null;
    if (unpaid) throw new AdsError(`Cannot approve yet: ${unpaid}. Mark it as paid (or waive it) first.`, 400);
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
