import { randomBytes, randomUUID } from 'node:crypto';
import { Router } from 'express';
import { and, eq, isNull } from 'drizzle-orm';
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
  revokeAllRefreshTokensForUser,
  revokeRefreshToken,
  rotateRefreshToken,
  setRefreshTokenCookie,
  signAccessToken,
  verifyPassword,
} from './auth/jwtTokens';
import { consumeAuthToken, issueAuthToken } from './auth/authTokens';
import {
  consumeSetupGrant,
  LocalPasswordSetupError,
  maskEmail,
  requestSetupOtp,
  verifySetupOtp,
} from './auth/localPasswordSetup';
import {
  sendLocalPasswordOtpEmail,
  sendPasswordAddedEmail,
  sendPasswordChangedEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
  sendWelcomeEmail,
  type ResetSurface,
} from './email/emailService';
import {
  resolveOrCreateUserForSocialIdentity,
  socialProvidersStatus,
  SocialAuthError,
  verifyFacebookCredential,
  verifyGoogleCredential,
  type VerifiedSocialIdentity,
} from './auth/socialAuth';
import {
  allocateNextChoosifyUserId,
  backfillChoosifyUserIds,
  ensureUserHasChoosifyUserId,
  findUserByChoosifyUserId,
  normalizeChoosifyUserIdQuery,
} from './auth/choosifyUserId';
import {
  getUserProfileExtras,
  PROFILE_NAME_LOCK_MS,
  upsertUserProfileExtras,
} from './auth/userProfileExtras';
import { AUTH_ERROR_CODES, sendAuthError } from './auth/authErrors';
import { recordLogin } from './analytics/eventHooks';
import { recordFailedAuthAttempt } from './lib/abuseProtection';
import { Logger } from './lib/logger';
import { operationalEvents } from './logging/operationalEvents';
import { authenticateRequest } from './middleware/auth';
import { requireRole } from './middleware/authorization';
import { validate } from './middleware/validate';
import { operationsStore } from './operations/operationsStore';
import {
  cleanupExpiredImpersonations,
  createImpersonationSession,
  endImpersonationSession,
  getImpersonationSession,
  listImpersonationSessions,
} from './impersonation/impersonationStore';
import { DevLoginBodySchema } from './validation/auth/devLoginSchema';
import { LoginBodySchema } from './validation/auth/loginSchema';
import { RegisterBodySchema } from './validation/auth/registerSchema';
import { UpgradeToSellerBodySchema } from './validation/auth/upgradeToSellerSchema';
import { loadAdminUserByEmail } from './operations/operationsDb';
import { db } from './db/client';
import { sellerProfiles, userIdentities, users } from './db/schema';
import { normalizePrimaryPhone } from './lib/phone';
import { hasRole } from './permissions/authorization';
import { ROLES, toUserRole, type UserRole } from './permissions/roles';
import { publishEvent } from './events/eventBus';
import {
  publicLifecycleFields,
  resolvePartnerLifecycle,
} from './partnerApplications/partnerLifecycle';
import { accountStatusPayload } from './profileStatusFacts';

export const authRouter = Router();

const requireAuth = [authenticateRequest];
const requireAdmin = [authenticateRequest, requireRole(ROLES.ADMIN)];

/**
 * The trusted auth surface for an account, decided SERVER-SIDE from the
 * canonical role. Consumers → the storefront (choosify.bd); every dashboard /
 * partner / staff role → the dashboard (dashboard.choosify.bd). A verification
 * or reset link is always built from this — never from a client-supplied URL.
 */
function resetSurfaceForRole(role: string | null | undefined): 'web' | 'dashboard' {
  return role && role !== ROLES.USER ? 'dashboard' : 'web';
}

/**
 * Public seller/creator-account lookup for the storefront Dashboard partner-account UI.
 * Returns only booleans — no profile details — to limit email enumeration risk.
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
    const hasCreatorAccount = role === ROLES.CREATOR;

    res.json({
      hasSellerAccount,
      hasCreatorAccount,
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

    const extras = getUserProfileExtras(user.id);
    let choosifyUserId = user.choosifyUserId || undefined;
    try {
      choosifyUserId = await ensureUserHasChoosifyUserId(user.id);
    } catch (error) {
      Logger.warn('choosifyUserId ensure on login failed', {
        userId: user.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    const life = await resolvePartnerLifecycle({
      userId: user.id,
      email: user.email,
      role: user.role,
    });
    res.json({
      uid: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      accessToken,
      choosifyUserId: choosifyUserId || null,
      hasPassword: true,
      changeNextLogin: extras?.changeNextLogin === true,
      ...publicLifecycleFields(life),
      ...(extras?.lastNameChangedAt && { lastNameChangedAt: extras.lastNameChangedAt }),
      ...(extras?.username && { username: extras.username }),
      ...(extras?.website && { website: extras.website }),
      ...(extras?.bio && { bio: extras.bio }),
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
authRouter.post(
  '/auth/seller-register',
  (_req, res) => {
    res.status(403).json({
      error:
        'Direct seller self-registration is disabled. Submit a Partner Application for Admin review.',
      code: 'PARTNER_APPLICATION_REQUIRED',
      applyPath: '/signup',
    });
  },
);

/**
 * Create a standard customer account. Creates a users row only (role=user) —
 * no seller_profiles row, no business fields collected or fabricated.
 */
