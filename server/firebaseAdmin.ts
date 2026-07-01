import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

let adminApp: App | null = null;
let adminDb: Firestore | null = null;
let initFailed = false;

const databaseId =
  process.env.FIRESTORE_DATABASE_ID || 'ai-studio-c2303f92-945b-405b-9b0b-230b63fef478';

export function hasFirebaseAdminCredentials(): boolean {
  return Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim());
}

export function getAdminFirestore(): Firestore | null {
  if (adminDb) return adminDb;
  if (initFailed) return null;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) return null;

  try {
    const serviceAccount = JSON.parse(raw) as Record<string, unknown>;
    adminApp = getApps()[0] ?? initializeApp({ credential: cert(serviceAccount) });
    adminDb = getFirestore(adminApp, databaseId);
    return adminDb;
  } catch (error) {
    initFailed = true;
    console.error('[Firebase Admin] Failed to initialize Firestore.', error);
    return null;
  }
}
