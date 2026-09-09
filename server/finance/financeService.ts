/**
 * Sprint 12, Phase 8 — Finance. Answers "what financial records/
 * transactions/settlements/billing documents exist?", a different question
 * from Monetization Center's "how is the platform performing?" (Phase 7).
 * This file creates NO second ledger and NO second revenue formula — every
 * list below reads the exact same authoritative tables Monetization reads,
 * just framed as individual records for audit rather than aggregated
 * performance:
 *
 *   Subscription payment records -> subscription_payments (Postgres, Phase 6)
 *   Commerce settlements         -> escrow "commerce_settlements" (memory/Firestore)
 *   Billing documents            -> subscription_billing_documents (Postgres, Phase 6)
 *
 * Scope (same as Monetization, disclosed identically): the older Ops
 * storefront order book is a separate, pre-existing system, not reconciled
 * here. Seller payouts/cashbook are NOT reimplemented here — the existing
 * native pages (/admin/payouts, /admin/cashbook) already cover that
 * ground with real, working functionality; Finance links out to them
 * rather than duplicating their logic (Part 13's own instruction).
 */
import { and, eq, gte, lte, inArray } from 'drizzle-orm';
import { db } from '../db/client';
import {
  subscriptionPayments,
  subscriptionBillingDocuments,
  workspaces,
  planVersionOffers,
  planVersions,
  plans,
  users,
} from '../db/schema';
import { escrowStore } from '../escrow/escrowStore';
import { toMinor } from '../escrow/money';
import { toDbComparableRange } from '../lib/dbTimestampDrift';
import type { CommerceSettlement } from '../escrow/types';

export type FinanceFilters = {
  from: Date;
  to: Date;
  paymentStatus?: 'all' | 'succeeded' | 'pending' | 'failed' | 'cancelled';
  persona?: 'all' | 'seller' | 'creator';
};

export type Pagination = { page: number; pageSize: number };

function normalizeFilters(f: FinanceFilters) {
  return { from: f.from, to: f.to, paymentStatus: f.paymentStatus ?? 'all', persona: f.persona ?? 'all' };
}
function normalizePagination(p?: Partial<Pagination>): Pagination {
  const pageSize = Math.min(Math.max(p?.pageSize ?? 25, 1), 100);
  const page = Math.max(p?.page ?? 1, 1);
  return { page, pageSize };
}
function toIso(d: Date): string {
  return d.toISOString();
}

// ── Overview ────────────────────────────────────────────────────────────

export type FinanceOverview = {
  currency: string;
  /** SUM(subscription_payments.amount) WHERE result='succeeded' — a financial-record total, not "revenue performance" (see Monetization Center for that framing). */
  totalSuccessfulSubscriptionPaymentValue: number;
  successfulSubscriptionPaymentCount: number;
  pendingSubscriptionPaymentCount: number;
  failedSubscriptionPaymentCount: number;
  cancelledSubscriptionPaymentCount: number;
  commerceSettlementCount: number;
  /** SUM(commerce_settlements.commissionAmount) — the same authoritative field Monetization reads; shown here as a recorded financial total, not re-derived. */
  totalCommissionRecorded: number;
  /** SUM(commerce_settlements.sellerNetAmount). */
  totalSellerNetRecorded: number;
  billingDocumentCount: number;
};

