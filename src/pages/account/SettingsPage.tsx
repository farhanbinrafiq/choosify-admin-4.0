import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowUpRight,
  Bell,
  KeyRound,
  Loader2,
  LogOut,
  Settings as SettingsIcon,
  ShieldCheck,
  SlidersHorizontal,
  UserCircle,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { formatRoleLabel, getAvatarUrl, getMyProfilePath } from '../../lib/userDisplay';
import ChangePasswordForm from '../../components/account/ChangePasswordForm';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  type NotificationPreferences,
} from '../../services/notificationsApi';

/**
 * Settings — the signed-in person's own account behaviour, security and
 * preferences. Identity (name, photo, bio, business/creator profile) stays on
 * the role's Profile page; platform-wide configuration stays in its dedicated
 * Admin modules. Every control here is backed end-to-end:
 *  - Security reuses the one ChangePasswordForm (POST /auth/change-password)
 *    and POST /auth/sessions/revoke-others.
 *  - Notifications read/write GET/PUT /api/notifications/preferences, which
 *    createNotification enforces per persona + event. In-app only — no other
 *    channel has a real delivery provider, so none is offered.
 * Deliberately absent (no backend yet): email/WhatsApp/push switches, 2FA,
 * messaging sound/away status, account closure, data export, store payment policy.
 */

type SectionKey = 'general' | 'security' | 'notifications' | 'admin' | 'creator';

const API_BASE = ((import.meta as any).env?.VITE_API_BASE_URL as string | undefined) || '/api/v1';
const AUTH_TOKEN_KEY = 'choosify_auth_token';
const ADMIN_ROLES = new Set(['admin', 'super_admin']);

const GROUP_LABEL: Record<string, string> = {
  orders: 'Orders & bookings',
  after_sales: 'Returns & warranty',
  engagement: 'Reviews & messages',
  account: 'Account',
  platform: 'From Choosify',
  staff: 'Staff queues',
};

const card = 'bg-app-card border border-app-border rounded-xl p-5';
const sectionTitle = 'flex items-center gap-2 mb-1 text-[13px] font-extrabold text-app-text-primary';
const sectionHint = 'text-[11.5px] text-app-text-secondary mb-4';

function isImpersonating(): boolean {
  try {
    return Boolean(localStorage.getItem('choosify_impersonation_original_token'));
  } catch {
    return false;
  }
}

function PreferenceSwitch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange?: () => void;
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
      className="relative shrink-0 rounded-full border-0 p-0 transition-colors disabled:cursor-not-allowed"
      style={{
        width: 38,
        height: 22,
        background: checked ? '#EF3C23' : '#D1D5DB',
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <span
        className="absolute top-[3px] rounded-full bg-white shadow transition-all"
        style={{ width: 16, height: 16, left: checked ? 19 : 3 }}
      />
    </button>
  );
}

function DeepLinkCard({ to, title, body }: { to: string; title: string; body: string }) {
  return (
    <Link
      to={to}
      className="group flex items-start justify-between gap-3 rounded-lg border border-app-border bg-app-card p-4 no-underline hover:border-[#EF3C23]/40 transition-colors"
    >
      <div className="min-w-0">
        <div className="text-[12.5px] font-bold text-app-text-primary">{title}</div>
        <div className="text-[11px] text-app-text-secondary mt-0.5">{body}</div>
      </div>
      <ArrowUpRight className="w-4 h-4 shrink-0 text-[#9CA3AF] group-hover:text-[#EF3C23]" />
    </Link>
  );
}

