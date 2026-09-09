import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Package,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  X,
  Star,
  History,
  ShieldCheck,
  Gift,
  ArrowUpCircle,
  Clock,
  CreditCard,
  RefreshCw,
  XCircle,
  Receipt,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { AdminWorkspaceLayout } from '../../components/Layout/AdminWorkspaceLayout';
import {
  subscriptionsApi,
  type AvailablePlanRow,
  type PlanVersionDetail,
  type SubscriptionPaymentRow,
} from '../../services/subscriptionsApi';
import { PARTNER_FEATURES } from '../../../shared/entitlements/registry';
import type { ResolvedSubscriptionPlan, Subscription, SubscriptionEvent, Workspace, PlanBillingInterval, Plan, PlanVersion, PlanVersionOffer } from '../../../server/subscriptions/types';

/**
 * Sprint 12, Phase 5 — Seller/Creator self-service "Plan & Billing" page.
 * Lives at Settings → Plan & Billing for both roles (no existing nav slot
 * fit — FINANCE & PAYOUTS is about the partner's OWN earnings, not what
 * Choosify charges them). Entirely backed by the real Phase 3 self-service
 * endpoints, which resolve the Workspace strictly from the authenticated
 * caller — this page never sends a workspaceId anywhere.
 *
 * Sprint 12, Phase 6 — real SSLCommerz checkout. Every amount/currency shown
 * below is the server-resolved offer (this page never invents or overrides
 * one); the browser redirect back from the gateway is never trusted as proof
 * of payment — the actual result always comes from a fresh
 * GET /subscriptions/payments/:id/status read of the server's own record.
 * V1 is manual/explicit checkout only — no stored cards, no automatic
 * renewal; every renewal/upgrade/downgrade-activation is its own checkout.
 */

const FEATURE_LABELS: Record<string, string> = Object.fromEntries(PARTNER_FEATURES.map((f) => [f.key, f.label]));

function formatMoney(minorUnits: number, currency: string): string {
  const symbol = currency === 'BDT' ? '৳' : `${currency} `;
  return `${symbol}${(minorUnits / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function Banner({ kind, children, onDismiss }: { kind: 'error' | 'success' | 'info'; children: React.ReactNode; onDismiss?: () => void }) {
  const styles =
    kind === 'error' ? 'bg-red-50 border-red-200 text-red-700' : kind === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-blue-50 border-blue-100 text-blue-800';
  return (
    <div className={`flex items-start justify-between gap-3 rounded-lg border px-3.5 py-2.5 text-[12px] font-semibold ${styles}`}>
      <span>{children}</span>
      {onDismiss && (
        <button onClick={onDismiss} className="shrink-0 opacity-60 hover:opacity-100" aria-label="Dismiss">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

function LoadingBlock({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-14 text-app-text-secondary">
      <Loader2 className="w-4 h-4 animate-spin" />
      <span className="text-[12px] font-bold">{label}</span>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    trial: 'bg-blue-50 border-blue-200 text-blue-700',
    past_due: 'bg-amber-50 border-amber-200 text-amber-700',
    grace_period: 'bg-amber-50 border-amber-200 text-amber-700',
    cancelled: 'bg-gray-100 border-gray-300 text-gray-600',
    expired: 'bg-gray-100 border-gray-300 text-gray-600',
    suspended: 'bg-red-50 border-red-200 text-red-700',
  };
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wide ${map[status] || 'bg-gray-100 border-gray-300 text-gray-600'}`}>{status.replace('_', ' ')}</span>;
}

function FeatureList({ version }: { version: { entitlements: Array<{ featureKey: string; enabled: boolean }> } }) {
  const enabled = version.entitlements.filter((e) => e.enabled);
  if (enabled.length === 0) return <div className="text-[11px] font-semibold text-app-text-secondary italic">No features included</div>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {enabled.map((e) => (
        <span key={e.featureKey} className="rounded-full bg-[#EFF6FF] border border-blue-100 px-2.5 py-1 text-[10.5px] font-bold text-blue-700">
          {FEATURE_LABELS[e.featureKey] || e.featureKey}
        </span>
      ))}
    </div>
  );
}

function LimitList({ version }: { version: { limits: Array<{ limitKey: string; limitValue: number | null }> } }) {
  if (version.limits.length === 0) return <div className="text-[11px] font-semibold text-app-text-secondary italic">No limits configured</div>;
  return (
    <div className="grid grid-cols-2 gap-2">
      {version.limits.map((l) => (
        <div key={l.limitKey} className="flex items-center justify-between rounded-lg border border-app-border px-3 py-1.5">
          <span className="text-[11px] font-bold text-app-text-primary">{l.limitKey}</span>
          <span className="text-[11px] font-extrabold text-app-text-secondary">{l.limitValue === null ? 'Unlimited' : l.limitValue}</span>
        </div>
      ))}
    </div>
  );
}

// ── Current Plan ─────────────────────────────────────────────────────