export async function getFinanceOverview(input: FinanceFilters): Promise<FinanceOverview> {
  const f = normalizeFilters(input);
  const { from: dbFrom, to: dbTo } = await toDbComparableRange(f.from, f.to);

  const paymentRows = await db
    .select({ amount: subscriptionPayments.amount, result: subscriptionPayments.result, currency: subscriptionPayments.currency })
    .from(subscriptionPayments)
    .where(and(gte(subscriptionPayments.createdAt, dbFrom), lte(subscriptionPayments.createdAt, dbTo)));

  const succeeded = paymentRows.filter((r) => r.result === 'succeeded');
  const totalSuccessfulSubscriptionPaymentValue = succeeded.reduce((s, r) => s + r.amount, 0);

  const [settlements, billingDocRows] = await Promise.all([
    escrowStore.listSettlementsInRange(toIso(f.from), toIso(f.to)),
    db.select({ id: subscriptionBillingDocuments.id }).from(subscriptionBillingDocuments).where(and(gte(subscriptionBillingDocuments.issuedAt, dbFrom), lte(subscriptionBillingDocuments.issuedAt, dbTo))),
  ]);

  const totalCommissionRecorded = settlements.reduce((s, r) => s + toMinor(r.commissionAmount), 0);
  const totalSellerNetRecorded = settlements.reduce((s, r) => s + toMinor(r.sellerNetAmount), 0);

  return {
    currency: succeeded[0]?.currency || settlements[0]?.currency || 'BDT',
    totalSuccessfulSubscriptionPaymentValue,
    successfulSubscriptionPaymentCount: succeeded.length,
    pendingSubscriptionPaymentCount: paymentRows.filter((r) => r.result === 'pending').length,
    failedSubscriptionPaymentCount: paymentRows.filter((r) => r.result === 'failed').length,
    cancelledSubscriptionPaymentCount: paymentRows.filter((r) => r.result === 'cancelled').length,
    commerceSettlementCount: settlements.length,
    totalCommissionRecorded,
    totalSellerNetRecorded,
    billingDocumentCount: billingDocRows.length,
  };
}

// ── Transactions (subscription_payments) ───────────────────────────────

export type FinanceTransactionRow = {
  id: string;
  createdAt: string;
  purpose: string;
  amount: number;
  currency: string;
  result: string;
  planName: string;
  planVersion: number;
  billingInterval: string;
  workspaceType: string;
};

export async function listFinanceTransactions(input: FinanceFilters, pagination?: Partial<Pagination>): Promise<{ rows: FinanceTransactionRow[]; total: number; page: number; pageSize: number }> {
  const f = normalizeFilters(input);
  const p = normalizePagination(pagination);
  const { from: dbFrom, to: dbTo } = await toDbComparableRange(f.from, f.to);

  const conditions = [gte(subscriptionPayments.createdAt, dbFrom), lte(subscriptionPayments.createdAt, dbTo)];
  if (f.paymentStatus !== 'all') conditions.push(eq(subscriptionPayments.result, f.paymentStatus));
  if (f.persona !== 'all') conditions.push(eq(workspaces.type, f.persona));

  const base = db
    .select({
      id: subscriptionPayments.id,
      createdAt: subscriptionPayments.createdAt,
      purpose: subscriptionPayments.purpose,
      amount: subscriptionPayments.amount,
      currency: subscriptionPayments.currency,
      result: subscriptionPayments.result,
      planName: plans.name,
      planVersion: planVersions.version,
      billingInterval: planVersionOffers.billingInterval,
      workspaceType: workspaces.type,
    })
    .from(subscriptionPayments)
    .innerJoin(workspaces, eq(subscriptionPayments.workspaceId, workspaces.id))
    .innerJoin(planVersionOffers, eq(subscriptionPayments.planVersionOfferId, planVersionOffers.id))
    .innerJoin(planVersions, eq(planVersionOffers.planVersionId, planVersions.id))
    .innerJoin(plans, eq(planVersions.planId, plans.id))
    .where(and(...conditions));

  const allRows = await base;
  const total = allRows.length;
  const sorted = allRows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const pageRows = sorted.slice((p.page - 1) * p.pageSize, p.page * p.pageSize);

  return {
    rows: pageRows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      purpose: r.purpose,
      amount: r.amount,
      currency: r.currency,
      result: r.result,
      planName: r.planName,
      planVersion: r.planVersion,
      billingInterval: r.billingInterval,
      workspaceType: r.workspaceType,
    })),
    total,
    page: p.page,
    pageSize: p.pageSize,
  };
}

// ── Settlements (CommerceSettlement) ───────────────────────────────────

export type FinanceSettlementRow = {
  settlementId: string;
  createdAt: string;
  sellerId: string;
  sellerName: string | null;
  grossAmount: number;
  commissionAmount: number;
  sellerNetAmount: number;
  currency: string;
  orderId: string;
};

