import React, { useState } from 'react';
import { ShieldAlert, ShieldCheck, ShieldQuestion, Clock, Bell } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { Badge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import type { MarketplaceAccessState, MarketplaceEntityType, SuspendInput } from '../../hooks/useMarketplaceAccess';

interface MarketplaceAccessPanelProps {
  entityType: MarketplaceEntityType;
  entityName: string;
  state: MarketplaceAccessState;
  onGrant: () => void;
  onSuspend: (input: SuspendInput) => void;
  onReinstate: () => void;
  isProcessing?: boolean;
  /**
   * Viewer permission gate — Admin/authorized staff may mutate.
   * Seller/Creator (and other non-cms:edit roles) see status only.
   */
  canManageMarketplaceAccess?: boolean;
  /** Optional authoritative status label (e.g. Active / Suspended / Inactive / Revoked). */
  statusLabel?: string;
}

type AccessBucket = 'not_granted' | 'active' | 'suspended_like' | 'revoked' | 'unmanaged';

/** Maps the canonical brand (not_granted/granted/restricted/suspended/restored/revoked) and
 * creator (draft/live/archived) status enums onto the four UI buckets Phase 1 requires. */
function classify(status: MarketplaceAccessState['status'], entityType: MarketplaceEntityType): AccessBucket {
  if (entityType === 'consumer') return 'unmanaged';
  if (!status) return 'unmanaged';
  switch (status) {
    case 'granted':
    case 'restored':
    case 'live':
      return 'active';
    case 'not_granted':
    case 'draft':
      return 'not_granted';
    case 'suspended':
    case 'restricted':
    case 'archived':
      return 'suspended_like';
    case 'revoked':
      return 'revoked';
    default:
      return 'unmanaged';
  }
}

const CUSTOM_DATE_VALUE = -1;

const DURATION_OPTIONS = [
  { label: '7 days', value: 7 },
  { label: '14 days', value: 14 },
  { label: '30 days', value: 30 },
  { label: 'Custom date', value: CUSTOM_DATE_VALUE },
  { label: 'Indefinite (manual reinstate)', value: 0 },
];

export const MarketplaceAccessPanel: React.FC<MarketplaceAccessPanelProps> = ({
  entityType,
  entityName,
  state,
  onGrant,
  onSuspend,
  onReinstate,
  isProcessing,
  canManageMarketplaceAccess = false,
  statusLabel,
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [durationDays, setDurationDays] = useState<number>(7);
  const [customDate, setCustomDate] = useState('');
  const [notify, setNotify] = useState(true);

  const bucket = classify(state.status, entityType);
  const resolvedLabel = statusLabel || (bucket === 'active' ? 'Active' : bucket === 'not_granted' ? 'Inactive' : bucket === 'revoked' ? 'Revoked' : bucket === 'suspended_like' ? 'Suspended' : 'Unmanaged');

  const handleConfirmSuspend = () => {
    if (!reason.trim()) return;
    if (durationDays === CUSTOM_DATE_VALUE && !customDate) return;

    let resolvedDays: number | null = durationDays === 0 ? null : durationDays;
    if (durationDays === CUSTOM_DATE_VALUE) {
      const msDiff = new Date(customDate).setHours(23, 59, 59, 999) - Date.now();
      resolvedDays = Math.max(1, Math.ceil(msDiff / (24 * 60 * 60 * 1000)));
    }

    onSuspend({ reason: reason.trim(), durationDays: resolvedDays, notify });
    setModalOpen(false);
    setReason('');
    setDurationDays(7);
    setCustomDate('');
    setNotify(true);
  };

  return (
    <GlassCard hoverLift={false} className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-bold text-app-text-primary flex items-center gap-2">
          {bucket === 'active' ? (
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          ) : bucket === 'unmanaged' ? (
            <ShieldQuestion className="w-4 h-4 text-app-text-secondary" />
          ) : (
            <ShieldAlert className="w-4 h-4 text-rose-600" />
          )}
          Marketplace Access
        </h3>
        <Badge variant={bucket === 'active' ? 'success' : bucket === 'unmanaged' ? 'neutral' : 'danger'}>{resolvedLabel}</Badge>
      </div>

      {bucket === 'unmanaged' ? (
        <p className="text-[11px] text-app-text-secondary font-semibold m-0">
          Marketplace Access does not apply to this account type.
        </p>
      ) : !canManageMarketplaceAccess ? (
        <p className="text-[11px] text-app-text-secondary font-semibold m-0">
          Platform-administered status. Contact Choosify Admin to change Marketplace Access.
        </p>
      ) : bucket === 'not_granted' ? (
        <div className="space-y-2">
          <p className="text-[11px] text-app-text-secondary font-semibold m-0">
            This {entityType} has been identity-approved but has not yet been granted Marketplace Access.
          </p>
          <button
            onClick={onGrant}
            disabled={isProcessing}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg uppercase tracking-wider transition-all disabled:opacity-50"
          >
            {isProcessing ? 'Granting…' : 'Grant Marketplace Access'}
          </button>
        </div>
      ) : bucket === 'revoked' ? (
        <div className="space-y-3">
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-[11px] text-rose-800">
            Marketplace Access was previously <span className="font-bold">revoked</span> for this {entityType}. Re-granting will
            restore full marketplace visibility.
          </div>
          <button
            onClick={onGrant}
            disabled={isProcessing}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg uppercase tracking-wider transition-all disabled:opacity-50"
          >
            {isProcessing ? 'Granting…' : 'Grant Marketplace Access'}
          </button>
        </div>
      ) : bucket === 'suspended_like' ? (
        <div className="space-y-3">
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 space-y-1.5 text-[11px] text-rose-800">
            <div>
              <span className="font-bold uppercase tracking-wider text-[9px] text-rose-500">Reason</span>
              <p className="mt-0.5">{state.suspensionReason || 'No reason recorded for this session — not persisted server-side.'}</p>
            </div>
            {state.suspendedAt && (
              <div className="flex items-center gap-1.5 text-rose-600">
                <Clock className="w-3 h-3" />
                Suspended on {new Date(state.suspendedAt).toLocaleDateString()}
              </div>
            )}
            {state.notifyOnSuspend && (
              <div className="flex items-center gap-1.5 text-rose-600">
                <Bell className="w-3 h-3" /> Account holder was notified
              </div>
            )}
          </div>
          <button
            onClick={onReinstate}
            disabled={isProcessing}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg uppercase tracking-wider transition-all disabled:opacity-50"
          >
            {isProcessing ? 'Reinstating…' : 'Reinstate Access'}
          </button>
        </div>
      ) : (
        <button
          onClick={() => setModalOpen(true)}
          disabled={isProcessing}
          className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg uppercase tracking-wider transition-all disabled:opacity-50"
        >
          Suspend Access
        </button>
      )}

      {canManageMarketplaceAccess ? (
        <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={`Suspend ${entityType} — ${entityName}`} maxWidth="max-w-md">
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold tracking-wider text-app-text-secondary">Reason (required)</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Repeated policy violations, fraud investigation..."
                className="w-full bg-white border border-app-border rounded-lg p-2.5 text-xs text-app-text-primary h-20 focus:border-app-accent focus:outline-none transition"
              />
              <p className="text-[10px] text-app-text-secondary">
                {entityType === 'creator'
                  ? 'Creators have no separate suspend state — this archives the profile. Reason is kept in the on-page activity log only.'
                  : 'Reason is kept in the on-page activity log only; the backend does not currently store a suspend reason.'}
              </p>
            </div>
            {entityType !== 'creator' && (
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold tracking-wider text-app-text-secondary">Duration (for operator reference only)</label>
                <select
                  value={durationDays}
                  onChange={(e) => setDurationDays(Number(e.target.value))}
                  className="w-full bg-white border border-app-border rounded-lg p-2.5 text-xs text-app-text-primary focus:border-app-accent focus:outline-none transition"
                >
                  {DURATION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {durationDays === CUSTOM_DATE_VALUE && (
                  <input
                    type="date"
                    value={customDate}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setCustomDate(e.target.value)}
                    className="w-full bg-white border border-app-border rounded-lg p-2.5 text-xs text-app-text-primary focus:border-app-accent focus:outline-none transition mt-1.5"
                  />
                )}
                <p className="text-[10px] text-app-text-secondary">
                  Not enforced automatically — the backend has no scheduled auto-reinstate. Reinstate manually when the window ends.
                </p>
              </div>
            )}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={notify}
                onChange={(e) => setNotify(e.target.checked)}
                className="rounded border-app-border text-app-accent focus:ring-app-accent"
              />
              <span className="text-[11px] font-bold text-app-text-secondary">Notify account holder of this suspension</span>
            </label>
            <button
              onClick={handleConfirmSuspend}
              disabled={!reason.trim() || (durationDays === CUSTOM_DATE_VALUE && !customDate) || isProcessing}
              className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg uppercase tracking-wider transition-all disabled:opacity-50"
            >
              {isProcessing ? 'Submitting…' : 'Confirm Suspension'}
            </button>
          </div>
        </Modal>
      ) : null}
    </GlassCard>
  );
};
