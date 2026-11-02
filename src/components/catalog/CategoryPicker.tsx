import React, { useId, useMemo, useState } from 'react';
import { Check, Search, X } from 'lucide-react';
import { labelOf, searchCategories, type CategoryMatch, type SearchableCategory } from '../../../shared/categorySearch';

export type CategoryChoice = {
  /** Main category id ('' = not chosen yet). */
  categoryId: string;
  /** Subcategory id under categoryId ('' = the whole main category). */
  subcategoryId: string;
  /** "Couldn't find my category" text — reviewed by staff in Category Management. */
  categoryRequest: string;
};

export const EMPTY_CATEGORY_CHOICE: CategoryChoice = { categoryId: '', subcategoryId: '', categoryRequest: '' };

type Props = {
  /** Every category (main + subcategories) from the live catalog. */
  categories: SearchableCategory[];
  value: CategoryChoice;
  onChange: (next: CategoryChoice) => void;
  label?: string;
  required?: boolean;
  /** Input/field class (matches the surrounding form). */
  inputClassName?: string;
  labelClassName?: string;
};

/**
 * Two-level category picker: type what you sell and pick a match — the main
 * category is filled in from the subcategory — or browse main → subcategory.
 * "Can't find it?" keeps the closest main category and records what's missing
 * for staff to add as a real subcategory.
 */
