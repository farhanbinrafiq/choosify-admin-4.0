/**
 * Search-and-pick a Choosify record (product / brand / creator / guide / deal / category) for an
 * ad's internal destination — no IDs to type. Lists come from the catalog API (loaded once per
 * type and kept for the session); the chosen record shows as a chip with "Change".
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Search, X } from 'lucide-react';
import { catalogApi } from '../../services/catalogApi';

export type PickableType = 'product' | 'brand' | 'creator' | 'guide' | 'deal' | 'category';

export type PickedEntity = { id: string; slug?: string; name: string; sub?: string; image?: string };

const cache = new Map<PickableType, Promise<PickedEntity[]>>();

const str = (v: unknown) => (typeof v === 'string' ? v : '');

function loadEntities(type: PickableType): Promise<PickedEntity[]> {
  const hit = cache.get(type);
  if (hit) return hit;
  const p = (async (): Promise<PickedEntity[]> => {
    switch (type) {
      case 'product':
        return ((await catalogApi.listProducts()) as unknown as Array<Record<string, unknown>>).map((r) => ({
          id: str(r.id),
          slug: str(r.slug),
          name: str(r.title) || str(r.name) || str(r.id),
          sub: str(r.brandName),
          image: str(r.image),
        }));
      case 'brand':
        return ((await catalogApi.listBrands()) as unknown as Array<Record<string, unknown>>).map((r) => ({
          id: str(r.id),
          slug: str(r.slug),
          name: str(r.name) || str(r.id),
          image: str(r.logo),
        }));
      case 'creator':
        return ((await catalogApi.listCreators()) as unknown as Array<Record<string, unknown>>).map((r) => ({
          id: str(r.id),
          slug: str(r.slug),
          name: str(r.name) || str(r.id),
          sub: str(r.handle) ? `@${str(r.handle).replace(/^@/, '')}` : undefined,
          image: str(r.avatar),
        }));
      case 'guide':
        return ((await catalogApi.listGuides()) as unknown as Array<Record<string, unknown>>).map((r) => ({
          id: str(r.id),
          slug: str(r.slug),
          name: str(r.title) || str(r.id),
          image: str(r.image),
        }));
      case 'deal':
        return ((await catalogApi.listDeals()) as unknown as Array<Record<string, unknown>>).map((r) => ({
          id: str(r.id),
          slug: str(r.slug),
          name: str(r.name) || str(r.id),
          sub: str(r.status),
        }));
      case 'category': {
        const all = (await catalogApi.listCategories()) as unknown as Array<Record<string, unknown>>;
        const byId = new Map(all.map((c) => [str(c.id), str(c.name)]));
        return all
          .filter((c) => c.enabled !== false)
          .map((r) => ({
            id: str(r.id),
            slug: str(r.slug),
            name: str(r.name) || str(r.id),
            sub: r.parentId ? `in ${byId.get(str(r.parentId)) || 'a category'}` : 'Main category',
          }));
      }
      default:
        return [];
    }
  })().catch((err) => {
    cache.delete(type);
    throw err;
  });
  cache.set(type, p);
  return p;
}

const LABEL: Record<PickableType, string> = {
  product: 'product',
  brand: 'brand',
  creator: 'creator',
  guide: 'buying guide',
  deal: 'deal',
  category: 'category',
};

export function EntityPicker({
  type,
  value,
  onPick,
}: {
  type: PickableType;
  /** Stored id (or, for older ads, whatever was typed). */
  value: string;
  onPick: (entity: PickedEntity | null) => void;
}) {
  const [items, setItems] = useState<PickedEntity[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    setItems(null);
    setLoadError(null);
    loadEntities(type)
      .then((rows) => alive && setItems(rows))
      .catch((err) => alive && setLoadError(err instanceof Error ? err.message : 'Could not load the list'));
    return () => {
      alive = false;
    };
  }, [type]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const selected = useMemo(() => (value && items ? items.find((i) => i.id === value || (type === 'category' && i.slug === value)) : undefined), [items, value, type]);
  // Older ads may hold a typed name instead of an id: offer the matching record.
  const nameMatch = useMemo(
    () => (value && items && !selected ? items.find((i) => i.name.trim().toLowerCase() === value.trim().toLowerCase()) : undefined),
    [items, value, selected],
  );
  const matches = useMemo(() => {
    if (!items) return [];
    const t = q.trim().toLowerCase();
    const list = t ? items.filter((i) => `${i.name} ${i.sub || ''} ${i.slug || ''}`.toLowerCase().includes(t)) : items;
    return list.slice(0, 40);
  }, [items, q]);

  if (selected && !open) {
    return (
      <div className="mt-1 flex items-center gap-2 rounded-lg border border-[#E8EDF2] bg-white px-2 py-1.5" data-testid="entity-picked">
        {selected.image ? <img src={selected.image} alt="" className="h-8 w-8 shrink-0 rounded object-cover" /> : null}
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12px] font-bold text-[#111827]">{selected.name}</div>
          <div className="truncate text-[10px] text-[#6B7280]">{selected.sub || `Linked ${LABEL[type]}`}</div>
        </div>
        <button type="button" onClick={() => setOpen(true)} className="shrink-0 rounded-md border border-[#E8EDF2] px-2 py-1 text-[10.5px] font-extrabold text-[#374151]" data-testid="entity-change">
          Change
        </button>
        <button type="button" onClick={() => onPick(null)} aria-label="Remove link" className="shrink-0 rounded-md p-1 text-[#9CA3AF] hover:text-red-600">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div ref={boxRef} className="relative mt-1">
      {value && items && !selected ? (
        <div className="mb-1.5 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-[10.5px] font-semibold text-amber-800" data-testid="entity-unlinked">
          “{value}” is not linked to a {LABEL[type]} yet, so the ad has no working link.
          {nameMatch ? (
            <button type="button" onClick={() => onPick(nameMatch)} className="ml-1 font-extrabold text-[#EF3C23] underline" data-testid="entity-fix">
              Link to the {LABEL[type]} “{nameMatch.name}”
            </button>
          ) : (
            ' Pick it from the list below.'
          )}
        </div>
      ) : null}
      <div className="flex items-center gap-2 rounded-lg border border-[#E8EDF2] bg-white px-3 py-2">
        <Search className="h-3.5 w-3.5 shrink-0 text-[#9CA3AF]" />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={`Search ${LABEL[type]}s by name…`}
          className="min-w-0 flex-1 bg-transparent text-[12px] outline-none"
          data-testid="entity-search"
        />
        {!items && !loadError ? <Loader2 className="h-3.5 w-3.5 animate-spin text-[#9CA3AF]" /> : null}
      </div>
      {loadError ? <div className="mt-1 text-[10.5px] font-semibold text-red-700">{loadError}</div> : null}
      {open && items ? (
        <div className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-[#E8EDF2] bg-white shadow-lg" data-testid="entity-options">
          {matches.length === 0 ? (
            <div className="px-3 py-3 text-[11.5px] text-[#9CA3AF]">No {LABEL[type]} matches “{q}”.</div>
          ) : (
            matches.map((i) => (
              <button
                key={i.id}
                type="button"
                onClick={() => {
                  onPick(i);
                  setOpen(false);
                  setQ('');
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-[#FFF4EE]"
                data-testid={`entity-option-${i.id}`}
              >
                {i.image ? <img src={i.image} alt="" className="h-7 w-7 shrink-0 rounded object-cover" /> : <span className="h-7 w-7 shrink-0 rounded bg-[#F3F4F6]" />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-bold text-[#111827]">{i.name}</span>
                  {i.sub ? <span className="block truncate text-[10px] text-[#6B7280]">{i.sub}</span> : null}
                </span>
              </button>
            ))
          )}
          {items.length > matches.length && !q ? (
            <div className="border-t border-[#F1F3F5] px-3 py-1.5 text-[10px] text-[#9CA3AF]">Showing 40 of {items.length} — type to search.</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
