/**
 * Canonical identity normalization for reconciling an external (Meta /
 * offline) customer against a Choosify account.
 *
 * There is no shared normaliser in the codebase today — email was inlined
 * as `.trim().toLowerCase()` in authRouter and there is no Bangladesh phone
 * util anywhere. This is that single source of truth; reuse it everywhere a
 * customer-supplied email/phone is compared to an account.
 *
 * IMPORTANT: normalization is for *matching*, not for authorization.
 * A string match never establishes identity — see the claim-confirm handler.
 */

export function normalizeEmail(raw: string): string {
  return String(raw || '').trim().toLowerCase();
}

/** Loose structural check — rejects the obviously malformed, not an RFC validator. */
export function isPlausibleEmail(raw: string): boolean {
  const e = normalizeEmail(raw);
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
}

/**
 * Bangladesh mobile numbers to a single canonical form: `01XXXXXXXXX`
 * (11 digits, leading 0). Accepts `+8801…`, `008801…`, `8801…`, `1XXXXXXXXX`,
 * and any of those with spaces / dashes / parens. Returns '' if it can't be
 * confidently canonicalised (caller treats '' as invalid).
 */
export function normalizeBdPhone(raw: string): string {
  let d = String(raw || '').replace(/[^\d]/g, '');
  if (!d) return '';
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('880')) d = d.slice(3);
  // now expect 10 digits starting with 1, or 11 starting with 01
  if (d.length === 11 && d.startsWith('01')) return d;
  if (d.length === 10 && d.startsWith('1')) return `0${d}`;
  return '';
}

export function isPlausibleBdPhone(raw: string): boolean {
  const p = normalizeBdPhone(raw);
  // 01[3-9]XXXXXXXX — the operator digit is 3..9 for every current BD MNO
  return /^01[3-9]\d{8}$/.test(p);
}
