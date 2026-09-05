import React from 'react';
import { ChoosifyLogo } from '../common/ChoosifyLogo';

/**
 * Lighter-weight member of the approved Admin/Partner auth design family
 * (see LoginPage.tsx): the same navy `choosify-dark-surface` ground with soft
 * ambient lighting, the Choosify wordmark, one white card, and the
 * `btn-brand-gradient` primary CTA. Used by the dashboard Forgot Password and
 * Reset Password screens so they don't fall back to a generic form.
 */
export function AdminAuthCard({
  kicker = 'Admin Console',
  title,
  intro,
  children,
  footer,
}: {
  kicker?: string;
  title: string;
  intro?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div
      className="choosify-dark-surface relative flex min-h-screen items-center justify-center overflow-hidden p-6"
      style={{ fontFamily: 'var(--font-sans)' }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -left-[12%] -top-[10%] h-[560px] w-[560px] rounded-full bg-[#5A1230]/25 blur-[170px]" />
        <div className="absolute left-1/2 top-1/2 h-[520px] w-[760px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#7A3CFF]/10 blur-[180px]" />
        <div className="absolute -right-[10%] -bottom-[8%] h-[540px] w-[540px] rounded-full bg-[#FF5B00]/10 blur-[170px]" />
        <div className="auth-admin-grid absolute inset-0 hidden opacity-60 xl:block" />
        <div className="auth-admin-vignette absolute inset-0" />
      </div>

      <div
        className="relative w-full max-w-[420px] overflow-hidden rounded-[16px] border border-white/12 bg-white"
        style={{ boxShadow: '0 30px 80px rgba(0,0,0,0.45)' }}
      >
        <div className="border-b border-[#EEF0F4] px-9 pt-9 pb-6">
          <ChoosifyLogo variant="full" theme="light" className="mb-5 h-8 w-auto max-w-[170px] select-none" />
          <span className="mb-3 inline-block rounded-full bg-[rgba(255,90,44,0.12)] px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#FF5B00]">
            {kicker}
          </span>
          <h1 className="text-[20px] font-extrabold leading-tight text-[#111827]">{title}</h1>
          {intro ? <p className="mt-1.5 text-[12.5px] font-semibold leading-relaxed text-[#6B7280]">{intro}</p> : null}
        </div>
        <div className="px-9 py-7">{children}</div>
        {footer ? (
          <div className="border-t border-[#EEF0F4] px-9 py-4 text-center text-[11px] font-semibold text-[#6B7280]">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** `#F8F9FC` field with an `#E8EDF2` border — matches the LoginPage inputs. */
export function AdminAuthInput({
  icon: Icon,
  rightSlot,
  label,
  id,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  icon?: React.ComponentType<{ className?: string }>;
  rightSlot?: React.ReactNode;
  label: string;
  id: string;
}) {
  return (
    <div className="mb-[18px]">
      <label htmlFor={id} className="mb-1.5 block text-[10px] font-extrabold tracking-wide text-[#6B7280]">
        {label}
      </label>
      <div className="flex h-11 items-center gap-2 rounded-lg border border-[#E8EDF2] bg-[#F8F9FC] px-3.5">
        {Icon ? <Icon className="h-3.5 w-3.5 shrink-0 text-[#9CA3AF]" /> : null}
        <input
          id={id}
          {...props}
          className="flex-1 border-0 bg-transparent text-[13px] font-semibold text-[#111827] outline-none placeholder:text-[#9CA3AF]"
        />
        {rightSlot}
      </div>
    </div>
  );
}

export function AdminAuthButton({
  children,
  loading,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={
        'btn-brand-gradient flex h-[46px] w-full items-center justify-center gap-1.5 rounded-[9px] text-[13.5px] font-extrabold text-white disabled:opacity-70 ' +
        (props.className || '')
      }
    >
      {children}
    </button>
  );
}
