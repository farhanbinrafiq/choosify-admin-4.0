/**
 * Shared presentation helpers for canonical seller Deals (Admin Deals Manager +
 * seller Ads & Deals Studio → Deals). Display only — the server decides state.
 */
import React from 'react';
import {
  PROMOTION_RUN_STATE_LABEL,
  type DealFilterKey,
  type PromotionRunState,
} from '@/shared/deals/dealPricing';

export const DHAKA_TZ = 'Asia/Dhaka';

export function money(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return '—';
  return `৳${Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

export function fmtDateTime(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-GB', {
    timeZone: DHAKA_TZ,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/** Bangladesh has no DST: Dhaka wall time → ISO via a fixed +06:00 offset. */
export function dhakaLocalToIso(date: string, time: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const ms = Date.parse(`${date}T${time}:00+06:00`);
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
}

/** ISO → { date, time } in Dhaka wall time (for prefilling inputs). */
export function isoToDhakaLocal(iso?: string): { date: string; time: string } {
  if (!iso) return { date: '', time: '' };
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return { date: '', time: '' };
  const shifted = new Date(ms + 6 * 3_600_000).toISOString();
  return { date: shifted.slice(0, 10), time: shifted.slice(11, 16) };
}

const PILL: Record<string, [string, string]> = {
  pending: ['#FFEDD5', '#9A3412'],
  approved: ['#DBEAFE', '#1E40AF'],
  rejected: ['#FEE2E2', '#991B1B'],
  paused: ['#FEF3C7', '#92400E'],
  disabled: ['#F3F4F6', '#6B7280'],
  draft: ['#F3F4F6', '#374151'],
  active: ['#DCFCE7', '#166534'],
  scheduled: ['#E0E7FF', '#3730A3'],
  expired: ['#F1F5F9', '#64748B'],
  legacy: ['#F5F5F4', '#57534E'],
  requested: ['#FFEDD5', '#9A3412'],
  promoted: ['#FCE7F3', '#9D174D'],
  cancelled: ['#F3F4F6', '#6B7280'],
};

export function Pill({ tone, children }: { tone: string; children: React.ReactNode }) {
  const [bg, fg] = PILL[tone] || ['#F3F4F6', '#374151'];
  return (
    <span
      className="inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wide"
      style={{ background: bg, color: fg }}
    >
      {children}
    </span>
  );
}

/**
 * One Deal status for people: the schedule-derived state (Scheduled / Active /
 * Expired) for an enabled deal, otherwise the moderation state (Paused /
 * Disabled), or Legacy. Deals have no approval state.
 */
export function DealStatusPill({ filterKey }: { filterKey: DealFilterKey }) {
  if (filterKey === 'legacy') return <Pill tone="legacy">Legacy — not priced</Pill>;
  return <Pill tone={filterKey}>{filterKey}</Pill>;
}

/** Promotion Request status for a deal (Requested / Promoted / Not approved / …). */
export function PromotionStatusPill({ summary }: { summary?: { status: string; runState: PromotionRunState | null } }) {
  if (!summary) return <span className="text-[11px] text-[#9CA3AF]">—</span>;
  if (summary.status === 'pending') return <Pill tone="requested">Requested</Pill>;
  if (summary.status === 'rejected') return <Pill tone="rejected">Not approved</Pill>;
  if (summary.status === 'cancelled') return <Pill tone="disabled">Cancelled</Pill>;
  if (summary.status === 'approved' && summary.runState) {
    const tone = summary.runState === 'running' ? 'promoted' : summary.runState === 'awaiting_fulfillment' ? 'approved' : 'expired';
    return <Pill tone={tone}>{PROMOTION_RUN_STATE_LABEL[summary.runState]}</Pill>;
  }
  return <Pill tone={summary.status}>{summary.status}</Pill>;
}

export function ListingTypeBadge({ type }: { type?: string }) {
  if (!type) return <span className="text-[11px] text-[#9CA3AF]">—</span>;
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wide ${
        type === 'service' ? 'bg-[#F3E8FF] text-[#6B21A8]' : 'bg-[#E0F2FE] text-[#075985]'
      }`}
    >
      {type}
    </span>
  );
}

/** Listing thumbnail; falls back to a neutral tile when the image is missing or fails to load. */
export function Thumb({ src, alt }: { src?: string; alt: string }) {
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => setFailed(false), [src]);
  return src && !failed ? (
    <img
      src={src}
      alt={alt}
      onError={() => setFailed(true)}
      className="h-10 w-10 shrink-0 overflow-hidden rounded bg-[#F3F4F6] object-cover text-[0px]"
      loading="lazy"
    />
  ) : (
    <div className="h-10 w-10 shrink-0 rounded bg-[#F3F4F6]" aria-hidden />
  );
}
