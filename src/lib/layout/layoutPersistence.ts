/**
 * Layout Persistence
 * 
 * Store and retrieve layout preferences from localStorage.
 */

const STORAGE_PREFIX = 'choosify_layout_';

interface LayoutPreferences {
  sizes?: number[];
  collapsed?: boolean;
  timestamp?: number;
}

/**
 * Get stored layout for a specific ID
 */
export function getStoredLayout(layoutId: string): LayoutPreferences | null {
  try {
    const key = `${STORAGE_PREFIX}${layoutId}`;
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.warn(`Failed to read layout for ${layoutId}:`, error);
    return null;
  }
}

/**
 * Save layout preferences
 */
export function saveLayout(layoutId: string, prefs: LayoutPreferences): void {
  try {
    const key = `${STORAGE_PREFIX}${layoutId}`;
    const existing = getStoredLayout(layoutId) || {};
    localStorage.setItem(
      key,
      JSON.stringify({
        ...existing,
        ...prefs,
        timestamp: Date.now()
      })
    );
  } catch (error) {
    console.warn(`Failed to save layout for ${layoutId}:`, error);
  }
}

/**
 * Clear layout for a specific ID
 */
export function clearLayout(layoutId: string): void {
  try {
    const key = `${STORAGE_PREFIX}${layoutId}`;
    localStorage.removeItem(key);
  } catch (error) {
    console.warn(`Failed to clear layout for ${layoutId}:`, error);
  }
}

/**
 * Clear all layouts
 */
export function clearAllLayouts(): void {
  try {
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith(STORAGE_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.warn('Failed to clear all layouts:', error);
  }
}

/**
 * Get all stored layouts
 */
export function getAllLayouts(): Record<string, LayoutPreferences> {
  const layouts: Record<string, LayoutPreferences> = {};
  try {
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith(STORAGE_PREFIX)) {
        const layoutId = key.replace(STORAGE_PREFIX, '');
        const stored = localStorage.getItem(key);
        if (stored) {
          layouts[layoutId] = JSON.parse(stored);
        }
      }
    });
  } catch (error) {
    console.warn('Failed to get all layouts:', error);
  }
  return layouts;
}
