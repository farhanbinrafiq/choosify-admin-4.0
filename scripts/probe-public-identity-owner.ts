/**
 * Public Identity — owner (Brand Studio / Creator Studio) presentation logic.
 * Pure: no server, no database, no files written.
 *
 *   npx tsx scripts/probe-public-identity-owner.ts
 *
 *  1  local username check == shared validator on every vector (no divergent rules)
 *  2  every rejection reason has specific, non-generic wording
 *  3  availability verdicts (incl. the owner-side generic `unavailable`)
 *  4  every lifecycle error code an owner can hit has specific wording
 *  5  status labels shown next to the username field
 *  6  30-day change cooldown: lock rule + wording
 */
import { readFileSync } from 'node:fs';
import { validateHandle } from '../shared/publicHandles/rules';
import {
  VERDICT_LABEL,
  availabilityVerdict,
  changeLockedUntil,
  checkUsernameLocally,
  describeOwnerFailure,
  describeUsernameReason,
  formatNextChange,
} from '../src/lib/publicIdentityOwner';

const FAIL: string[] = [];
let passes = 0;
function check(c: unknown, label: string, detail?: unknown) {
  if (c) passes += 1;
  else FAIL.push(label);
  console.log(c ? 'PASS' : 'FAIL', label, c ? '' : JSON.stringify(detail ?? ''));
}

const vectors = JSON.parse(readFileSync(new URL('../shared/publicHandles/vectors.json', import.meta.url), 'utf8')) as {
  accept: Array<{ input: string; handle: string }>;
  reject: Array<{ input: string; handle: string; reason: string }>;
  reserved: Record<string, unknown> | string[];
  reservedPrefixes: string[];
};

// 1 — parity with the shared vectors
for (const v of vectors.accept) {
  const r = checkUsernameLocally(v.input);
  check(r.ok && r.handle === v.handle && validateHandle(v.input).ok, `accept ${JSON.stringify(v.input)} → @${v.handle}`, r);
}
for (const v of vectors.reject) {
  const r = checkUsernameLocally(v.input);
  check(!r.ok && r.reason === v.reason && r.handle === v.handle, `reject ${JSON.stringify(v.input)} → ${v.reason}`, r);
}
const reservedNames = Array.isArray(vectors.reserved) ? vectors.reserved : Object.keys(vectors.reserved);
const reservedMismatch = reservedNames.filter((n) => checkUsernameLocally(n).reason !== 'reserved');
check(reservedMismatch.length === 0, `all ${reservedNames.length} reserved names are refused as reserved`, reservedMismatch.slice(0, 5));
for (const p of vectors.reservedPrefixes) check(checkUsernameLocally(`${p}shop`).reason === 'reserved_prefix', `prefix ${p} refused`);
check(checkUsernameLocally('  @Choosify-Shop ').handle === 'choosify-shop', 'input normalised like the server (trim, @, lowercase)');
check(checkUsernameLocally('ঢাকা').reason === 'non_ascii', 'Bangla username → non_ascii (display names unaffected)');
check(checkUsernameLocally('my shop').reason === 'invalid_characters', 'space → invalid_characters');

// 2 — wording
const generic = describeUsernameReason(undefined);
const reasons = ['empty', 'too_short', 'too_long', 'non_ascii', 'invalid_characters', 'must_start_with_letter', 'leading_or_trailing_hyphen', 'consecutive_hyphens', 'reserved', 'reserved_prefix', 'current_handle', 'namespace_conflict'];
for (const r of reasons) check(describeUsernameReason(r) !== generic && describeUsernameReason(r).length > 10, `reason ${r} has specific wording`);
check(describeUsernameReason('too_short').includes('3') && describeUsernameReason('too_long').includes('30'), 'length messages state the 3 / 30 limits');

