import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { profileReturnState } from '../../../lib/profileReturn';
import { ExternalLink } from 'lucide-react';
import type { OpsPartnerApplication } from '../../../services/operationsApi';
import type { UserDirectoryEntry } from '../../../services/authApi';
import { DataTable, type DataTableColumn } from '../../ui/DataTable';
import { Avatar } from '../../shared/Avatar';
import { PartnerApplicationReviewActions } from '../PartnerApplicationReviewActions';

/**
 * Requests tab (new Seller / Creator applications) in the same table layout as
 * the directory: row number, avatar, CF-ID, real application fields. "Review"
 * opens the applicant's full profile with the application review on top.
 */
export function PartnerRequestsTable({
  applicantType,
  requests,
  usersById,
  onReviewed,
}: {
  applicantType: 'seller' | 'creator';
  requests: OpsPartnerApplication[];
  usersById: Map<string, UserDirectoryEntry>;
  onReviewed: (app: OpsPartnerApplication, action: 'approve' | 'reject') => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const accountId = (r: OpsPartnerApplication) => r.provisionedUserId || r.existingUserId || '';
  const profileHref = (r: OpsPartnerApplication) => {
    const app = `&applicationId=${encodeURIComponent(r.id)}`;
    if (applicantType === 'seller') return accountId(r) ? `/admin/seller-profile?sellerId=${encodeURIComponent(accountId(r))}${app}` : '';
    const target = r.catalogEntityId || accountId(r);
    return target ? `/admin/creator-review?creatorId=${encodeURIComponent(target)}${app}` : '';
  };

  const columns: DataTableColumn<OpsPartnerApplication>[] = [
    {
      key: 'applicant',
      header: 'Applicant',
      sortValue: (r) => r.displayName,
      render: (r) => {
        const href = profileHref(r);
        const body = (
          <>
            <Avatar src={usersById.get(accountId(r))?.avatarUrl || null} name={r.displayName} size={36} />
            <div className="min-w-0">
              <div className="text-xs font-bold text-app-text-primary truncate">{r.displayName}</div>
              <div className="text-[10px] text-app-text-secondary truncate">{r.email}</div>
            </div>
          </>
        );
        return href ? (
          <button
            type="button"
            onClick={() => navigate(href, profileReturnState(location))}
            className="flex items-center gap-3 text-left hover:opacity-80 transition-opacity"
            data-testid="partner-application-open"
          >
            {body}
          </button>
        ) : (
          <div className="flex items-center gap-3" title="No account linked yet — not linked to a profile">
            {body}
          </div>
        );
      },
    },
    {
      key: 'cfId',
      header: applicantType === 'seller' ? 'Seller CF ID' : 'Creator CF ID',
      sortValue: (r) => usersById.get(accountId(r))?.choosifyUserId || '',
      render: (r) => <span className="font-mono text-xs font-bold">{usersById.get(accountId(r))?.choosifyUserId || '—'}</span>,
    },
    {
      key: 'business',
      header: applicantType === 'seller' ? 'Business / Brand' : 'Channel',
      sortValue: (r) => r.businessOrChannelName,
      render: (r) => <span className="text-[11px] text-app-text-primary">{r.businessOrChannelName}</span>,
    },
    {
      key: 'category',
      header: 'Category',
      sortValue: (r) => r.category || '',
      render: (r) => <span className="text-[11px] text-app-text-secondary">{r.category || '—'}</span>,
    },
    {
      key: 'applied',
      header: 'Applied',
      sortValue: (r) => r.createdAt || '',
      render: (r) => <span className="text-xs text-app-text-secondary">{r.createdAt ? r.createdAt.slice(0, 10) : '—'}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => (
        <span className="text-[9px] font-black uppercase px-2 py-1 rounded bg-amber-500/10 text-amber-600 whitespace-nowrap">
          {r.resubmissionRequested ? 'Changes requested' : 'Under review'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (r) => {
        const href = profileHref(r);
        return (
          <div className="flex items-center justify-end gap-2" data-testid="partner-application-row">
            {href ? (
              <button
                type="button"
                onClick={() => navigate(href, profileReturnState(location))}
                className="p-1.5 bg-app-accent/10 hover:bg-app-accent/20 text-app-accent rounded-lg transition-colors inline-flex items-center gap-1 text-[10px] font-bold whitespace-nowrap"
              >
                Review profile <ExternalLink className="w-3 h-3" />
              </button>
            ) : null}
            <PartnerApplicationReviewActions application={r} onReviewed={onReviewed} />
          </div>
        );
      },
    },
  ];

  return (
    <div className="aws-page-card overflow-hidden">
      <DataTable
        columns={columns}
        rows={requests}
        getRowId={(r) => r.id}
        emptyMessage={`No pending ${applicantType} requests.`}
      />
    </div>
  );
}
