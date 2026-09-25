import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle, ExternalLink, Eye, Loader2, Pause, Play, Search, Slash, X, XCircle } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  DEAL_PRICING_MODE_LABEL,
  formatDealDiscount,
  PROMOTION_TYPE_LABEL,
  REJECTION_REASON_MAX,
  type DealFilterKey,
} from '@/shared/deals/dealPricing';
import { adsApi, type DealRecord, type PromotionRequestRecord } from '../../services/adsApi';
import { catalogApi } from '../../services/catalogApi';
import type { CatalogDeal } from '../../types/catalog';
import {
  DealStatusPill,
  fmtDateTime,
  ListingTypeBadge,
  money,
  Pill,
  PromotionStatusPill,
  Thumb,
} from '../../components/deals/dealDisplay';

// ============================================================================
// Admin Deals Manager — operational + promotion workspace for canonical seller
// Deals (Ads Manager AdRecord kind 'deal', /ads/deals).
//
// Deals are OPEN marketplace inventory: sellers create them on their own
// listings and they follow their dates automatically (Scheduled → Active →
// Expired). There is NO deal approval here. Admin controls on deals are
// exceptional moderation only: Pause / Resume / Disable (Disable is final and
// the only action on legacy deals).
//
// Approve / Reject exist ONLY on Promotion Requests (kind 'promotion' +
// dealId): a seller asking for Featured / Sponsored visibility for an Active
// deal. Rejecting a request never affects the deal. Sponsored approval does
// not imply payment (no billing yet) — it stays "awaiting fulfillment".
//
// No customer-facing pricing effect yet. Legacy CatalogDeal records are shown
// read-only.
// ============================================================================

type Tab = 'deals' | 'promotions';
type DealFilter = 'all' | DealFilterKey | 'promoted';
type PromoFilter = 'pending' | 'approved' | 'rejected' | 'cancelled';

const DEAL_FILTERS: Array<{ key: DealFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'expired', label: 'Expired' },
  { key: 'paused', label: 'Paused' },
  { key: 'disabled', label: 'Disabled' },
  { key: 'legacy', label: 'Legacy' },
  { key: 'promoted', label: 'Promoted' },
];

const PROMO_FILTERS: Array<{ key: PromoFilter; label: string }> = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'cancelled', label: 'Cancelled' },
];

type DealAction = 'pause' | 'resume' | 'disable';

/** Moderation available per deal state (the server enforces the same rules). */
function dealActionsFor(d: DealRecord): DealAction[] {
  if (d.status === 'disabled') return [];
  if (d.legacy) return ['disable'];
  if (d.status === 'paused') return ['resume', 'disable'];
  if (d.status === 'active') return ['pause', 'disable'];
  return ['disable'];
}

/** Base-price drift since the deal was created, as a signed percentage. */
function basePriceDrift(d: DealRecord): number | null {
  const at = d.dealTerms?.basePriceAtSubmit;
  const now = d.listing?.currentBasePrice;
  if (!at || !now || !d.listing?.exists || at === now) return null;
  return ((now - at) / at) * 100;
}

// Selected chips/tabs use a light wash: the platform's global
// `main [role="tab"][aria-selected="true"]` rule forces dark text.
const chipCls = (on: boolean) =>
  `rounded-full px-3 py-1.5 text-[10.5px] font-extrabold outline-none ${
    on ? 'bg-[#FFF1EE] text-[#111827] shadow-[inset_0_0_0_1px_rgba(239,60,35,0.35)]' : 'bg-[#F3F4F6] text-[#374151]'
  }`;

