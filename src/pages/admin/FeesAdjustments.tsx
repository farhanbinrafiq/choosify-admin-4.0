import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { cashbookApi, type FinanceAdjustmentRow } from '../../services/cashbookApi';
import { DataTable, type DataTableColumn } from '../../components/ui/DataTable';
import { DashShell, ContentCard } from './dashboards/primitives';

/**
 * Fees & Adjustments — the signed-in account's authoritative balance-ledger
 * deductions and credits (GET /finance/adjustments; the server scopes it to the
 * requester, exactly like the legacy CMS-mirror page this replaces). Read only.
 * No invented fees: an empty ledger says so.
 */
const money = (n: number) => (n ? `৳ ${Math.round(n).toLocaleString('en-US')}` : '—');
const fmtDate = (iso: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export default function FeesAdjustments() {
  const [rows, setRows] = useState<FinanceAdjustmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await cashbookApi.getFinanceAdjustments());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load adjustments.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const columns: DataTableColumn<FinanceAdjustmentRow>[] = [
    { key: 'date', header: 'Date', sortValue: (r) => r.date || '', render: (r) => <span className="text-xs text-[#64748B]">{fmtDate(r.date)}</span> },
    { key: 'type', header: 'Type', sortValue: (r) => r.type, render: (r) => <span className="text-xs font-bold text-[#000435]">{r.type || 'Adjustment'}</span> },
    { key: 'reference', header: 'Reference', render: (r) => <span className="font-mono text-[11px] text-[#64748B]">{r.reference || '—'}</span> },
    { key: 'description', header: 'Description', render: (r) => <span className="text-xs text-[#475569]">{r.description || '—'}</span> },
    { key: 'debit', header: 'Debit', align: 'right', sortValue: (r) => r.debit || 0, render: (r) => <span className="text-xs font-bold text-[#DC2626]">{money(r.debit)}</span> },
    { key: 'credit', header: 'Credit', align: 'right', sortValue: (r) => r.credit || 0, render: (r) => <span className="text-xs font-bold text-[#16A34A]">{money(r.credit)}</span> },
    {
      key: 'status',
      header: 'Status',
      render: (r) => (
        <span className="text-[9px] font-black uppercase px-2 py-1 rounded bg-[#F1F5F9] text-[#475569] whitespace-nowrap">
          {r.status || 'Posted'}
        </span>
      ),
    },
  ];

  return (
    <DashShell
      title="Fees & Adjustments"
      subtitle="Authoritative current deductions and credits on your balance ledger."
      actions={
        <>
          <Link
            to="/admin/analytics"
            className="h-[42px] px-4 bg-white border border-[#E2E8F0] text-[#000435] rounded-xl font-bold text-[13px] inline-flex items-center hover:bg-[#FFF0E8] transition-all no-underline"
          >
            Finance overview
          </Link>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="h-[42px] px-4 bg-white border-[1.5px] border-[#F96500] text-[#000435] rounded-xl font-bold text-[13px] inline-flex items-center gap-2 hover:bg-[#FFF0E8] transition-all disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 text-[#F96500] ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </>
      }
    >
      <ContentCard>
        <div className="mb-4">
          <h3 className="text-[18px] font-extrabold text-[#000435] tracking-tight m-0" style={{ fontFamily: 'var(--font-heading)' }}>
            Current deductions &amp; credits
          </h3>
          <p className="text-[13px] text-[#64748B] mt-1 mb-0">Only authoritative balance ledger adjustments. No invented fees.</p>
        </div>
        {error ? (
          <div className="py-8 text-center text-sm font-bold text-[#DC2626]" role="alert" data-testid="fees-adjustments-error">
            {error}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[#E2E8F0]" data-testid="fees-adjustments-table">
            <DataTable
              columns={columns}
              rows={rows}
              getRowId={(r) => r.id}
              isLoading={loading}
              loadingMessage="Loading adjustments…"
              emptyMessage="No adjustments posted yet."
            />
          </div>
        )}
      </ContentCard>
    </DashShell>
  );
}
