/**
 * Sprint 12 — Subscription lifecycle services. Every mutation to
 * `subscriptions` goes through this module (and nowhere else — Phase 6
 * payment code must call activateInitialSubscription/renewSubscription
 * rather than writing to the table itself). Cancellation-at-period-end and
 * the "never auto-remove/delete on downgrade" policy are enforced here;
 * upgrade/downgrade proration is explicitly NOT decided yet, so
 * requestPlanChange returns a controlled blocked result instead of
 * guessing financial behavior.
 */
import { and, eq, inArray, lt, isNotNull } from 'drizzle-orm';
import { db } from '../db/client';
import {
  subscriptions,
  subscriptionEvents,
  subscriptionPayments,
  subscriptionBillingDocuments,
  planVersionOffers,
  planVersions,
  plans,
  workspaces,
} from '../db/schema';
import { auditLog, AUDIT_CATEGORIES } from '../logging/auditLogger';
import { allocateReferenceId } from '../referenceIds/referenceIdService';
import { workspaceService } from './workspaceService';
import {
  OPEN_SUBSCRIPTION_STATUSES,
  type ResolvedSubscriptionPlan,
  type Subscription,
  type SubscriptionEvent,
  type WorkspaceType,
} from './types';

export class SubscriptionServiceError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function toSubscription(row: typeof subscriptions.$inferSelect): Subscription {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    planVersionOfferId: row.planVersionOfferId,
    pendingPlanVersionOfferId: row.pendingPlanVersionOfferId,
    status: row.status,
    startDate: row.startDate.toISOString(),
    currentPeriodStart: row.currentPeriodStart.toISOString(),
    currentPeriodEnd: row.currentPeriodEnd ? row.currentPeriodEnd.toISOString() : null,
    cancelAtPeriodEnd: row.cancelAtPeriodEnd,
    cancelledAt: row.cancelledAt ? row.cancelledAt.toISOString() : null,
    trialEndsAt: row.trialEndsAt ? row.trialEndsAt.toISOString() : null,
    grantedManually: row.grantedManually,
    grantedByUserId: row.grantedByUserId,
    grantedReason: row.grantedReason,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toEvent(row: typeof subscriptionEvents.$inferSelect): SubscriptionEvent {
  return {
    id: row.id,
    subscriptionId: row.subscriptionId,
    eventType: row.eventType,
    fromPlanVersionOfferId: row.fromPlanVersionOfferId,
    toPlanVersionOfferId: row.toPlanVersionOfferId,
    actorUserId: row.actorUserId,
    reason: row.reason,
    metadata: row.metadata,
    createdAt: row.createdAt.toISOString(),
  };
}

function addInterval(date: Date, interval: 'monthly' | 'annual'): Date {
  const d = new Date(date);
  if (interval === 'monthly') d.setMonth(d.getMonth() + 1);
  else d.setFullYear(d.getFullYear() + 1);
  return d;
}

async function getOfferWithPlan(offerId: string) {
  const rows = await db
    .select({ offer: planVersionOffers, version: planVersions, plan: plans })
    .from(planVersionOffers)
    .innerJoin(planVersions, eq(planVersionOffers.planVersionId, planVersions.id))
    .innerJoin(plans, eq(planVersions.planId, plans.id))
    .where(eq(planVersionOffers.id, offerId))
    .limit(1);
  return rows[0] ?? null;
}

async function assertPersonaMatch(workspaceType: WorkspaceType, offerId: string): Promise<void> {
  const found = await getOfferWithPlan(offerId);
  if (!found) throw new SubscriptionServiceError('Plan version offer not found', 404);
  if (found.plan.role !== workspaceType) {
    throw new SubscriptionServiceError(
      `Persona mismatch: this offer belongs to a ${found.plan.role} plan, but the workspace is ${workspaceType}.`,
      403,
    );
  }
}

/**
 * Phase 3C correction: upgrade vs downgrade is NEVER inferred from price
 * (or from sortOrder, or from anything else) — price is commercial pricing,
 * not a reliable hierarchy (breaks under monthly-vs-annual, discounts,
 * repricing, differently-priced-but-equivalent Plans, equal prices). V1
 * makes the two operations explicit — the CLIENT states which one it wants
 * (requestUpgrade / requestDowngrade) and the server validates only that
 * the target is real, correctly-personaed, published, and genuinely
 * DIFFERENT from the current offer — never which "direction" it is.
 */
async function assertTargetOfferValid(currentOfferId: string, targetOfferId: string): Promise<Awaited<ReturnType<typeof getOfferWithPlan>>> {
  const target = await getOfferWithPlan(targetOfferId);
  if (!target) throw new SubscriptionServiceError('Target plan version offer not found', 404);
  if (target.plan.lifecycleState !== 'published') {
    throw new SubscriptionServiceError('Target Plan is not currently published.', 400);
  }
  if (targetOfferId === currentOfferId) {
    throw new SubscriptionServiceError('Target offer is the same as the current offer — not a Plan change.', 400);
  }
  return target;
}

export const subscriptionService = {
  /** null = no open subscription (never fabricated as "active on a default plan"). */
  getCurrentSubscription: async (workspaceId: string): Promise<ResolvedSubscriptionPlan | null> => {
    return workspaceService.getResolvedOpenSubscription(workspaceId);
  },

  getSubscriptionHistory: async (workspaceId: string): Promise<{ subscriptions: Subscription[]; events: SubscriptionEvent[] }> => {
    const subRows = await db.select().from(subscriptions).where(eq(subscriptions.workspaceId, workspaceId));
    const subIds = subRows.map((s) => s.id);
    const eventRows = subIds.length
      ? await db.select().from(subscriptionEvents).where(inArray(subscriptionEvents.subscriptionId, subIds))
      : [];
    return {
      subscriptions: subRows.map(toSubscription).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      events: eventRows.map(toEvent).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    };
  },

  /**
   * Super Admin manual grant. Creates a subscription + lifecycle event and
   * NOTHING ELSE — no subscription_payments row, no billing document, so
   * Monetization Center's revenue derivation naturally counts this as ৳0
   * (it only sums succeeded payments) without any special-case filter.
   */
  manualGrant: async (input: {
    workspaceId: string;
    planVersionOfferId: string;
    actorUserId: string;
    reason: string;
    startDate?: Date;
    endDate?: Date | null;
  }): Promise<Subscription> => {
    if (!input.reason?.trim()) throw new SubscriptionServiceError('A reason is required for a manual grant.');
    const workspace = await workspaceService.getWorkspace(input.workspaceId);
    if (!workspace) throw new SubscriptionServiceError('Workspace not found', 404);
    await assertPersonaMatch(workspace.type, input.planVersionOfferId);

    const existing = await workspaceService.getResolvedOpenSubscription(input.workspaceId);
    if (existing) {
      throw new SubscriptionServiceError(
        'This Workspace already has an open subscription. Cancel or let it expire before granting a new one.',
        409,
      );
    }

    const startDate = input.startDate ?? new Date();
    const [created] = await db
      .insert(subscriptions)
      .values({
        workspaceId: input.workspaceId,
        planVersionOfferId: input.planVersionOfferId,
        status: 'active',
        startDate,
        currentPeriodStart: startDate,
        currentPeriodEnd: input.endDate ?? null,
        grantedManually: true,
        grantedByUserId: input.actorUserId,
        grantedReason: input.reason.trim(),
      })
      .returning();

    await db.insert(subscriptionEvents).values({
      subscriptionId: created.id,
      eventType: 'manually_granted',
      toPlanVersionOfferId: input.planVersionOfferId,
      actorUserId: input.actorUserId,
      reason: input.reason.trim(),
    });

    auditLog({
      category: AUDIT_CATEGORIES.ADMIN_ACTION,
      action: 'subscription.manual_grant',
      resource: 'subscription',
      resourceId: created.id,
      result: 'success',
      userId: input.actorUserId,
      metadata: { workspaceId: input.workspaceId, planVersionOfferId: input.planVersionOfferId, reason: input.reason, endDate: input.endDate ?? null },
    });

    return toSubscription(created);
  },

  /**
   * Locked policy: cancellation is always cancel-at-period-end. Entitlement
   * is not revoked immediately. CANCELLATION + PENDING DOWNGRADE
   * interaction (locked): cancellation wins — a pending downgrade is
   * cleared in the same update, since we should not retain a future
   * Plan-change intention after the user has explicitly chosen to end the
   * subscription.
   */
  requestCancellation: async (workspaceId: string, actorUserId: string): Promise<Subscription> => {
    const resolved = await workspaceService.getResolvedOpenSubscription(workspaceId);
    if (!resolved) throw new SubscriptionServiceError('No open subscription for this Workspace', 404);
    if (resolved.subscription.cancelAtPeriodEnd && !resolved.subscription.pendingPlanVersionOfferId) return resolved.subscription;

    const hadPendingDowngrade = resolved.subscription.pendingPlanVersionOfferId;
    await db
      .update(subscriptions)
      .set({ cancelAtPeriodEnd: true, pendingPlanVersionOfferId: null, updatedAt: new Date() })
      .where(eq(subscriptions.id, resolved.subscription.id));
    await db.insert(subscriptionEvents).values({
      subscriptionId: resolved.subscription.id,
      eventType: 'cancellation_requested',
      actorUserId,
      metadata: hadPendingDowngrade ? { clearedPendingDowngrade: hadPendingDowngrade } : undefined,
    });
    if (hadPendingDowngrade) {
      await db.insert(subscriptionEvents).values({
        subscriptionId: resolved.subscription.id,
        eventType: 'downgrade_cancelled',
        toPlanVersionOfferId: hadPendingDowngrade,
        actorUserId,
        reason: 'Superseded by full subscription cancellation',
      });
    }
    auditLog({
      category: AUDIT_CATEGORIES.ADMIN_ACTION,
      action: 'subscription.cancellation_requested',
      resource: 'subscription',
      resourceId: resolved.subscription.id,
      result: 'success',
      userId: actorUserId,
      metadata: { workspaceId, clearedPendingDowngrade: hadPendingDowngrade ?? null },
    });

    const rows = await db.select().from(subscriptions).where(eq(subscriptions.id, resolved.subscription.id)).limit(1);
    return toSubscription(rows[0]);
  },

  /**
   * Expiry sweep — idempotent (only selects subscriptions still in an OPEN
   * status with a passed current_period_end; once transitioned, a rerun
   * won't reselect the same row). Never deletes any business data —
   * downstream product/order/team data is untouched; only this Workspace's
   * effective plan access stops (resolveFeatureEnabled/resolvePlanLimit will
   * simply find no open subscription afterward). Local/test invocation only
   * — no cron is wired in this phase.
   */
  processExpirations: async (now: Date = new Date()): Promise<{ expiredCount: number; cancelledCount: number; ids: string[] }> => {
    const candidates = await db
      .select()
      .from(subscriptions)
      .where(and(inArray(subscriptions.status, OPEN_SUBSCRIPTION_STATUSES), isNotNull(subscriptions.currentPeriodEnd), lt(subscriptions.currentPeriodEnd, now)));

    let expiredCount = 0;
    let cancelledCount = 0;
    const ids: string[] = [];
    for (const row of candidates) {
      const nextStatus = row.cancelAtPeriodEnd ? 'cancelled' : 'expired';
      await db
        .update(subscriptions)
        .set({ status: nextStatus, cancelledAt: nextStatus === 'cancelled' ? now : row.cancelledAt, updatedAt: now })
        .where(eq(subscriptions.id, row.id));
      await db.insert(subscriptionEvents).values({
        subscriptionId: row.id,
        eventType: nextStatus === 'cancelled' ? 'cancelled' : 'expired',
        actorUserId: null, // system-driven — never fabricated as a human action
        reason: nextStatus === 'cancelled' ? 'cancel_at_period_end reached at expiry sweep' : 'current_period_end passed with no renewal',
        // pending_plan_version_offer_id is deliberately NOT cleared here — a pending downgrade
        // is never auto-activated (no automatic charge exists), but the intent must survive
        // this closure so the later "pay for the pending target" flow knows what was requested.
        metadata: row.pendingPlanVersionOfferId ? { pendingPlanVersionOfferId: row.pendingPlanVersionOfferId } : undefined,
      });
      auditLog({
        category: AUDIT_CATEGORIES.SYSTEM_EVENT,
        action: nextStatus === 'cancelled' ? 'subscription.cancelled' : 'subscription.expired',
        resource: 'subscription',
        resourceId: row.id,
        result: 'success',
        metadata: { workspaceId: row.workspaceId },
      });
      ids.push(row.id);
      if (nextStatus === 'cancelled') cancelledCount++;
      else expiredCount++;
    }
    return { expiredCount, cancelledCount, ids };
  },

  /**
   * Phase 6 payment integration point: called ONLY after SSLCommerz
   * validateTransaction() has confirmed success. Never mutates
   * subscription tables from payment code directly.
   */
  activateInitialSubscription: async (input: {
    workspaceId: string;
    planVersionOfferId: string;
    subscriptionPaymentId?: string;
  }): Promise<Subscription> => {
    const workspace = await workspaceService.getWorkspace(input.workspaceId);
    if (!workspace) throw new SubscriptionServiceError('Workspace not found', 404);
    await assertPersonaMatch(workspace.type, input.planVersionOfferId);

    const existing = await workspaceService.getResolvedOpenSubscription(input.workspaceId);
    if (existing) {
      throw new SubscriptionServiceError('This Workspace already has an open subscription.', 409);
    }

    const offerRow = await getOfferWithPlan(input.planVersionOfferId);
    if (!offerRow) throw new SubscriptionServiceError('Plan version offer not found', 404);

    const now = new Date();
    const periodEnd = addInterval(now, offerRow.offer.billingInterval);
    const [created] = await db
      .insert(subscriptions)
      .values({
        workspaceId: input.workspaceId,
        planVersionOfferId: input.planVersionOfferId,
        status: 'active',
        startDate: now,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      })
      .returning();

    await db.insert(subscriptionEvents).values({
      subscriptionId: created.id,
      eventType: 'subscribed',
      toPlanVersionOfferId: input.planVersionOfferId,
      metadata: input.subscriptionPaymentId ? { subscriptionPaymentId: input.subscriptionPaymentId } : undefined,
    });

    auditLog({
      category: AUDIT_CATEGORIES.SYSTEM_EVENT,
      action: 'subscription.subscribed',
      resource: 'subscription',
      resourceId: created.id,
      result: 'success',
      metadata: { workspaceId: input.workspaceId, planVersionOfferId: input.planVersionOfferId },
    });

    return toSubscription(created);
  },

  /**
   * Phase 6 payment integration point for a manual renewal payment. Same
   * offer, next period. Interpretation choice (reporting per the ask):
   * renewing on the CURRENT offer as-is is an affirmative "keep this plan"
   * action, so any stale pending downgrade is cleared here too — same
   * rationale as upgrade/cancellation superseding it. If the workspace
   * actually wants to move to the pending target, that happens through
   * activatePendingDowngrade, not this function.
   */
  renewSubscription: async (input: { subscriptionId: string; subscriptionPaymentId?: string }): Promise<Subscription> => {
    const rows = await db.select().from(subscriptions).where(eq(subscriptions.id, input.subscriptionId)).limit(1);
    const sub = rows[0];
    if (!sub) throw new SubscriptionServiceError('Subscription not found', 404);
    const offerRow = await getOfferWithPlan(sub.planVersionOfferId);
    if (!offerRow) throw new SubscriptionServiceError('Plan version offer not found', 404);

    const now = new Date();
    const periodStart = sub.currentPeriodEnd && sub.currentPeriodEnd > now ? sub.currentPeriodEnd : now;
    const periodEnd = addInterval(periodStart, offerRow.offer.billingInterval);

    await db
      .update(subscriptions)
      .set({ status: 'active', currentPeriodStart: periodStart, currentPeriodEnd: periodEnd, cancelAtPeriodEnd: false, pendingPlanVersionOfferId: null, updatedAt: now })
      .where(eq(subscriptions.id, sub.id));
    if (sub.pendingPlanVersionOfferId) {
      await db.insert(subscriptionEvents).values({
        subscriptionId: sub.id,
        eventType: 'downgrade_cancelled',
        toPlanVersionOfferId: sub.pendingPlanVersionOfferId,
        reason: 'Superseded by renewing on the current Plan',
      });
    }
    await db.insert(subscriptionEvents).values({
      subscriptionId: sub.id,
      eventType: 'renewed',
      fromPlanVersionOfferId: sub.planVersionOfferId,
      toPlanVersionOfferId: sub.planVersionOfferId,
      metadata: input.subscriptionPaymentId ? { subscriptionPaymentId: input.subscriptionPaymentId } : undefined,
    });
    auditLog({
      category: AUDIT_CATEGORIES.SYSTEM_EVENT,
      action: 'subscription.renewed',
      resource: 'subscription',
      resourceId: sub.id,
      result: 'success',
    });

    const updated = await db.select().from(subscriptions).where(eq(subscriptions.id, sub.id)).limit(1);
    return toSubscription(updated[0]);
  },

  /**
   * Upgrade REQUEST — validates only, never mutates. The client states the
   * intent (this is explicitly an upgrade); the server validates the target
   * is real, published, correctly-personaed, and different from the
   * current offer — it does NOT infer direction from price. Returns the
   * canonical amount Phase 6 must charge in full (no proration/credit).
   * Activation only ever happens via activateUpgrade() after a validated
   * successful payment.
   */
  requestUpgrade: async (input: {
    subscriptionId: string;
    toPlanVersionOfferId: string;
    actorUserId: string;
  }): Promise<{ applied: false; status: 'upgrade_quote'; targetOfferId: string; amountDue: number; currency: string; note: string }> => {
    const rows = await db.select().from(subscriptions).where(eq(subscriptions.id, input.subscriptionId)).limit(1);
    const sub = rows[0];
    if (!sub) throw new SubscriptionServiceError('Subscription not found', 404);
    if (!OPEN_SUBSCRIPTION_STATUSES.includes(sub.status)) {
      throw new SubscriptionServiceError('Subscription is not open — cannot change plan.', 409);
    }
    const workspace = await workspaceService.getWorkspace(sub.workspaceId);
    if (!workspace) throw new SubscriptionServiceError('Workspace not found', 404);
    await assertPersonaMatch(workspace.type, input.toPlanVersionOfferId);
    const target = await assertTargetOfferValid(sub.planVersionOfferId, input.toPlanVersionOfferId);

    auditLog({
      category: AUDIT_CATEGORIES.ADMIN_ACTION,
      action: 'subscription.upgrade_requested',
      resource: 'subscription',
      resourceId: sub.id,
      result: 'success',
      userId: input.actorUserId,
      metadata: { toPlanVersionOfferId: input.toPlanVersionOfferId },
    });
    return {
      applied: false,
      status: 'upgrade_quote',
      targetOfferId: input.toPlanVersionOfferId,
      amountDue: target!.offer.price,
      currency: target!.offer.currency,
      note: 'Full price is charged immediately upon successful payment. No proration, credit, or refund for unused time on the current Plan.',
    };
  },

  /**
   * Downgrade REQUEST — locked V1 policy. Never touches the current offer,
   * entitlements, or limits; only records the pending target for activation
   * at period end (and only once actually paid for — see
   * activatePendingDowngrade below). If a pending downgrade already exists,
   * this safely REPLACES it with the newly requested target — still one
   * canonical pending pointer, full auditability via a fresh
   * downgrade_requested event either way.
   */
  requestDowngrade: async (input: {
    subscriptionId: string;
    toPlanVersionOfferId: string;
    actorUserId: string;
  }): Promise<Subscription> => {
    const rows = await db.select().from(subscriptions).where(eq(subscriptions.id, input.subscriptionId)).limit(1);
    const sub = rows[0];
    if (!sub) throw new SubscriptionServiceError('Subscription not found', 404);
    if (!OPEN_SUBSCRIPTION_STATUSES.includes(sub.status)) {
      throw new SubscriptionServiceError('Subscription is not open — cannot change plan.', 409);
    }
    const workspace = await workspaceService.getWorkspace(sub.workspaceId);
    if (!workspace) throw new SubscriptionServiceError('Workspace not found', 404);
    await assertPersonaMatch(workspace.type, input.toPlanVersionOfferId);
    await assertTargetOfferValid(sub.planVersionOfferId, input.toPlanVersionOfferId);

    await db
      .update(subscriptions)
      .set({ pendingPlanVersionOfferId: input.toPlanVersionOfferId, updatedAt: new Date() })
      .where(eq(subscriptions.id, sub.id));
    await db.insert(subscriptionEvents).values({
      subscriptionId: sub.id,
      eventType: 'downgrade_requested',
      fromPlanVersionOfferId: sub.planVersionOfferId,
      toPlanVersionOfferId: input.toPlanVersionOfferId,
      actorUserId: input.actorUserId,
    });
    auditLog({
      category: AUDIT_CATEGORIES.ADMIN_ACTION,
      action: 'subscription.downgrade_requested',
      resource: 'subscription',
      resourceId: sub.id,
      result: 'success',
      userId: input.actorUserId,
      metadata: {
        fromPlanVersionOfferId: sub.planVersionOfferId,
        toPlanVersionOfferId: input.toPlanVersionOfferId,
        replacedPending: sub.pendingPlanVersionOfferId ?? null,
      },
    });

    const updated = await db.select().from(subscriptions).where(eq(subscriptions.id, sub.id)).limit(1);
    return toSubscription(updated[0]);
  },

  /** Cancels a pending downgrade only — the current active Plan/entitlements/limits are entirely untouched (nothing about them ever changed in the first place). No payment/revenue effects. */
  cancelPendingDowngrade: async (subscriptionId: string, actorUserId: string): Promise<Subscription> => {
    const rows = await db.select().from(subscriptions).where(eq(subscriptions.id, subscriptionId)).limit(1);
    const sub = rows[0];
    if (!sub) throw new SubscriptionServiceError('Subscription not found', 404);
    if (!sub.pendingPlanVersionOfferId) {
      throw new SubscriptionServiceError('No pending downgrade to cancel.', 404);
    }
    const clearedTarget = sub.pendingPlanVersionOfferId;

    await db.update(subscriptions).set({ pendingPlanVersionOfferId: null, updatedAt: new Date() }).where(eq(subscriptions.id, sub.id));
    await db.insert(subscriptionEvents).values({
      subscriptionId: sub.id,
      eventType: 'downgrade_cancelled',
      toPlanVersionOfferId: clearedTarget,
      actorUserId,
    });
    auditLog({
      category: AUDIT_CATEGORIES.ADMIN_ACTION,
      action: 'subscription.downgrade_cancelled',
      resource: 'subscription',
      resourceId: sub.id,
      result: 'success',
      userId: actorUserId,
      metadata: { clearedPendingPlanVersionOfferId: clearedTarget },
    });

    const updated = await db.select().from(subscriptions).where(eq(subscriptions.id, sub.id)).limit(1);
    return toSubscription(updated[0]);
  },

  /**
   * LATER DOWNGRADE PAYMENT — called once Phase 6 receives a validated
   * successful payment for a workspace's pending target. Requires the
   * subscription to already be CLOSED (expired/cancelled) — paying for a
   * pending downgrade EARLY, while the current period is still open, is not
   * a supported V1 flow (that would raise an unresolved
   * forfeit-remaining-time question this project has explicitly deferred).
   * Reuses the SAME canonical subscription row (reactivates it in place —
   * the same pattern renewSubscription already relies on for a closed
   * same-offer renewal) rather than creating a second row, so history
   * never fragments across two subscription ids for one continuous
   * commercial relationship.
   */
  activatePendingDowngrade: async (input: { workspaceId: string; subscriptionPaymentId: string }): Promise<Subscription> => {
    const closedWithPending = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.workspaceId, input.workspaceId));
    const candidate = closedWithPending
      .filter((s) => !OPEN_SUBSCRIPTION_STATUSES.includes(s.status) && s.pendingPlanVersionOfferId)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
    if (!candidate) {
      throw new SubscriptionServiceError('No closed subscription with a pending downgrade target found for this Workspace.', 404);
    }

