/**
 * Pre-VPS Gap 2 closure — proves the remaining stores not covered by any
 * existing real-restart probe survive a genuine process kill + respawn:
 *   1. omniStore (omni messaging)          — memory + debounced disk snapshot
 *   2. adsStore (ads/deals)                — memory + debounced disk snapshot
 *   3. cashbookStore                       — memory + debounced disk snapshot
 *   4. Reference IDs (referenceIdService)  — Postgres-authoritative, `.data`
 *      index/sequence files are synchronous restart-visibility mirrors only
 *   5. Choosify user ID (choosifyUserId)   — Postgres-authoritative, `.data`
 *      sequence file is a synchronous mirror only
 *   6. Partner entitlements                — fully migrated to Postgres;
 *      `.data/partner-entitlements-snapshot.json` is dead, one-time-backfill
 *      legacy state that is never written to again (asserted, not exercised
 *      as a live memory+disk store)
 *
 * Uses a genuinely new OS process for the "after restart" phase (kills the
 * port, spawns a fresh `npm run dev`, waits for /health) — not an in-process
 * module reload.
 *
 * Usage: npx tsx scripts/probe-gap2-remaining-persistence.ts
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const PORT = Number(process.env.PORT || 3001);
const BASE = `http://localhost:${PORT}`;
const V1 = `${BASE}/api/v1`;
const ADMIN_EMAIL = 'admin@choosify.com.bd';
const SELLER_EMAIL = 'seller@choosify.com.bd';
const DEV_PASS = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';

const fails: string[] = [];
function assert(cond: unknown, label: string, detail?: unknown) {
  if (cond) console.log('PASS', label);
  else {
    fails.push(label);
    console.log('FAIL', label, detail ?? '');
  }
}

type Json = Record<string, unknown>;

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
      const res = await fetch(`${BASE}/health`);
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await delay(500);
  }
  throw new Error('Server did not become healthy after restart');
}

async function login(email: string, password: string): Promise<{ token: string; uid: string }> {
  const res = await fetch(`${V1}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = (await res.json()) as Json;
  if (!res.ok || typeof body.accessToken !== 'string') throw new Error(`login failed: ${res.status} ${JSON.stringify(body)}`);
  return { token: body.accessToken as string, uid: String(body.uid || '') };
}

async function main() {
  const { token: admin } = await login(ADMIN_EMAIL, DEV_PASS);
  const { token: seller } = await login(SELLER_EMAIL, DEV_PASS);
  const stamp = Date.now();

  // --- 0. Partner entitlements: confirm the legacy snapshot file is genuinely
  // dead (untouched), not silently the live store — informational, not a
  // durability exercise (live store is Postgres, verified structurally).
  const entitlementsSnapshotPath = path.join(process.cwd(), '.data', 'partner-entitlements-snapshot.json');
  const entitlementsSnapshotExistsBefore = fs.existsSync(entitlementsSnapshotPath);
  const entitlementsSnapshotMtimeBefore = entitlementsSnapshotExistsBefore
    ? fs.statSync(entitlementsSnapshotPath).mtimeMs
    : null;

  // --- 1. omniStore: send a real omni message in an existing seeded conversation ---
  const convRes = await fetch(`${BASE}/api/conversations`, { headers: { Authorization: `Bearer ${admin}` } });
  const convBody = (await convRes.json()) as Array<{ conversationId: string; platform: string }> | { data?: Array<{ conversationId: string; platform: string }> };
  const conversationList = Array.isArray(convBody) ? convBody : convBody.data || [];
  assert(convRes.ok && conversationList.length > 0, 'omniStore: seeded conversation available', { status: convRes.status, count: conversationList.length });
  const conversationId = (conversationList.find((c) => c.platform === 'platform') || conversationList[0])?.conversationId;

  let omniMessageId: string | undefined;
  if (conversationId) {
    const sendRes = await fetch(`${BASE}/api/messages/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin}` },
      body: JSON.stringify({ conversationId, content: { type: 'text', body: `Gap2 probe ${stamp}` } }),
    });
    const sendBody = (await sendRes.json()) as { message?: { id: string } } & Json;
    omniMessageId = sendBody.message?.id;
    assert(sendRes.ok && !!omniMessageId, 'omniStore: message sent', sendBody);
  }

  // --- 2. adsStore: create a deal (auto-approved/active) ---
  const dealRes = await fetch(`${V1}/ads/deals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin}` },
    body: JSON.stringify({ title: `Gap2 Probe Deal ${stamp}` }),
  });
  const dealBody = (await dealRes.json()) as { data?: { id: string } } & Json;
  const dealId = (dealBody as { data?: { id: string } }).data?.id || (dealBody as { id?: string }).id;
  assert(dealRes.ok && !!dealId, 'adsStore: deal created', dealBody);

  // --- 3. cashbookStore: create a cashbook (as seller) ---
  const cashbookRes = await fetch(`${V1}/cashbooks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${seller}` },
    body: JSON.stringify({ name: `Gap2 Probe Book ${stamp}` }),
  });
  const cashbookBody = (await cashbookRes.json()) as { data?: { id: string; name: string } } & Json;
  const cashbookId = cashbookBody.data?.id;
  assert(cashbookRes.ok && !!cashbookId, 'cashbookStore: cashbook created', cashbookBody);

  // --- 4/5. Reference IDs + Choosify user ID: register a fresh consumer,
  // which triggers a CF-xxxxx user ID and (for the user record itself) exercises
  // the same Postgres-counter + synchronous-mirror pipeline as every other
  // reference-ID type (brand/product/order use the identical service). ---
  const probeEmail = `gap2-probe-${stamp}@test.choosify.bd`;
  const registerRes = await fetch(`${V1}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: probeEmail, password: 'Gap2Probe!2026', fullName: 'Gap2 Probe User' }),
  });
  const registerBody = (await registerRes.json()) as { choosifyUserId?: string } & Json;
  const choosifyUserId = registerBody.choosifyUserId as string | undefined;
  assert(registerRes.ok && !!choosifyUserId, 'choosifyUserId: assigned on registration', registerBody);

  // Allow all debounced disk writes (250ms) to flush before restart. Reference-ID
  // and choosify-user-id mirrors are written synchronously already.
  await delay(1000);

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
  console.log('Server healthy after restart (genuinely new OS process)');

  const { token: admin2 } = await login(ADMIN_EMAIL, DEV_PASS);
  const { token: seller2 } = await login(SELLER_EMAIL, DEV_PASS);

  // --- Verify omni message ---
  if (conversationId && omniMessageId) {
    const msgsAfter = await fetch(`${BASE}/api/messages/${encodeURIComponent(conversationId)}`, {
      headers: { Authorization: `Bearer ${admin2}` },
    });
    const msgsAfterBody = (await msgsAfter.json()) as Array<{ id: string }>;
    const msgList = Array.isArray(msgsAfterBody) ? msgsAfterBody : [];
    assert(
      msgList.some((m) => m.id === omniMessageId),
      'omniStore: message survives real server restart',
      { omniMessageId, count: msgList.length },
    );
  }

  // --- Verify ad deal ---
  const dealsAfter = await fetch(`${V1}/ads/deals`, { headers: { Authorization: `Bearer ${admin2}` } });
  const dealsAfterBody = (await dealsAfter.json()) as { data?: Array<{ id: string }> } & Json;
  const dealsList = (dealsAfterBody as { data?: Array<{ id: string }> }).data || [];
  assert(
    dealsList.some((d) => d.id === dealId),
    'adsStore: deal survives real server restart',
    { dealId, count: dealsList.length },
  );

  // --- Verify cashbook ---
  const cashbooksAfter = await fetch(`${V1}/cashbooks`, { headers: { Authorization: `Bearer ${seller2}` } });
  const cashbooksAfterBody = (await cashbooksAfter.json()) as { data?: Array<{ id: string }> } & Json;
  const cashbooksList = (cashbooksAfterBody as { data?: Array<{ id: string }> }).data || [];
  assert(
    cashbooksList.some((c) => c.id === cashbookId),
    'cashbookStore: cashbook survives real server restart',
    { cashbookId, count: cashbooksList.length },
  );

  // --- Verify choosify user ID + reference-ID lookup survive restart ---
  if (choosifyUserId) {
    const refAfter = await fetch(`${V1}/reference/${encodeURIComponent(choosifyUserId)}`, {
      headers: { Authorization: `Bearer ${admin2}` },
    });
    const refAfterBody = (await refAfter.json()) as Json;
    assert(
      refAfter.ok,
      'referenceIds + choosifyUserId: CF-id lookup survives real server restart',
      { choosifyUserId, status: refAfter.status, body: refAfterBody },
    );

    const loginAfter = await login(probeEmail, 'Gap2Probe!2026');
    const meAfter = await fetch(`${V1}/auth/me`, { headers: { Authorization: `Bearer ${loginAfter.token}` } });
    const meAfterBody = (await meAfter.json()) as { choosifyUserId?: string } & Json;
    assert(
      meAfter.ok && meAfterBody.choosifyUserId === choosifyUserId,
      'choosifyUserId: same CF-id re-issued to same user after restart (Postgres-authoritative)',
      { expected: choosifyUserId, got: meAfterBody.choosifyUserId },
    );
  }

  // --- Partner entitlements: confirm the legacy snapshot file was NOT touched
  // by this restart (proves it's genuinely dead code, not a silent live store) ---
  const entitlementsSnapshotExistsAfter = fs.existsSync(entitlementsSnapshotPath);
  const entitlementsSnapshotMtimeAfter = entitlementsSnapshotExistsAfter
    ? fs.statSync(entitlementsSnapshotPath).mtimeMs
    : null;
  assert(
    entitlementsSnapshotExistsBefore === entitlementsSnapshotExistsAfter &&
      entitlementsSnapshotMtimeBefore === entitlementsSnapshotMtimeAfter,
    'partnerEntitlements: legacy .data snapshot untouched by restart (confirms Postgres-only, not a live memory+disk store)',
    { before: entitlementsSnapshotMtimeBefore, after: entitlementsSnapshotMtimeAfter },
  );

  console.log('\n=== GAP 2 REMAINING-STORES PERSISTENCE SUMMARY ===');
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
