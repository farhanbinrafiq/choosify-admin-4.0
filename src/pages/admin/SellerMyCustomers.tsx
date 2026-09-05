import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Search,
  RefreshCw,
  AlertCircle,
  MessageSquare,
} from 'lucide-react';
import { catalogApi, type WorkspaceCustomerRow } from '../../services/catalogApi';
import { useAuth } from '../../contexts/AuthContext';
import { GlassCard } from '../../components/ui/GlassCard';
import { DataTable, DataTableColumn } from '../../components/ui/DataTable';
import { Avatar } from '../../components/shared/Avatar';

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
export default function SellerMyCustomers() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const owner: 'seller' | 'creator' = profile?.role === 'creator' ? 'creator' : 'seller';

  const [rows, setRows] = useState<WorkspaceCustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

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

  // Was an in-page Modal fetching its own detail copy; "View" now opens the
  // real Seller Customer Profile page (same visual family as the Super
  // Admin Consumer Profile), which fetches this same owner-scoped endpoint
  // itself.
  const openDetail = useCallback(
    (customerId: string) => {
      navigate(`/admin/customers/${encodeURIComponent(customerId)}`);
    },
    [navigate],
  );

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
          onClick={() => openDetail(c.id)}
          className="flex items-center gap-2.5 text-left cursor-pointer group"
        >
          <Avatar src={c.avatarUrl} name={c.name} size={32} />
          <div className="min-w-0">
            <div className="font-extrabold text-app-text-primary text-[12px] group-hover:text-app-accent truncate">
              {c.name}
            </div>
            <div className="text-[10px] text-app-text-muted font-mono">{c.choosifyUserId || '—'}</div>
          </div>
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
            onClick={() => openDetail(c.id)}
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
    </div>
  );
}
