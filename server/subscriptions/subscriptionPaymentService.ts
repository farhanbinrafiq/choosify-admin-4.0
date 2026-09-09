/**
 * Sprint 12, Phase 6 — SSLCommerz subscription checkout. Reuses the existing
 * PaymentGatewayProvider contract (server/payments/types.ts) and the SAME
 * sslcommerzProvider singleton commerce/ops payments already use — this is
 * NOT a second payment system, just a new payment PURPOSE routed through the
 * shared gateway. Mirrors the exact security pattern already established in
 * server/payments/paymentService.ts and commercePaymentService.ts:
 *   - the browser success redirect is NEVER proof of payment (no crediting);
 *   - only independent server-to-server validateTransaction() can credit;
 *   - fail/cancel MAY apply from the browser redirect (you cannot forge a
 *     "failure" to steal value the way you could forge a "success").
 *
 * V1 scope: manual/explicit checkout only. No recurring billing, no stored
 * cards, no tokenization — every renewal/upgrade/downgrade-activation is its
 * own explicit subscription_payments row requiring a fresh checkout.
 */
import { randomUUID } from 'node:crypto';
import { and, eq, gte, lte } from 'drizzle-orm';
import { db } from '../db/client';
import { subscriptionPayments, subscriptionBillingDocuments, subscriptions as subscriptionsTable, users } from '../db/schema';
import { Logger } from '../lib/logger';
import { auditLog, AUDIT_CATEGORIES } from '../logging/auditLogger';
import { sslcommerzProvider } from '../payments/sslcommerzProvider';
import { mockPaymentProvider } from '../payments/mockProvider';
import type { PaymentGatewayProvider, PaymentValidationResult } from '../payments/types';
import { planService } from './planService';
import { subscriptionService, SubscriptionServiceError } from './subscriptionService';
import { workspaceService } from './workspaceService';
import { OPEN_SUBSCRIPTION_STATUSES, type Subscription, type SubscriptionPaymentPurpose } from './types';

export class SubscriptionPaymentError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function isProductionRuntime(): boolean {
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL_ENV === 'production' ||
    process.env.CHOOSIFY_ENV === 'production'
  );
}

/**
 * Provider selection — fail closed in production if only mock is available.
 * Mirrors commercePaymentService.resolveCommercePaymentProvider() exactly;
 * kept as its own small copy (not imported) so subscription payment code
 * never depends on Commerce's own error type (CommerceError).
 */
export function resolveSubscriptionPaymentProvider(): PaymentGatewayProvider {
  const mockOn = (process.env.PAYMENT_GATEWAY_MOCK || '').trim().toLowerCase() === 'true';
  const sslOn = sslcommerzProvider.isConfigured();

  if (isProductionRuntime()) {
    if (mockOn && !sslOn) {
      throw new SubscriptionPaymentError('Mock payment provider cannot run in production', 503);
    }
    if (!sslOn) {
      throw new SubscriptionPaymentError('Payment gateway not available. Set SSLCOMMERZ_STORE_ID and SSLCOMMERZ_STORE_PASSWORD.', 503);
    }
    return sslcommerzProvider;
  }

  if (mockOn && mockPaymentProvider.isConfigured()) return mockPaymentProvider;
  if (sslOn) return sslcommerzProvider;
  if (mockOn) return mockPaymentProvider;
  throw new SubscriptionPaymentError('Payment gateway not available. Set SSLCOMMERZ credentials or PAYMENT_GATEWAY_MOCK=true for the local harness.', 503);
}

function amountsMatch(expectedMinorUnits: number, actualMajorUnits: number, toleranceMajor = 0.01): boolean {
  const expectedMajor = expectedMinorUnits / 100;
  return Math.abs(expectedMajor - actualMajorUnits) <= toleranceMajor;
}

