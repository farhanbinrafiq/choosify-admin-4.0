import { catalogStore } from '../../lib/vercel-catalog/catalogStore';
import type { CatalogBrand } from '../../src/types/catalog';
import type { CatalogCreator } from '../../lib/vercel-catalog/catalogEditorialTypes';
import { withRecordLocks } from '../catalog/recordLock';
import { operationsStore } from '../operations/operationsStore';
import { Logger } from '../lib/logger';
import { entityLockKeys, ownerOf, recordAudit, writeEntity, type ClaimEntityType } from './ownershipClaims';

/**
 * One-time correction (2026-10): "Verified" used to be switched on by partner
 * application approval and by granting Marketplace Access, without any
 * documents. The badge now means an admin-approved, fully documented
 * verification (or an approved ownership claim) by the CURRENT owner.
 *
 * Runs once at startup: every OWNED brand / creator with verifiedStatus true
 * but no such approved request loses only the badge (verifiedStatus false).
 * Ownership, claimStatus and Marketplace Access are untouched. Each change is
 * audited; a summary audit event is the run-once marker.
 */
const MARKER_ACTION = 'verified_badges_reconciled';

function hasApprovedVerification(type: ClaimEntityType, entityId: string, owner: string): boolean {
  return operationsStore
    .listVerifications({ entityType: type, entityId })
    .some((v) => v.status === 'Approved' && v.submitted_by === owner);
}

export async function reconcileVerifiedBadgesOnce(): Promise<void> {
  if (operationsStore.listAuditEvents({ action: MARKER_ACTION, limit: 1 }).length) return;
  const removed: string[] = [];
  const sets: Array<[ClaimEntityType, Array<CatalogBrand | CatalogCreator>]> = [
    ['brand', await catalogStore.listBrands()],
    ['creator', await catalogStore.listCreators()],
  ];
  for (const [type, rows] of sets) {
    for (const row of rows) {
      const owner = ownerOf(type, row);
      if (!owner || row.verifiedStatus !== true || hasApprovedVerification(type, row.id, owner)) continue;
      await withRecordLocks(entityLockKeys(type, row.id), async () => {
        const current = type === 'brand' ? await catalogStore.getBrand(row.id) : await catalogStore.getCreator(row.id);
        if (!current || current.verifiedStatus !== true || ownerOf(type, current) !== owner) return;
        await writeEntity(type, current, { verifiedStatus: false });
        recordAudit(null, {
          action: 'verified_badge_removed',
          actorId: 'system',
          actorName: 'Choosify',
          targetType: type,
          targetId: row.id,
          targetName: row.name,
          note: 'Verified badge removed: no admin-approved document verification on file (badge rule change).',
        });
        removed.push(`${type}:${row.name}`);
      });
    }
  }
  recordAudit(null, {
    action: MARKER_ACTION,
    actorId: 'system',
    actorName: 'Choosify',
    targetType: 'brand',
    targetId: 'system:verified-badges',
    refs: { removed: String(removed.length) },
    note: removed.length ? `Removed: ${removed.join(', ')}`.slice(0, 500) : 'Nothing to change',
  });
  Logger.info('verified badge reconciliation complete', { removed: removed.length, profiles: removed });
}
