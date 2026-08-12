import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { KeyRound, ShieldCheck, UserPlus } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { AdminWorkspaceLayout } from '../../components/Layout/AdminWorkspaceLayout';
import type { PartnerFeatureDef, PartnerRole } from '../../../shared/entitlements/registry';

const AUTH_TOKEN_KEY = 'choosify_auth_token';
const API_BASE = '/api/v1';

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

function authHeaders(): HeadersInit {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

const Toggle = ({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    onClick={onChange}
    className="relative shrink-0 cursor-pointer transition-colors duration-200 disabled:opacity-50"
    style={{
      width: 38,
      height: 22,
      borderRadius: 11,
      backgroundColor: checked ? 'var(--color-accent-primary, #FF5B00)' : '#D1D5DB',
    }}
  >
    <span
      className="absolute top-0.5 bg-white rounded-full transition-all duration-200"
      style={{ width: 16, height: 16, left: checked ? 20 : 2 }}
    />
  </button>
);

/**
 * Admin-only Feature Access & Entitlements.
 * Controls Seller/Creator commercial feature availability — never Admin RBAC modules.
 * Disabling a feature blocks access only; feature-owned data is never deleted.
 */
export default function FeatureAccessEntitlementsPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';

  const [tab, setTab] = useState<'seller' | 'creator' | 'applications'>('seller');
  const [catalog, setCatalog] = useState<PartnerFeatureDef[]>([]);
  const [roleDefaults, setRoleDefaults] = useState<RoleDefaults | null>(null);
  const [applications, setApplications] = useState<PartnerApplicationRow[]>([]);
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
      if (!entRes.ok) throw new Error(entBody.error || 'Unable to load entitlements');
      setCatalog(entBody.catalog || []);
      setRoleDefaults(entBody.roleDefaults || null);
      if (appRes.ok) setApplications(appBody.applications || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin, load]);

  const featuresForTab = useMemo(() => {
    if (tab !== 'seller' && tab !== 'creator') return [];
    return catalog.filter((f) => f.roles.includes(tab));
  }, [catalog, tab]);

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
        note?: string;
      };
      if (!res.ok) throw new Error(body.error || 'Update failed');
      if (body.roleDefaults) setRoleDefaults(body.roleDefaults);
      showToast(
        enabled
          ? `${featureKey} enabled for ${role} — prior data remains intact.`
          : `${featureKey} access disabled for ${role} — data preserved.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Toggle failed');
    } finally {
      setBusyKey(null);
    }
  };

  const reviewApplication = async (id: string, action: 'approve' | 'reject') => {
    setBusyKey(`app:${id}`);
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
      showToast(action === 'approve' ? 'Partner provisioned.' : 'Application rejected.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Review failed');
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
      pageSubtitle="Control Seller and Creator dashboard feature availability. Disabling access never deletes data."
    >
      <div className="p-6 max-w-5xl mx-auto">
        {toast && (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[13px] text-emerald-800">
            {toast}
          </div>
        )}
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-[13px] text-red-700">
            {error}
          </div>
        )}

        <div className="mb-5 rounded-xl border border-app-border bg-white p-4 flex gap-3 items-start">
          <ShieldCheck className="w-5 h-5 text-[#FF5B00] shrink-0 mt-0.5" />
          <div>
            <p className="text-[13px] font-extrabold text-app-text-primary">
              Partner commercial entitlements only
            </p>
            <p className="text-[12px] font-semibold text-app-text-muted mt-1 leading-relaxed">
              Admin modules stay on existing RBAC. Precedence model (ready for plans): account
              override → plan default → role default. This screen manages global role defaults.
            </p>
          </div>
        </div>

        <div className="flex gap-2 mb-5 flex-wrap">
          {(
            [
              { id: 'seller', label: 'Seller defaults', icon: KeyRound },
              { id: 'creator', label: 'Creator defaults', icon: KeyRound },
              { id: 'applications', label: 'Partner applications', icon: UserPlus },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 px-3.5 h-9 rounded-lg text-[12px] font-bold border transition-colors ${
                tab === t.id
                  ? 'bg-[#FF5B00] text-white border-[#FF5B00]'
                  : 'bg-white text-app-text-muted border-app-border hover:border-[#FF5B00]/40'
              }`}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-[12px] font-semibold text-app-text-muted py-10">Loading…</div>
        ) : tab === 'applications' ? (
          <div className="rounded-xl border border-app-border bg-white overflow-hidden">
            {applications.length === 0 ? (
              <div className="p-8 text-[13px] font-semibold text-app-text-muted">
                No pending partner applications.
              </div>
            ) : (
              <ul className="divide-y divide-app-border">
                {applications.map((app) => (
                  <li key={app.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                    <div>
                      <p className="text-[13px] font-extrabold text-app-text-primary">
                        {app.businessOrChannelName}{' '}
                        <span className="text-[11px] font-bold text-[#FF5B00] uppercase">
                          {app.applicantType}
                        </span>
                      </p>
                      <p className="text-[12px] font-semibold text-app-text-muted mt-0.5">
                        {app.displayName} · {app.email} · {app.category} · {app.city}
                        {app.niche ? ` · ${app.niche}` : ''}
                      </p>
                      <p className="text-[10px] font-semibold text-app-text-disabled mt-1">
                        {new Date(app.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={busyKey === `app:${app.id}`}
                        onClick={() => void reviewApplication(app.id, 'approve')}
                        className="h-9 px-3.5 rounded-lg text-[12px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={busyKey === `app:${app.id}`}
                        onClick={() => void reviewApplication(app.id, 'reject')}
                        className="h-9 px-3.5 rounded-lg text-[12px] font-bold text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 disabled:opacity-60"
                      >
                        Reject
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-app-border bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-app-border flex items-center justify-between gap-3">
              <p className="text-[12px] font-bold text-app-text-muted uppercase tracking-wide">
                {tab === 'seller' ? 'Seller / Brand' : 'Creator'} role defaults
              </p>
              <span className="text-[10px] font-bold text-app-text-disabled uppercase tracking-wide">
                Future: plans · account overrides · premium locks
              </span>
            </div>
            <ul className="divide-y divide-app-border">
              {featuresForTab.map((feature) => {
                const enabled = roleDefaults?.[tab]?.[feature.key] !== false;
                const busy = busyKey === `${tab}:${feature.key}`;
                return (
                  <li key={feature.key} className="px-4 py-3.5 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-[13px] font-extrabold text-app-text-primary">{feature.label}</p>
                      <p className="text-[11px] font-semibold text-app-text-muted mt-0.5">
                        {feature.description}
                      </p>
                      {feature.pageKeys.length > 0 && (
                        <p className="text-[10px] font-semibold text-app-text-disabled mt-1">
                          Pages: {feature.pageKeys.join(', ')}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-[10px] font-extrabold uppercase tracking-wide ${
                          enabled ? 'text-emerald-600' : 'text-app-text-disabled'
                        }`}
                      >
                        {enabled ? 'Enabled' : 'Access off'}
                      </span>
                      <Toggle
                        checked={enabled}
                        disabled={busy}
                        onChange={() => void toggleFeature(tab, feature.key, !enabled)}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </AdminWorkspaceLayout>
  );
}
