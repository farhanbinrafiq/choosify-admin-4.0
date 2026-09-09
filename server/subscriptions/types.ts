/**
 * Sprint 12 — Subscription Plans + Monetization Center shared types.
 * Mirrors server/db/schema.ts exactly; see that file for the full DDL
 * rationale (Plan vs Plan Version separation, version-aware grandfathering,
 * monthly/annual offers as a separate table, append-only subscription
 * history).
 */

export type WorkspaceType = 'seller' | 'creator';
export type WorkspaceStatus = 'active' | 'suspended';

export type Workspace = {
  id: string;
  type: WorkspaceType;
  ownerUserId: string;
  displayName: string;
  status: WorkspaceStatus;
  createdAt: string;
  updatedAt: string;
};

export type PlanLifecycleState = 'draft' | 'published' | 'archived';
export type PlanBillingInterval = 'monthly' | 'annual';

export type Plan = {
  id: string;
  role: WorkspaceType;
  name: string;
  internalCode: string | null;
  description: string | null;
  badge: string | null;
  lifecycleState: PlanLifecycleState;
  isPublic: boolean;
  isRecommended: boolean;
  sortOrder: number;
  currentPublishedVersionId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PlanVersion = {
  id: string;
  planId: string;
  version: number;
  nameSnapshot: string;
  descriptionSnapshot: string | null;
  trialDays: number | null;
  publishedAt: string | null; // null = still draft/editable
  publishedByUserId: string | null;
  createdAt: string;
};

export type PlanVersionOffer = {
  id: string;
  planVersionId: string;
  billingInterval: PlanBillingInterval;
  price: number; // minor units
  currency: string;
};

export type PlanEntitlement = {
  planVersionId: string;
  featureKey: string;
  enabled: boolean;
};

export type PlanLimit = {
  planVersionId: string;
  limitKey: string;
  limitValue: number | null; // null = unlimited
};

export type SubscriptionStatus =
  | 'trial' | 'active' | 'past_due' | 'grace_period' | 'cancelled' | 'expired' | 'suspended';

/** Statuses that count as "open" — a Workspace may have at most one row in any of these at a time. */
export const OPEN_SUBSCRIPTION_STATUSES: SubscriptionStatus[] = ['trial', 'active', 'past_due', 'grace_period'];

export type Subscription = {
  id: string;
  workspaceId: string;
  planVersionOfferId: string;
  /** Target offer requested for activation at period end (a pending downgrade). NULL = no pending change. */
  pendingPlanVersionOfferId: string | null;
  status: SubscriptionStatus;
  startDate: string;
  currentPeriodStart: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  cancelledAt: string | null;
  trialEndsAt: string | null;
  grantedManually: boolean;
  grantedByUserId: string | null;
  grantedReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SubscriptionEventType =
  | 'subscribed' | 'renewed' | 'upgraded' | 'downgraded'
  | 'cancellation_requested' | 'cancelled' | 'expired'
  | 'manually_granted' | 'suspended' | 'restored'
  | 'downgrade_requested' | 'downgrade_cancelled';

export type SubscriptionEvent = {
  id: string;
  subscriptionId: string;
  eventType: SubscriptionEventType;
  fromPlanVersionOfferId: string | null;
  toPlanVersionOfferId: string | null;
  actorUserId: string | null;
  reason: string | null;
  metadata: unknown;
  createdAt: string;
};

/**
 * Resolved commercial chain for an open subscription — what the plan/limit
 * resolvers consume. entitlements/limits (Phase 5 additive read — no schema
 * change) are the subscribed Version's OWN boolean features/quantitative
 * limits, so a Seller/Creator's Current Plan display shows exactly what
 * they purchased, not the Plan's newest published version's terms.
 */
export type ResolvedSubscriptionPlan = {
  subscription: Subscription;
  offer: PlanVersionOffer;
  version: PlanVersion;
  plan: Plan;
  entitlements: PlanEntitlement[];
  limits: PlanLimit[];
};

export type SubscriptionPaymentPurpose = 'initial' | 'renewal' | 'upgrade' | 'downgrade' | 'manual_adjustment';
export type SubscriptionPaymentResult = 'pending' | 'succeeded' | 'failed' | 'cancelled';

export type SubscriptionPayment = {
  id: string;
  subscriptionId: string | null;
  workspaceId: string;
  planVersionOfferId: string;
  purpose: SubscriptionPaymentPurpose;
  amount: number; // minor units
  currency: string;
  provider: string;
  providerTranId: string | null;
  providerValId: string | null;
  result: SubscriptionPaymentResult;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
};

export type SubscriptionBillingDocumentStatus = 'issued' | 'void';

export type SubscriptionBillingDocument = {
  id: string;
  subscriptionPaymentId: string;
  workspaceId: string;
  referenceId: string;
  amount: number;
  currency: string;
  periodStart: string;
  periodEnd: string | null;
  status: SubscriptionBillingDocumentStatus;
  issuedAt: string;
};
