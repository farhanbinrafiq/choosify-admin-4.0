/**
 * Canonical social-login provider layer for Choosify.
 *
 *  - ONE architecture for every provider (Google now, Facebook when Meta creds
 *    exist). Both resolve to / create the SAME canonical Choosify Postgres
 *    account and the SAME JWT + refresh-cookie session as email/password login.
 *  - The backend ALWAYS verifies the provider credential itself — a raw email
 *    from the client is never trusted.
 *  - A social login only ever authenticates or creates a Consumer
 *    (`users.role = 'user'`). It can never touch role, and it refuses to attach
 *    to an existing NON-consumer (staff / seller / creator / partner) account —
 *    dashboard authentication is unchanged and separate.
 *  - No OAuth access / refresh tokens are stored. `user_identities` keeps only
 *    the provider subject id + a snapshot of the provider email at link time.
 *
 * NOT Firebase / Auth0 / Clerk / Supabase — `google-auth-library` is Google's
 * own token-verification library and nothing more.
 */
import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { OAuth2Client } from 'google-auth-library';
import { db } from '../db/client';
import { userIdentities, users } from '../db/schema';
import { allocateNextChoosifyUserId } from './choosifyUserId';
import { ROLES } from '../permissions/roles';
import { Logger } from '../lib/logger';

export type SocialProvider = 'google' | 'facebook';

/** Normalised, server-verified identity from a provider. */
export type VerifiedSocialIdentity = {
  provider: SocialProvider;
  /** Provider's stable user id (Google OIDC `sub`, Facebook `id`). */
  subject: string;
  /** Lower-cased provider email, or null when the provider did not share one. */
  email: string | null;
  /** True only when the provider asserts the email is verified. */
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
};

