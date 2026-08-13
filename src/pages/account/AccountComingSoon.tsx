import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Construction } from 'lucide-react';

/**
 * LEGACY / DEAD — not mounted.
 * `/admin/account/settings` and `/admin/account/security` redirect to `/admin/settings`.
 */
type AccountComingSoonProps = {
  title: string;
  description: string;
};

export default function AccountComingSoon({ title, description }: AccountComingSoonProps) {
  return (
    <div className="max-w-2xl mx-auto">
      <Link
        to="/admin/dashboard"
        className="inline-flex items-center gap-2 text-[12px] font-bold text-app-text-secondary hover:text-app-accent transition-colors mb-6"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to dashboard
      </Link>

      <div className="rounded-2xl border border-app-border bg-app-card p-8 sm:p-10 shadow-sm">
        <div className="w-12 h-12 rounded-xl bg-[#FFF4ED] text-[#FF5B00] flex items-center justify-center mb-5">
          <Construction className="w-6 h-6" aria-hidden />
        </div>
        <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-app-accent mb-2">Coming Soon</p>
        <h1 className="text-2xl font-extrabold text-app-text-primary mb-3">{title}</h1>
        <p className="text-[14px] leading-relaxed text-app-text-secondary mb-6">{description}</p>
        <p className="text-[12px] text-app-text-secondary">
          The full Account Center will let you manage profile, avatar, email, password, phone, security, sessions,
          notifications, language, and appearance from one place.
        </p>
      </div>
    </div>
  );
}
