import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Search,
  RefreshCw,
  AlertCircle,
  Loader2,
  MessageSquare,
  ShoppingBag,
  ExternalLink,
  Package,
} from 'lucide-react';
import { catalogApi, type WorkspaceCustomerRow } from '../../services/catalogApi';
import { useAuth } from '../../contexts/AuthContext';
import { GlassCard } from '../../components/ui/GlassCard';
import { DataTable, DataTableColumn } from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';

/**
 * Seller / Creator "My Customers" — canonical React customer directory
 * (Option B/D, Sprint 14).
 *
 * Reads the EXISTING canonical route GET /catalog/workspace/{seller,creator}/
 * customers (server/catalogRouter.ts → listMyCustomersForOwner). The server
 * always scopes to the authenticated owner: a partner can never widen it, and
 * GET .../:customerId returns 403 for a buyer outside the caller's own
 * relationship set. No new endpoint, no new store, no client-side ownership
 * derivation.
 *
 * Eligibility (canonical listMyCustomersForOwner rule): a Consumer with >= 1
 * Operations order carrying a sub-order owned by this partner, plus
 * accepted/paid service bookings. A pure buyer↔seller conversation with no
 * order or booking is NOT a customer in V1 (documented limitation).
 *
 * The DTO (SellerCustomerRow) is already "privacy-limited … no phone/address/
 * KYC". This surface additionally never renders the vestigial `flagged` field
 * and exposes NO ban / flag / fraud / moderation control. "Message" and
 * "Create manual order" hand off to the canonical Seller Inbox flow.
 */

const CHOOSIFY_WEB_URL = 'https://choosify.bd';

function formatCurrency(n?: number): string {
  return `৳ ${Number(n || 0).toLocaleString()}`;
}

function segmentBadgeClass(segment: string): string {
  switch (segment) {
    case 'Repeat':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'High Value':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'Inactive':
      return 'bg-slate-50 text-slate-600 border-slate-200';
    default:
      return 'bg-amber-50 text-amber-700 border-amber-200';
  }
}
function orderStatusBadgeClass(status: string): string {
  const s = status.toLowerCase();
  if (s.includes('deliver')) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (s.includes('cancel')) return 'bg-rose-50 text-rose-700 border-rose-200';
  if (s.includes('process')) return 'bg-blue-50 text-blue-700 border-blue-200';
  return 'bg-slate-50 text-slate-700 border-slate-200';
}

