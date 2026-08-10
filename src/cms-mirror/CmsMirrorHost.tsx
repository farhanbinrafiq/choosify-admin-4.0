import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { PAGE_KEY_TO_PATH, allowedPageKeysForRole, pathToPageKey, resolveAdminPageKey } from './nav';
import { UserProfileDropdown } from '../components/account/UserProfileDropdown';
import './tokens.css';

const NotFoundPage = lazy(() => import('../pages/NotFoundPage'));

/** Bump when public/cms-mirror/app.html behavior changes so the iframe never serves a stale 304. */
const CMS_MIRROR_ASSET_VERSION = '20260809-ui-hotfix-notif-bell-1';

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
 */
export const CmsMirrorHost: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const knownPageKey = useMemo(() => resolveAdminPageKey(location.pathname), [location.pathname]);
  const pageKey = useMemo(() => pathToPageKey(location.pathname), [location.pathname]);
  const brandDetail = useMemo(
    () => parseBrandDetail(location.pathname, location.search),
    [location.pathname, location.search],
  );
  const role = profile?.role;

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

  const postMirrorState = useCallback(
    (page: string, nextRole: string | undefined) => {
      if (!nextRole) return;
      const win = iframeRef.current?.contentWindow;
      if (!win) return;
      try {
        win.postMessage(
          {
            type: 'cms-mirror-set-state',
            page,
            role: nextRole,
            allowedKeys: allowedPageKeysForRole(nextRole),
            userId: profile?.id || null,
            displayName: profile?.displayName || null,
            email: profile?.email || null,
          },
          '*',
        );
        const token = localStorage.getItem('choosify_auth_token');
        if (token) {
          win.postMessage({ type: 'cms-mirror-auth-token', token }, '*');
        }
        // Select Brand Profile after page state lands (Admin Brand Detail route).
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
    [profile?.id, profile?.displayName, profile?.email, brandDetail.id, brandDetail.name],
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

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (data?.type === 'cms-mirror-auth-token-request') {
        postAuthTokenToMirror();
        return;
      }
      if (data?.type === 'cms-mirror-navigate' && typeof data.path === 'string') {
        if (data.path !== location.pathname) {
          navigate(data.path, { replace: Boolean(data.replace) });
        }
        return;
      }
      if (!data || data.type !== 'cms-mirror-page' || typeof data.page !== 'string') return;
      // Admin Brand Profile lives at /admin/brand-detail/:id — leaving brands page
      // (or clearing detail) should return to the React Brand Management ledger.
      if (
        data.page === 'brands' &&
        location.pathname.startsWith('/admin/brand-detail')
      ) {
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
  }, [location.pathname, navigate, postAuthTokenToMirror]);

  const onIframeLoad = () => {
    postMirrorState(pageKey, role);
    postAuthTokenToMirror();
    postSelectBrand();
  };

  const iframeSrc = useMemo(
    () =>
      `/cms-mirror/app.html?v=${CMS_MIRROR_ASSET_VERSION}#page=${encodeURIComponent(pageKey)}&role=${encodeURIComponent(role || '')}`,
    // role in src + key forces a clean boot when switching Admin/Seller/Creator
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pageKey applied via postMessage after load
    [role],
  );

  useEffect(() => {
    if (!knownPageKey || !role) return;
    const allowed = allowedPageKeysForRole(role);
    if (allowed && !allowed.includes(pageKey)) {
      navigate('/admin/dashboard', { replace: true });
    }
  }, [knownPageKey, role, pageKey, navigate]);

  // Sellers must not open the admin Brand Profile detail route.
  useEffect(() => {
    if (!role) return;
    if (!location.pathname.startsWith('/admin/brand-detail')) return;
    if (role === 'admin' || role === 'super_admin') return;
    navigate('/admin/brand-studio', { replace: true });
  }, [location.pathname, role, navigate]);

  if (!profile || !role) {
    return null;
  }

  if (!knownPageKey) {
    return (
      <Suspense fallback={null}>
        <NotFoundPage />
      </Suspense>
    );
  }

  return (
    <div className="cms-mirror-host">
      <UserProfileDropdown variant="overlay" />
      <iframe
        key={`${role}::${CMS_MIRROR_ASSET_VERSION}`}
        ref={iframeRef}
        title="Choosify Admin CMS"
        src={iframeSrc}
        onLoad={onIframeLoad}
        allow="clipboard-read; clipboard-write"
      />
    </div>
  );
};

export default CmsMirrorHost;
