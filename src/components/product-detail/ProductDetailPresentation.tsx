import React, { useMemo, useState } from 'react';
import { Check, Heart, MapPin, MessageCircleMore, Pencil, Play, ShieldCheck, Star } from 'lucide-react';
import type { ProductEditSection, ProductEditorModel } from '../../pages/admin/productEditorModel';
import { classifyProductVideo, resolveCreatorThumbnail } from '../../lib/productVideo';
import { AddonItemsView, ProductGuideView, RelatedInfoView, VariantSummaryView, WarrantyInfoView } from '../../pages/admin/productStudioSections';
import { mergeRelatedStores } from '../../../lib/vercel-catalog/relatedInfoMerge';

/**
 * Shared storefront-parity Product Detail presentation.
 *
 *  - mode="public"  -> read-only storefront-parity view (used by ProductStorefrontPreview).
 *  - mode="studio"  -> same storefront view + section-level inline editing: each
 *                      EDITABLE region shows a small "Edit" pill; clicking it swaps
 *                      that region in place to the parent-supplied editor
 *                      (studio.renderEditor) with Cancel / Save Changes. One at a
 *                      time. Preview-only sections stay read-only. Buyer actions
 *                      (Add to Cart / Wishlist / Compare / Message / qty) are
 *                      rendered for parity but disabled and non-interactive.
 *  - mode="editor"  -> legacy per-section drawer trigger (kept for compatibility;
 *                      not used by the current Product Studio).
 *
 * This component MUST track the real Choosify-Web Product Detail composition -
 * see docs/design/dashboard-ui-regression-lock.md section 8 "Product Detail <-> Product
 * Studio synchronization checklist".
 */

type CarouselMedia =
  | { kind: 'image'; src: string }
  | { kind: 'youtube'; embedUrl: string }
  | { kind: 'video'; src: string };

export type StudioBridge = {
  /** section key currently being edited; '*' = whole-form create mode */
  editingSection: string | null;
  dirty: boolean;
  saving: boolean;
  onEdit: (sectionKey: string) => void;
  onCancel: () => void;
  onSave: () => void;
  /** parent supplies the inline field JSX for a given section key */
  renderEditor: (sectionKey: string) => React.ReactNode;
};

/**
 * Human labels for each editable section key. Shown as a heading inside the
 * inline editor - especially in create mode, where the storefront `view` (which
 * normally carries the <h3>) is replaced wholesale by the editor and the seller
 * would otherwise face an unlabelled box.
 */
const SECTION_TITLES: Record<string, string> = {
  core: 'Core Product Profile',
  basic: 'Basic Information',
  description: 'About This Product',
  pricing: 'Pricing',
  inventory: 'Inventory & Status',
  options: 'Options & Variants',
  addons: 'Add-on Items',
  specs: 'Specifications',
  addlspecs: 'Physical Specifications',
  box: 'Complimentary Features',
  overview: 'Product Overview',
  tags: 'Best For Tags',
  delivery: 'Delivery Information',
  influencer: 'Creator Reviews',
  warranty: 'Warranty & After-Sales Services',
  relatedinfo: 'Related Information',
};

