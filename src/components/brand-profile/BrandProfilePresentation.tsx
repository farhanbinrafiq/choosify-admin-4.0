import React, { useMemo, useState } from 'react';
import { ChevronDown, MapPin, Star } from 'lucide-react';
import type { BrandCMSModel } from '../../pages/admin/brandSeeds';
import {
  BrandProfileEditChip,
  BrandProfileHero,
  type BrandProfileEditSection,
  type BrandProfilePresentationMode,
} from './BrandProfileHero';

/** Matches Choosify-Web BrandDetailPage sticky nav (Compare is below fold, not in tabs). */
const SECTION_NAV = [
  { id: 'deals-section', label: 'Deals' },
  { id: 'products-section', label: 'Products' },
  { id: 'public-reviews-section', label: 'Public Review' },
  { id: 'brand-overview-section', label: 'Overview' },
  { id: 'store-location-section', label: 'Where to Buy' },
  { id: 'faq-section', label: 'FAQ' },
  { id: 'brand-story-section', label: 'Brand Story' },
] as const;

function EmptyEditorState({
  message,
  actionLabel,
  onAction,
}: {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="border border-dashed border-[#E8EDF2] rounded-[10px] bg-white px-5 py-10 text-center">
      <p className="text-[13px] font-medium text-[#9AA0AC] m-0">{message}</p>
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-3 text-[11px] font-extrabold uppercase tracking-wider text-[#FF5B00] hover:underline bg-transparent border-0 cursor-pointer"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

function SectionShell({
  id,
  title,
  subtitle,
  mode,
  editLabel,
  onEdit,
  trailing,
  children,
}: {
  id: string;
  title: string;
  subtitle?: string;
  mode: BrandProfilePresentationMode;
  editLabel?: string;
  onEdit?: () => void;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-36 w-full relative">
      {mode === 'editor' && onEdit ? (
        <BrandProfileEditChip label={editLabel || 'Edit'} onClick={onEdit} />
      ) : null}
      <div className="flex items-baseline justify-between gap-3 mb-1 text-left pr-20">
        <h3 className="text-[15px] font-extrabold text-[#1A1A2E] tracking-tight m-0">{title}</h3>
        {trailing}
      </div>
      {subtitle ? <p className="text-[11.5px] text-[#9AA0AC] m-0 mb-3.5">{subtitle}</p> : null}
      {children}
    </section>
  );
}

export function BrandProfilePresentation({
  model,
  mode = 'editor',
  onEditSection,
  compareBrands = [],
}: {
  model: BrandCMSModel;
  mode?: BrandProfilePresentationMode;
  onEditSection?: (section: BrandProfileEditSection) => void;
  compareBrands?: Array<{ id: string; name: string; category?: string; score?: number }>;
}) {
  const [activeNav, setActiveNav] = useState<string>('deals-section');
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const brandName = model.brandName || 'this brand';
  const brandNameUpper = (model.brandName || 'BRAND').toUpperCase();

  const liveProducts = useMemo(
    () => (model.products || []).filter((p) => p.status === 'Live' || mode === 'editor'),
    [model.products, mode],
  );
  const activeDeals = useMemo(
    () => (model.deals || []).filter((d) => d.status === 'Active' || mode === 'editor'),
    [model.deals, mode],
  );
  const promos = model.promoCodes || [];
  const reviews = model.reviews || [];
  const faq = model.faq || [];
  const stores = model.stores || { authorized: [], distributors: [], serviceCenters: [] };
  const hasStores =
    (stores.authorized?.length || 0) +
      (stores.distributors?.length || 0) +
      (stores.serviceCenters?.length || 0) >
    0;

  const scrollTo = (id: string) => {
    setActiveNav(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const overviewHasContent = Boolean(
    model.address ||
      model.website ||
      model.contactEmail ||
      model.phone ||
      model.priceRange ||
      model.ageRange ||
      model.audienceType ||
      (model.services || []).length ||
      (model.bestForTags || []).length ||
      model.description,
  );

  const trustStats = [
    typeof model.followersCount === 'number' && model.followersCount > 0
      ? { value: model.followersCount.toLocaleString(), label: 'Followers' }
      : null,
    reviews.length > 0 ? { value: String(reviews.length), label: 'Reviews' } : null,
    typeof model.choosifyScore === 'number' && model.choosifyScore > 0
      ? { value: `${model.choosifyScore}/5`, label: 'Brand Score' }
      : null,
    liveProducts.length > 0 ? { value: String(liveProducts.length), label: 'Products' } : null,
  ].filter(Boolean) as Array<{ value: string; label: string }>;

  return (
    <div className="bg-[#F0F8FF] text-[#1A1A2E] overflow-hidden">
      <BrandProfileHero
        model={model}
        mode={mode}
        onEdit={onEditSection}
        onExploreProducts={() => scrollTo('products-section')}
        onShare={() => {
          if (typeof navigator !== 'undefined' && navigator.clipboard) {
            const slug = model.slug || model.id;
            void navigator.clipboard.writeText(`${window.location.origin}/brands/${slug}`);
          }
        }}
      />

      {/* Choosify-Web DcUnderlineTabs parity */}
      <div className="choosify-sticky-section-nav sticky top-[64px] z-[15] w-full mb-4 bg-[#F0F8FF]">
        <div className="max-w-[1440px] mx-auto px-5 sm:px-8 lg:px-10">
          <div className="w-full flex border border-[#E8EDF2] rounded-none bg-white overflow-x-auto">
            {SECTION_NAV.map((item) => {
              const active = activeNav === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => scrollTo(item.id)}
                  className={`shrink-0 px-4 sm:px-5 py-4 text-[12.5px] font-bold cursor-pointer whitespace-nowrap border-0 border-b-2 bg-transparent transition-colors ${
                    active
                      ? 'text-[#EB4501] border-[#EB4501]'
                      : 'text-[#6B7280] border-transparent hover:text-[#1A1A2E]'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-[1440px] mx-auto px-5 sm:px-8 lg:px-10 py-8 space-y-10">
        <SectionShell
          id="deals-section"
          title={`TOP DEALS & COUPONS ON ${brandNameUpper}`}
          subtitle={`Limited-time offers on ${brandName} products`}
          mode={mode}
          editLabel="Edit"
          onEdit={onEditSection ? () => onEditSection('promos') : undefined}
        >
          {activeDeals.length === 0 && promos.length === 0 ? (
            <EmptyEditorState
              message={
                mode === 'editor'
                  ? `No deals or coupons available for ${brandName} yet.`
                  : `No deals or coupons available for ${brandName} yet.`
              }
              actionLabel={mode === 'editor' ? 'Add first deal / coupon' : undefined}
              onAction={onEditSection ? () => onEditSection('promos') : undefined}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {activeDeals.map((deal) => (
                <div key={deal.id} className="bg-white border border-[#E8EDF2] rounded-[10px] p-4">
                  <div className="text-[10px] font-extrabold text-[#FF5B00] uppercase tracking-wider mb-1">
                    {deal.status}
                  </div>
                  <div className="text-[13px] font-extrabold text-[#1A1A2E]">{deal.title}</div>
                  <div className="text-[12px] text-[#4B5563] mt-1">
                    {deal.discountType === 'Percentage'
                      ? `${deal.discountValue}% off`
                      : `৳${deal.discountValue} off`}
                  </div>
                </div>
              ))}
              {promos
                .filter((p) => p.enabled || mode === 'editor')
                .map((promo) => (
                  <div key={promo.id} className="bg-white border border-[#E8EDF2] rounded-[10px] p-4">
                    <div className="text-[10px] font-extrabold text-[#2323FF] uppercase tracking-wider mb-1">
                      Coupon
                    </div>
                    <div className="text-[15px] font-extrabold font-mono text-[#1A1A2E]">{promo.code}</div>
                    <div className="text-[12px] text-[#4B5563] mt-1">
                      {promo.discountType === 'Percentage'
                        ? `${promo.discountValue}% off`
                        : `৳${promo.discountValue} off`}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </SectionShell>

        <SectionShell
          id="products-section"
          title={`${brandNameUpper} PRODUCTS`}
          subtitle={`Explore all products from ${brandName}`}
          mode={mode}
          editLabel="Edit"
          onEdit={onEditSection ? () => onEditSection('products') : undefined}
        >
          {liveProducts.length === 0 ? (
            <EmptyEditorState
              message={
                mode === 'editor'
                  ? `No products listed for ${brandName} yet.`
                  : `No products listed for ${brandName} yet.`
              }
              actionLabel={mode === 'editor' ? 'Manage products in catalog' : undefined}
              onAction={onEditSection ? () => onEditSection('products') : undefined}
            />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
              {liveProducts.slice(0, 12).map((p) => (
                <div key={p.id} className="bg-white border border-[#E8EDF2] rounded-[10px] overflow-hidden">
                  <div className="aspect-square bg-[#F4F7F9]">
                    {p.thumbnail ? (
                      <img src={p.thumbnail} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[10px] text-[#9AA0AC]">
                        No image
                      </div>
                    )}
                  </div>
                  <div className="p-3 text-left">
                    <div className="text-[12px] font-bold text-[#1A1A2E] line-clamp-2 min-h-[2.5em]">
                      {p.name}
                    </div>
                    <div className="text-[12.5px] font-extrabold text-[#FF5B00] mt-1">
                      ৳{Number(p.price || 0).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionShell>

        <SectionShell
          id="public-reviews-section"
          title="WHAT CUSTOMERS SAY"
          subtitle="Real reviews from verified buyers"
          mode={mode}
          editLabel="Edit"
          onEdit={onEditSection ? () => onEditSection('reviews') : undefined}
        >
          {reviews.length === 0 ? (
            <EmptyEditorState
              message={
                mode === 'editor'
                  ? `No customer reviews yet for ${brandName}`
                  : `No customer reviews yet for ${brandName}`
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
              {reviews.slice(0, 6).map((r) => (
                <div key={r.id} className="bg-white border border-[#E8EDF2] rounded-[10px] p-4">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="text-[12.5px] font-extrabold text-[#1A1A2E]">{r.author}</div>
                    <div className="flex items-center gap-0.5 text-[#F59E0B] text-[11px] font-bold">
                      <Star size={12} className="fill-current" /> {r.rating}
                    </div>
                  </div>
                  <p className="text-[12px] text-[#4B5563] leading-relaxed m-0">{r.text}</p>
                  <div className="text-[10px] text-[#9AA0AC] mt-2">
                    {r.date}
                    {r.verified ? ' · Verified purchase' : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionShell>

        <SectionShell
          id="brand-overview-section"
          title="BRAND OVERVIEW"
          subtitle={`About ${brandName}`}
          mode={mode}
          onEdit={onEditSection ? () => onEditSection('overview') : undefined}
        >
          {!overviewHasContent ? (
            <EmptyEditorState
              message={mode === 'editor' ? 'No overview details yet.' : 'No overview available.'}
              actionLabel={mode === 'editor' ? 'Add overview details' : undefined}
              onAction={onEditSection ? () => onEditSection('overview') : undefined}
            />
          ) : (
            <div className="space-y-3.5">
              {model.description ? (
                <div className="bg-white border border-[#E8EDF2] rounded-[10px] p-[18px] text-[12.5px] text-[#4B5563] leading-relaxed text-left">
                  {model.description}
                </div>
              ) : null}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                <div className="bg-white rounded-[10px] p-[18px] border border-[#E8EDF2] text-left">
                  <h4 className="text-[11px] font-extrabold text-[#1A1A2E] uppercase tracking-wider mb-3">
                    Shop Address & Links
                  </h4>
                  <p className="text-[11.5px] text-[#6B7280] font-semibold m-0 mb-2">
                    {model.address || '—'}
                  </p>
                  {model.website ? (
                    <a
                      href={model.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-bold text-[#EB4501] hover:underline"
                    >
                      {model.website}
                    </a>
                  ) : null}
                </div>
                <div className="bg-white rounded-[10px] p-[18px] border border-[#E8EDF2] text-left">
                  <h4 className="text-[11px] font-extrabold text-[#1A1A2E] uppercase tracking-wider mb-3">
                    Contact
                  </h4>
                  <p className="text-[11.5px] text-[#6B7280] font-semibold m-0 mb-2">
                    Email: {model.contactEmail || '—'}
                  </p>
                  <p className="text-[11.5px] text-[#6B7280] font-semibold m-0">
                    Phone: {model.phone || '—'}
                  </p>
                </div>
                <div className="bg-white rounded-[10px] p-[18px] border border-[#E8EDF2] text-left">
                  <h4 className="text-[11px] font-extrabold text-[#1A1A2E] uppercase tracking-wider mb-3">
                    Price & Audience
                  </h4>
                  <p className="text-[11.5px] text-[#6B7280] font-semibold m-0 mb-1">
                    {model.priceRange || '—'}
                  </p>
                  <p className="text-[11.5px] text-[#6B7280] font-semibold m-0 mb-1">
                    {model.ageRange || '—'}
                  </p>
                  <p className="text-[11.5px] text-[#EB4501] font-extrabold m-0 uppercase">
                    {model.audienceType || '—'}
                  </p>
                </div>
              </div>
              {(model.services || []).length > 0 || (model.bestForTags || []).length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {(model.services || []).map((s) => (
                    <span
                      key={s}
                      className="px-2.5 py-1 rounded-full bg-white border border-[#E8EDF2] text-[10.5px] font-bold text-[#1A1A2E]"
                    >
                      {s}
                    </span>
                  ))}
                  {(model.bestForTags || []).map((t) => (
                    <span
                      key={t}
                      className="px-2.5 py-1 rounded-full bg-[#FFF4ED] text-[10.5px] font-bold text-[#FF5B00]"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </SectionShell>

        <SectionShell
          id="store-location-section"
          title={`WHERE TO BUY ${brandNameUpper}`}
          mode={mode}
          onEdit={onEditSection ? () => onEditSection('stores') : undefined}
        >
          {!hasStores ? (
            <EmptyEditorState
              message={mode === 'editor' ? 'No stores added' : 'No store locations listed.'}
              actionLabel={mode === 'editor' ? 'Add first store location' : undefined}
              onAction={onEditSection ? () => onEditSection('stores') : undefined}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {[
                { title: 'AUTHORIZED STORES', rows: stores.authorized || [] },
                { title: 'DISTRIBUTORS & RESELLERS', rows: stores.distributors || [] },
                { title: 'SERVICE CENTERS', rows: stores.serviceCenters || [] },
              ].map((col) => (
                <div key={col.title} className="bg-white border border-[#E8EDF2] rounded-[10px] overflow-hidden">
                  <div className="text-[11px] font-extrabold text-white choosify-dark-surface px-2.5 py-1.5">
                    {col.title}
                  </div>
                  <div className="p-[18px] pt-3 text-left">
                    {col.rows.length === 0 ? (
                      <p className="text-[11px] text-[#9AA0AC] m-0">None listed</p>
                    ) : (
                      col.rows.map((row) => (
                        <div
                          key={row.id}
                          className="flex justify-between items-start py-2 border-b border-[#F1F1F3] gap-2.5 last:border-0"
                        >
                          <div className="min-w-0">
                            <div className="text-[11.5px] font-bold text-[#1A1A2E]">{row.name}</div>
                            <div className="text-[10px] text-[#9AA0AC] flex items-center gap-1">
                              <MapPin size={10} /> {row.sub || '—'}
                            </div>
                            {'hours' in row && (row as { hours?: string }).hours ? (
                              <div className="text-[10px] text-[#9AA0AC]">
                                {(row as { hours?: string }).hours}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionShell>

        <SectionShell
          id="faq-section"
          title="FREQUENTLY ASKED QUESTIONS"
          mode={mode}
          onEdit={onEditSection ? () => onEditSection('faq') : undefined}
        >
          {faq.length === 0 ? (
            <EmptyEditorState
              message={mode === 'editor' ? 'Add your first FAQ' : 'No FAQs available.'}
              actionLabel={mode === 'editor' ? 'Add first FAQ' : undefined}
              onAction={onEditSection ? () => onEditSection('faq') : undefined}
            />
          ) : (
            <div className="bg-white border border-[#E8EDF2] rounded-[10px] px-[22px] py-1.5">
              {faq.map((fq, i) => {
                const open = openFaq === i;
                return (
                  <div key={fq.id} className="border-b border-[#F1F1F3] last:border-0">
                    <button
                      type="button"
                      onClick={() => setOpenFaq(open ? null : i)}
                      className="w-full flex justify-between items-center gap-3 py-3.5 bg-transparent border-0 cursor-pointer text-left px-0"
                    >
                      <span className="text-[12.5px] font-semibold text-[#1A1A2E]">{fq.q}</span>
                      <ChevronDown
                        size={14}
                        className={`text-[#9AA0AC] shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
                      />
                    </button>
                    {open ? (
                      <p className="text-[12px] text-[#4B5563] leading-relaxed pb-3.5 m-0 pr-6">{fq.a}</p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </SectionShell>

        <SectionShell
          id="brand-story-section"
          title="BRAND STORY"
          mode={mode}
          editLabel="Edit"
          onEdit={onEditSection ? () => onEditSection('story') : undefined}
        >
          {!model.brandStory && !model.missionStatement && !model.values ? (
            <EmptyEditorState
              message={mode === 'editor' ? 'No Brand Stories yet' : 'No brand story available.'}
              actionLabel={mode === 'editor' ? 'Add Brand Story' : undefined}
              onAction={onEditSection ? () => onEditSection('story') : undefined}
            />
          ) : (
            <div className="bg-white border border-[#E8EDF2] rounded-[10px] p-[18px] space-y-3 text-left">
              {model.missionStatement ? (
                <div>
                  <div className="text-[10px] font-extrabold text-[#9AA0AC] uppercase tracking-wider mb-1">
                    Mission
                  </div>
                  <p className="text-[12.5px] text-[#4B5563] m-0 leading-relaxed">{model.missionStatement}</p>
                </div>
              ) : null}
              {model.brandStory ? (
                <div>
                  <div className="text-[10px] font-extrabold text-[#9AA0AC] uppercase tracking-wider mb-1">
                    Story
                  </div>
                  <p className="text-[12.5px] text-[#4B5563] m-0 leading-relaxed whitespace-pre-wrap">
                    {model.brandStory}
                  </p>
                </div>
              ) : null}
              {model.values ? (
                <div>
                  <div className="text-[10px] font-extrabold text-[#9AA0AC] uppercase tracking-wider mb-1">
                    Values
                  </div>
                  <p className="text-[12.5px] text-[#4B5563] m-0 leading-relaxed">{model.values}</p>
                </div>
              ) : null}
            </div>
          )}
        </SectionShell>

        <section id="compare-section" className="scroll-mt-36 w-full">
          <h3 className="text-[15px] font-extrabold text-[#1A1A2E] mb-3.5">
            COMPARE {brandNameUpper} WITH OTHER BRANDS
          </h3>
          {compareBrands.length === 0 ? (
            <EmptyEditorState message="No comparable brands available from catalog yet." />
          ) : (
            <div className="bg-white border border-[#E8EDF2] rounded-[10px] overflow-hidden">
              <div className="grid grid-cols-[1.2fr_repeat(auto-fit,minmax(100px,1fr))] gap-0 text-[11px] text-left">
                <div className="p-3 font-extrabold text-[#9AA0AC] border-b border-[#F1F1F3]">Brand</div>
                {compareBrands.slice(0, 4).map((b) => (
                  <div
                    key={b.id}
                    className="p-3 font-extrabold text-[#1A1A2E] border-b border-l border-[#F1F1F3]"
                  >
                    {b.name}
                  </div>
                ))}
                <div className="p-3 font-semibold text-[#6B7280]">Category</div>
                {compareBrands.slice(0, 4).map((b) => (
                  <div key={`${b.id}-cat`} className="p-3 border-l border-[#F1F1F3] text-[#1A1A2E]">
                    {b.category || '—'}
                  </div>
                ))}
                <div className="p-3 font-semibold text-[#6B7280] border-t border-[#F1F1F3]">Score</div>
                {compareBrands.slice(0, 4).map((b) => (
                  <div
                    key={`${b.id}-score`}
                    className="p-3 border-t border-l border-[#F1F1F3] font-extrabold text-[#1A1A2E]"
                  >
                    {typeof b.score === 'number' && b.score > 0 ? b.score.toFixed(1) : '—'}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Trust strip — Choosify-Web structure; stats only when real */}
        <div className="w-full choosify-dark-surface rounded-xl px-7 py-5 text-center text-white">
          <div className="text-[13px] font-extrabold mb-1">CHOSEN BY MILLIONS. TRUSTED WORLDWIDE.</div>
          <div className="text-[11.5px] text-white/50 mb-5">
            100% authentic products, official warranty & dedicated support from {brandName}.
          </div>
          {trustStats.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {trustStats.map((ts) => (
                <div key={ts.label}>
                  <div className="text-[20px] font-extrabold text-[#EB4501]">{ts.value}</div>
                  <div className="text-[10.5px] text-white/50">{ts.label}</div>
                </div>
              ))}
            </div>
          ) : mode === 'editor' ? (
            <p className="text-[11px] text-white/40 m-0">
              Trust metrics appear here once followers, reviews, and scores exist for this Brand.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default BrandProfilePresentation;
