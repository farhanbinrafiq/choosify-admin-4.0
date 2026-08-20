/**
 * Pre-VPS self-hosting pass — self-service email verification + password
 * reset tokens. Mirrors jwtTokens.ts's refresh-token conventions: the raw
 * token is returned to the caller exactly once (to embed in an emailed
 * link) and never stored; only its SHA-256 hash (peppered with
 * JWT_REFRESH_SECRET, same pepper already used for refresh tokens) lives in
 * Postgres. One-time use via consumedAt, real expiry, always looked up by
 * hash so a leaked DB row alone can't be replayed as a token.
 */
import { createHash, randomBytes } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../db/client';
import { authTokens } from '../db/schema';

export type AuthTokenType = 'email_verification' | 'password_reset';

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1h — shorter than verification, it grants account takeover if leaked

function hashToken(raw: string): string {
  const pepper = process.env.JWT_REFRESH_SECRET?.trim() || '';
  return createHash('sha256').update(`${pepper}:${raw}`).digest('hex');
}

function ttlForType(type: AuthTokenType): number {
  return type === 'password_reset' ? PASSWORD_RESET_TTL_MS : EMAIL_VERIFICATION_TTL_MS;
}

/** Generates a fresh token, invalidating any previous unconsumed token of the same type for this user (only the newest link should work). */
export async function issueAuthToken(userId: string, type: AuthTokenType): Promise<{ rawToken: string; expiresAt: Date }> {
  await db
    .update(authTokens)
    .set({ consumedAt: new Date() })
    .where(and(eq(authTokens.userId, userId), eq(authTokens.type, type), isNull(authTokens.consumedAt)));

  const rawToken = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + ttlForType(type));
  await db.insert(authTokens).values({
    userId,
    type,
    tokenHash: hashToken(rawToken),
    expiresAt,
  });
  return { rawToken, expiresAt };
}

/**
 * Validates a raw token against its hash, type, expiry, and one-time-use
 * state, and — only if every check passes — atomically marks it consumed.
 * Returns the userId on success, null on any failure (expired, already
 * used, wrong type, or unknown token) without distinguishing which.
 */
export async function consumeAuthToken(rawToken: string, type: AuthTokenType): Promise<string | null> {
  const tokenHash = hashToken(rawToken);
  const rows = await db
    .select()
    .from(authTokens)
    .where(and(eq(authTokens.tokenHash, tokenHash), eq(authTokens.type, type), isNull(authTokens.consumedAt)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) return null;

  const consumed = await db
    .update(authTokens)
    .set({ consumedAt: new Date() })
    .where(and(eq(authTokens.id, row.id), isNull(authTokens.consumedAt)))
    .returning();
  // Guards a theoretical concurrent double-consume race — only the request
  // that actually flips consumedAt from null wins.
  if (!consumed.length) return null;

  return row.userId;
}
