import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { AdminWorkspaceLayout } from '../../components/Layout/AdminWorkspaceLayout';
import {
  PARTNER_FEATURES,
  type PartnerFeatureDef,
  type PartnerFeatureKey,
  type PartnerRole,
} from '../../../shared/entitlements/registry';

const AUTH_TOKEN_KEY = 'choosify_auth_token';
const API_BASE = '/api/v1';

type RoleScope = 'seller' | 'creator' | 'consumer';

type RoleDefaults = {
  seller: Record<string, boolean>;
  creator: Record<string, boolean>;
};

type PartnerApplicationRow = {
  id: string;
  applicantType: 'seller' | 'creator';
  status: 'pending' | 'approved' | 'rejected';
  email: string;
  displayName: string;
  businessOrChannelName: string;
  category: string;
  city: string;
  niche?: string;
  createdAt: string;
  provisionedUserId?: string;
};

type FeatureGroupDef = {
  title: string;
  keys: PartnerFeatureKey[];
};

/**
 * Visual groups from standalone design architecture.
 * Keys are real registry only — never design-file mock keys.
 */
const SELLER_GROUPS: FeatureGroupDef[] = [
  {
    title: 'STOREFRONT & CATALOG',
    keys: ['products', 'brandStudio', 'reviews'],
  },
  {
    title: 'FINANCE & PAYOUTS',
    keys: ['cashbooks', 'myEarnings', 'payouts', 'feesAdjustments', 'analytics'],
  },
  {
    title: 'MARKETING & MESSAGING',
    keys: ['messaging', 'metaMessaging', 'adsDeals', 'guideManagement', 'promoCodes'],
  },
  {
    title: 'OPERATIONS & INSIGHTS',
    keys: ['returnsRefunds', 'logistics', 'advancedAnalytics', 'customerInsights', 'notifications'],
  },
];

const CREATOR_GROUPS: FeatureGroupDef[] = [
  {
    title: 'CONTENT & PUBLISHING',
    keys: ['guideManagement'],
  },
  {
    title: 'MONETIZATION',
    keys: ['myEarnings', 'payouts', 'feesAdjustments', 'adsDeals'],
  },
  {
    title: 'COMMUNICATION & INSIGHTS',
    keys: [
      'messaging',
      'metaMessaging',
      'analytics',
      'customerInsights',
      'reviews',
      'notifications',
      'cashbooks',
    ],
  },
];

const ROLE_HEADINGS: Record<RoleScope, [string, string]> = {
  seller: [
    'Seller Feature Access',
    'Enable or disable platform features and entitlements per Seller account tier.',
  ],
  creator: [
    'Creator Feature Access',
    'Enable or disable platform features and entitlements per Creator account tier.',
  ],
  consumer: [
    'Consumer Feature Access',
    'Enable or disable platform features made available to shopper accounts.',
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
  brandStudio: '🏬',
  reviews: '⭐',
  cashbooks: '📒',
  myEarnings: '💰',
  payouts: '⚡',
  feesAdjustments: '🧾',
  analytics: '📊',
  advancedAnalytics: '📈',
  messaging: '💬',
  metaMessaging: '💬',
  adsDeals: '📣',
  guideManagement: '🎬',
  promoCodes: '🎟️',
  returnsRefunds: '↩️',
  logistics: '🚚',
  customerInsights: '🧭',
  notifications: '🔔',
};

function authHeaders(): HeadersInit {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function catalogByKey(catalog: PartnerFeatureDef[]): Map<string, PartnerFeatureDef> {
  return new Map(catalog.map((f) => [f.key, f]));
}

function buildGroups(
  role: PartnerRole,
  catalog: PartnerFeatureDef[],
): { title: string; items: PartnerFeatureDef[] }[] {
  const byKey = catalogByKey(catalog.filter((f) => f.roles.includes(role)));
  const defs = role === 'seller' ? SELLER_GROUPS : CREATOR_GROUPS;
  const used = new Set<string>();
  const groups: { title: string; items: PartnerFeatureDef[] }[] = [];

  for (const g of defs) {
    const items = g.keys
      .map((k) => byKey.get(k))
      .filter((f): f is PartnerFeatureDef => Boolean(f));
    for (const it of items) used.add(it.key);
    if (items.length > 0) groups.push({ title: g.title, items });
  }

  const leftover = [...byKey.values()].filter((f) => !used.has(f.key));
  if (leftover.length > 0) {
    groups.push({ title: 'OTHER FEATURES', items: leftover });
  }
  return groups;
}

/** Design-file toggle: 38×22 / radius 11 / knobs 16 @ top:3 left|right:3 */
function DesignToggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      style={{
        width: 38,
        height: 22,
        borderRadius: 11,
        background: checked ? '#FF5B00' : '#D1D5DB',
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

function PlanRequiredBadge() {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 800,
        color: '#B45309',
        background: '#FEF3C7',
        padding: '5px 10px',
        borderRadius: 6,
        flexShrink: 0,
      }}
    >
      PLAN REQUIRED
    </div>
  );
}

function FeatureRow({
  feature,
  enabled,
  busy,
  planRequired,
  onToggle,
}: {
  feature: PartnerFeatureDef;
  enabled: boolean;
  busy: boolean;
  planRequired: boolean;
  onToggle: () => void;
}) {
  const emoji = FEATURE_EMOJI[feature.key] || '⚙️';

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '18px 0',
        borderBottom: '1px solid #F1F3F5',
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
      {planRequired ? (
        <PlanRequiredBadge />
      ) : (
        <DesignToggle checked={enabled} disabled={busy} onChange={onToggle} />
      )}
    </div>
  );
}

