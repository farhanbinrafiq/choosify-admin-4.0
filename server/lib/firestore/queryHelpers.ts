import type {
  DocumentData,
  Firestore,
  OrderByDirection,
  Query,
  WhereFilterOp,
} from 'firebase-admin/firestore';
import { getAdminFirestore } from '../../firebaseAdmin';
import { mapDocsToData, snapToData } from './documentHelpers';
import { decodeCursor } from './pagination';

export async function requireAdminFirestore(): Promise<Firestore> {
  const db = await getAdminFirestore();
  if (!db) {
    throw new Error('Firestore Admin is not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON on the server.');
  }
  return db;
}

export async function listCollection<T extends DocumentData>(
  collectionName: string,
  options?: { limit?: number },
): Promise<T[]> {
  const db = await requireAdminFirestore();
  let query: Query = db.collection(collectionName);
  if (options?.limit) {
    query = query.limit(options.limit);
  }
  const snapshot = await query.get();
  return mapDocsToData(snapshot.docs) as T[];
}

export async function getDocumentById<T extends DocumentData>(
  collectionName: string,
  id: string,
  fields?: string[],
): Promise<T | null> {
  const db = await requireAdminFirestore();
  const ref = db.collection(collectionName).doc(id);
  if (fields?.length) {
    type SelectableDocumentReference = typeof ref & {
      select: (...fieldPaths: string[]) => typeof ref;
    };
    const snapshot = await (ref as SelectableDocumentReference).select(...fields).get();
    return snapToData(snapshot) as T | null;
  }

  const snapshot = await ref.get();
  return snapToData(snapshot) as T | null;
}

export async function upsertDocument<T extends DocumentData & { id: string }>(
  collectionName: string,
  data: T,
): Promise<T> {
  const db = await requireAdminFirestore();
  await db.collection(collectionName).doc(data.id).set(data, { merge: true });
  return data;
}

export async function upsertDocumentById<T extends DocumentData>(
  collectionName: string,
  id: string,
  data: T,
): Promise<T> {
  const db = await requireAdminFirestore();
  await db.collection(collectionName).doc(id).set(data, { merge: true });
  return data;
}

export async function deleteDocument(collectionName: string, id: string): Promise<void> {
  const db = await requireAdminFirestore();
  await db.collection(collectionName).doc(id).delete();
}

export async function collectionHasDocuments(
  collectionName: string,
  limit = 1,
): Promise<boolean> {
  const db = await requireAdminFirestore();
  const snapshot = await db.collection(collectionName).limit(limit).get();
  return !snapshot.empty;
}

export async function existsWhere(
  collectionName: string,
  field: string,
  operator: WhereFilterOp,
  value: unknown,
): Promise<boolean> {
  const db = await requireAdminFirestore();
  const snapshot = await db
    .collection(collectionName)
    .where(field, operator, value)
    .limit(1)
    .get();
  return !snapshot.empty;
}

export type OrderedListOptions = {
  limit?: number;
  cursor?: string;
  direction?: OrderByDirection;
};

export async function listOrdered<T extends DocumentData>(
  collectionName: string,
  orderByField: string,
  options?: OrderedListOptions,
): Promise<T[]> {
  const db = await requireAdminFirestore();
  let query: Query = db.collection(collectionName).orderBy(
    orderByField,
    options?.direction ?? 'desc',
  );

  if (options?.cursor) {
    query = query.startAfter(decodeCursor(options.cursor));
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const snapshot = await query.get();
  return mapDocsToData(snapshot.docs) as T[];
}

export async function listWhereOrdered<T extends DocumentData>(
  collectionName: string,
  filters: Array<{ field: string; operator: WhereFilterOp; value: unknown }>,
  orderByField: string,
  options?: OrderedListOptions,
): Promise<T[]> {
  const db = await requireAdminFirestore();
  let query: Query = db.collection(collectionName);

  filters.forEach((filter) => {
    query = query.where(filter.field, filter.operator, filter.value);
  });

  query = query.orderBy(orderByField, options?.direction ?? 'asc');

  if (options?.cursor) {
    query = query.startAfter(decodeCursor(options.cursor));
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const snapshot = await query.get();
  return mapDocsToData(snapshot.docs) as T[];
}

export async function getLatestWhere<T extends DocumentData>(
  collectionName: string,
  filters: Array<{ field: string; operator: WhereFilterOp; value: unknown }>,
  orderByField: string,
): Promise<T | null> {
  const rows = await listWhereOrdered<T>(collectionName, filters, orderByField, {
    limit: 1,
    direction: 'desc',
  });
  return rows[0] ?? null;
}
