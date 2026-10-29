import { Router } from 'express';
import { authenticateRequest } from '../middleware/auth';
import { requireRole } from '../middleware/authorization';
import { ROLES } from '../permissions/roles';
import { partnerApplicationStore } from './partnerApplicationStore';
import {
  acknowledgePartnerResubmission,
  approvePartnerApplication,
  rejectPartnerApplication,
  requestPartnerResubmission,
  sanitizeApplication,
  savePartnerAdminNotes,
  submitPartnerApplication,
  unapprovePartnerApplication,
} from './partnerApplicationService';
import { Logger } from '../lib/logger';
import { catalogStore } from '../../lib/vercel-catalog/catalogStore';

export const partnerApplicationRouter = Router();

const requireAdmin = [authenticateRequest, requireRole(ROLES.ADMIN)];

/** Privilege-bearing client fields are never accepted on public apply. */
const REJECTED_APPLY_FIELDS = [
  'role',
  'roles',
  'status',
  'accessGranted',
  'entitlements',
  'marketplaceAccess',
  'choosifyUserId',
  'userCode',
  'publicId',
  'cfId',
  'choosifyId',
  'uid',
  'userId',
  'id',
  'existingUserId',
  'provisionedUserId',
  'reviewedByUserId',
  'reviewedAt',
  'passwordHash',
  'approved',
  'permissions',
] as const;

partnerApplicationRouter.post('/auth/partner-apply', async (req, res) => {
  const body = (req.body || {}) as Record<string, unknown>;

  for (const key of REJECTED_APPLY_FIELDS) {
    if (key in body && body[key] !== undefined && body[key] !== null && body[key] !== '') {
      res.status(400).json({
        error: `Field "${key}" cannot be supplied by the client`,
        code: 'PRIVILEGE_FIELD_REJECTED',
      });
      return;
    }
  }

  const applicantType = String(body.applicantType || '').toLowerCase();
  if (applicantType !== 'seller' && applicantType !== 'creator') {
    res.status(400).json({ error: 'applicantType must be seller or creator' });
    return;
  }

  try {
    const result = await submitPartnerApplication({
      applicantType,
      email: String(body.email || ''),
      password: String(body.password || ''),
      displayName: String(body.displayName || ''),
      phone: String(body.phone || ''),
      businessOrChannelName: String(body.businessOrChannelName || body.storeName || ''),
      category: String(body.category || ''),
      city: String(body.city || ''),
      website: body.website ? String(body.website) : undefined,
      niche: body.niche ? String(body.niche) : undefined,
      contentFocus: body.contentFocus ? String(body.contentFocus) : undefined,
      socialPrimary: body.socialPrimary ? String(body.socialPrimary) : undefined,
      socialLinks:
        body.socialLinks && typeof body.socialLinks === 'object'
          ? Object.fromEntries(
              Object.entries(body.socialLinks as Record<string, unknown>)
                .filter(([, v]) => typeof v === 'string')
                .map(([k, v]) => [k, String(v).slice(0, 2000)]),
            )
          : undefined,
      audienceSize: body.audienceSize ? String(body.audienceSize) : undefined,
      notes: body.notes ? String(body.notes) : undefined,
      claimIntentId: body.claimIntentId ? String(body.claimIntentId) : undefined,
    });
    Logger.info('partner application submitted', {
      requestId: req.requestId,
      applicationId: result.applicationId,
      applicantType,
      // never log password or passwordHash
    });
    res.status(201).json({
      success: true,
      applicationId: result.applicationId,
      status: result.status,
      message: result.message,
      accessGranted: false,
      ...((result as { claimId?: string }).claimId ? { claimId: (result as { claimId?: string }).claimId } : {}),
    });
  } catch (error) {
    const status = (error as Error & { status?: number }).status || 500;
    const code = (error as Error & { code?: string }).code;
    res.status(status).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unable to submit application',
      code,
    });
  }
});

partnerApplicationRouter.get('/auth/partner-applications/me', authenticateRequest, async (req, res) => {
  const app = await partnerApplicationStore.findForActor({
    userId: req.userId || req.user?.uid,
    email: req.user?.email,
  });
  if (!app) {
    res.status(404).json({ success: false, error: 'No partner application for this account' });
    return;
  }
  res.json({ success: true, application: sanitizeApplication(app) });
});

partnerApplicationRouter.post(
  '/auth/partner-applications/me/resubmit',
  authenticateRequest,
  async (req, res) => {
    try {
      const updated = await acknowledgePartnerResubmission({
        userId: req.userId || req.user?.uid || '',
        email: req.user?.email,
        note:
          typeof (req.body as { note?: string })?.note === 'string'
            ? (req.body as { note?: string }).note
            : undefined,
      });
      res.json({ success: true, application: sanitizeApplication(updated) });
    } catch (error) {
      const status = (error as Error & { status?: number }).status || 500;
      const code = (error as Error & { code?: string }).code;
      res.status(status).json({
        success: false,
        error: error instanceof Error ? error.message : 'Resubmit failed',
        code,
      });
    }
  },
);