// 3 — verdicts
check(availabilityVerdict({ handle: 'abc', available: true }) === 'available', 'verdict available');
check(availabilityVerdict({ handle: 'abc', available: false, reason: 'current_handle' }) === 'current', 'verdict current');
check(availabilityVerdict({ handle: 'blog', available: false, reason: 'reserved' }) === 'reserved', 'verdict reserved (name)');
check(availabilityVerdict({ handle: 'brand-x', available: false, reason: 'reserved_prefix' }) === 'reserved', 'verdict reserved (prefix)');
check(availabilityVerdict({ handle: 'ab', available: false, reason: 'too_short' }) === 'invalid', 'verdict invalid');
check(availabilityVerdict({ handle: 'taken', available: false, reason: 'unavailable' }) === 'unavailable', 'verdict unavailable (owner generic)');
check(availabilityVerdict({ handle: 'x-y', available: false, reason: 'namespace_conflict' }) === 'unavailable', 'verdict unavailable (namespace conflict)');

// 4 — errors
const fallback = describeOwnerFailure({ status: 418 });
const codes = ['HANDLE_CHANGE_COOLDOWN', 'HANDLE_UNAVAILABLE', 'HANDLE_NAMESPACE_CONFLICT', 'HANDLE_NO_CHANGE', 'HANDLE_OWNER_SUSPENDED', 'HANDLE_IMPERSONATION_NOT_ALLOWED', 'HANDLE_FORBIDDEN', 'HANDLE_CONFLICT', 'HANDLES_UNAVAILABLE'];
for (const code of codes) check(describeOwnerFailure({ status: 409, code }) !== fallback, `code ${code} has specific wording`);
check(describeOwnerFailure({ status: 400, code: 'HANDLE_INVALID', reason: 'consecutive_hyphens' }) === describeUsernameReason('consecutive_hyphens'), 'HANDLE_INVALID uses the validator reason');
check(/session/i.test(describeOwnerFailure({ status: 401 })), '401 → session expired');
check(/permission/i.test(describeOwnerFailure({ status: 403 })), '403 → permission');
check(/connection/i.test(describeOwnerFailure({ status: 0, code: 'NETWORK_ERROR' })), 'network → connection message');
check(/temporarily/i.test(describeOwnerFailure({ status: 503 })), '5xx → temporarily unavailable');
check(/impersonat/i.test(describeOwnerFailure({ status: 403, code: 'HANDLE_IMPERSONATION_NOT_ALLOWED' })), 'impersonation refusal is explicit');

// 5 — status labels (Facebook-style field feedback)
check(
  VERDICT_LABEL.available === 'Available' && VERDICT_LABEL.unavailable === 'Not available' && VERDICT_LABEL.invalid === 'Invalid username' && VERDICT_LABEL.reserved === 'Reserved',
  'labels: Available / Not available / Invalid username / Reserved',
);
check(/just taken|no longer available/i.test(describeOwnerFailure({ status: 409, code: 'HANDLE_UNAVAILABLE' })), 'taken-at-save message tells the owner to choose another');

// 6 — 30-day change cooldown presentation (the server decides; this only words it)
const until = '2026-11-02T10:05:00.000Z';
check(changeLockedUntil({ activeHandle: { handle: 'abc' }, ownerChangeAvailableAt: until }) === until, 'active username + running cooldown → change locked until the server time');
check(changeLockedUntil({ activeHandle: null, ownerChangeAvailableAt: until }) === null, 'no active username → never locked (first registration / after an admin retirement)');
check(changeLockedUntil({ activeHandle: { handle: 'abc' }, ownerChangeAvailableAt: null }) === null, 'no cooldown running → not locked');
check(changeLockedUntil({ activeHandle: { handle: 'abc' } }) === null, 'older payload without the field → not locked (server still enforces)');
const msg = describeOwnerFailure({ status: 409, code: 'HANDLE_CHANGE_COOLDOWN', nextChangeAt: until });
check(/30 days/.test(msg) && msg.includes(formatNextChange(until)) && /2026/.test(formatNextChange(until)), 'cooldown refusal names the 30-day rule and the next allowed date', msg);
check(/30 days/.test(describeOwnerFailure({ status: 409, code: 'HANDLE_CHANGE_COOLDOWN' })), 'cooldown refusal without a date still explains the rule');
check(formatNextChange('not-a-date') === 'not-a-date', 'unparseable date is shown as given (never "Invalid Date")');

console.log(`\n${FAIL.length === 0 ? 'PASS' : 'FAIL'} probe-public-identity-owner (${passes} passed, ${FAIL.length} failed)`);
if (FAIL.length) for (const f of FAIL) console.log(`  - ${f}`);
process.exit(FAIL.length === 0 ? 0 : 1);
