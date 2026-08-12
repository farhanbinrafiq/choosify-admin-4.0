import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  SearchCheck,
  Clock,
  Eye,
  Zap,
  X,
  Package,
  ShoppingBag,
  Store,
  Users,
  BookOpen,
  Megaphone,
  Wallet,
  Ticket,
  CircleDollarSign,
  MessageSquare,
  ShieldAlert,
  LayoutDashboard,
  User,
  LogIn,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getAuthToken } from '../../lib/commerceOrderAdapter';
import { useAuth } from '../../contexts/AuthContext';
import { useRbac } from '../../contexts/RbacContext';
import { useImpersonation } from '../../contexts/ImpersonationContext';
import { cn } from '../../lib/utils';
import {
  loadRecentSearches,
  loadRecentlyViewed,
  pushRecentlyViewed,
  saveRecentSearches,
  saveRecentlyViewed,
  type DashboardRecentlyViewedItem,
} from '../../lib/dashboardSearchStorage';
import { getQuickAccessForRole } from '../../lib/dashboardSearchQuickAccess';
import { GlobalSearchShell } from './GlobalSearchShell';
import { DashboardSearchSkeleton } from './skeletons';


type DashboardSearchGroup =
  | 'Users'
  | 'Orders'
  | 'Products'
  | 'Brands'
  | 'Customers'
  | 'Content'
  | 'Ads & Deals'
  | 'Cashbooks'
  | 'Coupons'
  | 'Finance'
  | 'Messages'
  | 'Disputes / Moderation'
  | 'Pages';


type DashboardSearchItem = {
  type: string;
  id: string;
  publicId?: string;
  title: string;
  subtitle?: string;
  group: DashboardSearchGroup;
  route: string;
  exactMatch?: boolean;
};


type DashboardSearchResponse = {
  success: true;
  query: string;
  total: number;
  groups: Array<{ group: DashboardSearchGroup; items: DashboardSearchItem[] }>;
};


const GROUP_ICONS: Record<DashboardSearchGroup, React.ComponentType<{ size?: number; className?: string }>> = {
  Users: User,
  Orders: ShoppingBag,
  Products: Package,
  Brands: Store,
  Customers: Users,
  Content: BookOpen,
  'Ads & Deals': Megaphone,
  Cashbooks: Wallet,
  Coupons: Ticket,
  Finance: CircleDollarSign,
  Messages: MessageSquare,
  'Disputes / Moderation': ShieldAlert,
  Pages: LayoutDashboard,
};


function referenceIdLike(q: string): boolean {
  return /^[A-Z]{2,3}-\d{1,}$/.test(q.toUpperCase());
}


function normalizeActorKey(profile: { choosifyUserId?: string; id?: string } | null | undefined): string {
  return String(profile?.choosifyUserId || profile?.id || 'anonymous');
}


function groupIcon(group: DashboardSearchGroup) {
  const Icon = GROUP_ICONS[group] || SearchCheck;
  return <Icon size={12} className="text-[#EB4501] shrink-0" />;
}