partnerApplicationRouter.get('/operations/partner-applications', ...requireAdmin, async (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const rows = await partnerApplicationStore.list(
    status === 'pending' || status === 'approved' || status === 'rejected' ? status : undefined,
  );
  // Creator applications: the links they applied with live on their draft Creator profile.
  const creators = new Map((await catalogStore.listCreators()).map((c) => [c.id, c]));
  res.json({
    success: true,
    applications: rows.map((row) => {
      const app = sanitizeApplication(row);
      const links = row.applicantType === 'creator' && row.catalogEntityId ? creators.get(row.catalogEntityId)?.socialLinks : undefined;
      return links ? { ...app, socialLinks: links } : app;
    }),
  });
});

partnerApplicationRouter.post(
  '/operations/partner-applications/:id/approve',
  ...requireAdmin,
  async (req, res) => {
    try {
      const updated = await approvePartnerApplication({
        applicationId: req.params.id,
        adminUserId: req.userId || req.user?.uid || '',
        reviewNote:
          typeof (req.body as { note?: string })?.note === 'string'
            ? (req.body as { note?: string }).note
            : undefined,
      });
      res.json({ success: true, application: sanitizeApplication(updated) });
    } catch (error) {
      const status = (error as Error & { status?: number }).status || 500;
      res.status(status).json({
        success: false,
        error: error instanceof Error ? error.message : 'Approve failed',
      });
    }
  },
);

partnerApplicationRouter.post(
  '/operations/partner-applications/:id/reject',
  ...requireAdmin,
  async (req, res) => {
    try {
      const updated = await rejectPartnerApplication({
        applicationId: req.params.id,
        adminUserId: req.userId || req.user?.uid || '',
        reviewNote:
          typeof (req.body as { note?: string })?.note === 'string'
            ? (req.body as { note?: string }).note
            : undefined,
      });
      res.json({ success: true, application: sanitizeApplication(updated) });
    } catch (error) {
      const status = (error as Error & { status?: number }).status || 500;
      res.status(status).json({
        success: false,
        error: error instanceof Error ? error.message : 'Reject failed',
      });
    }
  },
);

/** Approved -> back to pending (only while Marketplace Access is not granted). Body: { reason }. */
partnerApplicationRouter.post(
  '/operations/partner-applications/:id/unapprove',
  ...requireAdmin,
  async (req, res) => {
    try {
      const updated = await unapprovePartnerApplication({
        applicationId: req.params.id,
        adminUserId: req.userId || req.user?.uid || '',
        reason: typeof (req.body as { reason?: unknown })?.reason === 'string' ? (req.body as { reason: string }).reason : undefined,
      });
      Logger.audit('partner_application.unapproved', { actorId: req.userId, applicationId: req.params.id });
      res.json({ success: true, application: sanitizeApplication(updated) });
    } catch (error) {
      const status = (error as Error & { status?: number }).status || 500;
      res.status(status).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unapprove failed',
        code: (error as Error & { code?: string }).code,
      });
    }
  },
);

partnerApplicationRouter.post(
  '/operations/partner-applications/:id/resubmit',
  ...requireAdmin,
  async (req, res) => {
    try {
      const updated = await requestPartnerResubmission({
        applicationId: req.params.id,
        adminUserId: req.userId || req.user?.uid || '',
        reviewNote:
          typeof (req.body as { note?: string })?.note === 'string'
            ? (req.body as { note?: string }).note
            : undefined,
      });
      res.json({ success: true, application: sanitizeApplication(updated) });
    } catch (error) {
      const status = (error as Error & { status?: number }).status || 500;
      res.status(status).json({
        success: false,
        error: error instanceof Error ? error.message : 'Resubmit request failed',
      });
    }
  },
);

partnerApplicationRouter.patch(
  '/operations/partner-applications/:id/notes',
  ...requireAdmin,
  async (req, res) => {
    try {
      const updated = await savePartnerAdminNotes({
        applicationId: req.params.id,
        adminUserId: req.userId || req.user?.uid || '',
        adminNotes: String((req.body as { adminNotes?: string })?.adminNotes || ''),
      });
      res.json({ success: true, application: sanitizeApplication(updated) });
    } catch (error) {
      const status = (error as Error & { status?: number }).status || 500;
      res.status(status).json({
        success: false,
        error: error instanceof Error ? error.message : 'Save notes failed',
      });
    }
  },
);
