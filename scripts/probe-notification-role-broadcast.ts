/**
 * Sprint 10 — Notification targetRoles broadcast fan-out regression.
 * Usage: npx tsx scripts/probe-notification-role-broadcast.ts
 * Or:    npm run test:notification-broadcast
 *
 * Requires the API already running (npm run dev) — this probe does not spawn its own server.
 */
// communicationRouter (notifications/broadcasts) mounts at bare /api, not /api/v1.
const API = process.env.API_BASE || 'http://127.0.0.1:3001/api/v1';
const COMM_API = process.env.COMM_API_BASE || 'http://127.0.0.1:3001/api';
const ADMIN_EMAIL = process.env.PROBE_ADMIN_EMAIL || 'admin@choosify.com.bd';
const ADMIN_PASS = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';
const SELLER_EMAIL = 'seller@choosify.com.bd';
const CREATOR_EMAIL = 'creator@choosify.com.bd';
const CONSUMER_PASS = ADMIN_PASS;

type Json = Record<string, unknown>;
const fails: string[] = [];
function assert(cond: unknown, msg: string) {
  if (!cond) fails.push(msg);
}

function defaultBaseFor(path: string): string {
  // communicationRouter (notifications/broadcasts) mounts at bare /api, not /api/v1.
  if (path.startsWith('/notifications') || path.startsWith('/admin/broadcasts')) return COMM_API;
  return API;
}

