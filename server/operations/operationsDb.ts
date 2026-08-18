import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { sellerProfiles, users } from '../db/schema';
import { getAdminFirestore, hasFirebaseAdminCredentials } from '../firestoreAdmin';
import type {
  OpsCoupon,
  OpsCouponUsage,
  OpsFeeCharge,
  OpsLead,
  OpsPaymentOptionsConfig,
  OpsReturnRequest,
  OpsReview,
  OpsSellerBookingSettings,
  OpsStorefrontOrder,
  OpsVerificationRequest,
  RolePermissionsMap,
} from './types';
import type { OpsShipment } from './shipmentStore';
import { getDocumentById } from '../lib/firestore/queryHelpers';

const DOC_ID = 'snapshot';

/** Ops snapshot still lives in Firestore; user profiles live in Postgres. */
export const useOperationsFirestore =
  process.env.OPERATIONS_USE_FIRESTORE === 'true' && hasFirebaseAdminCredentials();

export interface OperationsSnapshot {
  orders: OpsStorefrontOrder[];
  coupons: OpsCoupon[];
  couponUsage: OpsCouponUsage[];
  reviews: OpsReview[];
  leads: OpsLead[];
  jobPostings?: import('./types').OpsJobPosting[];
  jobApplications?: import('./types').OpsJobApplication[];
  permissions: RolePermissionsMap;
  shipments: OpsShipment[];
  featureFlags: Record<string, boolean>;
  sellerOffers: OpsSellerOfferRow[];
  feeCharges?: OpsFeeCharge[];
  paymentOptionsConfig?: OpsPaymentOptionsConfig;
  sellerBookingSettings?: Record<string, OpsSellerBookingSettings>;
  returns?: OpsReturnRequest[];
  verifications?: OpsVerificationRequest[];
}

export interface OpsSellerOfferRow {
  id: string;
  productName: string;
  category: string;
  brand: string;
  price: string;
  description: string;
  sellerName: string;
  sellerPhone: string;
  sellerRegion: string;
  status: 'new' | 'reviewing' | 'approved' | 'rejected';
  createdAt: string;
  updatedAt: string;
}

async function firestoreOrThrow() {
  const firestore = await getAdminFirestore();
  if (!firestore) {
    throw new Error('Firestore Admin is not configured.');
  }
  return firestore;
}

/**
 * Sprint 12 pre-beta audit — P0 fix: this snapshot previously ONLY persisted
 * when OPERATIONS_USE_FIRESTORE=true (loadOperationsSnapshot/saveOperationsSnapshot
 * both no-op'd otherwise). Unlike every sibling domain (escrow, catalog,
 * commerce, messaging, payments, ads, moderation — all of which fall back to a
 * `.data/<domain>-memory-snapshot.json` disk snapshot when Firestore isn't
 * configured), operationsStore had NO fallback at all — returns, verifications,
 * reviews, coupons, leads, job postings, seller offers, and fee charges were
 * silently wiped on every server restart in local/dev/non-Firestore deploys.
 * This adds the same established disk-snapshot pattern as the fallback.
 */
const DISK_SNAPSHOT_PATH =
  process.env.OPERATIONS_MEMORY_SNAPSHOT_PATH?.trim() ||
  join(process.cwd(), '.data', 'operations-memory-snapshot.json');

function loadDiskSnapshot(): OperationsSnapshot | null {
  if (!existsSync(DISK_SNAPSHOT_PATH)) return null;
  try {
    return JSON.parse(readFileSync(DISK_SNAPSHOT_PATH, 'utf8')) as OperationsSnapshot;
  } catch (error) {
    console.warn('[OperationsPersist] Failed to load disk snapshot:', error);
    return null;
  }
}

function saveDiskSnapshot(snapshot: OperationsSnapshot): void {
  try {
    mkdirSync(dirname(DISK_SNAPSHOT_PATH), { recursive: true });
    writeFileSync(DISK_SNAPSHOT_PATH, JSON.stringify(snapshot), 'utf8');
  } catch (error) {
    console.error('[OperationsPersist] Failed to save disk snapshot:', error);
  }
}

export async function loadOperationsSnapshot(): Promise<OperationsSnapshot | null> {
  if (useOperationsFirestore) return getDocumentById<OperationsSnapshot>('ops_state', DOC_ID);
  return loadDiskSnapshot();
}

export async function saveOperationsSnapshot(snapshot: OperationsSnapshot): Promise<void> {
  if (useOperationsFirestore) {
    const firestore = await firestoreOrThrow();
    await firestore.collection('ops_state').doc(DOC_ID).set(snapshot, { merge: true });
    return;
  }
  saveDiskSnapshot(snapshot);
}

export async function loadAdminUser(
  uid: string,
): Promise<{ role: string; displayName: string; email: string } | null> {
  const rows = await db.select().from(users).where(eq(users.id, uid)).limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    role: row.role,
    displayName: row.displayName || row.email || 'Admin User',
    email: row.email || '',
  };
}

export async function loadAdminUserByEmail(
  email: string,
): Promise<{ uid: string; role: string; displayName: string; email: string } | null> {
  const normalized = email.trim().toLowerCase();
  const rows = await db.select().from(users).where(eq(users.email, normalized)).limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    uid: row.id,
    role: row.role,
    displayName: row.displayName || row.email || 'Admin User',
    email: row.email || normalized,
  };
}

export async function upsertAdminUserProfile(input: {
  uid: string;
  email: string;
  displayName: string;
  role: string;
  storeName?: string;
  phone?: string;
  category?: string;
  city?: string;
  website?: string;
  passwordHash?: string;
}): Promise<void> {
  const email = input.email.trim().toLowerCase();
  const displayName = input.displayName.trim() || email;
  const now = new Date();

  await db
    .insert(users)
    .values({
      id: input.uid,
      email,
      displayName,
      role: input.role as (typeof users.$inferInsert)['role'],
      passwordHash: input.passwordHash ?? null,
      emailVerified: false,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        email,
        displayName,
        role: input.role as (typeof users.$inferInsert)['role'],
        ...(input.passwordHash ? { passwordHash: input.passwordHash } : {}),
        updatedAt: now,
      },
    });

  if (input.storeName?.trim() && input.phone?.trim() && input.category?.trim() && input.city?.trim()) {
    await db
      .insert(sellerProfiles)
      .values({
        userId: input.uid,
        storeName: input.storeName.trim(),
        phone: input.phone.trim(),
        category: input.category.trim(),
        city: input.city.trim(),
        website: input.website?.trim() || null,
        createdAt: now,
      })
      .onConflictDoUpdate({
        target: sellerProfiles.userId,
        set: {
          storeName: input.storeName.trim(),
          phone: input.phone.trim(),
          category: input.category.trim(),
          city: input.city.trim(),
          website: input.website?.trim() || null,
        },
      });
  }
}