async function getPaymentRow(id: string) {
  const rows = await db.select().from(subscriptionPayments).where(eq(subscriptionPayments.id, id)).limit(1);
  return rows[0] ?? null;
}
async function getPaymentByTranId(tranId: string) {
  const rows = await db.select().from(subscriptionPayments).where(eq(subscriptionPayments.providerTranId, tranId)).limit(1);
  return rows[0] ?? null;
}

/**
 * PLAN SELECTION -> SERVER RESOLVES OFFER -> CREATE subscription_payments (pending)
 * -> SSLCommerz session. Never trusts client-supplied price/currency/persona/
 * workspace — everything is re-resolved from the authenticated actor + the
 * real Plan Version Offer row.
 */
export async function initiateSubscriptionCheckout(input: {
  actorUserId: string;
  actorRole: string | undefined | null;
  offerId: string;
  purpose: Exclude<SubscriptionPaymentPurpose, 'manual_adjustment'>;
  publicApiBase: string;
  webBase: string;
}): Promise<{ redirectUrl: string; tranId: string; paymentId: string; amount: number; currency: string }> {
  const workspace = await workspaceService.resolveWorkspaceForUser(input.actorUserId, input.actorRole);
  if (!workspace) {
    // Consumer / Admin / Super Admin / any role with no Workspace concept — never reaches here.
    throw new SubscriptionPaymentError('Only an authenticated Seller or Creator Workspace may purchase a subscription.', 403);
  }

  const offerDetail = await planService.getOfferDetail(input.offerId);
  if (!offerDetail) throw new SubscriptionPaymentError('Plan version offer not found', 404);
  if (offerDetail.plan.lifecycleState !== 'published') {
    throw new SubscriptionPaymentError('This Plan is not currently published.', 400);
  }
  if (offerDetail.plan.role !== workspace.type) {
    throw new SubscriptionPaymentError(`Persona mismatch: this offer belongs to a ${offerDetail.plan.role} plan, but the workspace is ${workspace.type}.`, 403);
  }

  const openSub = await workspaceService.getResolvedOpenSubscription(workspace.id);
  let subscriptionId: string | null = null;

  if (input.purpose === 'initial') {
    if (openSub) throw new SubscriptionPaymentError('This Workspace already has an open subscription.', 409);
  } else if (input.purpose === 'renewal') {
    if (!openSub) throw new SubscriptionPaymentError('No open subscription to renew.', 404);
    if (openSub.offer.id !== input.offerId) {
      throw new SubscriptionPaymentError('Renewal must target the subscription\'s current offer — use upgrade/downgrade to change Plans.', 400);
    }
    subscriptionId = openSub.subscription.id;
  } else if (input.purpose === 'upgrade') {
    if (!openSub) throw new SubscriptionPaymentError('No open subscription to upgrade.', 404);
    // Reuses the EXISTING, already-tested validation (real target, published, persona-matched,
    // genuinely different offer) — never re-implements it. requestUpgrade never mutates state.
    await subscriptionService.requestUpgrade({ subscriptionId: openSub.subscription.id, toPlanVersionOfferId: input.offerId, actorUserId: input.actorUserId });
    subscriptionId = openSub.subscription.id;
  } else if (input.purpose === 'downgrade') {
    // Mirrors activatePendingDowngrade's own precondition: a CLOSED subscription for this
    // workspace whose pending target is exactly this offer. Never charges for a downgrade
    // that was never actually requested/scheduled.
    const closedWithPending = await db
      .select()
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.workspaceId, workspace.id));
    const candidate = closedWithPending
      .filter((s) => !OPEN_SUBSCRIPTION_STATUSES.includes(s.status) && s.pendingPlanVersionOfferId === input.offerId)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
    if (!candidate) {
      throw new SubscriptionPaymentError('No pending downgrade to this offer was found for this Workspace.', 404);
    }
    subscriptionId = candidate.id;
  } else {
    throw new SubscriptionPaymentError('Unsupported payment purpose', 400);
  }

  const provider = resolveSubscriptionPaymentProvider();
  const tranId = `SUBTXN-${offerDetail.plan.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12)}-${randomUUID()}`;
  const idempotencyKey = `subpay-${workspace.id}-${input.purpose}-${randomUUID()}`;

  const [paymentRow] = await db
    .insert(subscriptionPayments)
    .values({
      subscriptionId,
      workspaceId: workspace.id,
      planVersionOfferId: input.offerId,
      purpose: input.purpose,
      amount: offerDetail.offer.price, // minor units, server-resolved — never client-supplied
      currency: offerDetail.offer.currency,
      provider: provider.id,
      result: 'pending',
      idempotencyKey,
    })
    .returning();

  const actorUserRows = await db.select({ email: users.email, displayName: users.displayName }).from(users).where(eq(users.id, input.actorUserId)).limit(1);
  const actorUser = actorUserRows[0];

  let session;
  try {
    session = await provider.initiateSession({
      order: { orderId: paymentRow.id },
      amount: offerDetail.offer.price / 100, // gateway expects major units (e.g. 500.00)
      currency: offerDetail.offer.currency,
      tranId,
      successUrl: `${input.publicApiBase}/subscriptions/payments/sslcommerz/success`,
      failUrl: `${input.publicApiBase}/subscriptions/payments/sslcommerz/fail`,
      cancelUrl: `${input.publicApiBase}/subscriptions/payments/sslcommerz/cancel`,
      ipnUrl: `${input.publicApiBase}/subscriptions/payments/sslcommerz/ipn`,
      customer: {
        name: actorUser?.displayName || workspace.displayName || 'Customer',
        email: actorUser?.email,
        city: 'Dhaka',
      },
    });
  } catch (error) {
    await db.update(subscriptionPayments).set({ result: 'failed', updatedAt: new Date() }).where(eq(subscriptionPayments.id, paymentRow.id));
    throw error;
  }

  await db.update(subscriptionPayments).set({ providerTranId: session.tranId, updatedAt: new Date() }).where(eq(subscriptionPayments.id, paymentRow.id));

  auditLog({
    category: AUDIT_CATEGORIES.SYSTEM_EVENT,
    action: 'subscription_payment.initiated',
    resource: 'subscription_payment',
    resourceId: paymentRow.id,
    result: 'success',
    userId: input.actorUserId,
    metadata: { workspaceId: workspace.id, offerId: input.offerId, purpose: input.purpose, amount: offerDetail.offer.price, currency: offerDetail.offer.currency },
  });

  return { redirectUrl: session.redirectUrl, tranId: session.tranId, paymentId: paymentRow.id, amount: offerDetail.offer.price, currency: offerDetail.offer.currency };
}

