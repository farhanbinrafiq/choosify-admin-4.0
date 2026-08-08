/**
 * Disk durability for the catalog memory adapter (dev / non-Firestore).
 * Same collections as Firestore — not a second database architecture.
 * Production uses Firestore when CATALOG_USE_FIRESTORE=true + Admin credentials.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export type CatalogMemorySnapshot = {
  version: 1;
  savedAt: string;
  products: unknown[];
  categories: unknown[];
  categoryAttributes: unknown[];
  brands: unknown[];
  deals: unknown[];
  creators: unknown[];
  guides: unknown[];
  placements: unknown[];
  productDetails: unknown[];
  brandPosts: unknown[];
  inventory: unknown[];
  services: unknown[];
  homepage: unknown;
  site: unknown;
};

const DEFAULT_PATH = join(process.cwd(), '.data', 'catalog-memory-snapshot.json');

export function catalogMemorySnapshotPath(): string {
  return process.env.CATALOG_MEMORY_SNAPSHOT_PATH?.trim() || DEFAULT_PATH;
}

export function loadCatalogMemorySnapshot(): CatalogMemorySnapshot | null {
  const path = catalogMemorySnapshotPath();
  if (!existsSync(path)) return null;
  try {
    const raw = readFileSync(path, 'utf8');
    const parsed = JSON.parse(raw) as CatalogMemorySnapshot;
    if (!parsed || parsed.version !== 1) return null;
    return parsed;
  } catch (error) {
    console.warn('[CatalogMemoryPersist] Failed to load snapshot:', error);
    return null;
  }
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleCatalogMemoryPersist(build: () => CatalogMemorySnapshot): void {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    try {
      const snapshot = build();
      const path = catalogMemorySnapshotPath();
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, JSON.stringify(snapshot), 'utf8');
    } catch (error) {
      console.error('[CatalogMemoryPersist] Failed to save snapshot:', error);
    }
  }, 250);
}