export class SocialAuthError extends Error {
  readonly statusCode: number;
  readonly code: string;
  constructor(message: string, statusCode: number, code: string) {
    super(message);
    this.name = 'SocialAuthError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

// ── Configuration ───────────────────────────────────────────────────────────

export function googleClientId(): string {
  return process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() || '';
}
export function isGoogleConfigured(): boolean {
  return googleClientId().length > 0;
}

export function facebookAppId(): string {
  return process.env.FACEBOOK_APP_ID?.trim() || '';
}
function facebookAppSecret(): string {
  return process.env.FACEBOOK_APP_SECRET?.trim() || '';
}
export function isFacebookConfigured(): boolean {
  return facebookAppId().length > 0 && facebookAppSecret().length > 0;
}

export function socialProvidersStatus(): { google: boolean; facebook: boolean } {
  return { google: isGoogleConfigured(), facebook: isFacebookConfigured() };
}

// ── Google — verify a GIS ID token ─────────────────────────────────────────

let cachedGoogleClient: OAuth2Client | null = null;
function googleClient(): OAuth2Client {
  if (!cachedGoogleClient) cachedGoogleClient = new OAuth2Client(googleClientId());
  return cachedGoogleClient;
}

export async function verifyGoogleCredential(idToken: string): Promise<VerifiedSocialIdentity> {
  if (!isGoogleConfigured()) {
    throw new SocialAuthError('Google sign-in is not configured.', 503, 'GOOGLE_AUTH_UNAVAILABLE');
  }
  if (!idToken || typeof idToken !== 'string') {
    throw new SocialAuthError('Missing Google credential.', 400, 'MISSING_CREDENTIAL');
  }
  let payload;
  try {
    const ticket = await googleClient().verifyIdToken({ idToken, audience: googleClientId() });
    payload = ticket.getPayload();
  } catch (error) {
    Logger.warn('google credential verification failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw new SocialAuthError('Could not verify your Google sign-in. Please try again.', 401, 'INVALID_CREDENTIAL');
  }
  if (!payload?.sub) {
    throw new SocialAuthError('Could not verify your Google sign-in. Please try again.', 401, 'INVALID_CREDENTIAL');
  }
  // `verifyIdToken` already checks signature, `aud`, `iss` and `exp`; assert
  // `iss` once more defensively.
  const iss = payload.iss || '';
  if (iss !== 'accounts.google.com' && iss !== 'https://accounts.google.com') {
    throw new SocialAuthError('Could not verify your Google sign-in. Please try again.', 401, 'INVALID_CREDENTIAL');
  }
  return {
    provider: 'google',
    subject: String(payload.sub),
    email: payload.email ? payload.email.trim().toLowerCase() : null,
    emailVerified: payload.email_verified === true,
    name: payload.name || null,
    picture: payload.picture || null,
  };
}

// ── Facebook — verify an access token via the Graph API ─────────────────────

type FbDebugToken = {
  data?: { app_id?: string; is_valid?: boolean; user_id?: string; error?: { message?: string } };
};
type FbMe = { id?: string; name?: string; email?: string; picture?: { data?: { url?: string } } };

export async function verifyFacebookCredential(accessToken: string): Promise<VerifiedSocialIdentity> {
  if (!isFacebookConfigured()) {
    throw new SocialAuthError('Facebook sign-in is not configured.', 503, 'FACEBOOK_AUTH_UNAVAILABLE');
  }
  if (!accessToken || typeof accessToken !== 'string') {
    throw new SocialAuthError('Missing Facebook credential.', 400, 'MISSING_CREDENTIAL');
  }
  const appToken = `${facebookAppId()}|${facebookAppSecret()}`;
  try {
    // 1) The token must be valid AND issued for OUR app.
    const debugRes = await fetch(
      `https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(accessToken)}&access_token=${encodeURIComponent(appToken)}`,
    );
    const debug = (await debugRes.json().catch(() => ({}))) as FbDebugToken;
    const d = debug.data;
    if (!debugRes.ok || !d?.is_valid || d.app_id !== facebookAppId() || !d.user_id) {
      throw new SocialAuthError('Could not verify your Facebook sign-in. Please try again.', 401, 'INVALID_CREDENTIAL');
    }
    // 2) Read the profile with the user's own token.
    const meRes = await fetch(
      `https://graph.facebook.com/me?fields=id,name,email,picture.type(large)&access_token=${encodeURIComponent(accessToken)}`,
    );
    const me = (await meRes.json().catch(() => ({}))) as FbMe;
    if (!meRes.ok || !me.id || me.id !== d.user_id) {
      throw new SocialAuthError('Could not verify your Facebook sign-in. Please try again.', 401, 'INVALID_CREDENTIAL');
    }
    return {
      provider: 'facebook',
      subject: String(me.id),
      // Facebook only returns an email the user has confirmed with Meta, so a
      // present email is treated as verified.
      email: me.email ? me.email.trim().toLowerCase() : null,
      emailVerified: Boolean(me.email),
      name: me.name || null,
      picture: me.picture?.data?.url || null,
    };
  } catch (error) {
    if (error instanceof SocialAuthError) throw error;
    Logger.warn('facebook credential verification failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw new SocialAuthError('Could not verify your Facebook sign-in. Please try again.', 401, 'INVALID_CREDENTIAL');
  }
}

// ── Canonical linking / account resolution ─────────────────────────────────

export type SocialResolution = {
  userId: string;
  /** true only when a brand-new Choosify account row was inserted. */
  created: boolean;
  /** true when an existing password account gained this provider identity now. */
  linked: boolean;
  email: string;
  displayName: string;
};

/**
 * Given a server-VERIFIED provider identity, return the canonical Choosify user
 * to sign in — creating or linking as needed. Consumer-only:
 *
 *   1. `user_identities(provider, subject)` already exists  -> log that user in.
 *   2. no such identity, provider email is verified:
 *        a. a `users` row with that email exists and is role 'user'  -> LINK.
 *        b. a `users` row with that email exists but is NOT 'user'   -> refuse
 *           (SOCIAL_ACCOUNT_CONFLICT) — dashboard accounts use password login.
 *        c. no `users` row                                           -> CREATE
 *           a Consumer account (role 'user', email_verified true).
 *   3. no verified provider email -> refuse (UNVERIFIED_PROVIDER_EMAIL).
 */
export async function resolveOrCreateUserForSocialIdentity(
  identity: VerifiedSocialIdentity,
): Promise<SocialResolution> {
  // 1) Existing linked identity.
  const existingIdentity = await db
    .select()
    .from(userIdentities)
    .where(
      and(
        eq(userIdentities.provider, identity.provider),
        eq(userIdentities.providerSubject, identity.subject),
      ),
    )
    .limit(1);

  if (existingIdentity[0]) {
    const linkRow = existingIdentity[0];
    const userRows = await db.select().from(users).where(eq(users.id, linkRow.userId)).limit(1);
    const user = userRows[0];
    if (!user) {
      // Orphaned identity (user hard-deleted). Drop it and fall through to re-create.
      await db.delete(userIdentities).where(eq(userIdentities.id, linkRow.id));
    } else {
      await db
        .update(userIdentities)
        .set({
          lastLoginAt: new Date(),
          providerEmail: identity.email ?? linkRow.providerEmail,
          providerEmailVerified: identity.emailVerified,
          updatedAt: new Date(),
        })
        .where(eq(userIdentities.id, linkRow.id));
      return {
        userId: user.id,
        created: false,
        linked: false,
        email: user.email,
        displayName: user.displayName,
      };
    }
  }

  // 2) No linked identity — need a verified email to safely create or link.
  if (!identity.email || !identity.emailVerified) {
    throw new SocialAuthError(
      `We couldn't get a verified email from ${identity.provider === 'google' ? 'Google' : 'Facebook'}. Sign in with your email and password instead.`,
      400,
      'UNVERIFIED_PROVIDER_EMAIL',
    );
  }

  const byEmail = await db.select().from(users).where(eq(users.email, identity.email)).limit(1);
  const existingUser = byEmail[0];

  if (existingUser) {
    // 2b) Guard: never attach social login to a privileged / partner account.
    if (existingUser.role !== ROLES.USER) {
      throw new SocialAuthError(
        'This email belongs to a Choosify dashboard account. Please sign in with your email and password.',
        409,
        'SOCIAL_ACCOUNT_CONFLICT',
      );
    }
    // 2a) LINK the provider to the existing Consumer account.
    try {
      await db.insert(userIdentities).values({
        userId: existingUser.id,
        provider: identity.provider,
        providerSubject: identity.subject,
        providerEmail: identity.email,
        providerEmailVerified: identity.emailVerified,
        lastLoginAt: new Date(),
      });
    } catch (error) {
      // A concurrent link of the same identity — re-read and use it.
      const raced = await db
        .select()
        .from(userIdentities)
        .where(
          and(
            eq(userIdentities.provider, identity.provider),
            eq(userIdentities.providerSubject, identity.subject),
          ),
        )
        .limit(1);
      if (!raced[0]) throw error;
    }
    // Adopt provider name/avatar only where the account has none.
    const patch: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };
    if (identity.picture && !existingUser.avatarUrl) patch.avatarUrl = identity.picture.slice(0, 700);
    if (!existingUser.emailVerified) patch.emailVerified = true;
    await db.update(users).set(patch).where(eq(users.id, existingUser.id));

    return {
      userId: existingUser.id,
      created: false,
      linked: true,
      email: existingUser.email,
      displayName: existingUser.displayName,
    };
  }

  // 2c) CREATE a fresh Consumer account from the verified provider profile.
  const uid = randomUUID();
  const now = new Date();
  const displayName =
    (identity.name || '').trim() || identity.email.split('@')[0] || 'Choosify member';

  try {
    await db.transaction(async (tx) => {
      const choosifyUserId = await allocateNextChoosifyUserId(tx);
      await tx.insert(users).values({
        id: uid,
        email: identity.email!,
        passwordHash: null, // OAuth-only account — a password can be set later via Forgot Password.
        displayName,
        role: ROLES.USER, // ALWAYS Consumer. Never influenced by the provider.
        emailVerified: true, // provider asserted + we verified the assertion.
        choosifyUserId,
        avatarUrl: identity.picture ? identity.picture.slice(0, 700) : null,
        createdAt: now,
        updatedAt: now,
      });
      await tx.insert(userIdentities).values({
        userId: uid,
        provider: identity.provider,
        providerSubject: identity.subject,
        providerEmail: identity.email,
        providerEmailVerified: identity.emailVerified,
        lastLoginAt: now,
      });
    });
  } catch (error) {
    // Lost a create race (same email or same identity inserted concurrently) —
    // fall back to resolving the now-existing rows.
    Logger.warn('social account create raced; re-resolving', {
      provider: identity.provider,
      error: error instanceof Error ? error.message : String(error),
    });
    return resolveOrCreateUserForSocialIdentity(identity);
  }

  return { userId: uid, created: true, linked: false, email: identity.email, displayName };
}
