import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { eq } from 'drizzle-orm';
import {
  DEV_ROLE_MAP,
  getBearerToken,
  resolveAuthenticatedUserFromToken,
} from './auth/authProfile';
import {
  clearRefreshTokenCookie,
  hashPassword,
  issueRefreshToken,
  isExpiredJwtError,
  readRefreshTokenCookie,
  revokeRefreshToken,
  rotateRefreshToken,
  setRefreshTokenCookie,
  signAccessToken,
  verifyPassword,
} from './auth/jwtTokens';
import { AUTH_ERROR_CODES, sendAuthError } from './auth/authErrors';
import { recordLogin } from './analytics/eventHooks';
import { recordFailedAuthAttempt } from './lib/abuseProtection';
import { Logger } from './lib/logger';
import { operationalEvents } from './logging/operationalEvents';
import { validate } from './middleware/validate';
import { DevLoginBodySchema } from './validation/auth/devLoginSchema';
import { LoginBodySchema } from './validation/auth/loginSchema';
import { RegisterBodySchema } from './validation/auth/registerSchema';
import { SellerRegisterBodySchema } from './validation/auth/sellerRegisterSchema';
import { UpgradeToSellerBodySchema } from './validation/auth/upgradeToSellerSchema';
import { loadAdminUserByEmail } from './operations/operationsDb';
import { db } from './db/client';
import { sellerProfiles, users } from './db/schema';
import { ROLES, toUserRole } from './permissions/roles';
import { publishEvent } from './events/eventBus';

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

