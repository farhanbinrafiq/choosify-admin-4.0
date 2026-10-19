import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { MarketplaceAccessPanel } from '../MarketplaceAccessPanel';
import { useMarketplaceAccess } from '../../../hooks/useMarketplaceAccess';
import { operationsApi, type MarketplaceAccessEvent } from '../../../services/operationsApi';
import type { CatalogBrand, CatalogCreator } from '../../../types/catalog';

/**
 * Marketplace Access for one brand (marketplaceStatus) or creator (publish
 * status) on the Super Admin profile: current status, Grant / Suspend (with a
 * required reason + duration) / Reinstate through the canonical endpoints, and
 * the server-recorded decision history. Governance actions are the admin's own
 * workflow, so they are available in View mode to staff allowed to manage access.
 */
const REMOVAL = ['suspended', 'restricted', 'revoked', 'archived'];
const ACTIVATION = ['granted', 'restored', 'live'];
const LABEL: Record<string, string> = {
  not_granted: 'Not granted',
  granted: 'Activated',
  restricted: 'Restricted',
  suspended: 'Suspended',
  restored: 'Reactivated',
  revoked: 'Revoked',
  live: 'Activated',
  draft: 'Draft',
  archived: 'Archived',
};

export function MarketplaceAccessSection({
  entityType,
  brand,
  creator,
  onChanged,
}: {
  entityType: 'brand' | 'creator';
  brand?: CatalogBrand;
  creator?: CatalogCreator;
  onChanged: (updated: CatalogBrand | CatalogCreator) => void;
}) {
  const { profile } = useAuth();
  const canManage = profile?.role === 'admin' || profile?.role === 'super_admin';
  const entityId = entityType === 'brand' ? brand?.id || '' : creator?.id || '';
  const entityName = entityType === 'brand' ? brand?.name || '' : creator?.name || '';
  const status = entityType === 'brand' ? brand?.marketplaceStatus : creator?.status;
  const [events, setEvents] = useState<MarketplaceAccessEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    if (!entityId) return;
    try {
      setEvents(await operationsApi.listMarketplaceAccessEvents({ entityType, entityId }));
    } catch {
      setEvents([]);
    }
  }, [entityType, entityId]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const access = useMarketplaceAccess({
    entityType,
    entityId,
    entityName,
    onSaved: (u) => {
      setError(null);
      onChanged(u);
      void loadEvents();
    },
    onError: (m) => setError(m),
    onAudit: (_a, d) => setNotice(d),
  });

  const latestRemoval = events.find((e) => REMOVAL.includes(e.toStatus));
  const active = entityType === 'brand' ? Boolean(brand?.marketplaceAccess) && !REMOVAL.includes(String(status || '')) : creator?.status === 'live';
  // Events arrive newest first: the activation that is in force now.
  const activation = active ? events.find((e) => ACTIVATION.includes(e.toStatus)) : undefined;
  const statusLabel = active ? 'Active' : status ? LABEL[String(status)] || String(status) : undefined;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} data-testid={`marketplace-access-${entityType}`}>
      <MarketplaceAccessPanel
        entityType={entityType}
        entityName={entityName}
        state={{
          status: status as never,
          access: active,
          suspensionReason: latestRemoval?.reason,
          suspendedAt: latestRemoval?.at,
        }}
        onGrant={access.grant}
        onSuspend={access.suspend}
        onReinstate={access.reinstate}
        isProcessing={access.isProcessing}
        canManageMarketplaceAccess={canManage}
        statusLabel={statusLabel}
      />
      <div style={{ background: '#fff', border: '1px solid #E8EDF2', borderRadius: 8, padding: '10px 14px', fontSize: 11.5, fontWeight: 700 }} data-testid="marketplace-access-current">
        {active ? (
          activation ? (
            <span style={{ color: '#166534' }}>
              Active since {new Date(activation.at).toLocaleString()} · activated by {activation.actorName || activation.actorId}
              {activation.reason ? <span style={{ color: '#4B5563', fontWeight: 600 }}> — {activation.reason}</span> : null}
            </span>
          ) : (
            <span style={{ color: '#166534' }}>Active · activation date not recorded (access was granted before decisions were logged)</span>
          )
        ) : latestRemoval ? (
          <span style={{ color: '#B91C1C' }}>
            {LABEL[latestRemoval.toStatus] || latestRemoval.toStatus} since {new Date(latestRemoval.at).toLocaleString()}
            {latestRemoval.reviewAt ? ` · review on ${new Date(latestRemoval.reviewAt).toLocaleDateString()}` : ''}
            <span style={{ color: '#4B5563', fontWeight: 600 }}> — {latestRemoval.reason || 'No reason recorded'}</span>
          </span>
        ) : (
          <span style={{ color: '#6B7280' }}>{statusLabel || 'Not granted'} · no access decisions recorded yet</span>
        )}
      </div>
      {error ? <div role="alert" style={{ fontSize: 11.5, fontWeight: 700, color: '#DC2626' }}>{error}</div> : null}
      {notice && !error ? <div role="status" style={{ fontSize: 11, fontWeight: 600, color: '#166534' }}>{notice}</div> : null}
      <div style={{ background: '#fff', border: '1px solid #E8EDF2', borderRadius: 8, padding: 14 }} data-testid="marketplace-access-history">
        <div style={{ fontSize: 11, fontWeight: 800, color: '#111827', marginBottom: 6 }}>ACCESS HISTORY — {entityName}</div>
        {events.length === 0 ? (
          <div style={{ fontSize: 11.5, color: '#9CA3AF', fontStyle: 'italic', fontWeight: 600 }}>No recorded access decisions yet.</div>
        ) : (
          events.slice(0, 12).map((e) => (
            <div key={e.id} style={{ fontSize: 11.5, fontWeight: 600, padding: '7px 0', borderTop: '1px solid #F5F6F8', display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0 }}>
                <b>{e.fromStatus ? `${LABEL[e.fromStatus] || e.fromStatus} → ` : ''}{LABEL[e.toStatus] || e.toStatus}</b>
                {e.durationDays ? <span style={{ color: '#6B7280' }}> · {e.durationDays} day(s){e.reviewAt ? `, review ${new Date(e.reviewAt).toLocaleDateString()}` : ''}</span> : null}
                <div style={{ color: '#4B5563', overflowWrap: 'anywhere' }}>{e.reason || 'No reason recorded'}</div>
              </div>
              <div style={{ color: '#9CA3AF', textAlign: 'right' }}>
                {e.actorName || e.actorId}
                <br />
                {new Date(e.at).toLocaleString()}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
