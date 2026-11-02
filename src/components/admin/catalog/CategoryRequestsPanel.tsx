import React, { useCallback, useEffect, useState } from 'react';
import { Inbox, Loader2 } from 'lucide-react';
import { catalogApi } from '../../../services/catalogApi';
import type { CatalogBrand, CatalogCategory } from '../../../types/catalog';
import { CategoryPicker, type CategoryChoice } from '../../catalog/CategoryPicker';

/**
 * Category requests: brands whose owner (seller sign-up / Brand Studio) or staff
 * (community profiles) typed "couldn't find my category". Staff add the missing
 * subcategory in this studio if it should exist, then file the brand under the
 * right Main › Subcategory here — which also clears the request — or dismiss it.
 * Shown only while requests are waiting.
 */
export function CategoryRequestsPanel({ refreshKey = 0 }: { refreshKey?: number }) {
  const [brands, setBrands] = useState<CatalogBrand[]>([]);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [choice, setChoice] = useState<CategoryChoice>({ categoryId: '', subcategoryId: '', categoryRequest: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [b, c] = await Promise.all([catalogApi.listBrands(), catalogApi.listCategories()]);
      setBrands(b.filter((x) => (x.categoryRequest || '').trim()));
      setCategories(c);
    } catch {
      // Panel is optional: the studio works without it.
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  if (loading || brands.length === 0) return null;

  const nameOf = (id?: string) => categories.find((c) => c.id === id)?.name;
  const save = async (brand: CatalogBrand, next: Partial<CatalogBrand>) => {
    setBusy(true);
    setError(null);
    try {
      await catalogApi.updateBrand(brand.id, next);
      setEditing(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update the brand.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="mb-4 rounded-xl border border-amber-200 bg-amber-50/60 p-4"
      data-testid="category-requests-panel"
    >
      <div className="flex items-center gap-2 text-[12px] font-black text-amber-900">
        <Inbox className="w-4 h-4" /> Category requests ({brands.length})
      </div>
      <p className="mt-1 text-[11px] text-amber-900/80">
        Brands that couldn't find a matching category. If the category should exist, add it as a subcategory below, then file the
        brand under it. Each brand is already listed under its closest main category.
      </p>
      {error && <p className="mt-2 text-[11px] font-bold text-red-600">{error}</p>}
      <div className="mt-3 divide-y divide-amber-200/70">
        {brands.map((b) => (
          <div key={b.id} className="py-2.5" data-testid="category-request-row">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-[12px] font-bold text-slate-900">{b.name}</span>
              <span className="rounded bg-white px-2 py-0.5 text-[11px] font-bold text-amber-800 border border-amber-200">
                asked for “{b.categoryRequest}”
              </span>
              <span className="text-[10.5px] text-slate-500">
                now in {[nameOf(b.categoryId) || b.category, b.subcategoryName].filter(Boolean).join(' › ') || '—'}
              </span>
              <span className="ml-auto flex gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[10.5px] font-bold"
                  onClick={() => {
                    setEditing(editing === b.id ? null : b.id);
                    setChoice({ categoryId: b.categoryId || '', subcategoryId: b.subcategoryId || '', categoryRequest: '' });
                  }}
                  data-testid="category-request-file"
                >
                  File under…
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[10.5px] font-bold text-slate-500"
                  onClick={() => void save(b, { categoryRequest: '' })}
                  title="Keep the brand where it is and close the request"
                  data-testid="category-request-dismiss"
                >
                  Dismiss
                </button>
              </span>
            </div>
            {editing === b.id && (
              <div className="mt-2 rounded-lg border border-slate-200 bg-white p-3">
                <CategoryPicker categories={categories} value={choice} onChange={(next) => setChoice({ ...next, categoryRequest: '' })} label="File this brand under" required />
                <div className="mt-2 flex justify-end gap-2">
                  <button type="button" className="rounded-lg px-3 py-1.5 text-[11px] font-bold" onClick={() => setEditing(null)}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={busy || !choice.categoryId}
                    className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-40"
                    onClick={() => void save(b, { categoryId: choice.categoryId, subcategoryId: choice.subcategoryId, categoryRequest: '' })}
                    data-testid="category-request-save"
                  >
                    {busy && <Loader2 className="w-3 h-3 animate-spin" />} Save & close request
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default CategoryRequestsPanel;
