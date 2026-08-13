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
  archiveAd,
  createBanner,
  createDeal,
  createDealFromListing,
  createPromotion,
  deleteOwnAd,
  getAdForActor,
  listAdminQueue,
  listBanners,
  listDeals,
  listOwnedEligibleListings,
  listPromotions,
  pauseAd,
  rejectAd,
  submitAdForApproval,
  updateOwnAd,
  type AdsActor,
} from './adsService';
import type { AdsOwnerRole } from './types';

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

adsRouter.get('/ads/deals', ...requireAuth, async (req, res) => {
  try {
    const data = await listDeals(actorOf(req));
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
});

adsRouter.post('/ads/deals', ...requireAuth, async (req, res) => {
  try {
    const actor = actorOf(req);
    const body = req.body || {};
    const data = await createDeal(
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
      },
      actor,
    );
    res.status(201).json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
});

adsRouter.post('/ads/deals/from-listing', ...requireAuth, async (req, res) => {
  try {
    const actor = actorOf(req);
    const listingId = String(req.body?.listingId || '').trim();
    if (!listingId) {
      res.status(400).json({ success: false, error: 'listingId is required' });
      return;
    }
    const data = await createDealFromListing(listingId, actor, {
      title: req.body?.title ? String(req.body.title) : undefined,
      metadata: req.body?.metadata,
    });
    res.status(201).json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
});

adsRouter.get('/ads/listings/eligible', ...requireAuth, async (req, res) => {
  try {
    const data = await listOwnedEligibleListings(actorOf(req));
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
});

adsRouter.patch('/ads/:id', ...requireAuth, async (req, res) => {
  try {
    const body = req.body || {};
    // Strip status from non-admin paths inside service; never accept active from body blindly
    const data = await updateOwnAd(req.params.id, actorOf(req), {
      title: body.title !== undefined ? String(body.title) : undefined,
      creative: body.creative,
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
    const data = await listBanners(actorOf(req));
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
        creative: body.creative,
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
