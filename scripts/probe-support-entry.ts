/**
 * Support-entry UAT — in-process idempotency + live HTTP against the running API.
 * Does NOT kill or restart the server.
 *
 * Usage: npx tsx scripts/probe-support-entry.ts
 */
import dotenv from 'dotenv';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';

dotenv.config({ path: '.env' });
if (existsSync('.env.local')) dotenv.config({ path: '.env.local', override: true });

const SNAPSHOT = join(process.cwd(), '.data', `support-entry-probe-${Date.now()}.json`);
process.env.MESSAGING_MEMORY_SNAPSHOT_PATH = SNAPSHOT;

const { ensureActiveSupportConversation, resolveSupportTicket, listConversationsForActor } =
  await import('../server/messaging/conversations/conversationService');

const DEV_PASSWORD = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';
const base = process.env.PROBE_BASE_URL || 'http://localhost:3001/api/v1';

let failed = 0;
function assert(condition: boolean, label: string, detail?: unknown) {
  if (condition) console.log('PASS', label);
  else {
    failed += 1;
    console.log('FAIL', label, detail ?? '');
  }
}

async function json(res: Response) {
  return res.json().catch(() => ({}));
}

async function login(email: string) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const res = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: DEV_PASSWORD }),
    });
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 8000 + attempt * 2000));
      continue;
    }
    const body = (await json(res)) as { accessToken?: string; uid?: string };
    if (!res.ok || !body.accessToken) throw new Error(`login failed for ${email}: ${res.status}`);
    return { token: body.accessToken, uid: body.uid as string };
  }
  throw new Error(`login failed for ${email}: rate limited`);
}

