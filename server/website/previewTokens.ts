/**
 * Short-lived, signed, document-scoped preview tokens for unpublished website drafts.
 *
 * Signed with a key DERIVED from JWT_ACCESS_SECRET (HMAC with a fixed purpose label), never
 * the access-token key itself, and with its own audience — so a preview token can never be
 * accepted as a login token and a login token can never open a preview.
 */
import { createHmac } from 'node:crypto';
import jwt from 'jsonwebtoken';

export const PREVIEW_TOKEN_TTL_SECONDS = 15 * 60;
const AUDIENCE = 'choosify-website-preview';
const ISSUER = 'choosify-website-studio';

function previewKey(): string {
  const secret = process.env.JWT_ACCESS_SECRET?.trim();
  if (!secret) throw new Error('JWT_ACCESS_SECRET is not configured');
  return createHmac('sha256', secret).update('website-preview-token-v1').digest('hex');
}

export type PreviewClaims = { key: string; rev: number; sub: string | null; exp: number };

export function signPreviewToken(documentKey: string, draftRevision: number, actorUserId: string | null) {
  const expiresAt = new Date(Date.now() + PREVIEW_TOKEN_TTL_SECONDS * 1000);
  const token = jwt.sign({ k: documentKey, r: draftRevision, typ: 'website-preview' }, previewKey(), {
    algorithm: 'HS256',
    audience: AUDIENCE,
    issuer: ISSUER,
    expiresIn: PREVIEW_TOKEN_TTL_SECONDS,
    ...(actorUserId ? { subject: actorUserId } : {}),
  });
  return { token, expiresAt: expiresAt.toISOString() };
}

/** Returns the claims if the token is valid AND scoped to `documentKey`; otherwise null. */
export function verifyPreviewToken(token: string, documentKey: string): PreviewClaims | null {
  try {
    const decoded = jwt.verify(token, previewKey(), { algorithms: ['HS256'], audience: AUDIENCE, issuer: ISSUER }) as jwt.JwtPayload;
    if (decoded.typ !== 'website-preview' || decoded.k !== documentKey) return null;
    return { key: String(decoded.k), rev: Number(decoded.r) || 0, sub: typeof decoded.sub === 'string' ? decoded.sub : null, exp: Number(decoded.exp) || 0 };
  } catch {
    return null;
  }
}
