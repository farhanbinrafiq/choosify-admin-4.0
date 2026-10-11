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
const LOG_PATH = process.env.VIEW_LOG_SNAPSHOT_PATH?.trim() || join(process.cwd(), '.data', 'view-log.json');
/** Most recent counted visits kept per item (for the seller's "who viewed" list). */
const LOG_LIMIT = 500;

/** One counted visit (at most one per visitor per item per day). */
export type ViewLogEntry = {
  /** Visitor key (account or anonymous hash). */
  v: string;
  /** Account id when the visitor was signed in. */
  u?: string;
  at: string;
  /** Where they came from: facebook, instagram, google, choosify, direct, other… */
  src?: string;
  /** mobile | desktop | tablet */
  dev?: string;
};
let log: Map<string, ViewLogEntry[]> | null = null;

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

function loadLog(): Map<string, ViewLogEntry[]> {
  if (log) return log;
  const next = new Map<string, ViewLogEntry[]>();
  if (existsSync(LOG_PATH)) {
    try {
      const raw = JSON.parse(readFileSync(LOG_PATH, 'utf8')) as { items?: Record<string, ViewLogEntry[]> };
      for (const [k, rows] of Object.entries(raw?.items ?? {})) next.set(k, Array.isArray(rows) ? rows : []);
    } catch (error) {
      throw new Error(`[ViewLog] Cannot read ${LOG_PATH}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  log = next;
  return log;
}

function writeAtomic(path: string, data: unknown) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(data), 'utf8');
  renameSync(tmp, path);
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
      writeAtomic(SNAPSHOT_PATH, snapshot);
      if (log) writeAtomic(LOG_PATH, { version: 1, savedAt: snapshot.savedAt, items: Object.fromEntries(log) });
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

/** Counted visits for an item, newest first (seller / Super Admin "who viewed"). */
export function viewLog(kind: ViewKind, id: string): ViewLogEntry[] {
  return [...(loadLog().get(`${kind}:${id}`) ?? [])].reverse();
}

/** Counts a view unless this visitor already viewed this item today. Returns the total. */
export function recordView(
  kind: ViewKind,
  id: string,
  visitor: string,
  meta: { userId?: string; source?: string; device?: string } = {},
): number {
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
    const l = loadLog();
    const rows = l.get(`${kind}:${id}`) ?? [];
    rows.push({ v: visitor, ...(meta.userId ? { u: meta.userId } : {}), at: new Date().toISOString(),
      ...(meta.source ? { src: meta.source } : {}), ...(meta.device ? { dev: meta.device } : {}) });
    if (rows.length > LOG_LIMIT) rows.splice(0, rows.length - LOG_LIMIT);
    l.set(`${kind}:${id}`, rows);
    schedulePersist();
  }
  return t[kind].get(id) ?? 0;
}
