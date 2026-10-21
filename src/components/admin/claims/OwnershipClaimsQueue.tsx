import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, ExternalLink, Loader2 } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { profileReturnState } from '../../../lib/profileReturn';
import { useAuth } from '../../../contexts/AuthContext';
import { operationsApi, type OpsVerification } from '../../../services/operationsApi';
import { authApi, type UserDirectoryEntry } from '../../../services/authApi';
import { DocumentViewerHost, VerificationRequestCard } from '../profile/VerificationCenterPanel';
import { Avatar } from '../../shared/Avatar';
import { DataTable, type DataTableColumn } from '../../ui/DataTable';

/**
 * Ownership Claims queue — claims on COMMUNITY profiles only
 * (GET /operations/verifications?kind=ownership_claim). Never mixed with the
 * owners' own verification. Every status is kept as history; staff review a
 * claim with the claim document set, and approval (server-side, atomic)
 * transfers ownership only if the profile is still ownerless.
 */

type StatusFilter = 'open' | 'Approved' | 'Rejected' | 'Withdrawn' | 'Expired' | 'all';
const OPEN = new Set(['Draft', 'Submitted', 'Under Review']);
const FILTERS: Array<{ key: StatusFilter; label: string }> = [
  { key: 'open', label: 'Open' },
  { key: 'Approved', label: 'Approved' },
  { key: 'Rejected', label: 'Rejected' },
  { key: 'Withdrawn', label: 'Withdrawn' },
  { key: 'Expired', label: 'Expired' },
  { key: 'all', label: 'All' },
];
const TONE: Record<string, string> = {
  Draft: 'bg-slate-500/10 text-slate-600',
  Submitted: 'bg-indigo-500/10 text-indigo-600',
  'Under Review': 'bg-amber-500/10 text-amber-600',
  Approved: 'bg-emerald-500/10 text-emerald-600',
  Rejected: 'bg-red-500/10 text-red-600',
  Withdrawn: 'bg-slate-500/10 text-slate-500',
  Expired: 'bg-slate-500/10 text-slate-500',
};
const SOURCE_LABEL: Record<string, string> = {
  storefront: 'Storefront claim',
  onboarding: 'Claimed during sign-up',
  invitation: 'Invitation',
};

