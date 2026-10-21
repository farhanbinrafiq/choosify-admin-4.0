import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Landmark, Smartphone } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { authApi } from '../../../services/authApi';
import { catalogApi } from '../../../services/catalogApi';
import { operationsApi, type PayoutChannel } from '../../../services/operationsApi';
import type { CatalogBrand, CatalogCreator } from '../../../types/catalog';
import PersonalAvatarCard from '../../../components/account/PersonalAvatarCard';
import { OwnerVerificationPanel } from '../../../components/admin/profile/OwnerVerificationPanel';
import { MarketplaceAccessSection } from '../../../components/admin/profile/MarketplaceAccessSection';
import { MarketplaceStatusBadge, PhotoVerificationBadge } from '../../../components/admin/profile/PhotoVerificationBadge';
import { personaCoverGradient } from '../../../components/admin/profile/personaTheme';
import { EditableAccountField } from '../../../components/admin/profile/AccountDetailsEditor';
import type { AccountDetailsPatch } from '../../../services/profileApi';
import { AccountActivityPanel } from '../../../components/admin/profile/AccountActivityPanel';

/**
 * Seller / Creator OWN profile (/admin/brand-profile, /admin/creator-profile).
 * Replaces the CMS-mirror prototype self-profile, whose KYC checklist and
 * documents were fabricated. Every section reads the real record: account
 * (auth), profile photo (account avatar, also used for photo verification),
 * Verification Center (upload / submit / answer Choosify), Marketplace Access
 * with its decision history, and payout channels. The brand / creator profile
 * itself is edited in Brand Studio / Creator Studio, so it is not repeated here
 * (the Super Admin profile view still shows it).
 */

type Persona = 'seller' | 'creator';

const TABS: Record<Persona, Array<{ key: string; label: string }>> = {
  seller: [
    { key: 'verification', label: 'Verification Center' },
    { key: 'access', label: 'Marketplace Access' },
    { key: 'payment', label: 'Payment Info' },
    { key: 'activity', label: 'Activity Log' },
  ],
  creator: [
    { key: 'verification', label: 'Verification Center' },
    { key: 'access', label: 'Marketplace Access' },
    { key: 'payment', label: 'Payment Info' },
    { key: 'activity', label: 'Activity Log' },
  ],
};

const S: Record<string, React.CSSProperties> = {
  grid: { display: 'grid', gridTemplateColumns: 'minmax(0,280px) minmax(0,1fr)', gap: 16, alignItems: 'start' },
  card: { background: '#fff', border: '1px solid #E8EDF2', borderRadius: 10, overflow: 'hidden' },
  kLabel: { fontSize: 9, fontWeight: 800, color: '#9CA3AF' },
  kValue: { fontSize: 11.5, fontWeight: 700, marginTop: 2, color: '#111827', overflowWrap: 'anywhere' },
  tabBar: { display: 'flex', gap: 16, background: '#fff', border: '1px solid #E8EDF2', borderRadius: 8, padding: '0 16px', overflowX: 'auto' },
  tab: { padding: '12px 4px', fontSize: 11.5, fontWeight: 800, whiteSpace: 'nowrap', cursor: 'pointer', borderBottom: '2px solid transparent', color: '#6B7280', background: 'transparent', borderTop: 0, borderLeft: 0, borderRight: 0 },
  tabActive: { color: 'var(--cms-accent)', borderBottom: '2px solid var(--cms-accent)' },
  panel: { background: '#fff', border: '1px solid #E8EDF2', borderRadius: 8, padding: 16 },
  link: { color: 'var(--cms-accent)', fontWeight: 800, textDecoration: 'none', fontSize: 11.5 },
};

