const STORAGE_KEY = 'choosify_cms_versions';
const MAX_VERSIONS = 20;

export interface CmsVersionSnapshot {
  id: string;
  label: string;
  savedAt: string;
  heroBanners: unknown[];
  homepageSections: unknown[];
  footer: unknown;
  seoEntries: unknown[];
  productBadges: unknown[];
  extendedSocialLinks: unknown[];
  websiteAssets: unknown;
  globalSettings: unknown;
  popularSearches: unknown[];
  navigation: unknown[];
  featuredProducts: unknown[];
  featuredBrands: unknown[];
  featuredCreators: unknown[];
  featuredDeals: unknown[];
  spotlightBrands: unknown[];
  sponsoredItems: unknown[];
  featuredRecommendations: unknown[];
  recommendedBrands: unknown[];
  recommendedProducts: unknown[];
  recommendedCreators: unknown[];
}

function readVersions(): CmsVersionSnapshot[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CmsVersionSnapshot[]) : [];
  } catch {
    return [];
  }
}

function writeVersions(versions: CmsVersionSnapshot[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(versions.slice(0, MAX_VERSIONS)));
}

export function saveCmsVersion(
  snapshot: Omit<CmsVersionSnapshot, 'id' | 'savedAt'>,
  label = 'CMS publish',
): string {
  const id = `v-${Date.now()}`;
  const entry: CmsVersionSnapshot = {
    ...snapshot,
    id,
    label,
    savedAt: new Date().toISOString(),
  };
  const versions = readVersions();
  writeVersions([entry, ...versions]);
  return id;
}

export function getCmsVersion(id: string): CmsVersionSnapshot | null {
  return readVersions().find((v) => v.id === id) ?? null;
}

export function listCmsVersions(): CmsVersionSnapshot[] {
  return readVersions();
}
