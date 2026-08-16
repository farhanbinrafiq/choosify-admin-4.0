/**
 * Sprint 11 — canonical Feature Request workflow. Seller/Creator requests access
 * to a gated feature; Admin reviews (approve/decline/contact). Requesting never
 * self-enables anything — approval only records a decision, the actual grant
 * (role default / plan / account override) remains a separate explicit Admin
 * action via the existing entitlementStore, matching how Partner Applications
 * keep "apply" and "provision" as distinct steps.
 */
import { randomUUID } from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { featureRequests } from '../db/schema';
import type { PartnerFeatureKey, PartnerRole } from '../../shared/entitlements/registry';

export type FeatureRequestStatus = 'pending' | 'approved' | 'declined' | 'contacted';

export type FeatureRequest = {
  id: string;
  userId: string;
  role: PartnerRole;
  featureKey: string;
  message: string | null;
  status: FeatureRequestStatus;
  reviewedAt: string | null;
  reviewedByUserId: string | null;
  reviewNote: string | null;
  createdAt: string;
  updatedAt: string;
};

function toFeatureRequest(row: typeof featureRequests.$inferSelect): FeatureRequest {
  return {
    id: row.id,
    userId: row.userId,
    role: row.role as PartnerRole,
    featureKey: row.featureKey,
    message: row.message,
    status: row.status,
    reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
    reviewedByUserId: row.reviewedByUserId,
    reviewNote: row.reviewNote,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export const featureRequestStore = {
  /** Throws if the user already has a pending request for this feature (DB unique index also enforces this). */
  create: async (input: {
    userId: string;
    role: PartnerRole;
    featureKey: PartnerFeatureKey;
    message?: string;
  }): Promise<FeatureRequest> => {
    const existing = await db
      .select()
      .from(featureRequests)
      .where(
        and(
          eq(featureRequests.userId, input.userId),
          eq(featureRequests.featureKey, input.featureKey),
          eq(featureRequests.status, 'pending'),
        ),
      )
      .limit(1);
    if (existing[0]) return toFeatureRequest(existing[0]);

    const id = `fr_${randomUUID()}`;
    await db.insert(featureRequests).values({
      id,
      userId: input.userId,
      role: input.role,
      featureKey: input.featureKey,
      message: input.message || null,
    });
    const [row] = await db.select().from(featureRequests).where(eq(featureRequests.id, id)).limit(1);
    return toFeatureRequest(row);
  },

  list: async (filter?: { status?: FeatureRequestStatus; userId?: string }): Promise<FeatureRequest[]> => {
    const conditions = [];
    if (filter?.status) conditions.push(eq(featureRequests.status, filter.status));
    if (filter?.userId) conditions.push(eq(featureRequests.userId, filter.userId));
    const rows = conditions.length
      ? await db.select().from(featureRequests).where(and(...conditions)).orderBy(desc(featureRequests.createdAt))
      : await db.select().from(featureRequests).orderBy(desc(featureRequests.createdAt));
    return rows.map(toFeatureRequest);
  },

  get: async (id: string): Promise<FeatureRequest | null> => {
    const rows = await db.select().from(featureRequests).where(eq(featureRequests.id, id)).limit(1);
    return rows[0] ? toFeatureRequest(rows[0]) : null;
  },

  /** Admin-only: record a decision. Does NOT grant the feature — that's a separate explicit entitlement/plan action. */
  review: async (
    id: string,
    input: { status: 'approved' | 'declined' | 'contacted'; reviewedByUserId: string; reviewNote?: string },
  ): Promise<FeatureRequest | null> => {
    await db
      .update(featureRequests)
      .set({
        status: input.status,
        reviewedAt: new Date(),
        reviewedByUserId: input.reviewedByUserId,
        reviewNote: input.reviewNote || null,
        updatedAt: new Date(),
      })
      .where(eq(featureRequests.id, id));
    return featureRequestStore.get(id);
  },
};
