import React, { useState, useEffect, useMemo } from 'react';
import {
  CheckCircle,
  Clock,
  AlertCircle,
  Search,
  Wallet,
  Landmark,
  Send,
  TrendingUp,
  Loader2,
  Info,
} from 'lucide-react';
import { operationsApi, toAnalyticsSummary } from '../../services/operationsApi';
import { useAuth } from '../../contexts/AuthContext';
import { useCashBook } from '../../contexts/CashBookContext';
import { Tabs, TabItem } from '../../components/ui/Tabs';
import { GlassCard } from '../../components/ui/GlassCard';
import { StatTile } from '../../components/ui/StatTile';

type PayoutsPageTab = 'requests' | 'earnings' | 'withdrawal' | 'payment-info';

const BD_BANKS = [
  'Sonali Bank',
  'Janata Bank',
  'Agrani Bank',
  'Rupali Bank',
  'BRAC Bank',
  'Dutch-Bangla Bank',
  'Eastern Bank',
  'City Bank',
  'Islami Bank Bangladesh',
  'Prime Bank',
  'Standard Chartered Bangladesh',
  'Mutual Trust Bank',
  'Bank Asia',
  'Southeast Bank',
  'Uttara Bank',
  'Pubali Bank',
  'NCC Bank',
  'IFIC Bank',
];

interface PaymentInfo {
  accountHolderName: string;
  bankName: string;
  accountNumber: string;
  routingNumber: string;
  branchName: string;
  bkashNumber: string;
  nagadNumber: string;
  updatedAt: string;
}

const EMPTY_PAYMENT_INFO: PaymentInfo = {
  accountHolderName: '',
  bankName: BD_BANKS[0],
  accountNumber: '',
  routingNumber: '',
  branchName: '',
  bkashNumber: '',
  nagadNumber: '',
  updatedAt: '',
};

