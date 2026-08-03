import { getAdminFirestore } from '../firestoreAdmin';

export type WebhookJobStatus = 'pending' | 'processing' | 'done' | 'failed';

export type WebhookJobRecord = {
  type: 'process-meta-webhook';
  status: WebhookJobStatus;
  payload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  attempts: number;
  error?: string;
};

const COLLECTION = 'webhook_jobs';
const MAX_ATTEMPTS = 3;

function nowIso() {
  return new Date().toISOString();
}

/**
 * Persist a Meta webhook payload, then process it. Survives serverless cold starts
 * because pending/failed jobs remain in Firestore for a later drain.
 */
export async function enqueueMetaWebhookJob(
  payload: Record<string, unknown>,
  process: (payload: Record<string, unknown>) => Promise<void>,
): Promise<string> {
  const db = await getAdminFirestore();
  if (!db) {
    await process(payload);
    return 'memory';
  }

  const ref = db.collection(COLLECTION).doc();
  const record: WebhookJobRecord = {
    type: 'process-meta-webhook',
    status: 'pending',
    payload,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    attempts: 0,
  };
  await ref.set(record);
  await processWebhookJobById(ref.id, process);
  return ref.id;
}

export async function processWebhookJobById(
  jobId: string,
  process: (payload: Record<string, unknown>) => Promise<void>,
): Promise<void> {
  const db = await getAdminFirestore();
  if (!db || jobId === 'memory') return;

  const ref = db.collection(COLLECTION).doc(jobId);
  const snap = await ref.get();
  if (!snap.exists) return;

  const data = snap.data() as WebhookJobRecord;
  if (data.status === 'done') return;

  await ref.set(
    {
      status: 'processing' satisfies WebhookJobStatus,
      updatedAt: nowIso(),
      attempts: (data.attempts || 0) + 1,
    },
    { merge: true },
  );

  try {
    await process(data.payload || {});
    await ref.set(
      {
        status: 'done' satisfies WebhookJobStatus,
        updatedAt: nowIso(),
        error: null,
      },
      { merge: true },
    );
  } catch (err) {
    const attempts = (data.attempts || 0) + 1;
    const message = err instanceof Error ? err.message : String(err);
    const failed = attempts >= MAX_ATTEMPTS;
    await ref.set(
      {
        status: (failed ? 'failed' : 'pending') satisfies WebhookJobStatus,
        updatedAt: nowIso(),
        error: message,
        attempts,
      },
      { merge: true },
    );
    if (!failed) {
      throw err;
    }
    console.error(`[webhook_jobs] Job ${jobId} failed after ${attempts} attempts:`, message);
  }
}

/** Re-process leftover pending Meta webhook jobs (e.g. after a cold-start interrupt). */
export async function drainPendingWebhookJobs(
  process: (payload: Record<string, unknown>) => Promise<void>,
  limit = 25,
): Promise<number> {
  const db = await getAdminFirestore();
  if (!db) return 0;

  const pending = await db
    .collection(COLLECTION)
    .where('status', '==', 'pending')
    .where('type', '==', 'process-meta-webhook')
    .limit(limit)
    .get();

  let processed = 0;
  for (const doc of pending.docs) {
    try {
      await processWebhookJobById(doc.id, process);
      processed += 1;
    } catch (err) {
      console.error(`[webhook_jobs] Drain failed for ${doc.id}:`, err);
    }
  }
  return processed;
}