authRouter.post('/auth/login', validate({ body: LoginBodySchema }), async (req, res) => {
  const { email, password } = req.body as { email: string; password: string };
  const normalizedEmail = email.trim().toLowerCase();

  try {
    const rows = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
    const user = rows[0];
    if (!user?.passwordHash) {
      recordFailedAuthAttempt(req.ip, req.originalUrl);
      operationalEvents.authenticationFailure({
        requestId: req.requestId,
        path: req.originalUrl,
        message: 'Unknown account',
        metadata: { reason: 'unknown_account' },
      });
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const ok = await verifyPassword(user.passwordHash, password);
    if (!ok) {
      recordFailedAuthAttempt(req.ip, req.originalUrl);
      operationalEvents.authenticationFailure({
        requestId: req.requestId,
        path: req.originalUrl,
        message: 'Incorrect password',
        metadata: { reason: 'wrong_password', userId: user.id },
      });
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const accessToken = signAccessToken({
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
    });
    const refreshToken = await issueRefreshToken(user.id);
    setRefreshTokenCookie(res, refreshToken);

    recordLogin(req, {
      userId: user.id,
      metadata: { mode: 'password', role: user.role },
    });
    operationalEvents.authenticationSuccess({
      requestId: req.requestId,
      path: req.originalUrl,
      metadata: { mode: 'password', userId: user.id, role: user.role },
    });

    res.json({
      uid: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      accessToken,
    });
  } catch (error) {
    Logger.warn('login failed', {
      requestId: req.requestId,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: 'Unable to sign in' });
  }
});

/**
 * Create a seller dashboard account for storefront "Join Now" users.
 * Response shape preserved: `customToken` now carries the access JWT
 * (frontend still expects this key — see Phase-1 follow-up flag).
 */
authRouter.post('/auth/seller-register', validate({ body: SellerRegisterBodySchema }), async (req, res) => {
  const { email, password, displayName, storeName, phone, category, city, website } = req.body as {
    email: string;
    password: string;
    displayName: string;
    storeName: string;
    phone: string;
    category: string;
    city: string;
    website?: string;
  };
  const normalizedEmail = email.trim().toLowerCase();

  try {
    const existingProfile = await loadAdminUserByEmail(normalizedEmail);
    if (existingProfile) {
      const role = toUserRole(existingProfile.role);
      if (role === ROLES.SELLER || role === ROLES.VERIFIED_SELLER) {
        res.status(409).json({
          error: 'A seller account already exists for this email. Sign in instead.',
          code: 'SELLER_EXISTS',
          loginPath: `/login?email=${encodeURIComponent(normalizedEmail)}&role=seller`,
        });
        return;
      }
      res.status(409).json({
        error: 'This email is already registered with another dashboard role.',
        code: 'EMAIL_IN_USE',
      });
      return;
    }

    const passwordHash = await hashPassword(password);
    const uid = randomUUID();
    const now = new Date();

    await db.transaction(async (tx) => {
      await tx.insert(users).values({
        id: uid,
        email: normalizedEmail,
        passwordHash,
        displayName: displayName.trim(),
        role: ROLES.SELLER,
        emailVerified: false,
        createdAt: now,
        updatedAt: now,
      });
      await tx.insert(sellerProfiles).values({
        userId: uid,
        storeName: storeName.trim(),
        phone: phone.trim(),
        category: category.trim(),
        city: city.trim(),
        website: website?.trim() || null,
        createdAt: now,
      });
    });

    const accessToken = signAccessToken({
      id: uid,
      email: normalizedEmail,
      emailVerified: false,
    });
    const refreshToken = await issueRefreshToken(uid);
    setRefreshTokenCookie(res, refreshToken);

    Logger.info('seller account registered', {
      requestId: req.requestId,
      uid,
      email: normalizedEmail,
    });

    res.status(201).json({
      uid,
      email: normalizedEmail,
      displayName: displayName.trim(),
      role: ROLES.SELLER,
      customToken: accessToken,
      dashboardPath: '/seller/products',
    });
  } catch (error) {
    Logger.warn('seller-register failed', {
      requestId: req.requestId,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: 'Unable to create seller account' });
  }
});

/**
 * Create a standard customer account. Creates a users row only (role=user) —
 * no seller_profiles row, no business fields collected or fabricated.
 */
authRouter.post('/auth/register', validate({ body: RegisterBodySchema }), async (req, res) => {
  const { email, password, fullName } = req.body as {
    email: string;
    password: string;
    fullName: string;
  };
  const normalizedEmail = email.trim().toLowerCase();

  try {
    const existingProfile = await loadAdminUserByEmail(normalizedEmail);
    if (existingProfile) {
      res.status(409).json({
        error: 'An account already exists for this email. Sign in instead.',
        code: 'EMAIL_EXISTS',
      });
      return;
    }

    const passwordHash = await hashPassword(password);
    const uid = randomUUID();
    const now = new Date();

    await db.insert(users).values({
      id: uid,
      email: normalizedEmail,
      passwordHash,
      displayName: fullName.trim(),
      role: ROLES.USER,
      emailVerified: false,
      createdAt: now,
      updatedAt: now,
    });

    const accessToken = signAccessToken({
      id: uid,
      email: normalizedEmail,
      emailVerified: false,
    });
    const refreshToken = await issueRefreshToken(uid);
    setRefreshTokenCookie(res, refreshToken);

    Logger.info('customer account registered', {
      requestId: req.requestId,
      uid,
      email: normalizedEmail,
    });

    res.status(201).json({
      uid,
      email: normalizedEmail,
      displayName: fullName.trim(),
      role: ROLES.USER,
      customToken: accessToken,
      dashboardPath: null,
    });
  } catch (error) {
    Logger.warn('register failed', {
      requestId: req.requestId,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: 'Unable to create account' });
  }
});

/**
 * Consumer -> Seller upgrade. Same user id/email, same session identity —
 * this only changes the users.role and attaches a seller_profiles row.
 * Consumer order history/wishlist/reviews/trust score stay intact because
 * they are keyed by this same userId and nothing here touches them.
 * Creators remain a separate account type per Blueprint — this endpoint
 * only accepts upgrades from plain "user" (Consumer) accounts.
 */
authRouter.post(
  '/auth/upgrade-to-seller',
  validate({ body: UpgradeToSellerBodySchema }),
  async (req, res) => {
    const token = getBearerToken(req.headers.authorization);
    if (!token) {
      recordFailedAuthAttempt(req.ip, req.originalUrl);
      sendAuthError(res, 401, AUTH_ERROR_CODES.MISSING_TOKEN, 'Missing bearer token');
      return;
    }

    const authed = await resolveAuthenticatedUserFromToken(token);
    if (!authed) {
      recordFailedAuthAttempt(req.ip, req.originalUrl);
      sendAuthError(res, 401, AUTH_ERROR_CODES.INVALID_TOKEN, 'Invalid token');
      return;
    }

    const { storeName, phone, category, city, website } = req.body as {
      storeName: string;
      phone: string;
      category: string;
      city: string;
      website?: string;
    };

    try {
      const rows = await db.select().from(users).where(eq(users.id, authed.uid)).limit(1);
      const user = rows[0];
      if (!user) {
        sendAuthError(res, 401, AUTH_ERROR_CODES.INVALID_TOKEN, 'Invalid token');
        return;
      }

      const currentRole = toUserRole(user.role);
      if (currentRole === ROLES.SELLER || currentRole === ROLES.VERIFIED_SELLER) {
        res.status(409).json({
          error: 'This account already has a Seller Workspace.',
          code: 'ALREADY_SELLER',
          dashboardPath: '/seller/products',
        });
        return;
      }
      if (currentRole !== ROLES.USER) {
        res.status(409).json({
          error: 'Only Consumer accounts can upgrade to a Seller Workspace.',
          code: 'UPGRADE_NOT_ALLOWED',
        });
        return;
      }

      const now = new Date();
      await db.transaction(async (tx) => {
        await tx
          .update(users)
          .set({ role: ROLES.SELLER, updatedAt: now })
          .where(eq(users.id, user.id));
        await tx
          .insert(sellerProfiles)
          .values({
            userId: user.id,
            storeName: storeName.trim(),
            phone: phone.trim(),
            category: category.trim(),
            city: city.trim(),
            website: website?.trim() || null,
            createdAt: now,
          })
          .onConflictDoUpdate({
            target: sellerProfiles.userId,
            set: {
              storeName: storeName.trim(),
              phone: phone.trim(),
              category: category.trim(),
              city: city.trim(),
              website: website?.trim() || null,
            },
          });
      });

      const accessToken = signAccessToken({
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
      });
      const refreshToken = await issueRefreshToken(user.id);
      setRefreshTokenCookie(res, refreshToken);

      publishEvent({
        eventName: 'SellerUpgraded',
        domain: 'Marketplace',
        producer: 'authRouter',
        aggregateId: user.id,
        actor: user.id,
        payload: { userId: user.id, email: user.email, storeName: storeName.trim() },
      });

      Logger.info('consumer upgraded to seller', {
        requestId: req.requestId,
        uid: user.id,
        email: user.email,
      });

      res.json({
        uid: user.id,
        email: user.email,
        displayName: user.displayName,
        role: ROLES.SELLER,
        accessToken,
        dashboardPath: '/seller/products',
      });
    } catch (error) {
      Logger.warn('upgrade-to-seller failed', {
        requestId: req.requestId,
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: 'Unable to upgrade to a Seller Workspace' });
    }
  },
);

authRouter.post('/auth/refresh', async (req, res) => {
  try {
    const raw = readRefreshTokenCookie(req.headers.cookie);
    if (!raw) {
      operationalEvents.authenticationFailure({
        requestId: req.requestId,
        path: req.originalUrl,
        message: 'Missing refresh token',
        metadata: { reason: 'refresh_missing' },
      });
      res.status(401).json({ error: 'Missing refresh token' });
      return;
    }

    const rotated = await rotateRefreshToken(raw);
    if (!rotated) {
      clearRefreshTokenCookie(res);
      operationalEvents.authenticationFailure({
        requestId: req.requestId,
        path: req.originalUrl,
        message: 'Invalid or expired refresh token',
        metadata: { reason: 'refresh_invalid_or_expired' },
      });
      res.status(401).json({ error: 'Invalid or expired refresh token' });
      return;
    }

    setRefreshTokenCookie(res, rotated.refreshToken);
    res.json({ accessToken: rotated.accessToken });
  } catch (error) {
    Logger.warn('refresh failed', {
      requestId: req.requestId,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: 'Unable to refresh session' });
  }
});

authRouter.post('/auth/logout', async (req, res) => {
  try {
    const raw = readRefreshTokenCookie(req.headers.cookie);
    if (raw) {
      await revokeRefreshToken(raw);
    }
    clearRefreshTokenCookie(res);
    operationalEvents.logout({
      requestId: req.requestId,
      path: req.originalUrl,
      metadata: { hadRefreshToken: Boolean(raw) },
    });
    res.json({ ok: true });
  } catch (error) {
    Logger.warn('logout failed', {
      requestId: req.requestId,
      error: error instanceof Error ? error.message : String(error),
    });
    clearRefreshTokenCookie(res);
    res.status(500).json({ error: 'Unable to log out' });
  }
});

authRouter.get('/auth/me', async (req, res) => {
  const token = getBearerToken(req.headers.authorization);

  if (!token) {
    recordFailedAuthAttempt(req.ip, req.originalUrl);
    sendAuthError(res, 401, AUTH_ERROR_CODES.MISSING_TOKEN, 'Missing bearer token');
    return;
  }

  try {
    const user = await resolveAuthenticatedUserFromToken(token);

    // Token failed to parse/verify (malformed, bad signature, unknown claims shape) —
    // this is an invalid credential, not an authorization decision. 401, not 403.
    if (!user) {
      recordFailedAuthAttempt(req.ip, req.originalUrl);
      sendAuthError(res, 401, AUTH_ERROR_CODES.INVALID_TOKEN, 'Invalid token');
      return;
    }

    // Successfully authenticated. Bare buyers resolve as role "user" — that's a real,
    // valid session that simply lacks the admin/seller/staff role this endpoint requires.
    // Insufficient role on a valid credential is exactly what 403 is for.
    if (user.role !== ROLES.USER) {
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

    sendAuthError(res, 403, AUTH_ERROR_CODES.FORBIDDEN, 'User is not registered as an admin.');
  } catch (error) {
    const abuse = recordFailedAuthAttempt(req.ip, req.originalUrl);
    if (abuse.thresholdExceeded) {
      Logger.warn('Excessive failed authentication attempts', {
        requestId: req.requestId,
        path: req.originalUrl,
        count: abuse.count,
      });
    }
    const expired = isExpiredJwtError(error);
    sendAuthError(
      res,
      401,
      expired ? AUTH_ERROR_CODES.EXPIRED_TOKEN : AUTH_ERROR_CODES.INVALID_TOKEN,
      expired ? 'Expired token' : 'Invalid token',
    );
  }
});

/** NODE_ENV must match one of these exactly for dev-login to ever be reachable. */
const DEV_LOGIN_ALLOWED_ENVIRONMENTS = new Set(['development', 'test']);

/**
 * Fail-closed by construction and by allowlist, not by exclusion: NODE_ENV
 * must be explicitly "development" or "test" — production, staging, preview,
 * an empty string, and a missing/undefined NODE_ENV are all denied, not just
 * "production". Exported so it can be regression tested directly (see
 * scripts/probe-dev-login-isolation.ts) without booting a server.
 */
export function isDevLoginAllowed(env?: {
  NODE_ENV?: string;
  ALLOW_DEV_LOGIN?: string;
}): boolean {
  const source = env ?? process.env;
  return (
    source.ALLOW_DEV_LOGIN === 'true' &&
    typeof source.NODE_ENV === 'string' &&
    DEV_LOGIN_ALLOWED_ENVIRONMENTS.has(source.NODE_ENV)
  );
}

authRouter.post('/auth/dev-login', validate({ body: DevLoginBodySchema }), (req, res) => {
  if (!isDevLoginAllowed()) {
    res.status(403).json({ error: 'Dev login disabled' });
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
