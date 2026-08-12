/**
 * Ads persistence facade — memory-disk only for pre-Sprint-9 stabilization.
 */

import { ensureAdsMemoryHydrated, adsMemoryBackend } from './adsMemoryBackend';
import type { AdRecord, AdsKind, AdsStatus } from './types';

ensureAdsMemoryHydrated();

console.log('[Ads] Persistence mode: memory-disk');

export const adsStore = {
  async getAd(id: string): Promise<AdRecord | null> {
    return adsMemoryBackend.getAd(id);
  },
  async listAds(filter?: {
    kind?: AdsKind;
    status?: AdsStatus;
    ownerId?: string;
    statuses?: AdsStatus[];
  }): Promise<AdRecord[]> {
    return adsMemoryBackend.listAds(filter);
  },
  async upsertAd(row: AdRecord): Promise<AdRecord> {
    return adsMemoryBackend.upsertAd(row);
  },
  async deleteAd(id: string): Promise<boolean> {
    return adsMemoryBackend.deleteAd(id);
  },
  flushMemory(): void {
    adsMemoryBackend.flush();
  },
};
