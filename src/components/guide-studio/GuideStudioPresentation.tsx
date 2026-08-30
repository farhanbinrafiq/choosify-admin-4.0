import React from 'react';
import { CheckCircle2, ExternalLink, Heart, Pencil, Plus, ShoppingBag, ThumbsUp } from 'lucide-react';
import type { CatalogBrand, CatalogProduct, GuideEntityRef } from '../../types/catalog';
import {
  GUIDE_FORMAT_LABEL,
  GUIDE_SECTION_TITLE,
  type GuideStudioModel,
  type GuideOptionalSection,
  type GuideStudioSection,
} from '../../pages/admin/guideStudioModel';

/**
 * Guide Studio storefront-parity presentation. VIEW ≈ the public Guide page;
 * STUDIO mode swaps one section at a time for an inline editor (Save / Cancel).
 * No drawer, no modal. Only sections present + enabled in `model.sectionLayout`
 * are shown — an unenabled section consumes no space.
 */
export type GuideStudioBridge = {
  editingSection: GuideStudioSection | null;
  dirty: boolean;
  saving: boolean;
  onEdit: (k: GuideStudioSection) => void;
  onCancel: () => void;
  onSave: () => void;
  renderEditor: (k: GuideStudioSection) => React.ReactNode;
  /** Optional sections not yet in the layout — for the "Add section" control. */
  addableSections: GuideOptionalSection[];
  onAddSection: (k: GuideOptionalSection) => void;
  onRemoveSection: (k: GuideOptionalSection) => void;
  onToggleSection: (k: GuideOptionalSection, enabled: boolean) => void;
  onMoveSection: (k: GuideOptionalSection, dir: -1 | 1) => void;
};

export type GuidePublisherView =
  | { kind: 'creator'; name: string; avatar?: string; verified?: boolean; score?: number | null; followers?: number | null }
  | { kind: 'brand'; name: string; logo?: string; verified?: boolean }
  | { kind: 'unknown'; name: string };

export function toYoutubeEmbed(url: string): string {
  const m =
    url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/) || [];
  return m[1] ? `https://www.youtube.com/embed/${m[1]}` : url;
}

export function GuideInlineEditFrame({
  title,
  studio,
  children,
}: {
  title: string;
  studio: GuideStudioBridge;
  children: React.ReactNode;
}) {
  return (
    <div className="relative rounded-xl bg-white border border-[#E8EDF2] p-4 sm:p-5">
      <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#9AA0AC] mb-3">
        Editing — {title}
      </div>
      {children}
      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-[#F1F1F3]">
        <button
          type="button"
          onClick={studio.onCancel}
          disabled={studio.saving}
          className="px-3.5 py-2 rounded-lg border border-[#E8EDF2] text-[11px] font-bold text-[#374151] bg-white"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={studio.onSave}
          disabled={studio.saving}
          className="px-4 py-2 rounded-lg text-[11px] font-extrabold text-white bg-[#EF3C23]"
        >
          {studio.saving ? 'Saving…' : 'Save Changes'}
        </button>
        {studio.dirty ? <span className="text-[10px] text-[#9AA0AC] italic">Unsaved changes</span> : null}
      </div>
    </div>
  );
}

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

function Empty({ text }: { text: string }) {
  return (
    <div className="border border-dashed border-[#E8EDF2] rounded-[10px] bg-white px-5 py-8 text-center">
      <p className="text-[12px] font-medium text-[#9AA0AC] m-0">{text}</p>
    </div>
  );
}

function TagChips({ tags }: { tags?: string[] }) {
  if (!tags?.length) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {tags.slice(0, 4).map((t, i) => (
        <span key={i} className="text-[8.5px] font-bold text-[#7C3AED] bg-[#F3E8FF] rounded px-1 py-0.5 uppercase tracking-wide">
          #{t.replace(/^#+/, '')}
        </span>
      ))}
    </div>
  );
}

