import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useImpersonation } from '../contexts/ImpersonationContext';
import { useRbac } from '../contexts/RbacContext';
import { useEntitlements } from '../contexts/EntitlementsContext';
import {
  PAGE_KEY_TO_PATH,
  allowedPageKeysForRole,
  navGroupsForMirror,
  partnerNavGroupsForSession,
  pathToPageKey,
  resolveAdminPageKey,
} from './nav';
import { UserProfileDropdown } from '../components/account/UserProfileDropdown';
import { GlobalDashboardSearch } from '../components/common/GlobalDashboardSearch';
import { AdminPageSkeleton, DashboardSearchSkeleton, SkeletonAvatar } from '../components/common/skeletons';
import { formatRoleLabel, getAvatarUrl, getMyProfilePath } from '../lib/userDisplay';
import { getLivePreviewStorefrontUrl, getPublishedStorefrontUrl } from '../lib/storefrontUrls';
import {
  MARKETPLACE_PENDING_ALLOWED_PAGE_KEYS,
  MarketplaceAccessLockPanel,
  partnerMarketplaceLocked,
} from '../components/MarketplaceAccessLock';
import { useNavAttention } from '../contexts/NavAttentionContext';
import './tokens.css';

const NotFoundPage = lazy(() => import('../pages/NotFoundPage'));

/** Bump when public/cms-mirror/app.html behavior changes so the iframe never serves a stale 304. */
const CMS_MIRROR_ASSET_VERSION = '20260813-partner-restricted-nav-2';

function pageSkeletonVariant(pageKey: string): 'dashboard' | 'profile' | 'orders' | 'products' | 'generic' {
  if (pageKey === 'dashboard') return 'dashboard';
  if (
    pageKey === 'brandProfile' ||
    pageKey === 'creatorProfile' ||
    pageKey === 'consumerProfile' ||
    pageKey === 'adminProfile' ||
    pageKey === 'profile'
  ) {
    return 'profile';
  }
  if (pageKey === 'orders' || pageKey === 'returnsRefunds') return 'orders';
  if (pageKey === 'products' || pageKey === 'inventoryStock') return 'products';
  return 'generic';
}

type LoginAsTarget = {
  targetUserId: string;
  displayName: string;
  roleLabel: string;
  choosifyUserId?: string;
  email?: string;
  avatarUrl?: string;
};

