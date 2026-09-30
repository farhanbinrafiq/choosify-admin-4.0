import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Modal } from '../ui/Modal';
import { DataTable, type DataTableColumn } from '../ui/DataTable';
import { authApi, type UserDirectoryEntry } from '../../services/authApi';
import {
  entitlementsAdminApi,
  describeEntitlementsAdminError,
  type AccountEntitlementRow,
  type AccountEntitlementSummary,
  type AccountOverrideRow,
  type AuditPerson,
  type EntitlementAuditEvent,
  type EntitlementSource,
  type OverrideEffect,
  type PlatformFeatureState,
} from '../../services/entitlementsAdminApi';
import { PARTNER_FEATURES, featureByKey, isSwitchableFeature } from '../../../shared/entitlements/registry';

/**
 * Shared Feature Access panels (Phase 2C): one account's effective access, the
 * platform switches and the entitlement audit history. Every state shown here
 * comes from the Phase 2B admin API — the server evaluates precedence; these
 * panels only explain its decision. Mutation controls render only when the
 * caller passes `canMutate` (Super Admin in Edit Mode); the server remains the
 * authorization boundary either way.
 */

// ─── Shared presentation ────────────────────────────────────────────────────

const card: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #E8EDF2',
  borderRadius: 10,
  marginBottom: 16,
  overflow: 'hidden',
};
const cardHeader: React.CSSProperties = {
  padding: '14px 24px',
  background: '#F9FAFB',
  borderBottom: '1px solid #F1F3F5',
  fontSize: 10.5,
  fontWeight: 800,
  color: '#6B7280',
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
};
const muted: React.CSSProperties = { fontSize: 11, color: '#9CA3AF', fontWeight: 600 };
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

function Pill({ text, color, background, testId }: { text: string; color: string; background: string; testId?: string }) {
  return (
    <span
      data-testid={testId}
      style={{ fontSize: 10, fontWeight: 800, color, background, padding: '4px 8px', borderRadius: 6, whiteSpace: 'nowrap' }}
    >
      {text}
    </span>
  );
}

function ErrorCard({ message, onRetry, testId }: { message: string; onRetry: () => void; testId: string }) {
  return (
    <div role="alert" data-testid={testId} style={{ ...card, border: '1px solid #FECACA', background: '#FEF2F2', padding: '18px 24px' }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: '#B91C1C' }}>{message}</div>
      <div style={{ fontSize: 11, color: '#991B1B', fontWeight: 600, marginTop: 4 }}>
        No entitlement state is shown until it can be loaded from the server.
      </div>
      <button
        type="button"
        onClick={onRetry}
        style={{ ...smallButton, marginTop: 12, height: 32, padding: '0 14px', color: '#B91C1C', border: '1px solid #FECACA' }}
      >
        Retry
      </button>
    </div>
  );
}

function SuccessNotice({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      data-testid="entitlement-notice"
      style={{
        marginBottom: 16,
        borderRadius: 10,
        border: '1px solid #A7F3D0',
        background: '#ECFDF5',
        padding: '10px 16px',
        fontSize: 13,
        fontWeight: 600,
        color: '#065F46',
      }}
    >
      {message}
    </div>
  );
}

function useTransientNotice(): [string | null, (msg: string) => void] {
  const [notice, setNotice] = useState<string | null>(null);
  const show = useCallback((msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice((current) => (current === msg ? null : current)), 3200);
  }, []);
  return [notice, show];
}

const formatTime = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString() : '—');
const featureLabel = (key: string | null | undefined) => (key ? featureByKey(key)?.label || key : '—');

// ─── Source explanation ─────────────────────────────────────────────────────

export const SOURCE_LABELS: Record<EntitlementSource, string> = {
  core: 'Core',
  platform: 'Platform Disabled',
  override: 'Account Override',
  plan: 'Plan',
  role_default: 'Role Default',
  dependency: 'Dependency',
  role_ineligible: 'Not Eligible',
  deprecated: 'Deprecated',
  unknown: 'Unknown Feature',
  not_partner: 'Not a Partner Account',
};

const EFFECT_LABELS: Record<OverrideEffect, string> = {
  grant: 'Grant',
  revoke: 'Revoke',
  restrict: 'Temporary Restriction',
};

export type AccessExplanation = {
  status: 'ENABLED' | 'DISABLED' | 'RESTRICTED';
  sourceLabel: string;
  explanation: string;
  expiresAt?: string;
  notes: string[];
};

