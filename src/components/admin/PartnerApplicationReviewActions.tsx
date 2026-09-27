import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, X, Loader2, ArrowRight } from 'lucide-react';
import { operationsApi, type OpsPartnerApplication } from '../../services/operationsApi';

/**
 * Approve / Reject for a pending partner application. Shared by Seller Management
 * (seller applications) and Creator Management (creator applications) — the one
 * review surface, moved out of Feature Access. Calls the existing
 * /operations/partner-applications/:id/(approve|reject) APIs; approval logic lives
 * server-side only.
 */
export function PartnerApplicationReviewActions({
  application,
  onReviewed,
}: {
  application: OpsPartnerApplication;
  onReviewed: (application: OpsPartnerApplication, action: 'approve' | 'reject') => void;
}) {
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const review = async (action: 'approve' | 'reject') => {
    if (action === 'reject' && !window.confirm(`Reject the application from ${application.businessOrChannelName}?`)) return;
    setBusy(action);
    setError(null);
    try {
      const updated =
        action === 'approve'
          ? await operationsApi.approvePartnerApplication(application.id, 'Approved via Management Studio')
          : await operationsApi.rejectPartnerApplication(application.id, 'Rejected via Management Studio');
      onReviewed({ ...application, ...updated }, action);
    } catch (e) {
      setError(e instanceof Error ? e.message : `${action} failed`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1 shrink-0">
      <div className="flex gap-1.5">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void review('approve')}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[10.5px] font-black uppercase tracking-wider disabled:opacity-50"
        >
          {busy === 'approve' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Approve
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void review('reject')}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-600 text-[10.5px] font-black uppercase tracking-wider disabled:opacity-50"
        >
          {busy === 'reject' ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />} Reject
        </button>
      </div>
      {error && <div className="text-[10.5px] font-bold text-red-500 max-w-xs text-right">{error}</div>}
    </div>
  );
}

/** Post-approval notice: identity is approved, Marketplace Access is still a separate grant. */
export function PartnerApprovedNotice({
  application,
  onDismiss,
}: {
  application: OpsPartnerApplication;
  onDismiss: () => void;
}) {
  const userId = application.provisionedUserId || application.existingUserId || '';
  const grantHref =
    application.applicantType === 'creator'
      ? `/admin/creators/${encodeURIComponent(userId)}/marketplace-access`
      : `/admin/seller-profile?sellerId=${encodeURIComponent(userId)}`;
  return (
    <div className="aws-page-card p-4 flex flex-wrap items-center justify-between gap-3 border border-emerald-200 bg-emerald-50">
      <div className="text-xs font-bold text-emerald-800">
        ✓ {application.businessOrChannelName} approved. Identity is verified — Marketplace Access is still off until it's
        granted separately.
      </div>
      <div className="flex items-center gap-2">
        {userId && (
          <Link
            to={grantHref}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[11px] font-black"
          >
            Grant Marketplace Access <ArrowRight className="w-3 h-3" />
          </Link>
        )}
        <button type="button" onClick={onDismiss} className="text-[11px] font-bold text-emerald-800">
          Dismiss
        </button>
      </div>
    </div>
  );
}
