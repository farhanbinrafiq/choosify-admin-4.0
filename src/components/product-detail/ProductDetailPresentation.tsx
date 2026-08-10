import React, { useMemo, useState } from 'react';
import { Heart, MessageCircleMore, Pencil, ShieldCheck, Star } from 'lucide-react';
import type { ProductEditSection, ProductEditorModel } from '../../pages/admin/productEditorModel';

function EditChip({ label, onClick }: { label?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute top-3 right-3 z-20 p-2 bg-white border border-[#EF3C23] text-[#EF3C23] hover:bg-[#EF3C23] hover:text-white rounded-lg transition-all shadow-sm flex items-center gap-1.5 text-[10px] font-extrabold uppercase"
    >
      <Pencil className="w-3.5 h-3.5" />
      {label || 'Edit'}
    </button>
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
  { id: 'product-utility-section', label: 'Box & Specs' },
  { id: 'where-to-buy-section', label: 'Brand' },
] as const;

export function ProductDetailPresentation({
  model,
  mode = 'editor',
  onEditSection,
}: {
  model: ProductEditorModel;
  mode?: 'public' | 'editor';
  onEditSection?: (section: ProductEditSection) => void;
}) {
  const [activeNav, setActiveNav] = useState('product-specs-section');
  const [qty, setQty] = useState(1);
  const [selectedColor, setSelectedColor] = useState(model.colors[0] || '');
  const [selectedSize, setSelectedSize] = useState(model.sizes[0] || model.storageOptions[0] || '');

  const media = useMemo(() => {
    const list = [...(model.gallery || [])];
    if (model.image && !list.includes(model.image)) list.unshift(model.image);
    return list.filter(Boolean);
  }, [model.gallery, model.image]);
  const [activeMedia, setActiveMedia] = useState(0);

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

  const overviewCols = [
    { title: 'Quality & Materials', rows: model.overviewQuality },
    { title: 'Features & Benefits', rows: model.overviewFeatures },
    { title: 'Audience & Use Cases', rows: model.overviewAudience },
    { title: 'Customer Support & Assurance', rows: model.overviewSupport },
  ];
  const hasOverview = overviewCols.some((c) => c.rows.length > 0) || model.bestForTags.length > 0;

  return (
    <div className="bg-[#F0F8FF] text-[#1A1A2E] overflow-hidden">
      {/* Gallery hero — Choosify-Web dark surface */}
      <div className="w-full choosify-dark-surface relative">
        {mode === 'editor' && onEditSection ? (
          <EditChip onClick={() => onEditSection('media')} />
        ) : null}
        <div className="max-w-[1280px] mx-auto px-5 sm:px-8 lg:px-10 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-6 items-start">
            <div>
              <div className="aspect-[4/3] rounded-none overflow-hidden bg-black/20 flex items-center justify-center">
                {media[activeMedia] ? (
                  <img src={media[activeMedia]} alt="" className="w-full h-full object-contain bg-black/10" />
                ) : (
                  <span className="text-[12px] text-white/50 font-semibold">
                    {mode === 'editor' ? 'Add product media' : 'No product image'}
                  </span>
                )}
              </div>
              {media.length > 1 ? (
                <div className="flex gap-2 mt-3 overflow-x-auto">
                  {media.map((src, i) => (
                    <button
                      key={`${src}-${i}`}
                      type="button"
                      onClick={() => setActiveMedia(i)}
                      className={`w-16 h-16 shrink-0 overflow-hidden border-2 ${
                        activeMedia === i ? 'border-[#EB4501]' : 'border-white/20'
                      }`}
                    >
                      <img src={src} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1280px] mx-auto px-5 sm:px-8 lg:px-10 pb-10">
        {/* Buy box */}
        <div className="relative -mt-2 mb-8">
          {mode === 'editor' && onEditSection ? (
            <EditChip label="Edit" onClick={() => onEditSection('header')} />
          ) : null}

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-[repeat(4,1fr)_auto] gap-3.5 bg-white rounded-xl border border-[#E8EDF2] px-6 py-[18px] mb-4 items-center">
            <div className="text-center">
              <div className="text-lg font-extrabold text-[#1A1A2E]">
                {model.rating > 0 ? `★ ${model.rating}` : '—'}
              </div>
              <div className="text-[11px] text-[#9AA0AC]">Rating</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-extrabold text-[#1A1A2E]">
                {model.reviewCount > 0 ? model.reviewCount.toLocaleString() : '—'}
              </div>
              <div className="text-[11px] text-[#9AA0AC]">Reviews</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-extrabold text-[#1A1A2E]">
                {model.orderCount > 0 ? model.orderCount.toLocaleString() : '—'}
              </div>
              <div className="text-[11px] text-[#9AA0AC]">Orders</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-extrabold text-[#1A1A2E]">
                {model.viewCount > 0 ? model.viewCount.toLocaleString() : '—'}
              </div>
              <div className="text-[11px] text-[#9AA0AC]">Views</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-5">
            <div className="bg-white border border-[#E8EDF2] rounded-xl p-5 sm:p-6 text-left relative">
              {mode === 'editor' && onEditSection ? (
                <EditChip onClick={() => onEditSection('pricing')} />
              ) : null}
              <div className="flex flex-wrap gap-2 mb-3">
                <span className={`text-white text-[10px] font-extrabold px-2.5 py-1 rounded-full ${stock.bg}`}>
                  {stock.label}
                </span>
                {model.status === 'LIVE' ? (
                  <span className="bg-[#07DD05]/15 text-[#15803D] text-[10px] font-extrabold px-2.5 py-1 rounded-full">
                    LIVE
                  </span>
                ) : (
                  <span className="bg-[#F3F4F6] text-[#6B7280] text-[10px] font-extrabold px-2.5 py-1 rounded-full">
                    {model.status}
                  </span>
                )}
              </div>
              <h1 className="text-[22px] sm:text-[26px] font-extrabold text-[#1A1A2E] tracking-tight m-0 mb-1">
                {model.title || 'Untitled Product'}
              </h1>
              <div className="text-[12.5px] text-[#9AA0AC] mb-2">
                {model.brandName || 'No brand'}
                {model.categoryName ? ` · ${model.categoryName}` : ''}
              </div>
              {model.rating > 0 ? (
                <div className="flex items-center gap-1.5 text-[12px] font-bold text-[#1A1A2E] mb-3">
                  <Star size={14} className="fill-[#F59E0B] text-[#F59E0B]" />
                  {model.rating}
                  {model.reviewCount > 0 ? (
                    <span className="text-[#9AA0AC] font-semibold">({model.reviewCount} reviews)</span>
                  ) : null}
                </div>
              ) : null}
              <div className="flex items-baseline gap-2.5 mb-4">
                <div className="text-[28px] font-extrabold text-[#EB4501]">
                  ৳{price.toLocaleString()}
                </div>
                {original > 0 ? (
                  <>
                    <div className="text-[14px] text-[#9AA0AC] line-through">৳{original.toLocaleString()}</div>
                    <div className="text-[11px] font-extrabold text-[#15803D]">Save {savePct}%</div>
                  </>
                ) : null}
              </div>

              {model.colors.length > 0 ? (
                <div className="mb-4">
                  <div className="text-[11px] font-extrabold text-[#9AA0AC] uppercase mb-2">Color</div>
                  <div className="flex flex-wrap gap-2">
                    {model.colors.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setSelectedColor(c)}
                        className={`px-3 py-1.5 rounded-full text-[11px] font-bold border ${
                          selectedColor === c
                            ? 'bg-[#1A1A2E] text-white border-[#1A1A2E]'
                            : 'bg-white text-[#1A1A2E] border-[#E8EDF2]'
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {(model.sizes.length > 0 || model.storageOptions.length > 0) ? (
                <div className="mb-2">
                  <div className="text-[11px] font-extrabold text-[#9AA0AC] uppercase mb-2">
                    {model.sizes.length > 0 ? 'Size' : 'Storage'}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(model.sizes.length > 0 ? model.sizes : model.storageOptions).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSelectedSize(s)}
                        className={`px-3 py-1.5 rounded-full text-[11px] font-bold border ${
                          selectedSize === s
                            ? 'bg-[#1A1A2E] text-white border-[#1A1A2E]'
                            : 'bg-white text-[#1A1A2E] border-[#E8EDF2]'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="bg-white border border-[#E8EDF2] rounded-xl p-5 sm:p-6 text-left space-y-3 relative">
              {mode === 'editor' && onEditSection ? (
                <EditChip onClick={() => onEditSection('addons')} />
              ) : null}
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-[#9AA0AC]">Qty</span>
                <button
                  type="button"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="w-8 h-8 rounded-lg border border-[#E8EDF2] bg-[#F4F7F9] font-bold"
                >
                  −
                </button>
                <span className="w-8 text-center text-sm font-extrabold">{qty}</span>
                <button
                  type="button"
                  onClick={() => setQty((q) => q + 1)}
                  className="w-8 h-8 rounded-lg border border-[#E8EDF2] bg-[#F4F7F9] font-bold"
                >
                  +
                </button>
              </div>
              <button
                type="button"
                disabled={isOut}
                className="w-full py-3 rounded-lg bg-[#EB4501] text-white text-[12.5px] font-extrabold disabled:opacity-50"
              >
                {isOut ? 'Out of Stock' : 'Add to Cart'}
              </button>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  className="flex items-center justify-center gap-1 py-2.5 rounded-lg border border-[#E8EDF2] text-[11px] font-bold bg-white"
                >
                  <Heart size={13} /> Wishlist
                </button>
                <button
                  type="button"
                  className="flex items-center justify-center gap-1 py-2.5 rounded-lg border border-[#E8EDF2] text-[11px] font-bold bg-white"
                >
                  Compare
                </button>
                <button
                  type="button"
                  className="flex items-center justify-center gap-1 py-2.5 rounded-lg border border-[#E8EDF2] text-[11px] font-bold bg-white"
                >
                  <MessageCircleMore size={13} /> Message
                </button>
              </div>

              {model.addons.length > 0 ? (
                <div className="pt-2 border-t border-[#F1F1F3] space-y-2">
                  <div className="text-[11px] font-extrabold text-[#9AA0AC] uppercase">Optional add-ons</div>
                  {model.addons.map((a) => (
                    <label key={a.name} className="flex items-center justify-between gap-2 text-[12px]">
                      <span className="font-semibold text-[#1A1A2E]">{a.name}</span>
                      <span className="text-[#EB4501] font-bold">{a.price || '—'}</span>
                    </label>
                  ))}
                </div>
              ) : mode === 'editor' ? (
                <p className="text-[11px] text-[#9AA0AC] m-0 pt-2 border-t border-[#F1F1F3]">
                  No add-on services yet — edit to add them.
                </p>
              ) : null}

              <div className="pt-2 border-t border-[#F1F1F3] relative">
                {mode === 'editor' && onEditSection ? (
                  <button
                    type="button"
                    onClick={() => onEditSection('delivery')}
                    className="absolute top-2 right-0 text-[10px] font-extrabold text-[#EF3C23] uppercase bg-transparent border-0 cursor-pointer"
                  >
                    Edit
                  </button>
                ) : null}
                <div className="text-[11px] font-extrabold text-[#9AA0AC] uppercase mb-1">Delivery</div>
                <p className="text-[12px] text-[#4B5563] m-0">
                  {model.deliveryNote ||
                    (mode === 'editor'
                      ? 'No delivery information yet.'
                      : 'Delivery details unavailable.')}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Underline tabs — Web DcUnderlineTabs parity */}
        <div className="sticky top-[64px] z-[15] mb-6 bg-[#F0F8FF]">
          <div className="w-full flex border border-[#E8EDF2] rounded-none bg-white overflow-x-auto">
            {SECTION_NAV.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => scrollTo(item.id)}
                className={`shrink-0 px-4 sm:px-5 py-4 text-[12.5px] font-bold cursor-pointer whitespace-nowrap border-0 border-b-2 bg-transparent ${
                  activeNav === item.id
                    ? 'text-[#EB4501] border-[#EB4501]'
                    : 'text-[#6B7280] border-transparent hover:text-[#1A1A2E]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-10">
          <section id="product-specs-section" className="scroll-mt-36 relative">
            {mode === 'editor' && onEditSection ? (
              <EditChip onClick={() => onEditSection('specs')} />
            ) : null}
            <h3 className="text-[15px] font-extrabold text-[#1A1A2E] mb-3.5 m-0">Specifications</h3>
            {model.specs.length === 0 ? (
              <EmptyState
                message={
                  mode === 'editor' ? 'No specifications yet — edit to add them.' : 'No specifications listed.'
                }
              />
            ) : (
              <div className="bg-white border border-[#E8EDF2] rounded-[10px] overflow-hidden">
                {model.specs.map((s) => (
                  <div
                    key={`${s.key}-${s.value}`}
                    className="grid grid-cols-[140px_1fr] sm:grid-cols-[180px_1fr] border-b border-[#F1F1F3] last:border-0"
                  >
                    <div className="px-4 py-3 text-[11.5px] font-bold text-[#9AA0AC] bg-[#FAFBFC]">{s.key}</div>
                    <div className="px-4 py-3 text-[12.5px] font-semibold text-[#1A1A2E]">{s.value || '—'}</div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section id="influencer-reviews-section" className="scroll-mt-36">
            <h3 className="text-[15px] font-extrabold text-[#1A1A2E] mb-3.5 m-0">Creator Reviews</h3>
            {model.creatorVideos.length === 0 ? (
              <EmptyState
                message={
                  mode === 'editor'
                    ? 'No creator reviews yet. Creator content editing is not wired in this builder yet.'
                    : 'No creator reviews yet.'
                }
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {model.creatorVideos.map((c) => (
                  <div key={c.id} className="bg-white border border-[#E8EDF2] rounded-[10px] overflow-hidden">
                    <div className="aspect-video bg-[#F4F7F9]">
                      {c.thumbnail ? <img src={c.thumbnail} alt="" className="w-full h-full object-cover" /> : null}
                    </div>
                    <div className="p-3 text-left">
                      <div className="text-[10px] font-extrabold text-[#EF3C23] uppercase">{c.platform}</div>
                      <div className="text-[12px] font-bold text-[#1A1A2E] mt-0.5 line-clamp-2">{c.title}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section id="public-reviews-section" className="scroll-mt-36">
            <h3 className="text-[15px] font-extrabold text-[#1A1A2E] mb-1 m-0">What Customers Say</h3>
            <p className="text-[11.5px] text-[#9AA0AC] m-0 mb-3.5">Real reviews from verified buyers</p>
            {model.publicReviews.length === 0 ? (
              <EmptyState
                message={
                  mode === 'editor'
                    ? 'No public reviews yet. Reviews stay read-only here.'
                    : 'No customer reviews yet.'
                }
              />
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

          <section id="product-overview-section" className="scroll-mt-36 relative">
            {mode === 'editor' && onEditSection ? (
              <EditChip onClick={() => onEditSection('overview')} />
            ) : null}
            <h3 className="text-[15px] font-extrabold text-[#1A1A2E] mb-3.5 m-0">Product Overview</h3>
            {!hasOverview ? (
              <EmptyState
                message={mode === 'editor' ? 'No overview content yet — edit to add it.' : 'No overview available.'}
              />
            ) : (
              <div className="space-y-3.5">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5">
                  {overviewCols.map((col) => (
                    <div key={col.title} className="bg-white border border-[#E8EDF2] rounded-[10px] p-4 text-left">
                      <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-[#1A1A2E] mb-3">
                        {col.title}
                      </h4>
                      {col.rows.length === 0 ? (
                        <p className="text-[11px] text-[#9AA0AC] m-0">—</p>
                      ) : (
                        <ul className="m-0 pl-4 space-y-1.5">
                          {col.rows.map((row) => (
                            <li key={row} className="text-[12px] text-[#4B5563]">
                              {row}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
                {model.bestForTags.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {model.bestForTags.map((t) => (
                      <span
                        key={t}
                        className="px-2.5 py-1 rounded-full bg-[#FFF4ED] text-[10.5px] font-bold text-[#EB4501]"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </section>

          <section id="product-utility-section" className="scroll-mt-36 relative">
            {mode === 'editor' && onEditSection ? (
              <EditChip onClick={() => onEditSection('box')} />
            ) : null}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div>
                <h3 className="text-[15px] font-extrabold text-[#1A1A2E] mb-3.5 m-0">Box Contents</h3>
                {model.boxContents.length === 0 ? (
                  <EmptyState message={mode === 'editor' ? 'No box contents yet.' : 'No box contents listed.'} />
                ) : (
                  <div className="bg-white border border-[#E8EDF2] rounded-[10px] p-4">
                    <ul className="m-0 pl-4 space-y-1.5 text-left">
                      {model.boxContents.map((b) => (
                        <li key={b} className="text-[12.5px] text-[#4B5563]">
                          {b}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <div>
                <h3 className="text-[15px] font-extrabold text-[#1A1A2E] mb-3.5 m-0">Physical Specifications</h3>
                {model.additionalSpecs.length === 0 ? (
                  <EmptyState
                    message={mode === 'editor' ? 'No physical specs yet.' : 'No physical specs listed.'}
                  />
                ) : (
                  <div className="bg-white border border-[#E8EDF2] rounded-[10px] overflow-hidden">
                    {model.additionalSpecs.map((s) => (
                      <div
                        key={`${s.key}-${s.value}`}
                        className="grid grid-cols-[1fr_1fr] border-b border-[#F1F1F3] last:border-0"
                      >
                        <div className="px-4 py-3 text-[11.5px] font-bold text-[#9AA0AC]">{s.key}</div>
                        <div className="px-4 py-3 text-[12.5px] font-semibold text-[#1A1A2E]">{s.value}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>

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
              <EmptyState message={mode === 'editor' ? 'No Brand associated yet — edit header to set Brand.' : 'No Brand listed.'} />
            )}
          </section>
        </div>
      </div>

      {/* Trust statement — Web parity */}
      <section className="w-full bg-[#F4F9FF] border-t border-blue-50 py-12">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-center gap-10 text-center md:text-left">
          <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-xl">
            <ShieldCheck size={40} className="text-blue-600" />
          </div>
          <div className="space-y-2">
            <h4 className="text-xl font-extrabold text-[#1A1A2E] tracking-tight leading-none m-0">
              Choosify.bd trust statement
            </h4>
            <p className="text-[14px] font-medium text-[#9AA0AC] tracking-tight m-0">
              “Only verified sellers and unbiased brands are listed on Choosify.bd.”
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

export default ProductDetailPresentation;
