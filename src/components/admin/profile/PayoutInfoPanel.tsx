import React, { useCallback, useEffect, useState } from 'react';
import { BellRing, Landmark, Loader2, Smartphone } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { operationsApi, type PayoutChannel, type PayoutReminder } from '../../../services/operationsApi';

/**
 * Payment Info on the Super Admin Seller / Creator profile — the owner's REAL
 * payout channels (server-side payout profile: bank account and/or bKash /
 * Nagad / Rocket), view-only. Support agents see masked numbers. With no
 * channel on file, staff can send the owner a reminder (recorded, max one per
 * 24 hours).
 */
const panel: React.CSSProperties = { background: '#fff', border: '1px solid #E8EDF2', borderRadius: 8, padding: 16 };
const btn: React.CSSProperties = { background: '#fff', border: '1px solid #E8EDF2', borderRadius: 7, padding: '7px 12px', fontSize: 11.5, fontWeight: 800, cursor: 'pointer', color: '#374151', display: 'inline-flex', alignItems: 'center', gap: 6 };
const STAFF = ['super_admin', 'admin', 'finance_manager', 'support_agent'];

export function PayoutInfoPanel({ userId, ownerLabel }: { userId: string; ownerLabel: 'seller' | 'creator' }) {
  const { profile } = useAuth();
  const canRemind = STAFF.includes(String(profile?.role || ''));
  const [channels, setChannels] = useState<PayoutChannel[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [masked, setMasked] = useState(false);
  const [reminders, setReminders] = useState<PayoutReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const d = await operationsApi.getUserPayoutProfile(userId);
      setChannels(d.channels);
      setUpdatedAt(d.updatedAt);
      setMasked(d.masked);
      setReminders(d.reminders || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load payout details.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const remind = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await operationsApi.sendPayoutReminder(userId);
      setNotice(`Reminder sent — the ${ownerLabel} was notified to add a payout method.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the reminder.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={panel} data-testid="profile-payment">
      <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 2 }}>PAYMENT INFO</div>
      <div style={{ fontSize: 10.5, color: '#9CA3AF', fontWeight: 600, marginBottom: 12 }}>
        How this {ownerLabel} gets paid — bank account and mobile wallets (MFS). View only; the {ownerLabel} manages it in Payouts → Payment Info.
        {masked ? ' Account numbers are masked for your role.' : ''}
      </div>
      {loading ? (
        <div style={{ padding: 20, textAlign: 'center' }}><Loader2 size={16} className="animate-spin" /></div>
      ) : channels.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {channels.map((c, i) => (
            <div key={`${c.provider}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: '#F8FAFC', borderRadius: 8, flexWrap: 'wrap' }} data-testid="payout-channel">
              <div style={{ width: 36, height: 36, borderRadius: 8, background: '#fff', border: '1px solid #E8EDF2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563EB' }}>
                {c.kind === 'bank' ? <Landmark size={16} /> : <Smartphone size={16} />}
              </div>
              <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 800 }}>
                  {c.provider} <span style={{ fontSize: 9, fontWeight: 800, color: '#64748B', textTransform: 'uppercase', marginLeft: 4 }}>{c.kind === 'bank' ? 'Bank account' : 'MFS wallet'}</span>
                </div>
                <div style={{ fontSize: 11.5, fontWeight: 700, fontFamily: 'monospace', marginTop: 2 }}>{c.number}</div>
                <div style={{ fontSize: 10.5, color: '#6B7280', fontWeight: 600 }}>
                  {c.accountName || '—'}
                  {c.extra ? ` · ${c.extra}` : ''}
                </div>
              </div>
            </div>
          ))}
          {updatedAt ? <div style={{ fontSize: 10.5, color: '#9CA3AF', fontWeight: 600 }}>Last updated {new Date(updatedAt).toLocaleString()}</div> : null}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '14px 0' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#6B7280' }} data-testid="payout-empty">No payment method is added.</div>
          {canRemind ? (
            <button type="button" style={{ ...btn, marginTop: 10 }} disabled={busy} onClick={() => void remind()} data-testid="payout-remind">
              {busy ? <Loader2 size={12} className="animate-spin" /> : <BellRing size={12} />} Send reminder to {ownerLabel}
            </button>
          ) : null}
        </div>
      )}
      {notice ? <div role="status" style={{ fontSize: 11, color: '#166534', fontWeight: 700, marginTop: 10 }}>{notice}</div> : null}
      {error ? <div role="alert" style={{ fontSize: 11, color: '#B91C1C', fontWeight: 700, marginTop: 10 }}>{error}</div> : null}
      {reminders.length ? (
        <div style={{ marginTop: 12, borderTop: '1px solid #F1F3F5', paddingTop: 10 }} data-testid="payout-reminders">
          <div style={{ fontSize: 10, fontWeight: 800, color: '#9CA3AF', marginBottom: 4 }}>REMINDERS SENT</div>
          {reminders.slice(0, 6).map((r) => (
            <div key={r.id} style={{ fontSize: 11, fontWeight: 600, color: '#4B5563' }}>
              {new Date(r.at).toLocaleString()} · by {r.actorName || r.actorId}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
