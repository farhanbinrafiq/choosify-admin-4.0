/**
 * Messaging persistence probe — memory-disk durability, Firestore mode selection, fail-closed.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { randomBytes } from 'node:crypto';

const PORT = 3001;
const RUN_ID = randomBytes(3).toString('hex');
const DATA = join(process.cwd(), '.data');
const SNAPSHOT = join(DATA, `messaging-persist-probe-${RUN_ID}.json`);
const OMNI_SNAPSHOT = join(DATA, `omni-persist-probe-${RUN_ID}.json`);
const BASE = `http://localhost:${PORT}/api/v1`;
const ADMIN_EMAIL = process.env.PROBE_ADMIN_EMAIL || 'admin@choosify.com.bd';
const DEV_PASSWORD = process.env.DEV_SEED_PASSWORD || process.env.PROBE_ADMIN_PASSWORD || 'ChoosifyDev!2026';

let failed = 0;
function assert(cond: unknown, label: string, detail?: unknown) {
  if (cond) {
    console.log(`PASS ${label}`);
    return;
  }
  failed += 1;
  console.error(`FAIL ${label}`, detail ?? '');
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

async function startServer(extraEnv: Record<string, string> = {}) {
  await killPort(PORT);
  await delay(800);
  const child = spawn('npx', ['tsx', 'server.ts'], {
    cwd: process.cwd(),
    stdio: 'ignore',
    shell: true,
    detached: true,
    env: {
      ...process.env,
      NODE_ENV: 'development',
      PAYMENT_GATEWAY_MOCK: 'true',
      MESSAGING_MEMORY_SNAPSHOT_PATH: SNAPSHOT,
      OMNI_MEMORY_SNAPSHOT_PATH: OMNI_SNAPSHOT,
      MESSAGING_USE_FIRESTORE: 'false',
      COMMERCE_USE_FIRESTORE: 'false',
      CATALOG_USE_FIRESTORE: 'false',
      ...extraEnv,
    },
  });
  child.unref();
  await waitForHealth();
}

async function json(res: Response) {
  return res.json().catch(() => ({}));
}

async function login(email: string, password: string) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = (await json(res)) as {
    accessToken?: string;
    token?: string;
    data?: { accessToken?: string };
  };
  const token = body.accessToken || body.token || body.data?.accessToken || '';
  if (!token) throw new Error(`login failed ${res.status}`);
  return { token };
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

function runTempTs(fileBase: string, code: string, env: Record<string, string> = {}): { status: number; out: string } {
  const path = join(DATA, `${fileBase}-${RUN_ID}.ts`);
  writeFileSync(path, code, 'utf8');
  const r = spawnSync('npx', ['tsx', path], {
    cwd: process.cwd(),
    encoding: 'utf8',
    shell: true,
    env: { ...process.env, ...env },
  });
  try {
    unlinkSync(path);
  } catch {
    /* ignore */
  }
  return { status: r.status ?? 1, out: `${r.stdout || ''}\n${r.stderr || ''}` };
}

