/**
 * Client mirror of server/lib/identityNormalize.ts — kept in lockstep.
 * Used for form hints / extraction confidence only; the server re-normalizes
 * and re-validates authoritatively.
 */

export function normalizeEmail(raw: string): string {
  return String(raw || '').trim().toLowerCase();
}

export function isPlausibleEmail(raw: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalizeEmail(raw));
}

export function normalizeBdPhone(raw: string): string {
  let d = String(raw || '').replace(/[^\d]/g, '');
  if (!d) return '';
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('880')) d = d.slice(3);
  if (d.length === 11 && d.startsWith('01')) return d;
  if (d.length === 10 && d.startsWith('1')) return `0${d}`;
  return '';
}

export function isPlausibleBdPhone(raw: string): boolean {
  return /^01[3-9]\d{8}$/.test(normalizeBdPhone(raw));
}
