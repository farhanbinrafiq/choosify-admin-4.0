import React from 'react';
import {
  CheckCircle2,
  ExternalLink,
  Heart,
  Pencil,
  Share2,
  ShoppingBag,
  ThumbsUp,
} from 'lucide-react';
import type { GuideEditSection, GuideEditorModel } from '../../pages/admin/guideEditorModel';

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

function formatKind(model: GuideEditorModel): string {
  if (model.format === 'product_review') return 'Product Review';
  if (model.format === 'comparison') return 'Comparison';
  if (model.format === 'live') return 'Live Session';
  if (model.format === 'tutorial') return 'Tutorial';
  if (model.format === 'tips') return 'Tips';
  if (model.type === 'video') return 'Video Guide';
  return 'Buying Guide';
}

export function GuideDetailPresentation({
  model,
  mode = 'editor',
  onEditSection,
  productLabels = [],
  brandLabels = [],
}: {
  model: GuideEditorModel;
  mode?: 'public' | 'editor';
  onEditSection?: (section: GuideEditSection) => void;
  productLabels?: string[];
  brandLabels?: string[];
}) {
  const isEditor = mode === 'editor' && !!onEditSection;
  const views = model.views || '0';
  const authorInitial = (model.author || 'C').charAt(0).toUpperCase();

  return (
    <div className="bg-[#F0F8FF] text-[#1A1A2E] overflow-hidden">
      {/* Hero media — Web GuideDetailPage dark surface */}
      <section className="relative w-full choosify-dark-surface py-7 mb-6 border-b border-white/5">
        {isEditor ? <EditChip label="Media" onClick={() => onEditSection!('media')} /> : null}
        <div className="max-w-[1280px] mx-auto px-5 sm:px-8 lg:px-10">
          <div className="aspect-[16/9] max-h-[420px] overflow-hidden bg-black/20 flex items-center justify-center">
            {model.image ? (
              <img
                src={model.image}
                alt=""
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="text-[12px] text-white/50 font-semibold">
                {isEditor ? 'Add cover media' : 'No cover media'}
              </span>
            )}
          </div>
        </div>
      </section>

      <div className="max-w-[1280px] mx-auto px-5 sm:px-8 lg:px-10 w-full -mt-2 mb-4 pb-10 space-y-4">
        {/* Metrics strip */}
        <div className="bg-white rounded-xl border border-[#E8EDF2] border-t-[3px] border-t-[#2323FF] px-[26px] py-[18px] flex flex-wrap items-center justify-center gap-8 sm:gap-14 text-center">
          <div>
            <div className="text-[15px] font-extrabold text-[#1A1A2E] tabular-nums">{views}</div>
            <div className="text-[10px] text-[#9AA0AC] mt-0.5">Views</div>
          </div>
          <div>
            <div className="text-[15px] font-extrabold text-[#1A1A2E] tabular-nums">—</div>
            <div className="mt-1 bg-white border border-[#E5E7EB] text-[9.5px] font-bold px-2.5 py-0.5 rounded-[10px] inline-flex items-center gap-1 text-[#4B5563]">
              <Heart size={11} /> Love React
            </div>
          </div>
          <div>
            <div className="text-[15px] font-extrabold text-[#1A1A2E] tabular-nums">—</div>
            <div className="mt-1 bg-[#F4F7F9] text-[9.5px] font-bold px-2.5 py-0.5 rounded-[10px] inline-flex items-center gap-1 text-[#4B5563]">
              <ThumbsUp size={11} /> Helpful
            </div>
          </div>
          <div>
            <div className="text-[15px] font-extrabold text-[#FF5B00] tabular-nums">—</div>
            <div className="mt-1 bg-[#F4F7F9] text-[9.5px] font-bold px-2.5 py-0.5 rounded-[10px] inline-flex items-center gap-1 text-[#4B5563]">
              <ShoppingBag size={11} /> Purchased
            </div>
          </div>
        </div>

        {/* Title card */}
        <div className="bg-white rounded-xl border border-[#E8EDF2] p-[26px] text-left relative">
          {isEditor ? <EditChip label="Header" onClick={() => onEditSection!('header')} /> : null}
          <span className="inline-block bg-[#FF5B00] text-white text-[9px] font-extrabold px-2.5 py-1 rounded-[5px] mb-3.5 uppercase tracking-wide">
            {formatKind(model)}
          </span>
          <h1 className="text-2xl font-extrabold text-[#1A1A2E] mb-2 leading-snug m-0">
            {model.title || (isEditor ? 'Untitled Guide' : 'Guide')}
          </h1>
          <p className="text-[13px] text-[#6B7280] leading-relaxed m-0 mb-[18px]">
            {model.excerpt ||
              (isEditor ? 'Add a Guide summary' : 'No summary available.')}
          </p>
          <div className="flex items-center gap-2.5 mb-5">
            {model.authorAvatar ? (
              <img
                src={model.authorAvatar}
                alt=""
                className="w-[34px] h-[34px] rounded-full object-cover shrink-0"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-[34px] h-[34px] rounded-full bg-[#FF5B00] flex items-center justify-center text-white text-xs font-extrabold shrink-0">
                {authorInitial}
              </div>
            )}
            <div>
              <div className="text-[12.5px] font-bold text-[#1A1A2E] flex items-center gap-1.5">
                {model.author || (isEditor ? 'Add author / Creator' : 'Choosify Editorial')}
                {model.author ? (
                  <CheckCircle2 size={14} className="text-[#3B82F6] shrink-0" aria-label="Verified" />
                ) : null}
              </div>
              <div className="text-[11px] text-[#9AA0AC]">
                {model.readTime || '—'} · {views} views
                {model.category ? ` · ${model.category}` : ''}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2.5 items-center">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 bg-[linear-gradient(90deg,#6C4CFF,#FF5B00)] text-white border-0 px-[18px] py-[11px] rounded-lg text-xs font-bold"
            >
              Ask Emi about this Discovery
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 border border-[#E5E7EB] bg-white px-[18px] py-[11px] rounded-lg text-xs font-bold text-[#1A1A2E]"
            >
              <Heart size={14} /> Love React
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 bg-[#F4F7F9] text-[#1A1A2E] border-0 px-[18px] py-[11px] rounded-lg text-xs font-bold"
            >
              <Share2 size={14} /> Share
            </button>
            {model.watchUrl ? (
              <a
                href={model.watchUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 bg-white border border-[#E5E7EB] text-[#1A1A2E] px-[18px] py-[11px] rounded-lg text-xs font-bold"
              >
                <ExternalLink size={14} /> Watch on YouTube
              </a>
            ) : isEditor ? (
              <span className="text-[11px] text-[#9AA0AC]">Add external video link</span>
            ) : null}
          </div>
        </div>

        {/* Guide body */}
        <section className="bg-white rounded-xl border border-[#E8EDF2] p-[26px] relative">
          {isEditor ? <EditChip onClick={() => onEditSection!('content')} /> : null}
          <h2 className="text-sm font-extrabold text-[#1A1A2E] m-0 mb-3">Guide Content</h2>
          {model.bodyText ? (
            <div className="text-[13px] text-[#4B5563] leading-relaxed whitespace-pre-wrap">
              {model.bodyText}
            </div>
          ) : (
            <EmptyState message={isEditor ? 'Add Guide content' : 'No Guide content yet'} />
          )}
        </section>

        {/* Verdict / pros / cons */}
        <section className="bg-white rounded-xl border border-[#E8EDF2] p-[26px] relative">
          {isEditor ? <EditChip onClick={() => onEditSection!('verdict')} /> : null}
          <h2 className="text-sm font-extrabold text-[#1A1A2E] m-0 mb-4">Recommendations & Quick Verdict</h2>
          {model.verdict || model.whatWeLike.length || model.whatToConsider.length ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-[11px] font-extrabold text-[#15803D] uppercase mb-2">What we like</div>
                {model.whatWeLike.length ? (
                  <ul className="m-0 pl-4 space-y-1.5">
                    {model.whatWeLike.map((p) => (
                      <li key={p} className="text-[12.5px] text-[#4B5563]">
                        {p}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[12px] text-[#9AA0AC] m-0">No pros yet.</p>
                )}
              </div>
              <div>
                <div className="text-[11px] font-extrabold text-[#B45309] uppercase mb-2">What to consider</div>
                {model.whatToConsider.length ? (
                  <ul className="m-0 pl-4 space-y-1.5">
                    {model.whatToConsider.map((c) => (
                      <li key={c} className="text-[12.5px] text-[#4B5563]">
                        {c}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[12px] text-[#9AA0AC] m-0">No cons yet.</p>
                )}
              </div>
              {model.verdict ? (
                <div className="md:col-span-2 mt-2 pt-3 border-t border-[#F1F1F3]">
                  <div className="text-[11px] font-extrabold text-[#1A1A2E] uppercase mb-2">Verdict</div>
                  <p className="text-[13px] text-[#4B5563] leading-relaxed m-0">{model.verdict}</p>
                </div>
              ) : null}
            </div>
          ) : (
            <EmptyState message={isEditor ? 'Add pros, cons, and verdict' : 'No verdict yet'} />
          )}
        </section>

        {/* Associations */}
        <section className="bg-white rounded-xl border border-[#E8EDF2] p-[26px] relative">
          {isEditor ? <EditChip onClick={() => onEditSection!('associations')} /> : null}
          <h2 className="text-sm font-extrabold text-[#1A1A2E] m-0 mb-4">Products & Brands</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-[11px] font-extrabold text-[#9AA0AC] uppercase mb-2">Associated Products</div>
              {productLabels.length || model.productIds.length ? (
                <div className="flex flex-wrap gap-2">
                  {(productLabels.length ? productLabels : model.productIds).map((p) => (
                    <span
                      key={p}
                      className="bg-[#F4F7F9] text-[11px] font-semibold text-[#4B5563] px-3 py-1.5 rounded-full"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              ) : (
                <EmptyState message={isEditor ? 'No Products associated' : 'No Products associated'} />
              )}
            </div>
            <div>
              <div className="text-[11px] font-extrabold text-[#9AA0AC] uppercase mb-2">Associated Brands</div>
              {brandLabels.length || model.brandIds.length ? (
                <div className="flex flex-wrap gap-2">
                  {(brandLabels.length ? brandLabels : model.brandIds).map((b) => (
                    <span
                      key={b}
                      className="bg-[#F4F7F9] text-[11px] font-semibold text-[#4B5563] px-3 py-1.5 rounded-full"
                    >
                      {b}
                    </span>
                  ))}
                </div>
              ) : (
                <EmptyState message={isEditor ? 'No Brand associated' : 'No Brand associated'} />
              )}
            </div>
          </div>
        </section>

        {/* Q&A / community — presentation gap */}
        <section className="bg-white rounded-xl border border-[#E8EDF2] p-[26px]">
          <h2 className="text-sm font-extrabold text-[#1A1A2E] m-0 mb-3">Q&A</h2>
          <EmptyState message="No Q&A yet. Seller/Creator answers stay read-only here." />
        </section>

        {/* Support CTA */}
        <section className="choosify-dark-surface rounded-xl px-7 py-6 text-white text-center">
          <h3 className="text-sm font-extrabold m-0 mb-2">Support this Creator</h3>
          <p className="text-[12px] text-white/60 m-0 mb-4">
            Follow and engage with {model.author || 'this creator'} on Choosify Spotlight.
          </p>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 bg-[#FF5B00] text-white border-0 px-5 py-2.5 rounded-lg text-xs font-bold"
          >
            Support Creator
          </button>
        </section>

        {/* Disclosure */}
        <section className="bg-white rounded-xl border border-[#E8EDF2] p-5 text-[11px] text-[#9AA0AC]">
          Choosify editorial disclosure: Guide content reflects catalog authorship. Affiliate or sponsorship
          disclosures appear when authored on the public Spotlight page.
        </section>
      </div>
    </div>
  );
}
