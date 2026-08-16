import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { catalogStore } from '../../lib/vercel-catalog/catalogStore';
import { normalizeCreatorInput } from '../../lib/vercel-catalog/catalogEditorialContract';
import { db } from '../db/client';
import { sellerProfiles, users } from '../db/schema';
import { allocateNextChoosifyUserId } from '../auth/choosifyUserId';
import { hashPassword, verifyPassword } from '../auth/jwtTokens';
import { normalizeBrandInput } from '../catalogContract';
import { loadAdminUserByEmail } from '../operations/operationsDb';
import { notifyRoles, notifyUser } from '../communication/systemNotify';
import { ROLES, toUserRole } from '../permissions/roles';
import { stampReferenceId } from '../referenceIds/stampReferenceId';
import {
  partnerApplicationStore,
  type PartnerApplicantType,
  type PartnerApplication,
} from './partnerApplicationStore';

export type PartnerApplyInput = {
  applicantType: PartnerApplicantType;
  email: string;
  password: string;
  displayName: string;
  phone: string;
  businessOrChannelName: string;
  category: string;
  city: string;
  website?: string;
  niche?: string;
  contentFocus?: string;
  socialPrimary?: string;
  audienceSize?: string;
  notes?: string;
};

function appendHistory(
  app: PartnerApplication,
  entry: { by: string; action: string; note?: string },
): PartnerApplication['reviewHistory'] {
  return [
    ...(app.reviewHistory || []),
    { at: new Date().toISOString(), by: entry.by, action: entry.action, note: entry.note },
  ];
}

async function createSellerIdentityBrand(params: {
  sellerUserId: string;
  name: string;
  category: string;
  website?: string;
  email: string;
  phone: string;
  city: string;
}): Promise<string> {
  const id = `brand-${randomUUID()}`;
  const normalized = normalizeBrandInput({
    id,
    name: params.name,
    category: params.category,
    website: params.website || '',
    sellerId: params.sellerUserId,
    marketplaceAccess: false,
    marketplaceStatus: 'not_granted',
    claimStatus: 'pending',
    verifiedStatus: false,
    overview: {
      email: params.email,
      phone: params.phone,
      address: params.city,
    },
  });
  const withRef = {
    ...normalized,
    brandReferenceId:
      (await stampReferenceId('brand', normalized, normalized.brandReferenceId)) ||
      normalized.brandReferenceId,
  };
  const saved = await catalogStore.upsertBrand(withRef);
  return saved.id;
}

async function createCreatorDraft(params: {
  userId: string;
  displayName: string;
  email: string;
  category: string;
}): Promise<string> {
  const name = params.displayName.trim() || 'Creator';
  const handle = '@' + name.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 24);
  const created = normalizeCreatorInput({
    name,
    handle,
    avatar: '',
    bio: '',
    score: 0,
    bestFor: params.category || 'General',
    bestForTags: [],
    platforms: ['YouTube'],
    followers: { YouTube: '0' },
    email: params.email,
    userId: params.userId,
    verifiedStatus: false,
    featuredFlag: false,
    videos: [],
    reels: [],
    blogs: [],
    status: 'draft',
  });
  const saved = await catalogStore.upsertCreator(created);
  return saved.id;
}

