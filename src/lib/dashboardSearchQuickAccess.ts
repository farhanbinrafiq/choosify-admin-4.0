import {
  NAV_DEFS,
  PAGE_KEY_TO_PATH,
  PAGE_META,
  allowedPageKeysForRole,
} from '../cms-mirror/nav';

export type DashboardQuickAccessItem = {
  id: string;
  label: string;
  route: string;
  subtitle?: string;
};

/** Frequently used destinations per role — no fake popularity data. */
const QUICK_ACCESS_KEYS: Record<string, string[]> = {
  super_admin: ['orders', 'customers', 'products', 'brands', 'settings'],
  admin: ['orders', 'customers', 'products', 'brands', 'settings'],
  seller: ['orders', 'products', 'sellerCustomers', 'myCashbook', 'adsDealsStudio'],
  creator: ['contentStudio', 'creatorProfile', 'myEarnings', 'myCashbook', 'adsDealsStudio'],
  moderator: ['moderationCenter', 'reviews', 'messages'],
  finance_manager: ['payouts', 'finance', 'feeCharges'],
  support_agent: ['messages', 'orders', 'customers'],
  marketing_manager: ['adsDealsStudio', 'promoCodes', 'websiteCmsStudio'],
};

function isPageAllowed(role: string, pageKey: string): boolean {
  const allowed = allowedPageKeysForRole(role);
  return !allowed || allowed.includes(pageKey);
}

export function getQuickAccessForRole(role: string | undefined): DashboardQuickAccessItem[] {
  const r = role || 'admin';
  const keys = QUICK_ACCESS_KEYS[r] || QUICK_ACCESS_KEYS.admin;
  const navByKey = new Map<string, { label: string; path: string }>();
  for (const group of NAV_DEFS) {
    for (const item of group.items) {
      navByKey.set(item.key, { label: item.label, path: item.path });
    }
  }

  return keys
    .filter((key) => isPageAllowed(r, key))
    .map((key) => {
      const nav = navByKey.get(key);
      const meta = PAGE_META[key];
      const route = nav?.path || PAGE_KEY_TO_PATH[key] || '/admin/dashboard';
      return {
        id: key,
        label: nav?.label || meta?.[0] || key,
        route,
        subtitle: meta?.[1],
      };
    })
    .filter((item) => Boolean(item.route));
}
