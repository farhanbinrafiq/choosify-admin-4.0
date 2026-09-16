import React from 'react';
import { BarChart3, ShieldCheck, Lock, Shield, Users } from 'lucide-react';
import { ChoosifyLogo } from '../common/ChoosifyLogo';

/** Existing approved copy (unchanged wording), moved here from LoginPage's
 *  old composite card so it isn't duplicated once the marketing panel and
 *  the form card are separate page-level columns. */
const VALUE_POINTS = [
  { icon: BarChart3, iconBg: '#FF5B00', title: 'Manage your business', sub: 'Track performance in real-time' },
  { icon: Users, iconBg: '#7A3CFF', title: 'Support your sellers', sub: 'Tools to grow their brand' },
  { icon: Shield, iconBg: '#07A828', title: 'Maintain trust & safety', sub: 'A safer marketplace for everyone' },
];

const TRUST_POINTS = [
  { icon: Lock, title: 'Secure admin access', sub: 'Your account is protected', iconColor: '#FF5B00' },
  { icon: ShieldCheck, title: 'Verified seller ecosystem', sub: 'Only trusted brands', iconColor: '#2323FF' },
  { icon: Shield, title: 'Privacy protected', sub: 'Your data stays private', iconColor: '#07A828' },
];

/**
 * Clean, minimal, white two-column authentication page shell shared by
 * every admin auth surface (Login, Forgot Password, Reset Password, Partner
 * Signup). Replaces the earlier full-bleed blurred-dashboard-preview
 * treatment entirely -- no blur, no dark overlay, no glassmorphism, and no
 * real or simulated authenticated dashboard data anywhere in this
 * unauthenticated route.
 *
 * `children` is the existing, unmodified auth card content -- this shell
 * only controls the page background, two-column layout, spacing and a
 * light card frame around it; it never touches the form's own internal
 * structure.
 *
 * `left`, when provided, replaces the default "Operations Control Center"
 * marketing panel -- used by SellerSignupPage, whose left content is
 * genuinely different (partner/creator-application messaging, not admin
 * staff messaging) even though it shares the same layout/background
 * system. Login/Forgot/Reset Password all use the default.
 *
 * `cardMaxWidthClass`, when provided, overrides the default 420px card
 * width -- SellerSignupPage's existing form is a wider, real two-column
 * application form (unchanged internal layout), so it needs more room
 * than the simple email/password cards; this only changes the *frame*
 * width, never the form's own internal structure/spacing.
 */
export function AdminAuthShell({
  children,
  left,
  cardMaxWidthClass = 'max-w-[420px]',
}: {
  children: React.ReactNode;
  left?: React.ReactNode;
  cardMaxWidthClass?: string;
}) {
  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: 'var(--font-sans)' }}>
      <div className="mx-auto flex min-h-screen w-full max-w-[1400px] flex-col lg:flex-row">
        {/* Left — brand / marketing information */}
        <div className="flex flex-col justify-center border-b border-[#EEF0F4] px-6 py-10 sm:px-10 sm:py-14 lg:w-[46%] lg:border-b-0 lg:border-r lg:px-14 lg:py-16 xl:w-[42%] xl:px-16">
          {left ?? <AdminAuthDefaultMarketing />}
        </div>

        {/* Right — the existing, unmodified auth card */}
        <div className="flex flex-1 items-center justify-center px-6 py-10 sm:px-10 lg:py-16">
          <div
            className={`w-full ${cardMaxWidthClass} rounded-2xl border border-[#EEF0F4] bg-white p-8 shadow-[0_1px_3px_rgba(16,24,40,0.06)] sm:p-9`}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminAuthDefaultMarketing() {
  return (
    <>
      <div className="mb-8">
        <ChoosifyLogo variant="full" theme="light" className="h-9 w-auto max-w-[190px] select-none" />
      </div>
      <span className="mb-4 inline-block w-max rounded-full bg-[rgba(255,90,44,0.1)] px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#FF5B00]">
        Admin Console
      </span>
      <h1
        className="mb-3 text-[28px] font-extrabold leading-tight text-[#111827] sm:text-[32px]"
        style={{ fontFamily: 'var(--font-heading)' }}
      >
        Operations
        <br />
        Control Center
      </h1>
      <p className="mb-2 text-[12.5px] font-bold leading-relaxed text-[#FF5B00]">
        Powering smarter commerce across Choosify.
      </p>
      <p className="mb-7 max-w-[380px] text-[13px] font-semibold leading-relaxed text-[#6B7280]">
        Oversee sellers, products, orders, content and platform trust from one workspace.
      </p>

      <ul className="m-0 mb-7 list-none space-y-4 p-0">
        {VALUE_POINTS.map((v) => {
          const Icon = v.icon;
          return (
            <li key={v.title} className="flex items-start gap-3">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: `${v.iconBg}1a` }}
              >
                <Icon size={16} strokeWidth={2.2} style={{ color: v.iconBg }} />
              </span>
              <div>
                <div className="text-[13.5px] font-bold text-[#111827]">{v.title}</div>
                <div className="text-[11.5px] text-[#9CA3AF]">{v.sub}</div>
              </div>
            </li>
          );
        })}
      </ul>

      <AdminAuthTrustRow />

      <div className="mt-8 text-[10.5px] font-semibold text-[#9CA3AF]">
        <span className="text-[#FF5B00]">©</span> {new Date().getFullYear()}{' '}
        <span className="font-bold text-[#FF5B00]">Choosify Technologies Ltd</span>. All rights reserved.
      </div>
    </>
  );
}

/** Reused as-is by SellerSignupPage's custom left content too, so the trust
 *  row/copyright stays consistent across the whole admin auth family. */
export function AdminAuthTrustRow() {
  return (
    <div className="mt-2 border-t border-[#EEF0F4] pt-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {TRUST_POINTS.map((point) => {
          const Icon = point.icon;
          return (
            <div key={point.title} className="flex items-start gap-2">
              <Icon size={15} strokeWidth={2.1} className="mt-0.5 shrink-0" style={{ color: point.iconColor }} />
              <div>
                <div className="text-[11.5px] font-bold text-[#111827]">{point.title}</div>
                <div className="text-[10.5px] text-[#9CA3AF]">{point.sub}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
