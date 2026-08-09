/**
 * Run one npm script after restarting API on :3001 (clears rate-limit memory).
 * Usage: npx tsx scripts/run-with-api-restart.ts test:brands
 */
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const PORT = 3001;
const script = process.argv[2];
if (!script) {
  console.error('Usage: npx tsx scripts/run-with-api-restart.ts <npm-script>');
  process.exit(2);
}

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

async function main() {
  console.log(`--- Restart API for ${script} ---`);
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
  console.log(`--- Running npm run ${script} ---`);
  const test = spawn('npm', ['run', script], {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, PAYMENT_GATEWAY_MOCK: 'true' },
  });
  const code: number = await new Promise((resolve) => {
    test.on('exit', (c) => resolve(c ?? 1));
  });
  process.exit(code);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
