/**
 * Real view counts for product and brand pages.
 *
 * A view is one visitor opening a product or brand page; the same visitor is
 * counted at most once per item per day (refreshing doesn't inflate it).
 * Totals live in their own disk snapshot (same pattern as the catalog /
 * follow snapshots, no schema change), written atomically and debounced.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export type ViewKind = 'product' | 'brand';
type ViewSnapshot = { version: 1; savedAt: string; product: Record<string, number>; brand: Record<string, number> };

const SNAPSHOT_PATH =
  process.env.VIEW_COUNTS_SNAPSHOT_PATH?.trim() || join(process.cwd(), '.data', 'view-counts.json');

let totals: { product: Map<string, number>; brand: Map<string, number> } | null = null;
let seenDay = '';
const seenToday = new Set<string>();
let persistTimer: ReturnType<typeof setTimeout> | null = null;

function load() {
  if (totals) return totals;
  const next = { product: new Map<string, number>(), brand: new Map<string, number>() };
  if (existsSync(SNAPSHOT_PATH)) {
    try {
      const raw = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8')) as ViewSnapshot;
      for (const kind of ['product', 'brand'] as const) {
        for (const [id, n] of Object.entries(raw?.[kind] ?? {})) next[kind].set(id, Number(n) || 0);
      }
    } catch (error) {
      // Never start from zero over an unreadable file — the next save would wipe it.
      throw new Error(`[ViewCounts] Cannot read ${SNAPSHOT_PATH}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  totals = next;
  return totals;
}

function schedulePersist() {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    const t = load();
    const snapshot: ViewSnapshot = {
      version: 1,
      savedAt: new Date().toISOString(),
      product: Object.fromEntries(t.product),
      brand: Object.fromEntries(t.brand),
    };
    try {
      mkdirSync(dirname(SNAPSHOT_PATH), { recursive: true });
      const tmp = `${SNAPSHOT_PATH}.tmp`;
      writeFileSync(tmp, JSON.stringify(snapshot), 'utf8');
      renameSync(tmp, SNAPSHOT_PATH);
    } catch (error) {
      console.error('[ViewCounts] Failed to save:', error);
    }
  }, 2000);
}

export function viewCount(kind: ViewKind, id: string): number {
  return load()[kind].get(id) ?? 0;
}

/** Visitor identity for de-duplication: the account when signed in, else a hash of network + browser. */
export function visitorKey(input: { userId?: string; ip?: string; userAgent?: string }): string {
  if (input.userId) return `u:${input.userId}`;
  return `a:${createHash('sha256').update(`${input.ip ?? ''}|${input.userAgent ?? ''}`).digest('hex').slice(0, 24)}`;
}

/** Counts a view unless this visitor already viewed this item today. Returns the total. */
export function recordView(kind: ViewKind, id: string, visitor: string): number {
  const t = load();
  const day = new Date().toISOString().slice(0, 10);
  if (day !== seenDay) {
    seenDay = day;
    seenToday.clear();
  }
  const key = `${kind}|${id}|${visitor}`;
  if (!seenToday.has(key)) {
    seenToday.add(key);
    t[kind].set(id, (t[kind].get(id) ?? 0) + 1);
    schedulePersist();
  }
  return t[kind].get(id) ?? 0;
}
