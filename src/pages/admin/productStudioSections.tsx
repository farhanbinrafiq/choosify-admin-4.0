import React, { useMemo, useRef, useState, CSSProperties } from 'react';
import { X, Loader2 } from 'lucide-react';
import { resolveCreatorThumbnail } from '../../lib/productVideo';
import { uploadCreatorImage, uploadProductImages } from '../../services/mediaUpload';
import {
  checkCategorySchemaCompatibility,
  generateCombinations,
  OVERVIEW_PRESET_TITLES,
  reconcileVariantsForDimensions,
  variantCoversDimensions,
  variantIsActive,
  variantKey,
  type CategorySchemaCompatibility,
  type EditorBeforeYourVisit,
  type EditorCustomRelatedBlock,
  type EditorRelatedStore,
  type EditorWhatsNearby,
  type ProductAddonRow,
  type ProductEditorModel,
  type ProductOptionGroup,
  type ProductVariantRow,
  type RelatedInfoType,
  type SchemaVariantDimension,
} from './productEditorModel';
import type { CatalogProductDetail, RelatedStoreEntry } from '../../types/catalog';

type ProductGuide = NonNullable<CatalogProductDetail['sizeGuide']>;

const GUIDE_TYPE_OPTIONS: Array<{ value: NonNullable<ProductGuide['guideType']>; label: string; cta: string }> = [
  { value: 'size', label: 'Size guide', cta: 'View Size Guide' },
  { value: 'measurement', label: 'Measurement guide', cta: 'View Measurement Guide' },
  { value: 'compatibility', label: 'Compatibility guide', cta: 'View Compatibility Guide' },
  { value: 'fitment', label: 'Fitment guide', cta: 'View Fitment Guide' },
  { value: 'feature', label: 'Feature guide', cta: 'View Feature Guide' },
  { value: 'custom', label: 'Custom label…', cta: 'View Guide' },
];

/** Storefront CTA label for a product guide (matches Choosify-Web productGuideCtaLabel). */
export function productGuideCtaLabel(g?: Partial<ProductGuide> | null): string {
  const t = g?.guideType || 'size';
  if (t === 'custom') return (g?.label || '').trim() || 'View Guide';
  return GUIDE_TYPE_OPTIONS.find((o) => o.value === t)?.cta || 'View Guide';
}

type OverviewBlock = ProductEditorModel['overviewBlocks'][number];
type CreatorVideo = ProductEditorModel['creatorVideos'][number];

/**
 * Inline editors for the storefront-parity Product Studio's category-driven
 * Options & Variants section and the Add-on Items section. Both render in place
 * inside their section (no drawer, no modal, no whole-page edit). Save / Cancel
 * chrome is supplied by the presentation's SectionShell — these components only
 * own the fields and call `onChange` with the next slice of the section draft.
 */

const ACCENT = 'var(--cms-accent)';
const ACCENT_WASH = 'color-mix(in srgb, var(--cms-accent) 12%, transparent)';

const x: Record<string, CSSProperties> = {
  label: { fontSize: '10.5px', fontWeight: 800, color: '#6B7280', marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase' },
  input: { width: '100%', boxSizing: 'border-box', height: 34, borderRadius: 8, border: '1px solid #E8EDF2', padding: '0 10px', fontSize: 12.5, background: '#fff', outline: 'none' },
  cell: { padding: '6px 8px', fontSize: 12, borderBottom: '1px solid #F1F3F5', verticalAlign: 'middle' },
  th: { padding: '8px', fontSize: '9.5px', fontWeight: 800, color: '#9CA3AF', letterSpacing: '0.04em', textTransform: 'uppercase', textAlign: 'left', borderBottom: '1px solid #E8EDF2', whiteSpace: 'nowrap' },
  smallInput: { width: '100%', boxSizing: 'border-box', height: 30, borderRadius: 6, border: '1px solid #E8EDF2', padding: '0 8px', fontSize: 12, background: '#fff', outline: 'none' },
  ghostBtn: { background: '#fff', border: '1px solid #E8EDF2', borderRadius: 8, padding: '7px 12px', fontSize: 11, fontWeight: 700, color: '#374151', cursor: 'pointer' },
  accentBtn: { background: ACCENT, border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 11, fontWeight: 800, color: '#fff', cursor: 'pointer' },
  chip: { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700, border: '1px solid #E8EDF2', background: '#fff', cursor: 'pointer' },
  chipOn: { background: '#1A1A2E', color: '#fff', borderColor: '#1A1A2E' },
  note: { fontSize: 11, color: '#6B7280', lineHeight: 1.6 },
  warnBox: { border: '1px solid #FCD34D', background: '#FFFBEB', borderRadius: 10, padding: 14, marginBottom: 12 },
};

// ───────────────────────────── Options & Variants ─────────────────────────────

const norm = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '');

/**
 * Per-combination stock state for the Studio at-a-glance chip. Mirrors the
 * server's canonical `deriveInventoryState(available, lowStockThreshold = 5)`
 * (server/catalog/productLifecycle.ts) — do NOT introduce a different threshold.
 * The live availability the storefront/inventory use still comes from the
 * canonical inventory record; this is the seller's on-hand number as typed.
 */
export const VARIANT_LOW_STOCK_THRESHOLD = 5;
export function variantStockState(
  v: { stock?: number; status?: string; enabled?: boolean },
): { label: string; color: string; bg: string } {
  const active = v.status ? v.status === 'active' : v.enabled !== false;
  if (!active) return { label: 'Inactive', color: '#6B7280', bg: '#F3F4F6' };
  const s = typeof v.stock === 'number' ? v.stock : undefined;
  if (s === undefined) return { label: 'No stock set', color: '#92400E', bg: '#FEF3C7' };
  if (s <= 0) return { label: 'Out of stock', color: '#B91C1C', bg: '#FEE2E2' };
  if (s < VARIANT_LOW_STOCK_THRESHOLD) return { label: 'Low', color: '#B45309', bg: '#FEF3C7' };
  return { label: 'In stock', color: '#15803D', bg: '#DCFCE7' };
}

/**
 * Searchable category picker shown at the top of the Options & Variants section.
 * The chosen category is what drives the recommended product options below, so
 * the seller can find and set the closest-fitting category right here without
 * leaving the section. Delegates the actual change (and the incompatible-data
 * remap prompt) to the same handler the Basic Information picker uses.
 */
