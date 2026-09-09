/**
 * Sprint 12 — minimal Workspace foundation. Deliberately NOT Team & Access
 * (server/catalog/staffOwnership.ts's BrandStaffGrant remains the separate,
 * later project for that). This service only answers "which business
 * context does this login's Subscription belong to" — one Workspace per
 * (owner_user_id, persona), backfilled once from real users.role, never
 * from CatalogBrand/CatalogCreator (so a Community/unclaimed profile can
 * never become a subscription owner — there is no code path here that
 * reads the catalog store at all).
 */
import { and, eq, ilike, inArray, or } from 'drizzle-orm';
import { db } from '../db/client';
import {
  workspaces,
  sellerProfiles,
  users,
  subscriptions,
  planVersionOffers,
  planVersions,
  plans,
  planEntitlements,
  planLimits,
} from '../db/schema';
import { OPEN_SUBSCRIPTION_STATUSES, type ResolvedSubscriptionPlan, type Workspace, type WorkspaceType } from './types';

function toWorkspace(row: typeof workspaces.$inferSelect): Workspace {
  return {
    id: row.id,
    type: row.type,
    ownerUserId: row.ownerUserId,
    displayName: row.displayName,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Normalizes a Choosify user role string to the Workspace persona it corresponds to, or null if the role has no Workspace concept (Admin/Super Admin/Consumer/staff). */
export function normalizeWorkspaceType(role: string | undefined | null): WorkspaceType | null {
  const r = String(role || '').toLowerCase();
  if (r === 'seller' || r === 'verified_seller') return 'seller';
  if (r === 'creator') return 'creator';
  return null;
}

export const workspaceService = {
  /** Resolve (and lazily create, matching the approved backfill rule) the Workspace for a login + its persona. Returns null for roles with no Workspace concept. */
  resolveWorkspaceForUser: async (
    userId: string,
    role: string | undefined | null,
  ): Promise<Workspace | null> => {
    const type = normalizeWorkspaceType(role);
    if (!type) return null;
    const rows = await db
      .select()
      .from(workspaces)
      .where(and(eq(workspaces.ownerUserId, userId), eq(workspaces.type, type)))
      .limit(1);
    if (rows[0]) return toWorkspace(rows[0]);
    return null;
  },

  /**
   * Creates the Workspace for a login + persona if one doesn't exist yet —
   * the same rule the one-time local backfill applied, exposed here so
   * future onboarding (a user becoming a Seller/Creator after this migration)
   * gets a Workspace without a second manual backfill run. Never reads the
   * catalog store; never invoked for Admin/Super Admin/Consumer.
   */
  ensureWorkspaceForUser: async (input: {
    userId: string;
    role: string | undefined | null;
    displayName?: string;
  }): Promise<Workspace | null> => {
    const type = normalizeWorkspaceType(input.role);
    if (!type) return null;
    const existing = await workspaceService.resolveWorkspaceForUser(input.userId, input.role);
    if (existing) return existing;

    let displayName = input.displayName;
    if (!displayName && type === 'seller') {
      const profile = await db
        .select({ storeName: sellerProfiles.storeName })
        .from(sellerProfiles)
        .where(eq(sellerProfiles.userId, input.userId))
        .limit(1);
      displayName = profile[0]?.storeName;
    }
    displayName = displayName || (type === 'seller' ? 'Seller Workspace' : 'Creator Workspace');

    const created = await db
      .insert(workspaces)
      .values({ type, ownerUserId: input.userId, displayName })
      .onConflictDoNothing({ target: [workspaces.ownerUserId, workspaces.type] })
      .returning();
    if (created[0]) return toWorkspace(created[0]);
    // Lost a race to a concurrent request creating the same (owner, type) row — read it back.
    return workspaceService.resolveWorkspaceForUser(input.userId, input.role);
  },

  getWorkspace: async (workspaceId: string): Promise<Workspace | null> => {
    const rows = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1);
    return rows[0] ? toWorkspace(rows[0]) : null;
  },

  /**
   * Super Admin workspace lookup for manual-grant target selection (Phase 4
   * UI). The smallest role-protected read this needs — NOT Team & Access,
   * just "which real Workspace is this." Matches on the Workspace's own
   * display name or its owner's email/display name; capped at 50 results
   * since there is no pagination need at this scale yet.
   */
  listWorkspaces: async (filter?: { type?: WorkspaceType; search?: string }): Promise<Array<Workspace & { ownerEmail: string; ownerDisplayName: string }>> => {
    const conditions = [];
    if (filter?.type) conditions.push(eq(workspaces.type, filter.type));
    const search = filter?.search?.trim();
    if (search) {
      conditions.push(
        or(
          ilike(workspaces.displayName, `%${search}%`),
          ilike(users.email, `%${search}%`),
          ilike(users.displayName, `%${search}%`),
        ),
      );
    }
    const rows = await db
      .select({ workspace: workspaces, ownerEmail: users.email, ownerDisplayName: users.displayName })
      .from(workspaces)
      .innerJoin(users, eq(workspaces.ownerUserId, users.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .limit(50);
    return rows.map((r) => ({ ...toWorkspace(r.workspace), ownerEmail: r.ownerEmail, ownerDisplayName: r.ownerDisplayName }));
  },

  /**
   * The single canonical lookup: this Workspace's OPEN subscription resolved
   * all the way through to its Plan Version's own row — the exact chain the
   * approved architecture requires (workspace -> open subscription ->
   * plan_version_offer -> plan_version -> plan). Used by BOTH
   * resolveFeatureEnabled()'s plan tier and resolvePlanLimit() so there is
   * exactly one place this join lives.
   */
  getResolvedOpenSubscription: async (workspaceId: string): Promise<ResolvedSubscriptionPlan | null> => {
    const rows = await db
      .select({
        subscription: subscriptions,
        offer: planVersionOffers,
        version: planVersions,
        plan: plans,
      })
      .from(subscriptions)
      .innerJoin(planVersionOffers, eq(subscriptions.planVersionOfferId, planVersionOffers.id))
      .innerJoin(planVersions, eq(planVersionOffers.planVersionId, planVersions.id))
      .innerJoin(plans, eq(planVersions.planId, plans.id))
      .where(and(eq(subscriptions.workspaceId, workspaceId), inArray(subscriptions.status, OPEN_SUBSCRIPTION_STATUSES)))
      .limit(1);
    const row = rows[0];
    if (!row) return null;

    const [entitlementRows, limitRows] = await Promise.all([
      db.select().from(planEntitlements).where(eq(planEntitlements.planVersionId, row.version.id)),
      db.select().from(planLimits).where(eq(planLimits.planVersionId, row.version.id)),
    ]);

    return {
      subscription: {
        id: row.subscription.id,
        workspaceId: row.subscription.workspaceId,
        planVersionOfferId: row.subscription.planVersionOfferId,
        pendingPlanVersionOfferId: row.subscription.pendingPlanVersionOfferId,
        status: row.subscription.status,
        startDate: row.subscription.startDate.toISOString(),
        currentPeriodStart: row.subscription.currentPeriodStart.toISOString(),
        currentPeriodEnd: row.subscription.currentPeriodEnd ? row.subscription.currentPeriodEnd.toISOString() : null,
        cancelAtPeriodEnd: row.subscription.cancelAtPeriodEnd,
        cancelledAt: row.subscription.cancelledAt ? row.subscription.cancelledAt.toISOString() : null,
        trialEndsAt: row.subscription.trialEndsAt ? row.subscription.trialEndsAt.toISOString() : null,
        grantedManually: row.subscription.grantedManually,
        grantedByUserId: row.subscription.grantedByUserId,
        grantedReason: row.subscription.grantedReason,
        createdAt: row.subscription.createdAt.toISOString(),
        updatedAt: row.subscription.updatedAt.toISOString(),
      },
      offer: {
        id: row.offer.id,
        planVersionId: row.offer.planVersionId,
        billingInterval: row.offer.billingInterval,
        price: row.offer.price,
        currency: row.offer.currency,
      },
      version: {
        id: row.version.id,
        planId: row.version.planId,
        version: row.version.version,
        nameSnapshot: row.version.nameSnapshot,
        descriptionSnapshot: row.version.descriptionSnapshot,
        trialDays: row.version.trialDays,
        publishedAt: row.version.publishedAt ? row.version.publishedAt.toISOString() : null,
        publishedByUserId: row.version.publishedByUserId,
        createdAt: row.version.createdAt.toISOString(),
      },
      plan: {
        id: row.plan.id,
        role: row.plan.role as WorkspaceType,
        name: row.plan.name,
        internalCode: row.plan.internalCode,
        description: row.plan.description,
        badge: row.plan.badge,
        lifecycleState: row.plan.lifecycleState,
        isPublic: row.plan.isPublic,
        isRecommended: row.plan.isRecommended,
        sortOrder: row.plan.sortOrder,
        currentPublishedVersionId: row.plan.currentPublishedVersionId,
        createdAt: row.plan.createdAt.toISOString(),
        updatedAt: row.plan.updatedAt.toISOString(),
      },
      entitlements: entitlementRows.map((e) => ({ planVersionId: e.planVersionId, featureKey: e.featureKey, enabled: e.enabled })),
      limits: limitRows.map((l) => ({ planVersionId: l.planVersionId, limitKey: l.limitKey, limitValue: l.limitValue })),
    };
  },
};
