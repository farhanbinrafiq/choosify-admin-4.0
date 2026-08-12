/**
 * Shared dashboard skeleton primitives — subtle, no flashy shimmer.
 * Match real chrome dimensions to avoid layout shift.
 */
import React from 'react';
import { cn } from '../../lib/utils';

type SkeletonProps = {
  className?: string;
  style?: React.CSSProperties;
};

const bone = 'bg-[#E8EDF2] animate-pulse';

export function SkeletonBlock({ className, style }: SkeletonProps) {
  return <div className={cn(bone, 'rounded-md', className)} style={style} aria-hidden />;
}

export function SkeletonText({ className, style }: SkeletonProps) {
  return <div className={cn(bone, 'h-3 rounded', className)} style={style} aria-hidden />;
}

export function SkeletonAvatar({ className, style }: SkeletonProps) {
  return <div className={cn(bone, 'rounded-full shrink-0', className || 'w-9 h-9')} style={style} aria-hidden />;
}

/** Matches GlobalSearchShell white pill geometry (rounded-full, ~40–44px). */
export function SkeletonPill({ className, style }: SkeletonProps) {
  return (
    <div
      className={cn(
        'w-full h-full min-h-[40px] rounded-full bg-white/15 border border-white/10 flex items-center px-3 gap-2',
        className,
      )}
      style={style}
      aria-hidden
    >
      <div className="w-4 h-4 rounded-full bg-white/25 shrink-0" />
      <div className="flex-1 h-3 rounded-full bg-white/20" />
      <div className="w-[72px] h-8 rounded-full bg-white/25 shrink-0" />
    </div>
  );
}

export function SkeletonCard({ className, style }: SkeletonProps) {
  return (
    <div
      className={cn('rounded-[18px] border border-[#E8EDF2] bg-white p-5', className)}
      style={style}
      aria-hidden
    >
      <SkeletonText className="w-24 mb-4" />
      <SkeletonBlock className="h-8 w-32 mb-3" />
      <SkeletonText className="w-40" />
    </div>
  );
}

export function SkeletonChart({ className }: SkeletonProps) {
  return (
    <div className={cn('rounded-[5px] border border-[#E8EDF2] bg-white p-6', className)} aria-hidden>
      <SkeletonText className="w-48 mb-2" />
      <SkeletonText className="w-32 mb-6 h-2.5" />
      <div className="flex items-end gap-2 h-36">
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonBlock
            key={i}
            className="flex-1 rounded-t"
            style={{ height: `${35 + ((i * 17) % 55)}%` }}
          />
        ))}
      </div>
    </div>
  );
}

export function SkeletonTableRow({ className }: SkeletonProps) {
  return (
    <div className={cn('flex items-center gap-3 py-3 border-b border-[#F1F5F9]', className)} aria-hidden>
      <SkeletonBlock className="w-8 h-8 rounded-lg shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <SkeletonText className="w-2/3 max-w-[220px]" />
        <SkeletonText className="w-1/3 max-w-[120px] h-2.5" />
      </div>
      <SkeletonText className="w-16 shrink-0" />
    </div>
  );
}

export function SkeletonProfileCard({ className }: SkeletonProps) {
  return (
    <div className={cn('rounded-xl border border-[#E8EDF2] bg-white overflow-hidden', className)} aria-hidden>
      <div className="h-20 bg-gradient-to-r from-[#8B3A3E] via-[#3A1E22] to-[#1e2260] opacity-80" />
      <div className="p-5 -mt-8">
        <SkeletonAvatar className="w-16 h-16 border-2 border-white mb-3" />
        <SkeletonText className="w-40 mb-2 h-4" />
        <SkeletonText className="w-28 mb-4" />
        <div className="space-y-2">
          <SkeletonText className="w-full" />
          <SkeletonText className="w-5/6" />
          <SkeletonText className="w-2/3" />
        </div>
      </div>
    </div>
  );
}

/** Dark-nav search skeleton for cms-mirror / workspace topbar overlays. */
export function DashboardSearchSkeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn('w-full h-full', className)}
      role="status"
      aria-busy="true"
      aria-label="Loading search"
    >
      <SkeletonPill />
      <span className="sr-only">Loading search</span>
    </div>
  );
}

