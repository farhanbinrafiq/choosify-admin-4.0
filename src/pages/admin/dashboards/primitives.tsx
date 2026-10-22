import React from 'react';
import { Link } from 'react-router-dom';
import {
  AreaChart,
  Area,
  ComposedChart,
  Line,
  Legend,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { ArrowUpRight, ChevronRight } from 'lucide-react';

/**
 * Shared visual primitives for the role-specific home dashboards
 * (AdminHomeDashboard / SellerHomeDashboard / CreatorHomeDashboard).
 *
 * Presentation language is taken from design-reference/Choosify Admin CMS
 * (standalone).html + public/cms-mirror/app.html: dark-glass KPI tiles on an
 * orange→navy gradient panel, white operational cards, Outfit numerals, compact
 * action rows, 2fr/1fr main+attention layout. These are dumb components — every
 * value/number/link is supplied by the caller from a canonical source.
 */

export type RangeKey = '7d' | '30d' | '90d';
export const RANGE_LABEL: Record<RangeKey, string> = {
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
};

/** localhost storefront origin — mirrors the convention already used by CreatorEditStudio. */
export const WEB_ORIGIN = 'http://localhost:5173';

export function DashShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="min-w-0">
          <h1
            className="text-[26px] sm:text-[30px] font-extrabold tracking-tight leading-tight text-[#000435] m-0"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            {title}
          </h1>
          {subtitle ? <p className="text-[#64748B] text-[15px] mt-1.5 mb-0">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}

export function RangeToggle({
  value,
  onChange,
}: {
  value: RangeKey;
  onChange: (r: RangeKey) => void;
}) {
  return (
    <div className="flex bg-white p-1 rounded-xl border border-[#E2E8F0] shadow-[0_1px_2px_rgba(15,23,42,0.04)]" role="group" aria-label="Date range">
      {(['7d', '30d', '90d'] as RangeKey[]).map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => onChange(t)}
          aria-pressed={value === t}
          className={`px-4 py-2 text-[12px] font-bold rounded-lg transition-all ${
            value === t
              ? 'bg-[#F96500] text-white shadow-sm'
              : 'text-[#000435] hover:bg-[#F8FAFC]'
          }`}
        >
          {t.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

/**
 * KPI card row — a plain responsive grid; the cards sit directly on the page
 * (4 columns wide desktop, 2 on tablet, 1–2 on mobile). `branded` is kept for
 * API compatibility and no longer changes the surface.
 */
export function KpiPanel({
  cols = 4,
  children,
}: {
  cols?: 2 | 3 | 4;
  branded?: boolean;
  children: React.ReactNode;
}) {
  const grid =
    cols === 2 ? 'sm:grid-cols-2' : cols === 3 ? 'sm:grid-cols-2 xl:grid-cols-3' : 'sm:grid-cols-2 xl:grid-cols-4';
  return <div className={`grid grid-cols-1 ${grid} gap-4 lg:gap-5`}>{children}</div>;
}

export type KpiTone = 'orange' | 'blue' | 'green' | 'purple' | 'neutral';
const KPI_TONES: Record<KpiTone, { card: string; chip: string; icon: string }> = {
  orange: { card: 'bg-[#FFF7F2] border-[#FDE3D1]', chip: 'bg-[#FFE4D1]', icon: 'text-[#F96500]' },
  blue: { card: 'bg-white border-[#E2E8F0]', chip: 'bg-[#E8F0FE]', icon: 'text-[#3B82F6]' },
  green: { card: 'bg-white border-[#E2E8F0]', chip: 'bg-[#E7F6EC]', icon: 'text-[#16A34A]' },
  purple: { card: 'bg-white border-[#E2E8F0]', chip: 'bg-[#EFEAFE]', icon: 'text-[#7C3AED]' },
  neutral: { card: 'bg-white border-[#E2E8F0]', chip: 'bg-[#F1F5F9]', icon: 'text-[#64748B]' },
};

/** KPI card. `to` makes the whole card a router link; `icon` / `tone` are optional. */
export function KpiTile({
  label,
  value,
  sub,
  to,
  icon: Icon,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  sub?: string;
  to?: string;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: KpiTone;
}) {
  const t = KPI_TONES[tone];
  const body = (
    <div
      className={`group h-full rounded-2xl border p-5 flex items-start gap-4 shadow-[0_1px_3px_rgba(15,23,42,0.05)] transition-all ${t.card} ${to ? 'hover:shadow-[0_6px_18px_rgba(15,23,42,0.08)] hover:-translate-y-px' : ''}`}
    >
      {Icon ? (
        <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${t.chip}`}>
          <Icon className={`w-5 h-5 ${t.icon}`} />
        </div>
      ) : null}
      <div className="min-w-0 flex-1">
        <div className="text-[11.5px] uppercase tracking-[0.08em] font-bold text-[#475569] mb-2">{label}</div>
        <div
          className="text-[28px] sm:text-[30px] font-extrabold tracking-tight leading-none text-[#000435] mb-2.5 truncate"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          {value}
        </div>
        <div className="text-[12px] text-[#64748B] font-medium flex items-center gap-1 min-h-[16px]">
          <span className="truncate">{sub}</span>
          {to ? (
            <ArrowUpRight className="w-3.5 h-3.5 text-[#F96500] shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
          ) : null}
        </div>
      </div>
    </div>
  );
  if (!to) return body;
  return (
    <Link to={to} className="block no-underline">
      {body}
    </Link>
  );
}

export function ContentCard({
  title,
  aside,
  className,
  children,
}: {
  title?: string;
  aside?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`bg-white border border-[#E2E8F0] rounded-2xl p-5 sm:p-6 shadow-[0_1px_3px_rgba(15,23,42,0.05)] ${className ?? ''}`}
    >
      {title || aside ? (
        <div className="flex items-center justify-between mb-4">
          {title ? (
            <h3 className="text-sm font-bold text-app-text-primary uppercase tracking-wider m-0">
              {title}
            </h3>
          ) : (
            <span />
          )}
          {aside}
        </div>
      ) : null}
      {children}
    </div>
  );
}

/**
 * Masonry-style card flow for the secondary dashboard panels. CSS multi-column
 * packs cards of unpredictable height with no row-alignment gaps — the "odd
 * empty space" a rigid 2fr/1fr grid leaves when one column's content is short.
 * Each child card must be a single block; it will not split across columns.
 */
export function CardColumns({ children }: { children: React.ReactNode }) {
  return (
    <div className="columns-1 md:columns-2 gap-6 [&>*]:mb-6 [&>*]:break-inside-avoid [&>*:last-child]:mb-0">
      {children}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-[12px] text-app-text-secondary py-6 text-center">{message}</div>
  );
}

/** Small label→value row used inside the "health" / "overview" panels. */
export function MiniStat({
  label,
  value,
  to,
}: {
  label: string;
  value: string;
  to?: string;
}) {
  const inner = (
    <div className="flex items-center justify-between py-1.5 text-[11.5px]">
      <span className="text-app-text-secondary font-medium">{label}</span>
      <span className="font-bold text-app-text-primary flex items-center gap-1">
        {value}
        {to ? <ChevronRight className="w-3.5 h-3.5 text-app-text-secondary" /> : null}
      </span>
    </div>
  );
  if (!to) return inner;
  return (
    <Link to={to} className="block hover:opacity-80 transition-opacity">
      {inner}
    </Link>
  );
}

export type ActionItem = {
  key: string;
  label: string;
  count: number;
  to: string;
  icon?: React.ComponentType<{ className?: string }>;
};

/** Compact "needs attention" row list. Zero-count rows are the caller's job to filter. */
export function ActionRowList({
  items,
  emptyMessage,
}: {
  items: ActionItem[];
  emptyMessage: string;
}) {
  if (!items.length) return <EmptyState message={emptyMessage} />;
  return (
    <div className="space-y-3">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.key}
            to={item.to}
            className="flex items-center justify-between p-3 bg-app-bg border border-app-border rounded-xl hover:border-app-accent/40 transition-all group"
          >
            <div className="flex items-center gap-3 min-w-0">
              {Icon ? (
                <div className="w-8 h-8 rounded-lg bg-app-accent/10 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-app-accent" />
                </div>
              ) : null}
              <div className="text-[11.5px] font-bold text-app-text-primary truncate">
                {item.label}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-sm font-black text-app-accent">{item.count}</span>
              <ChevronRight className="w-4 h-4 text-app-text-secondary group-hover:text-app-accent" />
            </div>
          </Link>
        );
      })}
    </div>
  );
}

export type QuickAction = {
  key: string;
  label: string;
  sub?: string;
  to?: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
  disabledHint?: string;
};

export function QuickActionGrid({ actions }: { actions: QuickAction[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {actions.map((a) => {
        const Icon = a.icon;
        const inner = (
          <>
            <div className="w-10 h-10 rounded-lg bg-app-accent/10 flex items-center justify-center shrink-0">
              <Icon className="w-5 h-5 text-app-accent" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-app-text-primary text-[13px] truncate">{a.label}</div>
              <div className="text-[11px] text-app-text-secondary truncate">
                {a.disabled ? a.disabledHint ?? 'Not available yet' : a.sub}
              </div>
            </div>
          </>
        );
        const cls =
          'bg-app-card border border-app-border rounded-2xl p-5 flex items-center gap-4 transition-all';
        if (a.disabled) {
          return (
            <div key={a.key} className={`${cls} opacity-50 cursor-not-allowed`} aria-disabled>
              {inner}
            </div>
          );
        }
        if (a.href) {
          return (
            <a
              key={a.key}
              href={a.href}
              target="_blank"
              rel="noopener noreferrer"
              className={`${cls} hover:border-app-accent/40`}
            >
              {inner}
            </a>
          );
        }
        return (
          <Link key={a.key} to={a.to ?? '#'} className={`${cls} hover:border-app-accent/40`}>
            {inner}
          </Link>
        );
      })}
    </div>
  );
}

/**
 * Trend chart. `data` is [{ name, value }]. When there is no real series the
 * chart is replaced with an honest message — never a fabricated line.
 */
export function TrendChart({
  data,
  seriesLabel,
  emptyMessage,
  color = '#EF3C23',
  gradientId = 'dashTrend',
  valuePrefix = '',
}: {
  data: Array<{ name: string; value: number }>;
  seriesLabel: string;
  emptyMessage: string;
  color?: string;
  gradientId?: string;
  valuePrefix?: string;
}) {
  const hasData = data.some((d) => d.value > 0);
  return (
    <div className="min-h-[280px]">
      {hasData ? (
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.15} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#00000010" vertical={false} />
            <XAxis dataKey="name" stroke="#888888" fontSize={10} tickLine={false} axisLine={false} />
            <YAxis stroke="#888888" fontSize={10} tickLine={false} axisLine={false} />
            <Tooltip
              formatter={(v: number | string) => [`${valuePrefix}${Number(v).toLocaleString()}`, seriesLabel]}
              contentStyle={{
                backgroundColor: 'var(--color-app-card)',
                border: '1px solid var(--color-app-border)',
                borderRadius: '12px',
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              name={seriesLabel}
              stroke={color}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-[280px] flex items-center justify-center text-app-text-secondary text-sm">
          {emptyMessage}
        </div>
      )}
    </div>
  );
}

export type DualTrendPoint = { date: string; label: string; revenue: number; orders: number };

/**
 * Revenue (area, left axis) + order count (line, right axis) over the selected
 * range. Separate axes because the two scales differ by orders of magnitude.
 * Real series only: loading and "no data" states replace the chart, never a
 * fabricated line.
 */
export function DualTrendChart({
  data,
  loading = false,
  emptyMessage,
  revenueLabel = 'GMV / Revenue (৳)',
  ordersLabel = 'Orders',
}: {
  data: DualTrendPoint[];
  loading?: boolean;
  emptyMessage: string;
  revenueLabel?: string;
  ordersLabel?: string;
}) {
  const hasData = data.some((d) => d.revenue > 0 || d.orders > 0);
  const box = 'h-[300px] sm:h-[340px] flex items-center justify-center text-[#64748B] text-sm';
  if (loading) return <div className={box}>Loading trend…</div>;
  if (!hasData) return <div className={box}>{emptyMessage}</div>;
  const money = (n: number) => `৳ ${Math.round(n).toLocaleString()}`;
  const compact = (n: number) => (n >= 1000 ? `${Number((n / 1000).toFixed(1))}k` : String(n));
  // Round axis maximum (1 / 2 / 2.5 / 5 × 10^k) so ticks land on readable numbers.
  const niceMax = (max: number) => {
    if (!(max > 0)) return 1;
    const pow = 10 ** Math.floor(Math.log10(max));
    const step = [1, 2, 2.5, 5, 10].find((m) => m * pow >= max) ?? 10;
    return step * pow;
  };
  const revMax = niceMax(Math.max(...data.map((d) => d.revenue)));
  const ordMax = Math.max(4, Math.ceil(niceMax(Math.max(...data.map((d) => d.orders)))));
  const fullDate = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(`${iso}T00:00:00`);
    return Number.isNaN(d.getTime())
      ? iso
      : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };
  return (
    <div className="h-[300px] sm:h-[340px] -mx-2" data-testid="dual-trend-chart">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="dashGmvFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F96500" stopOpacity={0.22} />
              <stop offset="100%" stopColor="#F96500" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="4 4" stroke="#E2E8F0" />
          <XAxis dataKey="label" stroke="#64748B" fontSize={11} tickLine={false} axisLine={false} minTickGap={18} dy={6} />
          <YAxis
            yAxisId="rev"
            stroke="#64748B"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={compact}
            domain={[0, revMax]}
            tickCount={5}
            width={48}
          />
          <YAxis
            yAxisId="ord"
            orientation="right"
            stroke="#64748B"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            domain={[0, ordMax]}
            width={32}
          />
          <Tooltip
            labelFormatter={(label, payload) =>
              fullDate((payload?.[0]?.payload as DualTrendPoint | undefined)?.date) || String(label)
            }
            formatter={(v: number | string, name: string) =>
              name === revenueLabel ? [money(Number(v)), name] : [Number(v).toLocaleString(), name]
            }
            contentStyle={{
              background: '#fff',
              border: '1px solid #E2E8F0',
              borderRadius: 12,
              boxShadow: '0 8px 24px rgba(15,23,42,0.08)',
              fontSize: 12,
            }}
            labelStyle={{ color: '#000435', fontWeight: 700, marginBottom: 4 }}
          />
          <Legend
            verticalAlign="top"
            align="right"
            iconType="circle"
            iconSize={9}
            height={32}
            wrapperStyle={{ fontSize: 12, color: '#000435' }}
          />
          <Area
            yAxisId="rev"
            type="monotoneX"
            dataKey="revenue"
            name={revenueLabel}
            stroke="#F96500"
            strokeWidth={2.5}
            fill="url(#dashGmvFill)"
            dot={{ r: 3, fill: '#F96500', strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
          <Line
            yAxisId="ord"
            type="monotoneX"
            dataKey="orders"
            name={ordersLabel}
            stroke="#3B82F6"
            strokeWidth={2.5}
            dot={{ r: 3, fill: '#3B82F6', strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
