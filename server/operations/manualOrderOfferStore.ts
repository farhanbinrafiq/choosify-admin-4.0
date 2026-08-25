import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { getAdminFirestore } from '../firestoreAdmin';
import { getDocumentById } from '../lib/firestore/queryHelpers';
import type { ManualOrderOffer } from '../../shared/manualOrder/manualOrderTypes';

type StoreBackend = 'admin' | 'memory';

const memory = new Map<string, ManualOrderOffer>();
let backend: StoreBackend | null = null;

/** Same durable memory-disk pattern as bookingStore.ts — never lose a pending offer on restart. */
const DISK_SNAPSHOT_PATH =
  process.env.MANUAL_ORDER_OFFER_MEMORY_SNAPSHOT_PATH?.trim() ||
  join(process.cwd(), '.data', 'manual-order-offer-memory-snapshot.json');

function loadDiskSnapshot(): void {
  if (!existsSync(DISK_SNAPSHOT_PATH)) return;
  try {
    const rows = JSON.parse(readFileSync(DISK_SNAPSHOT_PATH, 'utf8')) as ManualOrderOffer[];
    for (const row of rows) memory.set(row.id, row);
    console.log(`[ManualOrderOfferStore] Hydrated ${rows.length} offer(s) from disk snapshot.`);
  } catch (error) {
    console.warn('[ManualOrderOfferStore] Failed to load disk snapshot:', error);
  }
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleDiskPersist(): void {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    try {
      mkdirSync(dirname(DISK_SNAPSHOT_PATH), { recursive: true });
      writeFileSync(DISK_SNAPSHOT_PATH, JSON.stringify([...memory.values()]), 'utf8');
    } catch (error) {
      console.error('[ManualOrderOfferStore] Failed to save disk snapshot:', error);
    }
  }, 300);
}

async function resolveBackend(): Promise<StoreBackend> {
  if (backend) return backend;
  const adminDb = await getAdminFirestore();
  backend = adminDb ? 'admin' : 'memory';
  if (backend === 'memory') loadDiskSnapshot();
  console.log(`[ManualOrderOfferStore] Using ${backend} backend`);
  return backend;
}

export async function saveManualOrderOffer(offer: ManualOrderOffer): Promise<ManualOrderOffer> {
  const mode = await resolveBackend();
  if (mode === 'memory') {
    memory.set(offer.id, offer);
    scheduleDiskPersist();
    return offer;
  }
  const db = await getAdminFirestore();
  await db!.collection('manual_order_offers').doc(offer.id).set(offer, { merge: true });
  return offer;
}

export async function getManualOrderOffer(id: string): Promise<ManualOrderOffer | null> {
  const mode = await resolveBackend();
  if (mode === 'memory') {
    return memory.get(id) ?? null;
  }
  return getDocumentById<ManualOrderOffer>('manual_order_offers', id);
}

export async function listManualOrderOffers(filters?: {
  sellerId?: string;
  buyerId?: string;
  status?: string | string[];
  conversationId?: string;
}): Promise<ManualOrderOffer[]> {
  const mode = await resolveBackend();
  let rows: ManualOrderOffer[];

  if (mode === 'memory') {
    rows = [...memory.values()];
  } else {
    const db = await getAdminFirestore();
    const snap = await db!.collection('manual_order_offers').limit(500).get();
    rows = snap.docs.map((doc) => doc.data() as ManualOrderOffer);
  }

  if (filters?.sellerId) {
    rows = rows.filter((r) => r.sellerId === filters.sellerId);
  }
  if (filters?.buyerId) {
    rows = rows.filter((r) => r.buyerId === filters.buyerId);
  }
  if (filters?.conversationId) {
    rows = rows.filter((r) => r.conversationId === filters.conversationId);
  }
  if (filters?.status) {
    const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
    rows = rows.filter((r) => statuses.includes(r.status));
  }

  return rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
