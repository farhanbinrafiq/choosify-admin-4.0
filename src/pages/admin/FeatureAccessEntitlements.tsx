import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { AdminWorkspaceLayout } from '../../components/Layout/AdminWorkspaceLayout';
import { authedFetch } from '../../services/authRefresh';
import {
  PARTNER_FEATURE_GROUPS,
  isSwitchableFeature,
  type PartnerFeatureDef,
  type PartnerFeatureGroup,
  type PartnerFeatureKey,
  type PartnerRole,
} from '../../../shared/entitlements/registry';

const API_BASE = '/api/v1';

type RoleScope = 'seller' | 'creator' | 'consumer';

type RoleDefaults = {
  seller: Record<string, boolean>;
  creator: Record<string, boolean>;
};

type GroupDef = { key: PartnerFeatureGroup; title: string };

const ROLE_HEADINGS: Record<RoleScope, [string, string]> = {
  seller: [
    'Seller Feature Access',
    'Switch operational and premium Seller capabilities. Core capabilities are always on.',
  ],
  creator: [
    'Creator Feature Access',
    'Switch operational and premium Creator capabilities. Core capabilities are always on.',
  ],
  consumer: [
    'Consumer Feature Access',
    'Consumer (shopper) capabilities are core and are not controlled through partner entitlements.',
  ],
};

const ROLE_TABS: { key: RoleScope; label: string }[] = [
  { key: 'seller', label: 'SELLER' },
  { key: 'creator', label: 'CREATOR' },
  { key: 'consumer', label: 'CONSUMER' },
];

/**
 * Icon tiles from standalone design file approach (emoji @ 14px in 36×36 #F3F4F6 / radius 8).
 * Mapped to real registry keys — not design mock feature keys.
 */
const FEATURE_EMOJI: Partial<Record<PartnerFeatureKey, string>> = {
  products: '📦',
  brandStudio: '🏪',
  reviews: '⭐',
  cashbooks: '📒',
  myEarnings: '💰',
  payouts: '⚡',
  feesAdjustments: '🧾',
  analytics: '📊',
  logisticsAnalytics: '📈',
  messaging: '💬',
  metaMessaging: '💬',
  adsDeals: '📣',
  promotionRequests: '🚀',
  guideManagement: '🎬',
  promoCodes: '🎟',
  returnsRefunds: '↩',
  logistics: '🚚',
  customerInsights: '🧭',
  notifications: '🔔',
};

/** Groups come from catalog metadata (feature.group), ordered by the catalog group list. */
function buildGroups(
  role: PartnerRole,
  catalog: PartnerFeatureDef[],
  groupDefs: GroupDef[],
): { title: string; items: PartnerFeatureDef[] }[] {
  const active = catalog.filter((f) => f.roles.includes(role) && !f.deprecated);
  return groupDefs
    .map((g) => ({ title: g.title, items: active.filter((f) => f.group === g.key) }))
    .filter((g) => g.items.length > 0);
}

/** Design-file toggle: 38×22 / radius 11 / knobs 16 @ top:3 left|right:3 */
function DesignToggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      style={{
        width: 38,
        height: 22,
        borderRadius: 11,
        background: checked ? '#EF3C23' : '#D1D5DB',
        position: 'relative',
        cursor: disabled ? 'not-allowed' : 'pointer',
        flexShrink: 0,
        opacity: disabled ? 0.55 : 1,
        border: 'none',
        padding: 0,
      }}
    >
      <span
        style={{
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: '#fff',
          position: 'absolute',
          top: 3,
          ...(checked ? { right: 3 } : { left: 3 }),
        }}
      />
    </button>
  );
}

function TierBadge({ text, color, background }: { text: string; color: string; background: string }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 800,
        color,
        background,
        padding: '5px 10px',
        borderRadius: 6,
        flexShrink: 0,
        whiteSpace: 'nowrap',
      }}
    >
      {text}
    </div>
  );
}

function FeatureRow({
  feature,
  enabled,
  busy,
  onToggle,
}: {
  feature: PartnerFeatureDef;
  enabled: boolean;
  busy: boolean;
  onToggle: () => void;
}) {
  const emoji = FEATURE_EMOJI[feature.key] || '⚙';

  return (
    <div
      data-testid={`feature-row-${feature.key}`}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '18px 0',
        borderBottom: '1px solid #F1F3F5',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', minWidth: 0 }}>
        <div
          aria-hidden
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: '#F3F4F6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 14,
            flexShrink: 0,
            lineHeight: 1,
          }}
        >
          {emoji}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#111827' }}>{feature.label}</div>
          <div
            style={{
              fontSize: 11,
              color: '#9CA3AF',
              fontWeight: 600,
              marginTop: 2,
              maxWidth: 600,
            }}
          >
            {feature.description}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        {feature.tier === 'core' && <TierBadge text="CORE · ALWAYS ON" color="#065F46" background="#D1FAE5" />}
        {feature.tier === 'reserved' && <TierBadge text="NOT YET AVAILABLE" color="#4B5563" background="#F3F4F6" />}
        {feature.planControlled && <TierBadge text="PLAN-CONTROLLED" color="#B45309" background="#FEF3C7" />}
        {isSwitchableFeature(feature) && (
          <DesignToggle checked={enabled} disabled={busy} onChange={onToggle} label={`${feature.label} for role`} />
        )}
      </div>
    </div>
  );
}

