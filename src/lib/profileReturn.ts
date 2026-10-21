/**
 * "Back" target for the Seller / Creator 360° profiles: the exact management
 * list view (tab, search) the profile was opened from, passed as router state
 * `{ returnTo }`. Falls back to the full directory when the profile was opened
 * any other way (deep link, search, reload).
 */
export type ProfileReturnState = { returnTo?: string };

const FILTER_LABELS: Record<string, string> = {
  verified: 'Verified Sellers',
  requests: 'Requests',
  claims: 'Ownership Claims',
  community: 'Community Profiles',
  active: 'Active',
  pending: 'Pending',
  flagged: 'Flagged',
  inactive: 'Inactive',
  suspended: 'Suspended',
};

export function profileReturnTarget(state: unknown, kind: 'seller' | 'creator'): { href: string; label: string } {
  const base = kind === 'seller' ? '/admin/seller-management' : '/admin/creator-management';
  const fallback = { href: base, label: kind === 'seller' ? 'All Sellers' : 'All Creators' };
  const returnTo = (state as ProfileReturnState | null)?.returnTo;
  // Only in-app management lists — never an arbitrary URL from history state.
  if (typeof returnTo !== 'string' || !returnTo.startsWith(base)) return fallback;
  const filter = new URLSearchParams(returnTo.split('?')[1] || '').get('filter') || '';
  if (!filter) return { href: returnTo, label: fallback.label };
  const label = filter === 'verified' && kind === 'creator' ? 'Verified Creators' : FILTER_LABELS[filter] || fallback.label;
  return { href: returnTo, label: `Back to ${label}` };
}

/** Router state to pass when opening a profile from a management list. */
export function profileReturnState(location: { pathname: string; search: string }): { state: ProfileReturnState } {
  return { state: { returnTo: `${location.pathname}${location.search}` } };
}
