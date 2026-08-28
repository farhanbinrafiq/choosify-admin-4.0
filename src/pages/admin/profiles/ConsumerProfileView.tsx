import React, { useCallback, useEffect, useMemo, useState, CSSProperties } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { useRbac } from '../../../contexts/RbacContext';
import { useImpersonation } from '../../../contexts/ImpersonationContext';
import { useContact } from '../../../contexts/ContactInteractionContext';
import { Loader2, AlertTriangle, Phone, Mail, ArrowLeft, LogIn } from 'lucide-react';

// ============================================================================
// Consumer Profile — the canonical /admin/consumers/:id surface.
//
// Sprint 13 UI regression lock — PRESENTATION is a faithful reproduction of the
// approved standalone `isCustomerDetail` section (design-reference/Choosify
// Admin CMS (standalone).html, decoded lines 3489–3830): exact hex, px, grid
// and DOM structure as inline styles. Sanctioned deviation: the accent uses the
// canonical `--cms-accent` token, not the raw reference `#FF5B00`.
//
// FUNCTIONALITY: identity, role, CF-ID and lifecycle come from the real
// GET /api/v1/auth/users/:id (server/authRouter.ts:1440). Impersonation
// ("Login As User") and "Message" reuse the existing ImpersonationContext /
// ContactInteractionContext. Routing/auth is unchanged — this component is
// mounted by the same ProtectedRoute > RoleGuard > AdminLayout wrappers in
// App.tsx that previously mounted UnifiedProfileShell for this path.
//
// The standalone prototype fills LTV, wallet, tickets, addresses, connected
// accounts, sessions, followed brands/creators, saved items, search history and
// the suspend toggle from its mock `Component.USERS` array. NONE of those have a
// production data source for a consumer. Every such section keeps its approved
// shape and renders an honest empty / disabled state — no prototype values are
// reproduced. This is deliberately separate from UnifiedProfileShell so the
// Seller / Creator / Brand / Order / Admin presentations are untouched.
// ============================================================================

const ACCENT = 'var(--cms-accent)';
const ACCENT_WASH = 'color-mix(in srgb, var(--cms-accent) 10%, transparent)';

interface AccountDetail {
  uid: string;
  email: string;
  displayName: string;
  role: string;
  choosifyUserId?: string | null;
  createdAt?: string;
  profileStatus?: string;
  identityVerified?: boolean;
  marketplaceAccess?: boolean;
  partnerApplicationStatus?: string | null;
}

