import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Info, Loader2, AlertTriangle, TrendingUp, Layers, ShieldCheck } from 'lucide-react';
import { AdminWorkspaceLayout } from '../../components/Layout/AdminWorkspaceLayout';
import { DashShell, ContentCard, KpiPanel, KpiTile, TrendChart, EmptyState } from './dashboards/primitives';
import { monetizationApi, type MonetizationSummary, type MonetizationSubscriptionMetrics, type MonetizationRevenueTrend, type MonetizationFilterOptions, type MonetizationFilterParams } from '../../services/monetizationApi';

/**
 * Sprint 12, Phase 7 — Monetization Center. An aggregation/intelligence
 * layer only (see server/monetization/monetizationService.ts's header for
 * the full source-of-truth map). This page renders exactly what the backend
 * returns — no client-side aggregation of raw rows, no invented metrics.
 * Every ৳0/empty state below distinguishes "genuinely zero" from "excluded
 * by the Source filter" (`null`) — never the same visual for both.
 */

type DatePreset = 'today' | '7d' | '30d' | '90d' | 'year' | 'custom';
type SourceFilter = 'all' | 'commerce' | 'subscriptions';
type PersonaFilter = 'all' | 'seller' | 'creator';
type PaymentStatusFilter = 'all' | 'succeeded' | 'pending' | 'failed' | 'cancelled';

const DATE_PRESET_LABEL: Record<DatePreset, string> = {
  today: 'Today',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  year: 'This year',
  custom: 'Custom range',
};

function toDateInputValue(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function resolveDateRange(preset: DatePreset, customFrom: string, customTo: string): { from: Date; to: Date } {
  const now = new Date();
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  switch (preset) {
    case 'today':
      return { from: startOfToday, to: endOfToday };
    case '7d':
      return { from: new Date(startOfToday.getTime() - 6 * 86_400_000), to: endOfToday };
    case '30d':
      return { from: new Date(startOfToday.getTime() - 29 * 86_400_000), to: endOfToday };
    case '90d':
      return { from: new Date(startOfToday.getTime() - 89 * 86_400_000), to: endOfToday };
    case 'year':
      return { from: new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0), to: endOfToday };
    case 'custom': {
      const from = customFrom ? new Date(`${customFrom}T00:00:00`) : startOfToday;
      const to = customTo ? new Date(`${customTo}T23:59:59.999`) : endOfToday;
      return { from, to };
    }
  }
}

