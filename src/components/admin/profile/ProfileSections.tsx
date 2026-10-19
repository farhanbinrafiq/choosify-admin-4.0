import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import type { CatalogBrand, CatalogProduct } from '../../../types/catalog';
import type { OpsReview, OpsStorefrontOrder } from '../../../services/operationsApi';
import type { FinanceSummary } from '../../../services/cashbookApi';
import { adsApi, type AdsApiRecord, type DealRecord, type PromotionRequestRecord } from '../../../services/adsApi';
import { dealFilterKey, formatDealDiscount } from '../../../../shared/deals/dealPricing';
import type { GuideManageRow } from '../../../services/catalogApi';

/**
 * Shared, read-only sections of the Super Admin Consumer / Seller / Creator
 * profile views. Each one renders ONLY records it is given from a canonical
 * source (Products & Inventory, Order Console data, the review store, Ads &
 * Deals, the finance summary) and links every entity to its canonical
 * destination. Nothing here fabricates a value: a metric the backend does not
 * record is shown as unavailable.
 */

const C = {
  panel: { background: '#fff', border: '1px solid #E8EDF2', borderRadius: 8, overflow: 'hidden' } as React.CSSProperties,
  head: { padding: '14px 16px', borderBottom: '1px solid #F1F3F5', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' } as React.CSSProperties,
  title: { fontSize: 12, fontWeight: 800, color: '#111827' } as React.CSSProperties,
  sub: { fontSize: '10.5px', color: '#9CA3AF', fontWeight: 600, marginTop: 2 } as React.CSSProperties,
  empty: { textAlign: 'center', color: '#9CA3AF', fontSize: 12, fontWeight: 600, fontStyle: 'italic', padding: '24px 16px' } as React.CSSProperties,
  th: { textAlign: 'left', fontSize: 9, fontWeight: 800, color: '#9CA3AF', letterSpacing: '0.04em', padding: '9px 12px', borderBottom: '1px solid #F1F3F5', whiteSpace: 'nowrap', background: '#FAFBFC' } as React.CSSProperties,
  td: { fontSize: '11.5px', fontWeight: 600, color: '#111827', padding: '10px 12px', borderBottom: '1px solid #F5F6F8', verticalAlign: 'middle' } as React.CSSProperties,
  link: { color: 'var(--cms-accent)', fontWeight: 800, textDecoration: 'none' } as React.CSSProperties,
  badge: { padding: '2px 8px', borderRadius: 6, fontSize: 9, fontWeight: 800, textTransform: 'uppercase', whiteSpace: 'nowrap', display: 'inline-block' } as React.CSSProperties,
  statRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10, padding: '12px 16px', borderBottom: '1px solid #F1F3F5' } as React.CSSProperties,
  statLabel: { fontSize: 9, fontWeight: 800, color: '#9CA3AF' } as React.CSSProperties,
  statValue: { fontSize: 16, fontWeight: 800, color: '#111827', marginTop: 3 } as React.CSSProperties,
  note: { fontSize: '10.5px', color: '#6B7280', fontWeight: 600, padding: '10px 16px', background: '#F8FAFC', borderTop: '1px solid #F1F3F5' } as React.CSSProperties,
};

const taka = (n: number | undefined | null) => (typeof n === 'number' && Number.isFinite(n) ? `৳${Math.round(n).toLocaleString('en-US')}` : '—');
const day = (iso?: string) => (iso && !Number.isNaN(Date.parse(iso)) ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const tone = (kind: 'ok' | 'warn' | 'bad' | 'muted' | 'info'): React.CSSProperties =>
  kind === 'ok'
    ? { background: '#DCFCE7', color: '#166534' }
    : kind === 'warn'
      ? { background: '#FEF3C7', color: '#92400E' }
      : kind === 'bad'
        ? { background: '#FEE2E2', color: '#991B1B' }
        : kind === 'info'
          ? { background: '#EEF2FF', color: '#3730A3' }
          : { background: '#F1F5F9', color: '#475569' };

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div style={C.statLabel}>{label}</div>
      <div style={C.statValue}>{value}</div>
    </div>
  );
}