type RoleSummary = {
  total: number;
  enabled: number;
  turnedOff: number;
  planLocked: number;
  turnedOffFeatures: PartnerFeatureDef[];
};

function computeRoleSummary(
  features: PartnerFeatureDef[],
  defaults: Record<string, boolean> | undefined,
): RoleSummary {
  let enabled = 0;
  let turnedOff = 0;
  let planLocked = 0;
  const turnedOffFeatures: PartnerFeatureDef[] = [];

  for (const f of features) {
    // Plan Locked = catalog planControlled keys (a Plan may grant/withhold them).
    if (f.planControlled) planLocked += 1;
    if (f.tier === 'core') {
      enabled += 1;
      continue;
    }
    if (!isSwitchableFeature(f)) continue;
    const on = defaults?.[f.key] !== false;
    if (on) enabled += 1;
    else {
      turnedOff += 1;
      turnedOffFeatures.push(f);
    }
  }

  return {
    total: features.length,
    enabled,
    turnedOff,
    planLocked,
    turnedOffFeatures,
  };
}

function SummaryStatCard({
  label,
  value,
  sub,
  color,
  barPct,
}: {
  label: string;
  value: number;
  sub: string;
  color: string;
  /** 0–100 fill for the Creator-studio-style line bar */
  barPct: number;
}) {
  const fill = Math.max(0, Math.min(100, barPct));
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #E8EDF2',
        borderRadius: 10,
        padding: 16,
        minWidth: 0,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 800,
          color,
          letterSpacing: '0.03em',
          marginBottom: 8,
          textTransform: 'uppercase',
        }}
      >
        ■ {label}
      </div>
      <div
        data-testid={`summary-${label.toLowerCase().replace(/\s+/g, '-')}`}
        style={{
          fontSize: 22,
          fontWeight: 800,
          color: '#111827',
          marginBottom: 8,
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      <div
        style={{
          height: 4,
          borderRadius: 99,
          background: '#F1F3F5',
          overflow: 'hidden',
          marginBottom: 6,
        }}
      >
        <div
          style={{
            width: `${fill}%`,
            height: '100%',
            background: color,
            borderRadius: 99,
          }}
        />
      </div>
      <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600 }}>{sub}</div>
    </div>
  );
}

