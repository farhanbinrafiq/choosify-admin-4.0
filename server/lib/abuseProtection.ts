type AttemptRecord = {
  count: number;
  firstSeenAt: number;
  lastSeenAt: number;
};

const failedAuthAttempts = new Map<string, AttemptRecord>();
const suspiciousRequestCounts = new Map<string, AttemptRecord>();

const DEFAULT_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_FAILED_AUTH_THRESHOLD = 20;
const DEFAULT_SUSPICIOUS_THRESHOLD = 200;

function getClientKey(ip: string | undefined, path: string): string {
  return `${ip || 'unknown'}:${path}`;
}

function pruneRecord(record: AttemptRecord, windowMs: number, now: number): AttemptRecord | null {
  if (now - record.firstSeenAt > windowMs) {
    return null;
  }
  return record;
}

function increment(
  store: Map<string, AttemptRecord>,
  key: string,
  windowMs: number,
): AttemptRecord {
  const now = Date.now();
  const existing = store.get(key);
  const current = existing ? pruneRecord(existing, windowMs, now) : null;

  const next: AttemptRecord = current
    ? { ...current, count: current.count + 1, lastSeenAt: now }
    : { count: 1, firstSeenAt: now, lastSeenAt: now };

  store.set(key, next);
  return next;
}

export function recordFailedAuthAttempt(ip: string | undefined, path: string): {
  count: number;
  thresholdExceeded: boolean;
} {
  const windowMs = Number(process.env.ABUSE_FAILED_AUTH_WINDOW_MS || DEFAULT_WINDOW_MS);
  const threshold = Number(process.env.ABUSE_FAILED_AUTH_THRESHOLD || DEFAULT_FAILED_AUTH_THRESHOLD);
  const record = increment(failedAuthAttempts, getClientKey(ip, path), windowMs);

  return {
    count: record.count,
    thresholdExceeded: record.count >= threshold,
  };
}

export function recordSuspiciousRequest(ip: string | undefined, path: string): {
  count: number;
  thresholdExceeded: boolean;
} {
  const windowMs = Number(process.env.ABUSE_SUSPICIOUS_WINDOW_MS || DEFAULT_WINDOW_MS);
  const threshold = Number(process.env.ABUSE_SUSPICIOUS_THRESHOLD || DEFAULT_SUSPICIOUS_THRESHOLD);
  const record = increment(suspiciousRequestCounts, getClientKey(ip, path), windowMs);

  return {
    count: record.count,
    thresholdExceeded: record.count >= threshold,
  };
}

export function getAbuseProtectionSnapshot() {
  return {
    failedAuthAttempts: failedAuthAttempts.size,
    suspiciousRequestCounts: suspiciousRequestCounts.size,
  };
}