function CurrentPlanCard({
  current,
  workspace,
  pendingDetail,
  onCancelled,
  onPendingCancelled,
  onRenew,
}: {
  current: ResolvedSubscriptionPlan;
  workspace: Workspace;
  pendingDetail: { plan: Plan; version: PlanVersion; offer: PlanVersionOffer } | null;
  onCancelled: () => void;
  onPendingCancelled: () => void;
  onRenew: (plan: Plan, offer: PlanVersionOffer) => void;
}) {
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancellingPending, setCancellingPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const { subscription, offer, version, plan } = current;

  const doCancel = async () => {
    setCancelling(true);
    setError(null);
    try {
      await subscriptionsApi.cancelMySubscription();
      setShowCancelConfirm(false);
      onCancelled();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to cancel');
    } finally {
      setCancelling(false);
    }
  };

  const doCancelPending = async () => {
    setCancellingPending(true);
    setError(null);
    try {
      await subscriptionsApi.cancelMyPendingDowngrade();
      setSuccess('Pending Plan change cancelled — you will stay on your current Plan.');
      onPendingCancelled();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to cancel pending change');
    } finally {
      setCancellingPending(false);
    }
  };

  return (
    <div className="bg-app-card border border-app-border rounded-xl p-5 space-y-4">
      {success && <Banner kind="success" onDismiss={() => setSuccess(null)}>{success}</Banner>}
      {error && <Banner kind="error" onDismiss={() => setError(null)}>{error}</Banner>}

      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <div className="text-[10px] font-extrabold text-[#9CA3AF] tracking-wide uppercase">Current Plan</div>
          <div className="text-[17px] font-extrabold text-app-text-primary mt-0.5">{plan.name}</div>
          <div className="text-[11px] font-bold text-app-text-secondary mt-0.5">Version {version.version} · {offer.billingInterval === 'monthly' ? 'Monthly' : 'Annual'} billing</div>
        </div>
        <StatusPill status={subscription.status} />
      </div>

      {subscription.grantedManually && (
        <div className="flex items-start gap-2 rounded-lg bg-blue-50 border border-blue-100 px-3 py-2.5 text-[11px] font-semibold text-blue-800">
          <Gift className="w-3.5 h-3.5 shrink-0 mt-0.5" /> This Plan was assigned by Choosify administration
          {subscription.currentPeriodEnd ? ` through ${formatDate(subscription.currentPeriodEnd)}` : ', with no fixed expiry'}. No billing amount applies.
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-[9px] font-extrabold text-[#9CA3AF] tracking-wide">CURRENT PERIOD</div>
          <div className="text-[12px] font-bold text-app-text-primary mt-1">{formatDate(subscription.currentPeriodStart)} – {formatDate(subscription.currentPeriodEnd)}</div>
        </div>
        <div>
          <div className="text-[9px] font-extrabold text-[#9CA3AF] tracking-wide">PRICE</div>
          <div className="text-[12px] font-bold text-app-text-primary mt-1">{subscription.grantedManually ? '—' : `${formatMoney(offer.price, offer.currency)} / ${offer.billingInterval}`}</div>
        </div>
      </div>

      {subscription.cancelAtPeriodEnd && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-[11.5px] font-bold text-amber-800">
          <Clock className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          Cancellation scheduled — you'll keep full access through {formatDate(subscription.currentPeriodEnd)}, then this subscription will not continue.
        </div>
      )}

      {pendingDetail && (
        <div className="rounded-lg border border-app-border bg-[#F9FAFB] p-3.5 space-y-2">
          <div className="text-[11.5px] font-extrabold text-app-text-primary">Pending Plan Change</div>
          <p className="text-[11px] font-semibold text-app-text-secondary">
            You've requested to move to <strong>{pendingDetail.plan.name}</strong> ({pendingDetail.offer.billingInterval}, {formatMoney(pendingDetail.offer.price, pendingDetail.offer.currency)}) once your
            current period ends on {formatDate(subscription.currentPeriodEnd)}. Your current Plan stays fully active until then — <strong>payment will still be required</strong> to actually activate it; this is not automatic.
          </p>
          <button onClick={doCancelPending} disabled={cancellingPending} className="text-[11px] font-extrabold text-red-600 hover:underline disabled:opacity-60">
            {cancellingPending ? 'Cancelling…' : 'Cancel Pending Downgrade'}
          </button>
        </div>
      )}

      <div>
        <div className="text-[9px] font-extrabold text-[#9CA3AF] tracking-wide mb-1.5">INCLUDED FEATURES</div>
        <FeatureList version={current} />
      </div>
      <div>
        <div className="text-[9px] font-extrabold text-[#9CA3AF] tracking-wide mb-1.5">QUANTITATIVE LIMITS</div>
        <LimitList version={current} />
      </div>

      {!subscription.grantedManually && (
        <div className="pt-2 border-t border-app-border flex items-center justify-between gap-2">
          <button
            onClick={() => onRenew(plan, offer)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#18154C] text-white text-[11.5px] font-extrabold px-3.5 py-1.5"
          >
            <CreditCard className="w-3.5 h-3.5" /> Renew Now
          </button>
          {!subscription.cancelAtPeriodEnd && (
            <button onClick={() => setShowCancelConfirm(true)} className="text-[11.5px] font-extrabold text-red-600 hover:underline">Cancel Subscription</button>
          )}
        </div>
      )}

      {showCancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => setShowCancelConfirm(false)}>
          <div className="bg-app-card border border-app-border rounded-2xl shadow-xl w-full max-w-md p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="text-[14px] font-extrabold text-app-text-primary">Cancel Subscription?</div>
            <p className="text-[12px] font-semibold text-app-text-secondary">
              Your access continues through <strong>{formatDate(subscription.currentPeriodEnd)}</strong> — the end of your current paid period. Your subscription will not continue beyond that date.
              No business data (products, orders, team, history) is ever deleted.
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setShowCancelConfirm(false)} className="rounded-lg border border-app-border px-4 py-2 text-[12px] font-extrabold">Keep Subscription</button>
              <button onClick={doCancel} disabled={cancelling} className="rounded-lg bg-red-600 text-white px-4 py-2 text-[12px] font-extrabold disabled:opacity-60">
                {cancelling ? 'Cancelling…' : 'Cancel at Period End'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Available Plans ──────────────────────────────────────────────────

function PlanOfferPicker({ offers, selected, onSelect }: { offers: PlanVersionOffer[]; selected: PlanVersionOffer | null; onSelect: (o: PlanVersionOffer) => void }) {
  if (offers.length === 0) return <div className="text-[11px] font-semibold text-app-text-secondary italic">No billing offer configured</div>;
  if (offers.length === 1) {
    return (
      <div className="text-[15px] font-extrabold text-app-text-primary">
        {formatMoney(offers[0].price, offers[0].currency)} <span className="text-[10.5px] font-bold text-app-text-secondary uppercase">/ {offers[0].billingInterval}</span>
      </div>
    );
  }
  return (
    <div className="flex gap-1.5">
      {offers.map((o) => (
        <button
          key={o.id}
          onClick={() => onSelect(o)}
          className={`flex-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-extrabold ${selected?.id === o.id ? 'bg-[#18154C] text-white border-[#18154C]' : 'border-app-border text-app-text-primary'}`}
        >
          {o.billingInterval === 'monthly' ? 'Monthly' : 'Annual'}<br />
          <span className="font-bold">{formatMoney(o.price, o.currency)}</span>
        </button>
      ))}
    </div>
  );
}

function PlanCard({
  row,
  isCurrentPlan,
  hasActiveSubscription,
  onSelectForCheckout,
  onUpgrade,
  onDowngrade,
}: {
  row: AvailablePlanRow;
  isCurrentPlan: boolean;
  hasActiveSubscription: boolean;
  onSelectForCheckout: (row: AvailablePlanRow, offer: PlanVersionOffer) => void;
  onUpgrade: (row: AvailablePlanRow, offer: PlanVersionOffer) => void;
  onDowngrade: (row: AvailablePlanRow, offer: PlanVersionOffer) => void;
}) {
  const [selectedOffer, setSelectedOffer] = useState<PlanVersionOffer | null>(row.offers[0] || null);

  return (
    <div className={`bg-app-card border rounded-xl p-4 flex flex-col ${isCurrentPlan ? 'border-[#18154C] ring-1 ring-[#18154C]' : 'border-app-border'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="text-[13.5px] font-extrabold text-app-text-primary">{row.plan.name}</div>
        {row.plan.isRecommended && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />}
      </div>
      {row.plan.badge && <span className="inline-block mt-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[9px] font-extrabold uppercase text-amber-700 w-fit">{row.plan.badge}</span>}
      {row.plan.description && <p className="text-[11px] font-semibold text-app-text-secondary mt-1.5">{row.plan.description}</p>}

      <div className="mt-3">
        <PlanOfferPicker offers={row.offers} selected={selectedOffer} onSelect={setSelectedOffer} />
      </div>
      {row.version.trialDays ? <div className="text-[10.5px] font-bold text-emerald-700 mt-1.5">{row.version.trialDays}-day trial included</div> : null}

      <div className="mt-3 pt-3 border-t border-app-border">
        <div className="text-[9px] font-extrabold text-[#9CA3AF] tracking-wide mb-1.5">FEATURES</div>
        <FeatureList version={row} />
      </div>
      <div className="mt-3">
        <div className="text-[9px] font-extrabold text-[#9CA3AF] tracking-wide mb-1.5">LIMITS</div>
        <LimitList version={row} />
      </div>

      <div className="mt-4 pt-3 border-t border-app-border">
        {isCurrentPlan ? (
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-[11.5px] font-extrabold text-[#18154C]"><CheckCircle2 className="w-4 h-4" /> Your Current Plan</div>
            <p className="text-[10px] font-semibold text-app-text-secondary">This card shows the Plan's current published terms — your actual purchased Version and price are shown above under Current Plan.</p>
          </div>
        ) : !hasActiveSubscription ? (
          <button
            disabled={!selectedOffer}
            onClick={() => selectedOffer && onSelectForCheckout(row, selectedOffer)}
            className="w-full rounded-lg bg-[#18154C] text-white text-[12px] font-extrabold py-2 disabled:opacity-40"
          >
            Select This Plan
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              disabled={!selectedOffer}
              onClick={() => selectedOffer && onUpgrade(row, selectedOffer)}
              className="flex-1 rounded-lg bg-emerald-600 text-white text-[11px] font-extrabold py-2 disabled:opacity-40"
            >
              Upgrade to This Plan
            </button>
            <button
              disabled={!selectedOffer}
              onClick={() => selectedOffer && onDowngrade(row, selectedOffer)}
              className="flex-1 rounded-lg border border-app-border text-app-text-primary text-[11px] font-extrabold py-2 disabled:opacity-40"
            >
              Schedule as Next Plan
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

type CheckoutPurpose = 'initial' | 'renewal' | 'upgrade' | 'downgrade';
type CheckoutStage = 'ready' | 'preparing' | 'redirecting' | 'error';

const CHECKOUT_COPY: Record<CheckoutPurpose, { title: string; note: string }> = {
  initial: { title: 'Checkout', note: "You'll be redirected to SSLCommerz to complete payment securely. Your subscription activates the moment payment is confirmed." },
  renewal: { title: 'Renew Subscription', note: 'This is a one-time payment for your next billing period — Choosify never stores your card or charges you automatically. Your subscription was renewed successfully once this completes.' },
  upgrade: { title: 'Upgrade Checkout', note: 'Upgrading charges the full amount above immediately and starts a fresh billing period. Remaining time on your current period is not credited or refunded.' },
  downgrade: { title: 'Activate Plan Change', note: 'This confirms your previously scheduled Plan change. Paying now activates it immediately — nothing changes until this payment succeeds.' },
};

/**
 * Real SSLCommerz checkout (Phase 6). The amount/currency shown is exactly
 * what /subscriptions/checkout/initiate will re-resolve and charge server-side
 * — this modal never sends a client-chosen price anywhere. "Proceed to
 * Payment" hands off to the real gateway (or, locally with no SSLCommerz
 * sandbox credentials configured, the mock harness's deterministic redirect —
 * see the Phase 6 report for that environment note).
 */
function CheckoutModal({
  plan,
  offer,
  purpose,
  onClose,
}: {
  plan: Plan;
  offer: PlanVersionOffer;
  purpose: CheckoutPurpose;
  onClose: () => void;
}) {
  const [stage, setStage] = useState<CheckoutStage>('ready');
  const [error, setError] = useState<string | null>(null);
  const copy = CHECKOUT_COPY[purpose];

  const proceed = async () => {
    setStage('preparing');
    setError(null);
    try {
      const result = await subscriptionsApi.initiateCheckout(offer.id, purpose);
      setStage('redirecting');
      window.location.href = result.redirectUrl;
    } catch (e) {
      setStage('error');
      setError(e instanceof Error ? e.message : 'Failed to start checkout');
    }
  };

  const busy = stage === 'preparing' || stage === 'redirecting';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={busy ? undefined : onClose}>
      <div className="bg-app-card border border-app-border rounded-2xl shadow-xl w-full max-w-md p-5 space-y-3.5" onClick={(e) => e.stopPropagation()}>
        <div className="text-[14px] font-extrabold text-app-text-primary">{copy.title}</div>
        <div className="rounded-lg border border-app-border p-3.5 space-y-1">
          <div className="text-[12.5px] font-extrabold text-app-text-primary">{plan.name}</div>
          <div className="text-[16px] font-extrabold text-app-text-primary">
            {formatMoney(offer.price, offer.currency)} <span className="text-[10.5px] font-bold text-app-text-secondary uppercase">/ {offer.billingInterval}</span>
          </div>
          <div className="text-[10px] font-bold text-app-text-secondary uppercase tracking-wide">{offer.currency} · charged in full now</div>
        </div>

        {purpose === 'upgrade' ? (
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-[11px] font-bold text-amber-800">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {copy.note}
          </div>
        ) : (
          <div className="flex items-start gap-2 rounded-lg bg-blue-50 border border-blue-100 px-3 py-2.5 text-[11px] font-semibold text-blue-800">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {copy.note}
          </div>
        )}

        {stage === 'error' && error && (
          <Banner kind="error" onDismiss={() => setError(null)}>{error}</Banner>
        )}

        <div className="flex items-center justify-between gap-2 pt-1">
          <button onClick={onClose} disabled={busy} className="rounded-lg border border-app-border px-4 py-2 text-[12px] font-extrabold disabled:opacity-40">
            Cancel
          </button>
          <button
            onClick={proceed}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#18154C] text-white px-4 py-2 text-[12px] font-extrabold disabled:opacity-60"
          >
            {stage === 'preparing' ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Preparing checkout…</>
            ) : stage === 'redirecting' ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Redirecting to payment…</>
            ) : (
              <><CreditCard className="w-3.5 h-3.5" /> Proceed to Payment</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

const PAYMENT_RESULT_LABELS: Record<SubscriptionPaymentRow['result'], string> = {
  succeeded: 'Paid',
  pending: 'Pending',
  failed: 'Failed',
  cancelled: 'Cancelled',
};
const PAYMENT_RESULT_STYLES: Record<SubscriptionPaymentRow['result'], string> = {
  succeeded: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  pending: 'bg-amber-50 border-amber-200 text-amber-700',
  failed: 'bg-red-50 border-red-200 text-red-700',
  cancelled: 'bg-gray-100 border-gray-300 text-gray-600',
};
const PAYMENT_PURPOSE_LABELS: Record<SubscriptionPaymentRow['purpose'], string> = {
  initial: 'Initial subscription',
  renewal: 'Renewal',
  upgrade: 'Upgrade',
  downgrade: 'Plan change',
  manual_adjustment: 'Adjustment',
};

/**
 * Shown after returning from the gateway. Never trusts the outcome named in
 * the return URL — always re-reads the server's own record via
 * getPaymentStatus before saying anything happened. Polls briefly for a
 * still-pending result (IPN can lag the browser redirect) then stops with a
 * manual refresh action rather than spinning forever.
 */
function PaymentReturnPanel({
  paymentId,
  onRetry,
  onDismiss,
  onSettled,
}: {
  paymentId: string;
  onRetry: (payment: SubscriptionPaymentRow) => void;
  onDismiss: () => void;
  onSettled: () => void;
}) {
  const [payment, setPayment] = useState<SubscriptionPaymentRow | null>(null);
  const [checking, setChecking] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [pollsLeft, setPollsLeft] = useState(4);
  const settledRef = React.useRef(false);

  const check = useCallback(async () => {
    setChecking(true);
    try {
      const { payment: p } = await subscriptionsApi.getPaymentStatus(paymentId);
      setPayment(p);
      if (p.result === 'succeeded' && !settledRef.current) {
        settledRef.current = true;
        onSettled();
      }
    } catch {
      setNotFound(true);
    } finally {
      setChecking(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentId]);

  useEffect(() => {
    check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentId]);

  useEffect(() => {
    if (!payment || payment.result !== 'pending' || pollsLeft <= 0) return;
    const t = setTimeout(() => {
      setPollsLeft((n) => n - 1);
      check();
    }, 3000);
    return () => clearTimeout(t);
  }, [payment, pollsLeft, check]);

  if (notFound) {
    return (
      <div className="rounded-xl border border-app-border bg-app-card p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="text-[12.5px] font-extrabold text-app-text-primary">We couldn't find this payment attempt</div>
          <p className="text-[11px] font-semibold text-app-text-secondary mt-0.5">The link may be expired or already handled. Check Payment History below, or start a new checkout.</p>
        </div>
        <button onClick={onDismiss} className="shrink-0 opacity-60 hover:opacity-100"><X className="w-3.5 h-3.5" /></button>
      </div>
    );
  }

  if (checking && !payment) {
    return (
      <div className="rounded-xl border border-app-border bg-app-card p-4">
        <LoadingBlock label="Checking your payment status…" />
      </div>
    );
  }
  if (!payment) return null;

  if (payment.result === 'succeeded') {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex items-start gap-3">
        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="text-[12.5px] font-extrabold text-emerald-800">
            Payment successful — {payment.purpose === 'renewal' ? 'your subscription was renewed successfully' : payment.purpose === 'upgrade' ? 'your Plan was upgraded' : payment.purpose === 'downgrade' ? 'your Plan change is now active' : 'your subscription is now active'}
          </div>
          <p className="text-[11px] font-semibold text-emerald-700 mt-0.5">{formatMoney(payment.amount, payment.currency)} charged · {formatDate(payment.createdAt)}. See the Current Plan card above for your updated status and next period.</p>
        </div>
        <button onClick={onDismiss} className="shrink-0 opacity-60 hover:opacity-100"><X className="w-3.5 h-3.5" /></button>
      </div>
    );
  }

  if (payment.result === 'pending') {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
        <Loader2 className="w-5 h-5 text-amber-600 shrink-0 mt-0.5 animate-spin" />
        <div className="flex-1">
          <div className="text-[12.5px] font-extrabold text-amber-800">Confirming your payment…</div>
          <p className="text-[11px] font-semibold text-amber-700 mt-0.5">
            {pollsLeft > 0 ? "This can take a few moments — we're checking automatically." : "Still not confirmed. This can happen if the payment gateway hasn't reported back yet — check again shortly."}
          </p>
          {pollsLeft <= 0 && (
            <button onClick={() => { setPollsLeft(4); check(); }} disabled={checking} className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-extrabold text-amber-800 hover:underline disabled:opacity-60">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh Status
            </button>
          )}
        </div>
      </div>
    );
  }

  // failed / cancelled
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-3">
      <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
      <div className="flex-1">
        <div className="text-[12.5px] font-extrabold text-red-800">{payment.result === 'cancelled' ? 'Payment cancelled' : 'Payment failed'}</div>
        <p className="text-[11px] font-semibold text-red-700 mt-0.5">Nothing was charged or activated. You can retry with a new payment attempt whenever you're ready.</p>
        <button onClick={() => onRetry(payment)} className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-extrabold text-red-800 hover:underline">
          <RefreshCw className="w-3.5 h-3.5" /> Retry Payment
        </button>
      </div>
      <button onClick={onDismiss} className="shrink-0 opacity-60 hover:opacity-100"><X className="w-3.5 h-3.5" /></button>
    </div>
  );
}

function PaymentHistorySection({ payments, offerLabels }: { payments: SubscriptionPaymentRow[]; offerLabels: Map<string, string> }) {
  if (payments.length === 0) {
    return <div className="text-[11.5px] font-semibold text-app-text-secondary italic py-6 text-center">No payments yet.</div>;
  }
  return (
    <div className="space-y-2">
      {payments.map((p) => (
        <div key={p.id} className="flex items-center justify-between rounded-lg border border-app-border px-3.5 py-2.5 gap-3">
          <div className="min-w-0">
            <div className="text-[12px] font-bold text-app-text-primary truncate">
              {PAYMENT_PURPOSE_LABELS[p.purpose]}{p.planVersionOfferId && offerLabels.has(p.planVersionOfferId) ? ` — ${offerLabels.get(p.planVersionOfferId)}` : ''}
            </div>
            <div className="text-[10.5px] font-semibold text-app-text-secondary mt-0.5">{formatDate(p.createdAt)}</div>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <span className="text-[12px] font-extrabold text-app-text-primary">{formatMoney(p.amount, p.currency)}</span>
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wide ${PAYMENT_RESULT_STYLES[p.result]}`}>{PAYMENT_RESULT_LABELS[p.result]}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── History ───────────────────────────────────────────────────────────

const EVENT_LABELS: Record<SubscriptionEvent['eventType'], string> = {
  subscribed: 'Subscribed',
  renewed: 'Renewed',
  upgraded: 'Upgraded',
  downgraded: 'Moved to a new Plan',
  cancellation_requested: 'Requested cancellation',
  cancelled: 'Subscription ended (cancelled)',
  expired: 'Subscription expired',
  manually_granted: 'Plan assigned by Choosify administration',
  suspended: 'Access suspended',
  restored: 'Access restored',
  downgrade_requested: 'Requested a Plan change for next period',
  downgrade_cancelled: 'Cancelled a pending Plan change',
};

function HistorySection({ events, offerNames }: { events: SubscriptionEvent[]; offerNames: Map<string, string> }) {
  if (events.length === 0) {
    return <div className="text-[11.5px] font-semibold text-app-text-secondary italic py-6 text-center">No subscription history yet.</div>;
  }
  return (
    <div className="space-y-2">
      {events.map((e) => {
        const to = e.toPlanVersionOfferId ? offerNames.get(e.toPlanVersionOfferId) : null;
        return (
          <div key={e.id} className="flex items-center justify-between rounded-lg border border-app-border px-3.5 py-2.5">
            <div>
              <div className="text-[12px] font-bold text-app-text-primary">{EVENT_LABELS[e.eventType] || e.eventType}{to ? ` — ${to}` : ''}</div>
              {e.reason && <div className="text-[10.5px] font-semibold text-app-text-secondary mt-0.5">{e.reason}</div>}
            </div>
            <div className="text-[10.5px] font-bold text-app-text-secondary whitespace-nowrap">{formatDate(e.createdAt)}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────

type Tab = 'overview' | 'history';

export default function PlanBillingPage() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<Tab>('overview');
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [current, setCurrent] = useState<ResolvedSubscriptionPlan | null>(null);
  const [availablePlans, setAvailablePlans] = useState<AvailablePlanRow[] | null>(null);
  const [history, setHistory] = useState<{ subscriptions: Subscription[]; events: SubscriptionEvent[] } | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<SubscriptionPaymentRow[] | null>(null);
  const [pendingDetail, setPendingDetail] = useState<{ plan: Plan; version: PlanVersion; offer: PlanVersionOffer } | null>(null);
  const [pendingClosedDetail, setPendingClosedDetail] = useState<{ plan: Plan; version: PlanVersion; offer: PlanVersionOffer } | null>(null);
  const [offerNames, setOfferNames] = useState<Map<string, string>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [checkoutModal, setCheckoutModal] = useState<{ plan: Plan; offer: PlanVersionOffer; purpose: CheckoutPurpose } | null>(null);
  const [lastClosedSubscription, setLastClosedSubscription] = useState<Subscription | null>(null);
  const [returnPaymentId, setReturnPaymentId] = useState<string | null>(null);

  // Phase 6: never trust the browser return URL as proof of payment — only used
  // to know WHICH payment to re-check via getPaymentStatus (PaymentReturnPanel).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const outcome = params.get('paymentOutcome');
    const paymentId = params.get('paymentId');
    if (outcome && paymentId) setReturnPaymentId(paymentId);
  }, []);

  const loadCore = useCallback(async () => {
    setError(null);
    try {
      const [{ workspace: ws, current: cur }, { plans }] = await Promise.all([
        subscriptionsApi.getCurrentSubscription(),
        subscriptionsApi.getAvailablePlans(),
      ]);
      setWorkspace(ws);
      setCurrent(cur);
      setAvailablePlans(plans);

      if (cur?.subscription.pendingPlanVersionOfferId) {
        subscriptionsApi.getOfferDetail(cur.subscription.pendingPlanVersionOfferId).then(setPendingDetail).catch(() => setPendingDetail(null));
      } else {
        setPendingDetail(null);
      }

      if (!cur) {
        const hist = await subscriptionsApi.getMyHistory();
        const mostRecent = hist.subscriptions[0] || null;
        const closed = mostRecent && (mostRecent.status === 'expired' || mostRecent.status === 'cancelled') ? mostRecent : null;
        setLastClosedSubscription(closed);
        if (closed?.pendingPlanVersionOfferId) {
          subscriptionsApi.getOfferDetail(closed.pendingPlanVersionOfferId).then(setPendingClosedDetail).catch(() => setPendingClosedDetail(null));
        } else {
          setPendingClosedDetail(null);
        }
      } else {
        setLastClosedSubscription(null);
        setPendingClosedDetail(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load your subscription');
    }
  }, []);

  useEffect(() => {
    loadCore();
  }, [loadCore]);

  const loadHistory = useCallback(async () => {
    try {
      const [hist, payHist] = await Promise.all([subscriptionsApi.getMyHistory(), subscriptionsApi.getPaymentHistory()]);
      setHistory(hist);
      setPaymentHistory(payHist.payments);
      const ids = new Set<string>();
      for (const e of hist.events) {
        if (e.toPlanVersionOfferId) ids.add(e.toPlanVersionOfferId);
        if (e.fromPlanVersionOfferId) ids.add(e.fromPlanVersionOfferId);
      }
      for (const p of payHist.payments) {
        if (p.planVersionOfferId) ids.add(p.planVersionOfferId);
      }
      const map = new Map(offerNames);
      await Promise.all(
        [...ids].filter((id) => !map.has(id)).map(async (id) => {
          try {
            const d = await subscriptionsApi.getOfferDetail(id);
            map.set(id, `${d.plan.name} (v${d.version.version})`);
          } catch {
            map.set(id, 'a Plan');
          }
        }),
      );
      setOfferNames(new Map(map));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load history');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (tab === 'history' && !history) loadHistory();
  }, [tab, history, loadHistory]);

  const personaLabel = workspace?.type === 'creator' ? 'Creator' : 'Seller';

  const handleUpgrade = async (row: AvailablePlanRow, offer: PlanVersionOffer) => {
    setBanner(null);
    try {
      const quote = await subscriptionsApi.requestMyUpgrade(offer.id);
      setBanner({ kind: 'success', text: `Upgrade validated: ${formatMoney(quote.amountDue, quote.currency)} due in full — ${quote.note}` });
      setCheckoutModal({ plan: row.plan, offer, purpose: 'upgrade' });
    } catch (e) {
      setBanner({ kind: 'error', text: e instanceof Error ? e.message : 'Failed to validate upgrade' });
    }
  };

  const handleDowngrade = async (row: AvailablePlanRow, offer: PlanVersionOffer) => {
    setBanner(null);
    try {
      await subscriptionsApi.requestMyDowngrade(offer.id);
      setBanner({ kind: 'success', text: `Scheduled: ${row.plan.name} will become your Plan after your current period ends. Payment will be required then — nothing was charged now.` });
      loadCore();
    } catch (e) {
      setBanner({ kind: 'error', text: e instanceof Error ? e.message : 'Failed to schedule Plan change' });
    }
  };

  /** Retry after a failed/cancelled payment — always a NEW attempt, never a mutated old one. */
  const handleRetry = async (payment: SubscriptionPaymentRow) => {
    setReturnPaymentId(null);
    if (!payment.planVersionOfferId) return;
    try {
      const d = await subscriptionsApi.getOfferDetail(payment.planVersionOfferId);
      const purpose = (payment.purpose === 'manual_adjustment' ? 'initial' : payment.purpose) as CheckoutPurpose;
      setCheckoutModal({ plan: d.plan, offer: d.offer, purpose });
    } catch (e) {
      setBanner({ kind: 'error', text: e instanceof Error ? e.message : 'Failed to reload the Plan for retry' });
    }
  };

  return (
    <AdminWorkspaceLayout>
      <div className="space-y-5 pb-10">
        <div>
          <h1 className="text-xl font-bold text-app-text-primary tracking-tight">Plan & Billing</h1>
          <p className="text-[12.5px] text-app-text-secondary mt-1">Your {personaLabel.toLowerCase()} subscription plan, billing history, and usage.</p>
        </div>

        {returnPaymentId && (
          <PaymentReturnPanel
            paymentId={returnPaymentId}
            onDismiss={() => setReturnPaymentId(null)}
            onRetry={(p) => { setReturnPaymentId(null); handleRetry(p); }}
            onSettled={loadCore}
          />
        )}
        {banner && <Banner kind={banner.kind} onDismiss={() => setBanner(null)}>{banner.text}</Banner>}
        {error && <Banner kind="error" onDismiss={() => setError(null)}>{error}</Banner>}

        <div className="flex items-center gap-1.5 border-b border-app-border">
          {(['overview', 'history'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 text-[12px] font-extrabold border-b-2 whitespace-nowrap ${
                tab === t ? 'border-[#18154C] text-app-text-primary' : 'border-transparent text-app-text-secondary hover:text-app-text-primary'
              }`}
            >
              {t === 'overview' ? <><Package className="w-3.5 h-3.5" /> Overview</> : <><History className="w-3.5 h-3.5" /> History</>}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <div className="space-y-5">
            {availablePlans === null && !error && <LoadingBlock label="Loading your subscription…" />}

            {availablePlans !== null && (
              <>
                {current && workspace ? (
                  <CurrentPlanCard
                    current={current}
                    workspace={workspace}
                    pendingDetail={pendingDetail}
                    onCancelled={loadCore}
                    onPendingCancelled={loadCore}
                    onRenew={(plan, offer) => setCheckoutModal({ plan, offer, purpose: 'renewal' })}
                  />
                ) : (
                  <div className="rounded-xl border border-dashed border-app-border bg-app-card p-6 text-center">
                    <div className="w-11 h-11 rounded-full bg-[#F3F4F6] flex items-center justify-center text-[#9CA3AF] mx-auto mb-2.5">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div className="text-[13.5px] font-extrabold text-app-text-primary">No Active Subscription</div>
                    {lastClosedSubscription ? (
                      <p className="text-[11.5px] font-semibold text-app-text-secondary mt-1">
                        Your previous subscription {lastClosedSubscription.status === 'cancelled' ? 'ended' : 'expired'} on {formatDate(lastClosedSubscription.currentPeriodEnd)}. Select a Plan below to subscribe again.
                      </p>
                    ) : (
                      <p className="text-[11.5px] font-semibold text-app-text-secondary mt-1">Select a Plan below to see available features and pricing.</p>
                    )}
                    {pendingClosedDetail && (
                      <div className="mt-4 rounded-lg border border-app-border bg-[#F9FAFB] p-3.5 text-left max-w-sm mx-auto">
                        <div className="text-[11.5px] font-extrabold text-app-text-primary">Pending Plan Change Available</div>
                        <p className="text-[11px] font-semibold text-app-text-secondary mt-1">
                          You previously scheduled a move to <strong>{pendingClosedDetail.plan.name}</strong> ({formatMoney(pendingClosedDetail.offer.price, pendingClosedDetail.offer.currency)} / {pendingClosedDetail.offer.billingInterval}). Pay now to activate it.
                        </p>
                        <button
                          onClick={() => setCheckoutModal({ plan: pendingClosedDetail.plan, offer: pendingClosedDetail.offer, purpose: 'downgrade' })}
                          className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-[#18154C] text-white text-[11.5px] font-extrabold px-3.5 py-1.5"
                        >
                          <CreditCard className="w-3.5 h-3.5" /> Activate This Plan
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <div className="text-[12px] font-extrabold text-app-text-primary mb-2.5">Available Plans</div>
                  {availablePlans.length === 0 ? (
                    <div className="text-[11.5px] font-semibold text-app-text-secondary italic py-6 text-center rounded-xl border border-dashed border-app-border">
                      No {personaLabel} plans are currently published.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {availablePlans.map((row) => (
                        <PlanCard
                          key={row.plan.id}
                          row={row}
                          isCurrentPlan={!!current && current.plan.id === row.plan.id}
                          hasActiveSubscription={!!current}
                          onSelectForCheckout={(r, offer) => setCheckoutModal({ plan: r.plan, offer, purpose: 'initial' })}
                          onUpgrade={handleUpgrade}
                          onDowngrade={handleDowngrade}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {tab === 'history' && (
          <div className="max-w-2xl space-y-6">
            <div>
              <div className="text-[12px] font-extrabold text-app-text-primary mb-2.5 inline-flex items-center gap-1.5"><Receipt className="w-3.5 h-3.5" /> Payment History</div>
              {!paymentHistory ? <LoadingBlock label="Loading payment history…" /> : <PaymentHistorySection payments={paymentHistory} offerLabels={offerNames} />}
            </div>
            <div>
              <div className="text-[12px] font-extrabold text-app-text-primary mb-2.5 inline-flex items-center gap-1.5"><History className="w-3.5 h-3.5" /> Subscription History</div>
              {!history ? <LoadingBlock label="Loading history…" /> : <HistorySection events={history.events} offerNames={offerNames} />}
            </div>
          </div>
        )}
      </div>

      {checkoutModal && (
        <CheckoutModal plan={checkoutModal.plan} offer={checkoutModal.offer} purpose={checkoutModal.purpose} onClose={() => setCheckoutModal(null)} />
      )}
    </AdminWorkspaceLayout>
  );
}
