/**
 * Website Studio — Homepage (Phase 2). A storefront-mirror editor: it reads top-to-bottom like the
 * real homepage (hero first, then each section in its live order) and offers only what the
 * storefront renders. Saving / publishing / history come from the shared DocumentWorkspace.
 */
import React, { useEffect } from 'react';
import { ArrowDown, ArrowUp, Eye, EyeOff, Plus } from 'lucide-react';
import { CatalogPicker, lookupIn, useHomepageCatalog } from './CatalogPicker';
import { HeroSlideEditor } from './HeroSlideEditor';
import {
  HOMEPAGE_LIMITS,
  SECTION_INFO,
  moveItem,
  newSlide,
  type HomepageSection,
  type HomepageSectionId,
  type HomepageStudioContent,
} from './homepageModel';

const inputCls =
  'w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-[12.5px] text-[#111827] outline-none focus:border-[#EF3C23] focus:ring-2 focus:ring-[#EF3C23]/15 disabled:bg-slate-50';
const labelCls = 'mb-1 block text-[10.5px] font-extrabold uppercase tracking-wide text-[#6B7280]';
const iconBtn = 'inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#E2E8F0] bg-white text-[#374151] hover:bg-slate-50 disabled:opacity-40';
const toggleBtn = 'inline-flex items-center gap-1 rounded-md border border-[#E2E8F0] bg-white px-2 py-1 text-[11px] font-bold text-[#374151] disabled:opacity-50';

function VisibleToggle({ visible, disabled, testId, onToggle }: { visible: boolean; disabled: boolean; testId: string; onToggle: () => void }) {
  return (
    <button type="button" className={toggleBtn} disabled={disabled} data-testid={testId} aria-pressed={visible} onClick={onToggle}>
      {visible ? (
        <>
          <Eye className="h-3.5 w-3.5" /> Shown
        </>
      ) : (
        <>
          <EyeOff className="h-3.5 w-3.5" /> Hidden
        </>
      )}
    </button>
  );
}

