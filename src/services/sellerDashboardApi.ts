import type { SellerDashboardPayload, SellerDashboardRange } from '../types/sellerDashboard';

const API_BASE = ((import.meta as any).env?.VITE_API_BASE_URL as string | undefined) || '/api/v1';

export type SellerDashboardQuery = {
  sellerId: string;
  sellerName?: string;
  storeName?: string;
  range?: SellerDashboardRange;
};

export async function fetchSellerDashboard(
  query: SellerDashboardQuery,
): Promise<SellerDashboardPayload> {
  const params = new URLSearchParams({ sellerId: query.sellerId });
  if (query.sellerName) params.set('sellerName', query.sellerName);
  if (query.storeName) params.set('storeName', query.storeName);
  if (query.range) params.set('range', query.range);

  const response = await fetch(`${API_BASE}/operations/seller-dashboard?${params.toString()}`);
  if (!response.ok) {
    const rawError = await response.text();
    throw new Error(rawError || `Seller dashboard request failed (${response.status})`);
  }

  const result = (await response.json()) as { data: SellerDashboardPayload };
  return result.data;
}
