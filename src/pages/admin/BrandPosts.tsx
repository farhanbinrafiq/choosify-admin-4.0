import React, { useEffect, useMemo, useState } from 'react';
import { Megaphone, RefreshCw, Trash2, Eye, EyeOff, Search } from 'lucide-react';
import { catalogApi } from '../../services/catalogApi';
import type { CatalogBrandPost, CatalogBrandPostStatus } from '../../types/catalog';

const STATUS_OPTIONS: CatalogBrandPostStatus[] = ['scheduled', 'live', 'expired'];

export default function BrandPostsPage() {
  const [posts, setPosts] = useState<CatalogBrandPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | CatalogBrandPostStatus>('all');
  const [toast, setToast] = useState<string | null>(null);

  const loadPosts = async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await catalogApi.listBrandPosts();
      setPosts(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load brand posts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPosts();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return posts.filter((post) => {
      if (statusFilter !== 'all' && post.status !== statusFilter) return false;
      if (!q) return true;
      return (
        post.title.toLowerCase().includes(q) ||
        post.brandName.toLowerCase().includes(q) ||
        post.slug.toLowerCase().includes(q)
      );
    });
  }, [posts, query, statusFilter]);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 3000);
  };

  const updateStatus = async (post: CatalogBrandPost, status: CatalogBrandPostStatus) => {
    try {
      const saved = await catalogApi.updateBrandPost(post.id, { status });
      setPosts((prev) => prev.map((row) => (row.id === post.id ? saved : row)));
      showToast(`Updated "${post.title}" to ${status}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Update failed');
    }
  };

  const removePost = async (post: CatalogBrandPost) => {
    if (!window.confirm(`Delete "${post.title}"? This cannot be undone.`)) return;
    try {
      await catalogApi.deleteBrandPost(post.id);
      setPosts((prev) => prev.filter((row) => row.id !== post.id));
      showToast(`Deleted "${post.title}"`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-app-accent" />
            What&apos;s On — Brand Posts
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage sponsored brand moments, launches, and events shown on the public storefront.
          </p>
        </div>
        <button
          type="button"
          onClick={loadPosts}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search title, brand, or slug..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-900"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as 'all' | CatalogBrandPostStatus)}
          className="px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-900"
        >
          <option value="all">All statuses</option>
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500 uppercase text-[11px] tracking-wide">
              <tr>
                <th className="px-4 py-3">Post</th>
                <th className="px-4 py-3">Brand</th>
                <th className="px-4 py-3">Kind</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Published</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                    Loading brand posts...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                    No brand posts match your filters.
                  </td>
                </tr>
              ) : (
                filtered.map((post) => (
                  <tr key={post.id} className="border-t border-slate-100 hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{post.title}</div>
                      <div className="text-xs text-slate-500 mt-0.5">/{post.slug}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{post.brandName}</td>
                    <td className="px-4 py-3 capitalize text-slate-600">{post.kind.replace('_', ' ')}</td>
                    <td className="px-4 py-3">
                      <select
                        value={post.status}
                        onChange={(event) => updateStatus(post, event.target.value as CatalogBrandPostStatus)}
                        className="px-2 py-1 rounded border border-slate-200 bg-white text-slate-800 capitalize"
                      >
                        {STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{post.publishedAt}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => updateStatus(post, post.status === 'live' ? 'expired' : 'live')}
                          className="p-2 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600"
                          title={post.status === 'live' ? 'Hide from storefront' : 'Publish live'}
                        >
                          {post.status === 'live' ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => removePost(post)}
                          className="p-2 rounded-lg border border-red-200 hover:bg-red-50 text-red-600"
                          title="Delete post"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg bg-slate-900 text-white px-4 py-3 text-sm shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
