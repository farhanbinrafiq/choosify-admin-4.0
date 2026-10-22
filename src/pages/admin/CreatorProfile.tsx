import React, { useCallback, useEffect, useMemo, useState, CSSProperties } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { profileReturnTarget } from '../../lib/profileReturn';
import { useAuth } from '../../contexts/AuthContext';
import { useRbac } from '../../contexts/RbacContext';
import { useImpersonation } from '../../contexts/ImpersonationContext';
import { Loader2, AlertTriangle, ArrowLeft, LogIn, Phone, Mail } from 'lucide-react';
import { catalogApi, type GuideManageRow } from '../../services/catalogApi';
import { authApi, type UserDetail } from '../../services/authApi';
import { operationsApi, type OpsReview } from '../../services/operationsApi';
import type { CatalogCreator, CatalogGuide } from '../../types/catalog';
import { Avatar } from '../../components/shared/Avatar';
import { AccountEntitlementsPanel } from '../../components/admin/EntitlementAccessPanels';
import { EntityHandlePanel, canViewPublicHandles, publicProfileUrl } from '../../components/admin/PublicHandlePanels';
import { CreatorProfilePresentation } from '../../components/creator-profile';
import { mapCatalogCreatorToEditor } from './creatorEditorModel';
import { personaCoverGradient } from '../../components/admin/profile/personaTheme';
import { AccountDetailsSection } from '../../components/admin/profile/AccountDetailsEditor';
import { AdminEditHistory, AdminEditModeStrip, AdminEditUserButton, useAdminEditUser } from '../../components/admin/profile/AdminEditUser';
import { AdsDealsPanel, ReviewsPanel, UnavailablePanel } from '../../components/admin/profile/ProfileSections';
import { MarketplaceStatusBadge, PhotoVerificationBadge } from '../../components/admin/profile/PhotoVerificationBadge';
import { PayoutInfoPanel } from '../../components/admin/profile/PayoutInfoPanel';
import { AccountActivityPanel } from '../../components/admin/profile/AccountActivityPanel';
import { VerificationCenterPanel } from '../../components/admin/profile/VerificationCenterPanel';
import { ClaimReviewSection } from '../../components/admin/claims/ClaimReviewSection';
import { ApplicationReviewSection } from '../../components/admin/claims/ApplicationReviewSection';
import { MarketplaceAccessSection } from '../../components/admin/profile/MarketplaceAccessSection';
import { ProfileMessagePopup } from '../../components/messaging/ProfileMessagePopup';
import { ProfileContactActions } from '../../components/admin/profile/ProfileContactActions';

// ============================================================================
// Creator Profile — the Super Admin 360° view at /admin/creator-review?creatorId=.
//
// VIEW ONLY by default; every tab reads a canonical source:
//   Account Information      → creator catalog record + auth user detail + Marketplace Access (recorded reasons)
//   Verification Center      → /operations/verifications for this creator
//   Creator Studio           → the creator record rendered by Creator Studio's own CreatorProfilePresentation
//   Recommendations & Guides → the creator's guides (Guide Management) + featured content + video/reel counts
//   My Earnings / Payment    → no server-side creator earnings / payout data exists (reported honestly)
//   Reviews & Score          → review store: trust score + reviews this account posted (no review targets creators)
//   Ads & Deals              → Ads & Deals records owned by the creator's account
// ============================================================================

const ACCENT = 'var(--cms-accent)';
const ACCENT_WASH = 'color-mix(in srgb, var(--cms-accent) 10%, transparent)';

const TABS: Array<{ key: string; label: string; icon: string }> = [
  { key: 'account', label: 'Account Information', icon: '⚙' },
  { key: 'verification', label: 'Verification Center', icon: '▤' },
  { key: 'studio', label: 'Creator Studio', icon: '♦' },
  { key: 'guides', label: 'Recommendations & Guides', icon: '📖' },
  { key: 'earnings', label: 'My Earnings', icon: '৳' },
  { key: 'payment', label: 'Payment Info', icon: '💳' },
  { key: 'reviews', label: 'Reviews & Score', icon: '●' },
  { key: 'ads', label: 'Ads & Deals', icon: '⛿' },
  { key: 'features', label: 'Feature Access', icon: '⚑' },
  { key: 'activity', label: 'Activity Log', icon: '⏱' },
];

