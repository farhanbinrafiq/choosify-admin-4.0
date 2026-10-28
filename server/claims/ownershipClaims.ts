import type { Request } from 'express';
import { randomBytes, randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { operationsStore } from '../operations/operationsStore';
import { scheduleOperationsPersist } from '../operations/operationsPersistence';
import { catalogStore } from '../../lib/vercel-catalog/catalogStore';
import { normalizeBrandInput } from '../catalogContract';
import { normalizeCreatorInput } from '../../lib/vercel-catalog/catalogEditorialContract';
import { recordKey, withRecordLocks } from '../catalog/recordLock';
import { db } from '../db/client';
import { users } from '../db/schema';
import { Logger } from '../lib/logger';
import { sendOwnershipClaimEmail } from '../email/emailService';
import type { OpsAuditEvent, OpsClaimIntent, OpsVerificationDocument, OpsVerificationRequest } from '../operations/types';
import type { CatalogBrand } from '../../src/types/catalog';
import type { CatalogCreator } from '../../lib/vercel-catalog/catalogEditorialTypes';
import { VERIFICATION_DOCUMENT_TYPES, claimantDetailsProblem, missingClaimDocuments } from '../../shared/verification/verificationDocuments';

/**
 * Community Claimable Profiles — the single place ownership claims are decided.
 *
 * OWNERSHIP SOURCE OF TRUTH: brand.sellerId / creator.userId. claimStatus,
 * verifiedStatus and anything a client sends are labels only.
 *
 * ATOMICITY: every ownership-changing transition (claim creation, approval,
 * rejection/withdrawal/expiry label reset, explicit staff assignment) runs
 * inside withRecordLocks([claim:<type>:<id>, <type>:<id>]). The `<type>:<id>`
 * key is the same one Brand/Creator Studio writes and the Marketplace Access
 * routes take, so no other catalog writer can interleave. Guarantee scope = the
 * production topology: ONE Node process (PM2 fork, single instance) with the
 * in-memory catalog/operations stores (see catalog/recordLock.ts). It is NOT a
 * distributed lock; running several API processes would need a shared lock.
 */

export type ClaimEntityType = 'brand' | 'creator';
type Entity = CatalogBrand | CatalogCreator;

export const CLAIM_INTENT_TTL_MS = 24 * 60 * 60 * 1000;
/** An open ownership claim with no activity for this long becomes Expired. */
export const CLAIM_INACTIVITY_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;
export const ACTIVE_VERIFICATION_STATUSES = new Set(['Draft', 'Submitted', 'Under Review']);
const BRAND_CLAIM_ROLES = new Set(['seller', 'verified_seller']);
const CREATOR_CLAIM_ROLES = new Set(['creator']);

export class ClaimError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export const claimLockKey = (type: ClaimEntityType, id: string) => `claim:${type}:${id}`;
export const entityLockKeys = (type: ClaimEntityType, id: string) => [claimLockKey(type, id), recordKey(type, id)];

export function ownerOf(type: ClaimEntityType, entity: Entity | null | undefined): string {
  if (!entity) return '';
  return String((type === 'brand' ? (entity as CatalogBrand).sellerId : (entity as CatalogCreator).userId) || '').trim();
}

export async function loadEntity(type: ClaimEntityType, id: string): Promise<Entity | null> {
  if (!id) return null;
  return type === 'brand' ? (await catalogStore.getBrand(id).catch(() => null)) || null : (await catalogStore.getCreator(id).catch(() => null)) || null;
}

export function requiredRoleFor(type: ClaimEntityType): 'seller' | 'creator' {
  return type === 'brand' ? 'seller' : 'creator';
}

export function roleCanClaim(type: ClaimEntityType, role: string | undefined | null): boolean {
  return (type === 'brand' ? BRAND_CLAIM_ROLES : CREATOR_CLAIM_ROLES).has(String(role || ''));
}

/**
 * owner_verification = the profile's own owner verifying their business;
 * ownership_claim = a claim on a community profile. Legacy rows have no `kind`:
 * a row whose submitter is the current owner is an owner verification.
 */
export function verificationKindOf(row: OpsVerificationRequest, currentOwnerId?: string): 'owner_verification' | 'ownership_claim' {
  if (row.kind) return row.kind;
  return currentOwnerId && currentOwnerId === row.submitted_by ? 'owner_verification' : 'ownership_claim';
}

export function activeOwnershipClaims(type: ClaimEntityType, entityId: string, ownerId = ''): OpsVerificationRequest[] {
  return operationsStore
    .listVerifications({ entityType: type, entityId })
    .filter((r) => ACTIVE_VERIFICATION_STATUSES.has(r.status) && verificationKindOf(r, ownerId) === 'ownership_claim');
}

// ── Public ownership state ─────────────────────────────────────────────────

export type OwnershipState = 'owned_verified' | 'owned' | 'claim_pending' | 'community' | 'unavailable';
/**
 * `verification` (owned, not yet verified only): 'pending' while the owner's
 * document verification is submitted / under review, otherwise 'none'.
 */
export type PublicOwnership = { state: OwnershipState; claimable: boolean; verification?: 'pending' | 'none' };

const REMOVED_MARKETPLACE = new Set(['suspended', 'revoked', 'restricted']);

export function publicOwnership(
  type: ClaimEntityType,
  entity: Entity,
  hasActiveClaim: boolean,
  verificationPending = ownerVerificationPending(type, entity),
): PublicOwnership {
  const owner = ownerOf(type, entity);
  if (owner) {
    // "Verified" = an admin-approved, fully documented verification (or an
    // approved ownership claim) — verifiedStatus is set only by those and
    // cleared by a revoke. Owning the profile, an approved partner
    // application or Marketplace Access alone do NOT make it verified.
    if (entity.verifiedStatus === true) return { state: 'owned_verified', claimable: false };
    return { state: 'owned', claimable: false, verification: verificationPending ? 'pending' : 'none' };
  }
  // Ownerless. Only profiles with explicit COMMUNITY provenance are claimable;
  // legacy / seed / platform profiles without provenance are not silently
  // reclassified as community profiles (no label, no claim CTA).
  if (entity.origin !== 'community') return { state: 'unavailable', claimable: false };
  if (type === 'brand' && REMOVED_MARKETPLACE.has(String((entity as CatalogBrand).marketplaceStatus || ''))) {
    return { state: 'unavailable', claimable: false };
  }
  if (type === 'creator' && (entity as CatalogCreator).status === 'archived') return { state: 'unavailable', claimable: false };
  if (hasActiveClaim) return { state: 'claim_pending', claimable: false };
  return { state: 'community', claimable: true };
}

/** Bulk annotation for public lists — one pass over open claims. */
export function activeClaimEntityIds(type: ClaimEntityType, ownerById: Map<string, string>): Set<string> {
  const ids = new Set<string>();
  for (const r of operationsStore.listVerifications({ entityType: type })) {
    if (!ACTIVE_VERIFICATION_STATUSES.has(r.status)) continue;
    if (verificationKindOf(r, ownerById.get(r.entityId) || '') === 'ownership_claim') ids.add(r.entityId);
  }
  return ids;
}

/** Entity ids whose current owner has a document verification submitted / under review. */
export function pendingOwnerVerificationIds(type: ClaimEntityType, ownerById: Map<string, string>): Set<string> {
  const ids = new Set<string>();
  for (const r of operationsStore.listVerifications({ entityType: type })) {
    if (r.status !== 'Submitted' && r.status !== 'Under Review') continue;
    const owner = ownerById.get(r.entityId) || '';
    if (owner && r.submitted_by === owner && verificationKindOf(r, owner) === 'owner_verification') ids.add(r.entityId);
  }
  return ids;
}

function ownerVerificationPending(type: ClaimEntityType, entity: Entity): boolean {
  const owner = ownerOf(type, entity);
  return owner ? pendingOwnerVerificationIds(type, new Map([[entity.id, owner]])).has(entity.id) : false;
}

export function withPublicOwnership<T extends Entity>(type: ClaimEntityType, rows: T[]): Array<T & { ownership: PublicOwnership }> {
  const owners = new Map(rows.map((r) => [r.id, ownerOf(type, r)]));
  const pending = activeClaimEntityIds(type, owners);
  const verifying = pendingOwnerVerificationIds(type, owners);
  return rows.map((r) => ({ ...r, ownership: publicOwnership(type, r, pending.has(r.id), verifying.has(r.id)) }));
}

// ── Audit ────────────────────────────────────────────────────────────────

export function recordAudit(
  req: Request | null,
  e: Omit<OpsAuditEvent, 'id' | 'at' | 'actorId' | 'actorName' | 'actorRole'> & { actorId?: string; actorName?: string; actorRole?: string },
): OpsAuditEvent {
  const event: OpsAuditEvent = {
    id: `aud_${randomUUID()}`,
    at: new Date().toISOString(),
    actorId: e.actorId || req?.realActorUserId || req?.userId || 'system',
    actorName: e.actorName ?? (req?.realActorUserId ? undefined : req?.user?.displayName),
    actorRole: e.actorRole ?? ((req?.realActorRole || req?.userRole) as string | undefined),
    action: e.action,
    targetType: e.targetType,
    targetId: e.targetId,
    ...(e.targetName ? { targetName: e.targetName } : {}),
    ...(e.refs ? { refs: e.refs } : {}),
    ...(e.before ? { before: e.before } : {}),
    ...(e.after ? { after: e.after } : {}),
    ...(e.note ? { note: e.note.slice(0, 500) } : {}),
  };
  operationsStore.addAuditEvent(event);
  scheduleOperationsPersist();
  Logger.audit(`ownership.${e.action}`, { actorId: event.actorId, targetType: e.targetType, targetId: e.targetId, refs: e.refs });
  return event;
}

// ── Claimant email (best effort, never throws) ───────────────────────────

export async function emailUser(userId: string, mail: Parameters<typeof sendOwnershipClaimEmail>[1]): Promise<void> {
  try {
    const rows = await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
    if (rows[0]?.email) await sendOwnershipClaimEmail(rows[0].email, mail);
  } catch (err) {
    Logger.warn('ownership claim email failed', { error: err instanceof Error ? err.message : String(err) });
  }
}

export async function loadClaimant(userId: string): Promise<{ id: string; role: string; displayName: string; email: string; choosifyUserId: string | null } | null> {
  const rows = await db
    .select({ id: users.id, role: users.role, displayName: users.displayName, email: users.email, choosifyUserId: users.choosifyUserId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const u = rows[0];
  return u ? { id: u.id, role: String(u.role), displayName: u.displayName || '', email: u.email, choosifyUserId: u.choosifyUserId || null } : null;
}

// ── Catalog label writes (always inside the entity lock) ──────────────────

export async function writeEntity(type: ClaimEntityType, existing: Entity, patch: Record<string, unknown>): Promise<Entity> {
  if (type === 'brand') {
    const next = normalizeBrandInput({ ...existing, ...patch }, existing as CatalogBrand);
    return catalogStore.upsertBrand({ ...next, slug: (existing as CatalogBrand).slug });
  }
  const next = normalizeCreatorInput({ ...existing, ...patch }, existing as CatalogCreator);
  return catalogStore.upsertCreator({ ...next, slug: (existing as CatalogCreator).slug });
}

/** After a claim closes: ownerless profile with no other open claim → back to 'community'. Never touches an owner. */
async function releaseClaimLabelLocked(type: ClaimEntityType, entityId: string): Promise<void> {
  const entity = await loadEntity(type, entityId);
  if (!entity) return;
  if (ownerOf(type, entity)) return; // owned profiles keep their label
  if (activeOwnershipClaims(type, entityId).length) return;
  const label = (entity as { claimStatus?: string }).claimStatus;
  if (label !== 'community') await writeEntity(type, entity, { claimStatus: 'community' });
}

// ── Claim intents ────────────────────────────────────────────────────────

export function isPrivateUploadUrl(url: unknown): boolean {
  return typeof url === 'string' && url.includes('/catalog/media/private/');
}

export async function createClaimIntent(params: {
  type: ClaimEntityType;
  entityId: string;
  source?: OpsClaimIntent['source'];
  userId?: string;
}): Promise<{ intent: OpsClaimIntent; ownership: PublicOwnership }> {
  const entity = await loadEntity(params.type, params.entityId);
  if (!entity) throw new ClaimError(404, 'PROFILE_NOT_FOUND', 'This profile does not exist.');
  const ownership = publicOwnership(params.type, entity, activeOwnershipClaims(params.type, entity.id, ownerOf(params.type, entity)).length > 0);
  if (!ownership.claimable) {
    throw new ClaimError(409, 'NOT_CLAIMABLE', ownershipBlockedMessage(ownership.state), { ownership });
  }
  const now = Date.now();
  const intent = operationsStore.addClaimIntent({
    id: `ci_${randomBytes(16).toString('hex')}`,
    entityType: params.type,
    entityId: entity.id,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + CLAIM_INTENT_TTL_MS).toISOString(),
    source: params.source === 'invitation' ? 'invitation' : 'storefront',
    ...(params.userId ? { userId: params.userId } : {}),
  });
  scheduleOperationsPersist();
  return { intent, ownership };
}

export function ownershipBlockedMessage(state: OwnershipState): string {
  switch (state) {
    case 'owned':
    case 'owned_verified':
      return 'This profile already has a verified owner, so it cannot be claimed. If you believe this is wrong, contact Choosify support.';
    case 'claim_pending':
      return 'Ownership verification for this profile is already in progress.';
    default:
      return 'This profile cannot be claimed.';
  }
}

/**
 * Validate an intent for use by `userId` (optional for anonymous reads). Binds
 * the intent to the first authenticated account that uses it; afterwards no
 * other account can use it.
 */
/**
 * Resolve a claim reference for the current viewer. The reference is bound to
 * the first account that CAN claim it (Seller for brands, Creator for creator
 * profiles). Viewing it with any other account (Consumer, wrong partner type,
 * staff) does not bind it, so the same link keeps working after the person
 * signs in with — or applies for — the right account type.
 */
export async function resolveClaimIntent(intentId: string, userId?: string, role?: string): Promise<{ intent: OpsClaimIntent; entity: Entity }> {
  const intent = operationsStore.getClaimIntent(String(intentId || ''));
  if (!intent) throw new ClaimError(404, 'CLAIM_INTENT_NOT_FOUND', 'This claim link is not valid. Start again from the profile page.');
  if (intent.userId && userId && intent.userId !== userId) {
    throw new ClaimError(403, 'CLAIM_INTENT_OTHER_ACCOUNT', 'This claim link belongs to a different account. Start again from the profile page.');
  }
  // An intent that already produced a claim stays resolvable (idempotent continuation).
  if (!intent.claimId && Date.parse(intent.expiresAt) < Date.now()) {
    throw new ClaimError(410, 'CLAIM_INTENT_EXPIRED', 'This claim link has expired. Start again from the profile page.');
  }
  const entity = await loadEntity(intent.entityType, intent.entityId);
  if (!entity) throw new ClaimError(404, 'PROFILE_NOT_FOUND', 'The profile for this claim no longer exists.');
  if (userId && !intent.userId && roleCanClaim(intent.entityType, String(role || ''))) {
    operationsStore.updateClaimIntent(intent.id, { userId });
    scheduleOperationsPersist();
    intent.userId = userId;
  }
  return { intent, entity };
}

// ── Claim creation ───────────────────────────────────────────────────────

function sanitizeClaimDocuments(raw: unknown): OpsVerificationDocument[] {
  const docs = Array.isArray(raw) ? raw : [];
  return docs.map((d, i) => {
    const doc = (d || {}) as Record<string, unknown>;
    const type = String(doc.type || '');
    if (!(VERIFICATION_DOCUMENT_TYPES as readonly string[]).includes(type) || type === 'Profile Photo') {
      throw new ClaimError(400, 'INVALID_DOCUMENT_TYPE', `Unsupported document type: ${type || '(none)'}`);
    }
    if (!isPrivateUploadUrl(doc.doc_url)) {
      throw new ClaimError(400, 'DOCUMENT_NOT_PRIVATE_UPLOAD', 'Claim documents must be uploaded through the private verification upload.');
    }
    return {
      id: `doc_${randomUUID()}_${i}`,
      type: type as OpsVerificationDocument['type'],
      name: String(doc.name || type).slice(0, 200),
      doc_url: String(doc.doc_url),
      status: 'pending' as const,
    };
  });
}

export async function createOwnershipClaim(params: {
  req: Request | null;
  type: ClaimEntityType;
  entityId: string;
  claimant: { id: string; role: string; displayName: string };
  source: OpsVerificationRequest['claimSource'];
  intentId?: string;
  documents?: unknown;
  submit?: boolean;
  claimantDetails?: OpsVerificationRequest['claimantDetails'];
}): Promise<{ claim: OpsVerificationRequest; reused: boolean }> {
  const { type, entityId, claimant } = params;
  return withRecordLocks(entityLockKeys(type, entityId), async () => {
    const entity = await loadEntity(type, entityId);
    if (!entity) throw new ClaimError(404, 'PROFILE_NOT_FOUND', 'This profile does not exist.');
    const owner = ownerOf(type, entity);
    if (owner === claimant.id) {
      throw new ClaimError(409, 'ALREADY_OWNER', 'You already own this profile — use your Verification Center to verify it.');
    }
    if (owner) throw new ClaimError(409, 'PROFILE_ALREADY_OWNED', ownershipBlockedMessage('owned'));
    if (!roleCanClaim(type, claimant.role)) {
      throw new ClaimError(403, 'CLAIM_PERSONA_REQUIRED', type === 'brand' ? 'Claiming a Brand needs a Seller account.' : 'Claiming a Creator profile needs a Creator account.', {
        requiredRole: requiredRoleFor(type),
      });
    }

    let intent: OpsClaimIntent | null = null;
    if (params.intentId) {
      intent = operationsStore.getClaimIntent(params.intentId);
      if (!intent || intent.entityType !== type || intent.entityId !== entityId) {
        throw new ClaimError(400, 'CLAIM_INTENT_MISMATCH', 'This claim link does not match the profile.');
      }
      if (intent.userId && intent.userId !== claimant.id) {
        throw new ClaimError(403, 'CLAIM_INTENT_OTHER_ACCOUNT', 'This claim link belongs to a different account.');
      }
      if (intent.claimId) {
        const prior = operationsStore.getVerification(intent.claimId);
        if (prior && prior.submitted_by === claimant.id && ACTIVE_VERIFICATION_STATUSES.has(prior.status)) return { claim: prior, reused: true };
        // A claim link is single-use: after its claim closed, a new claim starts from the profile page.
        if (prior) throw new ClaimError(409, 'CLAIM_INTENT_USED', 'This claim link was already used. Start a new claim from the profile page.');
      }
      if (!intent.claimId && Date.parse(intent.expiresAt) < Date.now() && params.source !== 'onboarding') {
        throw new ClaimError(410, 'CLAIM_INTENT_EXPIRED', 'This claim link has expired. Start again from the profile page.');
      }
    }

    const active = activeOwnershipClaims(type, entityId, owner);
    const mine = active.find((r) => r.submitted_by === claimant.id);
    if (mine) return { claim: mine, reused: true };
    if (active.length) throw new ClaimError(409, 'CLAIM_IN_PROGRESS', ownershipBlockedMessage('claim_pending'));
    if (entity.origin === 'owner' || publicOwnership(type, entity, false).state === 'unavailable') {
      throw new ClaimError(409, 'NOT_CLAIMABLE', 'This profile cannot be claimed.');
    }

    const documents = sanitizeClaimDocuments(params.documents);
    const status: OpsVerificationRequest['status'] = params.submit ? 'Submitted' : 'Draft';
    if (params.submit) {
      const detailsProblem = claimantDetailsProblem(params.claimantDetails);
      if (detailsProblem) throw new ClaimError(400, 'CLAIMANT_DETAILS_MISSING', `Add your details before submitting: ${detailsProblem}`);
      const missing = missingClaimDocuments(type, documents, params.claimantDetails?.relationship);
      if (missing.length) {
        throw new ClaimError(400, 'CLAIM_DOCUMENTS_MISSING', `Upload every required document before submitting. Missing: ${missing.map((m) => m.label).join(', ')}`);
      }
    }
    const entityName = (entity as { name: string }).name;
    const now = new Date().toISOString();
    const claim = operationsStore.createVerification({
      entityType: type,
      entityId,
      entityName,
      brand_id: entityId,
      brand_name: entityName,
      logo_url: type === 'brand' ? (entity as CatalogBrand).logo || '' : (entity as CatalogCreator).avatar || '',
      submitted_by: claimant.id,
      submitted_by_name: claimant.displayName || claimant.id,
      status,
      kind: 'ownership_claim',
      claimSource: params.source || 'storefront',
      ...(intent ? { claimIntentId: intent.id } : {}),
      ...(params.claimantDetails && !claimantDetailsProblem(params.claimantDetails) ? { claimantDetails: params.claimantDetails } : {}),
      documents,
      audit_trail: [
        {
          timestamp: now,
          action: status === 'Draft' ? 'Claim Started' : 'Claim Submitted',
          actor: claimant.displayName || claimant.id,
          details: `Ownership claim for ${entityName} (${params.source || 'storefront'})`,
        },
      ],
    } as Omit<OpsVerificationRequest, 'id' | 'created_at' | 'updated_at' | 'reviews'> as never) as OpsVerificationRequest;
    if (intent) operationsStore.updateClaimIntent(intent.id, { claimId: claim.id, userId: claimant.id });
    await writeEntity(type, entity, { claimStatus: 'pending' });
    scheduleOperationsPersist();
    recordAudit(params.req, {
      action: status === 'Draft' ? 'claim_started' : 'claim_submitted',
      actorId: claimant.id,
      actorName: claimant.displayName,
      actorRole: claimant.role,
      targetType: type,
      targetId: entityId,
      targetName: entityName,
      refs: { claimId: claim.id, claimantId: claimant.id, source: params.source || 'storefront' },
    });
    return { claim, reused: false };
  });
}

// ── Approval (atomic) ─────────────────────────────────────────────────────

export async function approveOwnershipClaim(params: {
  req: Request;
  claimId: string;
  reviewerId: string;
  reviewerName: string;
  feedback: string;
}): Promise<{ claim: OpsVerificationRequest; entity: Entity; superseded: OpsVerificationRequest[] }> {
  const initial = operationsStore.getVerification(params.claimId);
  if (!initial) throw new ClaimError(404, 'CLAIM_NOT_FOUND', 'Claim not found');
  const type = initial.entityType as ClaimEntityType;
  const entityId = initial.entityId;
  return withRecordLocks(entityLockKeys(type, entityId), async () => {
    // 2. Reload everything inside the lock.
    const claim = operationsStore.getVerification(params.claimId);
    const entity = await loadEntity(type, entityId);
    if (!claim || !entity) throw new ClaimError(404, 'CLAIM_NOT_FOUND', 'Claim or profile not found');
    const owner = ownerOf(type, entity);
    if (verificationKindOf(claim, owner) !== 'ownership_claim') throw new ClaimError(409, 'NOT_A_CLAIM', 'This request is not an ownership claim.');
    // 3. Eligible state + still ownerless.
    if (claim.status !== 'Submitted' && claim.status !== 'Under Review') {
      throw new ClaimError(409, 'CLAIM_NOT_REVIEWABLE', `This claim is ${claim.status.toLowerCase()} and cannot be approved.`);
    }
    if (owner) {
      throw new ClaimError(409, 'PROFILE_ALREADY_OWNED', 'This profile already has an owner. Approving the claim would replace them, so it was refused. Use the explicit ownership-dispute workflow instead.');
    }
    if (claim.submitted_by === params.reviewerId) throw new ClaimError(403, 'SELF_APPROVAL', 'You cannot approve your own claim.');
    // 4. Claimant still exists and is eligible.
    const claimant = await loadClaimant(claim.submitted_by);
    if (!claimant || !roleCanClaim(type, claimant.role)) {
      throw new ClaimError(409, 'CLAIMANT_NOT_ELIGIBLE', 'The claimant account no longer exists or no longer has the required Seller/Creator account.');
    }
    const missing = missingClaimDocuments(type, claim.documents || [], claim.claimantDetails?.relationship);
    const notApproved = (claim.documents || []).filter((d) => d.status !== 'approved');
    if (missing.length) throw new ClaimError(400, 'CLAIM_DOCUMENTS_MISSING', `Required documents are missing: ${missing.map((m) => m.label).join(', ')}.`);
    if (notApproved.length) throw new ClaimError(400, 'CLAIM_DOCUMENTS_NOT_APPROVED', 'Approve (or have the claimant replace) every document before approving ownership.');

    // 5–6. Attach the owner to the EXISTING profile (slug/handle/id unchanged; Marketplace Access untouched).
    const now = new Date().toISOString();
    const ownerPatch: Record<string, unknown> =
      type === 'brand'
        ? { sellerId: claimant.id, claimStatus: 'verified', verifiedStatus: true, ownershipVerifiedAt: now, ownershipSource: 'claim' }
        : { userId: claimant.id, claimStatus: 'verified', verifiedStatus: true, ownershipVerifiedAt: now, ownershipSource: 'claim' };
    const savedEntity = await writeEntity(type, entity, ownerPatch);

    // 7. Mark the claim and resolve the other open claims (policy: superseded → Rejected).
    const approved = operationsStore.updateVerification(claim.id, {
      status: 'Approved',
      closedAt: now,
      reviews: [
        ...(claim.reviews || []),
        { id: `rev_${randomUUID()}`, reviewer_id: params.reviewerId, reviewer_name: params.reviewerName, status: 'approved', feedback: params.feedback, reviewed_at: now },
      ],
      audit_trail: [...claim.audit_trail, { timestamp: now, action: 'Ownership Approved', actor: params.reviewerName, details: params.feedback }],
    }) as OpsVerificationRequest;
    const superseded: OpsVerificationRequest[] = [];
    for (const other of activeOwnershipClaims(type, entityId)) {
      if (other.id === claim.id) continue;
      const closed = operationsStore.updateVerification(other.id, {
        status: 'Rejected',
        closedAt: now,
        closedReason: 'superseded',
        reviews: [
          ...(other.reviews || []),
          { id: `rev_${randomUUID()}`, reviewer_id: params.reviewerId, reviewer_name: 'Choosify', status: 'rejected', feedback: 'Ownership of this profile was verified for another applicant.', reviewed_at: now },
        ],
        audit_trail: [...other.audit_trail, { timestamp: now, action: 'Claim Closed', actor: 'Choosify', details: 'Superseded: ownership verified for another applicant' }],
      });
      if (closed) superseded.push(closed);
    }
    scheduleOperationsPersist();
    // 8. Audit.
    recordAudit(params.req, {
      action: 'claim_approved',
      targetType: type,
      targetId: entityId,
      targetName: (entity as { name: string }).name,
      refs: { claimId: claim.id, claimantId: claimant.id },
      before: { owner: null },
      after: { owner: claimant.id, ownershipSource: 'claim' },
      note: params.feedback,
    });
    return { claim: approved, entity: savedEntity, superseded };
  });
}

/** Reject / withdraw / expire: close the claim and reset the label only for ownerless profiles. */
export async function closeOwnershipClaim(params: {
  req: Request | null;
  claimId: string;
  status: 'Rejected' | 'Withdrawn' | 'Expired';
  actorName: string;
  feedback?: string;
  reviewerId?: string;
}): Promise<OpsVerificationRequest> {
  const initial = operationsStore.getVerification(params.claimId);
  if (!initial) throw new ClaimError(404, 'CLAIM_NOT_FOUND', 'Claim not found');
  const type = initial.entityType as ClaimEntityType;
  return withRecordLocks(entityLockKeys(type, initial.entityId), async () => {
    const claim = operationsStore.getVerification(params.claimId);
    if (!claim) throw new ClaimError(404, 'CLAIM_NOT_FOUND', 'Claim not found');
    if (!ACTIVE_VERIFICATION_STATUSES.has(claim.status)) {
      throw new ClaimError(409, 'CLAIM_CLOSED', `This claim is already ${claim.status.toLowerCase()}.`);
    }
    const now = new Date().toISOString();
    const action = params.status === 'Rejected' ? 'Claim Rejected' : params.status === 'Withdrawn' ? 'Claim Withdrawn' : 'Claim Expired';
    const updated = operationsStore.updateVerification(claim.id, {
      status: params.status,
      closedAt: now,
      closedReason: params.status.toLowerCase(),
      ...(params.status === 'Rejected'
        ? {
            reviews: [
              ...(claim.reviews || []),
              { id: `rev_${randomUUID()}`, reviewer_id: params.reviewerId || 'system', reviewer_name: params.actorName, status: 'rejected' as const, feedback: params.feedback || '', reviewed_at: now },
            ],
          }
        : {}),
      audit_trail: [...claim.audit_trail, { timestamp: now, action, actor: params.actorName, details: params.feedback || action }],
    }) as OpsVerificationRequest;
    await releaseClaimLabelLocked(type, claim.entityId);
    scheduleOperationsPersist();
    recordAudit(params.req, {
      action: `claim_${params.status.toLowerCase()}`,
      ...(params.req ? {} : { actorId: 'system', actorName: 'Choosify' }),
      targetType: type,
      targetId: claim.entityId,
      targetName: claim.entityName,
      refs: { claimId: claim.id, claimantId: claim.submitted_by },
      ...(params.feedback ? { note: params.feedback } : {}),
    });
    return updated;
  });
}

let lastExpirySweep = 0;
/** Lazy expiry of inactive ownership claims (called from read paths, at most once a minute). */
export async function expireStaleClaims(): Promise<OpsVerificationRequest[]> {
  if (Date.now() - lastExpirySweep < 60_000) return [];
  lastExpirySweep = Date.now();
  const expired: OpsVerificationRequest[] = [];
  for (const row of operationsStore.listVerifications()) {
    if (row.kind !== 'ownership_claim' || !ACTIVE_VERIFICATION_STATUSES.has(row.status)) continue;
    if (Date.now() - Date.parse(row.updated_at) < CLAIM_INACTIVITY_EXPIRY_MS) continue;
    try {
      const closed = await closeOwnershipClaim({ req: null, claimId: row.id, status: 'Expired', actorName: 'Choosify', feedback: 'No activity for 30 days.' });
      expired.push(closed);
      void emailUser(row.submitted_by, {
        subject: `Your ownership claim for ${row.entityName} expired`,
        heading: 'Ownership claim expired',
        lines: [`Your claim for ${row.entityName} had no activity for 30 days, so it was closed.`, 'You can start a new claim from the profile page at any time.'],
      });
    } catch (err) {
      Logger.warn('claim expiry failed', { claimId: row.id, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return expired;
}

/** For tests: allow an immediate sweep. */
export function resetExpirySweepThrottle(): void {
  lastExpirySweep = 0;
}

// ── Explicit staff ownership assignment (the separate dispute workflow) ──

export async function assignOwnerExplicitly(params: {
  req: Request;
  type: ClaimEntityType;
  entityId: string;
  userId: string;
  reason: string;
  replaceExistingOwner: boolean;
}): Promise<{ entity: Entity; previousOwner: string; closedClaims: OpsVerificationRequest[] }> {
  return withRecordLocks(entityLockKeys(params.type, params.entityId), async () => {
    const entity = await loadEntity(params.type, params.entityId);
    if (!entity) throw new ClaimError(404, 'PROFILE_NOT_FOUND', 'Profile not found');
    const previousOwner = ownerOf(params.type, entity);
    if (previousOwner === params.userId) throw new ClaimError(409, 'ALREADY_OWNER', 'That account already owns this profile.');
    if (previousOwner && !params.replaceExistingOwner) {
      throw new ClaimError(409, 'PROFILE_ALREADY_OWNED', 'This profile already has an owner. Replacing an owner needs replaceExistingOwner: true and a documented reason.');
    }
    const user = await loadClaimant(params.userId);
    if (!user) throw new ClaimError(404, 'USER_NOT_FOUND', 'Target account not found');
    if (!roleCanClaim(params.type, user.role)) {
      throw new ClaimError(409, 'CLAIMANT_NOT_ELIGIBLE', params.type === 'brand' ? 'The account must be a Seller account.' : 'The account must be a Creator account.');
    }
    const now = new Date().toISOString();
    const saved = await writeEntity(params.type, entity, {
      ...(params.type === 'brand' ? { sellerId: user.id } : { userId: user.id }),
      claimStatus: 'verified',
      // Staff assigned the owner; documents were not reviewed, so the profile
      // is owned but not "Verified" until the owner's verification is approved.
      verifiedStatus: false,
      ownershipVerifiedAt: now,
      ownershipSource: 'admin_assigned',
    });
    const closedClaims: OpsVerificationRequest[] = [];
    for (const c of activeOwnershipClaims(params.type, params.entityId)) {
      const closed = operationsStore.updateVerification(c.id, {
        status: 'Rejected',
        closedAt: now,
        closedReason: 'owner_assigned_by_staff',
        audit_trail: [...c.audit_trail, { timestamp: now, action: 'Claim Closed', actor: 'Choosify', details: 'Ownership was assigned by Choosify staff' }],
      });
      if (closed) closedClaims.push(closed);
    }
    scheduleOperationsPersist();
    recordAudit(params.req, {
      action: previousOwner ? 'owner_replaced_by_staff' : 'owner_assigned_by_staff',
      targetType: params.type,
      targetId: params.entityId,
      targetName: (entity as { name: string }).name,
      refs: { userId: user.id },
      before: { owner: previousOwner || null },
      after: { owner: user.id, ownershipSource: 'admin_assigned' },
      note: params.reason,
    });
    return { entity: saved, previousOwner, closedClaims };
  });
}
