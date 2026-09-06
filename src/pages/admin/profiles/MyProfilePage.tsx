import React, { useState } from 'react';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { formatRoleLabel, getAvatarUrl, getUserInitials } from '../../../lib/userDisplay';
import ChangePasswordForm from '../../../components/account/ChangePasswordForm';

/**
 * Canonical self-profile page for every non-partner dashboard role (Super
 * Admin, Admin, and the other internal staff roles — moderator, finance
 * manager, support agent, marketing manager). This is the ONE destination
 * both the left-nav "My Profile" entry and the top-right avatar dropdown's
 * "My Profile" item navigate to (see lib/userDisplay.getMyProfilePath).
 *
 * This replaces the legacy CMS-mirror iframe's "adminProfile" page — that
 * page rendered inside a completely separate shell (a different, more
 * limited internal sidebar baked into public/cms-mirror/app.html), which is
 * why opening it used to make the modern dashboard nav appear to vanish.
 * Rendering natively here means it stays inside AdminWorkspaceLayout like
 * every other current dashboard page.
 *
 * Content below is a faithful port of the legacy page's own tabs — nothing
 * added, nothing invented. The legacy page's own copy documented exactly
 * what's real (Account Information, the Change Password flow) and what
 * isn't (2FA "Not implemented", no per-user audit API, notification
 * checkboxes with no persistence) — that honesty is preserved as-is. The
 * one genuine improvement: Security embeds the actual ChangePasswordForm
 * component (the same one AccountSecurityPage already uses) instead of the
 * legacy page's plain link-out text, which is reuse of existing business
 * logic, not new functionality.
 */

type TabKey = 'account' | 'security' | 'activity' | 'permissions' | 'notifications';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'account', label: 'Account Information' },
  { key: 'security', label: 'Security & Sessions' },
  { key: 'activity', label: 'Activity Log' },
  { key: 'permissions', label: 'Permissions & Role' },
  { key: 'notifications', label: 'Notification Preferences' },
];

function KpiTile({ label, value, sub, valueClassName }: { label: string; value: string; sub: string; valueClassName?: string }) {
  return (
    <div className="bg-app-card border border-app-border rounded-xl p-4">
      <div className="text-[9.5px] font-extrabold text-[#9CA3AF] tracking-wide uppercase">{label}</div>
      <div className={`text-[19px] font-extrabold mt-1 ${valueClassName || 'text-app-text-primary'}`}>{value}</div>
      <div className="text-[10.5px] text-app-text-secondary font-semibold mt-1">{sub}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] font-extrabold text-[#9CA3AF] tracking-wide">{label}</div>
      <div className="text-[12.5px] font-bold text-app-text-primary mt-1">{value}</div>
    </div>
  );
}

