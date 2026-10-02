// PUBLIC IDENTITY — the owner's username section in Brand Studio and Creator
// Studio. A username (public handle) belongs to the Brand / Creator entity, never
// to the seller or login account; each entity's section is independent.
//
// Facebook-style: type a username → live availability → Save → done. Saving sets
// or changes it at once (PUT …/handle); a change permanently retires the old
// username, and changes are limited to one per 30 days (enforced by the server;
// the next allowed time comes from it). Availability here is only a hint — the server re-checks everything
// inside the save transaction. The server decides ownership and refuses
// impersonated sessions; the controls only mirror that (staff see a read-only
// view). Feature Access grants nothing here.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useImpersonation } from '../../contexts/ImpersonationContext';
import { publicProfileUrl } from '../admin/PublicHandlePanels';
import { publicHandlesOwnerApi, PublicIdentityOwnerError } from '../../services/publicHandlesOwnerApi';
import {
  USERNAME_RULES_TEXT,
  VERDICT_LABEL,
  availabilityVerdict,
  changeLockedUntil,
  checkUsernameLocally,
  describeOwnerFailure,
  describeUsernameReason,
  formatNextChange,
  type AvailabilityVerdict,
  type OwnerEntityType,
} from '../../lib/publicIdentityOwner';

const label = 'block text-[10px] font-extrabold uppercase tracking-wider text-[#6B7280] mb-1';
const input =
  'w-full rounded-lg border border-[#E8EDF2] px-3 py-2 text-[12.5px] text-[#1A1A2E] outline-none focus:border-[#EF3C23]/50 bg-white';
const ghostBtn =
  'inline-flex items-center gap-1 rounded-md border border-[#E8EDF2] bg-white px-2.5 py-1.5 text-[11px] font-bold text-[#374151] disabled:opacity-50 disabled:cursor-not-allowed';
const accentBtn =
  'inline-flex items-center gap-1 rounded-md bg-[#EF3C23] px-3.5 py-2 text-[11.5px] font-extrabold text-white disabled:opacity-50 disabled:cursor-not-allowed';
const hint = 'text-[10.5px] leading-snug text-[#9CA3AF]';

/** How long typing must pause before availability is checked. */
const CHECK_DEBOUNCE_MS = 400;

type Status = AvailabilityVerdict | 'checking' | 'idle' | 'error';

const STATUS_TONE: Record<Exclude<Status, 'idle'>, string> = {
  checking: 'text-[#6B7280]',
  available: 'text-[#047857]',
  current: 'text-[#1D4ED8]',
  reserved: 'text-[#92400E]',
  invalid: 'text-[#B91C1C]',
  unavailable: 'text-[#B91C1C]',
  error: 'text-[#B91C1C]',
};

const failureOf = (error: unknown) =>
  error instanceof PublicIdentityOwnerError ? error : new PublicIdentityOwnerError('Unexpected error', 0, 'NETWORK_ERROR');

export type PublicIdentitySectionProps = {
  entityType: OwnerEntityType;
  entityId: string;
  /** Current catalog slug — the public address while no username is set. */
  slug?: string | null;
};

