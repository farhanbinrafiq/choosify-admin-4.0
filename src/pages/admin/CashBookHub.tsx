import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  Eye,
  FileSpreadsheet,
  Info,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useCashBook } from '../../contexts/CashBookContext';
import { operationsApi, type CommerceOrderLite } from '../../services/operationsApi';
import type { CashbookEntry, CashbookListItem } from '../../services/cashbookApi';
import { S, ACCENT, formatCurrency, formatDay } from './orderHubChrome';
import {
  CASHBOOK_CATEGORIES,
  CASHBOOK_COLOR_CHOICES,
  CASHBOOK_ICON_CHOICES,
  CASHBOOK_PAYMENT_MODES,
  aggregateBooks,
  cashbookLedgerPath,
  isImportEligibleStatus,
  orderFlagLabel,
  withRunningBalance,
} from './cashbookModel';

// ── design tokens — the genuine Cashbook reference radius language:
//    cards & panels 10 · controls (buttons/inputs) 8 · modals 16 · chips 6 ──
const R = { card: 10, panel: 10, control: 8, modal: 16, chip: 6 };
const CASH_IN = '#16A34A';
const CASH_OUT = '#DC2626';
const BORDER = '#E8EDF2';
const MUTED = '#9CA3AF';

type ToastState = { message: string; type: 'success' | 'danger' | 'info' } | null;

function money(n?: number): string {
  return formatCurrency(Math.abs(Number(n || 0)));
}