function ProductCardMini({ p, badge, external, tags }: { p?: CatalogProduct; badge?: string; tags?: string[]; external?: { title: string; imageUrl?: string; brandName?: string; externalUrl: string } }) {
  if (external) {
    return (
      <a
        href={external.externalUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block rounded-[10px] border border-[#E8EDF2] bg-white overflow-hidden"
      >
        <div className="aspect-[4/3] bg-[#F4F7F9]">
          {external.imageUrl ? <img src={external.imageUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : null}
        </div>
        <div className="p-2.5 text-left">
          <span className="text-[8px] font-extrabold text-[#6B7280] bg-[#F3F4F6] rounded px-1 py-0.5 uppercase">External Product</span>
          <div className="text-[11.5px] font-bold text-[#1A1A2E] line-clamp-2 mt-0.5">{external.title}</div>
          {external.brandName ? <div className="text-[10px] text-[#9AA0AC]">{external.brandName}</div> : null}
          <TagChips tags={tags} />
          <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-[#2563EB]">
            Visit Product <ExternalLink size={10} />
          </div>
        </div>
      </a>
    );
  }
  if (!p) {
    return (
      <div className="rounded-[10px] border border-dashed border-[#E8EDF2] bg-white p-3 text-[11px] text-[#9AA0AC]">
        Product no longer available
      </div>
    );
  }
  return (
    <div className="rounded-[10px] border border-[#E8EDF2] bg-white overflow-hidden">
      <div className="aspect-[4/3] bg-[#F4F7F9]">
        {p.image ? <img src={p.image} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : null}
      </div>
      <div className="p-2.5 text-left">
        {badge ? <div className="text-[8.5px] font-extrabold text-[#EB4501] uppercase tracking-wide mb-0.5">{badge}</div> : null}
        <div className="text-[11.5px] font-bold text-[#1A1A2E] line-clamp-2">{p.title}</div>
        <div className="text-[11px] font-bold text-[#EB4501] mt-0.5">৳{Number(p.price || 0).toLocaleString()}</div>
        <TagChips tags={tags} />
      </div>
    </div>
  );
}

function BrandCardMini({ b, external, tags }: { b?: CatalogBrand; tags?: string[]; external?: { title: string; imageUrl?: string; externalUrl: string } }) {
  if (external) {
    return (
      <a
        href={external.externalUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block rounded-[10px] border border-[#E8EDF2] bg-white p-3"
      >
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-lg bg-[#F4F7F9] overflow-hidden shrink-0">
            {external.imageUrl ? <img src={external.imageUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : null}
          </div>
          <div className="min-w-0">
            <span className="text-[8px] font-extrabold text-[#6B7280] bg-[#F3F4F6] rounded px-1 py-0.5 uppercase">External Brand</span>
            <div className="text-[12px] font-bold text-[#1A1A2E] truncate mt-0.5">{external.title}</div>
            <TagChips tags={tags} />
            <div className="inline-flex items-center gap-1 text-[10px] font-bold text-[#2563EB]">
              Visit Brand <ExternalLink size={10} />
            </div>
          </div>
        </div>
      </a>
    );
  }
  if (!b) {
    return (
      <div className="rounded-[10px] border border-dashed border-[#E8EDF2] bg-white p-3 text-[11px] text-[#9AA0AC]">
        Brand no longer available
      </div>
    );
  }
  return (
    <div className="rounded-[10px] border border-[#E8EDF2] bg-white p-3 flex items-start gap-3">
      <div className="w-11 h-11 rounded-lg bg-[#F4F7F9] overflow-hidden shrink-0">
        {b.logo ? <img src={b.logo} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : null}
      </div>
      <div className="min-w-0">
        <div className="text-[12px] font-bold text-[#1A1A2E] truncate">{b.name}</div>
        <div className="text-[10px] text-[#9AA0AC] truncate">{b.category || 'Brand'}</div>
        <TagChips tags={tags} />
      </div>
    </div>
  );
}

function Bullets({ items, empty }: { items: string[]; empty: string }) {
  if (!items.length) return <Empty text={empty} />;
  return (
    <ul className="m-0 pl-4 space-y-1">
      {items.map((x, i) => (
        <li key={i} className="text-[12.5px] text-[#4B5563]">
          {x}
        </li>
      ))}
    </ul>
  );
}

export function GuideStudioPresentation({
  model,
  mode = 'view',
  studio,
  productsById,
  brandsById,
  publisher,
}: {
  model: GuideStudioModel;
  mode?: 'view' | 'studio';
  studio?: GuideStudioBridge;
  productsById: Map<string, CatalogProduct>;
  brandsById: Map<string, CatalogBrand>;
  publisher: GuidePublisherView;
}) {
  const isStudio = mode === 'studio' && !!studio;
  const formatLabel = GUIDE_FORMAT_LABEL[model.format] || 'Guide';
  const editingHero = isStudio && studio!.editingSection === 'media';
  const editingIdentity = isStudio && studio!.editingSection === 'identity';
  const externalById = new Map(model.externalRefs.map((r) => [r.id, r]));

  const refLabel = (ref: GuideEntityRef): { title: string; kind: 'product' | 'brand'; external?: any } => {
    if (ref.entityType === 'product') return { title: productsById.get(ref.entityId)?.title || 'Product', kind: 'product' };
    if (ref.entityType === 'brand') return { title: brandsById.get(ref.entityId)?.name || 'Brand', kind: 'brand' };
    const x = externalById.get(ref.entityId);
    return {
      title: x?.title || 'External',
      kind: ref.entityType === 'external_brand' ? 'brand' : 'product',
      external: x,
    };
  };

  const RefCard = ({ ref, badge }: { ref: GuideEntityRef; badge?: string }) => {
    if (ref.entityType === 'product') return <ProductCardMini p={productsById.get(ref.entityId)} badge={badge} />;
    if (ref.entityType === 'brand') return <BrandCardMini b={brandsById.get(ref.entityId)} />;
    const x = externalById.get(ref.entityId);
    if (!x) return <ProductCardMini badge={badge} />;
    return ref.entityType === 'external_brand'
      ? <BrandCardMini external={{ title: x.title, imageUrl: x.imageUrl, externalUrl: x.externalUrl }} />
      : <ProductCardMini badge={badge} external={{ title: x.title, imageUrl: x.imageUrl, brandName: x.brandName, externalUrl: x.externalUrl }} />;
  };

  // ── VIEW renderers for optional sections ────────────────────────────────
  const renderView = (id: GuideOptionalSection): React.ReactNode => {
    switch (id) {
      case 'description':
        return model.body ? (
          <div className="bg-white rounded-xl border border-[#E8EDF2] p-6 text-[13px] text-[#4B5563] leading-relaxed whitespace-pre-wrap">
            {model.body}
          </div>
        ) : (
          <Empty text={isStudio ? 'Add the description / introduction' : 'No description'} />
        );
      case 'products': {
        const hasExternal = model.externalRefs.some((r) => r.kind === 'product');
        if (!model.productIds.length && !hasExternal)
          return <Empty text={isStudio ? 'Add products this guide discusses' : 'No products'} />;
        return (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {model.productIds.map((pid) => (
              <ProductCardMini
                key={pid}
                p={productsById.get(pid)}
                badge={model.topPickIds.includes(pid) ? 'Top pick' : undefined}
                tags={model.productHighlights[pid]}
              />
            ))}
            {model.externalRefs
              .filter((r) => r.kind === 'product')
              .map((x) => (
                <ProductCardMini key={x.id} tags={x.highlightTags} external={{ title: x.title, imageUrl: x.imageUrl, brandName: x.brandName, externalUrl: x.externalUrl }} />
              ))}
          </div>
        );
      }
      case 'brandMentions': {
        const hasExternal = model.externalRefs.some((r) => r.kind === 'brand');
        if (!model.brandIds.length && !hasExternal)
          return <Empty text={isStudio ? 'Mention the brands this guide discusses' : 'No brand mentions'} />;
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {model.brandIds.map((bid) => (
              <BrandCardMini key={bid} b={brandsById.get(bid)} tags={model.brandHighlights[bid]} />
            ))}
            {model.externalRefs
              .filter((r) => r.kind === 'brand')
              .map((x) => (
                <BrandCardMini key={x.id} tags={x.highlightTags} external={{ title: x.title, imageUrl: x.imageUrl, externalUrl: x.externalUrl }} />
              ))}
          </div>
        );
      }
      case 'externalRefs':
        return model.externalRefs.length ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {model.externalRefs.map((x) =>
              x.kind === 'brand' ? (
                <BrandCardMini key={x.id} tags={x.highlightTags} external={{ title: x.title, imageUrl: x.imageUrl, externalUrl: x.externalUrl }} />
              ) : (
                <ProductCardMini key={x.id} tags={x.highlightTags} external={{ title: x.title, imageUrl: x.imageUrl, brandName: x.brandName, externalUrl: x.externalUrl }} />
              ),
            )}
          </div>
        ) : (
          <Empty text={isStudio ? 'Add products / brands that are not on Choosify' : 'No off-platform references'} />
        );
      case 'picks':
        return model.picks.length ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {model.picks.map((p) => (
              <div key={p.id}>
                <div className="text-[9px] font-extrabold text-[#8A00C4] uppercase tracking-wide mb-1">{p.label || 'Pick'}</div>
                <RefCard ref={p.ref} />
              </div>
            ))}
          </div>
        ) : (
          <Empty text={isStudio ? 'Add labelled picks (Best Value, Editor’s Pick…) — no ranking' : 'No picks'} />
        );
      case 'winner':
        return model.winnerOverall ? (
          <div className="space-y-3">
            <div className="max-w-xs">
              <RefCard ref={model.winnerOverall} badge="Overall winner" />
            </div>
            {model.awards.length ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {model.awards.map((a) => (
                  <div key={a.id}>
                    <div className="text-[9px] font-extrabold text-[#EB4501] uppercase tracking-wide mb-1">{a.label || 'Award'}</div>
                    <RefCard ref={a.ref} />
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <Empty text={isStudio ? 'Pick one overall winner (only when the guide genuinely has one)' : 'No winner'} />
        );
      case 'whyWon':
        return model.whyWonChips.length ? (
          <div className="flex flex-wrap gap-2">
            {model.whyWonChips.map((c, i) => (
              <span key={i} className="px-3 py-2 text-[11px] font-bold border border-[#E8EDF2] rounded-xl bg-white text-[#1A1A2E]">
                {c}
              </span>
            ))}
          </div>
        ) : (
          <Empty text={isStudio ? 'Add the key reasons the winner won' : 'No reasons'} />
        );
      case 'verdict':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { t: 'Best For', items: model.bestFor },
              { t: 'Not For', items: model.notFor },
              { t: 'Pros', items: model.pros },
              { t: 'Cons', items: model.cons },
            ].map((col) => (
              <div key={col.t} className="bg-white rounded-[10px] border border-[#E8EDF2] p-4">
                <div className="text-[11px] font-extrabold text-[#1A1A2E] uppercase mb-2">{col.t}</div>
                <Bullets items={col.items} empty="—" />
              </div>
            ))}
          </div>
        );
      case 'takeaways':
        return model.takeawayTitle || model.takeawayBody ? (
          <div className="bg-white rounded-[10px] border border-[#E8EDF2] p-6">
            {model.takeawayTitle ? <p className="text-[13px] font-extrabold text-[#EB4501] mb-1 m-0">{model.takeawayTitle}</p> : null}
            <p className="text-[13px] font-medium text-[#4B5563] leading-relaxed m-0 whitespace-pre-wrap">{model.takeawayBody}</p>
          </div>
        ) : (
          <Empty text={isStudio ? 'Add the bottom-line takeaway' : 'No takeaways'} />
        );
      case 'methodology':
        return model.reviewMethodSteps.length ? (
          <div className="bg-white rounded-[10px] border border-[#E8EDF2] p-6">
            <div className="text-[12px] font-extrabold text-[#1A1A2E] mb-3">
              HOW <span className="text-[#EB4501]">THIS REVIEW</span> WAS MADE
            </div>
            <ul className="m-0 pl-4 space-y-1.5">
              {model.reviewMethodSteps.map((x, i) => (
                <li key={i} className="text-[12.5px] font-medium text-[#1A1A2E]">
                  {x}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <Empty text={isStudio ? 'Add how the review / test was done' : 'No methodology'} />
        );
      case 'liveOffers':
        return model.liveOffers.length ? (
          <div className="space-y-1.5">
            {model.liveOffers.map((o) => {
              const p = productsById.get(o.productId);
              return (
                <div key={o.id} className="flex items-center justify-between gap-2 rounded-lg border border-[#E8EDF2] bg-white px-3 py-2">
                  <span className="text-[12px] font-semibold text-[#1A1A2E] truncate">{p?.title || o.productId}</span>
                  <span className="text-[11px] font-bold text-[#EB4501] shrink-0">
                    {typeof o.promoPrice === 'number'
                      ? `৳${o.promoPrice.toLocaleString()}`
                      : `${o.discountValue}${o.discountType === 'percent' ? '% off' : ' off'}`}
                    {'  ·  '}
                    {new Date(o.startsAt).toLocaleDateString()}–{new Date(o.endsAt).toLocaleDateString()}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <Empty text={isStudio ? 'Add a time-boxed promo on a tagged product (brand-authored only)' : 'No live offers'} />
        );
      case 'socialLinks':
        return model.socialLinks.length ? (
          <div className="flex flex-wrap gap-2">
            {model.socialLinks.map((l) => (
              <a
                key={l.id}
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-[#E8EDF2] bg-white px-3 py-1.5 text-[11px] font-bold text-[#1A1A2E]"
              >
                {l.label || `Continue on ${l.platform}`} <ExternalLink size={11} />
              </a>
            ))}
          </div>
        ) : (
          <Empty text={isStudio ? 'Add continue-on-platform links for this guide' : 'No links'} />
        );
      default:
        return null;
    }
  };

  const SectionShell = ({ id }: { id: GuideOptionalSection }) => {
    const editingThis = isStudio && studio!.editingSection === id;
    const entry = model.sectionLayout.find((e) => e.id === id);
    const idx = model.sectionLayout.findIndex((e) => e.id === id);
    return (
      <section id={`guide-${id}`} className="scroll-mt-36 w-full">
        <div className="flex items-center justify-between gap-3 mb-2">
          <h3 className="text-[13px] font-extrabold text-[#1A1A2E] tracking-wide uppercase m-0">
            {GUIDE_SECTION_TITLE[id]}
            {entry && !entry.enabled ? (
              <span className="ml-2 text-[9px] font-bold text-[#9AA0AC] uppercase">hidden</span>
            ) : null}
          </h3>
          {isStudio && !editingThis ? (
            <div className="flex items-center gap-1">
              <button type="button" className="text-[10px] font-bold text-[#6B7280] px-1.5 py-0.5 rounded border border-[#E8EDF2]" onClick={() => studio!.onMoveSection(id, -1)} disabled={idx <= 0}>↑</button>
              <button type="button" className="text-[10px] font-bold text-[#6B7280] px-1.5 py-0.5 rounded border border-[#E8EDF2]" onClick={() => studio!.onMoveSection(id, 1)} disabled={idx === model.sectionLayout.length - 1}>↓</button>
              <button
                type="button"
                className="text-[10px] font-bold text-[#6B7280] px-1.5 py-0.5 rounded border border-[#E8EDF2]"
                onClick={() => studio!.onToggleSection(id, !(entry?.enabled ?? true))}
              >
                {entry?.enabled ?? true ? 'Hide' : 'Show'}
              </button>
              <button type="button" className="text-[10px] font-bold text-[#DC2626] px-1.5 py-0.5 rounded border border-[#E8EDF2]" onClick={() => studio!.onRemoveSection(id)}>Remove</button>
            </div>
          ) : null}
        </div>
        {editingThis ? (
          <GuideInlineEditFrame title={GUIDE_SECTION_TITLE[id]} studio={studio!}>
            {studio!.renderEditor(id)}
          </GuideInlineEditFrame>
        ) : (
          <div className="relative">
            {isStudio ? <EditPill onClick={() => studio!.onEdit(id)} /> : null}
            {renderView(id)}
          </div>
        )}
      </section>
    );
  };

  return (
    <div className="bg-[#F0F8FF] text-[#1A1A2E]">
      {/* ── Media hero (core) ── */}
      <section className="relative w-full choosify-dark-surface py-7 border-b border-white/5">
        <div className="max-w-[1180px] mx-auto px-5 sm:px-8">
          {editingHero ? (
            <GuideInlineEditFrame title="Media" studio={studio!}>
              {studio!.renderEditor('media')}
            </GuideInlineEditFrame>
          ) : (
            <div className="relative">
              {isStudio ? <EditPill onClick={() => studio!.onEdit('media')} /> : null}
              {(() => {
                const primary = model.photos[0] || '';
                const extras = model.photos.slice(1);
                const videoSrc = model.format === 'live' ? model.liveEmbedUrl || model.videoUrl : model.videoUrl;
                if (!primary && !videoSrc) {
                  return (
                    <div className="aspect-[16/9] max-h-[400px] rounded-lg bg-black/20 flex items-center justify-center">
                      <span className="text-[12px] text-white/50 font-semibold">
                        {isStudio ? 'Add photos and/or a video' : 'No media'}
                      </span>
                    </div>
                  );
                }
                return (
                  <div className="grid gap-3 md:grid-cols-[1.6fr_1fr] items-start">
                    <div className="space-y-2">
                      {primary ? (
                        <div className="aspect-[16/9] max-h-[380px] overflow-hidden rounded-lg bg-black/20">
                          <img src={primary} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        </div>
                      ) : null}
                      {extras.length ? (
                        <div className="flex gap-2 flex-wrap">
                          {extras.map((u, i) => (
                            <div key={i} className="w-20 h-14 rounded-md overflow-hidden bg-black/20 shrink-0">
                              <img src={u} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    {videoSrc ? (
                      <div>
                        <div className="text-[9px] font-extrabold text-white/50 uppercase tracking-wider mb-1">
                          {model.format === 'live' ? 'Live / video' : 'Video'}
                        </div>
                        <div className="aspect-video rounded-lg overflow-hidden bg-black">
                          {/youtube\.com|youtu\.be/.test(videoSrc) ? (
                            <iframe title="Guide video" src={toYoutubeEmbed(videoSrc)} className="w-full h-full border-0" allowFullScreen />
                          ) : /\.(mp4|webm)(\?|$)/i.test(videoSrc) ? (
                            <video src={videoSrc} controls preload="metadata" className="w-full h-full object-contain bg-black" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[10px] text-white/50 px-2 text-center break-all">
                              {videoSrc}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </section>

      <div className="max-w-[1180px] mx-auto px-5 sm:px-8 py-6 space-y-8">
        {/* Metrics strip — preview only */}
        <div className="bg-white rounded-xl border border-[#E8EDF2] border-t-[3px] border-t-[#2323FF] px-6 py-4 flex flex-wrap items-center justify-center gap-10 text-center">
          {[
            { v: model.views && Number(model.views.replace(/\D/g, '')) > 0 ? Number(model.views.replace(/\D/g, '')).toLocaleString() : '—', l: 'Views' },
            { v: '—', l: <span className="inline-flex items-center gap-1"><Heart size={11} /> Love</span> },
            { v: '—', l: <span className="inline-flex items-center gap-1"><ThumbsUp size={11} /> Helpful</span> },
            { v: '—', l: <span className="inline-flex items-center gap-1"><ShoppingBag size={11} /> Purchased</span> },
          ].map((x, i) => (
            <div key={i}>
              <div className="text-[15px] font-extrabold text-[#1A1A2E] tabular-nums">{x.v}</div>
              <div className="text-[10px] text-[#9AA0AC] mt-0.5">{x.l}</div>
            </div>
          ))}
        </div>

        {/* ── Identity (core) ── */}
        {editingIdentity ? (
          <GuideInlineEditFrame title="Guide Identity" studio={studio!}>
            {studio!.renderEditor('identity')}
          </GuideInlineEditFrame>
        ) : (
          <div className="relative bg-white rounded-xl border border-[#E8EDF2] p-6 text-left">
            {isStudio ? <EditPill onClick={() => studio!.onEdit('identity')} /> : null}
            <span className="inline-block bg-[#EB4501] text-white text-[9px] font-extrabold px-2.5 py-1 rounded-[5px] mb-3 uppercase tracking-wide">
              {formatLabel}
            </span>
            <h1 className="text-2xl font-extrabold text-[#1A1A2E] mb-2 leading-snug m-0">
              {model.title || (isStudio ? 'Untitled Guide' : 'Guide')}
            </h1>
            <p className="text-[13px] text-[#6B7280] leading-relaxed m-0 mb-3">
              {model.excerpt || (isStudio ? 'Add a short summary' : '')}
            </p>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {model.tags.map((t) => (
                <span key={t} className="text-[10px] font-semibold text-[#4B5563] bg-[#F4F7F9] rounded-full px-2.5 py-1">
                  #{t.replace(/^#+/, '')}
                </span>
              ))}
            </div>
            <div className="text-[11px] text-[#9AA0AC]">
              {model.category || 'Uncategorised'} · {model.readTime} · {model.type}
            </div>
            <div className="mt-3 pt-3 border-t border-[#F1F1F3] flex items-center gap-2.5">
              <span className="text-[11.5px]">
                <span className="text-[#9AA0AC]">{publisher.kind === 'brand' ? 'Published by brand' : 'Authored by'}</span>{' '}
                <span className="font-bold text-[#1A1A2E]">{publisher.name}</span>
              </span>
              <span className="ml-1 text-[9px] font-bold text-[#9AA0AC] uppercase">read-only</span>
            </div>
          </div>
        )}

        {/* ── Optional sections, in layout order ── */}
        {model.sectionLayout
          .filter((e) => isStudio || e.enabled)
          .map((e) => <SectionShell key={e.id} id={e.id} />)}

        {/* Add section (studio only) */}
        {isStudio && studio!.addableSections.length ? (
          <div className="rounded-xl border border-dashed border-[#E8EDF2] bg-white p-4">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#9AA0AC] mb-2">Add a section</div>
            <div className="flex flex-wrap gap-2">
              {studio!.addableSections.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => studio!.onAddSection(id)}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#E8EDF2] bg-white px-2.5 py-1.5 text-[11px] font-bold text-[#374151] hover:bg-[#F8FAFC]"
                >
                  <Plus className="h-3 w-3" /> {GUIDE_SECTION_TITLE[id]}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {/* ── Publisher identity card (core, read-only) ── */}
        <section className="w-full">
          <h3 className="text-[13px] font-extrabold text-[#1A1A2E] tracking-wide uppercase mb-2">
            {publisher.kind === 'brand' ? 'About the Brand' : 'About the Author'}
          </h3>
          <div className="bg-white border border-[#E8EDF2] rounded-[10px] p-5 max-w-md">
            <div className="flex items-center gap-3">
              <div
                className={`w-14 h-14 overflow-hidden bg-[#F4F7F9] shrink-0 flex items-center justify-center ${
                  publisher.kind === 'brand' ? 'rounded-lg' : 'rounded-full'
                }`}
              >
                {publisher.kind === 'brand' && 'logo' in publisher && publisher.logo ? (
                  <img src={publisher.logo} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : publisher.kind === 'creator' && 'avatar' in publisher && publisher.avatar ? (
                  <img src={publisher.avatar} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <span className="text-lg font-extrabold text-[#1A1A2E]">{(publisher.name || 'C').charAt(0).toUpperCase()}</span>
                )}
              </div>
              <div className="min-w-0">
                <div className="text-[14px] font-extrabold text-[#1A1A2E] flex items-center gap-1.5">
                  {publisher.name}
                  {'verified' in publisher && publisher.verified ? (
                    <CheckCircle2 size={14} className="text-[#3B82F6]" aria-label="Verified" />
                  ) : null}
                </div>
                {publisher.kind === 'creator' ? (
                  <div className="text-[11px] text-[#9AA0AC]">
                    {typeof publisher.followers === 'number' ? `${publisher.followers.toLocaleString()} followers` : '— followers'}
                    {' · '}
                    {typeof publisher.score === 'number' ? `score ${publisher.score}` : 'score —'}
                  </div>
                ) : (
                  <div className="text-[11px] text-[#9AA0AC]">Publisher brand</div>
                )}
              </div>
            </div>
            <p className="text-[10.5px] text-[#9AA0AC] mt-3 mb-0">
              Publisher identity is resolved from the canonical {publisher.kind === 'brand' ? 'Brand' : 'Creator'} record and edited in{' '}
              {publisher.kind === 'brand' ? 'Brand Studio' : 'Creator Studio'}, not here.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