async function registerConsumer(email: string) {
  const res = await fetch(`${base}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password: 'Probe!2026xx',
      fullName: 'Support Entry Consumer',
    }),
  });
  const body = (await json(res)) as { accessToken?: string; customToken?: string; uid?: string };
  const token = body.accessToken || body.customToken;
  if (!res.ok || !token) throw new Error(`register failed: ${res.status}`);
  return { token, uid: body.uid as string };
}

function authHeaders(token: string) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

async function runInProcess() {
  console.log('\n=== In-process ensureActiveSupportConversation ===');
  const first = await ensureActiveSupportConversation({
    actor: { userId: 'sell_probe', role: 'seller' },
    subject: 'Seller help',
    body: 'Need seller help',
  });
  const second = await ensureActiveSupportConversation({
    actor: { userId: 'sell_probe', role: 'seller' },
  });
  assert(
    first.conversation.id === second.conversation.id && second.created === false,
    'seller ensure is idempotent',
  );
  const own = await listConversationsForActor({ userId: 'sell_probe', role: 'seller' });
  assert(own.some((c) => c.id === first.conversation.id), 'seller sees own support thread');

  const other = await ensureActiveSupportConversation({
    actor: { userId: 'cons_probe', role: 'user' },
  });
  const sellerList = await listConversationsForActor({ userId: 'sell_probe', role: 'seller' });
  assert(
    !sellerList.some((c) => c.id === other.conversation.id),
    'seller does not see another user support thread',
  );

  const resolved = await resolveSupportTicket({
    actor: { userId: 'admin_probe', role: 'admin' },
    conversationId: first.conversation.id,
  });
  assert(resolved.ticket.status === 'resolved', 'admin can resolve');
  const third = await ensureActiveSupportConversation({
    actor: { userId: 'sell_probe', role: 'seller' },
  });
  assert(
    third.created === true && third.conversation.id !== first.conversation.id,
    'closed thread does not block a new active thread',
  );

  const c1 = await ensureActiveSupportConversation({
    actor: { userId: 'creator_probe', role: 'creator' },
  });
  const c2 = await ensureActiveSupportConversation({
    actor: { userId: 'creator_probe', role: 'creator' },
  });
  assert(c1.conversation.id === c2.conversation.id && c2.created === false, 'creator ensure is idempotent');
}

async function postEnsure(token: string) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(`${base}/support/conversations/ensure`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({}),
    });
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 8000 + attempt * 2000));
      continue;
    }
    const body = (await json(res)) as {
      data?: { created?: boolean; conversation?: { id: string; contextType: string } };
    };
    return { res, body };
  }
  throw new Error('ensure rate limited');
}

async function ensureTwice(token: string, label: string) {
  const a = await postEnsure(token);
  const b = await postEnsure(token);
  const id = a.body.data?.conversation?.id;
  assert(
    a.res.ok && Boolean(id) && a.body.data?.conversation?.contextType === 'support_ticket',
    `${label} ensure returns support_ticket`,
    { status: a.res.status, body: a.body },
  );
  assert(
    b.res.status === 200 && b.body.data?.created === false && b.body.data?.conversation?.id === id,
    `${label} second ensure returns the same active thread`,
    { status: b.res.status, body: b.body },
  );
  return id;
}

async function runHttp() {
  console.log('\n=== Live HTTP support entry ===');
  const health = await fetch('http://localhost:3001/health').catch(() => null);
  if (!health?.ok) {
    console.log('SKIP live HTTP — API not healthy on :3001');
    return;
  }
  const seller = await login('seller@choosify.com.bd');
  const creator = await login('creator@choosify.com.bd');
  let consumer: { token: string; uid: string };
  try {
    consumer = await login('consumer@choosify.com.bd');
  } catch {
    consumer = await registerConsumer(`support-entry-${Date.now()}@probe.local`);
  }
  const admin = await login('admin@choosify.com.bd');

  const sellerId = await ensureTwice(seller.token, 'seller');
  const creatorId = await ensureTwice(creator.token, 'creator');
  const consumerId = await ensureTwice(consumer.token, 'consumer');
  assert(
    Boolean(sellerId && creatorId && consumerId) &&
      sellerId !== creatorId &&
      sellerId !== consumerId &&
      creatorId !== consumerId,
    'each role gets its own support thread',
  );

  const steal = await fetch(`${base}/support/conversations/${sellerId}/messages`, {
    headers: authHeaders(creator.token),
  });
  assert(steal.status === 403 || steal.status === 404, 'creator cannot read seller support messages', {
    status: steal.status,
  });

  const sellerList = await fetch(`${base}/support/conversations`, {
    headers: authHeaders(seller.token),
  });
  const sellerListBody = (await json(sellerList)) as { data?: Array<{ id: string }> };
  const ids = new Set((sellerListBody.data || []).map((c) => c.id));
  assert(ids.has(sellerId || '') && !ids.has(creatorId || '') && !ids.has(consumerId || ''), 'seller list is own-scoped');

  if (sellerId) {
    const resolved = await fetch(`${base}/support/conversations/${sellerId}/resolve`, {
      method: 'POST',
      headers: authHeaders(admin.token),
      body: JSON.stringify({ status: 'resolved' }),
    });
    assert(resolved.ok, 'admin can resolve seller support thread', { status: resolved.status });
    const after = await fetch(`${base}/support/conversations/ensure`, {
      method: 'POST',
      headers: authHeaders(seller.token),
      body: JSON.stringify({}),
    });
    const afterBody = (await json(after)) as {
      data?: { created?: boolean; conversation?: { id: string } };
    };
    assert(
      after.status === 201 &&
        afterBody.data?.created === true &&
        afterBody.data?.conversation?.id !== sellerId,
      'after resolve, seller ensure creates a new thread',
      { status: after.status, body: afterBody },
    );
  }
}

try {
  await runInProcess();
  await runHttp();
} finally {
  if (existsSync(SNAPSHOT)) {
    try {
      unlinkSync(SNAPSHOT);
    } catch {
      /* ignore */
    }
  }
}

console.log('\n=== Support-entry probe DONE ===');
if (failed > 0) {
  console.error(`FAILED ${failed} assertion(s)`);
  process.exit(1);
}
console.log('ALL SUPPORT-ENTRY PROBES PASSED');
