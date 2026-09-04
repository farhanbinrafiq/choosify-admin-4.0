import React from 'react';
import { ShieldCheck, KeyRound } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { formatRoleLabel } from '../../lib/userDisplay';
import ChangePasswordForm from '../../components/account/ChangePasswordForm';

/**
 * Self-service account security for every password-authenticated dashboard role.
 * The account acted on is ALWAYS the signed-in session (AuthContext) — this page
 * has no "target user" concept and is never rendered while inspecting someone
 * else's profile. Social login stays Consumer-storefront-only; there is no
 * "set up password via OTP" here.
 */
export default function AccountSecurityPage() {
  const { profile } = useAuth();

  return (
    <div className="max-w-[560px] mx-auto py-8 px-4 text-left">
      <div className="flex items-center gap-2.5 mb-1">
        <ShieldCheck className="w-5 h-5 text-app-accent" />
        <h1 className="text-[18px] font-extrabold text-app-text-primary">Account Security</h1>
      </div>
      <p className="text-[12.5px] text-app-text-secondary mb-6">
        Manage the password for your own account
        {profile?.email ? (
          <>
            {' '}
            (<span className="text-app-text-primary font-semibold">{profile.email}</span>,{' '}
            {formatRoleLabel(profile.role)})
          </>
        ) : null}
        .
      </p>

      <div className="bg-app-card border border-app-border rounded-[10px] p-6 shadow-xl">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-app-border">
          <KeyRound className="w-4 h-4 text-app-accent" />
          <h2 className="text-[13px] font-bold text-app-text-primary uppercase tracking-wider">Change password</h2>
        </div>

        <div className="mb-5 flex items-center gap-3">
          <span className="text-[15px] tracking-[0.25em] text-app-text-primary">••••••••••••</span>
          <span className="text-[10px] font-semibold text-app-text-secondary">Your password is never shown.</span>
        </div>

        <ChangePasswordForm />
      </div>

      <p className="mt-4 text-[11px] text-app-text-secondary leading-relaxed">
        Forgot your current password? Sign out and use <span className="font-semibold">Forgot password</span> on the sign-in
        screen to receive a reset link. Changing your password here keeps you signed in on this device and does not affect
        your other sessions.
      </p>
    </div>
  );
}
