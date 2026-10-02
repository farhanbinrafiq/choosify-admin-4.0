// PUBLIC IDENTITY — the owner's username section in Brand Studio and Creator
// Studio. A username (public handle) belongs to the Brand / Creator entity, never
// to the seller or login account; each entity's section is independent.
//
// Every change is a REQUEST: the active username stays unchanged until a Choosify
// Super Admin approves it, and an approved change permanently retires the old
// one. The server decides ownership and refuses impersonated sessions; the
// controls here only mirror that (staff see a read-only view). Feature Access
// grants nothing here.
import React, { useCallback, useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useImpersonation } from '../../contexts/ImpersonationContext';
import { publicProfileUrl } from '../admin/PublicHandlePanels';
import { publicHandlesOwnerApi, PublicIdentityOwnerError } from '../../services/publicHandlesOwnerApi';
import {
  USERNAME_RULES_TEXT,
  VERDICT_LABEL,
  availabilityVerdict,
  checkUsernameLocally,
  describeOwnerFailure,
  describeUsernameReason,
  latestDecidedRequest,
  type AvailabilityVerdict,
  type OwnerEntityType,
  type OwnerHandleState,
} from '../../lib/publicIdentityOwner';

const label = 'block text-[10px] font-extrabold uppercase tracking-wider text-[#6B7280] mb-1';
const input =
  'w-full rounded-lg border border-[#E8EDF2] px-3 py-2 text-[12.5px] text-[#1A1A2E] outline-none focus:border-[#EF3C23]/50 bg-white';
const ghostBtn =
  'inline-flex items-center gap-1 rounded-md border border-[#E8EDF2] bg-white px-2.5 py-1.5 text-[11px] font-bold text-[#374151] disabled:opacity-50 disabled:cursor-not-allowed';
const accentBtn =
  'inline-flex items-center gap-1 rounded-md bg-[#EF3C23] px-3 py-1.5 text-[11px] font-extrabold text-white disabled:opacity-50 disabled:cursor-not-allowed';
const hint = 'text-[10.5px] leading-snug text-[#9CA3AF]';

const VERDICT_TONE: Record<AvailabilityVerdict, string> = {
  available: 'bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]',
  current: 'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]',
  reserved: 'bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]',
  invalid: 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]',
  unavailable: 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]',
};

const formatDate = (iso: string | null | undefined) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

const failureOf = (error: unknown) =>
  error instanceof PublicIdentityOwnerError ? error : new PublicIdentityOwnerError('Unexpected error', 0, 'NETWORK_ERROR');

export type PublicIdentitySectionProps = {
  entityType: OwnerEntityType;
  entityId: string;
  /** Current catalog slug — the public address while no username is active. */
  slug?: string | null;
};

