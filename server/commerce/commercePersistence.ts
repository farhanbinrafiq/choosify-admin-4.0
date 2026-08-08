/**
 * Disk durability for commerce memory adapter (dev / non-Firestore).
 * Same pattern as catalog memory-disk — not a second database architecture.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export type CommerceMemorySnapshot = {
  version: 1;
  savedAt: string;
  carts: unknown[];
  checkouts: unknown[];
  orders: unknown[];
  bookingRequests: unknown[];
  idempotency: unknown[];
};

const DEFAULT_PATH = join(process.cwd(), '.data', 'commerce-memory-snapshot.json');

export function commerceMemorySnapshotPath(): string {
  return process.env.COMMERCE_MEMORY_SNAPSHOT_PATH?.trim() || DEFAULT_PATH;
}

export function loadCommerceMemorySnapshot(): CommerceMemorySnapshot | null {
  const path = commerceMemorySnapshotPath();
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as CommerceMemorySnapshot;
    if (!parsed || parsed.version !== 1) return null;
    return parsed;
  } catch (error) {
    console.warn('[CommerceMemoryPersist] Failed to load snapshot:', error);
    return null;
  }
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;
let pendingBuild: (() => CommerceMemorySnapshot) | null = null;

export function scheduleCommerceMemoryPersist(build: () => CommerceMemorySnapshot): void {
  pendingBuild = build;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    flushCommerceMemoryPersist();
  }, 250);
}

/** Immediate disk write — used by probes / graceful shutdown. */
export function flushCommerceMemoryPersist(): void {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  if (!pendingBuild) return;
  try {
    const snapshot = pendingBuild();
    const path = commerceMemorySnapshotPath();
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(snapshot), 'utf8');
  } catch (error) {
    console.error('[CommerceMemoryPersist] Failed to save snapshot:', error);
  }
}
