import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Landmark, RefreshCw, Smartphone } from 'lucide-react';
import { useCashBook } from '../../contexts/CashBookContext';
import { operationsApi, type PayoutChannel } from '../../services/operationsApi';
import { ContentCard, DashShell, EmptyState, KpiPanel, KpiTile } from './dashboards/primitives';

/**
 * My Earnings (/admin/my-earnings) for sellers and creators — replaces the CMS
 * mirror page, which listed invented withdrawals. Every figure is the
 * escrow-derived finance summary (GET /finance/summary) and the saved payout
 * methods (GET /operations/payout-profile/me). Withdrawals are not recorded by
 * the backend yet, so none are shown; Payment Info is edited on the Payouts page.
 */
type Tab = 'overview' | 'payment-info';

const taka = (n: number | undefined) => `৳${Math.round(Math.abs(n || 0)).toLocaleString('en-US')}`;

export default function MyEarningsPage() {
  const { financeSummary: f, financeSummaryLoading, financeSummaryError, loadFinanceSummary } = useCashBook();
  const [tab, setTab] = useState<Tab>(() => (new URLSearchParams(window.location.search).get('tab') === 'payment-info' ? 'payment-info' : 'overview'));
  const [channels, setChannels] = useState<PayoutChannel[] | null>(null);
  const [channelsError, setChannelsError] = useState<string | null>(null);

  useEffect(() => {
    void loadFinanceSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let alive = true;
    operationsApi
      .getMyPayoutProfile()
      .then((d) => alive && setChannels(d.channels || []))
      .catch((e) => alive && setChannelsError(e instanceof Error ? e.message : 'Could not load payment info.'));
    return () => {
      alive = false;
    };
  }, []);

  const v = (n: number | undefined) => (financeSummaryLoading && !f ? '…' : taka(n));

  return (
    <DashShell
      title="My Earnings"
      subtitle="Your earnings, balances and where Choosify sends your payouts."
      actions={
        <button
          type="button"
          onClick={() => void loadFinanceSummary()}
          disabled={financeSummaryLoading}
          className="h-[42px] px-4 bg-white border-[1.5px] border-[#F96500] text-[#000435] rounded-xl font-bold text-[13px] inline-flex items-center gap-2 hover:bg-[#FFF0E8] disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 text-[#F96500] ${financeSummaryLoading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      }
    >
      <div className="flex gap-1 bg-white border border-[#E2E8F0] rounded-[14px] px-3 flex-wrap" role="tablist">
        {(
          [
            ['overview', 'Overview'],
            ['payment-info', 'Payment Info'],
          ] as Array<[Tab, string]>
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`px-3.5 py-3 text-[12.5px] font-extrabold border-b-2 -mb-px transition-colors ${
              tab === key ? 'text-[#F96500] border-[#F96500]' : 'text-app-text-secondary border-transparent hover:text-app-text-primary'
            }`}
            data-testid={`earnings-tab-${key}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' ? (
        financeSummaryError && !f ? (
          <ContentCard>
            <div className="text-sm font-bold text-red-600" role="alert">{financeSummaryError}</div>
          </ContentCard>
        ) : (
          <>
            <KpiPanel cols={3}>
              <KpiTile label="Lifetime earnings" value={v(f?.lifetimeEarnings)} sub="All released earnings" />
              <KpiTile label="Available balance" value={v(f?.availableBalance)} sub="Ready to withdraw" />
              <KpiTile label="Pending approval" value={v(f?.pendingApproval)} sub="Awaiting release" />
            </KpiPanel>
            <KpiPanel cols={3}>
              <KpiTile
                label={`Choosify commission${f ? ` (${f.choosifyCommissionPercent}%)` : ''}`}
                value={f ? `−${taka(f.choosifyCommission)}` : v(undefined)}
                sub="Deducted from eligible earnings"
              />
              <KpiTile label="Other adjustments" value={f ? `${f.otherAdjustments < 0 ? '−' : ''}${taka(f.otherAdjustments)}` : v(undefined)} sub="Fees and corrections" />
              <KpiTile label="Net withdrawable" value={v(f?.netWithdrawable)} sub={f ? `Escrow held ${taka(f.escrowHeld)}` : undefined} />
            </KpiPanel>

            <ContentCard title="Adjustments">
              {!f || f.adjustments.length === 0 ? (
                <EmptyState message={financeSummaryLoading ? 'Loading…' : 'No adjustments recorded.'} />
              ) : (
                <div className="divide-y divide-[#EEF2F7]" data-testid="earnings-adjustments">
                  {f.adjustments.map((a) => (
                    <div key={a.id} className="flex items-center justify-between gap-3 py-2.5 text-[13px]">
                      <div className="min-w-0">
                        <div className="font-bold text-app-text-primary truncate">{a.description || a.type}</div>
                        <div className="text-[11px] text-app-text-secondary">
                          {a.date ? new Date(a.date).toLocaleDateString() : '—'} · {a.status}
                          {a.reference ? ` · ${a.reference}` : ''}
                        </div>
                      </div>
                      <div className={`font-extrabold shrink-0 ${a.debit ? 'text-red-700' : 'text-green-700'}`}>
                        {a.debit ? `−${taka(a.debit)}` : `+${taka(a.credit)}`}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ContentCard>

            <ContentCard title="Withdrawal history">
              <div data-testid="earnings-withdrawals">
                <EmptyState message="Withdrawals are not recorded by Choosify yet, so none are listed here. Payouts are settled to your Payment Info." />
              </div>
              {f?.commissionNote ? <p className="text-[11.5px] text-app-text-secondary mt-3">{f.commissionNote}</p> : null}
            </ContentCard>
          </>
        )
      ) : (
        <ContentCard
          title="Payment Info"
          aside={
            <Link to="/admin/payouts?tab=payment-info" className="text-[13px] font-bold text-[#F96500] hover:underline" data-testid="earnings-edit-payment">
              {channels && channels.length ? 'Edit payment info' : 'Add payment method'} →
            </Link>
          }
        >
          {channelsError ? (
            <div className="text-sm font-bold text-red-600" role="alert">{channelsError}</div>
          ) : !channels ? (
            <EmptyState message="Loading your payment info…" />
          ) : channels.length === 0 ? (
            <EmptyState message="No payment method is added. Add a bank account or bKash / Nagad / Rocket wallet so Choosify can pay you." />
          ) : (
            <div className="divide-y divide-[#EEF2F7]" data-testid="earnings-channels">
              {channels.map((c, i) => (
                <div key={i} className="flex items-center gap-3 py-3">
                  {c.kind === 'bank' ? <Landmark className="w-4 h-4 text-[#2563EB]" /> : <Smartphone className="w-4 h-4 text-[#2563EB]" />}
                  <div className="min-w-0">
                    <div className="text-[13px] font-extrabold text-app-text-primary">{c.provider}</div>
                    <div className="text-[11.5px] font-semibold text-app-text-secondary font-mono truncate">
                      {c.number} · {c.accountName}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ContentCard>
      )}
    </DashShell>
  );
}
