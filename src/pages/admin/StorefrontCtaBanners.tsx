import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Loader2,
  Pencil,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
  XCircle,
} from 'lucide-react';
import { catalogApi } from '../../services/catalogApi';
import { useAuth } from '../../contexts/AuthContext';
import { uploadSiteAssetImage } from '../../services/mediaUpload';
import { BrandImageUploadField } from './BrandImageUploadField';
import type { CtaAudienceRule, CtaBannerItem, CtaDestinationType, CtaPageKey, CtaPosition, SiteConfig } from '../../types/catalog';
import {
  CTA_AUDIENCE_RULE_OPTIONS,
  CTA_DESTINATION_TYPE_OPTIONS,
  CTA_INTERNAL_ROUTE_PRESETS,
  CTA_PAGE_OPTIONS,
  CTA_RESERVED_NOTES,
  getPageSections,
  getSectionPositions,
  newCtaBannerDraft,
  placementGroupKey,
  placementPreviewText,
  placementSummary,
  resolveCtaBanners,
} from '../../lib/ctaBanners';

/** Mirrors nav.ts's ADMIN_ONLY_PAGE_KEYS gating for `websiteCmsStudio` — display-only; the real boundary is `requireCmsWrite` on PUT /catalog/site. */
const ALLOWED_ROLES = new Set(['super_admin', 'admin', 'marketing_manager']);

/**
 * Storefront Curation -> CTA & Banners. Manages the editorial CTA/banner
 * strips found on customer-facing storefront pages. Deliberately separate
 * from Ads & Deals Studio, which manages PAID/sponsored placements
 * (CatalogPlacement) -- two different business models sharing only a visual
 * placement concept.
 *
 * Pipeline: CTA -> Placement (Page -> Section -> Position) -> Destination ->
 * Audience -> Enabled -> storefront rendering. Placement options are drawn
 * from CTA_PLACEMENT_REGISTRY (lib/ctaPlacementRegistry.ts) -- the same
 * registry the storefront's <CtaBannerSlot/> call sites are wired from, so a
 * placement selectable here is guaranteed to actually render somewhere.
 *
 * Persists through the existing SiteConfig / `PUT /catalog/site` endpoint
 * (server/catalogRouter.ts, gated by requireCmsWrite) -- no new endpoint, no
 * schema migration; `ctaBanners` is a new optional field on the same
 * JSON-snapshot-backed SiteConfig record every other site-wide setting
 * already lives on. Backend re-validates placement/destination/audience
 * independently (lib/vercel-catalog/catalogContract.ts) -- this form is
 * convenience, not the security boundary.
 */

const STYLE_OPTIONS: Array<{ value: NonNullable<CtaBannerItem['style']>; label: string }> = [
  { value: 'navy', label: 'Navy (dark surface)' },
  { value: 'orange', label: 'Orange (brand gradient)' },
  { value: 'light', label: 'Light (white card)' },
  // "purple" intentionally not offered: no existing banner surface treatment
  // in the current design system to reuse without inventing new CSS.
];

function draftEquals(a: CtaBannerItem, b: CtaBannerItem): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function destinationSummary(item: CtaBannerItem): string {
  if (item.destinationType === 'none') return 'No action';
  if (item.destinationType === 'creator_signup') return 'Creator Signup (canonical)';
  if (item.destinationType === 'seller_signup') return 'Seller Signup (canonical)';
  return item.destinationValue || '(not set)';
}

function destinationClickPreview(item: CtaBannerItem): string {
  if (item.destinationType === 'none') return 'No navigation — submits a local action.';
  if (item.destinationType === 'creator_signup') return 'Creator Signup → /signup?type=creator (resolves to the live partner-signup origin)';
  if (item.destinationType === 'seller_signup') return 'Seller Signup → /signup?type=seller (resolves to the live partner-signup origin)';
  if (item.destinationType === 'external') return `External Website → ${item.destinationValue || '(not set)'}`;
  const preset = CTA_INTERNAL_ROUTE_PRESETS.find((p) => p.value === item.destinationValue);
  return `${preset?.label ?? 'Internal Page'} → ${item.destinationValue || '(not set)'}`;
}

function audienceSummary(rule: CtaAudienceRule | undefined): string {
  return CTA_AUDIENCE_RULE_OPTIONS.find((o) => o.value === (rule ?? 'none'))?.label ?? 'Everyone';
}

