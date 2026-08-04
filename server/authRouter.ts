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
  readRefreshTokenCookie,
  revokeRefreshToken,
  rotateRefreshToken,
  setRefreshTokenCookie,
  signAccessToken,
  verifyPassword,
} from './auth/jwtTokens';
import { recordLogin } from './analytics/eventHooks';
import { recordFailedAuthAttempt } from './lib/abuseProtection';
import { Logger } from './lib/logger';
import { validate } from './middleware/validate';
import { DevLoginBodySchema } from './validation/auth/devLoginSchema';
import { LoginBodySchema } from './validation/auth/loginSchema';
import { RegisterBodySchema } from './validation/auth/registerSchema';
import { SellerRegisterBodySchema } from './validation/auth/sellerRegisterSchema';
import { loadAdminUserByEmail } from './operations/operationsDb';
import { db } from './db/client';
import { sellerProfiles, users } from './db/schema';
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

authRouter.post('/auth/login', validate({ body: LoginBodySchema }), async (req, res) => {
  const { email, password } = req.body as { email: string; password: string };
  const normalizedEmail = email.trim().toLowerCase();

  try {
    const rows = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
    const user = rows[0];
    if (!user?.passwordHash) {
      recordFailedAuthAttempt(req.ip, req.originalUrl);
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const ok = await verifyPassword(user.passwordHash, password);
    if (!ok) {
      recordFailedAuthAttempt(req.ip, req.originalUrl);
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

authRouter.post('/auth/refresh', async (req, res) => {
  try {
    const raw = readRefreshTokenCookie(req.headers.cookie);
    if (!raw) {
      res.status(401).json({ error: 'Missing refresh token' });
      return;
    }

    const rotated = await rotateRefreshToken(raw);
    if (!rotated) {
      clearRefreshTokenCookie(res);
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
    res.status(401).json({ error: 'Missing bearer token' });
    return;
  }

  try {
    const user = await resolveAuthenticatedUserFromToken(token);
    // Bare buyers resolve as role "user". Admin /auth/me still requires a staff/seller profile.
    if (user && user.role !== ROLES.USER) {
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
