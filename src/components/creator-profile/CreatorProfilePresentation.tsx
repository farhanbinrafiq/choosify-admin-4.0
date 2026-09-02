import React, { useState } from 'react';
import {
  Check,
  CheckCircle2,
  ExternalLink,
  Heart,
  MessageCircleMore,
  Pencil,
  Share2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import {
  normalizeTrustScore,
  type CreatorEditSection,
  type CreatorEditorModel,
} from '../../pages/admin/creatorEditorModel';

/**
 * Storefront-parity Creator profile. VIEW ≈ the public Creator Profile page;
 * STUDIO mode swaps one section at a time for an inline editor (Save Changes /
 * Cancel). No drawer, no modal, no slide-over. Trust score, followers,
 * verification, media and reviews are platform/relationship-derived and render
 * read-only with no edit affordance.
 */
export type CreatorStudioBridge = {
  editingSection: CreatorEditSection | null;
  dirty: boolean;
  saving: boolean;
  onEdit: (k: CreatorEditSection) => void;
  onCancel: () => void;
  onSave: () => void;
  renderEditor: (k: CreatorEditSection) => React.ReactNode;
  /** Where the read-only Guides tab links for managing content. */
  manageGuidesHref?: string;
};

const SECTION_TITLE: Record<CreatorEditSection, string> = {
  cover: 'Cover & Avatar',
  identity: 'Profile Identity',
  social: 'Social Links',
  overview: 'Creator Overview',
  contact: 'Contact & Reach',
  partnerships: 'Partnerships & Collaborations',
  featured: 'Featured Content',
};

function EditPill({ onClick, label }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute top-3 right-3 z-20 inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-[#E8EDF2] bg-white/95 text-[#EF3C23] text-[10px] font-extrabold uppercase shadow-sm hover:bg-[#EF3C23] hover:text-white hover:border-[#EF3C23] transition-colors"
    >
      <Pencil className="w-3 h-3" /> {label || 'Edit'}
    </button>
  );
}

function CreatorInlineEditFrame({
  title,
  studio,
  children,
}: {
  title: string;
  studio: CreatorStudioBridge;
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

function EmptyState({ message }: { message: string }) {
  return (
    <div className="border border-dashed border-[#E8EDF2] rounded-[10px] bg-white px-5 py-10 text-center">
      <p className="text-[13px] font-medium text-[#9AA0AC] m-0">{message}</p>
    </div>
  );
}

function DerivedNote({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] text-[#9AA0AC] mt-2 mb-0 italic">{children}</p>;
}

function OverviewCardHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-4 border-b border-[#F1F1F3] pb-3">
      <div className="w-8 h-8 rounded-lg bg-[#FFF3EA] text-[#FF5B00] flex items-center justify-center shrink-0">
        <CheckCircle2 size={16} fill="currentColor" className="text-[#FF5B00] stroke-white" />
      </div>
      <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-[#1A1A2E] m-0">{title}</h3>
    </div>
  );
}

const SCORE_ROWS = [
  { label: 'Accuracy', key: 0.96 },
  { label: 'Depth', key: 0.94 },
  { label: 'Clarity', key: 0.92 },
  { label: 'Trust', key: 0.98 },
  { label: 'Value', key: 0.9 },
] as const;

const TABS = ['Overview', 'Guides', 'Videos', 'Reviews', 'Collections', 'Deals', 'About'] as const;

export function CreatorProfilePresentation({
  model,
  mode = 'view',
  studio,
}: {
  model: CreatorEditorModel;
  mode?: 'view' | 'studio';
  studio?: CreatorStudioBridge;
}) {
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>('Overview');
  const isStudio = mode === 'studio' && !!studio;
  const trust = normalizeTrustScore(model.score);
  const initial = String(model.name || 'C')
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const handle = model.handle || (model.name ? `@${model.name.toLowerCase().replace(/\s+/g, '')}` : '@creator');
  const firstName = (model.name || 'Creator').split(/\s+/)[0];
  // Featured Content: creator-curated list, else fall back to newest media.
  const curatedFeatured = Array.isArray(model.featuredContent) ? model.featuredContent : [];
  const featured = curatedFeatured.length
    ? curatedFeatured.map((f) => ({
        id: f.id,
        kind: f.source === 'platform' ? f.kind : 'link',
        title: f.title,
        thumbnail: f.thumbnail,
        url: f.url,
        views: undefined as string | undefined,
        external: f.source === 'external',
      }))
    : [...model.videos, ...model.reels, ...model.blogs].slice(0, 4).map((m) => ({
        id: m.id,
        kind: m.kind,
        title: m.title,
        thumbnail: m.thumbnail,
        url: m.url,
        views: m.views,
        external: false,
      }));
  const socialEntries = (
    [
      ['Facebook', model.socialLinks.facebook],
      ['Instagram', model.socialLinks.instagram],
      ['YouTube', model.socialLinks.youtube],
      ['LinkedIn', model.socialLinks.linkedin],
      ['TikTok', model.socialLinks.tiktok],
      ...(model.socialLinks.custom ?? []).map((c) => [c.label, c.url] as const),
    ] as ReadonlyArray<readonly [string, string | undefined]>
  ).filter(([, url]) => !!url);

  const infoFacts = [
    { icon: '📹', label: 'Videos', value: String(model.videos.length || '—') },
    { icon: '✦', label: 'Reels', value: String(model.reels.length || '—') },
    { icon: '✍', label: 'Blogs', value: String(model.blogs.length || '—') },
    { icon: '♥', label: 'Followers', value: model.followerTotal || '—' },
    { icon: '★', label: 'Trust', value: trust > 0 ? String(trust) : '—' },
    { icon: '🏷', label: 'Best for', value: model.bestFor || model.bestForTags[0] || '—' },
  ];

  const editingId = isStudio ? studio!.editingSection : null;
  const editingHere = (k: CreatorEditSection) => editingId === k;
  const pill = (k: CreatorEditSection, label?: string) =>
    isStudio && !editingHere(k) ? <EditPill onClick={() => studio!.onEdit(k)} label={label} /> : null;
  const frame = (k: CreatorEditSection) => (
    <CreatorInlineEditFrame title={SECTION_TITLE[k]} studio={studio!}>
      {studio!.renderEditor(k)}
    </CreatorInlineEditFrame>
  );

  return (
    <div className="bg-[#F0F8FF] text-[#1A1A2E] overflow-hidden">
      {/* Cover + avatar */}
      <div className="w-full px-5 sm:px-8 lg:px-10 pt-4 relative">
        <div className="max-w-[1180px] mx-auto relative">
          {editingHere('cover') ? (
            <div className="pb-2">{frame('cover')}</div>
          ) : (
            <>
              {pill('cover', 'Cover')}
              <div className="relative h-[220px] sm:h-[280px] md:h-[320px] overflow-hidden choosify-dark-surface rounded-none">
                {model.coverImage ? (
                  <img src={model.coverImage} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[12px] text-white/50 font-semibold">
                    {isStudio ? 'Add cover image' : 'No cover image'}
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
              </div>
              <div className="absolute left-1/2 top-full -translate-x-1/2 -translate-y-[60px] w-[100px] h-[100px] md:w-[120px] md:h-[120px] z-[5]">
                <div className="w-full h-full rounded-full bg-[#1A1A2E] border-[5px] border-white shadow-[0_16px_36px_rgba(0,0,0,0.28),0_0_0_4px_rgba(7,208,80,0.18)] overflow-hidden flex items-center justify-center text-white text-[30px] font-extrabold">
                  {model.avatar ? (
                    <img src={model.avatar} alt={model.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    initial
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="max-w-[1180px] mx-auto px-5 sm:px-8 lg:px-10 pb-6">
        {/* Identity + social */}
        <div className={`relative ${editingHere('cover') ? 'mt-6' : 'mt-[74px]'} mb-6`}>
          {editingHere('identity') ? (
            frame('identity')
          ) : (
            <div className="relative flex flex-col lg:flex-row justify-between items-start gap-6">
              {pill('identity', 'Identity')}
              <div className="flex-1 min-w-0 text-center lg:text-left w-full">
                <div className="text-[22px] font-extrabold text-[#1A1A2E] flex items-center justify-center lg:justify-start gap-2 flex-wrap">
                  {model.name || 'Untitled Creator'}
                  {model.verified ? (
                    <span className="inline-flex text-[#2323FF]" title="Verified (platform-managed)">
                      <Check size={18} strokeWidth={3} />
                    </span>
                  ) : null}
                </div>
                <div className="text-[13px] text-[#2323FF] font-semibold">
                  {model.title || (isStudio ? 'Add creator title' : 'Creator')}
                </div>
                <div className="text-[12.5px] text-[#9AA0AC] mb-2.5">
                  {handle}
                  {model.location ? ` · ${model.location}` : isStudio ? ' · Add location' : ''}
                </div>
                {model.verified ? (
                  <div className="inline-flex items-center gap-1.5 text-[10px] font-bold text-[#2323FF] mb-2">
                    <ShieldCheck size={12} /> Verified Creator
                  </div>
                ) : (
                  <div className="text-[10px] font-bold text-[#9AA0AC] mb-2">Community creator profile</div>
                )}

                {/* Social — its own editable section */}
                <div className="relative mt-2.5 min-h-[30px]">
                  {editingHere('social') ? (
                    frame('social')
                  ) : (
                    <>
                      {isStudio ? (
                        <button
                          type="button"
                          onClick={() => studio!.onEdit('social')}
                          className="absolute -top-1 right-0 text-[10px] font-extrabold text-[#EF3C23] uppercase bg-transparent border-0 cursor-pointer"
                        >
                          Edit social
                        </button>
                      ) : null}
                      <div className="flex flex-wrap gap-2 justify-center lg:justify-start">
                        {socialEntries.length ? (
                          socialEntries.map(([label, url]) => (
                            <a
                              key={label}
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="px-3 py-1.5 rounded-full border border-[#E8EDF2] bg-white text-[11px] font-bold text-[#1A1A2E]"
                            >
                              {label}
                            </a>
                          ))
                        ) : (
                          <span className="text-[11px] text-[#9AA0AC]">
                            {isStudio ? 'Add social links' : 'No social links'}
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {model.bio ? (
                  <p className="text-[12.5px] text-[#4B5563] max-w-xl mx-auto lg:mx-0 leading-relaxed mt-3 m-0">
                    {model.bio}
                  </p>
                ) : isStudio ? (
                  <p className="text-[12.5px] text-[#9AA0AC] mt-3 m-0">Add a bio for the storefront profile.</p>
                ) : null}
              </div>

              <div className="flex gap-2.5 flex-wrap justify-center lg:justify-end lg:mt-[52px] shrink-0 w-full lg:w-auto">
                {['Follow', 'Message', 'Share', 'Love', 'Ask For Branding'].map((b, i) => (
                  <button
                    key={b}
                    type="button"
                    disabled
                    className={`inline-flex items-center gap-1.5 px-[18px] py-2.5 rounded-lg text-xs font-bold ${
                      i === 0
                        ? 'bg-[#2323FF] text-white border border-[#2323FF]'
                        : 'bg-white text-[#1A1A2E] border border-[#E5E7EB] font-semibold'
                    } ${isStudio ? 'opacity-60' : ''}`}
                  >
                    {i === 1 ? <MessageCircleMore size={13} className="text-[#FF5B00]" /> : null}
                    {i === 2 ? <Share2 size={13} /> : null}
                    {i === 3 ? <Heart size={13} /> : null}
                    {i === 4 ? <Sparkles size={13} /> : null}
                    {b}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Trust (derived) + Creator info (derived) */}
        <div className="flex flex-col md:flex-row gap-4 mb-2">
          <div className="bg-white border border-[#E8EDF2] rounded-[10px] p-5 md:w-[300px] shadow-[0_2px_10px_rgba(0,0,0,0.03)] shrink-0">
            <div className="text-[11px] font-extrabold text-[#9AA0AC] tracking-wide mb-2.5">TRUST SCORE</div>
            <div className="flex items-baseline gap-2 mb-4">
              <div className="text-[30px] font-extrabold text-[#1A1A2E]">{trust > 0 ? trust : '—'}</div>
              <div className="text-[11.5px] text-[#9AA0AC]">/5 · platform-managed</div>
            </div>
            {trust > 0 ? (
              SCORE_ROWS.map((r) => {
                const rowVal = Math.min(5, Math.round(trust * r.key * 10) / 10);
                const pct = `${Math.min(100, Math.round((rowVal / 5) * 100))}%`;
                return (
                  <div key={r.label} className="flex items-center gap-2.5 mb-2">
                    <div className="text-[11px] text-[#4B5563] font-semibold w-[74px]">{r.label}</div>
                    <div className="flex-1 h-1.5 bg-[#F1F1F3] rounded-sm overflow-hidden">
                      <div className="h-full bg-[#2323FF] rounded-sm" style={{ width: pct }} />
                    </div>
                    <div className="text-[11px] font-extrabold text-[#1A1A2E] w-5 text-right">{rowVal}</div>
                  </div>
                );
              })
            ) : (
              <p className="text-[11px] text-[#9AA0AC] m-0">No trust score yet.</p>
            )}
            {isStudio ? <DerivedNote>Trust Score is calculated by Choosify — not editable here.</DerivedNote> : null}
          </div>

          <div className="bg-white border border-[#E8EDF2] rounded-[10px] p-5 flex-1 shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
            <div className="text-[11px] font-extrabold text-[#9AA0AC] tracking-wide mb-4">CREATOR INFO</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-5">
              {infoFacts.map((f) => (
                <div key={f.label} className="flex items-center gap-2.5">
                  <div className="w-[34px] h-[34px] rounded-lg bg-[#F4F7F9] flex items-center justify-center text-sm shrink-0">
                    {f.icon}
                  </div>
                  <div>
                    <div className="text-[15px] font-extrabold text-[#1A1A2E]">{f.value}</div>
                    <div className="text-[10.5px] text-[#9AA0AC]">{f.label}</div>
                  </div>
                </div>
              ))}
            </div>
            {isStudio ? (
              <DerivedNote>Followers, media counts and Trust are resolved from your account &amp; content.</DerivedNote>
            ) : null}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="sticky top-[64px] z-[15] w-full bg-[#F0F8FF] border-b border-[#E8EDF2]">
        <div className="max-w-[1180px] mx-auto px-5 sm:px-8 lg:px-10 flex gap-7 overflow-x-auto">
          {TABS.map((tab) => {
            const active = activeTab === tab;
            const count =
              tab === 'Guides'
                ? model.blogs.length || ''
                : tab === 'Videos'
                  ? model.videos.length + model.reels.length || ''
                  : '';
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`shrink-0 py-3.5 text-[13px] font-bold cursor-pointer whitespace-nowrap border-0 border-b-2 bg-transparent ${
                  active
                    ? 'text-app-accent border-app-accent'
                    : 'text-[#6B7280] border-transparent hover:text-[#1A1A2E]'
                }`}
              >
                {tab}
                {count ? <span className="text-[#9AA0AC] font-semibold ml-1">{count}</span> : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="max-w-[1180px] mx-auto px-5 sm:px-8 lg:px-10 py-6 w-full space-y-8 pb-10">
        {activeTab === 'Guides' ? (
          <section className="bg-white border border-[#E8EDF2] rounded-[10px] p-5">
            <div className="flex items-center justify-between gap-3 mb-3.5">
              <h2 className="text-sm font-extrabold text-[#1A1A2E] m-0">Guides &amp; Content</h2>
              <a
                href={studio?.manageGuidesHref || '/admin/guides'}
                className="inline-flex items-center gap-1 text-[11px] font-extrabold text-[#EF3C23] uppercase"
              >
                Manage Guides <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            {model.blogs.length ? (
              <div className="grid grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {model.blogs.map((b) => (
                  <div key={b.id} className="border border-[#E8EDF2] rounded-[10px] overflow-hidden bg-[#F9FAFB]">
                    <div className="aspect-video bg-[#1A1A2E]/10 flex items-center justify-center overflow-hidden">
                      {b.thumbnail ? <img src={b.thumbnail} alt="" className="w-full h-full object-cover" /> : <span className="text-[10px] font-bold text-[#9AA0AC] uppercase">guide</span>}
                    </div>
                    <div className="p-3 text-[12px] font-bold text-[#1A1A2E] line-clamp-2">{b.title}</div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState message="No guides yet — publish one from Guide Management." />
            )}
            {isStudio ? (
              <DerivedNote>Guides are managed in Guide Management; this tab mirrors your published content.</DerivedNote>
            ) : null}
          </section>
        ) : activeTab !== 'Overview' ? (
          <EmptyState
            message={
              activeTab === 'Videos' && model.videos.length + model.reels.length === 0
                ? 'No videos yet.'
                : activeTab === 'Reviews'
                  ? 'No reviews yet.'
                  : `No ${activeTab.toLowerCase()} yet.`
            }
          />
        ) : (
          <>
            {/* Featured Content — creator-curated (own Guides + external links) */}
            <section className="relative">
              {editingHere('featured') ? (
                frame('featured')
              ) : (
                <div className="relative bg-white border border-[#E8EDF2] rounded-[10px] p-5">
                  {pill('featured')}
                  <div className="flex justify-between items-baseline mb-3.5">
                    <h2 className="text-sm font-extrabold text-[#1A1A2E] m-0">Featured Content</h2>
                    {curatedFeatured.length === 0 && isStudio ? (
                      <span className="text-[10px] text-[#9AA0AC] italic">auto — newest content</span>
                    ) : null}
                  </div>
                  {featured.length ? (
                    <div className="grid grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 items-start">
                      {featured.map((item) => {
                        const Card = (
                          <>
                            <div className="aspect-video bg-[#1A1A2E]/10 flex items-center justify-center overflow-hidden">
                              {item.thumbnail ? (
                                <img src={item.thumbnail} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                <span className="text-[10px] font-bold text-[#9AA0AC] uppercase">{item.kind}</span>
                              )}
                            </div>
                            <div className="p-3">
                              <div className="text-[10px] font-extrabold text-[#FF5B00] uppercase mb-1 flex items-center gap-1">
                                {item.kind}
                                {item.external ? <ExternalLink className="w-2.5 h-2.5" /> : null}
                              </div>
                              <div className="text-[12px] font-bold text-[#1A1A2E] line-clamp-2">{item.title}</div>
                              {item.views ? <div className="text-[10px] text-[#9AA0AC] mt-1">{item.views} views</div> : null}
                            </div>
                          </>
                        );
                        return item.url ? (
                          <a
                            key={`${item.kind}-${item.id}`}
                            href={item.url}
                            {...(item.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                            className="block border border-[#E8EDF2] rounded-[10px] overflow-hidden bg-[#F9FAFB] hover:border-[#FF5B00]/40 transition-colors"
                          >
                            {Card}
                          </a>
                        ) : (
                          <div key={`${item.kind}-${item.id}`} className="border border-[#E8EDF2] rounded-[10px] overflow-hidden bg-[#F9FAFB]">
                            {Card}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <EmptyState message={isStudio ? 'Feature your own guides or add external links.' : 'No featured content yet.'} />
                  )}
                  {isStudio && curatedFeatured.length === 0 ? (
                    <DerivedNote>Empty — the profile shows your newest videos/reels/guides until you curate this.</DerivedNote>
                  ) : null}
                </div>
              )}
            </section>

            {/* Expertise & Topics (read-only mirror of Creator Overview) + Latest Reviews (derived) */}
            <section className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-4">
              <div className="relative">
                <div className="relative bg-white border border-[#E8EDF2] rounded-[10px] p-5">
                  <h3 className="text-[13px] font-extrabold text-[#1A1A2E] mb-3.5 m-0">Expertise &amp; Topics</h3>
                  {model.bestForTags.length ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {model.bestForTags.map((tag) => (
                        <div key={tag} className="flex items-center gap-2">
                          <div className="w-[30px] h-[30px] rounded-lg bg-[#F4F7F9] flex items-center justify-center text-[13px] shrink-0">#</div>
                          <div>
                            <div className="text-[11.5px] font-bold text-[#1A1A2E]">{tag}</div>
                            <div className="text-[10px] text-[#9AA0AC]">Topic</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState message={isStudio ? 'Add expertise in Creator Overview' : 'No expertise topics'} />
                  )}
                  {model.platforms.length ? (
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {model.platforms.map((p) => (
                        <span key={p} className="text-[10.5px] font-semibold text-[#4B5563] bg-[#F4F7F9] rounded-full px-2.5 py-1">
                          {p}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {isStudio ? <DerivedNote>Expertise topics and platforms are edited in the Creator Overview section below.</DerivedNote> : null}
                </div>
              </div>
              <div className="bg-white border border-[#E8EDF2] rounded-[10px] p-5">
                <h3 className="text-[13px] font-extrabold text-[#1A1A2E] mb-3.5 m-0">Latest Reviews</h3>
                <EmptyState message="No reviews yet." />
                {isStudio ? <DerivedNote>Community reviews are collected by Choosify and shown read-only.</DerivedNote> : null}
              </div>
            </section>

            {/* Why Follow (derived from editable data) */}
            <section className="choosify-dark-surface rounded-xl px-[30px] py-[26px] text-white overflow-hidden">
              <h3 className="text-sm font-extrabold mb-[18px] m-0">Why Follow {firstName}?</h3>
              {model.collabTypes.length || model.bestForTags.length ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  {(model.collabTypes.length ? model.collabTypes : model.bestForTags).slice(0, 4).map((item) => (
                    <div key={item} className="flex gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-[13px] shrink-0">✦</div>
                      <div>
                        <div className="text-xs font-bold mb-0.5">{item}</div>
                        <div className="text-[10.5px] text-white/50 leading-snug">From creator profile data</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[12px] text-white/60 m-0">
                  {isStudio ? 'Add collaboration types or expertise to populate this section.' : 'No reasons listed yet.'}
                </p>
              )}
            </section>

            {/* Creator Overview (editable — the one canonical bio) + Contact */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                {editingHere('overview') ? (
                  frame('overview')
                ) : (
                  <div className="relative bg-white border border-[#E8EDF2] rounded-[10px] p-[18px]">
                    {pill('overview')}
                    <OverviewCardHeader title="Creator Overview" />
                    <div className="mb-3.5">
                      <div className="text-[11.5px] font-bold text-[#1A1A2E] flex items-center gap-1.5 mb-1">📄 Background &amp; Bio</div>
                      <p className="text-[11px] text-[#4B5563] leading-relaxed m-0 whitespace-pre-wrap">
                        {model.bio || (isStudio ? 'Add a bio.' : 'No bio yet.')}
                      </p>
                    </div>
                    <div className="mb-3.5">
                      <div className="text-[11.5px] font-bold text-[#1A1A2E] flex items-center gap-1.5 mb-1">📁 Areas of Expertise</div>
                      <p className="text-[11px] text-[#4B5563] leading-relaxed m-0">
                        {model.bestForTags.length ? model.bestForTags.join(', ') : isStudio ? 'Add expertise topics.' : 'No expertise listed.'}
                      </p>
                    </div>
                    <div>
                      <div className="text-[11.5px] font-bold text-[#1A1A2E] flex items-center gap-1.5 mb-1">▷ Content Platforms</div>
                      <p className="text-[11px] text-[#4B5563] leading-relaxed m-0">
                        {model.platforms.length ? model.platforms.join(', ') : isStudio ? 'Add the platforms you publish on.' : 'No platforms listed.'}
                      </p>
                    </div>
                    {isStudio ? <DerivedNote>Bio, expertise and platforms save together here. The bio also appears in your profile header.</DerivedNote> : null}
                  </div>
                )}
              </div>
              <div className="relative">
                {editingHere('contact') ? (
                  frame('contact')
                ) : (
                  <div className="relative bg-white border border-[#E8EDF2] rounded-[10px] p-[18px]">
                    {pill('contact')}
                    <OverviewCardHeader title="Contact & Reach" />
                    {(
                      [
                        ['✉', 'Business email', model.email],
                        ['📞', 'Phone', model.phone],
                        ['⏱', 'Response time', model.responseTime],
                        ['💬', 'Preferred contact', model.preferredContact],
                        ['📺', 'Platforms', model.platforms.join(', ')],
                      ] as const
                    ).map(([icon, label, value]) => (
                      <div key={label} className="flex items-start gap-2 mb-3 last:mb-0">
                        <div className="text-xs shrink-0">{icon}</div>
                        <div>
                          <div className="text-[11px] font-bold text-[#1A1A2E]">{label}</div>
                          <div className="text-[11px] text-[#4B5563]">{value || (isStudio ? 'Not set' : '—')}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* Partnerships (editable) */}
            <section className="relative">
              {editingHere('partnerships') ? (
                frame('partnerships')
              ) : (
                <div className="relative bg-white border border-[#E8EDF2] rounded-[10px] p-6">
                  {pill('partnerships')}
                  <OverviewCardHeader title="Partnerships & Collaborations" />
                  <div className="text-[10px] font-bold text-[#9AA0AC] mb-2">TOP BRAND PARTNERS</div>
                  {model.brandPartners.length ? (
                    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2.5 mb-5">
                      {model.brandPartners.map((bp, i) => (
                        <div
                          key={bp.brandId || `${bp.name}-${i}`}
                          className="border border-[#E5E7EB] rounded-md p-3 text-center text-[11px] font-extrabold flex flex-col items-center gap-1.5"
                          style={{ color: bp.color || '#1A1A2E' }}
                        >
                          {bp.logo ? (
                            <img src={bp.logo} alt="" className="w-8 h-8 rounded object-cover" referrerPolicy="no-referrer" />
                          ) : null}
                          {bp.name}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mb-5">
                      <EmptyState message={isStudio ? 'No partnerships added' : 'No brand partners'} />
                    </div>
                  )}
                  <div className="text-[10px] font-bold text-[#9AA0AC] mb-2">COLLABORATION TYPES</div>
                  {model.collabTypes.length ? (
                    <div className="flex flex-wrap gap-2">
                      {model.collabTypes.map((ct) => (
                        <span key={ct} className="bg-[#F4F7F9] text-[10.5px] font-semibold text-[#4B5563] px-3 py-1.5 rounded-full">
                          {ct}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <EmptyState message={isStudio ? 'Add collaboration types' : 'No collaboration types'} />
                  )}
                </div>
              )}
            </section>

            {/* Community (derived) */}
            <section>
              <h2 className="text-sm font-extrabold text-[#1A1A2E] mb-3.5 m-0">What The Community Says</h2>
              <EmptyState message="No reviews yet." />
            </section>
          </>
        )}
      </div>
    </div>
  );
}