type StatusFilter = 'all' | 'enabled' | 'disabled';

export default function StorefrontCtaBanners() {
  const { profile } = useAuth();
  const [site, setSite] = useState<SiteConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CtaBannerItem | null>(null);

  const [creatingPage, setCreatingPage] = useState<CtaPageKey>('home');
  const [isPickingPage, setIsPickingPage] = useState(false);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Auth Page Visual — the storefront login/signup/forgot/reset left-column
  // image (StorefrontAuthShell). Own local draft + save, independent of the
  // CTA list above, but persisted through the exact same SiteConfig record.
  const [authImage, setAuthImage] = useState('');
  const [authImageAlt, setAuthImageAlt] = useState('');
  const [authVisualSaving, setAuthVisualSaving] = useState(false);
  const [authVisualSavedFlash, setAuthVisualSavedFlash] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const config = await catalogApi.getSiteConfig();
      setSite(config);
      setAuthImage(config.authVisual?.storefrontImage ?? '');
      setAuthImageAlt(config.authVisual?.storefrontImageAlt ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load site config');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const authVisualDirty =
    site != null &&
    (authImage !== (site.authVisual?.storefrontImage ?? '') || authImageAlt !== (site.authVisual?.storefrontImageAlt ?? ''));

  const saveAuthVisual = async () => {
    if (!site) return;
    setAuthVisualSaving(true);
    setError(null);
    try {
      const saved = await catalogApi.updateSiteConfig({
        ...site,
        authVisual: { storefrontImage: authImage.trim(), storefrontImageAlt: authImageAlt.trim() },
      });
      setSite(saved);
      setAuthImage(saved.authVisual?.storefrontImage ?? '');
      setAuthImageAlt(saved.authVisual?.storefrontImageAlt ?? '');
      setAuthVisualSavedFlash(true);
      window.setTimeout(() => setAuthVisualSavedFlash(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setAuthVisualSaving(false);
    }
  };

  const banners = useMemo(() => resolveCtaBanners(site?.ctaBanners), [site]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return banners.filter((item) => {
      if (statusFilter === 'enabled' && !item.enabled) return false;
      if (statusFilter === 'disabled' && item.enabled) return false;
      if (!q) return true;
      return (
        item.id.toLowerCase().includes(q) ||
        item.title.toLowerCase().includes(q) ||
        item.page.toLowerCase().includes(q) ||
        item.section.toLowerCase().includes(q)
      );
    });
  }, [banners, search, statusFilter]).sort((a, b) => {
    const groupCompare = placementGroupKey(a).localeCompare(placementGroupKey(b));
    return groupCompare !== 0 ? groupCompare : a.order - b.order;
  });

  const isDirty = (item: CtaBannerItem) => draft != null && editingId === item.id && !draftEquals(draft, item);

  const guardSwitch = (): boolean => {
    if (editingId) {
      const current = banners.find((b) => b.id === editingId);
      const isNewUnsaved = !current && draft;
      if ((current && isDirty(current)) || isNewUnsaved) {
        return window.confirm('Discard unsaved changes to the other CTA?');
      }
    }
    return true;
  };

  const startEdit = (item: CtaBannerItem) => {
    if (editingId && editingId !== item.id && !guardSwitch()) return;
    setIsPickingPage(false);
    setEditingId(item.id);
    setDraft({ ...item });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(null);
  };

  const startCreate = () => {
    if (!guardSwitch()) return;
    setIsPickingPage(true);
  };

  const confirmCreate = () => {
    const fresh = newCtaBannerDraft(creatingPage);
    setIsPickingPage(false);
    setEditingId(fresh.id);
    setDraft(fresh);
  };

  const persist = async (nextBanners: CtaBannerItem[]) => {
    if (!site) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await catalogApi.updateSiteConfig({ ...site, ctaBanners: nextBanners });
      setSite(saved);
      setSavedFlash('Saved');
      window.setTimeout(() => setSavedFlash(null), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const saveDraft = async () => {
    if (!draft) return;
    if (!draft.title.trim() || !draft.buttonLabel.trim()) {
      setError('Title and Button Label are required.');
      return;
    }
    if (draft.destinationType === 'internal' && !draft.destinationValue.trim()) {
      setError('Please select a destination.');
      return;
    }
    if (draft.destinationType === 'external' && !/^https:\/\//i.test(draft.destinationValue.trim())) {
      setError('External URLs must use HTTPS.');
      return;
    }
    const isNewRecord = editingId != null && !banners.some((b) => b.id === editingId);
    const collision = banners.some((b) => b.id === draft.id && b.id !== editingId);
    if (collision) {
      setError('This internal name is already in use.');
      return;
    }
    // A brand-new record always defaults to order 0 (see newCtaBannerDraft) --
    // recompute it here against whatever placement group it's actually being
    // saved into (which may have changed since the draft was created), so it
    // appends after existing siblings instead of tying with them at 0.
    const finalDraft = isNewRecord
      ? {
          ...draft,
          order:
            1 +
            Math.max(
              -1,
              ...banners.filter((b) => placementGroupKey(b) === placementGroupKey(draft)).map((b) => b.order),
            ),
        }
      : draft;
    const next = isNewRecord ? [...banners, finalDraft] : banners.map((b) => (b.id === finalDraft.id ? finalDraft : b));
    await persist(next);
    setEditingId(null);
    setDraft(null);
  };

  const deleteCta = async (item: CtaBannerItem) => {
    const ok = window.confirm(`Delete this CTA?\n\n"${item.title || item.id}"\n\nThis will remove the CTA from its storefront placement.`);
    if (!ok) return;
    const next = banners.filter((b) => b.id !== item.id);
    await persist(next);
    if (editingId === item.id) cancelEdit();
  };

  const toggleEnabled = async (item: CtaBannerItem) => {
    const next = banners.map((b) => (b.id === item.id ? { ...b, enabled: !b.enabled } : b));
    await persist(next);
  };

  /** Ordering is scoped to items sharing the exact same (page, section, position) — never a global order. */
  const move = async (item: CtaBannerItem, direction: -1 | 1) => {
    const group = banners
      .filter((b) => placementGroupKey(b) === placementGroupKey(item))
      .sort((a, b) => a.order - b.order);
    const idx = group.findIndex((b) => b.id === item.id);
    const swapIdx = idx + direction;
    if (idx < 0 || swapIdx < 0 || swapIdx >= group.length) return;
    const a = group[idx];
    const b = group[swapIdx];
    const next = banners.map((row) => {
      if (row.id === a.id) return { ...row, order: b.order };
      if (row.id === b.id) return { ...row, order: a.order };
      return row;
    });
    await persist(next);
  };

  if (profile && !ALLOWED_ROLES.has(profile.role)) {
    return (
      <div className="flex items-center gap-2 p-8 text-[13px] font-semibold text-red-600">
        <ShieldAlert className="h-4 w-4" /> You don't have access to Storefront Curation.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-8 text-[13px] text-[#6B7280]">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading CTA & Banners…
      </div>
    );
  }

  const isCreatingNew = editingId != null && !banners.some((b) => b.id === editingId);

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-5 md:px-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[15px] font-extrabold text-[#111827]">CTA & Banners</div>
          <div className="text-[11px] font-semibold text-[#6B7280]">
            Editorial CTA strips shown across the storefront · Storefront Curation
          </div>
        </div>
        <div className="flex items-center gap-3">
          {savedFlash && (
            <div className="flex items-center gap-1.5 text-[12px] font-bold text-emerald-600">
              <CheckCircle2 className="h-4 w-4" /> {savedFlash}
            </div>
          )}
          <button
            type="button"
            onClick={startCreate}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#EF3C23] px-3.5 py-2 text-[12px] font-bold text-white disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" /> Create CTA / Banner
          </button>
        </div>
      </div>

      <div className="mb-4 rounded-xl border border-[#E8EDF2] bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-[13px] font-bold text-[#1A1A2E]">Auth Page Visual</div>
            <div className="text-[11px] text-[#9AA0AC]">
              Optional image shown in the left column of the storefront Login/Signup/Forgot/Reset pages. Leave empty to use the approved no-image layout.
            </div>
          </div>
          {authVisualSavedFlash && (
            <div className="flex items-center gap-1.5 text-[12px] font-bold text-emerald-600">
              <CheckCircle2 className="h-4 w-4" /> Saved
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[220px_1fr]">
          <BrandImageUploadField value={authImage} onChange={setAuthImage} label="Image" variant="banner" uploadFn={uploadSiteAssetImage} />
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase text-[#9AA0AC]">Alt text</label>
            <input
              className="w-full rounded-lg border border-[#E8EDF2] px-3 py-2 text-[12.5px]"
              value={authImageAlt}
              onChange={(e) => setAuthImageAlt(e.target.value)}
              placeholder="Describe the image for screen readers"
            />
            <button
              type="button"
              onClick={saveAuthVisual}
              disabled={authVisualSaving || !authVisualDirty}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#EF3C23] px-4 py-2 text-[12px] font-bold text-white disabled:opacity-50"
            >
              {authVisualSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Save Auth Visual
            </button>
          </div>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#9AA0AC]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by internal name, title, page, or section…"
            className="w-full rounded-lg border border-[#E8EDF2] py-2 pl-8 pr-3 text-[12.5px]"
          />
        </div>
        {(['all', 'enabled', 'disabled'] as StatusFilter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setStatusFilter(f)}
            className={`rounded-full px-3 py-1.5 text-[10.5px] font-extrabold uppercase tracking-wide ${
              statusFilter === f ? 'bg-[#EF3C23] text-white' : 'bg-[#F3F4F6] text-[#374151]'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[12px] font-semibold text-red-700">
          {error}
        </div>
      )}

      {isPickingPage && (
        <div className="mb-4 rounded-xl border border-[#E8EDF2] bg-[#F8FAFC] p-4">
          <div className="mb-2 text-[12px] font-bold text-[#1A1A2E]">Which page should this CTA appear on?</div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="rounded-lg border border-[#E8EDF2] px-3 py-2 text-[12.5px]"
              value={creatingPage}
              onChange={(e) => setCreatingPage(e.target.value as CtaPageKey)}
            >
              {CTA_PAGE_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label} ({p.route})
                </option>
              ))}
            </select>
            <button type="button" onClick={confirmCreate} className="rounded-lg bg-[#EF3C23] px-4 py-2 text-[12px] font-bold text-white">
              Continue
            </button>
            <button
              type="button"
              onClick={() => setIsPickingPage(false)}
              className="rounded-lg border border-[#E8EDF2] px-4 py-2 text-[12px] font-bold text-[#374151]"
            >
              Cancel
            </button>
          </div>
          <div className="mt-2 text-[11px] text-[#9AA0AC]">
            You'll choose the exact section and position next. This CTA renders immediately after you save.
          </div>
        </div>
      )}

      {isCreatingNew && draft && (
        <div className="mb-4 rounded-xl border-2 border-[#111827] bg-white p-4">
          <div className="mb-3 text-[11px] font-black uppercase tracking-wide text-[#9AA0AC]">New CTA / Banner</div>
          <CtaEditForm draft={draft} setDraft={setDraft} reserved={undefined} onSave={saveDraft} onCancel={cancelEdit} saving={saving} isCreate />
        </div>
      )}

      <div className="space-y-4">
        {filtered.length === 0 && (
          <div className="rounded-xl border border-dashed border-[#E8EDF2] p-8 text-center text-[12px] text-[#9AA0AC]">
            No CTAs match your search/filter.
          </div>
        )}
        {filtered.map((item) => {
          const reserved = CTA_RESERVED_NOTES[item.id];
          const editing = editingId === item.id && draft && !isCreatingNew;
          const group = banners.filter((b) => placementGroupKey(b) === placementGroupKey(item)).sort((a, b) => a.order - b.order);
          const idx = group.findIndex((b) => b.id === item.id);

          return (
            <div key={item.id} data-testid={`cta-row-${item.id}`} className="rounded-xl border border-[#E8EDF2] bg-white p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-wide text-[#9AA0AC]">{item.id}</div>
                  <div className="text-[13px] font-bold text-[#1A1A2E]">{item.title || '(untitled)'}</div>
                  {reserved?.note && <div className="mt-1 text-[11px] text-[#9AA0AC]">{reserved.note}</div>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    title="Move up (within this placement)"
                    disabled={idx === 0 || saving}
                    onClick={() => move(item, -1)}
                    className="rounded-md border border-[#E8EDF2] p-1.5 text-[#6B7280] disabled:opacity-30"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    title="Move down (within this placement)"
                    disabled={idx === group.length - 1 || saving}
                    onClick={() => move(item, 1)}
                    className="rounded-md border border-[#E8EDF2] p-1.5 text-[#6B7280] disabled:opacity-30"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <label className="flex items-center gap-1.5 text-[11px] font-bold text-[#374151]">
                    <input type="checkbox" checked={item.enabled} disabled={saving} onChange={() => toggleEnabled(item)} />
                    Enabled
                  </label>
                  {!editing && (
                    <button
                      type="button"
                      onClick={() => startEdit(item)}
                      className="inline-flex items-center gap-1 rounded-md bg-[#EF3C23] px-3 py-1.5 text-[11px] font-bold text-white"
                    >
                      <Pencil className="h-3 w-3" /> Edit
                    </button>
                  )}
                  {!reserved && !editing && (
                    <button
                      type="button"
                      title="Delete"
                      disabled={saving}
                      onClick={() => deleteCta(item)}
                      className="rounded-md border border-red-200 p-1.5 text-red-600 disabled:opacity-30"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {!editing ? (
                <div className="grid grid-cols-1 gap-3 text-[12px] sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <div className="text-[10px] font-bold uppercase text-[#9AA0AC]">Placement</div>
                    <div className="text-[#1A1A2E]">{placementSummary(item)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase text-[#9AA0AC]">Destination</div>
                    <div className="text-[#1A1A2E]">{destinationSummary(item)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase text-[#9AA0AC]">Audience</div>
                    <div className="text-[#1A1A2E]">{audienceSummary(item.audienceRule)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase text-[#9AA0AC]">Status</div>
                    <div className={item.enabled ? 'font-bold text-emerald-600' : 'font-bold text-[#9AA0AC]'}>
                      {item.enabled ? 'Enabled' : 'Disabled'}
                    </div>
                  </div>
                </div>
              ) : (
                <CtaEditForm draft={draft!} setDraft={setDraft} reserved={reserved} onSave={saveDraft} onCancel={cancelEdit} saving={saving} isCreate={false} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CtaEditForm({
  draft,
  setDraft,
  reserved,
  onSave,
  onCancel,
  saving,
  isCreate,
}: {
  draft: CtaBannerItem;
  setDraft: (d: CtaBannerItem) => void;
  reserved: { note?: string; lockPlacement?: boolean; lockDestination?: boolean } | undefined;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  isCreate: boolean;
}) {
  const inputClass = 'w-full rounded-lg border border-[#E8EDF2] px-3 py-2 text-[12.5px]';
  const labelClass = 'mb-1 block text-[10px] font-bold uppercase text-[#9AA0AC]';
  const groupHeading = 'mb-2 text-[10.5px] font-black uppercase tracking-wide text-[#9AA0AC] border-b border-[#F3F4F6] pb-1';

  const sections = getPageSections(draft.page);
  const positions = getSectionPositions(draft.page, draft.section);

  const setPage = (page: CtaPageKey) => {
    const firstSection = getPageSections(page)[0];
    setDraft({
      ...draft,
      page,
      section: firstSection?.section ?? '',
      position: firstSection?.positions[0] ?? 'after',
    });
  };

  const setSection = (section: string) => {
    const firstPosition = getSectionPositions(draft.page, section)[0] ?? 'after';
    setDraft({ ...draft, section, position: firstPosition });
  };

  const setDestinationType = (destinationType: CtaDestinationType) => {
    setDraft({
      ...draft,
      destinationType,
      destinationValue: destinationType === 'internal' || destinationType === 'external' ? draft.destinationValue : '',
      openInNewTab: destinationType === 'none' ? false : draft.openInNewTab,
    });
  };

  return (
    <div className="space-y-5">
      <div>
        <div className={groupHeading}>Basic Information</div>
        <div className="space-y-3">
          <div>
            <label className={labelClass}>Internal Name</label>
            {isCreate ? (
              <input
                className={inputClass}
                value={draft.id}
                onChange={(e) => setDraft({ ...draft, id: e.target.value.trim() })}
                placeholder="e.g. deals.summer_promo_cta"
              />
            ) : (
              <div className="rounded-lg bg-[#F8FAFC] px-3 py-2 text-[12.5px] text-[#6B7280]">{draft.id} — fixed after creation</div>
            )}
          </div>
          <div>
            <label className={labelClass}>Title</label>
            <input className={inputClass} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          </div>
          <div>
            <label className={labelClass}>Subtitle</label>
            <input className={inputClass} value={draft.subtitle} onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Button Label</label>
              <input className={inputClass} value={draft.buttonLabel} onChange={(e) => setDraft({ ...draft, buttonLabel: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>Style</label>
              <select className={inputClass} value={draft.style ?? 'navy'} onChange={(e) => setDraft({ ...draft, style: e.target.value as CtaBannerItem['style'] })}>
                {STYLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className={groupHeading}>Storefront Placement</div>
        {reserved?.lockPlacement ? (
          <div className="rounded-lg bg-[#F8FAFC] px-3 py-2 text-[12.5px] text-[#6B7280]">
            {placementSummary(draft)} — fixed for this placement
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className={labelClass}>Page</label>
                <select className={inputClass} value={draft.page} onChange={(e) => setPage(e.target.value as CtaPageKey)}>
                  {CTA_PAGE_OPTIONS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Section</label>
                <select className={inputClass} value={draft.section} onChange={(e) => setSection(e.target.value)}>
                  {sections.map((s) => (
                    <option key={s.section} value={s.section}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Position</label>
                <select
                  className={inputClass}
                  value={draft.position}
                  onChange={(e) => setDraft({ ...draft, position: e.target.value as CtaPosition })}
                >
                  {positions.map((p) => (
                    <option key={p} value={p}>
                      {p === 'before' ? 'Before' : 'After'}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="rounded-lg bg-[#F8FAFC] px-3 py-2 text-[11px] text-[#374151]">
              <span className="font-bold">Placement Preview: </span>
              {placementPreviewText(draft)}
            </div>
          </div>
        )}
      </div>

      <div>
        <div className={groupHeading}>Click Destination</div>
        {reserved?.lockDestination ? (
          <div className="rounded-lg bg-[#F8FAFC] px-3 py-2 text-[11px] text-[#6B7280]">
            Destination is fixed to "No action" for this placement — it submits a local form rather than navigating.
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {CTA_DESTINATION_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setDestinationType(opt.value)}
                  className={`rounded-full px-3 py-1 text-[10px] font-extrabold ${
                    draft.destinationType === opt.value ? 'bg-[#EF3C23] text-white' : 'bg-[#F3F4F6] text-[#374151]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {draft.destinationType === 'internal' && (
              <select className={inputClass} value={draft.destinationValue} onChange={(e) => setDraft({ ...draft, destinationValue: e.target.value })}>
                <option value="">Select a route…</option>
                {CTA_INTERNAL_ROUTE_PRESETS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label} ({p.value})
                  </option>
                ))}
              </select>
            )}

            {draft.destinationType === 'external' && (
              <input
                className={inputClass}
                placeholder="https://example.com"
                value={draft.destinationValue}
                onChange={(e) => setDraft({ ...draft, destinationValue: e.target.value })}
              />
            )}

            {draft.destinationType !== 'none' && (
              <label className="flex items-center gap-1.5 text-[11px] font-bold text-[#374151]">
                <input type="checkbox" checked={draft.openInNewTab} onChange={(e) => setDraft({ ...draft, openInNewTab: e.target.checked })} />
                Open in new tab
              </label>
            )}

            <div className="rounded-lg bg-[#F8FAFC] px-3 py-2 text-[11px] text-[#374151]">
              <span className="font-bold">Click Action: </span>
              {destinationClickPreview(draft)}
            </div>
          </div>
        )}
      </div>

      <div>
        <div className={groupHeading}>Audience</div>
        <select
          className={inputClass}
          value={draft.audienceRule ?? 'none'}
          onChange={(e) => setDraft({ ...draft, audienceRule: e.target.value as CtaAudienceRule })}
        >
          {CTA_AUDIENCE_RULE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <div className={groupHeading}>Status</div>
        <label className="flex items-center gap-1.5 text-[12px] font-bold text-[#374151]">
          <input type="checkbox" checked={draft.enabled} onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} />
          Enabled
        </label>
      </div>

      <div className="flex items-center gap-2 border-t border-[#F3F4F6] pt-3">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#EF3C23] px-4 py-2 text-[12px] font-bold text-white disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} {isCreate ? 'Create CTA' : 'Save Changes'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#E8EDF2] px-4 py-2 text-[12px] font-bold text-[#374151]"
        >
          <XCircle className="h-3.5 w-3.5" /> Cancel
        </button>
      </div>
    </div>
  );
}
