/**
 * Sprint 11 security regression — legacy Omni/Meta provider messaging endpoints
 * (server/messagingHub.ts, mounted at /api) previously had NO authentication at
 * all, serving real dual-written conversation data to any caller. Confirms:
 *   - unauthenticated access is denied (401)
 *   - Admin/Support staff roles are allowed (200)
 *   - Seller/Creator/Consumer roles are denied (403), fail-closed
 *
 * Usage: npx tsx scripts/probe-omni-messaging-security.ts
 * Or:    npm run test:omni-messaging-security
 */
const ROOT = process.env.PROBE_BASE_URL_ROOT || 'http://localhost:3001';
const API = `${ROOT}/api`;
const V1 = `${ROOT}/api/v1`;
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

async function login(email: string, password: string): Promise<string> {
  const res = await fetch(`${V1}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = (await res.json().catch(() => ({}))) as Json;
  if (!res.ok || typeof body.accessToken !== 'string') {
    throw new Error(`login failed for ${email}: ${res.status} ${JSON.stringify(body)}`);
  }
  return body.accessToken as string;
}

const OMNI_ROUTES: Array<{ method: string; path: string; body?: Json }> = [
  { method: 'GET', path: '/conversations' },
  { method: 'GET', path: '/conversations/conv_platform_probe' },
  { method: 'GET', path: '/messages/conv_platform_probe' },
  { method: 'POST', path: '/messages/send', body: { conversationId: 'conv_platform_probe', content: { type: 'text', body: 'probe' } } },
  { method: 'PATCH', path: '/conversation/status', body: { conversationId: 'conv_platform_probe', status: 'open' } },
  { method: 'PATCH', path: '/conversation/assign-agent', body: { conversationId: 'conv_platform_probe', agentId: 'agent_probe' } },
  { method: 'GET', path: '/agents' },
];

async function call(path: string, method: string, token?: string, body?: Json): Promise<{ status: number; body: Json }> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json().catch(() => ({}))) as Json;
  return { status: res.status, body: json };
}

async function main() {
  // --- Unauthenticated: every route must deny (401), never 200 ---
  for (const route of OMNI_ROUTES) {
    const { status } = await call(route.path, route.method, undefined, route.body);
    assert(status === 401, `unauthenticated ${route.method} ${route.path} -> 401`, `got ${status}`);
  }

  // --- Admin (staff): must be allowed (200) ---
  const adminToken = await login('admin@choosify.com.bd', DEV_PASS);

  // Auth is what's under test here, not the omni store's business logic — use a
  // real conversation ID so the routes that require an existing thread don't 404
  // for reasons unrelated to authorization.
  const listRes = await call('/conversations', 'GET', adminToken);
  const realConversationId = ((listRes.body as unknown as Json[]) || [])[0]?.conversationId as string | undefined;
  assert(typeof realConversationId === 'string' && realConversationId.length > 0, 'admin can list at least one real omni conversation for fixture use', listRes.body);

  const adminRoutes = realConversationId
    ? OMNI_ROUTES.map((r) => ({
        ...r,
        path: r.path.replace('conv_platform_probe', realConversationId),
        body: r.body
          ? { ...r.body, conversationId: realConversationId }
          : r.body,
      }))
    : OMNI_ROUTES;

  for (const route of adminRoutes) {
    const { status, body } = await call(route.path, route.method, adminToken, route.body);
    assert(status === 200, `admin ${route.method} ${route.path} -> 200`, `got ${status} ${JSON.stringify(body).slice(0, 150)}`);
  }

  // --- Support agent (staff): must be allowed (200) on read routes ---
  const supportToken = await login('support@choosify.com.bd', DEV_PASS);
  {
    const { status } = await call('/conversations', 'GET', supportToken);
    assert(status === 200, 'support_agent GET /conversations -> 200', `got ${status}`);
  }
  {
    const { status } = await call('/agents', 'GET', supportToken);
    assert(status === 200, 'support_agent GET /agents -> 200', `got ${status}`);
  }

  // --- Finance Manager, Marketing Manager: staff, but have no operational need
  // to read/write raw customer conversation content — must be denied (403), not
  // widened just because they're "staff". Least-privilege, not role-blanket. ---
  const financeToken = await login('finance@choosify.com.bd', DEV_PASS);
  const marketingToken = await login('marketing@choosify.com.bd', DEV_PASS);
  for (const [roleName, token] of [
    ['finance_manager', financeToken],
    ['marketing_manager', marketingToken],
  ] as const) {
    const { status } = await call('/conversations', 'GET', token);
    assert(status === 403, `${roleName} GET /conversations -> 403 (denied, least-privilege)`, `got ${status}`);
    const agentsRes = await call('/agents', 'GET', token);
    assert(agentsRes.status === 403, `${roleName} GET /agents -> 403 (denied, least-privilege)`, `got ${agentsRes.status}`);
  }

  // --- Seller, Creator, Consumer: must be denied (403), fail-closed ---
  const sellerToken = await login('seller@choosify.com.bd', DEV_PASS);
  const creatorToken = await login('creator@choosify.com.bd', DEV_PASS);

  const stamp = Date.now();
  const consumerEmail = `omni-security-consumer-${stamp}@test.choosify.bd`;
  const reg = await fetch(`${V1}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: consumerEmail, password: 'RoleTest!2026', fullName: 'Omni Security Consumer' }),
  });
  if (!reg.ok) throw new Error(`consumer register failed: ${reg.status}`);
  const consumerToken = await login(consumerEmail, 'RoleTest!2026');

  for (const [roleName, token] of [
    ['seller', sellerToken],
    ['creator', creatorToken],
    ['consumer', consumerToken],
  ] as const) {
    for (const route of OMNI_ROUTES) {
      const { status } = await call(route.path, route.method, token, route.body);
      assert(status === 403, `${roleName} ${route.method} ${route.path} -> 403 (denied)`, `got ${status}`);
    }
  }

  console.log('\n=== OMNI MESSAGING SECURITY SUMMARY ===');
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
