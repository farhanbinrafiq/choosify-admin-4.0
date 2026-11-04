/**
 * Website Studio — Homepage. A storefront MIRROR: the left pane looks like choosify.bd's homepage
 * (hero band, then each section in its live order, drawn the way the storefront draws it, with the
 * real picked brands, products, guides, categories and banners). Click a section to edit it in
 * the inspector on the right. Saving / previewing / publishing / history come from DocumentWorkspace.
 */
import React, { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Eye, EyeOff, Play, Plus } from 'lucide-react';
import { CatalogPicker, lookupIn, useHomepageCatalog, type HomepageCatalog, type PickItem } from './CatalogPicker';
import { HeroSlideEditor } from './HeroSlideEditor';
import { DealsBannersPanel } from './DealsBannersPanel';
import { Field, MirrorBlock, MirrorLayout, STOREFRONT, inputCls, iconBtn, smallBtn } from './StudioKit';
import {
  HOMEPAGE_LIMITS,
  SECTION_INFO,
  moveItem,
  newSlide,
  type HomepageSection,
  type HomepageSectionId,
  type HomepageStudioContent,
} from './homepageModel';

type Sel = 'hero' | HomepageSectionId | null;

const CAT_ICONS = ['👗', '💍', '💆', '🎧', '🛋', '🛒'];
const SERVICES = ['Restaurants', 'Hotels', 'Travel', 'Education', 'Health', 'Repairs'];

/** Storefront section shell: white panel, heading + "VIEW ALL ›", optional sub-line. */
function Panel({ title, subtitle, viewAll = true, children }: { title: string; subtitle?: string; viewAll?: boolean; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#E8EDF2] bg-white p-4">
      {title && (
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <div className="text-[14px] font-extrabold text-[#1A1A2E]">{title}</div>
          {viewAll && <div className="text-[10px] font-bold" style={{ color: STOREFRONT.orange }}>VIEW ALL ›</div>}
        </div>
      )}
      {subtitle && <div className="mb-2 text-[10.5px] text-[#6B7280]">{subtitle}</div>}
      <div className="mt-2">{children}</div>
    </div>
  );
}

const Ghost = ({ n, className }: { n: number; className: string }) => (
  <>
    {Array.from({ length: n }, (_, i) => (
      <span key={i} className={`bg-slate-100 ${className}`} />
    ))}
  </>
);
const AutoTag = ({ text }: { text: string }) => <div className="mt-2 text-[10px] font-semibold text-slate-400">{text}</div>;

function Cards({ items, empty, round }: { items: Array<PickItem | undefined>; empty: string; round?: boolean }) {
  if (!items.length) {
    return (
      <>
        <div className="grid grid-cols-4 gap-2"><Ghost n={4} className={round ? 'mx-auto h-12 w-12 rounded-full' : 'h-20 rounded-lg'} /></div>
        <AutoTag text={empty} />
      </>
    );
  }
  return (
    <div className={round ? 'grid grid-cols-6 gap-2' : 'grid grid-cols-4 gap-2'}>
      {items.map((it, i) =>
        round ? (
          <div key={i} className="text-center">
            {it?.thumb ? <img src={it.thumb} alt="" className="mx-auto h-11 w-11 rounded-full border border-[#E8EDF2] object-cover" /> : <span className="mx-auto block h-11 w-11 rounded-full bg-slate-100" />}
            <div className="mt-1 truncate text-[9.5px] font-semibold text-[#1A1A2E]">{it?.label ?? '…'}</div>
          </div>
        ) : (
          <div key={i} className="overflow-hidden rounded-lg border border-[#E8EDF2]">
            {it?.thumb ? <img src={it.thumb} alt="" className="h-16 w-full object-cover" /> : <span className="block h-16 w-full bg-slate-100" />}
            <div className="truncate px-1.5 py-1 text-[9.5px] font-semibold text-[#1A1A2E]">{it?.label ?? '…'}</div>
          </div>
        ),
      )}
    </div>
  );
}

