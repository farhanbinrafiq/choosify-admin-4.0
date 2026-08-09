/**
 * Disk durability for commerce payment memory adapter (dev / non-Firestore).
 * Same pattern as catalog/commerce memory-disk — not a second database architecture.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export type PaymentsMemorySnapshot = {
  version: 1;
  savedAt: string;
  payments: unknown[];
  processedValIds: string[];
};

const DEFAULT_PATH = join(process.cwd(), '.data', 'payments-memory-snapshot.json');

export function paymentsMemorySnapshotPath(): string {
  return process.env.PAYMENTS_MEMORY_SNAPSHOT_PATH?.trim() || DEFAULT_PATH;
}

export function loadPaymentsMemorySnapshot(): PaymentsMemorySnapshot | null {
  const path = paymentsMemorySnapshotPath();
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as PaymentsMemorySnapshot;
    if (!parsed || parsed.version !== 1) return null;
    return parsed;
  } catch (error) {
    console.warn('[PaymentsMemoryPersist] Failed to load snapshot:', error);
    return null;
  }
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;
let pendingBuild: (() => PaymentsMemorySnapshot) | null = null;

export function schedulePaymentsMemoryPersist(build: () => PaymentsMemorySnapshot): void {
  pendingBuild = build;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    flushPaymentsMemoryPersist();
  }, 250);
}

export function flushPaymentsMemoryPersist(): void {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  if (!pendingBuild) return;
  try {
    const snapshot = pendingBuild();
    const path = paymentsMemorySnapshotPath();
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(snapshot), 'utf8');
  } catch (error) {
    console.error('[PaymentsMemoryPersist] Failed to save snapshot:', error);
  }
}