export const Payouts = () => {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<PayoutsPageTab>('requests');
  const [platformRevenue, setPlatformRevenue] = useState<number | null>(null);

  const role = (profile?.role || '').toLowerCase();
  const isAdmin = role === 'admin' || role === 'super_admin' || role === 'superadmin';

  const { financeSummary, financeSummaryLoading, financeSummaryError, loadFinanceSummary } = useCashBook();

  useEffect(() => {
    operationsApi
      .getAnalytics('30d')
      .then((summary) => {
        setPlatformRevenue(toAnalyticsSummary(summary).orders.revenue);
      })
      .catch(() => setPlatformRevenue(null));
  }, []);

  // Non-admins (seller/creator) inspect their own payout summary automatically.
  useEffect(() => {
    if (!isAdmin) {
      loadFinanceSummary();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  // Admin: must pick a specific seller/creator — the API has no cross-seller list.
  const [inspectSellerId, setInspectSellerId] = useState('');
  const handleInspectSeller = (e: React.FormEvent) => {
    e.preventDefault();
    const id = inspectSellerId.trim();
    if (!id) return;
    loadFinanceSummary(id);
  };

  const [toast, setToast] = useState<string | null>(null);
  const triggerToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // ----- Payment Info tab (self-service settings, no backend endpoint) -----
  const paymentInfoKey = `choosify_payment_info_${profile?.id || 'guest'}`;
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo>(() => {
    try {
      const saved = localStorage.getItem(paymentInfoKey);
      return saved ? JSON.parse(saved) : EMPTY_PAYMENT_INFO;
    } catch {
      return EMPTY_PAYMENT_INFO;
    }
  });

  const handleSavePaymentInfo = () => {
    const next = { ...paymentInfo, updatedAt: new Date().toISOString() };
    setPaymentInfo(next);
    localStorage.setItem(paymentInfoKey, JSON.stringify(next));
    triggerToast('Payment info saved successfully.');
  };

  const payoutsTabs: TabItem[] = [
    { key: 'requests', label: 'Payout Summary', icon: Wallet },
    { key: 'earnings', label: 'Earnings', icon: TrendingUp },
    { key: 'withdrawal', label: 'Withdrawal Request', icon: Send },
    { key: 'payment-info', label: 'Payment Info', icon: Landmark },
  ];

  const adjustmentsByType = useMemo(() => {
    const groups: Record<string, { count: number; debit: number; credit: number }> = {};
    (financeSummary?.adjustments || []).forEach((a) => {
      if (!groups[a.type]) groups[a.type] = { count: 0, debit: 0, credit: 0 };
      groups[a.type].count += 1;
      groups[a.type].debit += a.debit || 0;
      groups[a.type].credit += a.credit || 0;
    });
    return groups;
  }, [financeSummary]);

  return (
    <div className="space-y-6 text-[#1A1A2E] text-left">
      <Tabs tabs={payoutsTabs} activeKey={activeTab} onChange={(key) => setActiveTab(key as PayoutsPageTab)} />

      {activeTab === 'requests' && (
        <div className="space-y-6">
          {/* Storefront revenue — the one number this page always had a real endpoint for */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm text-left">
              <div className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Storefront Revenue (30d)</div>
              <div className="text-2xl font-bold text-[#1A1A2E]">৳ {(platformRevenue ?? 0).toLocaleString()}</div>
              <div className="text-[10px] text-gray-500 mt-1">From live platform checkout orders</div>
            </div>
          </div>

          {isAdmin && (
            <GlassCard hoverLift={false} className="p-5 space-y-4">
              <div className="flex items-start gap-2 text-xs text-app-text-secondary bg-slate-50 border border-app-border rounded-lg p-3">
                <Info className="w-4 h-4 shrink-0 mt-0.5 text-app-accent" />
                <p>
                  The Finance API returns a payout breakdown for one seller/creator at a time — there is no endpoint that lists
                  payout requests across every seller. Enter a specific user ID to inspect their real balance.
                </p>
              </div>
              <form onSubmit={handleInspectSeller} className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[220px]">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-app-text-secondary block mb-1">
                    Seller / Creator User ID
                  </label>
                  <input
                    value={inspectSellerId}
                    onChange={(e) => setInspectSellerId(e.target.value)}
                    placeholder="e.g. seller_a1b2c3"
                    className="w-full bg-white border border-app-border rounded-lg p-2.5 text-xs text-app-text-primary focus:border-app-accent focus:outline-none transition"
                  />
                </div>
                <button
                  type="submit"
                  disabled={financeSummaryLoading}
                  className="px-5 py-2.5 bg-app-accent hover:bg-app-accent-hover text-white text-xs font-bold rounded-lg uppercase tracking-wider transition-all disabled:opacity-60 flex items-center gap-2"
                >
                  {financeSummaryLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                  Inspect
                </button>
              </form>
            </GlassCard>
          )}

          {financeSummaryLoading && !financeSummary && (
            <div className="py-16 text-center text-gray-400 text-sm flex flex-col items-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin" />
              Loading payout summary…
            </div>
          )}

          {financeSummaryError && (
            <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl p-4">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {financeSummaryError}
            </div>
          )}

          {financeSummary && !financeSummaryError && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm text-left">
                  <div className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Available Balance</div>
                  <div className="text-2xl font-bold text-[#1A1A2E]">৳ {financeSummary.availableBalance.toLocaleString()}</div>
                </div>
                <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm text-left">
                  <div className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Pending Approval</div>
                  <div className="text-2xl font-bold text-orange-600">৳ {financeSummary.pendingApproval.toLocaleString()}</div>
                </div>
                <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm text-left">
                  <div className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Escrow Held</div>
                  <div className="text-2xl font-bold text-blue-600">৳ {financeSummary.escrowHeld.toLocaleString()}</div>
                </div>
                <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm text-left">
                  <div className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Net Withdrawable</div>
                  <div className="text-2xl font-bold text-green-600">৳ {financeSummary.netWithdrawable.toLocaleString()}</div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                  <span className="text-[#1A1A2E] font-bold tracking-tight text-md">Adjustments Ledger</span>
                  <span className="text-[10px] text-gray-400 font-bold uppercase">{financeSummary.currency}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-[#F8F9FA] border-b border-gray-150 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                      <tr>
                        <th className="p-4">Date</th>
                        <th className="p-4">Type</th>
                        <th className="p-4">Reference</th>
                        <th className="p-4">Description</th>
                        <th className="p-4 text-right">Debit</th>
                        <th className="p-4 text-right">Credit</th>
                        <th className="p-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-[12px] font-medium text-gray-700">
                      {financeSummary.adjustments.map((a) => (
                        <tr key={a.id} className="hover:bg-slate-50/40">
                          <td className="p-4 text-gray-400 font-mono text-[11px]">{new Date(a.date).toLocaleDateString()}</td>
                          <td className="p-4 font-bold text-[#1A1A2E]">{a.type}</td>
                          <td className="p-4 font-mono text-[11px] text-gray-500">{a.reference}</td>
                          <td className="p-4 text-gray-500">{a.description}</td>
                          <td className="p-4 text-right font-bold text-red-600">{a.debit ? `৳ ${a.debit.toLocaleString()}` : '—'}</td>
                          <td className="p-4 text-right font-bold text-green-600">{a.credit ? `৳ ${a.credit.toLocaleString()}` : '—'}</td>
                          <td className="p-4 text-gray-500">{a.status}</td>
                        </tr>
                      ))}
                      {financeSummary.adjustments.length === 0 && (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-xs text-gray-400 italic">
                            No adjustments on record.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {!financeSummary && !financeSummaryLoading && !financeSummaryError && isAdmin && (
            <div className="py-10 text-center text-xs text-gray-400">Enter a seller/creator ID above to view their payout summary.</div>
          )}
        </div>
      )}

      {activeTab === 'earnings' && (
        <div className="space-y-6">
          {financeSummary ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <StatTile label="Lifetime Earnings" value={`৳ ${financeSummary.lifetimeEarnings.toLocaleString()}`} icon={CheckCircle} accent="emerald" />
                <StatTile
                  label={`Choosify Commission (${financeSummary.choosifyCommissionPercent}%)`}
                  value={`৳ ${financeSummary.choosifyCommission.toLocaleString()}`}
                  icon={Clock}
                  accent="orange"
                />
              </div>

              <GlassCard hoverLift={false} className="overflow-hidden !rounded-[1.25rem]">
                <div className="p-4 border-b border-app-border">
                  <span className="text-[13px] font-bold text-app-text-primary">Adjustments Breakdown by Type</span>
                </div>
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-app-border">
                    <tr>
                      <th className="p-4 text-[10px] font-bold text-app-text-secondary uppercase tracking-widest">Type</th>
                      <th className="p-4 text-[10px] font-bold text-app-text-secondary uppercase tracking-widest">Count</th>
                      <th className="p-4 text-[10px] font-bold text-app-text-secondary uppercase tracking-widest text-right">Debit</th>
                      <th className="p-4 text-[10px] font-bold text-app-text-secondary uppercase tracking-widest text-right">Credit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-app-border text-[12px]">
                    {Object.keys(adjustmentsByType).length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-6 text-center text-xs text-gray-400 italic">
                          No adjustments to break down.
                        </td>
                      </tr>
                    ) : (
                      Object.entries(adjustmentsByType).map(([type, row]) => (
                        <tr key={type}>
                          <td className="p-4 font-bold text-app-text-primary">{type}</td>
                          <td className="p-4 text-app-text-secondary font-mono">{row.count}</td>
                          <td className="p-4 text-right font-mono font-bold text-red-600">৳ {row.debit.toLocaleString()}</td>
                          <td className="p-4 text-right font-mono font-bold text-emerald-600">৳ {row.credit.toLocaleString()}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </GlassCard>
            </>
          ) : (
            <div className="py-10 text-center text-xs text-gray-400">
              {isAdmin ? 'Inspect a seller/creator from the Payout Summary tab first.' : 'Loading your earnings…'}
            </div>
          )}
        </div>
      )}

      {activeTab === 'withdrawal' && (
        <GlassCard hoverLift={false} className="p-6 space-y-3 max-w-lg">
          <div className="flex items-start gap-2 text-xs text-app-text-secondary bg-slate-50 border border-app-border rounded-lg p-3">
            <Info className="w-4 h-4 shrink-0 mt-0.5 text-app-accent" />
            <p>
              Withdrawal request submission is not available yet — the platform API has no endpoint to create one. This tab will be
              wired up once that backend capability exists.
            </p>
          </div>
        </GlassCard>
      )}

      {activeTab === 'payment-info' && (
        <GlassCard hoverLift={false} className="p-6 space-y-4 max-w-lg">
          <div>
            <h3 className="text-base font-extrabold text-app-text-primary">Payment Info</h3>
            <p className="text-xs text-app-text-secondary mt-1">
              Bank account and mobile wallet details used when your payout/withdrawal requests are settled.
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold tracking-wider text-app-text-secondary">Account Holder Name</label>
            <input
              value={paymentInfo.accountHolderName}
              onChange={(e) => setPaymentInfo((p) => ({ ...p, accountHolderName: e.target.value }))}
              className="w-full bg-white border border-app-border rounded-lg p-2.5 text-xs text-app-text-primary focus:border-app-accent focus:outline-none transition"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold tracking-wider text-app-text-secondary">Bank Name</label>
            <select
              value={paymentInfo.bankName}
              onChange={(e) => setPaymentInfo((p) => ({ ...p, bankName: e.target.value }))}
              className="w-full bg-white border border-app-border rounded-lg p-2.5 text-xs text-app-text-primary focus:border-app-accent focus:outline-none transition"
            >
              {BD_BANKS.map((bank) => (
                <option key={bank} value={bank}>
                  {bank}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold tracking-wider text-app-text-secondary">Account Number</label>
              <input
                value={paymentInfo.accountNumber}
                onChange={(e) => setPaymentInfo((p) => ({ ...p, accountNumber: e.target.value }))}
                className="w-full bg-white border border-app-border rounded-lg p-2.5 text-xs font-mono text-app-text-primary focus:border-app-accent focus:outline-none transition"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold tracking-wider text-app-text-secondary">Routing Number</label>
              <input
                value={paymentInfo.routingNumber}
                onChange={(e) => setPaymentInfo((p) => ({ ...p, routingNumber: e.target.value }))}
                className="w-full bg-white border border-app-border rounded-lg p-2.5 text-xs font-mono text-app-text-primary focus:border-app-accent focus:outline-none transition"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold tracking-wider text-app-text-secondary">Branch Name</label>
            <input
              value={paymentInfo.branchName}
              onChange={(e) => setPaymentInfo((p) => ({ ...p, branchName: e.target.value }))}
              className="w-full bg-white border border-app-border rounded-lg p-2.5 text-xs text-app-text-primary focus:border-app-accent focus:outline-none transition"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold tracking-wider text-app-text-secondary">bKash Number</label>
              <input
                value={paymentInfo.bkashNumber}
                onChange={(e) => setPaymentInfo((p) => ({ ...p, bkashNumber: e.target.value }))}
                className="w-full bg-white border border-app-border rounded-lg p-2.5 text-xs font-mono text-app-text-primary focus:border-app-accent focus:outline-none transition"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold tracking-wider text-app-text-secondary">Nagad Number</label>
              <input
                value={paymentInfo.nagadNumber}
                onChange={(e) => setPaymentInfo((p) => ({ ...p, nagadNumber: e.target.value }))}
                className="w-full bg-white border border-app-border rounded-lg p-2.5 text-xs font-mono text-app-text-primary focus:border-app-accent focus:outline-none transition"
              />
            </div>
          </div>

          {paymentInfo.updatedAt && (
            <p className="text-[10px] text-app-text-secondary">Last updated: {new Date(paymentInfo.updatedAt).toLocaleString()}</p>
          )}

          <button
            onClick={handleSavePaymentInfo}
            className="w-full py-2.5 bg-app-accent hover:bg-app-accent-hover text-white text-xs font-bold rounded-lg uppercase tracking-wider transition-all"
          >
            Save Payment Info
          </button>
        </GlassCard>
      )}

      {/* Floating Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[600] bg-[#1A1A2E] border border-[#FF5B00]/30 p-4 rounded-xl shadow-2xl flex items-center gap-3 text-xs font-bold text-white">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
};

export default Payouts;
