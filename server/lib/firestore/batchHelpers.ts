import type { Firestore, WriteBatch } from 'firebase-admin/firestore';

const FIRESTORE_BATCH_LIMIT = 500;

export async function runBatchedWrites(
  db: Firestore,
  operations: Array<(batch: WriteBatch) => void>,
): Promise<void> {
  if (operations.length === 0) return;

  for (let index = 0; index < operations.length; index += FIRESTORE_BATCH_LIMIT) {
    const batch = db.batch();
    const chunk = operations.slice(index, index + FIRESTORE_BATCH_LIMIT);
    chunk.forEach((operation) => operation(batch));
    await batch.commit();
  }
}