export function CategorySearchSelect({
  options,
  valueId,
  valueName,
  onSelect,
  placeholder,
}: {
  options: Array<{ id: string; name: string }>;
  valueId: string;
  valueName?: string;
  onSelect: (id: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const selectedName = valueName || options.find((o) => o.id === valueId)?.name || '';
  const needle = q.trim().toLowerCase();
  const filtered = needle ? options.filter((o) => o.name.toLowerCase().includes(needle)) : options;

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => { setOpen((v) => !v); setQ(''); }}
        style={{
          ...x.smallInput,
          height: 34,
          textAlign: 'left',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <span
          style={{
            color: selectedName ? '#111827' : '#9CA3AF',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {selectedName || placeholder || 'Select a category…'}
        </span>
        <span style={{ color: '#9CA3AF', fontSize: 10 }}>▾</span>
      </button>
      {open ? (
        <div
          style={{
            position: 'absolute',
            zIndex: 30,
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            background: '#fff',
            border: '1px solid #E8EDF2',
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
            padding: 6,
          }}
        >
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search categories…"
            style={{ ...x.smallInput, marginBottom: 6 }}
          />
          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <div style={{ ...x.note, padding: '8px 6px' }}>No category matches “{q}”.</div>
            ) : (
              filtered.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => { onSelect(o.id); setOpen(false); setQ(''); }}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '7px 8px',
                    borderRadius: 6,
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: o.id === valueId ? 800 : 600,
                    background: o.id === valueId ? '#F1F5F9' : 'transparent',
                    color: '#111827',
                  }}
                >
                  {o.name}
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Fully controlled by `optionGroups` — no local mirror of enabled dims/values,
 * so it can't go stale when the category schema arrives after mount.
 */
export function VariantMatrixEditor({
  optionGroups,
  productVariants,
  variantDimensions,
  isService,
  onChange,
}: {
  optionGroups: ProductOptionGroup[];
  productVariants: ProductVariantRow[];
  /** null = schema still loading; [] = category defines no variant dimensions */
  variantDimensions: SchemaVariantDimension[] | null;
  isService: boolean;
  onChange: (next: { optionGroups: ProductOptionGroup[]; productVariants: ProductVariantRow[] }) => void;
}) {
  const dims = variantDimensions ?? [];
  const [freeInput, setFreeInput] = useState<Record<string, string>>({});
  const [newDimName, setNewDimName] = useState('');
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);

  const groupFor = (d: SchemaVariantDimension) =>
    optionGroups.find((g) => norm(g.name) === norm(d.name) || norm(g.name) === norm(d.key));
  const valuesFor = (d: SchemaVariantDimension) => groupFor(d)?.values ?? [];
  const enabledDims = dims.filter((d) => valuesFor(d).length > 0);

  // Hybrid model: any option group NOT matching a category variant dimension is a
  // seller custom, product-only dimension (free-form values, not a search facet).
  const isSchemaGroup = (g: ProductOptionGroup) =>
    dims.some((d) => norm(d.name) === norm(g.name) || norm(d.key) === norm(g.name));
  const customGroups = optionGroups.filter((g) => !isSchemaGroup(g));

  /** Every dimension that actually drives combinations — schema + custom. */
  const effectiveDims: Array<{ key: string; name: string; values: string[]; custom: boolean }> = [
    ...enabledDims.map((d) => ({ key: d.key, name: d.name, values: valuesFor(d), custom: false })),
    ...customGroups.filter((g) => g.values.length > 0).map((g) => ({ key: g.id, name: g.name, values: g.values, custom: true })),
  ];

  const schemaOptionSet = (d: SchemaVariantDimension) => new Set(d.options || []);
  const sellerAddedValues = (d: SchemaVariantDimension) => {
    const opts = schemaOptionSet(d);
    return valuesFor(d).filter((v) => !opts.has(v));
  };

  const writeGroup = (d: SchemaVariantDimension, values: string[]) => {
    const rest = optionGroups.filter((g) => norm(g.name) !== norm(d.name) && norm(g.name) !== norm(d.key));
    const existing = groupFor(d);
    // A category `select` dimension's schema options stay canonical; anything the
    // seller typed beyond them is recorded as `customValues` (sells, but not a facet).
    const opts = schemaOptionSet(d);
    const isSelect = d.type === 'select' || d.type === 'multi_select';
    const customValues = isSelect ? values.filter((v) => !opts.has(v)) : undefined;
    onChange({
      optionGroups: [
        ...rest,
        {
          id: existing?.id || `og-${d.key}`,
          name: d.name,
          displayType: existing?.displayType || (norm(d.name).includes('color') ? 'swatch' : 'pills'),
          values,
          ...(customValues && customValues.length ? { customValues } : {}),
        },
      ],
      productVariants,
    });
  };

  const toggleDim = (d: SchemaVariantDimension) => {
    const rest = optionGroups.filter((g) => norm(g.name) !== norm(d.name) && norm(g.name) !== norm(d.key));
    if (groupFor(d)) {
      // turn OFF — drop the group entirely
      onChange({ optionGroups: rest, productVariants });
    } else {
      // turn ON — add an empty group so its value pickers appear
      onChange({
        optionGroups: [
          ...rest,
          { id: `og-${d.key}`, name: d.name, displayType: norm(d.name).includes('color') ? 'swatch' : 'pills', values: [] },
        ],
        productVariants,
      });
    }
  };

  const isRowOpen = (d: SchemaVariantDimension) => !!groupFor(d);

  const toggleValue = (d: SchemaVariantDimension, value: string) => {
    const cur = valuesFor(d);
    writeGroup(d, cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value]);
  };

  const addFreeValue = (d: SchemaVariantDimension) => {
    const raw = (freeInput[d.key] || '').trim();
    if (!raw) return;
    const cur = valuesFor(d);
    if (!cur.includes(raw)) writeGroup(d, [...cur, raw]);
    setFreeInput((p) => ({ ...p, [d.key]: '' }));
  };

  // ── Seller custom dimensions ──
  const addCustomDimension = () => {
    const name = newDimName.trim();
    if (!name) return;
    if (optionGroups.some((g) => norm(g.name) === norm(name)) || dims.some((d) => norm(d.name) === norm(name))) {
      setNewDimName('');
      return;
    }
    onChange({
      optionGroups: [
        ...optionGroups,
        {
          id: `ogc-${norm(name)}-${Date.now()}`,
          name,
          displayType: norm(name).includes('color') ? 'swatch' : 'pills',
          values: [],
          custom: true,
        },
      ],
      productVariants,
    });
    setNewDimName('');
  };
  const writeCustomValues = (groupId: string, values: string[]) => {
    onChange({
      optionGroups: optionGroups.map((g) => (g.id === groupId ? { ...g, values } : g)),
      productVariants,
    });
  };
  const removeCustomDimension = (groupId: string) => {
    onChange({ optionGroups: optionGroups.filter((g) => g.id !== groupId), productVariants });
  };

  const effectiveDimSpecs = effectiveDims.map((d) => ({ name: d.name, values: d.values }));
  const currentDimNames = effectiveDims.map((d) => d.name);
  const fullCombos = () => generateCombinations(effectiveDimSpecs);

  /**
   * A row is "partial" when it has at least one populated option but is
   * missing at least one of the product's CURRENT dimensions — exactly the
   * situation left behind when a seller adds a new option dimension (e.g.
   * Color, Fitting) after variants already exist for an earlier one (Size).
   * A partial row can never be a real sellable combination — the storefront
   * requires every dimension to resolve one variant — so it's never counted
   * as "already present" and is superseded once its full completions exist.
   */
  const partialRows = productVariants.filter(
    (v) => Object.keys(v.options || {}).length > 0 && !variantCoversDimensions(v.options, currentDimNames),
  );
  const completeRows = productVariants.filter((v) => !partialRows.includes(v));
  const presentKeys = new Set(completeRows.map((v) => variantKey(v.options || {})));
  const missingCombos = fullCombos().filter((c) => !presentKeys.has(variantKey(c)));

  /** ADD the combinations the seller doesn't have yet — never removes an
   *  already-complete row (so a deleted "combination that doesn't exist"
   *  stays deleted), but DOES replace a superseded partial row with its full
   *  completions, seeded from that row's own data (see
   *  reconcileVariantsForDimensions). */
  const addMissingCombinations = () => {
    if (!missingCombos.length && !partialRows.length) return;
    onChange({
      optionGroups,
      productVariants: reconcileVariantsForDimensions(
        productVariants,
        effectiveDimSpecs,
        (i) => `var-${Date.now()}-${i}`,
      ),
    });
  };

  /** Escape hatch — rebuild the full cartesian, keeping data for combos that
   *  survive (including seeding new rows from a superseded partial row) and
   *  DROPPING any row (deleted-and-not-regenerated, or otherwise) that isn't
   *  part of the current full matrix. */
  const resetToFullMatrix = () => {
    const reconciled = reconcileVariantsForDimensions(
      productVariants,
      effectiveDimSpecs,
      (i) => `var-${Date.now()}-${i}`,
    );
    const byKey = new Map(reconciled.map((v) => [variantKey(v.options || {}), v]));
    const next: ProductVariantRow[] = fullCombos().map((options, i) => {
      const prev = byKey.get(variantKey(options));
      return prev
        ? { ...prev, options }
        : { id: `var-${Date.now()}-${i}`, sku: '', options, enabled: true, status: 'active' as const };
    });
    onChange({ optionGroups, productVariants: next });
  };

  const deleteVariantRow = (id: string) => {
    onChange({ optionGroups, productVariants: productVariants.filter((v) => v.id !== id) });
  };

  const patchVariant = (id: string, patch: Partial<ProductVariantRow>) => {
    onChange({ optionGroups, productVariants: productVariants.map((v) => (v.id === id ? { ...v, ...patch } : v)) });
  };

  const saveVariant = (next: ProductVariantRow) => {
    onChange({ optionGroups, productVariants: productVariants.map((v) => (v.id === next.id ? next : v)) });
  };

  /** Bulk-apply one variant's images onto every OTHER variant sharing the same
   *  value for one dimension (e.g. every "Red" combination gets this row's
   *  photos) — operates on the variant editor's current (possibly still-
   *  unsaved) draft, so what the seller sees in the modal is exactly what
   *  gets copied, never a stale committed copy. Commits the draft's own
   *  edits at the same time. Only ever called from an explicit, confirmed
   *  seller action (see VariantEditModal). */
  const applyImagesToMatching = (draft: ProductVariantRow, optionName: string) => {
    const imgs = draft.images ?? [];
    const val = draft.options?.[optionName];
    onChange({
      optionGroups,
      productVariants: productVariants.map((v) => {
        if (v.id === draft.id) return draft;
        if (val != null && imgs.length && v.options?.[optionName] === val) return { ...v, images: [...imgs] };
        return v;
      }),
    });
  };


  if (variantDimensions === null) {
    return <p style={x.note}>Loading this category's product options…</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <div style={x.label}>Category product options</div>
        <div style={x.note}>
          {dims.length ? (
            <>Turn on the options that apply to this product and pick the choices you offer. <b>select</b>
            {' '}choices come from the category; text/number options also accept your own choices.</>
          ) : (
            <>This product's category defines no product options yet. You can still add your own
            product options below if this product comes in different choices.</>
          )}
        </div>
      </div>

      {dims.map((d) => {
        const isSelect = d.type === 'select' || d.type === 'multi_select';
        const open = isRowOpen(d);
        const values = valuesFor(d);
        return (
          <div key={d.key} style={{ border: '1px solid #E8EDF2', borderRadius: 10, padding: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={open} onChange={() => toggleDim(d)} />
              <span style={{ fontSize: 12.5, fontWeight: 800 }}>{d.name}</span>
              <span style={{ fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase' }}>{d.type}</span>
            </label>
            {open ? (
              <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                {isSelect
                  ? d.options.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => toggleValue(d, opt)}
                        style={{ ...x.chip, ...(values.includes(opt) ? x.chipOn : {}) }}
                      >
                        {opt}
                      </button>
                    ))
                  : values.map((v) => (
                      <button key={v} type="button" onClick={() => toggleValue(d, v)} style={{ ...x.chip, ...x.chipOn }}>
                        {v} ✕
                      </button>
                    ))}
                {/* Seller-added values on a category select dimension (e.g. "M(42)", "50 inches") */}
                {isSelect
                  ? sellerAddedValues(d).map((v) => (
                      <button
                        key={v}
                        type="button"
                        title="Your value — sells like any other, but not a category filter bucket"
                        onClick={() => writeGroup(d, values.filter((x2) => x2 !== v))}
                        style={{ ...x.chip, ...x.chipOn, borderStyle: 'dashed' }}
                      >
                        {v} <span style={{ opacity: 0.7, fontSize: 9 }}>· yours</span> ✕
                      </button>
                    ))
                  : null}
                <span style={{ display: 'inline-flex', gap: 4 }}>
                  <input
                    value={freeInput[d.key] || ''}
                    onChange={(e) => setFreeInput((p) => ({ ...p, [d.key]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); addFreeValue(d); }
                    }}
                    placeholder={isSelect ? `Add your own ${d.name.toLowerCase()}…` : `Add ${d.name.toLowerCase()}…`}
                    style={{ ...x.smallInput, width: 170 }}
                  />
                  <button type="button" onClick={() => addFreeValue(d)} style={x.ghostBtn}>Add</button>
                </span>
              </div>
            ) : null}
          </div>
        );
      })}

      {/* ── Seller custom, product-only dimensions (not a category facet) ── */}
      <div style={{ borderTop: '1px dashed #E8EDF2', paddingTop: 12 }}>
        <div style={x.label}>Custom product options (this product only)</div>
        <div style={{ ...x.note, marginBottom: 8 }}>
          Add a buyer-selectable option the category doesn't cover (e.g. Strap Material, Roast,
          Frame, Pack Size). These drive pricing &amp; variant combinations but aren't category
          search filters, and a later category change never removes them.
        </div>
        {customGroups.map((g) => (
          <div key={g.id} style={{ border: '1px solid #E8EDF2', borderRadius: 10, padding: 12, marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12.5, fontWeight: 800 }}>{g.name}</span>
              <span style={{ ...x.chip, color: ACCENT }}>custom</span>
              <button type="button" onClick={() => removeCustomDimension(g.id)} style={{ ...x.ghostBtn, color: '#DC2626', marginLeft: 'auto' }}>
                Remove option
              </button>
            </div>
            <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              {g.values.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => writeCustomValues(g.id, g.values.filter((x2) => x2 !== v))}
                  style={{ ...x.chip, ...x.chipOn }}
                >
                  {v} ✕
                </button>
              ))}
              <span style={{ display: 'inline-flex', gap: 4 }}>
                <input
                  value={freeInput[g.id] || ''}
                  onChange={(e) => setFreeInput((p) => ({ ...p, [g.id]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const raw = (freeInput[g.id] || '').trim();
                      if (raw && !g.values.includes(raw)) writeCustomValues(g.id, [...g.values, raw]);
                      setFreeInput((p) => ({ ...p, [g.id]: '' }));
                    }
                  }}
                  placeholder={`Add ${g.name.toLowerCase()} value…`}
                  style={{ ...x.smallInput, width: 160 }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const raw = (freeInput[g.id] || '').trim();
                    if (raw && !g.values.includes(raw)) writeCustomValues(g.id, [...g.values, raw]);
                    setFreeInput((p) => ({ ...p, [g.id]: '' }));
                  }}
                  style={x.ghostBtn}
                >
                  Add
                </button>
              </span>
            </div>
          </div>
        ))}
        <div style={{ display: 'inline-flex', gap: 6 }}>
          <input
            value={newDimName}
            onChange={(e) => setNewDimName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomDimension(); } }}
            placeholder="Option name — e.g. Size, Storage, Color"
            style={{ ...x.smallInput, width: 220 }}
          />
          <button type="button" onClick={addCustomDimension} style={x.ghostBtn}>+ Add product option</button>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={addMissingCombinations}
          disabled={!missingCombos.length && !partialRows.length}
          style={x.accentBtn}
        >
          {missingCombos.length
            ? `Generate missing combinations (${missingCombos.length})`
            : '✓ All combinations created'}
        </button>
        {productVariants.length > 0 ? (
          <button type="button" onClick={resetToFullMatrix} style={x.ghostBtn}>
            Reset to all combinations
          </button>
        ) : null}
        <span style={x.note}>
          Choosify builds one variant combination per set of choices. Delete the rows you don't
          sell (e.g. "12GB only in Black") — a deleted combination stays deleted. Generating only
          ever fills gaps.
          {partialRows.length ? (
            <>
              {' '}
              <b>{partialRows.length} row{partialRows.length === 1 ? '' : 's'}</b> {partialRows.length === 1 ? 'was' : 'were'} saved
              before a newer option was added and {partialRows.length === 1 ? "isn't" : "aren't"} tied
              to it yet — generating will complete{' '}
              {partialRows.length === 1 ? 'it' : 'them'}, carrying over its existing price/stock/SKU/images.
            </>
          ) : null}
        </span>
      </div>

      {productVariants.length > 0 ? (
        <div style={{ overflowX: 'auto', border: '1px solid #E8EDF2', borderRadius: 10 }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 780 }}>
            <thead>
              <tr>
                {effectiveDims.map((d) => (
                  <th key={d.key} style={{ ...x.th, minWidth: 90 }}>
                    {d.name}{d.custom ? ' *' : ''}
                  </th>
                ))}
                <th style={{ ...x.th, minWidth: 140 }}>SKU</th>
                <th style={{ ...x.th, minWidth: 90 }}>Price</th>
                <th style={{ ...x.th, minWidth: 90 }}>MRP</th>
                {!isService ? <th style={{ ...x.th, minWidth: 90 }}>Stock</th> : null}
                <th style={x.th}>Active</th>
                <th style={x.th}>Images</th>
                <th style={x.th} />
              </tr>
            </thead>
            <tbody>
              {productVariants.map((v) => {
                const st = variantStockState(v);
                const imgCount = (v.images ?? []).length;
                return (
                  <tr key={v.id}>
                    {effectiveDims.map((d) => {
                      const val = v.options?.[d.name];
                      const missing = val == null;
                      return (
                        <td
                          key={d.key}
                          style={{ ...x.cell, fontWeight: 700, ...(missing ? { color: '#B45309' } : {}) }}
                          title={
                            missing
                              ? 'Not set yet — click "Generate missing combinations" above to complete this row'
                              : undefined
                          }
                        >
                          {val ?? '—'}
                        </td>
                      );
                    })}
                    <td style={{ ...x.cell, fontFamily: 'monospace', fontSize: 11.5, whiteSpace: 'nowrap' }}>
                      {v.sku?.trim() || <span style={{ color: '#9CA3AF', fontFamily: 'inherit' }}>No SKU</span>}
                    </td>
                    <td style={{ ...x.cell, whiteSpace: 'nowrap' }}>
                      {typeof v.price === 'number' ? `৳${v.price.toLocaleString()}` : <span style={{ color: '#9CA3AF' }}>—</span>}
                    </td>
                    <td style={{ ...x.cell, whiteSpace: 'nowrap', color: '#6B7280' }}>
                      {typeof v.originalPrice === 'number' ? `৳${v.originalPrice.toLocaleString()}` : '—'}
                    </td>
                    {!isService ? (
                      <td style={x.cell}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          <input
                            type="number"
                            min={0}
                            value={v.stock ?? ''}
                            onChange={(e) => patchVariant(v.id, { stock: e.target.value === '' ? undefined : Number(e.target.value) })}
                            style={{ ...x.smallInput, width: 66 }}
                            title="Quick-edit stock — open Edit for full details"
                          />
                          <span style={{ fontSize: 9, fontWeight: 800, color: st.color, background: st.bg, borderRadius: 4, padding: '1px 5px', whiteSpace: 'nowrap', alignSelf: 'flex-start' }}>
                            {st.label}
                          </span>
                        </div>
                      </td>
                    ) : null}
                    <td style={{ ...x.cell, textAlign: 'center' }}>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={variantIsActive(v)}
                        title={variantIsActive(v) ? 'Active — available for purchase' : 'Inactive — not available for purchase'}
                        onClick={() => patchVariant(v.id, { status: variantIsActive(v) ? 'inactive' : 'active', enabled: !variantIsActive(v) })}
                        style={{
                          width: 34, height: 19, borderRadius: 999, border: 'none', cursor: 'pointer', position: 'relative',
                          background: variantIsActive(v) ? ACCENT : '#D1D5DB', transition: 'background 0.15s',
                        }}
                      >
                        <span style={{
                          position: 'absolute', top: 2, left: variantIsActive(v) ? 17 : 2, width: 15, height: 15,
                          borderRadius: '50%', background: '#fff', transition: 'left 0.15s', boxShadow: '0 1px 2px rgba(0,0,0,0.25)',
                        }} />
                      </button>
                    </td>
                    <td style={{ ...x.cell, textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => setEditingVariantId(v.id)}
                        title={imgCount ? `${imgCount} photo${imgCount === 1 ? '' : 's'} — click Edit to manage` : 'No photos yet'}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      >
                        {imgCount ? (
                          <span style={{ width: 30, height: 30, borderRadius: 6, overflow: 'hidden', border: '1px solid #E8EDF2', background: '#F9FAFB', flexShrink: 0 }}>
                            <img src={v.images![0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" />
                          </span>
                        ) : (
                          <span style={{ width: 30, height: 30, borderRadius: 6, border: '1px dashed #E8EDF2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#9CA3AF', flexShrink: 0 }}>
                            —
                          </span>
                        )}
                        <span style={{ fontSize: 10.5, fontWeight: 700, color: '#6B7280' }}>{imgCount || 0}</span>
                      </button>
                    </td>
                    <td style={{ ...x.cell, textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <button type="button" onClick={() => setEditingVariantId(v.id)} style={{ ...x.ghostBtn, padding: '5px 10px', marginRight: 6 }}>
                        Edit
                      </button>
                      <button
                        type="button"
                        title="You don't sell this combination — remove it"
                        onClick={() => deleteVariantRow(v.id)}
                        style={{ ...x.ghostBtn, color: '#DC2626', padding: '5px 8px' }}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p style={x.note}>
          No variant combinations yet — choose your option choices above and press
          {' '}<b>Generate missing combinations</b>.
        </p>
      )}
      {isService ? (
        <p style={x.note}>
          This is a service listing — per-combination <b>stock</b> is hidden. Appointment / resource
          availability stays controlled by the booking model; per-combination pricing still applies.
        </p>
      ) : null}

      {editingVariantId ? (
        (() => {
          const editing = productVariants.find((v) => v.id === editingVariantId);
          if (!editing) return null;
          return (
            <VariantEditModal
              key={editing.id}
              variant={editing}
              dims={effectiveDims}
              isService={isService}
              onSave={(next) => {
                saveVariant(next);
                setEditingVariantId(null);
              }}
              onApplyImagesToMatching={(draft, dimName) => {
                applyImagesToMatching(draft, dimName);
                setEditingVariantId(null);
              }}
              onClose={() => setEditingVariantId(null)}
            />
          );
        })()
      ) : null}
    </div>
  );
}

/**
 * Large centered "Edit Variant" dialog — the comfortable full editor for one
 * combination's SKU/price/MRP/stock/active/images. Replaces the old always-
 * visible inline row inputs; the table stays a scannable overview with
 * Edit/Delete actions. The option combination itself is READ-ONLY here:
 * changing which Size/Color/Fitting a variant represents after it's been
 * created could collide with another combination's key or orphan its
 * SKU/inventory record — to sell a different combination the seller deletes
 * this row and generates it fresh from the matrix, which is a safe,
 * already-supported path.
 */
function VariantEditModal({
  variant,
  dims,
  isService,
  onSave,
  onApplyImagesToMatching,
  onClose,
}: {
  variant: ProductVariantRow;
  dims: Array<{ key: string; name: string; values: string[]; custom: boolean }>;
  isService: boolean;
  onSave: (next: ProductVariantRow) => void;
  onApplyImagesToMatching: (draft: ProductVariantRow, dimName: string) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<ProductVariantRow>(variant);
  const [dirty, setDirty] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imgUrlInput, setImgUrlInput] = useState('');

  const patch = (p: Partial<ProductVariantRow>) => {
    setDraft((d) => ({ ...d, ...p }));
    setDirty(true);
  };

  const combinationLabel =
    dims
      .map((d) => draft.options?.[d.name])
      .filter((v): v is string => v != null)
      .join(' / ') || 'Unassigned combination';

  const requestClose = () => {
    if (dirty && !window.confirm('Discard unsaved changes to this variant?')) return;
    onClose();
  };

  const active = variantIsActive(draft);
  const images = draft.images ?? [];
  const applicableDims = dims.filter((d) => draft.options?.[d.name] != null);

  const addFiles = async (files: File[]) => {
    if (!files.length) return;
    setUploading(true);
    try {
      const urls = await uploadProductImages(files);
      patch({ images: [...images, ...urls] });
    } catch {
      const locals = files.map((f) => URL.createObjectURL(f));
      patch({ images: [...images, ...locals] });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[300] bg-black/50 flex items-center justify-center p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) requestClose(); }}
    >
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="shrink-0 border-b border-[#E8EDF2] px-5 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-wide text-[#9CA3AF] mb-0.5">Edit Variant</div>
            <div className="text-[15px] sm:text-[16px] font-black text-[#111827] truncate">{combinationLabel}</div>
          </div>
          <button type="button" onClick={requestClose} className="shrink-0 text-[#9CA3AF] hover:text-[#111827]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-6">
          {/* Combination */}
          <section>
            <div className="text-[10.5px] font-extrabold uppercase tracking-wide text-[#6B7280] mb-2">Combination</div>
            <div className="flex flex-wrap gap-2">
              {dims.map((d) => (
                <span
                  key={d.key}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E8EDF2] bg-[#F9FAFB] text-[12px] font-bold text-[#111827]"
                >
                  <span className="text-[#9CA3AF] font-semibold">{d.name}:</span> {draft.options?.[d.name] ?? '—'}
                </span>
              ))}
            </div>
            <p className="text-[11px] text-[#6B7280] mt-2 leading-relaxed">
              Read-only — changing which options a variant represents after it's created could collide
              with another combination or orphan its SKU/inventory record. To sell a different
              combination, delete this row and generate it from the matrix.
            </p>
          </section>

          {/* SKU */}
          <section>
            <label className="block text-[10.5px] font-extrabold uppercase tracking-wide text-[#6B7280] mb-2">SKU</label>
            <input
              value={draft.sku ?? ''}
              onChange={(e) => patch({ sku: e.target.value })}
              placeholder="e.g. SHIRT-M-RED-SLIM"
              spellCheck={false}
              className="w-full h-11 px-3.5 rounded-xl border border-[#E8EDF2] text-[13px] font-mono text-[#111827] outline-none focus:border-[#FF5B00] focus:ring-2 focus:ring-[#FF5B00]/20"
            />
          </section>

          {/* Price / MRP / Stock */}
          <section className={isService ? 'grid grid-cols-1 sm:grid-cols-2 gap-4' : 'grid grid-cols-1 sm:grid-cols-3 gap-4'}>
            <div>
              <label className="block text-[10.5px] font-extrabold uppercase tracking-wide text-[#6B7280] mb-2">Selling price ৳</label>
              <input
                type="number"
                min={0}
                value={draft.price ?? ''}
                onChange={(e) => patch({ price: e.target.value === '' ? undefined : Number(e.target.value) })}
                className="w-full h-11 px-3.5 rounded-xl border border-[#E8EDF2] text-[13px] outline-none focus:border-[#FF5B00] focus:ring-2 focus:ring-[#FF5B00]/20"
              />
            </div>
            <div>
              <label className="block text-[10.5px] font-extrabold uppercase tracking-wide text-[#6B7280] mb-2">Original / MRP ৳</label>
              <input
                type="number"
                min={0}
                value={draft.originalPrice ?? ''}
                onChange={(e) => patch({ originalPrice: e.target.value === '' ? undefined : Number(e.target.value) })}
                className="w-full h-11 px-3.5 rounded-xl border border-[#E8EDF2] text-[13px] outline-none focus:border-[#FF5B00] focus:ring-2 focus:ring-[#FF5B00]/20"
              />
            </div>
            {!isService ? (
              <div>
                <label className="block text-[10.5px] font-extrabold uppercase tracking-wide text-[#6B7280] mb-2">Stock</label>
                <input
                  type="number"
                  min={0}
                  value={draft.stock ?? ''}
                  onChange={(e) => patch({ stock: e.target.value === '' ? undefined : Number(e.target.value) })}
                  className="w-full h-11 px-3.5 rounded-xl border border-[#E8EDF2] text-[13px] outline-none focus:border-[#FF5B00] focus:ring-2 focus:ring-[#FF5B00]/20"
                />
                {(() => {
                  const st = variantStockState(draft);
                  return (
                    <span
                      className="inline-block mt-1.5 text-[10px] font-extrabold rounded px-1.5 py-0.5"
                      style={{ color: st.color, background: st.bg }}
                    >
                      {st.label}
                    </span>
                  );
                })()}
              </div>
            ) : null}
          </section>

          {/* Active */}
          <section className="flex items-start gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={active}
              onClick={() => patch({ status: active ? 'inactive' : 'active', enabled: !active })}
              className="shrink-0 mt-0.5 relative w-11 h-6 rounded-full transition-colors"
              style={{ background: active ? ACCENT : '#D1D5DB' }}
            >
              <span
                className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all"
                style={{ left: active ? 22 : 2 }}
              />
            </button>
            <div>
              <div className="text-[12.5px] font-bold text-[#111827]">Active variant</div>
              <div className="text-[11px] text-[#6B7280]">Inactive variants are not available for purchase.</div>
            </div>
          </section>

          {/* Variant Images */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10.5px] font-extrabold uppercase tracking-wide text-[#6B7280]">Variant Images</div>
              <span className="text-[11px] text-[#6B7280] font-semibold">
                {images.length} photo{images.length === 1 ? '' : 's'}
              </span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mb-3">
              {images.map((src, i) => (
                <div
                  key={`${src}-${i}`}
                  className="relative rounded-xl overflow-hidden border border-[#E8EDF2] bg-[#F9FAFB]"
                  style={{ aspectRatio: '1 / 1' }}
                >
                  <img src={src} alt="" className="w-full h-full" style={{ objectFit: 'contain' }} referrerPolicy="no-referrer" />
                  <button
                    type="button"
                    onClick={() => patch({ images: images.filter((_, j) => j !== i) })}
                    title="Remove image"
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white text-[11px] leading-none flex items-center justify-center hover:bg-black/75"
                  >
                    ×
                  </button>
                </div>
              ))}
              <label
                className="relative rounded-xl border-2 border-dashed border-[#E8EDF2] bg-[#F9FAFB] flex flex-col items-center justify-center gap-1 text-[#6B7280] hover:border-[#FF5B00]/40 cursor-pointer"
                style={{ aspectRatio: '1 / 1' }}
              >
                {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <span className="text-[20px] leading-none">＋</span>}
                <span className="text-[10px] font-bold">{uploading ? 'Uploading…' : 'Upload'}</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  disabled={uploading}
                  className="hidden"
                  onChange={async (e) => {
                    const files = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith('image/'));
                    e.currentTarget.value = '';
                    await addFiles(files);
                  }}
                />
              </label>
            </div>
            <input
              value={imgUrlInput}
              onChange={(e) => setImgUrlInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                const url = imgUrlInput.trim();
                if (url) patch({ images: [...images, url] });
                setImgUrlInput('');
              }}
              placeholder="or paste an image URL and press Enter"
              className="w-full h-9 px-3 rounded-lg border border-[#E8EDF2] text-[11.5px] outline-none focus:border-[#FF5B00] focus:ring-2 focus:ring-[#FF5B00]/20"
            />

            {images.length > 0 && applicableDims.length > 0 ? (
              <div className="mt-3 pt-3 border-t border-dashed border-[#E8EDF2]">
                <div className="text-[11px] font-bold text-[#6B7280] mb-1.5">Apply these images to other variants</div>
                <div className="flex flex-wrap gap-1.5">
                  {applicableDims.map((d) => (
                    <button
                      key={d.key}
                      type="button"
                      onClick={() => {
                        const val = draft.options?.[d.name];
                        if (
                          window.confirm(
                            `Save this variant and apply its ${images.length} image(s) to every OTHER variant where ${d.name} = ${val}? This overwrites their current images.`,
                          )
                        ) {
                          onApplyImagesToMatching(draft, d.name);
                        }
                      }}
                      title={`Apply these images to all variants with ${d.name}: ${draft.options?.[d.name]}`}
                      className="inline-flex items-center px-2.5 py-1 rounded-full border border-[#E8EDF2] bg-white text-[10.5px] font-bold text-[#374151] hover:border-[#FF5B00]/40"
                    >
                      Apply to all {d.name}: {draft.options?.[d.name]}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        </div>

        <div className="shrink-0 border-t border-[#E8EDF2] px-5 sm:px-6 py-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={requestClose}
            className="px-4 py-2.5 rounded-xl border border-[#E8EDF2] text-[12px] font-bold text-[#374151] hover:bg-[#F9FAFB]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(draft)}
            className="px-5 py-2.5 rounded-xl text-[12px] font-bold text-white hover:opacity-90"
            style={{ background: ACCENT }}
          >
            Save Variant
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────── Options & Variants — VIEW mode ───────────────────────

export function VariantSummaryView({
  optionGroups,
  productVariants,
  isService,
}: {
  optionGroups: ProductOptionGroup[];
  productVariants: ProductVariantRow[];
  isService: boolean;
}) {
  if (!optionGroups.length && !productVariants.length) {
    return <div style={{ fontSize: 11, color: '#9CA3AF', fontStyle: 'italic' }}>No product options or variant combinations.</div>;
  }
  const activeCount = productVariants.filter(variantIsActive).length;
  const prices = productVariants.map((v) => v.price).filter((p): p is number => typeof p === 'number' && p > 0);
  const minP = prices.length ? Math.min(...prices) : 0;
  const maxP = prices.length ? Math.max(...prices) : 0;
  const inStock = productVariants.filter((v) => variantIsActive(v) && (isService || (v.stock ?? 0) > 0)).length;

  // Column order for the per-combination breakdown: declared option groups first,
  // then any stray option key that appears only on variant rows.
  const comboCols: string[] = [
    ...optionGroups.map((g) => g.name),
    ...Array.from(
      new Set(productVariants.flatMap((v) => Object.keys(v.options || {}))),
    ).filter((k) => !optionGroups.some((g) => g.name === k)),
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {optionGroups.map((g) => (
        <div key={g.id}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 6 }}>
            {g.name}
            {g.custom ? <span style={{ ...x.chip, color: ACCENT, marginLeft: 6 }}>custom</span> : null}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {g.values.map((v) => (
              <span key={v} style={{ padding: '5px 11px', borderRadius: 20, fontSize: 11, fontWeight: 700, border: '1px solid #E8EDF2', background: '#fff' }}>{v}</span>
            ))}
          </div>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 11.5, color: '#374151', paddingTop: 4 }}>
        <span><b>{productVariants.length}</b> variant combination{productVariants.length === 1 ? '' : 's'}</span>
        <span><b>{activeCount}</b> active</span>
        {!isService ? <span><b>{inStock}</b> in stock</span> : null}
        {prices.length ? (
          <span>Price {minP === maxP ? `৳${minP.toLocaleString()}` : `৳${minP.toLocaleString()} – ৳${maxP.toLocaleString()}`}</span>
        ) : null}
      </div>

      {productVariants.length ? (
        <div style={{ overflowX: 'auto', border: '1px solid #E8EDF2', borderRadius: 10 }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 520 }}>
            <thead>
              <tr>
                {comboCols.map((c) => <th key={c} style={x.th}>{c}</th>)}
                <th style={x.th}>SKU</th>
                <th style={x.th}>Price ৳</th>
                {!isService ? <th style={x.th}>Stock</th> : null}
                <th style={x.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {productVariants.map((v) => {
                const st = variantStockState(v);
                return (
                  <tr key={v.id}>
                    {comboCols.map((c) => (
                      <td key={c} style={{ ...x.cell, fontWeight: 700 }}>{v.options?.[c] ?? '—'}</td>
                    ))}
                    <td style={{ ...x.cell, fontFamily: 'monospace', fontSize: 10.5 }}>{v.sku || '—'}</td>
                    <td style={x.cell}>{typeof v.price === 'number' ? `৳${v.price.toLocaleString()}` : '—'}</td>
                    {!isService ? <td style={x.cell}>{typeof v.stock === 'number' ? v.stock : '—'}</td> : null}
                    <td style={x.cell}>
                      <span style={{ fontSize: 9.5, fontWeight: 800, color: st.color, background: st.bg, borderRadius: 4, padding: '1px 6px', whiteSpace: 'nowrap' }}>{st.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

// ─────────────── Product Guide (size / measurement / fitment / …) ─────────────
// Informational seller-uploaded chart. NEVER touches variants / price / SKU /
// stock / availability / checkout. Lives inside the Options & Variants section.

const guideIsActive = (g?: ProductGuide | null): boolean =>
  !!g && g.enabled !== false && !!(g.imageUrl?.trim() || g.description?.trim() || (g.rows?.length ?? 0) > 0);

export function ProductGuideView({ guide }: { guide?: ProductGuide | null }) {
  if (!guideIsActive(guide)) return null;
  const g = guide!;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, paddingTop: 10, borderTop: '1px dashed #E8EDF2' }}>
      {g.imageUrl ? (
        <div style={{ width: 40, height: 40, borderRadius: 8, overflow: 'hidden', border: '1px solid #E8EDF2', background: '#F9FAFB', flexShrink: 0 }}>
          <img src={g.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" />
        </div>
      ) : null}
      <span style={{ fontSize: 11.5, fontWeight: 800, color: ACCENT, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        ↗ {productGuideCtaLabel(g).toUpperCase()}
      </span>
      <span style={{ fontSize: 10.5, color: '#9CA3AF' }}>shown to buyers beside the product option picker</span>
    </div>
  );
}

export function ProductGuideEditor({
  guide,
  onChange,
  onToast,
}: {
  guide?: ProductGuide;
  onChange: (next: ProductGuide) => void;
  onToast: (m: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const active = !!guide && guide.enabled !== false;
  const g: ProductGuide = guide ?? { enabled: false, guideType: 'size', type: 'image' };
  const patch = (p: Partial<ProductGuide>) => onChange({ ...g, ...p });

  const upload = async (files: FileList | File[] | null) => {
    const file = Array.from(files ?? []).find((f) => f.type.startsWith('image/'));
    if (!file) { onToast('Choose a JPG or PNG image.'); return; }
    setBusy(true);
    try {
      const [url] = await uploadProductImages([file]);
      patch({ imageUrl: url, type: 'image', enabled: true });
      onToast('Guide image uploaded.');
    } catch (err) {
      const blob = URL.createObjectURL(file);
      patch({ imageUrl: blob, type: 'image', enabled: true });
      onToast(err instanceof Error ? `${err.message} — shown as an UNSAVED local preview.` : 'Upload failed — UNSAVED local preview.');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  if (!active) {
    return (
      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed #E8EDF2' }}>
        <div style={x.label}>Size / Measurement / Compatibility Guide</div>
        <p style={{ ...x.note, margin: '0 0 8px' }}>
          Optional. Add a guide so customers can understand sizing, measurements or compatibility
          before choosing an option. Guides are informational only — they never change prices,
          stock or the variant combinations themselves.
        </p>
        <button type="button" style={x.ghostBtn} onClick={() => onChange({ enabled: true, guideType: 'size', type: 'image' })}>
          ＋ Add a guide
        </button>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed #E8EDF2', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={x.label}>Size / Measurement / Compatibility Guide</div>
        <button
          type="button"
          style={{ ...x.ghostBtn, color: '#DC2626', borderColor: '#FECACA' }}
          onClick={() => onChange({ enabled: false })}
        >
          Remove guide
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div>
          <div style={x.label}>Guide type</div>
          <select
            style={x.input as CSSProperties}
            value={g.guideType || 'size'}
            onChange={(e) => patch({ guideType: e.target.value as ProductGuide['guideType'] })}
          >
            {GUIDE_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <div style={{ ...x.note, marginTop: 4 }}>Buyer sees: <b>{productGuideCtaLabel(g)}</b></div>
        </div>
        {g.guideType === 'custom' ? (
          <div>
            <div style={x.label}>Custom CTA label</div>
            <input
              style={x.input as CSSProperties}
              value={g.label ?? ''}
              maxLength={40}
              placeholder="e.g. View Fit & Care Guide"
              onChange={(e) => patch({ label: e.target.value })}
            />
          </div>
        ) : null}
      </div>

      <div>
        <div style={x.label}>Guide image</div>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => void upload(e.target.files)} />
        {g.imageUrl ? (
          <div style={{ position: 'relative', maxWidth: 320, border: '1px solid #E8EDF2', borderRadius: 10, overflow: 'hidden', background: '#F9FAFB' }}>
            <img src={g.imageUrl} alt="Guide" style={{ display: 'block', width: '100%', maxHeight: 240, objectFit: 'contain', background: '#fff' }} referrerPolicy="no-referrer" />
            <div style={{ display: 'flex', gap: 8, padding: 8 }}>
              <button type="button" style={x.ghostBtn} disabled={busy} onClick={() => fileRef.current?.click()}>
                {busy ? 'Uploading…' : 'Replace image'}
              </button>
              <button type="button" style={{ ...x.ghostBtn, color: '#DC2626' }} onClick={() => patch({ imageUrl: undefined })}>
                Remove image
              </button>
            </div>
          </div>
        ) : (
          <div
            role="button"
            tabIndex={0}
            onClick={() => !busy && fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); void upload(e.dataTransfer.files); }}
            style={{ border: '2px dashed #E5E7EB', borderRadius: 10, padding: '22px 12px', textAlign: 'center', color: '#9CA3AF', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', background: '#fff' }}
          >
            {busy ? 'Uploading…' : 'Drop a chart image or click to upload (JPG / PNG)'}
          </div>
        )}
        <div style={{ ...x.note, marginTop: 4 }}>Shown to the buyer exactly as uploaded, in a pop-up viewer — no measurements are added or altered.</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
        <div>
          <div style={x.label}>Title (optional)</div>
          <input
            style={x.input as CSSProperties}
            value={g.title ?? ''}
            maxLength={120}
            placeholder="e.g. Men's Panjabi — Chest & Length"
            onChange={(e) => patch({ title: e.target.value })}
          />
        </div>
        <div>
          <div style={x.label}>Short description (optional)</div>
          <textarea
            style={{ ...(x.input as CSSProperties), height: 60, padding: '8px 10px', resize: 'vertical' }}
            value={g.description ?? ''}
            maxLength={600}
            placeholder="e.g. Measured flat, in inches. Allow ~1 inch ease for a relaxed fit."
            onChange={(e) => patch({ description: e.target.value })}
          />
        </div>
      </div>

      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, color: '#374151' }}>
        <input type="checkbox" checked={g.enabled !== false} onChange={(e) => patch({ enabled: e.target.checked })} />
        Show this guide on the storefront
      </label>
    </div>
  );
}

// ──────────────────────────────── Add-on Items ───────────────────────────────

export function AddonItemsEditor({
  items,
  onChange,
}: {
  items: ProductAddonRow[];
  onChange: (next: ProductAddonRow[]) => void;
}) {
  const sorted = useMemo(
    () => [...items].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [items],
  );

  const patch = (id: string, p: Partial<ProductAddonRow>) =>
    onChange(items.map((a) => (a.id === id ? { ...a, ...p } : a)));

  const add = () =>
    onChange([
      ...items,
      {
        id: `addon-${Date.now()}`,
        title: '',
        price: 0,
        enabled: true,
        sortOrder: (items.reduce((m, a) => Math.max(m, a.sortOrder ?? 0), 0) || 0) + 1,
      },
    ]);

  const remove = (id: string) => onChange(items.filter((a) => a.id !== id));

  const move = (id: string, dir: -1 | 1) => {
    const ordered = [...sorted];
    const i = ordered.findIndex((a) => a.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ordered.length) return;
    [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
    onChange(ordered.map((a, idx) => ({ ...a, sortOrder: idx + 1 })));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={x.note}>
        Optional paid extras a buyer can add alongside this item (Gift Wrap, Installation,
        Breakfast…). Distinct from variants — these don't change the main item, they add a charge.
      </div>
      {sorted.length === 0 ? (
        <p style={{ ...x.note, fontStyle: 'italic' }}>No add-ons yet.</p>
      ) : (
        sorted.map((a, idx) => (
          <div key={a.id} style={{ border: '1px solid #E8EDF2', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8 }}>
              <div>
                <div style={x.label}>Name</div>
                <input value={a.title} onChange={(e) => patch(a.id, { title: e.target.value })} placeholder="e.g. Gift Wrap" style={x.input} />
              </div>
              <div>
                <div style={x.label}>Additional price ৳</div>
                <input type="number" min={0} value={a.price || ''} onChange={(e) => patch(a.id, { price: Number(e.target.value) || 0 })} style={x.input} />
              </div>
            </div>
            <div>
              <div style={x.label}>Description / subtitle</div>
              <input value={a.description ?? ''} onChange={(e) => patch(a.id, { description: e.target.value })} placeholder="Optional" style={x.input} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <div style={x.label}>Badge (optional)</div>
                <input value={a.badge ?? ''} onChange={(e) => patch(a.id, { badge: e.target.value || undefined })} placeholder="Popular / Recommended / Best Value" style={x.input} />
              </div>
              <div>
                <div style={x.label}>Max quantity (blank = 1)</div>
                <input type="number" min={1} value={a.maxQuantity ?? ''} onChange={(e) => patch(a.id, { maxQuantity: e.target.value === '' ? undefined : Math.max(1, Number(e.target.value)) })} style={x.input} />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700 }}>
                <input type="checkbox" checked={a.enabled !== false} onChange={(e) => patch(a.id, { enabled: e.target.checked })} />
                Enabled
              </label>
              <span style={{ display: 'inline-flex', gap: 4 }}>
                <button type="button" onClick={() => move(a.id, -1)} disabled={idx === 0} style={x.ghostBtn}>↑</button>
                <button type="button" onClick={() => move(a.id, 1)} disabled={idx === sorted.length - 1} style={x.ghostBtn}>↓</button>
              </span>
              <button type="button" onClick={() => remove(a.id)} style={{ ...x.ghostBtn, color: '#DC2626', marginLeft: 'auto' }}>Remove</button>
            </div>
          </div>
        ))
      )}
      <div>
        <button type="button" onClick={add} style={x.accentBtn}>+ Add-on item</button>
      </div>
    </div>
  );
}

// ─────────────────────── Add-on Items — VIEW mode ───────────────────────

export function AddonItemsView({ items }: { items: ProductAddonRow[] }) {
  const shown = [...items].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  if (!shown.length) {
    return <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0, fontStyle: 'italic' }}>No add-on items.</p>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase' }}>Optional add-ons</div>
      {shown.map((a) => (
        <div
          key={a.id}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
            fontSize: 12, opacity: a.enabled === false ? 0.45 : 1,
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" disabled />
            <span style={{ fontWeight: 700, color: '#1A1A2E' }}>{a.title || 'Untitled add-on'}</span>
            {a.badge ? (
              <span style={{ background: ACCENT_WASH, color: '#C2410C', fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 20, textTransform: 'uppercase' }}>{a.badge}</span>
            ) : null}
            {a.enabled === false ? <span style={{ fontSize: 9, color: '#9CA3AF', fontWeight: 800 }}>DISABLED</span> : null}
          </span>
          <span style={{ color: ACCENT, fontWeight: 800 }}>{a.price > 0 ? `+ ৳${a.price.toLocaleString()}` : 'Free'}</span>
        </div>
      ))}
    </div>
  );
}

// ─────────────────── Category-change compatibility guard ──────────────────────

export function CategoryChangeDecision({
  compat,
  fromName,
  toName,
  onRemap,
  onClear,
  onCancel,
}: {
  compat: CategorySchemaCompatibility;
  fromName: string;
  toName: string;
  onRemap: () => void;
  onClear: () => void;
  onCancel: () => void;
}) {
  return (
    <div style={x.warnBox}>
      <div style={{ fontSize: 12.5, fontWeight: 800, color: '#92400E', marginBottom: 6 }}>
        “{toName}” doesn't fit the current variant configuration
      </div>
      <div style={{ ...x.note, color: '#92400E' }}>
        Changing category from <b>{fromName || '—'}</b> to <b>{toName}</b> would leave variant data
        that isn't valid under the new schema. Nothing is deleted or silently kept — choose one:
      </div>
      <ul style={{ ...x.note, color: '#92400E', margin: '8px 0', paddingLeft: 18 }}>
        {compat.invalidGroups.length ? <li>Dimensions not in the new schema: <b>{compat.invalidGroups.join(', ')}</b></li> : null}
        {compat.invalidValues.length ? <li>Values not permitted: <b>{compat.invalidValues.join(', ')}</b></li> : null}
        {compat.invalidVariantIds.length ? <li><b>{compat.invalidVariantIds.length}</b> combination(s) reference invalid data</li> : null}
      </ul>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" onClick={onRemap} style={x.accentBtn}>Remap existing data</button>
        <button type="button" onClick={onClear} style={{ ...x.ghostBtn, borderColor: '#DC2626', color: '#DC2626' }}>
          Clear incompatible data…
        </button>
        <button type="button" onClick={onCancel} style={x.ghostBtn}>Cancel category change</button>
      </div>
    </div>
  );
}

export function checkCompat(
  optionGroups: ProductOptionGroup[],
  productVariants: ProductVariantRow[],
  schemaDims: SchemaVariantDimension[],
): CategorySchemaCompatibility {
  return checkCategorySchemaCompatibility(optionGroups, productVariants, schemaDims);
}

// ─────────────────── Category-change: explicit REMAP panel ────────────────────

const DROP = '__drop__';

/**
 * Explicitly map the product's current variant dimensions/values into the new
 * category's variant-eligible dimensions. Anything left as "Drop" is removed and
 * counted — no silent deletion, no silent retention of schema-invalid data.
 */
export function VariantRemapPanel({
  optionGroups,
  productVariants,
  targetDims,
  onApply,
  onCancel,
}: {
  optionGroups: ProductOptionGroup[];
  productVariants: ProductVariantRow[];
  targetDims: SchemaVariantDimension[];
  onApply: (next: { optionGroups: ProductOptionGroup[]; productVariants: ProductVariantRow[] }) => void;
  onCancel: () => void;
}) {
  // dimMap: current group name -> target dim key | DROP
  const [dimMap, setDimMap] = useState<Record<string, string>>(() => {
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');
    const out: Record<string, string> = {};
    for (const g of optionGroups) {
      const hit = targetDims.find((d) => norm(d.name) === norm(g.name) || norm(d.key) === norm(g.name));
      out[g.name] = hit ? hit.key : DROP;
    }
    return out;
  });
  // valMap: `${groupName}::${value}` -> new value | DROP
  const [valMap, setValMap] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const g of optionGroups) {
      for (const v of g.values) out[`${g.name}::${v}`] = v;
    }
    return out;
  });

  const dimByKey = useMemo(() => new Map(targetDims.map((d) => [d.key, d])), [targetDims]);

  const build = () => {
    const groups: ProductOptionGroup[] = [];
    const groupNameToTarget = new Map<string, SchemaVariantDimension>();
    for (const g of optionGroups) {
      const tk = dimMap[g.name];
      if (!tk || tk === DROP) continue;
      const dim = dimByKey.get(tk);
      if (!dim) continue;
      groupNameToTarget.set(g.name, dim);
      const isSelect = dim.type === 'select' || dim.type === 'multi_select';
      const mappedValues = [
        ...new Set(
          g.values
            .map((v) => (isSelect ? valMap[`${g.name}::${v}`] : v))
            .filter((v) => v && v !== DROP && (!isSelect || dim.options.includes(v))),
        ),
      ] as string[];
      if (!mappedValues.length) continue;
      const existing = groups.find((x) => x.name === dim.name);
      if (existing) existing.values = [...new Set([...existing.values, ...mappedValues])];
      else
        groups.push({
          id: `og-${dim.key}`,
          name: dim.name,
          displayType: g.displayType || (dim.name.toLowerCase().includes('color') ? 'swatch' : 'pills'),
          values: mappedValues,
        });
    }

    const seen = new Set<string>();
    const variants: ProductVariantRow[] = [];
    for (const v of productVariants) {
      const nextOptions: Record<string, string> = {};
      let drop = false;
      for (const [oldKey, oldVal] of Object.entries(v.options || {})) {
        const dim = groupNameToTarget.get(oldKey);
        if (!dim) { drop = true; break; }
        const isSelect = dim.type === 'select' || dim.type === 'multi_select';
        const mapped = isSelect ? valMap[`${oldKey}::${oldVal}`] : oldVal;
        if (!mapped || mapped === DROP || (isSelect && !dim.options.includes(mapped))) { drop = true; break; }
        nextOptions[dim.name] = mapped;
      }
      if (drop || !Object.keys(nextOptions).length) continue;
      const key = variantKey(nextOptions);
      if (seen.has(key)) continue;
      seen.add(key);
      variants.push({ ...v, options: nextOptions });
    }
    return { optionGroups: groups, productVariants: variants };
  };

  const preview = build();

  return (
    <div style={{ ...x.warnBox, borderColor: '#93C5FD', background: '#EFF6FF', marginTop: 12 }}>
      <div style={{ fontSize: 12.5, fontWeight: 800, color: '#1E3A8A', marginBottom: 8 }}>Remap variant data</div>
      {optionGroups.length === 0 ? (
        <p style={x.note}>No option groups to remap.</p>
      ) : (
        optionGroups.map((g) => {
          const tk = dimMap[g.name];
          const dim = tk && tk !== DROP ? dimByKey.get(tk) : undefined;
          const isSelect = dim && (dim.type === 'select' || dim.type === 'multi_select');
          return (
            <div key={g.name} style={{ borderTop: '1px solid #DBEAFE', paddingTop: 8, marginTop: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, fontWeight: 800 }}>{g.name}</span>
                <span style={{ fontSize: 11, color: '#6B7280' }}>maps to →</span>
                <select
                  value={tk}
                  onChange={(e) => setDimMap((p) => ({ ...p, [g.name]: e.target.value }))}
                  style={{ ...x.smallInput, width: 180 }}
                >
                  {targetDims.map((d) => <option key={d.key} value={d.key}>{d.name}</option>)}
                  <option value={DROP}>— Drop this dimension —</option>
                </select>
              </div>
              {dim && isSelect ? (
                <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {g.values.map((v) => (
                    <div key={v} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5 }}>
                      <span style={{ minWidth: 90 }}>{v}</span>
                      <span style={{ color: '#6B7280' }}>→</span>
                      <select
                        value={valMap[`${g.name}::${v}`] ?? DROP}
                        onChange={(e) => setValMap((p) => ({ ...p, [`${g.name}::${v}`]: e.target.value }))}
                        style={{ ...x.smallInput, width: 160 }}
                      >
                        {dim.options.map((o) => <option key={o} value={o}>{o}</option>)}
                        <option value={DROP}>— Drop —</option>
                      </select>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })
      )}
      <div style={{ ...x.note, marginTop: 10 }}>
        <b>{preview.productVariants.length}</b> of {productVariants.length} combination(s) kept ·{' '}
        <b>{preview.optionGroups.length}</b> dimension(s) after remap.
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button type="button" onClick={() => onApply(preview)} style={x.accentBtn}>Apply remap &amp; switch category</button>
        <button type="button" onClick={onCancel} style={x.ghostBtn}>Back</button>
      </div>
    </div>
  );
}

// ─────────────────────── Specifications — label/value card grid ───────────────
// Mirrors the storefront "Product Specifications" section, which renders each
// spec as its own labelled card. The editor is the same shape: one card per
// spec with a LABEL field and a VALUE field, laid out in a responsive grid.

type SpecPair = { key: string; value: string };

export function SpecRowsEditor({
  rows,
  onChange,
  labelPlaceholder = 'e.g. Material',
  valuePlaceholder = 'e.g. Full-grain leather',
}: {
  rows: SpecPair[];
  onChange: (next: SpecPair[]) => void;
  labelPlaceholder?: string;
  valuePlaceholder?: string;
}) {
  const list = rows || [];
  const patch = (i: number, p: Partial<SpecPair>) =>
    onChange(list.map((r, idx) => (idx === i ? { ...r, ...p } : r)));
  const remove = (i: number) => onChange(list.filter((_, idx) => idx !== i));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const add = () => onChange([...list, { key: '', value: '' }]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={x.note}>
        Each row is one card in the storefront Product Specifications grid — a label and its value.
      </div>
      {list.length === 0 ? (
        <p style={{ ...x.note, fontStyle: 'italic' }}>No specifications yet.</p>
      ) : null}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10, alignItems: 'start' }}>
        {list.map((r, i) => (
          <div key={i} style={{ border: '1px solid #E8EDF2', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div>
              <div style={x.label}>Label</div>
              <input value={r.key} onChange={(e) => patch(i, { key: e.target.value })} placeholder={labelPlaceholder} style={{ ...x.input, fontWeight: 700 }} />
            </div>
            <div>
              <div style={x.label}>Value</div>
              <input value={r.value} onChange={(e) => patch(i, { value: e.target.value })} placeholder={valuePlaceholder} style={x.input} />
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} style={x.ghostBtn}>↑</button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === list.length - 1} style={x.ghostBtn}>↓</button>
              <button type="button" onClick={() => remove(i)} style={{ ...x.ghostBtn, color: '#DC2626', marginLeft: 'auto' }}>Remove</button>
            </div>
          </div>
        ))}
      </div>
      <div>
        <button type="button" onClick={add} style={x.accentBtn}>+ Add specification</button>
      </div>
    </div>
  );
}

// ─────────────────────────── Best For Tags — hashtags ────────────────────────
// The storefront renders these as "# BEST FOR TAGS" pills (it prepends the `#`),
// so stored values must be bare tokens. The editor keeps a raw text buffer while
// typing (so a leading `#` or spaces don't fight the caret) and normalises into
// clean, de-duped tokens on every change; a live pill row previews the result.

export function parseHashtags(value: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of value.split(/[\n,\s]+/)) {
    const tag = raw
      .trim()
      .replace(/^#+/, '')
      .replace(/[^\p{L}\p{N}_-]+/gu, '')
      .replace(/^[-_]+|[-_]+$/g, '');
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
  }
  return out;
}

export function HashtagsEditor({
  tags,
  onChange,
}: {
  tags: string[];
  onChange: (next: string[]) => void;
}) {
  const [text, setText] = useState(() => (tags || []).join(' '));
  const onInput = (v: string) => {
    setText(v);
    onChange(parseHashtags(v));
  };
  const preview = parseHashtags(text);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={x.label}>Hashtags — space or comma separated</div>
      <textarea
        rows={2}
        value={text}
        onChange={(e) => onInput(e.target.value)}
        placeholder="#beauty #spa #skincare #grooming"
        style={{ width: '100%', boxSizing: 'border-box', borderRadius: 8, border: '1px solid #E8EDF2', padding: '8px 10px', fontSize: 12.5, resize: 'vertical', outline: 'none', fontFamily: 'inherit' }}
      />
      <div style={x.note}>
        Type with or without “#”. Buyers see these as “# BEST FOR TAGS” pills on the storefront.
      </div>
      {preview.length ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
          {preview.map((t) => (
            <span key={t} style={{ padding: '3px 10px', borderRadius: 999, background: '#F3E8FF', color: '#8A00C4', fontSize: 11, fontWeight: 700 }}>#{t}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ─────────────────────── Product Overview — preset + custom blocks ────────────

const linesToArr = (s: string) => s.split('\n').map((v) => v.trim()).filter(Boolean);

export function OverviewBlocksEditor({
  blocks,
  onChange,
}: {
  blocks: OverviewBlock[];
  onChange: (next: OverviewBlock[]) => void;
}) {
  const patch = (id: string, p: Partial<OverviewBlock>) =>
    onChange(blocks.map((b) => (b.id === id ? { ...b, ...p } : b)));
  const remove = (id: string) => onChange(blocks.filter((b) => b.id !== id));
  const move = (id: string, dir: -1 | 1) => {
    const i = blocks.findIndex((b) => b.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const addBlock = (title: string) =>
    onChange([...blocks, { id: `ov-${Date.now()}`, title, bullets: [] }]);
  const unusedPresets = OVERVIEW_PRESET_TITLES.filter(
    (t) => !blocks.some((b) => b.title.trim().toLowerCase() === t.toLowerCase()),
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={x.note}>
        Each block becomes its own column on the storefront Product Overview. Rename a block, add
        your own, or remove ones you don't use.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10, alignItems: 'start' }}>
      {blocks.map((b, idx) => (
        <div key={b.id} style={{ border: '1px solid #E8EDF2', borderRadius: 10, padding: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <input
              value={b.title}
              onChange={(e) => patch(b.id, { title: e.target.value })}
              placeholder="Block title (e.g. Quality & Materials)"
              style={{ ...x.input, fontWeight: 800, minWidth: 0 }}
            />
            <span style={{ display: 'inline-flex', gap: 4, flexShrink: 0 }}>
              <button type="button" onClick={() => move(b.id, -1)} disabled={idx === 0} style={x.ghostBtn}>↑</button>
              <button type="button" onClick={() => move(b.id, 1)} disabled={idx === blocks.length - 1} style={x.ghostBtn}>↓</button>
            </span>
            <button type="button" onClick={() => remove(b.id)} style={{ ...x.ghostBtn, color: '#DC2626', flexShrink: 0 }}>Remove</button>
          </div>
          <textarea
            rows={3}
            value={b.bullets.join('\n')}
            onChange={(e) => patch(b.id, { bullets: linesToArr(e.target.value) })}
            placeholder="One bullet per line"
            style={{ width: '100%', boxSizing: 'border-box', borderRadius: 8, border: '1px solid #E8EDF2', padding: '8px 10px', fontSize: 12, resize: 'vertical', outline: 'none', fontFamily: 'inherit' }}
          />
        </div>
      ))}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {unusedPresets.map((t) => (
          <button key={t} type="button" onClick={() => addBlock(t)} style={x.ghostBtn}>+ {t}</button>
        ))}
        <button type="button" onClick={() => addBlock('New section')} style={x.accentBtn}>+ Custom block</button>
      </div>
    </div>
  );
}

// ──────────────────────────── Creator Reviews editor ────────────────────────

const CREATOR_PLATFORMS = ['YouTube', 'Instagram', 'TikTok', 'Facebook', 'Vimeo', 'Other'];

/**
 * Thumbnail control for one creator review. Primary action is a real image
 * upload (POST /catalog/media/upload via uploadCreatorImage); a pasted link is
 * still accepted as a fallback. When nothing is set the card falls back to the
 * video's own poster where the platform exposes one (YouTube).
 */
function CreatorThumbField({
  video,
  onPatch,
}: {
  video: CreatorVideo;
  onPatch: (p: Partial<CreatorVideo>) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const explicit = (video.thumbnail || '').trim();
  const resolved = resolveCreatorThumbnail(video.videoUrl, explicit);
  const usingVideoPoster = !explicit && !!resolved;

  const pick = async (file?: File | null) => {
    if (!file) return;
    setErr('');
    setBusy(true);
    try {
      const url = await uploadCreatorImage(file);
      onPatch({ thumbnail: url });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div>
      <div style={x.label}>Thumbnail image</div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <div
          style={{
            width: 120,
            height: 68,
            borderRadius: 6,
            border: '1px solid #E8EDF2',
            background: '#F4F7F9',
            overflow: 'hidden',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {resolved ? (
            <img src={resolved} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" />
          ) : (
            <span style={{ fontSize: 9.5, color: '#9CA3AF', textAlign: 'center', padding: 4 }}>No thumbnail</span>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, flex: 1 }}>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
            style={{ display: 'none' }}
            onChange={(e) => void pick(e.target.files?.[0])}
          />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} style={x.ghostBtn}>
              {busy ? 'Uploading…' : explicit ? 'Replace image' : 'Upload image'}
            </button>
            {explicit ? (
              <button type="button" onClick={() => onPatch({ thumbnail: '' })} style={{ ...x.ghostBtn, color: '#DC2626' }}>
                Remove image
              </button>
            ) : null}
          </div>
          <input
            value={video.thumbnail}
            onChange={(e) => onPatch({ thumbnail: e.target.value })}
            placeholder="…or paste an image link"
            style={{ ...x.input, height: 30, fontSize: 11.5 }}
          />
          {usingVideoPoster ? (
            <div style={{ ...x.note, fontSize: 10 }}>Using the video&rsquo;s own thumbnail. Upload an image to override it.</div>
          ) : null}
          {!resolved ? (
            <div style={{ ...x.note, fontSize: 10 }}>
              No image, and this platform has no automatic thumbnail — the storefront card shows a play icon.
            </div>
          ) : null}
          {err ? <div style={{ fontSize: 10, color: '#DC2626', fontWeight: 700 }}>{err}</div> : null}
        </div>
      </div>
    </div>
  );
}

export function CreatorReviewsEditor({
  videos,
  onChange,
}: {
  videos: CreatorVideo[];
  onChange: (next: CreatorVideo[]) => void;
}) {
  const patch = (id: string, p: Partial<CreatorVideo>) =>
    onChange(videos.map((v) => (v.id === id ? { ...v, ...p } : v)));
  const remove = (id: string) => onChange(videos.filter((v) => v.id !== id));
  const add = () =>
    onChange([
      ...videos,
      { id: `cr-${Date.now()}`, title: '', platform: 'YouTube', thumbnail: '', videoUrl: '', creatorHandle: '' },
    ]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={x.note}>
        Add video reviews of this product — your own or a creator's. Paste the shareable / embed
        link, then upload a thumbnail image (or leave it blank to use the video's own poster).
        The storefront renders these with its existing player.
      </div>
      {videos.length === 0 ? <p style={{ ...x.note, fontStyle: 'italic' }}>No creator reviews yet.</p> : null}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 10, alignItems: 'start' }}>
      {videos.map((v) => (
        <div key={v.id} style={{ border: '1px solid #E8EDF2', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8 }}>
            <div>
              <div style={x.label}>Platform</div>
              <select value={v.platform} onChange={(e) => patch(v.id, { platform: e.target.value })} style={x.input}>
                {CREATOR_PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <div style={x.label}>Title</div>
              <input value={v.title} onChange={(e) => patch(v.id, { title: e.target.value })} placeholder="e.g. Full hands-on review" style={x.input} />
            </div>
          </div>
          <div>
            <div style={x.label}>Shareable / embed video link (https)</div>
            <input value={v.videoUrl} onChange={(e) => patch(v.id, { videoUrl: e.target.value })} placeholder="https://youtube.com/watch?v=… / https://instagram.com/reel/…" style={x.input} />
          </div>
          <CreatorThumbField video={v} onPatch={(p) => patch(v.id, p)} />
          <div>
            <div style={x.label}>Creator handle (optional)</div>
            <input value={v.creatorHandle ?? ''} onChange={(e) => patch(v.id, { creatorHandle: e.target.value })} placeholder="@handle" style={x.input} />
          </div>
          <button type="button" onClick={() => remove(v.id)} style={{ ...x.ghostBtn, color: '#DC2626', alignSelf: 'flex-start' }}>Remove review</button>
        </div>
      ))}
      </div>
      <div>
        <button type="button" onClick={add} style={x.accentBtn}>+ Add creator review</button>
      </div>
    </div>
  );
}

// ─────────────────── Warranty & After-Sales Services ────────────────────────

export function WarrantyEditor({
  months,
  type,
  provider,
  terms,
  afterSales,
  onChange,
}: {
  months: number;
  type: string;
  provider: string;
  terms: string;
  afterSales: string[];
  onChange: (p: Partial<{ months: number; type: string; provider: string; terms: string; afterSales: string[] }>) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <div>
          <div style={x.label}>Warranty (months)</div>
          <input type="number" min={0} value={months || ''} onChange={(e) => onChange({ months: Number(e.target.value) || 0 })} style={x.input} />
        </div>
        <div>
          <div style={x.label}>Warranty type</div>
          <input value={type} onChange={(e) => onChange({ type: e.target.value })} placeholder="e.g. Brand / Seller / International" style={x.input} />
        </div>
        <div>
          <div style={x.label}>Provider</div>
          <input value={provider} onChange={(e) => onChange({ provider: e.target.value })} placeholder="e.g. Samsung Bangladesh" style={x.input} />
        </div>
      </div>
      <div>
        <div style={x.label}>Warranty terms</div>
        <textarea rows={3} value={terms} onChange={(e) => onChange({ terms: e.target.value })} placeholder="What the warranty covers, claim process, exclusions…" style={{ width: '100%', boxSizing: 'border-box', borderRadius: 8, border: '1px solid #E8EDF2', padding: '8px 10px', fontSize: 12, resize: 'vertical', outline: 'none', fontFamily: 'inherit' }} />
      </div>
      <div>
        <div style={{ ...x.label, marginBottom: 6 }}>After-sales services — one per line</div>
        <textarea rows={4} value={afterSales.join('\n')} onChange={(e) => onChange({ afterSales: linesToArr(e.target.value) })} placeholder={'Free servicing for 6 months\n7-day replacement on defects\nAuthorized service centres nationwide\nDedicated after-sales hotline'} style={{ width: '100%', boxSizing: 'border-box', borderRadius: 8, border: '1px solid #E8EDF2', padding: '8px 10px', fontSize: 12, resize: 'vertical', outline: 'none', fontFamily: 'inherit' }} />
        <div style={x.note}>Leave everything blank to hide the storefront section.</div>
      </div>
    </div>
  );
}

export function WarrantyInfoView({
  months,
  type,
  provider,
  terms,
  afterSales,
}: {
  months: number;
  type: string;
  provider: string;
  terms: string;
  afterSales: string[];
}) {
  const facts = (afterSales || []).filter(Boolean);
  const hasWarranty = months > 0 || !!type || !!provider || !!terms;
  if (!hasWarranty && !facts.length) {
    return <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0, fontStyle: 'italic' }}>No warranty or after-sales info yet.</p>;
  }
  return (
    <div style={{ fontSize: 12.5, color: '#4B5563', lineHeight: 1.6 }}>
      {hasWarranty ? (
        <div style={{ marginBottom: facts.length ? 10 : 0 }}>
          <span style={{ fontWeight: 800, color: '#1A1A2E' }}>
            {months > 0 ? `${months} month${months === 1 ? '' : 's'} warranty` : 'Warranty'}
          </span>
          {type ? ` · ${type}` : ''}
          {provider ? ` · ${provider}` : ''}
          {terms ? <div style={{ marginTop: 3 }}>{terms}</div> : null}
        </div>
      ) : null}
      {facts.length ? (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {facts.map((f) => (
            <li key={f} style={{ display: 'flex', gap: 6 }}>
              <span style={{ color: '#15803D' }}>✓</span>
              <span>{f}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

// ─────────────────────────── Related Information ─────────────────────────────
// Two independently-owned surfaces merged only for the storefront:
//   • seller-owned  — `stores` / `whatsNearby` / `beforeYourVisit` (editable here)
//   • Choosify-owned — `adminPromoted` (READ-ONLY here; a separate admin tool
//     manages them). `locked` puts the whole section in read-only mode.

const RELATED_TYPE_LABEL: Record<RelatedInfoType, string> = {
  '': 'No related-info panel',
  price_across_stores: 'Where to Buy / Price Across Stores',
  whats_nearby: "What's Nearby",
  before_your_visit: 'Before Your Visit',
  custom: 'Custom section (your own headings)',
};

const RELATED_TYPE_OPTIONS: RelatedInfoType[] = [
  'price_across_stores',
  'whats_nearby',
  'before_your_visit',
  'custom',
];

const NEARBY_BUCKETS: Array<{ key: keyof EditorWhatsNearby; label: string }> = [
  { key: 'restaurantCafe', label: 'Restaurants & cafés' },
  { key: 'entertainmentAttraction', label: 'Entertainment & attractions' },
  { key: 'hospitalPoliceStation', label: 'Hospitals & police stations' },
  { key: 'transportAirport', label: 'Transport & airport' },
  { key: 'shoppingAtm', label: 'Shopping & ATM' },
];
type BeforeVisitStringKey = Exclude<keyof EditorBeforeYourVisit, 'customFields'>;
const VISIT_FIELDS: Array<{ key: BeforeVisitStringKey; label: string; placeholder: string }> = [
  { key: 'parkingAvailability', label: 'Parking availability', placeholder: 'Shared lot behind the building' },
  { key: 'cancellationPolicy', label: 'Cancellation policy', placeholder: 'Reschedule once free; late cancel incurs 30% fee' },
  { key: 'whatToBring', label: 'What to bring', placeholder: 'ID, prior prescriptions, comfortable clothing' },
  { key: 'wheelchairAccess', label: 'Wheelchair access', placeholder: 'Lift access to all treatment rooms' },
  { key: 'insuranceAccepted', label: 'Insurance accepted', placeholder: 'MetLife, Guardian, Pragati' },
];

type RelatedInfoChange = Partial<{
  relatedInfoType: RelatedInfoType;
  priceAcrossStoresEnabled: boolean;
  relatedStores: EditorRelatedStore[];
  whatsNearby: EditorWhatsNearby;
  beforeYourVisit: EditorBeforeYourVisit;
  customRelatedInfoTitle: string;
  customRelatedBlocks: EditorCustomRelatedBlock[];
}>;

function PromotedStoreRow({ s }: { s: RelatedStoreEntry }) {
  return (
    <div
      style={{
        border: '1px solid #E8D9FF',
        background: '#FAF5FF',
        borderRadius: 8,
        padding: '8px 10px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      {s.logoUrl ? (
        <img src={s.logoUrl} alt="" style={{ width: 22, height: 22, objectFit: 'contain', borderRadius: 4 }} referrerPolicy="no-referrer" />
      ) : null}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: '#1A1A2E' }}>
          {s.storeName}
          {typeof s.price === 'number' && s.price > 0 ? ` · ৳${s.price}` : ''}
        </div>
        <div style={{ fontSize: 10, color: '#8A00C4', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {s.promoLabel || 'Promoted by Choosify'}
        </div>
      </div>
      <span style={{ fontSize: 10, color: '#9CA3AF' }}>Managed by Choosify</span>
    </div>
  );
}

export function RelatedInfoEditor({
  type,
  priceAcrossStoresEnabled,
  stores,
  adminPromoted,
  locked,
  whatsNearby,
  beforeYourVisit,
  customTitle,
  customBlocks,
  suggestedType,
  onChange,
}: {
  type: RelatedInfoType;
  priceAcrossStoresEnabled: boolean;
  stores: EditorRelatedStore[];
  adminPromoted: RelatedStoreEntry[];
  locked: boolean;
  whatsNearby: EditorWhatsNearby;
  beforeYourVisit: EditorBeforeYourVisit;
  customTitle: string;
  customBlocks: EditorCustomRelatedBlock[];
  suggestedType: RelatedInfoType;
  onChange: (p: RelatedInfoChange) => void;
}) {
  const patchBlock = (id: string, p: Partial<EditorCustomRelatedBlock>) =>
    onChange({ customRelatedBlocks: customBlocks.map((b) => (b.id === id ? { ...b, ...p } : b)) });
  const removeBlock = (id: string) =>
    onChange({ customRelatedBlocks: customBlocks.filter((b) => b.id !== id) });
  const moveBlock = (id: string, dir: -1 | 1) => {
    const i = customBlocks.findIndex((b) => b.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= customBlocks.length) return;
    const next = [...customBlocks];
    [next[i], next[j]] = [next[j], next[i]];
    onChange({ customRelatedBlocks: next });
  };
  const addBlock = () =>
    onChange({ customRelatedBlocks: [...customBlocks, { id: `crb-${Date.now()}`, heading: '', items: [] }] });
  const patchStore = (id: string, p: Partial<EditorRelatedStore>) =>
    onChange({ relatedStores: stores.map((s) => (s.id === id ? { ...s, ...p } : s)) });
  const removeStore = (id: string) => onChange({ relatedStores: stores.filter((s) => s.id !== id) });
  const moveStore = (id: string, dir: -1 | 1) => {
    const i = stores.findIndex((s) => s.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= stores.length) return;
    const next = [...stores];
    [next[i], next[j]] = [next[j], next[i]];
    onChange({ relatedStores: next });
  };
  const addStore = () =>
    onChange({
      relatedStores: [
        ...stores,
        { id: `sc-${Date.now()}`, storeName: '', storeUrl: '', price: 0, availability: 'In stock', storeRating: 0, isFeatured: false, logoUrl: '' },
      ],
    });

  if (locked) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ ...x.warnBox, borderColor: '#C7B3F0', background: '#FAF5FF' }}>
          <div style={{ fontWeight: 800, color: '#6D28D9', fontSize: 12 }}>Managed by Choosify</div>
          <div style={{ ...x.note, marginTop: 2 }}>
            Seller editing of the Related Information section is temporarily restricted by Choosify.
            Your existing entries and any promoted placements are shown below, read-only.
          </div>
        </div>
        {stores.length ? (
          <div>
            <div style={x.label}>Your entries</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {stores.map((s) => (
                <div key={s.id} style={{ border: '1px solid #E8EDF2', borderRadius: 8, padding: '8px 10px', fontSize: 12 }}>
                  <b>{s.storeName || 'Untitled store'}</b>
                  {s.price > 0 ? ` · ৳${s.price}` : ''} · {s.availability}
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {adminPromoted.length ? (
          <div>
            <div style={x.label}>Promoted by Choosify</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {adminPromoted.map((s) => <PromotedStoreRow key={s.id} s={s} />)}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <div style={x.label}>Section type</div>
        <select
          value={type}
          onChange={(e) => onChange({ relatedInfoType: e.target.value as RelatedInfoType })}
          style={x.input}
        >
          {RELATED_TYPE_OPTIONS.map((t) => (
            <option key={t} value={t}>{RELATED_TYPE_LABEL[t]}</option>
          ))}
        </select>
        {suggestedType && suggestedType !== type ? (
          <div style={x.note}>
            Suggested for this listing: <b>{RELATED_TYPE_LABEL[suggestedType]}</b>.{' '}
            <button
              type="button"
              onClick={() => onChange({ relatedInfoType: suggestedType })}
              style={{ ...x.ghostBtn, padding: '2px 8px', fontSize: 10 }}
            >
              Use suggestion
            </button>
          </div>
        ) : null}
      </div>

      {type === 'price_across_stores' ? (
        <>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, fontWeight: 700 }}>
            <input
              type="checkbox"
              checked={priceAcrossStoresEnabled}
              onChange={(e) => onChange({ priceAcrossStoresEnabled: e.target.checked })}
            />
            Show the &ldquo;Where to Buy&rdquo; panel on the storefront
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 10, alignItems: 'start' }}>
            {stores.map((s, i) => (
              <div key={s.id} style={{ border: '1px solid #E8EDF2', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div>
                  <div style={x.label}>Store / platform name</div>
                  <input value={s.storeName} onChange={(e) => patchStore(s.id, { storeName: e.target.value })} placeholder="e.g. Daraz, Pickaboo, CartUp" style={{ ...x.input, fontWeight: 700 }} />
                </div>
                <div>
                  <div style={x.label}>Link (https)</div>
                  <input value={s.storeUrl} onChange={(e) => patchStore(s.id, { storeUrl: e.target.value })} placeholder="https://daraz.com.bd/products/…" style={x.input} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <div style={x.label}>Price (৳)</div>
                    <input type="number" min={0} value={s.price || ''} onChange={(e) => patchStore(s.id, { price: Number(e.target.value) || 0 })} style={x.input} />
                  </div>
                  <div>
                    <div style={x.label}>Availability</div>
                    <input value={s.availability} onChange={(e) => patchStore(s.id, { availability: e.target.value })} placeholder="In stock" style={x.input} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <div style={x.label}>Rating (0–5)</div>
                    <input type="number" min={0} max={5} step={0.1} value={s.storeRating || ''} onChange={(e) => patchStore(s.id, { storeRating: Number(e.target.value) || 0 })} style={x.input} />
                  </div>
                  <div>
                    <div style={x.label}>Logo image URL (optional)</div>
                    <input value={s.logoUrl} onChange={(e) => patchStore(s.id, { logoUrl: e.target.value })} placeholder="https://…/logo.png" style={x.input} />
                  </div>
                </div>
                <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11.5, fontWeight: 700 }}>
                  <input type="checkbox" checked={s.isFeatured} onChange={(e) => patchStore(s.id, { isFeatured: e.target.checked })} />
                  Feature this store (shows first among your entries)
                </label>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button type="button" onClick={() => moveStore(s.id, -1)} disabled={i === 0} style={x.ghostBtn}>↑</button>
                  <button type="button" onClick={() => moveStore(s.id, 1)} disabled={i === stores.length - 1} style={x.ghostBtn}>↓</button>
                  <button type="button" onClick={() => removeStore(s.id)} style={{ ...x.ghostBtn, color: '#DC2626', marginLeft: 'auto' }}>Remove</button>
                </div>
              </div>
            ))}
          </div>
          <div>
            <button type="button" onClick={addStore} style={x.accentBtn}>+ Add store</button>
          </div>

          {adminPromoted.length ? (
            <div>
              <div style={x.label}>Promoted by Choosify — read-only</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {adminPromoted.map((s) => <PromotedStoreRow key={s.id} s={s} />)}
              </div>
              <div style={x.note}>Choosify manages these sponsored placements. You can&rsquo;t edit, hide or reorder them.</div>
            </div>
          ) : null}
        </>
      ) : null}

      {type === 'whats_nearby' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
          {NEARBY_BUCKETS.map((b) => (
            <div key={b.key}>
              <div style={{ ...x.label, marginBottom: 6 }}>{b.label} — one per line</div>
              <textarea
                rows={3}
                value={(whatsNearby[b.key] || []).join('\n')}
                onChange={(e) => onChange({ whatsNearby: { ...whatsNearby, [b.key]: linesToArr(e.target.value) } })}
                style={{ width: '100%', boxSizing: 'border-box', borderRadius: 8, border: '1px solid #E8EDF2', padding: '8px 10px', fontSize: 12, resize: 'vertical', outline: 'none', fontFamily: 'inherit' }}
              />
            </div>
          ))}
        </div>
      ) : null}

      {type === 'before_your_visit' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
            {VISIT_FIELDS.map((f) => (
              <div key={f.key}>
                <div style={x.label}>{f.label}</div>
                <input
                  value={beforeYourVisit[f.key] || ''}
                  onChange={(e) => onChange({ beforeYourVisit: { ...beforeYourVisit, [f.key]: e.target.value } })}
                  placeholder={f.placeholder}
                  style={x.input}
                />
              </div>
            ))}
            {(beforeYourVisit.customFields || []).map((f, i) => (
              <div key={f.id} style={{ border: '1px solid #E8EDF2', borderRadius: 10, padding: 10 }}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                  <input
                    value={f.label}
                    onChange={(e) => {
                      const next = [...(beforeYourVisit.customFields || [])];
                      next[i] = { ...f, label: e.target.value };
                      onChange({ beforeYourVisit: { ...beforeYourVisit, customFields: next } });
                    }}
                    placeholder="Custom field label"
                    style={{ ...x.input, fontWeight: 700 }}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      onChange({
                        beforeYourVisit: {
                          ...beforeYourVisit,
                          customFields: (beforeYourVisit.customFields || []).filter((c) => c.id !== f.id),
                        },
                      })
                    }
                    style={{ ...x.ghostBtn, color: '#DC2626', flexShrink: 0 }}
                  >
                    Remove
                  </button>
                </div>
                <input
                  value={f.value}
                  onChange={(e) => {
                    const next = [...(beforeYourVisit.customFields || [])];
                    next[i] = { ...f, value: e.target.value };
                    onChange({ beforeYourVisit: { ...beforeYourVisit, customFields: next } });
                  }}
                  placeholder="Value"
                  style={x.input}
                />
              </div>
            ))}
          </div>
          <div>
            <button
              type="button"
              onClick={() =>
                onChange({
                  beforeYourVisit: {
                    ...beforeYourVisit,
                    customFields: [
                      ...(beforeYourVisit.customFields || []),
                      { id: `bvc-${Date.now()}`, label: '', value: '' },
                    ],
                  },
                })
              }
              style={x.ghostBtn}
            >
              + Add custom field
            </button>
          </div>
        </div>
      ) : null}

      {type === 'custom' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <div style={x.label}>Section title</div>
            <input
              value={customTitle}
              onChange={(e) => onChange({ customRelatedInfoTitle: e.target.value })}
              placeholder="e.g. Licensing & Compliance, Care & Handling…"
              style={{ ...x.input, fontWeight: 700 }}
            />
          </div>
          <div style={x.note}>
            Use this when the listing doesn&rsquo;t fit &ldquo;Where to Buy&rdquo;, &ldquo;What&rsquo;s Nearby&rdquo; or
            &ldquo;Before Your Visit&rdquo;. Each block becomes a column on the storefront.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10, alignItems: 'start' }}>
            {customBlocks.map((b, i) => (
              <div key={b.id} style={{ border: '1px solid #E8EDF2', borderRadius: 10, padding: 12 }}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 8, alignItems: 'center' }}>
                  <input
                    value={b.heading}
                    onChange={(e) => patchBlock(b.id, { heading: e.target.value })}
                    placeholder="Column heading"
                    style={{ ...x.input, fontWeight: 700, minWidth: 0 }}
                  />
                  <span style={{ display: 'inline-flex', gap: 4, flexShrink: 0 }}>
                    <button type="button" onClick={() => moveBlock(b.id, -1)} disabled={i === 0} style={x.ghostBtn}>↑</button>
                    <button type="button" onClick={() => moveBlock(b.id, 1)} disabled={i === customBlocks.length - 1} style={x.ghostBtn}>↓</button>
                  </span>
                  <button type="button" onClick={() => removeBlock(b.id)} style={{ ...x.ghostBtn, color: '#DC2626', flexShrink: 0 }}>Remove</button>
                </div>
                <textarea
                  rows={3}
                  value={b.items.join('\n')}
                  onChange={(e) => patchBlock(b.id, { items: linesToArr(e.target.value) })}
                  placeholder="One bullet per line"
                  style={{ width: '100%', boxSizing: 'border-box', borderRadius: 8, border: '1px solid #E8EDF2', padding: '8px 10px', fontSize: 12, resize: 'vertical', outline: 'none', fontFamily: 'inherit' }}
                />
              </div>
            ))}
          </div>
          <div>
            <button type="button" onClick={addBlock} style={x.accentBtn}>+ Add block</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Storefront-parity read view of the Related Information section. */
export function RelatedInfoView({
  type,
  mergedStores,
  whatsNearby,
  beforeYourVisit,
  customTitle,
  customBlocks,
}: {
  type: RelatedInfoType;
  mergedStores: Array<RelatedStoreEntry & { sponsored: boolean; promoLabel?: string }>;
  whatsNearby: EditorWhatsNearby;
  beforeYourVisit: EditorBeforeYourVisit;
  customTitle: string;
  customBlocks: EditorCustomRelatedBlock[];
}) {
  if (type === 'price_across_stores') {
    if (!mergedStores.length) {
      return <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0, fontStyle: 'italic' }}>No stores listed yet.</p>;
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {mergedStores.map((s) => (
          <div
            key={s.id}
            style={{
              border: `1px solid ${s.sponsored ? '#E8D9FF' : '#E8EDF2'}`,
              background: s.sponsored ? '#FAF5FF' : '#fff',
              borderRadius: 8,
              padding: '8px 10px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {s.logoUrl ? (
              <img src={s.logoUrl} alt="" style={{ width: 22, height: 22, objectFit: 'contain', borderRadius: 4 }} referrerPolicy="no-referrer" />
            ) : null}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: '#1A1A2E' }}>
                {s.storeName}
                {typeof s.price === 'number' && s.price > 0 ? <span style={{ fontWeight: 700, color: '#4B5563' }}>{` · ৳${s.price}`}</span> : null}
              </div>
              <div style={{ fontSize: 10.5, color: '#9AA0AC' }}>
                {s.availability || 'See store'}
                {s.isFeatured && !s.sponsored ? ' · Featured' : ''}
              </div>
            </div>
            {s.sponsored ? (
              <span style={{ fontSize: 9.5, fontWeight: 800, color: '#8A00C4', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {s.promoLabel || 'Promoted'}
              </span>
            ) : null}
          </div>
        ))}
      </div>
    );
  }
  if (type === 'whats_nearby') {
    const rows = NEARBY_BUCKETS.map((b) => ({ label: b.label, items: whatsNearby[b.key] || [] })).filter((r) => r.items.length);
    if (!rows.length) return <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0, fontStyle: 'italic' }}>Nothing listed yet.</p>;
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
        {rows.map((r) => (
          <div key={r.label}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#EF3C23', textTransform: 'uppercase' }}>{r.label}</div>
            <ul style={{ margin: '4px 0 0', paddingLeft: 16, fontSize: 12, color: '#4B5563' }}>
              {r.items.map((it) => <li key={it}>{it}</li>)}
            </ul>
          </div>
        ))}
      </div>
    );
  }
  if (type === 'before_your_visit') {
    const rows = [
      ...VISIT_FIELDS.map((f) => ({ label: f.label, value: beforeYourVisit[f.key] || '' })),
      ...(beforeYourVisit.customFields || []).map((f) => ({ label: f.label || 'Detail', value: f.value || '' })),
    ].filter((r) => r.value.trim());
    if (!rows.length) return <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0, fontStyle: 'italic' }}>Nothing listed yet.</p>;
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
        {rows.map((r) => (
          <div key={r.label}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#EF3C23', textTransform: 'uppercase' }}>{r.label}</div>
            <div style={{ fontSize: 12, color: '#4B5563', marginTop: 3 }}>{r.value}</div>
          </div>
        ))}
      </div>
    );
  }
  if (type === 'custom') {
    const blocks = (customBlocks || []).filter((b) => (b.heading || '').trim() || (b.items || []).some((i) => i.trim()));
    if (!customTitle.trim() && !blocks.length) {
      return <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0, fontStyle: 'italic' }}>Nothing added yet.</p>;
    }
    return (
      <div>
        {customTitle.trim() ? (
          <div style={{ fontSize: 13, fontWeight: 800, color: '#1A1A2E', marginBottom: 8 }}>{customTitle.trim()}</div>
        ) : null}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
          {blocks.map((b) => (
            <div key={b.id}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#EF3C23', textTransform: 'uppercase' }}>{b.heading || 'Details'}</div>
              <ul style={{ margin: '4px 0 0', paddingLeft: 16, fontSize: 12, color: '#4B5563' }}>
                {(b.items || []).filter((i) => i.trim()).map((it) => <li key={it}>{it}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0, fontStyle: 'italic' }}>No related-info panel for this listing.</p>;
}
