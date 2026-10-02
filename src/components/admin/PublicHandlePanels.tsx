import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Modal } from '../ui/Modal';
import { DataTable, type DataTableColumn } from '../ui/DataTable';
import { AdminEditModeBar, useAdminEditMode } from './AdminEditMode';
import { useAuth } from '../../contexts/AuthContext';
import { useImpersonation } from '../../contexts/ImpersonationContext';
import { authApi, type UserDirectoryEntry } from '../../services/authApi';
import { catalogApi } from '../../services/catalogApi';
import { getPublishedStorefrontUrl } from '../../lib/storefrontUrls';
import type { CatalogBrand, CatalogCreator } from '../../types/catalog';
import {
  publicHandlesAdminApi,
  describeHandleReason,
  describePublicHandlesError,
  type EntityHandleState,
  type HandleEntityType,
  type HandleEventRow,
  type HandleRequestRow,
  type HandleRow,
} from '../../services/publicHandlesAdminApi';

/**
 * Public Identity C5 — Admin public handle management (Brands + Creators only).
 *
 * Every state shown comes from the C2 lifecycle API; the server decides. Reads
 * are Admin + Super Admin. Write controls (approve, reject, assign, rename,
 * retire) render only for a Super Admin in Edit Mode who is not impersonating —
 * presentation only: the server still enforces Super Admin and refuses
 * impersonated sessions. Feature Access and page permissions grant nothing here.
 * A Brand handle belongs to the Brand (never its seller); reserve / release stay
 * API-only.
 */

// ─── Shared presentation (same visual language as EntitlementAccessPanels) ───

const card: React.CSSProperties = { background: '#fff', border: '1px solid #E8EDF2', borderRadius: 10, marginBottom: 16, overflow: 'hidden' };
const cardHeader: React.CSSProperties = {
  padding: '14px 24px',
  background: '#F9FAFB',
  borderBottom: '1px solid #F1F3F5',
  fontSize: 10.5,
  fontWeight: 800,
  color: '#6B7280',
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  flexWrap: 'wrap',
};
const body: React.CSSProperties = { padding: '18px 24px' };
const muted: React.CSSProperties = { fontSize: 11, color: '#9CA3AF', fontWeight: 600 };
const strong: React.CSSProperties = { fontSize: 13, fontWeight: 800, color: '#111827' };
const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 36,
  borderRadius: 8,
  border: '1px solid #E8EDF2',
  padding: '0 12px',
  fontSize: 12,
  fontWeight: 600,
  color: '#111827',
  background: '#fff',
};
const smallButton: React.CSSProperties = {
  height: 28,
  padding: '0 10px',
  borderRadius: 7,
  border: '1px solid #E8EDF2',
  background: '#fff',
  color: '#374151',
  fontSize: 11,
  fontWeight: 800,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};
const primaryButton: React.CSSProperties = { ...smallButton, height: 34, padding: '0 14px', background: '#EF3C23', border: '1px solid #EF3C23', color: '#fff' };
const kvGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 };

function Pill({ text, color, background, testId }: { text: string; color: string; background: string; testId?: string }) {
  return (
    <span data-testid={testId} style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.04em', color, background, borderRadius: 999, padding: '3px 8px', whiteSpace: 'nowrap' }}>
      {text}
    </span>
  );
}

function Notice({ tone, children, testId }: { tone: 'warn' | 'info' | 'error'; children: React.ReactNode; testId?: string }) {
  const palette =
    tone === 'error'
      ? { color: '#B91C1C', background: '#FEF2F2', border: '#FECACA' }
      : tone === 'warn'
        ? { color: '#92400E', background: '#FFFBEB', border: '#FDE68A' }
        : { color: '#1E40AF', background: '#EFF6FF', border: '#BFDBFE' };
  return (
    <div data-testid={testId} role={tone === 'error' ? 'alert' : undefined} style={{ fontSize: 12, fontWeight: 600, color: palette.color, background: palette.background, border: `1px solid ${palette.border}`, borderRadius: 8, padding: '10px 12px' }}>
      {children}
    </div>
  );
}

function ErrorCard({ message, onRetry, testId }: { message: string; onRetry: () => void; testId: string }) {
  return (
    <div data-testid={testId} role="alert" style={{ ...body, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: '#B91C1C' }}>{message}</span>
      <button type="button" style={smallButton} onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}

const formatTime = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
};

/** Public storefront URL of a Brand / Creator: its handle, else its slug, else its catalog id (mirrors Web lib/publicUrls). */
export function publicProfileUrl(entityType: HandleEntityType, key: { handle?: string | null; slug?: string | null; id: string }): string {
  const segment = key.handle || key.slug || key.id;
  return `${getPublishedStorefrontUrl()}/${entityType === 'brand' ? 'brands' : 'creators'}/${encodeURIComponent(segment)}`;
}

/** Brand marketplace states in which the server refuses handle approval (C2). */
const BRAND_APPROVAL_BLOCKED = new Set(['suspended', 'revoked', 'restricted']);

