/**
 * Sprint 12, Phase 7 — Monetization Center. An AGGREGATION/INTELLIGENCE
 * LAYER only — this file creates no new financial ledger. Every number it
 * returns is derived, at read time, from tables/collections that already
 * have an independent authoritative owner:
 *
 *   Subscription Revenue  -> subscription_payments (Postgres, Phase 6)
 *                             SUM(amount) WHERE result = 'succeeded'
 *   Commerce Commission   -> escrow "commerce_settlements" (memory/Firestore)
 *                             SUM(commissionAmount) — CommerceSettlement is
 *                             already the canonical commission source; this
 *                             file never recomputes commission from plan
 *                             prices or order totals.
 *   GMV                   -> escrow "commerce_escrows" SUM(capturedAmount)
 *                             (the immutable gross allocation captured at
 *                             PaymentCaptured time — escrow's own doc
 *                             comment). NOT netted for later refunds in this
 *                             phase (see Phase 7 report — a definitional
 *                             choice, not a bug).
 *   Seller Net            -> escrow "commerce_settlements" SUM(sellerNetAmount)
 *   Platform Revenue      -> Commission Revenue + Subscription Revenue
 *                             (an explicit, documented SUM of the two
 *                             existing revenue components — never GMV, never
 *                             a third invented number).
 *
 * Scope note (disclosed in the Phase 7 report, not silently decided): the
 * OLDER Ops storefront order book (server/operations/*, JSON-snapshot,
 * powers the existing AdminHomeDashboard "GMV/Revenue" widget via
 * /operations/analytics) is a SEPARATE, pre-existing order system from the
 * Commerce module (cart/checkout/escrow/settlement) that Phase 7's own
 * instructions name as canonical (CommerceSettlement). Reconciling the two
 * into one unified platform GMV is exactly the kind of cross-system
 * reconciliation this task defers — Monetization Center's GMV/Commission/
 * Seller Net are scoped to the Commerce module only, matching the LOCKED
 * rules given. Flagged for a later phase, not silently merged.
 *
 * No client input is ever trusted for a value — only for WHICH rows to
 * read (date range, persona, plan, interval, payment status, source).
 *
 * DISCOVERED ENVIRONMENT ISSUE (disclosed in the Phase 7 report; Phase 8
 * extracted the fix into server/lib/dbTimestampDrift.ts so Finance shares
 * it instead of duplicating it — see that file for the full root-cause
 * writeup): this Postgres instance's session timezone is not UTC, and
 * naive `timestamp` columns like subscription_payments.created_at get
 * misread by Drizzle as if they were UTC. This service self-calibrates the
 * actual drift at read time (via the shared helper) and compensates ONLY
 * for its own date-range queries — not a global fix.
 */
import { and, eq, gte, lte, inArray } from 'drizzle-orm';
import { db } from '../db/client';
import { toDbComparableRange, getDbTimestampDriftMs } from '../lib/dbTimestampDrift';
import {
  subscriptionPayments,
  subscriptions,
  subscriptionEvents,
  workspaces,
  planVersionOffers,
  planVersions,
  plans,
} from '../db/schema';
import { escrowStore } from '../escrow/escrowStore';
import { toMinor } from '../escrow/money';
import type { WorkspaceType } from '../subscriptions/types';

export type MonetizationSource = 'all' | 'commerce' | 'subscriptions';
export type MonetizationPersona = 'all' | WorkspaceType;
export type MonetizationPaymentStatus = 'all' | 'succeeded' | 'pending' | 'failed' | 'cancelled';

export type MonetizationFilters = {
  from: Date;
  to: Date;
  source?: MonetizationSource;
  persona?: MonetizationPersona;
  planId?: string;
  planVersionId?: string;
  billingInterval?: 'monthly' | 'annual';
  /** Filters the payment-status BREAKDOWN counts only — never changes what counts as revenue (Part 9 lock: only 'succeeded' is ever revenue). */
  paymentStatus?: MonetizationPaymentStatus;
};

