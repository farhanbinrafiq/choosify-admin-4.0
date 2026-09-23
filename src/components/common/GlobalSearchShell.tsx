/**
 * GlobalSearchShell — shared presentational search chrome.
 *
 * Visual source of truth: Choosify-Web `GlobalSearchBar` navbar-fluid / hero shell
 * (`renderNavbarHeroForm` + `.choosify-navbar-hero-search` tokens).
 *
 * Storefront supplies mode="discover" (label DISCOVER).
 * Dashboard supplies mode="dashboard" (label SEARCH).
 *
 * Data/search providers stay outside this shell.
 */
import React from 'react';
import { SearchCheck, X } from 'lucide-react';
import { cn } from '../../lib/utils';

export type GlobalSearchShellMode = 'discover' | 'dashboard';

export type GlobalSearchShellProps = {
  mode: GlobalSearchShellMode;
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onFocus?: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onClear?: () => void;
  placeholder: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  /** 'inline' = desktop navbar; 'overlay' = mobile expanded overlay */
  presentation?: 'inline' | 'overlay';
  onCloseOverlay?: () => void;
  className?: string;
  inputAriaLabel?: string;
  /**
   * 'dark' (default) = the translucent white-on-dark glass frame, for every
   * existing dark-chrome caller (storefront navbar, CmsMirrorHost overlay,
   * AdminLayout). 'light' = a solid, bordered frame for a light chrome
   * (AdminWorkspaceLayout's white topbar, Dashboard Design System) -- the
   * translucent white frame is invisible on a white background.
   */
  tone?: 'dark' | 'light';
};

const SUBMIT_LABEL: Record<GlobalSearchShellMode, string> = {
  discover: 'DISCOVER',
  dashboard: 'SEARCH',
};

export function GlobalSearchShell({
  mode,
  value,
  onChange,
  onSubmit,
  onFocus,
  onKeyDown,
  onClear,
  placeholder,
  inputRef,
  presentation = 'inline',
  onCloseOverlay,
  className,
  inputAriaLabel,
  tone = 'dark',
}: GlobalSearchShellProps) {
  const submitLabel = SUBMIT_LABEL[mode];
  const showClear = Boolean(value) && presentation === 'inline' && typeof onClear === 'function';

  return (
    <form
      onSubmit={onSubmit}
      className={cn(
        'relative w-full rounded-full transition-all duration-300',
        tone === 'light'
          ? 'bg-[#F8F9FB] border border-[#E1E5EA] focus-within:border-[#EF3C23]/40'
          : 'bg-white/10 backdrop-blur-md border border-white/10 shadow-lg focus-within:border-white/20',
        presentation === 'overlay' && 'choosify-mobile-search-pill',
        className,
      )}
    >
      {/*
        Inner white pill — storefront geometry.
        Clear × gets a dedicated shrink-0 region immediately before the CTA
        so it never collides with or resizes the SEARCH/DISCOVER button.
      */}
      <div className={cn('global-search-shell__pill flex items-center rounded-full relative min-w-0', tone === 'light' ? 'bg-[#F8F9FB]' : 'bg-white')}>
        {presentation === 'overlay' && (
          <button
            type="button"
            aria-label="Close search"
            onClick={onCloseOverlay}
            className="shrink-0 pl-2.5 pr-1 text-gray-400 hover:text-[#EF3C23] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        <div className="pl-2.5 sm:pl-4 text-[#EF3C23] shrink-0">
          <SearchCheck className="w-4 h-4" strokeWidth={2} />
        </div>

        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          aria-label={inputAriaLabel || (mode === 'discover' ? 'Search storefront' : 'Search dashboard')}
          className={cn(
            'global-search-shell__input w-full min-w-0 bg-transparent outline-none text-[#172033] font-semibold placeholder-gray-500 focus:outline-none focus:ring-0 border-none',
            presentation === 'overlay'
              ? 'h-10 pl-2 pr-2 text-xs'
              : 'h-9 sm:h-9 md:h-10 pl-2 sm:pl-3 pr-2 text-[11px] sm:text-xs',
          )}
        />

        {/* Dedicated clear region — always reserved on inline so layout never jumps */}
        {presentation === 'inline' && (
          <div className="global-search-shell__clear shrink-0 w-7 sm:w-8 flex items-center justify-center">
            {showClear ? (
              <button
                type="button"
                onClick={onClear}
                aria-label="Clear search"
                className="text-gray-400 hover:text-[#EF3C23] p-0.5 cursor-pointer bg-transparent border-none"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : null}
          </div>
        )}

        <button
          type="submit"
          aria-label={submitLabel}
          className={cn(
            'global-search-shell__cta shrink-0 m-1 sm:m-1.5 rounded-full bg-[#EF3C23] hover:bg-[#D4331B] text-white font-extrabold tracking-wide uppercase flex items-center justify-center gap-1 transition-all duration-200 cursor-pointer',
            presentation === 'overlay'
              ? 'px-4 h-8 text-[9px]'
              : 'px-2 sm:px-2.5 md:px-4 lg:px-5 h-7 sm:h-7 md:h-8 text-[8px] sm:text-[8px] md:text-[9px] min-w-[3.25rem] sm:min-w-[2.25rem] md:min-w-0',
          )}
        >
          {presentation === 'overlay' ? (
            submitLabel
          ) : (
            <>
              <SearchCheck className="w-3.5 h-3.5 md:hidden shrink-0" strokeWidth={2} />
              <span className="hidden md:inline font-extrabold">{submitLabel}</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}

export default GlobalSearchShell;