authRouter.post(
  '/auth/register',
  (req, res, next) => {
    const body = (req.body || {}) as Record<string, unknown>;
    if (body.choosifyUserId || body.userCode || body.publicId || body.cfId || body.choosifyId) {
      res.status(400).json({
        error: 'choosifyUserId is server-assigned and cannot be supplied by the client',
        code: 'CHOOSIFY_USER_ID_IMMUTABLE',
      });
      return;
    }
    next();
  },
  validate({ body: RegisterBodySchema }),
  async (req, res) => {
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
    let choosifyUserId = '';

    await db.transaction(async (tx) => {
      choosifyUserId = await allocateNextChoosifyUserId(tx);
      await tx.insert(users).values({
        id: uid,
        email: normalizedEmail,
        passwordHash,
        displayName: fullName.trim(),
        role: ROLES.USER,
        emailVerified: false,
        choosifyUserId,
        createdAt: now,
        updatedAt: now,
      });
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
      choosifyUserId,
    });

    // Email verification is informational only — never blocks registration
    // or login. A slow/unconfigured email send must not fail account creation.
    try {
      const { rawToken } = await issueAuthToken(uid, 'email_verification');
      await sendVerificationEmail(normalizedEmail, rawToken, { name: fullName.trim(), surface: 'web' });
    } catch (error) {
      Logger.warn('verification email failed to send', {
        requestId: req.requestId,
        uid,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    res.status(201).json({
      uid,
      email: normalizedEmail,
      displayName: fullName.trim(),
      role: ROLES.USER,
      choosifyUserId,
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
 * Issue the SAME session (access JWT + rotating refresh cookie) and identity
 * payload as POST /auth/login, for a user row we've already authenticated by
 * some other means (currently: a server-verified social provider credential).
 * Kept separate from the /auth/login handler so that flow is untouched.
 */
async function finalizeLoginSession(
  req: import('express').Request,
  res: import('express').Response,
  user: typeof users.$inferSelect,
  mode: string,
): Promise<void> {
  const accessToken = signAccessToken({
    id: user.id,
    email: user.email,
    emailVerified: user.emailVerified,
  });
  const refreshToken = await issueRefreshToken(user.id);
  setRefreshTokenCookie(res, refreshToken);

  recordLogin(req, { userId: user.id, metadata: { mode, role: user.role } });
  operationalEvents.authenticationSuccess({
    requestId: req.requestId,
    path: req.originalUrl,
    metadata: { mode, userId: user.id, role: user.role },
  });

  const extras = getUserProfileExtras(user.id);
  let choosifyUserId = user.choosifyUserId || undefined;
  try {
    choosifyUserId = await ensureUserHasChoosifyUserId(user.id);
  } catch (error) {
    Logger.warn('choosifyUserId ensure on social login failed', {
      userId: user.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
  const life = await resolvePartnerLifecycle({
    userId: user.id,
    email: user.email,
    role: user.role,
  });
  res.json({
    uid: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    accessToken,
    choosifyUserId: choosifyUserId || null,
    changeNextLogin: extras?.changeNextLogin === true,
    ...publicLifecycleFields(life),
    ...(extras?.lastNameChangedAt && { lastNameChangedAt: extras.lastNameChangedAt }),
    ...(extras?.username && { username: extras.username }),
    ...(extras?.website && { website: extras.website }),
    ...(extras?.bio && { bio: extras.bio }),
  });
}

/** Which social providers the server can actually verify right now. Public — the
 *  consumer Login page reads this to decide which buttons are active. */
authRouter.get('/auth/social/providers', (_req, res) => {
  res.json({ providers: socialProvidersStatus() });
});

/**
 * Social sign-in / sign-up — Consumer storefront only.
 *
 *  - The backend verifies the provider credential itself (Google ID token via
 *    google-auth-library; Facebook access token via the Graph API). A raw email
 *    from the client is never trusted.
 *  - Resolves to / creates ONE canonical Choosify Postgres account and issues
 *    the normal JWT + refresh session.
 *  - New accounts are ALWAYS role 'user'. The provider can never grant Seller /
 *    Creator / Admin / Super Admin / staff. A verified email that already
 *    belongs to a NON-consumer account is refused (409) — those use password
 *    login on the dashboard, which is unchanged.
 */
async function handleSocialLogin(
  req: import('express').Request,
  res: import('express').Response,
  verify: () => Promise<VerifiedSocialIdentity>,
  mode: string,
): Promise<void> {
  try {
    const identity = await verify();
    const resolution = await resolveOrCreateUserForSocialIdentity(identity);

    const rows = await db.select().from(users).where(eq(users.id, resolution.userId)).limit(1);
    const user = rows[0];
    if (!user) {
      res.status(500).json({ error: 'Unable to sign in', code: 'ACCOUNT_LOOKUP_FAILED' });
      return;
    }
    // Defence in depth: a social session is only ever a Consumer session.
    if (user.role !== ROLES.USER) {
      Logger.warn('social login resolved to a non-consumer account — refused', {
        requestId: req.requestId,
        userId: user.id,
        role: user.role,
        provider: identity.provider,
      });
      res.status(409).json({
        error: 'This email belongs to a Choosify dashboard account. Please sign in with your email and password.',
        code: 'SOCIAL_ACCOUNT_CONFLICT',
      });
      return;
    }

    if (resolution.created) {
      Logger.audit('auth.social_account_created', {
        userId: user.id,
        provider: identity.provider,
        ip: req.ip,
      });
      publishEvent({
        eventName: 'UserRegistered',
        domain: 'Identity',
        producer: 'authRouter',
        aggregateId: user.id,
        actor: user.id,
        payload: { email: user.email, via: identity.provider },
      });
      try {
        await sendWelcomeEmail(user.email, user.displayName);
      } catch (error) {
        Logger.warn('welcome email failed to send', {
          requestId: req.requestId,
          userId: user.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    } else if (resolution.linked) {
      Logger.audit('auth.social_identity_linked', {
        userId: user.id,
        provider: identity.provider,
        ip: req.ip,
      });
      publishEvent({
        eventName: 'SocialIdentityLinked',
        domain: 'Identity',
        producer: 'authRouter',
        aggregateId: user.id,
        actor: user.id,
        payload: { email: user.email, provider: identity.provider },
      });
    }

    await finalizeLoginSession(req, res, user, mode);
  } catch (error) {
    if (error instanceof SocialAuthError) {
      if (error.statusCode >= 500 || error.statusCode === 401) {
        recordFailedAuthAttempt(req.ip, req.originalUrl);
      }
      res.status(error.statusCode).json({ error: error.message, code: error.code });
      return;
    }
    Logger.warn('social login failed', {
      requestId: req.requestId,
      mode,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: 'Unable to sign in' });
  }
}

authRouter.post('/auth/google', async (req, res) => {
  const credential = String(req.body?.credential || req.body?.idToken || '').trim();
  await handleSocialLogin(req, res, () => verifyGoogleCredential(credential), 'google');
});

authRouter.post('/auth/facebook', async (req, res) => {
  const accessToken = String(req.body?.accessToken || req.body?.token || '').trim();
  await handleSocialLogin(req, res, () => verifyFacebookCredential(accessToken), 'facebook');
});

/**
 * Self-service email verification. The token is one-time-use and only
 * valid for the email_verification type (a password-reset token cannot be
 * replayed here) — see server/auth/authTokens.ts.
 */
authRouter.post('/auth/verify-email', async (req, res) => {
  const token = String(req.body?.token || '').trim();
  if (!token) {
    res.status(400).json({ success: false, error: 'token is required' });
    return;
  }
  try {
    const userId = await consumeAuthToken(token, 'email_verification');
    if (!userId) {
      res.status(400).json({ success: false, error: 'Invalid or expired verification link.' });
      return;
    }
    await db.update(users).set({ emailVerified: true, updatedAt: new Date() }).where(eq(users.id, userId));
    Logger.audit('auth.email_verified', { userId, ip: req.ip });
    res.json({ success: true });
  } catch (error) {
    Logger.warn('verify-email failed', { requestId: req.requestId, error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ success: false, error: 'Unable to verify email' });
  }
});

/** Re-sends a fresh verification link for the currently authenticated account. Generic response either way — no account-existence signal beyond "you're logged in." */
authRouter.post('/auth/resend-verification', authenticateRequest, async (req, res) => {
  try {
    const rows = await db.select().from(users).where(eq(users.id, req.userId!)).limit(1);
    const user = rows[0];
    if (!user) {
      res.status(404).json({ success: false, error: 'Account not found' });
      return;
    }
    if (user.emailVerified) {
      res.json({ success: true, message: 'Email is already verified.' });
      return;
    }
    const { rawToken } = await issueAuthToken(user.id, 'email_verification');
    await sendVerificationEmail(user.email, rawToken, {
      name: user.displayName,
      surface: resetSurfaceForRole(user.role),
    });
    res.json({ success: true, message: 'Verification email sent.' });
  } catch (error) {
    Logger.warn('resend-verification failed', { requestId: req.requestId, error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ success: false, error: 'Unable to resend verification email' });
  }
});

/**
 * Consumer -> Seller upgrade — CLOSED.
 * Self-grant of Seller role is no longer allowed. Consumers must submit a
 * Partner Application (`POST /auth/partner-apply`). Apply provisions a restricted
 * partner account on the same uid/CF ID; Admin later enables Marketplace Access.
 */
authRouter.post('/auth/upgrade-to-seller', (_req, res) => {
  res.status(403).json({
    error:
      'Direct Consumer→Seller self-upgrade is disabled. Submit a Partner Application for Admin review.',
    code: 'PARTNER_APPLICATION_REQUIRED',
    applyPath: '/signup',
  });
});

/* Legacy upgrade-to-seller body retained only as comment reference — route above is authoritative.
authRouter.post(
  '/auth/upgrade-to-seller',
  validate({ body: UpgradeToSellerBodySchema }),
  async (req, res) => {
    // removed: self-grant
  },
);
*/

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

    // Any authenticated account (Consumer included) may read own identity + CF ID.
    // Dashboard RoleGuard still restricts admin surfaces.
    recordLogin(req, {
      userId: user.uid,
      metadata: { mode: 'token', role: user.role },
    });

    const extras = getUserProfileExtras(user.uid);
    let website: string | undefined = extras?.website;
    let choosifyUserId: string | null = null;
    try {
      choosifyUserId = await ensureUserHasChoosifyUserId(user.uid);
    } catch (error) {
      Logger.warn('choosifyUserId ensure on /auth/me failed', {
        userId: user.uid,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    try {
      const profileRows = await db
        .select()
        .from(sellerProfiles)
        .where(eq(sellerProfiles.userId, user.uid))
        .limit(1);
      if (profileRows[0]?.website) website = profileRows[0].website;
    } catch {
      /* optional seller profile */
    }
    const life = await resolvePartnerLifecycle({
      userId: user.uid,
      email: user.email,
      role: user.role,
    });
    let avatarUrl: string | undefined;
    let hasPassword = true;
    try {
      const userRows = await db
        .select({ avatarUrl: users.avatarUrl, passwordHash: users.passwordHash })
        .from(users)
        .where(eq(users.id, user.uid))
        .limit(1);
      avatarUrl = userRows[0]?.avatarUrl || undefined;
      hasPassword = Boolean(userRows[0]?.passwordHash);
    } catch {
      /* avatarUrl is optional */
    }

    // Linked social identities — provider + (masked) provider email + link time.
    // Never exposes provider_subject. Empty array when the account has none.
    let identities: Array<{ provider: string; email: string | null; connectedAt: string }> = [];
    try {
      const idRows = await db
        .select({
          provider: userIdentities.provider,
          providerEmail: userIdentities.providerEmail,
          linkedAt: userIdentities.linkedAt,
        })
        .from(userIdentities)
        .where(eq(userIdentities.userId, user.uid));
      identities = idRows.map((r) => ({
        provider: r.provider,
        email: r.providerEmail ? maskEmail(r.providerEmail) : null,
        connectedAt: r.linkedAt instanceof Date ? r.linkedAt.toISOString() : String(r.linkedAt ?? ''),
      }));
    } catch {
      /* user_identities is optional until migration 0005 */
    }

    res.json({
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      choosifyUserId,
      // Canonical account/security facts for the storefront Profile Settings.
      emailVerified: user.emailVerified === true,
      hasPassword,
      phone: extras?.phone || null,
      identities,
      changeNextLogin: extras?.changeNextLogin === true,
      ...publicLifecycleFields(life),
      ...(extras?.lastNameChangedAt && { lastNameChangedAt: extras.lastNameChangedAt }),
      ...(extras?.username && { username: extras.username }),
      ...(website && { website }),
      ...(extras?.bio && { bio: extras.bio }),
      ...(avatarUrl && { avatarUrl }),
    });
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

/**
 * Admin-only, server-authorized impersonation (support/diagnostics).
 *
 * - Effective actor for RBAC = target account (decoded uid).
 * - Real actor for audit = admin/super_admin (JWT impersonation claims).
 * - Original admin access token remains intact on the client (client swaps tokens).
 */
authRouter.post('/auth/impersonate/start', ...requireAuth, async (req, res) => {
  const actorRole = req.userRole;
  if (!actorRole) {
    sendAuthError(res, 401, AUTH_ERROR_CODES.UNAUTHORIZED, 'Authentication required');
    return;
  }

  // Deny nested impersonation by construction:
  // effective actor is no longer admin when impersonating; start requires admin role.
  if (actorRole !== ROLES.ADMIN && actorRole !== ROLES.SUPER_ADMIN) {
    sendAuthError(res, 403, AUTH_ERROR_CODES.FORBIDDEN, 'Impersonation requires admin/super admin');
    return;
  }

  const permissions = operationsStore.getPermissions();
  const canImpersonate = actorRole === ROLES.SUPER_ADMIN || Boolean(permissions[actorRole]?.impersonate);
  if (!canImpersonate) {
    sendAuthError(res, 403, AUTH_ERROR_CODES.FORBIDDEN, 'Missing user.impersonate permission');
    return;
  }

  const actorUserId = req.userId || '';
  const body = req.body || {};
  const targetUserId = typeof body.targetUserId === 'string' ? body.targetUserId : '';
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) : '';

  if (!targetUserId) {
    res.status(400).json({ success: false, error: 'targetUserId is required' });
    return;
  }
  if (reason.length < 2) {
    res.status(400).json({ success: false, error: 'reason is required' });
    return;
  }

  // Resolve target account.
  const targetRows = await db
    .select()
    .from(users)
    .where(eq(users.id, targetUserId))
    .limit(1);
  const target = targetRows[0];
  if (!target) {
    res.status(404).json({ success: false, error: 'Target user not found' });
    return;
  }

  const targetRole = toUserRole(target.role as unknown);
  const disallowedTargetRoles: Array<UserRole> = [ROLES.ADMIN, ROLES.SUPER_ADMIN];
  if (disallowedTargetRoles.includes(targetRole)) {
    sendAuthError(res, 403, AUTH_ERROR_CODES.FORBIDDEN, 'Cannot impersonate admin/super admin');
    return;
  }

  // Create impersonation session (short-lived).
  const startedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 30).toISOString(); // 30m
  const impersonationSessionId = `imp_${randomUUID()}`;

  let adminChoosifyUserId: string | undefined;
  try {
    adminChoosifyUserId = await ensureUserHasChoosifyUserId(actorUserId);
  } catch {
    adminChoosifyUserId = undefined;
  }
  let targetChoosifyUserId =
    typeof (target as { choosifyUserId?: string | null }).choosifyUserId === 'string'
      ? String((target as { choosifyUserId?: string | null }).choosifyUserId)
      : undefined;
  if (!targetChoosifyUserId) {
    try {
      targetChoosifyUserId = await ensureUserHasChoosifyUserId(target.id);
    } catch {
      targetChoosifyUserId = undefined;
    }
  }

  createImpersonationSession({
    impersonationSessionId,
    adminUserId: actorUserId,
    adminRole: actorRole,
    adminChoosifyUserId,
    targetUserId: target.id,
    targetRole,
    targetChoosifyUserId,
    startedAt,
    expiresAt,
    reason,
  });

  Logger.audit('ImpersonationStarted', {
    impersonationSessionId,
    adminUserId: actorUserId,
    adminChoosifyUserId: adminChoosifyUserId || null,
    adminRole: actorRole,
    targetUserId: target.id,
    targetChoosifyUserId: targetChoosifyUserId || null,
    targetRole,
    reason,
    startedAt,
    expiresAt,
    ip: req.ip,
    userAgent: req.get('user-agent') || undefined,
  });

  const accessToken = signAccessToken({
    id: target.id,
    email: target.email,
    emailVerified: target.emailVerified,
    impersonation: {
      sessionId: impersonationSessionId,
      realActorUid: actorUserId,
      realActorRole: actorRole,
      startedAt,
      expiresAt,
      reason,
    },
  });

  res.json({
    success: true,
    impersonationSessionId,
    expiresAt,
    accessToken,
    targetUserId: target.id,
    targetRole,
  });
});

authRouter.post('/auth/impersonate/exit', ...requireAuth, async (req, res) => {
  const sessionId = req.impersonationSessionId;
  if (!sessionId) {
    res.status(400).json({ success: false, error: 'No impersonation session' });
    return;
  }

  const sess = getImpersonationSession(sessionId);
  if (!sess) {
    res.status(404).json({ success: false, error: 'Impersonation session not found' });
    return;
  }

  const ended = endImpersonationSession(sessionId);
  const endedAt = ended?.endedAt || new Date().toISOString();
  Logger.audit('ImpersonationEnded', {
    impersonationSessionId: sessionId,
    adminUserId: sess.adminUserId,
    adminChoosifyUserId: sess.adminChoosifyUserId || null,
    adminRole: sess.adminRole,
    targetUserId: sess.targetUserId,
    targetChoosifyUserId: sess.targetChoosifyUserId || null,
    targetRole: sess.targetRole,
    reason: sess.reason,
    startedAt: sess.startedAt,
    endedAt,
    ip: req.ip,
    userAgent: req.get('user-agent') || undefined,
  });

  res.json({
    success: true,
    audit: {
      event: 'ImpersonationEnded',
      impersonationSessionId: sessionId,
      adminUserId: sess.adminUserId,
      adminChoosifyUserId: sess.adminChoosifyUserId || null,
      adminRole: sess.adminRole,
      targetUserId: sess.targetUserId,
      targetChoosifyUserId: sess.targetChoosifyUserId || null,
      targetRole: sess.targetRole,
      reason: sess.reason,
      startedAt: sess.startedAt,
      endedAt,
    },
  });
});

authRouter.get('/auth/impersonate/status', ...requireAuth, async (req, res) => {
  const sessionId = req.impersonationSessionId;
  if (!sessionId) {
    res.json({ success: true, active: false });
    return;
  }

  cleanupExpiredImpersonations();
  const sess = getImpersonationSession(sessionId);
  if (!sess || sess.endedAt || new Date(sess.expiresAt).getTime() <= Date.now()) {
    res.json({ success: true, active: false });
    return;
  }

  res.json({
    success: true,
    active: true,
    impersonationSessionId: sess.impersonationSessionId,
    startedAt: sess.startedAt,
    expiresAt: sess.expiresAt,
    adminUserId: sess.adminUserId,
    adminChoosifyUserId: sess.adminChoosifyUserId || null,
    adminRole: sess.adminRole,
    targetUserId: sess.targetUserId,
    targetChoosifyUserId: sess.targetChoosifyUserId || null,
    targetRole: sess.targetRole,
    reason: sess.reason,
  });
});

/** Admin-only: list recent impersonation sessions (including ended) for audit verification. */
authRouter.get('/auth/impersonate/history', ...requireAuth, async (req, res) => {
  const actorRole = req.userRole;
  if (actorRole !== ROLES.ADMIN && actorRole !== ROLES.SUPER_ADMIN) {
    sendAuthError(res, 403, AUTH_ERROR_CODES.FORBIDDEN, 'Admin only');
    return;
  }
  if (req.impersonationSessionId) {
    res.status(403).json({ success: false, error: 'Unavailable during Admin impersonation' });
    return;
  }
  cleanupExpiredImpersonations();
  const sessions = listImpersonationSessions().slice(0, 50);
  res.json({
    success: true,
    sessions: sessions.map((s) => ({
      impersonationSessionId: s.impersonationSessionId,
      adminUserId: s.adminUserId,
      adminChoosifyUserId: s.adminChoosifyUserId || null,
      adminRole: s.adminRole,
      targetUserId: s.targetUserId,
      targetChoosifyUserId: s.targetChoosifyUserId || null,
      targetRole: s.targetRole,
      reason: s.reason,
      startedAt: s.startedAt,
      expiresAt: s.expiresAt,
      endedAt: s.endedAt || null,
      event: s.endedAt ? 'ImpersonationEnded' : 'ImpersonationStarted',
    })),
  });
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

/**
 * PATCH owner/admin profile identity fields.
 * Display name: 90-day lock for non-admins; admin override audited.
 * username / website / bio: owner-editable without the 90-day restriction.
 */
authRouter.patch('/auth/profile', ...requireAuth, async (req, res) => {
  if (
    Object.prototype.hasOwnProperty.call(req.body || {}, 'choosifyUserId') ||
    Object.prototype.hasOwnProperty.call(req.body || {}, 'userCode') ||
    Object.prototype.hasOwnProperty.call(req.body || {}, 'publicId') ||
    Object.prototype.hasOwnProperty.call(req.body || {}, 'cfId')
  ) {
    res.status(403).json({
      success: false,
      error: 'Choosify User ID is immutable and cannot be changed',
      code: 'CHOOSIFY_USER_ID_IMMUTABLE',
    });
    return;
  }
  const actorId = req.userId || req.user?.uid || '';
  const actorRole = (req.userRole || req.user?.role) as UserRole | undefined;
  const targetUserId = String(req.body?.userId || actorId).trim() || actorId;
  const adminOverride = req.body?.adminOverride === true;

  const hasDisplayName = Object.prototype.hasOwnProperty.call(req.body || {}, 'displayName');
  const displayName = hasDisplayName ? String(req.body?.displayName || '').trim() : undefined;
  const hasUsername = Object.prototype.hasOwnProperty.call(req.body || {}, 'username');
  const username = hasUsername
    ? String(req.body?.username || '')
        .trim()
        .replace(/^@/, '')
        .slice(0, 64)
    : undefined;
  const hasWebsite = Object.prototype.hasOwnProperty.call(req.body || {}, 'website');
  const website = hasWebsite
    ? String(req.body?.website || '')
        .trim()
        .slice(0, 320)
    : undefined;
  const hasBio = Object.prototype.hasOwnProperty.call(req.body || {}, 'bio');
  const bio = hasBio
    ? String(req.body?.bio || '')
        .trim()
        .slice(0, 2000)
    : undefined;
  const hasAvatarUrl = Object.prototype.hasOwnProperty.call(req.body || {}, 'avatarUrl');
  const avatarUrl = hasAvatarUrl
    ? String(req.body?.avatarUrl || '')
        .trim()
        .slice(0, 700)
    : undefined;

  // Primary account phone. Present + empty/null => clear it. Present + value =>
  // normalize server-side to canonical E.164 (see server/lib/phone.ts) — the
  // browser's formatting is never trusted. Contact info only; not a credential,
  // not unique, and editing it does not touch any historical order snapshot.
  const hasPhone = Object.prototype.hasOwnProperty.call(req.body || {}, 'phone');
  const phoneRaw = hasPhone ? req.body?.phone : undefined;
  let phone: string | null | undefined;
  if (hasPhone) {
    if (phoneRaw === null || (typeof phoneRaw === 'string' && phoneRaw.trim() === '')) {
      phone = null; // explicit delete
    } else {
      const normalized = normalizePrimaryPhone(phoneRaw);
      if (normalized.ok && normalized.e164) {
        phone = normalized.e164;
      } else {
        res.status(400).json({
          success: false,
          error: normalized.error || 'Enter a valid phone number.',
          code: 'INVALID_PHONE',
        });
        return;
      }
    }
  }

  if (
    displayName === undefined &&
    username === undefined &&
    website === undefined &&
    bio === undefined &&
    avatarUrl === undefined &&
    phone === undefined
  ) {
    res.status(400).json({
      success: false,
      error: 'Provide at least one of displayName, username, website, bio, avatarUrl, phone',
    });
    return;
  }

  if (avatarUrl !== undefined && avatarUrl && !/^\/media\/|^https?:\/\//i.test(avatarUrl)) {
    res.status(400).json({ success: false, error: 'avatarUrl must be a Choosify media URL' });
    return;
  }

  if (displayName !== undefined && (displayName.length < 2 || displayName.length > 120)) {
    res.status(400).json({ success: false, error: 'displayName must be 2–120 characters' });
    return;
  }

  if (website !== undefined && website) {
    const lower = website.toLowerCase();
    if (
      lower.startsWith('javascript:') ||
      lower.startsWith('data:') ||
      lower.startsWith('vbscript:')
    ) {
      res.status(400).json({ success: false, error: 'website URL scheme is not allowed' });
      return;
    }
  }

  const isAdmin = hasRole(actorRole, ROLES.ADMIN);
  const isSelf = targetUserId === actorId;
  if (!isSelf && !isAdmin) {
    sendAuthError(res, 403, AUTH_ERROR_CODES.FORBIDDEN, 'Not authorized to update this profile');
    return;
  }

  try {
    const rows = await db.select().from(users).where(eq(users.id, targetUserId)).limit(1);
    const user = rows[0];
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    const extras = getUserProfileExtras(targetUserId);
    const now = new Date();
    let nextExtras = extras;

    if (displayName !== undefined && displayName !== user.displayName) {
      const lastChanged = extras?.lastNameChangedAt ? Date.parse(extras.lastNameChangedAt) : NaN;
      const locked =
        Number.isFinite(lastChanged) && Date.now() - lastChanged < PROFILE_NAME_LOCK_MS;

      if (locked && !(isAdmin && adminOverride)) {
        const unlockAt = new Date(lastChanged + PROFILE_NAME_LOCK_MS).toISOString();
        res.status(403).json({
          success: false,
          error:
            'Your profile name can only be changed once every 90 days. If you need an urgent correction, please contact Choosify Support.',
          lastNameChangedAt: extras?.lastNameChangedAt,
          unlockAt,
        });
        return;
      }

      await db
        .update(users)
        .set({ displayName, updatedAt: now })
        .where(eq(users.id, targetUserId));

      nextExtras = upsertUserProfileExtras({
        userId: targetUserId,
        lastNameChangedAt: now.toISOString(),
        changeNextLogin: extras?.changeNextLogin,
        username: extras?.username,
        website: extras?.website,
        bio: extras?.bio,
      });

      if (isAdmin && adminOverride && locked) {
        Logger.audit('auth.profile_name_override', {
          actorId,
          targetUserId,
          previousName: user.displayName,
          newName: displayName,
        });
      } else {
        Logger.audit('auth.profile_name_change', {
          actorId,
          targetUserId,
          newName: displayName,
        });
      }
    }

    if (avatarUrl !== undefined) {
      await db
        .update(users)
        .set({ avatarUrl: avatarUrl || null, updatedAt: now })
        .where(eq(users.id, targetUserId));
      Logger.audit('auth.profile_avatar_update', { actorId, targetUserId, cleared: !avatarUrl });
    }

    if (username !== undefined || website !== undefined || bio !== undefined) {
      nextExtras = upsertUserProfileExtras({
        userId: targetUserId,
        lastNameChangedAt: nextExtras?.lastNameChangedAt || extras?.lastNameChangedAt,
        changeNextLogin: extras?.changeNextLogin,
        username: username !== undefined ? username || undefined : extras?.username,
        website: website !== undefined ? website || undefined : extras?.website,
        bio: bio !== undefined ? bio || undefined : extras?.bio,
      });

      if (website !== undefined) {
        try {
          const existingSeller = await db
            .select()
            .from(sellerProfiles)
            .where(eq(sellerProfiles.userId, targetUserId))
            .limit(1);
          if (existingSeller[0]) {
            await db
              .update(sellerProfiles)
              .set({ website: website || null })
              .where(eq(sellerProfiles.userId, targetUserId));
          }
        } catch {
          /* seller profile optional */
        }
      }

      Logger.audit('auth.profile_identity_update', {
        actorId,
        targetUserId,
        fields: {
          username: username !== undefined,
          website: website !== undefined,
          bio: bio !== undefined,
        },
        admin: isAdmin && !isSelf,
      });
    }

    if (phone !== undefined) {
      // phone === null  -> clear;  phone === '<e164>' -> set. Preserves every
      // other extras field. Historical order/invoice/shipment phone snapshots
      // are separate records and are never touched here.
      nextExtras = upsertUserProfileExtras({
        userId: targetUserId,
        lastNameChangedAt: nextExtras?.lastNameChangedAt || extras?.lastNameChangedAt,
        changeNextLogin: extras?.changeNextLogin,
        username: nextExtras?.username ?? extras?.username,
        website: nextExtras?.website ?? extras?.website,
        bio: nextExtras?.bio ?? extras?.bio,
        phone: phone === null ? undefined : phone,
      });
      Logger.audit('auth.profile_phone_update', {
        actorId,
        targetUserId,
        cleared: phone === null,
        admin: isAdmin && !isSelf,
      });
    }

    const fresh = getUserProfileExtras(targetUserId);
    res.json({
      success: true,
      data: {
        userId: targetUserId,
        displayName: displayName !== undefined ? displayName : user.displayName,
        username: fresh?.username || '',
        website: fresh?.website || website || '',
        bio: fresh?.bio || '',
        avatarUrl: avatarUrl !== undefined ? avatarUrl : undefined,
        phone: fresh?.phone || null,
        lastNameChangedAt: fresh?.lastNameChangedAt,
        changeNextLogin: fresh?.changeNextLogin === true,
      },
    });
  } catch (error) {
    Logger.warn('profile update failed', {
      requestId: req.requestId,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ success: false, error: 'Unable to update profile' });
  }
});

/**
 * Public self-service password reset request. Always returns the same
 * generic response regardless of whether the email exists — no account-
 * enumeration signal. Real, secure, one-time, hash-only-stored token (see
 * server/auth/authTokens.ts) — never returned in the response, only ever
 * emailed. Rate-limited alongside the other credential-mutation auth routes
 * (see AUTH_STRICT_PATH in server/app.ts).
 */
authRouter.post('/auth/password-reset-request', async (req, res) => {
  const email = String(req.body?.email || '')
    .trim()
    .toLowerCase();

  // The reset destination is which Choosify SPA renders the token form, not
  // an authorization grant — it never changes what the token itself can do.
  // Preferred over the account's role because a person's account role does
  // not tell you which surface they were actually using when they clicked
  // Forgot Password (e.g. a Seller browsing the storefront as a Consumer).
  // Only this exact enum is ever accepted — never a client-supplied URL/host
  // — and callers that don't yet send it (legacy/internal) fall back to the
  // previous role-based resolution so nothing breaks silently.
  const requestedSurface = req.body?.surface;
  const explicitSurface: ResetSurface | undefined =
    requestedSurface === 'web' || requestedSurface === 'dashboard' ? requestedSurface : undefined;

  const genericResponse = {
    success: true,
    message: 'If an account exists with this email, a password reset link has been sent.',
  };

  if (!email || !email.includes('@')) {
    res.status(400).json({ success: false, error: 'Valid email is required' });
    return;
  }

  try {
    const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
    const user = rows[0];

    if (user) {
      const { rawToken } = await issueAuthToken(user.id, 'password_reset');

      Logger.audit('auth.password_reset_requested', {
        userId: user.id,
        email: user.email,
        ip: req.ip,
        requestedAt: new Date().toISOString(),
      });

      publishEvent({
        eventName: 'PasswordResetRequested',
        domain: 'Identity',
        producer: 'authRouter',
        aggregateId: user.id,
        actor: user.id,
        payload: { email: user.email },
      });

      await sendPasswordResetEmail(user.email, rawToken, {
        surface: explicitSurface ?? resetSurfaceForRole(user.role),
      });
    }

    res.json(genericResponse);
  } catch (error) {
    Logger.warn('password-reset-request failed', {
      requestId: req.requestId,
      error: error instanceof Error ? error.message : String(error),
    });
    res.json(genericResponse);
  }
});

/**
 * Consumes a password-reset token: validates hash/type/expiry/one-time-use
 * (server/auth/authTokens.ts), sets the new password, revokes every active
 * session for the account (a reset is exactly the moment an old, possibly-
 * compromised session must not survive), and emails a security notification.
 */
authRouter.post('/auth/reset-password', async (req, res) => {
  const token = String(req.body?.token || '').trim();
  const newPassword = String(req.body?.newPassword || '');

  if (!token) {
    res.status(400).json({ success: false, error: 'token is required' });
    return;
  }
  if (newPassword.length < 8) {
    res.status(400).json({ success: false, error: 'New password must be at least 8 characters' });
    return;
  }

  try {
    const userId = await consumeAuthToken(token, 'password_reset');
    if (!userId) {
      res.status(400).json({ success: false, error: 'This reset link is invalid or has expired. Request a new one.' });
      return;
    }

    const passwordHash = await hashPassword(newPassword);
    await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, userId));
    await revokeAllRefreshTokensForUser(userId);
    clearRefreshTokenCookie(res);

    const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    Logger.audit('auth.password_reset_completed', { userId, ip: req.ip });
    if (rows[0]) {
      await sendPasswordChangedEmail(rows[0].email, { surface: resetSurfaceForRole(rows[0].role) });
    }

    res.json({ success: true, message: 'Password reset. Sign in with your new password.' });
  } catch (error) {
    Logger.warn('reset-password failed', { requestId: req.requestId, error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ success: false, error: 'Unable to reset password' });
  }
});

/**
 * Change password endpoint (authenticated users).
 * Verifies current password, hashes new password, updates user, clears changeNextLogin flag.
 */
authRouter.post('/auth/change-password', ...requireAuth, async (req, res) => {
  if (req.impersonationSessionId) {
    res.status(403).json({
      success: false,
      error: 'Unavailable during Admin impersonation',
    });
    return;
  }

  const userId = req.userId || req.user?.uid || '';
  const currentPassword = String(req.body?.currentPassword || '');
  const newPassword = String(req.body?.newPassword || '');

  if (!currentPassword || !newPassword) {
    res.status(400).json({ success: false, error: 'currentPassword and newPassword are required' });
    return;
  }

  if (newPassword.length < 8) {
    res.status(400).json({ success: false, error: 'New password must be at least 8 characters' });
    return;
  }

  if (currentPassword === newPassword) {
    res.status(400).json({ success: false, error: 'New password must be different from current password' });
    return;
  }

  try {
    const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const user = rows[0];
    if (!user || !user.passwordHash) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    const currentPasswordValid = await verifyPassword(user.passwordHash, currentPassword);
    if (!currentPasswordValid) {
      recordFailedAuthAttempt(req.ip, req.originalUrl);
      res.status(401).json({ success: false, error: 'Current password is incorrect' });
      return;
    }

    const newPasswordHash = await hashPassword(newPassword);
    const now = new Date();
    await db
      .update(users)
      .set({ passwordHash: newPasswordHash, updatedAt: now })
      .where(eq(users.id, userId));

    const extras = getUserProfileExtras(userId);
    const wasForced = extras?.changeNextLogin === true;
    upsertUserProfileExtras({
      userId,
      lastNameChangedAt: extras?.lastNameChangedAt,
      changeNextLogin: false,
      username: extras?.username,
      website: extras?.website,
      bio: extras?.bio,
    });

    Logger.audit(wasForced ? 'auth.forced_password_changed' : 'auth.password_changed', {
      userId,
      email: user.email,
      changedAt: now.toISOString(),
      forced: wasForced,
    });

    publishEvent({
      eventName: 'PasswordChanged',
      domain: 'Identity',
      producer: 'authRouter',
      aggregateId: userId,
      actor: userId,
      payload: { email: user.email },
    });

    // Security-notice email — best effort, must not fail the change.
    try {
      await sendPasswordChangedEmail(user.email, { surface: resetSurfaceForRole(user.role) });
    } catch (error) {
      Logger.warn('password-changed email failed to send', {
        requestId: req.requestId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    res.json({
      success: true,
      message: 'Password updated successfully',
    });
  } catch (error) {
    Logger.warn('change-password failed', {
      requestId: req.requestId,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ success: false, error: 'Unable to change password' });
  }
});

/* ────────────────────────────────────────────────────────────────────────────
 * OPTIONAL: a passwordless (social-only) Consumer adds a local password.
 *
 * Never forced. Consumer-only. Never touches role or linked social identities.
 * Two stages: (1) email a 6-digit OTP to the *canonical account email the
 * server derives from the session* — the browser can neither supply nor change
 * the destination; (2) the correct OTP mints a short-lived, one-time,
 * purpose-bound server authorization ("setupToken"); (3) the write endpoint
 * consumes that token and sets `users.password_hash` only while it is still
 * NULL and the role is still 'user'. A manipulated client cannot assert
 * "otpVerified" — it can only present a server-issued unforgeable token.
 * See server/auth/localPasswordSetup.ts.
 * ──────────────────────────────────────────────────────────────────────────── */

type PasswordlessConsumer = {
  id: string;
  email: string;
  displayName: string | null;
  emailVerified: boolean;
};

/**
 * Shared hard guard for every local-password-setup endpoint. Re-resolves the
 * account from the DB (never trusts a request field), and enforces: not during
 * impersonation, account exists, role is exactly 'user', and no password is set
 * yet. On any failure it writes the response and returns null.
 */
async function guardPasswordlessConsumer(
  req: import('express').Request,
  res: import('express').Response,
): Promise<PasswordlessConsumer | null> {
  if (req.impersonationSessionId) {
    res.status(403).json({ success: false, error: 'Unavailable during Admin impersonation', code: 'IMPERSONATION' });
    return null;
  }
  const userId = req.userId || req.user?.uid || '';
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      passwordHash: users.passwordHash,
      displayName: users.displayName,
      emailVerified: users.emailVerified,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const user = rows[0];
  if (!user) {
    res.status(404).json({ success: false, error: 'Account not found', code: 'NOT_FOUND' });
    return null;
  }
  if (user.role !== ROLES.USER) {
    // Seller / Creator / Admin / Super Admin / staff / partner: their auth rules
    // are unchanged and this flow is not available to them.
    res.status(403).json({ success: false, error: 'This feature is only available for shopper accounts.', code: 'NOT_CONSUMER' });
    return null;
  }
  if (user.passwordHash) {
    // Already has a password — must use the canonical Change Password flow.
    res.status(409).json({ success: false, error: 'This account already has a password. Use Change password instead.', code: 'PASSWORD_ALREADY_SET' });
    return null;
  }
  return { id: user.id, email: user.email, displayName: user.displayName, emailVerified: user.emailVerified };
}

function sendLocalPasswordSetupError(res: import('express').Response, error: unknown): boolean {
  if (error instanceof LocalPasswordSetupError) {
    res.status(error.statusCode).json({
      success: false,
      code: error.code,
      error: error.message,
      ...(error.retryAfterSeconds ? { retryAfterSeconds: error.retryAfterSeconds } : {}),
    });
    return true;
  }
  return false;
}

/** Step 1 — email a fresh 6-digit code to the account's own email. */
authRouter.post('/auth/local-password/request-otp', ...requireAuth, async (req, res) => {
  const user = await guardPasswordlessConsumer(req, res);
  if (!user) return;
  try {
    const { code } = await requestSetupOtp(user.id);
    // The code is a transient secret: emailed, never logged, never returned.
    await sendLocalPasswordOtpEmail(user.email, code);
    Logger.audit('auth.local_password_otp_requested', { userId: user.id, ip: req.ip });
    res.json({ success: true, email: maskEmail(user.email), expiresInSeconds: 600 });
  } catch (error) {
    if (sendLocalPasswordSetupError(res, error)) return;
    Logger.warn('local-password request-otp failed', {
      requestId: req.requestId,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ success: false, error: 'Unable to send a verification code right now.' });
  }
});

/** Step 2 — verify the code; on success mint the one-time setup authorization. */
authRouter.post('/auth/local-password/verify-otp', ...requireAuth, async (req, res) => {
  const user = await guardPasswordlessConsumer(req, res);
  if (!user) return;
  const code = String(req.body?.code || '').trim();
  try {
    const { grant } = await verifySetupOtp(user.id, code);
    Logger.audit('auth.local_password_otp_verified', { userId: user.id, ip: req.ip });
    // setupToken is a short-lived, single-use, purpose-bound server grant — the
    // client presents it back on step 3; it can never fabricate one.
    res.json({ success: true, setupToken: grant, expiresInSeconds: 600 });
  } catch (error) {
    if (sendLocalPasswordSetupError(res, error)) return;
    Logger.warn('local-password verify-otp failed', {
      requestId: req.requestId,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ success: false, error: 'Unable to verify that code right now.' });
  }
});

/** Step 3 — consume the setup authorization and write the password (once). */
authRouter.post('/auth/local-password/set', ...requireAuth, async (req, res) => {
  const user = await guardPasswordlessConsumer(req, res);
  if (!user) return;

  const setupToken = String(req.body?.setupToken || '').trim();
  const newPassword = String(req.body?.newPassword || '');
  const confirmPassword = String(req.body?.confirmPassword || '');

  if (!setupToken) {
    res.status(400).json({ success: false, error: 'Verification is required before setting a password.', code: 'SETUP_AUTHORIZATION_INVALID' });
    return;
  }
  if (newPassword.length < 8 || newPassword.length > 128) {
    res.status(400).json({ success: false, error: 'Password must be between 8 and 128 characters.', code: 'WEAK_PASSWORD' });
    return;
  }
  if (newPassword !== confirmPassword) {
    res.status(400).json({ success: false, error: 'Passwords do not match.', code: 'PASSWORD_MISMATCH' });
    return;
  }

  try {
    const authorized = await consumeSetupGrant(user.id, setupToken);
    if (!authorized) {
      res.status(401).json({ success: false, error: 'Your verification has expired. Start again.', code: 'SETUP_AUTHORIZATION_INVALID' });
      return;
    }

    const passwordHash = await hashPassword(newPassword);
    // Atomic + guarded: only writes while role is still 'user' AND no password
    // exists yet. A manipulated client or a TOCTOU race cannot overwrite an
    // existing password or a non-Consumer account.
    const updated = await db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(and(eq(users.id, user.id), eq(users.role, ROLES.USER), isNull(users.passwordHash)))
      .returning({ id: users.id });

    if (!updated.length) {
      res.status(409).json({ success: false, error: 'This account already has a password.', code: 'PASSWORD_ALREADY_SET' });
      return;
    }

    // Keep THIS session; sign every other refresh session out (a new credential
    // was just added — consistent with treating it like a sensitive change).
    await revokeAllRefreshTokensForUser(user.id);
    const refreshToken = await issueRefreshToken(user.id);
    setRefreshTokenCookie(res, refreshToken);
    const accessToken = signAccessToken({ id: user.id, email: user.email, emailVerified: user.emailVerified });

    Logger.audit('auth.local_password_added', { userId: user.id, ip: req.ip });
    publishEvent({
      eventName: 'LocalPasswordAdded',
      domain: 'Identity',
      producer: 'authRouter',
      aggregateId: user.id,
      actor: user.id,
      payload: { email: user.email },
    });

    try {
      await sendPasswordAddedEmail(user.email);
    } catch (error) {
      Logger.warn('password-added email failed to send', {
        requestId: req.requestId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    res.json({ success: true, message: 'Password set. You can now sign in with email and password.', accessToken });
  } catch (error) {
    Logger.warn('local-password set failed', {
      requestId: req.requestId,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ success: false, error: 'Unable to set a password right now.' });
  }
});

/**
 * Admin password-reset assistance.
 * Generates a one-time temp password (plaintext returned once) or a reset link placeholder.
 * Never returns an existing password. Stores hash; sets changeNextLogin in extras.
 */
authRouter.post('/auth/admin/password-reset-assist', ...requireAdmin, async (req, res) => {
  const actorId = req.userId || req.user?.uid || '';
  const userId = String(req.body?.userId || '').trim();
  const mode = String(req.body?.mode || 'temp').trim() as 'temp' | 'link';

  if (!userId) {
    res.status(400).json({ success: false, error: 'userId is required' });
    return;
  }
  if (mode !== 'temp' && mode !== 'link') {
    res.status(400).json({ success: false, error: "mode must be 'temp' or 'link'" });
    return;
  }

  try {
    const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const user = rows[0];
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    if (mode === 'link') {
      const token = randomBytes(24).toString('hex');
      const resetLink = `/auth/reset-password?uid=${encodeURIComponent(userId)}&token=${token}`;
      upsertUserProfileExtras({
        userId,
        lastNameChangedAt: getUserProfileExtras(userId)?.lastNameChangedAt,
        changeNextLogin: true,
      });
      Logger.audit('auth.admin_password_reset_assist', {
        actorId,
        targetUserId: userId,
        mode: 'link',
      });
      res.json({
        success: true,
        data: {
          userId,
          mode: 'link',
          resetLink,
          changeNextLogin: true,
        },
      });
      return;
    }

    const tempPassword = `Tmp_${randomBytes(9).toString('base64url')}`;
    const passwordHash = await hashPassword(tempPassword);
    const now = new Date();
    await db
      .update(users)
      .set({ passwordHash, updatedAt: now })
      .where(eq(users.id, userId));

    upsertUserProfileExtras({
      userId,
      lastNameChangedAt: getUserProfileExtras(userId)?.lastNameChangedAt,
      changeNextLogin: true,
    });

    Logger.audit('auth.admin_password_reset_assist', {
      actorId,
      targetUserId: userId,
      mode: 'temp',
    });

    res.json({
      success: true,
      data: {
        userId,
        mode: 'temp',
        tempPassword,
        changeNextLogin: true,
      },
    });
  } catch (error) {
    Logger.warn('admin password-reset assist failed', {
      requestId: req.requestId,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ success: false, error: 'Unable to assist password reset' });
  }
});

/**
 * Admin/support lookup by Choosify User ID (CF-00127 / 00127 / 127).
 * Does not authorize by CF ID — returns account reference for support workflows only.
 */
authRouter.get('/auth/users/by-choosify-id/:choosifyUserId', ...requireAdmin, async (req, res) => {
  try {
    const raw = String(req.params.choosifyUserId || '').trim();
    const canonical = normalizeChoosifyUserIdQuery(raw);
    if (!canonical) {
      res.status(400).json({ success: false, error: 'Invalid Choosify User ID' });
      return;
    }
    const user = await findUserByChoosifyUserId(canonical);
    if (!user) {
      res.status(404).json({ success: false, error: 'No account found for this Choosify User ID' });
      return;
    }
    Logger.audit('auth.choosify_user_id_lookup', {
      actorId: req.userId,
      choosifyUserId: canonical,
      targetUserId: user.id,
    });
    res.json({
      success: true,
      data: {
        uid: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        choosifyUserId: user.choosifyUserId,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    Logger.warn('choosify user id lookup failed', {
      requestId: req.requestId,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ success: false, error: 'Lookup failed' });
  }
});

authRouter.get('/auth/users/search', ...requireAdmin, async (req, res) => {
  try {
    const q = String(req.query.choosifyUserId || req.query.q || '').trim();
    if (!q) {
      res.status(400).json({ success: false, error: 'choosifyUserId or q is required' });
      return;
    }
    const canonical = normalizeChoosifyUserIdQuery(q);
    if (!canonical) {
      res.status(400).json({ success: false, error: 'Invalid Choosify User ID query' });
      return;
    }
    const user = await findUserByChoosifyUserId(canonical);
    if (!user) {
      res.status(404).json({ success: false, error: 'No account found' });
      return;
    }
    res.json({
      success: true,
      data: {
        uid: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        choosifyUserId: user.choosifyUserId,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Search failed' });
  }
});

/** Admin directory for profile UI — uid + email + choosifyUserId (display/search only). */
authRouter.get('/auth/users/directory', ...requireAdmin, async (_req, res) => {
  try {
    const rows = await db
      .select({
        uid: users.id,
        email: users.email,
        displayName: users.displayName,
        role: users.role,
        choosifyUserId: users.choosifyUserId,
        avatarUrl: users.avatarUrl,
      })
      .from(users);
    res.json({ success: true, data: rows });
  } catch (error) {
    Logger.warn('choosify user directory failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ success: false, error: 'Directory lookup failed' });
  }
});

/** Admin lookup of a target account by internal Auth UID (not CF ID). */
authRouter.get('/auth/users/:userId', ...requireAdmin, async (req, res) => {
  try {
    const userId = String(req.params.userId || '').trim();
    if (!userId || userId.length < 8) {
      res.status(400).json({ success: false, error: 'Valid userId is required' });
      return;
    }
    const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const user = rows[0];
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }
    const status = await accountStatusPayload({
      id: user.id,
      role: user.role,
      email: user.email,
    });
    res.json({
      success: true,
      data: {
        uid: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        choosifyUserId: user.choosifyUserId,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
        ...status,
      },
    });
  } catch (error) {
    Logger.warn('auth user lookup failed', {
      requestId: req.requestId,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ success: false, error: 'Lookup failed' });
  }
});

/** Idempotent admin backfill for existing accounts missing CF IDs. */
authRouter.post('/auth/admin/backfill-choosify-user-ids', ...requireAdmin, async (req, res) => {
  try {
    const result = await backfillChoosifyUserIds();
    Logger.audit('auth.choosify_user_id_backfill', {
      actorId: req.userId,
      ...result,
    });
    res.json({ success: true, data: result });
  } catch (error) {
    Logger.warn('choosify user id backfill failed', {
      requestId: req.requestId,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ success: false, error: 'Backfill failed' });
  }
});