function normalizeFilters(f: Partial<MonetizationFilters> & { from: Date; to: Date }): Required<Pick<MonetizationFilters, 'from' | 'to' | 'source' | 'persona' | 'paymentStatus'>> & MonetizationFilters {
  return {
    from: f.from,
    to: f.to,
    source: f.source ?? 'all',
    persona: f.persona ?? 'all',
    paymentStatus: f.paymentStatus ?? 'all',
    planId: f.planId,
    planVersionId: f.planVersionId,
    billingInterval: f.billingInterval,
  };
}

/** Joined subscription-payment rows for the given filters — the single query every subscription metric below reads from, so no two cards can silently disagree on scope. */
async function selectSubscriptionPaymentRows(f: ReturnType<typeof normalizeFilters>) {
  const { from: dbFrom, to: dbTo } = await toDbComparableRange(f.from, f.to);
  const conditions = [gte(subscriptionPayments.createdAt, dbFrom), lte(subscriptionPayments.createdAt, dbTo)];
  if (f.persona !== 'all') conditions.push(eq(workspaces.type, f.persona));
  if (f.planId) conditions.push(eq(plans.id, f.planId));
  if (f.planVersionId) conditions.push(eq(planVersions.id, f.planVersionId));
  if (f.billingInterval) conditions.push(eq(planVersionOffers.billingInterval, f.billingInterval));

  return db
    .select({
      payment: subscriptionPayments,
      workspaceType: workspaces.type,
      planId: plans.id,
      planName: plans.name,
      planVersionId: planVersions.id,
      planVersion: planVersions.version,
      billingInterval: planVersionOffers.billingInterval,
    })
    .from(subscriptionPayments)
    .innerJoin(workspaces, eq(subscriptionPayments.workspaceId, workspaces.id))
    .innerJoin(planVersionOffers, eq(subscriptionPayments.planVersionOfferId, planVersionOffers.id))
    .innerJoin(planVersions, eq(planVersionOffers.planVersionId, planVersions.id))
    .innerJoin(plans, eq(planVersions.planId, plans.id))
    .where(and(...conditions));
}

async function computeSubscriptionRevenue(f: ReturnType<typeof normalizeFilters>): Promise<{ totalMinorUnits: number; currency: string; paymentCount: number }> {
  const rows = await selectSubscriptionPaymentRows(f);
  const succeeded = rows.filter((r) => r.payment.result === 'succeeded');
  const totalMinorUnits = succeeded.reduce((sum, r) => sum + r.payment.amount, 0);
  return { totalMinorUnits, currency: succeeded[0]?.payment.currency || 'BDT', paymentCount: succeeded.length };
}

function toIso(d: Date): string {
  return d.toISOString();
}

async function computeCommerceMetrics(f: ReturnType<typeof normalizeFilters>): Promise<{ gmvMinorUnits: number; commissionMinorUnits: number; sellerNetMinorUnits: number; currency: string; settlementCount: number; escrowCount: number }> {
  const [settlements, escrows] = await Promise.all([
    escrowStore.listSettlementsInRange(toIso(f.from), toIso(f.to)),
    escrowStore.listEscrowsInRange(toIso(f.from), toIso(f.to)),
  ]);
  // Escrow/Settlement amounts are stored in MAJOR units (see server/escrow/money.ts convention,
  // unlike subscription_payments' minor-unit integers) — convert EACH row to minor units before
  // summing (toMinor, not a bulk float sum × 100) to avoid float drift across many rows, then this
  // service's outputs are consistently minor units throughout, matching Phase 6's convention.
  const gmvMinorUnits = escrows.reduce((sum, e) => sum + toMinor(e.capturedAmount), 0);
  const commissionMinorUnits = settlements.reduce((sum, s) => sum + toMinor(s.commissionAmount), 0);
  const sellerNetMinorUnits = settlements.reduce((sum, s) => sum + toMinor(s.sellerNetAmount), 0);
  const currency = settlements[0]?.currency || escrows[0]?.currency || 'BDT';
  return { gmvMinorUnits, commissionMinorUnits, sellerNetMinorUnits, currency, settlementCount: settlements.length, escrowCount: escrows.length };
}

export type MonetizationSummary = {
  from: string;
  to: string;
  currency: string;
  /** null = excluded by the 'source' filter (never conflated with a genuine ৳0). */
  platformRevenue: number | null;
  gmv: number | null;
  commissionRevenue: number | null;
  subscriptionRevenue: number | null;
  sellerNet: number | null;
};

