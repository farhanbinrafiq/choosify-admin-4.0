import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  fetchNavAttention,
  type NavAttentionCounts,
} from '../services/navAttentionApi';
import { useAuth } from './AuthContext';

const STALE_MS = 30_000;

type NavAttentionContextValue = {
  counts: NavAttentionCounts;
  ready: boolean;
  refresh: () => Promise<void>;
};

const NavAttentionContext = createContext<NavAttentionContextValue>({
  counts: {},
  ready: false,
  refresh: async () => {},
});

export const NavAttentionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile } = useAuth();
  const [counts, setCounts] = useState<NavAttentionCounts>({});
  const [ready, setReady] = useState(false);
  const fetchedAtRef = useRef(0);
  const inFlightRef = useRef<Promise<void> | null>(null);

  const load = useCallback(
    async (force = false) => {
      if (!profile?.id) {
        setCounts({});
        setReady(false);
        fetchedAtRef.current = 0;
        return;
      }
      if (!force && fetchedAtRef.current && Date.now() - fetchedAtRef.current < STALE_MS) return;
      if (inFlightRef.current) {
        await inFlightRef.current;
        return;
      }
      const run = (async () => {
        try {
          const next = await fetchNavAttention();
          setCounts(next);
          fetchedAtRef.current = Date.now();
        } catch {
          /* keep last known counts */
        } finally {
          setReady(true);
          inFlightRef.current = null;
        }
      })();
      inFlightRef.current = run;
      await run;
    },
    [profile?.id],
  );

  useEffect(() => {
    fetchedAtRef.current = 0;
    setReady(false);
    void load(true);
  }, [profile?.id, profile?.role, load]);

  useEffect(() => {
    const onFocus = () => {
      if (Date.now() - fetchedAtRef.current > 15_000) void load(true);
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [load]);

  const refresh = useCallback(async () => {
    fetchedAtRef.current = 0;
    await load(true);
  }, [load]);

  const value = useMemo(
    () => ({ counts, ready, refresh }),
    [counts, ready, refresh],
  );

  return <NavAttentionContext.Provider value={value}>{children}</NavAttentionContext.Provider>;
};

export function useNavAttention(): NavAttentionContextValue {
  return useContext(NavAttentionContext);
}
