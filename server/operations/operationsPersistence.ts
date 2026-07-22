import { operationsStore } from './operationsStore';
import { shipmentStore } from './shipmentStore';
import {
  loadOperationsSnapshot,
  saveOperationsSnapshot,
  useOperationsFirestore,
  type OperationsSnapshot,
} from './operationsFirestore';

let persistTimer: ReturnType<typeof setTimeout> | null = null;
let hydrated = false;

export function buildOperationsSnapshot(): OperationsSnapshot {
  return {
    orders: operationsStore.listOrders(),
    coupons: operationsStore.listCoupons(),
    couponUsage: operationsStore.listCouponUsage(),
    reviews: operationsStore.listReviews(),
    leads: operationsStore.listLeads(),
    jobPostings: operationsStore.listJobPostings(),
    jobApplications: operationsStore.listJobApplications(),
    permissions: operationsStore.getPermissions(),
    shipments: shipmentStore.listShipments(),
    featureFlags: operationsStore.getFeatureFlags(),
    sellerOffers: operationsStore.listSellerOffers(),
  };
}

export function scheduleOperationsPersist() {
  if (!useOperationsFirestore) return;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    saveOperationsSnapshot(buildOperationsSnapshot()).catch((err) => {
      console.error('[OperationsPersist] Failed to save snapshot:', err);
    });
  }, 400);
}

export async function ensureOperationsHydrated(): Promise<void> {
  if (hydrated) return;
  hydrated = true;
  if (!useOperationsFirestore) return;

  try {
    const snapshot = await loadOperationsSnapshot();
    if (snapshot) {
      operationsStore.hydrate(snapshot);
      if (snapshot.shipments?.length) {
        shipmentStore.hydrate(snapshot.shipments);
      }
      console.log('[OperationsPersist] Hydrated from Firestore.');
    } else {
      await saveOperationsSnapshot(buildOperationsSnapshot());
      console.log('[OperationsPersist] Seeded initial Firestore snapshot.');
    }
  } catch (err) {
    console.error('[OperationsPersist] Hydration failed, using in-memory defaults.', err);
  }
}

export function attachOperationsPersistence() {
  operationsStore.setPersistHook(scheduleOperationsPersist);
}
