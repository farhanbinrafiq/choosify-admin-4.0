/**
 * Sprint 11 — minimal Plan / Account Plan store. See server/db/schema.ts for the
 * "deliberately not billing" rationale. Postgres-authoritative, same pattern as
 * entitlementStore.ts (no per-process cache — reads hit the DB every call).
 */
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { accountPlans, plans } from '../db/schema';
import type { PartnerRole } from '../../shared/entitlements/registry';

export type Plan = {
  id: string;
  role: PartnerRole;
  name: string;
  priceLabel: string | null;
  active: boolean;
  sortOrder: number;
};

export type AccountPlan = {
  userId: string;
  planId: string;
  status: 'active' | 'expired' | 'cancelled';
  assignedAt: string;
  expiresAt: string | null;
};

function toPlan(row: typeof plans.$inferSelect): Plan {
  return {
    id: row.id,
    role: row.role as PartnerRole,
    name: row.name,
    priceLabel: row.priceLabel,
    active: row.active,
    sortOrder: row.sortOrder,
  };
}

function toAccountPlan(row: typeof accountPlans.$inferSelect): AccountPlan {
  return {
    userId: row.userId,
    planId: row.planId,
    status: row.status as AccountPlan['status'],
    assignedAt: row.assignedAt.toISOString(),
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
  };
}

export const planStore = {
  listPlans: async (role?: PartnerRole): Promise<Plan[]> => {
    const rows = role
      ? await db.select().from(plans).where(eq(plans.role, role))
      : await db.select().from(plans);
    return rows.map(toPlan).sort((a, b) => a.sortOrder - b.sortOrder);
  },

  getPlan: async (id: string): Promise<Plan | null> => {
    const rows = await db.select().from(plans).where(eq(plans.id, id)).limit(1);
    return rows[0] ? toPlan(rows[0]) : null;
  },

  createPlan: async (input: { role: PartnerRole; name: string; priceLabel?: string; sortOrder?: number }): Promise<Plan> => {
    const id = `plan_${randomUUID()}`;
    await db.insert(plans).values({
      id,
      role: input.role,
      name: input.name,
      priceLabel: input.priceLabel || null,
      sortOrder: input.sortOrder ?? 0,
    });
    return (await planStore.getPlan(id))!;
  },

  updatePlan: async (
    id: string,
    patch: Partial<{ name: string; priceLabel: string | null; active: boolean; sortOrder: number }>,
  ): Promise<Plan | null> => {
    await db
      .update(plans)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(plans.id, id));
    return planStore.getPlan(id);
  },

  /** The account's currently assigned plan, or null if unassigned/expired. */
  getAccountPlan: async (userId: string): Promise<AccountPlan | null> => {
    const rows = await db.select().from(accountPlans).where(eq(accountPlans.userId, userId)).limit(1);
    const row = rows[0];
    if (!row) return null;
    const ap = toAccountPlan(row);
    if (ap.status !== 'active') return null;
    if (ap.expiresAt && new Date(ap.expiresAt).getTime() < Date.now()) return null;
    return ap;
  },

  /** Admin-only: assign or change an account's plan. Never self-service. */
  assignAccountPlan: async (input: {
    userId: string;
    planId: string;
    assignedByUserId: string;
    expiresAt?: string | null;
  }): Promise<AccountPlan> => {
    const plan = await planStore.getPlan(input.planId);
    if (!plan) throw new Error(`Plan ${input.planId} not found`);
    await db
      .insert(accountPlans)
      .values({
        userId: input.userId,
        planId: input.planId,
        status: 'active',
        assignedByUserId: input.assignedByUserId,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      })
      .onConflictDoUpdate({
        target: accountPlans.userId,
        set: {
          planId: input.planId,
          status: 'active',
          assignedByUserId: input.assignedByUserId,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
          updatedAt: new Date(),
        },
      });
    return (await planStore.getAccountPlan(input.userId))!;
  },

  cancelAccountPlan: async (userId: string): Promise<void> => {
    await db
      .update(accountPlans)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(accountPlans.userId, userId));
  },

  listAccountPlans: async (): Promise<AccountPlan[]> => {
    const rows = await db.select().from(accountPlans);
    return rows.map(toAccountPlan);
  },
};
