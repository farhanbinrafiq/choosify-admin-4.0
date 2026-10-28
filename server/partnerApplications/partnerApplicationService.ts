import { randomUUID } from 'node:crypto';
import { operationsStore } from '../operations/operationsStore';
import { scheduleOperationsPersist } from '../operations/operationsPersistence';
import { ClaimError, createOwnershipClaim, loadEntity, ownerOf, publicOwnership, activeOwnershipClaims, type ClaimEntityType } from '../claims/ownershipClaims';
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
import { slugForAutomatedCreation } from '../publicHandles/publicHandleCatalog';
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
  /**
   * Server-issued claim reference from a community profile's "Claim" button.
   * When valid, onboarding attaches the applicant to THAT profile (as a Draft
   * ownership claim) instead of creating a new Brand / Creator.
   */
  claimIntentId?: string;
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
    origin: 'owner',
    ownershipSource: 'seller_onboarding',
    overview: {
      email: params.email,
      phone: params.phone,
      address: params.city,
    },
  });
  // Public Identity C3: never another Brand's public handle.
  normalized.slug = await slugForAutomatedCreation('brand', normalized.slug, id);
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
  const created = normalizeCreatorInput({
    name,
    handle: '',
    avatar: '',
    bio: '',
    score: 0,
    bestFor: params.category || '',
    bestForTags: [],
    platforms: [],
    followers: {},
    email: params.email,
    userId: params.userId,
    origin: 'owner',
    ownershipSource: 'creator_onboarding',
    verifiedStatus: false,
    featuredFlag: false,
    videos: [],
    reels: [],
    blogs: [],
    status: 'draft',
  });
  // Public Identity C3: never another Creator's public handle.
  created.slug = await slugForAutomatedCreation('creator', created.slug, created.id);
  const saved = await catalogStore.upsertCreator(created);
  return saved.id;
}

async function provisionPartnerUser(params: {
  app: PartnerApplication;
  passwordHash: string;
  existingUserId?: string;
  /** Claim onboarding: the applicant will claim an EXISTING community profile — do not create a new one. */
  skipCatalogEntity?: boolean;
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
  if (!catalogEntityId && !params.skipCatalogEntity) {
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

  // Claim onboarding: validate the server-issued claim reference BEFORE anything is created.
  const claimTarget = input.claimIntentId ? await validateOnboardingClaimIntent(input.claimIntentId, input.applicantType, existingUserId) : null;

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
    skipCatalogEntity: Boolean(claimTarget),
  });

  let claimId: string | undefined;
  if (claimTarget) {
    // Attach to the EXISTING community profile as a Draft ownership claim. This
    // never grants ownership — staff still verify the claim's documents.
    operationsStore.updateClaimIntent(claimTarget.intentId, { applicationId: row.id, userId: provisioned.userId });
    scheduleOperationsPersist();
    try {
      const { claim } = await createOwnershipClaim({
        req: null,
        type: claimTarget.type,
        entityId: claimTarget.entityId,
        claimant: {
          id: provisioned.userId,
          role: input.applicantType === 'creator' ? 'creator' : 'seller',
          displayName: input.displayName.trim(),
        },
        source: 'onboarding',
        intentId: claimTarget.intentId,
        submit: false,
      });
      claimId = claim.id;
    } catch (error) {
      // The account still exists (no duplicate profile was created); the claimant
      // can restart the claim from the profile page. Report it, do not hide it.
      console.error('[PartnerApplications] Claim onboarding could not open the ownership claim:', error);
    }
  }

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
      eventKey: 'staff.partner_application',
      persona: 'staff',
      title: input.applicantType === 'seller' ? 'New Seller Application' : 'New Creator Application',
      summary: `${row.displayName} (${row.businessOrChannelName}) submitted a ${input.applicantType} application.`,
      // Staff review queue (Requests tab), not the owner Studio.
      actionUrl: input.applicantType === 'seller' ? '/admin/seller-management?filter=requests' : '/admin/creator-management?filter=requests',
      metadata: { applicationId: row.id, applicantType: input.applicantType },
    });
  } catch (error) {
    console.error('[PartnerApplications] Failed to notify admins of new application:', error);
  }

  return {
    applicationId: row.id,
    status: 'pending',
    provisionedUserId: provisioned.userId,
    ...(claimId ? { claimId } : {}),
    message: claimId
      ? 'Application received. Sign in to upload the documents for your ownership claim. You will not control the profile until Choosify verifies the claim.'
      : 'Application received. You can sign in now. Marketplace features stay locked until Admin verifies your identity and enables Marketplace Access.',
  };
}

/** Validate a claim reference for partner onboarding (type match, not expired, unbound or bound to this account, target still claimable). */
async function validateOnboardingClaimIntent(
  intentId: string,
  applicantType: PartnerApplicantType,
  existingUserId: string | undefined,
): Promise<{ intentId: string; type: ClaimEntityType; entityId: string }> {
  const fail = (code: string, message: string, status = 400): never => {
    throw Object.assign(new Error(message), { status, code });
  };
  const intent = operationsStore.getClaimIntent(String(intentId));
  if (!intent) return fail('CLAIM_INTENT_NOT_FOUND', 'This claim link is not valid. Start again from the profile page.', 404);
  const expectedType: ClaimEntityType = applicantType === 'creator' ? 'creator' : 'brand';
  if (intent.entityType !== expectedType) {
    return fail('CLAIM_PERSONA_MISMATCH', intent.entityType === 'brand' ? 'Brand claims need a Seller application.' : 'Creator profile claims need a Creator application.');
  }
  if (Date.parse(intent.expiresAt) < Date.now()) return fail('CLAIM_INTENT_EXPIRED', 'This claim link has expired. Start again from the profile page.', 410);
  if (intent.applicationId || intent.claimId) return fail('CLAIM_INTENT_USED', 'This claim link was already used.', 409);
  if (intent.userId && intent.userId !== existingUserId) return fail('CLAIM_INTENT_OTHER_ACCOUNT', 'This claim link belongs to a different account.', 403);
  const entity = await loadEntity(intent.entityType, intent.entityId);
  if (!entity) return fail('PROFILE_NOT_FOUND', 'The profile for this claim no longer exists.', 404);
  const state = publicOwnership(intent.entityType, entity, activeOwnershipClaims(intent.entityType, entity.id, ownerOf(intent.entityType, entity)).length > 0);
  if (!state.claimable) return fail('NOT_CLAIMABLE', 'This profile can no longer be claimed.', 409);
  void ClaimError;
  return { intentId: intent.id, type: intent.entityType, entityId: entity.id };
}

/**
 * Approving the application confirms the applicant OWNS the brand (claimStatus
 * 'verified'), but it is not a document verification: verifiedStatus — the
 * public "Verified" badge — is set only when the owner's Verification Center
 * request (every required document) is approved by staff.
 */
async function markIdentityVerified(app: PartnerApplication): Promise<void> {
  if (!app.catalogEntityId) return;
  if (app.applicantType === 'seller') {
    const brand = await catalogStore.getBrand(app.catalogEntityId);
    if (!brand) return;
    const saved = normalizeBrandInput({ ...brand, claimStatus: 'verified' }, brand);
    await catalogStore.upsertBrand(saved);
  }
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
      eventKey: 'account.access',
      persona: app.applicantType === 'creator' ? 'creator' : 'seller',
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
        eventKey: 'account.access',
        persona: app.applicantType === 'creator' ? 'creator' : 'seller',
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
