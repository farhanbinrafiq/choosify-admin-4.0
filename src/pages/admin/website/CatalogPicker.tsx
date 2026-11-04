/**
 * Real-catalog pickers for the Homepage Studio: products (server search), brands, guides and
 * categories (loaded once). No sample data — a picked record that no longer exists is shown as
 * "Missing" so the editor can remove it; the server also blocks publishing it.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Loader2, Plus, Search, X } from 'lucide-react';
import { catalogApi } from '../../../services/catalogApi';
import type { CatalogBrand, CatalogCategory, CatalogGuide, CatalogProduct } from '../../../types/catalog';
import { moveItem } from './homepageModel';

export type PickItem = { id: string; label: string; sub?: string; thumb?: string; muted?: boolean };

const LIVE = new Set(['live', 'active']);
const toProduct = (p: CatalogProduct): PickItem => ({
  id: String(p.id),
  label: p.title || p.slug || String(p.id),
  sub: [p.brandName, LIVE.has(String(p.status)) ? '' : `not live (${p.status})`].filter(Boolean).join(' · '),
  thumb: p.image,
  muted: !LIVE.has(String(p.status)),
});
const missing = (id: string): PickItem => ({ id, label: 'Missing — no longer in the catalog', sub: `id ${id}`, muted: true });

export type HomepageCatalog = {
  loaded: boolean;
  error: string | null;
  brands: PickItem[];
  guides: PickItem[];
  categories: PickItem[];
  product: (id: string) => PickItem | undefined;
  /** Products loaded so far (first page + searches), name order. */
  productList: PickItem[];
  searchProducts: (q: string) => Promise<PickItem[]>;
  resolveProducts: (ids: string[]) => void;
};

export function useHomepageCatalog(): HomepageCatalog {
  const [base, setBase] = useState<{ loaded: boolean; error: string | null; brands: PickItem[]; guides: PickItem[]; categories: PickItem[] }>({
    loaded: false,
    error: null,
    brands: [],
    guides: [],
    categories: [],
  });
  const [products, setProducts] = useState<Map<string, PickItem>>(new Map());
  const resolving = useRef(new Set<string>());

  useEffect(() => {
    let cancelled = false;
    Promise.all([catalogApi.listBrands(), catalogApi.listGuides(), catalogApi.listCategories(), catalogApi.listProducts()])
      .then(([brands, guides, categories, prods]) => {
        if (cancelled) return;
        const names = new Map((categories as CatalogCategory[]).map((c) => [String(c.id), c.name]));
        setBase({
          loaded: true,
          error: null,
          brands: (brands as CatalogBrand[]).map((b) => ({ id: String(b.id), label: b.name, thumb: b.logo })).sort((a, b) => a.label.localeCompare(b.label)),
          guides: (guides as CatalogGuide[]).map((g) => ({
            id: String(g.id),
            label: g.title,
            sub: g.status === 'live' ? undefined : `not live (${g.status})`,
            thumb: g.image,
            muted: g.status !== 'live',
          })),
          categories: (categories as CatalogCategory[])
            .map((c) => ({ id: String(c.id), label: c.name, sub: c.parentId ? `in ${names.get(String(c.parentId)) ?? 'a parent category'}` : 'Top level' }))
            .sort((a, b) => a.label.localeCompare(b.label)),
        });
        setProducts(new Map((prods as CatalogProduct[]).map((p) => [String(p.id), toProduct(p)])));
      })
      .catch((e) => !cancelled && setBase((s) => ({ ...s, loaded: true, error: e instanceof Error ? e.message : 'Could not load the catalog' })));
    return () => {
      cancelled = true;
    };
  }, []);

  const searchProducts = useCallback(async (q: string) => {
    const list = await catalogApi.listProducts(q.trim() ? { q: q.trim() } : undefined);
    const items = list.map(toProduct);
    setProducts((m) => {
      const next = new Map(m);
      items.forEach((it) => next.set(it.id, it));
      return next;
    });
    return items;
  }, []);

  // Picked products outside the first page / searches are fetched one by one (at most 8).
  const resolveProducts = useCallback(
    (ids: string[]) => {
      ids
        .filter((id) => !products.has(id) && !resolving.current.has(id))
        .forEach((id) => {
          resolving.current.add(id);
          catalogApi
            .getProduct(id)
            .then((p) => setProducts((m) => new Map(m).set(id, toProduct(p as CatalogProduct))))
            .catch(() => setProducts((m) => new Map(m).set(id, missing(id))));
        });
    },
    [products],
  );

  const productList = useMemo(() => [...products.values()].filter((p) => !p.label.startsWith('Missing')).sort((a, b) => a.label.localeCompare(b.label)), [products]);
  return { ...base, product: (id) => products.get(id), productList, searchProducts, resolveProducts };
}

/** Lookup in a loaded list; unknown ids show as Missing once the catalog has loaded. */
export const lookupIn = (list: PickItem[], loaded: boolean) => (id: string) => list.find((x) => x.id === id) ?? (loaded ? missing(id) : undefined);

const inputCls =
  'w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-[12.5px] text-[#111827] outline-none focus:border-[#EF3C23] focus:ring-2 focus:ring-[#EF3C23]/15';
const iconBtn = 'inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#E2E8F0] bg-white text-[#374151] hover:bg-slate-50 disabled:opacity-40';

