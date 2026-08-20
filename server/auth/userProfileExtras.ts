/**
 * Sidecar extras for users table fields not yet migrated
 * (lastNameChangedAt, changeNextLogin) — memory-disk, escrow-style.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export type UserProfileExtras = {
  userId: string;
  lastNameChangedAt?: string;
  changeNextLogin?: boolean;
  /** Owner-editable handle (not subject to 90-day name lock). */
  username?: string;
  /** Owner-editable bio/about when not stored elsewhere. */
  bio?: string;
  /** Official website for roles without seller_profiles.website. */
  website?: string;
  updatedAt: string;
};

type Snapshot = {
  version: 1;
  savedAt: string;
  extras: UserProfileExtras[];
};

const DEFAULT_PATH = join(process.cwd(), '.data', 'auth-profile-extras.json');

function snapshotPath(): string {
  return process.env.AUTH_PROFILE_EXTRAS_PATH?.trim() || DEFAULT_PATH;
}

const state: { extras: UserProfileExtras[] } = { extras: [] };
let hydrated = false;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

function buildSnapshot(): Snapshot {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    extras: state.extras,
  };
}

function flush(): void {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  try {
    const path = snapshotPath();
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(buildSnapshot()), 'utf8');
  } catch (error) {
    console.error('[AuthProfileExtras] Failed to save:', error);
  }
}

function schedulePersist(): void {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(flush, 250);
}

function ensureHydrated(): void {
  if (hydrated) return;
  hydrated = true;
  const path = snapshotPath();
  if (!existsSync(path)) return;
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as Snapshot;
    if (parsed?.version === 1 && Array.isArray(parsed.extras)) {
      state.extras = parsed.extras;
    }
  } catch (error) {
    console.warn('[AuthProfileExtras] Failed to load:', error);
  }
}

export function getUserProfileExtras(userId: string): UserProfileExtras | null {
  ensureHydrated();
  return state.extras.find((e) => e.userId === userId) ?? null;
}

export function upsertUserProfileExtras(
  patch: Omit<UserProfileExtras, 'updatedAt'> & { updatedAt?: string },
): UserProfileExtras {
  ensureHydrated();
  const now = new Date().toISOString();
  const existing = state.extras.find((e) => e.userId === patch.userId);
  const next: UserProfileExtras = {
    ...(existing || { userId: patch.userId }),
    ...patch,
    updatedAt: patch.updatedAt || now,
  };
  const idx = state.extras.findIndex((e) => e.userId === patch.userId);
  if (idx >= 0) state.extras[idx] = next;
  else state.extras.push(next);
  schedulePersist();
  return next;
}

export const PROFILE_NAME_LOCK_MS = 90 * 24 * 60 * 60 * 1000;