function isPlanRequired(feature: PartnerFeatureDef): boolean {
  // Future-ready: honor real plan/locked metadata when the registry/API provides it.
  // Do not invent premium locks in the UI.
  const meta = feature as PartnerFeatureDef & {
    planRequired?: boolean;
    locked?: boolean;
    planGated?: boolean;
  };
  return Boolean(meta.planRequired || meta.locked || meta.planGated);
}

function flattenRoleFeatures(
  groups: { title: string; items: PartnerFeatureDef[] }[],
): PartnerFeatureDef[] {
  const seen = new Set<string>();
  const out: PartnerFeatureDef[] = [];
  for (const g of groups) {
    for (const f of g.items) {
      if (seen.has(f.key)) continue;
      seen.add(f.key);
      out.push(f);
    }
  }
  return out;
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
    if (isPlanRequired(f)) {
      planLocked += 1;
      continue;
    }
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
          sub={`of ${total}`}
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
            All available features are currently enabled.
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
                  {FEATURE_EMOJI[f.key] || '⚙️'}
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

/**
 * Admin Feature Access & Entitlements —
 * Presentation: standalone design file (Choosify Admin CMS).
 * Data/logic: live entitlement registry + admin API (unchanged).
 */
export default function FeatureAccessEntitlementsPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';

  const [roleScope, setRoleScope] = useState<RoleScope>('seller');
  const [catalog, setCatalog] = useState<PartnerFeatureDef[]>([]);
  const [roleDefaults, setRoleDefaults] = useState<RoleDefaults | null>(null);
  const [applications, setApplications] = useState<PartnerApplicationRow[]>([]);
  const [applicationsLoading, setApplicationsLoading] = useState(true);
  const [applicationsError, setApplicationsError] = useState<string | null>(null);
  const [rowFeedback, setRowFeedback] = useState<Record<string, { type: 'success' | 'error'; message: string }>>({});
  const [justApproved, setJustApproved] = useState<{ id: string; name: string; grantHref: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3200);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setApplicationsLoading(true);
    setError(null);
    try {
      const [entRes, appRes] = await Promise.all([
        fetch(`${API_BASE}/entitlements/admin`, { headers: authHeaders() }),
        fetch(`${API_BASE}/operations/partner-applications?status=pending`, {
          headers: authHeaders(),
        }),
      ]);
      const entBody = (await entRes.json().catch(() => ({}))) as {
        catalog?: PartnerFeatureDef[];
        roleDefaults?: RoleDefaults;
        error?: string;
      };
      const appBody = (await appRes.json().catch(() => ({}))) as {
        applications?: PartnerApplicationRow[];
        error?: string;
      };

      if (entRes.ok && entBody.catalog?.length) {
        setCatalog(entBody.catalog);
        setRoleDefaults(entBody.roleDefaults || null);
      } else if (!entRes.ok) {
        // Unauthenticated / mock Admin UI: render registry so design layout stays reviewable.
        // Do not surface auth noise (e.g. "Missing bearer token") as a page error banner.
        setCatalog(PARTNER_FEATURES);
        setRoleDefaults({
          seller: Object.fromEntries(
            PARTNER_FEATURES.filter((f) => f.roles.includes('seller')).map((f) => [f.key, true]),
          ),
          creator: Object.fromEntries(
            PARTNER_FEATURES.filter((f) => f.roles.includes('creator')).map((f) => [f.key, true]),
          ),
        });
        const authNoise =
          /bearer|unauthorized|401|403|not authenticated/i.test(String(entBody.error || '')) ||
          entRes.status === 401 ||
          entRes.status === 403;
        if (entBody.error && !authNoise) setError(entBody.error);
      } else {
        setCatalog(PARTNER_FEATURES);
        setRoleDefaults(entBody.roleDefaults || null);
      }
      if (appRes.ok) {
        setApplications(appBody.applications || []);
        setApplicationsError(null);
      } else {
        setApplicationsError(appBody.error || `Failed to load partner applications (${appRes.status}).`);
      }
    } catch (e) {
      setCatalog(PARTNER_FEATURES);
      setRoleDefaults({
        seller: Object.fromEntries(
          PARTNER_FEATURES.filter((f) => f.roles.includes('seller')).map((f) => [f.key, true]),
        ),
        creator: Object.fromEntries(
          PARTNER_FEATURES.filter((f) => f.roles.includes('creator')).map((f) => [f.key, true]),
        ),
      });
      setError(e instanceof Error ? e.message : 'Load failed');
      setApplicationsError(e instanceof Error ? e.message : 'Failed to load partner applications.');
    } finally {
      setLoading(false);
      setApplicationsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin, load]);

  const groups = useMemo(() => {
    if (roleScope === 'consumer') return [];
    return buildGroups(roleScope, catalog.length ? catalog : PARTNER_FEATURES);
  }, [catalog, roleScope]);

  const roleSummary = useMemo(() => {
    if (roleScope === 'consumer') {
      return computeRoleSummary([], undefined);
    }
    const features = flattenRoleFeatures(groups);
    const defaults =
      roleScope === 'seller' || roleScope === 'creator'
        ? roleDefaults?.[roleScope]
        : undefined;
    return computeRoleSummary(features, defaults);
  }, [groups, roleDefaults, roleScope]);

  const [heading, subheading] = ROLE_HEADINGS[roleScope];

  const toggleFeature = async (role: PartnerRole, featureKey: string, enabled: boolean) => {
    setBusyKey(`${role}:${featureKey}`);
    try {
      const res = await fetch(
        `${API_BASE}/entitlements/admin/role-defaults/${role}/${featureKey}`,
        {
          method: 'PATCH',
          headers: authHeaders(),
          body: JSON.stringify({ enabled }),
        },
      );
      const body = (await res.json().catch(() => ({}))) as {
        roleDefaults?: RoleDefaults;
        error?: string;
      };
      if (!res.ok) throw new Error(body.error || 'Update failed');
      if (body.roleDefaults) setRoleDefaults(body.roleDefaults);
      showToast(
        enabled
          ? `${featureKey} enabled for ${role} — prior data remains intact.`
          : `${featureKey} access disabled for ${role} — data preserved.`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Toggle failed';
      const authNoise = /bearer|unauthorized|401|403|not authenticated/i.test(msg);
      if (authNoise) {
        showToast('Sign in required to persist entitlement changes.');
      } else {
        setError(msg);
      }
    } finally {
      setBusyKey(null);
    }
  };

  const reviewApplication = async (id: string, action: 'approve' | 'reject') => {
    const app = applications.find((a) => a.id === id);
    setBusyKey(`app:${id}:${action}`);
    setRowFeedback((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    try {
      const res = await fetch(`${API_BASE}/operations/partner-applications/${id}/${action}`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          note: action === 'approve' ? 'Approved via Feature Access module' : 'Rejected',
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error || `${action} failed`);
      if (action === 'approve' && app) {
        const grantHref = app.applicantType === 'creator'
          ? `/admin/creators/${encodeURIComponent(app.provisionedUserId || '')}/marketplace-access`
          : `/brand/${encodeURIComponent(app.provisionedUserId || '')}`;
        setJustApproved({ id, name: app.businessOrChannelName, grantHref });
        showToast('Partner provisioned. Marketplace Access still needs to be granted separately.');
      } else {
        setRowFeedback((prev) => ({ ...prev, [id]: { type: 'success', message: 'Application rejected.' } }));
        showToast('Application rejected.');
      }
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Review failed';
      setRowFeedback((prev) => ({ ...prev, [id]: { type: 'error', message: msg } }));
      setError(msg);
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

        {/*
          Partner Applications — deliberately placed at the top of the page, always visible.
          Previously lived inside a collapsed <details> at the bottom of this (unrelated) Feature
          Access page; a live approval attempt during QA went unnoticed by the operator as a
          result. Kept on this page (not moved elsewhere) to avoid adding a second review surface.
        */}
        <div
          style={{
            background: '#fff',
            border: applications.length > 0 ? '1px solid #FED7AA' : '1px solid #E8EDF2',
            borderRadius: 10,
            marginBottom: 16,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '14px 20px',
              background: applications.length > 0 ? '#FFF7ED' : '#F9FAFB',
              borderBottom: '1px solid #F1F3F5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 800, color: '#111827', display: 'flex', alignItems: 'center' }}>
              Partner Applications
              {applications.length > 0 && (
                <span
                  style={{
                    marginLeft: 8,
                    minWidth: 20,
                    padding: '2px 7px',
                    borderRadius: 999,
                    background: '#FF5B00',
                    color: '#fff',
                    fontSize: 11,
                    fontWeight: 800,
                    textAlign: 'center',
                  }}
                >
                  {applications.length} pending
                </span>
              )}
            </div>
            {applicationsLoading && <span style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF' }}>Loading…</span>}
          </div>

          {justApproved && (
            <div
              style={{
                margin: 16,
                padding: 16,
                borderRadius: 10,
                border: '1px solid #A7F3D0',
                background: '#ECFDF5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#065F46' }}>
                ✓ {justApproved.name} approved. Identity is verified — Marketplace Access is still off until it's granted
                separately.
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <a
                  href={justApproved.grantHref}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 8,
                    background: '#059669',
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 800,
                    textDecoration: 'none',
                  }}
                >
                  Grant Marketplace Access →
                </a>
                <button
                  type="button"
                  onClick={() => setJustApproved(null)}
                  style={{ border: 'none', background: 'transparent', color: '#065F46', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {applicationsError && (
            <div
              style={{
                margin: 16,
                padding: '10px 14px',
                borderRadius: 8,
                border: '1px solid #FECACA',
                background: '#FEF2F2',
                fontSize: 12,
                fontWeight: 700,
                color: '#B91C1C',
              }}
            >
              {applicationsError}
            </div>
          )}

          {!applicationsLoading && !applicationsError && applications.length === 0 ? (
            <div style={{ padding: 24, fontSize: 13, fontWeight: 600, color: '#6B7280' }}>No pending partner applications.</div>
          ) : (
            applications.map((app) => {
              const feedback = rowFeedback[app.id];
              const busy = busyKey === `app:${app.id}:approve` || busyKey === `app:${app.id}:reject`;
              return (
                <div key={app.id} style={{ padding: '16px 20px', borderBottom: '1px solid #F1F3F5' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800 }}>
                        {app.businessOrChannelName}{' '}
                        <span style={{ fontSize: 11, fontWeight: 800, color: '#FF5B00' }}>{app.applicantType.toUpperCase()}</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600, marginTop: 2 }}>
                        {app.displayName} · {app.email} · {app.category} · {app.city}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void reviewApplication(app.id, 'approve')}
                        style={{
                          height: 36,
                          padding: '0 14px',
                          borderRadius: 8,
                          border: 'none',
                          background: '#059669',
                          color: '#fff',
                          fontSize: 12,
                          fontWeight: 800,
                          cursor: 'pointer',
                          opacity: busy ? 0.6 : 1,
                        }}
                      >
                        {busyKey === `app:${app.id}:approve` ? 'Approving…' : 'Approve'}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void reviewApplication(app.id, 'reject')}
                        style={{
                          height: 36,
                          padding: '0 14px',
                          borderRadius: 8,
                          border: '1px solid #FECACA',
                          background: '#FEF2F2',
                          color: '#B91C1C',
                          fontSize: 12,
                          fontWeight: 800,
                          cursor: 'pointer',
                          opacity: busy ? 0.6 : 1,
                        }}
                      >
                        {busyKey === `app:${app.id}:reject` ? 'Rejecting…' : 'Reject'}
                      </button>
                    </div>
                  </div>
                  {feedback && (
                    <div
                      style={{
                        marginTop: 10,
                        padding: '8px 12px',
                        borderRadius: 8,
                        fontSize: 11.5,
                        fontWeight: 700,
                        background: feedback.type === 'success' ? '#ECFDF5' : '#FEF2F2',
                        color: feedback.type === 'success' ? '#065F46' : '#B91C1C',
                        border: `1px solid ${feedback.type === 'success' ? '#A7F3D0' : '#FECACA'}`,
                      }}
                    >
                      {feedback.message}
                    </div>
                  )}
                </div>
              );
            })
          )}
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
        {!loading && <RoleAnalyticsSummary summary={roleSummary} />}

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
                  background: active ? '#FF5B00' : 'transparent',
                  color: active ? '#fff' : '#374151',
                }}
              >
                {tb.label}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', padding: '24px 0' }}>
            Loading…
          </div>
        ) : roleScope === 'consumer' ? (
          <div
            style={{
              background: '#fff',
              border: '1px solid #E8EDF2',
              borderRadius: 10,
              marginBottom: 16,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '14px 24px',
                background: '#F9FAFB',
                borderBottom: '1px solid #F1F3F5',
                fontSize: 10.5,
                fontWeight: 800,
                color: '#6B7280',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}
            >
              CONSUMER ENTITLEMENTS
            </div>
            <div style={{ padding: '18px 24px' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#111827' }}>
                No configurable Consumer feature entitlements are available yet.
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: '#9CA3AF',
                  fontWeight: 600,
                  marginTop: 2,
                  maxWidth: 600,
                }}
              >
                The live entitlement registry currently covers Seller and Creator commercial features
                only. When consumer keys are added to the registry, they will appear here with the
                same summary, group, and toggle layout.
              </div>
            </div>
          </div>
        ) : (
          groups.map((grp) => (
            <div
              key={grp.title}
              style={{
                background: '#fff',
                border: '1px solid #E8EDF2',
                borderRadius: 10,
                marginBottom: 16,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '14px 24px',
                  background: '#F9FAFB',
                  borderBottom: '1px solid #F1F3F5',
                  fontSize: 10.5,
                  fontWeight: 800,
                  color: '#6B7280',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                }}
              >
                {grp.title}
              </div>
              <div style={{ padding: '0 24px' }}>
                {grp.items.map((feature) => {
                  const enabled = roleDefaults?.[roleScope]?.[feature.key] !== false;
                  const busy = busyKey === `${roleScope}:${feature.key}`;
                  const planRequired = isPlanRequired(feature);

                  return (
                    <FeatureRow
                      key={feature.key}
                      feature={feature}
                      enabled={enabled}
                      busy={busy}
                      planRequired={planRequired}
                      onToggle={() => void toggleFeature(roleScope, feature.key, !enabled)}
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