export function GlobalDashboardSearch(props: {
  variant?: 'header' | 'topbar';
  className?: string;
  /**
   * When false, render a non-interactive pill skeleton (initial boot / role change).
   * Defaults to true — internal route navigation should leave search interactive.
   */
  ready?: boolean;
}) {
  const { ready = true, variant = 'header', className } = props;
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { can } = useRbac();
  const { startImpersonation } = useImpersonation();
  const actorKey = normalizeActorKey(profile);
  const token = getAuthToken();
  const searchContextReady = Boolean(ready && profile?.role && (token || profile?.id));


  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<DashboardSearchResponse['groups']>([]);
  const [noResults, setNoResults] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<DashboardRecentlyViewedItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [mobileExpanded, setMobileExpanded] = useState(false);


  const containerRef = useRef<HTMLDivElement | null>(null);
  const mobileOverlayRef = useRef<HTMLDivElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({ visibility: 'hidden' });


  const quickAccess = useMemo(() => getQuickAccessForRole(profile?.role), [profile?.role]);


  useEffect(() => {
    // Identity change (login-as / role switch): clear live query UI so stale-role results never flash.
    setQuery('');
    setFocused(false);
    setGroups([]);
    setNoResults(false);
    setActiveIndex(-1);
    setMobileExpanded(false);
    setRecent(loadRecentSearches(actorKey));
    setRecentlyViewed(loadRecentlyViewed(actorKey));
  }, [actorKey]);


  const shouldSearch = useMemo(() => {
    const q = query.trim();
    if (!q) return false;
    if (referenceIdLike(q)) return true;
    return q.length >= 2;
  }, [query]);


  const flatResults = useMemo(
    () => groups.flatMap((g) => g.items.map((item) => ({ ...item, groupLabel: g.group }))),
    [groups],
  );


  useEffect(() => {
    if (!focused && !mobileExpanded) return;

    const isInsideSearchUi = (target: EventTarget | null) => {
      if (!(target instanceof Node)) return false;
      if (containerRef.current?.contains(target)) return true;
      if (mobileOverlayRef.current?.contains(target)) return true;
      if (dropdownRef.current?.contains(target)) return true;
      return false;
    };

    const closeDropdown = () => {
      setFocused(false);
      setMobileExpanded(false);
    };

    const onPointerDown = (e: Event) => {
      if (isInsideSearchUi(e.target)) return;
      closeDropdown();
    };

    // Clicks inside a same-origin iframe (cms-mirror) never bubble to the parent
    // document — close when the parent window loses focus to the iframe.
    const onWindowBlur = () => {
      window.setTimeout(() => {
        if (isInsideSearchUi(document.activeElement)) return;
        closeDropdown();
      }, 0);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeDropdown();
        inputRef.current?.blur();
      }
    };

    document.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('blur', onWindowBlur);
    document.addEventListener('keydown', onKeyDown);

    const iframeCleanups: Array<() => void> = [];
    document.querySelectorAll('iframe').forEach((iframe) => {
      const bindIframeDoc = () => {
        try {
          const doc = iframe.contentDocument;
          if (!doc) return;
          doc.addEventListener('pointerdown', onPointerDown, true);
          iframeCleanups.push(() => doc.removeEventListener('pointerdown', onPointerDown, true));
        } catch {
          /* cross-origin */
        }
      };
      bindIframeDoc();
      iframe.addEventListener('load', bindIframeDoc);
      iframeCleanups.push(() => iframe.removeEventListener('load', bindIframeDoc));
    });

    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('blur', onWindowBlur);
      document.removeEventListener('keydown', onKeyDown);
      iframeCleanups.forEach((fn) => fn());
    };
  }, [focused, mobileExpanded]);


  useEffect(() => {
    if (!focused) return;
    if (!shouldSearch) {
      setGroups([]);
      setNoResults(false);
      setLoading(false);
      return;
    }


    const controller = new AbortController();
    const t = window.setTimeout(async () => {
      if (!token || !searchContextReady) {
        setGroups([]);
        setNoResults(false);
        return;
      }
      setLoading(true);
      try {
        const url = `/api/v1/search?q=${encodeURIComponent(query.trim())}&limitPerGroup=5`;
        const res = await fetch(url, {
          signal: controller.signal,
          headers: { Authorization: `Bearer ${token}` },
        });
        const body = (await res.json()) as DashboardSearchResponse;
        if (!controller.signal.aborted) {
          const ok = body?.success;
          if (!ok || !body.groups?.length) {
            setGroups([]);
            setNoResults(true);
          } else {
            setGroups(body.groups);
            setNoResults(false);
          }
          setActiveIndex(-1);
        }
      } catch {
        if (!controller.signal.aborted) {
          setGroups([]);
          setNoResults(true);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);


    return () => {
      controller.abort();
      window.clearTimeout(t);
    };
  }, [query, focused, shouldSearch, token, searchContextReady]);


  useLayoutEffect(() => {
    if (!focused) return;

    const updatePosition = () => {
      const anchor =
        mobileExpanded && mobileOverlayRef.current ? mobileOverlayRef.current : containerRef.current;
      if (!anchor) return;

      const rect = anchor.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const isMobileOverlay = mobileExpanded && viewportWidth < 640;

      // Align dropdown edges to the search shell (storefront geometry intent).
      // Mobile overlay: near full-bleed. Desktop: exact shell width/left.
      if (isMobileOverlay) {
        const width = Math.max(24, viewportWidth - 24);
        setDropdownStyle({
          position: 'fixed',
          top: rect.bottom + 8,
          left: 12,
          width,
          maxHeight: Math.min(560, window.innerHeight - rect.bottom - 16),
          visibility: 'visible',
          zIndex: 300,
        });
        return;
      }

      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 8,
        left: Math.max(8, rect.left),
        width: Math.max(280, rect.width),
        maxHeight: 560,
        visibility: 'visible',
        zIndex: 300,
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [focused, query, mobileExpanded]);


  const persistRecent = (next: string[]) => {
    setRecent(next);
    saveRecentSearches(actorKey, next);
  };


  const addToRecent = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    const next = [trimmed, ...recent.filter((x) => x.toLowerCase() !== trimmed.toLowerCase())].slice(0, 10);
    persistRecent(next);
  };


  const navigateToResult = (item: Pick<DashboardSearchItem, 'type' | 'id' | 'title' | 'subtitle' | 'route'>) => {
    if (query.trim()) addToRecent(query.trim());
    const viewed = pushRecentlyViewed(actorKey, {
      id: item.id,
      type: item.type,
      title: item.title,
      subtitle: item.subtitle,
      route: item.route,
    });
    setRecentlyViewed(viewed);
    navigate(item.route);
    setFocused(false);
    setMobileExpanded(false);
    setQuery('');
  };


  const handleRecentClick = (rq: string) => {
    setQuery(rq);
    setFocused(true);
    inputRef.current?.focus();
  };


  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    addToRecent(trimmed);
    if (flatResults.length > 0) {
      navigateToResult(flatResults[0]);
      return;
    }
    setFocused(true);
  };


  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!focused) {
      if (e.key === 'ArrowDown') setFocused(true);
      return;
    }


    const listLength = query.trim() ? flatResults.length : 0;
    if (e.key === 'ArrowDown' && listLength > 0) {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1 >= listLength ? 0 : prev + 1));
    } else if (e.key === 'ArrowUp' && listLength > 0) {
      e.preventDefault();
      setActiveIndex((prev) => (prev - 1 < 0 ? listLength - 1 : prev - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < flatResults.length) {
        navigateToResult(flatResults[activeIndex]);
      } else {
        handleSubmit();
      }
    }
  };


  const openMobileSearch = () => {
    setMobileExpanded(true);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      setFocused(true);
    });
  };


  const closeMobileSearch = () => {
    setMobileExpanded(false);
    setFocused(false);
    inputRef.current?.blur();
  };


  const placeholder =
    variant === 'topbar' ? 'Search orders, products, customers, pages…' : 'Search dashboard…';


  const showDropdown = focused;
  const showIdle = showDropdown && !query.trim();
  const showResults = showDropdown && query.trim().length > 0;


  const renderSearchForm = (presentation: 'inline' | 'overlay') => (
    <GlobalSearchShell
      mode="dashboard"
      presentation={presentation}
      value={query}
      placeholder={placeholder}
      inputRef={inputRef}
      inputAriaLabel="Search dashboard"
      onChange={(next) => {
        setQuery(next);
        setFocused(true);
        setActiveIndex(-1);
      }}
      onFocus={() => {
        setFocused(true);
        setActiveIndex(-1);
      }}
      onKeyDown={handleKeyDown}
      onClear={() => {
        setQuery('');
        inputRef.current?.focus();
      }}
      onCloseOverlay={closeMobileSearch}
      onSubmit={(e) => {
        handleSubmit(e);
        if (presentation === 'overlay') closeMobileSearch();
      }}
      className="choosify-navbar-hero-search"
    />
  );


  const renderIdlePanel = () => (
    <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-x-7 gap-y-6 divide-y md:divide-y-0 md:divide-x divide-gray-100">
      <div className="flex flex-col text-left space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1 shrink-0">
            <Clock size={12} className="text-gray-400" />
            Recent Searches
          </span>
          <button
              type="button"
              onClick={() => persistRecent([])}
              disabled={recent.length === 0}
              className="text-[9.5px] font-bold text-[#EB4501] hover:text-[#CF4400] hover:underline bg-transparent border-0 cursor-pointer p-0 shrink-0 whitespace-nowrap disabled:opacity-40 disabled:cursor-default disabled:no-underline"
            >
              Clear search history
            </button>
        </div>
        {recent.length === 0 ? (
          <p className="text-[11px] text-gray-400 italic">No recent searches</p>
        ) : (
          <div className="flex flex-col space-y-1">
            {recent.map((rq, idx) => (
              <div
                key={`${rq}-${idx}`}
                onClick={() => handleRecentClick(rq)}
                className="group flex items-center justify-between px-2.5 py-1.5 rounded-[5px] text-[11px] font-bold cursor-pointer transition-colors text-[#1A1A2E] hover:bg-gray-50"
              >
                <span className="truncate">{rq}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    persistRecent(recent.filter((x) => x !== rq));
                  }}
                  className="text-gray-300 hover:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
                  title="Remove"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>


      <div className="flex flex-col text-left space-y-2 pt-4 md:pt-0 md:pl-4">
        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
          <Eye size={12} className="text-[#EB4501]" />
          Recently Viewed
        </span>
        {recentlyViewed.length === 0 ? (
          <p className="text-[11px] text-gray-400 italic">Open a record from search to track it here</p>
        ) : (
          <div className="flex flex-col space-y-1">
            {recentlyViewed.slice(0, 6).map((item) => (
              <div
                key={`${item.type}-${item.id}`}
                onClick={() => navigateToResult(item)}
                className="px-2.5 py-1.5 rounded-[5px] text-[11px] font-bold cursor-pointer transition-colors text-[#1A1A2E] hover:bg-gray-50"
              >
                <div className="truncate">{item.title}</div>
                {item.subtitle ? (
                  <div className="text-[9.5px] text-gray-500 font-semibold truncate mt-0.5">{item.subtitle}</div>
                ) : null}
              </div>
            ))}
          </div>
        )}
        {recentlyViewed.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setRecentlyViewed([]);
              saveRecentlyViewed(actorKey, []);
            }}
            className="text-[9.5px] font-bold text-[#EB4501] hover:text-[#CF4400] hover:underline bg-transparent border-0 cursor-pointer p-0 self-start"
          >
            Clear recently viewed
          </button>
        )}
      </div>


      <div className="flex flex-col text-left space-y-2 pt-4 md:pt-0 md:pl-4">
        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
          <Zap size={12} className="text-[#EB4501]" />
          Quick Access
        </span>
        <div className="flex flex-wrap gap-2">
          {quickAccess.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() =>
                navigateToResult({
                  id: item.id,
                  type: 'Page',
                  title: item.label,
                  subtitle: item.subtitle,
                  route: item.route,
                })
              }
              className="px-2.5 py-1.5 rounded-full text-[10px] font-bold border transition-colors bg-gray-50 text-[#1A1A2E] border-gray-100 hover:border-[#EB4501]/20 hover:bg-[#EB4501]/5"
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );


  const renderResultsPanel = () => {
    if (loading) {
      return (
        <div className="choosify-omni-search-dropdown--empty p-8 text-center text-gray-500 font-sans text-xs">
          <div>
            <p className="font-bold uppercase tracking-wider text-gray-400 mb-1">Searching</p>
            Looking across your authorized workspace…
          </div>
        </div>
      );
    }


    if (noResults || flatResults.length === 0) {
      return (
        <div className="choosify-omni-search-dropdown--empty p-8 text-center text-gray-500 font-sans text-xs">
          <div>
            <p className="font-bold uppercase tracking-wider text-gray-400 mb-1">No matches</p>
            No results found for &quot;{query.trim()}&quot;
          </div>
        </div>
      );
    }


    let flatIdx = 0;
    return (
      <div className="divide-y divide-gray-100">
        {groups.map((g) => (
          <div key={g.group} className="p-2">
            <span className="px-2.5 py-1 text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5 mb-1">
              {groupIcon(g.group)}
              {g.group}
            </span>
            {g.items.map((item) => {
              const idx = flatIdx++;
              const isActive = activeIndex === idx;
              const canImpersonate = item.type === 'User' && can('impersonate');
              return (
                <div
                  key={`${item.type}-${item.id}`}
                  onClick={() => navigateToResult(item)}
                  onMouseEnter={() => setActiveIndex(idx)}
                  className={cn(
                    'flex items-center justify-between gap-3 px-3 py-2 rounded-[5px] cursor-pointer transition-colors',
                    isActive ? 'bg-[#EB4501]/5 text-[#EB4501]' : 'text-[#1A1A2E] hover:bg-gray-50',
                  )}
                >
                  <div className="min-w-0 text-left flex-1">
                    <div className="text-[11.5px] font-bold truncate leading-snug">
                      {item.publicId && item.title !== item.publicId ? (
                        <>
                          <span className="font-black">{item.publicId}</span>
                          <span className="mx-1 opacity-40">·</span>
                          {item.title}
                        </>
                      ) : (
                        item.title
                      )}
                    </div>
                    {item.subtitle ? (
                      <p className="text-[9.5px] text-gray-500 font-semibold truncate mt-0.5">{item.subtitle}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {canImpersonate ? (
                      <button
                        type="button"
                        title="Login as user"
                        onClick={(e) => {
                          e.stopPropagation();
                          const subtitle = String(item.subtitle || '');
                          const roleGuess = /seller/i.test(subtitle)
                            ? 'seller'
                            : /creator/i.test(subtitle)
                              ? 'creator'
                              : 'consumer';
                          const path =
                            roleGuess === 'seller'
                              ? `/seller/${encodeURIComponent(item.id)}`
                              : roleGuess === 'creator'
                                ? `/creator/${encodeURIComponent(item.id)}`
                                : `/consumer/${encodeURIComponent(item.id)}`;
                          navigate(`${path}?impersonate=1`);
                          setFocused(false);
                          setQuery('');
                        }}
                        className="text-[8px] font-black uppercase tracking-wider bg-[#EB4501]/10 text-[#EB4501] border border-[#EB4501]/20 px-2 py-0.5 rounded-full inline-flex items-center gap-1"
                      >
                        <LogIn size={10} />
                        Login As
                      </button>
                    ) : null}
                    <span className="text-[8px] font-black uppercase tracking-wider bg-[#EB4501]/10 text-[#EB4501] border border-[#EB4501]/20 px-2 py-0.5 rounded-full scale-90">
                      {item.type}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  };


  if (!searchContextReady) {
    return (
      <div className={cn('relative min-w-0 w-full choosify-navbar-hero-search', className)}>
        <DashboardSearchSkeleton />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn('relative min-w-0 w-full choosify-navbar-hero-search', className)}
    >      <button
        type="button"
        aria-label="Open search"
        onClick={openMobileSearch}
        className="sm:hidden flex w-10 h-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white hover:bg-white/10 transition-colors"
      >
        <SearchCheck size={20} strokeWidth={2} />
      </button>


      {mobileExpanded &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-[2px] sm:hidden"
              onClick={closeMobileSearch}
              aria-hidden
            />
            <div
              ref={mobileOverlayRef}
              className="fixed left-0 right-0 z-[95] px-3 py-3 choosify-dark-gradient border-b border-white/10 sm:hidden"
              style={{ top: 'var(--choosify-navbar-height, 3.5rem)' }}
            >
              {renderSearchForm('overlay')}
            </div>
          </>,
          document.body,
        )}


      <div className="hidden sm:block w-full min-w-0">{renderSearchForm('inline')}</div>


      {showDropdown &&
        createPortal(
          <div
            ref={dropdownRef}
            style={dropdownStyle}
            className="choosify-omni-search-dropdown bg-white border border-gray-200 rounded-lg shadow-[0_18px_40px_rgba(0,4,53,0.14)] font-sans text-left text-[#1A1A2E] overflow-y-auto overflow-x-hidden no-scrollbar"
          >
            {showIdle ? renderIdlePanel() : null}
            {showResults ? renderResultsPanel() : null}
          </div>,
          document.body,
        )}
    </div>
  );
}

