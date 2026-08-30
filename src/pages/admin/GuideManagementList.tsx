import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Archive,
  BookOpen,
  ExternalLink,
  Plus,
  RotateCw,
  Search,
} from 'lucide-react';
import { catalogApi, type GuideManageRow } from '../../services/catalogApi';

/**
 * Guide Management — real canonical list backed by the authenticated,
 * ownership-scoped `GET /catalog/guides/manage` endpoint.
 *
 * NOT the storefront-parity Guide Studio (that is a later pass). This is the
 * management entry surface: search, filter, status, thumbnail, CT reference,
 * timestamps, Create, open in editor, Archive.
 */

type StatusFilter = 'all' | 'draft' | 'live' | 'archived';

const STATUS_STYLE: Record<string, string> = {
  live: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  draft: 'bg-amber-50 text-amber-700 border-amber-100',
  archived: 'bg-[#F3F4F6] text-[#6B7280] border-[#E5E7EB]',
};

const FORMAT_LABEL: Record<string, string> = {
  buying_guide: 'Buying Guide',
  product_review: 'Product Review',
  comparison: 'Comparison',
  live: 'Live / Ask & Shop',
  tutorial: 'Tutorial',
  tips: 'Tips',
};

function fmtDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function GuideManagementList() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<GuideManageRow[]>([]);
  const [scope, setScope] = useState<'staff' | 'creator'>('creator');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    catalogApi
      .manageGuides({ status: 'all' })
      .then((res) => {
        if (cancelled) return;
        setRows(res.data);
        setScope(res.scope);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to load guides');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadNonce]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== 'all' && r.status !== status) return false;
      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q) ||
        (r.publisherName || '').toLowerCase().includes(q) ||
        (r.contentReferenceId || '').toLowerCase().includes(q) ||
        (r.format || '').toLowerCase().includes(q)
      );
    });
  }, [rows, query, status]);

  const counts = useMemo(() => {
    const c = { all: rows.length, draft: 0, live: 0, archived: 0 };
    for (const r of rows) c[r.status] += 1;
    return c;
  }, [rows]);

  const archive = async (id: string) => {
    setBusyId(id);
    try {
      await catalogApi.archiveGuide(id);
      setReloadNonce((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Archive failed');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5 pb-12 text-left bg-[#F9FAFB] text-[#111827] -m-6 p-6 min-h-screen">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white border border-[#E5E7EB] p-5 rounded-2xl shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="bg-[#EF3C23]/10 text-[#EF3C23] p-1.5 rounded-lg border border-[#EF3C23]/20">
              <BookOpen className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold tracking-tight">Guide Management</h1>
          </div>
          <p className="text-[#6B7280] text-[12px]">
            {scope === 'staff'
              ? 'All Choosify guides, stories, videos, reels and live sessions.'
              : 'Your published and draft guides, stories, videos, reels and live sessions.'}
          </p>
        </div>
        <Link
          to="/admin/guides/new"
          className="flex items-center gap-2 bg-[#EF3C23] hover:bg-[#CF3319] text-white px-5 py-3 rounded-xl text-xs font-bold transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" /> Create Guide / Story
        </Link>
      </div>

      <div className="bg-white border border-[#E5E7EB] p-4 rounded-2xl shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="w-full md:w-96 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl flex items-center px-3.5 gap-2.5">
          <Search className="w-4 h-4 text-[#6B7280]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title, creator, format, CT reference…"
            className="flex-1 py-2.5 text-xs bg-transparent outline-none placeholder-[#9CA3AF]"
          />
        </div>
        <div className="flex gap-1 bg-[#F9FAFB] border border-[#E5E7EB] p-1 rounded-xl self-start md:self-auto">
          {(['all', 'draft', 'live', 'archived'] as StatusFilter[]).map((st) => (
            <button
              key={st}
              onClick={() => setStatus(st)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors ${
                status === st ? 'bg-[#1A1A2E] text-white' : 'text-[#6B7280] hover:bg-slate-100'
              }`}
            >
              {st} ({counts[st]})
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-[#6B7280]">
          <RotateCw className="w-5 h-5 animate-spin text-[#EF3C23]" />
          <span className="text-xs font-mono">Loading guides…</span>
        </div>
      ) : error ? (
        <div className="bg-white border border-rose-200 rounded-2xl p-8 text-center">
          <p className="text-sm font-bold text-rose-600 m-0 mb-1">Could not load guides</p>
          <p className="text-[12px] text-[#6B7280] m-0 mb-4">{error}</p>
          <button
            onClick={() => setReloadNonce((n) => n + 1)}
            className="px-4 py-2 rounded-lg text-[11px] font-extrabold text-white bg-[#EF3C23]"
          >
            Retry
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-16 text-center text-[#6B7280] flex flex-col items-center gap-3">
          <BookOpen className="w-10 h-10 text-[#9CA3AF]" />
          <div>
            <h4 className="text-sm font-bold text-[#111827] uppercase tracking-wider">No guides found</h4>
            <p className="text-[11px] max-w-sm">
              {rows.length === 0
                ? 'Create your first guide or story to get started.'
                : 'No guides match the current filter.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB] text-[9px] font-bold uppercase text-[#6B7280] tracking-wider">
                <th className="p-4">Guide / Story</th>
                <th className="p-4">Format · Media</th>
                {scope === 'staff' && <th className="p-4">Owner</th>}
                <th className="p-4">Relations</th>
                <th className="p-4">Status</th>
                <th className="p-4">Updated</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB]/60">
              {filtered.map((r) => (
                <tr
                  key={r.id}
                  className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                  onClick={() => navigate(`/admin/guides/${r.id}/edit`)}
                >
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-10 rounded-md bg-[#F1F3F5] overflow-hidden shrink-0">
                        {r.image ? (
                          <img src={r.image} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-[#111827] leading-snug line-clamp-2 max-w-xs">
                          {r.title || 'Untitled Guide'}
                        </div>
                        {r.contentReferenceId ? (
                          <div className="text-[9px] font-mono text-[#9CA3AF] mt-0.5">{r.contentReferenceId}</div>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="text-[11px] font-bold text-[#1A1A2E]">
                      {r.format ? FORMAT_LABEL[r.format] || r.format : '—'}
                    </div>
                    <div className="text-[10px] text-[#9CA3AF] uppercase">{r.type}</div>
                  </td>
                  {scope === 'staff' && (
                    <td className="p-4 text-[11px] text-[#4B5563]">
                      <span
                        className={`inline-block rounded px-1.5 py-0.5 text-[8.5px] font-extrabold uppercase mr-1.5 ${
                          r.publisherType === 'brand'
                            ? 'bg-[#EEF2FF] text-[#2323FF]'
                            : 'bg-[#F3E8FF] text-[#8A00C4]'
                        }`}
                      >
                        {r.publisherType}
                      </span>
                      {r.publisherName || r.publisherBrandId || r.creatorId || '—'}
                    </td>
                  )}
                  <td className="p-4 text-[11px] text-[#4B5563]">
                    {r.productCount} product{r.productCount === 1 ? '' : 's'} · {r.brandCount} brand
                    {r.brandCount === 1 ? '' : 's'}
                  </td>
                  <td className="p-4">
                    <span
                      className={`px-2.5 py-0.5 text-[8px] font-bold tracking-wider uppercase rounded border ${
                        STATUS_STYLE[r.status] || STATUS_STYLE.archived
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="p-4 text-[11px] text-[#6B7280]">{fmtDate(r.updatedAt)}</td>
                  <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-2">
                      {r.status === 'live' && r.slug ? (
                        <a
                          href={`http://localhost:5173/spotlight/${r.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 bg-slate-100 hover:bg-[#1A1A2E] text-[#1A1A2E] hover:text-white rounded-lg border border-[#E5E7EB] transition-colors"
                          title="View public page"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      ) : null}
                      {r.status !== 'archived' ? (
                        <button
                          onClick={() => archive(r.id)}
                          disabled={busyId === r.id}
                          className="p-1.5 bg-slate-100 hover:bg-amber-50 text-[#6B7280] hover:text-amber-700 rounded-lg border border-[#E5E7EB] transition-colors disabled:opacity-50"
                          title="Archive"
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