export default function DealsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Promo codes / vouchers live at /admin/coupons — the former in-page tab redirects there.
  useEffect(() => {
    if (searchParams.get('tab') === 'promocodes') navigate('/admin/coupons', { replace: true });
  }, [searchParams, navigate]);

  const tab: Tab = searchParams.get('view') === 'promotions' ? 'promotions' : 'deals';
  const setTab = (t: Tab) => setSearchParams(t === 'promotions' ? { view: 'promotions' } : {});

  const [deals, setDeals] = useState<DealRecord[]>([]);
  const [requests, setRequests] = useState<PromotionRequestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dealFilter, setDealFilter] = useState<DealFilter>('all');
  const [promoFilter, setPromoFilter] = useState<PromoFilter>('pending');
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [reviewingDeal, setReviewingDeal] = useState<DealRecord | null>(null);
  const [reviewingRequest, setReviewingRequest] = useState<PromotionRequestRecord | null>(null);
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const [legacyDeals, setLegacyDeals] = useState<CatalogDeal[] | null>(null);
  const [legacyError, setLegacyError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [d, r] = await Promise.all([adsApi.listDeals(), adsApi.listPromotionRequests()]);
      setDeals(d);
      setRequests(r);
      setReviewingDeal((cur) => (cur ? d.find((x) => x.id === cur.id) || null : null));
      setReviewingRequest((cur) => (cur ? r.find((x) => x.id === cur.id) || null : null));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load deals');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    catalogApi
      .listDeals()
      .then(setLegacyDeals)
      .catch((err) => {
        setLegacyDeals([]);
        setLegacyError(err instanceof Error ? err.message : 'Failed to load legacy deals');
      });
  }, [load]);

  const flash = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3500);
  };

  const dealCounts = useMemo(() => {
    const c: Record<string, number> = { all: deals.length, promoted: 0 };
    for (const d of deals) {
      c[d.filterKey] = (c[d.filterKey] || 0) + 1;
      if (d.promotion?.promotedNow) c.promoted += 1;
    }
    return c;
  }, [deals]);

  const promoCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of requests) c[r.status] = (c[r.status] || 0) + 1;
    return c;
  }, [requests]);

  const q = query.trim().toLowerCase();
  const matches = (...vals: Array<string | undefined>) => !q || vals.filter(Boolean).some((v) => String(v).toLowerCase().includes(q));

  const filteredDeals = useMemo(
    () =>
      deals.filter((d) => {
        if (dealFilter === 'promoted' ? !d.promotion?.promotedNow : dealFilter !== 'all' && d.filterKey !== dealFilter) return false;
        return matches(d.dealReferenceId, d.listing?.name, d.title, d.listing?.brandName, d.ownerId);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deals, dealFilter, q],
  );

  const filteredRequests = useMemo(
    () =>
      requests.filter(
        (r) =>
          r.status === promoFilter &&
          matches(r.advertisementReferenceId, r.deal?.dealReferenceId, r.deal?.listing?.name, r.title, r.deal?.listing?.brandName, r.ownerId),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [requests, promoFilter, q],
  );

  const moderate = async (d: DealRecord, action: DealAction) => {
    setBusyId(d.id);
    try {
      if (action === 'pause') await adsApi.pauseDeal(d.id);
      if (action === 'resume') await adsApi.resumeDeal(d.id);
      if (action === 'disable') await adsApi.disableDeal(d.id);
      flash(
        { pause: 'Deal paused.', resume: 'Deal resumed — its dates decide Scheduled / Active / Expired.', disable: 'Deal disabled.' }[action],
      );
      await load();
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Action failed', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const decide = async (r: PromotionRequestRecord, action: 'approve' | 'reject', reason?: string) => {
    setBusyId(r.id);
    try {
      if (action === 'approve') await adsApi.approvePromotionRequest(r.id);
      else await adsApi.rejectPromotionRequest(r.id, reason || '');
      flash(
        action === 'approve'
          ? r.promotionType === 'sponsored'
            ? 'Sponsored request approved — awaiting fulfillment (no payment has been taken).'
            : 'Promotion approved.'
          : 'Promotion request rejected — the deal is unaffected and the seller can see the reason.',
      );
      setRejectMode(false);
      setRejectReason('');
      await load();
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Action failed', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const openRequest = (r: PromotionRequestRecord, reject = false) => {
    setReviewingRequest(r);
    setRejectMode(reject);
    setRejectReason('');
  };

  return (
    <div className="min-w-0 text-[#111827]">
      {toast ? (
        // Background must be a bg-* CLASS (not an inline style): the global
        // `main .text-white:not([class*="bg-[#1"], [class*="bg-red"] …)` rule
        // otherwise forces the toast text dark on its dark background.
        <div
          role="status"
          data-testid="deals-toast"
          className={`fixed bottom-6 left-1/2 z-[100] flex max-w-[92vw] -translate-x-1/2 items-center gap-2 rounded-xl px-4 py-2.5 text-[12.5px] font-bold text-white shadow-xl ${
            toast.type === 'error' ? 'bg-red-600' : 'bg-[#111827]'
          }`}
        >
          {toast.type === 'error' ? <AlertTriangle size={15} /> : <CheckCircle size={15} />} {toast.message}
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-3">
            <span className="text-[15px] font-extrabold">Deals Manager</span>
            <button
              type="button"
              onClick={() => navigate('/admin/coupons')}
              className="inline-flex items-center gap-1 text-[11.5px] font-extrabold"
              style={{ color: 'var(--cms-accent)' }}
            >
              Promo Codes &amp; Vouchers <ExternalLink size={12} />
            </button>
          </div>
          <div className="text-[11px] font-semibold text-[#6B7280]">
            Seller deals go live automatically by their dates. Review promotion requests; pause or disable deals only when moderation is needed.
          </div>
        </div>
      </div>

      <div className="mb-4 inline-flex rounded-lg border border-[#E8EDF2] bg-white p-1" role="tablist" aria-label="Deals Manager sections">
        {([
          ['deals', 'All Deals', deals.length],
          ['promotions', 'Promotion Requests', promoCounts.pending || 0],
        ] as const).map(([key, label, count]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            data-tab={key}
            onClick={() => setTab(key)}
            className={`rounded-md px-3.5 py-1.5 text-[11.5px] font-extrabold outline-none ${
              tab === key ? 'bg-[#FFF1EE] text-[#111827] shadow-[inset_0_0_0_1px_rgba(239,60,35,0.35)]' : 'text-[#374151] hover:bg-[#F9FAFB]'
            }`}
          >
            {label} <span className="opacity-60">{count}</span>
          </button>
        ))}
      </div>

      <div className="relative mb-3 max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[#9CA3AF]" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search reference, listing or seller…"
          className="h-10 w-full rounded-lg border border-[#E8EDF2] bg-white pl-9 pr-3 text-[12.5px] outline-none"
          aria-label="Search deals"
        />
      </div>

      {error ? (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-700">
          {error}{' '}
          <button type="button" className="underline" onClick={() => void load()}>
            Retry
          </button>
        </div>
      ) : null}

      {tab === 'deals' ? (
        <>
          <div className="mb-3 flex flex-wrap gap-2" role="tablist" aria-label="Deal filters">
            {DEAL_FILTERS.map((f) => (
              <button key={f.key} type="button" role="tab" aria-selected={dealFilter === f.key} data-filter={f.key} onClick={() => setDealFilter(f.key)} className={chipCls(dealFilter === f.key)}>
                {f.label} <span className="opacity-60">{dealCounts[f.key] || 0}</span>
              </button>
            ))}
          </div>

          <div className="overflow-hidden rounded-lg border border-[#E8EDF2] bg-white">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1500px] border-collapse text-left" data-testid="admin-deals-table">
                <thead>
                  <tr className="bg-[#F9FAFB]">
                    {['Reference', 'Listing', 'Type', 'Seller', 'Base @ creation', 'Current base', 'Deal price', 'Pricing mode', 'Discount', 'Start', 'End', 'Status', 'Promotion', 'Created', 'Actions'].map((h) => (
                      <th key={h} className="whitespace-nowrap px-3 py-2.5 text-[10px] font-extrabold uppercase tracking-wide text-[#6B7280]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={15} className="px-3 py-10 text-center text-[12px] text-[#6B7280]"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading deals…</td></tr>
                  ) : filteredDeals.length === 0 ? (
                    <tr><td colSpan={15} className="px-3 py-10 text-center text-[12px] italic text-[#9CA3AF]">No deals in this view.</td></tr>
                  ) : (
                    filteredDeals.map((d) => {
                      const t = d.dealTerms;
                      const drift = basePriceDrift(d);
                      const acts = dealActionsFor(d);
                      return (
                        <tr key={d.id} className="border-t border-[#F1F3F5] align-top" data-deal-id={d.id} style={{ opacity: busyId === d.id ? 0.55 : 1 }}>
                          <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[11px] font-bold text-[#EF3C23]">{d.dealReferenceId || d.id.slice(0, 12)}</td>
                          <td className="px-3 py-2.5">
                            <div className="flex max-w-[240px] items-center gap-2">
                              <Thumb src={d.listing?.image || (d.creative?.imageUrl as string | undefined)} alt={d.listing?.name || d.title} />
                              <div className="min-w-0">
                                <div className="truncate text-[12px] font-bold">{d.listing?.name || d.title}</div>
                                {d.listing && !d.listing.exists ? (
                                  <div className="text-[10px] font-bold text-[#B91C1C]">Listing missing</div>
                                ) : d.listing?.category ? (
                                  <div className="truncate text-[10.5px] text-[#9CA3AF]">{d.listing.category}</div>
                                ) : null}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2.5"><ListingTypeBadge type={d.listingType} /></td>
                          <td className="px-3 py-2.5 text-[11.5px]">
                            <div className="max-w-[160px] truncate font-semibold">{d.listing?.brandName || '—'}</div>
                            <div className="max-w-[160px] truncate font-mono text-[10px] text-[#9CA3AF]" title={d.ownerId}>{d.ownerRole} · {d.ownerId.slice(0, 10)}</div>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-[12px]">{money(t?.basePriceAtSubmit)}</td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-[12px]">
                            {d.listing?.exists ? money(d.listing.currentBasePrice) : '—'}
                            {drift !== null ? (
                              <div className={`text-[10px] font-extrabold ${Math.abs(drift) >= 5 ? 'text-[#B45309]' : 'text-[#6B7280]'}`} data-testid="base-price-drift">
                                {drift > 0 ? '▲' : '▼'} {Math.abs(drift).toFixed(1)}% since creation
                              </div>
                            ) : null}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-[12px] font-extrabold">
                            {money(d.currentDealPrice ?? t?.dealPriceAtSubmit)}
                            {t && d.currentPriceInvalidReason ? <div className="text-[10px] font-bold text-[#B91C1C]">Not applied now</div> : null}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-[11px]">{t ? DEAL_PRICING_MODE_LABEL[t.mode] : '—'}</td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-[11px]">{t ? formatDealDiscount(t.mode, t.value) : '—'}</td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-[11px] text-[#6B7280]">{fmtDateTime(d.startsAt)}</td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-[11px] text-[#6B7280]">{fmtDateTime(d.endsAt)}</td>
                          <td className="px-3 py-2.5"><DealStatusPill filterKey={d.filterKey} /></td>
                          <td className="px-3 py-2.5"><PromotionStatusPill summary={d.promotion?.latest} /></td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-[11px] text-[#6B7280]">{fmtDateTime(d.createdAt)}</td>
                          <td className="whitespace-nowrap px-3 py-2.5">
                            <div className="flex gap-1.5">
                              <IconBtn label="Review" onClick={() => setReviewingDeal(d)} icon={<Eye size={13} />} />
                              {acts.includes('pause') ? <IconBtn label="Pause" tone="amber" disabled={busyId === d.id} onClick={() => void moderate(d, 'pause')} icon={<Pause size={13} />} /> : null}
                              {acts.includes('resume') ? <IconBtn label="Resume" tone="green" disabled={busyId === d.id} onClick={() => void moderate(d, 'resume')} icon={<Play size={13} />} /> : null}
                              {acts.includes('disable') ? <IconBtn label="Disable" tone="red" disabled={busyId === d.id} onClick={() => void moderate(d, 'disable')} icon={<Slash size={13} />} /> : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <LegacyCatalogDeals rows={legacyDeals} error={legacyError} />
        </>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-2" role="tablist" aria-label="Promotion request filters">
            {PROMO_FILTERS.map((f) => (
              <button key={f.key} type="button" role="tab" aria-selected={promoFilter === f.key} data-promo-filter={f.key} onClick={() => setPromoFilter(f.key)} className={chipCls(promoFilter === f.key)}>
                {f.label} <span className="opacity-60">{promoCounts[f.key] || 0}</span>
              </button>
            ))}
          </div>
          <div className="mb-3 text-[11px] text-[#6B7280]">
            Approving or rejecting a request only changes its promotional visibility — the underlying deal stays live either way.
          </div>

          <div className="overflow-hidden rounded-lg border border-[#E8EDF2] bg-white">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1400px] border-collapse text-left" data-testid="promotion-requests-table">
                <thead>
                  <tr className="bg-[#F9FAFB]">
                    {['Reference', 'Deal', 'Listing', 'Seller', 'Promotion type', 'Requested period', 'Deal status', 'Seller note', 'Submitted', 'Status', 'Actions'].map((h) => (
                      <th key={h} className="whitespace-nowrap px-3 py-2.5 text-[10px] font-extrabold uppercase tracking-wide text-[#6B7280]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={11} className="px-3 py-10 text-center text-[12px] text-[#6B7280]"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading requests…</td></tr>
                  ) : filteredRequests.length === 0 ? (
                    <tr><td colSpan={11} className="px-3 py-10 text-center text-[12px] italic text-[#9CA3AF]">No promotion requests in this view.</td></tr>
                  ) : (
                    filteredRequests.map((r) => (
                      <tr key={r.id} className="border-t border-[#F1F3F5] align-top" data-request-id={r.id} style={{ opacity: busyId === r.id ? 0.55 : 1 }}>
                        <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[11px] font-bold text-[#EF3C23]">{r.advertisementReferenceId || r.id.slice(0, 12)}</td>
                        <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[11px] font-bold text-[#374151]">{r.deal?.dealReferenceId || '—'}</td>
                        <td className="max-w-[220px] px-3 py-2.5 text-[12px] font-bold"><div className="truncate">{r.deal?.listing?.name || r.title}</div></td>
                        <td className="px-3 py-2.5 text-[11.5px]">
                          <div className="max-w-[160px] truncate font-semibold">{r.deal?.listing?.brandName || '—'}</div>
                          <div className="max-w-[160px] truncate font-mono text-[10px] text-[#9CA3AF]" title={r.ownerId}>{r.ownerId.slice(0, 10)}</div>
                        </td>
                        <td className="px-3 py-2.5"><Pill tone={r.promotionType === 'sponsored' ? 'approved' : 'promoted'}>{PROMOTION_TYPE_LABEL[r.promotionType]}</Pill></td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-[11px] text-[#6B7280]">{fmtDateTime(r.startsAt)}<br />→ {fmtDateTime(r.endsAt)}</td>
                        <td className="px-3 py-2.5">{r.deal ? <DealStatusPill filterKey={r.deal.filterKey} /> : <span className="text-[11px] text-[#B91C1C]">Deal missing</span>}</td>
                        <td className="max-w-[220px] px-3 py-2.5 text-[11px] text-[#374151]"><div className="line-clamp-2">{r.sellerNote || '—'}</div></td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-[11px] text-[#6B7280]">{fmtDateTime(r.review?.submittedAt || r.createdAt)}</td>
                        <td className="px-3 py-2.5"><PromotionStatusPill summary={{ status: r.status, runState: r.runState }} /></td>
                        <td className="whitespace-nowrap px-3 py-2.5">
                          <div className="flex gap-1.5">
                            <IconBtn label="Review" onClick={() => openRequest(r)} icon={<Eye size={13} />} />
                            {r.status === 'pending' ? (
                              <>
                                <IconBtn label="Approve" tone="green" disabled={busyId === r.id} onClick={() => void decide(r, 'approve')} icon={<CheckCircle size={13} />} />
                                <IconBtn label="Reject" tone="red" disabled={busyId === r.id} onClick={() => openRequest(r, true)} icon={<XCircle size={13} />} />
                              </>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {reviewingDeal ? (
        <DealReviewPanel deal={reviewingDeal} busy={busyId === reviewingDeal.id} onClose={() => setReviewingDeal(null)} onAction={(a) => void moderate(reviewingDeal, a)} />
      ) : null}
      {reviewingRequest ? (
        <PromotionReviewPanel
          request={reviewingRequest}
          busy={busyId === reviewingRequest.id}
          rejectMode={rejectMode}
          rejectReason={rejectReason}
          onRejectMode={setRejectMode}
          onRejectReason={setRejectReason}
          onClose={() => setReviewingRequest(null)}
          onDecide={(a, reason) => void decide(reviewingRequest, a, reason)}
        />
      ) : null}
    </div>
  );
}

function LegacyCatalogDeals({ rows, error }: { rows: CatalogDeal[] | null; error: string | null }) {
  return (
    <div className="mt-8" data-testid="legacy-catalog-deals">
      <div className="mb-2 flex flex-wrap items-baseline gap-2">
        <span className="text-[13px] font-extrabold">Legacy catalog deals</span>
        <span className="rounded-full bg-[#F5F5F4] px-2 py-0.5 text-[9.5px] font-extrabold uppercase text-[#57534E]">Legacy — not priced · read-only</span>
      </div>
      <div className="mb-2 text-[11px] text-[#6B7280]">
        Historical free-text deals kept for reference. They cannot be edited, promoted or used as storefront deals.
      </div>
      {error ? <div className="text-[12px] font-semibold text-red-700">{error}</div> : null}
      <div className="overflow-hidden rounded-lg border border-[#E8EDF2] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead>
              <tr className="bg-[#F9FAFB]">
                {['Deal', 'Seller', 'Discount', 'Valid from', 'Valid until', 'Stored status'].map((h) => (
                  <th key={h} className="whitespace-nowrap px-3 py-2.5 text-[10px] font-extrabold uppercase tracking-wide text-[#6B7280]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!rows ? (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-[12px] text-[#6B7280]"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-[12px] italic text-[#9CA3AF]">No legacy catalog deals.</td></tr>
              ) : (
                rows.map((l) => (
                  <tr key={l.id} className="border-t border-[#F1F3F5]">
                    <td className="max-w-[260px] truncate px-3 py-2.5 text-[12px] font-bold">{l.name}</td>
                    <td className="px-3 py-2.5 text-[12px] text-[#6B7280]">{l.seller || '—'}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-[11px]">{l.discountType === 'flat' ? `৳${l.discountValue} off` : `${l.discountValue}% off`}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-[11px] text-[#6B7280]">{fmtDateTime(l.validFrom)}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-[11px] text-[#6B7280]">{fmtDateTime(l.validUntil)}</td>
                    <td className="px-3 py-2.5 text-[11px] uppercase text-[#6B7280]">{l.status}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function IconBtn({ label, icon, onClick, disabled, tone }: { label: string; icon: React.ReactNode; onClick: () => void; disabled?: boolean; tone?: 'green' | 'red' | 'amber' }) {
  const color = tone === 'green' ? '#16A34A' : tone === 'red' ? '#DC2626' : tone === 'amber' ? '#B45309' : '#374151';
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="inline-flex items-center gap-1 rounded-md border border-[#E8EDF2] bg-white px-2 py-1 text-[10px] font-extrabold disabled:opacity-50" style={{ color }}>
      {icon} {label}
    </button>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-[#F1F3F5] py-1.5 text-[12px]">
      <span className="shrink-0 font-semibold text-[#6B7280]">{k}</span>
      <span className="min-w-0 text-right font-bold text-[#111827]">{v}</span>
    </div>
  );
}

function Drawer({ label, onClose, children, testId }: { label: string; onClose: () => void; children: React.ReactNode; testId: string }) {
  return (
    <div className="fixed inset-0 z-[90] flex justify-end bg-black/30" onClick={onClose} role="dialog" aria-label={label}>
      <div className="h-full w-full max-w-[460px] overflow-y-auto bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()} data-testid={testId}>
        {children}
      </div>
    </div>
  );
}

function DrawerHeader({ reference, title, onClose }: { reference?: string; title: string; onClose: () => void }) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="font-mono text-[11px] font-bold text-[#EF3C23]">{reference}</div>
        <div className="truncate text-[14px] font-extrabold">{title}</div>
      </div>
      <button type="button" onClick={onClose} aria-label="Close" className="rounded-md border border-[#E8EDF2] p-1.5"><X size={14} /></button>
    </div>
  );
}

function DealFacts({ deal: d }: { deal: DealRecord }) {
  const t = d.dealTerms;
  const drift = basePriceDrift(d);
  return (
    <>
      <Row k="Seller" v={<>{d.listing?.brandName || '—'} <span className="block font-mono text-[10px] text-[#9CA3AF]">{d.ownerId}</span></>} />
      <Row k="Listing status" v={d.listing ? (d.listing.exists ? d.listing.status : 'missing') : '—'} />
      <Row k="Base price at creation" v={money(t?.basePriceAtSubmit)} />
      <Row
        k="Current base price"
        v={
          <>
            {d.listing?.exists ? money(d.listing.currentBasePrice) : '—'}
            {drift !== null ? (
              <span className={`block text-[10.5px] ${Math.abs(drift) >= 5 ? 'text-[#B45309]' : 'text-[#6B7280]'}`}>
                {drift > 0 ? '▲' : '▼'} {Math.abs(drift).toFixed(1)}% since creation
              </span>
            ) : null}
          </>
        }
      />
      <Row k="Pricing mode" v={t ? DEAL_PRICING_MODE_LABEL[t.mode] : '—'} />
      <Row k="Discount / special" v={t ? formatDealDiscount(t.mode, t.value) : '—'} />
      <Row k="Deal price (current base)" v={d.currentPriceInvalidReason ? <span className="text-[#B91C1C]">{d.currentPriceInvalidReason}</span> : money(d.currentDealPrice ?? t?.dealPriceAtSubmit)} />
      <Row k="Deal start" v={fmtDateTime(d.startsAt)} />
      <Row k="Deal end" v={fmtDateTime(d.endsAt)} />
    </>
  );
}

function DealReviewPanel({ deal: d, busy, onClose, onAction }: { deal: DealRecord; busy: boolean; onClose: () => void; onAction: (a: DealAction) => void }) {
  const acts = dealActionsFor(d);
  return (
    <Drawer label="Review deal" onClose={onClose} testId="deal-review-panel">
      <DrawerHeader reference={d.dealReferenceId || d.id} title={d.listing?.name || d.title} onClose={onClose} />
      <div className="mb-3 flex flex-wrap gap-2">
        <DealStatusPill filterKey={d.filterKey} />
        <ListingTypeBadge type={d.listingType} />
        <PromotionStatusPill summary={d.promotion?.latest} />
      </div>
      {d.legacy ? (
        <div className="mb-3 rounded-lg bg-[#F5F5F4] px-3 py-2 text-[11.5px] text-[#57534E]">
          Legacy deal created before canonical Deals — no listing type, pricing terms or schedule. It can only be disabled.
        </div>
      ) : null}
      <DealFacts deal={d} />
      <Row k="Created" v={fmtDateTime(d.createdAt)} />
      <div className="mt-4 flex flex-wrap gap-2">
        {acts.includes('pause') ? <button type="button" disabled={busy} onClick={() => onAction('pause')} className="rounded-lg border border-[#FDE68A] px-3 py-2 text-[11.5px] font-extrabold text-[#B45309]">Pause</button> : null}
        {acts.includes('resume') ? <button type="button" disabled={busy} onClick={() => onAction('resume')} className="rounded-lg bg-[#16A34A] px-3 py-2 text-[11.5px] font-extrabold text-white disabled:opacity-50">Resume</button> : null}
        {acts.includes('disable') ? <button type="button" disabled={busy} onClick={() => onAction('disable')} className="rounded-lg border border-[#E8EDF2] px-3 py-2 text-[11.5px] font-extrabold text-[#6B7280]">Disable</button> : null}
      </div>
      <p className="mt-4 text-[10.5px] text-[#9CA3AF]">
        Deals do not need approval. Pause, Resume and Disable are exceptional moderation controls. Deals have no storefront pricing effect in this release.
      </p>
    </Drawer>
  );
}

function PromotionReviewPanel({
  request: r,
  busy,
  rejectMode,
  rejectReason,
  onRejectMode,
  onRejectReason,
  onClose,
  onDecide,
}: {
  request: PromotionRequestRecord;
  busy: boolean;
  rejectMode: boolean;
  rejectReason: string;
  onRejectMode: (v: boolean) => void;
  onRejectReason: (v: string) => void;
  onClose: () => void;
  onDecide: (a: 'approve' | 'reject', reason?: string) => void;
}) {
  const pending = r.status === 'pending';
  return (
    <Drawer label="Review promotion request" onClose={onClose} testId="promotion-review-panel">
      <DrawerHeader reference={r.advertisementReferenceId || r.id} title={`${PROMOTION_TYPE_LABEL[r.promotionType]} promotion · ${r.deal?.listing?.name || r.title}`} onClose={onClose} />
      <div className="mb-3 flex flex-wrap gap-2">
        <PromotionStatusPill summary={{ status: r.status, runState: r.runState }} />
        {r.deal ? <DealStatusPill filterKey={r.deal.filterKey} /> : null}
        <ListingTypeBadge type={r.listingType} />
      </div>
      {r.promotionType === 'sponsored' ? (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11.5px] font-semibold text-amber-800">
          Sponsored (paid) request. Billing is not implemented: approval records the decision and the request stays “awaiting fulfillment”. No payment has been taken.
        </div>
      ) : null}
      <div className="mb-1 text-[10px] font-extrabold uppercase tracking-wide text-[#6B7280]">Promotion request</div>
      <Row k="Type" v={PROMOTION_TYPE_LABEL[r.promotionType]} />
      <Row k="Requested start" v={fmtDateTime(r.startsAt)} />
      <Row k="Requested end" v={fmtDateTime(r.endsAt)} />
      <Row k="Seller note" v={r.sellerNote ? <span className="whitespace-pre-wrap font-semibold">{r.sellerNote}</span> : '—'} />
      <Row k="Submitted" v={fmtDateTime(r.review?.submittedAt || r.createdAt)} />
      {r.review?.decidedAt ? <Row k="Decided" v={fmtDateTime(r.review.decidedAt)} /> : null}
      {r.review?.rejectionReason ? <Row k="Rejection reason" v={<span className="text-[#B91C1C]">{r.review.rejectionReason}</span>} /> : null}
      <div className="mb-1 mt-4 text-[10px] font-extrabold uppercase tracking-wide text-[#6B7280]">Underlying deal {r.deal?.dealReferenceId || ''}</div>
      {r.deal ? <DealFacts deal={r.deal} /> : <div className="text-[12px] text-[#B91C1C]">The deal no longer exists.</div>}
      <Row k="Listing rating" v={r.listingRating ? `${r.listingRating.average} ★ (${r.listingRating.count} review${r.listingRating.count === 1 ? '' : 's'})` : 'No reviews yet'} />

      {pending && rejectMode ? (
        <div className="mt-4">
          <label htmlFor="reject-reason" className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-wide text-[#6B7280]">
            Rejection reason (shown to the seller)
          </label>
          <textarea
            id="reject-reason"
            value={rejectReason}
            maxLength={REJECTION_REASON_MAX}
            onChange={(e) => onRejectReason(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-[#E8EDF2] p-2.5 text-[12.5px] outline-none"
          />
          <div className="mt-2 flex gap-2">
            <button type="button" disabled={busy || !rejectReason.trim()} onClick={() => onDecide('reject', rejectReason.trim())} className="rounded-lg bg-[#DC2626] px-3 py-2 text-[11.5px] font-extrabold text-white disabled:opacity-50">
              Confirm rejection
            </button>
            <button type="button" onClick={() => onRejectMode(false)} className="rounded-lg border border-[#E8EDF2] px-3 py-2 text-[11.5px] font-extrabold">Cancel</button>
          </div>
        </div>
      ) : pending ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => onDecide('approve')} className="rounded-lg bg-[#16A34A] px-3 py-2 text-[11.5px] font-extrabold text-white disabled:opacity-50">
            Approve promotion
          </button>
          <button type="button" disabled={busy} onClick={() => onRejectMode(true)} className="rounded-lg border border-[#FECACA] px-3 py-2 text-[11.5px] font-extrabold text-[#DC2626]">
            Reject…
          </button>
        </div>
      ) : null}
      <p className="mt-4 text-[10.5px] text-[#9CA3AF]">
        Approval re-checks that the deal is still active, validly priced, and that the period fits the deal. Rejecting never affects the deal.
      </p>
    </Drawer>
  );
}
