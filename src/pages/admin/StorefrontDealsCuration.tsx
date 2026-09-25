import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, CheckCircle2, EyeOff, Loader2, Pencil, Plus, Search, ShieldAlert, Trash2 } from 'lucide-react';
import { catalogApi } from '../../services/catalogApi';
import { operationsApi } from '../../services/operationsApi';
import { useAuth } from '../../contexts/AuthContext';
import type { CatalogBrand, CatalogCategory, SiteConfig } from '../../types/catalog';
import {
  BRAND_NO_ACTIVE_DEAL,
  COUPON_REASON_LABEL,
  CURATION_EDITOR_ROLE,
  CURATION_PLACEMENTS,
  couponDetail,
  couponHeadline,
  couponIneligibleReason,
  type CurationCoupon,
  type CurationItem,
  type CurationPlacementConfig,
  type CurationPlacementKey,
} from '../../../shared/storefront/storefrontCuration';
import { lastUpdatedLabel } from '../../lib/curationMeta';

/** Super Admin only — mirrors the server's requireCurationEditor on every curation write. */
const canEditCuration = (role: string | undefined) => role === CURATION_EDITOR_ROLE;

const SECTIONS: Array<{ key: CurationPlacementKey; empty: string; help: string; addLabel: string }> = [
  {
    key: 'deals.top_coupons',
    empty: 'No Top Coupons selected',
    help: 'Curated subset shown in the Deals page "Top Coupons" card. Only coupons that are active, in date and under their usage limit can be added; a pinned coupon that later expires is hidden automatically. "View All Coupons" still lists every eligible coupon.',
    addLabel: 'Select coupons',
  },
  {
    key: 'deals.popular_categories',
    empty: 'No Popular Deal Categories selected',
    help: 'Real product categories shown in "Popular Deal Categories". No automatic popularity ranking is applied — when nothing is selected the module is hidden.',
    addLabel: 'Select categories',
  },
  {
    key: 'deals.brand_deals',
    empty: 'No Brand Deals selected',
    help: 'Real brands with an active Deal (a live deal product, not expired, with a discount). Only those brands can be added; a pinned brand whose deals end is hidden automatically. "Up to X% off" is the brand\'s highest active deal discount.',
    addLabel: 'Select brands',
  },
];

type Candidate = { id: string; label: string; sub: string; problem: string | null };

const emptyConfig = (): CurationPlacementConfig => ({ enabled: true, items: [] });
const sameConfig = (a: CurationPlacementConfig, b: CurationPlacementConfig) => JSON.stringify(a) === JSON.stringify(b);

