import React, { useState } from 'react';
import type { BookingOfferCard } from '../../../shared/booking/bookingTypes';
import { SERVICE_CATEGORY_LABELS } from '../../../shared/booking/bookingFieldConfig';

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  accepted: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  buyer_accepted: 'bg-blue-50 text-blue-700 border-blue-200',
  countered: 'bg-violet-50 text-violet-700 border-violet-200',
  declined: 'bg-red-50 text-red-700 border-red-200',
  buyer_declined: 'bg-red-50 text-red-700 border-red-200',
  expired: 'bg-slate-100 text-slate-600 border-slate-200',
  payment_expired: 'bg-slate-100 text-slate-600 border-slate-200',
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

type Props = {
  offer: BookingOfferCard;
  sellerId: string;
  sellerName?: string;
  onUpdated?: (offer: BookingOfferCard) => void;
};

async function postAction(
  requestId: string,
  action: 'accept' | 'decline' | 'counter',
  body: Record<string, unknown>,
) {
  const res = await fetch(`/api/v1/booking/requests/${requestId}/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Failed to ${action} booking`);
  return json.data as BookingOfferCard;
}

export function BookingOfferAdminCard({ offer, sellerId, sellerName, onUpdated }: Props) {
  const [busy, setBusy] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [showDecline, setShowDecline] = useState(false);
  const [showCounter, setShowCounter] = useState(false);
  const [counterPrice, setCounterPrice] = useState(String(offer.price || ''));
  const [error, setError] = useState<string | null>(null);

  const canAct = offer.status === 'pending' || offer.status === 'countered';
  const fieldEntries = Object.entries(offer.fields || {}).filter(([key]) => key !== 'notes');

  const run = async (fn: () => Promise<BookingOfferCard>) => {
    setBusy(true);
    setError(null);
    try {
      const next = await fn();
      onUpdated?.(next);
      setShowDecline(false);
      setShowCounter(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2 rounded-2xl border border-[#E8EDF2] bg-white p-3.5 text-left shadow-sm space-y-3 max-w-md">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#9AA0AC]">
            {offer.isService ? 'Booking request' : 'Product request'} · v{offer.version}
          </p>
          <p className="text-[13px] font-extrabold text-[#1A1A2E] mt-0.5">{offer.listingTitle}</p>
          {offer.serviceCategory ? (
            <p className="text-[11px] text-[#9AA0AC] mt-0.5">
              {SERVICE_CATEGORY_LABELS[offer.serviceCategory] || offer.serviceCategory}
            </p>
          ) : null}
        </div>
        <span
          className={`shrink-0 text-[10px] font-extrabold uppercase tracking-wide px-2 py-1 rounded-lg border ${
            STATUS_STYLES[offer.status] || STATUS_STYLES.pending
          }`}
        >
          {offer.status.replace(/_/g, ' ')}
        </span>
      </div>

      <div className="text-[15px] font-black text-[#EB4501]">
        ৳{Number(offer.price || 0).toLocaleString()}
      </div>

      {fieldEntries.length > 0 && (
        <dl className="grid grid-cols-2 gap-2">
          {fieldEntries.map(([key, value]) => (
            <div key={key} className="rounded-lg bg-[#F4F7F9] px-2.5 py-2">
              <dt className="text-[9px] font-bold uppercase tracking-wide text-[#9AA0AC]">
                {key.replace(/([A-Z])/g, ' $1')}
              </dt>
              <dd className="text-[12px] font-semibold text-[#1A1A2E] mt-0.5">{String(value)}</dd>
            </div>
          ))}
        </dl>
      )}

      {offer.notes ? (
        <p className="text-[12px] text-[#4B5563] bg-[#F4F7F9] rounded-lg px-2.5 py-2">{offer.notes}</p>
      ) : null}

      {offer.declineReason ? (
        <p className="text-[12px] text-red-700 bg-red-50 border border-red-100 rounded-lg px-2.5 py-2">
          Decline reason: {offer.declineReason}
        </p>
      ) : null}

      {error ? <p className="text-[12px] text-red-600 font-medium">{error}</p> : null}

      {canAct && (
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              run(() =>
                postAction(offer.requestId, 'accept', { sellerId, sellerName }),
              )
            }
            className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[11px] font-extrabold uppercase tracking-wide disabled:opacity-50"
          >
            Accept
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setShowDecline(true);
              setShowCounter(false);
            }}
            className="px-3 py-1.5 rounded-lg bg-red-50 text-red-700 border border-red-200 text-[11px] font-extrabold uppercase tracking-wide disabled:opacity-50"
          >
            Decline
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setShowCounter(true);
              setShowDecline(false);
              setCounterPrice(String(offer.price || ''));
            }}
            className="px-3 py-1.5 rounded-lg bg-[#FFF3EA] text-[#EB4501] border border-[#EB4501]/20 text-[11px] font-extrabold uppercase tracking-wide disabled:opacity-50"
          >
            Modify & Resend
          </button>
        </div>
      )}

      {showDecline && (
        <div className="space-y-2 border-t border-[#E8EDF2] pt-3">
          <label className="block text-[10px] font-extrabold uppercase tracking-wide text-[#9AA0AC]">
            Decline reason (required)
          </label>
          <textarea
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value)}
            rows={2}
            className="w-full rounded-xl border border-[#E8EDF2] px-3 py-2 text-[12px] outline-none focus:border-[#EB4501]"
            placeholder="Explain why this request cannot be fulfilled…"
          />
          <button
            type="button"
            disabled={busy || !declineReason.trim()}
            onClick={() =>
              run(() =>
                postAction(offer.requestId, 'decline', {
                  sellerId,
                  sellerName,
                  declineReason: declineReason.trim(),
                }),
              )
            }
            className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-[11px] font-extrabold uppercase tracking-wide disabled:opacity-50"
          >
            Submit decline
          </button>
        </div>
      )}

      {showCounter && (
        <div className="space-y-2 border-t border-[#E8EDF2] pt-3">
          <label className="block text-[10px] font-extrabold uppercase tracking-wide text-[#9AA0AC]">
            Counter-offer price (৳)
          </label>
          <input
            type="number"
            min={1}
            value={counterPrice}
            onChange={(e) => setCounterPrice(e.target.value)}
            className="w-full rounded-xl border border-[#E8EDF2] px-3 py-2 text-[12px] outline-none focus:border-[#EB4501] font-mono font-bold"
          />
          <p className="text-[11px] text-[#9AA0AC]">
            Resets a fresh 24-hour buyer response window (original seller clock does not keep counting).
          </p>
          <button
            type="button"
            disabled={busy || !Number(counterPrice)}
            onClick={() =>
              run(() =>
                postAction(offer.requestId, 'counter', {
                  sellerId,
                  sellerName,
                  price: Number(counterPrice),
                }),
              )
            }
            className="px-3 py-1.5 rounded-lg bg-[#EB4501] text-white text-[11px] font-extrabold uppercase tracking-wide disabled:opacity-50"
          >
            Send counter-offer
          </button>
        </div>
      )}
    </div>
  );
}