/**
 * Resolves a payment attempt for a browser return redirect (success/fail/
 * cancel) by tran_id first, falling back to a client-hinted paymentId only
 * if that lookup misses. Read-only — used purely so the outbound redirect to
 * the web app can carry the REAL payment id (never a value the gateway
 * happened not to echo), so the frontend has something to re-verify.
 */
export async function resolveSubscriptionPaymentIdForReturn(params: { tranId?: string; paymentId?: string }): Promise<string | null> {
  const payment = (params.tranId ? await getPaymentByTranId(params.tranId) : null) || (params.paymentId ? await getPaymentRow(params.paymentId) : null);
  return payment?.id ?? null;
}

/** Untrusted browser-redirect fail/cancel — safe to apply directly (see file header). Never touches a payment already succeeded. Returns the real payment id for the return redirect. */
export async function applyUntrustedSubscriptionPaymentOutcome(params: { tranId?: string; paymentId?: string; status: 'failed' | 'cancelled' }): Promise<string | null> {
  const payment = (params.tranId ? await getPaymentByTranId(params.tranId) : null) || (params.paymentId ? await getPaymentRow(params.paymentId) : null);
  if (!payment) return null;
  if (payment.result === 'succeeded') return payment.id;
  await db.update(subscriptionPayments).set({ result: params.status, updatedAt: new Date() }).where(eq(subscriptionPayments.id, payment.id));
  return payment.id;
}