export const monetizationService = {
  /** Documents the derivation of every field for future audits (Part 24). Not a UI response shape — a developer/ops reference. */
  metricDictionary: {
    subscriptionRevenue: { table: 'subscription_payments', field: 'amount', filter: "result = 'succeeded'", formula: 'SUM(amount)' },
    commissionRevenue: { table: 'commerce_settlements (escrow module)', field: 'commissionAmount', filter: 'createdAt in range', formula: 'SUM(commissionAmount)' },
    gmv: { table: 'commerce_escrows (escrow module)', field: 'capturedAmount', filter: 'createdAt in range', formula: 'SUM(capturedAmount)' },
    sellerNet: { table: 'commerce_settlements (escrow module)', field: 'sellerNetAmount', filter: 'createdAt in range', formula: 'SUM(sellerNetAmount)' },
    platformRevenue: { table: '(derived)', field: 'n/a', filter: 'n/a', formula: 'commissionRevenue + subscriptionRevenue' },
  },

  async getSummary(input: MonetizationFilters): Promise<MonetizationSummary> {
    const f = normalizeFilters(input);
    const includeSubscriptions = f.source !== 'commerce';
    const includeCommerce = f.source !== 'subscriptions';

    const [subRevenue, commerce] = await Promise.all([
      includeSubscriptions ? computeSubscriptionRevenue(f) : null,
      includeCommerce ? computeCommerceMetrics(f) : null,
    ]);

    const subscriptionRevenue = subRevenue ? subRevenue.totalMinorUnits : null;
    const commissionRevenue = commerce ? commerce.commissionMinorUnits : null;
    const gmv = commerce ? commerce.gmvMinorUnits : null;
    const sellerNet = commerce ? commerce.sellerNetMinorUnits : null;
    const platformRevenue = subscriptionRevenue === null && commissionRevenue === null ? null : (subscriptionRevenue ?? 0) + (commissionRevenue ?? 0);
    const currency = subRevenue?.currency || commerce?.currency || 'BDT';

    return { from: toIso(f.from), to: toIso(f.to), currency, platformRevenue, gmv, commissionRevenue, subscriptionRevenue, sellerNet };
  },

  async getRevenueBreakdown(input: MonetizationFilters): Promise<{ currency: string; commerceCommission: number | null; subscriptionRevenue: number | null; platformRevenue: number | null }> {
    const summary = await this.getSummary(input);
    return { currency: summary.currency, commerceCommission: summary.commissionRevenue, subscriptionRevenue: summary.subscriptionRevenue, platformRevenue: summary.platformRevenue };
  },

  async getSubscriptionMetrics(input: MonetizationFilters): Promise<{
    currency: string;
    activePaidSubscriptions: number;
    sellerRevenue: number;
    creatorRevenue: number;
    byPlan: Array<{ planId: string; planName: string; planVersionId: string; planVersion: number; billingInterval: string; revenue: number; count: number }>;
    byInterval: { monthly: number; annual: number };
    paymentCounts: { succeeded: number; pending: number; failed: number; cancelled: number };
    renewals: number;
    expirations: number;
    cancellations: number;
  }> {
    const f = normalizeFilters(input);
    const rows = await selectSubscriptionPaymentRows(f);
    const succeeded = rows.filter((r) => r.payment.result === 'succeeded');

    const sellerRevenue = succeeded.filter((r) => r.workspaceType === 'seller').reduce((s, r) => s + r.payment.amount, 0);
    const creatorRevenue = succeeded.filter((r) => r.workspaceType === 'creator').reduce((s, r) => s + r.payment.amount, 0);

    const byPlanMap = new Map<string, { planId: string; planName: string; planVersionId: string; planVersion: number; billingInterval: string; revenue: number; count: number }>();
    for (const r of succeeded) {
      // Keyed by the actual purchased Plan VERSION (Part 13/26 grandfathering lock) — never
      // collapsed to the bare planId, so a v1 payment never gets attributed to v2's identity.
      const key = `${r.planVersionId}:${r.billingInterval}`;
      const existing = byPlanMap.get(key);
      if (existing) {
        existing.revenue += r.payment.amount;
        existing.count += 1;
      } else {
        byPlanMap.set(key, { planId: r.planId, planName: r.planName, planVersionId: r.planVersionId, planVersion: r.planVersion, billingInterval: r.billingInterval, revenue: r.payment.amount, count: 1 });
      }
    }

    const byInterval = {
      monthly: succeeded.filter((r) => r.billingInterval === 'monthly').reduce((s, r) => s + r.payment.amount, 0),
      annual: succeeded.filter((r) => r.billingInterval === 'annual').reduce((s, r) => s + r.payment.amount, 0),
    };

    // Payment-status breakdown honors the paymentStatus filter (Part 9) — a display lens over
    // the same in-range rows, never a second source and never influencing the revenue above.
    const statusRows = f.paymentStatus === 'all' ? rows : rows.filter((r) => r.payment.result === f.paymentStatus);
    const paymentCounts = {
      succeeded: statusRows.filter((r) => r.payment.result === 'succeeded').length,
      pending: statusRows.filter((r) => r.payment.result === 'pending').length,
      failed: statusRows.filter((r) => r.payment.result === 'failed').length,
      cancelled: statusRows.filter((r) => r.payment.result === 'cancelled').length,
    };

    // Active paid subscriptions: an OPEN subscription that has at least one succeeded payment
    // (excludes pure manual grants, which create zero payment rows — Part 2/18 lock) as of "to".
    const openStatuses = ['trial', 'active', 'past_due', 'grace_period'] as const;
    const wsConditions = f.persona !== 'all' ? [eq(workspaces.type, f.persona)] : [];
    const openSubRows = await db
      .select({ subscriptionId: subscriptions.id })
      .from(subscriptions)
      .innerJoin(workspaces, eq(subscriptions.workspaceId, workspaces.id))
      .where(and(inArray(subscriptions.status, [...openStatuses]), eq(subscriptions.grantedManually, false), ...wsConditions));
    const openIds = new Set(openSubRows.map((r) => r.subscriptionId));
    const paidSubIdsWithPayment = new Set(
      (await db.select({ subscriptionId: subscriptionPayments.subscriptionId }).from(subscriptionPayments).where(eq(subscriptionPayments.result, 'succeeded')))
        .map((r) => r.subscriptionId)
        .filter((id): id is string => !!id),
    );
    const activePaidSubscriptions = [...openIds].filter((id) => paidSubIdsWithPayment.has(id)).length;

    // Lifecycle counts from the append-only event log, scoped by the same date range/persona.
    const { from: dbEventFrom, to: dbEventTo } = await toDbComparableRange(f.from, f.to);
    const eventConditions = [gte(subscriptionEvents.createdAt, dbEventFrom), lte(subscriptionEvents.createdAt, dbEventTo)];
    const eventRows = await db
      .select({ eventType: subscriptionEvents.eventType, workspaceType: workspaces.type })
      .from(subscriptionEvents)
      .innerJoin(subscriptions, eq(subscriptionEvents.subscriptionId, subscriptions.id))
      .innerJoin(workspaces, eq(subscriptions.workspaceId, workspaces.id))
      .where(and(...eventConditions, ...(f.persona !== 'all' ? [eq(workspaces.type, f.persona)] : [])));
    const renewals = eventRows.filter((r) => r.eventType === 'renewed').length;
    const expirations = eventRows.filter((r) => r.eventType === 'expired').length;
    const cancellations = eventRows.filter((r) => r.eventType === 'cancelled').length;

    return {
      currency: succeeded[0]?.payment.currency || 'BDT',
      activePaidSubscriptions,
      sellerRevenue,
      creatorRevenue,
      byPlan: [...byPlanMap.values()].sort((a, b) => b.revenue - a.revenue),
      byInterval,
      paymentCounts,
      renewals,
      expirations,
      cancellations,
    };
  },

  async getCommissionMetrics(input: MonetizationFilters): Promise<{ currency: string; totalCommission: number; settlementCount: number }> {
    const f = normalizeFilters(input);
    const commerce = await computeCommerceMetrics(f);
    return { currency: commerce.currency, totalCommission: commerce.commissionMinorUnits, settlementCount: commerce.settlementCount };
  },

  async getGmvMetrics(input: MonetizationFilters): Promise<{ currency: string; totalGmv: number; escrowCount: number }> {
    const f = normalizeFilters(input);
    const commerce = await computeCommerceMetrics(f);
    return { currency: commerce.currency, totalGmv: commerce.gmvMinorUnits, escrowCount: commerce.escrowCount };
  },

  /**
   * Real time-series aggregation over actual transaction dates — never
   * placeholder points or a generated growth curve. Bucketed daily when the
   * range is <= 92 days, monthly otherwise, so a "This year" query returns a
   * readable number of points instead of 365 near-empty days.
   */
  async getRevenueTrend(input: MonetizationFilters): Promise<{ currency: string; granularity: 'day' | 'month'; points: Array<{ date: string; subscriptionRevenue: number; commissionRevenue: number; gmv: number; platformRevenue: number }> }> {
    const f = normalizeFilters(input);
    const spanDays = (f.to.getTime() - f.from.getTime()) / 86_400_000;
    const granularity: 'day' | 'month' = spanDays <= 92 ? 'day' : 'month';
    const bucketKey = (d: Date) => (granularity === 'day' ? d.toISOString().slice(0, 10) : d.toISOString().slice(0, 7));

    const includeSubscriptions = f.source !== 'commerce';
    const includeCommerce = f.source !== 'subscriptions';

    const buckets = new Map<string, { subscriptionRevenue: number; commissionRevenue: number; gmv: number }>();
    const touch = (key: string) => {
      if (!buckets.has(key)) buckets.set(key, { subscriptionRevenue: 0, commissionRevenue: 0, gmv: 0 });
      return buckets.get(key)!;
    };

    if (includeSubscriptions) {
      const rows = await selectSubscriptionPaymentRows(f);
      const driftMs = await getDbTimestampDriftMs();
      for (const r of rows) {
        if (r.payment.result !== 'succeeded') continue;
        // Undo the same read-side mislabeling toDbComparableRange() compensates for on the way
        // in, so a payment's trend bucket reflects the day/month it was actually made on.
        const key = bucketKey(new Date(r.payment.createdAt.getTime() - driftMs));
        touch(key).subscriptionRevenue += r.payment.amount;
      }
    }
    let currency = 'BDT';
    if (includeCommerce) {
      const [settlements, escrows] = await Promise.all([
        escrowStore.listSettlementsInRange(toIso(f.from), toIso(f.to)),
        escrowStore.listEscrowsInRange(toIso(f.from), toIso(f.to)),
      ]);
      currency = settlements[0]?.currency || escrows[0]?.currency || currency;
      for (const s of settlements) {
        const key = bucketKey(new Date(s.createdAt));
        touch(key).commissionRevenue += toMinor(s.commissionAmount);
      }
      for (const e of escrows) {
        const key = bucketKey(new Date(e.createdAt));
        touch(key).gmv += toMinor(e.capturedAmount);
      }
    }

    const points = [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({
        date,
        subscriptionRevenue: includeSubscriptions ? v.subscriptionRevenue : 0,
        commissionRevenue: includeCommerce ? v.commissionRevenue : 0,
        gmv: includeCommerce ? v.gmv : 0,
        platformRevenue: (includeSubscriptions ? v.subscriptionRevenue : 0) + (includeCommerce ? v.commissionRevenue : 0),
      }));

    return { currency, granularity, points };
  },

  /** Real filter dimensions for the UI dropdowns — never hardcoded plan names/intervals. */
  async getFilterOptions(): Promise<{ plans: Array<{ id: string; name: string; role: string }>; planVersions: Array<{ id: string; planId: string; version: number }>; billingIntervals: string[] }> {
    const planRows = await db.select({ id: plans.id, name: plans.name, role: plans.role }).from(plans);
    const versionRows = await db.select({ id: planVersions.id, planId: planVersions.planId, version: planVersions.version }).from(planVersions);
    return { plans: planRows, planVersions: versionRows, billingIntervals: ['monthly', 'annual'] };
  },
};
