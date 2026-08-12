/**
 * PRE-SPRINT-9 release-gate runner.
 * Restarts API between each npm script to avoid rate-limit bleed.
 * Usage: npx tsx scripts/run-presprint9-release-gate.ts
 */
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import fs from 'node:fs';

const PORT = 3001;
const SUITES = [
  'test:auth',
  'test:brands',
  'test:products',
  'test:catalog-persist',
  'test:categories',
  'test:commerce',
  'test:orders',
  'test:orders-wiring',
  'test:payments',
  'test:escrow',
  'test:presprint9-completion',
  'test:choosify-user-id',
  'test:cms-mirror-cf-id',
  'test:messaging',
];

type SuiteResult = { suite: string; ok: boolean; code: number; elapsedMs: number; tail: string };

function killPort(port: number): Promise<void> {
  return new Promise((resolve) => {
    const ps = spawn(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        `$conns = Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique; foreach ($p in $conns) { if ($p -and $p -ne 0) { Stop-Process -Id $p -Force -ErrorAction SilentlyContinue } }`,
      ],
      { stdio: 'ignore' },
    );
    ps.on('exit', () => resolve());
    ps.on('error', () => resolve());
  });
}

async function waitForHealth(timeoutMs = 90000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://localhost:${PORT}/health`);
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await delay(800);
  }
  throw new Error('Server health timeout');
}

async function restartApi() {
  await killPort(PORT);
  await delay(1000);
  const child = spawn('npx', ['tsx', 'server.ts'], {
    cwd: process.cwd(),
    stdio: 'ignore',
    shell: true,
    detached: true,
    env: { ...process.env, PAYMENT_GATEWAY_MOCK: 'true', NODE_ENV: 'development' },
  });
  child.unref();
  await waitForHealth();
}

function runNpm(script: string): Promise<{ code: number; out: string }> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    const child = spawn('npm', ['run', script], {
      cwd: process.cwd(),
      shell: true,
      env: { ...process.env, PAYMENT_GATEWAY_MOCK: 'true' },
    });
    child.stdout?.on('data', (d) => chunks.push(Buffer.from(d)));
    child.stderr?.on('data', (d) => chunks.push(Buffer.from(d)));
    child.on('exit', (c) => resolve({ code: c ?? 1, out: Buffer.concat(chunks).toString('utf8') }));
  });
}

async function main() {
  const results: SuiteResult[] = [];
  for (const suite of SUITES) {
    console.log(`\n======== ${suite} ========`);
    const t0 = Date.now();
    try {
      await restartApi();
      const { code, out } = await runNpm(suite);
      const lines = out.trim().split(/\r?\n/);
      const tail = lines.slice(-12).join('\n');
      const ok = code === 0;
      results.push({ suite, ok, code, elapsedMs: Date.now() - t0, tail });
      console.log(ok ? `PASS ${suite}` : `FAIL ${suite} exit=${code}`);
      console.log(tail);
    } catch (err) {
      results.push({
        suite,
        ok: false,
        code: 1,
        elapsedMs: Date.now() - t0,
        tail: String(err),
      });
      console.log(`FAIL ${suite} — ${err}`);
    }
  }

  // lint + smoke (no need to restart between if server up; restart for smoke isolation)
  console.log('\n======== lint ========');
  const lint = await runNpm('lint');
  results.push({
    suite: 'lint',
    ok: lint.code === 0,
    code: lint.code,
    elapsedMs: 0,
    tail: lint.out.trim().split(/\r?\n/).slice(-8).join('\n'),
  });
  console.log(lint.code === 0 ? 'PASS lint' : `FAIL lint exit=${lint.code}`);

  console.log('\n======== smoke ========');
  await restartApi();
  const smoke = await runNpm('smoke');
  results.push({
    suite: 'smoke',
    ok: smoke.code === 0,
    code: smoke.code,
    elapsedMs: 0,
    tail: smoke.out.trim().split(/\r?\n/).slice(-10).join('\n'),
  });
  console.log(smoke.code === 0 ? 'PASS smoke' : `FAIL smoke exit=${smoke.code}`);

  const summary = {
    passed: results.filter((r) => r.ok).length,
    total: results.length,
    failed: results.filter((r) => !r.ok).map((r) => r.suite),
    results,
  };
  fs.mkdirSync('.data', { recursive: true });
  fs.writeFileSync('.data/presprint9-release-gate.json', JSON.stringify(summary, null, 2));
  console.log('\n======== RELEASE GATE SUMMARY ========');
  console.log(`PASS ${summary.passed} / ${summary.total}`);
  if (summary.failed.length) {
    console.log('FAILED:', summary.failed.join(', '));
    process.exitCode = 1;
  } else {
    console.log('ALL SUITES GREEN');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
