/**
 * Shared analytics building blocks in the Inventory Management style: number cards with a
 * coloured left edge, and titled detail panels. Inline styles so the admin theme can't recolour them.
 */
import React from 'react';

export const KPI_COLORS = { blue: '#3B82F6', green: '#16A34A', amber: '#F59E0B', red: '#DC2626', orange: '#EF3C23', purple: '#7C3AED' } as const;

export type Kpi = { label: string; value: React.ReactNode; sub?: React.ReactNode; color: string; testId?: string };

export function KpiStrip({ items }: { items: Kpi[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14 }} data-testid="kpi-strip">
      {items.map((k) => (
        <div
          key={k.label}
          data-testid={k.testId}
          style={{ background: '#fff', border: '1px solid #E8EDF2', borderLeft: `4px solid ${k.color}`, borderRadius: 16, padding: 16, minWidth: 0 }}
        >
          <div style={{ fontSize: 26, fontWeight: 800, color: '#111827', lineHeight: 1.1 }}>{k.value}</div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 6 }}>{k.label}</div>
          {k.sub ? <div style={{ fontSize: 10.5, fontWeight: 600, color: '#EF3C23', marginTop: 6 }}>{k.sub}</div> : null}
        </div>
      ))}
    </div>
  );
}

export function InsightGrid({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>{children}</div>;
}

export function InsightPanel({ title, children, testId }: { title: string; children: React.ReactNode; testId?: string }) {
  return (
    <div data-testid={testId} style={{ background: '#FAFCFF', border: '1px solid #E8EDF2', borderRadius: 16, padding: '16px 18px', minWidth: 0 }}>
      <div style={{ fontSize: 11.5, fontWeight: 800, color: '#EF3C23', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}

export const Empty = ({ children }: { children: React.ReactNode }) => <div style={{ fontSize: 12.5, color: '#9CA3AF', lineHeight: 1.5 }}>{children}</div>;

/** "label …… value" rows. */
export function RankList({ rows, empty }: { rows: Array<{ key: string; label: React.ReactNode; value: React.ReactNode }>; empty: string }) {
  if (!rows.length) return <Empty>{empty}</Empty>;
  return (
    <div>
      {rows.map((r) => (
        <div key={r.key} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, borderTop: '1px solid #EEF2F6', padding: '6px 0', fontSize: 12.5 }}>
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#374151' }}>{r.label}</span>
          <b style={{ flexShrink: 0, color: '#111827' }}>{r.value}</b>
        </div>
      ))}
    </div>
  );
}

/** Tiny bar chart for a day series (one or two values per day). */
export function DayBars({ series, empty }: { series: Array<{ date: string; a: number; b?: number }>; empty: string }) {
  if (!series.length || series.every((d) => !d.a && !d.b)) return <Empty>{empty}</Empty>;
  const max = Math.max(1, ...series.map((d) => d.a));
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 90 }} data-testid="day-bars">
        {series.map((d) => (
          <div key={d.date} title={`${d.date}: ${d.a}${d.b !== undefined ? ` · ${d.b}` : ''}`} style={{ flex: 1, position: 'relative', height: '100%', display: 'flex', alignItems: 'flex-end' }}>
            <div style={{ width: '100%', height: `${Math.max(2, (d.a / max) * 86)}px`, background: '#F96500', opacity: d.a ? 1 : 0.18, borderRadius: '2px 2px 0 0' }} />
            {d.b ? <div style={{ position: 'absolute', bottom: 0, left: '25%', width: '50%', height: `${Math.max(2, (d.b / max) * 86)}px`, background: '#1A1D4E', borderRadius: '2px 2px 0 0' }} /> : null}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#9CA3AF', marginTop: 4 }}>
        <span>{series[0]?.date}</span>
        <span>{series[series.length - 1]?.date}</span>
      </div>
    </div>
  );
}

export const fmt = (v: number) => v.toLocaleString('en-US');
export const pct = (num: number, den: number) => (den > 0 ? `${((num / den) * 100).toFixed(1)}%` : '—');
