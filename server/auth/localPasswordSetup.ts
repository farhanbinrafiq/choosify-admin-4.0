/**
 * "Add a local password to a passwordless (social-only) Consumer" — a
 * dedicated, purpose-bound, two-stage email-OTP challenge.
 *
 * Stage 1  request → a cryptographically-random 6-digit code is emailed. Stored
 *          only as sha256(pepper : userId : purpose : code). 10-minute TTL,
 *          single active code per user, issuing a new one invalidates the
 *          previous, send-throttled, and each row locks after 5 wrong guesses.
 * Stage 2  verify → the correct code mints a short-lived (10-minute), one-time,
 *          purpose-bound server authorization ("grant"). The client holds only
 *          this unforgeable token — never an "otpVerified" boolean.
 * Stage 3  the password-write endpoint consumes the grant atomically.
 *
 * Deliberately NOT built on `auth_tokens`: that table's tokens are 256-bit and
 * need no attempt counter; a 6-digit OTP is only safe with the `attempts` /
 * `resend_count` columns this dedicated table adds. This mechanism is only ever
 * used for `purpose = 'SET_LOCAL_PASSWORD'` and can never change an existing
 * password.
 *
 * The raw code and raw grant are returned to the caller exactly once (so the
 * router can email the code / hand the grant to the browser) and are never
 * logged, never persisted in the clear, never put in analytics/audit events.
 */
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { localPasswordSetups } from '../db/schema';

export const SET_LOCAL_PASSWORD_PURPOSE = 'SET_LOCAL_PASSWORD';

const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const GRANT_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_VERIFY_ATTEMPTS = 5; // wrong-code guesses per active code before it locks
const RESEND_MIN_INTERVAL_MS = 60 * 1000; // no more than one code per minute
const RESEND_MAX_PER_EPISODE = 5; // total codes for one setup episode

export type LocalPasswordSetupErrorCode =
  | 'RESEND_TOO_SOON'
  | 'RESEND_LIMIT'
  | 'NO_ACTIVE_CODE'
  | 'CODE_EXPIRED'
  | 'INVALID_CODE'
  | 'TOO_MANY_ATTEMPTS'
  | 'SETUP_AUTHORIZATION_INVALID';

