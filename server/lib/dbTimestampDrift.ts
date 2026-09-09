/**
 * Sprint 12, Phase 8 — shared home for the timestamp-drift workaround Phase
 * 7 (Monetization Center) first discovered and fixed locally. Extracted
 * here so Finance (and any future date-filtered report) shares ONE
 * self-calibrating compensation instead of each copying its own — per the
 * explicit Phase 8 instruction not to "blindly duplicate" the Monetization
 * workaround.
 *
 * ROOT CAUSE (confirmed empirically in Phase 7, re-confirmed at full-schema
 * scope in Phase 8): this Postgres instance's session timezone is not UTC
 * (Asia/Dhaka, +6, in this local environment). A `timestamp` column with NO
 * `{ withTimezone: true }` stores `defaultNow()` as the SESSION's local
 * wall-clock digits, with no offset. Drizzle's own mapping for that column
 * type then treats those raw digits as if they were already UTC when
 * reading them back (append 'Z' and parse) — so every `timestamp`-column
 * value Drizzle returns, and every gte/lte comparison built from a real
 * `Date`, is off by exactly the session's UTC offset.
 *
 * SCHEMA-WIDE AUDIT (Phase 8): of 58 `timestamp(...)` column declarations
 * in server/db/schema.ts, only 2 use `{ withTimezone: true }` —
 * `choosify_user_id_counters.updatedAt` and
 * `choosify_reference_id_counters.updatedAt` (internal allocator
 * bookkeeping, not date-range-reported). Every other timestamp column —
 * users, workspaces, subscriptions, subscription_payments,
 * subscription_events, subscription_billing_documents, plans, plan
 * versions, and more — is naive and affected. This is a genuine,
 * systemic, schema-wide characteristic, not something specific to
 * Monetization or Finance.
 *
 * WHY THIS ISN'T FIXED GLOBALLY HERE: the correct general fix (make the
 * Postgres session/connection timezone UTC, or add `withTimezone: true` to
 * every affected column in a dedicated migration) touches every date
 * comparison and every displayed timestamp across the ENTIRE application —
 * orders, payments, settlements, subscriptions, events, payouts, billing
 * documents, audit logs, and more. That blast radius is far outside a
 * single feature phase's safe scope and needs its own dedicated,
 * carefully-regression-tested phase (see the Phase 8 report's "Production
 * requirements" section for the exact recommended fix). Until then, this
 * file gives any date-filtered SERVER-SIDE query a narrow, read-only,
 * self-correcting compensation — on a properly UTC-configured Postgres
 * instance the measured drift resolves to 0 and every call below becomes a
 * no-op.
 */
import { sql } from 'drizzle-orm';
import { db } from '../db/client';

let cachedDriftMs: number | null = null;

/**
 * Measures (and caches for this process) the gap between a true UTC instant
 * and what Drizzle reconstructs for a `timestamp` column value written at
 * that same instant by this Postgres session. Read-only — a single plain
 * SELECT, no table writes.
 */
export async function getDbTimestampDriftMs(): Promise<number> {
  if (cachedDriftMs !== null) return cachedDriftMs;
  const result: any = await db.execute(sql`select extract(epoch from now()) as true_epoch, now()::timestamp as naive_now`);
  const row = result.rows?.[0];
  if (!row) {
    cachedDriftMs = 0;
    return 0;
  }
  const trueEpochMs = Number(row.true_epoch) * 1000;
  // Reproduces Drizzle's own (documented-gotcha) mapping for a naive `timestamp` column:
  // it treats the raw "YYYY-MM-DD HH:MM:SS.sss" string as already being UTC.
  const asDrizzleWouldReadIt = new Date(String(row.naive_now).replace(' ', 'T') + 'Z').getTime();
  cachedDriftMs = asDrizzleWouldReadIt - trueEpochMs;
  return cachedDriftMs;
}

/** Shifts a true UTC date range so it compares correctly against Drizzle-read `timestamp` (no-tz) columns — see file header. */
export async function toDbComparableRange(from: Date, to: Date): Promise<{ from: Date; to: Date }> {
  const drift = await getDbTimestampDriftMs();
  if (drift === 0) return { from, to };
  return { from: new Date(from.getTime() + drift), to: new Date(to.getTime() + drift) };
}

/** Undoes the same mislabeling for a single already-read Drizzle timestamp value — e.g. before deriving a display/bucket date from it. */
export async function toTrueInstant(drizzleReadDate: Date): Promise<Date> {
  const drift = await getDbTimestampDriftMs();
  if (drift === 0) return drizzleReadDate;
  return new Date(drizzleReadDate.getTime() - drift);
}