/** Human-readable reading of one server decision (never re-derives the decision itself). */
export function explainAccess(row: AccountEntitlementRow, override: AccountOverrideRow | undefined): AccessExplanation {
  const detail = (row.detail || {}) as Record<string, unknown>;
  const notes: string[] = [];
  let status: AccessExplanation['status'] = row.enabled ? 'ENABLED' : 'DISABLED';
  let sourceLabel = SOURCE_LABELS[row.source] || row.source;
  let explanation = '';
  let expiresAt: string | undefined;

  switch (row.source) {
    case 'core':
      explanation = 'Core capability — always on for this role.';
      break;
    case 'platform':
      explanation = 'Turned off platform-wide for every partner by a Super Admin.';
      if (override) {
        notes.push(`An account override (${EFFECT_LABELS[override.effect]}) exists, but the platform switch takes precedence.`);
      }
      break;
    case 'override': {
      const effect = detail.effect as OverrideEffect | undefined;
      if (effect === 'grant') {
        sourceLabel = 'Account Grant';
        explanation = 'Granted to this account by a Super Admin override.';
      } else if (effect === 'restrict') {
        sourceLabel = 'Account Restriction';
        status = 'RESTRICTED';
        expiresAt = typeof detail.expiresAt === 'string' ? detail.expiresAt : override?.expiresAt || undefined;
        explanation = `Temporarily restricted for this account until ${formatTime(expiresAt)}.`;
      } else {
        sourceLabel = 'Account Revocation';
        explanation = 'Revoked for this account by a Super Admin override.';
      }
      break;
    }
    case 'plan':
      explanation = row.enabled ? 'Included in this account’s subscription plan.' : 'Not included in this account’s subscription plan.';
      break;
    case 'role_default':
      explanation = detail.missing
        ? 'No role default is stored for this feature — denied.'
        : row.enabled
          ? 'On by the role default for this role.'
          : 'Off by the role default for this role.';
      break;
    case 'dependency': {
      const requires = typeof detail.requires === 'string' ? detail.requires : '';
      const depSource = typeof detail.dependencySource === 'string' ? (detail.dependencySource as EntitlementSource) : null;
      explanation = requires
        ? `Requires ${featureLabel(requires)}, which is off${depSource ? ` (${SOURCE_LABELS[depSource] || depSource})` : ''}.`
        : 'A required feature is off.';
      if (override?.active) {
        notes.push(`An account override (${EFFECT_LABELS[override.effect]}) is active, but a required feature is off.`);
      }
      break;
    }
    case 'role_ineligible':
      explanation = 'This feature is not available to this account’s role.';
      break;
    case 'deprecated':
      explanation = 'Deprecated feature — no longer resolved.';
      break;
    case 'not_partner':
      explanation = 'Partner entitlements do not apply to this account.';
      break;
    default:
      explanation = 'Unknown feature — denied.';
  }

  if (override && !override.active) {
    notes.push(`Expired restriction (ended ${formatTime(override.expiresAt)}) — kept for history, no longer applied.`);
  }
  return { status, sourceLabel, explanation, expiresAt, notes };
}

function StatusPill({ status, testId }: { status: AccessExplanation['status']; testId?: string }) {
  if (status === 'ENABLED') return <Pill text="ENABLED" color="#065F46" background="#D1FAE5" testId={testId} />;
  if (status === 'RESTRICTED') return <Pill text="RESTRICTED" color="#92400E" background="#FEF3C7" testId={testId} />;
  return <Pill text="DISABLED" color="#991B1B" background="#FEE2E2" testId={testId} />;
}

function TierPill({ tier, planControlled }: { tier: string; planControlled: boolean }) {
  return (
    <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
      <Pill text={tier.toUpperCase()} color="#4B5563" background="#F3F4F6" />
      {planControlled && <Pill text="PLAN-CONTROLLED" color="#B45309" background="#FEF3C7" />}
    </span>
  );
}

// ─── Partner account directory + picker ─────────────────────────────────────

const PARTNER_ROLES = new Set(['seller', 'verified_seller', 'creator']);

