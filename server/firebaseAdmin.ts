import type { Firestore } from 'firebase-admin/firestore';
import type { App } from 'firebase-admin/app';
import type { Auth } from 'firebase-admin/auth';

let adminDb: Firestore | null = null;
let adminApp: App | null = null;
let initFailed = false;

const databaseId =
  process.env.FIRESTORE_DATABASE_ID || 'ai-studio-c2303f92-945b-405b-9b0b-230b63fef478';

export function hasFirebaseAdminCredentials(): boolean {
  return Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim());
}

async function ensureAdminApp(): Promise<App | null> {
  if (adminApp) return adminApp;
  if (initFailed) return null;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) return null;

  try {
    const [{ cert, getApps, initializeApp }] = await Promise.all([import('firebase-admin/app')]);
    const serviceAccount = JSON.parse(raw) as Record<string, unknown>;
    adminApp = getApps()[0] ?? initializeApp({ credential: cert(serviceAccount) });
    return adminApp;
  } catch (error) {
    initFailed = true;
    console.error('[Firebase Admin] Failed to initialize app.', error);
    return null;
  }
}

export async function getAdminApp(): Promise<App | null> {
  return ensureAdminApp();
}

export async function getAdminAuth(): Promise<Auth | null> {
  const app = await ensureAdminApp();
  if (!app) return null;
  const { getAuth } = await import('firebase-admin/auth');
  return getAuth(app);
}

export async function getAdminFirestore(): Promise<Firestore | null> {
  if (adminDb) return adminDb;
  const app = await ensureAdminApp();
  if (!app) return null;

  try {
    const { getFirestore } = await import('firebase-admin/firestore');
    adminDb = getFirestore(app, databaseId);
    return adminDb;
  } catch (error) {
    initFailed = true;
    console.error('[Firebase Admin] Failed to initialize Firestore.', error);
    return null;
  }
}
