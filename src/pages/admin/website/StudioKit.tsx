/**
 * Small shared pieces for the visual (storefront-mirror) Website Studio editors:
 * a mirror canvas + inspector layout, selectable mirror blocks, form fields and a link field.
 * Dark storefront colours use inline styles (global dashboard light-mode CSS overrides bg-[#hex]).
 */
import React from 'react';
import { MousePointerClick } from 'lucide-react';
import { SITE_PAGES } from './siteModel';

export const inputCls =
  'w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-[12.5px] text-[#111827] outline-none focus:border-[#EF3C23] focus:ring-2 focus:ring-[#EF3C23]/15 disabled:bg-slate-50';
export const labelCls = 'mb-1 block text-[10.5px] font-extrabold uppercase tracking-wide text-[#6B7280]';
export const iconBtn =
  'inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#E2E8F0] bg-white text-[#374151] hover:bg-slate-50 disabled:opacity-40';
export const smallBtn =
  'inline-flex items-center gap-1 rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-[11.5px] font-bold text-[#111827] hover:bg-slate-50 disabled:opacity-50';

/** Storefront chrome colours (Web choosify-chrome-header / footer-brand-gradient). */
export const STOREFRONT = {
  navy: '#1A1D4E',
  header: 'linear-gradient(90deg, #2A1235 0%, #1A1D4E 100%)',
  footer: 'linear-gradient(180deg, #1A1D4E 0%, #12143A 100%)',
  orange: '#FF5B00',
  page: '#F4F7FB',
};

/** Two-pane studio: the storefront mirror (left) and the inspector for the selected block (right). */
export function MirrorLayout({ mirror, inspector, inspectorTitle }: { mirror: React.ReactNode; inspector: React.ReactNode; inspectorTitle?: string }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="min-w-0 overflow-hidden rounded-xl border border-[#E8EDF2]" style={{ background: STOREFRONT.page }} data-testid="ws-mirror">
        <div className="flex items-center gap-1.5 border-b border-[#E8EDF2] bg-white px-3 py-1.5 text-[10.5px] font-bold text-slate-500">
          <span className="h-2 w-2 rounded-full bg-red-300" />
          <span className="h-2 w-2 rounded-full bg-amber-300" />
          <span className="h-2 w-2 rounded-full bg-emerald-300" />
          <span className="ml-2 truncate">choosify.bd — storefront mirror · click any part to edit it</span>
        </div>
        {mirror}
      </div>
      <div className="xl:sticky xl:top-20 xl:self-start" data-testid="ws-inspector">
        <div className="rounded-xl border border-[#E8EDF2] bg-white p-4">
          {inspectorTitle && <div className="mb-3 text-[13px] font-extrabold text-[#111827]">{inspectorTitle}</div>}
          {inspector ?? (
            <div className="flex items-center gap-2 py-6 text-[12px] font-semibold text-slate-500">
              <MousePointerClick className="h-4 w-4" /> Click a part of the page on the left to edit it.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** A clickable region of the mirror: outlined on hover, highlighted when selected. */
export function MirrorBlock({
  selected,
  onSelect,
  label,
  testId,
  muted,
  children,
  className = '',
  style,
}: {
  selected: boolean;
  onSelect: () => void;
  label: string;
  testId: string;
  muted?: boolean;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`Edit ${label}`}
      data-testid={testId}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      className={`group relative cursor-pointer outline-none transition-shadow ${selected ? 'ring-2 ring-[#EF3C23] ring-offset-2' : 'hover:ring-2 hover:ring-[#EF3C23]/40 hover:ring-offset-1'} ${muted ? 'opacity-45' : ''} ${className}`}
      style={style}
    >
      <span
        className={`pointer-events-none absolute -top-2.5 left-2 z-10 rounded px-1.5 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wide ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
        style={{ background: '#EF3C23', color: '#FFFFFF' }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {children}
      {hint && <div className="mt-1 text-[10.5px] text-slate-500">{hint}</div>}
    </div>
  );
}

/** A link to a storefront page (suggested from the real page list) or an https:// address. */
export function LinkInput({ value, onChange, disabled, testId, placeholder = '/deals or https://…' }: { value: string; onChange: (v: string) => void; disabled: boolean; testId: string; placeholder?: string }) {
  const listId = `${testId}-pages`;
  return (
    <>
      <input className={inputCls} value={value} disabled={disabled} list={listId} placeholder={placeholder} maxLength={500} data-testid={testId} onChange={(e) => onChange(e.target.value)} />
      <datalist id={listId}>
        {SITE_PAGES.map((p) => (
          <option key={p.path} value={p.path}>
            {p.label}
          </option>
        ))}
      </datalist>
    </>
  );
}

export function Toggle({ checked, onChange, disabled, label, testId }: { checked: boolean; onChange: (v: boolean) => void; disabled: boolean; label: string; testId: string }) {
  return (
    <label className="inline-flex items-center gap-1.5 text-[11.5px] font-bold text-[#374151]">
      <input type="checkbox" checked={checked} disabled={disabled} data-testid={testId} onChange={(e) => onChange(e.target.checked)} /> {label}
    </label>
  );
}
