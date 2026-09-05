import React, { useCallback, useEffect, useMemo, useState, CSSProperties } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2, AlertTriangle, ArrowLeft, MessageSquare, ShoppingBag, Package, ExternalLink, Star } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { catalogApi, type WorkspaceCustomerRow } from '../../../services/catalogApi';
import { Avatar } from '../../../components/shared/Avatar';

// ============================================================================
// Seller Customer Profile — /admin/customers/:id.
//
// Visually inherits the ConsumerProfileView shell (left identity rail + cover
// + tabbed right column) so the seller-facing directory belongs to the same
// design family as the Super Admin Consumer Profile, but this is NOT that
// page's permission set: it fetches through the existing owner-scoped
// GET /catalog/workspace/{seller,creator}/customers/:customerId
// (catalogApi.getMyCustomer — server/catalog/sellerWorkspace.ts
// getMyCustomerForOwner), which the server always scopes to the
// authenticated caller's own relationship set (403 for anyone else's
// customer, see catalogRouter.ts). No new endpoint, no client-side
// ownership check, no admin-only fields (no LTV, no other-seller history,
// no followed brands/creators, no search history, no security/session
// trail, no Login As User, no suspension control).
//
// This replaces the primitive Modal in SellerMyCustomers.tsx as the primary
// "View" destination for that page; the data it shows is identical to what
// that modal already rendered (WorkspaceCustomerRow) — only the
// presentation and depth of navigation change.
// ============================================================================

const ACCENT = 'var(--cms-accent)';
const ACCENT_WASH = 'color-mix(in srgb, var(--cms-accent) 10%, transparent)';

function formatCurrency(n?: number): string {
  return `৳ ${Number(n || 0).toLocaleString()}`;
}

