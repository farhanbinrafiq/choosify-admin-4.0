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

const DOC_ID = 'snapshot';

export const useOperationsFirestore =
  process.env.OPERATIONS_USE_FIRESTORE === 'true' && hasFirebaseAdminCredentials();

export interface OperationsSnapshot {
  orders: OpsStorefrontOrder[];
  coupons: OpsCoupon[];
  couponUsage: OpsCouponUsage[];
  reviews: OpsReview[];
  leads: OpsLead[];
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
  const db = await dbOrThrow();
  const snap = await db.collection('ops_state').doc(DOC_ID).get();
  if (!snap.exists) return null;
  return snap.data() as OperationsSnapshot;
}

export async function saveOperationsSnapshot(snapshot: OperationsSnapshot): Promise<void> {
  if (!useOperationsFirestore) return;
  const db = await dbOrThrow();
  await db.collection('ops_state').doc(DOC_ID).set(snapshot, { merge: true });
}

export async function loadAdminUser(uid: string): Promise<{ role: string; displayName: string; email: string } | null> {
  if (!useOperationsFirestore) return null;
  const db = await getAdminFirestore();
  if (!db) return null;
  const snap = await db.collection('admin_users').doc(uid).get();
  if (!snap.exists) return null;
  const data = snap.data() as { role?: string; displayName?: string; email?: string };
  if (!data.role) return null;
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
  const snap = await db.collection('admin_users').where('email', '==', email.toLowerCase()).limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  const data = doc.data() as { role?: string; displayName?: string; email?: string };
  if (!data.role) return null;
  return {
    uid: doc.id,
    role: data.role,
    displayName: data.displayName || data.email || 'Admin User',
    email: data.email || email,
  };
}