// ═══════════════════════════════════════════════════════════════════════
export default function CashBookHub() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { bookId } = useParams<{ bookId?: string }>();
  const [sp] = useSearchParams();

  const role = (profile?.role || '').toLowerCase();
  const isAdmin = role === 'admin' || role === 'super_admin' || role === 'superadmin';
  const myUid = String(profile?.id || '');

  const cb = useCashBook();

  const [toast, setToast] = useState<ToastState>(null);
  const showToast = (message: string, type: 'success' | 'danger' | 'info' = 'success') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 4200);
  };

  // route → which layer
  const reportsView = sp.get('view') === 'reports';
  const oversightSellerId = sp.get('seller') || '';
  const ledgerOwnerId = sp.get('owner') || '';
  const isLedger = Boolean(bookId) && !reportsView;

  // ── data loading ────────────────────────────────────────────────────
  useEffect(() => {
    if (isLedger) return;
    if (isAdmin) {
      if (oversightSellerId) cb.loadOversightSeller(oversightSellerId);
      else cb.loadOversight();
    } else {
      cb.refreshCashbooks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, oversightSellerId, isLedger]);

  useEffect(() => {
    if (isLedger && bookId) {
      cb.loadCashbookDetail(bookId, isAdmin ? ledgerOwnerId || undefined : undefined);
    } else {
      cb.clearCashbookDetail();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLedger, bookId, ledgerOwnerId]);

  // ── render switch ──────────────────────────────────────────────────
  return (
    <div style={{ padding: 24, minHeight: '100%', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}

      {!isLedger && !reportsView && isAdmin && !oversightSellerId && (
        <OversightIndexView cb={cb} navigate={navigate} />
      )}
      {!isLedger && !reportsView && isAdmin && oversightSellerId && (
        <OversightSellerView cb={cb} navigate={navigate} sellerId={oversightSellerId} />
      )}
      {!isLedger && !reportsView && !isAdmin && (
        <SellerHubView cb={cb} navigate={navigate} showToast={showToast} myUid={myUid} />
      )}
      {reportsView && !isAdmin && <ReportsView cb={cb} navigate={navigate} />}
      {isLedger && (
        <LedgerView
          cb={cb}
          navigate={navigate}
          readOnly={isAdmin}
          backTo={isAdmin ? `/admin/cashbook?seller=${encodeURIComponent(ledgerOwnerId)}` : '/admin/cashbook'}
          showToast={showToast}
        />
      )}
    </div>
  );
}

// ── shared bits ──────────────────────────────────────────────────────

function Toast({ toast, onClose }: { toast: NonNullable<ToastState>; onClose: () => void }) {
  const c =
    toast.type === 'success'
      ? { bg: '#F0FDF4', bd: 'rgba(22,163,74,0.3)', fg: CASH_IN }
      : toast.type === 'danger'
        ? { bg: '#FEF2F2', bd: 'rgba(220,38,38,0.3)', fg: CASH_OUT }
        : { bg: '#EFF6FF', bd: '#BFDBFE', fg: '#2563EB' };
  return (
    <div
      style={{
        position: 'fixed',
        top: 24,
        right: 24,
        zIndex: 100,
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        padding: '14px 16px',
        borderRadius: R.control,
        background: c.bg,
        border: `1px solid ${c.bd}`,
        color: c.fg,
        boxShadow: '0 16px 40px rgba(0,0,0,0.14)',
        maxWidth: 420,
      }}
    >
      <div style={{ fontSize: 12.5, fontWeight: 700, flex: 1 }}>{toast.message}</div>
      <button
        type="button"
        onClick={onClose}
        style={{ border: 'none', background: 'none', cursor: 'pointer', color: c.fg, opacity: 0.7 }}
      >
        <X style={{ width: 15, height: 15 }} />
      </button>
    </div>
  );
}

function Kpi({
  label,
  value,
  tone,
  icon,
  hint,
}: {
  label: string;
  value: string;
  tone?: 'in' | 'out' | 'net';
  icon?: React.ReactNode;
  hint?: string;
}) {
  const color = tone === 'in' ? CASH_IN : tone === 'out' ? CASH_OUT : tone === 'net' ? ACCENT : '#111827';
  return (
    <div style={{ ...S.card, borderRadius: R.card, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ ...S.microLabel }}>{label}</span>
        {icon && <span style={{ color, opacity: 0.85 }}>{icon}</span>}
      </div>
      <div style={{ fontSize: 19, fontWeight: 800, marginTop: 8, color }}>{value}</div>
      {hint && <div style={{ fontSize: 10, color: MUTED, marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

/** The genuine Cashbook folder/card — used for Seller books AND Admin brand/seller folders. */
function FolderCard({
  icon,
  color,
  title,
  subtitle,
  reference,
  moneyIn,
  moneyOut,
  net,
  countLabel,
  updatedAt,
  onOpen,
  actions,
}: {
  icon: string;
  color: string;
  title: string;
  subtitle?: string;
  reference?: string;
  moneyIn: number;
  moneyOut: number;
  net: number;
  countLabel: string;
  updatedAt?: string;
  onOpen: () => void;
  actions?: React.ReactNode;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={title}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      style={{
        ...S.card,
        borderRadius: R.card,
        borderTop: `3px solid ${color}`,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        cursor: 'pointer',
        transition: 'box-shadow .15s ease, transform .15s ease',
      }}
      onClick={onOpen}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 14px 32px rgba(17,24,39,0.10)';
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.transform = 'none';
      }}
    >
      <div style={{ padding: 16, flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <span
            style={{
              fontSize: 24,
              lineHeight: 1,
              padding: 8,
              background: '#F9FAFB',
              border: `1px solid ${BORDER}`,
              borderRadius: R.control,
            }}
          >
            {icon}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {updatedAt && (
              <span style={{ fontSize: 10, color: MUTED, fontWeight: 700 }}>{formatDay(updatedAt)}</span>
            )}
            {actions}
          </div>
        </div>
        <div style={{ fontSize: 13.5, fontWeight: 800, color: '#111827', marginTop: 12 }} title={title}>
          {title}
        </div>
        {subtitle && <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>{subtitle}</div>}
        {reference && (
          <div style={{ fontSize: 9.5, color: MUTED, fontFamily: 'monospace', marginTop: 3 }}>{reference}</div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
          <span style={S.microLabel}>{countLabel}</span>
          <span style={{ fontSize: 10, fontWeight: 800, color: ACCENT }}>Open →</span>
        </div>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          borderTop: `1px solid ${BORDER}`,
          background: '#F9FAFB',
        }}
      >
        <MiniStat label="Inflow" value={money(moneyIn)} color={CASH_IN} />
        <MiniStat label="Outflow" value={money(moneyOut)} color={CASH_OUT} border />
        <MiniStat label="Net" value={money(net)} color={net < 0 ? CASH_OUT : ACCENT} border />
      </div>
    </div>
  );
}

function MiniStat({ label, value, color, border }: { label: string; value: string; color: string; border?: boolean }) {
  return (
    <div style={{ padding: '10px 12px', borderLeft: border ? `1px solid ${BORDER}` : undefined }}>
      <div style={{ fontSize: 8.5, fontWeight: 800, color: MUTED, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 800, color, marginTop: 3 }}>{value}</div>
    </div>
  );
}

function HeaderBtn({
  onClick,
  children,
  emphasis,
  disabled,
}: {
  onClick: () => void;
  children: React.ReactNode;
  emphasis?: 'accent' | 'blue';
  disabled?: boolean;
}) {
  const bg = emphasis === 'accent' ? ACCENT : emphasis === 'blue' ? '#2563EB' : '#fff';
  const fg = emphasis ? '#fff' : '#374151';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        height: 36,
        padding: '0 14px',
        borderRadius: R.control,
        border: emphasis ? 'none' : `1px solid ${BORDER}`,
        background: bg,
        color: fg,
        fontSize: 11,
        fontWeight: 800,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        boxShadow: emphasis ? '0 6px 16px rgba(0,0,0,0.12)' : 'none',
      }}
    >
      {children}
    </button>
  );
}

function ErrorRow({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 10,
        padding: 12,
        borderRadius: R.panel,
        background: '#FEF2F2',
        border: '1px solid rgba(220,38,38,0.25)',
        color: CASH_OUT,
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <AlertTriangle style={{ width: 15, height: 15 }} /> {message}
      </span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          style={{ border: 'none', background: 'none', color: CASH_OUT, fontWeight: 800, textDecoration: 'underline', cursor: 'pointer' }}
        >
          Retry
        </button>
      )}
    </div>
  );
}

function Loading({ label }: { label: string }) {
  return (
    <div style={{ padding: 60, textAlign: 'center', color: MUTED, fontSize: 13, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <Loader2 style={{ width: 22, height: 22 }} className="animate-spin" />
      {label}
    </div>
  );
}

function EmptyBooks({ onCreate }: { onCreate: () => void }) {
  return (
    <div style={{ padding: 60, textAlign: 'center' }}>
      <div style={{ fontSize: 34 }}>📭</div>
      <div style={{ fontSize: 13, fontWeight: 800, color: '#111827', marginTop: 12 }}>No cashbooks yet</div>
      <div style={{ fontSize: 12, color: MUTED, marginTop: 6, maxWidth: 420, marginInline: 'auto' }}>
        Create a book, then record Cash In / Cash Out or import your delivered order lines to start tracking real
        money movement.
      </div>
      <button
        type="button"
        onClick={onCreate}
        style={{
          marginTop: 16,
          height: 38,
          padding: '0 18px',
          borderRadius: R.control,
          border: 'none',
          background: ACCENT,
          color: '#fff',
          fontSize: 12,
          fontWeight: 800,
          cursor: 'pointer',
        }}
      >
        + Create your first book
      </button>
    </div>
  );
}

// ═══════════════════════════ SELLER HUB (Layer 1) ═════════════════════
type CbApi = ReturnType<typeof useCashBook>;

function SellerHubView({
  cb,
  navigate,
  showToast,
  myUid,
}: {
  cb: CbApi;
  navigate: (to: string) => void;
  showToast: (m: string, t?: 'success' | 'danger' | 'info') => void;
  myUid: string;
}) {
  const [newBookOpen, setNewBookOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const agg = useMemo(() => aggregateBooks(cb.cashbooks), [cb.cashbooks]);

  return (
    <>
      {/* header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 16,
          flexWrap: 'wrap',
          borderBottom: `1px solid ${BORDER}`,
          paddingBottom: 18,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.01em', margin: 0 }}>My Cashbook</h1>
            <span
              style={{
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                padding: '3px 10px',
                borderRadius: 999,
                background: 'rgba(37,99,235,0.10)',
                color: '#2563EB',
              }}
            >
              Seller / Creator · Private
            </span>
          </div>
          <p style={{ fontSize: 12, color: '#6B7280', marginTop: 6, marginBottom: 0 }}>
            Your private books — manual Cash In / Cash Out plus imported order revenue. Only visible to you.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <HeaderBtn onClick={() => cb.refreshCashbooks()}>
            <RefreshCw style={{ width: 13, height: 13 }} className={cb.cashbooksLoading ? 'animate-spin' : ''} /> Refresh
          </HeaderBtn>
          <HeaderBtn onClick={() => setImportOpen(true)} emphasis="blue">
            <FileSpreadsheet style={{ width: 13, height: 13 }} /> Import Orders
          </HeaderBtn>
          <HeaderBtn onClick={() => setNewBookOpen(true)} emphasis="accent">
            <Plus style={{ width: 13, height: 13 }} /> New Book
          </HeaderBtn>
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14 }}>
        <Kpi label="Total Cash In" tone="in" value={formatCurrency(agg.moneyIn)} icon={<ArrowUpRight style={{ width: 16, height: 16 }} />} />
        <Kpi label="Total Cash Out" tone="out" value={formatCurrency(agg.moneyOut)} icon={<ArrowDownLeft style={{ width: 16, height: 16 }} />} />
        <Kpi label="Net Balance" tone="net" value={formatCurrency(agg.net)} icon={<Wallet style={{ width: 16, height: 16 }} />} />
        <Kpi label="Total Books" value={String(cb.cashbooks.length)} hint="Tap a book to open its ledger" />
      </div>

      {/* books */}
      <div style={{ ...S.card, borderRadius: R.card, padding: 18 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: `1px solid ${BORDER}`,
            paddingBottom: 14,
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 800 }}>
            My Books <span style={{ color: MUTED, fontWeight: 700 }}>{cb.cashbooks.length}</span>
          </div>
          <a
            href="/admin/cashbook?view=reports"
            onClick={(e) => {
              e.preventDefault();
              navigate('/admin/cashbook?view=reports');
            }}
            style={{ fontSize: 11, fontWeight: 800, color: ACCENT, textDecoration: 'none' }}
          >
            View reports →
          </a>
        </div>

        {cb.cashbooksError && <ErrorRow message={cb.cashbooksError} onRetry={() => cb.refreshCashbooks()} />}
        {cb.cashbooksLoading && cb.cashbooks.length === 0 ? (
          <Loading label="Loading your cashbooks…" />
        ) : cb.cashbooks.length === 0 && !cb.cashbooksError ? (
          <EmptyBooks onCreate={() => setNewBookOpen(true)} />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
            {cb.cashbooks.map((b) => (
              <FolderCard
                key={b.id}
                icon={b.icon}
                color={b.color}
                title={b.name}
                reference={b.cashbookReferenceId}
                updatedAt={b.updatedAt}
                moneyIn={b.summary.moneyIn}
                moneyOut={b.summary.moneyOut}
                net={b.summary.net}
                countLabel={`${b.summary.entryCount} entr${b.summary.entryCount === 1 ? 'y' : 'ies'} · ${b.summary.importedCount} imported`}
                onOpen={() => navigate(cashbookLedgerPath(b.id))}
              />
            ))}
          </div>
        )}
      </div>

      {newBookOpen && (
        <NewBookModal
          onClose={() => setNewBookOpen(false)}
          onCreate={async (name, icon, color) => {
            try {
              const book = await cb.createCashbook(name, icon, color);
              showToast(`Created “${book.name}”`);
              setNewBookOpen(false);
            } catch (e) {
              showToast(e instanceof Error ? e.message : 'Failed to create book', 'danger');
            }
          }}
        />
      )}
      {importOpen && (
        <ImportOrdersModal
          books={cb.cashbooks}
          myUid={myUid}
          onClose={() => setImportOpen(false)}
          onImport={cb.importOrders}
          afterImport={(bookId) => {
            setImportOpen(false);
            navigate(cashbookLedgerPath(bookId));
          }}
          showToast={showToast}
        />
      )}
    </>
  );
}

// ═══════════════════════════ LEDGER (Layer 2) ════════════════════════

function LedgerView({
  cb,
  navigate,
  readOnly,
  backTo,
  showToast,
}: {
  cb: CbApi;
  navigate: (to: string) => void;
  readOnly: boolean;
  backTo: string;
  showToast: (m: string, t?: 'success' | 'danger' | 'info') => void;
}) {
  const detail = cb.bookDetail;
  const [search, setSearch] = useState('');
  const [entryModal, setEntryModal] = useState<null | { mode: 'cashIn' | 'cashOut' | 'edit'; entry?: CashbookEntry }>(null);
  const [auditEntry, setAuditEntry] = useState<CashbookEntry | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [confirmDeleteBook, setConfirmDeleteBook] = useState(false);
  const [confirmDeleteEntry, setConfirmDeleteEntry] = useState<CashbookEntry | null>(null);
  const [busy, setBusy] = useState(false);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const all = withRunningBalance(detail?.entries || []);
    if (!q) return all;
    return all.filter(({ entry }) =>
      [entry.description, entry.contact, entry.category, entry.productTitle, entry.orderId, entry.paymentMode]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [detail?.entries, search]);

  if (cb.bookDetailLoading) return <Loading label="Loading cashbook…" />;
  if (cb.bookDetailError)
    return (
      <>
        <BackBar label="All books" onBack={() => navigate(backTo)} />
        <ErrorRow message={cb.bookDetailError} onRetry={() => detail && cb.loadCashbookDetail(detail.book.id)} />
      </>
    );
  if (!detail) {
    return (
      <>
        <BackBar label="All books" onBack={() => navigate(backTo)} />
        <ErrorRow message="Cashbook not found or not available to you." />
      </>
    );
  }

  const s = detail.summary;

  const doEntry = async (input: Parameters<CbApi['addManualEntry']>[1]) => {
    setBusy(true);
    try {
      if (entryModal?.mode === 'edit' && entryModal.entry) {
        await cb.updateEntry(entryModal.entry.entryId, input);
        showToast('Entry updated.');
      } else {
        await cb.addManualEntry(detail.book.id, input);
        showToast(`${input.direction === 'out' ? 'Cash out' : 'Cash in'} recorded.`);
      }
      setEntryModal(null);
      setAuditEntry(null);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to save entry', 'danger');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', borderBottom: `1px solid ${BORDER}`, paddingBottom: 16 }}>
        <button
          type="button"
          onClick={() => navigate(backTo)}
          style={{ height: 34, padding: '0 12px', borderRadius: R.control, border: `1px solid ${BORDER}`, background: '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 800, color: '#374151' }}
        >
          <ChevronLeft style={{ width: 14, height: 14, color: ACCENT }} /> All Books
        </button>
        <span style={{ fontSize: 22 }}>{detail.book.icon}</span>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800 }}>{detail.book.name}</div>
          {detail.book.cashbookReferenceId && (
            <div style={{ fontSize: 10.5, color: MUTED, fontFamily: 'monospace' }}>{detail.book.cashbookReferenceId}</div>
          )}
        </div>
        <div style={{ flex: 1 }} />
        {readOnly ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 10.5,
              fontWeight: 800,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              padding: '6px 12px',
              borderRadius: 999,
              background: 'rgba(180,83,9,0.12)',
              color: '#B45309',
            }}
          >
            <Eye style={{ width: 13, height: 13 }} /> Read-only · Managed by Seller
          </span>
        ) : (
          <>
            <HeaderBtn onClick={() => setRenameOpen(true)}>
              <Pencil style={{ width: 12, height: 12 }} /> Rename
            </HeaderBtn>
            <HeaderBtn onClick={() => setConfirmDeleteBook(true)}>
              <Trash2 style={{ width: 12, height: 12 }} /> Delete book
            </HeaderBtn>
          </>
        )}
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        <Kpi label="Total Inflow" tone="in" value={formatCurrency(s.moneyIn)} hint="Cash in from sales, imports & manual" />
        <Kpi label="Total Outflow" tone="out" value={formatCurrency(s.moneyOut)} hint="Expenses, refunds & adjustments" />
        <Kpi label="Net Ledger Balance" tone="net" value={formatCurrency(s.net)} hint={`${s.importedCount} imported · ${s.manualCount} manual`} />
      </div>

      {/* toolbar */}
      <div style={{ ...S.card, borderRadius: `${R.panel}px ${R.panel}px 0 0`, borderBottom: 'none', padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <Search style={{ width: 14, height: 14, position: 'absolute', left: 12, top: 12, color: MUTED }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search remarks, contact, order #, category…"
            style={{ ...S.input, width: '100%', paddingLeft: 34 }}
          />
        </div>
        {!readOnly && (
          <>
            <button
              type="button"
              onClick={() => setEntryModal({ mode: 'cashIn' })}
              style={{ height: 38, padding: '0 16px', borderRadius: R.control, border: 'none', background: CASH_IN, color: '#fff', fontSize: 11, fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <ArrowUpRight style={{ width: 13, height: 13 }} /> + Cash In
            </button>
            <button
              type="button"
              onClick={() => setEntryModal({ mode: 'cashOut' })}
              style={{ height: 38, padding: '0 16px', borderRadius: R.control, border: 'none', background: CASH_OUT, color: '#fff', fontSize: 11, fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <ArrowDownLeft style={{ width: 13, height: 13 }} /> − Cash Out
            </button>
          </>
        )}
      </div>

      {/* ledger */}
      <div style={{ ...S.card, borderRadius: `0 0 ${R.panel}px ${R.panel}px`, overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: 820, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#F9FAFB' }}>
              {['Date & Time', 'Details / Contact', 'Category', 'Payment Mode', 'Inflow (+/−)', 'Running Balance'].map((h) => (
                <th key={h} style={thStyle}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ entry, running }) => {
              const isCredit = entry.amount >= 0;
              const flagged = entry.orderChanged && (entry.orderFlags || []).length > 0;
              return (
                <tr
                  key={entry.entryId}
                  onClick={() => setAuditEntry(entry)}
                  style={{ borderTop: `1px solid #F1F3F5`, cursor: 'pointer' }}
                >
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 700 }}>{formatDay(entry.entryDate || entry.orderDate || entry.createdAt)}</div>
                    <div style={{ fontSize: 10, color: MUTED }}>{entry.entryTime || new Date(entry.createdAt).toLocaleTimeString()}</div>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 700 }}>{entry.productTitle || entry.description || '—'}</div>
                    <div style={{ fontSize: 10, display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
                      {entry.contact && <span style={{ color: ACCENT, fontWeight: 700 }}>● {entry.contact}</span>}
                      {entry.source === 'order_import' && entry.orderId && (
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/admin/platform-orders/${encodeURIComponent(entry.orderId!)}`);
                          }}
                          style={{ color: '#2563EB', fontWeight: 700, textDecoration: 'underline', cursor: 'pointer' }}
                        >
                          Order #{entry.orderId}
                        </span>
                      )}
                      <span style={{ color: MUTED, fontWeight: 700 }}>{entry.source === 'order_import' ? 'Imported' : 'Manual'}</span>
                      {flagged &&
                        (entry.orderFlags || []).map((f) => (
                          <span
                            key={f}
                            style={{ background: 'rgba(220,38,38,0.10)', color: CASH_OUT, fontWeight: 800, padding: '1px 7px', borderRadius: R.chip }}
                          >
                            ⚠ {orderFlagLabel(f)}
                          </span>
                        ))}
                    </div>
                  </td>
                  <td style={tdStyle}>
                    {entry.category ? (
                      <span style={{ background: '#F3F4F6', color: '#374151', fontSize: 9.5, fontWeight: 700, padding: '3px 9px', borderRadius: R.chip }}>
                        {entry.category}
                      </span>
                    ) : (
                      <span style={{ color: MUTED }}>—</span>
                    )}
                  </td>
                  <td style={{ ...tdStyle, color: MUTED }}>{entry.paymentMode || '—'}</td>
                  <td style={{ ...tdStyle, fontWeight: 800, color: isCredit ? CASH_IN : CASH_OUT }}>
                    {isCredit ? '+' : '−'} {money(entry.amount)}
                  </td>
                  <td style={{ ...tdStyle, fontWeight: 800, color: running < 0 ? CASH_OUT : '#111827' }}>{money(running)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div style={{ textAlign: 'center', color: MUTED, fontStyle: 'italic', fontSize: 12, padding: 30 }}>
            {search ? 'No entries match your search.' : 'No entries logged yet.'}
          </div>
        )}
      </div>

      <div style={{ textAlign: 'center', color: '#B45309', fontSize: 11, fontWeight: 600 }}>
        {readOnly
          ? '🔎 Oversight view — this ledger is managed by the seller and cannot be edited here.'
          : '🔒 Only visible to you — imported order entries are immutable history; manual entries can be edited.'}
      </div>

      {/* ── modals ── */}
      {entryModal && !readOnly && (
        <EntryModal
          mode={entryModal.mode}
          entry={entryModal.entry}
          busy={busy}
          onClose={() => setEntryModal(null)}
          onSave={doEntry}
        />
      )}
      {auditEntry && (
        <AuditModal
          entry={auditEntry}
          readOnly={readOnly}
          onClose={() => setAuditEntry(null)}
          onEdit={() => {
            if (auditEntry.source !== 'manual') {
              showToast('Imported order entries are immutable history.', 'info');
              return;
            }
            setEntryModal({ mode: 'edit', entry: auditEntry });
            setAuditEntry(null);
          }}
          onDelete={() => {
            setConfirmDeleteEntry(auditEntry);
            setAuditEntry(null);
          }}
        />
      )}
      {renameOpen && !readOnly && (
        <RenameModal
          current={detail.book.name}
          onClose={() => setRenameOpen(false)}
          onSave={async (name) => {
            try {
              await cb.renameCashbook(detail.book.id, name);
              showToast('Book renamed.');
              setRenameOpen(false);
            } catch (e) {
              showToast(e instanceof Error ? e.message : 'Rename failed', 'danger');
            }
          }}
        />
      )}
      {confirmDeleteBook && !readOnly && (
        <DeleteBookModal
          name={detail.book.name}
          entriesCount={detail.entries.length}
          onClose={() => setConfirmDeleteBook(false)}
          onConfirm={async () => {
            try {
              await cb.deleteCashbook(detail.book.id);
              showToast('Cashbook deleted.', 'info');
              navigate(backTo);
            } catch (e) {
              showToast(e instanceof Error ? e.message : 'Delete failed', 'danger');
            }
          }}
        />
      )}
      {confirmDeleteEntry && !readOnly && (
        <ConfirmModal
          title="Delete this entry?"
          body={
            confirmDeleteEntry.source === 'order_import'
              ? 'This imported order line will be removed from this ledger only. It never changes the order, payment or escrow record.'
              : 'This manual entry will be permanently removed from this ledger.'
          }
          confirmLabel="Delete"
          danger
          onClose={() => setConfirmDeleteEntry(null)}
          onConfirm={async () => {
            try {
              await cb.deleteEntry(confirmDeleteEntry.entryId);
              showToast('Entry deleted.', 'info');
              setConfirmDeleteEntry(null);
            } catch (e) {
              showToast(e instanceof Error ? e.message : 'Delete failed', 'danger');
            }
          }}
        />
      )}
    </>
  );
}

function BackBar({ label, onBack }: { label: string; onBack: () => void }) {
  return (
    <button
      type="button"
      onClick={onBack}
      style={{ alignSelf: 'flex-start', height: 34, padding: '0 12px', borderRadius: R.control, border: `1px solid ${BORDER}`, background: '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 800, color: '#374151' }}
    >
      <ChevronLeft style={{ width: 14, height: 14, color: ACCENT }} /> {label}
    </button>
  );
}

const thStyle: React.CSSProperties = {
  padding: 12,
  textAlign: 'left',
  fontSize: 9.5,
  fontWeight: 800,
  color: '#6B7280',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  borderBottom: `1px solid ${BORDER}`,
};
const tdStyle: React.CSSProperties = { padding: 12, fontSize: 12, color: '#374151', verticalAlign: 'top' };

// ═══════════════════════════ REPORTS ════════════════════════════════

function ReportsView({ cb, navigate }: { cb: CbApi; navigate: (to: string) => void }) {
  const agg = useMemo(() => aggregateBooks(cb.cashbooks), [cb.cashbooks]);
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, borderBottom: `1px solid ${BORDER}`, paddingBottom: 16 }}>
        <BackBar label="Back" onBack={() => navigate('/admin/cashbook')} />
        <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Cashbook Reports</h1>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14 }}>
        <Kpi label="Total Cash In" tone="in" value={formatCurrency(agg.moneyIn)} />
        <Kpi label="Total Cash Out" tone="out" value={formatCurrency(agg.moneyOut)} />
        <Kpi label="Net Balance" tone="net" value={formatCurrency(agg.net)} />
        <Kpi label="Total Books" value={String(cb.cashbooks.length)} />
      </div>
      <div style={{ ...S.card, borderRadius: R.card, padding: 18 }}>
        <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 14 }}>Per-book breakdown</div>
        {cb.cashbooks.length === 0 ? (
          <div style={{ fontSize: 12, color: MUTED }}>No cashbooks yet.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F9FAFB' }}>
                {['Book', 'Entries', 'Imported', 'Cash In', 'Cash Out', 'Net'].map((h) => (
                  <th key={h} style={thStyle}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cb.cashbooks.map((b) => (
                <tr key={b.id} style={{ borderTop: `1px solid #F1F3F5`, cursor: 'pointer' }} onClick={() => navigate(cashbookLedgerPath(b.id))}>
                  <td style={tdStyle}>
                    {b.icon} <strong>{b.name}</strong>
                  </td>
                  <td style={tdStyle}>{b.summary.entryCount}</td>
                  <td style={tdStyle}>{b.summary.importedCount}</td>
                  <td style={{ ...tdStyle, color: CASH_IN, fontWeight: 800 }}>{money(b.summary.moneyIn)}</td>
                  <td style={{ ...tdStyle, color: CASH_OUT, fontWeight: 800 }}>{money(b.summary.moneyOut)}</td>
                  <td style={{ ...tdStyle, fontWeight: 800 }}>{money(b.summary.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

// ═══════════════════════════ ADMIN OVERSIGHT ════════════════════════

function OversightIndexView({ cb, navigate }: { cb: CbApi; navigate: (to: string) => void }) {
  const owners = cb.oversight?.owners || [];
  return (
    <>
      <div style={{ borderBottom: `1px solid ${BORDER}`, paddingBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Cashbook Oversight</h1>
          <span
            style={{
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              padding: '3px 10px',
              borderRadius: 999,
              background: 'rgba(180,83,9,0.12)',
              color: '#B45309',
            }}
          >
            Read-only
          </span>
        </div>
        <p style={{ fontSize: 12, color: '#6B7280', marginTop: 6, marginBottom: 0 }}>
          Browse a seller or creator, open their cashbooks, and inspect ledgers. Staff cannot create, edit, import or
          delete anything here.
        </p>
      </div>

      {cb.oversightError && <ErrorRow message={cb.oversightError} onRetry={() => cb.loadOversight()} />}
      {cb.oversightLoading && owners.length === 0 ? (
        <Loading label="Loading cashbook owners…" />
      ) : owners.length === 0 ? (
        <div style={{ ...S.card, borderRadius: R.card, padding: 40, textAlign: 'center', color: MUTED, fontSize: 13 }}>
          No seller or creator has created a cashbook yet.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
          {owners.map((o) => {
            const headline = o.brandName || o.accountName || o.displayName || o.email || `Account ${o.ownerUserId.slice(0, 8)}…`;
            const secondary = [
              o.brandName ? o.accountName || o.displayName : undefined,
              o.role,
              o.choosifyUserId,
              (o.brandNames && o.brandNames.length > 1) ? `+${o.brandNames.length - 1} more brand${o.brandNames.length > 2 ? 's' : ''}` : undefined,
            ].filter(Boolean).join(' · ') || undefined;
            return (
              <FolderCard
                key={o.ownerUserId}
                icon="🏬"
                color="#18154C"
                title={headline}
                subtitle={secondary}
                reference={o.email}
                updatedAt={o.updatedAt}
                moneyIn={o.moneyIn}
                moneyOut={o.moneyOut}
                net={o.moneyIn - o.moneyOut}
                countLabel={`${o.bookCount} book${o.bookCount === 1 ? '' : 's'} · ${o.entryCount} entries`}
                onOpen={() => navigate(`/admin/cashbook?seller=${encodeURIComponent(o.ownerUserId)}`)}
              />
            );
          })}
        </div>
      )}
    </>
  );
}

function OversightSellerView({
  cb,
  navigate,
  sellerId,
}: {
  cb: CbApi;
  navigate: (to: string) => void;
  sellerId: string;
}) {
  const data = cb.oversightSeller;
  const books = data?.books || [];
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', borderBottom: `1px solid ${BORDER}`, paddingBottom: 16 }}>
        <BackBar label="All sellers" onBack={() => navigate('/admin/cashbook')} />
        <div>
          <div style={{ fontSize: 11, color: MUTED, fontWeight: 700 }}>Cashbook Oversight /</div>
          <div style={{ fontSize: 16, fontWeight: 800 }}>
            {data?.brandName || data?.accountName || sellerId}
          </div>
          {(data?.brandName || data?.accountName) && (
            <div style={{ fontSize: 10.5, color: MUTED }}>
              {[data?.brandName ? data?.accountName : undefined, sellerId].filter(Boolean).join(' · ')}
            </div>
          )}
        </div>
        <div style={{ flex: 1 }} />
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 10.5,
            fontWeight: 800,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            padding: '6px 12px',
            borderRadius: 999,
            background: 'rgba(180,83,9,0.12)',
            color: '#B45309',
          }}
        >
          <Eye style={{ width: 13, height: 13 }} /> Read-only · Managed by Seller
        </span>
      </div>

      {cb.oversightError && <ErrorRow message={cb.oversightError} onRetry={() => cb.loadOversightSeller(sellerId)} />}
      {cb.oversightLoading && books.length === 0 ? (
        <Loading label="Loading this seller's cashbooks…" />
      ) : books.length === 0 ? (
        <div style={{ ...S.card, borderRadius: R.card, padding: 40, textAlign: 'center', color: MUTED, fontSize: 13 }}>
          This seller has no cashbooks.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
          {books.map((b: CashbookListItem) => (
            <FolderCard
              key={b.id}
              icon={b.icon}
              color={b.color}
              title={b.name}
              reference={b.cashbookReferenceId}
              updatedAt={b.updatedAt}
              moneyIn={b.summary.moneyIn}
              moneyOut={b.summary.moneyOut}
              net={b.summary.net}
              countLabel={`${b.summary.entryCount} entries · ${b.summary.importedCount} imported`}
              onOpen={() =>
                navigate(`${cashbookLedgerPath(b.id)}?owner=${encodeURIComponent(sellerId)}`)
              }
            />
          ))}
        </div>
      )}
    </>
  );
}

// ═══════════════════════════ MODALS ═════════════════════════════════

function Backdrop({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 90 }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: R.modal, boxShadow: '0 30px 80px rgba(0,0,0,0.3)', width: 'min(720px, 100%)', maxHeight: '86vh', overflow: 'auto' }}>
        {children}
      </div>
    </div>
  );
}

function fieldLabel(t: string) {
  return <div style={{ fontSize: 9.5, fontWeight: 800, color: MUTED, letterSpacing: '0.03em', textTransform: 'uppercase', marginBottom: 6 }}>{t}</div>;
}

function NewBookModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (name: string, icon: string, color: string) => void;
}) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState(CASHBOOK_ICON_CHOICES[0]);
  const [color, setColor] = useState(CASHBOOK_COLOR_CHOICES[0]);
  return (
    <Backdrop onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) onCreate(name.trim(), icon, color);
        }}
        style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 440 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 800 }}>Create new cashbook</div>
          <button type="button" onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: MUTED }}>
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>
        <div>
          {fieldLabel('Book name')}
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Outlet Sales Ledger" style={{ ...S.input, width: '100%' }} />
        </div>
        <div>
          {fieldLabel('Icon')}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {CASHBOOK_ICON_CHOICES.map((em) => (
              <button
                key={em}
                type="button"
                onClick={() => setIcon(em)}
                style={{ width: 34, height: 34, borderRadius: R.control, border: `1px solid ${icon === em ? ACCENT : BORDER}`, background: icon === em ? 'rgba(255,91,0,0.08)' : '#fff', fontSize: 16, cursor: 'pointer' }}
              >
                {em}
              </button>
            ))}
          </div>
        </div>
        <div>
          {fieldLabel('Colour')}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {CASHBOOK_COLOR_CHOICES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                style={{ width: 26, height: 26, borderRadius: 999, border: `2px solid ${color === c ? '#111827' : 'transparent'}`, background: c, cursor: 'pointer' }}
              />
            ))}
          </div>
        </div>
        <button type="submit" style={{ height: 40, borderRadius: R.control, border: 'none', background: ACCENT, color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
          Create book
        </button>
      </form>
    </Backdrop>
  );
}

function RenameModal({ current, onClose, onSave }: { current: string; onClose: () => void; onSave: (n: string) => void }) {
  const [name, setName] = useState(current);
  return (
    <Backdrop onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim() && name.trim() !== current) onSave(name.trim());
          else onClose();
        }}
        style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 420 }}
      >
        <div style={{ fontSize: 14, fontWeight: 800 }}>Rename cashbook</div>
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} style={{ ...S.input, width: '100%' }} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" onClick={onClose} style={ghostBtn}>
            Cancel
          </button>
          <button type="submit" style={{ ...primaryBtn }}>
            Save
          </button>
        </div>
      </form>
    </Backdrop>
  );
}

