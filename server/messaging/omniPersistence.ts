/**
 * Omni (Meta Unified Inbox) memory-disk persistence — durable webhook dedup locally.
 * Does not replace commerce Messaging SoT; only backs omni_* when Firestore Admin is absent.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Agent, Conversation, Customer, UnifiedMessage } from '../../src/types';

export type OmniMemorySnapshot = {
  version: 1;
  savedAt: string;
  conversations: Conversation[];
  messages: UnifiedMessage[];
  agents: Agent[];
  customers: Customer[];
};

let pending: OmniMemorySnapshot | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

export function omniMemorySnapshotPath(): string {
  return (
    process.env.OMNI_MEMORY_SNAPSHOT_PATH?.trim() ||
    join(process.cwd(), '.data', 'omni-memory-snapshot.json')
  );
}

export function loadOmniMemorySnapshot(): OmniMemorySnapshot | null {
  const path = omniMemorySnapshotPath();
  if (!existsSync(path)) return null;
  try {
    const raw = readFileSync(path, 'utf8');
    const parsed = JSON.parse(raw) as OmniMemorySnapshot;
    if (!parsed || parsed.version !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function scheduleOmniMemoryPersist(build: () => OmniMemorySnapshot): void {
  pending = build();
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    flushOmniMemoryPersist();
  }, 250);
}

export function flushOmniMemoryPersist(): void {
  if (!pending) return;
  const path = omniMemorySnapshotPath();
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(pending), 'utf8');
  } catch (error) {
    console.error('[OmniMemoryPersist] Failed to write snapshot', error);
  }
  pending = null;
}
