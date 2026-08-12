import { Router } from 'express';
import { authenticateRequest } from '../middleware/auth';
import { requireRole } from '../middleware/authorization';
import { ROLES } from '../permissions/roles';
import { partnerApplicationStore } from './partnerApplicationStore';
import {
  approvePartnerApplication,
  rejectPartnerApplication,
  sanitizeApplication,
  submitPartnerApplication,
} from './partnerApplicationService';
import { Logger } from '../lib/logger';

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
      audienceSize: body.audienceSize ? String(body.audienceSize) : undefined,
      notes: body.notes ? String(body.notes) : undefined,
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

partnerApplicationRouter.get('/operations/partner-applications', ...requireAdmin, (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const rows = partnerApplicationStore.list(
    status === 'pending' || status === 'approved' || status === 'rejected' ? status : undefined,
  );
  res.json({
    success: true,
    applications: rows.map(sanitizeApplication),
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