export function UnavailablePanel({ title, sub, message, testId }: { title: string; sub?: string; message: React.ReactNode; testId?: string }) {
  return (
    <div style={C.panel} data-testid={testId}>
      <div style={C.head}>
        <div>
          <div style={C.title}>{title}</div>
          {sub ? <div style={C.sub}>{sub}</div> : null}
        </div>
      </div>
      <div style={C.empty}>{message}</div>
    </div>
  );
}

// ── Product listings (Products & Inventory) ────────────────────────────────

const LIVE_STATUSES = new Set(['live', 'active', 'published']);

export function ProductListingsTable({ products, editing }: { products: CatalogProduct[]; editing: boolean }) {
  const rows = useMemo(() => [...products].sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))), [products]);
  const live = products.filter((p) => LIVE_STATUSES.has(String(p.status || '').toLowerCase())).length;
  const outOfStock = products.filter((p) => (p as { productType?: string }).productType !== 'service' && Number(p.stock) <= 0).length;
  return (
    <div style={C.panel} data-testid="profile-products">
      <div style={C.head}>
        <div>
          <div style={C.title}>PRODUCT LISTINGS</div>
          <div style={C.sub}>From Products &amp; Inventory — the seller’s actual catalog.</div>
        </div>
      </div>
      <div style={C.statRow}>
        <Stat label="TOTAL PRODUCTS" value={products.length} />
        <Stat label="LIVE" value={live} />
        <Stat label="NOT LIVE" value={products.length - live} />
        <Stat label="OUT OF STOCK" value={outOfStock} />
      </div>
      {rows.length === 0 ? (
        <div style={C.empty}>No products are listed under this seller’s brands.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
            <thead>
              <tr>
                {['PRODUCT', 'ID / REF', 'CATEGORY', 'PRICE', 'STOCK', 'STATUS', 'UPDATED', ''].map((h) => (
                  <th key={h} style={C.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const isService = (p as { productType?: string }).productType === 'service';
                const status = String(p.status || '—');
                return (
                  <tr key={p.id} data-testid="profile-product-row">
                    <td style={C.td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 6, background: '#F4F7F9', overflow: 'hidden', flexShrink: 0 }}>
                          {p.image ? <img src={p.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
                        </div>
                        <Link to={`/admin/products/${encodeURIComponent(p.id)}/preview`} style={{ ...C.link, color: '#111827', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }} title={p.title}>
                          {p.title}
                        </Link>
                      </div>
                    </td>
                    <td style={{ ...C.td, fontFamily: 'monospace', fontSize: 10.5 }}>{p.productReferenceId || p.id}</td>
                    <td style={C.td}>{p.categoryName || '—'}</td>
                    <td style={C.td}>{taka(p.price)}</td>
                    <td style={C.td}>{isService ? 'Service' : Number(p.stock) > 0 ? `${p.stock} in stock` : <span style={{ ...C.badge, ...tone('bad') }}>Out of stock</span>}</td>
                    <td style={C.td}>
                      <span style={{ ...C.badge, ...tone(LIVE_STATUSES.has(status.toLowerCase()) ? 'ok' : 'muted') }}>{status}</span>
                    </td>
                    <td style={C.td}>{day(p.updatedAt)}</td>
                    <td style={{ ...C.td, whiteSpace: 'nowrap' }}>
                      {editing ? (
                        <Link to={`/admin/products/${encodeURIComponent(p.id)}/edit`} style={C.link} data-testid="profile-product-edit">Edit</Link>
                      ) : (
                        <Link to={`/admin/products/${encodeURIComponent(p.id)}/preview`} style={C.link}>View</Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Guides (Guide Studio records published by the seller's brands) ─────────

export function GuideListingsTable({
  guides,
  views,
  ownerLabel,
}: {
  guides: GuideManageRow[];
  views?: Map<string, string | number | undefined>;
  ownerLabel: string;
}) {
  const rows = useMemo(() => [...guides].sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))), [guides]);
  const live = guides.filter((g) => g.status === 'live').length;
  const draft = guides.filter((g) => g.status === 'draft').length;
  const archived = guides.filter((g) => g.status === 'archived').length;
  return (
    <div style={C.panel} data-testid="profile-guides">
      <div style={C.head}>
        <div>
          <div style={C.title}>GUIDES</div>
          <div style={C.sub}>From Guide Studio — guides published under {ownerLabel}.</div>
        </div>
      </div>
      <div style={C.statRow}>
        <Stat label="TOTAL GUIDES" value={guides.length} />
        <Stat label="LIVE" value={live} />
        <Stat label="DRAFT" value={draft} />
        <Stat label="ARCHIVED" value={archived} />
      </div>
      {rows.length === 0 ? (
        <div style={C.empty}>No guides have been posted yet.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
            <thead>
              <tr>
                {['GUIDE', 'PUBLISHER', 'FORMAT', 'PRODUCTS', 'VIEWS', 'STATUS', 'UPDATED', ''].map((h) => (
                  <th key={h} style={C.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((g) => (
                <tr key={g.id} data-testid="profile-guide-row">
                  <td style={C.td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 6, background: '#F4F7F9', overflow: 'hidden', flexShrink: 0 }}>
                        {g.image ? <img src={g.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
                      </div>
                      <span style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', fontWeight: 800 }} title={g.title}>{g.title}</span>
                    </div>
                  </td>
                  <td style={C.td}>{g.publisherName || '—'}</td>
                  <td style={C.td}>{g.format || g.type || '—'}</td>
                  <td style={C.td}>{g.productCount}</td>
                  <td style={C.td}>{views?.get(g.id) ?? '—'}</td>
                  <td style={C.td}>
                    <span style={{ ...C.badge, ...tone(g.status === 'live' ? 'ok' : g.status === 'draft' ? 'warn' : 'muted') }}>{g.status}</span>
                  </td>
                  <td style={C.td}>{day(g.updatedAt)}</td>
                  <td style={{ ...C.td, whiteSpace: 'nowrap' }}>
                    <Link to={`/admin/guides/${encodeURIComponent(g.id)}/edit`} style={C.link}>Open in Guide Studio</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Order history (canonical Order Console data) ───────────────────────────

const ORDER_TONE: Record<string, 'ok' | 'warn' | 'bad' | 'muted' | 'info'> = {
  completed: 'ok',
  confirmed: 'info',
  active: 'info',
  pending_payment: 'warn',
  cancelled: 'bad',
};

/**
 * Orders as the Order Console stores them. `sellerId` narrows items / amounts
 * to that seller's slice of split orders; without it (consumer view) the whole
 * order is shown. Every order id opens the canonical Order Details page.
 */
export function OrderHistoryTable({ orders, sellerId, perspective }: { orders: OpsStorefrontOrder[]; sellerId?: string; perspective: 'seller' | 'buyer' }) {
  const rows = useMemo(() => [...orders].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))), [orders]);
  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const o of orders) m[o.status] = (m[o.status] || 0) + 1;
    return m;
  }, [orders]);
  return (
    <div style={C.panel} data-testid="profile-orders">
      <div style={C.head}>
        <div>
          <div style={C.title}>ORDER HISTORY</div>
          <div style={C.sub}>From the Order Console. Click an order to open its canonical Order Details.</div>
        </div>
      </div>
      <div style={C.statRow}>
        <Stat label="TOTAL ORDERS" value={orders.length} />
        <Stat label="ACTIVE / CONFIRMED" value={(counts.active || 0) + (counts.confirmed || 0)} />
        <Stat label="COMPLETED" value={counts.completed || 0} />
        <Stat label="CANCELLED" value={counts.cancelled || 0} />
        <Stat label="AWAITING PAYMENT" value={counts.pending_payment || 0} />
      </div>
      {rows.length === 0 ? (
        <div style={C.empty}>{perspective === 'seller' ? 'No orders for this seller yet.' : 'This user has not placed any orders.'}</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820 }}>
            <thead>
              <tr>
                {['ORDER', 'DATE', perspective === 'seller' ? 'CUSTOMER' : 'SELLER', 'ITEMS', 'QTY', 'AMOUNT', 'PAYMENT', 'STATUS'].map((h) => (
                  <th key={h} style={C.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => {
                const slices = sellerId ? (o.subOrders || []).filter((s) => s.sellerId === sellerId) : o.subOrders || [];
                const items = slices.flatMap((s) => s.items || []);
                const qty = items.reduce((n, it) => n + (Number(it.quantity) || 0), 0);
                const amount = sellerId
                  ? slices.reduce((sum, s) => sum + (s.items || []).reduce((t, it) => t + (Number(it.price) || 0) * (Number(it.quantity) || 0), 0) + (Number(s.deliveryFee) || 0), 0)
                  : o.overallTotal;
                const summary = items.length ? `${items[0].productTitle}${items.length > 1 ? ` +${items.length - 1} more` : ''}` : '—';
                const counterpart = perspective === 'seller' ? o.shipping?.fullName || '—' : slices.map((s) => s.sellerBusinessName).filter(Boolean).join(', ') || '—';
                const fulfil = slices.length === 1 && slices[0].trackingStatus ? slices[0].trackingStatus : o.status;
                return (
                  <tr key={o.id} data-testid="profile-order-row">
                    <td style={C.td}>
                      <Link to={`/admin/orders/${encodeURIComponent(o.orderId)}`} style={{ ...C.link, fontFamily: 'monospace' }} data-testid="profile-order-link">
                        {o.orderId}
                      </Link>
                    </td>
                    <td style={C.td}>{day(o.createdAt)}</td>
                    <td style={{ ...C.td, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{counterpart}</td>
                    <td style={{ ...C.td, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={items.map((i) => i.productTitle).join(', ')}>{summary}</td>
                    <td style={C.td}>{qty || '—'}</td>
                    <td style={C.td}>{taka(amount)}</td>
                    <td style={C.td}>
                      <span style={{ ...C.badge, ...tone(o.paymentStatus === 'paid' ? 'ok' : o.paymentStatus === 'failed' || o.paymentStatus === 'cancelled' ? 'bad' : o.isCOD ? 'muted' : 'warn') }}>
                        {o.paymentStatus || (o.isCOD ? 'COD' : '—')}
                      </span>
                    </td>
                    <td style={C.td}>
                      <span style={{ ...C.badge, ...tone(ORDER_TONE[o.status] || 'muted') }}>{String(fulfil).replace(/_/g, ' ')}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {sellerId ? <div style={C.note}>Items, quantity and amount show this seller’s part of each order (including its delivery fee).</div> : null}
    </div>
  );
}

// ── Reviews (canonical review store) ───────────────────────────────────────

/** Circular 0–100 score gauge. */
function ScoreRing({ score, label }: { score: number | null; label: string }) {
  const pct = score ?? 0;
  const color = score === null ? '#CBD5E1' : pct >= 80 ? '#16A34A' : pct >= 60 ? '#F59E0B' : '#DC2626';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div
        style={{ width: 84, height: 84, borderRadius: '50%', background: `conic-gradient(${color} ${pct * 3.6}deg, #F1F3F5 0deg)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        role="img"
        aria-label={score === null ? 'No score yet' : `Score ${pct} out of 100`}
      >
        <div style={{ width: 66, height: 66, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 800, color: '#111827' }}>
          {score === null ? '—' : `${pct}%`}
        </div>
      </div>
      <div style={{ fontSize: 9, fontWeight: 800, color: '#9CA3AF' }}>{label}</div>
    </div>
  );
}

export function ReviewsPanel({
  direction,
  reviews,
  loading,
  error,
  emptyText,
  testId,
}: {
  direction: 'received' | 'posted';
  reviews: OpsReview[];
  loading?: boolean;
  error?: string | null;
  emptyText: string;
  testId?: string;
}) {
  const rated = reviews.filter((r) => Number(r.rating) > 0);
  const avg = rated.length ? rated.reduce((s, r) => s + Number(r.rating), 0) / rated.length : null;
  const dist = [5, 4, 3, 2, 1].map((n) => ({ n, c: rated.filter((r) => Math.round(Number(r.rating)) === n).length }));
  const positive = rated.filter((r) => Number(r.rating) >= 4).length;
  const neutral = rated.filter((r) => Math.round(Number(r.rating)) === 3).length;
  const negative = rated.filter((r) => Number(r.rating) < 2.5).length;
  const responded = reviews.filter((r) => r.response).length;
  // Score out of 100 = average star rating as a percentage of 5 stars.
  const score = avg !== null ? Math.round((avg / 5) * 100) : null;
  const rows = [...reviews].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return (
    <div style={C.panel} data-testid={testId || `profile-reviews-${direction}`}>
      <div style={C.head}>
        <div>
          <div style={C.title}>{direction === 'received' ? 'REVIEWS RECEIVED' : 'REVIEWS POSTED'}</div>
          <div style={C.sub}>
            {direction === 'received'
              ? 'Written by buyers about this seller’s products (from the review store).'
              : 'Written by this account about products it bought (from the review store).'}
          </div>
        </div>
      </div>
      {loading ? (
        <div style={C.empty}><Loader2 size={16} className="animate-spin" /></div>
      ) : error ? (
        <div style={{ ...C.empty, color: '#DC2626', fontStyle: 'normal' }}>{error}</div>
      ) : reviews.length === 0 ? (
        <div style={C.empty}>{emptyText}</div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '14px 16px', borderBottom: '1px solid #F1F3F5', flexWrap: 'wrap' }} data-testid="review-score">
            <ScoreRing score={score} label={direction === 'received' ? 'SCORE' : 'AVG GIVEN'} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(96px,1fr))', gap: 10, flex: '1 1 260px' }}>
              <Stat label="TOTAL REVIEWS" value={reviews.length} />
              <Stat label="AVERAGE RATING" value={avg !== null ? `${avg.toFixed(1)} / 5` : '—'} />
              <Stat label="POSITIVE (4–5★)" value={<span style={{ color: '#166534' }}>{positive}</span>} />
              <Stat label="NEUTRAL (3★)" value={<span style={{ color: '#92400E' }}>{neutral}</span>} />
              <Stat label="NEGATIVE (1–2★)" value={<span style={{ color: '#991B1B' }}>{negative}</span>} />
              {direction === 'received' ? <Stat label="WITH SELLER RESPONSE" value={responded} /> : null}
            </div>
          </div>
          <div style={{ ...C.statRow, alignItems: 'center' }}>
            <div style={{ gridColumn: '1 / -1', minWidth: 0 }}>
              {dist.map(({ n, c }) => (
                <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 700, color: '#6B7280' }}>
                  <span style={{ width: 18 }}>{n}★</span>
                  <div style={{ flex: 1, height: 5, background: '#F1F3F5', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${rated.length ? (c / rated.length) * 100 : 0}%`, height: '100%', background: '#F59E0B' }} />
                  </div>
                  <span style={{ width: 22, textAlign: 'right' }}>{c}</span>
                </div>
              ))}
            </div>
          </div>
          {rows.map((r) => (
            <div key={r.id} style={{ padding: '12px 16px', borderBottom: '1px solid #F5F6F8' }} data-testid="profile-review-row">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 11.5, fontWeight: 800 }}>
                  {direction === 'received' ? r.userName || 'Buyer' : r.brandName || r.storeName || '—'}
                  <span style={{ color: '#F59E0B', marginLeft: 6 }}>{'★'.repeat(Math.max(0, Math.min(5, Math.round(Number(r.rating)))))}</span>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ ...C.badge, ...tone(r.status === 'published' ? 'ok' : r.status === 'rejected' || r.status === 'removed' ? 'bad' : 'warn') }}>{r.status}</span>
                  <span style={{ fontSize: 10.5, color: '#9CA3AF', fontWeight: 600 }}>{day(r.createdAt)}</span>
                </div>
              </div>
              <div style={{ fontSize: 10.5, color: '#6B7280', fontWeight: 600, marginTop: 3 }}>
                {r.productId ? (
                  <Link to={`/admin/products/${encodeURIComponent(r.productId)}/preview`} style={C.link}>{r.productTitle || r.productId}</Link>
                ) : (
                  r.productTitle || '—'
                )}
                {r.orderId ? (
                  <>
                    {' · Order '}
                    <Link to={`/admin/orders/${encodeURIComponent(r.orderId)}`} style={{ ...C.link, fontFamily: 'monospace' }}>{r.orderId}</Link>
                  </>
                ) : null}
              </div>
              <p style={{ fontSize: 11.5, color: '#374151', margin: '6px 0 0', lineHeight: 1.5, overflowWrap: 'anywhere' }}>{r.comment}</p>
              {r.response ? (
                <div style={{ marginTop: 6, fontSize: 11, color: '#4B5563', background: '#F8FAFC', borderRadius: 6, padding: '6px 8px' }}>
                  <b>Response ({r.response.author}):</b> {r.response.comment}
                </div>
              ) : null}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ── Ads & Deals (canonical Ads & Deals records) ────────────────────────────

const DEAL_KEY_TONE: Record<string, 'ok' | 'warn' | 'bad' | 'muted' | 'info'> = {
  active: 'ok',
  scheduled: 'info',
  expired: 'muted',
  paused: 'warn',
  disabled: 'bad',
  legacy: 'muted',
};

export function AdsDealsPanel({ ownerUserId, brands, editing }: { ownerUserId: string; brands?: CatalogBrand[]; editing: boolean }) {
  const [deals, setDeals] = useState<DealRecord[]>([]);
  const [requests, setRequests] = useState<PromotionRequestRecord[]>([]);
  const [banners, setBanners] = useState<AdsApiRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [d, r, b] = await Promise.all([adsApi.listDeals(), adsApi.listPromotionRequests(), adsApi.listBanners()]);
        if (!alive) return;
        setDeals((d || []).filter((x) => x.ownerId === ownerUserId));
        setRequests((r || []).filter((x) => x.ownerId === ownerUserId));
        setBanners((b || []).filter((x) => x.ownerId === ownerUserId));
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : 'Could not load Ads & Deals.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [ownerUserId]);

  const coupons = (brands || []).flatMap((b) => (b.promoCodes || []).map((pc) => ({ ...pc, brandName: b.name })));
  const now = Date.now();
  const dealKeyCounts = deals.reduce<Record<string, number>>((m, d) => {
    const k = dealFilterKey(d as never, now);
    m[k] = (m[k] || 0) + 1;
    return m;
  }, {});

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }} data-testid="profile-ads">
      <div style={C.panel}>
        <div style={C.head}>
          <div>
            <div style={C.title}>DEALS</div>
            <div style={C.sub}>From Ads &amp; Deals. Feature / promotion requests are made per deal in Ads &amp; Deals.</div>
          </div>
          {editing ? (
            <Link to="/admin/ads-studio" style={C.link}>Open Ads &amp; Deals Studio →</Link>
          ) : null}
        </div>
        {loading ? (
          <div style={C.empty}><Loader2 size={16} className="animate-spin" /></div>
        ) : error ? (
          <div style={{ ...C.empty, color: '#DC2626', fontStyle: 'normal' }}>{error}</div>
        ) : (
          <>
            <div style={C.statRow}>
              <Stat label="ACTIVE" value={dealKeyCounts.active || 0} />
              <Stat label="SCHEDULED" value={dealKeyCounts.scheduled || 0} />
              <Stat label="PAUSED / DISABLED" value={(dealKeyCounts.paused || 0) + (dealKeyCounts.disabled || 0)} />
              <Stat label="EXPIRED" value={dealKeyCounts.expired || 0} />
            </div>
            {deals.length === 0 ? (
              <div style={C.empty}>No deals created.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
                  <thead>
                    <tr>{['DEAL', 'OFFER', 'START', 'END', 'STATUS'].map((h) => <th key={h} style={C.th}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {deals.map((d) => {
                      const k = dealFilterKey(d as never, now);
                      return (
                        <tr key={d.id} data-testid="profile-deal-row">
                          <td style={C.td}>
                            <div>{d.title}</div>
                            <div style={{ fontSize: 10, color: '#9CA3AF', fontFamily: 'monospace' }}>{d.dealReferenceId || d.id}</div>
                          </td>
                          <td style={C.td}>{d.dealTerms ? formatDealDiscount(d.dealTerms.mode, d.dealTerms.value) : '—'}</td>
                          <td style={C.td}>{day(d.startsAt)}</td>
                          <td style={C.td}>{day(d.endsAt)}</td>
                          <td style={C.td}><span style={{ ...C.badge, ...tone(DEAL_KEY_TONE[k] || 'muted') }}>{k}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      <div style={C.panel}>
        <div style={C.head}>
          <div>
            <div style={C.title}>FEATURE / PROMOTION REQUESTS</div>
            <div style={C.sub}>Requests to feature or sponsor a deal, reviewed by Choosify.</div>
          </div>
        </div>
        {loading ? null : requests.length === 0 ? (
          <div style={C.empty}>No promotion requests.</div>
        ) : (
          requests.map((r) => (
            <div key={r.id} style={{ padding: '10px 16px', borderBottom: '1px solid #F5F6F8', display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', fontSize: 11.5, fontWeight: 700 }} data-testid="profile-promotion-row">
              <div>
                {r.title} <span style={{ color: '#9CA3AF', fontWeight: 600 }}>· {r.promotionType}</span>
                {r.review?.rejectionReason ? <div style={{ fontSize: 10.5, color: "#6B7280", fontWeight: 600 }}>Rejected: {r.review.rejectionReason}</div> : null}
              </div>
              <span style={{ ...C.badge, ...tone(r.status === 'approved' ? 'ok' : r.status === 'rejected' ? 'bad' : r.status === 'pending' ? 'warn' : 'muted') }}>{r.status}</span>
            </div>
          ))
        )}
      </div>

      <div style={C.panel}>
        <div style={C.head}>
          <div>
            <div style={C.title}>AD CAMPAIGNS</div>
            <div style={C.sub}>Banner ads owned by this account.</div>
          </div>
        </div>
        {loading ? null : banners.length === 0 ? (
          <div style={C.empty}>No ad campaigns.</div>
        ) : (
          banners.map((b) => (
            <div key={b.id} style={{ padding: '10px 16px', borderBottom: '1px solid #F5F6F8', display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', fontSize: 11.5, fontWeight: 700 }} data-testid="profile-campaign-row">
              <div>
                {b.title}
                <div style={{ fontSize: 10.5, color: '#9CA3AF', fontWeight: 600 }}>{day(b.startsAt)} – {day(b.endsAt)}</div>
              </div>
              <span style={{ ...C.badge, ...tone(b.status === 'active' ? 'ok' : b.status === 'pending' ? 'warn' : b.status === 'rejected' || b.status === 'disabled' ? 'bad' : 'muted') }}>{b.status}</span>
            </div>
          ))
        )}
        <div style={C.note}>Budget, spend, impressions, clicks, conversions and attributed GMV are not recorded for ads yet, so they are not shown.</div>
      </div>

      {brands ? (
        <div style={C.panel}>
          <div style={C.head}>
            <div>
              <div style={C.title}>COUPONS</div>
              <div style={C.sub}>Promo codes on this seller’s brand profiles (Brand Studio).</div>
            </div>
          </div>
          {coupons.length === 0 ? (
            <div style={C.empty}>No promo codes on this seller’s brands.</div>
          ) : (
            coupons.map((c) => {
              const expired = c.endDate && Date.parse(c.endDate) < now;
              return (
                <div key={`${c.brandName}-${c.id}`} style={{ padding: '10px 16px', borderBottom: '1px solid #F5F6F8', display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', fontSize: 11.5, fontWeight: 700 }} data-testid="profile-coupon-row">
                  <div>
                    <span style={{ fontFamily: 'monospace' }}>{c.code}</span> · {c.discountType === 'Flat' ? taka(c.discountValue) : `${c.discountValue}%`} off · {c.brandName}
                    <div style={{ fontSize: 10.5, color: '#9CA3AF', fontWeight: 600 }}>
                      {day(c.startDate)} – {day(c.endDate)}{c.usageLimit ? ` · limit ${c.usageLimit}` : ''}
                    </div>
                  </div>
                  <span style={{ ...C.badge, ...tone(!c.enabled ? 'muted' : expired ? 'muted' : 'ok') }}>{!c.enabled ? 'disabled' : expired ? 'expired' : 'active'}</span>
                </div>
              );
            })
          )}
          <div style={C.note}>Coupon usage counts are not recorded per brand promo code.</div>
        </div>
      ) : null}
    </div>
  );
}

// ── Seller earnings (escrow-derived finance summary) ───────────────────────

export function SellerEarningsPanel({ finance, unavailable }: { finance: FinanceSummary | null; unavailable: boolean }) {
  if (unavailable || !finance) {
    return <UnavailablePanel title="MY EARNINGS" sub="Escrow-derived finance summary." message="No finance summary is available for this seller yet." testId="profile-earnings" />;
  }
  return (
    <div style={C.panel} data-testid="profile-earnings">
      <div style={C.head}>
        <div>
          <div style={C.title}>MY EARNINGS</div>
          <div style={C.sub}>Escrow-derived finance summary (GET /finance/summary).</div>
        </div>
      </div>
      <div style={C.statRow}>
        <Stat label="LIFETIME EARNINGS" value={taka(finance.lifetimeEarnings)} />
        <Stat label="AVAILABLE BALANCE" value={taka(finance.availableBalance)} />
        <Stat label="PENDING APPROVAL" value={taka(finance.pendingApproval)} />
        <Stat label="ESCROW HELD" value={taka(finance.escrowHeld)} />
      </div>
      <div style={C.statRow}>
        <Stat label="GROSS ELIGIBLE" value={taka(finance.grossEligibleAmount)} />
        <Stat label={`CHOOSIFY COMMISSION (${finance.choosifyCommissionPercent}%)`} value={taka(finance.choosifyCommission)} />
        <Stat label="OTHER ADJUSTMENTS" value={taka(finance.otherAdjustments)} />
        <Stat label="NET WITHDRAWABLE" value={taka(finance.netWithdrawable)} />
      </div>
      <div style={{ padding: '12px 16px' }}>
        <div style={{ ...C.statLabel, marginBottom: 6 }}>ADJUSTMENTS</div>
        {finance.adjustments.length === 0 ? (
          <div style={{ ...C.empty, padding: '8px 0' }}>No adjustments recorded.</div>
        ) : (
          finance.adjustments.map((a) => (
            <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 11.5, fontWeight: 600, padding: '7px 0', borderTop: '1px solid #F5F6F8' }}>
              <div>
                {a.description || a.type} <span style={{ color: '#9CA3AF' }}>· {day(a.date)} · {a.status}</span>
              </div>
              <div style={{ fontWeight: 800, color: a.debit ? '#991B1B' : '#166534' }}>{a.debit ? `−${taka(a.debit)}` : `+${taka(a.credit)}`}</div>
            </div>
          ))
        )}
      </div>
      <div style={C.note}>
        {finance.commissionNote} Withdrawal history is not recorded by the backend yet, so it is not shown.
      </div>
    </div>
  );
}
