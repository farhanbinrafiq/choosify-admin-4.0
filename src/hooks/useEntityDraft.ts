import { useCallback, useEffect, useRef, useState } from 'react';
import { catalogApi, type DraftEntityType, type EntityVersion } from '../services/catalogApi';

const DRAFT_SAVE_DEBOUNCE_MS = 800;
const VERSIONS_CACHE_LIMIT = 15;

export interface UseEntityDraftOptions {
  draftKey: string;
  versionsKey: string;
}

export interface UseEntityDraftResult<T> {
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  saveDraft: (data: T) => void;
  versions: EntityVersion[];
  isLoadingVersions: boolean;
  saveVersion: (label: string, snapshot: T) => Promise<EntityVersion | null>;
  refreshVersions: () => Promise<void>;
}

/**
 * Shared backend-persisted draft/version layer for Brand/Product/Creator/Guide
 * studios. localStorage (keyed by the caller's draftKey/versionsKey) stays as an
 * optimistic cache for instant paint — the backend draft always wins once it
 * loads, via onBackendDraft. Each studio keeps owning its own model state; this
 * hook only owns the async load/save/version plumbing.
 */
export function useEntityDraft<T>(
  entityType: DraftEntityType,
  entityId: string,
  { draftKey, versionsKey }: UseEntityDraftOptions,
  onBackendDraft: (data: T) => void,
): UseEntityDraftResult<T> {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [versions, setVersions] = useState<EntityVersion[]>([]);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onBackendDraftRef = useRef(onBackendDraft);
  onBackendDraftRef.current = onBackendDraft;

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    catalogApi
      .getDraft(entityType, entityId)
      .then((draft) => {
        if (cancelled || !draft) return;
        onBackendDraftRef.current(draft.data as T);
        try {
          localStorage.setItem(draftKey, JSON.stringify(draft.data));
        } catch {
          // localStorage is a best-effort cache only
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load draft');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [entityType, entityId, draftKey]);

  const refreshVersions = useCallback(async () => {
    setIsLoadingVersions(true);
    try {
      const list = await catalogApi.listVersions(entityType, entityId);
      setVersions(list);
      try {
        localStorage.setItem(versionsKey, JSON.stringify(list));
      } catch {
        // localStorage is a best-effort cache only
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load versions');
    } finally {
      setIsLoadingVersions(false);
    }
  }, [entityType, entityId, versionsKey]);

  useEffect(() => {
    refreshVersions();
  }, [refreshVersions]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const saveDraft = useCallback(
    (data: T) => {
      try {
        localStorage.setItem(draftKey, JSON.stringify(data));
      } catch {
        // localStorage is a best-effort cache only
      }
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setIsSaving(true);
        catalogApi
          .saveDraft(entityType, entityId, data as Record<string, unknown>)
          .catch((err: unknown) => {
            setError(err instanceof Error ? err.message : 'Failed to save draft');
          })
          .finally(() => setIsSaving(false));
      }, DRAFT_SAVE_DEBOUNCE_MS);
    },
    [entityType, entityId, draftKey],
  );

  const saveVersion = useCallback(
    async (label: string, snapshot: T): Promise<EntityVersion | null> => {
      try {
        const version = await catalogApi.createVersion(
          entityType,
          entityId,
          label,
          snapshot as Record<string, unknown>,
        );
        setVersions((prev) => [version, ...prev].slice(0, VERSIONS_CACHE_LIMIT));
        return version;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save version');
        return null;
      }
    },
    [entityType, entityId],
  );

  return {
    isLoading,
    isSaving,
    error,
    saveDraft,
    versions,
    isLoadingVersions,
    saveVersion,
    refreshVersions,
  };
}

export default useEntityDraft;
