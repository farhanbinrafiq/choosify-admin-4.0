import React, { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { catalogApi } from '../../services/catalogApi';
import { getMyProfilePath } from '../../lib/userDisplay';
import { ContentCard, DashShell } from './dashboards/primitives';

/**
 * Creator Studio home (/admin/creator-studio) for a creator whose Marketplace
 * Access is still pending — the App route used to hand this case to the CMS
 * mirror's old form editor. The storefront-parity Creator Studio
 * (/admin/creator-studio/:id/edit) already lets a pending creator keep editing
 * their own profile (with the pending notice), so open it directly.
 */
export default function OwnerCreatorStudioHome() {
  const { profile } = useAuth();
  const [creatorId, setCreatorId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.id) return;
    let alive = true;
    (async () => {
      try {
        const own = (await catalogApi.listCreators()).find((c) => c.userId === profile.id);
        if (own?.id) {
          if (alive) setCreatorId(own.id);
          return;
        }
        // No catalog creator yet: the same workspace bootstrap the Studio home uses.
        const { creators } = await catalogApi.ensureCreatorWorkspace({
          displayName: profile.displayName || undefined,
          email: profile.email || undefined,
        });
        const created = creators.find((c) => c.userId === profile.id) || creators[0];
        if (!alive) return;
        if (created?.id) setCreatorId(created.id);
        else setError('No Creator profile was found for this account.');
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : 'Could not open Creator Studio.');
      }
    })();
    return () => {
      alive = false;
    };
  }, [profile?.id, profile?.displayName, profile?.email]);

  if (!profile) return null;
  if (creatorId) return <Navigate to={`/admin/creator-studio/${encodeURIComponent(creatorId)}/edit`} replace />;

  return (
    <DashShell title="Creator Studio" subtitle="Edit your public Creator profile.">
      <ContentCard>
        {error ? (
          <div className="space-y-3" data-testid="creator-studio-error">
            <div className="text-sm font-bold text-red-600" role="alert">{error}</div>
            <Link to={getMyProfilePath(profile)} className="text-[13px] font-bold text-[#F96500] hover:underline">
              Open Profile &amp; Verification →
            </Link>
          </div>
        ) : (
          <div className="py-10 text-center text-sm text-app-text-secondary">Opening Creator Studio…</div>
        )}
      </ContentCard>
    </DashShell>
  );
}
