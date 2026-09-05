/**
 * Support-thread discovery/unread regression — Issue 1 fix.
 *
 * Reproduction being fixed: Admin proactively opens/messages a user's
 * Support thread; the user had no way to discover it (GET
 * /support/conversations/active existed but reported no unread signal) until
 * they clicked "Contact Support" themselves, which is what actually created/
 * reused the thread client-side.
 *
 * Proves, end-to-end over real HTTP:
 *  - Admin messaging a user creates/reuses their Support thread (existing
 *    behavior, unaffected).
 *  - GET /support/conversations/active (self-service, the SAME endpoint the
 *    storefront now polls on bootstrap) finds that thread WITHOUT the user
 *    ever calling ensure/create themselves, and reports unreadCount > 0.
 *  - POST /support/conversations/:id/read clears it -- a subsequent active
 *    check reports unreadCount === 0.
 *  - A user reply does NOT count as unread for themselves (only messages
 *    NOT authored by the caller count).
 *
 * Usage: npx tsx scripts/probe-support-unread-discovery.ts
 * Or:    npm run test:support-unread-discovery
 */
import dotenv from 'dotenv';
import { existsSync } from 'fs';

dotenv.config({ path: '.env' });
if (existsSync('.env.local')) dotenv.config({ path: '.env.local', override: true });

const base = process.env.PROBE_BASE_URL || 'http://localhost:3001/api/v1';
const PW = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';
const RID = Date.now();

let failed = 0;
function ok(cond: boolean, label: string, detail?: unknown) {
  if (cond) console.log('PASS', label);
  else {
    failed += 1;
    console.log('FAIL', label, detail === undefined ? '' : JSON.stringify(detail));
  }
}
const j = (r: Response) => r.json().catch(() => ({}));
const H = (t: string) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${t}` });

async function login(email: string) {
  const r = await fetch(`${base}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PW }),
  });
  const b = (await j(r)) as { accessToken?: string; uid?: string };
  if (!r.ok || !b.accessToken) throw new Error(`login ${email}: ${r.status}`);
  return { token: b.accessToken, uid: b.uid as string };
}

async function registerConsumer(email: string) {
  const r = await fetch(`${base}/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Probe!2026xx', fullName: 'Discovery Probe Consumer' }),
  });
  const b = (await j(r)) as { customToken?: string; accessToken?: string; uid?: string };
  const token = b.accessToken || b.customToken;
  if (!r.ok || !token) throw new Error(`register ${email}: ${r.status}`);
  return { token, uid: b.uid as string };
}

async function getActive(token: string) {
  const r = await fetch(`${base}/support/conversations/active`, { headers: H(token) });
  return { status: r.status, body: (await j(r)) as { data?: { conversation?: { id: string }; unreadCount?: number } } };
}

async function main() {
  const admin = await login('admin@choosify.com.bd');
  const consumer = await registerConsumer(`unread-discovery-${RID}@probe.local`);

  // Sanity: brand-new consumer has no active support thread yet.
  const before = await getActive(consumer.token);
  ok(before.status === 404, 'a fresh consumer has no active support thread yet', before);

  // Admin proactively messages this consumer -- the user does NOT call ensure/create themselves.
  const opened = await fetch(`${base}/admin/support/conversations`, {
    method: 'POST', headers: H(admin.token),
    body: JSON.stringify({ targetUserId: consumer.uid, body: 'Hello from Choosify Support!' }),
  });
  const openedBody = (await j(opened)) as { data?: { conversation?: { id: string } } };
  ok(opened.status === 201 || opened.status === 200, 'admin opens the consumer\'s support thread', { status: opened.status });
  const conversationId = openedBody.data?.conversation?.id;
  ok(Boolean(conversationId), 'admin-opened conversation has an id');

  // The consumer discovers it via the self-service "active" check alone.
  const discovered = await getActive(consumer.token);
  ok(discovered.status === 200, 'consumer discovers the admin-created thread via GET .../active (no ensure/create call)', discovered);
  ok(discovered.body.data?.conversation?.id === conversationId, 'discovered conversation is the SAME one admin opened (no duplicate)');
  ok((discovered.body.data?.unreadCount ?? 0) > 0, 'discovered thread reports unreadCount > 0 (admin\'s message unread)', discovered.body.data);

  // Mark read -- subsequent check reports zero.
  const markRead = await fetch(`${base}/support/conversations/${conversationId}/read`, { method: 'POST', headers: H(consumer.token) });
  ok(markRead.ok, 'consumer can mark the thread read', { status: markRead.status });
  const afterRead = await getActive(consumer.token);
  ok((afterRead.body.data?.unreadCount ?? -1) === 0, 'after marking read, unreadCount is 0', afterRead.body.data);

  // The consumer's OWN reply must not count as unread for themselves.
  await fetch(`${base}/support/conversations/${conversationId}/messages`, {
    method: 'POST', headers: H(consumer.token), body: JSON.stringify({ body: 'Thanks, here is my reply.' }),
  });
  const afterOwnReply = await getActive(consumer.token);
  ok((afterOwnReply.body.data?.unreadCount ?? -1) === 0, "the consumer's own reply does not count as unread for themselves", afterOwnReply.body.data);

  // A second admin reply DOES count as unread again.
  await fetch(`${base}/admin/support/conversations`, {
    method: 'POST', headers: H(admin.token),
    body: JSON.stringify({ targetUserId: consumer.uid, body: 'Following up on your reply.' }),
  });
  const afterSecondAdminMsg = await getActive(consumer.token);
  ok((afterSecondAdminMsg.body.data?.unreadCount ?? 0) > 0, 'a second admin message re-flags the thread unread', afterSecondAdminMsg.body.data);

  console.log('\n=== Support unread/discovery probe DONE ===');
  if (failed > 0) {
    console.error(`FAILED ${failed} assertion(s)`);
    process.exit(1);
  }
  console.log('ALL SUPPORT UNREAD/DISCOVERY CHECKS PASSED');
}

main().catch((e) => { console.error(e); process.exit(1); });
