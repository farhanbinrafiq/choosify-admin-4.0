/**
 * Sprint 11 — Moderation queue durability regression. moderationStore previously
 * had NO persistence at all (server/moderation/moderationStore.ts, pure in-memory
 * `state` object, wiped on every restart). Confirms that a moderation item now
 * survives a real server restart via the new moderationPersistence.ts snapshot
 * (matching the established escrow/catalog/commerce/messaging/payments/ads
 * memory-disk pattern).
 *
 * There is currently no HTTP endpoint that creates a moderation item (queueItem()
 * has no real caller yet — Sprint 11 scope is persistence only, not building the
 * auto-flagging trigger pipeline). This probe creates the fixture via a direct
 * in-process store import, matching how the disk snapshot is actually populated
 * today, then proves it survives an out-of-process server restart over HTTP.
 *
 * Usage: npx tsx scripts/probe-moderation-persistence.ts
 * Or:    npm run test:moderation-persistence
 */
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { moderationStore } from '../server/moderation/moderationStore';
import { flushModerationMemoryPersist, moderationMemorySnapshotPath } from '../server/moderation/moderationPersistence';

const PORT = Number(process.env.PORT || 3001);
const base = `http://localhost:${PORT}/api/v1`;
const ADMIN_EMAIL = 'admin@choosify.com.bd';
const ADMIN_PASS = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';

const fails: string[] = [];
function assert(cond: unknown, label: string, detail?: unknown) {
  if (cond) console.log('PASS', label);
  else {
    fails.push(label);
    console.log('FAIL', label, detail ?? '');
  }
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
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

async function waitForHealth(timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://localhost:${PORT}/api/v1/health`);
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await delay(500);
  }
  throw new Error('Server did not become healthy after restart');
}

async function main() {
  const marker = `Probe Moderation Item ${Date.now()}`;
  const created = moderationStore.createItem({
    queue: 'products',
    resourceType: 'product',
    resourceId: `probe-resource-${Date.now()}`,
    resourceLabel: marker,
    priority: 1,
    notes: 'probe fixture',
  });
  assert(!!created.id, 'moderationStore.createItem returns a real item', created);

  // Force the debounced disk write to complete before we read the file / restart.
  flushModerationMemoryPersist();
  await delay(200);

  const path = moderationMemorySnapshotPath();
  assert(existsSync(path), 'moderation snapshot file exists on disk', path);
  const onDisk = JSON.parse(readFileSync(path, 'utf8')) as { items?: Array<{ id: string; resourceLabel?: string }> };
  assert(
    (onDisk.items || []).some((i) => i.id === created.id),
    'created item is present in the on-disk snapshot',
    onDisk.items?.length,
  );

  console.log('Restarting API server on port', PORT, '…');
  await killPort(PORT);
  await delay(2000);

  const child = spawn('npm', ['run', 'dev'], {
    cwd: process.cwd(),
    stdio: 'ignore',
    shell: true,
    detached: true,
  });
  child.unref();

  await waitForHealth();
  console.log('Server healthy after restart');

  const login = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASS }),
  });
  const loginBody = (await login.json()) as { accessToken?: string };
  assert(login.ok && loginBody.accessToken, 'admin login after restart');

  const queueRes = await fetch(`http://localhost:${PORT}/api/admin/moderation/queue`, {
    headers: { Authorization: `Bearer ${loginBody.accessToken}` },
  });
  const queueBody = (await queueRes.json()) as { data?: { items?: Array<{ id: string; resourceLabel?: string }> } };
  const survivedItem = (queueBody.data?.items || []).find((i) => i.id === created.id);
  assert(queueRes.ok, 'GET /admin/moderation/queue succeeds after restart', queueRes.status);
  assert(!!survivedItem, 'moderation item survives real server restart', {
    createdId: created.id,
    itemsAfterRestart: queueBody.data?.items?.length,
  });
  assert(survivedItem?.resourceLabel === marker, 'survived item has correct resourceLabel', survivedItem);

  console.log('\n=== MODERATION PERSISTENCE SUMMARY ===');
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
