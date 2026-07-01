import type { Firestore } from 'firebase-admin/firestore';

let adminDb: Firestore | null = null;
let initFailed = false;

const databaseId =
  process.env.FIRESTORE_DATABASE_ID || 'ai-studio-c2303f92-945b-405b-9b0b-230b63fef478';

export function hasFirebaseAdminCredentials(): boolean {
  return Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim());
}

export async function getAdminFirestore(): Promise<Firestore | null> {
  if (adminDb) return adminDb;
  if (initFailed) return null;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) return null;

  try {
    const [{ cert, getApps, initializeApp }, { getFirestore }] = await Promise.all([
      import('firebase-admin/app'),
      import('firebase-admin/firestore'),
    ]);
    const serviceAccount = JSON.parse(raw) as Record<string, unknown>;
    const app = getApps()[0] ?? initializeApp({ credential: cert(serviceAccount) });
    adminDb = getFirestore(app, databaseId);
    return adminDb;
  } catch (error) {
    initFailed = true;
    console.error('[Firebase Admin] Failed to initialize Firestore.', error);
    return null;
  }
}
