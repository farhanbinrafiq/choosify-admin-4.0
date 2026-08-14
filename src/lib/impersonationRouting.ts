/** Target-role dashboard after Login As starts. All live roles use cms-mirror dashboard. */
export const IMPERSONATION_DASHBOARD_PATH = '/admin/dashboard';

export type InspectionRole = 'consumer' | 'seller' | 'creator';

export type LoginAsConfirmTarget = {
  targetUserId: string;
  displayName: string;
  roleLabel: string;
  choosifyUserId?: string;
  email?: string;
  avatarUrl?: string;
};

export function isLegacyInspectionPath(pathname: string): boolean {
  const path = String(pathname || '').split('?')[0];
  return (
    /^\/(consumer|seller|creator)\/[^/]+/i.test(path) ||
    /^\/upe\/(consumer|seller|creator)(\/|$)/i.test(path)
  );
}

export function inspectionUniversalPath(role: InspectionRole, id: string): string {
  const enc = encodeURIComponent(id);
  if (role === 'consumer') return `/admin/consumers/${enc}`;
  if (role === 'creator') return `/admin/creators/${enc}`;
  return `/admin/brand-studio?sellerId=${enc}`;
}

function decodeSegment(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/**
 * Map whatever URL Admin is on into a safe cms-mirror /admin return location.
 * Legacy UnifiedProfileShell routes are rewritten to the current universal profile.
 */
export function canonicalImpersonationReturnPath(pathname: string, search = ''): string {
  const path = String(pathname || '') || '/';
  const qs = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  qs.delete('impersonate');

  const upe = path.match(/^\/upe\/(consumer|seller|creator)\/([^/]+)/i);
  if (upe) {
    return inspectionUniversalPath(upe[1].toLowerCase() as InspectionRole, decodeSegment(upe[2]));
  }

  const legacy = path.match(/^\/(consumer|seller|creator)\/([^/]+)/i);
  if (legacy) {
    return inspectionUniversalPath(legacy[1].toLowerCase() as InspectionRole, decodeSegment(legacy[2]));
  }

  if (path.startsWith('/admin/')) {
    const q = qs.toString();
    return q ? `${path}?${q}` : path;
  }

  return IMPERSONATION_DASHBOARD_PATH;
}

/** Exit-impersonation target. Never restore a legacy profile shell. */
export function safeImpersonationReturnPath(stored: string | null | undefined): string {
  if (!stored || typeof stored !== 'string') return IMPERSONATION_DASHBOARD_PATH;
  const trimmed = stored.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || /:\/\//.test(trimmed)) {
    return IMPERSONATION_DASHBOARD_PATH;
  }
  const qIndex = trimmed.indexOf('?');
  const pathname = qIndex >= 0 ? trimmed.slice(0, qIndex) : trimmed;
  const search = qIndex >= 0 ? trimmed.slice(qIndex + 1) : '';
  const canonical = canonicalImpersonationReturnPath(pathname, search);
  if (!canonical.startsWith('/admin/')) return IMPERSONATION_DASHBOARD_PATH;
  return canonical;
}