function parseBrandDetail(pathname: string, search: string): { id: string | null; name: string | null } {
  const match = pathname.match(/^\/admin\/brand-detail\/([^/?#]+)/);
  const id = match?.[1] ? decodeURIComponent(match[1]) : null;
  const name = new URLSearchParams(search).get('name');
  return { id, name: name || null };
}

/**
 * Full-viewport 1:1 host for the Choosify Admin CMS standalone prototype.
 * Seller/creator see the same shell with a filtered left menu.
 *
 * Remount only on role change (nav filter + data scope). Page changes sync via
 * postMessage / hash so Brand & Creator Studio keep selection state instead of
 * blanking the main pane on every remount race.
 *
 * Host overlays (outside iframe):
 * - GlobalDashboardSearch (storefront-style operational search)
 * - UserProfileDropdown
 * - Impersonation banner + Login As User confirmation
 */
export const CmsMirrorHost: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, activeBrandId } = useAuth();
  const { can } = useRbac();
  const { state: impersonation, startImpersonation, exitImpersonation } = useImpersonation();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const searchAnchorRef = useRef<HTMLDivElement>(null);
  const knownPageKey = useMemo(() => resolveAdminPageKey(location.pathname), [location.pathname]);
  const pageKey = useMemo(() => pathToPageKey(location.pathname), [location.pathname]);
  const brandDetail = useMemo(
    () => parseBrandDetail(location.pathname, location.search),
    [location.pathname, location.search],
  );
  const role = profile?.role;
  const canImpersonate = can('impersonate') && !impersonation.active;

  const [loginAsTarget, setLoginAsTarget] = useState<LoginAsTarget | null>(null);
  const [loginAsReason, setLoginAsReason] = useState('Customer support / diagnostics');
  const [loginAsError, setLoginAsError] = useState<string | null>(null);
  const [loginAsBusy, setLoginAsBusy] = useState(false);
  /** First-load / role-change gate: search stays non-interactive until iframe chrome is ready. */
  const [iframeReady, setIframeReady] = useState(false);
  const [slotReady, setSlotReady] = useState(false);
  const [bootFailed, setBootFailed] = useState(false);
  const shellInteractive = (iframeReady && slotReady) || bootFailed;

  const postSelectBrand = useCallback(() => {
    if (!brandDetail.id && !brandDetail.name) return;
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    try {
      win.postMessage(
        {
          type: 'cms-mirror-select-brand',
          id: brandDetail.id,
          name: brandDetail.name,
        },
        '*',
      );
    } catch {
      /* ignore */
    }
  }, [brandDetail.id, brandDetail.name]);

  const { filterAllowedPageKeys, status: entitlementStatus, entitlements } = useEntitlements();
  const { counts: navAttention, refresh: refreshNavAttention } = useNavAttention();

  const postMirrorState = useCallback(
    (page: string, nextRole: string | undefined) => {
      if (!nextRole) return;
      const win = iframeRef.current?.contentWindow;
      if (!win) return;
      try {
        const tabParam = new URLSearchParams(location.search).get('tab');
        const marketplaceLocked = partnerMarketplaceLocked(profile);
        const allowedKeys = marketplaceLocked
          ? allowedPageKeysForRole(nextRole)
          : filterAllowedPageKeys(allowedPageKeysForRole(nextRole));
        const partnerChrome =
          nextRole === 'seller' || nextRole === 'creator' || nextRole === 'consumer';
        const navGroups = partnerChrome
          ? navGroupsForMirror(
              partnerNavGroupsForSession({
                role: nextRole,
                marketplaceAccess: profile?.marketplaceAccess,
                filterAllowedPageKeys,
              }),
            )
          : null;
        win.postMessage(
          {
            type: 'cms-mirror-set-state',
            page,
            role: nextRole,
            tab:
              page === 'myEarnings' && (tabParam === 'payment' || tabParam === 'overview')
                ? tabParam
                : undefined,
            allowedKeys,
            navGroups,
            userId: profile?.id || null,
            displayName: profile?.displayName || null,
            email: profile?.email || null,
            activeBrandId: activeBrandId || null,
            username: profile?.username || null,
            website: profile?.website || null,
            bio: profile?.bio || null,
            choosifyUserId: profile?.choosifyUserId || null,
            canImpersonate,
            storefrontUrl: getPublishedStorefrontUrl(),
            previewUrl: getLivePreviewStorefrontUrl(),
            entitlements,
            marketplaceAccess: profile?.marketplaceAccess !== false,
            partnerApplicationStatus: profile?.partnerApplicationStatus || null,
            identityVerified: profile?.identityVerified === true,
            resubmissionRequested: profile?.resubmissionRequested === true,
            navAttention,
          },
          '*',
        );
        const token = localStorage.getItem('choosify_auth_token');
        if (token) {
          win.postMessage({ type: 'cms-mirror-auth-token', token }, '*');
        }
        if (brandDetail.id || brandDetail.name) {
          window.setTimeout(() => {
            try {
              win.postMessage(
                {
                  type: 'cms-mirror-select-brand',
                  id: brandDetail.id,
                  name: brandDetail.name,
                },
                '*',
              );
            } catch {
              /* ignore */
            }
          }, 120);
        }
      } catch {
        /* ignore */
      }
    },
    [
      profile?.id,
      profile?.displayName,
      profile?.email,
      profile?.username,
      profile?.website,
      profile?.bio,
      profile?.choosifyUserId,
      activeBrandId,
      brandDetail.id,
      brandDetail.name,
      location.search,
      canImpersonate,
      filterAllowedPageKeys,
      entitlementStatus,
      entitlements,
      profile?.marketplaceAccess,
      profile?.partnerApplicationStatus,
      profile?.identityVerified,
      profile?.resubmissionRequested,
      navAttention,
    ],
  );

  const postAuthTokenToMirror = useCallback(() => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    const token = localStorage.getItem('choosify_auth_token');
    if (!token) return;
    try {
      win.postMessage({ type: 'cms-mirror-auth-token', token }, '*');
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!knownPageKey || !role) return;
    postMirrorState(pageKey, role);
  }, [knownPageKey, pageKey, role, postMirrorState]);

  useEffect(() => {
    if (!profile) return;
    postAuthTokenToMirror();
  }, [profile?.id, postAuthTokenToMirror]);

  useEffect(() => {
    if (!brandDetail.id && !brandDetail.name) return;
    const t = window.setInterval(() => postSelectBrand(), 400);
    const stop = window.setTimeout(() => window.clearInterval(t), 8000);
    return () => {
      window.clearInterval(t);
      window.clearTimeout(stop);
    };
  }, [brandDetail.id, brandDetail.name, postSelectBrand]);

  /** Pin React search overlay to the iframe flex search slot (storefront-width parity). */
  useEffect(() => {
    let slotRo: ResizeObserver | null = null;
    let observedSlot: Element | null = null;

    const syncSearchSlot = () => {
      const anchor = searchAnchorRef.current;
      const iframe = iframeRef.current;
      if (!anchor || !iframe) return;
      try {
        const doc = iframe.contentDocument;
        const slot = doc?.querySelector('[data-cms-search-slot]') as HTMLElement | null;
        if (!slot) return;

        // Observe the live flex slot so title/control width changes reflow the overlay.
        if (slot !== observedSlot) {
          slotRo?.disconnect();
          observedSlot = slot;
          if (typeof ResizeObserver !== 'undefined') {
            slotRo = new ResizeObserver(() => syncSearchSlot());
            slotRo.observe(slot);
          }
        }

        const iframeRect = iframe.getBoundingClientRect();
        const rect = slot.getBoundingClientRect();
        if (rect.width < 40 || rect.height < 8) return;

        // Content box of the padded flex-1 band — same region Choosify-Web
        // `navbar-fluid` fills inside `px-1 sm:px-3 md:px-4 lg:px-5`.
        const cs = doc.defaultView?.getComputedStyle(slot);
        const padL = cs ? parseFloat(cs.paddingLeft) || 0 : 0;
        const padR = cs ? parseFloat(cs.paddingRight) || 0 : 0;

        const left = iframeRect.left + rect.left + padL;
        const rightEdge = iframeRect.left + rect.right - padR;
        const top = iframeRect.top + rect.top;

        // Stretch with left+right (width:auto) — never lock a short fixed width.
        anchor.style.top = `${Math.round(top)}px`;
        anchor.style.left = `${Math.round(left)}px`;
        anchor.style.right = `${Math.round(Math.max(0, window.innerWidth - rightEdge))}px`;
        anchor.style.width = 'auto';
        anchor.style.maxWidth = 'none';
        anchor.style.height = `${Math.round(Math.max(rect.height, 40))}px`;
        anchor.style.padding = '0';
        setSlotReady(true);
      } catch {
        /* cross-origin / unloaded */
      }
    };

    syncSearchSlot();
    const interval = window.setInterval(syncSearchSlot, 300);
    window.addEventListener('resize', syncSearchSlot);
    const iframe = iframeRef.current;
    iframe?.addEventListener('load', syncSearchSlot);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('resize', syncSearchSlot);
      iframe?.removeEventListener('load', syncSearchSlot);
      slotRo?.disconnect();
    };
  }, [knownPageKey, pageKey, role, impersonation.active]);

  /** Role / impersonation identity change: re-gate chrome until iframe remount settles. */
  useEffect(() => {
    setIframeReady(false);
    setSlotReady(false);
    setBootFailed(false);
  }, [role, impersonation.active, impersonation.targetUserId]);

  /** Fail-safe: never leave an infinite skeleton if iframe boot stalls. */
  useEffect(() => {
    if (shellInteractive) return;
    const t = window.setTimeout(() => setBootFailed(true), 10000);
    return () => window.clearTimeout(t);
  }, [shellInteractive, role]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (data?.type === 'cms-mirror-auth-token-request') {
        postAuthTokenToMirror();
        return;
      }
      if (data?.type === 'cms-mirror-login-as-user') {
        if (!canImpersonate) return;
        const targetUserId = typeof data.targetUserId === 'string' ? data.targetUserId.trim() : '';
        if (!targetUserId) return;
        if (profile?.id && targetUserId === profile.id) return;
        setLoginAsError(null);
        setLoginAsReason('Customer support / diagnostics');
        setLoginAsTarget({
          targetUserId,
          displayName: typeof data.displayName === 'string' ? data.displayName : 'User',
          roleLabel: typeof data.roleLabel === 'string' ? data.roleLabel : 'User',
          choosifyUserId: typeof data.choosifyUserId === 'string' ? data.choosifyUserId : undefined,
          email: typeof data.email === 'string' ? data.email : undefined,
          avatarUrl: typeof data.avatarUrl === 'string' ? data.avatarUrl : undefined,
        });
        return;
      }
      if (data?.type === 'cms-mirror-nav-attention-refresh') {
        void refreshNavAttention();
        return;
      }
      if (data?.type === 'cms-mirror-navigate' && typeof data.path === 'string') {
        if (data.path !== location.pathname) {
          navigate(data.path, { replace: Boolean(data.replace) });
        }
        return;
      }
      if (!data || data.type !== 'cms-mirror-page' || typeof data.page !== 'string') return;
      if (data.page === 'brands' && location.pathname.startsWith('/admin/brand-detail')) {
        navigate('/admin/brand-studio', { replace: true });
        return;
      }
      const target = PAGE_KEY_TO_PATH[data.page] || '/admin/dashboard';
      if (target !== location.pathname) {
        navigate(target, { replace: true });
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [canImpersonate, location.pathname, navigate, postAuthTokenToMirror, profile?.id, refreshNavAttention]);

  const onIframeLoad = () => {
    setIframeReady(true);
    postMirrorState(pageKey, role);
    postAuthTokenToMirror();
    postSelectBrand();
  };

  const iframeSrc = useMemo(
    () =>
      `/cms-mirror/app.html?v=${CMS_MIRROR_ASSET_VERSION}#page=${encodeURIComponent(pageKey)}&role=${encodeURIComponent(role || '')}`,
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pageKey applied via postMessage after load
    [role],
  );

  useEffect(() => {
    if (!knownPageKey || !role) return;
    const allowed = filterAllowedPageKeys(allowedPageKeysForRole(role));
    if (allowed && !allowed.includes(pageKey)) {
      navigate('/admin/dashboard', { replace: true });
    }
  }, [knownPageKey, role, pageKey, navigate, filterAllowedPageKeys]);

  useEffect(() => {
    if (!role) return;
    if (!location.pathname.startsWith('/admin/brand-detail')) return;
    if (role === 'admin' || role === 'super_admin') return;
    navigate('/admin/brand-studio', { replace: true });
  }, [location.pathname, role, navigate]);

  const confirmLoginAs = async () => {
    if (!loginAsTarget) return;
    setLoginAsBusy(true);
    setLoginAsError(null);
    try {
      await startImpersonation({
        targetUserId: loginAsTarget.targetUserId,
        reason: loginAsReason.trim() || 'Customer support / diagnostics',
      });
    } catch (e) {
      setLoginAsError(e instanceof Error ? e.message : String(e));
      setLoginAsBusy(false);
    }
  };

  if (!profile || !role) {
    return (
      <div className="cms-mirror-host cms-mirror-host--booting" role="status" aria-busy="true" aria-label="Loading dashboard">
        <div className="cms-mirror-boot-chrome" aria-hidden>
          <div className="cms-mirror-boot-sidebar" />
          <div className="cms-mirror-boot-main">
            <div className="cms-mirror-boot-topbar">
              <div className="cms-mirror-boot-title-skel" />
              <div className="cms-mirror-boot-search-skel">
                <DashboardSearchSkeleton />
              </div>
              <SkeletonAvatar className="w-8 h-8 bg-white/20" />
            </div>
            <AdminPageSkeleton variant="dashboard" />
          </div>
        </div>
      </div>
    );
  }

  if (!knownPageKey) {
    return (
      <Suspense fallback={<AdminPageSkeleton variant="generic" />}>
        <NotFoundPage />
      </Suspense>
    );
  }

  return (
    <div
      className={`cms-mirror-host${impersonation.active ? ' cms-mirror-host--impersonating' : ''}${
        !shellInteractive ? ' cms-mirror-host--booting' : ''
      }`}
      aria-busy={!shellInteractive}
    >
      {impersonation.active && (
        <div className="cms-mirror-impersonation-banner" role="status">
          <div className="cms-mirror-impersonation-banner__copy">
            <div className="cms-mirror-impersonation-banner__eyebrow">You are viewing Choosify as</div>
            <div className="cms-mirror-impersonation-banner__title">
              {profile.displayName || 'User'} · {formatRoleLabel(profile.role)} ·{' '}
              {profile.choosifyUserId || '—'}
            </div>
          </div>
          <button
            type="button"
            className="cms-mirror-impersonation-banner__exit"
            onClick={() => void exitImpersonation()}
          >
            Exit Impersonation
          </button>
        </div>
      )}

      <div
        ref={searchAnchorRef}
        className={`cms-mirror-search-anchor${!shellInteractive ? ' cms-mirror-search-anchor--booting' : ''}`}
      >
        <GlobalDashboardSearch variant="topbar" className="w-full" ready={shellInteractive} />
      </div>

      {shellInteractive ? (
        <UserProfileDropdown variant="overlay" />
      ) : (
        <div className="cms-mirror-profile-anchor" aria-hidden>
          <SkeletonAvatar className="w-9 h-9 bg-white/25" />
        </div>
      )}

      {!shellInteractive ? (
        <div className="cms-mirror-boot-overlay" role="status" aria-busy="true" aria-label="Loading page">
          <div className="cms-mirror-boot-chrome">
            <div className="cms-mirror-boot-sidebar" />
            <div className="cms-mirror-boot-main">
              <div className="cms-mirror-boot-topbar cms-mirror-boot-topbar--spacer" aria-hidden />
              <AdminPageSkeleton variant={pageSkeletonVariant(pageKey)} />
              {bootFailed ? (
                <div className="cms-mirror-boot-error" role="alert">
                  Dashboard is taking longer than expected. Content will appear when ready.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <iframe
        key={`${role}::${CMS_MIRROR_ASSET_VERSION}`}
        ref={iframeRef}
        title="Choosify Admin CMS"
        src={iframeSrc}
        onLoad={onIframeLoad}
        allow="clipboard-read; clipboard-write"
        className={!shellInteractive ? 'cms-mirror-iframe--booting' : undefined}
      />

      {partnerMarketplaceLocked(profile) && !MARKETPLACE_PENDING_ALLOWED_PAGE_KEYS.has(pageKey) ? (
        <div className="cms-mirror-marketplace-lock" role="status">
          <MarketplaceAccessLockPanel profilePath={getMyProfilePath(profile)} />
        </div>
      ) : null}

      {loginAsTarget && (
        <div className="cms-mirror-login-as-modal" role="dialog" aria-modal="true" aria-labelledby="login-as-title">
          <div className="cms-mirror-login-as-modal__card">
            <div className="cms-mirror-login-as-modal__warn">Privileged support action</div>
            <h2 id="login-as-title" className="cms-mirror-login-as-modal__title">
              Login As User?
            </h2>
            <p className="cms-mirror-login-as-modal__body">
              You are about to enter this account as:
            </p>
            <div className="cms-mirror-login-as-modal__target">
              <img
                src={
                  loginAsTarget.avatarUrl ||
                  getAvatarUrl({
                    displayName: loginAsTarget.displayName,
                    email: loginAsTarget.email || '',
                    avatar: undefined,
                  })
                }
                alt=""
                className="cms-mirror-login-as-modal__avatar"
              />
              <div className="min-w-0">
                <div className="cms-mirror-login-as-modal__name">{loginAsTarget.displayName}</div>
                <div className="cms-mirror-login-as-modal__meta">
                  {loginAsTarget.roleLabel}
                  {loginAsTarget.choosifyUserId ? ` · ${loginAsTarget.choosifyUserId}` : ''}
                </div>
                {loginAsTarget.email ? (
                  <div className="cms-mirror-login-as-modal__email">{loginAsTarget.email}</div>
                ) : null}
              </div>
            </div>
            <p className="cms-mirror-login-as-modal__body">
              You will temporarily experience Choosify using this user&apos;s permissions and account
              scope. Your admin session is retained and can be restored via Exit Impersonation.
            </p>
            <label className="cms-mirror-login-as-modal__label" htmlFor="login-as-reason">
              Support reason (required)
            </label>
            <textarea
              id="login-as-reason"
              value={loginAsReason}
              onChange={(e) => setLoginAsReason(e.target.value)}
              className="cms-mirror-login-as-modal__reason"
              rows={3}
            />
            {loginAsError ? <div className="cms-mirror-login-as-modal__error">{loginAsError}</div> : null}
            <div className="cms-mirror-login-as-modal__actions">
              <button
                type="button"
                className="cms-mirror-login-as-modal__cancel"
                disabled={loginAsBusy}
                onClick={() => setLoginAsTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="cms-mirror-login-as-modal__confirm"
                disabled={loginAsBusy || loginAsReason.trim().length < 2}
                onClick={() => void confirmLoginAs()}
              >
                {loginAsBusy ? 'Starting…' : 'Login As User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CmsMirrorHost;