export function PublicIdentitySection({ entityType, entityId, slug }: PublicIdentitySectionProps) {
  const { profile } = useAuth();
  const { state: impersonation } = useImpersonation();
  const isStaffReader = profile?.role === 'admin' || profile?.role === 'super_admin';
  const impersonating = Boolean(impersonation?.active);
  const noun = entityType === 'brand' ? 'Brand' : 'Creator';

  const [state, setState] = useState<OwnerHandleState | null>(null);
  const [loadError, setLoadError] = useState<PublicIdentityOwnerError | null>(null);
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [value, setValue] = useState('');
  const [checking, setChecking] = useState(false);
  const [availability, setAvailability] = useState<{ handle: string; verdict: AvailabilityVerdict; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setState(await publicHandlesOwnerApi.getState(entityType, entityId));
      setLoadError(null);
    } catch (error) {
      setLoadError(failureOf(error));
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => {
    void load();
  }, [load]);

  const local = checkUsernameLocally(value);
  // An availability answer only counts for exactly the username now in the field.
  const currentAvailability = availability && local.handle === availability.handle ? availability : null;
  const canMutate = Boolean(state) && !isStaffReader && !impersonating;
  const pending = state?.pendingRequest ?? null;
  const active = state?.activeHandle?.handle ?? null;
  const decided = state ? latestDecidedRequest(state) : null;
  const profileUrl = publicProfileUrl(entityType, { handle: active, slug, id: entityId });

  const runCheck = async () => {
    setActionError(null);
    setNotice(null);
    if (!local.ok) {
      setAvailability({ handle: local.handle, verdict: availabilityVerdict({ handle: local.handle, available: false, reason: local.reason }), message: local.message });
      return;
    }
    setChecking(true);
    try {
      const result = await publicHandlesOwnerApi.checkAvailability(entityType, entityId, local.handle);
      const verdict = availabilityVerdict(result);
      setAvailability({
        handle: result.handle,
        verdict,
        message: verdict === 'available' ? `@${result.handle} is available to request.` : describeUsernameReason(result.reason),
      });
    } catch (error) {
      setAvailability(null);
      setActionError(describeOwnerFailure(failureOf(error)));
    } finally {
      setChecking(false);
    }
  };

  const submit = async () => {
    if (!local.ok || currentAvailability?.verdict !== 'available') return;
    setSubmitting(true);
    setActionError(null);
    setNotice(null);
    try {
      const created = await publicHandlesOwnerApi.submitRequest(entityType, entityId, local.handle);
      setNotice(
        `Request for @${created.requestedHandle} submitted and waiting for Choosify review. ${
          active ? `@${active} stays your username until it is approved.` : 'Nothing changes until it is approved.'
        }`,
      );
      setFormOpen(false);
      setValue('');
      setAvailability(null);
      await load();
    } catch (error) {
      const failure = failureOf(error);
      setActionError(describeOwnerFailure(failure)); // the typed username stays in the field
      if (failure.code === 'HANDLE_PENDING_EXISTS') await load();
    } finally {
      setSubmitting(false);
    }
  };

  const cancelPending = async () => {
    if (!pending) return;
    setCancelling(true);
    setActionError(null);
    setNotice(null);
    try {
      const cancelled = await publicHandlesOwnerApi.cancelRequest(pending.id);
      setNotice(`Request for @${cancelled.requestedHandle} cancelled. ${active ? `Your username is still @${active}.` : 'Nothing was changed.'}`);
      setConfirmCancel(false);
      await load();
    } catch (error) {
      const failure = failureOf(error);
      setActionError(describeOwnerFailure(failure));
      if (failure.code === 'HANDLE_REQUEST_NOT_PENDING' || failure.code === 'HANDLE_REQUEST_NOT_FOUND') {
        setConfirmCancel(false);
        await load();
      }
    } finally {
      setCancelling(false);
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
        <span className={hint}>Sent on its own — the section Save does not submit username requests.</span>
      </div>

      {loading && !state && !loadError ? <div className={hint}>Loading username…</div> : null}

      {loadError && !state ? (
        <div data-testid={loadError.code === 'HANDLE_FORBIDDEN' ? 'pi-forbidden' : 'pi-load-error'} role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2">
          <span className="text-[11.5px] font-semibold text-[#B91C1C]">{describeOwnerFailure(loadError)}</span>
          {loadError.code !== 'HANDLE_FORBIDDEN' ? (
            <button type="button" className={ghostBtn} onClick={() => void load()}>
              Retry
            </button>
          ) : null}
        </div>
      ) : null}

      {state ? (
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

          {pending ? (
            <div data-testid="pi-pending" className="rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2.5 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="rounded-full bg-[#FEF3C7] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-[#92400E]">Pending review</span>
                <span className="text-[12px] font-semibold text-[#78350F]">
                  Requested username <strong data-testid="pi-pending-handle">@{pending.requestedHandle}</strong>
                  {formatDate(pending.createdAt) ? ` · submitted ${formatDate(pending.createdAt)}` : ''}
                </span>
              </div>
              <p className="m-0 text-[11px] text-[#92400E]">
                {active ? `Your username stays @${active} until Choosify approves this request.` : 'Nothing changes until Choosify approves this request.'}
              </p>
              {canMutate && pending.requestedByUserId === profile?.id ? (
                confirmCancel ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-semibold text-[#78350F]">Cancel the request for @{pending.requestedHandle}?</span>
                    <button type="button" data-testid="pi-cancel-confirm" className={accentBtn} disabled={cancelling} onClick={() => void cancelPending()}>
                      {cancelling ? 'Cancelling…' : 'Yes, cancel request'}
                    </button>
                    <button type="button" className={ghostBtn} disabled={cancelling} onClick={() => setConfirmCancel(false)}>
                      Keep request
                    </button>
                  </div>
                ) : (
                  <button type="button" data-testid="pi-cancel" className={ghostBtn} onClick={() => setConfirmCancel(true)}>
                    Cancel request
                  </button>
                )
              ) : null}
            </div>
          ) : null}

          {!pending && decided ? (
            decided.status === 'rejected' ? (
              <div data-testid="pi-rejected" className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2.5">
                <div className="text-[12px] font-bold text-[#991B1B]">
                  Your request for @{decided.requestedHandle} was not approved{formatDate(decided.decidedAt) ? ` (${formatDate(decided.decidedAt)})` : ''}.
                </div>
                {decided.decisionNote ? (
                  <div className="mt-1 text-[11.5px] text-[#7F1D1D]">
                    Reason: <span data-testid="pi-rejected-reason">{decided.decisionNote}</span>
                  </div>
                ) : null}
              </div>
            ) : decided.status === 'superseded' ? (
              <div data-testid="pi-superseded" className="rounded-lg border border-[#E8EDF2] bg-white px-3 py-2.5 text-[11.5px] text-[#4B5563]">
                Your request for @{decided.requestedHandle} was closed without a change{decided.decisionNote ? ` — ${decided.decisionNote}` : ''}.
              </div>
            ) : decided.status === 'approved' && decided.requestedHandle === active ? (
              <div data-testid="pi-approved" className="rounded-lg border border-[#A7F3D0] bg-[#ECFDF5] px-3 py-2.5 text-[11.5px] font-semibold text-[#065F46]">
                @{decided.requestedHandle} was approved{formatDate(decided.decidedAt) ? ` on ${formatDate(decided.decidedAt)}` : ''}.
              </div>
            ) : null
          ) : null}

          {notice ? (
            <div data-testid="pi-notice" role="status" className="rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-2 text-[11.5px] font-semibold text-[#1E40AF]">
              {notice}
            </div>
          ) : null}
          {actionError ? (
            <div data-testid="pi-error" role="alert" className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-[11.5px] font-semibold text-[#B91C1C]">
              {actionError}
            </div>
          ) : null}

          {isStaffReader ? (
            <p data-testid="pi-readonly" className={`${hint} m-0`}>
              Read-only for staff. Username requests are reviewed by a Super Admin in Brand Verification → public handle requests.
            </p>
          ) : impersonating ? (
            <p data-testid="pi-impersonating" className="m-0 rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2 text-[11.5px] font-semibold text-[#92400E]">
              Username changes are not available while impersonating an account.
            </p>
          ) : null}

          {canMutate && !pending ? (
            formOpen ? (
              <div data-testid="pi-form" className="space-y-2 rounded-lg border border-[#E8EDF2] bg-white p-3">
                <div>
                  <label htmlFor={`pi-input-${entityType}-${entityId}`} className={label}>
                    New username
                  </label>
                  <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                    <div className="relative flex-1 min-w-[180px]">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[12.5px] text-[#9CA3AF]">@</span>
                      <input
                        id={`pi-input-${entityType}-${entityId}`}
                        data-testid="pi-input"
                        className={`${input} pl-7`}
                        value={value}
                        maxLength={100}
                        autoComplete="off"
                        spellCheck={false}
                        aria-describedby={`pi-rules-${entityType}-${entityId}`}
                        placeholder={entityType === 'brand' ? 'yourbrand' : 'your-name'}
                        onChange={(e) => {
                          setValue(e.target.value);
                          setActionError(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            void runCheck();
                          }
                        }}
                      />
                    </div>
                    <button type="button" data-testid="pi-check" className={ghostBtn} disabled={checking || !value.trim()} onClick={() => void runCheck()}>
                      {checking ? 'Checking…' : 'Check availability'}
                    </button>
                  </div>
                </div>
                <p id={`pi-rules-${entityType}-${entityId}`} className={`${hint} m-0`}>
                  {USERNAME_RULES_TEXT}
                </p>
                {value.trim() && !local.ok && !currentAvailability ? (
                  <p data-testid="pi-local-error" className="m-0 text-[11px] font-semibold text-[#B91C1C]">
                    {local.message}
                  </p>
                ) : null}
                {currentAvailability ? (
                  <div data-testid="pi-verdict" data-verdict={currentAvailability.verdict} role="status" className={`rounded-lg border px-3 py-2 text-[11.5px] font-semibold ${VERDICT_TONE[currentAvailability.verdict]}`}>
                    <span className="font-extrabold">{VERDICT_LABEL[currentAvailability.verdict]}</span> — {currentAvailability.message}
                  </div>
                ) : null}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    data-testid="pi-submit"
                    className={accentBtn}
                    disabled={submitting || !local.ok || currentAvailability?.verdict !== 'available'}
                    onClick={() => void submit()}
                  >
                    {submitting ? 'Submitting…' : 'Submit request'}
                  </button>
                  <button
                    type="button"
                    className={ghostBtn}
                    disabled={submitting}
                    onClick={() => {
                      setFormOpen(false);
                      setValue('');
                      setAvailability(null);
                      setActionError(null);
                    }}
                  >
                    Close
                  </button>
                  {local.ok && currentAvailability?.verdict !== 'available' ? (
                    <span className={hint}>Check availability before submitting.</span>
                  ) : null}
                </div>
              </div>
            ) : (
              <button
                type="button"
                data-testid="pi-change"
                className={ghostBtn}
                onClick={() => {
                  setFormOpen(true);
                  setNotice(null);
                }}
              >
                {active ? 'Change username' : 'Request a username'}
              </button>
            )
          ) : null}

          <ul className={`${hint} m-0 list-disc space-y-0.5 pl-4`}>
            <li>Your username belongs to this {noun} and is its public web address. Display names can still use Bangla or any language.</li>
            <li>Every username change is reviewed by Choosify. {active ? 'Your current username stays active until the request is approved.' : 'Nothing changes until it is approved.'}</li>
            <li>After an approved change the old username is permanently retired — it can never be used again, by you or anyone else.</li>
          </ul>
        </>
      ) : null}
    </section>
  );
}
