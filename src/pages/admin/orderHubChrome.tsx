import React, { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import type { OpsStorefrontOrder, OpsOrderItem } from '../../services/operationsApi';
import { catalogApi } from '../../services/catalogApi';
import { productStudioPath } from './orderHubModel';

/**
 * Shared visual chrome for the Order Hub surfaces (list + Quick View modal +
 * full Order Details page). Inline-styled reproduction of the approved
 * standalone "Order Console" / "Order Details" design; sanctioned deviation:
 * accent = var(--cms-accent), not the reference #FF5B00.
 */

export const CHOOSIFY_WEB_URL = 'https://choosify.bd';
export const ACCENT = 'var(--cms-accent)';
export const ACCENT_WASH = 'color-mix(in srgb, var(--cms-accent) 12%, transparent)';

export function formatCurrency(n?: number): string {
  return `৳ ${Number(n || 0).toLocaleString()}`;
}

export function formatDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

export function formatDay(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export const S = {
  card: {
    background: '#fff',
    border: '1px solid #E8EDF2',
    borderRadius: 10,
  } as CSSProperties,
  microLabel: {
    fontSize: 9.5,
    fontWeight: 800,
    color: '#9CA3AF',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  } as CSSProperties,
  inset: {
    background: '#F9FAFB',
    borderRadius: 8,
  } as CSSProperties,
  input: {
    height: 38,
    borderRadius: 8,
    border: '1px solid #E8EDF2',
    padding: '0 14px',
    fontSize: 12.5,
    color: '#111827',
    background: '#fff',
    boxSizing: 'border-box',
  } as CSSProperties,
};

export function fulfillmentBadgeStyle(status: OpsStorefrontOrder['status']): CSSProperties {
  const map: Record<string, { bg: string; fg: string }> = {
    pending_payment: { bg: 'rgba(245,158,11,0.14)', fg: '#B45309' },
    active: { bg: 'rgba(37,99,235,0.10)', fg: '#2563EB' },
    confirmed: { bg: 'rgba(37,99,235,0.10)', fg: '#2563EB' },
    completed: { bg: 'rgba(22,163,74,0.12)', fg: '#16A34A' },
    cancelled: { bg: 'rgba(220,38,38,0.10)', fg: '#DC2626' },
  };
  const c = map[status] || { bg: '#F1F3F5', fg: '#6B7280' };
  return {
    background: c.bg,
    color: c.fg,
    fontSize: 9.5,
    fontWeight: 800,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    padding: '4px 9px',
    borderRadius: 6,
    whiteSpace: 'nowrap',
  };
}

/** Badge colour for the unified lifecycle status (orderHubModel HubLifecycleStatus). */
export function lifecycleBadgeStyle(status: string): CSSProperties {
  const map: Record<string, { bg: string; fg: string }> = {
    pending: { bg: 'rgba(245,158,11,0.14)', fg: '#B45309' },
    confirmed: { bg: 'rgba(37,99,235,0.10)', fg: '#2563EB' },
    processing: { bg: 'rgba(124,58,237,0.12)', fg: '#7C3AED' },
    dispatched: { bg: 'rgba(8,145,178,0.12)', fg: '#0891B2' },
    in_transit: { bg: 'rgba(8,145,178,0.12)', fg: '#0891B2' },
    delivered: { bg: 'rgba(22,163,74,0.12)', fg: '#16A34A' },
    completed: { bg: 'rgba(22,163,74,0.12)', fg: '#16A34A' },
    cancelled: { bg: 'rgba(220,38,38,0.10)', fg: '#DC2626' },
    rejected: { bg: 'rgba(220,38,38,0.10)', fg: '#DC2626' },
  };
  const c = map[status] || { bg: '#F1F3F5', fg: '#6B7280' };
  return {
    background: c.bg,
    color: c.fg,
    fontSize: 9.5,
    fontWeight: 800,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    padding: '4px 9px',
    borderRadius: 6,
    whiteSpace: 'nowrap',
  };
}

export function paymentBadgeStyle(order: OpsStorefrontOrder): CSSProperties {
  const ps = order.paymentStatus;
  const c =
    ps === 'paid'
      ? { bg: 'rgba(22,163,74,0.12)', fg: '#16A34A' }
      : ps === 'failed' || ps === 'cancelled'
        ? { bg: 'rgba(220,38,38,0.10)', fg: '#DC2626' }
        : { bg: '#F1F3F5', fg: '#6B7280' };
  return {
    background: c.bg,
    color: c.fg,
    fontSize: 9.5,
    fontWeight: 800,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    padding: '4px 9px',
    borderRadius: 6,
    whiteSpace: 'nowrap',
  };
}

export function paymentBadgeText(order: OpsStorefrontOrder): string {
  return `${order.paymentMethod || 'payment'} · ${order.paymentStatus || 'n/a'}`;
}

export function chipStyle(): CSSProperties {
  return {
    background: '#F3F4F6',
    color: '#374151',
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: '0.03em',
    textTransform: 'uppercase',
    padding: '3px 8px',
    borderRadius: 5,
    whiteSpace: 'nowrap',
  };
}

/**
 * One <style> block for the Order Hub surfaces — the ordered-item product
 * identity block: a visibly large media container, an always-visible accent
 * title + open icon + "Open in Products & Inventory" hint, and one combined
 * clickable target. Render <style>{ORDER_HUB_CSS}</style> once per page.
 */
export const ORDER_HUB_CSS = `
.ordhub-media {
  width: 104px; height: 104px; border-radius: 10px; flex-shrink: 0;
  background: linear-gradient(135deg,#E8EDF2,#F1F3F5);
  border: 1px solid #E8EDF2; overflow: hidden;
  display: flex; align-items: center; justify-content: center;
  transition: box-shadow .12s ease, border-color .12s ease;
}
.ordhub-media img { width: 100%; height: 100%; object-fit: cover; display: block; }
.ordhub-media--md { width: 76px; height: 76px; border-radius: 8px; }
@media (max-width: 900px) { .ordhub-media { width: 76px; height: 76px; } }
@media (max-width: 640px) {
  .ordhub-media { width: 62px; height: 62px; }
  .ordhub-media--md { width: 60px; height: 60px; }
}
.ordhub-identity { display: flex; gap: 14px; align-items: flex-start; min-width: 0; text-decoration: none; color: inherit; border-radius: 10px; }
.ordhub-identity--md { gap: 12px; }
.ordhub-idtext { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.ordhub-idtitlerow { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.ordhub-idtitle { color: var(--cms-accent); font-weight: 800; font-size: 14.5px; overflow-wrap: anywhere; }
.ordhub-identity--md .ordhub-idtitle { font-size: 13px; }
.ordhub-idopenicon { width: 13px; height: 13px; color: var(--cms-accent); flex-shrink: 0; }
.ordhub-idmeta { font-size: 10.5px; color: #6B7280; font-weight: 600; overflow-wrap: anywhere; }
.ordhub-idhint { font-size: 10px; font-weight: 800; letter-spacing: .02em; color: #9CA3AF; margin-top: 2px; text-transform: none; }
a.ordhub-identity:hover .ordhub-media,
a.ordhub-identity:focus-visible .ordhub-media { border-color: var(--cms-accent); box-shadow: 0 3px 12px rgba(0,0,0,0.14); }
a.ordhub-identity:hover .ordhub-idtitle,
a.ordhub-identity:focus-visible .ordhub-idtitle { text-decoration: underline; text-underline-offset: 2px; }
a.ordhub-identity:hover .ordhub-idhint,
a.ordhub-identity:focus-visible .ordhub-idhint { color: var(--cms-accent); }
a.ordhub-identity:focus-visible { outline: 2px solid color-mix(in srgb, var(--cms-accent) 45%, transparent); outline-offset: 2px; }
`;

/**
 * Fetch CURRENT product thumbnails for a bounded set of ordered items (Full
 * Details / Quick View only — never the Hub list: that would be N+1). The
 * historical snapshot (title / price / variant) always stays from the order;
 * only the photo comes from live catalog, and an archived / unavailable /
 * 404 product falls back to the neutral placeholder. One parallel GET per
 * distinct productId, deduped and cached for the component's lifetime.
 */
export function useOrderedItemThumbs(items: Array<Pick<OpsOrderItem, 'productId'>>): Map<string, string> {
  const [map, setMap] = useState<Map<string, string>>(new Map());
  const seen = useRef<Set<string>>(new Set());

  const ids = Array.from(
    new Set(items.map((it) => String(it.productId || '').trim()).filter(Boolean)),
  ).join(',');

  useEffect(() => {
    const wanted = ids ? ids.split(',') : [];
    const todo = wanted.filter((id) => !seen.current.has(id));
    if (todo.length === 0) return;
    todo.forEach((id) => seen.current.add(id));
    let cancelled = false;
    void Promise.allSettled(todo.map((id) => catalogApi.getProduct(id))).then((results) => {
      if (cancelled) return;
      setMap((prev) => {
        const next = new Map(prev);
        results.forEach((r, i) => {
          if (r.status === 'fulfilled' && r.value?.image) next.set(todo[i], r.value.image);
        });
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [ids]);

  return map;
}

/**
 * Ordered-item product identity — ONE combined clickable target
 * (media + title + open icon + "Open in Products & Inventory" hint) that
 * navigates to /admin/products/:productId/edit. Renders a plain block (no link,
 * no hint) when the item has no canonical productId (service line / purged
 * product) — the row still reads. `imageUrl` is the current catalog photo when
 * available; otherwise a neutral placeholder tile.
 */
export function ProductIdentityLink({
  productId,
  title,
  meta,
  imageUrl,
  size = 'lg',
}: {
  productId?: string | null;
  title: string;
  meta?: string;
  imageUrl?: string;
  size?: 'lg' | 'md';
}) {
  const [imgOk, setImgOk] = useState(true);
  const to = productStudioPath(productId);
  const mediaCls = `ordhub-media${size === 'md' ? ' ordhub-media--md' : ''}`;
  const media =
    imageUrl && imgOk ? (
      <div className={mediaCls}>
        <img src={imageUrl} alt={title} onError={() => setImgOk(false)} />
      </div>
    ) : (
      <div className={mediaCls} role="img" aria-label={title} />
    );

  const body = (
    <>
      {media}
      <div className="ordhub-idtext">
        <div className="ordhub-idtitlerow">
          <span className="ordhub-idtitle">{title}</span>
          {to && <ExternalLink className="ordhub-idopenicon" aria-hidden />}
        </div>
        {meta && <div className="ordhub-idmeta">{meta}</div>}
        {to && <div className="ordhub-idhint">Open in Products &amp; Inventory ↗</div>}
      </div>
    </>
  );

  const cls = `ordhub-identity${size === 'md' ? ' ordhub-identity--md' : ''}`;
  if (!to) return <div className={cls}>{body}</div>;
  return (
    <Link to={to} className={cls} title="Open in Products & Inventory" aria-label={`Open “${title}” in Products & Inventory`}>
      {body}
    </Link>
  );
}

export function actionBtnStyle(emphasis: boolean): CSSProperties {
  return emphasis
    ? {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        background: ACCENT_WASH,
        border: '1px solid color-mix(in srgb, var(--cms-accent) 30%, transparent)',
        color: '#C2410C',
        borderRadius: 6,
        padding: '8px 14px',
        fontSize: 10.5,
        fontWeight: 800,
        cursor: 'pointer',
        textDecoration: 'none',
        whiteSpace: 'nowrap',
      }
    : {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        background: '#fff',
        border: '1px solid #E8EDF2',
        color: '#374151',
        borderRadius: 6,
        padding: '8px 14px',
        fontSize: 10.5,
        fontWeight: 700,
        cursor: 'pointer',
        textDecoration: 'none',
        whiteSpace: 'nowrap',
      };
}