export async function listFinanceSettlements(input: FinanceFilters, pagination?: Partial<Pagination>): Promise<{ rows: FinanceSettlementRow[]; total: number; page: number; pageSize: number }> {
  const f = normalizeFilters(input);
  const p = normalizePagination(pagination);

  const all: CommerceSettlement[] = await escrowStore.listSettlementsInRange(toIso(f.from), toIso(f.to));
  const total = all.length;
  const sorted = [...all].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const pageRows = sorted.slice((p.page - 1) * p.pageSize, p.page * p.pageSize);

  // Best-effort seller display-name resolution — falls back to the raw id if it isn't a real
  // Choosify user id (test/demo fixtures, or any non-UUID value, would otherwise error a `uuid`
  // column comparison; caught defensively so a bad id never breaks the whole settlements list).
  const sellerIds = [...new Set(pageRows.map((r) => r.sellerId))];
  const nameMap = new Map<string, string>();
  if (sellerIds.length) {
    try {
      const matches = await db.select({ id: users.id, displayName: users.displayName }).from(users).where(inArray(users.id, sellerIds));
      for (const m of matches) nameMap.set(m.id, m.displayName);
    } catch {
      // Non-UUID seller ids (fixtures) — leave nameMap empty, callers fall back to the raw id.
    }
  }

  return {
    rows: pageRows.map((r) => ({
      settlementId: r.settlementId,
      createdAt: r.createdAt,
      sellerId: r.sellerId,
      sellerName: nameMap.get(r.sellerId) ?? null,
      grossAmount: toMinor(r.grossAmount),
      commissionAmount: toMinor(r.commissionAmount),
      sellerNetAmount: toMinor(r.sellerNetAmount),
      currency: r.currency,
      orderId: r.orderId,
    })),
    total,
    page: p.page,
    pageSize: p.pageSize,
  };
}

// ── Billing documents (subscription_billing_documents) ─────────────────

export type FinanceBillingDocumentRow = {
  referenceId: string;
  issuedAt: string;
  amount: number;
  currency: string;
  periodStart: string;
  periodEnd: string | null;
  status: string;
  workspaceType: string;
};

export async function listFinanceBillingDocuments(input: FinanceFilters, pagination?: Partial<Pagination>): Promise<{ rows: FinanceBillingDocumentRow[]; total: number; page: number; pageSize: number }> {
  const f = normalizeFilters(input);
  const p = normalizePagination(pagination);
  const { from: dbFrom, to: dbTo } = await toDbComparableRange(f.from, f.to);

  const conditions = [gte(subscriptionBillingDocuments.issuedAt, dbFrom), lte(subscriptionBillingDocuments.issuedAt, dbTo)];
  if (f.persona !== 'all') conditions.push(eq(workspaces.type, f.persona));

  const allRows = await db
    .select({
      referenceId: subscriptionBillingDocuments.referenceId,
      issuedAt: subscriptionBillingDocuments.issuedAt,
      amount: subscriptionBillingDocuments.amount,
      currency: subscriptionBillingDocuments.currency,
      periodStart: subscriptionBillingDocuments.periodStart,
      periodEnd: subscriptionBillingDocuments.periodEnd,
      status: subscriptionBillingDocuments.status,
      workspaceType: workspaces.type,
    })
    .from(subscriptionBillingDocuments)
    .innerJoin(workspaces, eq(subscriptionBillingDocuments.workspaceId, workspaces.id))
    .where(and(...conditions));

  const total = allRows.length;
  const sorted = allRows.sort((a, b) => b.issuedAt.getTime() - a.issuedAt.getTime());
  const pageRows = sorted.slice((p.page - 1) * p.pageSize, p.page * p.pageSize);

  return {
    rows: pageRows.map((r) => ({
      referenceId: r.referenceId,
      issuedAt: r.issuedAt.toISOString(),
      amount: r.amount,
      currency: r.currency,
      periodStart: r.periodStart.toISOString(),
      periodEnd: r.periodEnd ? r.periodEnd.toISOString() : null,
      status: r.status,
      workspaceType: r.workspaceType,
    })),
    total,
    page: p.page,
    pageSize: p.pageSize,
  };
}
