import { createHash, randomBytes } from 'node:crypto';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { and, eq, gt, isNull, ne } from 'drizzle-orm';
import type { Response } from 'express';
import { db } from '../db/client';
import { refreshTokens, users } from '../db/schema';

const ACCESS_TTL = '15m';
const REFRESH_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
const REFRESH_COOKIE = 'choosify_refresh';

/** db itself or a transaction handle — anything that can insert a refresh token row. */
type RefreshTokenWriter = Pick<typeof db, 'insert'>;

export type AccessTokenClaims = {
  uid: string;
  email?: string;
  emailVerified?: boolean;
  impersonation?: {
    sessionId: string;
    realActorUid: string;
    realActorRole?: string;
    startedAt: string;
    expiresAt: string;
    reason?: string;
  };
};

function requireAccessSecret(): string {
  const secret = process.env.JWT_ACCESS_SECRET?.trim();
  if (!secret) {
    throw new Error('JWT_ACCESS_SECRET is not set. Add it to .env and Vercel env vars.');
  }
  return secret;
}

export function hashRefreshToken(raw: string): string {
  const pepper = process.env.JWT_REFRESH_SECRET?.trim() || '';
  return createHash('sha256').update(`${pepper}:${raw}`).digest('hex');
}

export function signAccessToken(user: {
  id: string;
  email: string;
  emailVerified: boolean;
  impersonation?: AccessTokenClaims['impersonation'];
}): string {
  const claims: AccessTokenClaims = {
    uid: user.id,
    email: user.email,
    emailVerified: user.emailVerified,
    impersonation: user.impersonation,
  };
  return jwt.sign(claims, requireAccessSecret(), {
    expiresIn: ACCESS_TTL,
    subject: user.id,
  });
}

export function verifyAccessToken(token: string): AccessTokenClaims | null {
  try {
    const decoded = jwt.verify(token, requireAccessSecret()) as jwt.JwtPayload & AccessTokenClaims;
    const uid = decoded.uid || decoded.sub;
    if (!uid || typeof uid !== 'string') return null;
    return {
      uid,
      email: typeof decoded.email === 'string' ? decoded.email : undefined,
      emailVerified: Boolean(decoded.emailVerified),
      impersonation: decoded.impersonation,
    };
  } catch (error) {
    if (isExpiredJwtError(error)) throw error;
    return null;
  }
}

export function isExpiredJwtError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: string }).name === 'TokenExpiredError'
  );
}

export async function issueRefreshToken(userId: string, writer: RefreshTokenWriter = db): Promise<string> {
  const raw = randomBytes(32).toString('base64url');
  const tokenHash = hashRefreshToken(raw);
  const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);
  await writer.insert(refreshTokens).values({
    userId,
    tokenHash,
    expiresAt,
  });
  return raw;
}

export function setRefreshTokenCookie(res: Response, rawToken: string) {
  const secure = process.env.NODE_ENV === 'production';
  res.cookie(REFRESH_COOKIE, rawToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: REFRESH_TTL_MS,
  });
}

export function clearRefreshTokenCookie(res: Response) {
  const secure = process.env.NODE_ENV === 'production';
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
  });
}

export function readRefreshTokenCookie(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const [key, ...rest] = part.trim().split('=');
    if (key === REFRESH_COOKIE) {
      return decodeURIComponent(rest.join('='));
    }
  }
  return null;
}

export async function rotateRefreshToken(rawToken: string): Promise<{
  userId: string;
  accessToken: string;
  refreshToken: string;
} | null> {
  const tokenHash = hashRefreshToken(rawToken);
  // One-time use, atomically: the single UPDATE claims the token only while it
  // is still unrevoked and unexpired. A concurrent request presenting the same
  // token waits on the row lock, re-checks `revoked_at IS NULL` after the first
  // commits and claims nothing — so a token can rotate at most once, and a
  // revoked token (rotated, logged out, password changed) never refreshes again.
  // Claiming the old token and inserting its successor share one transaction.
  // Losing a race is handled by the clients, which retry once with the cookie
  // the winning request has just set.
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(refreshTokens.tokenHash, tokenHash),
          isNull(refreshTokens.revokedAt),
          gt(refreshTokens.expiresAt, new Date()),
        ),
      )
      .returning({ userId: refreshTokens.userId });
    if (!row) return null;

    const [user] = await tx.select().from(users).where(eq(users.id, row.userId)).limit(1);
    if (!user) return null;

    const accessToken = signAccessToken({
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
    });
    const refreshToken = await issueRefreshToken(user.id, tx);
    return { userId: user.id, accessToken, refreshToken };
  });
}

/**
 * Why a refresh was refused, for operational logging only (never returned to
 * the client, never includes the token): 'revoked' covers a rotated token
 * presented again (reuse/replay or a lost concurrent race), logout and
 * password-change revocation.
 */
export async function classifyRefreshFailure(rawToken: string): Promise<'unknown' | 'revoked' | 'expired'> {
  const [row] = await db
    .select({ revokedAt: refreshTokens.revokedAt, expiresAt: refreshTokens.expiresAt })
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, hashRefreshToken(rawToken)))
    .limit(1);
  if (!row) return 'unknown';
  if (row.revokedAt) return 'revoked';
  return row.expiresAt <= new Date() ? 'expired' : 'unknown';
}

export async function revokeRefreshToken(rawToken: string): Promise<void> {
  const tokenHash = hashRefreshToken(rawToken);
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.tokenHash, tokenHash), isNull(refreshTokens.revokedAt)));
}

/** Kills every active session for a user — used after a password reset/change so a leaked old session can't survive it. */
export async function revokeAllRefreshTokensForUser(userId: string): Promise<void> {
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));
}

/**
 * "Sign out other devices": revokes every active refresh token for the user
 * EXCEPT the one this device presents. Returns null — revoking nothing — when
 * the presented token isn't a live session of this same user, so a missing or
 * foreign cookie can never sign the caller out everywhere by accident.
 * Other devices' already-issued access tokens stay valid until they expire
 * (ACCESS_TTL); they can no longer refresh.
 */
export async function revokeOtherRefreshTokensForUser(
  userId: string,
  keepRawToken: string,
): Promise<{ revoked: number } | null> {
  const keepHash = hashRefreshToken(keepRawToken);
  const [current] = await db
    .select({ id: refreshTokens.id })
    .from(refreshTokens)
    .where(
      and(
        eq(refreshTokens.userId, userId),
        eq(refreshTokens.tokenHash, keepHash),
        isNull(refreshTokens.revokedAt),
        gt(refreshTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if (!current) return null;
  const revoked = await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt), ne(refreshTokens.id, current.id)))
    .returning({ id: refreshTokens.id });
  return { revoked: revoked.length };
}

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password);
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

export { REFRESH_COOKIE };
