/**
 * Ads & Deals API client — Banner / Direct Ads Visual Builder.
 */

import type { AdFormatDef, AdPlacementDef, AdPageKey } from '@/shared/ads/placementRegistry';

const API_BASE =
  ((import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_API_BASE_URL as
    | string
    | undefined) || '/api/v1';
const AUTH_TOKEN_KEY = 'choosify_auth_token';

export type AdsApiRecord = {
  id: string;
  ownerId: string;
  ownerRole: 'seller' | 'creator' | 'admin';
  listingId?: string;
  brandId?: string;
  title: string;
  status: string;
  kind: 'deal' | 'promotion' | 'banner' | 'external';
  formatId?: string;
  placementId?: string;
  pageKey?: string;
  creative?: Record<string, unknown>;
  cta?: Record<string, unknown>;
  externalUrl?: string;
  placement?: string;
  startsAt?: string;
  endsAt?: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
  advertisementReferenceId?: string;
  dealReferenceId?: string;
};

export type EligibleListing = {
  id: string;
  title: string;
  brandId?: string;
  image?: string;
  status?: string;
};

export type PlacementsResponse = {
  formats: AdFormatDef[];
  pages: Array<{ pageKey: AdPageKey; pageLabel: string }>;
  placements: AdPlacementDef[];
};

function parseError(raw: string, status: number): string {
  if (!raw) return `Request failed (${status})`;
  try {
    const parsed = JSON.parse(raw) as { error?: string; message?: string };
    if (parsed.error?.trim()) return parsed.error;
    if (parsed.message?.trim()) return parsed.message;
  } catch {
    // keep raw
  }
  return raw;
}

async function request<T>(path: string, method: string = 'GET', body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const raw = await response.text();
  let parsed: { success?: boolean; data?: T; error?: string } = {};
  try {
    parsed = raw ? JSON.parse(raw) : {};
  } catch {
    parsed = {};
  }

  if (!response.ok) {
    throw new Error(parsed.error || parseError(raw, response.status));
  }
  return (parsed.data !== undefined ? parsed.data : (parsed as unknown as T)) as T;
}

export const adsApi = {
  getPlacements: (pageKey?: string) =>
    request<PlacementsResponse>(
      pageKey ? `/ads/placements?pageKey=${encodeURIComponent(pageKey)}` : '/ads/placements',
    ),

  listBanners: () => request<AdsApiRecord[]>('/ads/banners'),

  getAd: (id: string) => request<AdsApiRecord>(`/ads/${encodeURIComponent(id)}`),

  listEligibleListings: () => request<EligibleListing[]>('/ads/listings/eligible'),

  createBanner: (body: Record<string, unknown>) =>
    request<AdsApiRecord>('/ads/banners', 'POST', body),

  updateAd: (id: string, body: Record<string, unknown>) =>
    request<AdsApiRecord>(`/ads/${encodeURIComponent(id)}`, 'PATCH', body),

  submitForApproval: (id: string) =>
    request<AdsApiRecord>(`/ads/${encodeURIComponent(id)}/submit`, 'POST', {}),

  deleteAd: (id: string) =>
    request<{ id: string }>(`/ads/${encodeURIComponent(id)}`, 'DELETE'),

  approveBanner: (id: string) =>
    request<AdsApiRecord>(`/ads/banners/${encodeURIComponent(id)}/approve`, 'POST', {}),

  rejectBanner: (id: string, reason?: string) =>
    request<AdsApiRecord>(`/ads/banners/${encodeURIComponent(id)}/reject`, 'POST', { reason }),

  pauseAd: (id: string) =>
    request<AdsApiRecord>(`/ads/${encodeURIComponent(id)}/pause`, 'POST', {}),

  disableAd: (id: string) =>
    request<AdsApiRecord>(`/ads/${encodeURIComponent(id)}/disable`, 'POST', {}),
};
