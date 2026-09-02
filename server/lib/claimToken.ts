import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';

/**
 * Opaque, high-entropy, single-purpose claim tokens for external Manual
 * Order offers. Same convention as `authTokens` (email verification /
 * password reset): the raw token only ever appears in the customer-facing
 * link; the server stores ONLY its SHA-256 hash, has a real expiry, and
 * consumes it on success.
 *
 * The token identifies a pending claim. It does NOT authorize ownership —
 * authentication + a verified matching identity does (see the claim-confirm
 * handler). Keep those two concerns separate.
 */

export const CLAIM_TOKEN_TTL_MS = Number(
  process.env.MANUAL_OFFER_CLAIM_TTL_MS || 14 * 24 * 60 * 60 * 1000,
);

export function generateClaimToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashClaimToken(raw: string): string {
  return createHash('sha256').update(String(raw), 'utf8').digest('hex');
}

/** Constant-time compare of a presented raw token against a stored hash. */
export function claimTokenMatches(rawPresented: string, storedHash: string): boolean {
  if (!rawPresented || !storedHash) return false;
  const a = Buffer.from(hashClaimToken(rawPresented), 'hex');
  const b = Buffer.from(storedHash, 'hex');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function claimTokenExpiryIso(from: number = Date.now()): string {
  return new Date(from + CLAIM_TOKEN_TTL_MS).toISOString();
}

export function isClaimExpired(expiresAtIso?: string): boolean {
  if (!expiresAtIso) return true;
  const t = Date.parse(expiresAtIso);
  return Number.isNaN(t) || Date.now() > t;
}