export function HomepageEditor({ value, onChange, disabled }: { value: HomepageStudioContent; onChange: (v: HomepageStudioContent) => void; disabled: boolean }) {
  const catalog = useHomepageCatalog();
  const v = value;
  const set = (patch: Partial<HomepageStudioContent>) => onChange({ ...v, ...patch });
  const setSection = (i: number, patch: Partial<HomepageSection>) => set({ sections: v.sections.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const { loaded, resolveProducts } = catalog;
  const productKey = v.featuredProductIds.join(',');

  useEffect(() => {
    if (loaded) resolveProducts(v.featuredProductIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, productKey]);

  const spotlightVisible = v.sections.find((s) => s.id === 'spotlight')?.isVisible !== false;
  const activeSlides = v.slides.filter((s) => s.isActive && s.mediaUrl).length;
  const pickerOff = disabled || !loaded;

  const sectionContent = (id: HomepageSectionId) => {
    switch (id) {
      case 'categories':
        return (
          <CatalogPicker
            testId="ws-hp-pick-categories"
            selectedIds={v.topCategories.map((c) => c.id)}
            max={HOMEPAGE_LIMITS.categories}
            lookup={lookupIn(catalog.categories, loaded)}
            options={catalog.categories}
            disabled={pickerOff}
            emptyText="Automatic — the categories with the most products."
            onChange={(ids) => set({ topCategories: ids.map((cid) => v.topCategories.find((c) => c.id === cid) ?? { id: cid, label: '' }) })}
            renderExtra={(cid) => (
              <input
                className="w-36 rounded-md border border-[#E2E8F0] px-2 py-1 text-[11.5px]"
                placeholder="Custom label (optional)"
                maxLength={40}
                disabled={disabled}
                aria-label="Custom label"
                data-testid="ws-hp-category-label"
                value={v.topCategories.find((c) => c.id === cid)?.label ?? ''}
                onChange={(e) => set({ topCategories: v.topCategories.map((c) => (c.id === cid ? { ...c, label: e.target.value } : c)) })}
              />
            )}
          />
        );
      case 'trending':
        return (
          <CatalogPicker
            testId="ws-hp-pick-products"
            selectedIds={v.featuredProductIds}
            max={HOMEPAGE_LIMITS.products}
            lookup={catalog.product}
            search={catalog.searchProducts}
            disabled={pickerOff}
            emptyText="Automatic — the newest products."
            onChange={(ids) => set({ featuredProductIds: ids })}
          />
        );
      case 'recommended':
        return (
          <CatalogPicker
            testId="ws-hp-pick-guides"
            selectedIds={v.featuredGuideIds}
            max={HOMEPAGE_LIMITS.guides}
            lookup={lookupIn(catalog.guides, loaded)}
            options={catalog.guides}
            disabled={pickerOff}
            emptyText="Automatic — the newest guides."
            onChange={(ids) => set({ featuredGuideIds: ids })}
          />
        );
      case 'featured-brands':
        return (
          <CatalogPicker
            testId="ws-hp-pick-brands"
            selectedIds={v.featuredBrandIds}
            max={HOMEPAGE_LIMITS.brands}
            lookup={lookupIn(catalog.brands, loaded)}
            options={catalog.brands}
            disabled={pickerOff}
            round
            emptyText="Automatic — daily rotation of brands with a logo (pinned and verified brands first)."
            onChange={(ids) => set({ featuredBrandIds: ids })}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-3" data-testid="ws-homepage-editor">
      {catalog.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11.5px] font-semibold text-red-700">The catalog could not be loaded: {catalog.error}</div>
      )}

      {/* HERO — always at the top of the storefront */}
      <section
        className={`rounded-xl border-2 p-3 ${v.heroVisible ? 'border-[#D9DCEC]' : 'border-dashed border-slate-200'}`}
        style={{ background: 'linear-gradient(180deg, #F5F6FB 0%, #FFFFFF 100%)' }}
        data-testid="ws-hp-hero"
      >
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide" style={{ background: '#1A1D4E', color: '#FFFFFF' }}>
            Top of page
          </span>
          <span className="text-[13px] font-extrabold text-[#111827]">Hero banner</span>
          <div className="ml-auto">
            <VisibleToggle visible={v.heroVisible} disabled={disabled} testId="ws-hp-hero-visible" onToggle={() => set({ heroVisible: !v.heroVisible })} />
          </div>
        </div>
        <div className="mb-3 text-[11.5px] text-slate-600" data-testid="ws-hp-hero-summary">
          Full-width sliding banner of images and/or videos; each slide can link somewhere.{' '}
          {activeSlides === 0 ? <b>No active slides — the built-in Choosify video is shown.</b> : `${activeSlides} active slide${activeSlides === 1 ? '' : 's'}.`}
        </div>
        <div className="space-y-3">
          {v.slides.map((s, i) => (
            <HeroSlideEditor
              key={s.id}
              slide={s}
              index={i}
              count={v.slides.length}
              disabled={disabled}
              onChange={(next) => set({ slides: v.slides.map((x, j) => (j === i ? next : x)) })}
              onMove={(d) => set({ slides: moveItem(v.slides, i, d) })}
              onRemove={() => set({ slides: v.slides.filter((_, j) => j !== i) })}
            />
          ))}
        </div>
        <button
          type="button"
          className="mt-3 inline-flex items-center gap-1 rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-[11.5px] font-bold text-[#111827] hover:bg-slate-50 disabled:opacity-50"
          disabled={disabled || v.slides.length >= HOMEPAGE_LIMITS.slides}
          data-testid="ws-hp-add-slide"
          onClick={() => set({ slides: [...v.slides, newSlide(v.slides)] })}
        >
          <Plus className="h-3.5 w-3.5" /> {v.slides.length >= HOMEPAGE_LIMITS.slides ? `Maximum ${HOMEPAGE_LIMITS.slides} slides` : 'Add slide'}
        </button>
      </section>

      {/* SECTIONS — in the order the storefront shows them */}
      {v.sections.map((s, i) => {
        const info = SECTION_INFO[s.id];
        return (
          <section
            key={s.id}
            className={`rounded-xl border p-3 ${s.isVisible ? 'border-[#E8EDF2] bg-white' : 'border-dashed border-slate-200 bg-slate-50'}`}
            data-testid={`ws-hp-section-${s.id}`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-5 text-center text-[11px] font-extrabold text-slate-400">{i + 1}</span>
              <span className={`text-[13px] font-extrabold ${s.isVisible ? 'text-[#111827]' : 'text-slate-400'}`}>{info.name}</span>
              {!s.isVisible && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-extrabold uppercase text-slate-600">Hidden</span>}
              {s.id === 'trending' && s.isVisible && spotlightVisible && (
                <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-extrabold text-violet-700">Shown inside Viral Today</span>
              )}
              <div className="ml-auto flex gap-1.5">
                <VisibleToggle visible={s.isVisible} disabled={disabled} testId={`ws-hp-visible-${s.id}`} onToggle={() => setSection(i, { isVisible: !s.isVisible })} />
                <button type="button" className={iconBtn} disabled={disabled || i === 0} aria-label={`Move ${info.name} up`} data-testid={`ws-hp-up-${s.id}`} onClick={() => set({ sections: moveItem(v.sections, i, -1) })}>
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  className={iconBtn}
                  disabled={disabled || i === v.sections.length - 1}
                  aria-label={`Move ${info.name} down`}
                  data-testid={`ws-hp-down-${s.id}`}
                  onClick={() => set({ sections: moveItem(v.sections, i, 1) })}
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="mt-1 pl-7 text-[11px] text-slate-500">{info.note}</div>
            {s.isVisible && (
              <div className="mt-3 space-y-3 pl-7">
                {info.heading && (
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label className={labelCls}>Heading</label>
                      <input
                        className={inputCls}
                        value={s.title}
                        maxLength={60}
                        disabled={disabled}
                        placeholder={info.defaultTitle}
                        data-testid={`ws-hp-title-${s.id}`}
                        onChange={(e) => setSection(i, { title: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Line under the heading (optional)</label>
                      <input
                        className={inputCls}
                        value={s.subtitle}
                        maxLength={160}
                        disabled={disabled}
                        placeholder={info.defaultSubtitle ?? 'None'}
                        data-testid={`ws-hp-subtitle-${s.id}`}
                        onChange={(e) => setSection(i, { subtitle: e.target.value })}
                      />
                    </div>
                  </div>
                )}
                {sectionContent(s.id)}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

/** Compact page outline beside the editor; Desktop / Mobile preview opens the real storefront. */
export function HomepageOutline({ value }: { value: HomepageStudioContent }) {
  const spotlightVisible = value.sections.find((s) => s.id === 'spotlight')?.isVisible !== false;
  const trending = value.sections.find((x) => x.id === 'trending');
  const active = value.slides.filter((s) => s.isActive && s.mediaUrl);
  const first = active[0];
  return (
    <div className="space-y-1.5 text-[11.5px]" data-testid="ws-hp-outline">
      <div
        className={`relative overflow-hidden rounded-md ${value.heroVisible ? '' : 'border border-dashed border-slate-300 text-slate-400'}`}
        style={value.heroVisible ? { background: '#1A1D4E', color: '#FFFFFF', textShadow: '0 1px 2px rgba(0,0,0,.6)' } : undefined}
      >
        {value.heroVisible && first?.mediaType === 'image' && (
          <img src={first.mediaUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70" style={{ objectPosition: `${first.focalX}% ${first.focalY}%` }} />
        )}
        <div className="relative px-2.5 py-3 font-bold">
          Hero {value.heroVisible ? (active.length ? `· ${active.length} slide${active.length === 1 ? '' : 's'}` : '· built-in video') : '· hidden'}
        </div>
      </div>
      {value.sections.map((s) => {
        if (s.id === 'trending' && spotlightVisible) return null;
        const info = SECTION_INFO[s.id];
        return (
          <div
            key={s.id}
            className={`rounded-md px-2.5 py-1.5 ${s.isVisible ? 'border border-[#E8EDF2] bg-white font-bold text-[#111827]' : 'border border-dashed border-slate-200 text-slate-400 line-through'}`}
          >
            {s.title || info.defaultTitle || info.name}
            {s.id === 'spotlight' && s.isVisible && trending?.isVisible !== false && (
              <span className="ml-1 font-normal text-slate-500">+ {trending?.title || 'Popular Products'}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
