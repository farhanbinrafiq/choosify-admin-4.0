/** One-off cleanup for leftover PROBE data from a crashed probe run. Local dev DB only. */
import { eq, like } from 'drizzle-orm';
import { db } from '../server/db/client';
import {
  workspaces,
  subscriptions,
  subscriptionEvents,
  subscriptionPayments,
  subscriptionBillingDocuments,
  plans,
  planVersions,
} from '../server/db/schema';

async function main() {
  const dbUrl = process.env.DATABASE_URL || '';
  if (!dbUrl.includes('127.0.0.1') && !dbUrl.includes('localhost')) {
    console.error('REFUSING: not a local database.');
    process.exit(1);
  }

  const leftoverPlans = await db.select().from(plans).where(like(plans.name, 'PROBE%'));
  console.log('Leftover PROBE plans:', leftoverPlans.map((p) => p.name));

  const sellerWs = await db.select().from(workspaces).where(eq(workspaces.type, 'seller')).limit(2);
  const creatorWs = await db.select().from(workspaces).where(eq(workspaces.type, 'creator')).limit(1);
  for (const ws of [...sellerWs, ...creatorWs]) {
    const pays = await db.select().from(subscriptionPayments).where(eq(subscriptionPayments.workspaceId, ws.id));
    for (const p of pays) await db.delete(subscriptionBillingDocuments).where(eq(subscriptionBillingDocuments.subscriptionPaymentId, p.id));
    await db.delete(subscriptionPayments).where(eq(subscriptionPayments.workspaceId, ws.id));
    const subs = await db.select().from(subscriptions).where(eq(subscriptions.workspaceId, ws.id));
    for (const s of subs) await db.delete(subscriptionEvents).where(eq(subscriptionEvents.subscriptionId, s.id));
    await db.delete(subscriptions).where(eq(subscriptions.workspaceId, ws.id));
  }

  for (const p of leftoverPlans) {
    const versions = await db.select().from(planVersions).where(eq(planVersions.planId, p.id));
    await db.update(plans).set({ currentPublishedVersionId: null }).where(eq(plans.id, p.id));
    for (const v of versions) {
      await db.execute(`delete from plan_entitlements where plan_version_id = '${v.id}'`);
      await db.execute(`delete from plan_limits where plan_version_id = '${v.id}'`);
      await db.execute(`delete from plan_version_offers where plan_version_id = '${v.id}'`);
    }
    await db.delete(planVersions).where(eq(planVersions.planId, p.id));
    await db.delete(plans).where(eq(plans.id, p.id));
  }

  const remaining = await db.select().from(plans).where(like(plans.name, 'PROBE%'));
  console.log('Remaining PROBE plans (should be empty):', remaining.map((p) => p.name));
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
