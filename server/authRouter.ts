import { Router } from 'express';
import {
  DEV_ROLE_MAP,
  getBearerToken,
  resolveAuthenticatedUserFromToken,
} from './auth/authProfile';
import { recordLogin } from './analytics/eventHooks';
import { recordFailedAuthAttempt } from './lib/abuseProtection';
import { Logger } from './lib/logger';
import { validate } from './middleware/validate';
import { DevLoginBodySchema } from './validation/auth/devLoginSchema';
import { loadAdminUserByEmail } from './operations/operationsFirestore';
import { ROLES, toUserRole } from './permissions/roles';

export const authRouter = Router();

/**
 * Public seller-account lookup for the storefront Dashboard dual-account UI.
 * Returns only a boolean — no profile details — to limit email enumeration risk.
 */
authRouter.get('/auth/seller-status', async (req, res) => {
  const email = String(req.query.email || '')
    .trim()
    .toLowerCase();

  if (!email || !email.includes('@')) {
    res.status(400).json({ error: 'Valid email query parameter is required' });
    return;
  }

  try {
    const profile = await loadAdminUserByEmail(email);
    const mappedRole = profile?.role ? toUserRole(profile.role) : undefined;
    const devRole = DEV_ROLE_MAP[email];
    const role = mappedRole || devRole;
    const hasSellerAccount = role === ROLES.SELLER || role === ROLES.VERIFIED_SELLER;

    res.json({
      hasSellerAccount,
      dashboardPath: '/seller/products',
    });
  } catch (error) {
    Logger.warn('seller-status lookup failed', {
      requestId: req.requestId,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: 'Unable to check seller status' });
  }
});

authRouter.get('/auth/me', async (req, res) => {
  const token = getBearerToken(req.headers.authorization);

  if (!token) {
    recordFailedAuthAttempt(req.ip, req.originalUrl);
    res.status(401).json({ error: 'Missing bearer token' });
    return;
  }

  try {
    const user = await resolveAuthenticatedUserFromToken(token);
    if (user) {
      recordLogin(req, {
        userId: user.uid,
        metadata: { mode: 'token', role: user.role },
      });
      res.json({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
      });
      return;
    }

    res.status(403).json({ error: 'User is not registered as an admin.' });
  } catch (error) {
    const abuse = recordFailedAuthAttempt(req.ip, req.originalUrl);
    if (abuse.thresholdExceeded) {
      Logger.warn('Excessive failed authentication attempts', {
        requestId: req.requestId,
        path: req.originalUrl,
        count: abuse.count,
      });
    }
    res.status(401).json({ error: error instanceof Error ? error.message : 'Invalid token' });
  }
});

authRouter.post('/auth/dev-login', validate({ body: DevLoginBodySchema }), (req, res) => {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEV_LOGIN !== 'true') {
    res.status(403).json({ error: 'Dev login disabled in production' });
    return;
  }
  const { email, role } = req.body as { email?: string; role?: string };
  const resolvedRole =
    role ||
    (email ? DEV_ROLE_MAP[email.toLowerCase()] : undefined) ||
    'admin';
  recordLogin(req, {
    userId: `dev_${resolvedRole}`,
    metadata: { mode: 'dev', role: resolvedRole },
  });
  res.json({
    uid: `dev_${resolvedRole}`,
    email: email || `${resolvedRole}@choosify.com.bd`,
    displayName: resolvedRole.replace(/_/g, ' '),
    role: resolvedRole,
    mode: 'dev',
  });
});