async function provisionPartnerUser(params: {
  app: PartnerApplication;
  passwordHash: string;
  existingUserId?: string;
}): Promise<{ userId: string; catalogEntityId: string }> {
  const role = params.app.applicantType === 'creator' ? ROLES.CREATOR : ROLES.SELLER;
  const now = new Date();
  let userId = params.existingUserId || '';

  if (params.existingUserId) {
    const rows = await db.select().from(users).where(eq(users.id, params.existingUserId)).limit(1);
    const user = rows[0];
    if (!user) {
      const err = new Error('Linked Consumer account no longer exists');
      (err as Error & { status?: number }).status = 409;
      throw err;
    }
    const current = toUserRole(user.role);
    if (current !== ROLES.USER && current !== role) {
      const err = new Error('Linked account is no longer a Consumer');
      (err as Error & { status?: number }).status = 409;
      throw err;
    }
    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({
          role,
          displayName: params.app.displayName,
          updatedAt: now,
        })
        .where(eq(users.id, user.id));
      if (role === ROLES.SELLER) {
        await tx
          .insert(sellerProfiles)
          .values({
            userId: user.id,
            storeName: params.app.businessOrChannelName,
            phone: params.app.phone,
            category: params.app.category,
            city: params.app.city,
            website: params.app.website || null,
            createdAt: now,
          })
          .onConflictDoUpdate({
            target: sellerProfiles.userId,
            set: {
              storeName: params.app.businessOrChannelName,
              phone: params.app.phone,
              category: params.app.category,
              city: params.app.city,
              website: params.app.website || null,
            },
          });
      }
    });
    userId = user.id;
  } else {
    const existing = await loadAdminUserByEmail(params.app.email);
    if (existing) {
      const err = new Error('Email was registered while application was pending');
      (err as Error & { status?: number }).status = 409;
      throw err;
    }
    const uid = randomUUID();
    await db.transaction(async (tx) => {
      const choosifyUserId = await allocateNextChoosifyUserId(tx);
      await tx.insert(users).values({
        id: uid,
        email: params.app.email,
        passwordHash: params.passwordHash,
        displayName: params.app.displayName,
        role,
        emailVerified: false,
        choosifyUserId,
        createdAt: now,
        updatedAt: now,
      });
      if (role === ROLES.SELLER) {
        await tx.insert(sellerProfiles).values({
          userId: uid,
          storeName: params.app.businessOrChannelName,
          phone: params.app.phone,
          category: params.app.category,
          city: params.app.city,
          website: params.app.website || null,
          createdAt: now,
        });
      }
    });
    userId = uid;
  }

  let catalogEntityId = params.app.catalogEntityId || '';
  if (!catalogEntityId) {
    if (role === ROLES.SELLER) {
      const owned = (await catalogStore.listBrands()).find((b) => b.sellerId === userId);
      catalogEntityId =
        owned?.id ||
        (await createSellerIdentityBrand({
          sellerUserId: userId,
          name: params.app.businessOrChannelName,
          category: params.app.category,
          website: params.app.website,
          email: params.app.email,
          phone: params.app.phone,
          city: params.app.city,
        }));
    } else {
      const owned = (await catalogStore.listCreators()).find((c) => c.userId === userId);
      catalogEntityId =
        owned?.id ||
        (await createCreatorDraft({
          userId,
          displayName: params.app.businessOrChannelName || params.app.displayName,
          email: params.app.email,
          category: params.app.category,
        }));
    }
  }

  return { userId, catalogEntityId };
}

