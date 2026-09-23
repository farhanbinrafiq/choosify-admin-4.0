import React from 'react';
import { AdminAuthShell } from './AdminAuthShell';

/**
 * Lighter-weight member of the approved Admin/Partner auth design family
 * (see LoginPage.tsx): the same clean white `AdminAuthShell` two-column
 * page (brand/marketing left, sharp auth card right). Used by the
 * dashboard Forgot Password and Reset Password screens so they don't fall
 * back to a generic form. Reusing `AdminAuthShell` here (rather than each
 * page owning its own copy) is what makes every page built on
 * `AdminAuthCard` share the same background/layout automatically.
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
    <AdminAuthShell>
      <>
        <span className="mb-3 inline-block rounded-full bg-[rgba(255,90,44,0.12)] px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#EF3C23]">
          {kicker}
        </span>
        <h1 className="text-[20px] font-extrabold leading-tight text-[#111827]">{title}</h1>
        {intro ? <p className="mb-5 mt-1.5 text-[12.5px] font-semibold leading-relaxed text-[#6B7280]">{intro}</p> : <div className="mb-5" />}
        {children}
        {footer ? (
          <div className="mt-5 border-t border-[#EEF0F4] pt-4 text-center text-[11px] font-semibold text-[#6B7280]">
            {footer}
          </div>
        ) : null}
      </>
    </AdminAuthShell>
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
