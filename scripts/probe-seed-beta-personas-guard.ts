/**
 * Regression coverage for scripts/seed-beta-personas.ts's safety guards.
 * Spawns the real script (not an imported function) with different env
 * combinations and checks exit code + stderr, so this proves the actual
 * CLI entry point refuses unsafe invocations — not just an internal helper
 * in isolation.
 *
 * Usage: npx tsx scripts/probe-seed-beta-personas-guard.ts
 */
import { spawn } from 'node:child_process';
import path from 'node:path';

const SCRIPT = path.join(process.cwd(), 'scripts', 'seed-beta-personas.ts');

const fails: string[] = [];
function assert(cond: unknown, label: string, detail?: unknown) {
  if (cond) console.log('PASS', label);
  else {
    fails.push(label);
    console.log('FAIL', label, detail ?? '');
  }
}

function run(env: Record<string, string | undefined>, timeoutMs = 8000): Promise<{ code: number | null; stderr: string; stdout: string }> {
  return new Promise((resolve) => {
    const child = spawn('npx', ['tsx', SCRIPT], {
      cwd: process.cwd(),
      shell: true,
      env: { ...process.env, ...env },
    });
    let stderr = '';
    let stdout = '';
    child.stderr.on('data', (d) => (stderr += d.toString()));
    child.stdout.on('data', (d) => (stdout += d.toString()));
    const timer = setTimeout(() => {
      child.kill();
      resolve({ code: -1, stderr: stderr + '\n[TIMEOUT]', stdout });
    }, timeoutMs);
    child.on('exit', (code) => {
      clearTimeout(timer);
      resolve({ code, stderr, stdout });
    });
  });
}

async function main() {
  // --- 1. No BETA_API_BASE_URL at all -> refused before any network call ---
  const noTarget = await run({ BETA_API_BASE_URL: '', BETA_TESTER_PASSWORD: 'x' });
  assert(
    noTarget.code !== 0 && /BETA_API_BASE_URL is required/.test(noTarget.stderr),
    'missing BETA_API_BASE_URL is refused with a clear error',
    noTarget,
  );

  // --- 2. Known production domains are refused, not silently allowed ---
  for (const prodHost of ['https://choosify.bd', 'https://www.choosify.bd', 'https://api.choosify.bd', 'https://dashboard.choosify.bd']) {
    const res = await run({ BETA_API_BASE_URL: prodHost, BETA_TESTER_PASSWORD: 'x' });
    assert(
      res.code !== 0 && /Refusing to run/.test(res.stderr) && /Production/.test(res.stderr),
      `known production domain ${prodHost} is refused`,
      res,
    );
  }

  // --- 3. Missing BETA_TESTER_PASSWORD is refused even with a safe target ---
  const noPassword = await run({ BETA_API_BASE_URL: 'http://localhost:3001', BETA_TESTER_PASSWORD: '' });
  assert(
    noPassword.code !== 0 && /BETA_TESTER_PASSWORD is required/.test(noPassword.stderr),
    'missing BETA_TESTER_PASSWORD is refused with a clear error',
    noPassword,
  );

  // --- 4. A safe non-production target is NOT blocked by the guard itself ---
  // (it will still fail — nothing is listening at this host — but it must
  // fail with a network/fetch error, not the "Refusing to run" guard error,
  // proving the guard let a legitimate beta-shaped host through.)
  const safeTarget = await run(
    { BETA_API_BASE_URL: 'https://api-beta.choosify.bd.invalid-test-host', BETA_TESTER_PASSWORD: 'x' },
    8000,
  );
  assert(
    !/Refusing to run/.test(safeTarget.stderr) && !/is required/.test(safeTarget.stderr),
    'a non-production beta-shaped host is NOT rejected by the safety guard',
    safeTarget,
  );

  console.log('\n=== SEED-BETA-PERSONAS SAFETY GUARD SUMMARY ===');
  if (fails.length) {
    console.error('FAILS:', fails);
    console.error(`RESULT: FAILED (${fails.length})`);
    process.exit(1);
  }
  console.log('RESULT: ALL PASSED');
}

main().catch((e) => {
  console.error('CRASH', e);
  process.exit(1);
});