/**
 * Canonical IPN handler — the ONLY path that can credit a subscription
 * payment. Independently re-validates with the provider; never trusts the
 * IPN payload's own status/amount fields alone.
 */
export async function processSubscriptionIpn(body: Record<string, unknown>): Promise<{ received: boolean; credited: boolean; paymentId?: string; reason?: string }> {
  const provider = resolveSubscriptionPaymentProvider();
  const valId = String(body.val_id || '').trim();
  const tranId = String(body.tran_id || '').trim();
  const paymentIdHint = String(body.value_a || body.paymentId || '').trim();
  const ipnStatus = String(body.status || '').toUpperCase();

  const payment = (tranId ? await getPaymentByTranId(tranId) : null) || (paymentIdHint ? await getPaymentRow(paymentIdHint) : null);
  if (!payment) return { received: true, credited: false, reason: 'payment_not_found' };

  if (!valId) {
    if (ipnStatus === 'FAILED' || ipnStatus === 'CANCELLED' || ipnStatus === 'UNATTEMPTED') {
      await applyUntrustedSubscriptionPaymentOutcome({ paymentId: payment.id, status: ipnStatus === 'CANCELLED' ? 'cancelled' : 'failed' });
    }
    return { received: true, credited: false, paymentId: payment.id, reason: 'no_val_id' };
  }

  if (payment.result === 'succeeded') {
    // Duplicate/retried IPN for an already-finalized payment — idempotent no-op.
    return { received: true, credited: true, paymentId: payment.id, reason: 'already_processed' };
  }

  const validation = await provider.validateTransaction(valId);
  if (!validation.valid) {
    await db.update(subscriptionPayments).set({ result: 'failed', updatedAt: new Date() }).where(eq(subscriptionPayments.id, payment.id));
    return { received: true, credited: false, paymentId: payment.id, reason: 'validation_not_valid' };
  }
  if (!amountsMatch(payment.amount, validation.amount)) {
    Logger.error('Subscription payment amount mismatch — not crediting', { paymentId: payment.id, expectedMinor: payment.amount, actualMajor: validation.amount });
    return { received: true, credited: false, paymentId: payment.id, reason: 'amount_mismatch' };
  }
  if (validation.tranId && payment.providerTranId && validation.tranId !== payment.providerTranId) {
    Logger.error('Subscription payment tran_id mismatch — not crediting', { paymentId: payment.id, expected: payment.providerTranId, actual: validation.tranId });
    return { received: true, credited: false, paymentId: payment.id, reason: 'tran_id_mismatch' };
  }

  const result = await finalizeSubscriptionPayment(payment.id, validation);
  return { received: true, credited: true, paymentId: payment.id, reason: result.reused ? 'already_processed' : 'credited' };
}

/**
 * The local financial/subscription state transition — kept as tight and
 * idempotent as possible around the actual write. Re-checks payment.result
 * immediately before mutating (check-then-set), so a retried/duplicated
 * call after a partial failure can never re-run the activation branch or
 * double-issue a billing document; DB-level uniqueness constraints
 * (idempotency_key, provider_tran_id, subscription_billing_documents.
 * subscription_payment_id) back this up as a second line of defense.
 */
