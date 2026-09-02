import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useCashBook } from '../../contexts/CashBookContext';
import { useOrders } from '../../contexts/OrdersContext';
import {
  Wallet,
  ArrowUpRight,
  Search,
  Trash2,
  ChevronLeft,
  Plus,
  FileSpreadsheet,
  AlertTriangle,
  X,
  Loader2,
  RefreshCw,
  Info,
  TrendingUp,
  FileText,
  CheckCircle2,
} from 'lucide-react';

const EMOJI_CHOICES = ['📒', '🛒', '🛍️', '💼', '🧵', '🎥', '✨', '📦', '🏦', '🎨'];
const COLOR_CHOICES = ['#FF5B00', '#10B981', '#3B82F6', '#6366F1', '#EC4899', '#8B5CF6', '#14B8A6', '#64748B'];

type ToastState = { message: string; type: 'success' | 'danger' | 'info' } | null;

export default function CashBookHub() {
  const { profile } = useAuth();
  const { orders } = useOrders();
  const location = useLocation();
  const navigate = useNavigate();
  const { bookId } = useParams<{ bookId?: string }>();

  const role = (profile?.role || '').toLowerCase();
  const isAdmin = role === 'admin' || role === 'super_admin' || role === 'superadmin';

  const {
    cashbooks,
    cashbooksLoading,
    cashbooksError,
    refreshCashbooks,
    bookDetail,
    bookDetailLoading,
    bookDetailError,
    loadCashbookDetail,
    clearCashbookDetail,
    createCashbook,
    importOrders,
    deleteEntry,
    financeSummary,
    financeSummaryLoading,
    financeSummaryError,
    loadFinanceSummary,
  } = useCashBook();

  const [toast, setToast] = useState<ToastState>(null);
  const triggerToast = (message: string, type: 'success' | 'danger' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const isReportsView = location.pathname.endsWith('/reports');
  const isDetailView = !isReportsView && Boolean(bookId) && bookId !== 'reports';

  // Non-admin actors (seller/creator) load their own cashbook list + finance summary on mount.
  useEffect(() => {
    if (!isAdmin) {
      refreshCashbooks();
      loadFinanceSummary();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  useEffect(() => {
    if (isDetailView && bookId) {
      loadCashbookDetail(bookId);
    } else {
      clearCashbookDetail();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDetailView, bookId]);

  // ---- Admin: Seller/Creator finance inspector (the only real cross-user capability) ----
  const [inspectSellerId, setInspectSellerId] = useState('');
  const handleInspectSeller = (e: React.FormEvent) => {
    e.preventDefault();
    const id = inspectSellerId.trim();
    if (!id) {
      triggerToast('Enter a seller/creator user ID to inspect', 'danger');
      return;
    }
    loadFinanceSummary(id);
  };

  // ---- New Book modal (seller/creator only — blocked server-side for admin) ----
  const [isNewBookModalOpen, setIsNewBookModalOpen] = useState(false);
  const [newBookName, setNewBookName] = useState('');
  const [newBookEmoji, setNewBookEmoji] = useState(EMOJI_CHOICES[0]);
  const [newBookColor, setNewBookColor] = useState(COLOR_CHOICES[0]);
  const [creatingBook, setCreatingBook] = useState(false);

  const handleCreateBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBookName.trim()) {
      triggerToast('Please enter a book name', 'danger');
      return;
    }
    setCreatingBook(true);
    try {
      const book = await createCashbook(newBookName.trim(), newBookEmoji, newBookColor);
      triggerToast(`Created cashbook "${book.name}"`, 'success');
      setIsNewBookModalOpen(false);
      setNewBookName('');
      setNewBookEmoji(EMOJI_CHOICES[0]);
      setNewBookColor(COLOR_CHOICES[0]);
    } catch (error) {
      triggerToast(error instanceof Error ? error.message : 'Failed to create cashbook', 'danger');
    } finally {
      setCreatingBook(false);
    }
  };

  // ---- Import Orders modal — the ONLY way entries get into a cashbook. ----
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importTargetBookId, setImportTargetBookId] = useState<string>('');
  const [importNewBookName, setImportNewBookName] = useState('Platform Sales Ledger');
  const [importSearch, setImportSearch] = useState('');
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);

  const openImportModal = () => {
    setImportTargetBookId(cashbooks[0]?.id || '');
    setSelectedOrderIds(new Set());
    setImportSearch('');
    setIsImportModalOpen(true);
  };

  const importableOrders = useMemo(() => {
    const q = importSearch.trim().toLowerCase();
    return (orders || []).filter((o) => {
      if (!q) return true;
      return (
        o.id.toLowerCase().includes(q) ||
        (o.customer?.name || '').toLowerCase().includes(q) ||
        (o.product?.name || '').toLowerCase().includes(q)
      );
    });
  }, [orders, importSearch]);

  const toggleOrderSelected = (id: string) => {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleImportOrders = async () => {
    if (selectedOrderIds.size === 0) {
      triggerToast('Select at least one order to import', 'danger');
      return;
    }
    setImporting(true);
    try {
      const items = Array.from(selectedOrderIds).map((orderId) => ({ orderId }));
      const params = importTargetBookId
        ? { bookId: importTargetBookId, items }
        : { newBookName: (importNewBookName || 'Platform Sales Ledger').trim() || 'Platform Sales Ledger', newBookIcon: '📦', items };
      const result = await importOrders(params);
      const parts = [`${result.imported} line item(s) imported`];
      if (result.skipped) parts.push(`${result.skipped} already imported`);
      if (result.failed) parts.push(`${result.failed} not owned by you`);
      triggerToast(parts.join(', ') + '.', result.imported > 0 ? 'success' : 'info');
      setIsImportModalOpen(false);
      navigate(`/admin/cashbook/${result.book.id}`);
    } catch (error) {
      triggerToast(error instanceof Error ? error.message : 'Failed to import orders', 'danger');
    } finally {
      setImporting(false);
    }
  };

  // ---- Delete entry ----
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null);
  const [confirmDeleteEntryId, setConfirmDeleteEntryId] = useState<string | null>(null);

  const handleDeleteEntry = async (entryId: string) => {
    setDeletingEntryId(entryId);
    try {
      await deleteEntry(entryId);
      triggerToast('Entry deleted.', 'info');
    } catch (error) {
      triggerToast(error instanceof Error ? error.message : 'Failed to delete entry', 'danger');
    } finally {
      setDeletingEntryId(null);
      setConfirmDeleteEntryId(null);
    }
  };

  // ---- Aggregate stats for the dashboard (sums of real per-book summaries the API returned) ----
  const aggregated = useMemo(() => {
    return cashbooks.reduce(
      (acc, b) => {
        acc.totalRevenue += b.summary.totalRevenue;
        acc.totalItems += b.summary.totalItems;
        acc.entryCount += b.summary.entryCount;
        return acc;
      },
      { totalRevenue: 0, totalItems: 0, entryCount: 0 },
    );
  }, [cashbooks]);

  return (
    <div className="flex-1 w-full min-h-screen bg-app-bg text-app-text-primary p-6 transition-all relative font-sans leading-relaxed">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-8 right-8 z-[100] flex items-center gap-3 px-5 py-4 border rounded-[5px] shadow-2xl transition-all duration-300 ${
            toast.type === 'success'
              ? 'bg-green-50 border-[#22C55E]/25 text-[#22C55E]'
              : toast.type === 'danger'
              ? 'bg-red-50 border-[#EF4444]/25 text-[#EF4444]'
              : 'bg-blue-50 border-blue-200 text-blue-700'
          }`}
        >
          <div className="text-sm font-bold flex-1 max-w-sm">{toast.message}</div>
          <button onClick={() => setToast(null)} className="opacity-60 hover:opacity-100 border-0 bg-transparent cursor-pointer">
            <X className="w-4 h-4 shrink-0" />
          </button>
        </div>
      )}

      {/* =========================================
          VIEW 1 — DASHBOARD (Admin inspector or My Books)
          ========================================= */}
      {!isDetailView && !isReportsView && (
        <div className="space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 border-b border-app-border pb-6">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-black text-app-text-primary tracking-tight">{isAdmin ? 'Cashbook Hub' : 'My Cashbook'}</h1>
                <span className="text-[10px] uppercase font-black tracking-widest px-2.5 py-1 rounded-full bg-blue-100 text-blue-700">
                  {role || 'guest'}
                </span>
              </div>
              <p className="text-xs text-app-text-secondary mt-1.5">
                {isAdmin
                  ? 'Inspect a seller or creator’s real payout summary.'
                  : 'Real cashbooks built from your imported order lines.'}
              </p>
            </div>

            {!isAdmin && (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => refreshCashbooks()}
                  className="px-3 py-2 border border-app-border bg-white text-app-text-secondary hover:bg-slate-50 text-[11px] font-bold rounded-[5px] transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${cashbooksLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
                <button
                  onClick={openImportModal}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold rounded-[5px] transition-all flex items-center gap-1.5 cursor-pointer shadow-md border-0"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Import Orders
                </button>
                <button
                  onClick={() => setIsNewBookModalOpen(true)}
                  className="px-4 py-2 bg-app-accent text-white hover:bg-[#EF3C23] text-[11px] font-bold rounded-[5px] transition-all flex items-center gap-1.5 cursor-pointer shadow-md border-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New Book
                </button>
              </div>
            )}
          </div>

          {/* Admin: real cross-user capability is finance/summary + adjustments, scoped to one seller at a time */}
          {isAdmin && (
            <div className="bg-app-card border border-app-border rounded-[5px] p-6 shadow-sm space-y-5">
              <div className="flex items-start gap-2 text-xs text-app-text-secondary bg-slate-50 border border-app-border rounded-[5px] p-3">
                <Info className="w-4 h-4 shrink-0 mt-0.5 text-app-accent" />
                <p>
                  The Cashbook API has no endpoint for admins to browse or list another user&apos;s cashbooks/entries — cashbooks are
                  strictly self-owned. The only real cross-user capability admins have is viewing a specific seller or creator&apos;s
                  finance summary below.
                </p>
              </div>

              <form onSubmit={handleInspectSeller} className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[220px]">
                  <label className="text-[10px] font-black text-app-text-muted uppercase tracking-wider block mb-1.5">
                    Seller / Creator User ID
                  </label>
                  <input
                    type="text"
                    value={inspectSellerId}
                    onChange={(e) => setInspectSellerId(e.target.value)}
                    placeholder="e.g. seller_a1b2c3"
                    className="w-full px-3 py-2 text-xs border border-app-border rounded-[5px] bg-white text-app-text-primary focus:outline-none focus:border-app-accent"
                  />
                </div>
                <button
                  type="submit"
                  disabled={financeSummaryLoading}
                  className="px-5 py-2 bg-app-accent text-white text-xs font-black rounded-[5px] hover:bg-[#EF3C23] disabled:opacity-60 cursor-pointer border-0 flex items-center gap-1.5"
                >
                  {financeSummaryLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                  Inspect
                </button>
              </form>

              {financeSummaryError && (
                <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-[5px] p-3">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {financeSummaryError}
                </div>
              )}

              {financeSummary && !financeSummaryError && <FinanceSummaryPanel summary={financeSummary} />}
            </div>
          )}

          {!isAdmin && (
            <>
              {/* Stat cards from real, already-fetched per-book summaries */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div className="bg-app-card border border-app-border rounded-[5px] p-5 shadow-sm">
                  <div className="flex justify-between items-center text-app-text-muted">
                    <span className="text-xs font-bold uppercase tracking-wider">Total Revenue Imported</span>
                    <div className="p-1.5 bg-[#F0FDF4] text-[#22C55E] rounded-[5px]">
                      <ArrowUpRight className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-black text-app-text-primary tracking-tight mt-2">
                    ৳{aggregated.totalRevenue.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-app-text-muted mt-2">Across all your cashbooks</div>
                </div>
                <div className="bg-app-card border border-app-border rounded-[5px] p-5 shadow-sm">
                  <div className="flex justify-between items-center text-app-text-muted">
                    <span className="text-xs font-bold uppercase tracking-wider">Line Items</span>
                    <div className="p-1.5 bg-orange-100 text-app-accent rounded-[5px]">
                      <FileText className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-black text-app-text-primary tracking-tight mt-2">{aggregated.entryCount}</div>
                  <div className="text-[10px] text-app-text-muted mt-2">Imported order lines</div>
                </div>
                <div className="bg-app-card border border-app-border rounded-[5px] p-5 shadow-sm">
                  <div className="flex justify-between items-center text-app-text-muted">
                    <span className="text-xs font-bold uppercase tracking-wider">Total Books</span>
                    <div className="p-1.5 bg-blue-100 text-blue-600 rounded-[5px]">
                      <Wallet className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-black text-app-text-primary tracking-tight mt-2">{cashbooks.length}</div>
                  <div className="text-[10px] text-app-text-muted mt-2">
                    <Link to="/admin/cashbook/reports" className="text-app-accent hover:underline">
                      View Reports →
                    </Link>
                  </div>
                </div>
              </div>

              <div className="bg-app-card border border-app-border rounded-[5px] p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-app-border pb-5 mb-5">
                  <h2 className="text-base font-black text-app-text-primary flex items-center gap-2">
                    My Books
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-app-text-secondary">{cashbooks.length}</span>
                  </h2>
                </div>

                {cashbooksError && (
                  <div className="flex items-center justify-between gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-[5px] p-3 mb-4">
                    <span className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      {cashbooksError}
                    </span>
                    <button onClick={() => refreshCashbooks()} className="font-bold underline cursor-pointer border-0 bg-transparent text-red-600">
                      Retry
                    </button>
                  </div>
                )}

                {cashbooksLoading && cashbooks.length === 0 ? (
                  <div className="py-16 text-center text-app-text-muted text-sm flex flex-col items-center gap-2">
                    <Loader2 className="w-6 h-6 animate-spin" />
                    Loading your cashbooks…
                  </div>
                ) : cashbooks.length === 0 && !cashbooksError ? (
                  <div className="py-16 text-center">
                    <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center mx-auto text-3xl">📭</div>
                    <h3 className="text-sm font-bold text-app-text-primary mt-4">No Cashbooks Yet</h3>
                    <p className="text-xs text-app-text-muted mt-1.5 max-w-md mx-auto">
                      Create a book, then import your delivered order lines into it to start tracking real revenue.
                    </p>
                    <button
                      onClick={() => setIsNewBookModalOpen(true)}
                      className="mt-4 px-5 py-2 bg-app-accent text-white text-xs font-black rounded-[5px] hover:bg-[#EF3C23] cursor-pointer border-0"
                    >
                      + Create Your First Book
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    {cashbooks.map((book) => (
                      <Link
                        key={book.id}
                        to={`/admin/cashbook/${book.id}`}
                        className="border border-app-border rounded-[5px] overflow-hidden flex flex-col justify-between transition-all hover:shadow-lg bg-white no-underline"
                        style={{ borderTop: `4px solid ${book.color}` }}
                      >
                        <div className="p-5 flex-1">
                          <div className="flex justify-between items-start">
                            <span className="text-3xl p-1 bg-slate-50 border border-slate-100 rounded-[5px] inline-block">{book.icon}</span>
                            <span className="text-[10px] text-app-text-muted font-bold block text-right">
                              {new Date(book.updatedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                          <h3 className="text-sm font-black text-app-text-primary mt-3 truncate" title={book.name}>
                            {book.name}
                          </h3>
                          {book.cashbookReferenceId && (
                            <div className="text-[9px] text-app-text-muted font-mono mt-0.5">{book.cashbookReferenceId}</div>
                          )}
                          <div className="text-[10px] text-app-text-muted font-black mt-2 flex items-center gap-1 uppercase">
                            <FileText className="w-3.5 h-3.5" />
                            {book.summary.entryCount} Entries
                          </div>
                        </div>
                        <div className="px-5 py-3 bg-slate-50 border-t border-app-border">
                          <div className="text-[10px] text-app-text-muted font-bold uppercase">Revenue Imported</div>
                          <div className="text-lg font-black text-app-text-primary">৳{book.summary.totalRevenue.toLocaleString()}</div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* =========================================
          VIEW 2 — BOOK DETAIL
          ========================================= */}
      {isDetailView && (
        <div className="space-y-6">
          <div className="flex items-center gap-4 border-b border-app-border pb-6">
            <button
              onClick={() => navigate('/admin/cashbook')}
              className="p-2 border border-app-border bg-white text-app-text-secondary hover:bg-slate-100 rounded-[5px] transition-all shrink-0 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4 text-app-accent shrink-0" />
            </button>
            {bookDetail && (
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{bookDetail.book.icon}</span>
                  <h1 className="text-xl font-black text-app-text-primary tracking-tight">{bookDetail.book.name}</h1>
                </div>
                {bookDetail.book.cashbookReferenceId && (
                  <p className="text-xs text-app-text-secondary mt-1 font-mono">{bookDetail.book.cashbookReferenceId}</p>
                )}
              </div>
            )}
          </div>

          {bookDetailLoading && (
            <div className="py-16 text-center text-app-text-muted text-sm flex flex-col items-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin" />
              Loading cashbook…
            </div>
          )}

          {bookDetailError && !bookDetailLoading && (
            <div className="flex items-center justify-between gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-[5px] p-4">
              <span className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {bookDetailError}
              </span>
              <button
                onClick={() => bookId && loadCashbookDetail(bookId)}
                className="font-bold underline cursor-pointer border-0 bg-transparent text-red-600"
              >
                Retry
              </button>
            </div>
          )}

          {bookDetail && !bookDetailLoading && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
                <SummaryCard label="Revenue" value={`৳${bookDetail.summary.totalRevenue.toLocaleString()}`} />
                <SummaryCard label="Orders" value={String(bookDetail.summary.totalSales)} />
                <SummaryCard label="Items" value={String(bookDetail.summary.totalItems)} />
                <SummaryCard label="Avg. Order Value" value={`৳${bookDetail.summary.averageOrderValue.toLocaleString()}`} />
              </div>

              <div className="bg-app-card border border-app-border rounded-[5px] p-6 shadow-sm">
                <div className="flex items-center justify-between gap-4 border-b border-app-border pb-5 mb-5">
                  <h2 className="text-base font-black text-app-text-primary">
                    Entries
                    <span className="ml-2 text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-app-text-secondary">
                      {bookDetail.entries.length}
                    </span>
                  </h2>
                  {!isAdmin && (
                    <button
                      onClick={openImportModal}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold rounded-[5px] transition-all flex items-center gap-1.5 cursor-pointer shadow-sm border-0"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      Import More Orders
                    </button>
                  )}
                </div>

                <div className="mb-4 flex items-start gap-2 text-[11px] text-app-text-muted bg-slate-50 border border-app-border rounded-[5px] p-3">
                  <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-app-accent" />
                  Entries are always imported from real order lines you sold — there is no manual entry creation. Deleting an entry
                  only removes it from this reporting ledger; it never changes the underlying order, payment, or escrow record.
                </div>

                {bookDetail.entries.length === 0 ? (
                  <div className="py-12 text-center text-app-text-muted text-xs">No entries in this book yet.</div>
                ) : (
                  <div className="overflow-x-auto -mx-2 px-2">
                    <table className="w-full text-left border-collapse min-w-[720px]">
                      <thead className="bg-slate-50 border-b border-app-border text-[10px] font-bold text-app-text-secondary uppercase tracking-widest">
                        <tr>
                          <th className="p-3">Item</th>
                          <th className="p-3">Order</th>
                          <th className="p-3">Qty</th>
                          <th className="p-3">Unit Price</th>
                          <th className="p-3">Amount</th>
                          <th className="p-3">Order Date</th>
                          <th className="p-3">Status</th>
                          <th className="p-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-app-border text-[12px]">
                        {bookDetail.entries.map((entry) => (
                          <tr key={entry.entryId} className="hover:bg-slate-50/50">
                            <td className="p-3">
                              <div className="font-bold text-app-text-primary">{entry.productTitle || entry.description}</div>
                              {entry.category && <div className="text-[10px] text-app-text-muted">{entry.category}</div>}
                            </td>
                            <td className="p-3 text-app-text-secondary font-mono text-[11px]">{entry.orderId || '—'}</td>
                            <td className="p-3 text-app-text-secondary">{entry.quantity ?? '—'}</td>
                            <td className="p-3 text-app-text-secondary">
                              {typeof entry.unitPrice === 'number' ? `৳${entry.unitPrice.toLocaleString()}` : '—'}
                            </td>
                            <td className="p-3 font-black text-app-text-primary">৳{entry.amount.toLocaleString()}</td>
                            <td className="p-3 text-app-text-muted text-[11px]">
                              {entry.orderDate ? new Date(entry.orderDate).toLocaleDateString() : '—'}
                            </td>
                            <td className="p-3 text-app-text-muted text-[11px]">{entry.orderStatus || '—'}</td>
                            <td className="p-3 text-right">
                              <button
                                onClick={() => setConfirmDeleteEntryId(entry.entryId)}
                                disabled={deletingEntryId === entry.entryId}
                                className="p-1.5 text-app-text-secondary hover:text-red-500 hover:bg-red-50 rounded transition-all cursor-pointer border-0 bg-transparent disabled:opacity-50"
                                title="Delete entry"
                              >
                                {deletingEntryId === entry.entryId ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* =========================================
          VIEW 3 — REPORTS (aggregate of already-fetched real per-book summaries)
          ========================================= */}
      {isReportsView && (
        <div className="space-y-6">
          <div className="flex items-center gap-4 border-b border-app-border pb-6">
            <button
              onClick={() => navigate('/admin/cashbook')}
              className="p-2 border border-app-border bg-white text-app-text-secondary hover:bg-slate-100 rounded-[5px] transition-all shrink-0 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4 text-app-accent shrink-0" />
            </button>
            <h1 className="text-xl font-black text-app-text-primary tracking-tight">Cashbook Reports</h1>
          </div>

          {isAdmin ? (
            <div className="bg-app-card border border-app-border rounded-[5px] p-6 text-sm text-app-text-secondary">
              Reports aggregate a single account&apos;s own cashbooks. Use the Cashbook Hub&apos;s seller/creator inspector to view a
              specific user&apos;s finance summary instead.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <SummaryCard label="Total Revenue Imported" value={`৳${aggregated.totalRevenue.toLocaleString()}`} icon={<TrendingUp className="w-4 h-4" />} />
              <SummaryCard label="Total Line Items" value={String(aggregated.entryCount)} icon={<FileText className="w-4 h-4" />} />
              <SummaryCard label="Total Books" value={String(cashbooks.length)} icon={<Wallet className="w-4 h-4" />} />
            </div>
          )}

          {!isAdmin && (
            <div className="bg-app-card border border-app-border rounded-[5px] p-6 shadow-sm">
              <h2 className="text-base font-black text-app-text-primary mb-4">Per-Book Breakdown</h2>
              {cashbooks.length === 0 ? (
                <div className="text-xs text-app-text-muted">No cashbooks yet.</div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 border-b border-app-border text-[10px] font-bold text-app-text-secondary uppercase tracking-widest">
                    <tr>
                      <th className="p-3">Book</th>
                      <th className="p-3">Orders</th>
                      <th className="p-3">Items</th>
                      <th className="p-3">Entries</th>
                      <th className="p-3 text-right">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-app-border text-[12px]">
                    {cashbooks.map((b) => (
                      <tr key={b.id}>
                        <td className="p-3 font-bold text-app-text-primary">
                          {b.icon} {b.name}
                        </td>
                        <td className="p-3 text-app-text-secondary">{b.summary.totalSales}</td>
                        <td className="p-3 text-app-text-secondary">{b.summary.totalItems}</td>
                        <td className="p-3 text-app-text-secondary">{b.summary.entryCount}</td>
                        <td className="p-3 text-right font-black">৳{b.summary.totalRevenue.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}

      {/* ---- New Book Modal ---- */}
      {isNewBookModalOpen && (
        <div className="fixed inset-0 z-[90] bg-black/40 flex items-center justify-center p-4" onClick={() => !creatingBook && setIsNewBookModalOpen(false)}>
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleCreateBook}
            className="bg-white rounded-[5px] shadow-2xl w-full max-w-md p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-app-text-primary">Create New Cashbook</h3>
              <button type="button" onClick={() => setIsNewBookModalOpen(false)} className="border-0 bg-transparent cursor-pointer text-app-text-muted">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="text-[10px] font-black text-app-text-muted uppercase tracking-wider block mb-1.5">Book Name</label>
              <input
                autoFocus
                value={newBookName}
                onChange={(e) => setNewBookName(e.target.value)}
                placeholder="e.g. Outlet Sales Ledger"
                className="w-full px-3 py-2 text-xs border border-app-border rounded-[5px] bg-white text-app-text-primary focus:outline-none focus:border-app-accent"
              />
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-[10px] font-black text-app-text-muted uppercase tracking-wider block mb-1.5">Icon</label>
                <div className="flex flex-wrap gap-1.5">
                  {EMOJI_CHOICES.map((em) => (
                    <button
                      type="button"
                      key={em}
                      onClick={() => setNewBookEmoji(em)}
                      className={`w-8 h-8 rounded-[5px] border text-base flex items-center justify-center cursor-pointer ${
                        newBookEmoji === em ? 'border-app-accent bg-orange-50' : 'border-app-border bg-white'
                      }`}
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <label className="text-[10px] font-black text-app-text-muted uppercase tracking-wider block mb-1.5">Color</label>
              <div className="flex flex-wrap gap-1.5">
                {COLOR_CHOICES.map((c) => (
                  <button
                    type="button"
                    key={c}
                    onClick={() => setNewBookColor(c)}
                    className={`w-7 h-7 rounded-full border-2 cursor-pointer ${newBookColor === c ? 'border-app-text-primary' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <button
              type="submit"
              disabled={creatingBook}
              className="w-full py-2.5 bg-app-accent text-white text-xs font-black rounded-[5px] hover:bg-[#EF3C23] disabled:opacity-60 cursor-pointer border-0 flex items-center justify-center gap-2"
            >
              {creatingBook && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Create Book
            </button>
          </form>
        </div>
      )}

      {/* ---- Import Orders Modal ---- */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-[90] bg-black/40 flex items-center justify-center p-4" onClick={() => !importing && setIsImportModalOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-[5px] shadow-2xl w-full max-w-2xl p-6 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-app-text-primary">Import Orders Into Cashbook</h3>
              <button type="button" onClick={() => setIsImportModalOpen(false)} className="border-0 bg-transparent cursor-pointer text-app-text-muted">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[180px]">
                <label className="text-[10px] font-black text-app-text-muted uppercase tracking-wider block mb-1.5">Target Book</label>
                <select
                  value={importTargetBookId}
                  onChange={(e) => setImportTargetBookId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-app-border rounded-[5px] bg-white text-app-text-primary focus:outline-none"
                >
                  <option value="">+ Create New Book</option>
                  {cashbooks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.icon} {b.name}
                    </option>
                  ))}
                </select>
              </div>
              {!importTargetBookId && (
                <div className="flex-1 min-w-[180px]">
                  <label className="text-[10px] font-black text-app-text-muted uppercase tracking-wider block mb-1.5">New Book Name</label>
                  <input
                    value={importNewBookName}
                    onChange={(e) => setImportNewBookName(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-app-border rounded-[5px] bg-white text-app-text-primary focus:outline-none"
                  />
                </div>
              )}
            </div>

            <div className="relative">
              <span className="absolute left-3 top-2.5 opacity-60">
                <Search className="w-4 h-4" />
              </span>
              <input
                value={importSearch}
                onChange={(e) => setImportSearch(e.target.value)}
                placeholder="Search orders by ID, buyer, or product…"
                className="w-full pl-9 pr-4 py-2 text-xs border border-app-border rounded-[5px] bg-white text-app-text-primary focus:outline-none"
              />
            </div>

            <div className="text-[11px] text-app-text-muted flex items-start gap-2 bg-slate-50 border border-app-border rounded-[5px] p-3">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-app-accent" />
              Only order lines you actually sold will be imported — the server checks ownership. Anything not yours is reported back
              as not-imported rather than silently added.
            </div>

            <div className="flex-1 overflow-y-auto border border-app-border rounded-[5px] divide-y divide-app-border">
              {importableOrders.length === 0 ? (
                <div className="p-6 text-center text-xs text-app-text-muted">No orders match your search.</div>
              ) : (
                importableOrders.map((o) => (
                  <label key={o.id} className="flex items-center gap-3 p-3 text-xs cursor-pointer hover:bg-slate-50">
                    <input type="checkbox" checked={selectedOrderIds.has(o.id)} onChange={() => toggleOrderSelected(o.id)} />
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-app-text-primary truncate">{o.product?.name || 'Order item'}</div>
                      <div className="text-[10px] text-app-text-muted">
                        {o.id} · {o.customer?.name || 'Unknown buyer'} · {o.timestamp ? new Date(o.timestamp).toLocaleDateString() : ''}
                      </div>
                    </div>
                    <div className="font-black text-app-text-primary">৳{(o.total_payable ?? o.product?.price ?? 0).toLocaleString()}</div>
                  </label>
                ))
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-app-border">
              <span className="text-[11px] text-app-text-muted font-bold">{selectedOrderIds.size} selected</span>
              <button
                onClick={handleImportOrders}
                disabled={importing || selectedOrderIds.size === 0}
                className="px-5 py-2 bg-app-accent text-white text-xs font-black rounded-[5px] hover:bg-[#EF3C23] disabled:opacity-60 cursor-pointer border-0 flex items-center gap-2"
              >
                {importing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Import Selected
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- Delete Entry Confirm ---- */}
      {confirmDeleteEntryId && (
        <div className="fixed inset-0 z-[90] bg-black/40 flex items-center justify-center p-4" onClick={() => setConfirmDeleteEntryId(null)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-[5px] shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="text-sm font-black">Delete this entry?</h3>
            </div>
            <p className="text-xs text-app-text-secondary">
              This removes it from your cashbook ledger only. It does not affect the underlying order, payment, or escrow record.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmDeleteEntryId(null)}
                className="px-4 py-2 text-xs font-bold text-app-text-secondary hover:text-app-text-primary cursor-pointer border-0 bg-transparent"
              >
                Cancel
              </button>
              <button
                onClick={() => confirmDeleteEntryId && handleDeleteEntry(confirmDeleteEntryId)}
                disabled={deletingEntryId === confirmDeleteEntryId}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-black rounded-[5px] cursor-pointer border-0 flex items-center gap-2 disabled:opacity-60"
              >
                {deletingEntryId === confirmDeleteEntryId && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="bg-app-card border border-app-border rounded-[5px] p-5 shadow-sm">
      <div className="flex justify-between items-center text-app-text-muted">
        <span className="text-[10px] font-black uppercase tracking-wider">{label}</span>
        {icon && <div className="p-1.5 bg-orange-100 text-app-accent rounded-[5px]">{icon}</div>}
      </div>
      <div className="text-xl font-black text-app-text-primary tracking-tight mt-2">{value}</div>
    </div>
  );
}

function FinanceSummaryPanel({
  summary,
}: {
  summary: import('../../services/cashbookApi').FinanceSummary;
}) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard label="Lifetime Earnings" value={`৳${summary.lifetimeEarnings.toLocaleString()}`} />
        <SummaryCard label="Available Balance" value={`৳${summary.availableBalance.toLocaleString()}`} />
        <SummaryCard label="Pending Approval" value={`৳${summary.pendingApproval.toLocaleString()}`} />
        <SummaryCard label="Escrow Held" value={`৳${summary.escrowHeld.toLocaleString()}`} />
        <SummaryCard label="Choosify Commission" value={`৳${summary.choosifyCommission.toLocaleString()} (${summary.choosifyCommissionPercent}%)`} />
        <SummaryCard label="Other Adjustments" value={`৳${summary.otherAdjustments.toLocaleString()}`} />
        <SummaryCard label="Net Withdrawable" value={`৳${summary.netWithdrawable.toLocaleString()}`} icon={<CheckCircle2 className="w-4 h-4" />} />
        <SummaryCard label="Currency" value={summary.currency} />
      </div>
      <p className="text-[11px] text-app-text-muted italic">{summary.commissionNote}</p>

      <div>
        <h3 className="text-xs font-black text-app-text-primary uppercase tracking-wider mb-2">Adjustments</h3>
        {summary.adjustments.length === 0 ? (
          <div className="text-xs text-app-text-muted">No adjustments on record for this seller.</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-app-border text-[10px] font-bold text-app-text-secondary uppercase tracking-widest">
              <tr>
                <th className="p-2">Date</th>
                <th className="p-2">Type</th>
                <th className="p-2">Reference</th>
                <th className="p-2">Description</th>
                <th className="p-2 text-right">Debit</th>
                <th className="p-2 text-right">Credit</th>
                <th className="p-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border text-[12px]">
              {summary.adjustments.map((a) => (
                <tr key={a.id}>
                  <td className="p-2 text-app-text-muted text-[11px]">{new Date(a.date).toLocaleDateString()}</td>
                  <td className="p-2 text-app-text-primary font-bold">{a.type}</td>
                  <td className="p-2 font-mono text-[11px] text-app-text-secondary">{a.reference}</td>
                  <td className="p-2 text-app-text-secondary">{a.description}</td>
                  <td className="p-2 text-right text-red-600 font-bold">{a.debit ? `৳${a.debit.toLocaleString()}` : '—'}</td>
                  <td className="p-2 text-right text-green-600 font-bold">{a.credit ? `৳${a.credit.toLocaleString()}` : '—'}</td>
                  <td className="p-2 text-app-text-muted text-[11px]">{a.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
