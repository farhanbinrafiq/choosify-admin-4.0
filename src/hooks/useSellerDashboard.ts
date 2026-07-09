import { useCallback, useEffect, useState } from 'react';
import { fetchSellerDashboard, type SellerDashboardQuery } from '../services/sellerDashboardApi';
import type { SellerDashboardPayload, SellerDashboardRange } from '../types/sellerDashboard';

type UseSellerDashboardState = {
  data: SellerDashboardPayload | null;
  loading: boolean;
  error: string | null;
  range: SellerDashboardRange;
  refresh: () => Promise<void>;
  setRange: (range: SellerDashboardRange) => void;
};

export function useSellerDashboard(query: SellerDashboardQuery): UseSellerDashboardState {
  const [data, setData] = useState<SellerDashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<SellerDashboardRange>(query.range || '7d');

  const refresh = useCallback(async () => {
    if (!query.sellerId) {
      setError('Seller ID is required');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = await fetchSellerDashboard({
        ...query,
        range,
      });
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load seller dashboard');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [query.sellerId, query.sellerName, query.storeName, range]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, loading, error, range, refresh, setRange };
}