// ── General ──────────────────────────────────────────────────────────────────
function GeneralSection() {
  const { profile } = useAuth();
  if (!profile) return null;
  const displayName = profile.displayName?.trim() || profile.email?.trim() || 'User';
  const avatar = getAvatarUrl(profile);
  const profilePath = getMyProfilePath(profile);
  return (
    <div className={card}>
      <div className={sectionTitle}>
        <UserCircle className="w-4 h-4 text-app-accent" /> Account
      </div>
      <p className={sectionHint}>Your identity is managed on your profile — Settings only shows it.</p>
      <div className="flex flex-wrap items-center gap-4">
        <img src={avatar} alt="" className="w-14 h-14 rounded-full object-cover border border-app-border" />
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-extrabold text-app-text-primary truncate">{displayName}</div>
          <div className="text-[12px] text-app-text-secondary truncate">{profile.email || '—'}</div>
          <span className="inline-block mt-1.5 rounded-full bg-[#EF3C23]/10 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-[#EF3C23]">
            {formatRoleLabel(profile.role)}
          </span>
        </div>
        <Link
          to={profilePath}
          className="inline-flex items-center gap-1.5 rounded-lg border border-app-border px-3 py-2 text-[11.5px] font-bold text-app-text-primary no-underline hover:border-[#EF3C23]/40"
        >
          Edit in Profile <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}

// ── Security ─────────────────────────────────────────────────────────────────
function SignOutOtherDevices() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const impersonating = isImpersonating();

  const run = async () => {
    if (!window.confirm('Sign out of Choosify on all your other devices? This device stays signed in.')) return;
    setBusy(true);
    setResult(null);
    try {
      const token = localStorage.getItem(AUTH_TOKEN_KEY);
      const res = await fetch(`${API_BASE}/auth/sessions/revoke-others`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        credentials: 'include',
      });
      const body = (await res.json().catch(() => ({}))) as { revoked?: number; error?: string };
      if (!res.ok) throw new Error(body.error || 'Unable to sign out other devices');
      const n = body.revoked ?? 0;
      setResult({
        ok: true,
        text:
          n === 0
            ? 'No other active sessions were found.'
            : `Signed out ${n} other session${n === 1 ? '' : 's'}. Those devices can’t renew their sign-in; any page already open there stops working within 15 minutes.`,
      });
    } catch (error) {
      setResult({ ok: false, text: error instanceof Error ? error.message : 'Unable to sign out other devices' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={card}>
      <div className={sectionTitle}>
        <LogOut className="w-4 h-4 text-app-accent" /> Other devices
      </div>
      <p className={sectionHint}>End every session except the one you are using now.</p>
      <button
        type="button"
        onClick={run}
        disabled={busy || impersonating}
        className="inline-flex items-center gap-2 rounded-lg border border-app-border bg-app-card px-3.5 py-2 text-[12px] font-bold text-app-text-primary hover:border-[#EF3C23]/40 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
        Sign out other devices
      </button>
      {impersonating ? (
        <p className="mt-2 text-[11px] text-app-text-secondary">Unavailable during Admin impersonation.</p>
      ) : null}
      {result ? (
        <p role="status" className={`mt-3 text-[11.5px] font-semibold ${result.ok ? 'text-emerald-700' : 'text-red-600'}`}>
          {result.text}
        </p>
      ) : null}
    </div>
  );
}

function SecuritySection() {
  return (
    <div className="space-y-4">
      <div className={card}>
        <div className={sectionTitle}>
          <KeyRound className="w-4 h-4 text-app-accent" /> Change password
        </div>
        <p className={sectionHint}>Your current password is verified before the change is saved.</p>
        <ChangePasswordForm />
        <p className="mt-3 text-[11px] text-app-text-secondary leading-relaxed">
          Forgot your current password? Sign out and use <span className="font-semibold">Forgot password</span> on the
          sign-in screen to receive a reset link.
        </p>
      </div>
      <SignOutOtherDevices />
    </div>
  );
}

// ── Notifications ────────────────────────────────────────────────────────────
function NotificationsSection({ onDirtyChange }: { onDirtyChange: (dirty: boolean) => void }) {
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [draft, setDraft] = useState<Record<string, boolean>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const next = await getNotificationPreferences();
      setPrefs(next);
      setDraft(Object.fromEntries(next.events.map((e) => [e.key, e.enabled])));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load notification preferences');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const changes = useMemo(() => {
    if (!prefs) return {};
    return Object.fromEntries(
      prefs.events.filter((e) => draft[e.key] !== e.enabled).map((e) => [e.key, draft[e.key]]),
    ) as Record<string, boolean>;
  }, [prefs, draft]);
  const dirty = Object.keys(changes).length > 0;
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const save = async () => {
    if (!prefs || !dirty) return;
    setSaving(true);
    setMessage(null);
    try {
      const next = await updateNotificationPreferences({ persona: prefs.persona, inApp: changes });
      setPrefs(next);
      setDraft(Object.fromEntries(next.events.map((e) => [e.key, e.enabled])));
      setMessage({ ok: true, text: 'Notification preferences saved.' });
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : 'Could not save preferences' });
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    if (!prefs) return;
    setDraft(Object.fromEntries(prefs.events.map((e) => [e.key, e.enabled])));
    setMessage(null);
  };

  if (loadError) {
    return (
      <div className={card}>
        <p className="text-[12px] font-semibold text-red-600">{loadError}</p>
        <button type="button" onClick={() => void load()} className="mt-3 text-[12px] font-bold text-[#EF3C23]">
          Retry
        </button>
      </div>
    );
  }
  if (!prefs) {
    return (
      <div className={`${card} flex items-center gap-2 text-[12px] text-app-text-secondary`}>
        <Loader2 className="w-4 h-4 animate-spin" /> Loading notification preferences…
      </div>
    );
  }

  const groups = Array.from(new Set(prefs.events.map((e) => e.group)));
  return (
    <div className="space-y-4">
      <div className={card}>
        <div className={sectionTitle}>
          <Bell className="w-4 h-4 text-app-accent" /> In-app notifications
        </div>
        <p className={sectionHint}>
          Choose which notifications appear in your Choosify notification center. These choices apply to your{' '}
          <span className="font-semibold">{formatRoleLabel(prefs.persona)}</span> account only.
        </p>
        {groups.length === 0 ? (
          <p className="text-[12px] text-app-text-secondary">There are no optional notifications for your account.</p>
        ) : (
          <div className="space-y-5">
            {groups.map((group) => (
              <div key={group}>
                <div className="text-[9.5px] font-extrabold uppercase tracking-wider text-[#9CA3AF] mb-2">
                  {GROUP_LABEL[group] || group}
                </div>
                <div className="divide-y divide-app-border border border-app-border rounded-lg">
                  {prefs.events
                    .filter((e) => e.group === group)
                    .map((e) => (
                      <div key={e.key} className="flex items-center justify-between gap-4 px-3.5 py-3">
                        <div className="min-w-0">
                          <div className="text-[12.5px] font-bold text-app-text-primary">{e.label}</div>
                          <div className="text-[11px] text-app-text-secondary">{e.description}</div>
                        </div>
                        <PreferenceSwitch
                          label={e.label}
                          checked={draft[e.key] !== false}
                          disabled={saving}
                          onChange={() => setDraft((d) => ({ ...d, [e.key]: !(d[e.key] !== false) }))}
                        />
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="mt-5 flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={save}
            disabled={!dirty || saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#EF3C23] px-4 py-2 text-[12px] font-extrabold text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            Save changes
          </button>
          <button
            type="button"
            onClick={cancel}
            disabled={!dirty || saving}
            className="rounded-lg border border-app-border px-4 py-2 text-[12px] font-bold text-app-text-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          {dirty ? <span className="text-[11px] font-semibold text-amber-700">Unsaved changes</span> : null}
          {message ? (
            <span role="status" className={`text-[11.5px] font-semibold ${message.ok ? 'text-emerald-700' : 'text-red-600'}`}>
              {message.text}
            </span>
          ) : null}
        </div>
      </div>

      {prefs.mandatoryEvents.length ? (
        <div className={card}>
          <div className={sectionTitle}>
            <ShieldCheck className="w-4 h-4 text-app-accent" /> Always delivered
          </div>
          <p className={sectionHint}>Security, account and critical order notifications can’t be switched off.</p>
          <ul className="space-y-2 m-0 p-0 list-none">
            {prefs.mandatoryEvents.map((e) => (
              <li key={e.key} className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-[12.5px] font-bold text-app-text-primary">{e.label}</div>
                  <div className="text-[11px] text-app-text-secondary">{e.description}</div>
                </div>
                <PreferenceSwitch label={`${e.label} (always on)`} checked disabled />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="text-[11px] text-app-text-secondary">
        Email, SMS, WhatsApp and push notification settings will appear here once those channels are available.
      </p>
    </div>
  );
}

// ── Role-specific links (configuration lives in its own module) ─────────────
function AdminSection() {
  return (
    <div className={card}>
      <div className={sectionTitle}>
        <SlidersHorizontal className="w-4 h-4 text-app-accent" /> Admin preferences
      </div>
      <p className={sectionHint}>
        Platform configuration is managed in its dedicated modules, not in your personal Settings.
      </p>
      <div className="grid gap-2.5 sm:grid-cols-2">
        <DeepLinkCard to="/admin/brand-verification" title="Verification Center" body="Verification policy and reviews" />
        <DeepLinkCard to="/admin/fee-charges" title="Fee & Charges Engine" body="Fees and payment policies" />
        <DeepLinkCard to="/admin/promotions" title="Subscription Plans" body="Plans, pricing and limits" />
        <DeepLinkCard to="/admin/feature-access" title="Feature Access & Entitlements" body="Who can use which features" />
        <DeepLinkCard to="/admin/moderation" title="Moderation Center" body="Content and review moderation" />
      </div>
    </div>
  );
}

function CreatorSection() {
  return (
    <div className={card}>
      <div className={sectionTitle}>
        <SlidersHorizontal className="w-4 h-4 text-app-accent" /> Creator
      </div>
      <p className={sectionHint}>Your creator profile, content and payouts are managed in their own workspaces.</p>
      <div className="grid gap-2.5 sm:grid-cols-2">
        <DeepLinkCard to="/admin/creator-studio" title="Creator Studio" body="Your public creator profile" />
        <DeepLinkCard to="/admin/guides" title="Guide Management" body="Draft, review and publish guides" />
        <DeepLinkCard to="/admin/payouts" title="Payouts / Withdrawals" body="Payout requests and destinations" />
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [notificationsDirty, setNotificationsDirty] = useState(false);
  const role = String(profile?.role || '').toLowerCase();

  const sections = useMemo(() => {
    const list: Array<{ key: SectionKey; label: string }> = [
      { key: 'general', label: 'General' },
      { key: 'security', label: 'Security' },
      { key: 'notifications', label: 'Notifications' },
    ];
    if (ADMIN_ROLES.has(role)) list.push({ key: 'admin', label: 'Admin Preferences' });
    if (role === 'creator') list.push({ key: 'creator', label: 'Creator' });
    return list;
  }, [role]);

  const requested = searchParams.get('section') as SectionKey | null;
  const active: SectionKey = sections.some((s) => s.key === requested) ? (requested as SectionKey) : 'general';

  // Unsaved-change protection: leaving the page or switching section with an
  // unsaved notifications draft asks first.
  useEffect(() => {
    if (!notificationsDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [notificationsDirty]);

  const onDirtyChange = useCallback((dirty: boolean) => setNotificationsDirty(dirty), []);

  const selectSection = (key: SectionKey) => {
    if (key === active) return;
    if (active === 'notifications' && notificationsDirty) {
      if (!window.confirm('You have unsaved notification changes. Leave without saving?')) return;
      setNotificationsDirty(false);
    }
    setSearchParams(key === 'general' ? {} : { section: key }, { replace: true });
  };

  if (!profile) return null; // ProtectedRoute already guards this route

  return (
    <div className="max-w-[980px] mx-auto py-8 px-4 text-left">
      <div className="flex items-center gap-2.5 mb-1">
        <SettingsIcon className="w-5 h-5 text-app-accent" />
        <h1 className="text-[18px] font-extrabold text-app-text-primary m-0">Settings</h1>
      </div>
      <p className="text-[12.5px] text-app-text-secondary mb-6">
        Manage your account security and notification preferences.
      </p>

      <div className="flex flex-col md:flex-row gap-5">
        <nav aria-label="Settings sections" className="md:w-[200px] shrink-0">
          <div className="flex md:flex-col gap-1 overflow-x-auto pb-1 md:pb-0">
            {sections.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => selectSection(s.key)}
                aria-current={active === s.key ? 'page' : undefined}
                className={`whitespace-nowrap rounded-lg px-3 py-2 text-left text-[12.5px] font-bold transition-colors ${
                  active === s.key
                    ? 'bg-[#EF3C23]/10 text-[#EF3C23]'
                    : 'text-app-text-secondary hover:bg-black/5 hover:text-app-text-primary'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </nav>
        <div className="min-w-0 flex-1">
          {active === 'general' ? <GeneralSection /> : null}
          {active === 'security' ? <SecuritySection /> : null}
          {active === 'notifications' ? <NotificationsSection onDirtyChange={onDirtyChange} /> : null}
          {active === 'admin' ? <AdminSection /> : null}
          {active === 'creator' ? <CreatorSection /> : null}
        </div>
      </div>
    </div>
  );
}
