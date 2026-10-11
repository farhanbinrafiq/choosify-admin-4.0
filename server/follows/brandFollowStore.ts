/**
 * Brand follows — who follows which brand. One record per (user, brand).
 *
 * Kept as its own disk snapshot (same established pattern as the catalog /
 * operations snapshots, no schema migration) and written atomically
 * (temp file + rename) so a crash mid-write can never truncate it. Follower
 * counts on brands are derived from here — never stored on the brand record.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

type FollowSnapshot = { version: 1; savedAt: string; brands: Record<string, Record<string, string>> };

const SNAPSHOT_PATH =
  process.env.BRAND_FOLLOWS_SNAPSHOT_PATH?.trim() || join(process.cwd(), '.data', 'brand-follows.json');

/** brandId -> (userId -> followedAt ISO). */
let state: Map<string, Map<string, string>> | null = null;

function load(): Map<string, Map<string, string>> {
  if (state) return state;
  const next = new Map<string, Map<string, string>>();
  if (existsSync(SNAPSHOT_PATH)) {
    try {
      const raw = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8')) as FollowSnapshot;
      for (const [brandId, users] of Object.entries(raw?.brands ?? {})) {
        next.set(brandId, new Map(Object.entries(users ?? {})));
      }
    } catch (error) {
      // Never start from empty over an unreadable file — that would wipe it on the next save.
      throw new Error(`[BrandFollows] Cannot read ${SNAPSHOT_PATH}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  state = next;
  return state;
}

function persist(): void {
  const s = load();
  const snapshot: FollowSnapshot = { version: 1, savedAt: new Date().toISOString(), brands: {} };
  for (const [brandId, users] of s) {
    if (users.size) snapshot.brands[brandId] = Object.fromEntries(users);
  }
  mkdirSync(dirname(SNAPSHOT_PATH), { recursive: true });
  const tmp = `${SNAPSHOT_PATH}.tmp`;
  writeFileSync(tmp, JSON.stringify(snapshot), 'utf8');
  renameSync(tmp, SNAPSHOT_PATH);
}

export function brandFollowerCount(brandId: string): number {
  return load().get(brandId)?.size ?? 0;
}

export function isFollowingBrand(userId: string, brandId: string): boolean {
  return load().get(brandId)?.has(userId) ?? false;
}

/** Idempotent. Returns the brand's follower count afterwards. */
export function followBrand(userId: string, brandId: string): number {
  const s = load();
  const users = s.get(brandId) ?? new Map<string, string>();
  if (!users.has(userId)) {
    users.set(userId, new Date().toISOString());
    s.set(brandId, users);
    persist();
  }
  return users.size;
}

/** Idempotent. Returns the brand's follower count afterwards. */
export function unfollowBrand(userId: string, brandId: string): number {
  const users = load().get(brandId);
  if (users?.delete(userId)) persist();
  return users?.size ?? 0;
}

export function brandsFollowedBy(userId: string): string[] {
  const out: string[] = [];
  for (const [brandId, users] of load()) if (users.has(userId)) out.push(brandId);
  return out;
}
