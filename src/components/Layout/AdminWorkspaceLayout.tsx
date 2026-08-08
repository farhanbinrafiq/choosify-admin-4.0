import React, { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { UserProfileDropdown } from '../account/UserProfileDropdown';
import {
  NAV_DEFS,
  PAGE_META,
  allowedPageKeysForRole,
  pathToPageKey,
  type CmsNavGroup,
} from '../../cms-mirror/nav';
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

function filterNavForRole(role: string | undefined): CmsNavGroup[] {
  const allowed = allowedPageKeysForRole(role);
  if (!allowed) return NAV_DEFS;

  return NAV_DEFS.map((group) => ({
    ...group,
    items: group.items.filter((item) => allowed.includes(item.key)),
  })).filter((group) => group.items.length > 0);
}

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
  const location = useLocation();
  const navigate = useNavigate();
  const [navSearch, setNavSearch] = useState('');
  const [catalogSearch, setCatalogSearch] = useState('');

  const activePageKey = pathToPageKey(location.pathname);
  const role = profile?.role;

  const navGroups = useMemo(() => {
    const roleFiltered = filterNavForRole(role);
    const q = navSearch.trim().toLowerCase();
    if (!q) return roleFiltered;
    return roleFiltered
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => item.label.toLowerCase().includes(q)),
      }))
      .filter((group) => group.items.length > 0);
  }, [role, navSearch]);

  const meta = PAGE_META[activePageKey] || PAGE_META.dashboard;
  const title = pageTitle ?? meta[0];
  const subtitle = pageSubtitle ?? meta[1];

  const displayName = profile?.displayName?.trim() || profile?.email?.trim() || 'User';
  const email = profile?.email?.trim() || '';
  const roleLabel = formatRoleLabel(profile?.role);
  const initials = getUserInitials(displayName, email);
  const avatarUrl = profile ? getAvatarUrl(profile) : '';

  const isNavActive = (path: string, key: string) => {
    if (key === 'brands') return location.pathname.startsWith('/admin/brand-studio');
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
                return (
                  <Link
                    key={item.key}
                    to={item.path}
                    className={`admin-workspace__nav-item${active ? ' admin-workspace__nav-item--active' : ''}`}
                    aria-current={active ? 'page' : undefined}
                  >
                    <span className="admin-workspace__nav-bar" aria-hidden />
                    <span className="admin-workspace__nav-label">{item.label}</span>
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
          <div>
            <div className="admin-workspace__topbar-title">{title}</div>
            <div className="admin-workspace__topbar-subtitle">{subtitle}</div>
          </div>
          <div className="admin-workspace__topbar-actions">
            <input
              className="admin-workspace__topbar-search"
              value={catalogSearch}
              onChange={(e) => setCatalogSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && catalogSearch.trim()) {
                  navigate(`/admin/products?q=${encodeURIComponent(catalogSearch.trim())}`);
                }
              }}
              placeholder="Search catalog, brands, sellers..."
              aria-label="Search catalog"
            />
            <button
              type="button"
              className="admin-workspace__topbar-icon"
              onClick={() => navigate('/admin/notifications')}
              aria-label="Notifications"
            >
              <Bell size={18} strokeWidth={1.6} />
              <span className="admin-workspace__topbar-badge">5</span>
            </button>
            <div className="admin-workspace__topbar-divider" aria-hidden />
            <UserProfileDropdown variant="header" />
          </div>
        </header>

        <main className="admin-workspace__content">{children}</main>
      </div>
    </div>
  );
};

export default AdminWorkspaceLayout;
