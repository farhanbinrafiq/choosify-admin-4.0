/**
 * Sprint 12 — Super Admin Subscription Plan management. plans holds catalog
 * identity ONLY (no price/features/limits); plan_versions/plan_version_offers/
 * plan_entitlements/plan_limits hold the actual commercial terms and are
 * immutable the moment a version is published (publishedAt set). Editing a
 * published Plan never mutates history — it always means creating a new
 * draft version.
 */
import { randomUUID } from 'node:crypto';
import { and, eq, desc } from 'drizzle-orm';
import { db } from '../db/client';
import {
  plans,
  planVersions,
  planVersionOffers,
  planEntitlements,
  planLimits,
  subscriptions,
  workspaces,
} from '../db/schema';
import { featureKeysForRole, type PartnerRole } from '../../shared/entitlements/registry';
import { auditLog, AUDIT_CATEGORIES } from '../logging/auditLogger';
import type {
  Plan,
  PlanVersion,
  PlanVersionOffer,
  PlanEntitlement,
  PlanLimit,
  WorkspaceType,
} from './types';

export class PlanServiceError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function toPlan(row: typeof plans.$inferSelect): Plan {
  return {
    id: row.id,
    role: row.role as WorkspaceType,
    name: row.name,
    internalCode: row.internalCode,
    description: row.description,
    badge: row.badge,
    lifecycleState: row.lifecycleState,
    isPublic: row.isPublic,
    isRecommended: row.isRecommended,
    sortOrder: row.sortOrder,
    currentPublishedVersionId: row.currentPublishedVersionId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toVersion(row: typeof planVersions.$inferSelect): PlanVersion {
  return {
    id: row.id,
    planId: row.planId,
    version: row.version,
    nameSnapshot: row.nameSnapshot,
    descriptionSnapshot: row.descriptionSnapshot,
    trialDays: row.trialDays,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    publishedByUserId: row.publishedByUserId,
    createdAt: row.createdAt.toISOString(),
  };
}

function toOffer(row: typeof planVersionOffers.$inferSelect): PlanVersionOffer {
  return {
    id: row.id,
    planVersionId: row.planVersionId,
    billingInterval: row.billingInterval,
    price: row.price,
    currency: row.currency,
  };
}

function toEntitlement(row: typeof planEntitlements.$inferSelect): PlanEntitlement {
  return { planVersionId: row.planVersionId, featureKey: row.featureKey, enabled: row.enabled };
}

function toLimit(row: typeof planLimits.$inferSelect): PlanLimit {
  return { planVersionId: row.planVersionId, limitKey: row.limitKey, limitValue: row.limitValue };
}

async function requirePlan(planId: string): Promise<typeof plans.$inferSelect> {
  const rows = await db.select().from(plans).where(eq(plans.id, planId)).limit(1);
  if (!rows[0]) throw new PlanServiceError('Plan not found', 404);
  return rows[0];
}

async function requireDraftVersion(planId: string, versionId: string): Promise<typeof planVersions.$inferSelect> {
  const rows = await db.select().from(planVersions).where(eq(planVersions.id, versionId)).limit(1);
  const row = rows[0];
  if (!row || row.planId !== planId) throw new PlanServiceError('Plan version not found', 404);
  if (row.publishedAt) {
    throw new PlanServiceError('This Plan Version is already published and is immutable — create a new draft version instead.', 409);
  }
  return row;
}

export const planService = {
  /**
   * Phase 5 additive read: resolves a bare Plan Version Offer id to its
   * Plan/Version/Offer details — used to faithfully display a WORKSPACE'S
   * OWN pending-downgrade target (which may not be the plan's current
   * published version, or may even belong to a different Plan than the
   * subscriber's current one) without inventing a second resolver. No
   * schema change; pure read, reuses the same tables getPlanDetail already
   * reads. Not workspace-scoped — Plan/Offer catalog data isn't
   * subscriber-identifying, so any authenticated partner may resolve any
   * real offer id (mirrors what listPublishedPlansForPersona already
   * exposes for published plans).
   */
  getOfferDetail: async (offerId: string): Promise<{ plan: Plan; version: PlanVersion; offer: PlanVersionOffer } | null> => {
    const rows = await db
      .select({ offer: planVersionOffers, version: planVersions, plan: plans })
      .from(planVersionOffers)
      .innerJoin(planVersions, eq(planVersionOffers.planVersionId, planVersions.id))
      .innerJoin(plans, eq(planVersions.planId, plans.id))
      .where(eq(planVersionOffers.id, offerId))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return { plan: toPlan(row.plan), version: toVersion(row.version), offer: toOffer(row.offer) };
  },

  listPlans: async (filter?: { role?: WorkspaceType }): Promise<Plan[]> => {
    const rows = filter?.role
      ? await db.select().from(plans).where(eq(plans.role, filter.role))
      : await db.select().from(plans);
    return rows.map(toPlan).sort((a, b) => a.sortOrder - b.sortOrder);
  },

  /**
   * Phase 4 UI list view — same plans as listPlans, enriched with the
   * current published version's real offers and a real subscriber count (no
   * invented numbers: a Plan with no published version simply has none).
   */
  listPlansWithSummary: async (
    filter?: { role?: WorkspaceType },
  ): Promise<Array<Plan & { currentVersion: (PlanVersion & { offers: PlanVersionOffer[] }) | null; subscriberCount: number }>> => {
    const list = await planService.listPlans(filter);
    const out = [];
    for (const p of list) {
      let currentVersion: (PlanVersion & { offers: PlanVersionOffer[] }) | null = null;
      let subscriberCount = 0;
      if (p.currentPublishedVersionId) {
        const versionRows = await db.select().from(planVersions).where(eq(planVersions.id, p.currentPublishedVersionId)).limit(1);
        if (versionRows[0]) {
          const offerRows = await db.select().from(planVersionOffers).where(eq(planVersionOffers.planVersionId, versionRows[0].id));
          currentVersion = { ...toVersion(versionRows[0]), offers: offerRows.map(toOffer) };
        }
      }
      const subscribers = await planService.getSubscribersForPlan(p.id);
      subscriberCount = subscribers.length;
      out.push({ ...p, currentVersion, subscriberCount });
    }
    return out;
  },

  getPlanDetail: async (
    planId: string,
  ): Promise<{ plan: Plan; versions: Array<PlanVersion & { offers: PlanVersionOffer[]; entitlements: PlanEntitlement[]; limits: PlanLimit[] }> }> => {
    const plan = await requirePlan(planId);
    const versionRows = await db
      .select()
      .from(planVersions)
      .where(eq(planVersions.planId, planId))
      .orderBy(desc(planVersions.version));
    const versions = [];
    for (const v of versionRows) {
      const [offerRows, entitlementRows, limitRows] = await Promise.all([
        db.select().from(planVersionOffers).where(eq(planVersionOffers.planVersionId, v.id)),
        db.select().from(planEntitlements).where(eq(planEntitlements.planVersionId, v.id)),
        db.select().from(planLimits).where(eq(planLimits.planVersionId, v.id)),
      ]);
      versions.push({
        ...toVersion(v),
        offers: offerRows.map(toOffer),
        entitlements: entitlementRows.map(toEntitlement),
        limits: limitRows.map(toLimit),
      });
    }
    return { plan: toPlan(plan), versions };
  },

  createPlan: async (input: {
    role: WorkspaceType;
    name: string;
    internalCode?: string;
    description?: string;
    badge?: string;
    sortOrder?: number;
    actorUserId: string;
  }): Promise<Plan> => {
    const name = input.name.trim();
    if (!name) throw new PlanServiceError('Plan name is required');
    const id = `plan_${randomUUID()}`;
    await db.insert(plans).values({
      id,
      role: input.role,
      name,
      internalCode: input.internalCode?.trim() || null,
      description: input.description?.trim() || null,
      badge: input.badge?.trim() || null,
      sortOrder: input.sortOrder ?? 0,
      lifecycleState: 'draft',
    });
    auditLog({
      category: AUDIT_CATEGORIES.ADMIN_ACTION,
      action: 'subscription_plan.create',
      resource: 'plan',
      resourceId: id,
      result: 'success',
      userId: input.actorUserId,
      metadata: { role: input.role, name },
    });
    const created = await requirePlan(id);
    return toPlan(created);
  },

  /** Catalog-identity-only edit — never touches price/features/limits (those don't live here). */
  updatePlanMetadata: async (
    planId: string,
    patch: Partial<{ name: string; description: string | null; badge: string | null; isPublic: boolean; isRecommended: boolean; sortOrder: number; internalCode: string | null }>,
    actorUserId: string,
  ): Promise<Plan> => {
    await requirePlan(planId);
    await db.update(plans).set({ ...patch, updatedAt: new Date() }).where(eq(plans.id, planId));
    auditLog({
      category: AUDIT_CATEGORIES.ADMIN_ACTION,
      action: 'subscription_plan.update_metadata',
      resource: 'plan',
      resourceId: planId,
      result: 'success',
      userId: actorUserId,
      metadata: patch,
    });
    const updated = await requirePlan(planId);
    return toPlan(updated);
  },

  archivePlan: async (planId: string, actorUserId: string): Promise<Plan> => {
    await requirePlan(planId);
    await db.update(plans).set({ lifecycleState: 'archived', isPublic: false, updatedAt: new Date() }).where(eq(plans.id, planId));
    auditLog({
      category: AUDIT_CATEGORIES.ADMIN_ACTION,
      action: 'subscription_plan.archive',
      resource: 'plan',
      resourceId: planId,
      result: 'success',
      userId: actorUserId,
    });
    const updated = await requirePlan(planId);
    return toPlan(updated);
  },

  createDraftVersion: async (
    planId: string,
    input: { nameSnapshot: string; descriptionSnapshot?: string; trialDays?: number },
    actorUserId: string,
  ): Promise<PlanVersion> => {
    const plan = await requirePlan(planId);
    const existingVersions = await db.select().from(planVersions).where(eq(planVersions.planId, planId));
    const nextVersion = existingVersions.reduce((max, v) => Math.max(max, v.version), 0) + 1;
    const nameSnapshot = input.nameSnapshot.trim() || plan.name;
    const [created] = await db
      .insert(planVersions)
      .values({
        planId,
        version: nextVersion,
        nameSnapshot,
        descriptionSnapshot: input.descriptionSnapshot?.trim() || null,
        trialDays: input.trialDays ?? null,
      })
      .returning();
    auditLog({
      category: AUDIT_CATEGORIES.ADMIN_ACTION,
      action: 'subscription_plan.create_draft_version',
      resource: 'plan_version',
      resourceId: created.id,
      result: 'success',
      userId: actorUserId,
      metadata: { planId, version: nextVersion },
    });
    return toVersion(created);
  },

  updateDraftVersion: async (
    planId: string,
    versionId: string,
    patch: Partial<{ nameSnapshot: string; descriptionSnapshot: string | null; trialDays: number | null }>,
  ): Promise<PlanVersion> => {
    await requireDraftVersion(planId, versionId);
    await db.update(planVersions).set(patch).where(eq(planVersions.id, versionId));
    const rows = await db.select().from(planVersions).where(eq(planVersions.id, versionId)).limit(1);
    return toVersion(rows[0]);
  },

  /** Replaces the draft version's offers wholesale (only valid pre-publish). No price is invented — caller supplies every value. */
  setDraftOffers: async (
    planId: string,
    versionId: string,
    offers: Array<{ billingInterval: 'monthly' | 'annual'; price: number; currency?: string }>,
  ): Promise<PlanVersionOffer[]> => {
    await requireDraftVersion(planId, versionId);
    for (const o of offers) {
      if (!Number.isFinite(o.price) || o.price < 0) {
        throw new PlanServiceError(`Invalid price for ${o.billingInterval} offer`);
      }
    }
    await db.delete(planVersionOffers).where(eq(planVersionOffers.planVersionId, versionId));
    if (offers.length === 0) return [];
    const inserted = await db
      .insert(planVersionOffers)
      .values(offers.map((o) => ({ planVersionId: versionId, billingInterval: o.billingInterval, price: o.price, currency: o.currency || 'BDT' })))
      .returning();
    return inserted.map(toOffer);
  },

  /** Replaces the draft version's boolean features wholesale. Validates every key against the canonical registry for the Plan's persona — no arbitrary feature-key strings. */
  setDraftEntitlements: async (
    planId: string,
    versionId: string,
    entitlements: Array<{ featureKey: string; enabled: boolean }>,
  ): Promise<PlanEntitlement[]> => {
    const plan = await requirePlan(planId);
    await requireDraftVersion(planId, versionId);
    const allowed = new Set(featureKeysForRole(plan.role as PartnerRole));
    for (const e of entitlements) {
      if (!allowed.has(e.featureKey as never)) {
        throw new PlanServiceError(`"${e.featureKey}" is not a valid feature for the ${plan.role} persona`);
      }
    }
    await db.delete(planEntitlements).where(eq(planEntitlements.planVersionId, versionId));
    if (entitlements.length === 0) return [];
    const inserted = await db
      .insert(planEntitlements)
      .values(entitlements.map((e) => ({ planVersionId: versionId, featureKey: e.featureKey, enabled: e.enabled })))
      .returning();
    return inserted.map(toEntitlement);
  },

  /** Replaces the draft version's quantitative limits wholesale. No commercial values are invented — caller supplies every limitKey/limitValue explicitly. */
  setDraftLimits: async (
    planId: string,
    versionId: string,
    limits: Array<{ limitKey: string; limitValue: number | null }>,
  ): Promise<PlanLimit[]> => {
    await requireDraftVersion(planId, versionId);
    await db.delete(planLimits).where(eq(planLimits.planVersionId, versionId));
    if (limits.length === 0) return [];
    const inserted = await db
      .insert(planLimits)
      .values(limits.map((l) => ({ planVersionId: versionId, limitKey: l.limitKey, limitValue: l.limitValue })))
      .returning();
    return inserted.map(toLimit);
  },

  /**
   * Transactional publish: verifies the version is still a draft, requires
   * at least one real offer (never publishes an unpriced version), freezes
   * it (publishedAt/publishedByUserId), and repoints
   * plans.current_published_version_id — all in one transaction so a crash
   * mid-publish can never leave the Plan pointing at a half-written version.
   * Existing subscribers on an OLDER version are entirely unaffected — this
   * only changes what NEW subscribers see.
   */
  publishVersion: async (planId: string, versionId: string, actorUserId: string): Promise<Plan> => {
    const version = await requireDraftVersion(planId, versionId);
    const offers = await db.select().from(planVersionOffers).where(eq(planVersionOffers.planVersionId, versionId));
    if (offers.length === 0) {
      throw new PlanServiceError('Cannot publish a Plan Version with no billing offer configured — add at least one monthly or annual price first.');
    }

    await db.transaction(async (tx) => {
      await tx.update(planVersions).set({ publishedAt: new Date(), publishedByUserId: actorUserId }).where(eq(planVersions.id, versionId));
      await tx
        .update(plans)
        .set({ currentPublishedVersionId: versionId, lifecycleState: 'published', updatedAt: new Date() })
        .where(eq(plans.id, planId));
    });

    auditLog({
      category: AUDIT_CATEGORIES.ADMIN_ACTION,
      action: 'subscription_plan.publish_version',
      resource: 'plan_version',
      resourceId: versionId,
      result: 'success',
      userId: actorUserId,
      metadata: { planId, version: version.version },
    });

    const updated = await requirePlan(planId);
    return toPlan(updated);
  },

  /** Published plans a given persona may subscribe to — used by the Seller/Creator "available plans" surface. Never invents data: an empty catalog returns an empty array. */
  listPublishedPlansForPersona: async (
    persona: WorkspaceType,
  ): Promise<Array<{ plan: Plan; version: PlanVersion; offers: PlanVersionOffer[]; entitlements: PlanEntitlement[]; limits: PlanLimit[] }>> => {
    const rows = await db
      .select()
      .from(plans)
      .where(and(eq(plans.role, persona), eq(plans.lifecycleState, 'published'), eq(plans.isPublic, true)));
    const out = [];
    for (const p of rows) {
      if (!p.currentPublishedVersionId) continue;
      const versionRows = await db.select().from(planVersions).where(eq(planVersions.id, p.currentPublishedVersionId)).limit(1);
      const version = versionRows[0];
      if (!version) continue;
      const [offerRows, entitlementRows, limitRows] = await Promise.all([
        db.select().from(planVersionOffers).where(eq(planVersionOffers.planVersionId, version.id)),
        db.select().from(planEntitlements).where(eq(planEntitlements.planVersionId, version.id)),
        db.select().from(planLimits).where(eq(planLimits.planVersionId, version.id)),
      ]);
      out.push({
        plan: toPlan(p),
        version: toVersion(version),
        offers: offerRows.map(toOffer),
        entitlements: entitlementRows.map(toEntitlement),
        limits: limitRows.map(toLimit),
      });
    }
    return out.sort((a, b) => a.plan.sortOrder - b.plan.sortOrder);
  },

  /** Super Admin subscriber inspection — every Workspace currently (or historically) on any Version of this Plan. */
  getSubscribersForPlan: async (planId: string) => {
    const versionRows = await db.select({ id: planVersions.id }).from(planVersions).where(eq(planVersions.planId, planId));
    const versionIds = new Set(versionRows.map((v) => v.id));
    if (versionIds.size === 0) return [];
    const offerRows = await db.select().from(planVersionOffers);
    const offerIdsForPlan = offerRows.filter((o) => versionIds.has(o.planVersionId)).map((o) => o.id);
    if (offerIdsForPlan.length === 0) return [];
    const subs = await db.select().from(subscriptions);
    const relevant = subs.filter((s) => offerIdsForPlan.includes(s.planVersionOfferId));
    const workspaceIds = [...new Set(relevant.map((s) => s.workspaceId))];
    const workspaceRows = workspaceIds.length ? await db.select().from(workspaces) : [];
    const workspaceById = new Map(workspaceRows.map((w) => [w.id, w]));
    return relevant.map((s) => ({
      subscriptionId: s.id,
      workspaceId: s.workspaceId,
      workspaceDisplayName: workspaceById.get(s.workspaceId)?.displayName ?? null,
      status: s.status,
      currentPeriodStart: s.currentPeriodStart.toISOString(),
      currentPeriodEnd: s.currentPeriodEnd ? s.currentPeriodEnd.toISOString() : null,
      grantedManually: s.grantedManually,
    }));
  },
};
