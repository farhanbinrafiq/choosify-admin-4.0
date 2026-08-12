import { randomUUID } from 'node:crypto';

export type PartnerApplicantType = 'seller' | 'creator';
export type PartnerApplicationStatus = 'pending' | 'approved' | 'rejected';

export type PartnerApplication = {
  id: string;
  applicantType: PartnerApplicantType;
  status: PartnerApplicationStatus;
  email: string;
  /** Argon2 hash only — never plaintext. Cleared after approve/reject. */
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
  /** Set when approved and user provisioned */
  provisionedUserId?: string;
};

let applications: PartnerApplication[] = [];
let persistHook: (() => void) | null = null;
const touch = () => persistHook?.();

export const partnerApplicationStore = {
  setPersistHook: (hook: (() => void) | null) => {
    persistHook = hook;
  },

  hydrate: (rows: PartnerApplication[] | null | undefined) => {
    if (Array.isArray(rows)) applications = rows;
  },

  snapshot: () => structuredClone(applications),

  list: (status?: PartnerApplicationStatus) => {
    const rows = structuredClone(applications);
    if (!status) return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return rows.filter((r) => r.status === status).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  getById: (id: string) => applications.find((a) => a.id === id) || null,

  findPendingByEmail: (email: string) => {
    const normalized = email.trim().toLowerCase();
    return (
      applications.find((a) => a.email === normalized && a.status === 'pending') || null
    );
  },

  create: (input: Omit<PartnerApplication, 'id' | 'status' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const row: PartnerApplication = {
      ...input,
      id: `papp_${randomUUID()}`,
      status: 'pending',
      email: input.email.trim().toLowerCase(),
      createdAt: now,
      updatedAt: now,
    };
    applications.unshift(row);
    touch();
    return structuredClone(row);
  },

  update: (id: string, patch: Partial<PartnerApplication>) => {
    const idx = applications.findIndex((a) => a.id === id);
    if (idx < 0) return null;
    applications[idx] = {
      ...applications[idx],
      ...patch,
      id: applications[idx].id,
      updatedAt: new Date().toISOString(),
    };
    touch();
    return structuredClone(applications[idx]);
  },
};