export default function StorefrontDealsCuration() {
  const { profile } = useAuth();
  const [site, setSite] = useState<SiteConfig | null>(null);
  const [coupons, setCoupons] = useState<CurationCoupon[]>([]);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [brands, setBrands] = useState<CatalogBrand[]>([]);
  /** brandId → "Up to X%" for brands with an active Deal; null = unknown (the server still enforces the rule). */
  const [brandLiveDeals, setBrandLiveDeals] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState<string | null>(null);
  const [editing, setEditing] = useState<CurationPlacementKey | null>(null);
  const [draft, setDraft] = useState<CurationPlacementConfig | null>(null);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      catalogApi.getSiteConfig(),
      operationsApi.listCoupons(),
      catalogApi.listCategories(),
      catalogApi.listBrands(),
      catalogApi.getBrandDealEligibility().catch(() => null),
    ])
      .then(([s, c, cats, b, live]) => {
        if (cancelled) return;
        setSite(s);
        setCoupons(c as unknown as CurationCoupon[]);
        setCategories(cats);
        setBrands(b);
        setBrandLiveDeals(live);
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const stored = (key: CurationPlacementKey): CurationPlacementConfig => site?.storefrontCuration?.[key] ?? emptyConfig();
  const dirty = editing != null && draft != null && !sameConfig(draft, stored(editing));

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  /** Label + current storefront eligibility for any entity of a placement. */
  const describe = (key: CurationPlacementKey, id: string, now = Date.now()): Candidate => {
    const type = CURATION_PLACEMENTS[key].entityType;
    if (type === 'coupon') {
      const c = coupons.find((x) => x.id === id);
      if (!c) return { id, label: 'Coupon no longer exists', sub: '', problem: 'Deleted' };
      const reason = couponIneligibleReason(c, now);
      return {
        id,
        label: c.code,
        sub: `${couponHeadline(c)} · ${couponDetail(c)} · until ${c.validUntil.slice(0, 10)}`,
        problem: reason ? COUPON_REASON_LABEL[reason] : null,
      };
    }
    if (type === 'category') {
      const c = catById.get(id);
      if (!c) return { id, label: 'Category no longer exists', sub: '', problem: 'Deleted' };
      const parent = c.parentId ? catById.get(c.parentId)?.name : null;
      return { id, label: c.name, sub: parent ? `in ${parent}` : 'Top-level category', problem: c.enabled ? null : 'Disabled' };
    }
    const b = brands.find((x) => x.id === id);
    if (!b) return { id, label: 'Brand no longer exists', sub: '', problem: 'Deleted' };
    const upTo = brandLiveDeals?.[id];
    return {
      id,
      label: b.name,
      sub: [b.category, b.verifiedStatus ? 'Verified' : null, upTo ? `Up to ${upTo}% off` : null].filter(Boolean).join(' · '),
      problem:
        b.marketplaceAccess === false
          ? 'Hidden from storefront'
          : brandLiveDeals && upTo == null
            ? BRAND_NO_ACTIVE_DEAL
            : null,
    };
  };

  const candidates = (key: CurationPlacementKey): Candidate[] => {
    const q = search.trim().toLowerCase();
    const taken = new Set(draft?.items.map((i) => i.entityId));
    const type = CURATION_PLACEMENTS[key].entityType;
    const ids =
      type === 'coupon' ? coupons.map((c) => c.id) : type === 'category' ? categories.map((c) => c.id) : brands.map((b) => b.id);
    return ids
      .filter((id) => !taken.has(id))
      .map((id) => describe(key, id))
      .filter((c) => !q || `${c.label} ${c.sub}`.toLowerCase().includes(q))
      .sort((a, b) => Number(!!a.problem) - Number(!!b.problem) || a.label.localeCompare(b.label))
      .slice(0, 25);
  };

  const startEdit = (key: CurationPlacementKey) => {
    if (dirty && editing !== key && !window.confirm('Discard unsaved changes to the other section?')) return;
    setEditing(key);
    setDraft(JSON.parse(JSON.stringify(stored(key))));
    setSearch('');
    setError(null);
  };
  const cancelEdit = () => {
    if (dirty && !window.confirm('Discard unsaved changes?')) return;
    setEditing(null);
    setDraft(null);
  };
  const updateItems = (fn: (items: CurationItem[]) => CurationItem[]) => draft && setDraft({ ...draft, items: fn(draft.items) });
  const move = (idx: number, dir: -1 | 1) =>
    updateItems((items) => {
      const next = [...items];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return items;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });

  const save = async () => {
    if (!editing || !draft) return;
    setSaving(true);
    setError(null);
    try {
      const { data, dropped } = await catalogApi.updateCurationPlacement(editing, draft);
      setSite((prev) => (prev ? { ...prev, storefrontCuration: { ...(prev.storefrontCuration ?? {}), [editing]: data } } : prev));
      setEditing(null);
      setDraft(null);
      setSavedFlash(dropped.length ? `Saved · ${dropped.length} deleted item(s) removed` : 'Saved');
      window.setTimeout(() => setSavedFlash(null), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (profile && !canEditCuration(profile.role)) {
    return (
      <div className="flex items-center gap-2 p-8 text-[13px] font-semibold text-red-600">
        <ShieldAlert className="h-4 w-4" /> You don't have access to Storefront Curation.
      </div>
    );
  }
  if (loading) {
    return (
      <div className="flex items-center gap-2 p-8 text-[13px] text-[#6B7280]">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading Deals Curation…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-5 md:px-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[15px] font-extrabold text-[#111827]">Deals Curation</div>
          <div className="text-[11px] font-semibold text-[#6B7280]">
            Top Coupons, Popular Deal Categories and Brand Deals on the storefront Deals page · Storefront Curation
          </div>
        </div>
        {savedFlash && (
          <div className="flex items-center gap-1.5 text-[12px] font-bold text-emerald-600">
            <CheckCircle2 className="h-4 w-4" /> {savedFlash}
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[12px] font-semibold text-red-700">{error}</div>
      )}

      <div className="space-y-4">
        {SECTIONS.map((section) => {
          const cfg = stored(section.key);
          const isEditing = editing === section.key && draft != null;
          const view = isEditing ? draft! : cfg;
          const placement = CURATION_PLACEMENTS[section.key];
          const liveCount = cfg.enabled ? cfg.items.filter((i) => i.enabled && !describe(section.key, i.entityId).problem).length : 0;
          return (
            <section
              key={section.key}
              className={`rounded-xl border bg-white p-4 ${isEditing ? 'border-[#EF3C23]/50 shadow-sm' : 'border-[#E8EDF2]'}`}
            >
              <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[13px] font-bold text-[#1A1A2E]">
                    {placement.label}
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                        view.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {view.enabled ? 'Placement on' : 'Placement off'}
                    </span>
                    {!isEditing && (
                      <span className="text-[11px] font-semibold text-[#6B7280]">{liveCount} showing on storefront</span>
                    )}
                  </div>
                  <div className="mt-0.5 max-w-[760px] text-[11px] text-[#9AA0AC]">{section.help}</div>
                  {lastUpdatedLabel(cfg.updatedAt, cfg.updatedBy) && (
                    <div className="mt-1 text-[10.5px] font-semibold text-[#6B7280]" data-testid="curation-last-updated">
                      {lastUpdatedLabel(cfg.updatedAt, cfg.updatedBy)}
                    </div>
                  )}
                </div>
                {!isEditing && (
                  <button
                    type="button"
                    onClick={() => startEdit(section.key)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#E8EDF2] px-3 py-1.5 text-[12px] font-bold text-[#374151] hover:bg-slate-50"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                )}
              </div>

              {isEditing && (
                <label className="mb-3 inline-flex items-center gap-2 text-[12px] font-semibold text-[#374151]">
                  <input type="checkbox" checked={draft!.enabled} onChange={(e) => setDraft({ ...draft!, enabled: e.target.checked })} />
                  Show this module on the Deals page
                </label>
              )}

              {view.items.length === 0 ? (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-[#E5E7EB] bg-[#FAFBFC] px-4 py-5">
                  <div className="text-[12px] font-semibold text-[#6B7280]">{section.empty} — the module is hidden on the storefront.</div>
                  {!isEditing && (
                    <button
                      type="button"
                      onClick={() => startEdit(section.key)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#EF3C23] px-3 py-1.5 text-[12px] font-bold text-white"
                    >
                      <Plus className="h-3.5 w-3.5" /> {section.addLabel}
                    </button>
                  )}
                </div>
              ) : (
                <ol className="divide-y divide-[#F1F3F6] rounded-lg border border-[#E8EDF2]">
                  {view.items.map((item, idx) => {
                    const d = describe(section.key, item.entityId);
                    const hidden = !!d.problem || !item.enabled;
                    return (
                      <li key={item.entityId} className="flex items-center gap-3 px-3 py-2">
                        <span className="w-5 text-right text-[11px] font-bold text-[#9AA0AC]">{idx + 1}</span>
                        <div className="min-w-0 flex-1">
                          <div className={`text-[12.5px] font-bold ${hidden ? 'text-[#9AA0AC]' : 'text-[#1A1A2E]'}`}>
                            {d.label}
                          </div>
                          <div className="text-[11px] text-[#9AA0AC]">{d.sub}</div>
                        </div>
                        {d.problem ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                            <EyeOff className="h-3 w-3" /> Hidden · {d.problem}
                          </span>
                        ) : !item.enabled ? (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">Disabled</span>
                        ) : (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Showing</span>
                        )}
                        {isEditing && (
                          <div className="flex items-center gap-1">
                            <label className="mr-1 inline-flex items-center gap-1 text-[11px] font-semibold text-[#374151]">
                              <input
                                type="checkbox"
                                checked={item.enabled}
                                onChange={(e) =>
                                  updateItems((items) => items.map((it, i) => (i === idx ? { ...it, enabled: e.target.checked } : it)))
                                }
                              />
                              On
                            </label>
                            <button type="button" aria-label="Move up" onClick={() => move(idx, -1)} disabled={idx === 0} className="rounded p-1 hover:bg-slate-100 disabled:opacity-30">
                              <ArrowUp className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              aria-label="Move down"
                              onClick={() => move(idx, 1)}
                              disabled={idx === view.items.length - 1}
                              className="rounded p-1 hover:bg-slate-100 disabled:opacity-30"
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              aria-label="Remove"
                              onClick={() => updateItems((items) => items.filter((_, i) => i !== idx))}
                              className="rounded p-1 text-red-500 hover:bg-red-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}

              {isEditing && (
                <div className="mt-3 rounded-lg border border-[#E8EDF2] bg-[#F8FAFC] p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-[12px] font-bold text-[#1A1A2E]">
                      Add {placement.entityType === 'coupon' ? 'coupons' : placement.entityType === 'category' ? 'categories' : 'brands'}
                      <span className="ml-2 text-[11px] font-semibold text-[#9AA0AC]">
                        {draft!.items.length}/{placement.max} selected
                      </span>
                    </div>
                    <div className="relative min-w-[240px]">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#9AA0AC]" />
                      <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by name or code…"
                        className="w-full rounded-lg border border-[#E8EDF2] bg-white py-1.5 pl-8 pr-3 text-[12px]"
                      />
                    </div>
                  </div>
                  <ul className="max-h-[260px] divide-y divide-[#F1F3F6] overflow-y-auto rounded-lg border border-[#E8EDF2] bg-white">
                    {candidates(section.key).map((c) => {
                      const full = draft!.items.length >= placement.max;
                      return (
                        <li key={c.id} className="flex items-center gap-3 px-3 py-1.5">
                          <div className="min-w-0 flex-1">
                            <div className={`text-[12px] font-semibold ${c.problem ? 'text-[#9AA0AC]' : 'text-[#1A1A2E]'}`}>{c.label}</div>
                            <div className="text-[10.5px] text-[#9AA0AC]">{c.sub}</div>
                          </div>
                          {c.problem ? (
                            <span className="text-[10.5px] font-bold text-amber-700">Not eligible · {c.problem}</span>
                          ) : (
                            <button
                              type="button"
                              disabled={full}
                              onClick={() => updateItems((items) => [...items, { entityId: c.id, enabled: true }])}
                              className="inline-flex items-center gap-1 rounded-md border border-[#E8EDF2] px-2 py-1 text-[11px] font-bold text-[#374151] hover:bg-slate-50 disabled:opacity-40"
                            >
                              <Plus className="h-3 w-3" /> Add
                            </button>
                          )}
                        </li>
                      );
                    })}
                    {candidates(section.key).length === 0 && (
                      <li className="px-3 py-3 text-[11.5px] text-[#9AA0AC]">No matches.</li>
                    )}
                  </ul>
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={save}
                      disabled={saving || !dirty}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#EF3C23] px-4 py-2 text-[12px] font-bold text-white disabled:opacity-50"
                    >
                      {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Save
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      disabled={saving}
                      className="rounded-lg border border-[#E8EDF2] px-4 py-2 text-[12px] font-bold text-[#374151]"
                    >
                      Cancel
                    </button>
                    {dirty && <span className="text-[11px] font-semibold text-amber-700">Unsaved changes</span>}
                  </div>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
