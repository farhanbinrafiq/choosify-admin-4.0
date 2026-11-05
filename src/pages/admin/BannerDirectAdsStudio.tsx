import React, { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, Loader2, Plus, XCircle } from 'lucide-react';
import { AD_PLACEMENTS, getAnyPlacementDef, getFormatDef, getPlacementDef } from '@/shared/ads/placementRegistry';
import { inferHeroMediaType } from '@/shared/ads/heroMedia';
import { useAuth } from '../../contexts/AuthContext';
import { adsApi, type AdsApiRecord } from '../../services/adsApi';

const SellerDeals = lazy(() => import('./SellerDeals'));

type StatusFilter =
  | 'all'
  | 'draft'
  | 'pending'
  | 'active'
  | 'paused'
  | 'disabled'
  | 'rejected'
  | 'approved';

type SortKey = 'updated_desc' | 'updated_asc' | 'created_desc' | 'created_asc' | 'ref_asc' | 'ref_desc' | 'title_asc' | 'status' | 'page' | 'format';

const SORTS: Array<{ key: SortKey; label: string }> = [
  { key: 'updated_desc', label: 'Last updated (newest first)' },
  { key: 'updated_asc', label: 'Last updated (oldest first)' },
  { key: 'created_desc', label: 'Created (newest first)' },
  { key: 'created_asc', label: 'Created (oldest first)' },
  { key: 'ref_asc', label: 'AD number (low → high)' },
  { key: 'ref_desc', label: 'AD number (high → low)' },
  { key: 'title_asc', label: 'Title (A → Z)' },
  { key: 'status', label: 'Status (live first)' },
  { key: 'page', label: 'Page' },
  { key: 'format', label: 'Format' },
];

const STATUS_ORDER = ['active', 'approved', 'pending', 'paused', 'draft', 'rejected', 'disabled', 'cancelled'];
const refNum = (r: AdsApiRecord) => Number(String(r.advertisementReferenceId || '').replace(/\D/g, '')) || Number.MAX_SAFE_INTEGER;

function sortRows(list: AdsApiRecord[], key: SortKey): AdsApiRecord[] {
  const s = list.slice();
  const by = (f: (r: AdsApiRecord) => string | number, dir = 1) =>
    s.sort((a, b) => {
      const x = f(a);
      const y = f(b);
      const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
      return c * dir || b.updatedAt.localeCompare(a.updatedAt);
    });
  switch (key) {
    case 'updated_asc': return by((r) => r.updatedAt);
    case 'created_desc': return by((r) => r.createdAt, -1);
    case 'created_asc': return by((r) => r.createdAt);
    case 'ref_asc': return by(refNum);
    case 'ref_desc': return by((r) => (refNum(r) === Number.MAX_SAFE_INTEGER ? -1 : refNum(r)), -1);
    case 'title_asc': return by((r) => (r.title || '').toLowerCase());
    case 'status': return by((r) => { const i = STATUS_ORDER.indexOf(r.status); return i < 0 ? 99 : i; });
    case 'page': return by((r) => getPlacementDef(r.placementId)?.pageLabel || getAnyPlacementDef(r.placementId)?.pageLabel || '~');
    case 'format': return by((r) => getFormatDef(r.formatId)?.label || '~');
    default: return by((r) => r.updatedAt, -1);
  }
}

const FILTERS: Array<{ key: StatusFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Draft' },
  { key: 'pending', label: 'Pending Approval' },
  { key: 'active', label: 'Active' },
  { key: 'approved', label: 'Approved' },
  { key: 'paused', label: 'Paused' },
  { key: 'disabled', label: 'Disabled' },
  { key: 'rejected', label: 'Rejected' },
];

function statusBadge(status: string) {
  const map: Record<string, string> = {
    active: 'background:#DCFCE7;color:#166534',
    pending: 'background:#FFEDD5;color:#9A3412',
    draft: 'background:#F3F4F6;color:#374151',
    approved: 'background:#DBEAFE;color:#1E40AF',
    paused: 'background:#FEF3C7;color:#92400E',
    disabled: 'background:#F3F4F6;color:#6B7280',
    rejected: 'background:#FEE2E2;color:#991B1B',
  };
  return map[status] || 'background:#F3F4F6;color:#374151';
}

