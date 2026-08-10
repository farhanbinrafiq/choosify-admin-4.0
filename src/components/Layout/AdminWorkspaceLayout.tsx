import React, { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { UserProfileDropdown } from '../account/UserProfileDropdown';
import { NotificationBellDropdown } from '../account/NotificationBellDropdown';
import {
  NAV_DEFS,
  PAGE_KEY_TO_PATH,
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

/** Seller/Creator chrome must include identity profile keys missing from admin NAV_DEFS. */
function filterNavForRole(role: string | undefined): CmsNavGroup[] {
  if (role === 'seller') {
    return [
      {
        title: 'OVERVIEW',
        items: [{ key: 'dashboard', label: 'Dashboard', path: PAGE_KEY_TO_PATH.dashboard }],
      },
      {
        title: 'BRAND & CATALOG',
        items: [
          { key: 'brands', label: 'Brand Management Studio', path: PAGE_KEY_TO_PATH.brands },
          { key: 'brandProfile', label: 'Seller Profile', path: PAGE_KEY_TO_PATH.brandProfile },
          { key: 'products', label: 'Products & Inventory', path: PAGE_KEY_TO_PATH.products },
        ],
      },
      {
        title: 'COMMERCE',
        items: [
          { key: 'orders', label: 'Orders Hub', path: PAGE_KEY_TO_PATH.orders },
          { key: 'sellerCustomers', label: 'Seller Customers', path: PAGE_KEY_TO_PATH.sellerCustomers },
          { key: 'returnsRefunds', label: 'Returns & Refunds', path: PAGE_KEY_TO_PATH.returnsRefunds },
          { key: 'promoCodes', label: 'Promo Codes & Vouchers', path: PAGE_KEY_TO_PATH.promoCodes },
        ],
      },
      {
        title: 'LOGISTICS MANAGEMENT',
        items: [
          { key: 'courierProviders', label: 'Courier Providers', path: PAGE_KEY_TO_PATH.courierProviders },
          { key: 'shipmentOperations', label: 'Shipment Operations', path: PAGE_KEY_TO_PATH.shipmentOperations },
          { key: 'courierAnalytics', label: 'Courier Analytics', path: PAGE_KEY_TO_PATH.courierAnalytics },
        ],
      },
      {
        title: 'TRUST & SAFETY',
        items: [{ key: 'reviews', label: 'Reviews', path: PAGE_KEY_TO_PATH.reviews }],
      },
      {
        title: 'COMMUNICATION',
        items: [{ key: 'messages', label: 'Messages', tag: '12', path: PAGE_KEY_TO_PATH.messages }],
      },
      {
        title: 'FINANCE',
        items: [
          { key: 'finance', label: 'Analytics', path: PAGE_KEY_TO_PATH.finance },
          { key: 'myCashbook', label: 'My Cashbook', tag: 'PRIVATE', path: PAGE_KEY_TO_PATH.myCashbook },
        ],
      },
      {
        title: 'SETTINGS',
        items: [{ key: 'settings', label: 'Settings', path: PAGE_KEY_TO_PATH.settings }],
      },
    ];
  }

  if (role === 'creator') {
    return [
      {
        title: 'OVERVIEW',
        items: [{ key: 'dashboard', label: 'Dashboard', path: PAGE_KEY_TO_PATH.dashboard }],
      },
      {
        title: 'PEOPLE',
        items: [
          { key: 'creators', label: 'Creator Studio', path: PAGE_KEY_TO_PATH.creators },
          { key: 'creatorProfile', label: 'Creator Profile', path: PAGE_KEY_TO_PATH.creatorProfile },
          { key: 'creatorEconomy', label: 'Creator Economy', path: PAGE_KEY_TO_PATH.creatorEconomy },
        ],
      },
      {
        title: 'MARKETING & CONTENT',
        items: [
          { key: 'contentStudio', label: 'Guide Management', tag: 'NEW', path: PAGE_KEY_TO_PATH.contentStudio },
        ],
      },
      {
        title: 'TRUST & SAFETY',
        items: [{ key: 'reviews', label: 'Reviews', path: PAGE_KEY_TO_PATH.reviews }],
      },
      {
        title: 'COMMUNICATION',
        items: [{ key: 'messages', label: 'Messages', tag: '12', path: PAGE_KEY_TO_PATH.messages }],
      },
      {
        title: 'FINANCE',
        items: [
          { key: 'finance', label: 'Finance', path: PAGE_KEY_TO_PATH.finance },
          { key: 'myCashbook', label: 'My Cashbook', tag: 'PRIVATE', path: PAGE_KEY_TO_PATH.myCashbook },
        ],
      },
      {
        title: 'SETTINGS',
        items: [{ key: 'settings', label: 'Settings', path: PAGE_KEY_TO_PATH.settings }],
      },
    ];
  }

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
            <NotificationBellDropdown />
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