function Thumb({ src, round }: { src?: string; round?: boolean }) {
  const shape = round ? 'rounded-full' : 'rounded-md';
  return src ? <img src={src} alt="" className={`h-8 w-8 shrink-0 border border-[#E8EDF2] bg-white object-cover ${shape}`} /> : <span className={`h-8 w-8 shrink-0 bg-slate-100 ${shape}`} />;
}

export function CatalogPicker({
  testId,
  selectedIds,
  max,
  lookup,
  options,
  search,
  disabled,
  emptyText,
  round,
  onChange,
  renderExtra,
}: {
  testId: string;
  selectedIds: string[];
  max: number;
  lookup: (id: string) => PickItem | undefined;
  /** Client-side list (brands / guides / categories)… */
  options?: PickItem[];
  /** …or server-side search (products). */
  search?: (q: string) => Promise<PickItem[]>;
  disabled: boolean;
  emptyText: string;
  round?: boolean;
  onChange: (ids: string[]) => void;
  renderExtra?: (id: string) => React.ReactNode;
}) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [remote, setRemote] = useState<PickItem[] | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!search || !open) return;
    const t = window.setTimeout(() => {
      setSearching(true);
      search(q)
        .then(setRemote)
        .catch(() => setRemote([]))
        .finally(() => setSearching(false));
    }, 250);
    return () => window.clearTimeout(t);
  }, [q, open, search]);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    // Name matches first (exact, then starts-with, then contains), then matches on the sub line.
    const rank = (o: PickItem) => {
      const l = o.label.toLowerCase();
      return l === needle ? 0 : l.startsWith(needle) ? 1 : l.includes(needle) ? 2 : 3;
    };
    const pool = (search ? remote ?? [] : options ?? [])
      .filter((o) => !selectedIds.includes(o.id))
      .filter((o) => search || !needle || `${o.label} ${o.sub ?? ''}`.toLowerCase().includes(needle));
    return (needle && !search ? [...pool].sort((a, b) => rank(a) - rank(b)) : pool).slice(0, 30);
  }, [q, options, remote, search, selectedIds]);

  const full = selectedIds.length >= max;

  return (
    <div data-testid={testId}>
      {selectedIds.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[#E2E8F0] px-3 py-2.5 text-[11.5px] text-slate-500">{emptyText}</div>
      ) : (
        <ol className="space-y-1.5">
          {selectedIds.map((id, i) => {
            const item = lookup(id);
            return (
              <li key={id} className="flex flex-wrap items-center gap-2 rounded-lg border border-[#E8EDF2] bg-white px-2.5 py-1.5" data-testid={`${testId}-item`}>
                <span className="w-4 text-[11px] font-extrabold text-slate-400">{i + 1}</span>
                <Thumb src={item?.thumb} round={round} />
                <div className="min-w-0 flex-1">
                  <div className={`truncate text-[12px] font-bold ${item?.muted ? 'text-slate-400' : 'text-[#111827]'}`}>{item?.label ?? 'Loading…'}</div>
                  {item?.sub && <div className="truncate text-[10.5px] text-slate-500">{item.sub}</div>}
                </div>
                {renderExtra?.(id)}
                <button type="button" className={iconBtn} disabled={disabled || i === 0} aria-label="Move up" onClick={() => onChange(moveItem(selectedIds, i, -1))}>
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button type="button" className={iconBtn} disabled={disabled || i === selectedIds.length - 1} aria-label="Move down" onClick={() => onChange(moveItem(selectedIds, i, 1))}>
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                <button type="button" className={iconBtn} disabled={disabled} aria-label="Remove" data-testid={`${testId}-remove`} onClick={() => onChange(selectedIds.filter((x) => x !== id))}>
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ol>
      )}
      <div className="mt-2">
        {!open ? (
          <button
            type="button"
            className="inline-flex items-center gap-1 text-[11.5px] font-bold text-[#2563EB] hover:underline disabled:text-slate-400 disabled:no-underline"
            disabled={disabled || full}
            data-testid={`${testId}-add`}
            onClick={() => setOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" /> {full ? `Maximum ${max} reached` : 'Add'}
          </button>
        ) : (
          <div className="rounded-lg border border-[#E2E8F0] bg-slate-50 p-2">
            <div className="flex items-center gap-2">
              <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <input autoFocus className={inputCls} placeholder="Search…" value={q} data-testid={`${testId}-search`} onChange={(e) => setQ(e.target.value)} />
              <button type="button" className={iconBtn} aria-label="Close search" onClick={() => { setOpen(false); setQ(''); }}>
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <ul className="mt-2 max-h-56 space-y-1 overflow-auto">
              {searching && (
                <li className="flex items-center gap-1.5 px-1 text-[11px] text-slate-500">
                  <Loader2 className="h-3 w-3 animate-spin" /> Searching…
                </li>
              )}
              {!searching && results.length === 0 && <li className="px-1 text-[11px] text-slate-500">No matches.</li>}
              {results.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    disabled={full}
                    data-testid={`${testId}-option`}
                    className="flex w-full items-center gap-2 rounded-md bg-white px-2 py-1.5 text-left hover:bg-orange-50 disabled:opacity-50"
                    onClick={() => onChange([...selectedIds, o.id])}
                  >
                    <Thumb src={o.thumb} round={round} />
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-[12px] font-bold ${o.muted ? 'text-slate-400' : 'text-[#111827]'}`}>{o.label}</span>
                      {o.sub && <span className="block truncate text-[10.5px] text-slate-500">{o.sub}</span>}
                    </span>
                    <Plus className="h-3.5 w-3.5 text-slate-400" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
