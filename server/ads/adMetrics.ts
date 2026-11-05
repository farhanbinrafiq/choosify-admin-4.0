/**
 * Unified ad reporting: impressions + clicks per campaign, per slot, per day (Asia/Dhaka date).
 *
 * Counting rules (enforced here, server-side):
 *  - an event is accepted only for an ad that is CURRENTLY deliverable in the slot it claims;
 *  - one impression and one click per (page view, ad) — repeated renders / double clicks within a
 *    page view are ignored (pageViewId is a random per-page-load token from the storefront);
 *  - blocked / failed ad requests never produce events (the storefront only reports ads it drew);
 *  - no personal data is stored: no IP, user id, cookie or user agent — only daily counters.
 *    A per-IP rate limit lives in memory only and is never written to disk.
 * Reporting starts when this release goes live; nothing earlier existed to import.
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

type Counter = { i: number; c: number };
type MetricsFile = { version: 1; since: string; daily: Record<string, Record<string, Record<string, Counter>>> };

const FLUSH_MS = 5000;
const DEDUPE_TTL_MS = 6 * 3600_000;
const DEDUPE_MAX = 200_000;

function metricsPath(): string {
  const configured = process.env.ADS_METRICS_SNAPSHOT_PATH?.trim();
  if (configured) return configured;
  const ads = process.env.ADS_MEMORY_SNAPSHOT_PATH?.trim();
  return ads ? join(dirname(ads), 'ads-metrics.json') : join(process.cwd(), '.data', 'ads-metrics.json');
}

let data: MetricsFile | null = null;
let dirty = false;
let timer: NodeJS.Timeout | null = null;
const seen = new Map<string, number>();
const rate = new Map<string, { at: number; n: number }>();

function load(): MetricsFile {
  if (data) return data;
  try {
    const parsed = JSON.parse(readFileSync(metricsPath(), 'utf8')) as MetricsFile;
    data = parsed && parsed.version === 1 && parsed.daily ? parsed : null;
  } catch {
    data = null;
  }
  if (!data) data = { version: 1, since: new Date().toISOString(), daily: {} };
  return data;
}

function flush() {
  timer = null;
  if (!dirty || !data) return;
  const path = metricsPath();
  try {
    mkdirSync(dirname(path), { recursive: true });
    const tmp = `${path}.tmp`;
    writeFileSync(tmp, JSON.stringify(data));
    renameSync(tmp, path);
    dirty = false;
  } catch {
    /* keep in memory; retry on next event */
  }
}

function schedule() {
  dirty = true;
  if (!timer) timer = setTimeout(flush, FLUSH_MS);
}

/** Bangladesh calendar date (UTC+6) for daily buckets. */
export const dhakaDate = (ms = Date.now()) => new Date(ms + 6 * 3600_000).toISOString().slice(0, 10);

/** Per-IP limit (memory only): 240 events / minute. */
export function rateLimited(ip: string, count: number): boolean {
  const now = Date.now();
  const r = rate.get(ip);
  if (!r || now - r.at > 60_000) {
    rate.set(ip, { at: now, n: count });
    if (rate.size > 50_000) rate.clear();
    return count > 240;
  }
  r.n += count;
  return r.n > 240;
}

/** Records one event unless it is a duplicate for this page view. Returns true when counted. */
export function recordEvent(pageViewId: string, adId: string, slot: string, type: 'i' | 'c', now = Date.now()): boolean {
  const key = `${pageViewId}:${adId}:${type}`;
  const prev = seen.get(key);
  if (prev && now - prev < DEDUPE_TTL_MS) return false;
  if (seen.size >= DEDUPE_MAX) {
    for (const [k, t] of seen) if (now - t > DEDUPE_TTL_MS) seen.delete(k);
    if (seen.size >= DEDUPE_MAX) seen.clear();
  }
  seen.set(key, now);
  const d = load();
  const byDay = (d.daily[adId] ||= {});
  const day = (byDay[dhakaDate(now)] ||= {});
  const c = (day[slot] ||= { i: 0, c: 0 });
  if (type === 'i') c.i++;
  else c.c++;
  schedule();
  return true;
}

export type AdMetricsRow = {
  adId: string;
  impressions: number;
  clicks: number;
  ctr: number | null;
  bySlot: Record<string, { impressions: number; clicks: number }>;
  daily: Array<{ date: string; impressions: number; clicks: number }>;
};

/** Totals per ad between two dates (inclusive, YYYY-MM-DD; omitted = all). */
export function metricsFor(adIds: string[] | null, from?: string, to?: string): { since: string; rows: AdMetricsRow[] } {
  const d = load();
  const ids = adIds ?? Object.keys(d.daily);
  const rows = ids.map((adId) => {
    const days = d.daily[adId] || {};
    const row: AdMetricsRow = { adId, impressions: 0, clicks: 0, ctr: null, bySlot: {}, daily: [] };
    for (const [date, slots] of Object.entries(days).sort(([a], [b]) => a.localeCompare(b))) {
      if ((from && date < from) || (to && date > to)) continue;
      let di = 0;
      let dc = 0;
      for (const [slot, c] of Object.entries(slots)) {
        const s = (row.bySlot[slot] ||= { impressions: 0, clicks: 0 });
        s.impressions += c.i;
        s.clicks += c.c;
        di += c.i;
        dc += c.c;
      }
      row.impressions += di;
      row.clicks += dc;
      row.daily.push({ date, impressions: di, clicks: dc });
    }
    row.ctr = row.impressions > 0 ? Math.round((row.clicks / row.impressions) * 10000) / 100 : null;
    return row;
  });
  return { since: d.since, rows };
}

/** Test hook: flush pending writes now. */
export function flushMetricsNow() {
  if (timer) clearTimeout(timer);
  flush();
}
