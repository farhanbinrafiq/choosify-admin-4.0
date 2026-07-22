import { getAdminFirestore } from '../firebaseAdmin';
import { getDocumentById } from '../lib/firestore/queryHelpers';
import type { BookingRequest } from '../../shared/booking/bookingTypes';

type StoreBackend = 'admin' | 'memory';

const memory = new Map<string, BookingRequest>();
let backend: StoreBackend | null = null;

async function resolveBackend(): Promise<StoreBackend> {
  if (backend) return backend;
  const adminDb = await getAdminFirestore();
  backend = adminDb ? 'admin' : 'memory';
  console.log(`[BookingStore] Using ${backend} backend`);
  return backend;
}

export async function saveBookingRequest(request: BookingRequest): Promise<BookingRequest> {
  const mode = await resolveBackend();
  if (mode === 'memory') {
    memory.set(request.id, request);
    return request;
  }
  const db = await getAdminFirestore();
  await db!.collection('booking_requests').doc(request.id).set(request, { merge: true });
  return request;
}

export async function getBookingRequest(id: string): Promise<BookingRequest | null> {
  const mode = await resolveBackend();
  if (mode === 'memory') {
    return memory.get(id) ?? null;
  }
  return getDocumentById<BookingRequest>('booking_requests', id);
}

export async function listBookingRequests(filters?: {
  sellerId?: string;
  buyerId?: string;
  status?: string | string[];
  conversationId?: string;
}): Promise<BookingRequest[]> {
  const mode = await resolveBackend();
  let rows: BookingRequest[];

  if (mode === 'memory') {
    rows = [...memory.values()];
  } else {
    const db = await getAdminFirestore();
    const snap = await db!.collection('booking_requests').limit(500).get();
    rows = snap.docs.map((doc) => doc.data() as BookingRequest);
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

/** Active requests that may need expiry (for cron / lazy sweep). */
export async function listExpirableBookingRequests(): Promise<BookingRequest[]> {
  return listBookingRequests({
    status: ['pending', 'accepted', 'buyer_accepted', 'countered'],
  });
}
