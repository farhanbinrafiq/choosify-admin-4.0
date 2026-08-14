import React, { Suspense, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useImpersonation } from '../../contexts/ImpersonationContext';
import { useEntitlements } from '../../contexts/EntitlementsContext';
import { UserProfileDropdown } from '../account/UserProfileDropdown';
import { NotificationBellDropdown } from '../account/NotificationBellDropdown';
import { DashboardHeaderMessageButton } from '../account/DashboardHeaderMessageButton';
import { GlobalDashboardSearch } from '../common/GlobalDashboardSearch';
import { AdminPageSkeleton } from '../common/skeletons';
import {
  PAGE_META,
  partnerNavGroupsForSession,
  pathToPageKey,
} from '../../cms-mirror/nav';
import { useNavAttention } from '../../contexts/NavAttentionContext';
import { formatNavAttentionCount } from '../../services/navAttentionApi';
import {
  formatRoleLabel,
  getAvatarUrl,
  getUserInitials,
} from '../../lib/userDisplay';
import './adminWorkspace.css';

export type AdminWorkspaceLayoutProps = {
  children: React.ReactNode;
  /** Optional override for topbar title/subtitle; defaults from PAGE_META for the active route. */
  pageTitle?: string;
  pageSubtitle?: string;
};

/**
 * Shared React Admin workspace chrome — visual parity with the live Admin CMS shell.
 * Presentation only; does not change RBAC, auth, or backend behavior.
 */
