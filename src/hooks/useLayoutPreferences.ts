/**
 * useLayoutPreferences Hook
 * 
 * Read/write layout preferences for a specific layout ID.
 * Handles persistence automatically.
 */

import { useCallback } from 'react';
import { getStoredLayout, saveLayout } from '../lib/layout/layoutPersistence';

export function useLayoutPreferences(layoutId: string) {
  /**
   * Get stored sizes for this layout
   */
  const getSizes = useCallback((): number[] => {
    const stored = getStoredLayout(layoutId);
    return stored?.sizes || [];
  }, [layoutId]);

  /**
   * Set sizes and persist
   */
  const setSizes = useCallback((sizes: number[]) => {
    saveLayout(layoutId, { sizes });
  }, [layoutId]);

  /**
   * Set collapsed state and persist
   */
  const setCollapsed = useCallback((collapsed: boolean) => {
    saveLayout(layoutId, { collapsed });
  }, [layoutId]);

  /**
   * Get collapsed state
   */
  const getCollapsed = useCallback((): boolean => {
    const stored = getStoredLayout(layoutId);
    return stored?.collapsed ?? false;
  }, [layoutId]);

  /**
   * Reset to defaults
   */
  const reset = useCallback(() => {
    saveLayout(layoutId, { sizes: [], collapsed: false });
  }, [layoutId]);

  return {
    getSizes,
    setSizes,
    setCollapsed,
    getCollapsed,
    reset
  };
}

export default useLayoutPreferences;