function RoleAnalyticsSummary({ summary }: { summary: RoleSummary }) {
  const { total, enabled, turnedOff, planLocked, turnedOffFeatures } = summary;
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 14,
          marginBottom: 12,
        }}
      >
        <SummaryStatCard
          label="Total Features"
          value={total}
          sub="items"
          color="#EF3C23"
          barPct={total > 0 ? 100 : 0}
        />
        <SummaryStatCard
          label="Enabled"
          value={enabled}
          sub={`of ${total}`}
          color="#16A34A"
          barPct={pct(enabled)}
        />
        <SummaryStatCard
          label="Turned Off"
          value={turnedOff}
          sub={`of ${total}`}
          color="#DC2626"
          barPct={pct(turnedOff)}
        />
        <SummaryStatCard
          label="Plan Locked"
          value={planLocked}
          sub={`of ${total} plan-controlled`}
          color="#F59E0B"
          barPct={pct(planLocked)}
        />
      </div>

      <div
        style={{
          background: '#FFF7ED',
          border: '1px solid #FED7AA',
          borderRadius: 10,
          padding: '14px 16px',
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            color: '#C2410C',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            marginBottom: 10,
          }}
        >
          Currently Turned Off
        </div>
        {turnedOffFeatures.length === 0 ? (
          <div style={{ fontSize: 12, fontWeight: 600, color: '#9A3412' }}>
            All switchable features are currently enabled.
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {turnedOffFeatures.map((f) => (
              <span
                key={f.key}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: '#fff',
                  border: '1px solid #E8EDF2',
                  borderRadius: 999,
                  padding: '6px 10px',
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#7C2D12',
                }}
              >
                <span aria-hidden style={{ fontSize: 13, lineHeight: 1 }}>
                  {FEATURE_EMOJI[f.key] || '⚙'}
                </span>
                {f.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function describeLoadFailure(status: number, body: { error?: string; code?: string }): string {
  if (status === 401) return 'Your session has expired. Sign in again to manage Feature Access.';
  if (status === 403) return 'You do not have permission to manage Feature Access.';
  if (status === 503 || body.code === 'ENTITLEMENT_CHECK_UNAVAILABLE') {
    return 'Feature Access is temporarily unavailable. Please retry shortly.';
  }
  return body.error || `Failed to load Feature Access (${status}).`;
}

const cardStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #E8EDF2',
  borderRadius: 10,
  marginBottom: 16,
  overflow: 'hidden',
};

const groupHeaderStyle: React.CSSProperties = {
  padding: '14px 24px',
  background: '#F9FAFB',
  borderBottom: '1px solid #F1F3F5',
  fontSize: 10.5,
  fontWeight: 800,
  color: '#6B7280',
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
};

/**
 * Admin Feature Access & Entitlements —
 * Presentation: standalone design file (Choosify Admin CMS).
 * Data/logic: live entitlement catalog (tier / group / planControlled metadata) + admin API.
 * Partner application review lives in Seller Management / Creator Management.
 */
export default function FeatureAccessEntitlementsPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';

  const [roleScope, setRoleScope] = useState<RoleScope>('seller');
  const [catalog, setCatalog] = useState<PartnerFeatureDef[]>([]);
  const [groupDefs, setGroupDefs] = useState<GroupDef[]>(PARTNER_FEATURE_GROUPS);
  const [roleDefaults, setRoleDefaults] = useState<RoleDefaults | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3200);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setError(null);
    try {
      // Refresh-aware: an expired access token is refreshed and the call retried.
      const res = await authedFetch(`${API_BASE}/entitlements/admin`);
      const body = (await res.json().catch(() => ({}))) as {
        catalog?: PartnerFeatureDef[];
        groups?: GroupDef[];
        roleDefaults?: RoleDefaults;
        error?: string;
        code?: string;
      };
      if (res.ok && body.catalog?.length && body.roleDefaults) {
        setCatalog(body.catalog);
        if (body.groups?.length) setGroupDefs(body.groups);
        setRoleDefaults(body.roleDefaults);
      } else {
        // Never fabricate an "all enabled" state — show what actually happened.
        setCatalog([]);
        setRoleDefaults(null);
        setLoadError(res.ok ? 'Feature Access returned an incomplete catalog.' : describeLoadFailure(res.status, body));
      }
    } catch (e) {
      setCatalog([]);
      setRoleDefaults(null);
      setLoadError(e instanceof Error ? `Failed to load Feature Access: ${e.message}` : 'Failed to load Feature Access.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin, load]);

  const groups = useMemo(() => {
    if (roleScope === 'consumer' || !catalog.length) return [];
    return buildGroups(roleScope, catalog, groupDefs);
  }, [catalog, groupDefs, roleScope]);

  const roleSummary = useMemo(() => {
    if (roleScope === 'consumer') return computeRoleSummary([], undefined);
    return computeRoleSummary(
      groups.flatMap((g) => g.items),
      roleDefaults?.[roleScope],
    );
  }, [groups, roleDefaults, roleScope]);

  const [heading, subheading] = ROLE_HEADINGS[roleScope];

  const toggleFeature = async (role: PartnerRole, feature: PartnerFeatureDef, enabled: boolean) => {
    setBusyKey(`${role}:${feature.key}`);
    setError(null);
    try {
      const res = await authedFetch(`${API_BASE}/entitlements/admin/role-defaults/${role}/${feature.key}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        roleDefaults?: RoleDefaults;
        error?: string;
        code?: string;
      };
      if (!res.ok) throw new Error(describeLoadFailure(res.status, body));
      if (body.roleDefaults) setRoleDefaults(body.roleDefaults);
      showToast(
        enabled
          ? `${feature.label} enabled for ${role} — prior data remains intact.`
          : `${feature.label} access disabled for ${role} — data preserved.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Toggle failed');
    } finally {
      setBusyKey(null);
    }
  };

  if (!isAdmin) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return (
    <AdminWorkspaceLayout
      pageTitle="Feature Access & Entitlements"
      pageSubtitle="Manage which platform features are enabled per role and plan"
    >
      {/* Exact visual shell from standalone design Feature Access block */}
      <div
        className="fa-entitlements"
        style={{
          padding: '0 0 24px',
          color: '#111827',
          fontFamily: 'var(--font-sans)',
        }}
      >
        {toast && (
          <div
            style={{
              marginBottom: 16,
              borderRadius: 10,
              border: '1px solid #A7F3D0',
              background: '#ECFDF5',
              padding: '10px 16px',
              fontSize: 13,
              fontWeight: 600,
              color: '#065F46',
            }}
          >
            {toast}
          </div>
        )}
        {error && (
          <div
            role="alert"
            style={{
              marginBottom: 16,
              borderRadius: 10,
              border: '1px solid #FECACA',
              background: '#FEF2F2',
              padding: '10px 16px',
              fontSize: 13,
              fontWeight: 600,
              color: '#B91C1C',
            }}
          >
            {error}
          </div>
        )}

        {/* Partner application review moved to the owning management studios. */}
        <div
          data-testid="partner-applications-pointer"
          style={{
            ...cardStyle,
            padding: '12px 20px',
            fontSize: 12,
            fontWeight: 600,
            color: '#4B5563',
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <span>Partner applications are reviewed in the management studios:</span>
          <Link to="/admin/seller-management?filter=requests" style={{ color: '#EF3C23', fontWeight: 800 }}>
            Seller applications →
          </Link>
          <Link to="/admin/creator-management?filter=requests" style={{ color: '#EF3C23', fontWeight: 800 }}>
            Creator applications →
          </Link>
        </div>

        {/* Role intro card — design: pad 24, radius 10, title 16/800, sub 12/#6B7280/600 */}
        <div
          style={{
            background: '#fff',
            border: '1px solid #E8EDF2',
            borderRadius: 10,
            padding: 24,
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4, color: '#111827' }}>
            {heading}
          </div>
          <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 600 }}>{subheading}</div>
        </div>

        {/* Active-role analytics — total / enabled / off / plan-locked + turned-off chips */}
        {!loading && !loadError && roleScope !== 'consumer' && <RoleAnalyticsSummary summary={roleSummary} />}

        {/* Role switcher — below analytics summary */}
        <div
          style={{
            display: 'flex',
            background: '#fff',
            border: '1px solid #E8EDF2',
            borderRadius: 10,
            padding: 8,
            marginBottom: 16,
            overflowX: 'auto',
          }}
        >
          {ROLE_TABS.map((tb) => {
            const active = roleScope === tb.key;
            return (
              <button
                key={tb.key}
                type="button"
                onClick={() => setRoleScope(tb.key)}
                style={{
                  flex: 1,
                  textAlign: 'center',
                  padding: '10px 14px',
                  borderRadius: 8,
                  fontSize: 11.5,
                  fontWeight: 800,
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  border: 'none',
                  background: active ? '#EF3C23' : 'transparent',
                  color: active ? '#fff' : '#374151',
                }}
              >
                {tb.label}
              </button>
            );
          })}
        </div>

        {roleScope === 'consumer' ? (
          <div style={cardStyle} data-testid="consumer-core-explanation">
            <div style={groupHeaderStyle}>CONSUMER CAPABILITIES</div>
            <div style={{ padding: '18px 24px' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#111827' }}>
                Consumer capabilities are core and are not controlled through Feature Access.
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: '#9CA3AF',
                  fontWeight: 600,
                  marginTop: 2,
                  maxWidth: 640,
                }}
              >
                Shopping, checkout, orders, returns and warranty claims, reviews, Choosify Support,
                account security and notifications are available to every shopper account. Partner
                entitlements (plans and role switches) apply to Seller and Creator commercial
                capabilities only; there are no consumer feature switches.
              </div>
            </div>
          </div>
        ) : loading ? (
          <div style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', padding: '24px 0' }}>
            Loading…
          </div>
        ) : loadError ? (
          <div
            role="alert"
            data-testid="feature-access-load-error"
            style={{ ...cardStyle, border: '1px solid #FECACA', background: '#FEF2F2', padding: '18px 24px' }}
          >
            <div style={{ fontSize: 13, fontWeight: 800, color: '#B91C1C' }}>{loadError}</div>
            <div style={{ fontSize: 11, color: '#991B1B', fontWeight: 600, marginTop: 4 }}>
              No entitlement state is shown until it can be loaded from the server.
            </div>
            <button
              type="button"
              onClick={() => void load()}
              style={{
                marginTop: 12,
                height: 32,
                padding: '0 14px',
                borderRadius: 8,
                border: '1px solid #FECACA',
                background: '#fff',
                color: '#B91C1C',
                fontSize: 12,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Retry
            </button>
          </div>
        ) : (
          groups.map((grp) => (
            <div key={grp.title} style={cardStyle}>
              <div style={groupHeaderStyle}>{grp.title}</div>
              <div style={{ padding: '0 24px' }}>
                {grp.items.map((feature) => {
                  const enabled = feature.tier === 'core' || roleDefaults?.[roleScope]?.[feature.key] !== false;
                  const busy = busyKey === `${roleScope}:${feature.key}`;
                  return (
                    <FeatureRow
                      key={feature.key}
                      feature={feature}
                      enabled={enabled}
                      busy={busy}
                      onToggle={() => void toggleFeature(roleScope, feature, !enabled)}
                    />
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </AdminWorkspaceLayout>
  );
}
