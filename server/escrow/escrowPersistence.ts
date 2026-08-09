/**
 * Disk durability for escrow memory adapter (dev / non-Firestore).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export type EscrowMemorySnapshot = {
  version: 1;
  savedAt: string;
  escrows: unknown[];
  settlements: unknown[];
  balances: unknown[];
  balanceEntries: unknown[];
  refunds: unknown[];
  returns: unknown[];
};

const DEFAULT_PATH = join(process.cwd(), '.data', 'escrow-memory-snapshot.json');

export function escrowMemorySnapshotPath(): string {
  return process.env.ESCROW_MEMORY_SNAPSHOT_PATH?.trim() || DEFAULT_PATH;
}

export function loadEscrowMemorySnapshot(): EscrowMemorySnapshot | null {
  const path = escrowMemorySnapshotPath();
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as EscrowMemorySnapshot;
    if (!parsed || parsed.version !== 1) return null;
    return parsed;
  } catch (error) {
    console.warn('[EscrowMemoryPersist] Failed to load snapshot:', error);
    return null;
  }
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;
let pendingBuild: (() => EscrowMemorySnapshot) | null = null;

export function scheduleEscrowMemoryPersist(build: () => EscrowMemorySnapshot): void {
  pendingBuild = build;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    flushEscrowMemoryPersist();
  }, 250);
}

export function flushEscrowMemoryPersist(): void {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  if (!pendingBuild) return;
  try {
    const snapshot = pendingBuild();
    const path = escrowMemorySnapshotPath();
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(snapshot), 'utf8');
  } catch (error) {
    console.error('[EscrowMemoryPersist] Failed to save snapshot:', error);
  }
}