function formatMoney(minorUnits: number, currency: string): string {
  const symbol = currency === 'BDT' ? '৳' : `${currency} `;
  return `${symbol}${(minorUnits / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function Banner({ kind, children }: { kind: 'error' | 'info'; children: React.ReactNode }) {
  const styles = kind === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-blue-50 border-blue-100 text-blue-800';
  const Icon = kind === 'error' ? AlertTriangle : Info;
  return (
    <div className={`flex items-start gap-2 rounded-lg border px-3.5 py-2.5 text-[12px] font-semibold ${styles}`}>
      <Icon className="w-3.5 h-3.5 shrink-0 mt-0.5" /> <span>{children}</span>
    </div>
  );
}

/** A summary tile that honestly distinguishes null (excluded by filter) from a genuine ৳0. */
function MoneyTile({ label, value, currency, sub, zeroCaption, notIncludedCaption }: { label: string; value: number | null; currency: string; sub?: string; zeroCaption?: string; notIncludedCaption?: string }) {
  const display = value === null ? '—' : formatMoney(value, currency);
  const caption = value === null ? (notIncludedCaption ?? 'Excluded by the Source filter') : value === 0 ? zeroCaption : sub;
  return (
    <div className="bg-app-card border border-app-border rounded-2xl p-5">
      <div className="text-[10px] font-extrabold text-[#9CA3AF] tracking-wide uppercase">{label}</div>
      <div className="text-[24px] font-extrabold text-app-text-primary mt-1.5 leading-none">{display}</div>
      {caption && <div className="text-[10.5px] font-semibold text-app-text-secondary mt-2">{caption}</div>}
    </div>
  );
}

type TrendSeriesKey = 'platformRevenue' | 'subscriptionRevenue' | 'commissionRevenue' | 'gmv';
const TREND_SERIES_LABEL: Record<TrendSeriesKey, string> = {
  platformRevenue: 'Platform Revenue',
  subscriptionRevenue: 'Subscription Revenue',
  commissionRevenue: 'Commerce Commission',
  gmv: 'GMV',
};

export default function MonetizationPage() {
  const [preset, setPreset] = useState<DatePreset>('30d');
  const [customFrom, setCustomFrom] = useState(toDateInputValue(new Date(Date.now() - 29 * 86_400_000)));
  const [customTo, setCustomTo] = useState(toDateInputValue(new Date()));
  const [source, setSource] = useState<SourceFilter>('all');
  const [persona, setPersona] = useState<PersonaFilter>('all');
  const [planVersionId, setPlanVersionId] = useState<string>('');
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'annual' | ''>('');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatusFilter>('all');
  const [trendSeries, setTrendSeries] = useState<TrendSeriesKey>('platformRevenue');

  const [filterOptions, setFilterOptions] = useState<MonetizationFilterOptions | null>(null);
  const [summary, setSummary] = useState<MonetizationSummary | null>(null);
  const [subMetrics, setSubMetrics] = useState<MonetizationSubscriptionMetrics | null>(null);
  const [trend, setTrend] = useState<MonetizationRevenueTrend | null>(null);
  const [commerceCounts, setCommerceCounts] = useState<{ settlementCount: number; escrowCount: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const { from, to } = useMemo(() => resolveDateRange(preset, customFrom, customTo), [preset, customFrom, customTo]);

  const filters: MonetizationFilterParams = useMemo(
    () => ({
      from: from.toISOString(),
      to: to.toISOString(),
      source,
      persona,
      planVersionId: planVersionId || undefined,
      billingInterval: billingInterval || undefined,
      paymentStatus,
    }),
    [from, to, source, persona, planVersionId, billingInterval, paymentStatus],
  );

  useEffect(() => {
    monetizationApi.getFilterOptions().then(({ options }) => setFilterOptions(options)).catch(() => setFilterOptions(null));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setForbidden(false);
    try {
      const [{ summary: s }, { metrics: sm }, { trend: t }, { metrics: gm }, { metrics: cm }] = await Promise.all([
        monetizationApi.getSummary(filters),
        monetizationApi.getSubscriptionMetrics(filters),
        monetizationApi.getRevenueTrend(filters),
        monetizationApi.getGmvMetrics(filters),
        monetizationApi.getCommissionMetrics(filters),
      ]);
      setSummary(s);
      setSubMetrics(sm);
      setTrend(t);
      setCommerceCounts({ settlementCount: cm.settlementCount, escrowCount: gm.escrowCount });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load Monetization data';
      if (/insufficient role|forbidden|401|403/i.test(msg)) setForbidden(true);
      else setError(msg);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  const currency = summary?.currency || 'BDT';

  const trendChartData = useMemo(() => {
    if (!trend) return [];
    return trend.points.map((p) => ({
      name: trend.granularity === 'day' ? p.date.slice(5) : p.date,
      value: (p[trendSeries] ?? 0) / 100,
    }));
  }, [trend, trendSeries]);

  if (forbidden) {
    return (
      <AdminWorkspaceLayout>
        <div className="rounded-xl border border-dashed border-app-border bg-app-card p-10 text-center max-w-lg mx-auto mt-10">
          <ShieldCheck className="w-8 h-8 text-app-text-secondary mx-auto mb-3" />
          <div className="text-[14px] font-extrabold text-app-text-primary">Super Admin Access Required</div>
          <p className="text-[12px] font-semibold text-app-text-secondary mt-1.5">The Monetization Center is restricted to Choosify administration.</p>
        </div>
      </AdminWorkspaceLayout>
    );
  }

  return (
    <AdminWorkspaceLayout>
      <DashShell title="Monetization Center" subtitle="Platform revenue and commerce performance — every number below traces to an authoritative record.">
        {error && <Banner kind="error">{error}</Banner>}

        {/* ── Filter bar ── */}
        <ContentCard title="Filters">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <div>
              <div className="text-[10px] font-extrabold text-[#9CA3AF] tracking-wide uppercase mb-1.5">Date</div>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(DATE_PRESET_LABEL) as DatePreset[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPreset(p)}
                    className={`px-3 py-1.5 text-[10.5px] font-bold rounded-lg border transition-all ${preset === p ? 'bg-app-accent text-white border-app-accent' : 'border-app-border text-app-text-secondary hover:text-app-text-primary'}`}
                  >
                    {DATE_PRESET_LABEL[p]}
                  </button>
                ))}
              </div>
              {preset === 'custom' && (
                <div className="flex items-center gap-2 mt-2">
                  <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="rounded-lg border border-app-border px-2.5 py-1.5 text-[11px] font-semibold" />
                  <span className="text-[11px] text-app-text-secondary">to</span>
                  <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="rounded-lg border border-app-border px-2.5 py-1.5 text-[11px] font-semibold" />
                </div>
              )}
              <div className="text-[10px] font-semibold text-app-text-secondary mt-1.5">
                Showing {from.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} – {to.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
            </div>

            <div>
              <div className="text-[10px] font-extrabold text-[#9CA3AF] tracking-wide uppercase mb-1.5">Source</div>
              <select value={source} onChange={(e) => setSource(e.target.value as SourceFilter)} className="w-full rounded-lg border border-app-border px-2.5 py-1.5 text-[11.5px] font-bold">
                <option value="all">All Sources</option>
                <option value="commerce">Commerce</option>
                <option value="subscriptions">Subscriptions</option>
              </select>
              <div className="text-[10px] font-semibold text-app-text-secondary mt-1.5">Advertising is not shown — no authoritative revenue source exists for it yet.</div>
            </div>

            <div>
              <div className="text-[10px] font-extrabold text-[#9CA3AF] tracking-wide uppercase mb-1.5">Persona (Subscription metrics only)</div>
              <select value={persona} onChange={(e) => setPersona(e.target.value as PersonaFilter)} className="w-full rounded-lg border border-app-border px-2.5 py-1.5 text-[11.5px] font-bold">
                <option value="all">All Personas</option>
                <option value="seller">Seller</option>
                <option value="creator">Creator</option>
              </select>
            </div>

            <div>
              <div className="text-[10px] font-extrabold text-[#9CA3AF] tracking-wide uppercase mb-1.5">Plan Version</div>
              <select value={planVersionId} onChange={(e) => setPlanVersionId(e.target.value)} className="w-full rounded-lg border border-app-border px-2.5 py-1.5 text-[11.5px] font-bold">
                <option value="">All Plan Versions</option>
                {(filterOptions?.planVersions ?? []).map((v) => {
                  const plan = filterOptions?.plans.find((p) => p.id === v.planId);
                  return (
                    <option key={v.id} value={v.id}>
                      {plan?.name ?? v.planId} — v{v.version}
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <div className="text-[10px] font-extrabold text-[#9CA3AF] tracking-wide uppercase mb-1.5">Billing Interval</div>
              <select value={billingInterval} onChange={(e) => setBillingInterval(e.target.value as 'monthly' | 'annual' | '')} className="w-full rounded-lg border border-app-border px-2.5 py-1.5 text-[11.5px] font-bold">
                <option value="">All Intervals</option>
                <option value="monthly">Monthly</option>
                <option value="annual">Annual</option>
              </select>
            </div>

            <div>
              <div className="text-[10px] font-extrabold text-[#9CA3AF] tracking-wide uppercase mb-1.5">Payment Status (breakdown only)</div>
              <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value as PaymentStatusFilter)} className="w-full rounded-lg border border-app-border px-2.5 py-1.5 text-[11.5px] font-bold">
                <option value="all">All Statuses</option>
                <option value="succeeded">Successful</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <div className="text-[10px] font-semibold text-app-text-secondary mt-1.5">Only successful payments ever count as revenue.</div>
            </div>
          </div>
        </ContentCard>

        {loading && !summary ? (
          <div className="flex items-center justify-center gap-2 py-16 text-app-text-secondary">
            <Loader2 className="w-4 h-4 animate-spin" /> <span className="text-[12px] font-bold">Loading Monetization data…</span>
          </div>
        ) : (
          <>
            {/* ── Revenue summary (the only cards that ARE revenue) ── */}
            <KpiPanel cols={3} branded>
              <KpiTile label="Platform Revenue" value={summary?.platformRevenue == null ? '—' : formatMoney(summary.platformRevenue, currency)} sub="Commerce Commission + Subscription Revenue" />
              <KpiTile
                label="Commission Revenue"
                value={summary?.commissionRevenue == null ? '—' : formatMoney(summary.commissionRevenue, currency)}
                sub={summary?.commissionRevenue == null ? 'Excluded — Source = Subscriptions' : commerceCounts ? `${commerceCounts.settlementCount} settlements` : 'Commerce'}
              />
              <KpiTile
                label="Subscription Revenue"
                value={summary?.subscriptionRevenue == null ? '—' : formatMoney(summary.subscriptionRevenue, currency)}
                sub={summary?.subscriptionRevenue == null ? 'Excluded — Source = Commerce' : subMetrics ? `${subMetrics.paymentCounts.succeeded} successful payments` : 'Subscriptions'}
              />
            </KpiPanel>

            {/* ── Explicitly NOT revenue — visually distinct, never merged into Platform Revenue ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <MoneyTile label="GMV (not platform revenue)" value={summary?.gmv ?? null} currency={currency} sub={commerceCounts ? `${commerceCounts.escrowCount} captured orders` : undefined} zeroCaption="No commerce orders captured for this period." notIncludedCaption="Excluded — Source filter is set to Subscriptions." />
              <MoneyTile label="Seller Net (not platform revenue)" value={summary?.sellerNet ?? null} currency={currency} sub={commerceCounts ? `${commerceCounts.settlementCount} settlements` : undefined} zeroCaption="No commerce settlements recorded for this period." notIncludedCaption="Excluded — Source filter is set to Subscriptions." />
            </div>

            {/* ── Revenue breakdown ── */}
            <ContentCard title="Revenue Breakdown">
              <div className="space-y-2">
                <div className="flex items-center justify-between py-2 border-b border-app-border">
                  <span className="text-[12px] font-extrabold text-app-text-primary">Platform Revenue</span>
                  <span className="text-[13px] font-extrabold text-app-text-primary">{summary?.platformRevenue == null ? '—' : formatMoney(summary.platformRevenue, currency)}</span>
                </div>
                <div className="flex items-center justify-between py-1.5 pl-4">
                  <span className="text-[11.5px] font-bold text-app-text-secondary">├── Commerce Commission</span>
                  <span className="text-[12px] font-bold text-app-text-primary">{summary?.commissionRevenue == null ? '—' : formatMoney(summary.commissionRevenue, currency)}</span>
                </div>
                <div className="flex items-center justify-between py-1.5 pl-4">
                  <span className="text-[11.5px] font-bold text-app-text-secondary">└── Subscription Revenue</span>
                  <span className="text-[12px] font-bold text-app-text-primary">{summary?.subscriptionRevenue == null ? '—' : formatMoney(summary.subscriptionRevenue, currency)}</span>
                </div>
              </div>
              <p className="text-[10.5px] font-semibold text-app-text-secondary mt-3 flex items-start gap-1.5">
                <Info className="w-3 h-3 shrink-0 mt-0.5" /> GMV and Seller Net are shown separately above — they are never added into Platform Revenue.
              </p>
            </ContentCard>

            {/* ── Subscription performance ── */}
            <ContentCard title="Subscription Performance">
              {subMetrics ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <MiniMetric label="Active Paid Subscriptions" value={String(subMetrics.activePaidSubscriptions)} caption="As of now" />
                    <MiniMetric label="Seller Revenue" value={formatMoney(subMetrics.sellerRevenue, subMetrics.currency)} />
                    <MiniMetric label="Creator Revenue" value={formatMoney(subMetrics.creatorRevenue, subMetrics.currency)} />
                    <MiniMetric label="Renewals" value={String(subMetrics.renewals)} />
                    <MiniMetric label="Cancellations" value={String(subMetrics.cancellations)} />
                    <MiniMetric label="Expirations" value={String(subMetrics.expirations)} />
                    <MiniMetric label="Successful Payments" value={String(subMetrics.paymentCounts.succeeded)} />
                    <MiniMetric label="Failed Payments" value={String(subMetrics.paymentCounts.failed)} />
                    <MiniMetric label="Pending Payments" value={String(subMetrics.paymentCounts.pending)} />
                    <MiniMetric label="Cancelled Payments" value={String(subMetrics.paymentCounts.cancelled)} />
                    <MiniMetric label="Monthly Revenue" value={formatMoney(subMetrics.byInterval.monthly, subMetrics.currency)} />
                    <MiniMetric label="Annual Revenue" value={formatMoney(subMetrics.byInterval.annual, subMetrics.currency)} />
                  </div>

                  <div>
                    <div className="text-[10px] font-extrabold text-[#9CA3AF] tracking-wide uppercase mb-2 flex items-center gap-1.5"><Layers className="w-3 h-3" /> Revenue by Plan Version</div>
                    {subMetrics.byPlan.length === 0 ? (
                      <EmptyState message="No subscription revenue recorded for this period." />
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-[11.5px]">
                          <thead>
                            <tr className="text-left text-[9.5px] font-extrabold text-[#9CA3AF] uppercase tracking-wide">
                              <th className="pb-2 pr-3">Plan</th>
                              <th className="pb-2 pr-3">Version</th>
                              <th className="pb-2 pr-3">Interval</th>
                              <th className="pb-2 pr-3 text-right">Payments</th>
                              <th className="pb-2 text-right">Revenue</th>
                            </tr>
                          </thead>
                          <tbody>
                            {subMetrics.byPlan.map((row) => (
                              <tr key={`${row.planVersionId}:${row.billingInterval}`} className="border-t border-app-border">
                                <td className="py-2 pr-3 font-bold text-app-text-primary">{row.planName}</td>
                                <td className="py-2 pr-3 text-app-text-secondary">v{row.planVersion}</td>
                                <td className="py-2 pr-3 text-app-text-secondary capitalize">{row.billingInterval}</td>
                                <td className="py-2 pr-3 text-right font-semibold">{row.count}</td>
                                <td className="py-2 text-right font-extrabold text-app-text-primary">{formatMoney(row.revenue, subMetrics.currency)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <EmptyState message="No verified subscription data for this period." />
              )}
            </ContentCard>

            {/* ── Revenue trend ── */}
            <ContentCard title="Revenue Trend">
              <div className="flex flex-wrap items-center justify-end gap-2 mb-3 -mt-1">
                <label className="text-[10px] font-extrabold text-[#9CA3AF] tracking-wide uppercase">Series</label>
                <select value={trendSeries} onChange={(e) => setTrendSeries(e.target.value as TrendSeriesKey)} className="w-full sm:w-auto rounded-lg border border-app-border px-2.5 py-1.5 text-[11px] font-bold">
                  {(Object.keys(TREND_SERIES_LABEL) as TrendSeriesKey[]).map((k) => (
                    <option key={k} value={k}>{TREND_SERIES_LABEL[k]}</option>
                  ))}
                </select>
              </div>
              <TrendChart
                data={trendChartData}
                seriesLabel={TREND_SERIES_LABEL[trendSeries]}
                emptyMessage={`No verified ${TREND_SERIES_LABEL[trendSeries].toLowerCase()} data for this period.`}
                valuePrefix={currency === 'BDT' ? '৳' : `${currency} `}
              />
              {trend && <div className="text-[10px] font-semibold text-app-text-secondary mt-1 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Bucketed by {trend.granularity === 'day' ? 'day' : 'month'}, from real transaction/settlement/payment dates.</div>}
            </ContentCard>

            {/* ── Transaction / source breakdown ── */}
            <ContentCard title="Transaction Breakdown">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MiniMetric label="Commerce Settlements" value={commerceCounts ? String(commerceCounts.settlementCount) : '—'} />
                <MiniMetric label="Captured Orders (Escrows)" value={commerceCounts ? String(commerceCounts.escrowCount) : '—'} />
                <MiniMetric label="Subscription Payments" value={subMetrics ? String(subMetrics.paymentCounts.succeeded + subMetrics.paymentCounts.pending + subMetrics.paymentCounts.failed + subMetrics.paymentCounts.cancelled) : '—'} />
                <MiniMetric label="Succeeded Subscription Payments" value={subMetrics ? String(subMetrics.paymentCounts.succeeded) : '—'} />
              </div>
            </ContentCard>
          </>
        )}
      </DashShell>
    </AdminWorkspaceLayout>
  );
}

function MiniMetric({ label, value, caption }: { label: string; value: string; caption?: string }) {
  return (
    <div className="rounded-xl border border-app-border p-3.5">
      <div className="text-[9px] font-extrabold text-[#9CA3AF] tracking-wide uppercase">{label}</div>
      <div className="text-[16px] font-extrabold text-app-text-primary mt-1">{value}</div>
      {caption && <div className="text-[9.5px] font-semibold text-app-text-secondary mt-0.5">{caption}</div>}
    </div>
  );
}
