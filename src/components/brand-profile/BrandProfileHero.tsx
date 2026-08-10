import React from 'react';
import { Check, Globe, Share2, ShieldCheck, Pencil } from 'lucide-react';
import type { BrandCMSModel } from '../../pages/admin/brandSeeds';

export type BrandProfileEditSection =
  | 'header'
  | 'creators'
  | 'promos'
  | 'overview'
  | 'stores'
  | 'faq'
  | 'products'
  | 'reviews'
  | 'story';

export type BrandProfilePresentationMode = 'public' | 'editor';

function formatCount(value: string | number | undefined | null): string | null {
  if (value === undefined || value === null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(String(value).replace(/,/g, ''));
  if (!Number.isFinite(n) || n <= 0) {
    const raw = String(value).trim();
    return raw.length > 0 && raw !== '0' ? raw : null;
  }
  return n.toLocaleString();
}

function scoreRowsFromModel(model: BrandCMSModel) {
  const rows = [
    { label: 'Quality', value: model.qualityScore },
    { label: 'Service', value: model.serviceScore },
    { label: 'Delivery', value: model.deliveryScore },
    { label: 'Packaging', value: model.packagingScore },
    { label: 'Recommend', value: model.recommendationScore },
  ].filter((r) => typeof r.value === 'number' && r.value > 0);

  return rows.map((r) => ({
    label: r.label,
    value: r.value.toFixed(1),
    pct: `${Math.min(100, Math.round((r.value / 5) * 100))}%`,
  }));
}

export function BrandProfileEditChip({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute top-3 right-3 z-20 p-2 bg-white border border-[#EF3C23] text-[#EF3C23] hover:bg-[#EF3C23] hover:text-white rounded-lg transition-all shadow-sm flex items-center gap-1.5 text-[10px] font-extrabold uppercase"
    >
      <Pencil className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}

export function BrandProfileHero({
  model,
  mode,
  onEdit,
  onExploreProducts,
  onShare,
}: {
  model: BrandCMSModel;
  mode: BrandProfilePresentationMode;
  onEdit?: (section: BrandProfileEditSection) => void;
  onExploreProducts?: () => void;
  onShare?: () => void;
}) {
  const claimStatus =
    model.verificationStatus === 'Verified'
      ? 'verified'
      : model.verificationStatus === 'Suspended'
        ? 'pending'
        : 'community';

  const score =
    typeof model.choosifyScore === 'number' && model.choosifyScore > 0
      ? model.choosifyScore
      : null;
  const reviewCount = model.reviews?.length ?? 0;
  const scoreRows = scoreRowsFromModel(model);

  const followers = formatCount(model.followersCount);
  const productCount = model.products?.filter((p) => p.status === 'Live').length ?? 0;
  const dealCount = model.deals?.filter((d) => d.status === 'Active').length ?? 0;
  const creatorCount = model.creators?.filter((c) => c.status === 'Approved').length ?? 0;

  const facts = [
    productCount > 0 ? { label: 'Products', value: String(productCount) } : null,
    followers ? { label: 'Followers', value: followers } : null,
    dealCount > 0 ? { label: 'Deals', value: String(dealCount) } : null,
    creatorCount > 0 ? { label: 'Creators', value: String(creatorCount) } : null,
    model.category ? { label: 'Category', value: model.category } : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  const infoBar = [
    followers ? { icon: '♥', value: followers, label: 'FOLLOWERS' } : null,
    dealCount > 0 ? { icon: '🤝', value: String(dealCount), label: 'ACTIVE DEALS' } : null,
    productCount > 0 ? { icon: '🏷', value: String(productCount), label: 'LIVE PRODUCTS' } : null,
    reviewCount > 0 ? { icon: '★', value: String(reviewCount), label: 'REVIEWS' } : null,
  ].filter(Boolean) as Array<{ icon: string; value: string; label: string }>;

  const handle =
    model.slug
      ? `@${model.slug}`
      : `@${String(model.brandName || 'brand').toLowerCase().replace(/\s+/g, '')}`;

  const cover = model.coverImage || '';
  const logo = model.logo || model.logoUrl || '';
  const initials =
    (model.brandName || 'B')
      .split(/\s+/)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'B';

  const socials = [
    model.socialFbUrl ? { label: 'Facebook', href: model.socialFbUrl } : null,
    model.socialInstaUrl ? { label: 'Instagram', href: model.socialInstaUrl } : null,
    model.socialTiktokUrl ? { label: 'TikTok', href: model.socialTiktokUrl } : null,
    model.socialYtUrl ? { label: 'YouTube', href: model.socialYtUrl } : null,
    model.website ? { label: 'Website', href: model.website } : null,
  ].filter(Boolean) as Array<{ label: string; href: string }>;

  return (
    <div className="bg-[#F0F8FF] relative">
      {mode === 'editor' && onEdit ? (
        <BrandProfileEditChip label="Edit" onClick={() => onEdit('header')} />
      ) : null}

      {/* Cover — Choosify-Web BrandDetailHero feed silhouette */}
      <div className="w-full px-5 sm:px-8 lg:px-10 pt-4">
        <div className="max-w-[1440px] mx-auto relative">
          <div className="relative h-[220px] sm:h-[280px] md:h-[320px] overflow-hidden choosify-dark-surface rounded-none">
            {cover ? (
              <img src={cover} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[11px] text-white/50 font-semibold">
                {mode === 'editor' ? 'Add a brand cover image' : ''}
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent rounded-none" />
          </div>
          <div className="absolute left-1/2 top-full -translate-x-1/2 -translate-y-[60px] w-[100px] h-[100px] md:w-[120px] md:h-[120px] z-[5]">
            <div className="w-full h-full rounded-full bg-white border-[5px] border-white shadow-[0_16px_36px_rgba(0,0,0,0.28),0_0_0_4px_rgba(35,35,255,0.18)] overflow-hidden flex items-center justify-center">
              {logo ? (
                <img src={logo} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-lg font-extrabold text-[#1A1A2E]">{initials}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1440px] mx-auto px-5 sm:px-8 lg:px-10 pb-6">
        <div className="flex flex-col lg:flex-row justify-between items-start gap-6 mt-[74px] mb-5">
          <div className="flex-1 min-w-0 text-center lg:text-left w-full">
            <div className="text-[22px] font-extrabold text-[#1A1A2E] flex items-center justify-center lg:justify-start gap-2 flex-wrap">
              {model.brandName || 'Untitled Brand'}
              {claimStatus === 'verified' && (
                <span className="inline-flex items-center text-[#2323FF]" title="Verified">
                  <Check size={18} strokeWidth={3} />
                </span>
              )}
            </div>
            <div className="text-[12.5px] text-[#9AA0AC] mb-2.5">
              {handle}
              {model.category ? ` · ${model.category}` : ''}
              {' · Bangladesh'}
            </div>
            {claimStatus === 'verified' && (
              <div className="inline-flex items-center gap-1.5 text-[10px] font-bold text-[#2323FF] mb-2">
                <ShieldCheck size={12} /> Verified Brand Owner
              </div>
            )}
            {claimStatus === 'pending' && (
              <div className="inline-flex items-center gap-1.5 bg-[#FF000D] text-white text-[10px] font-bold px-2.5 py-1 rounded-full mb-2">
                Ownership verification pending
              </div>
            )}
            {claimStatus === 'community' && (
              <div className="text-[10px] font-bold text-[#9AA0AC] mb-2">Community brand profile</div>
            )}
            {model.tagline ? (
              <p className="text-[12.5px] text-[#4B5563] max-w-xl mx-auto lg:mx-0">{model.tagline}</p>
            ) : null}
            {socials.length > 0 ? (
              <div className="mt-2.5 flex flex-wrap gap-2 justify-center lg:justify-start">
                {socials.map((s) => (
                  <a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-full border border-[#E5E7EB] bg-white text-[11px] font-semibold text-[#1A1A2E] hover:border-[#EF3C23]/40"
                  >
                    {s.label}
                  </a>
                ))}
              </div>
            ) : mode === 'editor' ? (
              <p className="mt-2 text-[11px] text-[#9AA0AC]">No social links yet — edit header to add them.</p>
            ) : null}
          </div>

          <div className="flex gap-2.5 flex-wrap justify-center lg:justify-end lg:mt-[52px] shrink-0 w-full lg:w-auto">
            {mode === 'public' ? (
              <button
                type="button"
                className="!bg-[#2323FF] !text-white !border-[#2323FF] px-[18px] py-2.5 rounded-lg text-xs font-bold hover:!brightness-110"
              >
                Follow
              </button>
            ) : (
              <span className="bg-[#2323FF] text-white border border-[#2323FF] px-[18px] py-2.5 rounded-lg text-xs font-bold opacity-90">
                Follow
              </span>
            )}
            <button
              type="button"
              onClick={onExploreProducts}
              className="bg-white text-[#1A1A2E] border border-[#E5E7EB] px-[18px] py-2.5 rounded-lg text-xs font-semibold hover:bg-[#F4F7F9]"
            >
              Explore Products
            </button>
            {model.website ? (
              <a
                href={model.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 bg-white text-[#1A1A2E] border border-[#E5E7EB] px-[18px] py-2.5 rounded-lg text-xs font-semibold hover:bg-[#F4F7F9]"
              >
                <Globe size={13} /> Visit Website
              </a>
            ) : null}
            <button
              type="button"
              onClick={onShare}
              className="inline-flex items-center gap-1.5 bg-white text-[#1A1A2E] border border-[#E5E7EB] px-[18px] py-2.5 rounded-lg text-xs font-semibold hover:bg-[#F4F7F9]"
            >
              <Share2 size={13} /> Share
            </button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="bg-white border border-[#E8EDF2] rounded-[10px] p-5 md:w-[300px] shadow-[0_2px_10px_rgba(0,0,0,0.03)] shrink-0">
            <div className="text-[11px] font-extrabold text-[#9AA0AC] tracking-wide mb-2.5">BRAND SCORE</div>
            {score != null ? (
              <>
                <div className="flex items-baseline gap-2 mb-4">
                  <div className="text-[30px] font-extrabold text-[#1A1A2E]">{score}</div>
                  <div className="text-[11.5px] text-[#9AA0AC]">
                    /5{reviewCount > 0 ? ` · ${reviewCount.toLocaleString()} reviews` : ''}
                  </div>
                </div>
                {scoreRows.length > 0 ? (
                  scoreRows.map((r) => (
                    <div key={r.label} className="flex items-center gap-2.5 mb-2">
                      <div className="text-[11px] text-[#4B5563] font-semibold w-16">{r.label}</div>
                      <div className="flex-1 h-1.5 bg-[#F1F1F3] rounded-sm overflow-hidden">
                        <div className="h-full bg-[#2323FF] rounded-sm" style={{ width: r.pct }} />
                      </div>
                      <div className="text-[11px] font-extrabold text-[#1A1A2E] w-5 text-right">{r.value}</div>
                    </div>
                  ))
                ) : (
                  <p className="text-[11px] text-[#9AA0AC]">Score breakdown not available yet.</p>
                )}
              </>
            ) : (
              <p className="text-[12px] text-[#9AA0AC] py-4">
                {mode === 'editor' ? 'No Brand Score yet — scores appear once reviews and trust signals exist.' : 'No Brand Score yet.'}
              </p>
            )}
          </div>

          <div className="bg-white border border-[#E8EDF2] rounded-[10px] p-5 flex-1 shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
            <div className="text-[11px] font-extrabold text-[#9AA0AC] tracking-wide mb-4">BRAND FACTS</div>
            {facts.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-5">
                {facts.map((f) => (
                  <div key={f.label}>
                    <div className="text-base font-extrabold text-[#1A1A2E] mb-0.5">{f.value}</div>
                    <div className="text-[11px] text-[#9AA0AC]">{f.label}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[12px] text-[#9AA0AC]">
                {mode === 'editor' ? 'Facts will populate from products, deals, and followers.' : 'No brand facts available.'}
              </p>
            )}
          </div>
        </div>

        {infoBar.length > 0 ? (
          <div className="bg-white border border-[#E8EDF2] rounded-[10px] px-5 sm:px-7 py-[18px] flex flex-wrap items-center gap-x-8 gap-y-4 mb-2 shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
            {infoBar.map((item) => (
              <div key={item.label}>
                <div className="text-base font-extrabold text-[#1A1A2E] flex items-center gap-1.5">
                  <span>{item.icon}</span> {item.value}
                </div>
                <div className="text-[10px] text-[#9AA0AC]">{item.label}</div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
