/**
 * Per-account password sign-in throttle (on top of the per-IP `auth` rate
 * limit): after LOGIN_ACCOUNT_MAX_FAILURES wrong attempts for one email within
 * LOGIN_ACCOUNT_WINDOW_MS, further password sign-ins for that email are paused
 * until the oldest failure leaves the window. Stops slow guessing of one
 * account from many IPs.
 *
 * Keyed by the normalized email whether or not an account exists, so the
 * response never reveals which emails are registered. A successful sign-in or a
 * password reset clears the counter. In-memory (single process); a restart
 * starts every counter fresh.
 */
import { readPositiveIntEnv } from '../lib/env';

const WINDOW_MS = readPositiveIntEnv('LOGIN_ACCOUNT_WINDOW_MS', 15 * 60 * 1000);
const MAX_FAILURES = readPositiveIntEnv('LOGIN_ACCOUNT_MAX_FAILURES', 10);
const MAX_TRACKED = 50_000;

const failures = new Map<string, number[]>();

const keyOf = (email: string) => email.trim().toLowerCase();

function recent(key: string, now: number): number[] {
  const list = (failures.get(key) || []).filter((t) => now - t < WINDOW_MS);
  if (list.length) failures.set(key, list);
  else failures.delete(key);
  return list;
}

/** Seconds until this email may try again, or 0 when sign-in is allowed. */
export function loginLockedForSeconds(email: string, now = Date.now()): number {
  const list = recent(keyOf(email), now);
  if (list.length < MAX_FAILURES) return 0;
  return Math.max(1, Math.ceil((list[0] + WINDOW_MS - now) / 1000));
}

export function recordLoginFailure(email: string, now = Date.now()): void {
  const key = keyOf(email);
  const list = recent(key, now);
  list.push(now);
  failures.set(key, list.slice(-MAX_FAILURES));
  if (failures.size > MAX_TRACKED) {
    // Drop the oldest-inserted keys first; Map keeps insertion order.
    for (const k of failures.keys()) {
      failures.delete(k);
      if (failures.size <= MAX_TRACKED * 0.9) break;
    }
  }
}

export function clearLoginFailures(email: string): void {
  failures.delete(keyOf(email));
}