async function finalizeSubscriptionPayment(paymentId: string, validation: PaymentValidationResult): Promise<{ reused: boolean; subscription?: Subscription }> {
  const fresh = await getPaymentRow(paymentId);
  if (!fresh) throw new SubscriptionPaymentError('Subscription payment not found', 404);
  if (fresh.result === 'succeeded') {
    return { reused: true };
  }

  const marked = await db
    .update(subscriptionPayments)
    .set({ result: 'succeeded', providerValId: validation.valId, updatedAt: new Date() })
    .where(eq(subscriptionPayments.id, paymentId))
    .returning();
  if (!marked[0]) return { reused: true };

  const workspace = await workspaceService.getWorkspace(fresh.workspaceId);
  let subscription: Subscription;

  try {
    if (fresh.purpose === 'initial') {
      subscription = await subscriptionService.activateInitialSubscription({ workspaceId: fresh.workspaceId, planVersionOfferId: fresh.planVersionOfferId, subscriptionPaymentId: paymentId });
      // Part 7: link payment.subscription_id back to the subscription it created — only
      // the 'initial' purpose needs this here, since renewal/upgrade/downgrade payments
      // already carry a non-null subscriptionId set at checkout-initiation time.
      await db.update(subscriptionPayments).set({ subscriptionId: subscription.id, updatedAt: new Date() }).where(eq(subscriptionPayments.id, paymentId));
      await ensureBillingDocument(paymentId, fresh.workspaceId, subscription);
    } else if (fresh.purpose === 'renewal') {
      subscription = await subscriptionService.renewSubscription({ subscriptionId: fresh.subscriptionId!, subscriptionPaymentId: paymentId });
      await ensureBillingDocument(paymentId, fresh.workspaceId, subscription);
    } else if (fresh.purpose === 'upgrade') {
      // activateUpgrade already issues its own billing document internally (Phase 3C).
      subscription = await subscriptionService.activateUpgrade({ subscriptionId: fresh.subscriptionId!, toPlanVersionOfferId: fresh.planVersionOfferId, subscriptionPaymentId: paymentId, actorUserId: workspace?.ownerUserId });
    } else if (fresh.purpose === 'downgrade') {
      // activatePendingDowngrade already issues its own billing document internally (Phase 3C).
      subscription = await subscriptionService.activatePendingDowngrade({ workspaceId: fresh.workspaceId, subscriptionPaymentId: paymentId });
    } else {
      throw new SubscriptionPaymentError(`Unsupported payment purpose: ${fresh.purpose}`, 400);
    }
  } catch (error) {
    Logger.error('Subscription payment marked succeeded but activation failed — payment remains succeeded for safe retry/reconciliation', {
      paymentId,
      purpose: fresh.purpose,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  auditLog({
    category: AUDIT_CATEGORIES.SYSTEM_EVENT,
    action: 'subscription_payment.succeeded',
    resource: 'subscription_payment',
    resourceId: paymentId,
    result: 'success',
    metadata: { workspaceId: fresh.workspaceId, purpose: fresh.purpose, amount: fresh.amount, currency: fresh.currency, subscriptionId: subscription.id },
  });

  return { reused: false, subscription };
}

/** Issues a billing document only if one doesn't already exist for this payment (idempotent — DB unique constraint is the hard backstop). */
async function ensureBillingDocument(paymentId: string, workspaceId: string, subscription: Subscription): Promise<void> {
  const existing = await db.select().from(subscriptionBillingDocuments).where(eq(subscriptionBillingDocuments.subscriptionPaymentId, paymentId)).limit(1);
  if (existing[0]) return;
  await subscriptionService.issueBillingDocumentForPayment({
    subscriptionPaymentId: paymentId,
    workspaceId,
    periodStart: new Date(subscription.currentPeriodStart),
    periodEnd: subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd) : null,
  });
}

/**
 * Canonical Subscription Revenue derivation (Phase 6 item 19/20) — the ONLY
 * financially valid source: SUM of succeeded subscription_payments.amount.
 * Never derived from plan list price, subscriber counts, or any UI state.
 * Manual grants create zero payment rows, so they contribute ৳0 automatically.
 */
export async function getSubscriptionRevenue(range?: { from: Date; to: Date }): Promise<{ totalMinorUnits: number; currency: string; paymentCount: number }> {
  const conditions = [eq(subscriptionPayments.result, 'succeeded' as const)];
  if (range) {
    conditions.push(gte(subscriptionPayments.createdAt, range.from));
    conditions.push(lte(subscriptionPayments.createdAt, range.to));
  }
  const rows = await db.select().from(subscriptionPayments).where(and(...conditions));
  const totalMinorUnits = rows.reduce((sum, r) => sum + r.amount, 0);
  return { totalMinorUnits, currency: rows[0]?.currency || 'BDT', paymentCount: rows.length };
}