export async function submitPartnerApplication(input: PartnerApplyInput): Promise<{
  applicationId: string;
  status: 'pending';
  message: string;
  provisionedUserId: string;
}> {
  const email = input.email.trim().toLowerCase();
  if (!input.password || input.password.length < 8) {
    const err = new Error('Password must be at least 8 characters.');
    (err as Error & { status?: number; code?: string }).status = 400;
    (err as Error & { code?: string }).code = 'WEAK_PASSWORD';
    throw err;
  }

  const existing = await loadAdminUserByEmail(email);
  let existingUserId: string | undefined;
  let passwordHash = '';

  if (existing) {
    const role = toUserRole(existing.role);
    if (role === ROLES.SELLER || role === ROLES.VERIFIED_SELLER || role === ROLES.CREATOR) {
      const err = new Error('A partner account already exists for this email. Sign in instead.');
      (err as Error & { status?: number; code?: string }).status = 409;
      (err as Error & { code?: string }).code = 'PARTNER_EXISTS';
      throw err;
    }
    if (role === ROLES.USER) {
      const rows = await db.select().from(users).where(eq(users.id, existing.uid)).limit(1);
      const userRow = rows[0];
      const ok = userRow?.passwordHash
        ? await verifyPassword(userRow.passwordHash, input.password)
        : false;
      if (!ok) {
        const err = new Error('Password does not match the existing Consumer account.');
        (err as Error & { status?: number; code?: string }).status = 401;
        (err as Error & { code?: string }).code = 'CONSUMER_PASSWORD_MISMATCH';
        throw err;
      }
      existingUserId = existing.uid;
      passwordHash = userRow!.passwordHash!;
    } else {
      const err = new Error('This email is already registered with another dashboard role.');
      (err as Error & { status?: number; code?: string }).status = 409;
      (err as Error & { code?: string }).code = 'EMAIL_IN_USE';
      throw err;
    }
  }

  if (await partnerApplicationStore.findPendingByEmail(email)) {
    const err = new Error('A pending partner application already exists for this email.');
    (err as Error & { status?: number; code?: string }).status = 409;
    (err as Error & { code?: string }).code = 'APPLICATION_PENDING';
    throw err;
  }

  if (!passwordHash) {
    passwordHash = await hashPassword(input.password);
  }

  if (!passwordHash || passwordHash.length < 20) {
    const err = new Error('Unable to secure application credentials');
    (err as Error & { status?: number }).status = 500;
    throw err;
  }

  const row = await partnerApplicationStore.create({
    applicantType: input.applicantType,
    email,
    passwordHash,
    displayName: input.displayName.trim(),
    phone: input.phone.trim(),
    businessOrChannelName: input.businessOrChannelName.trim(),
    category: input.category.trim(),
    city: input.city.trim(),
    website: input.website?.trim() || undefined,
    niche: input.niche?.trim() || undefined,
    contentFocus: input.contentFocus?.trim() || undefined,
    socialPrimary: input.socialPrimary?.trim() || undefined,
    audienceSize: input.audienceSize?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    existingUserId,
  });

  const provisioned = await provisionPartnerUser({
    app: row,
    passwordHash,
    existingUserId,
  });

  await partnerApplicationStore.update(row.id, {
    provisionedUserId: provisioned.userId,
    catalogEntityId: provisioned.catalogEntityId,
    passwordHash: '[provisioned]',
    reviewHistory: appendHistory(row, { by: 'system', action: 'submitted' }),
  });

  try {
    await notifyRoles(['admin', 'super_admin'], {
      type: 'system_alert',
      category: 'admin',
      title: input.applicantType === 'seller' ? 'New Seller Application' : 'New Creator Application',
      summary: `${row.displayName} (${row.businessOrChannelName}) submitted a ${input.applicantType} application.`,
      actionUrl: input.applicantType === 'seller' ? '/admin/brand-studio' : '/admin/creator-studio',
      metadata: { applicationId: row.id, applicantType: input.applicantType },
    });
  } catch (error) {
    console.error('[PartnerApplications] Failed to notify admins of new application:', error);
  }

  return {
    applicationId: row.id,
    status: 'pending',
    provisionedUserId: provisioned.userId,
    message:
      'Application received. You can sign in now. Marketplace features stay locked until Admin verifies your identity and enables Marketplace Access.',
  };
}

async function markIdentityVerified(app: PartnerApplication): Promise<void> {
  if (!app.catalogEntityId) return;
  if (app.applicantType === 'seller') {
    const brand = await catalogStore.getBrand(app.catalogEntityId);
    if (!brand) return;
    const saved = normalizeBrandInput(
      {
        ...brand,
        verifiedStatus: true,
        claimStatus: 'verified',
      },
      brand,
    );
    await catalogStore.upsertBrand(saved);
    return;
  }
  const creator = await catalogStore.getCreator(app.catalogEntityId);
  if (!creator) return;
  await catalogStore.upsertCreator(
    normalizeCreatorInput({ ...creator, verifiedStatus: true }, creator),
  );
}

