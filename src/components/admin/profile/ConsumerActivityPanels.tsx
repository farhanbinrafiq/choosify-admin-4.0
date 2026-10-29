import React, { CSSProperties, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { OpsStorefrontOrder } from '../../../services/operationsApi';
import type { ReturnRequest } from '../../../contexts/ReturnsContext';
import type { WarrantyClaim } from '../../../services/warrantyClaimsApi';
import type { StoredCustomerAddress } from '../../../services/authApi';
import { catalogApi } from '../../../services/catalogApi';

/**
 * Consumer 360 — the shopper's own storefront account sections, read-only for
 * staff: saved addresses, To Pay, Cancellations, Returns, Refunds, Warranty.
 * The lists use the same rules as the storefront "My Account" sections.
 */

const C: Record<string, CSSProperties> = {
  panel: { background: '#fff', border: '1px solid #E8EDF2', borderRadius: 14, padding: 16 },
  title: { fontSize: 11, fontWeight: 900, letterSpacing: '0.08em', color: '#111827', marginBottom: 2 },
  sub: { fontSize: 11, color: '#6B7280', marginBottom: 12 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  th: { textAlign: 'left', fontSize: 10, fontWeight: 800, color: '#6B7280', textTransform: 'uppercase', padding: '8px 6px', borderBottom: '1px solid #E8EDF2' },
  td: { padding: '9px 6px', borderBottom: '1px solid #F1F5F9', verticalAlign: 'top' },
  link: { color: '#EF3C23', fontWeight: 700, textDecoration: 'none' },
  empty: { fontSize: 12, color: '#6B7280', padding: '18px 0', textAlign: 'center' },
  pill: { display: 'inline-block', fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 999, background: '#F1F5F9', color: '#475569', textTransform: 'capitalize' },
};

const date = (iso?: string) => (iso ? new Date(iso).toLocaleDateString() : '—');
const money = (n?: number) => (typeof n === 'number' ? `৳${n.toLocaleString()}` : '—');
const label = (s?: string) => (s ? s.replace(/_/g, ' ') : '—');

/** Storefront rule: an unpaid order still within its payment window. */
export function toPayOrders(orders: OpsStorefrontOrder[], now = Date.now()): OpsStorefrontOrder[] {
  return orders.filter((o) => {
    if (o.status !== 'pending_payment') return false;
    const due = (o as { paymentDueAt?: string }).paymentDueAt;
    return !due || new Date(due).getTime() > now;
  });
}

/** Storefront rule: cancelled orders (by status or a cancellation timestamp). */
export function cancelledOrders(orders: OpsStorefrontOrder[]): OpsStorefrontOrder[] {
  return orders.filter((o) => o.status === 'cancelled' || !!o.cancelledAt);
}

/** Storefront rule: refund cases are return requests past the initial review. */
export function refundCases(returns: ReturnRequest[]): ReturnRequest[] {
  return returns.filter((r) => r.status !== 'initiated');
}

function Panel({ title, sub, error, children }: { title: string; sub: string; error?: string; children: React.ReactNode }) {
  return (
    <div style={C.panel}>
      <div style={C.title}>{title}</div>
      <div style={C.sub}>{sub}</div>
      {error ? <div style={{ fontSize: 12, fontWeight: 700, color: '#DC2626' }}>{error}</div> : children}
    </div>
  );
}

const orderLink = (orderId: string) => (
  <Link to={`/admin/orders/${encodeURIComponent(orderId)}`} style={{ ...C.link, fontFamily: 'monospace' }}>
    {orderId}
  </Link>
);

export function SavedAddressesPanel({ addresses }: { addresses: StoredCustomerAddress[] }) {
  return (
    <Panel title="SAVED ADDRESSES" sub="The shopper's own address book from the storefront (synced while they are signed in).">
      {addresses.length === 0 ? (
        <div style={C.empty} data-testid="consumer-addresses-empty">No saved addresses on the account yet.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 10 }} data-testid="consumer-addresses">
          {addresses.map((a) => (
            <div key={a.id} style={{ border: '1px solid #E8EDF2', borderRadius: 10, padding: 12, fontSize: 12 }} data-testid="consumer-address">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ fontWeight: 800 }}>{String(a.label || label(a.type) || 'Address')}</span>
                <span style={C.pill}>{label(a.type)}</span>
                {a.isDefault ? <span style={{ ...C.pill, background: '#ECFDF5', color: '#047857' }}>Default</span> : null}
              </div>
              {a.recipientName || a.phone ? (
                <div style={{ color: '#374151', marginBottom: 2 }}>
                  {[a.recipientName, a.phone].filter(Boolean).map(String).join(' · ')}
                </div>
              ) : null}
              <div style={{ color: '#111827' }}>{a.summary || '—'}</div>
              {a.trail ? <div style={{ color: '#6B7280', fontSize: 11, marginTop: 2 }}>{a.trail}</div> : null}
              {a.landmark ? <div style={{ color: '#6B7280', fontSize: 11, marginTop: 2 }}>Landmark: {String(a.landmark)}</div> : null}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function OrdersMiniTable({ rows, extra }: { rows: OpsStorefrontOrder[]; extra: { head: string; cell: (o: OpsStorefrontOrder) => React.ReactNode } }) {
  return (
    <table style={C.table}>
      <thead>
        <tr>
          <th style={C.th}>Order</th>
          <th style={C.th}>Placed</th>
          <th style={C.th}>Total</th>
          <th style={C.th}>{extra.head}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((o) => (
          <tr key={o.orderId}>
            <td style={C.td}>{orderLink(o.orderId)}</td>
            <td style={C.td}>{date(o.createdAt)}</td>
            <td style={C.td}>{money((o as { total?: number }).total)}</td>
            <td style={C.td}>{extra.cell(o)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ToPayPanel({ orders, error }: { orders: OpsStorefrontOrder[]; error?: string }) {
  const rows = toPayOrders(orders);
  return (
    <Panel title="TO PAY" sub="Unpaid orders still within their payment window — same list the shopper sees." error={error}>
      {rows.length === 0 ? (
        <div style={C.empty}>Nothing waiting for payment.</div>
      ) : (
        <OrdersMiniTable
          rows={rows}
          extra={{ head: 'Pay by', cell: (o) => date((o as { paymentDueAt?: string }).paymentDueAt) }}
        />
      )}
    </Panel>
  );
}

export function CancellationsPanel({ orders, error }: { orders: OpsStorefrontOrder[]; error?: string }) {
  const rows = cancelledOrders(orders);
  return (
    <Panel title="CANCELLATIONS" sub="Cancelled orders, with who cancelled and why." error={error}>
      {rows.length === 0 ? (
        <div style={C.empty}>No cancelled orders.</div>
      ) : (
        <OrdersMiniTable
          rows={rows}
          extra={{
            head: 'Cancellation',
            cell: (o) => (
              <span>
                {date(o.cancelledAt)} · by {o.cancelledBy || '—'}
                {o.cancelReason ? <span style={{ color: '#6B7280' }}> — {o.cancelReason}</span> : null}
              </span>
            ),
          }}
        />
      )}
    </Panel>
  );
}

function ReturnsTable({ rows, refund }: { rows: ReturnRequest[]; refund?: boolean }) {
  return (
    <table style={C.table}>
      <thead>
        <tr>
          <th style={C.th}>Return</th>
          <th style={C.th}>Order</th>
          <th style={C.th}>Reason</th>
          <th style={C.th}>Status</th>
          {refund ? <th style={C.th}>Refund</th> : <th style={C.th}>Opened</th>}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            <td style={C.td}>
              <Link to={`/admin/returns/${encodeURIComponent(r.id)}`} style={C.link}>
                {r.referenceId || r.id}
              </Link>
            </td>
            <td style={C.td}>{orderLink(r.orderId)}</td>
            <td style={C.td}>{label(r.reason)}</td>
            <td style={C.td}>
              <span style={C.pill}>{label(r.status)}</span>
            </td>
            <td style={C.td}>{refund ? `${money(r.refundAmount)} · ${label(r.refundStatus)}` : date(r.createdAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ReturnsPanel({ returns, error }: { returns: ReturnRequest[]; error?: string }) {
  return (
    <Panel title="RETURNS" sub="Every return request this shopper opened." error={error}>
      {returns.length === 0 ? <div style={C.empty}>No return requests.</div> : <ReturnsTable rows={returns} />}
    </Panel>
  );
}

export function RefundsPanel({ returns, error }: { returns: ReturnRequest[]; error?: string }) {
  const rows = refundCases(returns);
  return (
    <Panel title="REFUNDS" sub="Return cases past the first review, with refund amount and status." error={error}>
      {rows.length === 0 ? <div style={C.empty}>No refund cases.</div> : <ReturnsTable rows={rows} refund />}
    </Panel>
  );
}

export function WarrantyPanel({ claims, error }: { claims: WarrantyClaim[]; error?: string }) {
  return (
    <Panel title="WARRANTY" sub="Warranty claims this shopper filed." error={error}>
      {claims.length === 0 ? (
        <div style={C.empty}>No warranty claims.</div>
      ) : (
        <table style={C.table}>
          <thead>
            <tr>
              <th style={C.th}>Claim</th>
              <th style={C.th}>Order</th>
              <th style={C.th}>Issue</th>
              <th style={C.th}>Status</th>
              <th style={C.th}>Filed</th>
            </tr>
          </thead>
          <tbody>
            {claims.map((c) => (
              <tr key={c.id}>
                <td style={C.td}>
                  <Link to={`/admin/warranty-claims/${encodeURIComponent(c.id)}`} style={C.link}>
                    {c.referenceId || c.id}
                  </Link>
                </td>
                <td style={C.td}>{orderLink(c.orderId)}</td>
                <td style={C.td}>{label(c.issueType)}</td>
                <td style={C.td}>
                  <span style={C.pill}>{label(c.status)}</span>
                </td>
                <td style={C.td}>{date(c.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}

type CatalogThumbs = { brand: (id: string) => string | undefined; creator: (id: string) => string | undefined };
let thumbsLoad: Promise<{ brands: Map<string, string>; creators: Map<string, string> }> | null = null;

/** Brand logos / creator photos by id or slug — for list thumbnails (loaded once per page). */
export function useCatalogThumbs(): CatalogThumbs {
  const [maps, setMaps] = useState<{ brands: Map<string, string>; creators: Map<string, string> } | null>(null);
  useEffect(() => {
    let alive = true;
    thumbsLoad ??= Promise.all([catalogApi.listBrands().catch(() => []), catalogApi.listCreators().catch(() => [])]).then(([brands, creators]) => {
      const b = new Map<string, string>();
      for (const x of brands) if (x.logo) [x.id, x.slug].forEach((k) => k && b.set(k, x.logo));
      const c = new Map<string, string>();
      for (const x of creators) if (x.avatar) [x.id, x.slug].forEach((k) => k && c.set(k, x.avatar));
      return { brands: b, creators: c };
    });
    thumbsLoad.then((m) => alive && setMaps(m)).catch(() => (thumbsLoad = null));
    return () => {
      alive = false;
    };
  }, []);
  return { brand: (id) => maps?.brands.get(id), creator: (id) => maps?.creators.get(id) };
}

/** 32px list thumbnail (empty grey tile when there is no image). */
export function Thumb({ src }: { src?: string | null }) {
  const [broken, setBroken] = useState<string | null>(null);
  return (
    <div style={{ width: 32, height: 32, borderRadius: 6, background: '#F4F7F9', overflow: 'hidden', flexShrink: 0 }}>
      {src && broken !== src ? (
        <img src={src} alt="" onError={() => setBroken(src)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : null}
    </div>
  );
}

/** Saved products / brands / followed creators recorded from the storefront. */
export function SignalList({
  title,
  items,
  empty,
  to,
  thumbFor,
  testId,
}: {
  title: string;
  items: Array<{ id: string; label: string; image?: string; at: string }>;
  empty: string;
  to?: (i: { id: string }) => string;
  /** Fallback image when the saved item has none (brand logo / creator photo). */
  thumbFor?: (id: string) => string | undefined;
  testId: string;
}) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E8EDF2', borderRadius: 8, padding: 16 }} data-testid={testId}>
      <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 2 }}>
        {title} ({items.length})
      </div>
      <div style={{ fontSize: 10.5, color: '#9CA3AF', fontWeight: 600, marginBottom: 10 }}>Recorded from the storefront while signed in.</div>
      {items.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#9CA3AF', fontSize: 12, fontWeight: 600, fontStyle: 'italic', padding: '16px 0' }}>{empty}</div>
      ) : (
        items.map((i) => (
          <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid #F1F3F5', fontSize: 11.5, fontWeight: 700 }}>
            <Thumb src={i.image || thumbFor?.(i.id)} />
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {to ? (
                <Link to={to(i)} style={{ color: '#111827', textDecoration: 'none' }}>
                  {i.label}
                </Link>
              ) : (
                i.label
              )}
            </span>
            <span style={{ color: '#9CA3AF', fontWeight: 600, fontSize: 10.5 }}>{new Date(i.at).toLocaleDateString()}</span>
          </div>
        ))
      )}
    </div>
  );
}

export function SearchHistoryPanel({ searches, error }: { searches: Array<{ q: string; at: string; count?: number }>; error?: string }) {
  return (
    <Panel title="SEARCH HISTORY" sub="Recent storefront searches while signed in (newest first, last 50). ×N = searched N times; the date is the latest search." error={error}>
      <div data-testid="consumer-search-history">
        {!searches.length ? (
          <div style={C.empty}>No searches recorded.</div>
        ) : (
          searches.map((s, i) => (
            <div key={`${s.q}-${i}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '8px 0', borderTop: '1px solid #F1F3F5', fontSize: 11.5, fontWeight: 700 }}>
              <span>
                “{s.q}”
                {(s.count || 1) > 1 ? (
                  <span data-testid="search-count" title={`Searched ${s.count} times`} style={{ ...C.pill, marginLeft: 8, background: '#FFF1EC', color: '#EF3C23', textTransform: 'none' }}>
                    ×{s.count}
                  </span>
                ) : null}
              </span>
              <span style={{ color: '#9CA3AF', fontWeight: 600 }}>{new Date(s.at).toLocaleString()}</span>
            </div>
          ))
        )}
      </div>
    </Panel>
  );
}
