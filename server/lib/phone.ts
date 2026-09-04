/**
 * Canonical phone-number normalization for the Consumer account's *primary
 * phone* (Profile Settings). Server-authoritative — the browser's formatting is
 * never trusted.
 *
 * Choosify is Bangladesh-first, so a bare local number (`01XXXXXXXXX`) is
 * assumed to be +880. International numbers are still accepted in E.164
 * (`+<country><subscriber>`, 8–15 digits total) — the country code is NOT
 * hard-locked, because the platform may serve customers abroad.
 *
 * This is contact information only. It is never a login credential and is
 * intentionally NOT globally unique (households / shared / business lines).
 */

export type PhoneNormalizationResult = { ok: boolean; e164?: string; error?: string };

const MAX_RAW_INPUT = 32;

/** Returns a canonical E.164 string, or an error message suitable for the client. */
export function normalizePrimaryPhone(input: unknown): PhoneNormalizationResult {
  if (typeof input !== 'string') return { ok: false, error: 'Phone number must be text.' };
  const raw = input.trim();
  if (raw.length === 0) return { ok: false, error: 'Enter a phone number.' };
  if (raw.length > MAX_RAW_INPUT) return { ok: false, error: 'That phone number is too long.' };

  // Keep a single leading +, strip spaces / dashes / dots / parens.
  const hadPlus = raw.startsWith('+');
  let digits = raw.replace(/[^\d]/g, '');
  if (!digits) return { ok: false, error: 'Enter a valid phone number.' };

  // Bangladesh local forms → +880…
  if (!hadPlus) {
    if (/^01\d{9}$/.test(digits)) {
      digits = `880${digits.slice(1)}`; // 01XXXXXXXXX -> 8801XXXXXXXXX
    } else if (/^1\d{9}$/.test(digits)) {
      digits = `880${digits}`; // 1XXXXXXXXX -> 8801XXXXXXXXX
    } else if (/^8801\d{9}$/.test(digits)) {
      // already 880…, fall through
    } else if (!/^\d{8,15}$/.test(digits)) {
      return { ok: false, error: 'Enter a valid phone number, e.g. 01XXXXXXXXX.' };
    }
  }

  if (digits.length < 8 || digits.length > 15) {
    return { ok: false, error: 'Enter a valid phone number.' };
  }

  // Bangladesh sanity check: +8801 followed by 9 digits, first subscriber digit 3–9.
  if (digits.startsWith('880')) {
    if (!/^8801[3-9]\d{8}$/.test(digits)) {
      return { ok: false, error: 'Enter a valid Bangladeshi mobile number (11 digits starting 01).' };
    }
  }

  return { ok: true, e164: `+${digits}` };
}

/** `+8801712345678` -> `+880 1712-345678` (display only). */
export function formatPrimaryPhoneForDisplay(e164: string): string {
  const m = /^\+880(1\d)(\d{3})(\d{4})$/.exec(e164 || '');
  if (m) return `+880 ${m[1]}${m[2]}-${m[3]}`;
  return e164 || '';
}
