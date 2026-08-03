import { getAdminFirestore } from '../firestoreAdmin';

/** Marks a Firebase Auth uid as allowed to read omni_* collections from the client SDK. */
export async function upsertOmniStaff(uid: string, meta?: { email?: string; role?: string }) {
  if (!uid) return;
  const db = await getAdminFirestore();
  if (!db) return;

  await db.collection('omni_staff').doc(uid).set(
    {
      uid,
      email: meta?.email || null,
      role: meta?.role || null,
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );
}
