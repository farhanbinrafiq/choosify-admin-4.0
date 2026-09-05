/**
 * Persona-routing UAT — in-process only (no live HTTP / no seeded DB user
 * needed).
 *
 * Proves the Habibur Rahman fix: a single dual-capability account (one row,
 * role='seller') gets TWO separate, correctly-routed, non-leaking support
 * conversations depending on which persona is addressed — without any
 * client-supplied role/persona being honoured outside the explicit,
 * allowlist-validated override.
 *
 * `openAdminSupportConversation` itself requires a real DB-backed target
 * user (resolveSupportTargetUser queries the `users` table), so the full
 * admin-route flow is covered live in scripts/probe-support-entry.ts style
 * HTTP tests against seeded dev accounts. Here we prove the two things that
 * don't need a DB row at all:
 *   (a) the allowlist/escalation guard in conversationPermissions.ts
 *       (allowedAudiencesForTarget / resolveSelfServiceSupportAudience) —
 *       pure functions, tested directly.
 *   (b) the audience-scoped reconcile-key + non-leak/idempotent-reuse
 *       mechanics in conversationService.ts, exercised via
 *       ensureActiveSupportConversation's own `audience` override, which
 *       funnels into the exact same activeSupportReconcileKey /
 *       findActiveSupportConversationForUser code the admin route uses.
 *
 * Usage: npx tsx scripts/probe-support-persona.ts
 */
import dotenv from 'dotenv';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';

dotenv.config({ path: '.env' });
if (existsSync('.env.local')) dotenv.config({ path: '.env.local', override: true });

const SNAPSHOT = join(process.cwd(), '.data', `support-persona-probe-${Date.now()}.json`);
process.env.MESSAGING_MEMORY_SNAPSHOT_PATH = SNAPSHOT;

const { ensureActiveSupportConversation, findActiveSupportConversationForUser } = await import(
  '../server/messaging/conversations/conversationService'
);
const { allowedAudiencesForTarget, resolveSelfServiceSupportAudience, parseSupportAudience } =
  await import('../server/messaging/conversations/conversationPermissions');

let failed = 0;
function assert(condition: boolean, label: string, detail?: unknown) {
  if (condition) console.log('PASS', label);
  else {
    failed += 1;
    console.log('FAIL', label, detail ?? '');
  }
}

function runAllowlist() {
  console.log('\n=== Allowlist / escalation guard (pure functions) ===');
  assert(
    JSON.stringify(allowedAudiencesForTarget('seller')) === JSON.stringify(['consumer', 'seller']),
    'Seller target: admin may address consumer or seller only',
  );
  assert(
    JSON.stringify(allowedAudiencesForTarget('creator')) === JSON.stringify(['consumer', 'creator']),
    'Creator target: admin may address consumer or creator only',
  );
  assert(
    JSON.stringify(allowedAudiencesForTarget('user')) === JSON.stringify(['consumer']),
    'Plain Consumer target: admin may address consumer only',
  );
  assert(parseSupportAudience('seller') === 'seller', 'parseSupportAudience accepts an allowlisted value');
  assert(parseSupportAudience('root') === null, 'parseSupportAudience rejects a non-allowlisted value');
  assert(parseSupportAudience(undefined) === null, 'parseSupportAudience rejects undefined');

  assert(
    resolveSelfServiceSupportAudience({ userId: 'u1', role: 'seller' }, 'consumer') === 'consumer',
    'self-service: consumer override always honoured regardless of current role',
  );
  assert(
    resolveSelfServiceSupportAudience({ userId: 'u1', role: 'user' }, 'seller') === 'consumer',
    'self-service: a plain Consumer cannot self-claim the seller persona (falls back to role-derived)',
  );
  assert(
    resolveSelfServiceSupportAudience({ userId: 'u1', role: 'seller' }, 'seller') === 'seller',
    'self-service: a real Seller confirming "seller" is honoured (no escalation, just a no-op match)',
  );
  assert(
    resolveSelfServiceSupportAudience({ userId: 'u1', role: 'seller' }, undefined) === 'seller',
    'self-service: omitted audience preserves the existing role-derived behaviour',
  );
}

async function runIsolation() {
  console.log('\n=== Audience-scoped reconcile-key isolation (in-process) ===');
  const habiburId = 'habibur_dual_probe';

  // Habibur's account is role='seller' — his Seller-persona thread, opened
  // the same way the Seller dashboard Support tab does today (no override).
  const sellerThread = await ensureActiveSupportConversation({
    actor: { userId: habiburId, role: 'seller' },
    subject: 'Seller support',
    body: 'Payout question',
  });
  assert(sellerThread.created, 'seller-persona thread created');

  // The storefront Consumer Messages surface reaches him via the fixed
  // audience:'consumer' override — this is what an Admin's explicit Consumer
  // pick, or Habibur's own storefront visit, both funnel into.
  const consumerThread = await ensureActiveSupportConversation({
    actor: { userId: habiburId, role: 'seller' },
    audience: 'consumer',
    body: 'Where is my order?',
  });
  assert(consumerThread.created, 'consumer-persona thread is a NEW conversation');
  assert(
    consumerThread.conversation.id !== sellerThread.conversation.id,
    'consumer-persona thread is NOT the seller-persona thread (no leak/merge)',
    { consumerId: consumerThread.conversation.id, sellerId: sellerThread.conversation.id },
  );
  assert(consumerThread.ticket.audience === 'consumer', 'consumer thread ticket is tagged audience=consumer');
  assert(sellerThread.ticket.audience === 'seller', 'seller thread ticket is tagged audience=seller');

  // Reopening either persona reuses its own thread (idempotent, matches the
  // pre-existing per-role idempotency probe-support-entry.ts already proves).
  const consumerAgain = await ensureActiveSupportConversation({
    actor: { userId: habiburId, role: 'seller' },
    audience: 'consumer',
  });
  assert(
    consumerAgain.created === false && consumerAgain.conversation.id === consumerThread.conversation.id,
    'reopening consumer persona reuses the same thread',
  );
  const sellerAgain = await ensureActiveSupportConversation({
    actor: { userId: habiburId, role: 'seller' },
  });
  assert(
    sellerAgain.created === false && sellerAgain.conversation.id === sellerThread.conversation.id,
    'reopening with no override still reuses the seller-persona thread (backward compatible)',
  );

  // No cross-persona bleed at the lookup layer either.
  const creatorLookup = await findActiveSupportConversationForUser(habiburId, 'creator');
  assert(creatorLookup === null, 'no creator-persona thread exists for this seller/consumer-only account');

  // A plain Consumer account cannot self-claim the seller persona end-to-end
  // (not just at the pure-function layer above).
  const plainConsumerThread = await ensureActiveSupportConversation({
    actor: { userId: 'plain_consumer_probe', role: 'user' },
    audience: 'seller',
  });
  assert(
    plainConsumerThread.ticket.audience === 'consumer',
    'a plain Consumer account cannot self-claim the seller persona end-to-end',
    { audience: plainConsumerThread.ticket.audience },
  );
}

try {
  runAllowlist();
  await runIsolation();
} finally {
  if (existsSync(SNAPSHOT)) {
    try {
      unlinkSync(SNAPSHOT);
    } catch {
      /* ignore */
    }
  }
}

console.log('\n=== Persona-routing probe DONE ===');
if (failed > 0) {
  console.error(`FAILED ${failed} assertion(s)`);
  process.exit(1);
}
console.log('ALL PERSONA-ROUTING PROBES PASSED');