/** Topbar chrome skeleton: title + search pill + bell + avatar. */
export function DashboardHeaderSkeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'h-16 flex items-center gap-4 px-8',
        'bg-[radial-gradient(900px_200px_at_15%_0%,hsla(6,86%,54%,0.16),transparent_70%),radial-gradient(700px_200px_at_90%_100%,hsla(6,86%,45%,0.12),transparent_70%),rgba(10,10,31,0.94)]',
        className,
      )}
      role="status"
      aria-busy="true"
      aria-label="Loading dashboard header"
    >
      <div className="shrink-0 w-[min(280px,28vw)] space-y-2">
        <div className="h-4 w-36 rounded bg-white/20 animate-pulse" />
        <div className="h-2.5 w-48 rounded bg-white/10 animate-pulse" />
      </div>
      <div className="flex-1 min-w-0 h-11">
        <SkeletonPill />
      </div>
      <div className="flex items-center gap-4 shrink-0">
        <div className="w-7 h-7 rounded-full bg-white/20 animate-pulse" />
        <div className="w-px h-5 bg-white/15" />
        <SkeletonAvatar className="w-8 h-8 bg-white/20" />
      </div>
    </div>
  );
}

export type AdminPageSkeletonVariant = 'dashboard' | 'profile' | 'orders' | 'products' | 'generic';

/** Content-area page skeleton — used under Suspense and cms-mirror boot overlay. */
export function AdminPageSkeleton({
  variant = 'generic',
  className,
}: {
  variant?: AdminPageSkeletonVariant;
  className?: string;
}) {
  if (variant === 'dashboard') {
    return (
      <div className={cn('p-7 space-y-5', className)} role="status" aria-busy="true" aria-label="Loading dashboard">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <SkeletonBlock className="h-6 w-56" />
            <SkeletonText className="w-72" />
          </div>
          <SkeletonBlock className="h-10 w-40 rounded-lg" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 p-5 rounded-[20px] bg-gradient-to-br from-[#EF3C23]/10 to-[#000435]/5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-[18px] h-[127px] p-5 border border-white/10"
              style={{
                background:
                  'linear-gradient(100deg, #8B3A3E 0%, #5A2A2E 28%, #3A1E22 52%, #2a2858 82%, #1e2260 100%)',
                opacity: 0.55,
              }}
            >
              <div className="h-2.5 w-24 rounded bg-white/25 mb-4" />
              <div className="h-7 w-20 rounded bg-white/30 mb-3" />
              <div className="h-2.5 w-32 rounded bg-white/20" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
          <SkeletonChart />
          <div className="rounded-[5px] border border-[#E8EDF2] bg-white p-5 space-y-3">
            <SkeletonText className="w-40 mb-2" />
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonTableRow key={i} />
            ))}
          </div>
        </div>
        <span className="sr-only">Loading dashboard</span>
      </div>
    );
  }

  if (variant === 'profile') {
    return (
      <div
        className={cn('p-7 grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5', className)}
        role="status"
        aria-busy="true"
        aria-label="Loading profile"
      >
        <SkeletonProfileCard />
        <div className="rounded-xl border border-[#E8EDF2] bg-white p-6 space-y-4">
          <div className="flex gap-3 mb-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonBlock key={i} className="h-8 w-24 rounded-lg" />
            ))}
          </div>
          <SkeletonText className="w-48 h-4" />
          <SkeletonText className="w-full" />
          <SkeletonText className="w-5/6" />
          <SkeletonBlock className="h-40 w-full rounded-xl mt-4" />
        </div>
        <span className="sr-only">Loading profile</span>
      </div>
    );
  }

  if (variant === 'orders') {
    return (
      <div className={cn('p-7 space-y-4', className)} role="status" aria-busy="true" aria-label="Loading orders">
        <div className="flex gap-2 flex-wrap">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-9 w-28 rounded-lg" />
          ))}
        </div>
        <div className="flex gap-3 flex-wrap">
          <SkeletonBlock className="h-10 flex-1 min-w-[200px] rounded-lg" />
          <SkeletonBlock className="h-10 w-32 rounded-lg" />
          <SkeletonBlock className="h-10 w-28 rounded-lg" />
        </div>
        <div className="rounded-xl border border-[#E8EDF2] bg-white px-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonTableRow key={i} />
          ))}
        </div>
        <span className="sr-only">Loading orders</span>
      </div>
    );
  }

  if (variant === 'products') {
    return (
      <div className={cn('p-7 space-y-4', className)} role="status" aria-busy="true" aria-label="Loading products">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
        <div className="rounded-xl border border-[#E8EDF2] bg-white px-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <SkeletonTableRow key={i} />
          ))}
        </div>
        <span className="sr-only">Loading products</span>
      </div>
    );
  }

  return (
    <div className={cn('p-7 space-y-4', className)} role="status" aria-busy="true" aria-label="Loading page">
      <SkeletonBlock className="h-6 w-48" />
      <SkeletonText className="w-72" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <div className="rounded-xl border border-[#E8EDF2] bg-white px-4 mt-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonTableRow key={i} />
        ))}
      </div>
      <span className="sr-only">Loading page</span>
    </div>
  );
}

export default AdminPageSkeleton;
