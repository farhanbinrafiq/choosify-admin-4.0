import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, AlertTriangle, ShieldCheck, Wallet, BookOpen, ExternalLink, Info } from 'lucide-react';
import { AdminWorkspaceLayout } from '../../components/Layout/AdminWorkspaceLayout';
import { DashShell, ContentCard, EmptyState } from './dashboards/primitives';
import { financeApi, type FinanceOverview, type FinanceTransactionRow, type FinanceSettlementRow, type FinanceBillingDocumentRow, type FinanceFilterParams } from '../../services/financeApi';

/**
 * Sprint 12, Phase 8 — Finance. Native React, AdminWorkspaceLayout, real
 * authoritative records only. View-only by default (Super Admin edit-mode
 * principle) — every action here is a read; nothing here can create, edit,
 * or delete a financial record. Answers "what financial records exist?" —
 * NOT "how is the platform performing?" (that's Monetization Center; this
 * page deliberately never repeats Platform Revenue/GMV/Commission Revenue
 * framing, even though some totals below share the same source tables).
 */

type DatePreset = 'today' | '7d' | '30d' | '90d' | 'year' | 'custom';
type PersonaFilter = 'all' | 'seller' | 'creator';
type PaymentStatusFilter = 'all' | 'succeeded' | 'pending' | 'failed' | 'cancelled';
type FinanceTab = 'overview' | 'transactions' | 'settlements' | 'billing-documents';

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
function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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

function MetricTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-app-card border border-app-border rounded-2xl p-5">
      <div className="text-[10px] font-extrabold text-[#9CA3AF] tracking-wide uppercase">{label}</div>
      <div className="text-[22px] font-extrabold text-app-text-primary mt-1.5 leading-none">{value}</div>
      {sub && <div className="text-[10.5px] font-semibold text-app-text-secondary mt-2">{sub}</div>}
    </div>
  );
}