function DeleteBookModal({
  name,
  entriesCount,
  onClose,
  onConfirm,
}: {
  name: string;
  entriesCount: number;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [confirmText, setConfirmText] = useState('');
  const match = confirmText === name;
  return (
    <Backdrop onClose={onClose}>
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 460 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: '#991B1B' }}>⚠ Delete “{name}”?</span>
          <button type="button" onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#991B1B', fontWeight: 700 }}>
            ✕ Cancel
          </button>
        </div>
        <div style={{ fontSize: 12, color: '#7F1D1D' }}>
          This permanently removes the book and its {entriesCount} ledger entr{entriesCount === 1 ? 'y' : 'ies'}. It does
          not touch any order, payment or escrow record. Type the book name to authorise.
        </div>
        <input
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder={name}
          style={{ ...S.input, width: '100%', borderColor: '#FCA5A5' }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" onClick={onClose} style={ghostBtn}>
            Cancel
          </button>
          <button
            type="button"
            disabled={!match}
            onClick={onConfirm}
            style={{ ...primaryBtn, background: match ? '#DC2626' : '#FCA5A5', cursor: match ? 'pointer' : 'not-allowed' }}
          >
            Delete book
          </button>
        </div>
      </div>
    </Backdrop>
  );
}

function ConfirmModal({
  title,
  body,
  confirmLabel,
  danger,
  onClose,
  onConfirm,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Backdrop onClose={onClose}>
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 400 }}>
        <div style={{ fontSize: 13.5, fontWeight: 800, color: danger ? '#991B1B' : '#111827' }}>{title}</div>
        <div style={{ fontSize: 12, color: '#6B7280' }}>{body}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" onClick={onClose} style={ghostBtn}>
            Cancel
          </button>
          <button type="button" onClick={onConfirm} style={{ ...primaryBtn, background: danger ? '#DC2626' : ACCENT }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </Backdrop>
  );
}

