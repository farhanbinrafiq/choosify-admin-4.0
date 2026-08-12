import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { sellerProfiles, users } from '../db/schema';
import { allocateNextChoosifyUserId } from '../auth/choosifyUserId';
import { hashPassword, verifyPassword } from '../auth/jwtTokens';
import { loadAdminUserByEmail } from '../operations/operationsDb';
import { ROLES, toUserRole } from '../permissions/roles';
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

export async function submitPartnerApplication(input: PartnerApplyInput): Promise<{
  applicationId: string;
  status: 'pending';
  message: string;
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
      // Consumer → partner application: preserve uid/CF on approval.
      // Applicant must prove they own the account (password verify).
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
      // Keep the existing argon2 hash — do not store a second secret.
      passwordHash = userRow!.passwordHash!;
    } else {
      const err = new Error('This email is already registered with another dashboard role.');
      (err as Error & { status?: number; code?: string }).status = 409;
      (err as Error & { code?: string }).code = 'EMAIL_IN_USE';
      throw err;
    }
  }

  if (partnerApplicationStore.findPendingByEmail(email)) {
    const err = new Error('A pending partner application already exists for this email.');
    (err as Error & { status?: number; code?: string }).status = 409;
    (err as Error & { code?: string }).code = 'APPLICATION_PENDING';
    throw err;
  }

  // Canonical argon2 hash immediately — raw password never persisted.
  if (!passwordHash) {
    passwordHash = await hashPassword(input.password);
  }

  if (!passwordHash || passwordHash.length < 20) {
    const err = new Error('Unable to secure application credentials');
    (err as Error & { status?: number }).status = 500;
    throw err;
  }

  const row = partnerApplicationStore.create({
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

  return {
    applicationId: row.id,
    status: 'pending',
    message:
      'Application received. Choosify Admin will review your partner request. You cannot access Seller/Creator tools until approved.',
  };
}

export async function approvePartnerApplication(params: {
  applicationId: string;
  adminUserId: string;
  reviewNote?: string;
}): Promise<PartnerApplication> {
  const app = partnerApplicationStore.getById(params.applicationId);
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

  if (!app.passwordHash || app.passwordHash.startsWith('[')) {
    const err = new Error('Application credentials are missing or already cleared');
    (err as Error & { status?: number }).status = 409;
    throw err;
  }

  const role = app.applicantType === 'creator' ? ROLES.CREATOR : ROLES.SELLER;
  const now = new Date();
  let provisionedUserId = '';

  if (app.existingUserId) {
    const rows = await db.select().from(users).where(eq(users.id, app.existingUserId)).limit(1);
    const user = rows[0];
    if (!user) {
      const err = new Error('Linked Consumer account no longer exists');
      (err as Error & { status?: number }).status = 409;
      throw err;
    }
    const current = toUserRole(user.role);
    if (current !== ROLES.USER) {
      const err = new Error('Linked account is no longer a Consumer');
      (err as Error & { status?: number }).status = 409;
      throw err;
    }

    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({
          role,
          displayName: app.displayName,
          updatedAt: now,
        })
        .where(eq(users.id, user.id));
      if (role === ROLES.SELLER) {
        await tx
          .insert(sellerProfiles)
          .values({
            userId: user.id,
            storeName: app.businessOrChannelName,
            phone: app.phone,
            category: app.category,
            city: app.city,
            website: app.website || null,
            createdAt: now,
          })
          .onConflictDoUpdate({
            target: sellerProfiles.userId,
            set: {
              storeName: app.businessOrChannelName,
              phone: app.phone,
              category: app.category,
              city: app.city,
              website: app.website || null,
            },
          });
      }
    });
    provisionedUserId = user.id;
  } else {
    const existing = await loadAdminUserByEmail(app.email);
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
        email: app.email,
        passwordHash: app.passwordHash,
        displayName: app.displayName,
        role,
        emailVerified: false,
        choosifyUserId,
        createdAt: now,
        updatedAt: now,
      });
      if (role === ROLES.SELLER) {
        await tx.insert(sellerProfiles).values({
          userId: uid,
          storeName: app.businessOrChannelName,
          phone: app.phone,
          category: app.category,
          city: app.city,
          website: app.website || null,
          createdAt: now,
        });
      }
    });
    provisionedUserId = uid;
  }

  const updated = partnerApplicationStore.update(params.applicationId, {
    status: 'approved',
    reviewedAt: now.toISOString(),
    reviewedByUserId: params.adminUserId,
    reviewNote: params.reviewNote,
    provisionedUserId,
    // Clear hash from pending store after provisioning (security hygiene)
    passwordHash: '[provisioned]',
  });
  if (!updated) throw new Error('Failed to update application');
  return updated;
}

export async function rejectPartnerApplication(params: {
  applicationId: string;
  adminUserId: string;
  reviewNote?: string;
}): Promise<PartnerApplication> {
  const app = partnerApplicationStore.getById(params.applicationId);
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
  const updated = partnerApplicationStore.update(params.applicationId, {
    status: 'rejected',
    reviewedAt: new Date().toISOString(),
    reviewedByUserId: params.adminUserId,
    reviewNote: params.reviewNote,
    passwordHash: '[cleared]',
  });
  if (!updated) throw new Error('Failed to update application');
  return updated;
}

/** Public listing omits password hashes. */
export function sanitizeApplication(app: PartnerApplication) {
  const { passwordHash: _ph, ...rest } = app;
  return rest;
}
