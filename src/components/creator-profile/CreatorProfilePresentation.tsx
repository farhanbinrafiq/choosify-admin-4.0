import React, { useState } from 'react';
import {
  Check,
  CheckCircle2,
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

function OverviewCardHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-4 border-b border-[#F1F1F3] pb-3">
      <div className="w-8 h-8 rounded-lg bg-[#FFF3EA] text-[#EB4501] flex items-center justify-center shrink-0">
        <CheckCircle2 size={16} fill="currentColor" className="text-[#EB4501] stroke-white" />
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
  mode = 'editor',
  onEditSection,
}: {
  model: CreatorEditorModel;
  mode?: 'public' | 'editor';
  onEditSection?: (section: CreatorEditSection) => void;
}) {
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>('Overview');
  const trust = normalizeTrustScore(model.score);
  const initial = String(model.name || 'C')
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const handle = model.handle || (model.name ? `@${model.name.toLowerCase().replace(/\s+/g, '')}` : '@creator');
  const firstName = (model.name || 'Creator').split(/\s+/)[0];
  const featured = [...model.videos, ...model.reels, ...model.blogs].slice(0, 4);
  const socialEntries = (
    [
      ['Facebook', model.socialLinks.facebook],
      ['Instagram', model.socialLinks.instagram],
      ['YouTube', model.socialLinks.youtube],
      ['LinkedIn', model.socialLinks.linkedin],
      ['TikTok', model.socialLinks.tiktok],
    ] as const
  ).filter(([, url]) => !!url);

  const infoFacts = [
    { icon: '📹', label: 'Videos', value: String(model.videos.length || '—') },
    { icon: '✦', label: 'Reels', value: String(model.reels.length || '—') },
    { icon: '✍', label: 'Blogs', value: String(model.blogs.length || '—') },
    { icon: '♥', label: 'Followers', value: model.followerTotal || '—' },
    { icon: '★', label: 'Trust', value: trust > 0 ? String(trust) : '—' },
    { icon: '🏷', label: 'Best for', value: model.bestFor || model.bestForTags[0] || '—' },
  ];

  const isEditor = mode === 'editor' && !!onEditSection;

  return (
    <div className="bg-[#F0F8FF] text-[#1A1A2E] overflow-hidden">
      {/* Cover + avatar — Web CreatorProfileHero silhouette */}
      <div className="w-full px-5 sm:px-8 lg:px-10 pt-4 relative">
        {isEditor ? <EditChip label="Cover" onClick={() => onEditSection!('cover')} /> : null}
        <div className="max-w-[1180px] mx-auto relative">
          <div className="relative h-[220px] sm:h-[280px] md:h-[320px] overflow-hidden choosify-dark-surface rounded-none">
            {model.coverImage ? (
              <img src={model.coverImage} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[12px] text-white/50 font-semibold">
                {isEditor ? 'Add cover image' : 'No cover image'}
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          </div>
          <div className="absolute left-1/2 top-full -translate-x-1/2 -translate-y-[60px] w-[100px] h-[100px] md:w-[120px] md:h-[120px] z-[5]">
            <div className="w-full h-full rounded-full bg-[#1A1A2E] border-[5px] border-white shadow-[0_16px_36px_rgba(0,0,0,0.28),0_0_0_4px_rgba(7,208,80,0.18)] overflow-hidden flex items-center justify-center text-white text-[30px] font-extrabold">
              {model.avatar ? (
                <img
                  src={model.avatar}
                  alt={model.name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                initial
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1180px] mx-auto px-5 sm:px-8 lg:px-10 pb-6">
        <div className="relative flex flex-col lg:flex-row justify-between items-start gap-6 mt-[74px] mb-6">
          {isEditor ? <EditChip label="Identity" onClick={() => onEditSection!('identity')} /> : null}
          <div className="flex-1 min-w-0 text-center lg:text-left w-full">
            <div className="text-[22px] font-extrabold text-[#1A1A2E] flex items-center justify-center lg:justify-start gap-2 flex-wrap">
              {model.name || 'Untitled Creator'}
              {model.verified ? (
                <span className="inline-flex text-[#2323FF]" title="Verified">
                  <Check size={18} strokeWidth={3} />
                </span>
              ) : null}
            </div>
            <div className="text-[13px] text-[#2323FF] font-semibold">
              {model.title || (isEditor ? 'Add creator title' : 'Creator')}
            </div>
            <div className="text-[12.5px] text-[#9AA0AC] mb-2.5">
              {handle}
              {model.location ? ` · ${model.location}` : isEditor ? ' · Add location' : ''}
            </div>
            {model.verified ? (
              <div className="inline-flex items-center gap-1.5 text-[10px] font-bold text-[#2323FF] mb-2">
                <ShieldCheck size={12} /> Verified Creator
              </div>
            ) : (
              <div className="text-[10px] font-bold text-[#9AA0AC] mb-2">Community creator profile</div>
            )}

            <div className="relative mt-2.5 flex flex-wrap gap-2 justify-center lg:justify-start">
              {isEditor ? (
                <button
                  type="button"
                  onClick={() => onEditSection!('social')}
                  className="absolute -top-1 right-0 text-[10px] font-extrabold text-[#EF3C23] uppercase bg-transparent border-0 cursor-pointer"
                >
                  Edit social
                </button>
              ) : null}
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
                  {isEditor ? 'Add social links' : 'No social links'}
                </span>
              )}
            </div>

            {model.bio ? (
              <p className="text-[12.5px] text-[#4B5563] max-w-xl mx-auto lg:mx-0 leading-relaxed mt-3 m-0">
                {model.bio}
              </p>
            ) : isEditor ? (
              <p className="text-[12.5px] text-[#9AA0AC] mt-3 m-0">Add a bio for the storefront profile.</p>
            ) : null}
          </div>

          <div className="flex gap-2.5 flex-wrap justify-center lg:justify-end lg:mt-[52px] shrink-0 w-full lg:w-auto">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 bg-[#2323FF] text-white border border-[#2323FF] px-[18px] py-2.5 rounded-lg text-xs font-bold"
            >
              Follow
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 bg-white text-[#1A1A2E] border border-[#E5E7EB] px-[18px] py-2.5 rounded-lg text-xs font-semibold"
            >
              <MessageCircleMore size={13} className="text-[#EB4501]" /> Message
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 bg-white text-[#1A1A2E] border border-[#E5E7EB] px-[18px] py-2.5 rounded-lg text-xs font-semibold"
            >
              <Share2 size={13} /> Share
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 bg-white text-[#1A1A2E] border border-[#E5E7EB] px-[18px] py-2.5 rounded-lg text-xs font-semibold"
            >
              <Heart size={13} /> Love
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 bg-white text-[#1A1A2E] border border-[#E5E7EB] px-[18px] py-2.5 rounded-lg text-xs font-semibold"
            >
              <Sparkles size={13} /> Ask For Branding
            </button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-2">
          <div className="bg-white border border-[#E8EDF2] rounded-[10px] p-5 md:w-[300px] shadow-[0_2px_10px_rgba(0,0,0,0.03)] shrink-0">
            <div className="text-[11px] font-extrabold text-[#9AA0AC] tracking-wide mb-2.5">TRUST SCORE</div>
            <div className="flex items-baseline gap-2 mb-4">
              <div className="text-[30px] font-extrabold text-[#1A1A2E]">{trust > 0 ? trust : '—'}</div>
              <div className="text-[11.5px] text-[#9AA0AC]">/5 · from catalog score</div>
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
          </div>

          <div className="bg-white border border-[#E8EDF2] rounded-[10px] p-5 flex-1 shadow-[0_2px_10px_rgba(0,0,0,0.03)] relative">
            {isEditor ? <EditChip onClick={() => onEditSection!('identity')} /> : null}
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
                    ? 'text-[#07DD05] border-[#07DD05]'
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
        {activeTab !== 'Overview' ? (
          <EmptyState
            message={
              activeTab === 'Guides' && model.blogs.length === 0
                ? 'No guides yet.'
                : activeTab === 'Videos' && model.videos.length + model.reels.length === 0
                  ? 'No videos yet.'
                  : `${activeTab} content uses the Overview canvas in Creator Visual Builder for now.`
            }
          />
        ) : (
          <>
            {/* Featured Content */}
            <section className="bg-white border border-[#E8EDF2] rounded-[10px] p-5 relative">
              <div className="flex justify-between items-baseline mb-3.5">
                <h2 className="text-sm font-extrabold text-[#1A1A2E] m-0">Featured Content</h2>
              </div>
              {featured.length ? (
                <div className="grid grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 items-start">
                  {featured.map((item) => (
                    <div
                      key={`${item.kind}-${item.id}`}
                      className="border border-[#E8EDF2] rounded-[10px] overflow-hidden bg-[#F9FAFB]"
                    >
                      <div className="aspect-video bg-[#1A1A2E]/10 flex items-center justify-center overflow-hidden">
                        {item.thumbnail ? (
                          <img src={item.thumbnail} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[10px] font-bold text-[#9AA0AC] uppercase">{item.kind}</span>
                        )}
                      </div>
                      <div className="p-3">
                        <div className="text-[10px] font-extrabold text-[#EB4501] uppercase mb-1">{item.kind}</div>
                        <div className="text-[12px] font-bold text-[#1A1A2E] line-clamp-2">{item.title}</div>
                        {item.views ? (
                          <div className="text-[10px] text-[#9AA0AC] mt-1">{item.views} views</div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState message={isEditor ? 'No featured content yet' : 'No featured content'} />
              )}
            </section>

            {/* Expertise + Latest Reviews */}
            <section className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-4">
              <div className="bg-white border border-[#E8EDF2] rounded-[10px] p-5 relative">
                {isEditor ? <EditChip onClick={() => onEditSection!('expertise')} /> : null}
                <h3 className="text-[13px] font-extrabold text-[#1A1A2E] mb-3.5 m-0">Expertise & Topics</h3>
                {model.bestForTags.length ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {model.bestForTags.map((tag) => (
                      <div key={tag} className="flex items-center gap-2">
                        <div className="w-[30px] h-[30px] rounded-lg bg-[#F4F7F9] flex items-center justify-center text-[13px] shrink-0">
                          #
                        </div>
                        <div>
                          <div className="text-[11.5px] font-bold text-[#1A1A2E]">{tag}</div>
                          <div className="text-[10px] text-[#9AA0AC]">Topic</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState message={isEditor ? 'Add expertise' : 'No expertise topics'} />
                )}
              </div>
              <div className="bg-white border border-[#E8EDF2] rounded-[10px] p-5">
                <h3 className="text-[13px] font-extrabold text-[#1A1A2E] mb-3.5 m-0">Latest Reviews</h3>
                {model.videos.length ? (
                  <div className="space-y-0">
                    {model.videos.slice(0, 3).map((v, i) => (
                      <div
                        key={v.id}
                        className={`flex items-center gap-2.5 py-2.5 ${
                          i < Math.min(2, model.videos.length - 1) ? 'border-b border-[#F1F1F3]' : ''
                        }`}
                      >
                        <div className="text-[11px] font-bold text-[#9AA0AC] w-3.5">{i + 1}</div>
                        <div className="w-[34px] h-[34px] rounded-md overflow-hidden shrink-0 bg-[#F4F7F9]">
                          {v.thumbnail ? (
                            <img src={v.thumbnail} alt="" className="w-full h-full object-cover" />
                          ) : null}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[11.5px] font-bold text-[#1A1A2E] truncate">{v.title}</div>
                          <div className="text-[10px] text-[#9AA0AC]">Creator video</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState message="No latest reviews yet" />
                )}
              </div>
            </section>

            {/* Why Follow */}
            <section className="choosify-dark-surface rounded-xl px-[30px] py-[26px] text-white overflow-hidden relative">
              <h3 className="text-sm font-extrabold mb-[18px] m-0">Why Follow {firstName}?</h3>
              {model.collabTypes.length || model.bestForTags.length ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  {(model.collabTypes.length ? model.collabTypes : model.bestForTags).slice(0, 4).map((item) => (
                    <div key={item} className="flex gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-[13px] shrink-0">
                        ✦
                      </div>
                      <div>
                        <div className="text-xs font-bold mb-0.5">{item}</div>
                        <div className="text-[10.5px] text-white/50 leading-snug">From creator profile data</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[12px] text-white/60 m-0">
                  {isEditor ? 'Add collaboration types or expertise to populate this section.' : 'No reasons listed yet.'}
                </p>
              )}
            </section>

            {/* Overview + Contact */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white border border-[#E8EDF2] rounded-[10px] p-[18px] relative">
                {isEditor ? <EditChip onClick={() => onEditSection!('overview')} /> : null}
                <OverviewCardHeader title="Creator Overview" />
                <div className="mb-3.5">
                  <div className="text-[11.5px] font-bold text-[#1A1A2E] flex items-center gap-1.5 mb-1">
                    📄 Background & Bio
                  </div>
                  <p className="text-[11px] text-[#4B5563] leading-relaxed m-0">
                    {model.bio || (isEditor ? 'Add overview bio' : 'No bio yet.')}
                  </p>
                </div>
                <div>
                  <div className="text-[11.5px] font-bold text-[#1A1A2E] flex items-center gap-1.5 mb-1">
                    📁 Areas of Expertise
                  </div>
                  <p className="text-[11px] text-[#4B5563] leading-relaxed m-0">
                    {model.bestForTags.length
                      ? model.bestForTags.join(', ')
                      : isEditor
                        ? 'Add expertise'
                        : 'No expertise listed.'}
                  </p>
                </div>
              </div>
              <div className="bg-white border border-[#E8EDF2] rounded-[10px] p-[18px] relative">
                {isEditor ? <EditChip onClick={() => onEditSection!('contact')} /> : null}
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
                      <div className="text-[11px] text-[#4B5563]">
                        {value || (isEditor ? 'Not set' : '—')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Partnerships */}
            <section className="bg-white border border-[#E8EDF2] rounded-[10px] p-6 relative">
              {isEditor ? <EditChip onClick={() => onEditSection!('partnerships')} /> : null}
              <OverviewCardHeader title="Partnerships & Collaborations" />
              <div className="text-[10px] font-bold text-[#9AA0AC] mb-2">TOP BRAND PARTNERS</div>
              {model.brandPartners.length ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2.5 mb-5">
                  {model.brandPartners.map((bp) => (
                    <div
                      key={bp.name}
                      className="border border-[#E5E7EB] rounded-md p-3 text-center text-[11px] font-extrabold"
                      style={{ color: bp.color || '#1A1A2E' }}
                    >
                      {bp.name}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mb-5">
                  <EmptyState message={isEditor ? 'No partnerships added' : 'No brand partners'} />
                </div>
              )}
              <div className="text-[10px] font-bold text-[#9AA0AC] mb-2">COLLABORATION TYPES</div>
              {model.collabTypes.length ? (
                <div className="flex flex-wrap gap-2">
                  {model.collabTypes.map((ct) => (
                    <span
                      key={ct}
                      className="bg-[#F4F7F9] text-[10.5px] font-semibold text-[#4B5563] px-3 py-1.5 rounded-full"
                    >
                      {ct}
                    </span>
                  ))}
                </div>
              ) : (
                <EmptyState message={isEditor ? 'Add collaboration types' : 'No collaboration types'} />
              )}
            </section>

            {/* Community */}
            <section>
              <h2 className="text-sm font-extrabold text-[#1A1A2E] mb-3.5 m-0">What The Community Says</h2>
              <EmptyState message="No reviews yet. Community reviews stay read-only here." />
            </section>
          </>
        )}
      </div>
    </div>
  );
}
