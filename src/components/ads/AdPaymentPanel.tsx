/**
 * Ad payment page (Ads Studio → "Pay now"). Sellers / creators see what they owe, Choosify's
 * payment details (set by staff) and send the transaction ID of their bKash / Nagad / bank
 * payment. Choosify then confirms it ("Mark as paid") and the ad can go live after approval.
 * Online checkout is shown as not switched on until the payment gateway is connected.
 */
import React, { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, Clock, CreditCard, Loader2 } from 'lucide-react';
import { adsApi, type AdsApiRecord } from '../../services/adsApi';
import { getAnyPlacementDef, pagePositionLabel, resolvePagePosition } from '@/shared/ads/placementRegistry';

type Billing = {
  status: 'unpaid' | 'paid' | 'waived';
  amount: number;
  days: number;
  ratePerDay: number;
  currency?: string;
  startsAt?: string;
  endsAt?: string;
  method?: string;
  reference?: string;
  paidAt?: string;
  note?: string;
  submitted?: { method: string; reference: string; note?: string; at: string };
};

const METHODS = ['bKash', 'Nagad', 'Rocket', 'Bank transfer', 'Other'];
const fmtDate = (s?: string) => (s ? new Date(s).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const taka = (n: number) => `৳${Number(n || 0).toLocaleString('en-US')}`;

export function AdPaymentPanel({
  ad,
  isAdmin,
  onUpdated,
  onBack,
}: {
  ad: AdsApiRecord;
  isAdmin: boolean;
  onUpdated: (next: AdsApiRecord) => void;
  onBack: () => void;
}) {
  const billing = ((ad.metadata || {}) as Record<string, unknown>).billing as Billing | undefined;
  const [info, setInfo] = useState<{ instructions: string; online: boolean } | null>(null);
  const [draftInfo, setDraftInfo] = useState('');
  const [editInfo, setEditInfo] = useState(false);
  const [method, setMethod] = useState('bKash');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    adsApi
      .getPaymentInfo()
      .then((d) => {
        setInfo(d);
        setDraftInfo(d.instructions);
      })
      .catch(() => setInfo({ instructions: '', online: false }));
  }, []);

  const slot = getAnyPlacementDef(ad.placementId);
  const pos = resolvePagePosition(slot, ((ad.creative || {}) as Record<string, unknown>).pagePosition);
  const where = [slot?.pageLabel, pos ? pagePositionLabel(slot, pos) : slot?.slotLabel].filter(Boolean).join(' · ');

  const run = async (fn: () => Promise<AdsApiRecord>, ok: string) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      onUpdated(await fn());
      setMessage(ok);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const card = 'rounded-xl border border-[#E8EDF2] bg-white p-4';
  const label = 'mb-2 text-[10px] font-extrabold tracking-[0.08em] text-[#9CA3AF]';

  return (
    <div className="mx-auto max-w-[760px] px-4 py-5 md:px-6" data-testid="ad-payment-page">
      <button type="button" onClick={onBack} className="mb-3 inline-flex items-center gap-1.5 rounded-lg border border-[#E8EDF2] bg-white px-3 py-2 text-[11.5px] font-extrabold text-[#374151]">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to the ad
      </button>
      <h1 className="text-[18px] font-extrabold text-[#111827]">Pay for your ad</h1>
      <div className="mb-4 text-[11.5px] font-semibold text-[#6B7280]">
        {ad.advertisementReferenceId || ad.id} · {ad.title}
      </div>

      {error ? <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-700">{error}</div> : null}
      {message ? <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] font-semibold text-emerald-800" data-testid="ad-pay-message">{message}</div> : null}

      {!billing ? (
        <div className={card}>
          <div className="text-[12.5px] font-semibold text-amber-800">No charge yet — choose a start and an end date for the ad first, then come back here.</div>
        </div>
      ) : (
        <div className="space-y-3">
          {/* What you pay */}
          <section className={card} data-testid="ad-pay-summary">
            <div className={label}>WHAT YOU PAY</div>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="text-[12px] text-[#374151]">
                <div>
                  <b>Where:</b> {where || ad.placementId}
                </div>
                <div>
                  <b>When:</b> {fmtDate(billing.startsAt || ad.startsAt)} → {fmtDate(billing.endsAt || ad.endsAt)} ({billing.days} day{billing.days === 1 ? '' : 's'})
                </div>
                <div>
                  {taka(billing.ratePerDay)} / day × {billing.days}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[26px] font-extrabold leading-none text-[#111827]" data-testid="ad-pay-amount">{taka(billing.amount)}</div>
                <div className="mt-1 text-[11px] font-extrabold">
                  {billing.status === 'paid' ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /> Paid</span>
                  ) : billing.status === 'waived' ? (
                    <span className="text-emerald-700">Charge waived by Choosify</span>
                  ) : billing.submitted ? (
                    <span className="inline-flex items-center gap-1 text-blue-700" data-testid="ad-pay-sent"><Clock className="h-3.5 w-3.5" /> Payment sent — being checked</span>
                  ) : (
                    <span className="text-amber-700">Unpaid</span>
                  )}
                </div>
              </div>
            </div>
          </section>

          {billing.status === 'unpaid' && !isAdmin && (ad.status === 'draft' || ad.status === 'pending') ? (
            <section className={card} data-testid="ad-pay-after-approval">
              <div className="text-[12.5px] font-semibold text-[#374151]">
                {ad.status === 'draft'
                  ? 'Submit the ad for approval first. Once Choosify approves it, you pay here and the ad goes live right after the payment is confirmed.'
                  : 'Choosify is reviewing your ad. Once it is approved you pay here, and the ad goes live right after the payment is confirmed.'}
              </div>
            </section>
          ) : billing.status === 'unpaid' ? (
            <>
              {/* Online checkout */}
              <section className={card}>
                <div className={label}>PAY ONLINE</div>
                <button type="button" disabled className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg bg-[#E5E7EB] px-4 py-2.5 text-[12px] font-extrabold text-[#6B7280]" title="Online payment is not switched on yet">
                  <CreditCard className="h-4 w-4" /> Card / bKash online checkout
                </button>
                <div className="mt-1.5 text-[11px] text-[#6B7280]">
                  {info?.online ? 'Online checkout for ads is coming soon.' : 'Online checkout is not switched on yet — please pay by bKash, Nagad or bank transfer below.'}
                </div>
              </section>

              {/* Manual payment */}
              <section className={card} data-testid="ad-pay-manual">
                <div className={label}>PAY BY bKASH / NAGAD / BANK</div>
                <div className="mb-3 rounded-lg border border-[#E8EDF2] bg-[#F9FAFB] px-3 py-2.5 text-[12px] text-[#111827]" data-testid="ad-pay-instructions">
                  {info === null ? (
                    <span className="inline-flex items-center gap-1.5 text-[#6B7280]"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading payment details…</span>
                  ) : info.instructions ? (
                    <div className="whitespace-pre-wrap">{info.instructions}</div>
                  ) : (
                    <span className="font-semibold text-amber-800">Choosify&apos;s payment details are not set up yet — contact Choosify support before paying.</span>
                  )}
                  <div className="mt-2 text-[11px] font-semibold text-[#6B7280]">
                    Pay exactly <b>{taka(billing.amount)}</b> and put <b>{ad.advertisementReferenceId || ad.id}</b> in the payment reference / note.
                  </div>
                </div>

                {isAdmin ? (
                  <div className="mb-3">
                    {editInfo ? (
                      <div data-testid="ad-pay-info-editor">
                        <textarea
                          value={draftInfo}
                          onChange={(e) => setDraftInfo(e.target.value)}
                          rows={5}
                          maxLength={3000}
                          placeholder={'e.g.\nbKash (Merchant): 01XXXXXXXXX\nNagad: 01XXXXXXXXX\nBank: Account name, A/C no, bank, branch, routing no'}
                          className="w-full rounded-lg border border-[#E8EDF2] px-3 py-2 text-[12px]"
                        />
                        <div className="mt-1.5 flex gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={async () => {
                              setBusy(true);
                              setError(null);
                              try {
                                const d = await adsApi.setPaymentInfo(draftInfo);
                                setInfo(d);
                                setEditInfo(false);
                                setMessage('Payment details saved — every advertiser now sees them here.');
                              } catch (e) {
                                setError(e instanceof Error ? e.message : 'Could not save');
                              } finally {
                                setBusy(false);
                              }
                            }}
                            className="rounded-lg bg-[#111827] px-3 py-1.5 text-[11px] font-extrabold text-white"
                            data-testid="ad-pay-info-save"
                          >
                            Save payment details
                          </button>
                          <button type="button" onClick={() => setEditInfo(false)} className="rounded-lg border border-[#E8EDF2] px-3 py-1.5 text-[11px] font-extrabold">
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button type="button" onClick={() => setEditInfo(true)} className="text-[11px] font-extrabold text-[#EF3C23] hover:underline" data-testid="ad-pay-info-edit">
                        Edit Choosify&apos;s payment details (staff only)
                      </button>
                    )}
                  </div>
                ) : null}

                {billing.submitted ? (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-[12px] text-blue-900" data-testid="ad-pay-submitted">
                    <b>Payment sent</b> on {fmtDate(billing.submitted.at)} · {billing.submitted.method} · ref <span className="font-mono">{billing.submitted.reference}</span>
                    {billing.submitted.note ? <div className="mt-0.5">Note: {billing.submitted.note}</div> : null}
                    <div className="mt-1 text-[11px]">
                      {isAdmin ? 'Check it arrived, then confirm below.' : 'Choosify is checking it. Once confirmed and approved, your ad goes live. Wrong details? Send them again below.'}
                    </div>
                  </div>
                ) : null}

                {isAdmin && billing.submitted ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void run(
                          () => adsApi.markAdPaid(ad.id, billing.submitted!.method, billing.submitted!.reference),
                          ad.status === 'approved' ? 'Payment confirmed — the ad is now live on the storefront.' : 'Payment confirmed. It goes live as soon as the ad is approved.',
                        )
                      }
                      className="rounded-lg bg-emerald-600 px-4 py-2.5 text-[12px] font-extrabold text-white"
                      data-testid="ad-pay-confirm"
                    >
                      Payment received — mark as paid
                    </button>
                  </div>
                ) : null}

                {!isAdmin || !billing.submitted ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-[160px_1fr]" data-testid="ad-pay-form">
                    <label className="text-[11px] font-bold text-[#374151]">
                      Paid by
                      <select value={method} onChange={(e) => setMethod(e.target.value)} className="mt-1 w-full rounded-lg border border-[#E8EDF2] bg-white px-2 py-2 text-[12px]" data-testid="ad-pay-method-select">
                        {METHODS.map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-[11px] font-bold text-[#374151]">
                      Transaction ID / reference <span className="text-red-600">*</span>
                      <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. 9BG7XK2LMN" className="mt-1 w-full rounded-lg border border-[#E8EDF2] px-3 py-2 text-[12px]" data-testid="ad-pay-reference" />
                    </label>
                    <label className="text-[11px] font-bold text-[#374151] sm:col-span-2">
                      Note (optional)
                      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. paid from 01XXXXXXXXX" className="mt-1 w-full rounded-lg border border-[#E8EDF2] px-3 py-2 text-[12px]" />
                    </label>
                    <div className="sm:col-span-2">
                      <button
                        type="button"
                        disabled={busy || reference.trim().length < 4}
                        onClick={() => void run(() => adsApi.submitAdPayment(ad.id, method, reference.trim(), note.trim() || undefined), 'Thanks — your payment details were sent. Your ad goes live as soon as Choosify confirms the payment.')}
                        className="rounded-lg bg-[#FF5B00] px-4 py-2.5 text-[12px] font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-40"
                        data-testid="ad-pay-submit"
                      >
                        {busy ? 'Sending…' : billing.submitted ? 'Send corrected details' : 'I have paid — send payment details'}
                      </button>
                    </div>
                  </div>
                ) : null}
              </section>
            </>
          ) : (
            <section className={card}>
              <div className="text-[12.5px] text-[#374151]">
                {billing.status === 'paid' ? (
                  <>Paid {taka(billing.amount)}{billing.method ? ` by ${billing.method}` : ''}{billing.reference ? ` · ref ${billing.reference}` : ''}{billing.paidAt ? ` on ${fmtDate(billing.paidAt)}` : ''}. The place and dates are locked.</>
                ) : (
                  <>Choosify waived this charge{billing.note ? ` (${billing.note})` : ''}.</>
                )}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
