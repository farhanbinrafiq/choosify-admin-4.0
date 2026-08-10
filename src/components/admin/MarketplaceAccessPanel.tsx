import React, { useState } from 'react';
import { ShieldAlert, ShieldCheck, Clock, Bell } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { Badge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import type { MarketplaceAccessState, MarketplaceEntityType, SuspendInput } from '../../hooks/useMarketplaceAccess';

interface MarketplaceAccessPanelProps {
  entityType: MarketplaceEntityType;
  entityName: string;
  state: MarketplaceAccessState;
  onSuspend: (input: SuspendInput) => void;
  onReinstate: () => void;
  isProcessing?: boolean;
  /**
   * Viewer permission gate — Admin/authorized staff may mutate.
   * Seller/Creator (and other non-cms:edit roles) see status only.
   */
  canManageMarketplaceAccess?: boolean;
  /** Optional authoritative status label (e.g. Active / Suspended / Inactive). */
  statusLabel?: string;
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

  const resolvedLabel = statusLabel || (state.suspended ? 'Suspended' : 'Active');
  const isNegative =
    state.suspended ||
    /suspended|inactive|restricted|revoked|not.?granted/i.test(resolvedLabel);

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
          {isNegative ? <ShieldAlert className="w-4 h-4 text-rose-600" /> : <ShieldCheck className="w-4 h-4 text-emerald-600" />}
          Marketplace Access
        </h3>
        <Badge variant={isNegative ? 'danger' : 'success'}>{resolvedLabel}</Badge>
      </div>

      {!canManageMarketplaceAccess ? (
        <p className="text-[11px] text-app-text-secondary font-semibold m-0">
          Platform-administered status. Contact Choosify Admin to change Marketplace Access.
        </p>
      ) : state.suspended ? (
        <div className="space-y-3">
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 space-y-1.5 text-[11px] text-rose-800">
            <div>
              <span className="font-bold uppercase tracking-wider text-[9px] text-rose-500">Reason</span>
              <p className="mt-0.5">{state.suspensionReason || 'No reason recorded'}</p>
            </div>
            {state.suspendedAt && (
              <div className="flex items-center gap-1.5 text-rose-600">
                <Clock className="w-3 h-3" />
                Suspended on {new Date(state.suspendedAt).toLocaleDateString()}
              </div>
            )}
            {state.autoReinstateAt ? (
              <div className="flex items-center gap-1.5 text-rose-600">
                <Clock className="w-3 h-3" />
                Auto-reinstates on {new Date(state.autoReinstateAt).toLocaleDateString()}
              </div>
            ) : (
              <div className="text-rose-600">Indefinite — requires manual reinstatement</div>
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
            Reinstate Now
          </button>
        </div>
      ) : (
        <button
          onClick={() => setModalOpen(true)}
          className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg uppercase tracking-wider transition-all"
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
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold tracking-wider text-app-text-secondary">Duration</label>
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
              {durationDays > 0 && (
                <p className="text-[10px] text-app-text-secondary">
                  Auto-reinstates on {new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toLocaleDateString()}
                </p>
              )}
              {durationDays === CUSTOM_DATE_VALUE && customDate && (
                <p className="text-[10px] text-app-text-secondary">
                  Auto-reinstates on {new Date(customDate).toLocaleDateString()}
                </p>
              )}
            </div>
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
              disabled={!reason.trim() || (durationDays === CUSTOM_DATE_VALUE && !customDate)}
              className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg uppercase tracking-wider transition-all disabled:opacity-50"
            >
              Confirm Suspension
            </button>
          </div>
        </Modal>
      ) : null}
    </GlassCard>
  );
};
