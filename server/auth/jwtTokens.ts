import { createHash, randomBytes } from 'node:crypto';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { and, eq, gt, isNull } from 'drizzle-orm';
import type { Response } from 'express';
import { db } from '../db/client';
import { refreshTokens, users } from '../db/schema';

const ACCESS_TTL = '15m';
const REFRESH_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
const REFRESH_COOKIE = 'choosify_refresh';

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

export async function issueRefreshToken(userId: string): Promise<string> {
  const raw = randomBytes(32).toString('base64url');
  const tokenHash = hashRefreshToken(raw);
  const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);
  await db.insert(refreshTokens).values({
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
  const rows = await db
    .select()
    .from(refreshTokens)
    .where(
      and(
        eq(refreshTokens.tokenHash, tokenHash),
        isNull(refreshTokens.revokedAt),
        gt(refreshTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(eq(refreshTokens.id, row.id));

  const userRows = await db.select().from(users).where(eq(users.id, row.userId)).limit(1);
  const user = userRows[0];
  if (!user) return null;

  const accessToken = signAccessToken({
    id: user.id,
    email: user.email,
    emailVerified: user.emailVerified,
  });
  const refreshToken = await issueRefreshToken(user.id);
  return { userId: user.id, accessToken, refreshToken };
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
