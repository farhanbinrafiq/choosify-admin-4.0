/**
 * Permanent Choosify User ID (CF-#####).
 *
 * Canonical field: users.choosify_user_id / API `choosifyUserId`
 * Internal Auth UUID remains authoritative for authz/ownership.
 *
 * Format: CF- + minimum 5-digit zero-padded sequence (unlimited growth).
 * Allocation: atomic Postgres counter row (+ durable .data mirror for restart visibility).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { asc, eq, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { choosifyUserIdCounters, users } from '../db/schema';
import { Logger } from '../lib/logger';

const SEQUENCE_MIRROR_PATH =
  process.env.CHOOSIFY_USER_ID_SEQUENCE_PATH?.trim() ||
  join(process.cwd(), '.data', 'choosify-user-id-sequence.json');

const CF_PREFIX = 'CF-';
const MIN_PAD = 5;

type SequenceMirror = {
  version: 1;
  nextValue: number;
  updatedAt: string;
};

let schemaReady: Promise<void> | null = null;

export function formatChoosifyUserId(sequence: number): string {
  const n = Math.floor(Number(sequence));
  if (!Number.isFinite(n) || n < 1) {
    throw new Error(`Invalid Choosify User ID sequence: ${sequence}`);
  }
  const body = n < 10 ** MIN_PAD ? String(n).padStart(MIN_PAD, '0') : String(n);
  return `${CF_PREFIX}${body}`;
}

/** Parse CF-00127 / 00127 / 127 → canonical CF-00127. */
export function normalizeChoosifyUserIdQuery(raw: string): string | null {
  const trimmed = String(raw || '').trim().toUpperCase();
  if (!trimmed) return null;
  const digits = trimmed.startsWith(CF_PREFIX) ? trimmed.slice(CF_PREFIX.length) : trimmed;
  if (!/^\d+$/.test(digits)) return null;
  const n = Number(digits.replace(/^0+/, '') || '0');
  if (!Number.isFinite(n) || n < 1) return null;
  return formatChoosifyUserId(n);
}

export function isCanonicalChoosifyUserId(value: string): boolean {
  const normalized = normalizeChoosifyUserIdQuery(value);
  return Boolean(normalized && normalized === String(value).trim().toUpperCase());
}

function sequenceNumberFromCfId(cfId: string): number {
  const normalized = normalizeChoosifyUserIdQuery(cfId);
  if (!normalized) return 0;
  return Number(normalized.slice(CF_PREFIX.length).replace(/^0+/, '') || '0');
}