const initialsFor = (name: string) =>
  (name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('') || 'U';

const TABS: Array<{ key: string; label: string; icon: string }> = [
  { key: 'account', label: 'Account Information', icon: '⚙' },
  { key: 'orders', label: 'Order History', icon: '▤' },
  { key: 'reviews', label: 'Reviews & Score', icon: '●' },
  { key: 'brands', label: 'Followed Brands', icon: '♦' },
  { key: 'saved', label: 'Saved Items', icon: '📌' },
  { key: 'creators', label: 'Followed Creators', icon: '🎞' },
  { key: 'search', label: 'Search History', icon: '🔍' },
];

const ORDER_PILLS = ['All', 'Pending', 'Confirmed', 'Processing', 'Dispatched', 'In Transit', 'Delivered', 'Cancelled', 'Returned', 'Exchanged'];

export default function ConsumerProfileView() {
  const { id } = useParams<{ id: string }>();
  const uid = id ? decodeURIComponent(id) : '';
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { profile } = useAuth();
  const { can } = useRbac();
  const { state: impersonation, openLoginAsConfirm } = useImpersonation();
  const { triggerMessage } = useContact();

  const [account, setAccount] = useState<AccountDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('account');

  const load = useCallback(async () => {
    if (!uid) {
      setError('No account id in the URL.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('choosify_auth_token');
      const res = await fetch(`/api/v1/auth/users/${encodeURIComponent(uid)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const body = (await res.json().catch(() => ({}))) as { data?: AccountDetail; error?: string };
      if (!res.ok || !body.data) throw new Error(body.error || `Request failed (${res.status})`);
      setAccount(body.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load account detail.');
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    void load();
  }, [load]);

  const name = account?.displayName || '(no name on file)';
  const email = account?.email || '—';
  const cfId = account?.choosifyUserId || '—';
  const joined = account?.createdAt ? new Date(account.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
  const isSelf = Boolean(profile?.id && account?.uid && profile.id === account.uid);
  const showLoginAsUser = can('impersonate') && !impersonation.active && !isSelf && Boolean(account?.uid);

  const requestLoginAs = useCallback(() => {
    if (!account) return;
    openLoginAsConfirm({
      targetUserId: account.uid,
      displayName: account.displayName || 'User',
      roleLabel: 'Consumer',
      choosifyUserId: account.choosifyUserId || undefined,
      email: account.email,
      avatarUrl: '',
    });
  }, [account, openLoginAsConfirm]);

  // ?impersonate=1 auto-opens the Login As confirmation, matching the prior
  // UnifiedProfileShell behaviour for this route.
  useEffect(() => {
    if (!showLoginAsUser) return;
    if (searchParams.get('impersonate') !== '1') return;
    requestLoginAs();
    const next = new URLSearchParams(searchParams);
    next.delete('impersonate');
    setSearchParams(next, { replace: true });
  }, [showLoginAsUser, searchParams, setSearchParams, requestLoginAs]);

  const S: Record<string, CSSProperties> = useMemo(() => ({
    headRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 12 },
    h1: { fontSize: 15, fontWeight: 800, color: '#111827' },
    sub: { fontSize: '11.5px', color: '#9CA3AF', fontWeight: 600, marginTop: 2 },
    hBtn: { background: '#fff', border: '1px solid #E8EDF2', borderRadius: 8, padding: '9px 14px', fontSize: '11.5px', fontWeight: 800, color: '#374151', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 },
    grid: { display: 'grid', gridTemplateColumns: 'minmax(0,260px) minmax(0,1fr)', gap: 16, alignItems: 'start' },
    card: { background: '#fff', border: '1px solid #E8EDF2', borderRadius: 10, overflow: 'hidden' },
    cover: { height: 80, background: `linear-gradient(120deg,#FBCFE8 0%,#FDE68A 50%, ${ACCENT} 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    coverLabel: { fontSize: 14, fontWeight: 800, letterSpacing: '0.15em', color: '#fff' },
    avatar: { width: 56, height: 56, borderRadius: '50%', background: '#fff', border: '1px solid #E8EDF2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16, marginTop: -42, marginBottom: 10, boxShadow: '0 2px 6px rgba(0,0,0,0.08)' },
    pName: { fontSize: '13.5px', fontWeight: 800 },
    pEmail: { fontSize: 11, color: '#2563EB', fontWeight: 600, marginTop: 2 },
    kv: { display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 },
    kLabel: { fontSize: 9, fontWeight: 800, color: '#9CA3AF', letterSpacing: '0.02em' },
    kValue: { fontSize: '11.5px', fontWeight: 700, marginTop: 2, color: '#111827' },
    kRow: { borderTop: '1px solid #F1F3F5', paddingTop: 8 },
    btnRow: { display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' },
    panel: { background: '#fff', border: '1px solid #E8EDF2', borderRadius: 8, padding: 16 },
    panelTitle: { fontSize: '12.5px', fontWeight: 800, marginBottom: 2 },
    panelSub: { fontSize: '10.5px', color: '#9CA3AF', fontWeight: 600, marginBottom: 12 },
    statGrid: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 },
    statCard: { background: '#fff', border: '1px solid #E8EDF2', borderRadius: 8, padding: 14 },
    statLabel: { fontSize: 9, fontWeight: 800, color: '#9CA3AF' },
    statEmpty: { fontSize: 11, fontWeight: 600, color: '#9CA3AF', marginTop: 6 },
    tabBar: { display: 'flex', gap: 16, background: '#fff', border: '1px solid #E8EDF2', borderRadius: 8, padding: '0 16px', overflowX: 'auto' },
    tab: { padding: '12px 4px', fontSize: '11.5px', fontWeight: 800, whiteSpace: 'nowrap', cursor: 'pointer', borderBottom: '2px solid transparent', color: '#6B7280' },
    tabActive: { color: ACCENT, borderBottom: `2px solid ${ACCENT}` },
    emptyBox: { textAlign: 'center', color: '#9CA3AF', fontSize: 12, fontWeight: 600, fontStyle: 'italic', padding: '24px 0' },
    sectionTitle: { fontSize: 12, fontWeight: 800, marginBottom: 10 },
    commRow: { fontSize: '11.5px', fontWeight: 700, padding: '6px 0', borderTop: '1px solid #F1F3F5', display: 'flex', justifyContent: 'space-between' },
    disBtn: { width: '100%', background: '#F9FAFB', border: '1px solid #E8EDF2', borderRadius: 7, padding: 9, fontSize: 11, fontWeight: 800, color: '#9CA3AF', cursor: 'not-allowed', marginTop: 10 },
    pill: { padding: '6px 12px', borderRadius: 7, fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap' },
    toggle: { width: 38, height: 22, borderRadius: 11, background: '#D1D5DB', position: 'relative', flexShrink: 0, opacity: 0.4, cursor: 'not-allowed' },
    toggleKnob: { width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: 3 },
  }), []);

  if (loading) {
    return (
      <div style={{ padding: '60px 0', textAlign: 'center', color: '#6B7280', fontSize: 12 }}>
        <Loader2 size={24} className="animate-spin" style={{ opacity: 0.5, marginBottom: 10 }} />
        <div>Loading account detail…</div>
      </div>
    );
  }

  if (error || !account) {
    return (
      <div style={{ padding: '48px 0', textAlign: 'center' }}>
        <p style={{ color: '#DC2626', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <AlertTriangle size={16} /> {error || 'Account not found.'}
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 14 }}>
          <button onClick={() => void load()} style={S.hBtn}>Retry</button>
          <button onClick={() => navigate('/admin/consumers')} style={S.hBtn}>← All Consumers</button>
        </div>
      </div>
    );
  }

  const marketplaceActive = account.marketplaceAccess !== false;

  const kv = (label: string, value: React.ReactNode, mono = false, first = false) => (
    <div style={first ? undefined : S.kRow}>
      <div style={S.kLabel}>{label}</div>
      <div style={{ ...S.kValue, ...(mono ? { fontFamily: 'monospace' } : {}) }}>{value}</div>
    </div>
  );

  return (
    <div style={{ color: '#111827' }}>
      {/* Header */}
      <div style={S.headRow}>
        <div>
          <div style={S.h1}>Consumer Profile</div>
          <div style={S.sub}>Client account registry standard logs</div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {showLoginAsUser && (
            <button onClick={requestLoginAs} style={{ ...S.hBtn, borderColor: ACCENT, color: ACCENT, background: ACCENT_WASH }}>
              <LogIn size={13} /> Login As User
            </button>
          )}
          <button onClick={() => navigate('/admin/consumers')} style={S.hBtn}>
            <ArrowLeft size={13} /> All Consumers
          </button>
        </div>
      </div>

      <div style={S.grid} className="cpv-grid">
        {/* ── Left column ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={S.card}>
            <div style={S.cover}><span style={S.coverLabel}>CONSUMER</span></div>
            <div style={{ padding: 16, position: 'relative' }}>
              <div style={S.avatar}>{initialsFor(name)}</div>
              <div style={S.pName}>{name}</div>
              <div style={S.pEmail}>{email}</div>

              <div style={S.kv}>
                {kv('ROLE', 'Consumer', false, true)}
                {kv('CHOOSIFY USER ID', cfId, true)}
                {kv('EMAIL ACCOUNT', email)}
                {kv('JOINED', joined)}
                {kv('PROFILE STATUS', account.profileStatus || '—')}
                {kv('IDENTITY VERIFIED', typeof account.identityVerified === 'boolean' ? (account.identityVerified ? 'Yes' : 'No') : '—')}
                {kv('GEOGRAPHY BASE', '—')}
                {kv('PRIMARY PHONE', '—')}
                {kv('CONNECTION STANDING', '—')}
              </div>

              <div style={S.btnRow}>
                <button
                  disabled
                  title="No phone number on file"
                  style={{ flex: 1, background: '#F3F4F6', color: '#9CA3AF', border: '1px solid #E8EDF2', borderRadius: 7, padding: '8px 0', fontSize: 11, fontWeight: 800, cursor: 'not-allowed', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
                >
                  <Phone size={12} /> Call
                </button>
                <button
                  onClick={() => triggerMessage({ id: account.uid, name: account.displayName || account.email, avatarUrl: '', role: account.role })}
                  style={{ flex: 1, background: '#fff', border: '1px solid #E8EDF2', borderRadius: 7, padding: '8px 0', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
                >
                  <Mail size={12} /> Message
                </button>
              </div>
            </div>
          </div>
          {/* RECENT EVENT TRAIL — reference renders it only when an event exists; none is available. */}
        </div>

        {/* ── Right column ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
          <input
            disabled
            placeholder="Search records — not available in this release"
            style={{ width: '100%', boxSizing: 'border-box', height: 40, borderRadius: 8, border: '1px solid #E8EDF2', padding: '0 14px', fontSize: '12.5px', background: '#F9FAFB', color: '#9CA3AF', cursor: 'not-allowed' }}
          />

          <div style={S.statGrid}>
            <div style={S.statCard}>
              <div style={S.statLabel}>TOTAL REVENUE LTV</div>
              <div style={S.statEmpty}>No purchase analytics available</div>
            </div>
            <div style={S.statCard}>
              <div style={S.statLabel}>SECURE WALLET STANDING</div>
              <div style={S.statEmpty}>No wallet data available</div>
            </div>
            <div style={S.statCard}>
              <div style={S.statLabel}>SUPPORT &amp; TICKETS LOG</div>
              <div style={S.statEmpty}>No support ticket data available</div>
            </div>
          </div>

          <div style={S.tabBar}>
            {TABS.map((t) => (
              <div
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                style={{ ...S.tab, ...(activeTab === t.key ? S.tabActive : {}) }}
              >
                {t.icon} {t.label}
              </div>
            ))}
          </div>

          {/* ACCOUNT INFORMATION */}
          {activeTab === 'account' && (
            <>
              <div style={S.panel}>
                <div style={S.panelTitle}>ASSOCIATED DELIVERY ADDRESSES</div>
                <div style={S.panelSub}>Physical shipping address endpoints registered for cargo dispatch pipelines.</div>
                <div style={S.emptyBox}>No delivery addresses on file.</div>
              </div>

              <div style={S.panel}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 2 }}>MARKETPLACE ACCESS</div>
                    <div style={{ fontSize: '10.5px', color: '#9CA3AF', fontWeight: 600 }}>
                      Suspend or reinstate this consumer&apos;s account access, with an optional auto-reinstate timer.
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: marketplaceActive ? '#16A34A' : '#9CA3AF' }}>
                      {marketplaceActive ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                    <div style={S.toggle} aria-disabled title="Consumer account suspension is not available in this release">
                      <div style={{ ...S.toggleKnob, ...(marketplaceActive ? { left: 'auto', right: 3 } : {}) }} />
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: '11.5px', color: marketplaceActive ? '#16A34A' : '#6B7280', fontWeight: 700 }}>
                  {marketplaceActive ? '✓ Account active — full marketplace access.' : 'Account access is limited.'}
                </div>
                <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600, marginTop: 6 }}>
                  Consumer account suspension is not available in this release.
                </div>
              </div>

              <div style={S.statGrid}>
                <div style={S.panel}>
                  <div style={S.sectionTitle}>COMMUNICATION &amp; SECURITY</div>
                  <div style={S.commRow}><span>Email Notifications</span><span style={{ color: '#9CA3AF' }}>—</span></div>
                  <div style={S.commRow}><span>SMS Alerts &amp; Broadcasts</span><span style={{ color: '#9CA3AF' }}>—</span></div>
                  <div style={S.commRow}><span>Two-Factor Auth (2FA)</span><span style={{ color: '#9CA3AF' }}>—</span></div>
                  <button disabled title="Not available in this release" style={S.disBtn}>Trigger Password Reset</button>
                </div>
                <div style={S.panel}>
                  <div style={S.sectionTitle}>CONNECTED ACCOUNTS</div>
                  <div style={S.emptyBox}>No connected accounts.</div>
                </div>
                <div style={S.panel}>
                  <div style={S.sectionTitle}>ACTIVE SESSIONS SECURITY TRAIL</div>
                  <div style={S.emptyBox}>No session data available.</div>
                </div>
              </div>
            </>
          )}

          {/* ORDER HISTORY */}
          {activeTab === 'orders' && (
            <>
              <div style={{ display: 'flex', gap: 8, background: '#fff', border: '1px solid #E8EDF2', borderRadius: 8, padding: 10, overflowX: 'auto' }}>
                {ORDER_PILLS.map((label, i) => (
                  <div key={label} style={{ ...S.pill, background: i === 0 ? ACCENT : 'transparent', color: i === 0 ? '#fff' : '#374151' }}>{label}</div>
                ))}
              </div>
              <div style={{ ...S.card }}>
                <div style={{ padding: '14px 16px', fontSize: 12, fontWeight: 800, borderBottom: '1px solid #F1F3F5' }}>ALL ASSOCIATED ORDERS FEED LOG</div>
                <div style={S.emptyBox}>No orders placed yet.</div>
              </div>
            </>
          )}

          {/* REVIEWS & SCORE */}
          {activeTab === 'reviews' && (
            <div style={S.panel}>
              <div style={S.panelTitle}>SUBMITTED PRODUCT &amp; BRAND REVIEWS</div>
              <div style={S.panelSub}>Verified user rating allocations disbursed across the platform.</div>
              <div style={S.emptyBox}>No reviews submitted yet.</div>
            </div>
          )}

          {/* FOLLOWED BRANDS */}
          {activeTab === 'brands' && (
            <div style={S.panel}>
              <div style={S.panelTitle}>FOLLOWED BRANDS</div>
              <div style={S.panelSub}>Monitored merchant suppliers and channels followed by the consumer.</div>
              <div style={S.emptyBox}>Not following any brands yet.</div>
            </div>
          )}

          {/* SAVED ITEMS */}
          {activeTab === 'saved' && (
            <div style={S.panel}>
              <div style={S.panelTitle}>SAVED &amp; BOOKMARKED CATALOGS</div>
              <div style={S.panelSub}>Consumer bookmarked items, promotions, and active discount campaigns.</div>
              <div style={S.emptyBox}>No saved items yet.</div>
            </div>
          )}

          {/* FOLLOWED CREATORS */}
          {activeTab === 'creators' && (
            <div style={S.panel}>
              <div style={S.panelTitle}>FOLLOWED CREATORS</div>
              <div style={S.panelSub}>Content advocates and creators followed by the consumer.</div>
              <div style={S.emptyBox}>Not following any creators yet.</div>
            </div>
          )}

          {/* SEARCH HISTORY */}
          {activeTab === 'search' && (
            <div style={{ background: '#fff', border: '1px solid #E8EDF2', borderRadius: 8, padding: 24, textAlign: 'center', color: '#9CA3AF', fontSize: 12, fontWeight: 600, fontStyle: 'italic' }}>
              No search history recorded yet.
            </div>
          )}
        </div>
      </div>

      <style>{`@media (max-width: 860px){ .cpv-grid{ grid-template-columns: minmax(0,1fr) !important; } }`}</style>
    </div>
  );
}