function segmentBadgeStyle(segment: string): CSSProperties {
  const map: Record<string, { bg: string; fg: string }> = {
    Repeat: { bg: 'rgba(16,185,129,0.1)', fg: '#059669' },
    'High Value': { bg: 'rgba(37,99,235,0.1)', fg: '#2563EB' },
    Inactive: { bg: '#F1F3F5', fg: '#6B7280' },
  };
  const c = map[segment] || { bg: 'rgba(245,158,11,0.1)', fg: '#B45309' };
  return { background: c.bg, color: c.fg, padding: '3px 8px', borderRadius: 5, fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.03em' };
}

function orderStatusBadgeStyle(status: string): CSSProperties {
  const s = status.toLowerCase();
  const c = s.includes('deliver')
    ? { bg: 'rgba(16,185,129,0.1)', fg: '#059669' }
    : s.includes('cancel')
      ? { bg: 'rgba(244,63,94,0.1)', fg: '#E11D48' }
      : s.includes('process')
        ? { bg: 'rgba(37,99,235,0.1)', fg: '#2563EB' }
        : { bg: '#F1F3F5', fg: '#6B7280' };
  return { background: c.bg, color: c.fg, padding: '3px 8px', borderRadius: 5, fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.03em' };
}

const CHOOSIFY_WEB_URL = 'https://choosify.bd';

const TABS = [
  { key: 'info', label: 'Customer Information' },
  { key: 'orders', label: 'Orders With You' },
  { key: 'reviews', label: 'Reviews' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

export default function SellerCustomerProfileView() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const owner: 'seller' | 'creator' = profile?.role === 'creator' ? 'creator' : 'seller';

  const [detail, setDetail] = useState<WorkspaceCustomerRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('info');

  const load = useCallback(async () => {
    if (!id) {
      setError('No customer id in the URL.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setDetail(await catalogApi.getMyCustomer(id, owner));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load customer.');
    } finally {
      setLoading(false);
    }
  }, [id, owner]);

  useEffect(() => {
    void load();
  }, [load]);

  // Same canonical hand-off SellerMyCustomers.tsx already uses — this
  // targets the buyer's Consumer messaging context (not this person's
  // Seller inbox, if they also happen to have a seller identity), unchanged
  // from the existing, working behavior.
  const goToInbox = () => {
    if (!id) return;
    navigate(`/admin/conversations?buyerId=${encodeURIComponent(id)}`);
  };

  const S: Record<string, CSSProperties> = useMemo(() => ({
    headRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 12 },
    h1: { fontSize: 15, fontWeight: 800, color: '#111827' },
    sub: { fontSize: '11.5px', color: '#9CA3AF', fontWeight: 600, marginTop: 2 },
    hBtn: { background: '#fff', border: '1px solid #E8EDF2', borderRadius: 8, padding: '9px 14px', fontSize: '11.5px', fontWeight: 800, color: '#374151', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 },
    grid: { display: 'grid', gridTemplateColumns: 'minmax(0,260px) minmax(0,1fr)', gap: 16, alignItems: 'start' },
    card: { background: '#fff', border: '1px solid #E8EDF2', borderRadius: 10, overflow: 'hidden' },
    cover: { height: 80, background: `linear-gradient(120deg,#BFDBFE 0%,#DDD6FE 50%, ${ACCENT} 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    coverLabel: { fontSize: 13, fontWeight: 800, letterSpacing: '0.15em', color: '#fff' },
    avatar: { width: 56, height: 56, borderRadius: '50%', background: '#fff', border: '1px solid #E8EDF2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16, marginTop: -42, marginBottom: 10, boxShadow: '0 2px 6px rgba(0,0,0,0.08)' },
    pName: { fontSize: '13.5px', fontWeight: 800 },
    pEmail: { fontSize: 11, color: '#2563EB', fontWeight: 600, marginTop: 2 },
    kv: { display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 },
    kLabel: { fontSize: 9, fontWeight: 800, color: '#9CA3AF', letterSpacing: '0.02em' },
    kValue: { fontSize: '11.5px', fontWeight: 700, marginTop: 2, color: '#111827' },
    kRow: { borderTop: '1px solid #F1F3F5', paddingTop: 8 },
    btnRow: { display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' },
    panel: { background: '#fff', border: '1px solid #E8EDF2', borderRadius: 8, padding: 16 },
    panelTitle: { fontSize: '12.5px', fontWeight: 800, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6 },
    statGrid: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 },
    statCard: { background: '#fff', border: '1px solid #E8EDF2', borderRadius: 8, padding: 14 },
    statLabel: { fontSize: 9, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.03em' },
    statValue: { fontSize: '15px', fontWeight: 800, color: '#111827', marginTop: 4 },
    tabBar: { display: 'flex', gap: 16, background: '#fff', border: '1px solid #E8EDF2', borderRadius: 8, padding: '0 16px', overflowX: 'auto' },
    tab: { padding: '12px 4px', fontSize: '11.5px', fontWeight: 800, whiteSpace: 'nowrap', cursor: 'pointer', borderBottom: '2px solid transparent', color: '#6B7280' },
    tabActive: { color: ACCENT, borderBottom: `2px solid ${ACCENT}` },
    emptyBox: { textAlign: 'center', color: '#9CA3AF', fontSize: 12, fontWeight: 600, fontStyle: 'italic', padding: '24px 0' },
    orderRow: { background: '#fff', border: '1px solid #E8EDF2', borderRadius: 8, padding: 12, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    reviewRow: { borderTop: '1px solid #F1F3F5', padding: '10px 0', fontSize: '11.5px' },
  }), []);

  if (loading) {
    return (
      <div style={{ padding: '60px 0', textAlign: 'center', color: '#6B7280', fontSize: 12 }}>
        <Loader2 size={24} className="animate-spin" style={{ opacity: 0.5, marginBottom: 10 }} />
        <div>Loading customer…</div>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div style={{ padding: '48px 0', textAlign: 'center' }}>
        <p style={{ color: '#DC2626', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <AlertTriangle size={16} /> {error || 'Customer not found.'}
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 14 }}>
          <button onClick={() => void load()} style={S.hBtn}>Retry</button>
          <button onClick={() => navigate('/admin/customers')} style={S.hBtn}>← My Customers</button>
        </div>
      </div>
    );
  }

  const kv = (label: string, value: React.ReactNode, mono = false, first = false) => (
    <div style={first ? undefined : S.kRow}>
      <div style={S.kLabel}>{label}</div>
      <div style={{ ...S.kValue, ...(mono ? { fontFamily: 'monospace' } : {}) }}>{value}</div>
    </div>
  );

  return (
    <div style={{ color: '#111827' }}>
      <div style={S.headRow}>
        <div>
          <div style={S.h1}>Customer Profile</div>
          <div style={S.sub}>Your relationship with this customer only — not the platform-wide account</div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <button onClick={goToInbox} style={{ ...S.hBtn, borderColor: ACCENT, color: ACCENT, background: ACCENT_WASH }}>
            <MessageSquare size={13} /> Message
          </button>
          <button onClick={() => navigate('/admin/customers')} style={S.hBtn}>
            <ArrowLeft size={13} /> My Customers
          </button>
        </div>
      </div>

      <div style={S.grid} className="cpv-grid">
        {/* ── Left identity rail ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={S.card}>
            <div style={S.cover}><span style={S.coverLabel}>CUSTOMER</span></div>
            <div style={{ padding: 16, position: 'relative' }}>
              <Avatar src={detail.avatarUrl} name={detail.name} size={56} style={S.avatar} />
              <div style={S.pName}>{detail.name}</div>
              {detail.email ? <div style={S.pEmail}>{detail.email}</div> : null}

              <div style={S.kv}>
                {kv('CHOOSIFY USER ID', detail.choosifyUserId || '—', true, true)}
                {kv('RELATIONSHIP', <span style={segmentBadgeStyle(detail.segment)}>{detail.segment}</span>)}
                {kv('ORDERS WITH YOU', detail.totalOrders)}
                {kv('VALUE WITH YOU', formatCurrency(detail.totalSpend))}
                {kv('LAST ORDER', detail.lastPurchase)}
              </div>

              <div style={S.btnRow}>
                <button
                  onClick={goToInbox}
                  style={{ flex: 1, background: ACCENT, color: '#fff', border: 'none', borderRadius: 7, padding: '8px 0', fontSize: 11, fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
                >
                  <MessageSquare size={12} /> Message
                </button>
                <button
                  onClick={goToInbox}
                  title="Opens the Seller Inbox conversation where the canonical Manual Order dialog lives"
                  style={{ flex: 1, background: '#fff', border: '1px solid #E8EDF2', borderRadius: 7, padding: '8px 0', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
                >
                  <Package size={12} /> Manual order
                </button>
              </div>
              <a
                href={`${CHOOSIFY_WEB_URL}/messages/conv_platform_${encodeURIComponent(detail.id)}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, color: '#6B7280', fontWeight: 700 }}
              >
                Open conversation <ExternalLink size={11} />
              </a>
            </div>
          </div>
        </div>

        {/* ── Right column ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
          <div style={S.statGrid}>
            <div style={S.statCard}>
              <div style={S.statLabel}>Orders With You</div>
              <div style={S.statValue}>{detail.totalOrders}</div>
            </div>
            <div style={S.statCard}>
              <div style={S.statLabel}>Value With You</div>
              <div style={S.statValue}>{formatCurrency(detail.totalSpend)}</div>
            </div>
            <div style={S.statCard}>
              <div style={S.statLabel}>Last Order</div>
              <div style={S.statValue}>{detail.lastPurchase}</div>
            </div>
          </div>

          <div style={S.tabBar}>
            {TABS.map((t) => (
              <div key={t.key} onClick={() => setActiveTab(t.key)} style={{ ...S.tab, ...(activeTab === t.key ? S.tabActive : {}) }}>
                {t.label}
              </div>
            ))}
          </div>

          {activeTab === 'info' && (
            <div style={S.panel}>
              <div style={S.panelTitle}>Relationship summary</div>
              <div style={{ ...S.emptyBox, display: detail ? 'none' : 'block' }} />
              <div style={{ marginTop: 10, fontSize: '11.5px', color: '#374151', lineHeight: 1.7 }}>
                This view shows only the commercial relationship between your business and this
                customer — orders, spend and reviews involving your products. It does not include
                this person&apos;s activity with other sellers or any platform-wide account data.
              </div>
            </div>
          )}

          {activeTab === 'orders' && (
            <div style={S.panel}>
              <div style={S.panelTitle}><ShoppingBag size={13} /> Orders with your business ({detail.orders.length})</div>
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {detail.orders.length === 0 ? (
                  <div style={S.emptyBox}>No order lines.</div>
                ) : (
                  detail.orders.map((o) => (
                    <div key={o.id} style={S.orderRow}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: '11.5px' }}>{o.product}</div>
                        <div style={{ fontSize: 10, color: '#9CA3AF', fontFamily: 'monospace' }}>
                          {o.id} · {o.date}{o.qty ? ` · ×${o.qty}` : ''}{o.bill ? ` · ${o.bill}` : ''}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 800, fontSize: '11.5px' }}>{formatCurrency(o.price)}</span>
                        <span style={orderStatusBadgeStyle(o.status)}>{o.status}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'reviews' && (
            <div style={S.panel}>
              <div style={S.panelTitle}><Star size={13} /> Reviews on your products ({detail.reviews.length})</div>
              <div style={{ marginTop: 6 }}>
                {detail.reviews.length === 0 ? (
                  <div style={S.emptyBox}>No reviews yet.</div>
                ) : (
                  detail.reviews.map((r) => (
                    <div key={r.id} style={S.reviewRow}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <span style={{ fontWeight: 700 }}>{r.productName}</span>
                        <span style={{ color: '#9CA3AF', fontSize: 10 }}>{r.date}</span>
                      </div>
                      <div style={{ color: '#F59E0B', fontWeight: 700, marginTop: 2 }}>{'★'.repeat(Math.round(r.rating))}{'☆'.repeat(Math.max(0, 5 - Math.round(r.rating)))}</div>
                      {r.comment ? <div style={{ color: '#374151', marginTop: 4 }}>{r.comment}</div> : null}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