export async function approvePartnerApplication(params: {
  applicationId: string;
  adminUserId: string;
  reviewNote?: string;
}): Promise<PartnerApplication> {
  const app = await partnerApplicationStore.getById(params.applicationId);
  if (!app) {
    const err = new Error('Application not found');
    (err as Error & { status?: number }).status = 404;
    throw err;
  }
  if (app.status !== 'pending') {
    const err = new Error(`Application is already ${app.status}`);
    (err as Error & { status?: number }).status = 409;
    throw err;
  }

  let provisionedUserId = app.provisionedUserId || '';
  let catalogEntityId = app.catalogEntityId || '';

  if (!provisionedUserId) {
    if (!app.passwordHash || app.passwordHash.startsWith('[')) {
      const err = new Error('Application credentials are missing or already cleared');
      (err as Error & { status?: number }).status = 409;
      throw err;
    }
    const provisioned = await provisionPartnerUser({
      app,
      passwordHash: app.passwordHash,
      existingUserId: app.existingUserId,
    });
    provisionedUserId = provisioned.userId;
    catalogEntityId = provisioned.catalogEntityId;
  }

  const verifiedApp: PartnerApplication = {
    ...app,
    provisionedUserId,
    catalogEntityId,
  };
  await markIdentityVerified(verifiedApp);

  const updated = await partnerApplicationStore.update(params.applicationId, {
    status: 'approved',
    reviewedAt: new Date().toISOString(),
    reviewedByUserId: params.adminUserId,
    reviewNote: params.reviewNote,
    provisionedUserId,
    catalogEntityId,
    resubmissionRequested: false,
    passwordHash: '[provisioned]',
    reviewHistory: appendHistory(app, {
      by: params.adminUserId,
      action: 'identity_verified',
      note: params.reviewNote,
    }),
  });
  if (!updated) throw new Error('Failed to update application');

  try {
    await notifyUser(provisionedUserId, {
      type: app.applicantType === 'seller' ? 'seller_update' : 'buyer_update',
      category: app.applicantType === 'seller' ? 'seller' : 'buyer',
      title: 'Marketplace Access Approved',
      summary: 'Your identity was verified. Marketplace features are now unlocked.',
      actionUrl: app.applicantType === 'seller' ? '/admin/brand-profile' : '/admin/creator-profile',
      metadata: { applicationId: app.id },
    });
  } catch (error) {
    console.error('[PartnerApplications] Failed to notify applicant of approval:', error);
  }

  return updated;
}

export async function rejectPartnerApplication(params: {
  applicationId: string;
  adminUserId: string;
  reviewNote?: string;
}): Promise<PartnerApplication> {
  const app = await partnerApplicationStore.getById(params.applicationId);
  if (!app) {
    const err = new Error('Application not found');
    (err as Error & { status?: number }).status = 404;
    throw err;
  }
  if (app.status !== 'pending') {
    const err = new Error(`Application is already ${app.status}`);
    (err as Error & { status?: number }).status = 409;
    throw err;
  }
  const updated = await partnerApplicationStore.update(params.applicationId, {
    status: 'rejected',
    reviewedAt: new Date().toISOString(),
    reviewedByUserId: params.adminUserId,
    reviewNote: params.reviewNote,
    passwordHash: app.passwordHash?.startsWith('[') ? app.passwordHash : '[cleared]',
    reviewHistory: appendHistory(app, {
      by: params.adminUserId,
      action: 'rejected',
      note: params.reviewNote,
    }),
  });
  if (!updated) throw new Error('Failed to update application');

  if (app.provisionedUserId) {
    try {
      await notifyUser(app.provisionedUserId, {
        type: app.applicantType === 'seller' ? 'seller_update' : 'buyer_update',
        category: app.applicantType === 'seller' ? 'seller' : 'buyer',
        title: 'Application Rejected',
        summary: params.reviewNote || 'Your partner application was not approved.',
        actionUrl: app.applicantType === 'seller' ? '/admin/brand-profile' : '/admin/creator-profile',
        metadata: { applicationId: app.id },
      });
    } catch (error) {
      console.error('[PartnerApplications] Failed to notify applicant of rejection:', error);
    }
  }

  return updated;
}

export async function requestPartnerResubmission(params: {
  applicationId: string;
  adminUserId: string;
  reviewNote?: string;
}): Promise<PartnerApplication> {
  const app = await partnerApplicationStore.getById(params.applicationId);
  if (!app) {
    const err = new Error('Application not found');
    (err as Error & { status?: number }).status = 404;
    throw err;
  }
  if (app.status === 'approved') {
    const err = new Error('Cannot request resubmission on an approved application');
    (err as Error & { status?: number }).status = 409;
    throw err;
  }
  const updated = await partnerApplicationStore.update(params.applicationId, {
    status: 'pending',
    resubmissionRequested: true,
    reviewedAt: new Date().toISOString(),
    reviewedByUserId: params.adminUserId,
    reviewNote: params.reviewNote,
    reviewHistory: appendHistory(app, {
      by: params.adminUserId,
      action: 'resubmission_requested',
      note: params.reviewNote,
    }),
  });
  if (!updated) throw new Error('Failed to update application');
  return updated;
}

