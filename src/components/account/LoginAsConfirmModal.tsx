import React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { getAvatarUrl } from '../../lib/userDisplay';
import type { LoginAsConfirmTarget } from '../../lib/impersonationRouting';

type Props = {
  target: LoginAsConfirmTarget;
  reason: string;
  error: string | null;
  busy: boolean;
  onReasonChange: (value: string) => void;
  onCancel: () => void;
  onContinue: () => void;
};

export function LoginAsConfirmModal({
  target,
  reason,
  error,
  busy,
  onReasonChange,
  onCancel,
  onContinue,
}: Props) {
  const canContinue = !busy && reason.trim().length >= 2;

  return createPortal(
    <div
      className="fixed inset-0 z-[900] flex items-center justify-center p-5"
      style={{ background: 'rgba(15, 23, 42, 0.55)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-as-title"
    >
      <div className="w-full max-w-[440px] rounded-2xl border border-[#e8edf2] bg-white p-[22px] text-[#111827] shadow-[0_24px_60px_rgba(15,23,42,0.28)]">
        <div className="flex items-start justify-between gap-3">
          <div className="inline-flex rounded-full border border-[#fde68a] bg-[#fffbeb] px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#b45309]">
            Privileged support action
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg border border-gray-200 p-2 hover:bg-gray-50 cursor-pointer disabled:opacity-50"
            aria-label="Close confirmation"
          >
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>
        <h2 id="login-as-title" className="mt-3 mb-2 text-[18px] font-extrabold">
          Login As User?
        </h2>
        <p className="mb-3 text-[12.5px] font-semibold leading-[1.45] text-[#6b7280]">
          You are about to enter this account as:
        </p>
        <div className="mb-3 flex items-center gap-3 rounded-xl border border-[#e8edf2] bg-[#f9fafb] p-3">
          <img
            src={
              target.avatarUrl ||
              getAvatarUrl({
                displayName: target.displayName,
                email: target.email || '',
                avatar: undefined,
              })
            }
            alt=""
            className="h-12 w-12 rounded-full object-cover bg-[#ef3c23]"
          />
          <div className="min-w-0">
            <div className="truncate text-[14px] font-extrabold">{target.displayName}</div>
            <div className="text-[12px] font-semibold text-[#6b7280]">
              {target.roleLabel}
              {target.choosifyUserId ? ` · ${target.choosifyUserId}` : ''}
            </div>
            {target.email ? (
              <div className="truncate text-[12px] font-semibold text-[#6b7280]">{target.email}</div>
            ) : null}
          </div>
        </div>
        <p className="mb-3 text-[12.5px] font-semibold leading-[1.45] text-[#6b7280]">
          You will temporarily experience Choosify using this user&apos;s permissions and account
          scope. Your admin session is retained and can be restored via Exit Impersonation.
        </p>
        <label className="mb-1.5 block text-[11px] font-extrabold tracking-wide text-[#6b7280]" htmlFor="login-as-reason">
          Support reason (required)
        </label>
        <textarea
          id="login-as-reason"
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
          placeholder="Customer support investigation, order issue, profile troubleshooting…"
          className="min-h-[80px] w-full resize-none rounded-lg border border-[#e8edf2] bg-[#f8f9fc] px-3.5 py-2 text-[13px] font-semibold text-[#111827] outline-none"
          rows={3}
        />
        {error ? <div className="mt-2 text-[12px] font-bold text-[#b91c1c]">{error}</div> : null}
        <div className="mt-5 flex items-center justify-end gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="cursor-pointer rounded-lg border border-gray-200 px-4 py-2 text-[12px] font-extrabold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canContinue}
            onClick={onContinue}
            className="cursor-pointer rounded-lg bg-[#EF3C23] px-4 py-2 text-[12px] font-extrabold text-white hover:bg-[#EF3C23]/90 disabled:opacity-60"
          >
            {busy ? 'Starting…' : 'Continue'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
