/**
 * Sprint 10 durability migration.
 *
 * Partner Applications and Feature Entitlements are now authoritative in PostgreSQL
 * (server/db/schema.ts: partnerApplications, featureEntitlements) via
 * server/partnerApplications/partnerApplicationStore.ts and
 * server/entitlements/entitlementStore.ts — both read/write Postgres directly on
 * every call, so a second backend instance sees identical state immediately.
 *
 * This module's only remaining job is a ONE-TIME, IDEMPOTENT backfill: if the old
 * dev/memory-mode JSON snapshot file exists on disk, import any records from it that
 * aren't already in Postgres, then leave the file alone (never written to again).
 * Running this twice must not duplicate records — every insert is a conflict-safe
 * upsert keyed on the same IDs the JSON snapshot already used.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { partnerApplications, featureEntitlements } from '../db/schema';
import type { PartnerApplication } from '../partnerApplications/partnerApplicationStore';
/** Shape of the pre-Sprint-10 JSON snapshot's entitlement block. */
type LegacyEntitlementState = {
  roleDefaults?: Record<string, Record<string, boolean>>;
  planDefaults?: Record<string, Record<string, boolean>>;
  accountOverrides?: Record<string, Record<string, boolean>>;
};

type LegacySnapshot = {
  version: 1;
  savedAt: string;
  entitlements: LegacyEntitlementState;
  partnerApplications: PartnerApplication[];
};

const DEFAULT_PATH = join(process.cwd(), '.data', 'partner-entitlements-snapshot.json');

function snapshotPath(): string {
  return process.env.PARTNER_ENTITLEMENTS_SNAPSHOT_PATH?.trim() || DEFAULT_PATH;
}

async function backfillPartnerApplications(rows: PartnerApplication[]): Promise<number> {
  let imported = 0;
  for (const app of rows) {
    const existing = await db.select({ id: partnerApplications.id }).from(partnerApplications).where(eq(partnerApplications.id, app.id)).limit(1);
    if (existing.length > 0) continue; // already migrated — idempotent, no duplicate insert
    await db.insert(partnerApplications).values({
      id: app.id,
      applicantType: app.applicantType,
      status: app.status,
      email: app.email,
      passwordHash: app.passwordHash,
      displayName: app.displayName,
      phone: app.phone,
      businessOrChannelName: app.businessOrChannelName,
      category: app.category,
      city: app.city,
      website: app.website,
      niche: app.niche,
      contentFocus: app.contentFocus,
      socialPrimary: app.socialPrimary,
      audienceSize: app.audienceSize,
      notes: app.notes,
      existingUserId: app.existingUserId,
      provisionedUserId: app.provisionedUserId,
      catalogEntityId: app.catalogEntityId,
      adminNotes: app.adminNotes,
      resubmissionRequested: app.resubmissionRequested ?? false,
      reviewedAt: app.reviewedAt ? new Date(app.reviewedAt) : undefined,
      reviewedByUserId: app.reviewedByUserId,
      reviewNote: app.reviewNote,
      reviewHistory: app.reviewHistory ?? [],
      createdAt: new Date(app.createdAt),
      updatedAt: new Date(app.updatedAt),
    }).onConflictDoNothing();
    imported += 1;
  }
  return imported;
}

async function backfillEntitlements(state: LegacyEntitlementState): Promise<number> {
  let imported = 0;
  const rowsToUpsert: Array<{ scope: 'role'; scopeKey: string; featureKey: string; enabled: boolean }> = [];
  for (const [role, features] of Object.entries(state.roleDefaults || {})) {
    for (const [featureKey, enabled] of Object.entries(features || {})) {
      rowsToUpsert.push({ scope: 'role', scopeKey: role, featureKey, enabled: Boolean(enabled) });
    }
  }
  // Phase 2A: legacy plan-scoped and account-scoped entitlements are no longer
  // imported. Neither is read by the resolver (plan access comes from Plan
  // Versions; account overrides from account_entitlement_overrides, which need an
  // admin reason and an audit row). Skipped entries are only counted, never written.
  const skipped =
    Object.values(state.planDefaults || {}).reduce((n, f) => n + Object.keys(f || {}).length, 0) +
    Object.values(state.accountOverrides || {}).reduce((n, f) => n + Object.keys(f || {}).length, 0);
  if (skipped > 0) {
    console.warn(
      `[EntitlementsBackfill] Skipped ${skipped} legacy plan/account-scoped entitlement entr${skipped === 1 ? 'y' : 'ies'} (retired in Phase 2A; not a source of truth).`,
    );
  }
  for (const row of rowsToUpsert) {
    const existing = await db
      .select({ id: featureEntitlements.id })
      .from(featureEntitlements)
      .where(eq(featureEntitlements.scopeKey, row.scopeKey))
      .limit(1);
    // Conflict-safe: unique index on (scope, scopeKey, featureKey) makes this a no-op
    // if already migrated, so running the backfill twice never duplicates rows.
    await db.insert(featureEntitlements).values(row).onConflictDoNothing();
    if (existing.length === 0) imported += 1;
  }
  return imported;
}

export async function backfillLegacyPartnerEntitlementsSnapshot(): Promise<void> {
  const path = snapshotPath();
  if (!existsSync(path)) return;
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as LegacySnapshot;
    if (parsed?.version !== 1) return;
    const appsImported = await backfillPartnerApplications(parsed.partnerApplications || []);
    const entitlementsImported = await backfillEntitlements(parsed.entitlements || { roleDefaults: { seller: {}, creator: {} }, planDefaults: {}, accountOverrides: {} });
    if (appsImported > 0 || entitlementsImported > 0) {
      console.log(
        `[EntitlementsBackfill] Imported ${appsImported} partner application(s) and ${entitlementsImported} entitlement row(s) from legacy snapshot into PostgreSQL. PostgreSQL is now authoritative.`,
      );
    }
  } catch (error) {
    console.warn('[EntitlementsBackfill] Failed to read legacy snapshot (non-fatal, Postgres remains authoritative):', error);
  }
}