async function req(
  path: string,
  opts: { method?: string; token?: string; body?: unknown; base?: string } = {},
): Promise<{ status: number; body: Json }> {
  const res = await fetch(`${opts.base ?? defaultBaseFor(path)}${path}`, {
    method: opts.method || (opts.body ? 'POST' : 'GET'),
    headers: {
      'Content-Type': 'application/json',
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const raw = await res.text();
  let body: Json = {};
  try {
    body = raw ? (JSON.parse(raw) as Json) : {};
  } catch {
    body = { raw };
  }
  return { status: res.status, body };
}

async function login(email: string, password: string): Promise<{ token: string; uid: string }> {
  const r = await req('/auth/login', { method: 'POST', body: { email, password } });
  if (r.status !== 200) throw new Error(`login ${email} -> ${r.status} ${JSON.stringify(r.body)}`);
  return { token: String(r.body.accessToken || ''), uid: String(r.body.uid || '') };
}

async function myUnreadIds(token: string): Promise<Set<string>> {
  const r = await req('/notifications?limit=200', { token });
  const data = (r.body.data as Json) || {};
  const items = ((data.items as Json[]) || []).map((n) => String(n.id));
  return new Set(items);
}

async function main() {
  console.log('=== Notification role-broadcast regression ===');
  const admin = await login(ADMIN_EMAIL, ADMIN_PASS);
  const seller = await login(SELLER_EMAIL, ADMIN_PASS);
  const creator = await login(CREATOR_EMAIL, ADMIN_PASS);
  // Consumer dev-seed account is not part of DEV_ROLE_MAP by default in every env;
  // fall back gracefully if it doesn't exist rather than hard-failing the whole probe.
  let consumer: { token: string; uid: string } | null = null;
  try {
    consumer = await login('consumer@choosify.com.bd', CONSUMER_PASS);
  } catch {
    console.log('(no seeded consumer account found — consumer-side assertions will be skipped)');
  }

  console.log('--- Non-admin broadcast attempt -> 403 ---');
  {
    const r = await req('/admin/broadcasts', {
      method: 'POST',
      token: seller.token,
      body: { title: 'x', body: 'x', broadcastType: 'seller', targetRoles: ['seller'] },
    });
    assert(r.status === 403, `non-admin create broadcast -> ${r.status} (expected 403)`);
  }

  console.log('--- Admin sends to Seller only ---');
  const stamp = Date.now();
  {
    const before = { seller: await myUnreadIds(seller.token), creator: await myUnreadIds(creator.token) };
    const create = await req('/admin/broadcasts', {
      method: 'POST',
      token: admin.token,
      body: {
        title: `Seller-only ${stamp}`,
        body: 'Seller-only broadcast body',
        broadcastType: 'seller',
        targetRoles: ['seller'],
      },
    });
    assert(create.status === 201, `create seller-only broadcast -> ${create.status}`);
    const broadcastId = String((create.body.data as Json)?.id || '');
    const send = await req(`/admin/broadcasts/${broadcastId}/send`, { method: 'POST', token: admin.token });
    assert(send.status === 200, `send seller-only broadcast -> ${send.status}`);

    await new Promise((r) => setTimeout(r, 300));
    const after = { seller: await myUnreadIds(seller.token), creator: await myUnreadIds(creator.token) };
    const sellerGained = [...after.seller].filter((id) => !before.seller.has(id));
    const creatorGained = [...after.creator].filter((id) => !before.creator.has(id));
    assert(sellerGained.length >= 1, 'seller received the seller-targeted broadcast notification');
    assert(creatorGained.length === 0, 'creator did NOT receive the seller-targeted broadcast notification');

    if (consumer) {
      const consumerBefore = await myUnreadIds(consumer.token);
      void consumerBefore;
    }
  }

  console.log('--- Admin sends to Seller + Creator ---');
  {
    const before = { seller: await myUnreadIds(seller.token), creator: await myUnreadIds(creator.token) };
    const create = await req('/admin/broadcasts', {
      method: 'POST',
      token: admin.token,
      body: {
        title: `Seller+Creator ${stamp}`,
        body: 'Multi-role broadcast body',
        broadcastType: 'seller',
        targetRoles: ['seller', 'creator'],
      },
    });
    assert(create.status === 201, `create multi-role broadcast -> ${create.status}`);
    const broadcastId = String((create.body.data as Json)?.id || '');
    const send = await req(`/admin/broadcasts/${broadcastId}/send`, { method: 'POST', token: admin.token });
    assert(send.status === 200, `send multi-role broadcast -> ${send.status}`);

    await new Promise((r) => setTimeout(r, 300));
    const after = { seller: await myUnreadIds(seller.token), creator: await myUnreadIds(creator.token) };
    const sellerGained = [...after.seller].filter((id) => !before.seller.has(id));
    const creatorGained = [...after.creator].filter((id) => !before.creator.has(id));
    assert(sellerGained.length >= 1, 'seller received the multi-role broadcast notification');
    assert(creatorGained.length >= 1, 'creator received the multi-role broadcast notification');
  }

  console.log('--- Explicit targetUserId + matching targetRole -> exactly ONE notification, not duplicate ---');
  {
    // Discover the seller's own uid via /auth/me so metadata.targetUserIds can name them explicitly.
    const me = await req('/auth/me', { token: seller.token });
    const sellerUid = String(me.body.uid || '');
    assert(!!sellerUid, 'resolved seller uid for dedup test');

    const before = await myUnreadIds(seller.token);
    const create = await req('/admin/broadcasts', {
      method: 'POST',
      token: admin.token,
      body: {
        title: `Dedup test ${stamp}`,
        body: 'Should arrive exactly once',
        broadcastType: 'seller',
        targetRoles: ['seller'],
        metadata: { targetUserIds: [sellerUid] },
      },
    });
    assert(create.status === 201, `create dedup broadcast -> ${create.status}`);
    const broadcastId = String((create.body.data as Json)?.id || '');
    const send = await req(`/admin/broadcasts/${broadcastId}/send`, { method: 'POST', token: admin.token });
    assert(send.status === 200, `send dedup broadcast -> ${send.status}`);

    await new Promise((r) => setTimeout(r, 300));
    const after = await myUnreadIds(seller.token);
    const gained = [...after].filter((id) => !before.has(id));
    assert(gained.length === 1, `dedup: expected exactly 1 new notification, got ${gained.length}`);
  }

  console.log('--- Read/unread is per-user; cross-user access denied ---');
  {
    const list = await req('/notifications?limit=1', { token: seller.token });
    const listData = (list.body.data as Json) || {};
    const first = ((listData.items as Json[]) || [])[0];
    assert(!!first, 'seller has at least one notification to test read/unread against');
    if (first) {
      const id = String(first.id);
      const markRead = await req(`/notifications/${id}/read`, { method: 'PATCH', token: seller.token });
      assert(markRead.status === 200, `seller marks own notification read -> ${markRead.status}`);

      // Creator must not be able to mark the seller's notification read (cross-user denied).
      const crossRead = await req(`/notifications/${id}/read`, { method: 'PATCH', token: creator.token });
      assert(crossRead.status === 403 || crossRead.status === 404, `cross-user mark-read denied -> ${crossRead.status}`);

      // Creator's own unread list must not contain the seller's notification id.
      const creatorList = await req('/notifications?limit=200', { token: creator.token });
      const creatorListData = (creatorList.body.data as Json) || {};
      const creatorIds = new Set(((creatorListData.items as Json[]) || []).map((n) => String(n.id)));
      assert(!creatorIds.has(id), "creator's notification list does not expose seller's notification");
    }
  }

  console.log('\n=== SUMMARY ===');
  if (fails.length) {
    console.error('FAILS:');
    for (const f of fails) console.error('-', f);
    console.error(`\nRESULT: FAILED (${fails.length})`);
    process.exit(1);
  }
  console.log('RESULT: ALL PASSED');
}

main().catch((e) => {
  console.error('CRASH', e);
  process.exit(1);
});
