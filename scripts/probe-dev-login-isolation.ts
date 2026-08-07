/**
 * Sprint 1 (IS-001) dev-login production-isolation probe.
 *
 * In-process unit check of the exact fail-closed guard behind
 * POST /auth/dev-login (see isDevLoginAllowed in server/authRouter.ts).
 * No HTTP server is booted — follows the same in-process convention as
 * scripts/probe-tier1-roles.ts.
 *
 * Rule under test: ALLOW_DEV_LOGIN === "true" AND NODE_ENV is explicitly
 * "development" or "test". Every other NODE_ENV value — including missing,
 * empty, "production", "staging", "preview", or anything unrecognized —
 * must deny.
 *
 * Run: npx tsx scripts/probe-dev-login-isolation.ts
 */
import { isDevLoginAllowed } from '../server/authRouter';

let failed = 0;
function assert(condition: boolean, label: string, detail?: unknown) {
  if (condition) {
    console.log('PASS', label);
  } else {
    failed += 1;
    console.log('FAIL', label, detail ?? '');
  }
}

type Case = [label: string, env: { NODE_ENV?: string; ALLOW_DEV_LOGIN?: string }, expected: boolean];

const cases: Case[] = [
  ['development + true -> allowed', { NODE_ENV: 'development', ALLOW_DEV_LOGIN: 'true' }, true],
  ['test + true -> allowed', { NODE_ENV: 'test', ALLOW_DEV_LOGIN: 'true' }, true],
  ['production + true -> denied', { NODE_ENV: 'production', ALLOW_DEV_LOGIN: 'true' }, false],
  ['undefined NODE_ENV + true -> denied', { NODE_ENV: undefined, ALLOW_DEV_LOGIN: 'true' }, false],
  ['empty NODE_ENV + true -> denied', { NODE_ENV: '', ALLOW_DEV_LOGIN: 'true' }, false],
  ['staging + true -> denied', { NODE_ENV: 'staging', ALLOW_DEV_LOGIN: 'true' }, false],
  ['development + false -> denied', { NODE_ENV: 'development', ALLOW_DEV_LOGIN: 'false' }, false],
  ['test + false -> denied', { NODE_ENV: 'test', ALLOW_DEV_LOGIN: 'false' }, false],
  // Additional coverage beyond the required 8, same rule surface:
  ['preview + true -> denied', { NODE_ENV: 'preview', ALLOW_DEV_LOGIN: 'true' }, false],
  ['unexpected value + true -> denied', { NODE_ENV: 'qa-env-42', ALLOW_DEV_LOGIN: 'true' }, false],
  ['development + undefined ALLOW_DEV_LOGIN -> denied', { NODE_ENV: 'development', ALLOW_DEV_LOGIN: undefined }, false],
];

for (const [label, env, expected] of cases) {
  assert(isDevLoginAllowed(env) === expected, label, { env, expected });
}

console.log('');
if (failed > 0) {
  console.log(`${failed} check(s) FAILED`);
  process.exit(1);
}
console.log('Dev-login isolation checks passed.');