export const AdminWorkspaceLayout: React.FC<AdminWorkspaceLayoutProps> = ({
  children,
  pageTitle,
  pageSubtitle,
}) => {
  const { profile } = useAuth();
  const { filterAllowedPageKeys } = useEntitlements();
  const { counts: navAttention } = useNavAttention();
  const { state: impersonation, exitImpersonation } = useImpersonation();
  const location = useLocation();
  const [navSearch, setNavSearch] = useState('');

  const activePageKey = pathToPageKey(location.pathname);
  const role = profile?.role;

  const navGroups = useMemo(() => {
    const roleFiltered = partnerNavGroupsForSession({
      role,
      marketplaceAccess: profile?.marketplaceAccess,
      filterAllowedPageKeys,
    });
    const q = navSearch.trim().toLowerCase();
    if (!q) return roleFiltered;
    return roleFiltered
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => item.label.toLowerCase().includes(q)),
      }))
      .filter((group) => group.items.length > 0);
  }, [role, navSearch, filterAllowedPageKeys, profile?.marketplaceAccess]);

  const metaBase = PAGE_META[activePageKey] || PAGE_META.dashboard;
  const meta: [string, string] =
    role === 'seller' && activePageKey === 'brands'
      ? ['Brand Management Studio', 'Manage your owned brands and open Brand Studio']
      : role === 'creator' && activePageKey === 'creators'
        ? ['Creator Studio', 'Edit and publish your live storefront creator profile']
        : metaBase;
  const title = pageTitle ?? meta[0];
  const subtitle = pageSubtitle ?? meta[1];

  const displayName = profile?.displayName?.trim() || profile?.email?.trim() || 'User';
  const email = profile?.email?.trim() || '';
  const roleLabel = formatRoleLabel(profile?.role);
  const initials = getUserInitials(displayName, email);
  const avatarUrl = profile ? getAvatarUrl(profile) : '';

  const isNavActive = (path: string, key: string) => {
    if (key === 'brands') return location.pathname.startsWith('/admin/brand-studio');
    if (key === 'creators') return location.pathname.startsWith('/admin/creator-studio');
    if (location.pathname === path) return true;
    if (path !== '/admin/dashboard' && location.pathname.startsWith(path)) return true;
    return activePageKey === key;
  };

  return (
    <div className="admin-workspace">
      <aside className="admin-workspace__sidebar" aria-label="Admin navigation">
        <div className="admin-workspace__logo">
          <Link to="/admin/dashboard" aria-label="Choosify Dashboard">
            <img
              src="/brand/choosify-logo-horizontal-white.svg"
              alt="Choosify"
              draggable={false}
            />
          </Link>
        </div>

        <div className="admin-workspace__nav-search">
          <input
            value={navSearch}
            onChange={(e) => setNavSearch(e.target.value)}
            placeholder="Search categories..."
            aria-label="Filter navigation"
          />
          {navSearch ? (
            <button
              type="button"
              className="admin-workspace__nav-search-clear"
              onClick={() => setNavSearch('')}
              aria-label="Clear navigation search"
            >
              ✕
            </button>
          ) : null}
        </div>

        <nav className="admin-workspace__nav">
          {navGroups.map((group) => (
            <div key={group.title} className="admin-workspace__nav-group">
              <div className="admin-workspace__nav-group-title">{group.title}</div>
              {group.items.map((item) => {
                const active = isNavActive(item.path, item.key);
                const attention = navAttention[item.key];
                const attentionCount = attention && attention.count > 0 ? attention.count : 0;
                const locked = item.lock === 'marketplace';
                return (
                  <Link
                    key={item.key}
                    to={item.path}
                    className={`admin-workspace__nav-item${active ? ' admin-workspace__nav-item--active' : ''}${locked ? ' admin-workspace__nav-item--locked' : ''}`}
                    aria-current={active ? 'page' : undefined}
                    aria-disabled={locked || undefined}
                    title={locked ? 'Marketplace Access Pending' : undefined}
                  >
                    <span className="admin-workspace__nav-bar" aria-hidden />
                    <span className="admin-workspace__nav-label">{item.label}</span>
                    {attentionCount > 0 ? (
                      <span
                        className="admin-workspace__nav-attention"
                        title={attention.label}
                        aria-label={attention.label}
                      >
                        {formatNavAttentionCount(attentionCount)}
                      </span>
                    ) : null}
                    {locked ? (
                      <span className="admin-workspace__nav-lock" title="Marketplace Access Pending">
                        LOCK
                      </span>
                    ) : null}
                    {item.tag ? <span className="admin-workspace__nav-tag">{item.tag}</span> : null}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="admin-workspace__sidebar-footer">
          <div className="admin-workspace__sidebar-avatar" aria-hidden>
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt=""
                onError={(event) => {
                  event.currentTarget.style.display = 'none';
                }}
              />
            ) : null}
            <span>{initials}</span>
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="admin-workspace__sidebar-name">{displayName}</div>
            <div className="admin-workspace__sidebar-role">{roleLabel}</div>
          </div>
        </div>
      </aside>

      <div className="admin-workspace__main">
        <header className="admin-workspace__topbar">
          <div className="admin-workspace__topbar-title-block">
            <div className="admin-workspace__topbar-title">{title}</div>
            <div className="admin-workspace__topbar-subtitle">{subtitle}</div>
          </div>
          <div className="admin-workspace__topbar-search-wrap">
            <GlobalDashboardSearch variant="topbar" className="w-full" ready={Boolean(profile?.role)} />
          </div>
          <div className="admin-workspace__topbar-actions">
            <DashboardHeaderMessageButton />
            <NotificationBellDropdown />
            <div className="admin-workspace__topbar-divider" aria-hidden />
            <UserProfileDropdown variant="header" />
          </div>
        </header>

        {impersonation.active ? (
          <div
            className="mx-6 mt-4 mb-0 px-4 py-3 rounded-lg border border-rose-300/40 bg-rose-600/10 text-rose-100 flex items-center justify-between gap-4"
            role="status"
          >
            <div className="min-w-0">
              <div className="text-[10px] font-extrabold uppercase tracking-widest text-rose-200">
                You are viewing Choosify as
              </div>
              <div className="text-[12px] font-bold text-white truncate mt-1">
                {profile?.displayName || 'User'} · {formatRoleLabel(profile?.role)} ·{' '}
                {profile?.choosifyUserId || '—'}
              </div>
            </div>
            <button
              type="button"
              onClick={() => void exitImpersonation()}
              className="shrink-0 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold"
            >
              Exit Impersonation
            </button>
          </div>
        ) : null}

        <main className="admin-workspace__content">
          <Suspense fallback={<AdminPageSkeleton variant="generic" />}>{children}</Suspense>
        </main>
      </div>
    </div>
  );
};

export default AdminWorkspaceLayout;
