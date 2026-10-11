import React, { useEffect, useState } from 'react';
import { catalogApi, type ViewersReport } from '../../services/catalogApi';

const SOURCE_LABEL: Record<string, string> = {
  choosify: 'Inside Choosify',
  direct: 'Direct / link',
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  google: 'Google',
  search: 'Other search',
  whatsapp: 'WhatsApp',
  other: 'Other sites',
};

function when(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/**
 * "Who viewed" — for the item's seller and Super Admins (the server enforces
 * it). Signed-in shoppers by name + Choosify ID; guests counted, never named.
 */
export function ViewersPanel({
  kind,
  id,
  title,
  onClose,
}: {
  kind: 'product' | 'brand';
  id: string;
  title: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<ViewersReport | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    catalogApi
      .getViewers(kind, id)
      .then((r) => !cancelled && setData(r))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : 'Could not load viewers.'));
    return () => {
      cancelled = true;
    };
  }, [kind, id]);

  const sources = data ? Object.entries(data.bySource).sort((a, b) => b[1] - a[1]) : [];
  const devices = data ? Object.entries(data.byDevice).sort((a, b) => b[1] - a[1]) : [];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Who viewed ${title}`}
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(17,24,39,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 14, width: 'min(560px, 100%)', maxHeight: '85vh', overflow: 'auto', padding: 22, boxShadow: '0 20px 50px rgba(0,0,0,0.2)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#9AA0AC', letterSpacing: '0.06em' }}>WHO VIEWED</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#1A1A2E' }}>{title}</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ border: 0, background: '#F4F7F9', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: 16 }}>
            ×
          </button>
        </div>

        {error ? <p style={{ color: '#DC2626', fontSize: 13 }}>{error}</p> : null}
        {!data && !error ? <p style={{ color: '#9AA0AC', fontSize: 13 }}>Loading…</p> : null}

        {data ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
              {[
                ['Total views', data.totalViews],
                ['Signed-in viewers', data.viewers.length],
                ['Guest visits', data.guestVisits],
              ].map(([label, n]) => (
                <div key={String(label)} style={{ background: '#F4F7F9', borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#1A1A2E' }}>{Number(n).toLocaleString()}</div>
                  <div style={{ fontSize: 11, color: '#6B7280' }}>{label}</div>
                </div>
              ))}
            </div>

            {sources.length ? (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#9AA0AC', marginBottom: 6 }}>WHERE VISITORS CAME FROM</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {sources.map(([s, n]) => (
                    <span key={s} style={{ fontSize: 12, background: '#FFF1E8', color: '#9A3412', borderRadius: 999, padding: '3px 10px', fontWeight: 600 }}>
                      {SOURCE_LABEL[s] || s} · {n}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {devices.length ? (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#9AA0AC', marginBottom: 6 }}>DEVICES</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {devices.map(([d, n]) => (
                    <span key={d} style={{ fontSize: 12, background: '#EEF0FF', color: '#2323FF', borderRadius: 999, padding: '3px 10px', fontWeight: 600, textTransform: 'capitalize' }}>
                      {d} · {n}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            <div style={{ fontSize: 11, fontWeight: 800, color: '#9AA0AC', marginBottom: 6 }}>SIGNED-IN VIEWERS</div>
            {data.viewers.length === 0 ? (
              <p style={{ fontSize: 13, color: '#9AA0AC', margin: 0 }}>
                No signed-in shoppers have viewed this yet{data.guestVisits ? ` — ${data.guestVisits} guest visit${data.guestVisits === 1 ? '' : 's'} so far` : ''}.
              </p>
            ) : (
              <div style={{ border: '1px solid #E8EDF2', borderRadius: 10, overflow: 'hidden' }}>
                {data.viewers.map((v, i) => (
                  <div
                    key={`${v.choosifyUserId || v.name}-${i}`}
                    style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 12px', borderTop: i ? '1px solid #F1F1F3' : 0, fontSize: 13 }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, color: '#1A1A2E' }}>{v.name}</div>
                      <div style={{ fontSize: 11, color: '#9AA0AC' }}>{v.choosifyUserId || '—'}</div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: 11, color: '#6B7280' }}>
                      <div>{v.visits} day{v.visits === 1 ? '' : 's'} viewed</div>
                      <div>Last: {when(v.lastViewedAt)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p style={{ fontSize: 11, color: '#9AA0AC', marginTop: 12, marginBottom: 0 }}>
              Visible only to this seller and Super Admins. Names and Choosify IDs only — no contact details. Covers the most recent {data.loggedVisits.toLocaleString()} counted visits.
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
}
