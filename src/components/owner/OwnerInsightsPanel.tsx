/**
 * Insights (GET /views/insights) in the Inventory card style:
 *  - owners (sellers / creators): their own brand pages, products and ads;
 *  - Super Admin (platform mode): the whole website, or "view as owner" = exactly what that owner sees.
 */
import React, { useEffect, useState } from 'react';
import { authedFetch } from '../../services/authRefresh';
import { DayBars, InsightGrid, InsightPanel, KPI_COLORS, KpiStrip, RankList, fmt, pct } from '../insights/Kpi';

type Insights = {
  days: number | 'all';
  brands: number;
  products: number;
  views: number;
  uniqueVisitors: number;
  allTimeViews: number;
  series: Array<{ date: string; views: number }>;
  bySource: Record<string, number>;
  byDevice: Record<string, number>;
  top: Array<{ kind: 'brand' | 'product'; id: string; name: string; image: string; views: number; visitors: number; allTimeViews: number }>;
  ads: { count: number; views: number; clicks: number };
  owners?: Array<{ ownerId: string; label: string }>;
};

const API_BASE = String((import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '');
const SOURCE_LABEL: Record<string, string> = { choosify: 'Choosify', direct: 'Direct / typed', facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', google: 'Google', search: 'Other search', other: 'Other sites' };
const rank = (o: Record<string, number>) => Object.entries(o).sort((a, b) => b[1] - a[1]);

export function OwnerInsightsPanel({ platform = false }: { platform?: boolean }) {
  const [days, setDays] = useState<'7' | '30' | 'all'>('30');
  const [owner, setOwner] = useState<string>('all');
  const [data, setData] = useState<Insights | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setError(null);
    const who = platform ? (owner === 'all' ? '&scope=all' : `&ownerId=${encodeURIComponent(owner)}`) : '';
    authedFetch(`${API_BASE}/views/insights?days=${days}${who}`)
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || 'Insights unavailable');
        if (alive) setData(j.data as Insights);
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : 'Insights unavailable'));
    return () => {
      alive = false;
    };
  }, [days, owner, platform]);

  return (
    <section className="space-y-3.5" data-testid={platform ? 'platform-insights' : 'owner-insights'}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[15px] font-extrabold text-[#111827]">{platform ? 'Platform Insights' : 'Insights'}</div>
          <div className="text-[12px] text-[#6B7280]">
            {platform ? 'Traffic and ad results across the whole website — or exactly what one owner sees.' : 'How shoppers found your brand pages, products and ads.'}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {platform && data?.owners?.length ? (
            <select value={owner} onChange={(e) => setOwner(e.target.value)} className="rounded-lg border border-[#E8EDF2] bg-white px-2.5 py-1.5 text-[12px] font-semibold" data-testid="insights-owner">
              <option value="all">Whole website</option>
              {data.owners.map((o) => (
                <option key={o.ownerId} value={o.ownerId}>
                  View as owner of {o.label}
                </option>
              ))}
            </select>
          ) : null}
          <select value={days} onChange={(e) => setDays(e.target.value as '7' | '30' | 'all')} className="rounded-lg border border-[#E8EDF2] bg-white px-2.5 py-1.5 text-[12px] font-semibold" data-testid="owner-insights-range">
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="all">All time</option>
          </select>
        </div>
      </div>
      {error ? (
        <div className="text-[12.5px] font-semibold text-red-600" role="alert">{error}</div>
      ) : !data ? (
        <div className="py-6 text-center text-[12.5px] text-[#6B7280]">Loading…</div>
      ) : (
        <>
          <KpiStrip
            items={[
              { label: 'Page views', value: fmt(data.views), sub: `${fmt(data.allTimeViews)} all time`, color: KPI_COLORS.blue, testId: 'owner-insights-page-views' },
              { label: 'Unique visitors', value: fmt(data.uniqueVisitors), sub: `${data.brands} brand${data.brands === 1 ? '' : 's'} · ${data.products} product${data.products === 1 ? '' : 's'}`, color: KPI_COLORS.green, testId: 'owner-insights-unique-visitors' },
              { label: 'Ad views', value: fmt(data.ads.views), sub: `${data.ads.count} ad${data.ads.count === 1 ? '' : 's'}`, color: KPI_COLORS.amber, testId: 'owner-insights-ad-views' },
              { label: 'Ad clicks', value: fmt(data.ads.clicks), sub: `click rate ${pct(data.ads.clicks, data.ads.views)}`, color: KPI_COLORS.red, testId: 'owner-insights-ad-clicks' },
            ]}
          />
          <InsightGrid>
            <InsightPanel title="Views per day" testId="owner-insights-chart">
              <DayBars series={data.series.map((d) => ({ date: d.date, a: d.views }))} empty="No page views in this period yet." />
            </InsightPanel>
            <InsightPanel title="Most viewed">
              <RankList
                empty="No views yet."
                rows={data.top.slice(0, 6).map((t) => ({
                  key: `${t.kind}-${t.id}`,
                  label: (
                    <>
                      <span style={{ fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase', color: '#6B7280', background: '#F1F5F9', borderRadius: 4, padding: '0 4px', marginRight: 6 }}>{t.kind}</span>
                      {t.name}
                    </>
                  ),
                  value: fmt(t.views),
                }))}
              />
            </InsightPanel>
            <InsightPanel title="Where visitors came from">
              <RankList empty="No visits yet." rows={rank(data.bySource).map(([k, v]) => ({ key: k, label: SOURCE_LABEL[k] ?? k, value: fmt(v) }))} />
              <div style={{ height: 10 }} />
              <RankList empty="" rows={rank(data.byDevice).map(([k, v]) => ({ key: `d-${k}`, label: `${k.charAt(0).toUpperCase()}${k.slice(1)}`, value: fmt(v) }))} />
            </InsightPanel>
          </InsightGrid>
          <div className="text-[10.5px] text-[#9CA3AF]">A page view counts once per visitor per page per day. {platform ? '' : 'Only your own brands, products and ads are included.'}</div>
        </>
      )}
    </section>
  );
}
