import React, { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, CheckCircle2, Info, Loader2, Pencil, Plus, ShieldAlert, Trash2 } from 'lucide-react';
import { catalogApi } from '../../services/catalogApi';
import { useAuth } from '../../contexts/AuthContext';
import type { SiteConfig } from '../../types/catalog';
import { ASSURANCE_ICON_COMPONENTS } from '../../lib/assuranceIcons';
import {
  ASSURANCE_ICONS,
  ASSURANCE_LIMITS,
  ASSURANCE_PLACEMENTS,
  ASSURANCE_PLACEMENT_KEYS,
  ASSURANCE_TONES,
  CURATION_EDITOR_ROLE,
  resolveAssurancePlacement,
  type AssuranceItem,
  type AssurancePlacementConfig,
  type AssurancePlacementKey,
  type AssuranceTone,
  type AssuranceVariant,
} from '../../../shared/storefront/storefrontCuration';
import { lastUpdatedLabel } from '../../lib/curationMeta';

/** Super Admin only — mirrors the server's requireCurationEditor on every curation write. */
const canEditCuration = (role: string | undefined) => role === CURATION_EDITOR_ROLE;

const TONE_LABEL: Record<AssuranceTone, string> = { blue: 'Blue', orange: 'Orange', green: 'Green', purple: 'Purple', red: 'Red', slate: 'Grey' };
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Compact admin preview in each placement's storefront visual treatment. */
function StripPreview({ variant, items }: { variant: AssuranceVariant; items: AssuranceItem[] }) {
  const shown = items.filter((i) => i.enabled);
  if (shown.length === 0) {
    return <div className="rounded-lg border border-dashed border-[#E5E7EB] px-4 py-4 text-[11.5px] text-[#9AA0AC]">Nothing enabled — the strip is hidden on the storefront.</div>;
  }
  if (variant === 'text') {
    return (
      <div className="flex flex-wrap justify-between gap-3.5 rounded-[10px] border border-[#E8EDF2] bg-white px-6 py-[18px]">
        {shown.map((i) => (
          <div key={i.id} className="max-w-[150px] text-center">
            <div className="mb-1 text-[11.5px] font-bold text-[#1A1A2E]">{i.title}</div>
            <div className="text-[10px] text-[#9AA0AC]">{i.description}</div>
          </div>
        ))}
      </div>
    );
  }
  if (variant === 'icons') {
    return (
      <div className="grid min-w-0 grid-cols-1 gap-3 rounded-[10px] border border-[#E8EDF2] bg-white px-4 py-4 sm:grid-cols-2 sm:px-5 xl:grid-cols-3">
        {shown.map((i) => {
          const Icon = ASSURANCE_ICON_COMPONENTS[i.icon];
          return (
            <div key={i.id} className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FF5B00]/10 text-[#FF5B00]">
                <Icon size={15} />
              </div>
              <span className="break-words text-[11.5px] font-bold leading-snug text-[#1A1A2E]">{i.title}</span>
            </div>
          );
        })}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-3.5 rounded-xl border border-[#E8EDF2] bg-white px-5 py-5 sm:grid-cols-3 lg:grid-cols-5">
      {shown.map((i) => {
        const Icon = ASSURANCE_ICON_COMPONENTS[i.icon];
        return (
          <div key={i.id} className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#1A1A2E]" style={{ backgroundColor: ASSURANCE_TONES[i.tone] }}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-[11.5px] font-bold text-[#1A1A2E]">{i.title}</div>
              <div className="text-[9.5px] leading-snug text-[#9AA0AC]">{i.description}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function StorefrontAssurance() {
  const { profile } = useAuth();
  const [site, setSite] = useState<SiteConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [active, setActive] = useState<AssurancePlacementKey>('deals.assurance_strip');
  const [draft, setDraft] = useState<AssurancePlacementConfig | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    catalogApi
      .getSiteConfig()
      .then(setSite)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  const resolved = resolveAssurancePlacement(site?.assuranceStrips, active);
  const current: AssurancePlacementConfig = { enabled: resolved.enabled, items: resolved.items };
  const dirty = draft != null && !same(draft, current);
  const meta = ASSURANCE_PLACEMENTS[active];

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const switchPlacement = (key: AssurancePlacementKey) => {
    if (key === active) return;
    if (dirty && !window.confirm('Discard unsaved changes to this strip?')) return;
    setDraft(null);
    setError(null);
    setActive(key);
  };
  const updateItem = (idx: number, patch: Partial<AssuranceItem>) =>
    draft && setDraft({ ...draft, items: draft.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)) });
  const move = (idx: number, dir: -1 | 1) => {
    if (!draft) return;
    const items = [...draft.items];
    const j = idx + dir;
    if (j < 0 || j >= items.length) return;
    [items[idx], items[j]] = [items[j], items[idx]];
    setDraft({ ...draft, items });
  };
  const addItem = () =>
    draft &&
    setDraft({
      ...draft,
      items: [...draft.items, { id: `item-${Date.now().toString(36)}`, title: '', description: '', icon: 'shield-check', tone: 'slate', enabled: true }],
    });

  const save = async () => {
    if (!draft) return;
    const blank = draft.items.findIndex((i) => !i.title.trim());
    if (blank >= 0) {
      setError(`Item ${blank + 1} needs a title (or remove it).`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const saved = await catalogApi.updateAssurancePlacement(active, draft);
      setSite((prev) => (prev ? { ...prev, assuranceStrips: { ...(prev.assuranceStrips ?? {}), [active]: saved } } : prev));
      setDraft(null);
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 2000);
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
        <Loader2 className="h-4 w-4 animate-spin" /> Loading Trust & Assurance…
      </div>
    );
  }

  const view = draft ?? current;
  const usesIcon = meta.variant !== 'text';
  const usesTone = meta.variant === 'chips';
  const usesDescription = meta.variant !== 'icons';

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-5 md:px-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[15px] font-extrabold text-[#111827]">Trust & Assurance</div>
          <div className="text-[11px] font-semibold text-[#6B7280]">
            Trust statements shown on storefront pages — each page has its own strip · Storefront Curation
          </div>
        </div>
        {savedFlash && (
          <div className="flex items-center gap-1.5 text-[12px] font-bold text-emerald-600">
            <CheckCircle2 className="h-4 w-4" /> Saved
          </div>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {ASSURANCE_PLACEMENT_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => switchPlacement(key)}
            className={`rounded-full px-3.5 py-1.5 text-[11.5px] font-bold ${
              key === active ? 'bg-[#EF3C23] text-white' : 'bg-[#F3F4F6] text-[#374151] hover:bg-[#E5E7EB]'
            }`}
          >
            {ASSURANCE_PLACEMENTS[key].tab} <span className="opacity-70">({ASSURANCE_PLACEMENTS[key].page})</span>
          </button>
        ))}
      </div>

      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[12px] font-semibold text-red-700">{error}</div>}

      <section className={`rounded-xl border bg-white p-4 ${draft ? 'border-[#EF3C23]/50 shadow-sm' : 'border-[#E8EDF2]'}`}>
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[13px] font-bold text-[#1A1A2E]">
              {meta.label}
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${view.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                {view.enabled ? 'Strip on' : 'Strip off'}
              </span>
            </div>
            <div className="text-[11px] text-[#9AA0AC]">Placement key: {active}</div>
            {lastUpdatedLabel(resolved.updatedAt, resolved.updatedBy) && (
              <div className="mt-0.5 text-[10.5px] font-semibold text-[#6B7280]" data-testid="curation-last-updated">
                {lastUpdatedLabel(resolved.updatedAt, resolved.updatedBy)}
              </div>
            )}
          </div>
          {!draft && (
            <button
              type="button"
              onClick={() => setDraft(clone(current))}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E8EDF2] px-3 py-1.5 text-[12px] font-bold text-[#374151] hover:bg-slate-50"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit strip
            </button>
          )}
        </div>

        {resolved.isDefault && !draft && (
          <div className="mb-3 flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-[11.5px] text-blue-800">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Showing the content currently live on this page (not yet customised). Saving stores it here so it can be managed.
          </div>
        )}

        <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-[#9AA0AC]">Preview</div>
        <StripPreview variant={meta.variant} items={view.enabled ? view.items : []} />

        {draft && (
          <div className="mt-4 rounded-lg border border-[#E8EDF2] bg-[#F8FAFC] p-3">
            <label className="mb-3 inline-flex items-center gap-2 text-[12px] font-semibold text-[#374151]">
              <input type="checkbox" checked={draft.enabled} onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} />
              Show this strip on {meta.page}
            </label>
            <div className="mb-2 text-[11px] text-amber-800">
              These are customer-facing commitments. Enter only statements Choosify actually stands behind — text is shown exactly as written.
            </div>
            <ol className="space-y-2">
              {draft.items.map((item, idx) => {
                const Icon = ASSURANCE_ICON_COMPONENTS[item.icon];
                return (
                  <li key={item.id} className="rounded-lg border border-[#E8EDF2] bg-white p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="w-5 text-right text-[11px] font-bold text-[#9AA0AC]">{idx + 1}</span>
                      <input
                        value={item.title}
                        maxLength={ASSURANCE_LIMITS.title}
                        onChange={(e) => updateItem(idx, { title: e.target.value })}
                        placeholder="Title (e.g. Secure Payments)"
                        className="min-w-[180px] flex-1 rounded-lg border border-[#E8EDF2] px-2.5 py-1.5 text-[12.5px] font-semibold"
                      />
                      {usesDescription && (
                        <input
                          value={item.description}
                          maxLength={ASSURANCE_LIMITS.description}
                          onChange={(e) => updateItem(idx, { description: e.target.value })}
                          placeholder="Short description"
                          className="min-w-[200px] flex-[1.4] rounded-lg border border-[#E8EDF2] px-2.5 py-1.5 text-[12px]"
                        />
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 pl-7">
                      {usesIcon && (
                        <>
                          <span className="flex h-7 w-7 items-center justify-center rounded-full" style={{ backgroundColor: usesTone ? ASSURANCE_TONES[item.tone] : '#F1F5F9' }}>
                            <Icon className="h-3.5 w-3.5 text-[#1A1A2E]" />
                          </span>
                          <select
                            aria-label="Icon"
                            value={item.icon}
                            onChange={(e) => updateItem(idx, { icon: e.target.value as AssuranceItem['icon'] })}
                            className="rounded-lg border border-[#E8EDF2] px-2 py-1 text-[11.5px]"
                          >
                            {ASSURANCE_ICONS.map((ic) => (
                              <option key={ic.key} value={ic.key}>
                                {ic.label}
                              </option>
                            ))}
                          </select>
                        </>
                      )}
                      {usesTone && (
                        <select
                          aria-label="Chip colour"
                          value={item.tone}
                          onChange={(e) => updateItem(idx, { tone: e.target.value as AssuranceTone })}
                          className="rounded-lg border border-[#E8EDF2] px-2 py-1 text-[11.5px]"
                        >
                          {(Object.keys(ASSURANCE_TONES) as AssuranceTone[]).map((t) => (
                            <option key={t} value={t}>
                              {TONE_LABEL[t]} chip
                            </option>
                          ))}
                        </select>
                      )}
                      <label className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-[#374151]">
                        <input type="checkbox" checked={item.enabled} onChange={(e) => updateItem(idx, { enabled: e.target.checked })} /> Enabled
                      </label>
                      <div className="ml-auto flex items-center gap-1">
                        <button type="button" aria-label="Move up" onClick={() => move(idx, -1)} disabled={idx === 0} className="rounded p-1 hover:bg-slate-100 disabled:opacity-30">
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label="Move down"
                          onClick={() => move(idx, 1)}
                          disabled={idx === draft.items.length - 1}
                          className="rounded p-1 hover:bg-slate-100 disabled:opacity-30"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label="Remove"
                          onClick={() => setDraft({ ...draft, items: draft.items.filter((_, i) => i !== idx) })}
                          className="rounded p-1 text-red-500 hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
            {draft.items.length === 0 && <div className="rounded-lg border border-dashed border-[#E5E7EB] px-3 py-3 text-[11.5px] text-[#9AA0AC]">No items — the strip will be hidden.</div>}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={addItem}
                disabled={draft.items.length >= ASSURANCE_LIMITS.items}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#E8EDF2] bg-white px-3 py-2 text-[12px] font-bold text-[#374151] disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" /> Add item
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving || !(dirty || resolved.isDefault)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#EF3C23] px-4 py-2 text-[12px] font-bold text-white disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Save
              </button>
              <button
                type="button"
                onClick={() => {
                  if (dirty && !window.confirm('Discard unsaved changes?')) return;
                  setDraft(null);
                  setError(null);
                }}
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
    </div>
  );
}
