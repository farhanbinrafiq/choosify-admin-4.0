/**
 * Account username (profile extras `username`) — the owner-editable label shown
 * as @username on account profiles. Separate from Brand/Creator public handles
 * (server/publicHandles), which have their own rules and uniqueness.
 *
 * Contract: the existing normalization (trim, strip one leading "@") is kept;
 * the result must be 3–30 ASCII letters, digits, dots or underscores. An empty
 * value clears the username. Not unique — it is a display label, not an
 * identifier or login credential.
 */
export const ACCOUNT_USERNAME_PATTERN = /^[A-Za-z0-9._]{3,30}$/;

export const ACCOUNT_USERNAME_RULE = 'Username must be 3–30 characters: letters, numbers, dots or underscores — no spaces.';

export type AccountUsernameResult = { ok: boolean; value: string; error?: string };

/** Normalize and validate a requested username. `value: ''` means "clear it". */
export function parseAccountUsername(raw: unknown): AccountUsernameResult {
  const value = String(raw ?? '')
    .trim()
    .replace(/^@/, '');
  if (!value) return { ok: true, value: '' };
  if (!ACCOUNT_USERNAME_PATTERN.test(value)) return { ok: false, value, error: ACCOUNT_USERNAME_RULE };
  return { ok: true, value };
}
