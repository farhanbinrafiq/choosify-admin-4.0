import React from 'react';
import { Link } from 'react-router-dom';
import {
  AreaChart,
  Area,
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-app-text-primary tracking-tight">{title}</h1>
          {subtitle ? <p className="text-app-text-secondary text-sm mt-0.5">{subtitle}</p> : null}
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
    <div className="flex bg-slate-100 p-1 rounded-xl border border-app-border">
      {(['7d', '30d', '90d'] as RangeKey[]).map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => onChange(t)}
          className={`px-4 py-1.5 text-[10px] font-bold rounded-lg transition-all ${
            value === t
              ? 'bg-app-accent text-white'
              : 'text-app-text-secondary hover:text-app-text-primary'
          }`}
        >
          {t.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

/**
 * Panel that hosts the KPI tile row.
 * Default: a soft warm tint (role dashboards stay professional / light).
 * `branded`: the connected Choosify brand gradient — reserved for the actual
 * Platform Command Center; tiles inside become translucent glass.
 */
export function KpiPanel({
  cols = 4,
  branded = false,
  children,
}: {
  cols?: 2 | 3 | 4;
  branded?: boolean;
  children: React.ReactNode;
}) {
  const grid =
    cols === 2
      ? 'md:grid-cols-2'
      : cols === 3
        ? 'md:grid-cols-2 lg:grid-cols-3'
        : 'md:grid-cols-2 lg:grid-cols-4';
  return (
    <div
      className={`rounded-[20px] p-5${branded ? ' dash-kpi-panel--branded' : ''}`}
      style={
        branded
          ? { background: 'var(--choosify-gradient-command)' }
          : {
              backgroundImage:
                'linear-gradient(120deg, color-mix(in srgb, var(--choosify-orange) 10%, transparent), color-mix(in srgb, var(--choosify-navy) 7%, transparent))',
            }
      }
    >
      <div className={`grid grid-cols-1 ${grid} gap-5`}>{children}</div>
    </div>
  );
}

/** Dark-glass KPI tile. `to` makes the whole tile a router link. */
export function KpiTile({
  label,
  value,
  sub,
  to,
}: {
  label: string;
  value: string;
  sub?: string;
  to?: string;
}) {
  const body = (
    <div className="dash-kpi-tile rounded-[18px] p-5 group transition-all relative overflow-hidden h-full">
      <div className="dash-kpi-label text-[11px] uppercase tracking-[0.15em] font-bold mb-3">
        {label}
      </div>
      <div
        className="dash-kpi-value text-[28px] font-extrabold tracking-tight mb-2 leading-none"
        style={{ fontFamily: "'Outfit', system-ui, sans-serif" }}
      >
        {value}
      </div>
      <div className="dash-kpi-sub text-[11px] font-medium flex items-center gap-1 min-h-[16px]">
        {sub}
        {to ? (
          <ArrowUpRight className="w-3.5 h-3.5 text-[#EF3C23] opacity-0 group-hover:opacity-100 transition-opacity" />
        ) : null}
      </div>
    </div>
  );
  if (!to) return body;
  return (
    <Link to={to} className="block">
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
      className={`bg-app-card border border-app-border rounded-2xl p-6 shadow-sm ${className ?? ''}`}
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
  color = '#FF5B00',
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