export function OwnershipClaimsQueue({
  entityType,
  onCountChange,
}: {
  entityType: 'brand' | 'creator';
  /** Reports the number of OPEN claims (for tab badges). */
  onCountChange?: (open: number) => void;
}) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  /** The claimant's full 360° profile, with this claim's review on top. */
  const openProfile = (c: OpsVerification) =>
    navigate(
      entityType === 'brand'
        ? `/admin/seller-profile?sellerId=${encodeURIComponent(c.submitted_by)}&claimId=${encodeURIComponent(c.id)}`
        : `/admin/creator-review?creatorId=${encodeURIComponent(c.submitted_by)}&claimId=${encodeURIComponent(c.id)}`,
      profileReturnState(location),
    );
  const canReview = ['super_admin', 'admin', 'moderator'].includes(String(profile?.role || ''));
  const [rows, setRows] = useState<OpsVerification[]>([]);
  const [users, setUsers] = useState<Map<string, UserDirectoryEntry>>(new Map());
  const [filter, setFilter] = useState<StatusFilter>('open');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [claims, directory] = await Promise.all([
        operationsApi.listVerifications({ entityType, kind: 'ownership_claim' }),
        authApi.getUsersDirectory().catch(() => [] as UserDirectoryEntry[]),
      ]);
      setRows(claims.sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at))));
      setUsers(new Map(directory.map((u) => [u.uid, u])));
      onCountChange?.(claims.filter((c) => OPEN.has(c.status)).length);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load ownership claims.');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType]);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { open: 0, all: rows.length };
    for (const r of rows) {
      if (OPEN.has(r.status)) c.open += 1;
      c[r.status] = (c[r.status] || 0) + 1;
    }
    return c;
  }, [rows]);
  const visible = rows.filter((r) => (filter === 'all' ? true : filter === 'open' ? OPEN.has(r.status) : r.status === filter));
  const expandedClaim = visible.find((c) => c.id === expanded) || null;
  const claimantOf = (c: OpsVerification) => users.get(c.submitted_by);
  const columns: DataTableColumn<OpsVerification>[] = [
    {
      key: 'claimant',
      header: 'Claimant',
      sortValue: (c) => claimantOf(c)?.displayName || c.submitted_by_name || '',
      render: (c) => {
        const u = claimantOf(c);
        return (
          <button
            type="button"
            onClick={() => openProfile(c)}
            className="flex items-center gap-3 text-left hover:opacity-80 transition-opacity"
            data-testid="ownership-claim-open"
            title="Open the claimant's full profile to review this claim"
          >
            <Avatar src={u?.avatarUrl || null} name={u?.displayName || c.submitted_by_name || c.entityName} size={36} />
            <div className="min-w-0">
              <div className="text-xs font-bold text-app-text-primary truncate">{u?.displayName || c.submitted_by_name || c.submitted_by}</div>
              <div className="text-[10px] text-app-text-secondary truncate">{u?.email || '—'}</div>
            </div>
          </button>
        );
      },
    },
    {
      key: 'cfId',
      header: 'Claimant CF ID',
      sortValue: (c) => claimantOf(c)?.choosifyUserId || '',
      render: (c) => <span className="font-mono text-xs font-bold">{claimantOf(c)?.choosifyUserId || '—'}</span>,
    },
    {
      key: 'profile',
      header: entityType === 'brand' ? 'Claimed brand' : 'Claimed creator profile',
      sortValue: (c) => c.entityName,
      render: (c) => <span className="text-[11px] font-bold text-app-text-primary" data-testid="ownership-claim-row">{c.entityName || c.entityId}</span>,
    },
    {
      key: 'source',
      header: 'Source',
      render: (c) => <span className="text-[11px] text-app-text-secondary">{SOURCE_LABEL[c.claimSource || ''] || 'Claim'}</span>,
    },
    {
      key: 'opened',
      header: 'Opened',
      sortValue: (c) => c.created_at || '',
      render: (c) => (
        <span className="text-xs text-app-text-secondary" title={c.closedReason || undefined}>
          {c.created_at?.slice(0, 10) || '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortValue: (c) => c.status,
      render: (c) => <span className={`text-[9px] font-black uppercase px-2 py-1 rounded whitespace-nowrap ${TONE[c.status] || TONE.Draft}`}>{c.status}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (c) => (
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => openProfile(c)}
            className="p-1.5 bg-app-accent/10 hover:bg-app-accent/20 text-app-accent rounded-lg transition-colors inline-flex items-center gap-1 text-[10px] font-bold whitespace-nowrap"
          >
            Review profile <ExternalLink className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={() => setExpanded(expanded === c.id ? null : c.id)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-app-border text-[10px] font-bold bg-white whitespace-nowrap"
            data-testid="ownership-claim-quick"
          >
            {expanded === c.id ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />} Quick review
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="aws-page-card overflow-hidden" data-testid="ownership-claims-queue">
      <div className="p-3 border-b border-app-border flex gap-1.5 overflow-x-auto scrollbar-hide">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider shrink-0 ${
              filter === f.key ? 'bg-app-accent text-white' : 'text-app-text-secondary hover:bg-[#F1F3F5]'
            }`}
          >
            {f.label} ({counts[f.key] || 0})
          </button>
        ))}
      </div>
      {loading ? (
        <div className="p-10 flex justify-center">
          <Loader2 className="w-4 h-4 animate-spin text-app-text-secondary" />
        </div>
      ) : error ? (
        <p className="p-6 text-xs font-bold text-red-500">{error}</p>
      ) : visible.length === 0 ? (
        <p className="p-10 text-center text-xs text-app-text-secondary">
          {filter === 'open' ? 'No open ownership claims.' : 'No ownership claims with this status.'}
        </p>
      ) : (
        <>
          <DataTable columns={columns} rows={visible} getRowId={(c) => c.id} emptyMessage="No ownership claims." />
          {expandedClaim ? (
            <div className="p-4 border-t border-app-border" data-testid="ownership-claim-quick-panel">
              <VerificationRequestCard
                v={expandedClaim}
                kind="ownership_claim"
                entityType={entityType}
                entityId={expandedClaim.entityId}
                entityName={expandedClaim.entityName}
                canReview={canReview && expandedClaim.submitted_by !== profile?.id}
                asks={[]}
                onChanged={() => void load()}
              />
            </div>
          ) : null}
        </>
      )}
      <DocumentViewerHost />
    </div>
  );
}