function EntryModal({
  mode,
  entry,
  busy,
  onClose,
  onSave,
}: {
  mode: 'cashIn' | 'cashOut' | 'edit';
  entry?: CashbookEntry;
  busy: boolean;
  onClose: () => void;
  onSave: (input: {
    direction: 'in' | 'out';
    amount: number;
    description?: string;
    category?: string;
    contact?: string;
    paymentMode?: string;
    docRef?: string;
    entryDate?: string;
    entryTime?: string;
  }) => void;
}) {
  const editingOut = mode === 'edit' ? (entry?.amount ?? 0) < 0 : mode === 'cashOut';
  const [amount, setAmount] = useState(entry ? String(Math.abs(entry.amount)) : '');
  const [contact, setContact] = useState(entry?.contact || '');
  const [remarks, setRemarks] = useState(entry?.description || '');
  const [docRef, setDocRef] = useState(entry?.docRef || '');
  const [category, setCategory] = useState(entry?.category || (editingOut ? 'Utilities' : 'Sales'));
  const [paymentMode, setPaymentMode] = useState(entry?.paymentMode || CASHBOOK_PAYMENT_MODES[0]);
  const [entryDate, setEntryDate] = useState(entry?.entryDate || new Date().toISOString().slice(0, 10));
  const [entryTime, setEntryTime] = useState(entry?.entryTime || '');
  const dir: 'in' | 'out' = editingOut ? 'out' : 'in';
  const accent = editingOut ? CASH_OUT : CASH_IN;

  return (
    <Backdrop onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const amt = Number(amount);
          if (!Number.isFinite(amt) || amt <= 0) return;
          onSave({
            direction: dir,
            amount: amt,
            description: remarks,
            category,
            contact,
            paymentMode,
            docRef,
            entryDate,
            entryTime,
          });
        }}
        style={{ padding: 24 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <span style={{ fontSize: 13.5, fontWeight: 800, color: accent }}>
            {mode === 'edit' ? '✎ Edit entry' : editingOut ? '● − Add Cash Out (expense record)' : '● + Add Cash In (income record)'}
          </span>
          <button type="button" onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: MUTED }}>
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          <div>
            {fieldLabel('Amount (BDT)')}
            <input autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" inputMode="decimal" style={{ ...S.input, width: '100%', marginBottom: 14 }} />
            {fieldLabel('Contact name (supplier / customer)')}
            <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="e.g. Apex Hub, Tangail Cotton…" style={{ ...S.input, width: '100%', marginBottom: 14 }} />
            {fieldLabel('Remarks / transaction description')}
            <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Billing receipts, references…" style={{ ...S.input, width: '100%', minHeight: 70, padding: 10, resize: 'none', height: 'auto', marginBottom: 14 }} />
            {fieldLabel('Document / invoice reference')}
            <input value={docRef} onChange={(e) => setDocRef(e.target.value)} placeholder="Filename or invoice code…" style={{ ...S.input, width: '100%' }} />
          </div>
          <div>
            {fieldLabel('Classification category')}
            <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ ...S.input, width: '100%', marginBottom: 14 }}>
              {CASHBOOK_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            {fieldLabel('Payment mode')}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
              {CASHBOOK_PAYMENT_MODES.map((pm) => (
                <button
                  key={pm}
                  type="button"
                  onClick={() => setPaymentMode(pm)}
                  style={{ padding: 9, borderRadius: R.control, border: `1px solid ${pm === paymentMode ? ACCENT : BORDER}`, background: '#fff', color: pm === paymentMode ? ACCENT : '#374151', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                >
                  {pm}
                </button>
              ))}
            </div>
            {fieldLabel('Billing record date')}
            <input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} style={{ ...S.input, width: '100%', marginBottom: 14 }} />
            {fieldLabel('Time stamp (optional)')}
            <input value={entryTime} onChange={(e) => setEntryTime(e.target.value)} placeholder="e.g. 09:25 PM" style={{ ...S.input, width: '100%' }} />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18, borderTop: `1px solid #F1F3F5`, paddingTop: 16 }}>
          <button type="button" onClick={onClose} style={ghostBtn}>
            Cancel
          </button>
          <button type="submit" disabled={busy} style={{ ...primaryBtn, opacity: busy ? 0.6 : 1 }}>
            {busy && <Loader2 style={{ width: 13, height: 13 }} className="animate-spin" />} {mode === 'edit' ? 'Save changes' : 'Save entry'}
          </button>
        </div>
      </form>
    </Backdrop>
  );
}

