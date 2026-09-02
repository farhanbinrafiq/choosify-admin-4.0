import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export type ConversationMemorySnapshot = {
  version: 1;
  savedAt: string;
  conversations: unknown[];
  messages: unknown[];
  attachments: unknown[];
  socialInbox: unknown[];
  supportTickets: unknown[];
  adminEntries: unknown[];
  supportNotes?: unknown[];
  supportFollowups?: unknown[];
};

const DEFAULT_PATH = join(process.cwd(), '.data', 'messaging-memory-snapshot.json');

export function conversationMemorySnapshotPath(): string {
  return process.env.MESSAGING_MEMORY_SNAPSHOT_PATH?.trim() || DEFAULT_PATH;
}

export function loadConversationMemorySnapshot(): ConversationMemorySnapshot | null {
  const path = conversationMemorySnapshotPath();
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as ConversationMemorySnapshot;
    if (!parsed || parsed.version !== 1) return null;
    return parsed;
  } catch (error) {
    console.warn('[MessagingMemoryPersist] Failed to load snapshot:', error);
    return null;
  }
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;
let pendingBuild: (() => ConversationMemorySnapshot) | null = null;

export function scheduleConversationMemoryPersist(build: () => ConversationMemorySnapshot): void {
  pendingBuild = build;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    flushConversationMemoryPersist();
  }, 250);
}

export function flushConversationMemoryPersist(): void {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  if (!pendingBuild) return;
  try {
    const snapshot = pendingBuild();
    const path = conversationMemorySnapshotPath();
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(snapshot), 'utf8');
  } catch (error) {
    console.error('[MessagingMemoryPersist] Failed to save snapshot:', error);
  }
}