function SectionMirror({ s, v, catalog }: { s: HomepageSection; v: HomepageStudioContent; catalog: HomepageCatalog }) {
  const info = SECTION_INFO[s.id];
  const title = s.title || info.defaultTitle;
  const sub = s.subtitle || info.defaultSubtitle || '';
  const trending = v.sections.find((x) => x.id === 'trending');
  const productCards = v.featuredProductIds.map((id) => catalog.product(id));
  switch (s.id) {
    case 'categories':
      return (
        <Panel title={title} subtitle={s.subtitle}>
          <div className="grid grid-cols-6 gap-2">
            {(v.topCategories.length ? v.topCategories.map((c) => c.label || lookupIn(catalog.categories, catalog.loaded)(c.id)?.label || '…') : Array(6).fill('Auto')).map((name, i) => (
              <div key={i} className="flex flex-col items-center gap-1 rounded-lg border border-[#E8EDF2] px-1 py-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-50 text-[13px]">{CAT_ICONS[i % 6]}</span>
                <span className="w-full truncate text-center text-[9px] font-semibold text-[#1A1A2E]">{name}</span>
              </div>
            ))}
          </div>
          {!v.topCategories.length && <AutoTag text="Automatic — the categories with the most products" />}
        </Panel>
      );
    case 'spotlight':
      return (
        <Panel title={`✦ ${title}`} subtitle={s.subtitle}>
          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex h-16 items-center justify-center rounded-lg bg-slate-100"><Play className="h-4 w-4 text-slate-400" /></div>
            ))}
          </div>
          <AutoTag text="Filled automatically with creator videos, reels and live streams" />
          {trending?.isVisible !== false && (
            <div className="mt-3 rounded-xl border border-dashed border-violet-200 p-2">
              <div className="mb-1 text-[11px] font-extrabold text-[#1A1A2E]">{trending?.title || 'Popular Products'} <span className="font-semibold text-violet-600">(inside Viral Today)</span></div>
              <Cards items={productCards} empty="Automatic — the newest products" />
            </div>
          )}
        </Panel>
      );
    case 'trending':
      return (
        <Panel title={title} subtitle={sub}>
          <Cards items={productCards} empty="Automatic — the newest products" />
        </Panel>
      );
    case 'deals': {
      const live = v.dealsBanners.filter((b) => b.isActive && b.image).slice(0, HOMEPAGE_LIMITS.activeDealsBanners);
      return (
        <Panel title={title} subtitle={s.subtitle} viewAll={false}>
          {live.length ? (
            <div className="flex gap-2 overflow-hidden">
              {live.map((b) => (
                <div key={b.id} className="relative h-[60px] w-[150px] shrink-0 overflow-hidden rounded-lg">
                  <img src={b.image} alt="" className="h-full w-full object-cover" />
                  {b.brandName && <span className="absolute bottom-1 left-1 rounded px-1 text-[8px] font-extrabold" style={{ background: 'rgba(0,0,0,.6)', color: '#FFFFFF' }}>PROMOTED · {b.brandName}</span>}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-200 px-3 py-3 text-[10.5px] text-slate-500">“No deals running right now.” — no banner is switched on</div>
          )}
        </Panel>
      );
    }
    case 'compare':
      return (
        <div className="rounded-2xl p-4" style={{ background: STOREFRONT.header }}>
          <div className="text-[14px] font-extrabold" style={{ color: '#FFFFFF' }}>Compare Anything</div>
          <div className="text-[10.5px]" style={{ color: 'rgba(255,255,255,.6)' }}>Find the best by comparing side by side</div>
        </div>
      );
    case 'recommended':
      return (
        <Panel title={title} subtitle={s.subtitle}>
          <Cards items={v.featuredGuideIds.map((id) => lookupIn(catalog.guides, catalog.loaded)(id))} empty="Automatic — the newest guides" />
        </Panel>
      );
    case 'featured-brands':
      return (
        <Panel title={title} subtitle={s.subtitle}>
          <Cards round items={v.featuredBrandIds.map((id) => lookupIn(catalog.brands, catalog.loaded)(id))} empty="Automatic — daily rotation of brands with a logo" />
        </Panel>
      );
    case 'services':
      return (
        <Panel title={title} subtitle={s.subtitle} viewAll={false}>
          <div className="grid grid-cols-6 gap-2">
            {SERVICES.map((n) => (
              <div key={n} className="rounded-lg border border-[#E8EDF2] px-1 py-2 text-center text-[9px] font-semibold text-[#1A1A2E]">{n}</div>
            ))}
          </div>
        </Panel>
      );
    default:
      return (
        <Panel title={title} subtitle={s.subtitle} viewAll={false}>
          <div className="grid grid-cols-6 gap-2"><Ghost n={6} className="h-12 rounded-lg" /></div>
          <AutoTag text="Personal to each signed-in shopper" />
        </Panel>
      );
  }
}

export function HomepageEditor({ value, onChange, disabled }: { value: HomepageStudioContent; onChange: (v: HomepageStudioContent) => void; disabled: boolean }) {
  const catalog = useHomepageCatalog();
  const [sel, setSel] = useState<Sel>(null);
  const v = { ...value, dealsBanners: value.dealsBanners ?? [] };
  const set = (patch: Partial<HomepageStudioContent>) => onChange({ ...v, ...patch });
  const { loaded, resolveProducts } = catalog;
  const productKey = v.featuredProductIds.join(',');
  useEffect(() => {
    if (loaded) resolveProducts(v.featuredProductIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, productKey]);

  const spotlightVisible = v.sections.find((s) => s.id === 'spotlight')?.isVisible !== false;
  const active = v.slides.filter((s) => s.isActive && s.mediaUrl);
  const first = active[0];
  const pickerOff = disabled || !loaded;

  const mirror = (
    <div className="space-y-3 p-3" onClick={() => setSel(null)} data-testid="ws-homepage-editor">
      {catalog.error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11.5px] font-semibold text-red-700">The catalog could not be loaded: {catalog.error}</div>}
      <MirrorBlock selected={sel === 'hero'} onSelect={() => setSel('hero')} label="Hero banner" testId="ws-hp-hero" muted={!v.heroVisible} className="rounded-xl">
        <div className="relative h-[150px] overflow-hidden rounded-xl" style={{ background: STOREFRONT.navy }}>
          {first?.mediaType === 'image' ? (
            <img src={first.mediaUrl} alt="" className="h-full w-full object-cover" style={{ objectPosition: `${first.focalX}% ${first.focalY}%` }} />
          ) : (
            <div className="flex h-full items-center justify-center gap-2 text-[12px] font-bold" style={{ color: 'rgba(255,255,255,.75)' }}>
              <Play className="h-5 w-5" /> {first ? 'Video slide' : 'Built-in Choosify video'}
            </div>
          )}
          <span className="absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: 'rgba(0,0,0,.55)', color: '#FFFFFF' }} data-testid="ws-hp-hero-summary">
            {!v.heroVisible ? 'Hidden' : active.length ? `${active.length} active slide${active.length === 1 ? '' : 's'}` : 'No active slides — built-in Choosify video'}
          </span>
        </div>
      </MirrorBlock>
      {v.sections.map((s) => {
        if (s.id === 'trending' && spotlightVisible && s.isVisible) return (
          <MirrorBlock key={s.id} selected={sel === s.id} onSelect={() => setSel(s.id)} label="Popular Products" testId={`ws-hp-section-${s.id}`} className="rounded-xl">
            <div className="rounded-xl border border-dashed border-violet-200 bg-white px-3 py-2 text-[11px] font-semibold text-violet-700">Popular Products — shown inside Viral Today (click to edit)</div>
          </MirrorBlock>
        );
        return (
          <MirrorBlock key={s.id} selected={sel === s.id} onSelect={() => setSel(s.id)} label={SECTION_INFO[s.id].name} testId={`ws-hp-section-${s.id}`} muted={!s.isVisible} className="rounded-2xl">
            {!s.isVisible && <span className="absolute right-2 top-2 z-10 rounded-full bg-slate-700 px-2 py-0.5 text-[9.5px] font-extrabold" style={{ color: '#FFFFFF' }}>HIDDEN</span>}
            <SectionMirror s={s} v={v} catalog={catalog} />
          </MirrorBlock>
        );
      })}
    </div>
  );

  // ----- Inspector -------------------------------------------------------------------------------
  let title = '';
  let inspector: React.ReactNode = null;
  if (sel === 'hero') {
    title = 'Hero banner';
    inspector = (
      <div className="space-y-3">
        <button type="button" className={smallBtn} disabled={disabled} data-testid="ws-hp-hero-visible" onClick={() => set({ heroVisible: !v.heroVisible })}>
          {v.heroVisible ? <><Eye className="h-3.5 w-3.5" /> Shown — click to hide</> : <><EyeOff className="h-3.5 w-3.5" /> Hidden — click to show</>}
        </button>
        <div className="text-[11.5px] text-slate-500">Full-width sliding banner of images and/or videos at the top of the homepage; each slide can link somewhere. No active slide = the built-in Choosify video.</div>
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
        <button type="button" className={smallBtn} disabled={disabled || v.slides.length >= HOMEPAGE_LIMITS.slides} data-testid="ws-hp-add-slide" onClick={() => set({ slides: [...v.slides, newSlide(v.slides)] })}>
          <Plus className="h-3.5 w-3.5" /> {v.slides.length >= HOMEPAGE_LIMITS.slides ? `Maximum ${HOMEPAGE_LIMITS.slides} slides` : 'Add slide'}
        </button>
      </div>
    );
  } else if (sel) {
    const i = v.sections.findIndex((x) => x.id === sel);
    const s = v.sections[i];
    const info = SECTION_INFO[sel];
    const setS = (patch: Partial<HomepageSection>) => set({ sections: v.sections.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
    title = info.name;
    inspector = (
      <div className="space-y-3" data-testid={`ws-hp-inspector-${sel}`}>
        <div className="text-[11.5px] text-slate-500">{info.note}</div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" className={smallBtn} disabled={disabled} data-testid={`ws-hp-visible-${sel}`} onClick={() => setS({ isVisible: !s.isVisible })}>
            {s.isVisible ? <><Eye className="h-3.5 w-3.5" /> Shown</> : <><EyeOff className="h-3.5 w-3.5" /> Hidden</>}
          </button>
          <button type="button" className={iconBtn} disabled={disabled || i === 0} aria-label="Move section up" data-testid={`ws-hp-up-${sel}`} onClick={() => set({ sections: moveItem(v.sections, i, -1) })}><ArrowUp className="h-3.5 w-3.5" /></button>
          <button type="button" className={iconBtn} disabled={disabled || i === v.sections.length - 1} aria-label="Move section down" data-testid={`ws-hp-down-${sel}`} onClick={() => set({ sections: moveItem(v.sections, i, 1) })}><ArrowDown className="h-3.5 w-3.5" /></button>
          <span className="text-[11px] font-semibold text-slate-400">position {i + 1} of {v.sections.length}</span>
        </div>
        {info.heading && (
          <>
            <Field label="Heading">
              <input className={inputCls} value={s.title} maxLength={60} disabled={disabled} placeholder={info.defaultTitle} data-testid={`ws-hp-title-${sel}`} onChange={(e) => setS({ title: e.target.value })} />
            </Field>
            <Field label="Line under the heading (optional)">
              <input className={inputCls} value={s.subtitle} maxLength={160} disabled={disabled} placeholder={info.defaultSubtitle ?? 'None'} data-testid={`ws-hp-subtitle-${sel}`} onChange={(e) => setS({ subtitle: e.target.value })} />
            </Field>
          </>
        )}
        {sel === 'categories' && (
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
                className="w-32 rounded-md border border-[#E2E8F0] px-2 py-1 text-[11.5px]"
                placeholder="Custom label"
                maxLength={40}
                disabled={disabled}
                aria-label="Custom label"
                data-testid="ws-hp-category-label"
                value={v.topCategories.find((c) => c.id === cid)?.label ?? ''}
                onChange={(e) => set({ topCategories: v.topCategories.map((c) => (c.id === cid ? { ...c, label: e.target.value } : c)) })}
              />
            )}
          />
        )}
        {sel === 'trending' && (
          <CatalogPicker testId="ws-hp-pick-products" selectedIds={v.featuredProductIds} max={HOMEPAGE_LIMITS.products} lookup={catalog.product} search={catalog.searchProducts} disabled={pickerOff} emptyText="Automatic — the newest products." onChange={(ids) => set({ featuredProductIds: ids })} />
        )}
        {sel === 'recommended' && (
          <CatalogPicker testId="ws-hp-pick-guides" selectedIds={v.featuredGuideIds} max={HOMEPAGE_LIMITS.guides} lookup={lookupIn(catalog.guides, loaded)} options={catalog.guides} disabled={pickerOff} emptyText="Automatic — the newest guides." onChange={(ids) => set({ featuredGuideIds: ids })} />
        )}
        {sel === 'featured-brands' && (
          <CatalogPicker testId="ws-hp-pick-brands" selectedIds={v.featuredBrandIds} max={HOMEPAGE_LIMITS.brands} lookup={lookupIn(catalog.brands, loaded)} options={catalog.brands} disabled={pickerOff} round emptyText="Automatic — daily rotation of brands with a logo (pinned and verified brands first)." onChange={(ids) => set({ featuredBrandIds: ids })} />
        )}
        {sel === 'deals' && <DealsBannersPanel banners={v.dealsBanners} disabled={disabled} products={catalog.productList} brands={catalog.brands} onChange={(dealsBanners) => set({ dealsBanners })} />}
      </div>
    );
  }

  return <MirrorLayout mirror={mirror} inspector={inspector} inspectorTitle={title} />;
}

/** Compact page outline (version history "View"). */
export function HomepageOutline({ value }: { value: HomepageStudioContent }) {
  const spotlightVisible = value.sections.find((s) => s.id === 'spotlight')?.isVisible !== false;
  const activeSlides = value.slides.filter((s) => s.isActive && s.mediaUrl).length;
  return (
    <div className="space-y-1.5 text-[11.5px]" data-testid="ws-hp-outline">
      <div className="rounded-md px-2.5 py-2 font-bold" style={value.heroVisible ? { background: STOREFRONT.navy, color: '#FFFFFF' } : { border: '1px dashed #CBD5E1', color: '#94A3B8' }}>
        Hero {value.heroVisible ? (activeSlides ? `· ${activeSlides} slide${activeSlides === 1 ? '' : 's'}` : '· built-in video') : '· hidden'}
      </div>
      {value.sections.map((s) =>
        s.id === 'trending' && spotlightVisible ? null : (
          <div key={s.id} className={`rounded-md px-2.5 py-1.5 ${s.isVisible ? 'border border-[#E8EDF2] bg-white font-bold text-[#111827]' : 'border border-dashed border-slate-200 text-slate-400 line-through'}`}>
            {s.title || SECTION_INFO[s.id].defaultTitle || SECTION_INFO[s.id].name}
            {s.id === 'deals' && ` · ${(value.dealsBanners ?? []).filter((b) => b.isActive).length} banner(s)`}
          </div>
        ),
      )}
    </div>
  );
}
