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
import { DashboardHeaderMessageButton } from '../components/account/DashboardHeaderMessageButton';
import { GlobalDashboardSearch } from '../components/common/GlobalDashboardSearch';
import { AdminPageSkeleton, DashboardSearchSkeleton, SkeletonAvatar } from '../components/common/skeletons';
import { formatRoleLabel, getMyProfilePath } from '../lib/userDisplay';
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
const CMS_MIRROR_ASSET_VERSION = '20260902-brand-palette-canonical';

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

function parseBrandDetail(pathname: string, search: string): { id: string | null; name: string | null } {
  const match = pathname.match(/^\/admin\/brand-detail\/([^/?#]+)/);
  const id = match?.[1] ? decodeURIComponent(match[1]) : null;
  const name = new URLSearchParams(search).get('name');
  return { id, name: name || null };
}

type MirrorDeepLink =
  | { kind: 'customer'; id: string }
  | { kind: 'creator'; id: string }
  | { kind: 'seller'; id: string }
  | { kind: 'brand'; id: string | null; name: string | null };

function parseMirrorDeepLink(pathname: string, search: string): MirrorDeepLink | null {
  const qs = new URLSearchParams(search);
  const consumer = pathname.match(/^\/admin\/consumers\/([^/?#]+)/);
  if (consumer?.[1]) return { kind: 'customer', id: decodeURIComponent(consumer[1]) };
  const creatorInspect = pathname.match(/^\/admin\/creators\/([^/?#]+)/);
  if (creatorInspect?.[1]) return { kind: 'creator', id: decodeURIComponent(creatorInspect[1]) };
  const creator = pathname.match(/^\/admin\/creator-profile\/([^/?#]+)/);
  if (creator?.[1]) return { kind: 'creator', id: decodeURIComponent(creator[1]) };
  const sellerId = qs.get('sellerId') || qs.get('userId');
  if (
    sellerId &&
    (pathname === '/admin/brand-studio' ||
      pathname === '/admin/brand-profile' ||
      pathname.startsWith('/admin/brand-profile/'))
  ) {
    return { kind: 'seller', id: sellerId };
  }
  const brand = parseBrandDetail(pathname, search);
  if (brand.id || brand.name) return { kind: 'brand', id: brand.id, name: brand.name };
  return null;
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
  const { state: impersonation, openLoginAsConfirm, exitImpersonation } = useImpersonation();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const searchAnchorRef = useRef<HTMLDivElement>(null);
  const messageAnchorRef = useRef<HTMLDivElement>(null);
  const knownPageKey = useMemo(() => resolveAdminPageKey(location.pathname), [location.pathname]);
  const pageKey = useMemo(() => pathToPageKey(location.pathname), [location.pathname]);
  const deepLink = useMemo(
    () => parseMirrorDeepLink(location.pathname, location.search),
    [location.pathname, location.search],
  );
  const role = profile?.role;
  const canImpersonate = can('impersonate') && !impersonation.active;

  /** First-load / role-change gate: search stays non-interactive until iframe chrome is ready. */
  const [iframeReady, setIframeReady] = useState(false);
  const [slotReady, setSlotReady] = useState(false);
  const [bootFailed, setBootFailed] = useState(false);
  const shellInteractive = (iframeReady && slotReady) || bootFailed;

  const postSelectDeepLink = useCallback(() => {
    if (!deepLink) return;
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    try {
      if (deepLink.kind === 'customer') {
        win.postMessage({ type: 'cms-mirror-select-customer', id: deepLink.id }, '*');
        return;
      }
      if (deepLink.kind === 'creator') {
        win.postMessage({ type: 'cms-mirror-select-creator', id: deepLink.id }, '*');
        return;
      }
      if (deepLink.kind === 'seller') {
        win.postMessage({ type: 'cms-mirror-select-brand', id: deepLink.id }, '*');
        return;
      }
      win.postMessage(
        { type: 'cms-mirror-select-brand', id: deepLink.id, name: deepLink.name },
        '*',
      );
    } catch {
      /* ignore */
    }
  }, [deepLink]);

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
            avatarUrl: profile?.avatar || null,
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
        window.setTimeout(() => {
          postSelectDeepLink();
        }, 120);
      } catch {
        /* ignore */
      }
    },
    [
      profile?.id,
      profile?.displayName,
      profile?.email,
      profile?.avatar,
      profile?.username,
      profile?.website,
      profile?.bio,
      profile?.choosifyUserId,
      activeBrandId,
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
      postSelectDeepLink,
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
    if (!deepLink) return;
    postSelectDeepLink();
    const t = window.setInterval(() => postSelectDeepLink(), 400);
    const stop = window.setTimeout(() => window.clearInterval(t), 8000);
    return () => {
      window.clearInterval(t);
      window.clearTimeout(stop);
    };
  }, [deepLink, postSelectDeepLink]);

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
        const msgAnchor = messageAnchorRef.current;
        const msgSlot = doc?.querySelector('[data-cms-message-slot]') as HTMLElement | null;
        if (msgAnchor && msgSlot) {
          const iframeBox = iframe.getBoundingClientRect();
          const msgRect = msgSlot.getBoundingClientRect();
          msgAnchor.style.top = `${Math.round(iframeBox.top + msgRect.top)}px`;
          msgAnchor.style.left = `${Math.round(iframeBox.left + msgRect.left)}px`;
          msgAnchor.style.width = `${Math.round(Math.max(msgRect.width, 28))}px`;
          msgAnchor.style.height = `${Math.round(Math.max(msgRect.height, 28))}px`;
        }

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
        openLoginAsConfirm({
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
        // The pre-built mirror bundle can carry a stale page→path map (e.g. an
        // older path for a nav key that has since moved). Re-resolve through the
        // host's live PAGE_KEY_TO_PATH so a nav click always lands on the current
        // route — this is what makes seller/creator "Guide Management" reach the
        // canonical /admin/guides React surface instead of a legacy path.
        const navKey = pathToPageKey(data.path);
        const canonical = navKey ? PAGE_KEY_TO_PATH[navKey] : undefined;
        const dest = canonical && canonical !== data.path ? canonical : data.path;
        if (dest !== location.pathname) {
          navigate(dest, { replace: Boolean(data.replace) });
        }
        return;
      }
      if (!data || data.type !== 'cms-mirror-page' || typeof data.page !== 'string') return;
      if (data.page === 'brands' && location.pathname.startsWith('/admin/brand-detail')) {
        navigate('/admin/brand-studio', { replace: true });
        return;
      }
      const target = PAGE_KEY_TO_PATH[data.page] || '/admin/dashboard';
      if (
        location.pathname === target ||
        location.pathname.startsWith(`${target}/`) ||
        pathToPageKey(location.pathname) === data.page
      ) {
        return;
      }
      if (target !== location.pathname) {
        navigate(target, { replace: true });
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [canImpersonate, location.pathname, navigate, openLoginAsConfirm, postAuthTokenToMirror, profile?.id, refreshNavAttention]);

  const onIframeLoad = () => {
    setIframeReady(true);
    postMirrorState(pageKey, role);
    postAuthTokenToMirror();
    postSelectDeepLink();
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

  /** Leftover ?impersonate=1 deep links: open overlay in place. Do not change the page. */
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('impersonate') !== '1') return;
    if (!canImpersonate) return;
    const id =
      deepLink && (deepLink.kind === 'customer' || deepLink.kind === 'creator' || deepLink.kind === 'seller')
        ? deepLink.id
        : '';
    if (id) {
      openLoginAsConfirm({
        targetUserId: id,
        displayName: 'User',
        roleLabel:
          deepLink?.kind === 'creator' ? 'Creator' : deepLink?.kind === 'seller' ? 'Seller' : 'Consumer',
      });
    }
    params.delete('impersonate');
    const next = params.toString();
    navigate({ pathname: location.pathname, search: next ? `?${next}` : '' }, { replace: true });
  }, [canImpersonate, deepLink, location.pathname, location.search, navigate, openLoginAsConfirm]);

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
        <div ref={messageAnchorRef} className="cms-mirror-message-anchor">
          <DashboardHeaderMessageButton />
        </div>
      ) : null}

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
    </div>
  );
};

export default CmsMirrorHost;