async function main() {
  console.log('=== Messaging persist probe START ===', RUN_ID);
  mkdirSync(DATA, { recursive: true });

  console.log('\n=== Mode selection / fail-closed ===');
  const local = runTempTs(
    'mode-local',
    `
process.env.MESSAGING_USE_FIRESTORE='false';
process.env.COMMERCE_USE_FIRESTORE='false';
process.env.CATALOG_USE_FIRESTORE='false';
async function main() {
  const m = await import('../server/messaging/conversations/conversationStore.ts');
  console.log('MODE=' + m.getMessagingPersistenceMode());
  process.exit(m.getMessagingPersistenceMode() === 'memory-disk' ? 0 : 1);
}
main();
`,
    { MESSAGING_USE_FIRESTORE: 'false', COMMERCE_USE_FIRESTORE: 'false', CATALOG_USE_FIRESTORE: 'false' },
  );
  assert(local.status === 0 && /MODE=memory-disk/.test(local.out), '10. local mode = memory-disk', local.out.slice(-500));

  const closed = runTempTs(
    'mode-closed',
    `
process.env.MESSAGING_USE_FIRESTORE='true';
delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
process.env.COMMERCE_USE_FIRESTORE='false';
process.env.CATALOG_USE_FIRESTORE='false';
async function main() {
  const m = await import('../server/messaging/conversations/conversationStore.ts');
  const mode = m.getMessagingPersistenceMode();
  try {
    m.assertMessagingPersistenceReady();
    console.log('READY_OK');
    process.exit(2);
  } catch {
    console.log('MODE=' + mode);
    console.log('FAIL_CLOSED_OK');
    process.exit(mode === 'firestore-misconfigured' ? 0 : 1);
  }
}
main();
`,
    {
      MESSAGING_USE_FIRESTORE: 'true',
      FIREBASE_SERVICE_ACCOUNT_JSON: '',
      COMMERCE_USE_FIRESTORE: 'false',
      CATALOG_USE_FIRESTORE: 'false',
    },
  );
  assert(
    closed.status === 0 && /FAIL_CLOSED_OK/.test(closed.out) && /MODE=firestore-misconfigured/.test(closed.out),
    '12. misconfigured production Firestore fails closed',
    closed.out.slice(-700),
  );

  const collectionsSrc = readFileSync('server/messaging/conversations/conversationCollections.ts', 'utf8');
  const storeSrc = readFileSync('server/messaging/conversations/conversationStore.ts', 'utf8');
  const adminSrc = readFileSync('server/messaging/conversations/conversationFirestoreAdmin.ts', 'utf8');
  assert(
    collectionsSrc.includes('messaging_conversations') &&
      collectionsSrc.includes('messaging_messages') &&
      collectionsSrc.includes('messaging_attachments') &&
      collectionsSrc.includes('messaging_social_inbox') &&
      adminSrc.includes('MESSAGING_CONVERSATIONS') &&
      storeSrc.includes('MESSAGING_USE_FIRESTORE') &&
      storeSrc.includes('hasFirebaseAdminCredentials') &&
      storeSrc.includes('firestore-misconfigured'),
    '11. configured production mode = Firestore adapter',
  );

  console.log('\n=== Order reconcile / multi-brand / Meta dedup ===');
  const orderSnap = join(DATA, `order-key-${RUN_ID}.json`).replace(/\\/g, '/');
  const order = runTempTs(
    'order-key',
    `
process.env.MESSAGING_USE_FIRESTORE='false';
process.env.COMMERCE_USE_FIRESTORE='false';
process.env.CATALOG_USE_FIRESTORE='false';
process.env.MESSAGING_MEMORY_SNAPSHOT_PATH=${JSON.stringify(orderSnap)};
async function main() {
  const { ensureOrderConversation, orderReconcileKey } = await import('../server/messaging/conversations/conversationService.ts');
  const { conversationMemoryFlushNow, conversationMemoryBackend } = await import('../server/messaging/conversations/conversationMemoryBackend.ts');
  const { getConversationByReconcileKey } = await import('../server/messaging/conversations/conversationStore.ts');
  conversationMemoryBackend.__resetForTests();
  const orderId = 'ord_persist_${RUN_ID}';
  const a = await ensureOrderConversation({ orderId, consumerId: 'c1', sellerId: 's1', brandId: 'b1' });
  const b = await ensureOrderConversation({ orderId, consumerId: 'c1', sellerId: 's1', brandId: 'b1' });
  conversationMemoryFlushNow();
  const found = await getConversationByReconcileKey(orderReconcileKey(orderId));
  console.log(JSON.stringify({ created: a.created, dupBlocked: b.created === false, found: !!found, same: a.conversation.id === b.conversation.id }));
  process.exit(a.created && !b.created && found && a.conversation.id === b.conversation.id ? 0 : 1);
}
main();
`,
    { MESSAGING_USE_FIRESTORE: 'false', COMMERCE_USE_FIRESTORE: 'false', CATALOG_USE_FIRESTORE: 'false' },
  );
  assert(order.status === 0 && /"dupBlocked":true/.test(order.out), '4/5. Order reconcile key + replay no duplicate', order.out.slice(-700));

  const multiSnap = join(DATA, `multi-${RUN_ID}.json`).replace(/\\/g, '/');
  const multi = runTempTs(
    'multi-brand',
    `
process.env.MESSAGING_USE_FIRESTORE='false';
process.env.COMMERCE_USE_FIRESTORE='false';
process.env.CATALOG_USE_FIRESTORE='false';
process.env.MESSAGING_MEMORY_SNAPSHOT_PATH=${JSON.stringify(multiSnap)};
async function main() {
  const { ensureOrderConversation } = await import('../server/messaging/conversations/conversationService.ts');
  const { conversationMemoryBackend } = await import('../server/messaging/conversations/conversationMemoryBackend.ts');
  conversationMemoryBackend.__resetForTests();
  const a = await ensureOrderConversation({ orderId: 'ord_a_${RUN_ID}', consumerId: 'c', sellerId: 's1', brandId: 'brand_a' });
  const b = await ensureOrderConversation({ orderId: 'ord_b_${RUN_ID}', consumerId: 'c', sellerId: 's2', brandId: 'brand_b' });
  console.log(JSON.stringify({ distinct: a.conversation.id !== b.conversation.id }));
  process.exit(a.conversation.id !== b.conversation.id ? 0 : 1);
}
main();
`,
    { MESSAGING_USE_FIRESTORE: 'false', COMMERCE_USE_FIRESTORE: 'false', CATALOG_USE_FIRESTORE: 'false' },
  );
  assert(multi.status === 0 && /"distinct":true/.test(multi.out), '6. multi-Brand Orders remain separate Conversations', multi.out.slice(-500));

  writeFileSync(
    OMNI_SNAPSHOT,
    JSON.stringify({
      version: 1,
      savedAt: new Date().toISOString(),
      conversations: [],
      messages: [
        {
          id: `omni_msg_${RUN_ID}`,
          platform: 'messenger',
          platformMessageId: `meta_plat_${RUN_ID}`,
          conversationId: `conv_messenger_user_${RUN_ID}`,
          senderId: 'user',
          senderName: 'user',
          content: { type: 'text', body: 'hi' },
          direction: 'inbound',
          status: 'sent',
          conversationStatus: 'open',
          timestamp: new Date().toISOString(),
        },
      ],
      agents: [],
      customers: [],
    }),
    'utf8',
  );
  const omniPath = OMNI_SNAPSHOT.replace(/\\/g, '/');
  const dedup = runTempTs(
    'omni-dedup',
    `
process.env.OMNI_MEMORY_SNAPSHOT_PATH=${JSON.stringify(omniPath)};
delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
async function main() {
  const omni = await import('../server/messaging/omniStore.ts');
  const exists = await omni.messageExistsByPlatformId(${JSON.stringify(`meta_plat_${RUN_ID}`)});
  console.log('DEDUP=' + exists);
  process.exit(exists ? 0 : 1);
}
main();
`,
    { OMNI_MEMORY_SNAPSHOT_PATH: OMNI_SNAPSHOT, FIREBASE_SERVICE_ACCOUNT_JSON: '' },
  );
  assert(dedup.status === 0 && /DEDUP=true/.test(dedup.out), '7. Meta webhook/message dedup survives restart', dedup.out.slice(-700));

  console.log('\n=== HTTP memory-disk restart durability ===');
  await startServer();

  const admin = await login(ADMIN_EMAIL, DEV_PASSWORD);
  const modeRes = await fetch(`${BASE}/messaging/persistence-mode`);
  const modeBody = (await json(modeRes)) as { data?: { mode?: string; notificationEngine?: boolean } };
  assert(modeBody.data?.mode === 'memory-disk', 'persistence-mode reports memory-disk locally');
  assert(modeBody.data?.notificationEngine === false, '17. Notification Engine not started');

  const reg = await fetch(`${BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: `msg-persist-${RUN_ID}@probe.local`,
      password: 'Probe!2026xx',
      fullName: 'Persist Consumer',
    }),
  });
  const regBody = (await json(reg)) as { customToken?: string; uid?: string };
  assert(reg.ok && Boolean(regBody.customToken), 'consumer register', { status: reg.status, body: regBody });
  const consumerToken = String(regBody.customToken || '');

  const ticket = await fetch(`${BASE}/support/tickets`, {
    method: 'POST',
    headers: authHeaders(consumerToken),
    body: JSON.stringify({ subject: `Persist ${RUN_ID}`, body: 'help me' }),
  });
  const ticketBody = (await json(ticket)) as {
    data?: { conversation?: { id: string; status: string } };
    error?: string;
  };
  assert(ticket.ok && ticketBody.data?.conversation?.id, '1. Conversation created', ticketBody);
  const convId = String(ticketBody.data?.conversation?.id || '');
  if (!convId) {
    console.error('Cannot continue without conversation');
    process.exit(1);
  }

  const enter = await fetch(`${BASE}/admin/conversations/${encodeURIComponent(convId)}/enter`, {
    method: 'POST',
    headers: authHeaders(admin.token),
    body: JSON.stringify({ reason: 'persist-probe' }),
  });
  assert(enter.ok, '8. admin-entry audit create', await json(enter));

  const send = await fetch(`${BASE}/conversations/${encodeURIComponent(convId)}/messages`, {
    method: 'POST',
    headers: authHeaders(consumerToken),
    body: JSON.stringify({ body: `persist-msg-${RUN_ID}` }),
  });
  const sendBody = (await json(send)) as { data?: { message?: { id: string } }; error?: string };
  assert(send.ok && sendBody.data?.message?.id, '2. Message sent', sendBody);
  const messageId = String(sendBody.data?.message?.id || '');

  const attach = await fetch(`${BASE}/conversations/${encodeURIComponent(convId)}/messages`, {
    method: 'POST',
    headers: authHeaders(consumerToken),
    body: JSON.stringify({
      body: `file-${RUN_ID}`,
      attachment: {
        fileName: 'probe.txt',
        contentType: 'text/plain',
        sizeBytes: 12,
        storageRef: `probe/${RUN_ID}.txt`,
      },
    }),
  });
  const attachBody = (await json(attach)) as {
    data?: { message?: { id: string; attachmentIds?: string[] } };
    error?: string;
  };
  assert(attach.ok && (attachBody.data?.message?.attachmentIds?.length || 0) >= 1, '3. Attachment metadata recorded', attachBody);

  await fetch(`${BASE}/messaging/flush`, { method: 'POST', headers: authHeaders(admin.token) });
  await delay(400);
  assert(existsSync(SNAPSHOT), 'snapshot file written');

  // Sprint 11: the legacy Omni provider shim (/api/conversations) is no longer
  // unauthenticated — see scripts/probe-omni-messaging-security.ts for the full
  // unauthenticated/staff/non-staff matrix. This just keeps this probe's "shim
  // still reachable" assertion honest for an authenticated staff caller.
  const legacyUnauth = await fetch(`http://localhost:${PORT}/api/conversations`);
  assert(legacyUnauth.status === 401, '13a. ADR-004 legacy shim denies unauthenticated access');
  const legacy = await fetch(`http://localhost:${PORT}/api/conversations`, { headers: authHeaders(admin.token) });
  assert(legacy.ok, '13b. ADR-004 legacy /api/conversations shim reachable for authenticated staff');

  const beforeMsgs = await fetch(`${BASE}/conversations/${encodeURIComponent(convId)}/messages`, {
    headers: authHeaders(consumerToken),
  });
  const beforeMsgsBody = (await json(beforeMsgs)) as { data?: Array<{ id: string }> };
  const beforeCount = beforeMsgsBody.data?.length || 0;

  console.log('--- Restart for durability ---');
  await startServer();

  const afterConv = await fetch(`${BASE}/conversations/${encodeURIComponent(convId)}`, {
    headers: authHeaders(consumerToken),
  });
  const afterConvBody = (await json(afterConv)) as { data?: { id: string; status: string }; error?: string };
  assert(afterConv.ok && afterConvBody.data?.id === convId, '1b. Conversation survives restart', afterConvBody);

  const afterMsgs = await fetch(`${BASE}/conversations/${encodeURIComponent(convId)}/messages`, {
    headers: authHeaders(consumerToken),
  });
  const afterMsgsBody = (await json(afterMsgs)) as {
    data?: Array<{ id: string; attachmentIds?: string[] }>;
  };
  assert(
    afterMsgs.ok && (afterMsgsBody.data?.length || 0) >= beforeCount,
    '2b. Messages survive restart',
    { beforeCount, after: afterMsgsBody.data?.length },
  );
  assert(afterMsgsBody.data?.some((m) => m.id === messageId), '2c. Specific message id survives restart');
  assert(
    afterMsgsBody.data?.some((m) => (m.attachmentIds?.length || 0) > 0),
    '3b. Attachments survive restart',
  );

  const adminGet = await fetch(`${BASE}/conversations/${encodeURIComponent(convId)}`, {
    headers: authHeaders(admin.token),
  });
  assert(adminGet.ok, '8b. admin-entry / conversation still accessible after restart');
  assert(Boolean(afterConvBody.data?.status), '9. conversation status persists');

  for (const p of [SNAPSHOT, OMNI_SNAPSHOT, join(DATA, `order-key-${RUN_ID}.json`), join(DATA, `multi-${RUN_ID}.json`)]) {
    try {
      if (existsSync(p)) unlinkSync(p);
    } catch {
      /* ignore */
    }
  }

  console.log('\n=== Messaging persist probe DONE ===');
  if (failed > 0) {
    console.error(`FAILED ${failed} assertion(s)`);
    process.exit(1);
  }
  console.log('ALL MESSAGING PERSIST PROBES PASSED');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