function EditPill({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute top-2 right-2 z-20 inline-flex items-center gap-1 px-2 py-1 rounded-md border border-[#E8EDF2] bg-white/95 text-[#EF3C23] text-[10px] font-extrabold uppercase shadow-sm hover:bg-[#EF3C23] hover:text-white hover:border-[#EF3C23] transition-colors"
    >
      <Pencil className="w-3 h-3" /> Edit
    </button>
  );
}

type SectionCtx = {
  isStudio: boolean;
  creating: boolean;
  studio?: StudioBridge;
  mode: 'public' | 'editor' | 'studio';
  onEditSection?: (section: ProductEditSection) => void;
};

/**
 * Wrap an EDITABLE storefront region. Module-scope so its element type stays
 * stable across parent re-renders - a fresh inline component would remount the
 * subtree on every keystroke and steal focus from the field being edited.
 * In studio view: storefront `view` + Edit pill -> while editing that key,
 * `studio.renderEditor(k)` + Cancel / Save Changes; create mode renders the
 * editor inline. Outside studio mode it is a pass-through.
 */
function SectionShell({
  k, view, className = '', ctx,
}: { k: string; view: React.ReactNode; className?: string; ctx: SectionCtx }) {
  const { isStudio, creating, studio, mode, onEditSection } = ctx;
  if (!isStudio) {
    return (
      <div className={`relative ${className}`}>
        {view}
        {mode === 'editor' && onEditSection ? (
          <EditPill onClick={() => onEditSection(k as ProductEditSection)} />
        ) : null}
      </div>
    );
  }
  const editing = creating || studio!.editingSection === k;
  if (editing) {
    return (
      <div className={`relative rounded-xl bg-white border border-[#E8EDF2] p-4 sm:p-5 ${className}`}>
        {creating ? (
          SECTION_TITLES[k] ? (
            <h3 className="text-[13px] font-extrabold uppercase tracking-wider text-[#1A1A2E] mb-3 m-0">{SECTION_TITLES[k]}</h3>
          ) : null
        ) : (
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#9AA0AC] mb-3">
            Editing{SECTION_TITLES[k] ? ` — ${SECTION_TITLES[k]}` : ' this section'}
          </div>
        )}
        {studio!.renderEditor(k)}
        {!creating ? (
          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-[#F1F1F3]">
            <button type="button" onClick={studio!.onCancel} disabled={studio!.saving}
              className="px-3.5 py-2 rounded-lg border border-[#E8EDF2] text-[11px] font-bold text-[#374151] bg-white">Cancel</button>
            <button type="button" onClick={studio!.onSave} disabled={studio!.saving}
              className="px-4 py-2 rounded-lg text-[11px] font-extrabold text-white bg-[#EF3C23]">
              {studio!.saving ? 'Saving...' : 'Save Changes'}
            </button>
            {studio!.dirty ? <span className="text-[10px] text-[#9AA0AC] italic">Unsaved changes</span> : null}
          </div>
        ) : null}
      </div>
    );
  }
  return (
    <div className={`relative ${className}`}>
      {view}
      <EditPill onClick={() => studio!.onEdit(k)} />
    </div>
  );
}

/** Platform fallback when the seller hasn't filled the Delivery Information section. */
const DEFAULT_DELIVERY_BULLETS = ['Cash on Delivery available', 'Standard delivery across Bangladesh'];

function DeliveryInfoView({ region, bullets }: { region?: string; bullets?: string[] }) {
  const clean = (bullets || []).filter(Boolean);
  const facts = clean.length ? clean : DEFAULT_DELIVERY_BULLETS;
  return (
    <div className="text-[12.5px] text-[#4B5563] leading-relaxed">
      <div className="text-[11px] font-extrabold text-[#9AA0AC] uppercase mb-2">Delivery Information</div>
      <div className="flex items-center gap-1.5 mb-1.5 text-[#1A1A2E] font-semibold">
        <MapPin size={13} className="text-[#FF5B00]" />
        {region || 'Bangladesh'}
      </div>
      <ul className="m-0 p-0 list-none space-y-1">
        {facts.map((f) => (
          <li key={f} className="flex items-start gap-1.5">
            <Check size={13} className="text-[#15803D] mt-0.5 shrink-0" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="border border-dashed border-[#E8EDF2] rounded-[10px] bg-white px-5 py-10 text-center">
      <p className="text-[13px] font-medium text-[#9AA0AC] m-0">{message}</p>
    </div>
  );
}

function stockDisplay(stock: number): { label: string; bg: string } {
  if (stock <= 0) return { label: 'Out of Stock', bg: 'bg-[#9CA3AF]' };
  if (stock < 15) return { label: `Only ${stock} Products Left`, bg: 'bg-[#FF000D]' };
  if (stock <= 30) return { label: `${stock} Products in Stock`, bg: 'bg-[#2323FF]' };
  return { label: `${stock} Products in Stock`, bg: 'bg-[#07DD05]' };
}

const SECTION_NAV = [
  { id: 'product-specs-section', label: 'Specs' },
  { id: 'influencer-reviews-section', label: 'Creator Reviews' },
  { id: 'public-reviews-section', label: 'Public Reviews' },
  { id: 'product-overview-section', label: 'Overview' },
  { id: 'product-utility-section', label: 'Features & Specs' },
  { id: 'warranty-section', label: 'Warranty' },
  { id: 'related-info-section', label: 'Related Info' },
  { id: 'where-to-buy-section', label: 'Brand' },
] as const;

export function ProductDetailPresentation({
  model,
  mode = 'public',
  onEditSection,
  studio,
}: {
  model: ProductEditorModel;
  mode?: 'public' | 'editor' | 'studio';
  onEditSection?: (section: ProductEditSection) => void;
  studio?: StudioBridge;
}) {
  const [activeNav, setActiveNav] = useState('product-specs-section');
  const [qty, setQty] = useState(1);

  const isStudio = mode === 'studio' && !!studio;
  const creating = isStudio && studio!.editingSection === '*';
  const previewOnly = mode !== 'public'; // buyer actions are never live outside the real storefront
  // While the seller is editing the media section, let it use the full hero
  // width so PRODUCT PHOTOS and PRODUCT VIDEO sit side by side instead of being
  // squeezed into one narrow column with dead space beside it.
  const coreEditing = isStudio && (creating || studio!.editingSection === 'core');

  // Carousel media = product images (primary first) + the optional product video
  // appended at the end. The video plays as video, not an image.
  const media = useMemo<CarouselMedia[]>(() => {
    const imgs = [...(model.gallery || [])];
    if (model.image && !imgs.includes(model.image)) imgs.unshift(model.image);
    const items: CarouselMedia[] = imgs.filter(Boolean).map((src) => ({ kind: 'image', src }));
    const v = classifyProductVideo(model.videoUrl);
    if (v.kind === 'youtube') items.push({ kind: 'youtube', embedUrl: v.embedUrl });
    else if (v.kind === 'file') items.push({ kind: 'video', src: v.src });
    return items;
  }, [model.gallery, model.image, model.videoUrl]);
  const [activeMedia, setActiveMedia] = useState(0);
  const active = media[Math.min(activeMedia, Math.max(0, media.length - 1))];

  const price = model.price || 0;
  const original = model.originalPrice > price ? model.originalPrice : 0;
  const saveAmt = original > 0 ? original - price : 0;
  const savePct = original > 0 ? Math.round((saveAmt / original) * 100) : 0;
  const stock = stockDisplay(model.stock);
  const isOut = model.stock <= 0;

  const scrollTo = (id: string) => {
    setActiveNav(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const overviewCols = (model.overviewBlocks || []).map((b) => ({ title: b.title, rows: b.bullets || [] }));
  const hasOverview = overviewCols.some((c) => c.rows.length > 0) || model.bestForTags.length > 0;

  const sctx: SectionCtx = { isStudio, creating, studio, mode, onEditSection };
  const buyerBtn = (extra: string) =>
    `${extra} ${previewOnly ? 'opacity-60 cursor-default' : ''}`;

  return (
    <div className="bg-[#F0F8FF] text-[#1A1A2E] overflow-hidden">
      {/* -- Gallery hero (media carousel) -- */}
      <div className="w-full choosify-dark-surface">
        <div className="max-w-[1280px] mx-auto px-5 sm:px-8 lg:px-10 py-6">
          <div className={coreEditing ? 'w-full' : 'grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-6 items-start'}>
            <SectionShell ctx={sctx}
              k="core"
              view={
                <div>
                  <div className="aspect-[4/3] rounded-none overflow-hidden bg-black/20 flex items-center justify-center">
                    {!active ? (
                      <span className="text-[12px] text-white/50 font-semibold">
                        {isStudio ? 'Add product media' : 'No product image'}
                      </span>
                    ) : active.kind === 'youtube' ? (
                      <iframe title="Product video" src={active.embedUrl} allow="accelerometer; encrypted-media; picture-in-picture" allowFullScreen className="w-full h-full border-0" />
                    ) : active.kind === 'video' ? (
                      <video src={active.src} controls preload="metadata" className="w-full h-full object-contain bg-black" />
                    ) : (
                      <img src={active.src} alt="" className="w-full h-full object-contain bg-black/10" />
                    )}
                  </div>
                  {media.length > 1 ? (
                    <div className="flex gap-2 mt-3 overflow-x-auto">
                      {media.map((m, i) => (
                        <button
                          key={`${m.kind}-${i}`}
                          type="button"
                          onClick={() => setActiveMedia(i)}
                          className={`w-16 h-16 shrink-0 overflow-hidden border-2 relative bg-black/40 ${
                            activeMedia === i ? 'border-[#FF5B00]' : 'border-white/20'
                          }`}
                        >
                          {m.kind === 'image' ? (
                            <img src={m.src} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="w-full h-full flex items-center justify-center text-white">
                              <Play size={18} className="fill-current" />
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              }
            />
          </div>
        </div>
      </div>

      <div className="max-w-[1280px] mx-auto px-5 sm:px-8 lg:px-10 pb-10">
        {/* -- Engagement stat row - PREVIEW-ONLY (system-calculated) -- */}
        <div className="relative -mt-2 mb-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 bg-white rounded-xl border border-[#E8EDF2] px-6 py-[18px] items-center">
            {([
              ['Rating', model.rating > 0 ? `★ ${model.rating}` : '—'],
              ['Reviews', model.reviewCount > 0 ? model.reviewCount.toLocaleString() : '—'],
              ['Orders', model.orderCount > 0 ? model.orderCount.toLocaleString() : '—'],
              ['Views', model.viewCount > 0 ? model.viewCount.toLocaleString() : '—'],
            ] as const).map(([label, val]) => (
              <div key={label} className="text-center">
                <div className="text-lg font-extrabold text-[#1A1A2E]">{val}</div>
                <div className="text-[11px] text-[#9AA0AC]">{label}</div>
              </div>
            ))}
          </div>
          {isStudio ? (
            <div className="text-[10px] text-[#9AA0AC] italic mt-1">Live storefront metrics - not editable here.</div>
          ) : null}
        </div>

        {/* -- Buy box -- */}
        <div className="mb-8">
          <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-5">
            <div className="bg-white border border-[#E8EDF2] rounded-xl p-5 sm:p-6 text-left space-y-4">
              {/* inventory + status badges */}
              <SectionShell ctx={sctx}
                k="inventory"
                view={
                  <div className="flex flex-wrap gap-2">
                    <span className={`text-white text-[10px] font-extrabold px-2.5 py-1 rounded-full ${stock.bg}`}>{stock.label}</span>
                    {model.status === 'LIVE' ? (
                      <span className="bg-[#07DD05]/15 text-[#15803D] text-[10px] font-extrabold px-2.5 py-1 rounded-full">LIVE</span>
                    ) : (
                      <span className="bg-[#F3F4F6] text-[#6B7280] text-[10px] font-extrabold px-2.5 py-1 rounded-full">{model.status}</span>
                    )}
                  </div>
                }
              />
              {/* basic identity */}
              <SectionShell ctx={sctx}
                k="basic"
                view={
                  <div>
                    <h1 className="text-[22px] sm:text-[26px] font-extrabold text-[#1A1A2E] tracking-tight m-0 mb-1">
                      {model.title || 'Untitled Product'}
                    </h1>
                    <div className="text-[12.5px] text-[#9AA0AC]">
                      {model.brandName || 'No brand'}
                      {model.categoryName ? ` · ${model.categoryName}` : ''}
                    </div>
                  </div>
                }
              />
              {/* pricing */}
              <SectionShell ctx={sctx}
                k="pricing"
                view={
                  <div className="flex items-baseline gap-2.5">
                    <div className="text-[28px] font-extrabold text-[#FF5B00]">{'৳'}{price.toLocaleString()}</div>
                    {original > 0 ? (
                      <>
                        <div className="text-[14px] text-[#9AA0AC] line-through">{'৳'}{original.toLocaleString()}</div>
                        <div className="text-[11px] font-extrabold text-[#15803D]">Save {savePct}%</div>
                      </>
                    ) : null}
                  </div>
                }
              />
              {/* options / variants — generic, category-schema driven */}
              <SectionShell ctx={sctx}
                k="options"
                view={
                  <>
                    <VariantSummaryView
                      optionGroups={model.optionGroups}
                      productVariants={model.productVariants}
                      isService={model.productType === 'service'}
                    />
                    <ProductGuideView guide={model.sizeGuide} />
                  </>
                }
              />
            </div>

            {/* right card - buyer actions (PREVIEW-ONLY) + add-ons */}
            <div className="bg-white border border-[#E8EDF2] rounded-xl p-5 sm:p-6 text-left space-y-3">
              {previewOnly ? (
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#9AA0AC]">Buyer preview - not interactive</div>
              ) : null}
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-[#9AA0AC]">Qty</span>
                <button type="button" disabled={previewOnly} onClick={() => !previewOnly && setQty((q) => Math.max(1, q - 1))}
                  className={buyerBtn('w-8 h-8 rounded-lg border border-[#E8EDF2] bg-[#F4F7F9] font-bold')}>{'−'}</button>
                <span className="w-8 text-center text-sm font-extrabold">{qty}</span>
                <button type="button" disabled={previewOnly} onClick={() => !previewOnly && setQty((q) => q + 1)}
                  className={buyerBtn('w-8 h-8 rounded-lg border border-[#E8EDF2] bg-[#F4F7F9] font-bold')}>+</button>
              </div>
              <button type="button" disabled className={buyerBtn('w-full py-3 rounded-lg bg-[#FF5B00] text-white text-[12.5px] font-extrabold disabled:opacity-50')}>
                {isOut ? 'Out of Stock' : 'Add to Cart'}
              </button>
              <div className="grid grid-cols-3 gap-2">
                <button type="button" disabled={previewOnly} className={buyerBtn('flex items-center justify-center gap-1 py-2.5 rounded-lg border border-[#E8EDF2] text-[11px] font-bold bg-white')}>
                  <Heart size={13} /> Wishlist
                </button>
                <button type="button" disabled={previewOnly} className={buyerBtn('flex items-center justify-center gap-1 py-2.5 rounded-lg border border-[#E8EDF2] text-[11px] font-bold bg-white')}>
                  Compare
                </button>
                <button type="button" disabled={previewOnly} className={buyerBtn('flex items-center justify-center gap-1 py-2.5 rounded-lg border border-[#E8EDF2] text-[11px] font-bold bg-white')}>
                  <MessageCircleMore size={13} /> Message
                </button>
              </div>

              <SectionShell ctx={sctx}
                k="addons"
                className="pt-2 border-t border-[#F1F1F3]"
                view={<AddonItemsView items={model.addonItems} />}
              />

              <SectionShell ctx={sctx}
                k="delivery"
                className="pt-2 border-t border-[#F1F1F3]"
                view={
                  <DeliveryInfoView region={model.deliveryRegion} bullets={model.deliveryBullets} />
                }
              />
            </div>
          </div>
        </div>

        {/* -- Underline section nav (parity) -- */}
        <div className="sticky top-[64px] z-[15] mb-6 bg-[#F0F8FF]">
          <div className="w-full flex border border-[#E8EDF2] rounded-none bg-white overflow-x-auto">
            {SECTION_NAV.map((item) => (
              <button key={item.id} type="button" onClick={() => scrollTo(item.id)}
                className={`shrink-0 px-4 sm:px-5 py-4 text-[12.5px] font-bold cursor-pointer whitespace-nowrap border-0 border-b-2 bg-transparent ${
                  activeNav === item.id ? 'text-[#FF5B00] border-[#FF5B00]' : 'text-[#6B7280] border-transparent hover:text-[#1A1A2E]'
                }`}>
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-10">
          {/* -- About / Description -- */}
          <SectionShell ctx={sctx}
            k="description"
            view={
              <div>
                <h3 className="text-[15px] font-extrabold text-[#1A1A2E] mb-2 m-0">About this product</h3>
                {model.description ? (
                  <p className="text-[13px] text-[#4B5563] leading-relaxed m-0 whitespace-pre-line">{model.description}</p>
                ) : (
                  <EmptyState message={isStudio ? 'No description yet - edit to add it.' : 'No description available.'} />
                )}
              </div>
            }
          />

          {/* -- Specifications -- */}
          <section id="product-specs-section" className="scroll-mt-36">
            <SectionShell ctx={sctx}
              k="specs"
              view={
                <div>
                  <h3 className="text-[15px] font-extrabold text-[#1A1A2E] mb-3.5 m-0">Specifications</h3>
                  {model.specs.length === 0 ? (
                    <EmptyState message={isStudio ? 'No specifications yet - edit to add them.' : 'No specifications listed.'} />
                  ) : (
                    <div className="bg-white border border-[#E8EDF2] rounded-[10px] overflow-hidden">
                      {model.specs.map((s) => (
                        <div key={`${s.key}-${s.value}`} className="grid grid-cols-[140px_1fr] sm:grid-cols-[180px_1fr] border-b border-[#F1F1F3] last:border-0">
                          <div className="px-4 py-3 text-[11.5px] font-bold text-[#9AA0AC] bg-[#FAFBFC]">{s.key}</div>
                          <div className="px-4 py-3 text-[12.5px] font-semibold text-[#1A1A2E]">{s.value || '—'}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              }
            />
          </section>

          {/* -- Creator Reviews - seller-uploadable video-review links -- */}
          <section id="influencer-reviews-section" className="scroll-mt-36">
            <SectionShell ctx={sctx}
              k="influencer"
              view={
                <div>
                  <h3 className="text-[15px] font-extrabold text-[#1A1A2E] mb-3.5 m-0">Creator Reviews</h3>
                  {model.creatorVideos.length === 0 ? (
                    <EmptyState message={isStudio ? 'No creator reviews yet - edit to add shareable video links.' : 'No creator reviews yet.'} />
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                      {model.creatorVideos.map((c) => (
                        <a
                          key={c.id}
                          href={previewOnly ? undefined : c.videoUrl || undefined}
                          target="_blank"
                          rel="noreferrer"
                          className="bg-white border border-[#E8EDF2] rounded-[10px] overflow-hidden block"
                        >
                          <div className="aspect-video bg-[#F4F7F9] flex items-center justify-center">
                            {resolveCreatorThumbnail(c.videoUrl, c.thumbnail) ? (
                              <img src={resolveCreatorThumbnail(c.videoUrl, c.thumbnail)} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <Play size={22} className="text-[#9AA0AC]" />
                            )}
                          </div>
                          <div className="p-3 text-left">
                            <div className="text-[10px] font-extrabold text-[#EF3C23] uppercase">{c.platform}</div>
                            <div className="text-[12px] font-bold text-[#1A1A2E] mt-0.5 line-clamp-2">{c.title || 'Video review'}</div>
                            {c.creatorHandle ? <div className="text-[10.5px] text-[#9AA0AC] mt-0.5">{c.creatorHandle}</div> : null}
                          </div>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              }
            />
          </section>

          {/* -- Public Reviews - PREVIEW-ONLY (user-generated) -- */}
          <section id="public-reviews-section" className="scroll-mt-36">
            <h3 className="text-[15px] font-extrabold text-[#1A1A2E] mb-1 m-0">What Customers Say</h3>
            <p className="text-[11.5px] text-[#9AA0AC] m-0 mb-3.5">Real reviews from verified buyers</p>
            {model.publicReviews.length === 0 ? (
              <EmptyState message={isStudio ? 'No customer reviews yet - read-only.' : 'No customer reviews yet.'} />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {model.publicReviews.map((r) => (
                  <div key={r.id} className="bg-white border border-[#E8EDF2] rounded-[10px] p-4 text-left">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-[12.5px] font-extrabold">{r.author}</div>
                      <div className="flex items-center gap-0.5 text-[#F59E0B] text-[11px] font-bold">
                        <Star size={12} className="fill-current" /> {r.rating}
                      </div>
                    </div>
                    <p className="text-[12px] text-[#4B5563] m-0 leading-relaxed">{r.comment}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* -- Product Overview + Best For tags -- */}
          <section id="product-overview-section" className="scroll-mt-36">
            <SectionShell ctx={sctx}
              k="overview"
              view={
                <div>
                  <h3 className="text-[15px] font-extrabold text-[#1A1A2E] mb-3.5 m-0">Product Overview</h3>
                  {!hasOverview ? (
                    <EmptyState message={isStudio ? 'No overview content yet - edit to add it.' : 'No overview available.'} />
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5">
                      {overviewCols.map((col) => (
                        <div key={col.title} className="bg-white border border-[#E8EDF2] rounded-[10px] p-4 text-left">
                          <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-[#1A1A2E] mb-3">{col.title}</h4>
                          {col.rows.length === 0 ? (
                            <p className="text-[11px] text-[#9AA0AC] m-0">{'—'}</p>
                          ) : (
                            <ul className="m-0 pl-4 space-y-1.5">
                              {col.rows.map((row) => <li key={row} className="text-[12px] text-[#4B5563]">{row}</li>)}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              }
            />
            <div className="mt-3.5">
              <SectionShell ctx={sctx}
                k="tags"
                view={
                  model.bestForTags.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {model.bestForTags.map((t) => (
                        <span key={t} className="px-2.5 py-1 rounded-full bg-[#F3E8FF] text-[10.5px] font-bold text-[#8A00C4]">#{t.replace(/^#+/, '')}</span>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[11px] text-[#9AA0AC] italic">No "best for" tags.</div>
                  )
                }
              />
            </div>
          </section>

          {/* -- Complimentary Features + Physical Specs -- */}
          <section id="product-utility-section" className="scroll-mt-36">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <SectionShell ctx={sctx}
                k="box"
                view={
                  <div>
                    <h3 className="text-[15px] font-extrabold text-[#1A1A2E] mb-3.5 m-0">Complimentary Features</h3>
                    {model.boxContents.length === 0 ? (
                      <EmptyState message={isStudio ? 'No complimentary features yet.' : 'No complimentary features listed.'} />
                    ) : (
                      <div className="bg-white border border-[#E8EDF2] rounded-[10px] p-4">
                        <ul className="m-0 pl-4 space-y-1.5 text-left">
                          {model.boxContents.map((b) => <li key={b} className="text-[12.5px] text-[#4B5563]">{b}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                }
              />
              <SectionShell ctx={sctx}
                k="addlspecs"
                view={
                  <div>
                    <h3 className="text-[15px] font-extrabold text-[#1A1A2E] mb-3.5 m-0">Physical Specifications</h3>
                    {model.additionalSpecs.length === 0 ? (
                      <EmptyState message={isStudio ? 'No physical specs yet.' : 'No physical specs listed.'} />
                    ) : (
                      <div className="bg-white border border-[#E8EDF2] rounded-[10px] overflow-hidden">
                        {model.additionalSpecs.map((s) => (
                          <div key={`${s.key}-${s.value}`} className="grid grid-cols-[1fr_1fr] border-b border-[#F1F1F3] last:border-0">
                            <div className="px-4 py-3 text-[11.5px] font-bold text-[#9AA0AC]">{s.key}</div>
                            <div className="px-4 py-3 text-[12.5px] font-semibold text-[#1A1A2E]">{s.value}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                }
              />
            </div>
          </section>

          {/* -- Warranty & After-Sales Services -- */}
          <section id="warranty-section" className="scroll-mt-36">
            <SectionShell ctx={sctx}
              k="warranty"
              view={
                <div>
                  <h3 className="text-[15px] font-extrabold text-[#1A1A2E] mb-3.5 m-0">Warranty &amp; After-Sales Services</h3>
                  <div className="bg-white border border-[#E8EDF2] rounded-[10px] p-4">
                    <WarrantyInfoView
                      months={model.warrantyMonths}
                      type={model.warrantyType}
                      provider={model.warrantyProvider}
                      terms={model.warrantyTerms}
                      afterSales={model.afterSalesBullets}
                    />
                  </div>
                </div>
              }
            />
          </section>

          {/* -- Related Information (seller + Choosify-promoted, merged) -- */}
          <section id="related-info-section" className="scroll-mt-36">
            <SectionShell ctx={sctx}
              k="relatedinfo"
              view={
                <div>
                  <h3 className="text-[15px] font-extrabold text-[#1A1A2E] mb-3.5 m-0">
                    Related Information
                    {model.relatedInfoLockedByAdmin ? (
                      <span className="ml-2 text-[10px] font-bold text-[#8A00C4] uppercase tracking-wide">Managed by Choosify</span>
                    ) : null}
                  </h3>
                  <div className="bg-white border border-[#E8EDF2] rounded-[10px] p-4">
                    <RelatedInfoView
                      type={model.relatedInfoType}
                      mergedStores={mergeRelatedStores(
                        model.relatedStores.map((s) => ({ ...s, source: 'seller' as const })),
                        model.adminPromotedStores,
                      )}
                      whatsNearby={model.whatsNearby}
                      beforeYourVisit={model.beforeYourVisit}
                      customTitle={model.customRelatedInfoTitle}
                      customBlocks={model.customRelatedBlocks}
                    />
                  </div>
                </div>
              }
            />
          </section>

          {/* -- Brand - PREVIEW-ONLY (relational; edit in Brand Studio) -- */}
          <section id="where-to-buy-section" className="scroll-mt-36">
            <h3 className="text-[15px] font-extrabold text-[#1A1A2E] mb-3.5 m-0">Brand</h3>
            {model.brandName ? (
              <div className="bg-white border border-[#E8EDF2] rounded-[10px] p-5 flex items-center gap-4 text-left">
                <div className="w-14 h-14 rounded-full bg-[#F4F7F9] border border-[#E8EDF2] flex items-center justify-center text-[14px] font-extrabold text-[#1A1A2E]">
                  {model.brandName.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="text-[15px] font-extrabold text-[#1A1A2E]">{model.brandName}</div>
                  <div className="text-[11.5px] text-[#9AA0AC]">{model.categoryName || 'Brand on Choosify'}</div>
                </div>
              </div>
            ) : (
              <EmptyState message={isStudio ? 'No brand associated - set it in Basic Information.' : 'No Brand listed.'} />
            )}
          </section>
        </div>
      </div>

      {/* -- Trust statement - PREVIEW-ONLY (platform) -- */}
      <section className="w-full bg-[#F4F9FF] border-t border-blue-50 py-12">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-center gap-10 text-center md:text-left">
          <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-xl">
            <ShieldCheck size={40} className="text-blue-600" />
          </div>
          <div className="space-y-2">
            <h4 className="text-xl font-extrabold text-[#1A1A2E] tracking-tight leading-none m-0">Choosify.bd trust statement</h4>
            <p className="text-[14px] font-medium text-[#9AA0AC] tracking-tight m-0">
              "Only verified sellers and unbiased brands are listed on Choosify.bd."
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

export default ProductDetailPresentation;
