import type {
  DocumentData,
  DocumentSnapshot,
  QueryDocumentSnapshot,
} from 'firebase-admin/firestore';

export function documentExists(snapshot: DocumentSnapshot): boolean {
  return snapshot.exists;
}

export function snapToData<T extends DocumentData>(
  snapshot: DocumentSnapshot<T> | QueryDocumentSnapshot<T>,
): T | null {
  if (!snapshot.exists) return null;
  return snapshot.data() ?? null;
}

export function mapDocsToData<T extends DocumentData>(
  docs: QueryDocumentSnapshot<T>[],
): T[] {
  return docs.map((doc) => doc.data());
}

export function mapDocsWithId<T extends DocumentData>(
  docs: QueryDocumentSnapshot<T>[],
): Array<T & { id: string }> {
  return docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}
