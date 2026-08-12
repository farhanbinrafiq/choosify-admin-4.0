/**
 * Ads memory-disk backend (local/dev).
 */

import {
  flushAdsMemoryPersist,
  loadAdsMemorySnapshot,
  scheduleAdsMemoryPersist,
  type AdsMemorySnapshot,
} from './adsPersistence';
import type { AdRecord, AdsKind, AdsStatus } from './types';

const state: { ads: AdRecord[] } = { ads: [] };

let hydrated = false;

function buildSnapshot(): AdsMemorySnapshot {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    ads: state.ads,
  };
}

function schedulePersist(): void {
  scheduleAdsMemoryPersist(buildSnapshot);
}

export function ensureAdsMemoryHydrated(): boolean {
  if (hydrated) return true;
  hydrated = true;
  const snapshot = loadAdsMemorySnapshot();
  if (!snapshot) return false;
  state.ads = (snapshot.ads as AdRecord[]) || [];
  console.log(`[AdsMemoryPersist] Hydrated (${state.ads.length} ads).`);
  return true;
}

export const adsMemoryBackend = {
  getAd(id: string): AdRecord | null {
    ensureAdsMemoryHydrated();
    return state.ads.find((a) => a.id === id) ?? null;
  },
  listAds(filter?: {
    kind?: AdsKind;
    status?: AdsStatus;
    ownerId?: string;
    statuses?: AdsStatus[];
  }): AdRecord[] {
    ensureAdsMemoryHydrated();
    return state.ads.filter((a) => {
      if (filter?.kind && a.kind !== filter.kind) return false;
      if (filter?.status && a.status !== filter.status) return false;
      if (filter?.statuses && !filter.statuses.includes(a.status)) return false;
      if (filter?.ownerId && a.ownerId !== filter.ownerId) return false;
      return true;
    });
  },
  upsertAd(row: AdRecord): AdRecord {
    ensureAdsMemoryHydrated();
    const idx = state.ads.findIndex((a) => a.id === row.id);
    if (idx >= 0) state.ads[idx] = row;
    else state.ads.push(row);
    schedulePersist();
    return row;
  },
  deleteAd(id: string): boolean {
    ensureAdsMemoryHydrated();
    const before = state.ads.length;
    state.ads = state.ads.filter((a) => a.id !== id);
    if (state.ads.length !== before) schedulePersist();
    return state.ads.length !== before;
  },
  flush(): void {
    ensureAdsMemoryHydrated();
    scheduleAdsMemoryPersist(buildSnapshot);
    flushAdsMemoryPersist();
  },
};
