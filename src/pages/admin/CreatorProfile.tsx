import React, { useCallback, useEffect, useMemo, useState, CSSProperties } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useRbac } from '../../contexts/RbacContext';
import { useImpersonation } from '../../contexts/ImpersonationContext';
import { Loader2, AlertTriangle, ArrowLeft, LogIn } from 'lucide-react';
import { AdminMessageUserButton } from '../../components/messaging/AdminMessageUserButton';
import { ProfileMessagePopup } from '../../components/messaging/ProfileMessagePopup';
import { catalogApi } from '../../services/catalogApi';
import { authApi, type UserDirectoryEntry } from '../../services/authApi';
import { operationsApi, type OpsVerification } from '../../services/operationsApi';
import { cashbookApi, type FinanceSummary } from '../../services/cashbookApi';
import type { CatalogCreator } from '../../types/catalog';
import { Avatar } from '../../components/shared/Avatar';

// ============================================================================
// Creator Profile — the real /admin/creator-review?creatorId= destination.
//
// Same approach as ConsumerProfileView.tsx / SellerProfile.tsx: PRESENTATION
// keeps the full original tab/section layout from the legacy CmsMirrorHost
// "Creator Profile" (Account Information / Verification Center / Creator
// Studio / Recommended Product Listings / Recommendations & Guides / My
// Earnings / Payment Info / Reviews & Score / Ads & Deals). FUNCTIONALITY
// only fills a section with real data when a real backend source exists;
// everything else keeps its shape but renders an honest "not available"
// state. Login As User / Message reuse the same ImpersonationContext /
// messaging components as every other real profile page in this app.
//
// NOTE: this route is "/admin/creator-review", not "/admin/creator-profile"
// -- that exact path is already the canonical self-service route a CREATOR
// uses to view their OWN profile (see App.tsx comments). Reusing it here
// would have shadowed that route behind the admin-only role gate.
// ============================================================================

const ACCENT = 'var(--cms-accent)';
const ACCENT_WASH = 'color-mix(in srgb, var(--cms-accent) 10%, transparent)';

const TABS: Array<{ key: string; label: string; icon: string }> = [
  { key: 'account', label: 'Account Information', icon: '⚙' },
  { key: 'verification', label: 'Verification Center', icon: '▤' },
  { key: 'studio', label: 'Creator Studio', icon: '♦' },
  { key: 'products', label: 'Recommended Product Listings', icon: '▦' },
  { key: 'guides', label: 'Recommendations & Guides', icon: '📖' },
  { key: 'earnings', label: 'My Earnings', icon: '৳' },
  { key: 'payment', label: 'Payment Info', icon: '💳' },
  { key: 'reviews', label: 'Reviews & Score', icon: '●' },
  { key: 'ads', label: 'Ads & Deals', icon: '⛿' },
];

