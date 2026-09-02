import React, { useMemo, useState } from 'react';
import { ChevronDown, ExternalLink, MapPin, Star } from 'lucide-react';
import type { BrandCMSModel } from '../../pages/admin/brandSeeds';
import { resolveStoryMedia, type BrandEditSection } from '../../pages/admin/brandEditorModel';

/** CSS aspect-ratio for a resolved story-media aspect (inline style — purge-proof). */
const STORY_ASPECT_RATIO: Record<'landscape' | 'portrait' | 'square', string> = {
  landscape: '16 / 9',
  portrait: '9 / 16',
  square: '1 / 1',
};
import {
  BrandInlineEditFrame,
  BrandProfileEditChip,
  BrandProfileHero,
  BrandStudioEditPill,
  type BrandProfileEditSection,
  type BrandProfilePresentationMode,
  type BrandStudioBridge,
} from './BrandProfileHero';

const SECTION_TITLES: Record<BrandEditSection, string> = {
  identity: 'Brand Identity',
  cover: 'Cover Image',
  logo: 'Brand Logo',
  deals: 'Pinned Spotlight Products',
  products: 'Pinned Products',
  brandAbout: 'About This Brand',
  brandAddress: 'Shop Address & Links',
  brandContact: 'Contact Information',
  brandAudience: 'Price & Audience',
  brandServices: 'Services & Specialties',
  brandTags: 'Best For Tags',
  credentials: 'Guarantees & Credentials',
  stores: 'Where to Buy',
  faq: 'FAQ',
  story: 'Brand Story',
};

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
          className="mt-3 text-[11px] font-extrabold uppercase tracking-wider text-[#EF3C23] hover:underline bg-transparent border-0 cursor-pointer"
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
  sectionKey,
  studio,
  trailing,
  children,
}: {
  id: string;
  title: string;
  subtitle?: string;
  mode: BrandProfilePresentationMode;
  editLabel?: string;
  onEdit?: () => void;
  /** Canonical section key — enables inline studio editing for this region. */
  sectionKey?: BrandEditSection;
  studio?: BrandStudioBridge;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  const isStudio = mode === 'studio' && !!studio;
  const editingThis = isStudio && sectionKey != null && studio!.editingSection === sectionKey;

  if (editingThis) {
    return (
      <section id={id} className="scroll-mt-36 w-full">
        <BrandInlineEditFrame k={sectionKey!} title={SECTION_TITLES[sectionKey!]} studio={studio!}>
          {studio!.renderEditor(sectionKey!)}
        </BrandInlineEditFrame>
      </section>
    );
  }

  return (
    <section id={id} className="scroll-mt-36 w-full relative">
      {isStudio && sectionKey != null ? (
        <BrandStudioEditPill onClick={() => studio!.onEdit(sectionKey!)} />
      ) : mode === 'editor' && onEdit ? (
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

/** Preview-only section — relational / system content managed on a dedicated surface. */
function PreviewOnlyLink({ href, label }: { href?: string; label: string }) {
  if (!href) return null;
  return (
    <a
      href={href}
      className="inline-flex items-center gap-1 mt-3 text-[11px] font-extrabold uppercase tracking-wider text-[#EF3C23] hover:underline"
    >
      {label} <ExternalLink size={12} />
    </a>
  );
}

export function BrandProfilePresentation({
  model,
  mode = 'editor',
  onEditSection,
  studio,
  compareBrands = [],
  manageLinks = {},
  storyContentById = {},
}: {
  model: BrandCMSModel;
  mode?: BrandProfilePresentationMode;
  onEditSection?: (section: BrandProfileEditSection) => void;
  /** Inline section-editing bridge (mode="studio"). */
  studio?: BrandStudioBridge;
  compareBrands?: Array<{ id: string; name: string; category?: string; score?: number }>;
  /** Canonical management surfaces for the preview-only sections. */
  manageLinks?: { products?: string; deals?: string; creators?: string; verification?: string };
  /** Resolved metadata for Brand Story `content`-kind sections + pinned stories, keyed by guide id. */
  storyContentById?: Record<
    string,
    {
      title: string;
      image?: string;
      kind: string;
      href?: string;
      aspect?: 'landscape' | 'portrait' | 'square';
    }
  >;
}) {
  const [activeNav, setActiveNav] = useState<string>('deals-section');
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const isStudio = mode === 'studio' && !!studio;

  const brandName = model.brandName || 'this brand';
  const brandNameUpper = (model.brandName || 'BRAND').toUpperCase();

  const liveProducts = useMemo(
    () => (model.products || []).filter((p) => p.status === 'Live' || mode !== 'public'),
    [model.products, mode],
  );
  // The brand page's Products section shows ONLY the seller's pinned selection —
  // the full catalog lives in the dedicated Products & Inventory console.
  const showcaseProducts = useMemo(() => {
    const byId = new Map((model.products || []).map((p) => [p.id, p]));
    return (model.pinnedShowcaseProductIds || [])
      .map((pid) => byId.get(pid))
      .filter((p): p is NonNullable<typeof p> => !!p && (p.status === 'Live' || mode !== 'public'));
  }, [model.products, model.pinnedShowcaseProductIds, mode]);
  const activeDeals = useMemo(
    () => (model.deals || []).filter((d) => d.status === 'Active' || mode !== 'public'),
    [model.deals, mode],
  );
  const promos = model.promoCodes || [];
  const pinnedProducts = useMemo(() => {
    const byId = new Map((model.products || []).map((p) => [p.id, p]));
    return (model.pinnedProductIds || [])
      .map((pid) => byId.get(pid))
      .filter((p): p is NonNullable<typeof p> => !!p && (p.status === 'Live' || mode !== 'public'));
  }, [model.products, model.pinnedProductIds, mode]);
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
        studio={studio}
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
                      ? 'text-[#FF5B00] border-[#FF5B00]'
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
          sectionKey="deals"
          studio={studio}
          onEdit={onEditSection ? () => onEditSection('promos') : undefined}
          trailing={
            isStudio ? (
              <PreviewOnlyLink href={manageLinks.deals} label="Manage deals in Ads & Deals Studio" />
            ) : undefined
          }
        >
          {activeDeals.length === 0 && promos.length === 0 && pinnedProducts.length === 0 ? (
            <EmptyEditorState
              message={`No deals or coupons available for ${brandName} yet.`}
              actionLabel={!isStudio && mode === 'editor' ? 'Add first deal / coupon' : undefined}
              onAction={onEditSection ? () => onEditSection('promos') : undefined}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {pinnedProducts.map((p, i) => (
                <div key={`pin-${p.id}`} className="bg-white border border-[#EF3C23]/30 rounded-[10px] overflow-hidden">
                  <div className="flex items-center gap-1 text-[9px] font-extrabold text-[#EF3C23] uppercase tracking-wider px-3 pt-2.5">
                    ★ Pinned #{i + 1}
                  </div>
                  <div className="flex gap-3 p-3">
                    <div className="w-14 h-14 shrink-0 rounded-md bg-[#F4F7F9] overflow-hidden">
                      {p.thumbnail ? <img src={p.thumbnail} alt="" className="w-full h-full object-cover" /> : null}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[12px] font-bold text-[#1A1A2E] line-clamp-2">{p.name}</div>
                      <div className="text-[12.5px] font-extrabold text-[#EF3C23] mt-1">
                        ৳{Number(p.price || 0).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {activeDeals.map((deal) => (
                <div key={deal.id} className="bg-white border border-[#E8EDF2] rounded-[10px] p-4">
                  <div className="text-[10px] font-extrabold text-[#EF3C23] uppercase tracking-wider mb-1">
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
          subtitle={`Products ${brandName} has pinned to feature here`}
          mode={mode}
          editLabel="Edit"
          sectionKey="products"
          studio={studio}
          onEdit={onEditSection ? () => onEditSection('products') : undefined}
          trailing={
            isStudio ? (
              <PreviewOnlyLink href={manageLinks.products} label="All products in Products & Inventory" />
            ) : undefined
          }
        >
          {showcaseProducts.length === 0 ? (
            <EmptyEditorState
              message={
                mode === 'public'
                  ? `${brandName} hasn't featured any products here yet.`
                  : 'No products pinned yet — pin products to feature them here.'
              }
              actionLabel={isStudio ? 'Pin products' : undefined}
              onAction={isStudio && studio ? () => studio.onEdit('products') : undefined}
            />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
              {showcaseProducts.map((p, i) => (
                <div key={p.id} className="bg-white border border-[#EF3C23]/40 rounded-[10px] overflow-hidden">
                  <div className="relative aspect-square bg-[#F4F7F9]">
                    <span className="absolute left-1.5 top-1.5 z-10 rounded bg-[#EF3C23] px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wide text-white">
                      ★ Pinned #{i + 1}
                    </span>
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
                    <div className="text-[12.5px] font-extrabold text-[#EF3C23] mt-1">
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
          mode={isStudio ? 'public' : mode}
          editLabel="Edit"
          onEdit={onEditSection ? () => onEditSection('reviews') : undefined}
        >
          {reviews.length === 0 ? (
            <EmptyEditorState message={`No customer reviews yet for ${brandName}`} />
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

        <section id="brand-overview-section" className="scroll-mt-36 w-full space-y-3.5">
          <div className="text-left">
            <h3 className="text-[15px] font-extrabold text-[#1A1A2E] tracking-tight m-0">BRAND OVERVIEW</h3>
            <p className="text-[11.5px] text-[#9AA0AC] m-0">About {brandName}</p>
          </div>

          <SectionShell id="brand-about-box" title="ABOUT THIS BRAND" mode={mode} sectionKey="brandAbout" studio={studio}>
            {model.description && model.description.trim() ? (
              <div className="bg-white border border-[#E8EDF2] rounded-[10px] p-[18px] text-[12.5px] text-[#4B5563] leading-relaxed text-left whitespace-pre-wrap">
                {model.description}
              </div>
            ) : (
              <EmptyEditorState message={mode === 'public' ? 'No description available.' : 'No description yet.'} />
            )}
          </SectionShell>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 items-start">
            <SectionShell id="brand-address-box" title="SHOP ADDRESS & LINKS" mode={mode} sectionKey="brandAddress" studio={studio}>
              <div className="bg-white rounded-[10px] p-[18px] border border-[#E8EDF2] text-left">
                <p className="text-[11.5px] text-[#6B7280] font-semibold m-0 mb-2">{model.address || '—'}</p>
                {model.website ? (
                  <a href={model.website} target="_blank" rel="noopener noreferrer" className="block text-[11px] font-bold text-[#FF5B00] hover:underline">
                    {model.website}
                  </a>
                ) : null}
                {model.mapLink ? (
                  <a href={model.mapLink} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-[11px] font-extrabold uppercase tracking-wider text-[#EF3C23] hover:underline">
                    Open on Maps →
                  </a>
                ) : null}
              </div>
            </SectionShell>

            <SectionShell id="brand-contact-box" title="CONTACT INFORMATION" mode={mode} sectionKey="brandContact" studio={studio}>
              <div className="bg-white rounded-[10px] p-[18px] border border-[#E8EDF2] text-left">
                <p className="text-[11.5px] text-[#6B7280] font-semibold m-0 mb-2">Email: {model.contactEmail || '—'}</p>
                <p className="text-[11.5px] text-[#6B7280] font-semibold m-0">Phone: {model.phone || '—'}</p>
              </div>
            </SectionShell>

            <SectionShell id="brand-audience-box" title="PRICE & AUDIENCE" mode={mode} sectionKey="brandAudience" studio={studio}>
              <div className="bg-white rounded-[10px] p-[18px] border border-[#E8EDF2] text-left">
                <p className="text-[11.5px] text-[#6B7280] font-semibold m-0 mb-1">{model.priceRange || '—'}</p>
                <p className="text-[11.5px] text-[#6B7280] font-semibold m-0 mb-1">{model.ageRange || '—'}</p>
                <p className="text-[11.5px] text-[#FF5B00] font-extrabold m-0 uppercase">{model.audienceType || '—'}</p>
              </div>
            </SectionShell>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 items-start">
            <SectionShell id="brand-services-box" title="SERVICES & SPECIALTIES" mode={mode} sectionKey="brandServices" studio={studio}>
              {(model.services || []).length ? (
                <ul className="bg-white border border-[#E8EDF2] rounded-[10px] p-[18px] m-0 pl-5 text-left space-y-1 text-[12px] text-[#4B5563]">
                  {(model.services || []).map((s) => <li key={s}>{s}</li>)}
                </ul>
              ) : (
                <EmptyEditorState message={mode === 'public' ? 'None listed.' : 'No services listed yet.'} />
              )}
            </SectionShell>

            <SectionShell id="brand-tags-box" title="BEST FOR #TAGS" mode={mode} sectionKey="brandTags" studio={studio}>
              {(model.bestForTags || []).length ? (
                <div className="bg-white border border-[#E8EDF2] rounded-[10px] p-[18px] flex flex-wrap gap-2 text-left">
                  {(model.bestForTags || []).map((t) => (
                    <span key={t} className="px-2.5 py-1 rounded-full bg-[#F3E8FF] text-[10.5px] font-bold text-[#8A00C4]">
                      #{t.replace(/^#+/, '')}
                    </span>
                  ))}
                </div>
              ) : (
                <EmptyEditorState message={mode === 'public' ? 'None listed.' : 'No tags yet.'} />
              )}
            </SectionShell>
          </div>
        </section>

        <SectionShell
          id="brand-credentials-section"
          title="GUARANTEES & CREDENTIALS"
          mode={mode}
          sectionKey="credentials"
          studio={studio}
        >
          {model.credentials && model.credentials.trim() ? (
            <div className="bg-white border border-[#E8EDF2] rounded-[10px] p-[18px] text-[12.5px] text-[#4B5563] leading-relaxed text-left whitespace-pre-wrap">
              {model.credentials}
            </div>
          ) : (
            <EmptyEditorState
              message={mode === 'public' ? 'No guarantees listed.' : 'No guarantees or credentials yet.'}
            />
          )}
        </SectionShell>

        <SectionShell
          id="store-location-section"
          title={`WHERE TO BUY ${brandNameUpper}`}
          mode={mode}
          sectionKey="stores"
          studio={studio}
          onEdit={onEditSection ? () => onEditSection('stores') : undefined}
        >
          {!hasStores ? (
            <EmptyEditorState
              message={mode === 'public' ? 'No store locations listed.' : 'No stores added'}
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
                  <div
                    className="text-[11px] font-extrabold px-2.5 py-1.5"
                    style={{ backgroundColor: '#1A1A2E', color: '#FFFFFF' }}
                  >
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
          sectionKey="faq"
          studio={studio}
          onEdit={onEditSection ? () => onEditSection('faq') : undefined}
        >
          {faq.length === 0 ? (
            <EmptyEditorState
              message={mode === 'public' ? 'No FAQs available.' : 'Add your first FAQ'}
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
          sectionKey="story"
          studio={studio}
          onEdit={onEditSection ? () => onEditSection('story') : undefined}
        >
          {(() => {
            const allBlocks = (model.storyBlocks || []).filter((b) => {
              const k = b.kind || 'text';
              return (
                (k === 'text' && ((b.heading || '').trim() || (b.body || '').trim())) ||
                (k === 'link' && (b.url || '').trim()) ||
                (k === 'content' && (b.contentId || '').trim())
              );
            });
            const textBlocks = allBlocks.filter((b) => (b.kind || 'text') === 'text');
            const cardBlocks = allBlocks.filter((b) => b.kind === 'link' || b.kind === 'content');
            const legacyOnly = !allBlocks.length && !!(model.brandStory || '').trim();

            // Seller-pinned published stories (guide ids) not already shown as a
            // `content` story section.
            const cardContentIds = new Set(
              cardBlocks
                .filter((b) => b.kind === 'content')
                .map((b) => (b.contentId || '').trim()),
            );
            const pinnedStoryIds = (model.pinnedStoryContentIds || [])
              .map((id) => String(id || '').trim())
              .filter((id) => id && !cardContentIds.has(id));

            type StoryCard = {
              key: string;
              title: string;
              image?: string;
              kindLabel: string;
              caption?: string;
              href?: string;
              ratio: string;
            };
            const blockCards: StoryCard[] = cardBlocks.map((b) => {
              const resolved =
                b.kind === 'content' ? storyContentById[(b.contentId || '').trim()] : undefined;
              const aspect =
                b.kind === 'link'
                  ? resolveStoryMedia({ url: b.url, mediaKind: b.mediaKind }).aspect
                  : b.mediaKind
                    ? resolveStoryMedia({ mediaKind: b.mediaKind }).aspect
                    : resolved?.aspect || 'landscape';
              return {
                key: b.id,
                title: (b.heading || '').trim() || resolved?.title || 'View',
                image: b.kind === 'link' ? b.thumbnail : resolved?.image,
                kindLabel: b.kind === 'link' ? 'Link' : resolved?.kind || 'Content',
                caption: b.kind === 'link' ? b.body : '',
                href: b.kind === 'link' ? b.url : resolved?.href,
                ratio: STORY_ASPECT_RATIO[aspect],
              };
            });
            const pinnedCards: StoryCard[] = pinnedStoryIds
              .map((id): StoryCard | null => {
                const r = storyContentById[id];
                if (!r) return null;
                return {
                  key: `pin-${id}`,
                  title: r.title || 'View',
                  image: r.image,
                  kindLabel: r.kind || 'Content',
                  href: r.href,
                  ratio: STORY_ASPECT_RATIO[r.aspect || 'landscape'],
                };
              })
              .filter((c): c is StoryCard => !!c);
            const storyCards = [...pinnedCards, ...blockCards];

            if (
              !allBlocks.length &&
              !legacyOnly &&
              !model.storyVideoUrl &&
              !storyCards.length
            ) {
              return (
                <EmptyEditorState
                  message={mode === 'public' ? 'No brand story available.' : 'No Brand Story yet'}
                  actionLabel={mode === 'editor' ? 'Add Brand Story' : undefined}
                  onAction={onEditSection ? () => onEditSection('story') : undefined}
                />
              );
            }
            return (
              <div className="space-y-3.5">
                {model.storyVideoUrl || textBlocks.length || legacyOnly ? (
                  <div className="bg-white border border-[#E8EDF2] rounded-[10px] p-[18px] space-y-4 text-left">
                    {model.storyVideoUrl ? (
                      <div>
                        <div className="text-[10px] font-extrabold text-[#9AA0AC] uppercase tracking-wider mb-1">
                          Story Video
                        </div>
                        <a
                          href={model.storyVideoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11.5px] font-bold text-[#FF5B00] hover:underline break-all"
                        >
                          {model.storyVideoUrl}
                        </a>
                      </div>
                    ) : null}
                    {legacyOnly ? (
                      <p className="text-[12.5px] text-[#4B5563] m-0 leading-relaxed whitespace-pre-wrap">
                        {model.brandStory}
                      </p>
                    ) : (
                      textBlocks.map((b) => (
                        <div key={b.id}>
                          {b.heading ? (
                            <div className="text-[10px] font-extrabold text-[#9AA0AC] uppercase tracking-wider mb-1">
                              {b.heading}
                            </div>
                          ) : null}
                          <p className="text-[12.5px] text-[#4B5563] m-0 leading-relaxed whitespace-pre-wrap">
                            {b.body}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                ) : null}
                {storyCards.length ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    {storyCards.map((c) => (
                      <a
                        key={c.key}
                        href={mode === 'public' && c.href ? c.href : undefined}
                        target={mode === 'public' && c.href ? '_blank' : undefined}
                        rel="noopener noreferrer"
                        className="block bg-white border border-[#E8EDF2] rounded-[10px] overflow-hidden"
                      >
                        <div
                          className="bg-[#F4F7F9] w-full"
                          style={{
                            aspectRatio: c.ratio,
                            ...(c.ratio === '9 / 16'
                              ? { maxWidth: 220, marginLeft: 'auto', marginRight: 'auto' }
                              : {}),
                          }}
                        >
                          {c.image ? (
                            <img src={c.image} alt="" className="w-full h-full object-cover" />
                          ) : null}
                        </div>
                        <div className="p-3 text-left">
                          <div className="text-[9px] font-extrabold text-[#8A00C4] uppercase tracking-wider">
                            {c.kindLabel}
                          </div>
                          <div className="text-[12px] font-bold text-[#1A1A2E] mt-0.5 line-clamp-2">
                            {c.title}
                          </div>
                          {c.caption ? (
                            <div className="text-[10.5px] text-[#9AA0AC] mt-0.5 line-clamp-1">
                              {c.caption}
                            </div>
                          ) : null}
                        </div>
                      </a>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })()}
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
                  <div className="text-[20px] font-extrabold text-[#FF5B00]">{ts.value}</div>
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
