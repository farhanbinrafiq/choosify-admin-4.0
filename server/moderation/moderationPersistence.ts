/**
 * Disk durability for the moderation memory store (dev / non-Firestore).
 * Sprint 11: moderationStore previously had NO persistence at all — every
 * moderation item, report, seller verification, and fraud signal was wiped on
 * every server restart. Mirrors the established memory-disk pattern already
 * used by escrow/catalog/commerce/messaging/payments/ads (see
 * server/escrow/escrowPersistence.ts for the reference implementation).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { FraudSignal, ModerationItem, ReportItem, SellerVerification } from './moderationTypes';

export type ModerationMemorySnapshot = {
  version: 1;
  savedAt: string;
  items: ModerationItem[];
  reports: ReportItem[];
  verifications: SellerVerification[];
  fraudSignals: FraudSignal[];
};

const DEFAULT_PATH = join(process.cwd(), '.data', 'moderation-memory-snapshot.json');

export function moderationMemorySnapshotPath(): string {
  return process.env.MODERATION_MEMORY_SNAPSHOT_PATH?.trim() || DEFAULT_PATH;
}

export function loadModerationMemorySnapshot(): ModerationMemorySnapshot | null {
  const path = moderationMemorySnapshotPath();
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as ModerationMemorySnapshot;
    if (!parsed || parsed.version !== 1) return null;
    return parsed;
  } catch (error) {
    console.warn('[ModerationMemoryPersist] Failed to load snapshot:', error);
    return null;
  }
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;
let pendingBuild: (() => ModerationMemorySnapshot) | null = null;

export function scheduleModerationMemoryPersist(build: () => ModerationMemorySnapshot): void {
  pendingBuild = build;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    flushModerationMemoryPersist();
  }, 250);
}

export function flushModerationMemoryPersist(): void {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  if (!pendingBuild) return;
  try {
    const snapshot = pendingBuild();
    const path = moderationMemorySnapshotPath();
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(snapshot), 'utf8');
  } catch (error) {
    console.error('[ModerationMemoryPersist] Failed to save snapshot:', error);
  }
}