    const pendingOfferId = candidate.pendingPlanVersionOfferId!;
    const offerRow = await getOfferWithPlan(pendingOfferId);
    if (!offerRow) throw new SubscriptionServiceError('Pending target plan version offer not found', 404);
    if (offerRow.plan.lifecycleState !== 'published') {
      throw new SubscriptionServiceError('The pending target Plan is no longer published — it cannot be activated as-is.', 409);
    }

    const now = new Date();
    const periodEnd = addInterval(now, offerRow.offer.billingInterval);
    const fromOfferId = candidate.planVersionOfferId;

    await db
      .update(subscriptions)
      .set({
        planVersionOfferId: pendingOfferId,
        pendingPlanVersionOfferId: null,
        status: 'active',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
        cancelledAt: null,
        updatedAt: now,
      })
      .where(eq(subscriptions.id, candidate.id));

    await db.insert(subscriptionEvents).values({
      subscriptionId: candidate.id,
      eventType: 'downgraded',
      fromPlanVersionOfferId: fromOfferId,
      toPlanVersionOfferId: pendingOfferId,
      metadata: { subscriptionPaymentId: input.subscriptionPaymentId },
    });

    await subscriptionService.issueBillingDocumentForPayment({
      subscriptionPaymentId: input.subscriptionPaymentId,
      workspaceId: input.workspaceId,
      periodStart: now,
      periodEnd,
    });