export default function MyProfilePage() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<TabKey>('account');

  if (!profile) return null; // ProtectedRoute already guards this route

  const displayName = profile.displayName?.trim() || profile.email?.trim() || 'User';
  const email = profile.email?.trim() || '—';
  const roleLabel = formatRoleLabel(profile.role);
  const initials = getUserInitials(displayName, email);
  const avatarUrl = getAvatarUrl(profile);
  const hasRealPhoto = Boolean(profile.avatar?.trim());
  const handle = profile.username
    ? `@${profile.username.replace(/^@/, '')}`
    : `@${displayName.toLowerCase().replace(/\s+/g, '_').slice(0, 24)}`;
  const cfId = profile.choosifyUserId || '—';

  return (
    <div className="space-y-5 pb-10">
      <div>
        <h1 className="text-xl font-bold text-app-text-primary tracking-tight">My Profile</h1>
        <p className="text-[12.5px] text-app-text-secondary mt-1">
          Account, security, and preferences for your own Choosify account.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiTile label="Last Login" value="Today" sub="This browser session" />
        <KpiTile label="Active Sessions" value="1" sub="Current device" valueClassName="text-blue-600" />
        <KpiTile label="Account Status" value="Active" sub={roleLabel} valueClassName="text-emerald-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-5 items-start">
        <div className="bg-app-card border border-app-border rounded-xl overflow-hidden">
          <div className="h-14" style={{ background: 'linear-gradient(90deg, #18154C, #EF3C23)' }} />
          <div className="p-4 -mt-9">
            <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-white shadow bg-[#EFF6FF] flex items-center justify-center text-[#2563EB] font-extrabold text-[15px]">
              {hasRealPhoto ? (
                <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <span>{initials}</span>
              )}
            </div>
            <div className="mt-2.5 text-[13.5px] font-extrabold text-app-text-primary truncate">{displayName}</div>
            <div className="text-[11px] font-bold text-blue-600 mt-0.5 truncate">{handle}</div>
            <span className="inline-flex items-center gap-1.5 mt-2.5 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-emerald-700">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Active
            </span>
            <div className="mt-4 space-y-2.5">
              <div>
                <div className="text-[9px] font-extrabold text-[#9CA3AF] tracking-wide">ROLE</div>
                <div className="text-[11.5px] font-bold text-app-text-primary mt-0.5">{roleLabel}</div>
              </div>
              <div className="border-t border-app-border pt-2.5">
                <div className="text-[9px] font-extrabold text-[#9CA3AF] tracking-wide">CHOOSIFY USER ID</div>
                <div className="text-[11.5px] font-bold text-app-text-primary mt-0.5 font-mono">{cfId}</div>
              </div>
              <div className="border-t border-app-border pt-2.5">
                <div className="text-[9px] font-extrabold text-[#9CA3AF] tracking-wide">EMAIL</div>
                <div className="text-[11.5px] font-bold text-app-text-primary mt-0.5 truncate">{email}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="min-w-0">
          <div className="flex gap-1 border-b border-app-border mb-4 flex-wrap">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`px-3.5 py-2.5 text-[12px] font-extrabold border-b-2 -mb-px transition-colors cursor-pointer ${
                  tab === t.key
                    ? 'text-app-accent border-app-accent'
                    : 'text-app-text-secondary border-transparent hover:text-app-text-primary'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'account' && (
            <div className="bg-app-card border border-app-border rounded-xl p-5 space-y-4">
              <div className="bg-app-bg border border-app-border rounded-lg p-3.5">
                <div className="text-[9px] font-extrabold text-[#9CA3AF] tracking-wide">CHOOSIFY USER ID</div>
                <div className="text-[13px] font-extrabold text-app-text-primary mt-1 font-mono">{cfId}</div>
                <div className="text-[10px] text-[#9CA3AF] font-semibold mt-1">
                  Permanent account reference — not editable.
                </div>
              </div>
              <div>
                <div className="text-[13px] font-extrabold text-app-text-primary mb-3">Account Information</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="DISPLAY NAME" value={displayName} />
                  <Field label="USERNAME" value={handle} />
                  <Field label="EMAIL" value={email} />
                  <Field label="ROLE" value={roleLabel} />
                </div>
              </div>
              <p className="text-[11px] text-app-text-secondary leading-relaxed">
                Profile photo is managed from the avatar menu in the top bar. Role and Choosify User ID are not
                self-editable.
              </p>
            </div>
          )}

          {tab === 'security' && (
            <div className="bg-app-card border border-app-border rounded-xl p-5 space-y-5">
              <div>
                <div className="flex items-center gap-2 mb-3.5 pb-2.5 border-b border-app-border">
                  <KeyRound className="w-4 h-4 text-app-accent" />
                  <h2 className="text-[13px] font-bold text-app-text-primary uppercase tracking-wide">
                    Change password
                  </h2>
                </div>
                <ChangePasswordForm />
              </div>
              <div className="border-t border-app-border pt-4 flex items-center justify-between flex-wrap gap-2">
                <span className="text-[12px] font-semibold text-app-text-secondary">Two-Factor Authentication</span>
                <span className="text-[10px] font-extrabold uppercase tracking-wide bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-0.5 rounded-full">
                  Not implemented
                </span>
              </div>
              <div className="border border-app-border rounded-lg p-3.5">
                <div className="text-[9px] font-extrabold text-[#9CA3AF] tracking-wide">CURRENT SESSION</div>
                <div className="text-[12.5px] font-bold text-app-text-primary mt-1">This browser</div>
              </div>
            </div>
          )}

          {tab === 'activity' && (
            <div className="bg-app-card border border-app-border rounded-xl p-5">
              <div className="text-[13px] font-extrabold text-app-text-primary mb-2">Activity Log</div>
              <p className="text-[12px] text-app-text-secondary">
                No admin-safe per-user audit retrieval API is available in this build.
              </p>
            </div>
          )}

          {tab === 'permissions' && (
            <div className="bg-app-card border border-app-border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck className="w-4 h-4 text-app-accent" />
                <div className="text-[13px] font-extrabold text-app-text-primary">Permissions &amp; Role</div>
              </div>
              <p className="text-[12px] text-app-text-secondary mb-2">
                Effective role: <span className="font-extrabold text-app-text-primary">{roleLabel}</span>
              </p>
              <p className="text-[12px] text-app-text-secondary">
                RBAC scopes are assigned by Super Admin. Login As User is not available on your own profile.
              </p>
            </div>
          )}

          {tab === 'notifications' && (
            <div className="bg-app-card border border-app-border rounded-xl p-5 space-y-3.5">
              <div className="text-[13px] font-extrabold text-app-text-primary mb-1">Notification Preferences</div>
              <label className="flex items-center gap-2.5 text-[12px] font-semibold text-app-text-primary">
                <input type="checkbox" className="w-4 h-4" />
                Email Alerts
              </label>
              <label className="flex items-center gap-2.5 text-[12px] font-semibold text-app-text-primary">
                <input type="checkbox" className="w-4 h-4" />
                WhatsApp Notifications
              </label>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