function AuditModal({
  entry,
  readOnly,
  onClose,
  onEdit,
  onDelete,
}: {
  entry: CashbookEntry;
  readOnly: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isCredit = entry.amount >= 0;
  const imported = entry.source === 'order_import';
  return (
    <Backdrop onClose={onClose}>
      <div style={{ padding: 24, maxWidth: 560 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <span style={{ fontSize: 13.5, fontWeight: 800 }}>📋 Entry detail</span>
          <button type="button" onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: MUTED }}>
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            {fieldLabel('Classification')}
            <div style={{ fontSize: 13, fontWeight: 800 }}>{isCredit ? 'CASH IN' : 'CASH OUT'} · {imported ? 'Imported order' : 'Manual'}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            {fieldLabel('Amount BDT')}
            <div style={{ fontSize: 16, fontWeight: 800, color: isCredit ? CASH_IN : CASH_OUT }}>
              {isCredit ? '+' : '−'} {money(entry.amount)}
            </div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <Field k="Contact" v={entry.contact || '—'} />
          <Field k="Payment channel" v={entry.paymentMode || '—'} />
          <Field k="Category" v={entry.category || '—'} />
          <Field k="Recorded" v={`${formatDay(entry.entryDate || entry.orderDate || entry.createdAt)} ${entry.entryTime || ''}`} />
          {imported && <Field k="Order" v={entry.orderId ? `#${entry.orderId}` : '—'} />}
          {imported && <Field k="Qty × Unit" v={`${entry.quantity ?? '—'} × ${money(entry.unitPrice)}`} />}
          {imported && entry.sourceOrderStatusAtImport && <Field k="Status at import" v={entry.sourceOrderStatusAtImport} />}
          {imported && entry.liveOrderStatus && <Field k="Order status now" v={entry.liveOrderStatus} />}
        </div>
        {entry.description && (
          <div style={{ ...S.inset, borderRadius: R.panel, padding: 12, marginBottom: 14 }}>
            {fieldLabel('Remarks & descriptions')}
            <div style={{ fontSize: 12, color: '#374151' }}>{entry.description}</div>
          </div>
        )}
        {entry.docRef && (
          <div style={{ ...S.inset, borderRadius: R.panel, padding: '10px 12px', marginBottom: 14, fontSize: 12, fontWeight: 700 }}>📄 {entry.docRef}</div>
        )}
        {imported && (entry.orderFlags || []).length > 0 && (
          <div style={{ background: '#FEF2F2', border: '1px solid rgba(220,38,38,0.25)', borderRadius: R.panel, padding: 12, marginBottom: 14, fontSize: 11.5, color: '#991B1B', fontWeight: 600 }}>
            ⚠ {(entry.orderFlags || []).map(orderFlagLabel).join(' · ')}. The original imported amount is kept as history —
            record a separate compensating Cash Out if a refund actually occurred.
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: `1px solid #F1F3F5`, paddingTop: 16 }}>
          {!readOnly && (
            <>
              <button
                type="button"
                onClick={onEdit}
                disabled={imported}
                title={imported ? 'Imported entries are immutable history' : undefined}
                style={{ ...ghostBtn, opacity: imported ? 0.5 : 1, cursor: imported ? 'not-allowed' : 'pointer' }}
              >
                <Pencil style={{ width: 12, height: 12 }} /> Edit record
              </button>
              <button type="button" onClick={onDelete} style={{ ...ghostBtn, background: '#FEF2F2', color: CASH_OUT, borderColor: 'transparent' }}>
                <Trash2 style={{ width: 12, height: 12 }} /> Delete record
              </button>
            </>
          )}
          {readOnly && <span style={{ fontSize: 11, color: MUTED, fontStyle: 'italic' }}>Read-only — managed by the seller.</span>}
        </div>
      </div>
    </Backdrop>
  );
}

function Field({ k, v }: { k: string; v: string }) {
  return (
    <div>
      {fieldLabel(k)}
      <div style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>{v}</div>
    </div>
  );
}

// ── Import Orders modal — same interaction as before, canonical data underneath ──
function ImportOrdersModal({
  books,
  myUid,
  onClose,
  onImport,
  afterImport,
  showToast,
}: {
  books: CashbookListItem[];
  myUid: string;
  onClose: () => void;
  onImport: CbApi['importOrders'];
  afterImport: (bookId: string) => void;
  showToast: (m: string, t?: 'success' | 'danger' | 'info') => void;
}) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Array<{ orderNumber: string; status: string; date?: string; amount: number }>>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [targetBookId, setTargetBookId] = useState<string>(books[0]?.id || '');
  const [newBookName, setNewBookName] = useState('Imported Sales Ledger');
  const [importing, setImporting] = useState(false);
  const idemRef = useRef<string>(cryptoRandom());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [ops, commerce] = await Promise.all([
          operationsApi.listOrders(myUid ? { sellerId: myUid } : undefined),
          operationsApi.listCommerceOrders('seller').catch(() => [] as CommerceOrderLite[]),
        ]);
        const statusByNumber = new Map<string, string>(
          commerce.map((c) => [c.orderNumber, c.status] as [string, string]),
        );
        const eligible = ops
          .map((o) => {
            const commerceStatus = statusByNumber.get(o.orderId);
            const status = commerceStatus || o.status;
            const subs = (o.subOrders || []) as Array<{ sellerId?: string; items?: Array<{ lineTotal?: number; total?: number }> }>;
            const amount = subs
              .filter((sub) => !myUid || sub.sellerId === myUid)
              .reduce((a, sub) => a + (sub.items || []).reduce((x, it) => x + Number(it.lineTotal ?? it.total ?? 0), 0), 0);
            return { orderNumber: o.orderId, status, date: o.updatedAt || o.createdAt, amount, commerceStatus, opsStatus: o.status };
          })
          .filter((r) => isImportEligibleStatus(r.commerceStatus) || r.opsStatus === 'completed')
          .sort((a, b) => String(b.date).localeCompare(String(a.date)));
        if (!cancelled) setRows(eligible.map(({ orderNumber, status, date, amount }) => ({ orderNumber, status, date, amount })));
      } catch (e) {
        if (!cancelled) showToast(e instanceof Error ? e.message : 'Failed to load orders', 'danger');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [myUid, showToast]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.orderNumber.toLowerCase().includes(q) || r.status.toLowerCase().includes(q));
  }, [rows, search]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const allVisibleSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.orderNumber));
  const selectAll = () => setSelected(new Set(filtered.map((r) => r.orderNumber)));
  const clearAll = () => setSelected(new Set());
  const selLinkStyle: React.CSSProperties = {
    border: 'none',
    background: 'none',
    color: ACCENT,
    fontSize: 11,
    fontWeight: 800,
    cursor: 'pointer',
    padding: 0,
  };

  const runImport = async () => {
    if (selected.size === 0) return;
    setImporting(true);
    try {
      const items = [...selected].map((orderId) => ({ orderId }));
      const params = targetBookId
        ? { bookId: targetBookId, items, idempotencyKey: idemRef.current }
        : { newBookName: (newBookName || 'Imported Sales Ledger').trim(), newBookIcon: '📦', items, idempotencyKey: idemRef.current };
      const result = await onImport(params);
      const parts = [`${result.imported} line item(s) imported`];
      if (result.skipped) parts.push(`${result.skipped} already imported`);
      if (result.failed) parts.push(`${result.failed} not eligible`);
      if (result.rejected?.length) parts.push(`${result.rejected.length} order(s) excluded`);
      showToast(parts.join(' · ') + '.', result.imported > 0 ? 'success' : 'info');
      afterImport(result.book.id);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Import failed', 'danger');
      idemRef.current = cryptoRandom();
    } finally {
      setImporting(false);
    }
  };

  return (
    <Backdrop onClose={onClose}>
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 800 }}>Import orders into a cashbook</div>
          <button type="button" onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: MUTED }}>
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            {fieldLabel('Destination book')}
            <select value={targetBookId} onChange={(e) => setTargetBookId(e.target.value)} style={{ ...S.input, width: '100%' }}>
              <option value="">+ Create new book</option>
              {books.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.icon} {b.name}
                </option>
              ))}
            </select>
          </div>
          {!targetBookId && (
            <div style={{ flex: 1, minWidth: 200 }}>
              {fieldLabel('New book name')}
              <input value={newBookName} onChange={(e) => setNewBookName(e.target.value)} style={{ ...S.input, width: '100%' }} />
            </div>
          )}
        </div>

        <div style={{ position: 'relative' }}>
          <Search style={{ width: 14, height: 14, position: 'absolute', left: 12, top: 12, color: MUTED }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by order number or status…" style={{ ...S.input, width: '100%', paddingLeft: 34 }} />
        </div>

        <div style={{ ...S.inset, borderRadius: R.panel, padding: 12, fontSize: 11, color: '#6B7280', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <Info style={{ width: 14, height: 14, color: ACCENT, flexShrink: 0, marginTop: 1 }} />
          Only <strong>delivered / completed</strong> orders are shown. The server imports just your own line-item value —
          never the whole-order total — and a line already imported into any of your books is skipped.
        </div>

        {/* selection toolbar — individual checkboxes plus mark-all / clear */}
        {!loading && filtered.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#374151' }}>
              {selected.size} of {filtered.length} selected
            </span>
            <div style={{ flex: 1 }} />
            <button type="button" onClick={selectAll} disabled={allVisibleSelected} style={{ ...selLinkStyle, opacity: allVisibleSelected ? 0.4 : 1, cursor: allVisibleSelected ? 'default' : 'pointer' }}>
              Select all ({filtered.length})
            </button>
            <span style={{ color: BORDER }}>|</span>
            <button type="button" onClick={clearAll} disabled={selected.size === 0} style={{ ...selLinkStyle, color: selected.size === 0 ? MUTED : CASH_OUT, opacity: selected.size === 0 ? 0.5 : 1, cursor: selected.size === 0 ? 'default' : 'pointer' }}>
              Clear
            </button>
          </div>
        )}

        <div style={{ border: `1px solid ${BORDER}`, borderRadius: R.panel, maxHeight: 320, overflowY: 'auto' }}>
          {loading ? (
            <Loading label="Loading eligible orders…" />
          ) : filtered.length === 0 ? (
            <div style={{ padding: 30, textAlign: 'center', fontSize: 12, color: MUTED }}>No delivered / completed orders to import.</div>
          ) : (
            <>
              <label style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 12px', borderBottom: `1px solid ${BORDER}`, fontSize: 11, fontWeight: 800, color: '#6B7280', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={() => (allVisibleSelected ? clearAll() : selectAll())}
                />
                Select all visible ({filtered.length})
              </label>
              {filtered.map((r) => (
                <label
                  key={r.orderNumber}
                  style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 12px', borderBottom: `1px solid #F1F3F5`, fontSize: 12, cursor: 'pointer' }}
                >
                  <input type="checkbox" checked={selected.has(r.orderNumber)} onChange={() => toggle(r.orderNumber)} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700 }}>Order #{r.orderNumber}</div>
                    <div style={{ fontSize: 10, color: MUTED, textTransform: 'capitalize' }}>
                      {r.status} · {formatDay(r.date)}
                    </div>
                  </div>
                  <div style={{ fontWeight: 800 }}>{r.amount > 0 ? money(r.amount) : '—'}</div>
                </label>
              ))}
            </>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${BORDER}`, paddingTop: 12 }}>
          <span style={{ fontSize: 11, color: MUTED, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            {selected.size} selected
            {selected.size > 0 && (
              <button type="button" onClick={clearAll} style={{ ...selLinkStyle, color: CASH_OUT }}>
                Clear
              </button>
            )}
          </span>
          <button
            type="button"
            disabled={importing || selected.size === 0}
            onClick={runImport}
            style={{ ...primaryBtn, opacity: importing || selected.size === 0 ? 0.5 : 1, cursor: importing || selected.size === 0 ? 'not-allowed' : 'pointer' }}
          >
            {importing && <Loader2 style={{ width: 13, height: 13 }} className="animate-spin" />} Import selected
          </button>
        </div>
      </div>
    </Backdrop>
  );
}

function cryptoRandom(): string {
  try {
    return (crypto as Crypto & { randomUUID?: () => string }).randomUUID?.() || String(Date.now()) + Math.random();
  } catch {
    return String(Date.now()) + Math.random();
  }
}

const ghostBtn: React.CSSProperties = {
  height: 38,
  padding: '0 16px',
  borderRadius: R.control,
  border: `1px solid ${BORDER}`,
  background: '#fff',
  color: '#374151',
  fontSize: 12,
  fontWeight: 800,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
};
const primaryBtn: React.CSSProperties = {
  height: 38,
  padding: '0 18px',
  borderRadius: R.control,
  border: 'none',
  background: ACCENT,
  color: '#fff',
  fontSize: 12,
  fontWeight: 800,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
};