    auditLog({
      category: AUDIT_CATEGORIES.SYSTEM_EVENT,
      action: 'subscription.downgraded',
      resource: 'subscription',
      resourceId: candidate.id,
      result: 'success',
      metadata: { fromPlanVersionOfferId: fromOfferId, toPlanVersionOfferId: pendingOfferId },
    });

    const updated = await db.select().from(subscriptions).where(eq(subscriptions.id, candidate.id)).limit(1);
    return toSubscription(updated[0]);
  },

  /**
   * Records a successful payment (Phase 6's job to call this once
   * SSLCommerz validateTransaction() confirms success) and issues the
   * matching billing document. Never called from anywhere but the
   * activation functions below and future Phase 6 payment code — payment
   * code must never mutate `subscriptions` directly.
   */
  recordSuccessfulPayment: async (input: {
    workspaceId: string;
    subscriptionId: string | null;
    planVersionOfferId: string;
    purpose: 'initial' | 'renewal' | 'upgrade' | 'downgrade' | 'manual_adjustment';
    amount: number;
    currency: string;
    provider?: string;
    providerTranId?: string;
    providerValId?: string;
    idempotencyKey: string;
  }): Promise<{ id: string }> => {
    const [created] = await db
      .insert(subscriptionPayments)
      .values({
        workspaceId: input.workspaceId,
        subscriptionId: input.subscriptionId,
        planVersionOfferId: input.planVersionOfferId,
        purpose: input.purpose,
        amount: input.amount,
        currency: input.currency,
        provider: input.provider || 'sslcommerz',
        providerTranId: input.providerTranId,
        providerValId: input.providerValId,
        result: 'succeeded',
        idempotencyKey: input.idempotencyKey,
      })
      .returning();
    return { id: created.id };
  },

  /** Issues a billing document for an already-succeeded payment, using the subscription's CURRENT period (call AFTER the state mutation, not before). */
  issueBillingDocumentForPayment: async (input: { subscriptionPaymentId: string; workspaceId: string; periodStart: Date; periodEnd: Date | null }): Promise<{ id: string; referenceId: string }> => {
    const paymentRows = await db.select().from(subscriptionPayments).where(eq(subscriptionPayments.id, input.subscriptionPaymentId)).limit(1);
    const payment = paymentRows[0];
    if (!payment) throw new SubscriptionServiceError('Subscription payment not found', 404);
    const referenceId = await allocateReferenceId('subscriptionInvoice');
    const [created] = await db
      .insert(subscriptionBillingDocuments)
      .values({
        subscriptionPaymentId: input.subscriptionPaymentId,
        workspaceId: input.workspaceId,
        referenceId,
        amount: payment.amount,
        currency: payment.currency,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
      })
      .returning();
    return { id: created.id, referenceId: created.referenceId };
  },

  /**
   * Upgrade ACTIVATION — called only after a validated successful payment
   * (recordSuccessfulPayment above). Never reachable from a bare client
   * request. Per the locked V1 policy: new billing period starts NOW (full
   * price, no proration); cancel_at_period_end resets to false (an upgrade
   * is an affirmative "keep going, on a bigger plan" action — see report for
   * rationale); any previously-pending downgrade is cleared (superseded —
   * it was scheduled against a period that no longer exists once upgraded).
   */
  activateUpgrade: async (input: {
    subscriptionId: string;
    toPlanVersionOfferId: string;
    subscriptionPaymentId: string;
    actorUserId?: string;
  }): Promise<Subscription> => {
    const rows = await db.select().from(subscriptions).where(eq(subscriptions.id, input.subscriptionId)).limit(1);
    const sub = rows[0];
    if (!sub) throw new SubscriptionServiceError('Subscription not found', 404);
    if (!OPEN_SUBSCRIPTION_STATUSES.includes(sub.status)) {
      throw new SubscriptionServiceError('Subscription is not open — cannot activate an upgrade.', 409);
    }
    const workspace = await workspaceService.getWorkspace(sub.workspaceId);
    if (!workspace) throw new SubscriptionServiceError('Workspace not found', 404);
    await assertPersonaMatch(workspace.type, input.toPlanVersionOfferId);
    // Re-validate the target is real/published/different (defense-in-depth — never trust
    // that the caller re-passed exactly what requestUpgrade quoted).
    const toOfferRow = await assertTargetOfferValid(sub.planVersionOfferId, input.toPlanVersionOfferId);

    const now = new Date();
    const periodEnd = addInterval(now, toOfferRow!.offer.billingInterval);
    const fromOfferId = sub.planVersionOfferId;

    // UPGRADE + PENDING DOWNGRADE interaction (locked): successful upgrade wins — any
    // previously-pending downgrade is cleared in this SAME update, since it was scheduled
    // against a period that no longer exists once upgraded onto new paid terms.
    await db
      .update(subscriptions)
      .set({
        planVersionOfferId: input.toPlanVersionOfferId,
        pendingPlanVersionOfferId: null,
        status: 'active',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
        updatedAt: now,
      })
      .where(eq(subscriptions.id, sub.id));

    if (sub.pendingPlanVersionOfferId) {
      await db.insert(subscriptionEvents).values({
        subscriptionId: sub.id,
        eventType: 'downgrade_cancelled',
        toPlanVersionOfferId: sub.pendingPlanVersionOfferId,
        actorUserId: input.actorUserId,
        reason: 'Superseded by a completed upgrade',
      });
    }

    await db.insert(subscriptionEvents).values({
      subscriptionId: sub.id,
      eventType: 'upgraded',
      fromPlanVersionOfferId: fromOfferId,
      toPlanVersionOfferId: input.toPlanVersionOfferId,
      actorUserId: input.actorUserId,
      metadata: { subscriptionPaymentId: input.subscriptionPaymentId },
    });

    await subscriptionService.issueBillingDocumentForPayment({
      subscriptionPaymentId: input.subscriptionPaymentId,
      workspaceId: sub.workspaceId,
      periodStart: now,
      periodEnd,
    });

    auditLog({
      category: AUDIT_CATEGORIES.SYSTEM_EVENT,
      action: 'subscription.upgraded',
      resource: 'subscription',
      resourceId: sub.id,
      result: 'success',
      userId: input.actorUserId,
      metadata: { fromPlanVersionOfferId: fromOfferId, toPlanVersionOfferId: input.toPlanVersionOfferId },
    });

    const updated = await db.select().from(subscriptions).where(eq(subscriptions.id, sub.id)).limit(1);
    return toSubscription(updated[0]);
  },

  /**
   * Super Admin replaces/changes an existing MANUAL grant (item "MANUAL
   * GRANTS" in the Phase 3C spec). Deliberately separate from customer
   * upgrade/downgrade: no payment, no billing document, no revenue —
   * exactly a second explicit authorized Admin action with its own
   * reason/actor/event, same as the original grant.
   */
  replaceManualGrant: async (input: {
    subscriptionId: string;
    toPlanVersionOfferId: string;
    actorUserId: string;
    reason: string;
  }): Promise<Subscription> => {
    if (!input.reason?.trim()) throw new SubscriptionServiceError('A reason is required to change a manual grant.');
    const rows = await db.select().from(subscriptions).where(eq(subscriptions.id, input.subscriptionId)).limit(1);
    const sub = rows[0];
    if (!sub) throw new SubscriptionServiceError('Subscription not found', 404);
    if (!sub.grantedManually) throw new SubscriptionServiceError('This subscription was not a manual grant — use the customer upgrade/downgrade path instead.', 400);
    if (!OPEN_SUBSCRIPTION_STATUSES.includes(sub.status)) {
      throw new SubscriptionServiceError('Subscription is not open.', 409);
    }
    const workspace = await workspaceService.getWorkspace(sub.workspaceId);
    if (!workspace) throw new SubscriptionServiceError('Workspace not found', 404);
    await assertPersonaMatch(workspace.type, input.toPlanVersionOfferId);

    const fromOfferId = sub.planVersionOfferId;
    await db
      .update(subscriptions)
      .set({
        planVersionOfferId: input.toPlanVersionOfferId,
        pendingPlanVersionOfferId: null, // an explicit Admin re-grant supersedes any stale customer-requested pending downgrade
        grantedReason: input.reason.trim(),
        grantedByUserId: input.actorUserId,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, sub.id));

    await db.insert(subscriptionEvents).values({
      subscriptionId: sub.id,
      eventType: 'manually_granted',
      fromPlanVersionOfferId: fromOfferId,
      toPlanVersionOfferId: input.toPlanVersionOfferId,
      actorUserId: input.actorUserId,
      reason: input.reason.trim(),
    });

    auditLog({
      category: AUDIT_CATEGORIES.ADMIN_ACTION,
      action: 'subscription.manual_grant_replaced',
      resource: 'subscription',
      resourceId: sub.id,
      result: 'success',
      userId: input.actorUserId,
      metadata: { fromPlanVersionOfferId: fromOfferId, toPlanVersionOfferId: input.toPlanVersionOfferId, reason: input.reason },
    });

    const updated = await db.select().from(subscriptions).where(eq(subscriptions.id, sub.id)).limit(1);
    return toSubscription(updated[0]);
  },
};