export function CategoryPicker({ categories, value, onChange, label = 'Category', required, inputClassName, labelClassName }: Props) {
  const id = useId();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [browsing, setBrowsing] = useState(false);
  const [requesting, setRequesting] = useState(Boolean(value.categoryRequest));

  const live = useMemo(() => categories.filter((c) => c.enabled !== false), [categories]);
  const mains = useMemo(
    () => live.filter((c) => !c.parentId).sort((a, b) => a.name.localeCompare(b.name)),
    [live],
  );
  const main = mains.find((m) => m.id === value.categoryId);
  const sub = live.find((c) => c.id === value.subcategoryId && c.parentId === value.categoryId);
  const subsOf = (mainId: string) => live.filter((c) => c.parentId === mainId).sort((a, b) => a.name.localeCompare(b.name));
  const matches = useMemo(() => (query.trim() ? searchCategories(live, query, 10) : []), [live, query]);

  const choose = (m: { main: SearchableCategory; sub?: SearchableCategory }) => {
    onChange({ categoryId: m.main.id, subcategoryId: m.sub?.id ?? '', categoryRequest: value.categoryRequest });
    setQuery('');
    setOpen(false);
    setBrowsing(false);
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!matches.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(matches.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const m = matches[active];
      if (m) choose(m);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const field = inputClassName || 'w-full bg-white border border-app-border rounded-lg px-3 py-2 text-xs outline-none focus:border-app-accent';
  const listId = `${id}-matches`;

  return (
    <div data-testid="category-picker">
      <label className={labelClassName || 'block text-[9.5px] font-black uppercase tracking-wider text-app-text-secondary mb-1'} htmlFor={`${id}-q`}>
        {label}
        {required ? ' *' : ''}
      </label>

      {main && (
        <div className="mb-2 flex flex-wrap items-center gap-2" data-testid="category-picker-selected">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-app-accent/10 px-2.5 py-1.5 text-[11.5px] font-bold text-app-accent">
            <Check className="w-3.5 h-3.5" />
            {sub ? `${main.name} › ${sub.name}` : main.name}
          </span>
          <button
            type="button"
            className="text-[10.5px] font-bold text-app-text-secondary hover:text-red-600"
            onClick={() => onChange({ ...EMPTY_CATEGORY_CHOICE, categoryRequest: value.categoryRequest })}
            aria-label="Clear category"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-app-text-secondary" />
        <input
          id={`${id}-q`}
          role="combobox"
          aria-expanded={open && matches.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          className={`${field} pl-8`}
          placeholder={main ? 'Search to change — e.g. shoes, gift items, perfume' : 'Type what you sell — e.g. shoes, gift items, perfume'}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={onKeyDown}
          data-testid="category-picker-search"
        />
        {open && query.trim() && (
          <ul
            id={listId}
            role="listbox"
            className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-app-border bg-white py-1 shadow-lg"
            data-testid="category-picker-matches"
          >
            {matches.length === 0 ? (
              <li className="px-3 py-2 text-[11px] text-app-text-secondary">
                No match. Browse below, or use “Can't find it?”.
              </li>
            ) : (
              matches.map((m: CategoryMatch, i) => (
                <li
                  key={`${m.main.id}-${m.sub?.id ?? ''}`}
                  role="option"
                  aria-selected={i === active}
                  className={`cursor-pointer px-3 py-2 text-[11.5px] ${i === active ? 'bg-app-accent/10' : 'hover:bg-slate-50'}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(m)}
                >
                  {m.sub ? (
                    <>
                      <span className="font-bold">{m.sub.name}</span>
                      <span className="text-app-text-secondary"> · in {m.main.name}</span>
                    </>
                  ) : (
                    <>
                      <span className="font-bold">{m.main.name}</span>
                      <span className="text-app-text-secondary"> · whole category</span>
                    </>
                  )}
                </li>
              ))
            )}
          </ul>
        )}
      </div>

      <div className="mt-1.5 flex flex-wrap gap-3 text-[10.5px] font-bold">
        <button type="button" className="text-app-accent" onClick={() => setBrowsing((b) => !b)} data-testid="category-picker-browse-toggle">
          {browsing ? 'Hide category list' : 'Browse all categories'}
        </button>
        <button
          type="button"
          className="text-app-text-secondary hover:text-app-accent"
          onClick={() => {
            const next = !requesting;
            setRequesting(next);
            if (!next) onChange({ ...value, categoryRequest: '' });
          }}
          data-testid="category-picker-request-toggle"
        >
          {requesting ? 'Never mind' : "Can't find it?"}
        </button>
      </div>

      {browsing && (
        <div className="mt-2 rounded-lg border border-app-border p-2.5 space-y-2" data-testid="category-picker-browse">
          <select
            className={field}
            value={value.categoryId}
            onChange={(e) => onChange({ categoryId: e.target.value, subcategoryId: '', categoryRequest: value.categoryRequest })}
            aria-label="Main category"
            data-testid="category-picker-main"
          >
            <option value="">Choose a main category</option>
            {mains.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          {main && subsOf(main.id).length > 0 && (
            <div className="flex flex-wrap gap-1.5" data-testid="category-picker-subs">
              <button
                type="button"
                onClick={() => choose({ main })}
                className={`rounded-full border px-2.5 py-1 text-[10.5px] font-bold ${!value.subcategoryId ? 'border-app-accent bg-app-accent/10 text-app-accent' : 'border-app-border'}`}
              >
                Whole category
              </button>
              {subsOf(main.id).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => choose({ main, sub: s })}
                  className={`rounded-full border px-2.5 py-1 text-[10.5px] font-bold ${value.subcategoryId === s.id ? 'border-app-accent bg-app-accent/10 text-app-accent' : 'border-app-border'}`}
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {requesting && (
        <div className="mt-2 rounded-lg border border-dashed border-app-border bg-slate-50 p-2.5" data-testid="category-picker-request">
          <label className="block text-[10.5px] font-bold text-app-text-secondary mb-1" htmlFor={`${id}-req`}>
            What do you sell? We'll review it and add a matching category.
          </label>
          <input
            id={`${id}-req`}
            className={field}
            maxLength={80}
            placeholder="e.g. Gift items, Pest control"
            value={value.categoryRequest}
            onChange={(e) => onChange({ ...value, categoryRequest: e.target.value })}
            data-testid="category-picker-request-input"
          />
          <p className="mt-1 text-[10px] text-app-text-secondary">
            {main ? `Until then the brand is listed under ${sub ? labelOf({ main, sub }) : main.name}.` : 'Also pick the closest main category above so the brand can be listed now.'}
          </p>
        </div>
      )}
    </div>
  );
}

export default CategoryPicker;