const GUIDE_TONE: Record<string, CSSProperties> = {
  live: { background: '#DCFCE7', color: '#166534' },
  draft: { background: '#FEF3C7', color: '#92400E' },
  archived: { background: '#F1F5F9', color: '#475569' },
};

export default function CreatorProfile() {
  const [searchParams] = useSearchParams();
  const creatorId = searchParams.get('creatorId') || '';
  /** Back to the exact management tab/list this profile was opened from. */
  const backTo = profileReturnTarget(useLocation().state, 'creator');
  /** Opened from the Ownership Claims queue: review this account's claim on top of its full profile. */
  const claimId = searchParams.get('claimId') || '';
  /** Opened from the Requests tab: review this account's Seller/Creator application on top of its full profile. */
  const applicationId = searchParams.get('applicationId') || '';
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { can } = useRbac();
  const { state: impersonation, openLoginAsConfirm } = useImpersonation();
  const [showMessagePopup, setShowMessagePopup] = useState(false);
  const rawTab = searchParams.get('tab');
  const initialTab = rawTab === 'products' ? 'guides' : rawTab === 'handle' ? 'account' : rawTab;
  const [activeTab, setActiveTab] = useState(() => (initialTab && TABS.some((t) => t.key === initialTab) ? initialTab : 'account'));
  const showHandles = canViewPublicHandles(profile?.role);
  const visibleTabs = TABS;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creator, setCreator] = useState<CatalogCreator | null>(null);
  const [user, setUser] = useState<UserDetail | null>(null);
  const [guides, setGuides] = useState<GuideManageRow[]>([]);
  const [liveGuides, setLiveGuides] = useState<CatalogGuide[]>([]);
  const [posted, setPosted] = useState<OpsReview[]>([]);
  const [reviewsError, setReviewsError] = useState<string | null>(null);

  // quiet: refresh in place (no full-page skeleton), e.g. after an inline field save.
  const load = useCallback(async (quiet = false) => {
    if (!creatorId) {
      setError('No creatorId in the URL.');
      setLoading(false);
      return;
    }
    if (!quiet) setLoading(true);
    setError(null);
    try {
      const allCreators = await catalogApi.listCreators();
      // Deep links carry either the creator profile id or the owner's user id.
      const matched = allCreators.find((c) => c.id === creatorId) || allCreators.find((c) => c.userId === creatorId) || null;
      setCreator(matched);
      // No creator record: the id may be a creator-role account that has not
      // set up Creator Studio yet — still load the account so staff can act on it.
      const uid = matched?.userId || (matched ? '' : creatorId);
      const [detail, manage, publicGuides] = await Promise.all([
        uid ? authApi.getUserDetail(uid).catch(() => null) : Promise.resolve(null),
        catalogApi.manageGuides({ status: 'all' }).then((r) => r.data || []).catch(() => [] as GuideManageRow[]),
        catalogApi.listGuides().catch(() => [] as CatalogGuide[]),
      ]);
      setUser(detail);
      const cid = matched?.id || creatorId;
      setGuides(manage.filter((g) => g.creatorId === cid && g.publisherType !== 'brand'));
      setLiveGuides(publicGuides.filter((g) => g.creatorId === cid));
      if (uid) {
        try {
          setPosted(await operationsApi.listReviews({ userId: uid }));
          setReviewsError(null);
        } catch (e) {
          setReviewsError(e instanceof Error ? e.message : 'Could not load reviews.');
        }
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

  const displayName = creator?.name || user?.displayName || 'Unknown Creator';
  const targetUserId = creator?.userId || user?.uid || '';
  const email = user?.email || creator?.email || '';
  const phone = user?.phone || creator?.phone || '';
  const isSelf = Boolean(profile?.id && targetUserId && profile.id === targetUserId);
  const showLoginAsUser = can('impersonate') && !impersonation.active && !isSelf && Boolean(targetUserId);
  const edit = useAdminEditUser({ targetUserId, targetRole: 'creator', targetLabel: displayName });
  const studioModel = useMemo(() => (creator ? mapCatalogCreatorToEditor(creator) : null), [creator]);
  const viewsById = useMemo(() => new Map(liveGuides.map((g) => [g.id, (g as { views?: string | number }).views])), [liveGuides]);
  const liveCount = guides.filter((g) => g.status === 'live').length;
  // Listing responses carry the active public handle (Public Identity) alongside the record.
  const publicHandle = (creator as (CatalogCreator & { publicHandle?: string | null }) | null)?.publicHandle ?? null;

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
    card: { background: '#fff', border: '1px solid #E8EDF2', borderRadius: 16, overflow: 'hidden' },
    cover: { height: 80, background: personaCoverGradient('creator'), display: 'flex', alignItems: 'center', justifyContent: 'center' },
    coverLabel: { fontSize: 14, fontWeight: 800, letterSpacing: '0.15em', color: '#fff' },
    avatar: { width: 56, height: 56, borderRadius: '50%', background: '#fff', border: '1px solid #E8EDF2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16, marginTop: -42, marginBottom: 10, boxShadow: '0 2px 6px rgba(0,0,0,0.08)' },
    pName: { fontSize: '13.5px', fontWeight: 800 },
    kv: { display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 },
    kLabel: { fontSize: 9, fontWeight: 800, color: '#9CA3AF', letterSpacing: '0.02em' },
    kValue: { fontSize: '11.5px', fontWeight: 700, marginTop: 2, color: '#111827', overflowWrap: 'anywhere' },
    kRow: { borderTop: '1px solid #F1F3F5', paddingTop: 8 },
    contact: { display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 },
    contactLink: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, color: '#2563EB', textDecoration: 'none', overflowWrap: 'anywhere' },
    panel: { background: '#fff', border: '1px solid #E8EDF2', borderRadius: 16, padding: 16 },
    panelTitle: { fontSize: '12.5px', fontWeight: 800, marginBottom: 2 },
    panelSub: { fontSize: '10.5px', color: '#9CA3AF', fontWeight: 600, marginBottom: 12 },
    statGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 14 },
    statCard: { background: '#fff', border: '1px solid #E8EDF2', borderRadius: 16, padding: 14 },
    statLabel: { fontSize: 9, fontWeight: 800, color: '#9CA3AF' },
    statValue: { fontSize: 18, fontWeight: 800, color: '#111827', marginTop: 6 },
    tabBar: { display: 'flex', gap: 16, background: '#fff', border: '1px solid #E8EDF2', borderRadius: 14, padding: '0 16px', overflowX: 'auto' },
    tab: { padding: '12px 4px', fontSize: '11.5px', fontWeight: 800, whiteSpace: 'nowrap', cursor: 'pointer', borderBottom: '2px solid transparent', color: '#6B7280', background: 'transparent', borderTop: 0, borderLeft: 0, borderRight: 0 },
    tabActive: { color: ACCENT, borderBottom: `2px solid ${ACCENT}` },
    emptyBox: { textAlign: 'center', color: '#9CA3AF', fontSize: 12, fontWeight: 600, fontStyle: 'italic', padding: '24px 0' },
    th: { textAlign: 'left', fontSize: 9, fontWeight: 800, color: '#9CA3AF', padding: '9px 12px', borderBottom: '1px solid #F1F3F5', whiteSpace: 'nowrap', background: '#FAFBFC' },
    td: { fontSize: '11.5px', fontWeight: 600, padding: '10px 12px', borderBottom: '1px solid #F5F6F8', verticalAlign: 'middle' },
    badge: { padding: '2px 8px', borderRadius: 6, fontSize: 9, fontWeight: 800, textTransform: 'uppercase', whiteSpace: 'nowrap' },
  }), []);

  if (loading) {
    return (
      <div style={{ padding: '60px 0', textAlign: 'center', color: '#6B7280', fontSize: 12 }}>
        <Loader2 size={24} className="animate-spin" style={{ opacity: 0.5, marginBottom: 10 }} />
        <div>Loading creator profile…</div>
      </div>
    );
  }

  if (error || (!creator && !user)) {
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

  if (!creator && user) {
    // Creator-role account without a Creator Studio record: account actions only.
    return (
      <div style={{ color: '#111827' }} data-testid="creator-account-only">
        <div style={S.headRow}>
          <div>
            <div style={S.h1}>Creator Profile</div>
            <div style={S.sub}>Account only — this creator has not set up Creator Studio yet</div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }} data-testid="profile-header-actions">
            {showLoginAsUser && (
              <button onClick={requestLoginAs} style={{ ...S.hBtn, borderColor: ACCENT, color: ACCENT, background: ACCENT_WASH }}>
                <LogIn size={13} /> Login As User
              </button>
            )}
            <AdminEditUserButton state={edit} />
            <button onClick={() => navigate(backTo.href)} style={S.hBtn} data-testid="profile-back">
              <ArrowLeft size={13} /> {backTo.label}
            </button>
          </div>
        </div>
        <AdminEditModeStrip state={edit} />
        {claimId ? <ClaimReviewSection claimId={claimId} onDecided={() => void load()} /> : null}
        {applicationId ? <ApplicationReviewSection applicationId={applicationId} onDecided={() => void load()} /> : null}
        <div style={S.grid} className="cprv-grid">
          <div style={S.card} data-testid="profile-identity">
            <div style={S.cover}><span style={S.coverLabel}>CREATOR</span></div>
            <div style={{ padding: 16, position: 'relative' }}>
              <Avatar src={user.avatarUrl || null} name={displayName} size={56} style={S.avatar} />
              <div style={S.pName}>{displayName}</div>
              <ProfileContactActions targetUserId={targetUserId} targetName={displayName} email={email} phone={phone} phoneTitle={user?.phoneSource === 'partner_application' ? 'From the partner application' : undefined} />
              <div style={S.kv}>
                {kv('ROLE', user.role || 'creator', false, true)}
                {kv('CHOOSIFY USER ID', user.choosifyUserId || '—', true)}
                {kv('JOINED', user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—')}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={S.panel}>
              <div style={S.panelTitle}>NO CREATOR STUDIO PROFILE YET</div>
              <div style={{ fontSize: 12, color: '#4B5563', fontWeight: 600, lineHeight: 1.6 }}>
                This account has the creator role but no Creator Studio record, so there is no public creator profile, guides,
                verification or marketplace access to show. They appear here once the creator sets up Creator Studio (or a partner
                application is approved).
              </div>
            </div>
            <AdminEditHistory state={edit} />
          </div>
        </div>
        <style>{`@media (max-width: 860px){ .cprv-grid{ grid-template-columns: minmax(0,1fr) !important; } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ color: '#111827' }}>
      <div style={S.headRow}>
        <div>
          <div style={S.h1}>Creator Profile</div>
          <div style={S.sub}>Read-only 360° view of this creator across Choosify</div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }} data-testid="profile-header-actions">
          {showLoginAsUser && (
            <button onClick={requestLoginAs} style={{ ...S.hBtn, borderColor: ACCENT, color: ACCENT, background: ACCENT_WASH }}>
              <LogIn size={13} /> Login As User
            </button>
          )}
          <AdminEditUserButton state={edit} />
          <button onClick={() => navigate(backTo.href)} style={S.hBtn} data-testid="profile-back">
            <ArrowLeft size={13} /> {backTo.label}
          </button>
        </div>
      </div>

      <AdminEditModeStrip state={edit} />
      {claimId ? <ClaimReviewSection claimId={claimId} onDecided={() => void load()} /> : null}
      {applicationId ? <ApplicationReviewSection applicationId={applicationId} onDecided={() => void load()} /> : null}

      <div style={S.grid} className="cprv-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={S.card} data-testid="profile-identity">
            <div style={S.cover}><span style={S.coverLabel}>CREATOR</span></div>
            <div style={{ padding: 16, position: 'relative' }}>
              <Avatar src={creator.avatar || user?.avatarUrl || null} name={displayName} size={56} style={S.avatar} />
              <div style={S.pName}>{displayName}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <PhotoVerificationBadge entityType="creator" entityIds={[creator.id]} currentAvatarUrl={user?.avatarUrl} />
                <MarketplaceStatusBadge active={creator.status === 'live'} status={creator.status} />
              </div>
              {publicHandle ? <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 700 }}>@{publicHandle}</div> : null}
              <ProfileContactActions targetUserId={targetUserId} targetName={displayName} email={email} phone={phone} phoneTitle={user?.phoneSource === 'partner_application' ? 'From the partner application' : undefined} />
              <div style={S.kv}>
                {kv('ROLE', creator.role || 'Creator', false, true)}
                {kv('CHOOSIFY USER ID', user?.choosifyUserId || '—', true)}
                {kv('PUBLICATION', creator.status || '—')}
                {kv('VERIFIED', creator.verifiedStatus ? 'Yes' : 'No')}
                {kv('LOCATION', creator.location || '—')}
                {kv('JOINED', creator.createdAt?.slice(0, 10) || '—')}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
          <div style={S.statGrid}>
            <div style={S.statCard}><div style={S.statLabel}>LIFETIME EARNINGS</div><div style={S.statValue}>—</div><div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600 }}>Not recorded — no creator earnings backend yet</div></div>
            <div style={S.statCard}><div style={S.statLabel}>TRUST SCORE</div><div style={S.statValue}>{creator.score ? `${creator.score}/100` : '—'}</div><div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600 }}>{creator.score ? 'Creator record score' : 'Not scored yet'}</div></div>
            <div style={S.statCard}><div style={S.statLabel}>LIVE GUIDES</div><div style={S.statValue}>{liveCount} <span style={{ fontSize: 11, color: '#9CA3AF' }}>/ {guides.length}</span></div><div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600 }}>{guides.reduce((n, g) => n + (g.productCount || 0), 0)} product recommendations</div></div>
            <div style={S.statCard}><div style={S.statLabel}>ENDORSED BRANDS</div><div style={S.statValue}>{(creator.brandPartners || []).length}</div><div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600 }}>{(creator.brandPartners || []).slice(0, 2).map((b) => b.name).join(', ') || 'None listed'}</div></div>
            <div style={S.statCard}><div style={S.statLabel}>REVIEWS POSTED</div><div style={S.statValue}>{posted.length}</div><div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600 }}>Creators can’t be reviewed directly</div></div>
          </div>

          <div style={S.tabBar} role="tablist">
            {visibleTabs.map((t) => (
              <button key={t.key} type="button" role="tab" aria-selected={activeTab === t.key} data-tab={t.key} onClick={() => setActiveTab(t.key)} style={{ ...S.tab, ...(activeTab === t.key ? S.tabActive : {}) }}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {activeTab === 'account' && (
            <>
              {edit.editing && targetUserId ? (
                <AccountDetailsSection
                  userId={targetUserId}
                  canOverrideNameLock={['super_admin', 'admin'].includes(String(profile?.role || ''))}
                  onSaved={() => void load(true)}
                  panelStyle={S.panel}
                  titleStyle={S.panelTitle}
                />
              ) : null}
              <div style={S.panel}>
                <div style={S.panelTitle}>ACCOUNT INFORMATION</div>
                <div style={S.panelSub}>From the creator catalog record and the linked login account.</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                  {kv('CATEGORY', creator.category || '—', false, true)}
                  {kv('BUSINESS EMAIL', creator.email || '—', false, true)}
                  {kv('BUSINESS PHONE', creator.phone || (phone && user?.phoneSource === 'partner_application' ? `${phone} (from application)` : '—'), false, true)}
                  {kv('BEST FOR', creator.bestFor || '—', false, true)}
                  {kv('LOGIN ACCOUNT', user ? user.email : 'Not linked to a login account', false, true)}
                  {kv('PARTNER APPLICATION', user?.partnerApplicationStatus || '—', false, true)}
                  {kv('ACCOUNT MARKETPLACE ACCESS', user ? (user.marketplaceAccess ? 'On' : 'Off') : '—', false, true)}
                  {kv('IDENTITY VERIFIED', user ? (user.identityVerified ? 'Yes' : 'No') : '—', false, true)}
                  {kv('PUBLIC HANDLE', publicHandle ? `@${publicHandle}` : 'None', false, true)}
                  {kv(
                    'PUBLIC PROFILE',
                    <a href={publicProfileUrl('creator', { handle: publicHandle, slug: creator.slug, id: creator.id })} target="_blank" rel="noreferrer" style={{ color: '#2563EB', fontWeight: 700, textDecoration: 'none', overflowWrap: 'anywhere' as const }}>
                      {publicProfileUrl('creator', { handle: publicHandle, slug: creator.slug, id: creator.id })}
                    </a>,
                    false,
                    true,
                  )}
                </div>
                {creator.bio ? <div style={{ marginTop: 14, fontSize: '11.5px', color: '#374151', fontWeight: 600, lineHeight: 1.6 }}>{creator.bio}</div> : null}
              </div>
              <MarketplaceAccessSection entityType="creator" creator={creator} onChanged={(u) => setCreator(u as CatalogCreator)} />
              {/* Handle management (history + staff override) only while editing, or when opened from a handle request. */}
              {showHandles && (edit.editing || searchParams.get('tab') === 'handle') ? (
                <EntityHandlePanel
                  key={creator.id}
                  entity={{ entityType: 'creator', entityId: creator.id, name: creator.name, slug: creator.slug, status: creator.status, ownerUserId: creator.userId ?? null }}
                />
              ) : null}
              <AdminEditHistory state={edit} />
            </>
          )}

          {activeTab === 'verification' && (
            <VerificationCenterPanel
              entityType="creator"
              entities={[{ id: creator.id, name: creator.name }]}
              emptyHint="The creator submits documents from their own Creator Profile → Verification Center."
              onRequestDocuments={targetUserId ? () => setShowMessagePopup(true) : undefined}
            />
          )}

          {activeTab === 'studio' && studioModel && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} data-testid="creator-studio-view">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', background: '#fff', border: '1px solid #E8EDF2', borderRadius: 8, padding: '10px 14px' }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: '#9CA3AF' }}>
                  CREATOR PROFILE (LIVE CREATOR STUDIO DATA) · updated {creator.updatedAt ? new Date(creator.updatedAt).toLocaleString() : '—'}
                </span>
                {edit.editing ? (
                  <Link to={`/admin/creator-studio/${encodeURIComponent(creator.id)}/edit`} style={{ fontSize: 11.5, fontWeight: 800, color: ACCENT, textDecoration: 'none' }} data-testid="creator-studio-edit">
                    Edit in Creator Studio →
                  </Link>
                ) : (
                  <span style={{ fontSize: 10.5, color: '#9CA3AF', fontWeight: 700 }}>View only</span>
                )}
              </div>
              <div style={{ border: '1px solid #E8EDF2', borderRadius: 8, overflow: 'hidden' }}>
                <CreatorProfilePresentation
                  model={studioModel}
                  mode="view"
                  publicHandle={publicHandle}
                  guides={guides.map((g) => ({ id: g.id, slug: g.slug, title: g.title, image: g.image, status: g.status }))}
                />
              </div>
            </div>
          )}

          {activeTab === 'guides' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ ...S.card }} data-testid="creator-guides">
                <div style={{ padding: '14px 16px', borderBottom: '1px solid #F1F3F5' }}>
                  <div style={{ fontSize: 12, fontWeight: 800 }}>RECOMMENDATIONS &amp; GUIDES</div>
                  <div style={{ fontSize: '10.5px', color: '#9CA3AF', fontWeight: 600 }}>
                    Guides this creator authored (Guide Management) — product recommendations live inside these guides.
                  </div>
                </div>
                {guides.length === 0 ? (
                  <div style={S.emptyBox}>This creator has not written any guides yet.</div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
                      <thead>
                        <tr>{['GUIDE', 'FORMAT', 'PRODUCTS', 'BRANDS', 'VIEWS', 'PUBLISHED', 'UPDATED', 'STATUS'].map((h) => <th key={h} style={S.th}>{h}</th>)}</tr>
                      </thead>
                      <tbody>
                        {guides.map((g) => (
                          <tr key={g.id} data-testid="creator-guide-row">
                            <td style={S.td}>
                              {edit.editing ? (
                                <Link to={`/admin/guides/${encodeURIComponent(g.id)}/edit`} style={{ color: ACCENT, fontWeight: 800, textDecoration: 'none' }}>{g.title}</Link>
                              ) : (
                                g.title
                              )}
                              <div style={{ fontSize: 10, color: '#9CA3AF', fontFamily: 'monospace' }}>{g.contentReferenceId || g.id}</div>
                            </td>
                            <td style={S.td}>{(g.format || g.type || '—').replace(/_/g, ' ')}</td>
                            <td style={S.td}>{g.productCount}</td>
                            <td style={S.td}>{g.brandCount}</td>
                            <td style={S.td}>{viewsById.get(g.id) ?? '—'}</td>
                            <td style={S.td}>{g.status === 'live' && g.publishedAt ? new Date(g.publishedAt).toLocaleDateString() : '—'}</td>
                            <td style={S.td}>{g.updatedAt ? new Date(g.updatedAt).toLocaleDateString() : '—'}</td>
                            <td style={S.td}><span style={{ ...S.badge, ...(GUIDE_TONE[g.status] || GUIDE_TONE.archived) }}>{g.status}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <div style={S.panel}>
                <div style={S.panelTitle}>FEATURED CONTENT &amp; MEDIA</div>
                <div style={S.panelSub}>From the creator’s Creator Studio record.</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10 }}>
                  {kv('FEATURED ITEMS', String((creator.featuredContent || []).length), false, true)}
                  {kv('VIDEOS', String((creator.videos || []).length), false, true)}
                  {kv('REELS', String((creator.reels || []).length), false, true)}
                </div>
                {(creator.featuredContent || []).length ? (
                  <ul style={{ margin: '10px 0 0', paddingLeft: 18, fontSize: 11.5, fontWeight: 600, color: '#374151' }}>
                    {(creator.featuredContent || []).map((f) => (
                      <li key={f.id}>{f.title} <span style={{ color: '#9CA3AF' }}>· {f.source === 'platform' ? f.kind : 'external link'}</span></li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          )}

          {activeTab === 'earnings' && (
            <UnavailablePanel
              title="MY EARNINGS"
              sub="Creator earnings and payouts."
              testId="profile-earnings"
              message={
                <>
                  No creator earnings are recorded on Choosify’s servers yet.
                  <br />
                  The creator Earnings page currently runs on sample data stored in the creator’s browser, so there is nothing real to
                  show here. (Seller escrow earnings don’t apply to creators.)
                </>
              }
            />
          )}

          {activeTab === 'payment' && targetUserId ? <PayoutInfoPanel userId={targetUserId} ownerLabel="creator" /> : null}

          {activeTab === 'reviews' && (
            <>
              <div style={S.panel} data-testid="creator-reputation">
                <div style={S.panelTitle}>REPUTATION</div>
                <div style={S.panelSub}>Trust score is set by Choosify on the creator record.</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 }}>
                  {kv('TRUST SCORE', creator.score ? String(creator.score) : 'Not scored yet', false, true)}
                  {kv('VERIFIED', creator.verifiedStatus ? 'Yes' : 'No', false, true)}
                </div>
                <div style={{ marginTop: 10, fontSize: 11, color: '#6B7280', fontWeight: 600 }}>
                  Reviews received: the review system records reviews of products and orders, not of creators — so a creator has none to show.
                </div>
              </div>
              <ReviewsPanel direction="posted" reviews={posted} error={reviewsError} emptyText={targetUserId ? 'This account has not posted any reviews.' : 'Not linked to a login account.'} />
            </>
          )}

          {activeTab === 'ads' &&
            (targetUserId ? (
              <AdsDealsPanel ownerUserId={targetUserId} editing={edit.editing} />
            ) : (
              <UnavailablePanel title="ADS & DEALS" message="This creator profile is not linked to a login account, so it owns no ads or deals." />
            ))}

          {activeTab === 'activity' && (targetUserId ? <AccountActivityPanel userId={targetUserId} ownerLabel="this creator account" /> : <UnavailablePanel title="ACTIVITY LOG" message="This creator profile is not linked to a login account, so there is no account activity." />)}

          {activeTab === 'features' &&
            (targetUserId ? (
              <AccountEntitlementsPanel
                userId={targetUserId}
                canMutate={false}
                manageHref={`/admin/feature-access?view=accounts&userId=${encodeURIComponent(targetUserId)}`}
                auditHref={`/admin/feature-access?view=audit&userId=${encodeURIComponent(targetUserId)}`}
              />
            ) : (
              <div style={S.panel} data-testid="creator-feature-access-no-account">
                <div style={S.panelTitle}>FEATURE ACCESS</div>
                <div style={S.panelSub}>Partner entitlements apply to the creator's linked login account.</div>
                <div style={S.emptyBox}>No linked account — this creator profile is not connected to a user account, so there is no feature access to show.</div>
              </div>
            ))}
        </div>
      </div>

      <style>{`@media (max-width: 860px){ .cprv-grid{ grid-template-columns: minmax(0,1fr) !important; } }`}</style>

      {edit.dialog}
      {showMessagePopup && targetUserId ? (
        <ProfileMessagePopup targetUserId={targetUserId} targetName={displayName} onClose={() => setShowMessagePopup(false)} />
      ) : null}
    </div>
  );
}