function usePartnerDirectory() {
  const [accounts, setAccounts] = useState<UserDirectoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const directory = await authApi.getUsersDirectory();
      setAccounts(directory.filter((u) => PARTNER_ROLES.has(String(u.role))));
    } catch (e) {
      setAccounts([]);
      setError(e instanceof Error ? `Failed to load partner accounts: ${e.message}` : 'Failed to load partner accounts.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  return { accounts, loading, error, reload: load };
}

const accountName = (u: Pick<UserDirectoryEntry, 'displayName' | 'email'>) => u.displayName || u.email;
const roleLabel = (role: string) => (role === 'creator' ? 'Creator' : 'Seller');

/** Searchable Seller/Creator selector over the existing users directory. */
export function AccountPicker({
  value,
  onSelect,
  allowClear = false,
  clearLabel = 'All accounts',
  testIdPrefix = 'account-picker',
}: {
  value: string;
  onSelect: (userId: string) => void;
  allowClear?: boolean;
  clearLabel?: string;
  testIdPrefix?: string;
}) {
  const { accounts, loading, error, reload } = usePartnerDirectory();
  const [query, setQuery] = useState('');
  const selected = accounts.find((a) => a.uid === value);
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return accounts
      .filter((a) =>
        [a.displayName, a.email, a.choosifyUserId, a.uid].some((v) => String(v || '').toLowerCase().includes(q)),
      )
      .slice(0, 25);
  }, [accounts, query]);

  return (
    <div data-testid={testIdPrefix} style={{ minWidth: 0 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="search"
          data-testid={`${testIdPrefix}-search`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={loading ? 'Loading partner accounts…' : 'Search sellers & creators by name, email or CF ID'}
          disabled={loading || !!error}
          aria-label="Search seller or creator accounts"
          style={{ ...inputStyle, flex: '1 1 260px' }}
        />
        {allowClear && value && (
          <button type="button" style={smallButton} onClick={() => onSelect('')} data-testid={`${testIdPrefix}-clear`}>
            {clearLabel}
          </button>
        )}
      </div>
      {error && (
        <div role="alert" style={{ marginTop: 8, fontSize: 12, fontWeight: 700, color: '#B91C1C' }}>
          {error}{' '}
          <button type="button" style={smallButton} onClick={() => void reload()}>
            Retry
          </button>
        </div>
      )}
      {value && (
        <div data-testid={`${testIdPrefix}-selected`} style={{ ...muted, marginTop: 8 }}>
          Selected:{' '}
          <span style={{ color: '#111827', fontWeight: 800 }}>
            {selected ? `${accountName(selected)} · ${roleLabel(selected.role)}` : value}
          </span>
        </div>
      )}
      {query.trim() && !loading && !error && (
        <div style={{ marginTop: 8, border: '1px solid #E8EDF2', borderRadius: 8, maxHeight: 260, overflowY: 'auto' }}>
          {matches.length === 0 ? (
            <div style={{ ...muted, padding: '10px 12px' }}>No seller or creator matches “{query.trim()}”.</div>
          ) : (
            matches.map((a) => (
              <button
                key={a.uid}
                type="button"
                data-testid={`${testIdPrefix}-option-${a.uid}`}
                onClick={() => {
                  onSelect(a.uid);
                  setQuery('');
                }}
                style={{
                  display: 'flex',
                  width: '100%',
                  justifyContent: 'space-between',
                  gap: 10,
                  padding: '9px 12px',
                  border: 'none',
                  borderBottom: '1px solid #F1F3F5',
                  background: a.uid === value ? '#FFF7ED' : '#fff',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#111827' }}>{accountName(a)}</span>
                  <span style={{ ...muted, display: 'block' }}>
                    {a.email}
                    {a.choosifyUserId ? ` · ${a.choosifyUserId}` : ''}
                  </span>
                </span>
                <Pill text={roleLabel(a.role).toUpperCase()} color="#4B5563" background="#F3F4F6" />
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Reason / expiry dialog ─────────────────────────────────────────────────

function ReasonDialog({
  title,
  description,
  confirmLabel,
  reasonRequired,
  withExpiry,
  busy,
  error,
  onCancel,
  onConfirm,
  testId,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  reasonRequired: boolean;
  withExpiry: boolean;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (input: { reason: string; expiresAt: string | null }) => void;
  testId: string;
}) {
  const [reason, setReason] = useState('');
  const [expiry, setExpiry] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const submit = () => {
    const trimmed = reason.trim();
    if (reasonRequired && !trimmed) {
      setLocalError('A reason is required.');
      return;
    }
    let expiresAt: string | null = null;
    if (withExpiry) {
      if (!expiry) {
        setLocalError('A temporary restriction needs an expiry date and time.');
        return;
      }
      const at = new Date(expiry);
      if (Number.isNaN(at.getTime())) {
        setLocalError('Enter a valid expiry date and time.');
        return;
      }
      if (at.getTime() <= Date.now()) {
        setLocalError('The expiry must be in the future.');
        return;
      }
      expiresAt = at.toISOString();
    }
    setLocalError(null);
    onConfirm({ reason: trimmed, expiresAt });
  };

  const shownError = localError || error;
  return (
    <Modal
      isOpen
      onClose={busy ? () => undefined : onCancel}
      title={title}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" style={{ ...smallButton, height: 34, padding: '0 14px' }} onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            data-testid={`${testId}-submit`}
            onClick={submit}
            disabled={busy}
            style={{
              ...smallButton,
              height: 34,
              padding: '0 14px',
              background: '#EF3C23',
              border: '1px solid #EF3C23',
              color: '#fff',
              opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? 'Saving…' : confirmLabel}
          </button>
        </div>
      }
    >
      <div data-testid={testId}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#4B5563', marginBottom: 14 }}>{description}</div>
        {withExpiry && (
          <label style={{ display: 'block', marginBottom: 12 }}>
            <span style={{ ...muted, display: 'block', marginBottom: 4 }}>RESTRICTED UNTIL</span>
            <input
              type="datetime-local"
              data-testid={`${testId}-expiry`}
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
              style={inputStyle}
            />
          </label>
        )}
        <label style={{ display: 'block' }}>
          <span style={{ ...muted, display: 'block', marginBottom: 4 }}>
            REASON {reasonRequired ? '(REQUIRED)' : '(OPTIONAL)'}
          </span>
          <textarea
            data-testid={`${testId}-reason`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={1000}
            style={{ ...inputStyle, height: 'auto', padding: '8px 12px', resize: 'vertical' }}
          />
        </label>
        {shownError && (
          <div role="alert" data-testid={`${testId}-error`} style={{ marginTop: 10, fontSize: 12, fontWeight: 700, color: '#B91C1C' }}>
            {shownError}
          </div>
        )}
      </div>
    </Modal>
  );
}

// ─── Account effective access ───────────────────────────────────────────────

type OverrideAction = OverrideEffect | 'remove';

const ACTION_COPY: Record<OverrideAction, { title: string; verb: string; describe: (label: string) => string }> = {
  grant: {
    title: 'Grant',
    verb: 'Grant access',
    describe: (l) => `${l} will be on for this account regardless of its role default or plan (a platform switch still wins).`,
  },
  revoke: {
    title: 'Revoke',
    verb: 'Revoke access',
    describe: (l) => `${l} will be off for this account until the override is removed. Existing data is preserved.`,
  },
  restrict: {
    title: 'Temporarily restrict',
    verb: 'Restrict',
    describe: (l) => `${l} will be off for this account until the expiry below, then its normal access returns automatically.`,
  },
  remove: {
    title: 'Remove override for',
    verb: 'Remove override',
    describe: (l) => `The account override for ${l} is removed; access falls back to the plan / role default.`,
  },
};

export function AccountEntitlementsPanel({
  userId,
  canMutate,
  manageHref,
  auditHref,
  reloadKey = 0,
  onChanged,
}: {
  userId: string;
  canMutate: boolean;
  /** Read-only entry points link to the central Feature Access page for changes. */
  manageHref?: string;
  auditHref?: string;
  reloadKey?: number;
  onChanged?: () => void;
}) {
  const [summary, setSummary] = useState<AccountEntitlementSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, showNotice] = useTransientNotice();
  const [dialog, setDialog] = useState<{ featureKey: string; action: OverrideAction } | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await entitlementsAdminApi.getAccount(userId);
      setSummary({ account: res.account, overrides: res.overrides || [], entitlements: res.entitlements || [], note: res.note });
    } catch (e) {
      setSummary(null);
      setLoadError(describeEntitlementsAdminError(e, 'this account’s feature access'));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  const overridesByKey = useMemo(
    () => new Map((summary?.overrides || []).map((o) => [o.featureKey, o] as const)),
    [summary],
  );

  const runAction = async ({ reason, expiresAt }: { reason: string; expiresAt: string | null }) => {
    if (!dialog) return;
    setBusy(true);
    setDialogError(null);
    const label = featureLabel(dialog.featureKey);
    try {
      if (dialog.action === 'remove') {
        await entitlementsAdminApi.removeAccountOverride(userId, dialog.featureKey, reason);
      } else {
        await entitlementsAdminApi.setAccountOverride(userId, dialog.featureKey, {
          effect: dialog.action,
          reason,
          ...(dialog.action === 'restrict' ? { expiresAt } : {}),
        });
      }
      setDialog(null);
      showNotice(`${ACTION_COPY[dialog.action].verb}: ${label} — saved.`);
      // The server is the authority: re-read the effective state instead of patching it locally.
      await load();
      onChanged?.();
    } catch (e) {
      setDialogError(describeEntitlementsAdminError(e, 'account overrides'));
    } finally {
      setBusy(false);
    }
  };

  const columns: DataTableColumn<AccountEntitlementRow>[] = [
    {
      key: 'feature',
      header: 'Feature',
      render: (r) => (
        <div data-testid={`account-feature-${r.featureKey}`} style={{ minWidth: 150 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#111827' }}>{r.label}</div>
          <div style={{ ...muted, fontFamily: 'monospace' }}>{r.featureKey}</div>
        </div>
      ),
      sortValue: (r) => r.label,
    },
    { key: 'tier', header: 'Tier', render: (r) => <TierPill tier={r.tier} planControlled={r.planControlled} /> },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <StatusPill status={explainAccess(r, overridesByKey.get(r.featureKey)).status} testId={`account-status-${r.featureKey}`} />,
    },
    {
      key: 'source',
      header: 'Source',
      render: (r) => {
        const x = explainAccess(r, overridesByKey.get(r.featureKey));
        return (
          <div data-testid={`account-source-${r.featureKey}`} style={{ minWidth: 200, maxWidth: 360 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#111827' }}>{x.sourceLabel}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', marginTop: 2 }}>{x.explanation}</div>
            {x.notes.map((n) => (
              <div key={n} style={{ fontSize: 11, fontWeight: 700, color: '#B45309', marginTop: 4 }}>
                {n}
              </div>
            ))}
          </div>
        );
      },
    },
    {
      key: 'override',
      header: 'Account override',
      render: (r) => {
        const o = overridesByKey.get(r.featureKey);
        if (!o) return <span data-testid={`account-override-${r.featureKey}`} style={muted}>None</span>;
        return (
          <div data-testid={`account-override-${r.featureKey}`} style={{ minWidth: 180, maxWidth: 300 }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#111827' }}>{EFFECT_LABELS[o.effect]}</span>
              {o.active ? (
                <Pill text="ACTIVE" color="#065F46" background="#D1FAE5" />
              ) : (
                <Pill text="EXPIRED · INACTIVE" color="#4B5563" background="#F3F4F6" />
              )}
            </div>
            {o.expiresAt && <div style={{ ...muted, marginTop: 2 }}>Expires {formatTime(o.expiresAt)}</div>}
            <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginTop: 2 }}>Reason: {o.reason}</div>
            <div style={{ ...muted, marginTop: 2 }}>Updated {formatTime(o.updatedAt)}</div>
          </div>
        );
      },
    },
  ];
  if (canMutate) {
    columns.push({
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (r) => {
        if (!isSwitchableFeature(featureByKey(r.featureKey))) {
          return <span style={muted}>Not switchable</span>;
        }
        const o = overridesByKey.get(r.featureKey);
        const actions: OverrideAction[] = ['grant', 'revoke', 'restrict', ...(o ? (['remove'] as const) : [])];
        return (
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap', minWidth: 170 }}>
            {actions.map((a) => (
              <button
                key={a}
                type="button"
                data-testid={`override-action-${a}-${r.featureKey}`}
                style={{ ...smallButton, ...(a === 'remove' ? { color: '#B91C1C', borderColor: '#FECACA' } : {}) }}
                onClick={() => {
                  setDialogError(null);
                  setDialog({ featureKey: r.featureKey, action: a });
                }}
              >
                {a === 'restrict' ? 'Restrict' : a === 'remove' ? 'Remove' : ACTION_COPY[a].title}
              </button>
            ))}
          </div>
        );
      },
    });
  }

  if (loading && !summary) {
    return (
      <div data-testid="account-entitlements-loading" style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', padding: '24px 0' }}>
        Loading feature access…
      </div>
    );
  }
  if (loadError || !summary) {
    return <ErrorCard message={loadError || 'Feature access could not be loaded.'} onRetry={() => void load()} testId="account-entitlements-error" />;
  }

  const { account } = summary;
  return (
    <div data-testid="account-entitlements-panel">
      <SuccessNotice message={notice} />
      <div style={{ ...card, padding: '16px 24px', display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div data-testid="account-identity" style={{ fontSize: 15, fontWeight: 800, color: '#111827' }}>
            {account.displayName || account.email}
          </div>
          <div style={muted}>
            {account.email}
            {account.choosifyUserId ? ` · ${account.choosifyUserId}` : ''} · role {account.role}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          {auditHref && (
            <Link to={auditHref} data-testid="account-audit-link" style={{ color: '#EF3C23', fontWeight: 800, fontSize: 12 }}>
              Audit history →
            </Link>
          )}
          {manageHref && (
            <Link to={manageHref} data-testid="account-manage-link" style={{ color: '#EF3C23', fontWeight: 800, fontSize: 12 }}>
              Manage in Feature Access →
            </Link>
          )}
        </div>
      </div>
      {summary.note ? (
        <div data-testid="account-not-partner" style={{ ...card, padding: '18px 24px', fontSize: 13, fontWeight: 700, color: '#374151' }}>
          {summary.note}
        </div>
      ) : (
        <div style={card}>
          <div style={cardHeader}>Effective feature access · {roleLabel(account.partnerRole || 'seller')}</div>
          <div style={{ overflowX: 'auto' }}>
            <DataTable
              columns={columns}
              rows={summary.entitlements}
              getRowId={(r) => r.featureKey}
              showRowNumbers={false}
              emptyMessage="No partner features apply to this account."
            />
          </div>
        </div>
      )}
      {dialog && (
        <ReasonDialog
          key={`${dialog.featureKey}:${dialog.action}`}
          testId="override-dialog"
          title={`${ACTION_COPY[dialog.action].title} ${featureLabel(dialog.featureKey)}`}
          description={ACTION_COPY[dialog.action].describe(featureLabel(dialog.featureKey))}
          confirmLabel={ACTION_COPY[dialog.action].verb}
          reasonRequired
          withExpiry={dialog.action === 'restrict'}
          busy={busy}
          error={dialogError}
          onCancel={() => setDialog(null)}
          onConfirm={(input) => void runAction(input)}
        />
      )}
    </div>
  );
}

// ─── Platform switches ──────────────────────────────────────────────────────

export function PlatformControlsPanel({ canMutate, onChanged }: { canMutate: boolean; onChanged?: () => void }) {
  const [states, setStates] = useState<PlatformFeatureState[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, showNotice] = useTransientNotice();
  const [dialog, setDialog] = useState<PlatformFeatureState | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await entitlementsAdminApi.listPlatformStates();
      // The API lists switchable features only; the registry check is defence in depth.
      setStates((res.states || []).filter((s) => isSwitchableFeature(featureByKey(s.featureKey))));
    } catch (e) {
      setStates(null);
      setLoadError(describeEntitlementsAdminError(e, 'platform feature controls'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const apply = async ({ reason }: { reason: string }) => {
    if (!dialog) return;
    const enabling = !dialog.enabled;
    setBusy(true);
    setDialogError(null);
    try {
      await entitlementsAdminApi.setPlatformState(dialog.featureKey, { enabled: enabling, reason: reason || null });
      setDialog(null);
      showNotice(`${dialog.label} ${enabling ? 'enabled' : 'disabled'} platform-wide — data preserved.`);
      await load();
      onChanged?.();
    } catch (e) {
      setDialogError(describeEntitlementsAdminError(e, 'platform feature controls'));
    } finally {
      setBusy(false);
    }
  };

  const columns: DataTableColumn<PlatformFeatureState>[] = [
    {
      key: 'feature',
      header: 'Feature',
      render: (s) => (
        <div data-testid={`platform-row-${s.featureKey}`} style={{ minWidth: 150 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#111827' }}>{s.label}</div>
          <div style={{ ...muted, fontFamily: 'monospace' }}>{s.featureKey}</div>
        </div>
      ),
      sortValue: (s) => s.label,
    },
    { key: 'tier', header: 'Tier', render: (s) => <TierPill tier={s.tier} planControlled={s.planControlled} /> },
    { key: 'roles', header: 'Applies to', render: (s) => <span style={{ fontSize: 12, fontWeight: 700 }}>{s.roles.map(roleLabel).join(', ')}</span> },
    {
      key: 'state',
      header: 'Platform state',
      render: (s) => (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {s.enabled ? (
            <Pill text="ON" color="#065F46" background="#D1FAE5" testId={`platform-state-${s.featureKey}`} />
          ) : (
            <Pill text="OFF" color="#991B1B" background="#FEE2E2" testId={`platform-state-${s.featureKey}`} />
          )}
          {!s.explicit && <span style={muted}>default</span>}
        </div>
      ),
    },
    {
      key: 'reason',
      header: 'Reason / last change',
      render: (s) =>
        s.explicit ? (
          <div style={{ maxWidth: 280 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>{s.reason || '—'}</div>
            <div style={muted}>{formatTime(s.updatedAt)}</div>
          </div>
        ) : (
          <span style={muted}>Never changed</span>
        ),
    },
  ];
  if (canMutate) {
    columns.push({
      key: 'action',
      header: 'Action',
      align: 'right',
      render: (s) => (
        <button
          type="button"
          data-testid={`platform-action-${s.featureKey}`}
          style={{ ...smallButton, ...(s.enabled ? { color: '#B91C1C', borderColor: '#FECACA' } : {}) }}
          onClick={() => {
            setDialogError(null);
            setDialog(s);
          }}
        >
          {s.enabled ? 'Disable' : 'Enable'}
        </button>
      ),
    });
  }

  if (loading && !states) {
    return <div style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', padding: '24px 0' }}>Loading platform controls…</div>;
  }
  if (loadError || !states) {
    return <ErrorCard message={loadError || 'Platform controls could not be loaded.'} onRetry={() => void load()} testId="platform-controls-error" />;
  }

  return (
    <div data-testid="platform-controls-panel">
      <SuccessNotice message={notice} />
      <div data-testid="platform-note" style={{ ...card, padding: '14px 24px', fontSize: 12, fontWeight: 600, color: '#4B5563' }}>
        A platform switch turns a feature off for every Seller and Creator at once and takes precedence over role defaults,
        plans and account overrides. Core, deprecated and reserved features are not platform switches and are not listed.
      </div>
      <div style={card}>
        <div style={cardHeader}>Platform feature switches</div>
        <div style={{ overflowX: 'auto' }}>
          <DataTable columns={columns} rows={states} getRowId={(s) => s.featureKey} showRowNumbers={false} emptyMessage="No switchable features." />
        </div>
      </div>
      {dialog && (
        <ReasonDialog
          key={dialog.featureKey}
          testId="platform-dialog"
          title={`${dialog.enabled ? 'Disable' : 'Enable'} ${dialog.label} platform-wide`}
          description={
            dialog.enabled
              ? `${dialog.label} will be turned off for every partner, overriding account grants. Existing data is preserved.`
              : `${dialog.label} returns to normal: role defaults, plans and account overrides apply again.`
          }
          confirmLabel={dialog.enabled ? 'Disable' : 'Enable'}
          reasonRequired={dialog.enabled}
          withExpiry={false}
          busy={busy}
          error={dialogError}
          onCancel={() => setDialog(null)}
          onConfirm={(input) => void apply(input)}
        />
      )}
    </div>
  );
}

// ─── Audit history (read-only) ──────────────────────────────────────────────

const AUDIT_ACTION_LABELS: Record<string, string> = {
  'account_override.set': 'Account override set',
  'account_override.removed': 'Account override removed',
  'platform_state.set': 'Platform switch changed',
  'role_default.set': 'Role default changed',
};

function personLabel(p: AuditPerson | null) {
  if (!p) return '—';
  return p.displayName || p.email || p.userId;
}

/** Audit state snapshots are small JSON objects written by the server; render them as text. */
function formatAuditState(state: unknown): string {
  if (state === null || state === undefined) return '—';
  if (typeof state !== 'object') return String(state);
  const s = state as Record<string, unknown>;
  if (typeof s.effect === 'string') {
    const effect = EFFECT_LABELS[s.effect as OverrideEffect] || s.effect;
    return s.expiresAt ? `${effect} until ${formatTime(String(s.expiresAt))}` : effect;
  }
  if (typeof s.enabled === 'boolean') return s.enabled ? 'On' : 'Off';
  return JSON.stringify(state);
}

function auditTarget(e: EntitlementAuditEvent) {
  if (e.targetScope === 'platform') return 'Platform (all partners)';
  if (e.targetScope === 'role') return `Role default · ${e.targetRole || '—'}`;
  return personLabel(e.target);
}

export function EntitlementAuditPanel({ initialUserId = '', pageSize = 20 }: { initialUserId?: string; pageSize?: number }) {
  const [userId, setUserId] = useState(initialUserId);
  const [featureKey, setFeatureKey] = useState('');
  const [events, setEvents] = useState<EntitlementAuditEvent[]>([]);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => setUserId(initialUserId), [initialUserId]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const page = await entitlementsAdminApi.listAudit({ userId: userId || undefined, featureKey: featureKey || undefined, limit: pageSize });
      setEvents(page.events || []);
      setNextBefore(page.nextBefore);
    } catch (e) {
      setEvents([]);
      setNextBefore(null);
      setLoadError(describeEntitlementsAdminError(e, 'entitlement audit history'));
    } finally {
      setLoading(false);
    }
  }, [userId, featureKey, pageSize]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadMore = async () => {
    if (!nextBefore) return;
    setLoadingMore(true);
    try {
      const page = await entitlementsAdminApi.listAudit({
        userId: userId || undefined,
        featureKey: featureKey || undefined,
        before: nextBefore,
        limit: pageSize,
      });
      setEvents((prev) => [...prev, ...(page.events || [])]);
      setNextBefore(page.nextBefore);
    } catch (e) {
      setLoadError(describeEntitlementsAdminError(e, 'entitlement audit history'));
    } finally {
      setLoadingMore(false);
    }
  };

  const columns: DataTableColumn<EntitlementAuditEvent>[] = [
    {
      key: 'time',
      header: 'Time',
      render: (e) => (
        <span data-testid="audit-event" data-event-id={e.id} data-created-at={e.createdAt} style={{ fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
          {formatTime(e.createdAt)}
        </span>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      render: (e) => <span style={{ fontSize: 12, fontWeight: 800, color: '#111827' }}>{AUDIT_ACTION_LABELS[e.action] || e.action}</span>,
    },
    {
      key: 'actor',
      header: 'Actor',
      render: (e) => (
        <div data-testid="audit-actor" style={{ minWidth: 120 }}>
          <div style={{ fontSize: 12, fontWeight: 700 }}>{e.actor ? personLabel(e.actor) : e.source === 'system' ? 'System' : '—'}</div>
          {e.realActor && e.realActor.userId !== e.actor?.userId && (
            <div style={muted}>via {personLabel(e.realActor)} (real actor)</div>
          )}
        </div>
      ),
    },
    { key: 'target', header: 'Target', render: (e) => <span data-testid="audit-target" style={{ fontSize: 12, fontWeight: 700 }}>{auditTarget(e)}</span> },
    { key: 'feature', header: 'Feature', render: (e) => <span data-testid="audit-feature" style={{ fontSize: 12, fontWeight: 700 }}>{featureLabel(e.featureKey)}</span> },
    { key: 'previous', header: 'Previous', render: (e) => <span data-testid="audit-previous" style={{ fontSize: 12 }}>{formatAuditState(e.previousState)}</span> },
    { key: 'new', header: 'New', render: (e) => <span data-testid="audit-new" style={{ fontSize: 12 }}>{formatAuditState(e.newState)}</span> },
    {
      key: 'reason',
      header: 'Reason',
      render: (e) => <span data-testid="audit-reason" style={{ fontSize: 12, display: 'block', maxWidth: 260 }}>{e.reason || '—'}</span>,
    },
  ];

  return (
    <div data-testid="entitlement-audit-panel">
      <div style={{ ...card, padding: '16px 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
        <div>
          <div style={{ ...muted, marginBottom: 6 }}>ACCOUNT</div>
          <AccountPicker value={userId} onSelect={setUserId} allowClear testIdPrefix="audit-account" />
        </div>
        <label style={{ display: 'block' }}>
          <span style={{ ...muted, display: 'block', marginBottom: 6 }}>FEATURE</span>
          <select data-testid="audit-feature-filter" value={featureKey} onChange={(e) => setFeatureKey(e.target.value)} style={inputStyle}>
            <option value="">All features</option>
            {PARTNER_FEATURES.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
                {f.deprecated ? ' (deprecated)' : ''}
              </option>
            ))}
          </select>
        </label>
      </div>
      {loadError ? (
        <ErrorCard message={loadError} onRetry={() => void load()} testId="audit-error" />
      ) : (
        <div style={card}>
          <div style={cardHeader}>Entitlement audit history · newest first · read-only</div>
          <div style={{ overflowX: 'auto' }}>
            <DataTable
              columns={columns}
              rows={events}
              getRowId={(e) => e.id}
              showRowNumbers={false}
              isLoading={loading}
              loadingMessage="Loading audit history…"
              emptyMessage="No entitlement changes match these filters."
            />
          </div>
          {!loading && nextBefore && (
            <div style={{ padding: '12px 24px', borderTop: '1px solid #F1F3F5', textAlign: 'center' }}>
              <button type="button" data-testid="audit-load-more" style={{ ...smallButton, height: 32, padding: '0 16px' }} onClick={() => void loadMore()} disabled={loadingMore}>
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
