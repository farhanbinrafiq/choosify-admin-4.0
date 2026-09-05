/**
 * Confirms the Seller/Creator side of Issue 1 (support-thread discovery +
 * unread badge) was ALREADY working before the storefront fix -- this repo's
 * PartnerSupportInbox.tsx fetches the active support conversation on mount
 * (no "Contact Support" click needed) and NavAttentionContext's
 * /dashboard/nav-attention badge counts ALL of the actor's conversations
 * (via listConversationsForActor), which already includes an admin-opened
 * Support thread. Also checks dual-persona isolation: a Consumer-audience
 * thread and a Seller-audience thread for the SAME account are independent
 * (findActiveSupportConversationForUser is audience-scoped).
 *
 * Usage: npx tsx scripts/probe-support-seller-persona-discovery.ts
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


async function navAttentionMessages(token: string): Promise<number> {
  const r = await fetch(`${base}/dashboard/nav-attention`, { headers: H(token) });
  const b = (await j(r)) as { counts?: Record<string, { count: number }> };
  return b.counts?.messages?.count ?? 0;
}

async function getActive(token: string, audience?: string) {
  const qs = audience ? `?audience=${audience}` : '';
  const r = await fetch(`${base}/support/conversations/active${qs}`, { headers: H(token) });
  return { status: r.status, body: (await j(r)) as { data?: { conversation?: { id: string }; unreadCount?: number } } };
}

async function main() {
  const admin = await login('admin@choosify.com.bd');
  // Direct seller self-registration is disabled (Partner Application + Admin
  // review required) -- use the repo's seeded dev seller account instead.
  const seller = await login('seller@choosify.com.bd');
  console.log('seller uid:', seller.uid);

  // Normalize baseline: mark any pre-existing seller-audience thread read
  // first, since this seeded account is reused across probe runs.
  const preexisting = await getActive(seller.token);
  if (preexisting.status === 200 && preexisting.body.data?.conversation?.id) {
    await fetch(`${base}/support/conversations/${preexisting.body.data.conversation.id}/read`, {
      method: 'POST', headers: H(seller.token),
    });
  }
  const before = await navAttentionMessages(seller.token);

  // Admin proactively opens/messages the seller's Support thread (seller-audience).
  const opened = await fetch(`${base}/admin/support/conversations`, {
    method: 'POST', headers: H(admin.token),
    body: JSON.stringify({ targetUserId: seller.uid, body: 'Hello Seller, following up on your shop.', audience: 'seller' }),
  });
  const openedBody = (await j(opened)) as { data?: { conversation?: { id: string; audience?: string } } };
  ok(opened.status === 201 || opened.status === 200, 'admin opens the seller-audience thread', { status: opened.status, body: openedBody });
  const conversationId = openedBody.data?.conversation?.id;

  // 1) Nav-attention badge reflects it WITHOUT the seller ever calling ensure/create.
  const afterCount = await navAttentionMessages(seller.token);
  ok(afterCount > before, 'seller nav-attention "messages" badge increases after admin message, no click needed', { before, afterCount });

  // 2) PartnerSupportInbox-equivalent proactive fetch (no audience = role default) finds the SAME thread.
  const discovered = await getActive(seller.token);
  ok(discovered.status === 200, 'seller discovers the thread via GET .../active with no audience param (role default)', discovered);
  ok(discovered.body.data?.conversation?.id === conversationId, 'discovered conversation matches the one admin opened (no duplicate)');
  ok((discovered.body.data?.unreadCount ?? 0) > 0, 'discovered seller thread reports unreadCount > 0', discovered.body.data);

  // 3) Dual-persona isolation: this same account's Consumer-audience thread is independent (404, not the seller thread).
  const consumerSide = await getActive(seller.token, 'consumer');
  ok(consumerSide.status === 404, "the SAME account's consumer-persona thread is independent (no cross-persona leakage)", consumerSide);

  // Mark seller thread read, confirm it clears.
  if (conversationId) {
    await fetch(`${base}/support/conversations/${conversationId}/read`, { method: 'POST', headers: H(seller.token) });
    const afterRead = await getActive(seller.token);
    ok((afterRead.body.data?.unreadCount ?? -1) === 0, 'after marking read, seller unreadCount is 0', afterRead.body.data);
    const badgeAfterRead = await navAttentionMessages(seller.token);
    ok(badgeAfterRead === before, 'nav-attention "messages" badge returns to baseline after marking read', { before, badgeAfterRead });
  }

  console.log('\n=== Seller-persona discovery/isolation probe DONE ===');
  if (failed > 0) {
    console.error(`FAILED ${failed} assertion(s)`);
    process.exit(1);
  }
  console.log('ALL SELLER-PERSONA DISCOVERY/ISOLATION CHECKS PASSED');
}

main().catch((e) => { console.error(e); process.exit(1); });
