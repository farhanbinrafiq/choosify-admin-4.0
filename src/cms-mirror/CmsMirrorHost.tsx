import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { PAGE_KEY_TO_PATH, allowedPageKeysForRole, pathToPageKey, resolveAdminPageKey } from './nav';
import { UserProfileDropdown } from '../components/account/UserProfileDropdown';
import './tokens.css';

const NotFoundPage = lazy(() => import('../pages/NotFoundPage'));

/** Bump when public/cms-mirror/app.html behavior changes so the iframe never serves a stale 304. */
const CMS_MIRROR_ASSET_VERSION = '20260731-brand-logo-1';

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
  const role = profile?.role || 'super_admin';

  const postMirrorState = useCallback(
    (page: string, nextRole: string) => {
      const win = iframeRef.current?.contentWindow;
      if (!win) return;
      try {
        win.postMessage(
          {
            type: 'cms-mirror-set-state',
            page,
            role: nextRole,
            allowedKeys: allowedPageKeysForRole(nextRole),
          },
          '*',
        );
        const token = localStorage.getItem('choosify_auth_token');
        if (token) {
          win.postMessage({ type: 'cms-mirror-auth-token', token }, '*');
        }
      } catch {
        /* ignore */
      }
    },
    [],
  );

  useEffect(() => {
    if (!knownPageKey) return;
    postMirrorState(pageKey, role);
  }, [knownPageKey, pageKey, role, postMirrorState]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.type !== 'cms-mirror-page' || typeof data.page !== 'string') return;
      const target = PAGE_KEY_TO_PATH[data.page] || '/admin/dashboard';
      if (target !== location.pathname) {
        navigate(target, { replace: true });
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [location.pathname, navigate]);

  const onIframeLoad = () => {
    postMirrorState(pageKey, role);
  };

  const iframeSrc = useMemo(
    () =>
      `/cms-mirror/app.html?v=${CMS_MIRROR_ASSET_VERSION}#page=${encodeURIComponent(pageKey)}&role=${encodeURIComponent(role)}`,
    // role in src + key forces a clean boot when switching Admin/Seller/Creator
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pageKey applied via postMessage after load
    [role],
  );

  useEffect(() => {
    if (!knownPageKey) return;
    const allowed = allowedPageKeysForRole(role);
    if (allowed && !allowed.includes(pageKey)) {
      navigate('/admin/dashboard', { replace: true });
    }
  }, [knownPageKey, role, pageKey, navigate]);

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
