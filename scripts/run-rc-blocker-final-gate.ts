/**
 * Final RC gate — only suites required by the blocker clearance pass.
 * Restarts API between npm suites / probe groups.
 */
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const PORT = 3001;

type Step =
  | { kind: 'npm'; script: string }
  | { kind: 'tsx'; file: string; label: string };

const STEPS: Step[] = [
  { kind: 'npm', script: 'test:auth' },
  { kind: 'npm', script: 'test:brands' },
  { kind: 'npm', script: 'test:presprint9-completion' },
  { kind: 'npm', script: 'test:choosify-user-id' },
  { kind: 'npm', script: 'test:reference-ids' },
  { kind: 'tsx', file: 'scripts/probe-orders-oversight-selectall.ts', label: 'orders-oversight' },
  { kind: 'tsx', file: 'scripts/probe-finance-cashbook-http.ts', label: 'finance-cashbook-http' },
  { kind: 'tsx', file: 'scripts/probe-cashbook-import-create-modal.ts', label: 'cashbook-import' },
  { kind: 'tsx', file: 'scripts/probe-cashbook-delete-modal.ts', label: 'cashbook-delete' },
  { kind: 'npm', script: 'test:messaging' },
  { kind: 'npm', script: 'test:messaging-persist' },
  { kind: 'npm', script: 'lint' },
  { kind: 'npm', script: 'smoke' },
  { kind: 'tsx', file: 'scripts/probe-my-profile-routing.ts', label: 'my-profile-routing' },
  { kind: 'tsx', file: 'scripts/probe-rc-blocker-clearance.ts', label: 'rc-blocker-clearance' },
];

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
  console.log('\n--- Restart API ---');
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

function run(cmd: string, args: string[]): Promise<{ code: number; out: string }> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    const child = spawn(cmd, args, {
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
  const results: Array<{ label: string; ok: boolean; code: number; elapsedMs: number; tail: string }> = [];

  for (const step of STEPS) {
    const label = step.kind === 'npm' ? step.script : step.label;
    console.log(`\n======== ${label} ========`);
    const t0 = Date.now();
    try {
      // lint needs no live API; clearance restarts itself — still restart for isolation
      if (label !== 'lint') await restartApi();
      const { code, out } =
        step.kind === 'npm'
          ? await run('npm', ['run', step.script])
          : await run('npx', ['tsx', step.file]);
      const lines = out.trim().split(/\r?\n/);
      const tail = lines.slice(-15).join('\n');
      const ok = code === 0;
      results.push({ label, ok, code, elapsedMs: Date.now() - t0, tail });
      console.log(ok ? `PASS ${label}` : `FAIL ${label} exit=${code}`);
      console.log(tail);
    } catch (err) {
      results.push({
        label,
        ok: false,
        code: 1,
        elapsedMs: Date.now() - t0,
        tail: String(err),
      });
      console.log(`FAIL ${label} — ${err}`);
    }
  }

  console.log('\n=== FINAL GATE SUMMARY ===');
  for (const r of results) {
    console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.label} (${Math.round(r.elapsedMs / 1000)}s)`);
  }
  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    console.log(`\nFAILED: ${failed.map((f) => f.label).join(', ')}`);
    process.exit(1);
  }
  console.log('\nALL FINAL GATE CHECKS PASSED');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
