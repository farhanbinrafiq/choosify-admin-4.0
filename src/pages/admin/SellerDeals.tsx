/**
 * Seller Deals — Ads & Deals Studio → Deals.
 *
 * Deals are open marketplace inventory: Create Deal (Step 1 select an existing
 * owned product/service → Step 2 configure pricing + schedule) creates the deal
 * immediately; it goes live and ends automatically by its dates. There is no
 * approval. The only reviewed workflow is "Request Promotion" (Featured /
 * Sponsored) for a currently Active deal — the deal stays live either way.
 *
 * Prices shown here are PREVIEWS; the server derives the deal price from the
 * listing's current base price and is authoritative. Deals have no
 * storefront/cart/checkout pricing effect yet.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2, Megaphone, Plus, Search, X } from 'lucide-react';
import {
  computeDealPrice,
  DEAL_PRICING_MODES,
  DEAL_PRICING_MODE_LABEL,
  formatDealDiscount,
  isLongDeal,
  LONG_DEAL_WARNING_TEXT,
  PROMOTION_TYPE_LABEL,
  PROMOTION_TYPES,
  SELLER_NOTE_MAX,
  type DealPricingMode,
  type PromotionType,
} from '@/shared/deals/dealPricing';
import {
  adsApi,
  type DealEligibleListing,
  type DealRecord,
  type DealSubmissionBody,
} from '../../services/adsApi';
import {
  DealStatusPill,
  dhakaLocalToIso,
  fmtDateTime,
  isoToDhakaLocal,
  ListingTypeBadge,
  money,
  PromotionStatusPill,
  Thumb,
} from '../../components/deals/dealDisplay';

type View = 'list' | 'pick' | 'configure' | 'done';
type TypeFilter = 'all' | 'product' | 'service';
type Confirm = { id: string; action: 'end' | 'withdraw' | 'cancelPromotion'; promotionId?: string } | null;

const inputCls =
  'h-10 w-full rounded-lg border border-[#E8EDF2] bg-white px-3 text-[12.5px] text-[#111827] outline-none focus:border-[#EF3C23]';
const labelCls = 'mb-1.5 block text-[10px] font-extrabold uppercase tracking-wide text-[#6B7280]';

function endsInLabel(iso?: string): string {
  if (!iso) return '';
  const ms = Date.parse(iso) - Date.now();
  if (ms <= 0) return '';
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return `Ends in ${Math.max(1, Math.floor(ms / 60_000))} min`;
  if (h < 48) return `Ends in ${h} h`;
  return `Ends in ${Math.floor(h / 24)} days`;
}

export default function SellerDeals() {
  const [view, setView] = useState<View>('list');
  const [doneMessage, setDoneMessage] = useState<{ title: string; body: string }>({ title: '', body: '' });
  const [deals, setDeals] = useState<DealRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [listings, setListings] = useState<DealEligibleListing[] | null>(null);
  const [listingsError, setListingsError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');

  const [editing, setEditing] = useState<DealRecord | null>(null);
  const [selected, setSelected] = useState<DealEligibleListing | null>(null);
  const [mode, setMode] = useState<DealPricingMode>('percentage');
  const [valueText, setValueText] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('00:00');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('23:59');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [viewing, setViewing] = useState<DealRecord | null>(null);
  const [promoting, setPromoting] = useState<DealRecord | null>(null);

  const loadDeals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDeals(await adsApi.listDeals());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load deals');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDeals();
  }, [loadDeals]);

  const loadListings = useCallback(async () => {
    setListingsError(null);
    try {
      setListings(await adsApi.listDealEligibleListings());
    } catch (err) {
      setListings([]);
      setListingsError(err instanceof Error ? err.message : 'Failed to load your listings');
    }
  }, []);

  const resetForm = () => {
    setEditing(null);
    setSelected(null);
    setMode('percentage');
    setValueText('');
    setStartDate('');
    setStartTime('00:00');
    setEndDate('');
    setEndTime('23:59');
    setFormError(null);
  };

  const startCreate = () => {
    resetForm();
    setNotice(null);
    setView('pick');
    if (!listings) void loadListings();
  };

  /** Edit is only offered for Scheduled deals; the listing stays fixed. */
  const startEdit = (deal: DealRecord) => {
    resetForm();
    setEditing(deal);
    setSelected({
      id: deal.listingId || '',
      listingType: deal.listingType || 'product',
      title: deal.listing?.name || deal.title,
      image: deal.listing?.image,
      category: deal.listing?.category,
      brandName: deal.listing?.brandName,
      basePrice: deal.listing?.currentBasePrice ?? deal.dealTerms?.basePriceAtSubmit ?? 0,
      status: deal.listing?.status || '',
      selectable: true,
    });
    if (deal.dealTerms) {
      setMode(deal.dealTerms.mode);
      setValueText(String(deal.dealTerms.value));
    }
    const s = isoToDhakaLocal(deal.startsAt);
    const e = isoToDhakaLocal(deal.endsAt);
    setStartDate(s.date);
    setStartTime(s.time || '00:00');
    setEndDate(e.date);
    setEndTime(e.time || '23:59');
    setView('configure');
  };

  const filteredListings = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (listings || []).filter(
      (l) =>
        (typeFilter === 'all' || l.listingType === typeFilter) &&
        (!q || l.title.toLowerCase().includes(q) || (l.category || '').toLowerCase().includes(q)),
    );
  }, [listings, query, typeFilter]);

  const value = valueText.trim() === '' ? Number.NaN : Number(valueText);
  const preview = selected && Number.isFinite(value) ? computeDealPrice(mode, value, selected.basePrice) : null;
  const startsAt = dhakaLocalToIso(startDate, startTime);
  const endsAt = dhakaLocalToIso(endDate, endTime);
  const longDeal = startsAt && endsAt && Date.parse(startsAt) < Date.parse(endsAt) ? isLongDeal(startsAt, endsAt) : false;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    if (!Number.isFinite(value)) return setFormError('Enter a numeric value.');
    if (!startsAt || !endsAt) return setFormError('Enter a valid start and end date/time.');
    setSubmitting(true);
    setFormError(null);
    try {
      let saved;
      if (editing) {
        saved = await adsApi.updateDeal(editing.id, { pricingMode: mode, pricingValue: value, startsAt, endsAt });
      } else {
        const body: DealSubmissionBody = {
          listingType: selected.listingType,
          listingId: selected.id,
          pricingMode: mode,
          pricingValue: value,
          startsAt,
          endsAt,
        };
        saved = await adsApi.createDeal(body);
      }
      const future = saved.startsAt && Date.parse(saved.startsAt) > Date.now();
      setDoneMessage(
        future
          ? {
              title: editing ? 'Deal updated' : 'Deal scheduled',
              body: `Goes live automatically on ${fmtDateTime(saved.startsAt)} and ends on ${fmtDateTime(saved.endsAt)}.`,
            }
          : { title: 'Your deal is live.', body: `It ends automatically on ${fmtDateTime(saved.endsAt)}.` },
      );
      await loadDeals();
      setView('done');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save the deal');
    } finally {
      setSubmitting(false);
    }
  };

  const runConfirmed = async () => {
    if (!confirm) return;
    const { id, action, promotionId } = confirm;
    setBusyId(id);
    setError(null);
    try {
      if (action === 'end') await adsApi.endDeal(id);
      if (action === 'withdraw') await adsApi.withdrawDeal(id);
      if (action === 'cancelPromotion' && promotionId) await adsApi.cancelPromotionRequest(promotionId);
      setNotice(
        action === 'end' ? 'Deal ended.' : action === 'withdraw' ? 'Deal withdrawn.' : 'Promotion request cancelled.',
      );
      await loadDeals();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusyId(null);
      setConfirm(null);
    }
  };

  // ── Created / updated confirmation ──
  if (view === 'done') {
    return (
      <div className="rounded-lg border border-[#E8EDF2] bg-white p-6 text-center" data-testid="deal-saved">
        <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-[#16A34A]" />
        <div className="text-[15px] font-extrabold text-[#111827]">{doneMessage.title}</div>
        <p className="mx-auto mt-1 max-w-md text-[12px] text-[#6B7280]">{doneMessage.body}</p>
        <button
          type="button"
          onClick={() => {
            resetForm();
            setView('list');
          }}
          className="mt-4 rounded-lg bg-[#111827] px-4 py-2 text-[12px] font-extrabold text-white"
        >
          View My Deals
        </button>
      </div>
    );
  }

  // ── Step 1 — select an existing listing ──
  if (view === 'pick') {
    return (
      <div>
        <StepHeader
          step={1}
          title="Select an existing listing"
          subtitle="Deals are created on your own live products and services. There is no free-text deal."
          onBack={() => {
            resetForm();
            setView('list');
          }}
        />
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[#9CA3AF]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your listings…"
              className={`${inputCls} pl-9`}
              aria-label="Search listings"
            />
          </div>
          {(['all', 'product', 'service'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTypeFilter(t)}
              className={`rounded-full px-3 py-1.5 text-[10px] font-extrabold ${
                typeFilter === t ? 'bg-[#111827] text-white' : 'bg-[#F3F4F6] text-[#374151]'
              }`}
            >
              {t === 'all' ? 'All' : t === 'product' ? 'Products' : 'Services'}
            </button>
          ))}
        </div>
        {listingsError ? <ErrorBox message={listingsError} /> : null}
        {!listings ? (
          <Loading label="Loading your listings…" />
        ) : filteredListings.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[#E8EDF2] bg-white px-4 py-10 text-center text-[12px] text-[#9CA3AF]">
            {listings.length === 0
              ? 'You have no products or services yet. Create a listing first, then create a deal on it.'
              : 'No listings match your search.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3" data-testid="deal-listing-picker">
            {filteredListings.map((l) => (
              <button
                key={`${l.listingType}:${l.id}`}
                type="button"
                disabled={!l.selectable}
                onClick={() => {
                  setSelected(l);
                  setView('configure');
                }}
                data-listing-type={l.listingType}
                className={`flex min-w-0 items-center gap-3 rounded-lg border bg-white p-3 text-left transition ${
                  l.selectable
                    ? 'border-[#E8EDF2] hover:border-[#EF3C23]'
                    : 'cursor-not-allowed border-[#F1F3F5] opacity-55'
                }`}
              >
                <Thumb src={l.image} alt={l.title} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px] font-bold text-[#111827]">{l.title}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10.5px] text-[#6B7280]">
                    <ListingTypeBadge type={l.listingType} />
                    <span className="truncate">{l.category || 'Uncategorised'}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="font-extrabold text-[#111827]">{money(l.basePrice)}</span>
                    <span className="rounded bg-[#F3F4F6] px-1.5 py-0.5 text-[9.5px] font-bold uppercase text-[#374151]">
                      {l.status || 'unknown'}
                    </span>
                    {l.reason ? <span className="text-[10px] font-semibold text-[#B45309]">{l.reason}</span> : null}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Step 2 — configure (also used to edit a Scheduled deal) ──
  if (view === 'configure' && selected) {
    const modeDef = DEAL_PRICING_MODES.find((m) => m.key === mode)!;
    return (
      <form onSubmit={submit}>
        <StepHeader
          step={editing ? undefined : 2}
          title={editing ? `Edit scheduled deal ${editing.dealReferenceId || ''}` : 'Configure deal'}
          subtitle={
            editing
              ? 'You can change the pricing and dates until the deal starts. The listing stays the same.'
              : 'Choose how the deal is priced and when it runs.'
          }
          onBack={() => {
            if (editing) {
              resetForm();
              setView('list');
            } else setView('pick');
          }}
          backLabel={editing ? 'Back to My Deals' : 'Change listing'}
        />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
          <div className="min-w-0 space-y-4 rounded-lg border border-[#E8EDF2] bg-white p-4">
            <div className="flex min-w-0 items-center gap-3 rounded-lg bg-[#F9FAFB] p-3">
              <Thumb src={selected.image} alt={selected.title} />
              <div className="min-w-0">
                <div className="truncate text-[12.5px] font-bold">{selected.title}</div>
                <div className="mt-0.5 flex items-center gap-1.5 text-[10.5px] text-[#6B7280]">
                  <ListingTypeBadge type={selected.listingType} /> {selected.category || ''}
                </div>
              </div>
            </div>

            <div>
              <span className={labelCls}>Pricing mode</span>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="radiogroup">
                {DEAL_PRICING_MODES.map((m) => (
                  <label
                    key={m.key}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-[12px] font-bold ${
                      mode === m.key ? 'border-[#EF3C23] bg-[#FFF5F3] text-[#111827]' : 'border-[#E8EDF2] text-[#374151]'
                    }`}
                  >
                    <input type="radio" name="pricingMode" value={m.key} checked={mode === m.key} onChange={() => setMode(m.key)} />
                    {m.label}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className={labelCls} htmlFor="deal-value">
                {modeDef.valueLabel}
              </label>
              <input
                id="deal-value"
                type="number"
                inputMode="decimal"
                step="any"
                min={0}
                value={valueText}
                onChange={(e) => setValueText(e.target.value)}
                className={inputCls}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls} htmlFor="deal-start-date">Start date</label>
                <input id="deal-start-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} required />
              </div>
              <div>
                <label className={labelCls} htmlFor="deal-start-time">Start time</label>
                <input id="deal-start-time" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputCls} required />
              </div>
              <div>
                <label className={labelCls} htmlFor="deal-end-date">End date</label>
                <input id="deal-end-date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} required />
              </div>
              <div>
                <label className={labelCls} htmlFor="deal-end-time">End time</label>
                <input id="deal-end-time" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputCls} required />
              </div>
            </div>
            <div className="text-[10.5px] text-[#9CA3AF]">
              Times are Bangladesh time (Asia/Dhaka). The deal goes live automatically at the start time and ends automatically.
            </div>

            {longDeal ? (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11.5px] font-semibold text-amber-800" data-testid="long-deal-warning">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {LONG_DEAL_WARNING_TEXT}
              </div>
            ) : null}
          </div>

          <div className="min-w-0 space-y-3">
            <div className="rounded-lg border border-[#E8EDF2] bg-white p-4" data-testid="deal-preview">
              <div className="flex items-center justify-between text-[12px]">
                <span className="font-semibold text-[#6B7280]">Base Price</span>
                <span className="font-extrabold text-[#111827]">{money(selected.basePrice)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-[12px]">
                <span className="font-semibold text-[#6B7280]">Deal Price Preview</span>
                <span className="text-[16px] font-extrabold text-[#EF3C23]">{preview && preview.ok ? money(preview.value) : '—'}</span>
              </div>
              {preview && preview.ok === false ? <div className="mt-2 text-[11px] font-semibold text-[#B91C1C]">{preview.error}</div> : null}
              <div className="mt-3 border-t border-[#F1F3F5] pt-2 text-[10.5px] text-[#6B7280]">
                Preview — final price is calculated and confirmed by the server.
              </div>
            </div>
            {formError ? <ErrorBox message={formError} /> : null}
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-[#EF3C23] to-[#D4331B] px-4 py-3 text-[12.5px] font-extrabold text-white disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {editing ? 'Save changes' : 'Create Deal'}
            </button>
          </div>
        </div>
      </form>
    );
  }

  // ── My Deals ──
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[13px] font-extrabold text-[#111827]">My Deals</div>
          <div className="text-[11px] font-semibold text-[#6B7280]">
            Deals go live automatically at their start time and end automatically. Promotion is optional and reviewed separately.
          </div>
        </div>
        <button
          type="button"
          onClick={startCreate}
          className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#EF3C23] to-[#D4331B] px-4 py-2.5 text-[12px] font-extrabold text-white"
        >
          <Plus className="h-4 w-4" /> Create Deal
        </button>
      </div>
      {error ? <ErrorBox message={error} /> : null}
      {notice ? (
        <div className="mb-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-[12px] font-semibold text-green-800" role="status" data-testid="seller-notice">
          {notice}
        </div>
      ) : null}
      {loading ? (
        <Loading label="Loading deals…" />
      ) : (
        <div className="overflow-hidden rounded-[5px] border border-[#E8EDF2] bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] border-collapse text-left" data-testid="my-deals-table">
              <thead>
                <tr className="bg-[#F9FAFB]">
                  {['Reference', 'Listing', 'Type', 'Base price', 'Deal price', 'Pricing mode', 'Discount / special', 'Start', 'End', 'Status', 'Promotion', 'Actions'].map((h) => (
                    <th key={h} className="whitespace-nowrap px-3 py-2.5 text-[10px] font-extrabold uppercase tracking-wide text-[#6B7280]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {deals.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-3 py-8 text-center text-[12px] text-[#9CA3AF]">
                      No deals yet. Click Create Deal to start.
                    </td>
                  </tr>
                ) : (
                  deals.map((d) => {
                    const t = d.dealTerms;
                    const latest = d.promotion?.latest;
                    const pendingPromotion = latest?.status === 'pending' ? latest : undefined;
                    const confirming = confirm?.id === d.id ? confirm : null;
                    return (
                      <tr key={d.id} className="border-t border-[#F1F3F5] align-top" data-deal-id={d.id}>
                        <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[11px] font-bold text-[#EF3C23]">
                          {d.dealReferenceId || d.id.slice(0, 12)}
                        </td>
                        <td className="max-w-[220px] px-3 py-2.5 text-[12px] font-bold text-[#111827]">
                          <div className="truncate">{d.listing?.name || d.title}</div>
                        </td>
                        <td className="px-3 py-2.5"><ListingTypeBadge type={d.listingType} /></td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-[12px]">{money(d.listing?.exists ? d.listing.currentBasePrice : t?.basePriceAtSubmit)}</td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-[12px] font-extrabold">
                          {money(d.currentDealPrice ?? t?.dealPriceAtSubmit)}
                          {t && d.currentPriceInvalidReason ? (
                            <div className="text-[10px] font-bold text-[#B91C1C]" title={d.currentPriceInvalidReason}>Not applied — base price changed</div>
                          ) : null}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-[11px]">{t ? DEAL_PRICING_MODE_LABEL[t.mode] : '—'}</td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-[11px]">{t ? formatDealDiscount(t.mode, t.value) : '—'}</td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-[11px] text-[#6B7280]">{fmtDateTime(d.startsAt)}</td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-[11px] text-[#6B7280]">
                          {fmtDateTime(d.endsAt)}
                          {d.timeState === 'active' ? <div className="text-[10px] font-bold text-[#166534]">{endsInLabel(d.endsAt)}</div> : null}
                        </td>
                        <td className="px-3 py-2.5" data-testid="deal-status"><DealStatusPill filterKey={d.filterKey} /></td>
                        <td className="px-3 py-2.5" data-testid="deal-promotion">
                          <PromotionStatusPill summary={latest} />
                          {latest?.status === 'rejected' && latest.rejectionReason ? (
                            <div className="mt-1 max-w-[200px] text-[10px] font-semibold text-[#B91C1C]" data-testid="promotion-rejection-reason">
                              {latest.rejectionReason}
                            </div>
                          ) : null}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5">
                          {confirming ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold text-[#374151]">
                                {confirming.action === 'end' ? 'End now?' : confirming.action === 'withdraw' ? 'Withdraw?' : 'Cancel request?'}
                              </span>
                              <SmallBtn tone="red" disabled={busyId === d.id} onClick={() => void runConfirmed()}>Confirm</SmallBtn>
                              <SmallBtn onClick={() => setConfirm(null)}>Keep</SmallBtn>
                            </div>
                          ) : (
                            <div className="flex gap-1.5">
                              <SmallBtn onClick={() => setViewing(d)}>View</SmallBtn>
                              {d.filterKey === 'scheduled' ? (
                                <>
                                  <SmallBtn onClick={() => startEdit(d)}>Edit</SmallBtn>
                                  <SmallBtn onClick={() => setConfirm({ id: d.id, action: 'end' })}>End Now</SmallBtn>
                                  <SmallBtn tone="red" onClick={() => setConfirm({ id: d.id, action: 'withdraw' })}>Withdraw</SmallBtn>
                                </>
                              ) : null}
                              {d.filterKey === 'active' ? (
                                <>
                                  <SmallBtn onClick={() => setConfirm({ id: d.id, action: 'end' })}>End Now</SmallBtn>
                                  {pendingPromotion ? (
                                    <SmallBtn tone="red" onClick={() => setConfirm({ id: d.id, action: 'cancelPromotion', promotionId: pendingPromotion.id })}>
                                      Cancel Request
                                    </SmallBtn>
                                  ) : (
                                    <SmallBtn tone="accent" onClick={() => setPromoting(d)}>
                                      <Megaphone className="h-3 w-3" /> Request Promotion
                                    </SmallBtn>
                                  )}
                                </>
                              ) : null}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <p className="mt-2 text-[10.5px] text-[#9CA3AF]">
        Deals are recorded now; storefront display and deal pricing switch on in a later release.
      </p>

      {viewing ? <DealDetailsModal deal={viewing} onClose={() => setViewing(null)} /> : null}
      {promoting ? (
        <PromotionRequestDialog
          deal={promoting}
          onClose={() => setPromoting(null)}
          onSubmitted={async () => {
            await loadDeals();
          }}
        />
      ) : null}
    </div>
  );
}

function DealDetailsModal({ deal: d, onClose }: { deal: DealRecord; onClose: () => void }) {
  const t = d.dealTerms;
  const p = d.promotion?.latest;
  return (
    <Modal title={`${d.dealReferenceId || 'Deal'} · ${d.listing?.name || d.title}`} onClose={onClose} testId="seller-deal-details">
      <div className="mb-3 flex flex-wrap gap-2">
        <DealStatusPill filterKey={d.filterKey} />
        <ListingTypeBadge type={d.listingType} />
      </div>
      <KV k="Base price" v={money(d.listing?.exists ? d.listing.currentBasePrice : t?.basePriceAtSubmit)} />
      <KV k="Deal price" v={money(d.currentDealPrice ?? t?.dealPriceAtSubmit)} />
      <KV k="Pricing mode" v={t ? DEAL_PRICING_MODE_LABEL[t.mode] : '—'} />
      <KV k="Discount / special" v={t ? formatDealDiscount(t.mode, t.value) : '—'} />
      <KV k="Start" v={fmtDateTime(d.startsAt)} />
      <KV k="End" v={fmtDateTime(d.endsAt)} />
      <KV k="Promotion" v={<PromotionStatusPill summary={p} />} />
      {p ? <KV k="Promotion type" v={p.promotionType ? PROMOTION_TYPE_LABEL[p.promotionType] : '—'} /> : null}
      {p ? <KV k="Promotion period" v={`${fmtDateTime(p.startsAt)} → ${fmtDateTime(p.endsAt)}`} /> : null}
      {p?.rejectionReason ? <KV k="Not approved because" v={<span className="text-[#B91C1C]">{p.rejectionReason}</span>} /> : null}
      {d.currentPriceInvalidReason ? (
        <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[11.5px] font-semibold text-amber-800">
          This deal is not applied right now: {d.currentPriceInvalidReason}
        </div>
      ) : null}
    </Modal>
  );
}

function PromotionRequestDialog({
  deal: d,
  onClose,
  onSubmitted,
}: {
  deal: DealRecord;
  onClose: () => void;
  onSubmitted: () => Promise<void>;
}) {
  const t = d.dealTerms;
  const nowLocal = isoToDhakaLocal(new Date(Date.now() + 5 * 60_000).toISOString());
  const endLocal = isoToDhakaLocal(d.endsAt);
  const [type, setType] = useState<PromotionType>('featured');
  const [startDate, setStartDate] = useState(nowLocal.date);
  const [startTime, setStartTime] = useState(nowLocal.time);
  const [endDate, setEndDate] = useState(endLocal.date);
  const [endTime, setEndTime] = useState(endLocal.time);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const startsAt = dhakaLocalToIso(startDate, startTime);
    const endsAt = dhakaLocalToIso(endDate, endTime);
    if (!startsAt || !endsAt) return setErr('Enter a valid promotion start and end.');
    setBusy(true);
    setErr(null);
    try {
      await adsApi.requestPromotion(d.id, { promotionType: type, startsAt, endsAt, sellerNote: note.trim() || undefined });
      await onSubmitted();
      setDone(true);
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Could not submit the request');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Request Promotion" onClose={onClose} testId="promotion-dialog">
      {done ? (
        <div className="py-4 text-center" data-testid="promotion-submitted">
          <CheckCircle2 className="mx-auto mb-2 h-7 w-7 text-[#16A34A]" />
          <div className="text-[14px] font-extrabold text-[#111827]">Promotion request submitted for review.</div>
          <p className="mt-1 text-[12px] text-[#6B7280]">Your Deal remains active while your promotion request is reviewed.</p>
          <button type="button" onClick={onClose} className="mt-4 rounded-lg bg-[#111827] px-4 py-2 text-[12px] font-extrabold text-white">
            Done
          </button>
        </div>
      ) : (
        <form onSubmit={submit}>
          <div className="mb-3 rounded-lg bg-[#F9FAFB] p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-[12.5px] font-bold">{d.listing?.name || d.title}</div>
                <div className="font-mono text-[10.5px] text-[#EF3C23]">{d.dealReferenceId}</div>
              </div>
              <DealStatusPill filterKey={d.filterKey} />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-[#374151]">
              <span>Deal price</span>
              <span className="text-right font-extrabold">{money(d.currentDealPrice ?? t?.dealPriceAtSubmit)}</span>
              <span>Deal runs</span>
              <span className="text-right">{fmtDateTime(d.startsAt)} → {fmtDateTime(d.endsAt)}</span>
            </div>
          </div>

          <span className={labelCls}>Promotion type</span>
          <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup">
            {PROMOTION_TYPES.map((p) => (
              <label
                key={p.key}
                className={`cursor-pointer rounded-lg border px-3 py-2.5 ${type === p.key ? 'border-[#EF3C23] bg-[#FFF5F3]' : 'border-[#E8EDF2]'}`}
              >
                <span className="flex items-center gap-2 text-[12px] font-bold text-[#111827]">
                  <input type="radio" name="promotionType" value={p.key} checked={type === p.key} onChange={() => setType(p.key)} />
                  {p.label}
                </span>
                <span className="mt-1 block text-[10.5px] leading-snug text-[#6B7280]">{p.description}</span>
              </label>
            ))}
          </div>
          {type === 'sponsored' ? (
            <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-800" data-testid="sponsored-notice">
              This is a sponsored (paid) promotion request. No payment is taken here and no price is set — if approved, it
              stays “awaiting fulfillment” until sponsorship terms are arranged with Choosify.
            </div>
          ) : null}

          <div className="mb-3 grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls} htmlFor="promo-start-date">Promotion start</label>
              <input id="promo-start-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} required />
            </div>
            <div>
              <label className={labelCls} htmlFor="promo-start-time">Start time</label>
              <input id="promo-start-time" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputCls} required />
            </div>
            <div>
              <label className={labelCls} htmlFor="promo-end-date">Promotion end</label>
              <input id="promo-end-date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} required />
            </div>
            <div>
              <label className={labelCls} htmlFor="promo-end-time">End time</label>
              <input id="promo-end-time" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputCls} required />
            </div>
          </div>
          <div className="mb-3 text-[10.5px] text-[#9CA3AF]">The promotion period must fall within the deal period.</div>

          <label className={labelCls} htmlFor="promo-note">Note to Choosify (optional)</label>
          <textarea
            id="promo-note"
            value={note}
            maxLength={SELLER_NOTE_MAX}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="mb-3 w-full rounded-lg border border-[#E8EDF2] p-2.5 text-[12.5px] outline-none"
          />
          {err ? <ErrorBox message={err} /> : null}
          <div className="text-[10.5px] text-[#6B7280]">Your Deal remains active while your promotion request is reviewed.</div>
          <button
            type="submit"
            disabled={busy}
            className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-[#EF3C23] to-[#D4331B] px-4 py-2.5 text-[12.5px] font-extrabold text-white disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Submit promotion request
          </button>
        </form>
      )}
    </Modal>
  );
}

function Modal({ title, onClose, children, testId }: { title: string; onClose: () => void; children: React.ReactNode; testId?: string }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/30 p-4" onClick={onClose} role="dialog" aria-label={title}>
      <div
        className="max-h-[90vh] w-full max-w-[480px] overflow-y-auto rounded-xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        data-testid={testId}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0 truncate text-[14px] font-extrabold text-[#111827]">{title}</div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md border border-[#E8EDF2] p-1.5">
            <X size={14} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-[#F1F3F5] py-1.5 text-[12px]">
      <span className="shrink-0 font-semibold text-[#6B7280]">{k}</span>
      <span className="min-w-0 text-right font-bold text-[#111827]">{v}</span>
    </div>
  );
}

function SmallBtn({
  children,
  onClick,
  disabled,
  tone,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'red' | 'accent';
}) {
  const cls =
    tone === 'red'
      ? 'border-[#FECACA] text-[#DC2626]'
      : tone === 'accent'
        ? 'border-[#FDBA9F] text-[#C2410C]'
        : 'border-[#E8EDF2] text-[#374151]';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1 rounded-md border bg-white px-2 py-1 text-[10px] font-extrabold disabled:opacity-50 ${cls}`}
    >
      {children}
    </button>
  );
}

function StepHeader({
  step,
  title,
  subtitle,
  onBack,
  backLabel = 'Back to My Deals',
}: {
  step?: number;
  title: string;
  subtitle: string;
  onBack: () => void;
  backLabel?: string;
}) {
  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={onBack}
        className="mb-2 inline-flex items-center gap-1.5 rounded-lg border border-[#E8EDF2] bg-white px-3 py-1.5 text-[11px] font-extrabold text-[#374151]"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> {backLabel}
      </button>
      {step ? <div className="text-[10px] font-extrabold uppercase tracking-wide text-[#EF3C23]">Step {step} of 2</div> : null}
      <div className="text-[14px] font-extrabold text-[#111827]">{title}</div>
      <div className="text-[11px] font-semibold text-[#6B7280]">{subtitle}</div>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-700" role="alert">
      {message}
    </div>
  );
}

function Loading({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-[12px] text-[#6B7280]">
      <Loader2 className="h-4 w-4 animate-spin" /> {label}
    </div>
  );
}