function readSequenceMirror(): SequenceMirror | null {
  if (!existsSync(SEQUENCE_MIRROR_PATH)) return null;
  try {
    const parsed = JSON.parse(readFileSync(SEQUENCE_MIRROR_PATH, 'utf8')) as SequenceMirror;
    if (parsed?.version === 1 && Number.isFinite(parsed.nextValue) && parsed.nextValue >= 1) {
      return parsed;
    }
  } catch (error) {
    Logger.warn('choosifyUserId sequence mirror load failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
  return null;
}

function writeSequenceMirror(nextValue: number): void {
  try {
    mkdirSync(dirname(SEQUENCE_MIRROR_PATH), { recursive: true });
    const snapshot: SequenceMirror = {
      version: 1,
      nextValue,
      updatedAt: new Date().toISOString(),
    };
    writeFileSync(SEQUENCE_MIRROR_PATH, JSON.stringify(snapshot, null, 2), 'utf8');
  } catch (error) {
    Logger.warn('choosifyUserId sequence mirror save failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function ensureChoosifyUserIdSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await db.execute(sql`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS choosify_user_id varchar(32)
      `);
      await db.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS users_choosify_user_id_uidx
        ON users (choosify_user_id)
        WHERE choosify_user_id IS NOT NULL
      `);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS choosify_user_id_counters (
          id integer PRIMARY KEY,
          next_value bigint NOT NULL DEFAULT 1,
          updated_at timestamptz NOT NULL DEFAULT now(),
          CONSTRAINT choosify_user_id_counters_singleton CHECK (id = 1)
        )
      `);
      await db.execute(sql`
        INSERT INTO choosify_user_id_counters (id, next_value)
        VALUES (1, 1)
        ON CONFLICT (id) DO NOTHING
      `);

      const existing = await db
        .select({ choosifyUserId: users.choosifyUserId })
        .from(users)
        .where(sql`${users.choosifyUserId} IS NOT NULL`);
      let maxAssigned = 0;
      for (const row of existing) {
        const num = sequenceNumberFromCfId(row.choosifyUserId || '');
        if (num > maxAssigned) maxAssigned = num;
      }
      const mirror = readSequenceMirror();
      const mirrorNext = mirror?.nextValue || 1;
      const desiredNext = Math.max(maxAssigned + 1, mirrorNext, 1);
      await db.execute(sql`
        UPDATE choosify_user_id_counters
        SET next_value = GREATEST(next_value, ${desiredNext}),
            updated_at = now()
        WHERE id = 1
      `);
      writeSequenceMirror(desiredNext);
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  await schemaReady;
}

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Atomically allocate the next sequence number and return formatted CF ID.
 * Uses UPDATE … RETURNING inside the caller's transaction when provided.
 */
export async function allocateNextChoosifyUserId(tx?: DbTx): Promise<string> {
  await ensureChoosifyUserIdSchema();
  const runner = tx || db;

  const rows = await runner
    .update(choosifyUserIdCounters)
    .set({
      nextValue: sql`${choosifyUserIdCounters.nextValue} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(choosifyUserIdCounters.id, 1))
    .returning({ nextValue: choosifyUserIdCounters.nextValue });

  let after = Number(rows[0]?.nextValue);
  if (!Number.isFinite(after) || after < 2) {
    await runner
      .insert(choosifyUserIdCounters)
      .values({ id: 1, nextValue: 2, updatedAt: new Date() })
      .onConflictDoNothing();
    const retry = await runner
      .update(choosifyUserIdCounters)
      .set({
        nextValue: sql`${choosifyUserIdCounters.nextValue} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(choosifyUserIdCounters.id, 1))
      .returning({ nextValue: choosifyUserIdCounters.nextValue });
    after = Number(retry[0]?.nextValue);
    if (!Number.isFinite(after) || after < 2) {
      throw new Error('Failed to allocate Choosify User ID sequence');
    }
  }

  const allocated = after - 1;
  writeSequenceMirror(after);
  return formatChoosifyUserId(allocated);
}

/** Assign CF ID if missing; never change an existing one. */
export async function ensureUserHasChoosifyUserId(userId: string): Promise<string> {
  await ensureChoosifyUserIdSchema();
  const existing = await db
    .select({
      id: users.id,
      choosifyUserId: users.choosifyUserId,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const row = existing[0];
  if (!row) {
    throw new Error('User not found');
  }
  if (row.choosifyUserId) {
    return row.choosifyUserId;
  }

  return db.transaction(async (tx) => {
    const locked = await tx
      .select({ choosifyUserId: users.choosifyUserId })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (locked[0]?.choosifyUserId) {
      return locked[0].choosifyUserId;
    }
    const cfId = await allocateNextChoosifyUserId(tx);
    await tx
      .update(users)
      .set({ choosifyUserId: cfId, updatedAt: new Date() })
      .where(eq(users.id, userId));
    Logger.audit('auth.choosify_user_id_assigned', { userId, choosifyUserId: cfId });
    return cfId;
  });
}

export type BackfillResult = {
  strategy: string;
  totalUsers: number;
  alreadyHadId: number;
  assigned: number;
  duplicatesDetected: string[];
  preserved: string[];
};

/**
 * Idempotent backfill ordered by createdAt ASC, id ASC (stable).
 * Preserves existing valid CF IDs; detects duplicates.
 */
export async function backfillChoosifyUserIds(): Promise<BackfillResult> {
  await ensureChoosifyUserIdSchema();
  const strategy =
    'ORDER BY users.created_at ASC NULLS LAST, users.id ASC — preserve existing valid choosifyUserId; assign only when null';

  const all = await db
    .select({
      id: users.id,
      choosifyUserId: users.choosifyUserId,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(asc(users.createdAt), asc(users.id));

  const seen = new Map<string, string>();
  const duplicatesDetected: string[] = [];
  const preserved: string[] = [];
  let alreadyHadId = 0;
  let assigned = 0;

  for (const row of all) {
    if (row.choosifyUserId) {
      alreadyHadId += 1;
      const canonical = normalizeChoosifyUserIdQuery(row.choosifyUserId) || row.choosifyUserId;
      if (seen.has(canonical) && seen.get(canonical) !== row.id) {
        duplicatesDetected.push(`${canonical} → ${seen.get(canonical)} and ${row.id}`);
      } else {
        seen.set(canonical, row.id);
        preserved.push(canonical);
      }
      continue;
    }

    const cfId = await ensureUserHasChoosifyUserId(row.id);
    assigned += 1;
    if (seen.has(cfId) && seen.get(cfId) !== row.id) {
      duplicatesDetected.push(`${cfId} → ${seen.get(cfId)} and ${row.id}`);
    } else {
      seen.set(cfId, row.id);
    }
  }

  return {
    strategy,
    totalUsers: all.length,
    alreadyHadId,
    assigned,
    duplicatesDetected,
    preserved: [...new Set(preserved)],
  };
}

export async function findUserByChoosifyUserId(query: string) {
  await ensureChoosifyUserIdSchema();
  const canonical = normalizeChoosifyUserIdQuery(query);
  if (!canonical) return null;

  const candidates = Array.from(
    new Set([
      canonical,
      `CF-${String(sequenceNumberFromCfId(canonical))}`,
      `CF-${String(sequenceNumberFromCfId(canonical)).padStart(5, '0')}`,
    ]),
  );

  for (const c of candidates) {
    const rows = await db.select().from(users).where(eq(users.choosifyUserId, c)).limit(1);
    if (rows[0]) return rows[0];
  }
  return null;
}
