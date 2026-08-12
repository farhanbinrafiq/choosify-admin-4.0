import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Loader2, Search, X } from 'lucide-react';
import { catalogApi } from '../../services/catalogApi';
import type { CatalogCategory } from '../../types/catalog';

export type CategoryPickerValue = {
  categoryId: string;
  categoryName: string;
};

type FlatRow = {
  id: string;
  name: string;
  depth: number;
  parentId: string | null;
  pathLabel: string;
};

function buildFlatRows(categories: CatalogCategory[]): FlatRow[] {
  const byParent = new Map<string | null, CatalogCategory[]>();
  for (const c of categories) {
    const key = c.parentId || null;
    const list = byParent.get(key) || [];
    list.push(c);
    byParent.set(key, list);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name));
  }

  const byId = new Map(categories.map((c) => [c.id, c]));
  const pathFor = (id: string): string => {
    const parts: string[] = [];
    let cursor: string | null | undefined = id;
    const guard = new Set<string>();
    while (cursor && !guard.has(cursor)) {
      guard.add(cursor);
      const node = byId.get(cursor);
      if (!node) break;
      parts.unshift(node.name);
      cursor = node.parentId;
    }
    return parts.join(' › ');
  };

  const out: FlatRow[] = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const node of byParent.get(parentId) || []) {
      out.push({
        id: node.id,
        name: node.name,
        depth,
        parentId: node.parentId,
        pathLabel: pathFor(node.id),
      });
      walk(node.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

/**
 * Searchable picker over authoritative `/catalog/categories`.
 * Ads Studio consumes categories — does not create them.
 */
export function CategorySearchSelect({
  value,
  onChange,
  disabled,
  label = 'Category',
  placeholder = 'Search or select a category…',
}: {
  value: CategoryPickerValue | null;
  onChange: (next: CategoryPickerValue | null) => void;
  disabled?: boolean;
  label?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    catalogApi
      .listCategories()
      .then((rows) => {
        if (cancelled) return;
        setCategories(Array.isArray(rows) ? rows.filter((c) => c && c.enabled !== false) : []);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load categories');
        setCategories([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (ev: MouseEvent) => {
      if (!rootRef.current?.contains(ev.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useEffect(() => {
    if (open) {
      window.setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setQuery('');
    }
  }, [open]);

  const flat = useMemo(() => buildFlatRows(categories), [categories]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return flat;
    return flat.filter(
      (row) =>
        row.name.toLowerCase().includes(q) ||
        row.pathLabel.toLowerCase().includes(q),
    );
  }, [flat, query]);

  const selectedLabel = value?.categoryName || '';

  return (
    <div ref={rootRef} className="relative block text-[11px] font-bold text-[#374151]">
      <div className="mb-1">{label}</div>
      <button
        type="button"
        disabled={disabled || loading}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-lg border border-[#E8EDF2] bg-white px-3 py-2 text-left text-[12px] font-semibold text-[#111827] disabled:opacity-60"
      >
        <Search className="h-3.5 w-3.5 shrink-0 text-[#9CA3AF]" />
        <span className={`flex-1 truncate ${selectedLabel ? '' : 'text-[#9CA3AF] font-medium'}`}>
          {loading ? 'Loading categories…' : selectedLabel || placeholder}
        </span>
        {value && !disabled ? (
          <span
            role="button"
            tabIndex={0}
            className="rounded p-0.5 text-[#9CA3AF] hover:bg-[#F3F4F6] hover:text-[#374151]"
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                onChange(null);
              }
            }}
          >
            <X className="h-3.5 w-3.5" />
          </span>
        ) : null}
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-[#EF3C23]" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-[#9CA3AF]" />
        )}
      </button>

      {error ? (
        <div className="mt-1 text-[10px] font-semibold text-red-600">{error}</div>
      ) : (
        <div className="mt-1 text-[10px] font-semibold text-[#9CA3AF]">
          Existing Choosify categories only — create categories in Category Management.
        </div>
      )}

      {open ? (
        <div className="absolute z-40 mt-1 w-full overflow-hidden rounded-lg border border-[#E8EDF2] bg-white shadow-lg">
          <div className="border-b border-[#F1F3F5] p-2">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search categories…"
              className="w-full rounded-md border border-[#E8EDF2] px-2.5 py-1.5 text-[12px] font-semibold text-[#111827]"
            />
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-center text-[11px] font-semibold text-[#9CA3AF]">
                No matching categories found.
              </div>
            ) : (
              filtered.map((row) => {
                const active = value?.categoryId === row.id;
                return (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => {
                      onChange({ categoryId: row.id, categoryName: row.name });
                      setOpen(false);
                    }}
                    className={`flex w-full items-start gap-2 px-3 py-2 text-left text-[12px] hover:bg-[#FFF5F3] ${
                      active ? 'bg-[#FFF5F3] text-[#EF3C23]' : 'text-[#111827]'
                    }`}
                    style={{ paddingLeft: `${12 + row.depth * 14}px` }}
                  >
                    <span className="font-bold leading-snug">{row.name}</span>
                    {row.depth > 0 ? (
                      <span className="ml-auto shrink-0 text-[9px] font-semibold text-[#9CA3AF]">
                        {row.pathLabel}
                      </span>
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
