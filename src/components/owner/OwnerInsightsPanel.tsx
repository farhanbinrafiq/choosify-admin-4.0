/**
 * Owner Insights (GET /views/insights): what shoppers did with everything this seller owns —
 * brand page + product views, unique visitors, daily trend, where they came from, devices,
 * top items, and the owner's ad views / clicks. Only the owner's own numbers.
 */
import React, { useEffect, useState } from 'react';
import { authedFetch } from '../../services/authRefresh';

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
};

const API_BASE = String((import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '');
const n = (v: number) => v.toLocaleString('en-US');
const SOURCE_LABEL: Record<string, string> = { choosify: 'Choosify', direct: 'Direct / typed', facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', google: 'Google', search: 'Other search', other: 'Other sites' };

export function OwnerInsightsPanel() {
  const [days, setDays] = useState<'7' | '30' | 'all'>('30');
  const [data, setData] = useState<Insights | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setError(null);
    authedFetch(`${API_BASE}/views/insights?days=${days}`)
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || 'Insights unavailable');
        if (alive) setData(j.data as Insights);
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : 'Insights unavailable'));
    return () => {
      alive = false;
    };
  }, [days]);

  const max = Math.max(1, ...(data?.series ?? []).map((d) => d.views));
  const ctr = data && data.ads.views > 0 ? `${((data.ads.clicks / data.ads.views) * 100).toFixed(1)}%` : '—';
  const rank = (o: Record<string, number>) => Object.entries(o).sort((a, b) => b[1] - a[1]);

  return (
    <section className="rounded-2xl border border-app-border bg-white p-5" data-testid="owner-insights">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[15px] font-extrabold text-app-text-primary">Insights</div>
          <div className="text-[12px] text-app-text-secondary">How shoppers found your brand pages, products and ads.</div>
        </div>
        <select value={days} onChange={(e) => setDays(e.target.value as '7' | '30' | 'all')} className="rounded-lg border border-app-border bg-white px-2.5 py-1.5 text-[12px] font-semibold" data-testid="owner-insights-range">
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="all">All time</option>
        </select>
      </div>
      {error ? (
        <div className="text-[12.5px] font-semibold text-red-600" role="alert">{error}</div>
      ) : !data ? (
        <div className="py-6 text-center text-[12.5px] text-app-text-secondary">Loading…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
            {[
              ['Page views', n(data.views), `${n(data.allTimeViews)} all time`],
              ['Unique visitors', n(data.uniqueVisitors), `${data.brands} brand${data.brands === 1 ? '' : 's'} · ${data.products} product${data.products === 1 ? '' : 's'}`],
              ['Ad views', n(data.ads.views), `${data.ads.count} ad${data.ads.count === 1 ? '' : 's'}`],
              ['Ad clicks', n(data.ads.clicks), `click rate ${ctr}`],
            ].map(([k, v, sub]) => (
              <div key={k} className="rounded-xl border border-app-border bg-[#F9FAFB] px-3 py-2.5" data-testid={`owner-insights-${k.toLowerCase().replace(/ /g, '-')}`}>
                <div className="text-[10.5px] font-extrabold uppercase tracking-wide text-app-text-secondary">{k}</div>
                <div className="text-[20px] font-extrabold text-app-text-primary">{v}</div>
                <div className="text-[11px] text-app-text-secondary">{sub}</div>
              </div>
            ))}
          </div>

          {data.series.length ? (
            <div className="mt-4">
              <div className="mb-1.5 text-[11.5px] font-extrabold text-app-text-primary">Views per day</div>
              <div className="flex h-[90px] items-end gap-[2px]" data-testid="owner-insights-chart">
                {data.series.map((d) => (
                  <div key={d.date} className="group relative flex-1">
                    <div className="w-full rounded-t-sm bg-[#F96500]" style={{ height: `${Math.max(2, (d.views / max) * 86)}px`, opacity: d.views ? 1 : 0.18 }} title={`${d.date}: ${d.views} views`} />
                  </div>
                ))}
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-app-text-secondary">
                <span>{data.series[0]?.date}</span>
                <span>{data.series[data.series.length - 1]?.date}</span>
              </div>
            </div>
          ) : null}

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div>
              <div className="mb-1.5 text-[11.5px] font-extrabold text-app-text-primary">Where visitors came from</div>
              {rank(data.bySource).length ? rank(data.bySource).map(([k, v]) => (
                <div key={k} className="flex justify-between border-t border-app-border py-1 text-[12px]">
                  <span>{SOURCE_LABEL[k] ?? k}</span>
                  <b>{n(v)}</b>
                </div>
              )) : <div className="text-[12px] text-app-text-secondary">No visits yet.</div>}
            </div>
            <div>
              <div className="mb-1.5 text-[11.5px] font-extrabold text-app-text-primary">Devices</div>
              {rank(data.byDevice).length ? rank(data.byDevice).map(([k, v]) => (
                <div key={k} className="flex justify-between border-t border-app-border py-1 text-[12px] capitalize">
                  <span>{k}</span>
                  <b>{n(v)}</b>
                </div>
              )) : <div className="text-[12px] text-app-text-secondary">—</div>}
            </div>
            <div>
              <div className="mb-1.5 text-[11.5px] font-extrabold text-app-text-primary">Most viewed</div>
              {data.top.length ? data.top.slice(0, 6).map((t) => (
                <div key={`${t.kind}-${t.id}`} className="flex items-center justify-between gap-2 border-t border-app-border py-1 text-[12px]" data-testid="owner-insights-top-row">
                  <span className="min-w-0 truncate">
                    <span className="mr-1 rounded bg-slate-100 px-1 text-[9.5px] font-extrabold uppercase text-slate-500">{t.kind}</span>
                    {t.name}
                  </span>
                  <b className="shrink-0">{n(t.views)}</b>
                </div>
              )) : <div className="text-[12px] text-app-text-secondary">No views yet.</div>}
            </div>
          </div>
          <div className="mt-3 text-[10.5px] text-app-text-secondary">
            A page view counts once per visitor per page per day. Only your own brands, products and ads are included. Open a product or brand to see who viewed it.
          </div>
        </>
      )}
    </section>
  );
}
