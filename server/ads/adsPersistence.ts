/**
 * Disk durability for ads memory adapter (dev / non-Firestore) — escrow pattern.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export type AdsMemorySnapshot = {
  version: 1;
  savedAt: string;
  ads: unknown[];
};

const DEFAULT_PATH = join(process.cwd(), '.data', 'ads-memory-snapshot.json');

export function adsMemorySnapshotPath(): string {
  return process.env.ADS_MEMORY_SNAPSHOT_PATH?.trim() || DEFAULT_PATH;
}

export function loadAdsMemorySnapshot(): AdsMemorySnapshot | null {
  const path = adsMemorySnapshotPath();
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as AdsMemorySnapshot;
    if (!parsed || parsed.version !== 1) return null;
    return parsed;
  } catch (error) {
    console.warn('[AdsMemoryPersist] Failed to load snapshot:', error);
    return null;
  }
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;
let pendingBuild: (() => AdsMemorySnapshot) | null = null;

export function scheduleAdsMemoryPersist(build: () => AdsMemorySnapshot): void {
  pendingBuild = build;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    flushAdsMemoryPersist();
  }, 250);
}

export function flushAdsMemoryPersist(): void {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  if (!pendingBuild) return;
  try {
    const snapshot = pendingBuild();
    const path = adsMemorySnapshotPath();
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(snapshot), 'utf8');
  } catch (error) {
    console.error('[AdsMemoryPersist] Failed to save snapshot:', error);
  }
}
