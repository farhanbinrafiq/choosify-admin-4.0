import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, LogIn, ShieldAlert, UserCog, FileCheck2, ShieldCheck } from 'lucide-react';
import { operationsApi, type AccountActivityEntry } from '../../../services/operationsApi';

/**
 * Activity Log on the Seller / Creator profile — the account's own trail:
 * sign-ins (device, IP, location when the edge proxy provides it), security
 * changes, account changes, verification steps and every Choosify staff action
 * on the account. `userId="me"` is the owner's own view; staff passing a
 * user id additionally see who on staff acted, from where, and internal notes.
 */

const FILTERS: Array<{ key: string; label: string }> = [
  { key: '', label: 'All' },
  { key: 'sign_in', label: 'Sign-ins' },
  { key: 'security', label: 'Security' },
  { key: 'account', label: 'Account changes' },
  { key: 'verification', label: 'Verification' },
  { key: 'admin', label: 'Choosify staff actions' },
];

const ICON: Record<string, React.ReactNode> = {
  sign_in: <LogIn size={14} />,
  security: <ShieldAlert size={14} />,
  account: <UserCog size={14} />,
  verification: <FileCheck2 size={14} />,
  admin: <ShieldCheck size={14} />,
};

const chip = (active: boolean): React.CSSProperties => ({
  border: `1px solid ${active ? 'var(--cms-accent)' : '#E8EDF2'}`,
  background: active ? 'color-mix(in srgb, var(--cms-accent) 10%, transparent)' : '#fff',
  color: active ? 'var(--cms-accent)' : '#4B5563',
  borderRadius: 999,
  padding: '4px 10px',
  fontSize: 11,
  fontWeight: 800,
  cursor: 'pointer',
});

export function AccountActivityPanel({ userId, ownerLabel }: { userId: string; ownerLabel: string }) {
  const [rows, setRows] = useState<AccountActivityEntry[]>([]);
  const [staffView, setStaffView] = useState(false);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const d = await operationsApi.listAccountActivity(userId);
      setRows(d.rows);
      setStaffView(d.staffView);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the activity log.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const shown = useMemo(() => rows.filter((r) => !filter || r.category === filter), [rows, filter]);
  const lastSignIn = rows.find((r) => r.type === 'sign_in' && r.actor === 'self');
  const failed = rows.filter((r) => r.type === 'sign_in_failed').length;

  return (
    <div style={{ background: '#fff', border: '1px solid #E8EDF2', borderRadius: 8, padding: 16 }} data-testid="account-activity">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 800 }}>ACTIVITY LOG</div>
          <div style={{ fontSize: 10.5, color: '#9CA3AF', fontWeight: 600, marginTop: 2 }}>
            Sign-ins, security and account changes, verification steps and Choosify staff actions on {ownerLabel}. Newest first, last 300.
          </div>
        </div>
        <button type="button" onClick={() => void load()} style={{ ...chip(false), padding: '5px 10px' }}>Refresh</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, margin: '12px 0' }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 800, color: '#9CA3AF' }}>LAST SIGN-IN</div>
          <div style={{ fontSize: 12, fontWeight: 800, marginTop: 3 }}>{lastSignIn ? new Date(lastSignIn.at).toLocaleString() : '—'}</div>
          {lastSignIn ? <div style={{ fontSize: 10.5, color: '#6B7280', fontWeight: 600 }}>{[lastSignIn.device, lastSignIn.location].filter(Boolean).join(' · ') || '—'}</div> : null}
        </div>
        <div>
          <div style={{ fontSize: 9, fontWeight: 800, color: '#9CA3AF' }}>FAILED SIGN-INS (IN LOG)</div>
          <div style={{ fontSize: 12, fontWeight: 800, marginTop: 3, color: failed ? '#B91C1C' : '#111827' }}>{failed}</div>
        </div>
        <div>
          <div style={{ fontSize: 9, fontWeight: 800, color: '#9CA3AF' }}>STAFF ACTIONS (IN LOG)</div>
          <div style={{ fontSize: 12, fontWeight: 800, marginTop: 3 }}>{rows.filter((r) => r.actor === 'staff').length}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }} role="tablist" aria-label="Filter activity">
        {FILTERS.map((f) => (
          <button key={f.key || 'all'} type="button" style={chip(filter === f.key)} onClick={() => setFilter(f.key)} aria-pressed={filter === f.key}>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: 20, textAlign: 'center' }}><Loader2 size={16} className="animate-spin" /></div>
      ) : error ? (
        <div role="alert" style={{ color: '#B91C1C', fontSize: 12, fontWeight: 700 }}>{error}</div>
      ) : shown.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#9CA3AF', fontSize: 12, fontWeight: 600, fontStyle: 'italic', padding: '18px 0' }}>No activity recorded yet.</div>
      ) : (
        <div>
          {shown.map((r) => (
            <div key={r.id} style={{ display: 'flex', gap: 10, padding: '10px 0', borderTop: '1px solid #F1F3F5' }} data-testid="activity-row">
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: !r.success ? '#FEE2E2' : r.actor === 'staff' ? '#EEF2FF' : '#F1F5F9',
                  color: !r.success ? '#B91C1C' : r.actor === 'staff' ? '#3730A3' : '#475569',
                }}
              >
                {ICON[r.category] || <UserCog size={14} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: r.success ? '#111827' : '#B91C1C', overflowWrap: 'anywhere' }}>{r.summary}</span>
                  <span style={{ fontSize: 10.5, color: '#9CA3AF', fontWeight: 600, whiteSpace: 'nowrap' }}>{new Date(r.at).toLocaleString()}</span>
                </div>
                <div style={{ fontSize: 10.5, color: '#6B7280', fontWeight: 600, marginTop: 2, overflowWrap: 'anywhere' }}>
                  {r.actor === 'staff' ? (
                    staffView ? (
                      <>
                        <b style={{ color: '#3730A3' }}>Staff: {r.staffActorName || r.staffActorId || 'unknown'}{r.staffActorRole ? ` (${r.staffActorRole.replace(/_/g, ' ')})` : ''}</b>
                        {[r.staffDevice, r.staffIp && `IP ${r.staffIp}`].filter(Boolean).length ? ` · ${[r.staffDevice, r.staffIp && `IP ${r.staffIp}`].filter(Boolean).join(' · ')}` : ''}
                      </>
                    ) : (
                      <b style={{ color: '#3730A3' }}>By Choosify staff</b>
                    )
                  ) : r.actor === 'system' ? (
                    'Choosify system'
                  ) : (
                    [r.device, r.ip && `IP ${r.ip}`, r.location || (r.ip ? 'Location unavailable' : '')].filter(Boolean).join(' · ') || '—'
                  )}
                </div>
                {staffView && r.staffNote ? <div style={{ fontSize: 10.5, color: '#4B5563', fontWeight: 600, marginTop: 2 }}>Internal: {r.staffNote}</div> : null}
              </div>
            </div>
          ))}
        </div>
      )}
      <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600, marginTop: 10 }}>
        Location comes from the network edge (country / city) when available; it is approximate and may be missing.
      </div>
    </div>
  );
}