// ─── Viewer permissions ─────────────────────────────────────────────────────

type HandleViewer = {
  /** Admin or Super Admin: may see handle data at all. */
  canRead: boolean;
  isSuperAdmin: boolean;
  impersonating: boolean;
  editMode: ReturnType<typeof useAdminEditMode>;
  /** Super Admin, in Edit Mode, not impersonating. Presentation only — the server re-checks. */
  canWrite: boolean;
};

function useHandleViewer(): HandleViewer {
  const { profile } = useAuth();
  const { state: impersonation } = useImpersonation();
  const role = profile?.role ?? null;
  const editMode = useAdminEditMode(role);
  const isSuperAdmin = role === 'super_admin';
  const impersonating = Boolean(impersonation?.active);
  return {
    canRead: role === 'admin' || role === 'super_admin',
    isSuperAdmin,
    impersonating,
    editMode,
    canWrite: isSuperAdmin && editMode.editing && !impersonating,
  };
}

/** True when the signed-in viewer may see handle management at all (Admin or Super Admin). */
export function canViewPublicHandles(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'super_admin';
}

// ─── Account directory (requester / actor identity) ─────────────────────────

let directoryPromise: Promise<UserDirectoryEntry[]> | null = null;
function useUserDirectory(): Map<string, UserDirectoryEntry> {
  const [entries, setEntries] = useState<UserDirectoryEntry[]>([]);
  useEffect(() => {
    let cancelled = false;
    if (!directoryPromise) {
      directoryPromise = authApi.getUsersDirectory().catch(() => {
        directoryPromise = null;
        return [];
      });
    }
    void directoryPromise.then((rows) => {
      if (!cancelled) setEntries(rows);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return useMemo(() => new Map(entries.map((u) => [u.uid, u])), [entries]);
}

function AccountLabel({ userId, directory, testId }: { userId: string | null | undefined; directory: Map<string, UserDirectoryEntry>; testId?: string }) {
  if (!userId) return <span style={muted}>—</span>;
  const user = directory.get(userId);
  return (
    <span data-testid={testId} style={{ display: 'inline-flex', flexDirection: 'column' }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>{user?.displayName || 'Unknown account'}</span>
      <span style={{ fontSize: 10.5, fontWeight: 600, color: '#6B7280' }}>
        {user?.email || userId}
        {user?.choosifyUserId ? ` · ${user.choosifyUserId}` : ''}
      </span>
    </span>
  );
}

// ─── Dialogs ────────────────────────────────────────────────────────────────

function DialogFooter({ busy, onCancel, onSubmit, submitLabel, submitDisabled, testId }: {
  busy: boolean;
  onCancel: () => void;
  onSubmit: () => void;
  submitLabel: string;
  submitDisabled?: boolean;
  testId: string;
}) {
  const disabled = busy || Boolean(submitDisabled);
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
      <button type="button" style={{ ...smallButton, height: 34, padding: '0 14px' }} onClick={onCancel} disabled={busy} data-testid={`${testId}-cancel`}>
        Cancel
      </button>
      <button type="button" data-testid={`${testId}-submit`} onClick={onSubmit} disabled={disabled} style={{ ...primaryButton, opacity: disabled ? 0.55 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}>
        {busy ? 'Saving…' : submitLabel}
      </button>
    </div>
  );
}

function TextArea({ label, required, value, onChange, testId, placeholder }: {
  label: string;
  required: boolean;
  value: string;
  onChange: (v: string) => void;
  testId: string;
  placeholder?: string;
}) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ ...muted, display: 'block', marginBottom: 4 }}>
        {label} {required ? '(REQUIRED)' : '(OPTIONAL)'}
      </span>
      <textarea
        data-testid={testId}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        maxLength={1000}
        style={{ ...inputStyle, height: 'auto', padding: '8px 12px', resize: 'vertical' }}
      />
    </label>
  );
}

const MIN_REASON = 5;

// ─── Request review ─────────────────────────────────────────────────────────

/**
 * Review controls for one pending request: Approve (explicit confirmation,
 * optional note) and Reject (note required). Errors stay inside the open dialog
 * with the request still shown; nothing is assumed to have succeeded until the
 * API confirms it.
 */
export function HandleRequestReview({
  request,
  currentHandle,
  entityLabel,
  directory,
  canWrite,
  approvalBlockedReason,
  onSettled,
  testId = 'handle-review',
}: {
  request: HandleRequestRow;
  currentHandle: string | null;
  entityLabel: string;
  directory: Map<string, UserDirectoryEntry>;
  canWrite: boolean;
  /** Shown as a warning (the server still decides) — e.g. a suspended Brand. */
  approvalBlockedReason?: string | null;
  /** Called after any decision attempt that changed or may have changed server state. */
  onSettled: () => void;
  testId?: string;
}) {
  const [dialog, setDialog] = useState<'approve' | 'reject' | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availability, setAvailability] = useState<{ checked: boolean; available: boolean; message: string } | null>(null);
  // A failure like "not pending" / "superseded" means the server state moved on: refresh on close.
  const staleRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setAvailability(null);
    publicHandlesAdminApi
      .checkAvailability(request.entityType, request.requestedHandle, request.entityId)
      .then((a) => {
        if (cancelled) return;
        setAvailability({ checked: true, available: a.available, message: a.available ? 'Available' : describeHandleReason(a.reason) });
      })
      .catch((e) => {
        if (!cancelled) setAvailability({ checked: false, available: false, message: describePublicHandlesError(e, 'availability') });
      });
    return () => {
      cancelled = true;
    };
  }, [request.entityType, request.requestedHandle, request.entityId]);

  const open = (kind: 'approve' | 'reject') => {
    setDialog(kind);
    setNote('');
    setError(null);
  };
  const close = () => {
    if (busy) return;
    setDialog(null);
    if (staleRef.current) {
      staleRef.current = false;
      onSettled();
    }
  };

  const submit = async () => {
    if (dialog === 'reject' && !note.trim()) {
      setError('A note explaining the rejection is required.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (dialog === 'approve') await publicHandlesAdminApi.approveRequest(request.id, note.trim() || undefined);
      else await publicHandlesAdminApi.rejectRequest(request.id, note.trim());
      setDialog(null);
      onSettled();
    } catch (e) {
      setError(describePublicHandlesError(e, 'this handle request'));
      const code = (e as { code?: string }).code;
      if (code === 'HANDLE_REQUEST_NOT_PENDING' || code === 'HANDLE_REQUESTER_NOT_OWNER' || code === 'HANDLE_REQUEST_NOT_FOUND') staleRef.current = true;
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-testid={testId} style={{ border: '1px solid #FDE68A', background: '#FFFDF5', borderRadius: 10, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Pill text="PENDING REQUEST" color="#92400E" background="#FEF3C7" />
          <span style={strong} data-testid={`${testId}-handle`}>@{request.requestedHandle}</span>
        </div>
        {canWrite && (
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" style={{ ...smallButton, borderColor: '#10B981', color: '#047857' }} onClick={() => open('approve')} data-testid={`${testId}-approve`}>
              Approve…
            </button>
            <button type="button" style={{ ...smallButton, borderColor: '#F87171', color: '#B91C1C' }} onClick={() => open('reject')} data-testid={`${testId}-reject`}>
              Reject…
            </button>
          </div>
        )}
      </div>
      <div style={{ ...kvGrid, marginTop: 12 }}>
        <div>
          <div style={muted}>REQUESTED BY</div>
          <AccountLabel userId={request.requestedByUserId} directory={directory} testId={`${testId}-requester`} />
        </div>
        <div>
          <div style={muted}>SUBMITTED</div>
          <div style={{ fontSize: 12, fontWeight: 700 }}>{formatTime(request.createdAt)}</div>
        </div>
        <div>
          <div style={muted}>CURRENT HANDLE</div>
          <div style={{ fontSize: 12, fontWeight: 700 }}>{currentHandle ? `@${currentHandle}` : 'None'}</div>
        </div>
        <div>
          <div style={muted}>AVAILABILITY</div>
          <div data-testid={`${testId}-availability`} style={{ fontSize: 12, fontWeight: 800, color: availability ? (availability.available ? '#047857' : '#B91C1C') : '#6B7280' }}>
            {availability ? availability.message : 'Checking…'}
          </div>
        </div>
      </div>
      {approvalBlockedReason && (
        <div style={{ marginTop: 12 }}>
          <Notice tone="warn" testId={`${testId}-blocked`}>{approvalBlockedReason}</Notice>
        </div>
      )}

      {dialog && (
        <Modal
          isOpen
          onClose={close}
          title={dialog === 'approve' ? 'Approve handle request' : 'Reject handle request'}
          footer={
            <DialogFooter
              busy={busy}
              onCancel={close}
              onSubmit={submit}
              submitLabel={dialog === 'approve' ? 'Approve request' : 'Reject request'}
              testId={`${testId}-dialog`}
            />
          }
        >
          <div data-testid={`${testId}-dialog`} style={{ display: 'grid', gap: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#4B5563' }}>{entityLabel}</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#111827' }} data-testid={`${testId}-dialog-change`}>
              {currentHandle ? `@${currentHandle}` : 'No handle'} → @{request.requestedHandle}
            </div>
            {dialog === 'approve' ? (
              <Notice tone="info">
                {currentHandle
                  ? `Approving makes @${request.requestedHandle} the public handle. @${currentHandle} is retired permanently and can never be issued again (old links keep redirecting).`
                  : `Approving makes @${request.requestedHandle} the public handle of this profile.`}
              </Notice>
            ) : (
              <Notice tone="info">The requester keeps their current handle. Explain why so the decision is on record.</Notice>
            )}
            {dialog === 'approve' && availability && !availability.available && (
              <Notice tone="warn">Availability check: {availability.message} The server re-checks on approval.</Notice>
            )}
            <TextArea label={dialog === 'approve' ? 'NOTE' : 'REASON FOR REJECTION'} required={dialog === 'reject'} value={note} onChange={setNote} testId={`${testId}-dialog-note`} />
            {error && (
              <Notice tone="error" testId={`${testId}-dialog-error`}>
                {error}
              </Notice>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Direct Super Admin assignment / rename / retire ────────────────────────

function DirectHandleDialog({
  mode,
  entityType,
  entityId,
  entityLabel,
  currentHandle,
  onClose,
  onDone,
}: {
  mode: 'assign' | 'rename' | 'retire';
  entityType: HandleEntityType;
  entityId: string;
  entityLabel: string;
  currentHandle: string | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const testId = `handle-${mode}`;
  const [handle, setHandle] = useState('');
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [checkedFor, setCheckedFor] = useState<{ handle: string; available: boolean; message: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalized = handle.trim().replace(/^@/, '').toLowerCase();
  const availabilityOk = mode === 'retire' || (checkedFor?.handle === normalized && checkedFor.available);

  const check = async () => {
    if (!normalized) return;
    setChecking(true);
    setError(null);
    try {
      const a = await publicHandlesAdminApi.checkAvailability(entityType, normalized, entityId);
      setCheckedFor({ handle: a.handle, available: a.available, message: a.available ? `@${a.handle} is available.` : describeHandleReason(a.reason) });
    } catch (e) {
      setCheckedFor(null);
      setError(describePublicHandlesError(e, 'availability'));
    } finally {
      setChecking(false);
    }
  };

  const submit = async () => {
    if (reason.trim().length < MIN_REASON) {
      setError(`Give a meaningful reason (at least ${MIN_REASON} characters).`);
      return;
    }
    if (mode === 'retire' && !confirmed) {
      setError('Confirm that the handle will be retired permanently.');
      return;
    }
    if (!availabilityOk) {
      setError('Check availability of the new handle first.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (mode === 'retire') await publicHandlesAdminApi.retire({ entityType, entityId, reason: reason.trim() });
      else await publicHandlesAdminApi[mode]({ entityType, entityId, handle: normalized, reason: reason.trim() });
      onDone();
    } catch (e) {
      setError(describePublicHandlesError(e, 'this handle'));
    } finally {
      setBusy(false);
    }
  };

  const title = mode === 'assign' ? 'Assign public handle' : mode === 'rename' ? 'Rename public handle' : 'Retire public handle';
  return (
    <Modal
      isOpen
      onClose={busy ? () => undefined : onClose}
      title={title}
      footer={
        <DialogFooter
          busy={busy}
          onCancel={onClose}
          onSubmit={submit}
          submitLabel={mode === 'assign' ? 'Assign handle' : mode === 'rename' ? 'Rename handle' : 'Retire handle'}
          submitDisabled={!availabilityOk || reason.trim().length < MIN_REASON || (mode === 'retire' && !confirmed)}
          testId={testId}
        />
      }
    >
      <div data-testid={testId} style={{ display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#4B5563' }}>{entityLabel}</div>
        {mode !== 'retire' && (
          <>
            {mode === 'rename' && (
              <div style={{ fontSize: 13, fontWeight: 800 }} data-testid={`${testId}-change`}>
                @{currentHandle} → {normalized ? `@${normalized}` : '…'}
              </div>
            )}
            <label style={{ display: 'block' }}>
              <span style={{ ...muted, display: 'block', marginBottom: 4 }}>NEW HANDLE</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  data-testid={`${testId}-input`}
                  value={handle}
                  onChange={(e) => {
                    setHandle(e.target.value);
                    setCheckedFor(null);
                  }}
                  placeholder="e.g. samsung-bd"
                  maxLength={40}
                  style={inputStyle}
                />
                <button type="button" style={{ ...smallButton, height: 36 }} onClick={check} disabled={!normalized || checking} data-testid={`${testId}-check`}>
                  {checking ? 'Checking…' : 'Check availability'}
                </button>
              </div>
            </label>
            {checkedFor && checkedFor.handle === normalized && (
              <Notice tone={checkedFor.available ? 'info' : 'warn'} testId={`${testId}-availability`}>
                {checkedFor.message}
              </Notice>
            )}
            {mode === 'rename' && (
              <Notice tone="info">@{currentHandle} is retired permanently and can never be issued again. Old links keep redirecting to the new handle.</Notice>
            )}
          </>
        )}
        {mode === 'retire' && (
          <>
            <div style={{ fontSize: 13, fontWeight: 800 }}>@{currentHandle}</div>
            <Notice tone="warn">
              The profile will have no public handle (links fall back to its slug). @{currentHandle} can never be issued again — not even to this profile.
            </Notice>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700 }}>
              <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} data-testid={`${testId}-confirm`} />I understand this retirement is permanent.
            </label>
          </>
        )}
        <TextArea label="REASON" required value={reason} onChange={setReason} testId={`${testId}-reason`} />
        {error && (
          <Notice tone="error" testId={`${testId}-error`}>
            {error}
          </Notice>
        )}
      </div>
    </Modal>
  );
}

// ─── History ────────────────────────────────────────────────────────────────

const ACTION_LABELS: Record<HandleEventRow['action'], string> = {
  assigned: 'Assigned',
  renamed: 'Renamed',
  retired: 'Retired',
  reserved: 'Reserved',
  reserved_assigned: 'Assigned (reserved name)',
  released: 'Released',
  request_submitted: 'Request submitted',
  request_approved: 'Request approved',
  request_rejected: 'Request rejected',
  request_cancelled: 'Request cancelled',
  request_superseded: 'Request superseded',
};

/** Read-only handle rows + append-only event history of one profile. */
export function HandleHistoryList({
  handles,
  events,
  directory,
  testId = 'handle-history',
}: {
  handles: HandleRow[];
  events: HandleEventRow[];
  directory: Map<string, UserDirectoryEntry>;
  testId?: string;
}) {
  const handleColumns: DataTableColumn<HandleRow>[] = [
    { key: 'handle', header: 'Handle', render: (h) => <span style={{ fontWeight: 800 }}>@{h.handle}</span> },
    {
      key: 'status',
      header: 'Status',
      render: (h) =>
        h.status === 'active' ? <Pill text="ACTIVE" color="#047857" background="#D1FAE5" /> : <Pill text={h.status.toUpperCase()} color="#6B7280" background="#F3F4F6" />,
    },
    { key: 'created', header: 'Since', render: (h) => formatTime(h.createdAt) },
    { key: 'retired', header: 'Retired', render: (h) => formatTime(h.retiredAt) },
  ];
  const ordered = [...events].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const eventColumns: DataTableColumn<HandleEventRow>[] = [
    { key: 'when', header: 'When', render: (e) => formatTime(e.createdAt) },
    { key: 'action', header: 'Action', render: (e) => <span style={{ fontWeight: 800 }}>{ACTION_LABELS[e.action] || e.action}</span> },
    {
      key: 'change',
      header: 'Change',
      render: (e) => (e.fromHandle || e.toHandle ? `${e.fromHandle ? `@${e.fromHandle}` : '—'} → ${e.toHandle ? `@${e.toHandle}` : '—'}` : '—'),
    },
    {
      key: 'actor',
      header: 'By',
      render: (e) => (
        <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 2 }}>
          <AccountLabel userId={e.actorUserId} directory={directory} />
          {e.realActorUserId && <span style={{ fontSize: 10, fontWeight: 700, color: '#92400E' }}>via impersonation by {directory.get(e.realActorUserId)?.displayName || e.realActorUserId}</span>}
        </span>
      ),
    },
    { key: 'reason', header: 'Reason / note', render: (e) => e.reason || '—' },
  ];
  return (
    <div data-testid={testId} style={{ display: 'grid', gap: 16 }}>
      <div>
        <div style={{ ...muted, marginBottom: 6 }}>HANDLES</div>
        <DataTable columns={handleColumns} rows={handles} getRowId={(h) => h.id} showRowNumbers={false} emptyMessage="This profile has never had a public handle." />
      </div>
      <div data-testid={`${testId}-events`}>
        <div style={{ ...muted, marginBottom: 6 }}>HISTORY</div>
        <DataTable columns={eventColumns} rows={ordered} getRowId={(e) => e.id} showRowNumbers={false} emptyMessage="No handle activity recorded yet." />
      </div>
    </div>
  );
}

// ─── One Brand / Creator ────────────────────────────────────────────────────

export type HandleEntitySummary = {
  entityType: HandleEntityType;
  entityId: string;
  name: string;
  slug?: string | null;
  /** Brand: marketplaceStatus. Creator: lifecycle status (draft / live / archived). */
  status?: string | null;
  /** Brand: sellerId. Creator: userId. */
  ownerUserId?: string | null;
};

/** Current handle, public URL, status, pending request, direct controls and history of one Brand / Creator. */
export function EntityHandlePanel({ entity, onChanged }: { entity: HandleEntitySummary; onChanged?: () => void }) {
  const viewer = useHandleViewer();
  const directory = useUserDirectory();
  const [state, setState] = useState<EntityHandleState | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [direct, setDirect] = useState<'assign' | 'rename' | 'retire' | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setState(await publicHandlesAdminApi.getEntityState(entity.entityType, entity.entityId));
    } catch (e) {
      setLoadError(describePublicHandlesError(e, 'this profile’s public handle'));
    } finally {
      setLoading(false);
    }
  }, [entity.entityType, entity.entityId]);

  useEffect(() => {
    void load();
  }, [load]);

  const settled = (message?: string) => {
    if (message) setFlash(message);
    void load();
    onChanged?.();
  };

  if (!viewer.canRead) return null;

  const isBrand = entity.entityType === 'brand';
  const active = state?.activeHandle?.handle ?? null;
  const status = entity.status || null;
  const approvalBlocked = isBrand && status && BRAND_APPROVAL_BLOCKED.has(status)
    ? `Marketplace access is ${status}: the server refuses handle approval for this Brand until access is restored. Requests stay pending.`
    : null;
  const entityLabel = `${isBrand ? 'Brand' : 'Creator'}: ${entity.name}`;
  const testId = `handle-panel-${entity.entityType}`;

  return (
    <div style={card} data-testid={testId} data-entity-id={entity.entityId}>
      <div style={cardHeader}>
        <span>Public handle — {entity.name}</span>
        {viewer.isSuperAdmin && <AdminEditModeBar mode={viewer.editMode} />}
      </div>
      {loading && !state ? (
        <div style={{ ...body, ...muted }} data-testid={`${testId}-loading`}>
          Loading public handle…
        </div>
      ) : loadError && !state ? (
        <ErrorCard message={loadError} onRetry={load} testId={`${testId}-error`} />
      ) : state ? (
        <div style={{ ...body, display: 'grid', gap: 16 }}>
          {viewer.isSuperAdmin && viewer.impersonating && (
            <Notice tone="warn" testId={`${testId}-impersonating`}>Handle management is unavailable while impersonating an account.</Notice>
          )}
          {flash && (
            <Notice tone="info" testId={`${testId}-flash`}>
              {flash}
            </Notice>
          )}
          <div style={kvGrid}>
            <div>
              <div style={muted}>ACTIVE HANDLE</div>
              <div style={{ ...strong, fontSize: 15 }} data-testid={`${testId}-active`}>
                {active ? `@${active}` : 'None'}
              </div>
            </div>
            <div>
              <div style={muted}>PUBLIC URL</div>
              <a
                href={publicProfileUrl(entity.entityType, { handle: active, slug: entity.slug, id: entity.entityId })}
                target="_blank"
                rel="noreferrer"
                data-testid={`${testId}-url`}
                style={{ fontSize: 12, fontWeight: 700, color: '#2563EB', wordBreak: 'break-all' }}
              >
                {publicProfileUrl(entity.entityType, { handle: active, slug: entity.slug, id: entity.entityId })}
              </a>
            </div>
            <div>
              <div style={muted}>{isBrand ? 'MARKETPLACE STATUS' : 'CREATOR STATUS'}</div>
              <div data-testid={`${testId}-status`} style={{ fontSize: 12, fontWeight: 800 }}>
                {status || '—'}
              </div>
            </div>
            <div>
              <div style={muted}>{isBrand ? 'OWNING SELLER' : 'OWNER ACCOUNT'}</div>
              {entity.ownerUserId ? (
                <AccountLabel userId={entity.ownerUserId} directory={directory} />
              ) : (
                <div data-testid={`${testId}-no-owner`} style={{ fontSize: 12, fontWeight: 700, color: '#6B7280' }}>
                  No linked owner account
                </div>
              )}
            </div>
          </div>
          {!isBrand && (
            <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7280' }}>
              {status === 'live'
                ? 'Live: the handle resolves publicly.'
                : 'Not live: the handle is kept, but the profile does not resolve publicly until it is live. Requests can still be reviewed.'}
              {!entity.ownerUserId && ' Without an owner account nobody can submit a request; a Super Admin can still assign a handle directly.'}
            </div>
          )}
          {isBrand && approvalBlocked && !state.pendingRequest && (
            <Notice tone="warn" testId={`${testId}-blocked`}>{approvalBlocked}</Notice>
          )}
          {!state.entityExists && <Notice tone="warn">This profile no longer exists in the catalog; its handle history is kept.</Notice>}

          {state.pendingRequest ? (
            <HandleRequestReview
              request={state.pendingRequest}
              currentHandle={active}
              entityLabel={entityLabel}
              directory={directory}
              canWrite={viewer.canWrite}
              approvalBlockedReason={approvalBlocked}
              onSettled={() => settled()}
              testId={`${testId}-review`}
            />
          ) : (
            <div style={{ fontSize: 12, fontWeight: 600, color: '#6B7280' }} data-testid={`${testId}-no-request`}>
              No pending handle request.
            </div>
          )}

          {viewer.canWrite && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} data-testid={`${testId}-direct`}>
              {!active && (
                <button type="button" style={smallButton} onClick={() => setDirect('assign')} data-testid={`${testId}-assign`}>
                  Assign handle…
                </button>
              )}
              {active && (
                <>
                  <button type="button" style={smallButton} onClick={() => setDirect('rename')} data-testid={`${testId}-rename`}>
                    Rename…
                  </button>
                  <button type="button" style={{ ...smallButton, borderColor: '#F87171', color: '#B91C1C' }} onClick={() => setDirect('retire')} data-testid={`${testId}-retire`}>
                    Retire…
                  </button>
                </>
              )}
            </div>
          )}

          <HandleHistoryList handles={state.handles} events={state.events} directory={directory} testId={`${testId}-history`} />
        </div>
      ) : null}
      {direct && (
        <DirectHandleDialog
          mode={direct}
          entityType={entity.entityType}
          entityId={entity.entityId}
          entityLabel={entityLabel}
          currentHandle={active}
          onClose={() => setDirect(null)}
          onDone={() => {
            const done = direct;
            setDirect(null);
            settled(done === 'assign' ? 'Handle assigned.' : done === 'rename' ? 'Handle renamed.' : 'Handle retired.');
          }}
        />
      )}
    </div>
  );
}

/** A seller's Brands, one at a time (handles belong to Brands, never to the seller). */
export function SellerBrandHandles({ brands, initialBrandId }: { brands: CatalogBrand[]; initialBrandId?: string | null }) {
  const [selected, setSelected] = useState<string>(() =>
    initialBrandId && brands.some((b) => b.id === initialBrandId) ? initialBrandId : brands[0]?.id || '',
  );
  useEffect(() => {
    if (!brands.some((b) => b.id === selected)) setSelected(initialBrandId && brands.some((b) => b.id === initialBrandId) ? initialBrandId : brands[0]?.id || '');
  }, [brands, initialBrandId, selected]);
  const brand = brands.find((b) => b.id === selected);
  if (brands.length === 0) {
    return (
      <div style={card} data-testid="handle-seller-no-brands">
        <div style={cardHeader}>Public handle</div>
        <div style={{ ...body, fontSize: 12, fontWeight: 600, color: '#6B7280' }}>This seller owns no Brands. Public handles belong to Brands.</div>
      </div>
    );
  }
  return (
    <div>
      {brands.length > 1 && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <span style={muted}>BRAND</span>
          <select data-testid="handle-brand-select" value={selected} onChange={(e) => setSelected(e.target.value)} style={{ ...inputStyle, width: 'auto', minWidth: 240 }}>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <span style={muted}>{brands.length} Brands owned by this seller — each has its own handle.</span>
        </label>
      )}
      {brand && (
        <EntityHandlePanel
          key={brand.id}
          entity={{
            entityType: 'brand',
            entityId: brand.id,
            name: brand.name,
            slug: brand.slug,
            status: brand.marketplaceStatus ?? (brand.marketplaceAccess === false ? 'not_granted' : null),
            ownerUserId: brand.sellerId ?? null,
          }}
        />
      )}
    </div>
  );
}

// ─── Central queue ──────────────────────────────────────────────────────────

/** Pending Brand and Creator handle requests, oldest first, with review in place. */
export function HandleRequestQueue() {
  const viewer = useHandleViewer();
  const directory = useUserDirectory();
  const [rows, setRows] = useState<HandleRequestRow[] | null>(null);
  const [brands, setBrands] = useState<Map<string, CatalogBrand>>(new Map());
  const [creators, setCreators] = useState<Map<string, CatalogCreator>>(new Map());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState<HandleRequestRow | null>(null);
  const [reviewState, setReviewState] = useState<EntityHandleState | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [pending, allBrands, allCreators] = await Promise.all([
        publicHandlesAdminApi.listRequests({ status: 'pending', limit: 200 }),
        catalogApi.listBrands().catch(() => [] as CatalogBrand[]),
        catalogApi.listCreators().catch(() => [] as CatalogCreator[]),
      ]);
      setRows(pending);
      setBrands(new Map(allBrands.map((b) => [b.id, b])));
      setCreators(new Map(allCreators.map((c) => [c.id, c])));
    } catch (e) {
      setLoadError(describePublicHandlesError(e, 'handle requests'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (viewer.canRead) void load();
  }, [load, viewer.canRead]);

  // The review needs the entity's current handle; read it when a row is opened.
  useEffect(() => {
    let cancelled = false;
    setReviewState(null);
    if (!reviewing) return;
    publicHandlesAdminApi
      .getEntityState(reviewing.entityType, reviewing.entityId)
      .then((s) => {
        if (!cancelled) setReviewState(s);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [reviewing]);

  if (!viewer.canRead) return null;

  const entityName = (r: HandleRequestRow) =>
    r.entityType === 'brand' ? brands.get(r.entityId)?.name : creators.get(r.entityId)?.name;
  const profileHref = (r: HandleRequestRow): string | null => {
    if (r.entityType === 'creator') return `/admin/creator-review?creatorId=${encodeURIComponent(r.entityId)}&tab=handle`;
    const sellerId = brands.get(r.entityId)?.sellerId;
    return sellerId ? `/admin/seller-profile?sellerId=${encodeURIComponent(sellerId)}&tab=handle&brandId=${encodeURIComponent(r.entityId)}` : null;
  };
  const brandStatus = (r: HandleRequestRow) => {
    if (r.entityType !== 'brand') return null;
    const s = brands.get(r.entityId)?.marketplaceStatus;
    return s && BRAND_APPROVAL_BLOCKED.has(s) ? s : null;
  };

  const columns: DataTableColumn<HandleRequestRow>[] = [
    { key: 'when', header: 'Submitted', render: (r) => formatTime(r.createdAt), sortValue: (r) => r.createdAt },
    { key: 'type', header: 'Type', render: (r) => <Pill text={r.entityType === 'brand' ? 'BRAND' : 'CREATOR'} color="#1E40AF" background="#DBEAFE" /> },
    {
      key: 'entity',
      header: 'Profile',
      render: (r) => (
        <span style={{ display: 'inline-flex', flexDirection: 'column' }}>
          <span style={{ fontWeight: 800 }}>{entityName(r) || 'Unknown profile'}</span>
          <span style={{ fontSize: 10.5, color: '#6B7280' }}>{r.entityId}</span>
          {brandStatus(r) && <span style={{ fontSize: 10, fontWeight: 800, color: '#92400E' }}>Marketplace {brandStatus(r)} — approval blocked</span>}
        </span>
      ),
    },
    { key: 'requester', header: 'Requested by', render: (r) => <AccountLabel userId={r.requestedByUserId} directory={directory} /> },
    { key: 'handle', header: 'Requested handle', render: (r) => <span style={{ fontWeight: 800 }}>@{r.requestedHandle}</span> },
    {
      key: 'actions',
      header: '',
      render: (r) => {
        const href = profileHref(r);
        return (
          <span style={{ display: 'inline-flex', gap: 6 }}>
            <button type="button" style={smallButton} onClick={() => setReviewing(r)} data-testid={`handle-queue-review-${r.id}`}>
              Review
            </button>
            {href ? (
              <Link to={href} style={{ ...smallButton, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }} data-testid={`handle-queue-open-${r.id}`}>
                Open profile
              </Link>
            ) : (
              <span style={{ fontSize: 10.5, fontWeight: 700, color: '#9CA3AF' }}>No seller profile</span>
            )}
          </span>
        );
      },
    },
  ];

  return (
    <div style={card} data-testid="handle-queue">
      <div style={cardHeader}>
        <span>
          Public handle requests {rows ? `· ${rows.length} pending` : ''}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
          <button type="button" style={smallButton} onClick={() => void load()} disabled={loading} data-testid="handle-queue-refresh">
            {loading ? 'Loading…' : 'Refresh'}
          </button>
          {viewer.isSuperAdmin && <AdminEditModeBar mode={viewer.editMode} />}
        </span>
      </div>
      {loadError && !rows ? (
        <ErrorCard message={loadError} onRetry={load} testId="handle-queue-error" />
      ) : (
        <div style={body}>
          {viewer.isSuperAdmin && viewer.impersonating && (
            <div style={{ marginBottom: 12 }}>
              <Notice tone="warn">Handle management is unavailable while impersonating an account.</Notice>
            </div>
          )}
          <DataTable
            columns={columns}
            rows={rows || []}
            getRowId={(r) => r.id}
            showRowNumbers={false}
            isLoading={loading && !rows}
            loadingMessage="Loading handle requests…"
            emptyMessage="No pending handle requests."
          />
        </div>
      )}
      {reviewing && (
        <Modal isOpen onClose={() => setReviewing(null)} title="Review handle request" maxWidth="max-w-2xl">
          <div style={{ display: 'grid', gap: 12 }} data-testid="handle-queue-review">
            <div style={{ fontSize: 12, fontWeight: 700 }}>
              {reviewing.entityType === 'brand' ? 'Brand' : 'Creator'}: {entityName(reviewing) || reviewing.entityId}
            </div>
            {reviewState ? (
              <HandleRequestReview
                request={reviewing}
                currentHandle={reviewState.activeHandle?.handle ?? null}
                entityLabel={`${reviewing.entityType === 'brand' ? 'Brand' : 'Creator'}: ${entityName(reviewing) || reviewing.entityId}`}
                directory={directory}
                canWrite={viewer.canWrite}
                approvalBlockedReason={
                  brandStatus(reviewing)
                    ? `Marketplace access is ${brandStatus(reviewing)}: the server refuses handle approval for this Brand until access is restored.`
                    : null
                }
                onSettled={() => {
                  setReviewing(null);
                  void load();
                }}
                testId="handle-queue-item"
              />
            ) : (
              <div style={muted}>Loading current handle…</div>
            )}
            {viewer.isSuperAdmin && !viewer.impersonating ? (
              // The queue header's Edit Mode control sits behind this modal; offer it here too.
              !viewer.editMode.editing && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#6B7280' }}>Enter Edit Mode to approve or reject.</span>
                  <AdminEditModeBar mode={viewer.editMode} />
                </div>
              )
            ) : (
              !viewer.canWrite && (
                <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7280' }}>Only a Super Admin can approve or reject handle requests.</div>
              )
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