export function PublicIdentitySection({ entityType, entityId, slug }: PublicIdentitySectionProps) {
  const { profile } = useAuth();
  const { state: impersonation } = useImpersonation();
  const isStaffReader = profile?.role === 'admin' || profile?.role === 'super_admin';
  const impersonating = Boolean(impersonation?.active);

  const [active, setActive] = useState<string | null>(null);
  /** Server time (ISO) until which a CHANGE is refused; null = no cooldown running. */
  const [lockedUntil, setLockedUntil] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<PublicIdentityOwnerError | null>(null);

  const [value, setValue] = useState('');
  const [check, setCheck] = useState<{ handle: string; status: Status; message: string }>({ handle: '', status: 'idle', message: '' });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const checkSeq = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    try {
      const state = await publicHandlesOwnerApi.getState(entityType, entityId);
      const current = state.activeHandle?.handle ?? null;
      setActive(current);
      setLockedUntil(changeLockedUntil(state));
      setValue(current ?? '');
      setLoadError(null);
    } catch (error) {
      setLoadError(failureOf(error));
    } finally {
      setLoaded(true);
    }
  }, [entityType, entityId]);

  useEffect(() => {
    void load();
  }, [load]);

  const canEdit = loaded && !loadError && !isStaffReader && !impersonating;
  const locked = Boolean(active && lockedUntil);
  const local = checkUsernameLocally(value);
  const profileUrl = publicProfileUrl(entityType, { handle: active, slug, id: entityId });

  /** Availability for the current field value; `immediate` skips the debounce (blur). */
  const runCheck = useCallback(
    (immediate: boolean) => {
      abortRef.current?.abort();
      const seq = ++checkSeq.current;
      const v = checkUsernameLocally(value);
      if (!value.trim()) {
        setCheck({ handle: '', status: 'idle', message: '' });
        return () => undefined;
      }
      if (!v.ok) {
        const status: Status = v.reason === 'reserved' || v.reason === 'reserved_prefix' ? 'reserved' : 'invalid';
        setCheck({ handle: v.handle, status, message: v.message || '' });
        return () => undefined;
      }
      if (v.handle === active) {
        setCheck({ handle: v.handle, status: 'current', message: describeUsernameReason('current_handle') });
        return () => undefined;
      }
      setCheck({ handle: v.handle, status: 'checking', message: 'Checking availability…' });
      const timer = window.setTimeout(
        async () => {
          const controller = new AbortController();
          abortRef.current = controller;
          try {
            const result = await publicHandlesOwnerApi.checkAvailability(entityType, entityId, v.handle, controller.signal);
            if (seq !== checkSeq.current) return;
            const verdict = availabilityVerdict(result);
            setCheck({
              handle: result.handle,
              status: verdict,
              message: verdict === 'available' ? `@${result.handle} is available.` : describeUsernameReason(result.reason),
            });
          } catch (error) {
            if (controller.signal.aborted || seq !== checkSeq.current) return;
            setCheck({ handle: v.handle, status: 'error', message: describeOwnerFailure(failureOf(error)) });
          }
        },
        immediate ? 0 : CHECK_DEBOUNCE_MS,
      );
      return () => window.clearTimeout(timer);
    },
    [value, active, entityType, entityId],
  );

  useEffect(() => {
    if (!canEdit || locked) return undefined;
    return runCheck(false);
  }, [canEdit, locked, runCheck]);

  const ready = !locked && check.status === 'available' && check.handle === local.handle && local.ok;

  const save = async () => {
    if (!ready || saving) return;
    setSaving(true);
    setSaveError(null);
    setNotice(null);
    try {
      const result = await publicHandlesOwnerApi.setHandle(entityType, entityId, local.handle);
      const saved = result.handle.handle;
      setActive(saved);
      setValue(saved);
      setCheck({ handle: saved, status: 'current', message: describeUsernameReason('current_handle') });
      setNotice(
        result.previousHandle
          ? `Saved. Your username is now @${saved}; @${result.previousHandle} has been retired.`
          : `Saved. Your username is now @${saved}.`,
      );
      if (result.previousHandle) {
        // A change starts the 30-day cooldown; take its end from the server.
        const fresh = await publicHandlesOwnerApi.getState(entityType, entityId).catch(() => null);
        if (fresh) setLockedUntil(changeLockedUntil(fresh));
      }
    } catch (error) {
      const failure = failureOf(error);
      setSaveError(describeOwnerFailure(failure)); // the typed username stays in the field
      if (failure.code === 'HANDLE_CHANGE_COOLDOWN' && failure.nextChangeAt) setLockedUntil(failure.nextChangeAt);
      if (failure.code === 'HANDLE_UNAVAILABLE' || failure.code === 'HANDLE_NAMESPACE_CONFLICT') {
        setCheck({ handle: local.handle, status: 'unavailable', message: describeUsernameReason('unavailable') });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      data-testid="pi-section"
      data-entity-type={entityType}
      data-entity-id={entityId}
      aria-labelledby={`pi-title-${entityType}-${entityId}`}
      className="rounded-xl border border-[#E8EDF2] bg-[#FAFBFC] p-4 space-y-3"
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 id={`pi-title-${entityType}-${entityId}`} className="m-0 text-[11px] font-extrabold uppercase tracking-widest text-[#1A1A2E]">
          Public Identity
        </h3>
        <span className={hint}>Saved separately from this section.</span>
      </div>

      {!loaded ? <div className={hint}>Loading username…</div> : null}

      {loadError ? (
        <div data-testid={loadError.code === 'HANDLE_FORBIDDEN' ? 'pi-forbidden' : 'pi-load-error'} role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2">
          <span className="text-[11.5px] font-semibold text-[#B91C1C]">{describeOwnerFailure(loadError)}</span>
          {loadError.code !== 'HANDLE_FORBIDDEN' ? (
            <button type="button" className={ghostBtn} onClick={() => void load()}>
              Retry
            </button>
          ) : null}
        </div>
      ) : null}

      {loaded && !loadError ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className={label}>Current username</div>
              <div data-testid="pi-current" className="text-[14px] font-extrabold text-[#1A1A2E] break-all">
                {active ? `@${active}` : <span className="text-[12px] font-semibold text-[#6B7280]">No username yet</span>}
              </div>
            </div>
            <div className="min-w-0">
              <div className={label}>Public profile</div>
              <a
                data-testid="pi-url"
                href={profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[12px] font-bold text-[#EF3C23] break-all"
              >
                {profileUrl.replace(/^https?:\/\//, '')} <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
              </a>
            </div>
          </div>

          {isStaffReader ? (
            <p data-testid="pi-readonly" className={`${hint} m-0`}>
              Read-only for staff. Super Admins can correct usernames from the Seller / Creator profile’s Public Handle tab.
            </p>
          ) : impersonating ? (
            <p data-testid="pi-impersonating" className="m-0 rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2 text-[11.5px] font-semibold text-[#92400E]">
              Username changes are not available while impersonating an account.
            </p>
          ) : (
            <div data-testid="pi-form" className="space-y-2">
              <label htmlFor={`pi-input-${entityType}-${entityId}`} className={label}>
                Username
              </label>
              <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                <div className="relative flex-1 min-w-[180px]">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[12.5px] text-[#9CA3AF]">@</span>
                  <input
                    id={`pi-input-${entityType}-${entityId}`}
                    data-testid="pi-input"
                    className={`${input} pl-7`}
                    value={value}
                    disabled={locked}
                    maxLength={100}
                    autoComplete="off"
                    spellCheck={false}
                    aria-describedby={`pi-status-${entityType}-${entityId} pi-rules-${entityType}-${entityId}`}
                    aria-invalid={check.status === 'invalid' || check.status === 'reserved' || check.status === 'unavailable'}
                    placeholder={entityType === 'brand' ? 'yourbrand' : 'your-name'}
                    onChange={(e) => {
                      setValue(e.target.value);
                      setSaveError(null);
                      setNotice(null);
                    }}
                    onBlur={() => {
                      if (check.status === 'checking') runCheck(true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void save();
                      }
                    }}
                  />
                </div>
                <button type="button" data-testid="pi-save" className={accentBtn} disabled={!ready || saving} onClick={() => void save()}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
              <div
                id={`pi-status-${entityType}-${entityId}`}
                data-testid="pi-status"
                data-status={check.status}
                role="status"
                aria-live="polite"
                className={`min-h-[16px] text-[11.5px] font-semibold ${check.status === 'idle' ? '' : STATUS_TONE[check.status]}`}
              >
                {check.status === 'idle' || check.handle !== local.handle ? null : (
                  <>
                    {check.status !== 'checking' && check.status !== 'error' ? <span className="font-extrabold">{VERDICT_LABEL[check.status]} — </span> : null}
                    {check.message}
                  </>
                )}
              </div>
              {locked && lockedUntil ? (
                <p data-testid="pi-cooldown" data-until={lockedUntil} className="m-0 rounded-lg border border-[#E8EDF2] bg-white px-3 py-2 text-[11.5px] font-semibold text-[#374151]">
                  Usernames can be changed once every 30 days. You can change it again on {formatNextChange(lockedUntil)}.
                </p>
              ) : null}
              {active && ready ? (
                <p data-testid="pi-retire-note" className={`${hint} m-0`}>
                  Saving retires @{active} permanently — it can’t be used again — and the next change is possible after 30 days.
                </p>
              ) : null}
              <p id={`pi-rules-${entityType}-${entityId}`} className={`${hint} m-0`}>
                {USERNAME_RULES_TEXT}
              </p>
            </div>
          )}

          {notice ? (
            <div data-testid="pi-notice" role="status" className="rounded-lg border border-[#A7F3D0] bg-[#ECFDF5] px-3 py-2 text-[11.5px] font-semibold text-[#065F46]">
              {notice}
            </div>
          ) : null}
          {saveError ? (
            <div data-testid="pi-error" role="alert" className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-[11.5px] font-semibold text-[#B91C1C]">
              {saveError}
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
