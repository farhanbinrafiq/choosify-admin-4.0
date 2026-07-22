import { getAdminFirestore, hasFirebaseAdminCredentials } from '../firebaseAdmin';
import type {
  OpsCoupon,
  OpsCouponUsage,
  OpsLead,
  OpsReview,
  OpsStorefrontOrder,
  RolePermissionsMap,
} from './types';
import type { OpsShipment } from './shipmentStore';
import { getDocumentById } from '../lib/firestore/queryHelpers';
import { snapToData } from '../lib/firestore/documentHelpers';

const DOC_ID = 'snapshot';
const ADMIN_USER_FIELDS = ['role', 'displayName', 'email'] as const;

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

async function dbOrThrow() {
  const db = await getAdminFirestore();
  if (!db) {
    throw new Error('Firestore Admin is not configured.');
  }
  return db;
}

export async function loadOperationsSnapshot(): Promise<OperationsSnapshot | null> {
  if (!useOperationsFirestore) return null;
  return getDocumentById<OperationsSnapshot>('ops_state', DOC_ID);
}

export async function saveOperationsSnapshot(snapshot: OperationsSnapshot): Promise<void> {
  if (!useOperationsFirestore) return;
  const db = await dbOrThrow();
  await db.collection('ops_state').doc(DOC_ID).set(snapshot, { merge: true });
}

export async function loadAdminUser(uid: string): Promise<{ role: string; displayName: string; email: string } | null> {
  if (!useOperationsFirestore) return null;
  const data = await getDocumentById<{
    role?: string;
    displayName?: string;
    email?: string;
  }>('admin_users', uid, [...ADMIN_USER_FIELDS]);

  if (!data?.role) return null;
  return {
    role: data.role,
    displayName: data.displayName || data.email || 'Admin User',
    email: data.email || '',
  };
}

export async function loadAdminUserByEmail(
  email: string,
): Promise<{ uid: string; role: string; displayName: string; email: string } | null> {
  if (!useOperationsFirestore) return null;
  const db = await getAdminFirestore();
  if (!db) return null;

  const snap = await db
    .collection('admin_users')
    .where('email', '==', email.toLowerCase())
    .select(...ADMIN_USER_FIELDS)
    .limit(1)
    .get();

  if (snap.empty) return null;
  const doc = snap.docs[0];
  const data = snapToData(doc);
  if (!data?.role) return null;

  return {
    uid: doc.id,
    role: data.role,
    displayName: data.displayName || data.email || 'Admin User',
    email: data.email || email,
  };
}

export async function upsertAdminUserProfile(input: {
  uid: string;
  email: string;
  displayName: string;
  role: string;
  storeName?: string;
}): Promise<void> {
  if (!useOperationsFirestore) {
    throw new Error('Firestore Admin is not configured.');
  }
  const db = await dbOrThrow();
  const email = input.email.trim().toLowerCase();
  const payload: Record<string, unknown> = {
    email,
    displayName: input.displayName.trim() || email,
    role: input.role,
    updatedAt: new Date().toISOString(),
  };
  if (input.storeName?.trim()) {
    payload.storeName = input.storeName.trim();
  }

  const existing = await db.collection('admin_users').doc(input.uid).get();
  if (!existing.exists) {
    payload.createdAt = new Date().toISOString();
  }

  await db.collection('admin_users').doc(input.uid).set(payload, { merge: true });
}
