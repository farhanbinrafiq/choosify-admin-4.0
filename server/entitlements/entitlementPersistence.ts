/**
 * Disk durability for partner entitlements + partner applications (dev / memory mode).
 * Access toggles only — never writes cashbook/order business payloads.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { entitlementStore } from './entitlementStore';
import { partnerApplicationStore } from '../partnerApplications/partnerApplicationStore';

type Snapshot = {
  version: 1;
  savedAt: string;
  entitlements: ReturnType<typeof entitlementStore.snapshot>;
  partnerApplications: ReturnType<typeof partnerApplicationStore.snapshot>;
};

const DEFAULT_PATH = join(process.cwd(), '.data', 'partner-entitlements-snapshot.json');

function snapshotPath(): string {
  return process.env.PARTNER_ENTITLEMENTS_SNAPSHOT_PATH?.trim() || DEFAULT_PATH;
}

export function hydratePartnerEntitlementsPersistence(): void {
  const path = snapshotPath();
  if (!existsSync(path)) {
    entitlementStore.setPersistHook(() => schedulePersist());
    partnerApplicationStore.setPersistHook(() => schedulePersist());
    return;
  }
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as Snapshot;
    if (parsed?.version === 1) {
      entitlementStore.hydrate(parsed.entitlements);
      partnerApplicationStore.hydrate(parsed.partnerApplications);
    }
  } catch (error) {
    console.warn('[PartnerEntitlements] Failed to load snapshot:', error);
  }
  entitlementStore.setPersistHook(() => schedulePersist());
  partnerApplicationStore.setPersistHook(() => schedulePersist());
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;

function schedulePersist(): void {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    try {
      const snapshot: Snapshot = {
        version: 1,
        savedAt: new Date().toISOString(),
        entitlements: entitlementStore.snapshot(),
        partnerApplications: partnerApplicationStore.snapshot(),
      };
      const path = snapshotPath();
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, JSON.stringify(snapshot, null, 2), 'utf8');
    } catch (error) {
      console.error('[PartnerEntitlements] Failed to save snapshot:', error);
    }
  }, 250);
}
