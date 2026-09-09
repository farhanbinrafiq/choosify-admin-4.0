import { eq, like } from 'drizzle-orm';
import { db } from '../server/db/client';
import { plans, planVersions, subscriptions, subscriptionEvents, subscriptionPayments, subscriptionBillingDocuments, workspaces, users } from '../server/db/schema';

async function main() {
  const sellerUser = (await db.select().from(users).where(eq(users.email, 'seller@choosify.com.bd')).limit(1))[0];
  const creatorUser = (await db.select().from(users).where(eq(users.email, 'creator@choosify.com.bd')).limit(1))[0];
  for (const u of [sellerUser, creatorUser]) {
    if (!u) continue;
    const ws = (await db.select().from(workspaces).where(eq(workspaces.ownerUserId, u.id)))[0];
    if (!ws) continue;
    const pays = await db.select().from(subscriptionPayments).where(eq(subscriptionPayments.workspaceId, ws.id));
    for (const p of pays) await db.delete(subscriptionBillingDocuments).where(eq(subscriptionBillingDocuments.subscriptionPaymentId, p.id));
    await db.delete(subscriptionPayments).where(eq(subscriptionPayments.workspaceId, ws.id));
    const subs = await db.select().from(subscriptions).where(eq(subscriptions.workspaceId, ws.id));
    for (const s of subs) await db.delete(subscriptionEvents).where(eq(subscriptionEvents.subscriptionId, s.id));
    await db.delete(subscriptions).where(eq(subscriptions.workspaceId, ws.id));
  }

  const qaPlans = await db.select().from(plans).where(like(plans.name, 'QA5%'));
  for (const p of qaPlans) {
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
  console.log('Removed plans:', qaPlans.map((p) => p.name));
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
