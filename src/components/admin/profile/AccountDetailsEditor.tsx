import React, { useCallback, useEffect, useState } from 'react';
import { Pencil } from 'lucide-react';
import { profileApi, type AccountDetails, type AccountDetailsPatch } from '../../../services/profileApi';

/**
 * Account details — display name, username (self only) and phone — edited one
 * field at a time, in place, through PATCH /auth/profile. `userId` set = staff
 * editing another account (shown only inside an active Edit Mode session);
 * unset = the signed-in user editing themselves. The server enforces every
 * rule (admin-only staff edits, 90-day name lock, phone format) and records
 * account activity + audit; these rows only show its messages.
 */
export type AccountField = 'displayName' | 'username' | 'phone';

const HINT: Record<AccountField, string> = {
  displayName: 'Can be changed once every 90 days.',
  username: '3–30 letters, numbers, dots or underscores.',
  phone: 'Bangladeshi mobile (01XXXXXXXXX). Leave empty to remove.',
};

/** Current account values for the row editors; `reload` after a save picks up server-normalized values. */
export function useAccountDetails(userId?: string) {
  const [details, setDetails] = useState<AccountDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    try {
      setDetails(await profileApi.getAccountDetails(userId));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load account details.');
    }
  }, [userId]);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { details, error, reload };
}

export function EditableAccountField({
  field,
  label,
  value,
  display,
  emptyText = 'Not added',
  userId,
  canOverrideNameLock = false,
  divider = false,
  onSaved,
}: {
  field: AccountField;
  label: string;
  /** Raw current value (what the input starts with). */
  value: string | null | undefined;
  /** Optional formatted value shown when not editing. */
  display?: React.ReactNode;
  emptyText?: string;
  userId?: string;
  canOverrideNameLock?: boolean;
  divider?: boolean;
  onSaved?: (saved: AccountDetailsPatch) => void;
}) {
  const current = value || '';
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(current);
  const [override, setOverride] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const start = () => {
    setDraft(current);
    setOverride(false);
    setMsg(null);
    setEditing(true);
  };

  const dirty = draft.trim() !== current.trim();

  const save = async () => {
    if (!dirty) return;
    const next = draft.trim();
    if (field === 'displayName' && next.length < 2) {
      setMsg({ ok: false, text: 'Display name must be at least 2 characters.' });
      return;
    }
    // Same rule as the server (server/auth/accountUsername.ts), checked here for an instant message.
    if (field === 'username' && next && !/^[a-z0-9._]{3,30}$/i.test(next.replace(/^@/, ''))) {
      setMsg({ ok: false, text: 'Username: 3–30 letters, numbers, dots or underscores — no spaces.' });
      return;
    }
    const patch: AccountDetailsPatch = field === 'phone' ? { phone: next || null } : { [field]: next };
    setBusy(true);
    setMsg(null);
    try {
      await profileApi.updateAccountDetails(patch, { userId, adminOverride: canOverrideNameLock && override });
      setEditing(false);
      setMsg({ ok: true, text: 'Saved.' });
      onSaved?.(patch);
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Could not save.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={divider ? 'border-t border-[#F1F3F5] pt-2' : ''} data-testid={`account-field-${field}`}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={`acc-${field}`} className="text-[9.5px] font-extrabold tracking-wide text-[#9CA3AF]">
          {label}
        </label>
        {!editing ? (
          <button
            type="button"
            onClick={start}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-[#F96500] hover:underline"
            aria-label={`Edit ${label.toLowerCase()}`}
            data-testid={`account-field-edit-${field}`}
          >
            <Pencil className="w-3 h-3" /> Edit
          </button>
        ) : null}
      </div>

      {!editing ? (
        <div className="text-[12.5px] font-bold text-[#000435] mt-0.5 break-words">
          {current ? display ?? current : <span className="text-[#9CA3AF] font-semibold">{emptyText}</span>}
        </div>
      ) : (
        <div className="mt-1 space-y-1.5">
          <input
            id={`acc-${field}`}
            autoFocus
            className="w-full h-[38px] px-3 rounded-xl border border-[#CBD5E1] text-[13px] text-[#000435] outline-none focus:border-[#F96500]"
            value={draft}
            maxLength={field === 'username' ? 30 : 80}
            inputMode={field === 'phone' ? 'tel' : undefined}
            placeholder={field === 'phone' ? '01XXXXXXXXX' : undefined}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void save();
              if (e.key === 'Escape') setEditing(false);
            }}
          />
          <div className="text-[10.5px] text-[#64748B]">{HINT[field]}</div>
          {field === 'displayName' && canOverrideNameLock && dirty ? (
            <label className="flex items-center gap-2 text-[11.5px] text-[#475569]">
              <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} />
              Override the 90-day name lock (recorded in the audit log)
            </label>
          ) : null}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void save()}
              disabled={!dirty || busy}
              className="h-[32px] px-3.5 rounded-lg bg-[#F96500] text-white text-[12px] font-bold disabled:opacity-50"
              data-testid={`account-field-save-${field}`}
            >
              {busy ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setMsg(null);
              }}
              className="h-[32px] px-3.5 rounded-lg border border-[#E2E8F0] bg-white text-[#000435] text-[12px] font-bold"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {msg ? (
        <div
          role={msg.ok ? 'status' : 'alert'}
          className={`text-[11.5px] font-bold mt-1 ${msg.ok ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}
          data-testid={`account-field-msg-${field}`}
        >
          {msg.text}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Staff, inside Edit Mode: the account's editable details as individual rows.
 * Username stays with the owner (the server only lets staff change name/phone).
 */
export function AccountDetailsSection({
  userId,
  canOverrideNameLock,
  onSaved,
  panelStyle,
  titleStyle,
}: {
  userId: string;
  canOverrideNameLock: boolean;
  onSaved?: () => void;
  panelStyle?: React.CSSProperties;
  titleStyle?: React.CSSProperties;
}) {
  const { details, error, reload } = useAccountDetails(userId);
  const saved = () => {
    void reload();
    onSaved?.();
  };
  return (
    <div style={panelStyle} data-testid="account-details-panel">
      <div style={titleStyle}>ACCOUNT DETAILS</div>
      <div className="text-[11px] text-[#6B7280] font-semibold mb-3">
        Editing on behalf of this user — every change is recorded in their activity log.
      </div>
      {error ? (
        <div className="text-[12px] font-bold text-[#DC2626]">{error}</div>
      ) : !details ? (
        <div className="text-[12px] text-[#64748B]">Loading…</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <EditableAccountField field="displayName" label="DISPLAY NAME" value={details.displayName} userId={userId} canOverrideNameLock={canOverrideNameLock} onSaved={saved} />
          <EditableAccountField field="phone" label="PHONE" value={details.phone} userId={userId} onSaved={saved} />
        </div>
      )}
    </div>
  );
}