export async function savePartnerAdminNotes(params: {
  applicationId: string;
  adminUserId: string;
  adminNotes: string;
}): Promise<PartnerApplication> {
  const app = await partnerApplicationStore.getById(params.applicationId);
  if (!app) {
    const err = new Error('Application not found');
    (err as Error & { status?: number }).status = 404;
    throw err;
  }
  const updated = await partnerApplicationStore.update(params.applicationId, {
    adminNotes: params.adminNotes,
    reviewHistory: appendHistory(app, {
      by: params.adminUserId,
      action: 'admin_note',
      note: params.adminNotes.slice(0, 280),
    }),
  });
  if (!updated) throw new Error('Failed to update application');
  return updated;
}

export async function acknowledgePartnerResubmission(params: {
  userId: string;
  email?: string;
  note?: string;
}): Promise<PartnerApplication> {
  const app = await partnerApplicationStore.findForActor({
    userId: params.userId,
    email: params.email,
  });
  if (!app) {
    const err = new Error('No partner application found for this account');
    (err as Error & { status?: number }).status = 404;
    throw err;
  }
  if (app.status !== 'pending' || !app.resubmissionRequested) {
    const err = new Error('No resubmission has been requested for this application');
    (err as Error & { status?: number; code?: string }).status = 409;
    (err as Error & { code?: string }).code = 'RESUBMISSION_NOT_REQUESTED';
    throw err;
  }
  const updated = await partnerApplicationStore.update(app.id, {
    resubmissionRequested: false,
    reviewHistory: appendHistory(app, {
      by: params.userId,
      action: 'applicant_resubmitted',
      note: params.note,
    }),
  });
  if (!updated) throw new Error('Failed to update application');
  return updated;
}

/**
 * Boot-safe path for legacy pending applications that never received a users row.
 * Links an existing email match (preserves UID/CF ID) or provisions from a real
 * argon2 hash. Never allocates a second CF ID for an email that already has a user.
 */
export async function ensureLegacyPendingApplicationsProvisioned(): Promise<{
  linked: number;
  provisioned: number;
  skipped: number;
  errors: string[];
}> {
  const result = { linked: 0, provisioned: 0, skipped: 0, errors: [] as string[] };
  const pending = await partnerApplicationStore.list('pending');
  for (const app of pending) {
    if (app.provisionedUserId) continue;
    try {
      const existing = await loadAdminUserByEmail(app.email);
      if (existing) {
        const current = toUserRole(existing.role);
        const wanted = app.applicantType === 'creator' ? ROLES.CREATOR : ROLES.SELLER;
        if (current !== ROLES.USER && current !== wanted && current !== ROLES.VERIFIED_SELLER) {
          result.skipped += 1;
          result.errors.push(`${app.email}: existing role ${current} is not linkable`);
          continue;
        }
        const provisioned = await provisionPartnerUser({
          app,
          passwordHash: '[provisioned]',
          existingUserId: existing.uid,
        });
        await partnerApplicationStore.update(app.id, {
          provisionedUserId: provisioned.userId,
          catalogEntityId: provisioned.catalogEntityId,
          existingUserId: app.existingUserId || existing.uid,
          passwordHash: '[provisioned]',
          reviewHistory: appendHistory(app, { by: 'system', action: 'legacy_linked' }),
        });
        result.linked += 1;
        continue;
      }
      if (!app.passwordHash || app.passwordHash.startsWith('[')) {
        result.skipped += 1;
        result.errors.push(`${app.email}: no canonical user and no usable password hash`);
        continue;
      }
      const provisioned = await provisionPartnerUser({
        app,
        passwordHash: app.passwordHash,
        existingUserId: app.existingUserId,
      });
      await partnerApplicationStore.update(app.id, {
        provisionedUserId: provisioned.userId,
        catalogEntityId: provisioned.catalogEntityId,
        passwordHash: '[provisioned]',
        reviewHistory: appendHistory(app, { by: 'system', action: 'legacy_provisioned' }),
      });
      result.provisioned += 1;
    } catch (error) {
      result.skipped += 1;
      result.errors.push(
        `${app.email}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  return result;
}

/** Public listing omits password hashes. */
export function sanitizeApplication(app: PartnerApplication) {
  const { passwordHash: _ph, ...rest } = app;
  return rest;
}
