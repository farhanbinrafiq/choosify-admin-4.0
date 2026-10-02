/**
 * Public handle contract probe (Public Identity Phase B) — Admin copy.
 *
 * Checks shared/publicHandles/rules.ts against shared/publicHandles/vectors.json,
 * which is byte-identical to the storefront repo's lib/publicHandleVectors.json:
 * both validators must accept and reject exactly the same inputs, with the same
 * normalized handle, the same rejection reason, the same reserved list and the
 * same reserved catalog-id prefixes (Phase C).
 * Pure / in-memory only.
 *
 * Run: npx tsx scripts/probe-public-handles.ts
 */
import { readFileSync } from 'node:fs';
import {
  HANDLE_MAX_LENGTH,
  HANDLE_MIN_LENGTH,
  HANDLE_PATTERN,
  RESERVED_HANDLES,
  RESERVED_HANDLE_PREFIXES,
  isReservedHandle,
  normalizeHandle,
  validateHandle,
} from '../shared/publicHandles/rules';

let pass = 0;
let fail = 0;
function assertEqual(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    pass += 1;
    console.log(`PASS ${name}`);
  } else {
    fail += 1;
    console.log(`FAIL ${name} — expected ${e}, got ${a}`);
  }
}

const result = (input: string) => {
  const r = validateHandle(input);
  return 'reason' in r ? { ok: false, handle: r.handle, reason: r.reason } : { ok: true, handle: r.handle };
};

type Vectors = {
  minLength: number;
  maxLength: number;
  pattern: string;
  accept: Array<{ input: string; handle: string }>;
  reject: Array<{ input: string; handle: string; reason: string }>;
  reservedPrefixes: string[];
  reserved: Record<string, string>;
};
const vectors = JSON.parse(readFileSync('shared/publicHandles/vectors.json', 'utf8')) as Vectors;

assertEqual('length bounds match vectors', [HANDLE_MIN_LENGTH, HANDLE_MAX_LENGTH], [vectors.minLength, vectors.maxLength]);
assertEqual('pattern matches vectors (and the 0012 CHECK constraint)', HANDLE_PATTERN.source, vectors.pattern);
for (const v of vectors.accept) assertEqual(`accept ${JSON.stringify(v.input)}`, result(v.input), { ok: true, handle: v.handle });
for (const v of vectors.reject) assertEqual(`reject ${JSON.stringify(v.input)}`, result(v.input), { ok: false, handle: v.handle, reason: v.reason });
assertEqual('reserved list (names + justification) identical to vectors', Object.entries(RESERVED_HANDLES).sort(), Object.entries(vectors.reserved).sort());
assertEqual('reserved prefixes identical to vectors', [...RESERVED_HANDLE_PREFIXES], vectors.reservedPrefixes);
assertEqual('vectors cover every reserved prefix with a rejection', vectors.reservedPrefixes.every((prefix) => vectors.reject.some((v) => v.reason === 'reserved_prefix' && v.handle.startsWith(prefix))), true);
assertEqual('normalize strips one @ and lowercases', normalizeHandle('  @Samsung '), 'samsung');
assertEqual('"account" is not reserved', isReservedHandle('account'), false);
const migration = readFileSync('server/db/migrations/0012_public_handles.sql', 'utf8');
assertEqual('0012 CHECK constraint uses the same pattern', migration.includes(`'${vectors.pattern}'`), true);
assertEqual('0012 CHECK constraint uses the same length bounds', migration.includes(`BETWEEN ${vectors.minLength} AND ${vectors.maxLength}`), true);

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'} probe-public-handles (admin) (${pass} passed, ${fail} failed)`);
process.exit(fail === 0 ? 0 : 1);
