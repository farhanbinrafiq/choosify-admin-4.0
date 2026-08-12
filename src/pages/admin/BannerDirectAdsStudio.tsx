import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Loader2, Plus, XCircle } from 'lucide-react';
import { getFormatDef, getPlacementDef } from '@/shared/ads/placementRegistry';
import { inferHeroMediaType } from '@/shared/ads/heroMedia';
import { useAuth } from '../../contexts/AuthContext';
import { adsApi, type AdsApiRecord } from '../../services/adsApi';

type StatusFilter =
  | 'all'
  | 'draft'
  | 'pending'
  | 'active'
  | 'paused'
  | 'disabled'
  | 'rejected'
  | 'approved';

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

export default function BannerDirectAdsStudio() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';
  const [rows, setRows] = useState<AdsApiRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [busyId, setBusyId] = useState<string | null>(null);

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
    () => (filter === 'all' ? rows : rows.filter((r) => r.status === filter)),
    [rows, filter],
  );

  const act = async (id: string, action: 'approve' | 'reject' | 'pause' | 'disable') => {
    setBusyId(id);
    setError(null);
    try {
      if (action === 'approve') await adsApi.approveBanner(id);
      if (action === 'reject') await adsApi.rejectBanner(id, 'Rejected by admin');
      if (action === 'pause') await adsApi.pauseAd(id);
      if (action === 'disable') await adsApi.disableAd(id);
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
          className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#C8321A] to-[#EF3C23] px-4 py-2.5 text-[12px] font-extrabold text-white"
        >
          <Plus className="h-4 w-4" /> Create Ad
        </button>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
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
      </div>

      {error ? (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-700">
          {error}
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
                  <td colSpan={9} className="px-3 py-8 text-center text-[12px] text-[#9CA3AF]">
                    No banner / direct ads yet. Click Create Ad to open the Visual Builder.
                  </td>
                </tr>
              ) : (
                filtered.map((row) => {
                  const creative = (row.creative || {}) as Record<string, string>;
                  const format = getFormatDef(row.formatId);
                  const placement = getPlacementDef(row.placementId);
                  const mediaType = inferHeroMediaType(
                    creative.videoUrl || creative.imageUrl,
                    creative.mediaType,
                  );
                  const mediaLabel =
                    mediaType === 'video' ? 'Video' : mediaType === 'gif' ? 'GIF' : 'Image';
                  const thumbUrl =
                    mediaType === 'video'
                      ? creative.posterUrl || creative.imageUrl
                      : creative.imageUrl;
                  return (
                    <tr key={row.id} className="border-t border-[#F1F3F5]">
                      <td className="px-3 py-2.5">
                        <button
                          type="button"
                          onClick={() => navigate(`/admin/ads-studio/${encodeURIComponent(row.id)}/edit`)}
                          className="flex items-center gap-2 text-left"
                        >
                          <div
                            className="h-10 w-14 shrink-0 rounded bg-[#F3F4F6]"
                            style={
                              thumbUrl
                                ? {
                                    backgroundImage: `url(${thumbUrl})`,
                                    backgroundSize: 'cover',
                                    backgroundPosition: 'center',
                                  }
                                : undefined
                            }
                          />
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
                        {placement?.slotLabel || row.placementId || row.placement || '—'}
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
    </div>
  );
}