const RESULT_STYLES: Record<string, string> = {
  succeeded: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  pending: 'bg-amber-50 border-amber-200 text-amber-700',
  failed: 'bg-red-50 border-red-200 text-red-700',
  cancelled: 'bg-gray-100 border-gray-300 text-gray-600',
};
function StatusPill({ status }: { status: string }) {
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wide ${RESULT_STYLES[status] || 'bg-gray-100 border-gray-300 text-gray-600'}`}>{status}</span>;
}

function Pager({ page, pageSize, total, onChange }: { page: number; pageSize: number; total: number; onChange: (p: number) => void }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between mt-3 text-[11px] font-bold text-app-text-secondary">
      <span>Page {page} of {totalPages} · {total} record{total === 1 ? '' : 's'}</span>
      <div className="flex gap-1.5">
        <button disabled={page <= 1} onClick={() => onChange(page - 1)} className="px-3 py-1 rounded-lg border border-app-border disabled:opacity-40">Previous</button>
        <button disabled={page >= totalPages} onClick={() => onChange(page + 1)} className="px-3 py-1 rounded-lg border border-app-border disabled:opacity-40">Next</button>
      </div>
    </div>
  );
}

export default function FinancePage() {
  const [tab, setTab] = useState<FinanceTab>('overview');
  const [preset, setPreset] = useState<DatePreset>('30d');
  const [customFrom, setCustomFrom] = useState(toDateInputValue(new Date(Date.now() - 29 * 86_400_000)));
  const [customTo, setCustomTo] = useState(toDateInputValue(new Date()));
  const [persona, setPersona] = useState<PersonaFilter>('all');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatusFilter>('all');

  const [overview, setOverview] = useState<FinanceOverview | null>(null);
  const [transactions, setTransactions] = useState<{ rows: FinanceTransactionRow[]; total: number; page: number; pageSize: number } | null>(null);
  const [settlements, setSettlements] = useState<{ rows: FinanceSettlementRow[]; total: number; page: number; pageSize: number } | null>(null);
  const [billingDocs, setBillingDocs] = useState<{ rows: FinanceBillingDocumentRow[]; total: number; page: number; pageSize: number } | null>(null);
  const [txPage, setTxPage] = useState(1);
  const [stPage, setStPage] = useState(1);
  const [bdPage, setBdPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const { from, to } = useMemo(() => resolveDateRange(preset, customFrom, customTo), [preset, customFrom, customTo]);
  const baseFilters: FinanceFilterParams = useMemo(() => ({ from: from.toISOString(), to: to.toISOString(), paymentStatus, persona }), [from, to, paymentStatus, persona]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setForbidden(false);
    try {
      if (tab === 'overview') {
        const { overview: o } = await financeApi.getOverview(baseFilters);
        setOverview(o);
      } else if (tab === 'transactions') {
        const result = await financeApi.listTransactions({ ...baseFilters, page: txPage, pageSize: 20 });
        setTransactions(result);
      } else if (tab === 'settlements') {
        const result = await financeApi.listSettlements({ ...baseFilters, page: stPage, pageSize: 20 });
        setSettlements(result);
      } else if (tab === 'billing-documents') {
        const result = await financeApi.listBillingDocuments({ ...baseFilters, page: bdPage, pageSize: 20 });
        setBillingDocs(result);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load Finance data';
      if (/insufficient role|forbidden|401|403/i.test(msg)) setForbidden(true);
      else setError(msg);
    } finally {
      setLoading(false);
    }
  }, [tab, baseFilters, txPage, stPage, bdPage]);

  useEffect(() => {
    load();
  }, [load]);

  if (forbidden) {
    return (
      <AdminWorkspaceLayout>
        <div className="rounded-xl border border-dashed border-app-border bg-app-card p-10 text-center max-w-lg mx-auto mt-10">
          <ShieldCheck className="w-8 h-8 text-app-text-secondary mx-auto mb-3" />
          <div className="text-[14px] font-extrabold text-app-text-primary">Super Admin Access Required</div>
          <p className="text-[12px] font-semibold text-app-text-secondary mt-1.5">Finance is restricted to Choosify administration.</p>
        </div>
      </AdminWorkspaceLayout>
    );
  }

  return (
    <AdminWorkspaceLayout>
      <DashShell title="Finance" subtitle="Financial transactions, settlements, and billing records — view only. For platform revenue performance, see Monetization Center.">
        {error && <Banner kind="error">{error}</Banner>}

        <div className="flex items-center gap-1 sm:gap-1.5 border-b border-app-border overflow-x-auto min-w-0">
          {([
            ['overview', 'Overview', 'Overview'],
            ['transactions', 'Transactions', 'Transactions'],
            ['settlements', 'Settlements', 'Settlements'],
            ['billing-documents', 'Billing', 'Billing Documents'],
          ] as Array<[FinanceTab, string, string]>).map(([key, shortLabel, fullLabel]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-2.5 sm:px-3.5 py-2.5 text-[11.5px] sm:text-[12px] font-extrabold border-b-2 whitespace-nowrap shrink-0 ${tab === key ? 'border-[#18154C] text-app-text-primary' : 'border-transparent text-app-text-secondary hover:text-app-text-primary'}`}
            >
              <span className="sm:hidden">{shortLabel}</span>
              <span className="hidden sm:inline">{fullLabel}</span>
            </button>
          ))}
        </div>

        <ContentCard title="Filters">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="text-[10px] font-extrabold text-[#9CA3AF] tracking-wide uppercase mb-1.5">Date</div>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(DATE_PRESET_LABEL) as DatePreset[]).map((p) => (
                  <button key={p} onClick={() => setPreset(p)} className={`px-3 py-1.5 text-[10.5px] font-bold rounded-lg border transition-all ${preset === p ? 'bg-app-accent text-white border-app-accent' : 'border-app-border text-app-text-secondary hover:text-app-text-primary'}`}>
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
              <div className="text-[10px] font-extrabold text-[#9CA3AF] tracking-wide uppercase mb-1.5">Persona</div>
              <select value={persona} onChange={(e) => setPersona(e.target.value as PersonaFilter)} className="w-full rounded-lg border border-app-border px-2.5 py-1.5 text-[11.5px] font-bold">
                <option value="all">All Personas</option>
                <option value="seller">Seller</option>
                <option value="creator">Creator</option>
              </select>
              <div className="text-[10px] font-semibold text-app-text-secondary mt-1.5">Applies to subscription payments &amp; billing documents.</div>
            </div>
            <div>
              <div className="text-[10px] font-extrabold text-[#9CA3AF] tracking-wide uppercase mb-1.5">Payment Status</div>
              <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value as PaymentStatusFilter)} className="w-full rounded-lg border border-app-border px-2.5 py-1.5 text-[11.5px] font-bold">
                <option value="all">All Statuses</option>
                <option value="succeeded">Successful</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </ContentCard>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-app-text-secondary">
            <Loader2 className="w-4 h-4 animate-spin" /> <span className="text-[12px] font-bold">Loading Finance data…</span>
          </div>
        ) : tab === 'overview' ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <MetricTile label="Total Successful Subscription Payment Value" value={overview ? formatMoney(overview.totalSuccessfulSubscriptionPaymentValue, overview.currency) : '—'} sub={overview ? `${overview.successfulSubscriptionPaymentCount} successful payments` : undefined} />
              <MetricTile label="Commerce Settlements" value={overview ? String(overview.commerceSettlementCount) : '—'} sub="Count of recorded settlements" />
              <MetricTile label="Total Commission Recorded" value={overview ? formatMoney(overview.totalCommissionRecorded, overview.currency) : '—'} sub="From CommerceSettlement.commissionAmount — see Monetization Center for platform-revenue framing" />
              <MetricTile label="Total Seller Net Recorded" value={overview ? formatMoney(overview.totalSellerNetRecorded, overview.currency) : '—'} sub="From CommerceSettlement.sellerNetAmount" />
              <MetricTile label="Billing Documents Issued" value={overview ? String(overview.billingDocumentCount) : '—'} />
              <MetricTile label="Non-Successful Subscription Payments" value={overview ? `${overview.pendingSubscriptionPaymentCount} pending · ${overview.failedSubscriptionPaymentCount} failed · ${overview.cancelledSubscriptionPaymentCount} cancelled` : '—'} sub="Operational counts — none of these contribute financial value" />
            </div>

            <ContentCard title="Related Finance Pages">
              <p className="text-[11.5px] font-semibold text-app-text-secondary mb-3">
                Seller/Creator payout obligations, completed payouts, and cashbook oversight already have dedicated, working pages — Finance links to them rather than duplicating their logic.
              </p>
              <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3">
                <Link to="/admin/payouts" className="inline-flex items-center justify-center gap-2 rounded-lg border border-app-border px-4 py-2.5 text-[12px] font-extrabold text-app-text-primary hover:border-app-accent/40 w-full sm:w-auto">
                  <Wallet className="w-4 h-4" /> Payouts &amp; Earnings <ExternalLink className="w-3 h-3 opacity-60" />
                </Link>
                <Link to="/admin/cashbook" className="inline-flex items-center justify-center gap-2 rounded-lg border border-app-border px-4 py-2.5 text-[12px] font-extrabold text-app-text-primary hover:border-app-accent/40 w-full sm:w-auto">
                  <BookOpen className="w-4 h-4" /> Cashbook Oversight <ExternalLink className="w-3 h-3 opacity-60" />
                </Link>
              </div>
            </ContentCard>
          </>
        ) : tab === 'transactions' ? (
          <ContentCard title="Subscription Payment Transactions">
            {!transactions || transactions.rows.length === 0 ? (
              <EmptyState message="No financial transactions found for this period." />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-[11.5px]">
                    <thead>
                      <tr className="text-left text-[9.5px] font-extrabold text-[#9CA3AF] uppercase tracking-wide">
                        <th className="pb-2 pr-3">Date</th>
                        <th className="pb-2 pr-3">Persona</th>
                        <th className="pb-2 pr-3">Plan</th>
                        <th className="pb-2 pr-3">Purpose</th>
                        <th className="pb-2 pr-3">Status</th>
                        <th className="pb-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.rows.map((r) => (
                        <tr key={r.id} className="border-t border-app-border">
                          <td className="py-2 pr-3 text-app-text-secondary">{formatDate(r.createdAt)}</td>
                          <td className="py-2 pr-3 capitalize text-app-text-secondary">{r.workspaceType}</td>
                          <td className="py-2 pr-3 font-bold text-app-text-primary">{r.planName} (v{r.planVersion}, {r.billingInterval})</td>
                          <td className="py-2 pr-3 capitalize text-app-text-secondary">{r.purpose}</td>
                          <td className="py-2 pr-3"><StatusPill status={r.result} /></td>
                          <td className="py-2 text-right font-extrabold text-app-text-primary">{formatMoney(r.amount, r.currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pager page={transactions.page} pageSize={transactions.pageSize} total={transactions.total} onChange={setTxPage} />
              </>
            )}
          </ContentCard>
        ) : tab === 'settlements' ? (
          <ContentCard title="Commerce Settlements">
            {!settlements || settlements.rows.length === 0 ? (
              <EmptyState message="No settlements recorded for this period." />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-[11.5px]">
                    <thead>
                      <tr className="text-left text-[9.5px] font-extrabold text-[#9CA3AF] uppercase tracking-wide">
                        <th className="pb-2 pr-3">Date</th>
                        <th className="pb-2 pr-3">Seller</th>
                        <th className="pb-2 pr-3 text-right">Gross</th>
                        <th className="pb-2 pr-3 text-right">Commission</th>
                        <th className="pb-2 text-right">Seller Net</th>
                      </tr>
                    </thead>
                    <tbody>
                      {settlements.rows.map((r) => (
                        <tr key={r.settlementId} className="border-t border-app-border">
                          <td className="py-2 pr-3 text-app-text-secondary">{formatDate(r.createdAt)}</td>
                          <td className="py-2 pr-3 font-bold text-app-text-primary">{r.sellerName ?? r.sellerId}</td>
                          <td className="py-2 pr-3 text-right font-semibold">{formatMoney(r.grossAmount, r.currency)}</td>
                          <td className="py-2 pr-3 text-right font-semibold">{formatMoney(r.commissionAmount, r.currency)}</td>
                          <td className="py-2 text-right font-extrabold text-app-text-primary">{formatMoney(r.sellerNetAmount, r.currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pager page={settlements.page} pageSize={settlements.pageSize} total={settlements.total} onChange={setStPage} />
              </>
            )}
          </ContentCard>
        ) : (
          <ContentCard title="Subscription Billing Documents">
            {!billingDocs || billingDocs.rows.length === 0 ? (
              <EmptyState message="No subscription billing documents found for this period." />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-[11.5px]">
                    <thead>
                      <tr className="text-left text-[9.5px] font-extrabold text-[#9CA3AF] uppercase tracking-wide">
                        <th className="pb-2 pr-3">Reference</th>
                        <th className="pb-2 pr-3">Issued</th>
                        <th className="pb-2 pr-3">Persona</th>
                        <th className="pb-2 pr-3">Period</th>
                        <th className="pb-2 pr-3">Status</th>
                        <th className="pb-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {billingDocs.rows.map((r) => (
                        <tr key={r.referenceId} className="border-t border-app-border">
                          <td className="py-2 pr-3 font-mono font-bold text-app-text-primary">{r.referenceId}</td>
                          <td className="py-2 pr-3 text-app-text-secondary">{formatDate(r.issuedAt)}</td>
                          <td className="py-2 pr-3 capitalize text-app-text-secondary">{r.workspaceType}</td>
                          <td className="py-2 pr-3 text-app-text-secondary">{formatDate(r.periodStart)} – {r.periodEnd ? formatDate(r.periodEnd) : '—'}</td>
                          <td className="py-2 pr-3 capitalize"><StatusPill status={r.status} /></td>
                          <td className="py-2 text-right font-extrabold text-app-text-primary">{formatMoney(r.amount, r.currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pager page={billingDocs.page} pageSize={billingDocs.pageSize} total={billingDocs.total} onChange={setBdPage} />
              </>
            )}
          </ContentCard>
        )}
      </DashShell>
    </AdminWorkspaceLayout>
  );
}