export default function OwnerProfilePage({ persona }: { persona: Persona }) {
  const { profile, applyProfileUpdate } = useAuth();
  const uid = profile?.id || '';
  const [tab, setTab] = useState(() => {
    const t = new URLSearchParams(window.location.search).get('tab');
    return t && TABS[persona].some((x) => x.key === t) ? t : 'verification';
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [brands, setBrands] = useState<CatalogBrand[]>([]);
  const [creator, setCreator] = useState<CatalogCreator | null>(null);
  const [channels, setChannels] = useState<PayoutChannel[]>([]);

  const load = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    setError(null);
    try {
      const [me, payout] = await Promise.all([
        authApi.getMyAccount().catch(() => null),
        operationsApi.getMyPayoutProfile().catch(() => null),
      ]);
      setPhone(me?.phone || null);
      setChannels(payout?.channels || []);
      if (persona === 'seller') {
        const owned = (await catalogApi.listBrands()).filter((b) => b.sellerId === uid);
        setBrands(owned);
      } else {
        setCreator((await catalogApi.listCreators()).find((c) => c.userId === uid) || null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your profile.');
    } finally {
      setLoading(false);
    }
  }, [uid, persona]);

  useEffect(() => {
    void load();
  }, [load]);

  const entities = useMemo(
    () =>
      persona === 'seller'
        ? brands.map((b) => ({ id: b.id, name: b.name, logo: b.logo }))
        : creator
          ? [{ id: creator.id, name: creator.name, logo: creator.avatar }]
          : [],
    [persona, brands, creator],
  );

  if (!profile) return null;
  const kv = (label: string, value: React.ReactNode) => (
    <div style={{ borderTop: '1px solid #F1F3F5', paddingTop: 8 }}>
      <div style={S.kLabel}>{label}</div>
      <div style={S.kValue}>{value}</div>
    </div>
  );

  const onAccountSaved = (saved: AccountDetailsPatch) => {
    applyProfileUpdate({
      ...(saved.displayName !== undefined ? { displayName: saved.displayName } : {}),
      ...(saved.username !== undefined ? { username: saved.username } : {}),
    });
    if (saved.phone !== undefined) void load();
  };

  return (
    <div style={{ color: '#111827' }} data-testid={`owner-profile-${persona}`}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 800 }}>My Profile</div>
        <div style={{ fontSize: 11.5, color: '#9CA3AF', fontWeight: 600, marginTop: 2 }}>
          Your {persona} account, verification documents, Marketplace Access and payout details.
        </div>
      </div>
      <div style={S.grid} className="cprv-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={S.card}>
            <div style={{ height: 70, background: personaCoverGradient(persona), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: '0.15em', color: '#fff' }}>{persona.toUpperCase()}</span>
            </div>
            <div style={{ padding: 16 }}>
              {/* Profile photo — also the Profile Photo document for photo verification. Change it any time. */}
              <PersonalAvatarCard variant="header" />
              <div style={{ fontSize: 13.5, fontWeight: 800, marginTop: 10 }}>{profile.displayName}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <PhotoVerificationBadge entityType={persona === 'seller' ? 'brand' : 'creator'} entityIds={entities.map((e) => e.id)} currentAvatarUrl={profile.avatar} />
                {!loading ? (
                  persona === 'seller' ? (
                    <MarketplaceStatusBadge active={brands.some((b) => b.marketplaceAccess && !['suspended', 'restricted', 'revoked'].includes(String(b.marketplaceStatus || '')))} status={brands[0]?.marketplaceStatus} />
                  ) : (
                    <MarketplaceStatusBadge active={creator?.status === 'live'} status={creator?.status} />
                  )
                ) : null}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                <EditableAccountField field="displayName" label="DISPLAY NAME" value={profile.displayName} divider onSaved={onAccountSaved} />
                <EditableAccountField
                  field="username"
                  label="USERNAME"
                  value={profile.username}
                  display={profile.username ? `@${profile.username.replace(/^@/, '')}` : undefined}
                  divider
                  onSaved={onAccountSaved}
                />
                {kv('EMAIL', profile.email || '—')}
                <EditableAccountField field="phone" label="PHONE" value={phone} divider onSaved={onAccountSaved} />
                {kv('CHOOSIFY USER ID', <span style={{ fontFamily: 'monospace' }}>{profile.choosifyUserId || '—'}</span>)}
                {kv('MARKETPLACE ACCESS', profile.marketplaceAccess ? 'Active' : 'Not active')}
                {persona === 'seller' ? kv('BRANDS', brands.map((b) => b.name).join(', ') || '—') : kv('CREATOR PROFILE', creator?.name || 'Not set up yet')}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
          <div style={S.tabBar} role="tablist">
            {TABS[persona].map((t) => (
              <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} data-tab={t.key} onClick={() => setTab(t.key)} style={{ ...S.tab, ...(tab === t.key ? S.tabActive : {}) }}>
                {t.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div style={{ ...S.panel, textAlign: 'center' }}><Loader2 size={18} className="animate-spin" /></div>
          ) : error ? (
            <div style={{ ...S.panel, color: '#DC2626', fontWeight: 700, fontSize: 12 }}>{error}</div>
          ) : (
            <>
              {tab === 'verification' && (
                <OwnerVerificationPanel
                  entityType={persona === 'seller' ? 'brand' : 'creator'}
                  entities={entities}
                  avatarUrl={profile.avatar}
                  emptyText={persona === 'seller' ? 'You have no brand yet — create one in Brand Studio first.' : 'Set up your Creator Studio profile first.'}
                />
              )}

              {tab === 'access' &&
                (entities.length === 0 ? (
                  <div style={{ ...S.panel, fontSize: 12, color: '#9CA3AF', fontWeight: 600 }}>Nothing to show yet.</div>
                ) : persona === 'seller' ? (
                  brands.map((b) => <MarketplaceAccessSection key={b.id} entityType="brand" brand={b} onChanged={() => void load()} />)
                ) : creator ? (
                  <MarketplaceAccessSection entityType="creator" creator={creator} onChanged={() => void load()} />
                ) : null)}

              {tab === 'activity' && <AccountActivityPanel userId="me" ownerLabel="your account" />}

              {tab === 'payment' && (
                <div style={S.panel} data-testid="owner-payment">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 800 }}>PAYMENT INFO</div>
                    <Link to="/admin/payouts?tab=payment-info" style={S.link}>{channels.length ? 'Edit' : 'Add payment method'} →</Link>
                  </div>
                  {channels.length === 0 ? (
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#6B7280' }}>No payment method is added. Add a bank account or bKash / Nagad / Rocket wallet so Choosify can pay you.</div>
                  ) : (
                    channels.map((c, i) => (
                      <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 0', borderTop: '1px solid #F5F6F8' }}>
                        {c.kind === 'bank' ? <Landmark size={15} color="#2563EB" /> : <Smartphone size={15} color="#2563EB" />}
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 800 }}>{c.provider}</div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', fontFamily: 'monospace' }}>{c.number} · {c.accountName}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <style>{`@media (max-width: 860px){ .cprv-grid{ grid-template-columns: minmax(0,1fr) !important; } }`}</style>
    </div>
  );
}