export default function SellerMyCustomers() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const owner: 'seller' | 'creator' = profile?.role === 'creator' ? 'creator' : 'seller';

  const [rows, setRows] = useState<WorkspaceCustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<WorkspaceCustomerRow | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await catalogApi.listMyCustomers(owner));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  }, [owner]);

  useEffect(() => {
    void load();
  }, [load]);

  // Search runs inside the already server-scoped owner set only (name / email /
  // CF-ID). It can never reach another partner's customers or the global
  // Consumer directory.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.email || '').toLowerCase().includes(q) ||
        (r.choosifyUserId || '').toLowerCase().includes(q),
    );
  }, [rows, search]);

  const openDetail = useCallback(
    async (customerId: string) => {
      setSelectedId(customerId);
      setDetail(null);
      setDetailError(null);
      setDetailLoading(true);
      try {
        setDetail(await catalogApi.getMyCustomer(customerId, owner));
      } catch (err) {
        setDetailError(err instanceof Error ? err.message : 'Failed to load customer');
      } finally {
        setDetailLoading(false);
      }
    },
    [owner],
  );

  const closeDetail = () => {
    setSelectedId(null);
    setDetail(null);
    setDetailError(null);
  };

  const goToInbox = (customerId: string) => {
    navigate(`/admin/conversations?buyerId=${encodeURIComponent(customerId)}`);
  };

  const columns: DataTableColumn<WorkspaceCustomerRow>[] = [
    {
      key: 'customer',
      header: 'Customer',
      render: (c) => (
        <button
          type="button"
          onClick={() => void openDetail(c.id)}
          className="text-left cursor-pointer group"
        >
          <div className="font-extrabold text-app-text-primary text-[12px] group-hover:text-app-accent">
            {c.name}
          </div>
          <div className="text-[10px] text-app-text-muted font-mono">{c.choosifyUserId || '—'}</div>
        </button>
      ),
      sortValue: (c) => c.name.toLowerCase(),
    },
    {
      key: 'segment',
      header: 'Relationship',
      render: (c) => (
        <span
          className={`inline-block px-1.5 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wide ${segmentBadgeClass(
            c.segment,
          )}`}
        >
          {c.segment}
        </span>
      ),
      sortValue: (c) => c.segment,
    },
    {
      key: 'orders',
      header: 'Orders with you',
      render: (c) => (
        <span className="font-bold text-app-text-primary text-[12px]">
          {c.totalOrders} {c.totalOrders === 1 ? 'order' : 'orders'}
        </span>
      ),
      sortValue: (c) => c.totalOrders,
    },
    {
      key: 'spend',
      header: 'Value with you',
      render: (c) => (
        <span className="font-extrabold text-app-text-primary text-[12px]">
          {formatCurrency(c.totalSpend)}
        </span>
      ),
      sortValue: (c) => Number(c.totalSpend || 0),
    },
    {
      key: 'last',
      header: 'Last order',
      render: (c) => (
        <span className="font-semibold text-app-text-secondary text-[12px]">{c.lastPurchase}</span>
      ),
      sortValue: (c) => c.lastPurchase,
    },
    {
      key: 'actions',
      header: '',
      render: (c) => (
        <div className="flex items-center gap-1.5 justify-end">
          <button
            type="button"
            onClick={() => void openDetail(c.id)}
            className="px-2 py-1 rounded-lg border border-app-border text-[10px] font-bold uppercase tracking-wide text-app-text-secondary hover:text-app-text-primary cursor-pointer"
          >
            View
          </button>
          <button
            type="button"
            onClick={() => goToInbox(c.id)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-app-accent text-white text-[10px] font-bold uppercase tracking-wide cursor-pointer"
          >
            <MessageSquare className="w-3 h-3" /> Message
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-app-accent/10 border border-app-accent/20">
            <Users className="w-5 h-5 text-app-accent" />
          </div>
          <div>
            <h1 className="text-xl font-black text-app-text-primary tracking-tight">My Customers</h1>
            <p className="text-xs text-app-text-secondary">
              Customers who have purchased from{' '}
              {owner === 'creator' ? 'or booked with' : ''} your business.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-app-border text-[10px] font-black uppercase tracking-wider text-app-text-secondary hover:text-app-text-primary"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      <GlassCard className="p-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-app-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search your customers by name, email or CF-ID…"
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-app-border text-[12px] text-app-text-primary bg-white focus:outline-none focus:ring-2 focus:ring-app-accent/30"
          />
        </div>
      </GlassCard>

      <GlassCard>
        {loading && <p className="text-xs text-app-text-muted p-4">Loading customers…</p>}
        {error && (
          <p className="text-xs text-rose-500 p-4 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> {error}
          </p>
        )}
        {!loading && !error && (
          <DataTable
            columns={columns}
            rows={filtered}
            getRowId={(c) => c.id}
            emptyMessage="No customers yet. Buyers appear here after their first order with your business."
          />
        )}
      </GlassCard>

      <Modal
        isOpen={Boolean(selectedId)}
        onClose={closeDetail}
        title={detail ? detail.name : 'Customer'}
        maxWidth="max-w-2xl"
      >
        {detailLoading && (
          <div className="flex items-center gap-2 text-app-text-muted text-sm py-8 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading customer…
          </div>
        )}
        {detailError && (
          <p className="text-xs text-rose-500 flex items-center gap-2 py-4">
            <AlertCircle className="w-4 h-4" /> {detailError}
          </p>
        )}
        {!detailLoading && !detailError && detail && (
          <div className="space-y-5">
            {/* Relationship — this partner ↔ this customer only */}
            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-app-text-muted mb-2">
                Your relationship
              </div>
              <GlassCard hoverLift={false} className="p-3 text-[12px] grid grid-cols-2 gap-y-1 gap-x-4">
                <div>
                  <span className="text-app-text-muted">CF-ID: </span>
                  <span className="font-semibold text-app-text-primary font-mono">
                    {detail.choosifyUserId || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-app-text-muted">Segment: </span>
                  <span className="font-semibold text-app-text-primary">{detail.segment}</span>
                </div>
                <div>
                  <span className="text-app-text-muted">Email: </span>
                  <span className="font-semibold text-app-text-primary">{detail.email || '—'}</span>
                </div>
                <div>
                  <span className="text-app-text-muted">Last order: </span>
                  <span className="font-semibold text-app-text-primary">{detail.lastPurchase}</span>
                </div>
                <div>
                  <span className="text-app-text-muted">Orders with you: </span>
                  <span className="font-semibold text-app-text-primary">{detail.totalOrders}</span>
                </div>
                <div>
                  <span className="text-app-text-muted">Value with you: </span>
                  <span className="font-semibold text-app-text-primary">
                    {formatCurrency(detail.totalSpend)}
                  </span>
                </div>
              </GlassCard>
            </div>

            {/* Recent orders — this partner's own order lines only */}
            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-app-text-muted mb-2 flex items-center gap-1.5">
                <ShoppingBag className="w-3.5 h-3.5" /> Orders with your business ({detail.orders.length})
              </div>
              <div className="space-y-2">
                {detail.orders.length === 0 && (
                  <div className="text-app-text-muted text-[12px]">No order lines.</div>
                )}
                {detail.orders.map((o) => (
                  <GlassCard
                    hoverLift={false}
                    key={o.id}
                    className="p-3 text-[12px] flex flex-wrap items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-app-text-primary truncate">{o.product}</div>
                      <div className="text-[10px] text-app-text-muted font-mono">
                        {o.id} · {o.date}
                        {o.qty ? ` · ×${o.qty}` : ''}
                        {o.bill ? ` · ${o.bill}` : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-bold text-app-text-primary">{formatCurrency(o.price)}</span>
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wide ${orderStatusBadgeClass(
                          o.status,
                        )}`}
                      >
                        {o.status}
                      </span>
                    </div>
                  </GlassCard>
                ))}
              </div>
            </div>

            {detail.reviews.length > 0 && (
              <div className="text-[11px] text-app-text-muted">
                {detail.reviews.length} review{detail.reviews.length === 1 ? '' : 's'} left on your
                products.
              </div>
            )}

            {/* Canonical hand-offs — never re-implemented on this page */}
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => selectedId && goToInbox(selectedId)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-app-accent text-white text-[11px] font-bold cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5" /> Message customer
              </button>
              <button
                type="button"
                onClick={() => selectedId && goToInbox(selectedId)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-app-border text-[11px] font-bold text-app-text-secondary hover:text-app-text-primary cursor-pointer"
                title="Opens the Seller Inbox conversation where the canonical Manual Order dialog lives"
              >
                <Package className="w-3.5 h-3.5" /> Create manual order
              </button>
              <a
                href={`${CHOOSIFY_WEB_URL}/messages/conv_platform_${encodeURIComponent(detail.id)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-app-border text-[11px] font-bold text-app-text-secondary hover:text-app-text-primary"
              >
                Open conversation <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