export default function CreatorProfile() {
  const [searchParams] = useSearchParams();
  const creatorId = searchParams.get('creatorId') || '';
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { can } = useRbac();
  const { state: impersonation, openLoginAsConfirm } = useImpersonation();
  const [showMessagePopup, setShowMessagePopup] = useState(false);
  const [activeTab, setActiveTab] = useState('account');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [creator, setCreator] = useState<CatalogCreator | null>(null);
  const [user, setUser] = useState<UserDirectoryEntry | null>(null);
  const [verifications, setVerifications] = useState<OpsVerification[]>([]);
  const [finance, setFinance] = useState<FinanceSummary | null>(null);
  const [financeError, setFinanceError] = useState(false);

  const load = useCallback(async () => {
    if (!creatorId) {
      setError('No creatorId in the URL.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [allCreators, directory, allCreatorVerifications] = await Promise.all([
        catalogApi.listCreators(),
        authApi.getUsersDirectory(),
        operationsApi.listVerifications({ entityType: 'creator' }),
      ]);
      const matched = allCreators.find((c) => c.id === creatorId) || null;
      setCreator(matched);
      const matchedUser = matched?.userId ? directory.find((u) => u.uid === matched.userId) || null : null;
      setUser(matchedUser);
      setVerifications(allCreatorVerifications.filter((v) => v.entityId === creatorId));

      if (matchedUser?.uid) {
        try {
          setFinance(await cashbookApi.getFinanceSummary(matchedUser.uid));
          setFinanceError(false);
        } catch {
          setFinanceError(true);
        }
      } else {
        setFinanceError(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load creator profile.');
    } finally {
      setLoading(false);
    }
  }, [creatorId]);

  useEffect(() => {
    void load();
  }, [load]);

  const displayName = creator?.name || 'Unknown Creator';
  const followerPlatformCount = useMemo(() => Object.values(creator?.followers || {}).length, [creator]);
  const targetUserId = user?.uid || '';
  const isSelf = Boolean(profile?.id && targetUserId && profile.id === targetUserId);
  const showLoginAsUser = can('impersonate') && !impersonation.active && !isSelf && Boolean(targetUserId);

  const requestLoginAs = useCallback(() => {
    if (!targetUserId) return;
    openLoginAsConfirm({
      targetUserId,
      displayName,
      roleLabel: 'Creator',
      choosifyUserId: user?.choosifyUserId || undefined,
      email: user?.email,
      avatarUrl: user?.avatarUrl || undefined,
    });
  }, [targetUserId, displayName, user, openLoginAsConfirm]);

  const S: Record<string, CSSProperties> = useMemo(() => ({
    headRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 12 },
    h1: { fontSize: 15, fontWeight: 800, color: '#111827' },
    sub: { fontSize: '11.5px', color: '#9CA3AF', fontWeight: 600, marginTop: 2 },
    hBtn: { background: '#fff', border: '1px solid #E8EDF2', borderRadius: 8, padding: '9px 14px', fontSize: '11.5px', fontWeight: 800, color: '#374151', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 },
    grid: { display: 'grid', gridTemplateColumns: 'minmax(0,260px) minmax(0,1fr)', gap: 16, alignItems: 'start' },
    card: { background: '#fff', border: '1px solid #E8EDF2', borderRadius: 10, overflow: 'hidden' },
    cover: { height: 80, background: `linear-gradient(120deg,#C4B5FD 0%,#FDE68A 50%, ${ACCENT} 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    coverLabel: { fontSize: 14, fontWeight: 800, letterSpacing: '0.15em', color: '#fff' },
    avatar: { width: 56, height: 56, borderRadius: '50%', background: '#fff', border: '1px solid #E8EDF2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16, marginTop: -42, marginBottom: 10, boxShadow: '0 2px 6px rgba(0,0,0,0.08)' },
    pName: { fontSize: '13.5px', fontWeight: 800 },
    pEmail: { fontSize: 11, color: '#2563EB', fontWeight: 600, marginTop: 2 },
    kv: { display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 },
    kLabel: { fontSize: 9, fontWeight: 800, color: '#9CA3AF', letterSpacing: '0.02em' },
    kValue: { fontSize: '11.5px', fontWeight: 700, marginTop: 2, color: '#111827' },
    kRow: { borderTop: '1px solid #F1F3F5', paddingTop: 8 },
    panel: { background: '#fff', border: '1px solid #E8EDF2', borderRadius: 8, padding: 16 },
    panelTitle: { fontSize: '12.5px', fontWeight: 800, marginBottom: 2 },
    panelSub: { fontSize: '10.5px', color: '#9CA3AF', fontWeight: 600, marginBottom: 12 },
    statGrid: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 },
    statCard: { background: '#fff', border: '1px solid #E8EDF2', borderRadius: 8, padding: 14 },
    statLabel: { fontSize: 9, fontWeight: 800, color: '#9CA3AF' },
    statValue: { fontSize: 18, fontWeight: 800, color: '#111827', marginTop: 6 },
    tabBar: { display: 'flex', gap: 16, background: '#fff', border: '1px solid #E8EDF2', borderRadius: 8, padding: '0 16px', overflowX: 'auto' },
    tab: { padding: '12px 4px', fontSize: '11.5px', fontWeight: 800, whiteSpace: 'nowrap', cursor: 'pointer', borderBottom: '2px solid transparent', color: '#6B7280' },
    tabActive: { color: ACCENT, borderBottom: `2px solid ${ACCENT}` },
    emptyBox: { textAlign: 'center', color: '#9CA3AF', fontSize: 12, fontWeight: 600, fontStyle: 'italic', padding: '24px 0' },
    row: { fontSize: '11.5px', fontWeight: 700, padding: '10px 0', borderTop: '1px solid #F1F3F5', display: 'flex', justifyContent: 'space-between', gap: 10 },
    badge: { padding: '2px 8px', borderRadius: 6, fontSize: 9, fontWeight: 800, textTransform: 'uppercase' },
  }), []);

  if (loading) {
    return (
      <div style={{ padding: '60px 0', textAlign: 'center', color: '#6B7280', fontSize: 12 }}>
        <Loader2 size={24} className="animate-spin" style={{ opacity: 0.5, marginBottom: 10 }} />
        <div>Loading creator profile…</div>
      </div>
    );
  }

  if (error || !creator) {
    return (
      <div style={{ padding: '48px 0', textAlign: 'center' }}>
        <p style={{ color: '#DC2626', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <AlertTriangle size={16} /> {error || 'Creator not found.'}
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 14 }}>
          <button onClick={() => void load()} style={S.hBtn}>Retry</button>
          <button onClick={() => navigate('/admin/creator-management')} style={S.hBtn}>← Creators Management</button>
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
          <div style={S.h1}>Creator Profile</div>
          <div style={S.sub}>Real creator account, verification, and publication status</div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {targetUserId ? <AdminMessageUserButton targetUserId={targetUserId} /> : null}
          {showLoginAsUser && (
            <button onClick={requestLoginAs} style={{ ...S.hBtn, borderColor: ACCENT, color: ACCENT, background: ACCENT_WASH }}>
              <LogIn size={13} /> Login As User
            </button>
          )}
          <button onClick={() => navigate('/admin/creator-management')} style={S.hBtn}>
            <ArrowLeft size={13} /> All Creators
          </button>
        </div>
      </div>

      <div style={S.grid} className="cprv-grid">
        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={S.card}>
            <div style={S.cover}><span style={S.coverLabel}>CREATOR</span></div>
            <div style={{ padding: 16, position: 'relative' }}>
              <Avatar src={creator.avatar || null} name={displayName} size={56} style={S.avatar} />
              <div style={S.pName}>{displayName}</div>
              <div style={S.pEmail}>@{creator.handle}</div>

              <div style={S.kv}>
                {kv('ROLE', creator.role || 'Content Creator', false, true)}
                {kv('CHOOSIFY USER ID', user?.choosifyUserId || '—', true)}
                {kv('STATUS', creator.status)}
                {kv('PRIMARY PLATFORM', creator.platforms?.[0] || '—')}
                {kv('LOCATION', creator.location || '—')}
                {kv('LINKED PLATFORMS', String(followerPlatformCount))}
              </div>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
          <div style={S.statGrid}>
            <div style={S.statCard}>
              <div style={S.statLabel}>PUBLICATION STATUS</div>
              <div style={S.statValue}>{creator.status}</div>
            </div>
            <div style={S.statCard}>
              <div style={S.statLabel}>SCORE</div>
              <div style={S.statValue}>{creator.score ?? 0}</div>
            </div>
            <div style={S.statCard}>
              <div style={S.statLabel}>VERIFICATION RECORDS</div>
              <div style={S.statValue}>{verifications.length}</div>
            </div>
          </div>

          <div style={S.tabBar}>
            {TABS.map((t) => (
              <div key={t.key} onClick={() => setActiveTab(t.key)} style={{ ...S.tab, ...(activeTab === t.key ? S.tabActive : {}) }}>
                {t.icon} {t.label}
              </div>
            ))}
          </div>

          {activeTab === 'account' && (
            <div style={S.panel}>
              <div style={S.panelTitle}>ACCOUNT INFORMATION</div>
              <div style={S.panelSub}>Real fields from the creator catalog record.</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
                {kv('CATEGORY', creator.category || '—', false, true)}
                {kv('EMAIL', creator.email || '—')}
                {kv('PHONE', creator.phone || '—')}
                {kv('BEST FOR', creator.bestFor || '—')}
                {kv('JOINED', creator.createdAt?.slice(0, 10) || '—')}
              </div>
              {creator.bio && (
                <div style={{ marginTop: 14, fontSize: '11.5px', color: '#374151', fontWeight: 600, lineHeight: 1.6 }}>{creator.bio}</div>
              )}
            </div>
          )}

          {activeTab === 'verification' && (
            <div style={S.card}>
              <div style={{ padding: '14px 16px', fontSize: 12, fontWeight: 800, borderBottom: '1px solid #F1F3F5' }}>REAL VERIFICATION RECORDS</div>
              {verifications.length === 0 ? (
                <div style={S.emptyBox}>No verification records for this creator.</div>
              ) : (
                verifications.map((v) => (
                  <div key={v.id} style={{ ...S.row, padding: '12px 16px' }}>
                    <div>
                      <div>{displayName}</div>
                      <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600 }}>Submitted {v.created_at ? v.created_at.slice(0, 10) : '—'}</div>
                    </div>
                    <span style={{ ...S.badge, background: '#FEF3C7', color: '#B45309' }}>{v.status}</span>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'studio' && (
            <div style={S.panel}>
              <div style={S.panelTitle}>CREATOR STUDIO</div>
              <div style={S.panelSub}>Cover image, bio, featured content and social links.</div>
              <div style={S.emptyBox}>
                Not available in this admin view yet. The creator's own Creator Studio already edits this data live —
                no separate admin editor has been built here.
              </div>
            </div>
          )}

          {activeTab === 'products' && (
            <div style={S.panel}>
              <div style={S.panelTitle}>RECOMMENDED PRODUCT LISTINGS</div>
              <div style={S.panelSub}>Products this creator has reviewed or recommended.</div>
              <div style={S.emptyBox}>
                Not available — no real backend links a creator to specific catalog products (creators review/recommend,
                they don't own listings). Showing one here would mean fabricating data.
              </div>
            </div>
          )}

          {activeTab === 'guides' && (
            <div style={S.panel}>
              <div style={S.panelTitle}>RECOMMENDATIONS &amp; GUIDES</div>
              <div style={S.panelSub}>Guides, videos and reels published by this creator.</div>
              <div style={S.emptyBox}>Not available here yet — see Guide Management for this creator's real published content.</div>
            </div>
          )}

          {activeTab === 'earnings' && (
            <div style={S.panel}>
              <div style={S.panelTitle}>MY EARNINGS</div>
              <div style={S.panelSub}>Real escrow-derived balance — GET /finance/summary.</div>
              {financeError || !finance ? (
                <div style={S.emptyBox}>No finance summary available for this creator yet.</div>
              ) : (
                <div style={S.statGrid}>
                  <div style={S.statCard}><div style={S.statLabel}>LIFETIME EARNINGS</div><div style={S.statValue}>৳{finance.lifetimeEarnings.toLocaleString()}</div></div>
                  <div style={S.statCard}><div style={S.statLabel}>AVAILABLE BALANCE</div><div style={S.statValue}>৳{finance.availableBalance.toLocaleString()}</div></div>
                  <div style={S.statCard}><div style={S.statLabel}>PENDING APPROVAL</div><div style={S.statValue}>৳{finance.pendingApproval.toLocaleString()}</div></div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'payment' && (
            <div style={S.panel}>
              <div style={S.panelTitle}>PAYMENT INFO</div>
              <div style={S.panelSub}>Payout bank/mobile-wallet account details.</div>
              <div style={S.emptyBox}>Not available — no payout account persistence exists in the backend yet.</div>
            </div>
          )}

          {activeTab === 'reviews' && (
            <div style={S.panel}>
              <div style={S.panelTitle}>REVIEWS &amp; SCORE</div>
              <div style={S.panelSub}>Community reviews and trust scoring for this creator.</div>
              <div style={S.emptyBox}>Not available here yet — see Trust &amp; Analytics / Moderation Center for real review data.</div>
            </div>
          )}

          {activeTab === 'ads' && (
            <div style={S.panel}>
              <div style={S.panelTitle}>ADS &amp; DEALS</div>
              <div style={S.panelSub}>Active sponsored placements for this creator.</div>
              <div style={S.emptyBox}>Not available here yet — see Ads &amp; Deals Studio for this creator's real campaigns.</div>
            </div>
          )}
        </div>
      </div>

      <style>{`@media (max-width: 860px){ .cprv-grid{ grid-template-columns: minmax(0,1fr) !important; } }`}</style>

      {showMessagePopup && targetUserId ? (
        <ProfileMessagePopup targetUserId={targetUserId} targetName={displayName} onClose={() => setShowMessagePopup(false)} />
      ) : null}
    </div>
  );
}
