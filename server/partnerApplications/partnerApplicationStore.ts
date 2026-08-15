import { randomUUID } from 'node:crypto';
import { and, desc, eq, or } from 'drizzle-orm';
import { db } from '../db/client';
import { partnerApplications } from '../db/schema';

export type PartnerApplicantType = 'seller' | 'creator';
export type PartnerApplicationStatus = 'pending' | 'approved' | 'rejected';

export type PartnerApplication = {
  id: string;
  applicantType: PartnerApplicantType;
  status: PartnerApplicationStatus;
  email: string;
  /** Argon2 hash only — never plaintext. Cleared to [provisioned] after account creation. */
  passwordHash: string;
  displayName: string;
  phone: string;
  /** Seller: store/brand name. Creator: channel/creator name. */
  businessOrChannelName: string;
  category: string;
  city: string;
  website?: string;
  /** Creator-specific */
  niche?: string;
  contentFocus?: string;
  socialPrimary?: string;
  audienceSize?: string;
  notes?: string;
  /**
   * When set, approval upgrades this existing Consumer (preserves uid + CF ID)
   * instead of inserting a new users row.
   */
  existingUserId?: string;
  createdAt: string;
  updatedAt: string;
  reviewedAt?: string;
  reviewedByUserId?: string;
  reviewNote?: string;
  /** Set when the users row is created (at apply for new lifecycle, or at approve for legacy). */
  provisionedUserId?: string;
  /** Catalog brand id (seller) or creator id. Set at apply so approval never mints another identity. */
  catalogEntityId?: string;
  adminNotes?: string;
  resubmissionRequested?: boolean;
  reviewHistory?: Array<{ at: string; by: string; action: string; note?: string }>;
};

type Row = typeof partnerApplications.$inferSelect;

function rowToApplication(row: Row): PartnerApplication {
  return {
    id: row.id,
    applicantType: row.applicantType as PartnerApplicantType,
    status: row.status as PartnerApplicationStatus,
    email: row.email,
    passwordHash: row.passwordHash || '',
    displayName: row.displayName,
    phone: row.phone,
    businessOrChannelName: row.businessOrChannelName,
    category: row.category,
    city: row.city,
    website: row.website || undefined,
    niche: row.niche || undefined,
    contentFocus: row.contentFocus || undefined,
    socialPrimary: row.socialPrimary || undefined,
    audienceSize: row.audienceSize || undefined,
    notes: row.notes || undefined,
    existingUserId: row.existingUserId || undefined,
    provisionedUserId: row.provisionedUserId || undefined,
    catalogEntityId: row.catalogEntityId || undefined,
    adminNotes: row.adminNotes || undefined,
    resubmissionRequested: row.resubmissionRequested,
    reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : undefined,
    reviewedByUserId: row.reviewedByUserId || undefined,
    reviewNote: row.reviewNote || undefined,
    reviewHistory: (row.reviewHistory as PartnerApplication['reviewHistory']) || [],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Sprint 10 durability migration — authoritative PostgreSQL persistence.
 * Same public API as before (list/getById/findForActor/create/update); every
 * caller keeps working unchanged apart from adding `await`, since these were
 * already synchronous in-memory operations wrapped by async service functions.
 */
export const partnerApplicationStore = {
  list: async (status?: PartnerApplicationStatus): Promise<PartnerApplication[]> => {
    const rows = status
      ? await db.select().from(partnerApplications).where(eq(partnerApplications.status, status)).orderBy(desc(partnerApplications.createdAt))
      : await db.select().from(partnerApplications).orderBy(desc(partnerApplications.createdAt));
    return rows.map(rowToApplication);
  },

  getById: async (id: string): Promise<PartnerApplication | null> => {
    const rows = await db.select().from(partnerApplications).where(eq(partnerApplications.id, id)).limit(1);
    return rows[0] ? rowToApplication(rows[0]) : null;
  },

  findPendingByEmail: async (email: string): Promise<PartnerApplication | null> => {
    const normalized = email.trim().toLowerCase();
    const rows = await db
      .select()
      .from(partnerApplications)
      .where(and(eq(partnerApplications.email, normalized), eq(partnerApplications.status, 'pending')))
      .limit(1);
    return rows[0] ? rowToApplication(rows[0]) : null;
  },

  findForActor: async (params: { userId?: string; email?: string }): Promise<PartnerApplication | null> => {
    const uid = params.userId?.trim();
    const email = params.email?.trim().toLowerCase();
    const conditions = [];
    if (uid) conditions.push(eq(partnerApplications.provisionedUserId, uid), eq(partnerApplications.existingUserId, uid));
    if (email) conditions.push(eq(partnerApplications.email, email));
    if (conditions.length === 0) return null;
    const rows = await db.select().from(partnerApplications).where(or(...conditions));
    if (!rows.length) return null;
    const mapped = rows.map(rowToApplication);
    const pending = mapped.find((a) => a.status === 'pending');
    if (pending) return pending;
    return [...mapped].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] || null;
  },

  create: async (input: Omit<PartnerApplication, 'id' | 'status' | 'createdAt' | 'updatedAt'>): Promise<PartnerApplication> => {
    const id = `papp_${randomUUID()}`;
    const rows = await db
      .insert(partnerApplications)
      .values({
        id,
        applicantType: input.applicantType,
        status: 'pending',
        email: input.email.trim().toLowerCase(),
        passwordHash: input.passwordHash,
        displayName: input.displayName,
        phone: input.phone,
        businessOrChannelName: input.businessOrChannelName,
        category: input.category,
        city: input.city,
        website: input.website,
        niche: input.niche,
        contentFocus: input.contentFocus,
        socialPrimary: input.socialPrimary,
        audienceSize: input.audienceSize,
        notes: input.notes,
        existingUserId: input.existingUserId,
        provisionedUserId: input.provisionedUserId,
        catalogEntityId: input.catalogEntityId,
        adminNotes: input.adminNotes,
        resubmissionRequested: input.resubmissionRequested ?? false,
        reviewHistory: input.reviewHistory ?? [],
      })
      .returning();
    return rowToApplication(rows[0]);
  },

  update: async (id: string, patch: Partial<PartnerApplication>): Promise<PartnerApplication | null> => {
    const { id: _ignoreId, createdAt: _ignoreCreatedAt, updatedAt: _ignoreUpdatedAt, reviewedAt: _ignoreReviewedAt, ...rest } = patch;
    const values: Partial<typeof partnerApplications.$inferInsert> = { ...rest, updatedAt: new Date() };
    if (patch.reviewedAt !== undefined) values.reviewedAt = patch.reviewedAt ? new Date(patch.reviewedAt) : null;
    const rows = await db.update(partnerApplications).set(values).where(eq(partnerApplications.id, id)).returning();
    return rows[0] ? rowToApplication(rows[0]) : null;
  },
};