/**
 * Ads & Deals Studio tabs. Sellers get Deals (Create Deal + My Deals); admins
 * manage Deals in the Deals Manager (/admin/deals); creators have no
 * Deals in v1. Tab lives in ?tab=deals so no new route is needed.
 */
export default function BannerDirectAdsStudio() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { profile } = useAuth();
  const role = String(profile?.role || '');
  const isSeller = role === 'seller' || role === 'verified_seller';
  const tab = isSeller && searchParams.get('tab') === 'deals' ? 'deals' : 'ads';

  const tabs = isSeller ? (
    <div className="mx-auto max-w-[1400px] px-4 pt-5 md:px-6" role="tablist">
      <div className="inline-flex rounded-lg border border-[#E8EDF2] bg-white p-1">
        {([
          ['ads', 'Banner / Direct Ads'],
          ['deals', 'Deals'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setSearchParams(key === 'deals' ? { tab: 'deals' } : {})}
            // Selected tabs use a light wash: the platform's global
            // `main [role="tab"][aria-selected="true"]` rule forces dark text.
            className={`rounded-md px-3.5 py-1.5 text-[11.5px] font-extrabold outline-none ${
              tab === key
                ? 'bg-[#FFF1EE] text-[#111827] shadow-[inset_0_0_0_1px_rgba(239,60,35,0.35)]'
                : 'text-[#374151] hover:bg-[#F9FAFB]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  ) : null;

  if (tab === 'deals') {
    return (
      <>
        {tabs}
        <div className="mx-auto max-w-[1400px] px-4 py-5 md:px-6">
          <Suspense fallback={<Loader2 className="h-4 w-4 animate-spin" />}>
            <SellerDeals />
          </Suspense>
        </div>
      </>
    );
  }
  return (
    <>
      {tabs}
      <BannerAdsList />
    </>
  );
}

function BannerAdsList() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';
  const [rows, setRows] = useState<AdsApiRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [sort, setSort] = useState<SortKey>(() => {
    try {
      const v = localStorage.getItem('choosify.adsList.sort') as SortKey | null;
      return v && SORTS.some((s) => s.key === v) ? v : 'updated_desc';
    } catch {
      return 'updated_desc';
    }
  });
  const chooseSort = (v: SortKey) => {
    setSort(v);
    try {
      localStorage.setItem('choosify.adsList.sort', v);
    } catch {
      /* remembered for this visit only */
    }
  };
  const [busyId, setBusyId] = useState<string | null>(null);
  /** Ticked rows (bulk Duplicate / Delete). */
  const [selected, setSelected] = useState<Set<string>>(new Set());
  /** Attention dialog before Duplicate / Delete. */
  const [confirm, setConfirm] = useState<{ kind: 'duplicate' | 'delete'; ids: string[]; openCopy?: boolean } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adsApi.listBanners();
      setRows(data.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load banners');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(
    () => sortRows(filter === 'all' ? rows : rows.filter((r) => r.status === filter), sort),
    [rows, filter, sort],
  );
  const selectableIds = useMemo(
    () => filtered.filter((r) => r.kind === 'banner' || r.kind === 'external').map((r) => r.id),
    [filtered],
  );
  const allTicked = selectableIds.length > 0 && selectableIds.every((x) => selected.has(x));

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const refOf = (id: string) => {
    const r = rows.find((x) => x.id === id);
    return r?.advertisementReferenceId || r?.title || id;
  };

  /** Runs the confirmed Duplicate / Delete on every chosen ad, one by one, and reports the result. */
  const runConfirmed = async () => {
    if (!confirm) return;
    const { kind, ids, openCopy } = confirm;
    setConfirm(null);
    setBulkBusy(true);
    setError(null);
    setNotice(null);
    const done: string[] = [];
    const skipped: string[] = [];
    const failed: string[] = [];
    let lastCopyId: string | null = null;
    for (const id of ids) {
      const row = rows.find((x) => x.id === id);
      try {
        if (kind === 'duplicate') {
          const copy = await adsApi.duplicateAd(id);
          lastCopyId = copy.id;
          done.push(copy.advertisementReferenceId || copy.id);
        } else {
          if (row?.status === 'active') {
            skipped.push(refOf(id));
            continue;
          }
          await adsApi.deleteAd(id);
          done.push(refOf(id));
        }
      } catch (err) {
        failed.push(`${refOf(id)} (${err instanceof Error ? err.message : 'failed'})`);
      }
    }
    setBulkBusy(false);
    setSelected(new Set());
    if (kind === 'duplicate' && openCopy && lastCopyId && !failed.length) {
      navigate(`/admin/ads-studio/${encodeURIComponent(lastCopyId)}/edit`);
      return;
    }
    const parts = [
      done.length ? (kind === 'duplicate' ? `${done.length} draft cop${done.length === 1 ? 'y' : 'ies'} created: ${done.join(', ')} — open each, choose where it goes, then publish.` : `${done.length} ad${done.length === 1 ? '' : 's'} deleted: ${done.join(', ')}.`) : '',
      skipped.length ? `Not deleted (live on the storefront — pause or disable first): ${skipped.join(', ')}.` : '',
    ].filter(Boolean);
    if (parts.length) setNotice(parts.join(' '));
    if (failed.length) setError(`Could not ${kind}: ${failed.join('; ')}`);
    await load();
  };

  const move = async (id: string, placementId: string, label: string) => {
    if (!placementId) return;
    if (!window.confirm(`Move this ad to "${label}"? Its approval status stays the same, and the image is re-checked for the new slot.`)) return;
    setBusyId(id);
    setError(null);
    try {
      await adsApi.moveAd(id, placementId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Move failed');
    } finally {
      setBusyId(null);
    }
  };

  const act = async (id: string, action: 'approve' | 'reject' | 'pause' | 'disable' | 'publish') => {
    setBusyId(id);
    setError(null);
    try {
      if (action === 'approve') await adsApi.approveBanner(id);
      if (action === 'reject') await adsApi.rejectBanner(id, 'Rejected by admin');
      if (action === 'pause') await adsApi.pauseAd(id);
      if (action === 'disable') await adsApi.disableAd(id);
      if (action === 'publish') await adsApi.publishAd(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-5 md:px-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[15px] font-extrabold text-[#111827]">Banner / Direct Ads</div>
          <div className="text-[11px] font-semibold text-[#6B7280]">
            Create and manage storefront ad placements · Ads & Deals Studio
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate('/admin/ads-studio/new')}
          className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#EF3C23] to-[#D4331B] px-4 py-2.5 text-[12px] font-extrabold text-white"
        >
          <Plus className="h-4 w-4" /> Create Ad
        </button>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-3 py-1.5 text-[10px] font-extrabold ${
              filter === f.key ? 'bg-[#111827] text-white' : 'bg-[#F3F4F6] text-[#374151]'
            }`}
          >
            {f.label}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-1.5 text-[10.5px] font-extrabold uppercase tracking-wide text-[#6B7280]">
          Sort by
          <select
            value={sort}
            onChange={(e) => chooseSort(e.target.value as SortKey)}
            className="rounded-lg border border-[#E8EDF2] bg-white px-2 py-1.5 text-[11.5px] font-bold normal-case tracking-normal text-[#111827]"
            data-testid="ads-sort"
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-700">
          {error}
        </div>
      ) : null}

      {notice ? (
        <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] font-semibold text-emerald-800" role="status" data-testid="ads-bulk-notice">
          {notice}
        </div>
      ) : null}
      {selected.size > 0 ? (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-[#FFD8C7] bg-[#FFF4EE] px-3 py-2 text-[12px] font-bold text-[#111827]" data-testid="ads-bulk-bar">
          <span>{selected.size} selected</span>
          <button
            type="button"
            disabled={bulkBusy}
            onClick={() => setConfirm({ kind: 'duplicate', ids: [...selected] })}
            className="rounded-md border border-[#E8EDF2] bg-white px-2.5 py-1 text-[11px] font-extrabold"
            data-testid="ads-bulk-duplicate"
          >
            Duplicate
          </button>
          <button
            type="button"
            disabled={bulkBusy}
            onClick={() => setConfirm({ kind: 'delete', ids: [...selected] })}
            className="rounded-md border border-red-200 bg-white px-2.5 py-1 text-[11px] font-extrabold text-red-700"
            data-testid="ads-bulk-delete"
          >
            Delete
          </button>
          <button type="button" onClick={() => setSelected(new Set())} className="text-[11px] font-bold text-[#6B7280] hover:underline">
            Clear selection
          </button>
          {bulkBusy ? <Loader2 className="h-4 w-4 animate-spin text-[#EF3C23]" /> : null}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-[12px] text-[#6B7280]">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="overflow-hidden rounded-[5px] border border-[#E8EDF2] bg-white">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-[#F9FAFB]">
                <th className="w-8 px-3 py-2.5">
                  <input
                    type="checkbox"
                    aria-label="Select all ads shown"
                    checked={allTicked}
                    onChange={() => setSelected(allTicked ? new Set() : new Set(selectableIds))}
                    data-testid="ads-select-all"
                  />
                </th>
                <th className="px-2 py-2.5 text-[10px] font-extrabold uppercase tracking-wide text-[#6B7280]">SL</th>
                {['Creative', 'Advertiser', 'Format', 'Page', 'Placement', 'Owner', 'Status', 'Updated', 'Actions'].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-3 py-2.5 text-[10px] font-extrabold uppercase tracking-wide text-[#6B7280]"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-3 py-8 text-center text-[12px] text-[#9CA3AF]">
                    No banner / direct ads yet. Click Create Ad to open the Visual Builder.
                  </td>
                </tr>
              ) : (
                filtered.map((row, idx) => {
                  const creative = (row.creative || {}) as Record<string, string>;
                  const format = getFormatDef(row.formatId);
                  const placement = getPlacementDef(row.placementId);
                  const mediaType = inferHeroMediaType(
                    creative.videoUrl || creative.imageUrl,
                    creative.mediaType,
                  );
                  const textOnly = Boolean(format && !format.imageLed);
                  const mediaLabel = textOnly ? 'Text' : mediaType === 'video' ? 'Video' : mediaType === 'gif' ? 'GIF' : 'Image';
                  const thumbUrl =
                    mediaType === 'video'
                      ? creative.posterUrl || creative.imageUrl
                      : creative.imageUrl;
                  return (
                    <tr key={row.id} className={`border-t border-[#F1F3F5] ${selected.has(row.id) ? 'bg-[#FFF8F4]' : ''}`}>
                      <td className="px-3 py-2.5">
                        {row.kind === 'banner' || row.kind === 'external' ? (
                          <input
                            type="checkbox"
                            aria-label={`Select ${row.advertisementReferenceId || row.title}`}
                            checked={selected.has(row.id)}
                            onChange={() => toggle(row.id)}
                            data-testid={`ads-select-${row.id}`}
                          />
                        ) : null}
                      </td>
                      <td className="px-2 py-2.5 align-middle" data-testid={`ads-sl-${row.id}`}>
                        <div className="text-[12px] font-extrabold text-[#111827]">{idx + 1}</div>
                        {row.advertisementReferenceId ? (
                          <div className="font-mono text-[9.5px] font-bold text-[#6B7280]">{row.advertisementReferenceId}</div>
                        ) : null}
                      </td>
                      <td className="px-3 py-2.5">
                        <button
                          type="button"
                          onClick={() => navigate(`/admin/ads-studio/${encodeURIComponent(row.id)}/edit`)}
                          className="flex items-center gap-2 text-left"
                        >
                          {textOnly ? (
                            <div
                              className="flex h-10 w-14 shrink-0 items-center justify-center rounded text-[13px] font-extrabold"
                              style={{ background: 'linear-gradient(135deg,#2A1846,#FF5B00)', color: '#FFFFFF' }}
                              title="Text ad — this format has no image (headline + button on a gradient)"
                              data-testid={`ads-thumb-text-${row.id}`}
                            >
                              Aa
                            </div>
                          ) : (
                            <div
                              className="flex h-10 w-14 shrink-0 items-center justify-center rounded bg-[#F3F4F6] text-[8.5px] font-extrabold uppercase text-amber-700"
                              style={
                                thumbUrl
                                  ? {
                                      backgroundImage: `url(${thumbUrl})`,
                                      backgroundSize: 'cover',
                                      backgroundPosition: 'center',
                                    }
                                  : undefined
                              }
                              title={thumbUrl ? undefined : 'No image uploaded yet — this format needs one before it can go live'}
                            >
                              {thumbUrl ? null : 'No image'}
                            </div>
                          )}
                          <div>
                            <div className="text-[12px] font-bold text-[#111827]">{row.title}</div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[9px] font-extrabold uppercase tracking-wide text-[#6B7280] bg-[#F3F4F6] px-1.5 py-0.5 rounded">
                                {mediaLabel}
                              </span>
                              <span className="text-[10px] text-[#9CA3AF] font-mono">{row.id.slice(0, 18)}…</span>
                            </div>
                          </div>
                        </button>
                      </td>
                      <td className="px-3 py-2.5 text-[12px] font-semibold text-[#374151]">
                        {creative.advertiserName || '—'}
                      </td>
                      <td className="px-3 py-2.5 text-[11px] text-[#6B7280]">{format?.label || row.formatId || '—'}</td>
                      <td className="px-3 py-2.5 text-[11px] text-[#6B7280]">
                        {placement?.pageLabel || row.pageKey || '—'}
                      </td>
                      <td className="px-3 py-2.5 text-[11px] text-[#6B7280]">
                        {placement?.slotLabel || getAnyPlacementDef(row.placementId)?.slotLabel || row.placementId || row.placement || '—'}
                        {!placement && getAnyPlacementDef(row.placementId) ? (
                          <div className="text-[9.5px] font-bold text-red-600" data-testid="ads-slot-retired">Slot retired — move this ad</div>
                        ) : null}
                        {isAdmin && (row.kind === 'banner' || row.kind === 'external') ? (
                          <select
                            className="mt-1 block max-w-[170px] rounded border border-[#E8EDF2] px-1 py-0.5 text-[10px]"
                            value=""
                            disabled={busyId === row.id}
                            data-testid={`ads-move-${row.id}`}
                            onChange={(e) => {
                              const target = AD_PLACEMENTS.find((p) => p.placementId === e.target.value);
                              if (target) void move(row.id, target.placementId, `${target.pageLabel} · ${target.slotLabel}`);
                            }}
                          >
                            <option value="">Move to…</option>
                            {AD_PLACEMENTS.filter((p) => p.active && p.placementId !== row.placementId && p.allowedFormats.includes(row.formatId as never)).map((p) => (
                              <option key={p.placementId} value={p.placementId}>
                                {p.pageLabel} · {p.slotLabel}
                              </option>
                            ))}
                          </select>
                        ) : null}
                        {row.kind === 'banner' || row.kind === 'external' ? (
                          <button
                            type="button"
                            disabled={busyId === row.id}
                            onClick={() => setConfirm({ kind: 'duplicate', ids: [row.id], openCopy: true })}
                            className="mt-1 block text-[10px] font-extrabold text-[#EF3C23] hover:underline"
                            data-testid={`ads-duplicate-${row.id}`}
                          >
                            Duplicate
                          </button>
                        ) : null}
                      </td>
                      <td className="px-3 py-2.5 text-[11px] text-[#6B7280]">
                        {row.ownerRole}
                        {isAdmin && row.status === 'pending' ? (
                          <div className="text-[9.5px] font-bold text-amber-700">⚑ Pending request</div>
                        ) : null}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className="rounded px-2 py-0.5 text-[10px] font-extrabold uppercase"
                          style={Object.fromEntries(
                            statusBadge(row.status)
                              .split(';')
                              .filter(Boolean)
                              .map((p) => {
                                const [k, v] = p.split(':');
                                return [k.trim(), v.trim()];
                              }),
                          )}
                        >
                          {row.status}
                        </span>
                        {row.delivery ? (
                          row.delivery.delivered ? (
                            <div className="mt-1 text-[9.5px] font-extrabold text-emerald-700" data-testid="ads-delivered">● On the storefront</div>
                          ) : (
                            <div className="mt-1 max-w-[200px] text-[9.5px] font-semibold text-slate-500" data-testid="ads-not-delivered" title={row.delivery.problems.join(' · ')}>
                              Not shown: {row.delivery.problems[0]}
                            </div>
                          )
                        ) : null}
                      </td>
                      <td className="px-3 py-2.5 text-[10px] text-[#9CA3AF]">
                        {new Date(row.updatedAt).toLocaleString()}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() => navigate(`/admin/ads-studio/${encodeURIComponent(row.id)}/edit`)}
                            className="rounded-md border border-[#E8EDF2] bg-white px-2 py-1 text-[10px] font-extrabold"
                          >
                            Edit
                          </button>
                          {isAdmin && row.status === 'pending' ? (
                            <>
                              <button
                                type="button"
                                disabled={busyId === row.id}
                                onClick={() => void act(row.id, 'approve')}
                                className="inline-flex items-center gap-1 rounded-md bg-[#16A34A] px-2 py-1 text-[10px] font-extrabold text-white"
                              >
                                <CheckCircle className="h-3 w-3" /> Approve
                              </button>
                              <button
                                type="button"
                                disabled={busyId === row.id}
                                onClick={() => void act(row.id, 'reject')}
                                className="inline-flex items-center gap-1 rounded-md border border-[#E8EDF2] px-2 py-1 text-[10px] font-extrabold text-[#DC2626]"
                              >
                                <XCircle className="h-3 w-3" /> Reject
                              </button>
                            </>
                          ) : null}
                          {isAdmin && (row.kind === 'banner' || row.kind === 'external') && ['draft', 'approved', 'paused', 'disabled'].includes(row.status) ? (
                            <button
                              type="button"
                              disabled={busyId === row.id}
                              onClick={() => void act(row.id, 'publish')}
                              className="rounded-md bg-emerald-600 px-2 py-1 text-[10px] font-extrabold text-white"
                              data-testid={`ads-publish-${row.id}`}
                            >
                              {row.status === 'paused' || row.status === 'disabled' ? 'Resume' : 'Publish'}
                            </button>
                          ) : null}
                          {isAdmin && row.status === 'active' ? (
                            <button
                              type="button"
                              disabled={busyId === row.id}
                              onClick={() => void act(row.id, 'pause')}
                              className="rounded-md border border-[#E8EDF2] px-2 py-1 text-[10px] font-extrabold"
                            >
                              Pause
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {confirm ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" data-testid="ads-confirm">
          <div className="w-full max-w-[460px] rounded-xl bg-white p-5 shadow-xl">
            <div className="flex items-start gap-3">
              <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[16px] font-extrabold ${confirm.kind === 'delete' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>!</span>
              <div className="min-w-0">
                <div className="text-[15px] font-extrabold text-[#111827]">
                  {confirm.kind === 'duplicate'
                    ? `Duplicate ${confirm.ids.length === 1 ? refOf(confirm.ids[0]) : `${confirm.ids.length} ads`}?`
                    : `Delete ${confirm.ids.length === 1 ? refOf(confirm.ids[0]) : `${confirm.ids.length} ads`}?`}
                </div>
                {confirm.kind === 'duplicate' ? (
                  <div className="mt-1.5 space-y-1 text-[12.5px] text-[#4B5563]">
                    <p>A copy of {confirm.ids.length === 1 ? 'this ad' : 'each ad'} is made with the same design, text, link and place, and its own AD number.</p>
                    <p className="font-semibold text-[#92400E]">Copies are saved as drafts and are NOT on the storefront. Open each copy, choose the page and place it should go, then publish it.</p>
                    {confirm.openCopy ? <p>The copy opens straight away.</p> : null}
                  </div>
                ) : (
                  <div className="mt-1.5 space-y-1 text-[12.5px] text-[#4B5563]">
                    <p className="font-semibold text-red-700">This permanently removes {confirm.ids.length === 1 ? 'the ad' : 'these ads'} and cannot be undone.</p>
                    {confirm.ids.some((x) => rows.find((r) => r.id === x)?.status === 'active') ? (
                      <p>Ads that are live on the storefront are skipped — pause or disable them first.</p>
                    ) : null}
                  </div>
                )}
                {confirm.ids.length > 1 ? (
                  <div className="mt-2 max-h-24 overflow-auto rounded border border-[#F1F3F5] bg-[#F9FAFB] px-2 py-1 font-mono text-[10.5px] text-[#374151]">
                    {confirm.ids.map((x) => refOf(x)).join(', ')}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirm(null)} className="rounded-lg border border-[#E8EDF2] px-3.5 py-2 text-[12px] font-extrabold text-[#374151]" data-testid="ads-confirm-cancel">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void runConfirmed()}
                className={`rounded-lg px-3.5 py-2 text-[12px] font-extrabold text-white ${confirm.kind === 'delete' ? 'bg-red-600' : 'bg-[#EF3C23]'}`}
                data-testid="ads-confirm-ok"
              >
                {confirm.kind === 'duplicate' ? (confirm.ids.length === 1 ? 'Duplicate' : `Duplicate ${confirm.ids.length}`) : confirm.ids.length === 1 ? 'Delete' : `Delete ${confirm.ids.length}`}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