export class LocalPasswordSetupError extends Error {
  code: LocalPasswordSetupErrorCode;
  statusCode: number;
  retryAfterSeconds?: number;
  constructor(code: LocalPasswordSetupErrorCode, statusCode: number, message: string, retryAfterSeconds?: number) {
    super(message);
    this.name = 'LocalPasswordSetupError';
    this.code = code;
    this.statusCode = statusCode;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function pepper(): string {
  return process.env.JWT_REFRESH_SECRET?.trim() || '';
}

/** sha256(pepper : userId : purpose : secret) — bound to the user AND the purpose. */
function hashSecret(userId: string, secret: string): string {
  return createHash('sha256').update(`${pepper()}:${userId}:${SET_LOCAL_PASSWORD_PURPOSE}:${secret}`).digest('hex');
}

function hashesEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/** Cryptographically-secure 6-digit code, zero-padded, uniform over 000000–999999. */
function generateSixDigitCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

/** `farhan@gmail.com` -> `fa••••@gmail.com` (never reveals more than the first 2 chars). */
export function maskEmail(email: string): string {
  const [local, domain] = String(email || '').split('@');
  if (!domain) return '•••••';
  const head = local.slice(0, 2);
  return `${head}${'•'.repeat(Math.max(4, local.length - head.length))}@${domain}`;
}

type SetupRow = typeof localPasswordSetups.$inferSelect;

async function newestOpenRow(userId: string): Promise<SetupRow | undefined> {
  const rows = await db
    .select()
    .from(localPasswordSetups)
    .where(
      and(
        eq(localPasswordSetups.userId, userId),
        eq(localPasswordSetups.purpose, SET_LOCAL_PASSWORD_PURPOSE),
        isNull(localPasswordSetups.consumedAt),
      ),
    )
    .orderBy(desc(localPasswordSetups.createdAt))
    .limit(1);
  return rows[0];
}

/**
 * Issues a fresh 6-digit code, invalidating any earlier unconsumed code for
 * this user. Returns the raw code ONCE (for emailing) plus its expiry. Throws
 * `LocalPasswordSetupError` when the send throttle is hit.
 */
export async function requestSetupOtp(
  userId: string,
): Promise<{ code: string; expiresAt: Date; resendCount: number }> {
  const now = Date.now();
  const prior = await newestOpenRow(userId);

  if (prior) {
    const sinceLast = now - prior.lastSentAt.getTime();
    if (sinceLast < RESEND_MIN_INTERVAL_MS) {
      const retryAfterSeconds = Math.ceil((RESEND_MIN_INTERVAL_MS - sinceLast) / 1000);
      throw new LocalPasswordSetupError(
        'RESEND_TOO_SOON',
        429,
        'A code was just sent. Wait a moment before requesting another.',
        retryAfterSeconds,
      );
    }
    if (prior.resendCount >= RESEND_MAX_PER_EPISODE) {
      throw new LocalPasswordSetupError(
        'RESEND_LIMIT',
        429,
        'Too many verification codes requested. Try again later.',
      );
    }
  }

  // Invalidate every earlier unconsumed code — only the newest one can work.
  await db
    .update(localPasswordSetups)
    .set({ consumedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(localPasswordSetups.userId, userId),
        eq(localPasswordSetups.purpose, SET_LOCAL_PASSWORD_PURPOSE),
        isNull(localPasswordSetups.consumedAt),
      ),
    );

  const code = generateSixDigitCode();
  const expiresAt = new Date(now + CODE_TTL_MS);
  const resendCount = (prior?.resendCount ?? 0) + 1;

  await db.insert(localPasswordSetups).values({
    userId,
    purpose: SET_LOCAL_PASSWORD_PURPOSE,
    codeHash: hashSecret(userId, code),
    codeExpiresAt: expiresAt,
    attempts: 0,
    resendCount,
    lastSentAt: new Date(now),
  });

  return { code, expiresAt, resendCount };
}

/**
 * Checks a submitted code against the newest active code for the user. On
 * success, mints and returns a one-time purpose-bound grant (raw, once) plus
 * its expiry. On failure, increments the row's attempt counter and throws.
 */
export async function verifySetupOtp(
  userId: string,
  submittedCode: string,
): Promise<{ grant: string; grantExpiresAt: Date }> {
  const code = String(submittedCode || '').trim();
  const row = await newestOpenRow(userId);

  if (!row || row.verifiedAt) {
    throw new LocalPasswordSetupError('NO_ACTIVE_CODE', 400, 'Request a verification code first.');
  }
  if (row.codeExpiresAt.getTime() < Date.now()) {
    throw new LocalPasswordSetupError('CODE_EXPIRED', 400, 'That code has expired. Request a new one.');
  }
  if (row.attempts >= MAX_VERIFY_ATTEMPTS) {
    throw new LocalPasswordSetupError(
      'TOO_MANY_ATTEMPTS',
      429,
      'Too many incorrect attempts. Request a new code.',
    );
  }

  const matches = /^\d{6}$/.test(code) && hashesEqual(hashSecret(userId, code), row.codeHash);

  if (!matches) {
    const updated = await db
      .update(localPasswordSetups)
      .set({ attempts: sql`${localPasswordSetups.attempts} + 1`, updatedAt: new Date() })
      .where(eq(localPasswordSetups.id, row.id))
      .returning({ attempts: localPasswordSetups.attempts });
    const attempts = updated[0]?.attempts ?? row.attempts + 1;
    if (attempts >= MAX_VERIFY_ATTEMPTS) {
      throw new LocalPasswordSetupError(
        'TOO_MANY_ATTEMPTS',
        429,
        'Too many incorrect attempts. Request a new code.',
      );
    }
    throw new LocalPasswordSetupError('INVALID_CODE', 400, 'That code is not correct.');
  }

  const grant = randomBytes(32).toString('hex');
  const grantExpiresAt = new Date(Date.now() + GRANT_TTL_MS);

  // Atomic: only the first verify of this still-open row mints a grant.
  const claimed = await db
    .update(localPasswordSetups)
    .set({
      verifiedAt: new Date(),
      grantHash: hashSecret(userId, grant),
      grantExpiresAt,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(localPasswordSetups.id, row.id),
        isNull(localPasswordSetups.verifiedAt),
        isNull(localPasswordSetups.consumedAt),
      ),
    )
    .returning({ id: localPasswordSetups.id });

  if (!claimed.length) {
    throw new LocalPasswordSetupError('NO_ACTIVE_CODE', 400, 'Request a verification code first.');
  }

  return { grant, grantExpiresAt };
}

/**
 * Consumes the stage-2 grant. Atomically flips `consumed_at` so a grant works
 * exactly once, and only while unexpired, verified, and unconsumed. Returns
 * true on success; the caller writes the password only then.
 */
export async function consumeSetupGrant(userId: string, grant: string): Promise<boolean> {
  const raw = String(grant || '').trim();
  if (!raw) return false;
  const grantHash = hashSecret(userId, raw);

  // Look the row up first and check expiry in JS (Date vs Date.now()) — the
  // timestamps are stored as the app writes them; a raw SQL `now()` would be the
  // DB session's timezone and can diverge from those app-written values.
  const rows = await db
    .select()
    .from(localPasswordSetups)
    .where(
      and(
        eq(localPasswordSetups.userId, userId),
        eq(localPasswordSetups.purpose, SET_LOCAL_PASSWORD_PURPOSE),
        eq(localPasswordSetups.grantHash, grantHash),
        isNull(localPasswordSetups.consumedAt),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row || !row.verifiedAt || !row.grantExpiresAt) return false;
  if (row.grantExpiresAt.getTime() < Date.now()) return false;

  // Atomically flip consumed_at — only the request that actually transitions it
  // from null wins, so a grant works exactly once.
  const consumed = await db
    .update(localPasswordSetups)
    .set({ consumedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(localPasswordSetups.id, row.id), isNull(localPasswordSetups.consumedAt)))
    .returning({ id: localPasswordSetups.id });
  return consumed.length > 0;
}

/** Test/support helper — drops all setup rows for a user. Not exposed via any route. */
export async function _clearLocalPasswordSetups(userId: string): Promise<void> {
  await db.delete(localPasswordSetups).where(eq(localPasswordSetups.userId, userId));
}

export const LOCAL_PASSWORD_SETUP_LIMITS = {
  CODE_TTL_MS,
  GRANT_TTL_MS,
  MAX_VERIFY_ATTEMPTS,
  RESEND_MIN_INTERVAL_MS,
  RESEND_MAX_PER_EPISODE,
};
