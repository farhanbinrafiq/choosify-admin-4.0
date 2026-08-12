export type DashboardRecentlyViewedItem = {
  id: string;
  type: string;
  title: string;
  subtitle?: string;
  route: string;
  viewedAt: string;
};

const RECENT_SEARCH_KEY = (actorKey: string) => `choosify_recent_dashboard_search_${actorKey}`;
const RECENT_VIEWED_KEY = (actorKey: string) => `choosify_recent_dashboard_viewed_${actorKey}`;

export function loadRecentSearches(actorKey: string): string[] {
  try {
    const raw = localStorage.getItem(RECENT_SEARCH_KEY(actorKey));
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    return Array.isArray(parsed) ? parsed.slice(0, 10) : [];
  } catch {
    return [];
  }
}

export function saveRecentSearches(actorKey: string, items: string[]): void {
  try {
    localStorage.setItem(RECENT_SEARCH_KEY(actorKey), JSON.stringify(items.slice(0, 10)));
  } catch {
    // ignore quota errors
  }
}

export function loadRecentlyViewed(actorKey: string): DashboardRecentlyViewedItem[] {
  try {
    const raw = localStorage.getItem(RECENT_VIEWED_KEY(actorKey));
    const parsed = raw ? (JSON.parse(raw) as DashboardRecentlyViewedItem[]) : [];
    return Array.isArray(parsed) ? parsed.slice(0, 12) : [];
  } catch {
    return [];
  }
}

export function saveRecentlyViewed(actorKey: string, items: DashboardRecentlyViewedItem[]): void {
  try {
    localStorage.setItem(RECENT_VIEWED_KEY(actorKey), JSON.stringify(items.slice(0, 12)));
  } catch {
    // ignore quota errors
  }
}

export function pushRecentlyViewed(
  actorKey: string,
  item: Omit<DashboardRecentlyViewedItem, 'viewedAt'>,
): DashboardRecentlyViewedItem[] {
  const entry: DashboardRecentlyViewedItem = { ...item, viewedAt: new Date().toISOString() };
  const prev = loadRecentlyViewed(actorKey);
  const next = [entry, ...prev.filter((x) => !(x.id === item.id && x.type === item.type))].slice(0, 12);
  saveRecentlyViewed(actorKey, next);
  return next;
}
