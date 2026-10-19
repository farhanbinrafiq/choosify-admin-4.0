import React from 'react';
import { Check, CheckCircle2, ExternalLink, Pencil, ShieldCheck } from 'lucide-react';
import {
  normalizeTrustScore,
  type CreatorEditSection,
  type CreatorEditorModel,
} from '../../pages/admin/creatorEditorModel';
import { StudioEditPill } from '../studio';

/**
 * Storefront-parity Creator profile. VIEW ≈ the public Creator Profile page;
 * STUDIO mode swaps one section at a time for an inline editor (Save Changes /
 * Cancel). No drawer, no modal, no slide-over. Trust score, followers,
 * verification, media and reviews are platform/relationship-derived and render
 * read-only with no edit affordance. Every value shown comes from the stored
 * profile — anything not recorded renders as an honest empty state, never a
 * placeholder number or name.
 */
export type CreatorStudioBridge = {
  editingSection: CreatorEditSection | null;
  dirty: boolean;
  saving: boolean;
  /** The open section has field errors — Save is disabled until they are fixed. */
  saveBlocked?: boolean;
  onEdit: (k: CreatorEditSection) => void;
  onCancel: () => void;
  onSave: () => void;
  renderEditor: (k: CreatorEditSection) => React.ReactNode;
  /** Where the read-only Guides tab links for managing content. */
  manageGuidesHref?: string;
};

/** One of this creator's own Guides (from Guide Management). */
export type CreatorProfileGuide = { id: string; slug?: string; title: string; image?: string; status?: string };

const SECTION_TITLE: Record<CreatorEditSection, string> = {
  cover: 'Cover Image',
  avatar: 'Profile Photo',
  identity: 'Profile Identity',
  social: 'Social Links',
  expertise: 'Expertise & Topics',
  overview: 'Creator Overview',
  contact: 'Contact & Reach',
  partnerships: 'Partnerships & Collaborations',
  featured: 'Featured Content',
};

/** Section "Edit" pill — the shared Studio pill (Creator keeps its own offset). */
function EditPill({ section, onClick, label }: { section: string; onClick: () => void; label?: string }) {
  return <StudioEditPill section={section} onClick={onClick} label={label} className="absolute top-3 right-3 gap-1.5" />;
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
  const blocked = !!studio.saveBlocked;
  return (
    <div className="relative rounded-xl bg-white border border-[#E8EDF2] p-4 sm:p-5" data-testid="creator-inline-editor">
      <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#9AA0AC] mb-3">
        Editing — {title}
      </div>
      {children}
      <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-[#F1F1F3]">
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
          disabled={studio.saving || blocked}
          className="px-4 py-2 rounded-lg text-[11px] font-extrabold text-white bg-[#EF3C23] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {studio.saving ? 'Saving…' : 'Save Changes'}
        </button>
        {blocked ? (
          <span className="text-[10px] font-semibold text-[#DC2626]">Fix the highlighted fields to save</span>
        ) : studio.dirty ? (
          <span className="text-[10px] text-[#9AA0AC] italic">Unsaved changes</span>
        ) : null}
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
      <div className="w-8 h-8 rounded-lg bg-[#FFF3EA] text-[#EF3C23] flex items-center justify-center shrink-0">
        <CheckCircle2 size={16} fill="currentColor" className="text-[#EF3C23] stroke-white" />
      </div>
      <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-[#1A1A2E] m-0">{title}</h3>
    </div>
  );
}

/** Only absolute http(s) links are ever rendered as hrefs. */
const isSafeHref = (url: string | undefined): url is string => !!url && /^https?:\/\//i.test(url.trim());

/**
 * Creator-only status strip (mirrors Brand Studio's seller strip): lifecycle status and
 * verification, from platform-owned fields. Studio-only — never part of the public profile.
 */
function CreatorStudioStatusStrip({ model }: { model: CreatorEditorModel }) {
  const status =
    model.status === 'LIVE'
      ? { value: 'Live', cls: 'bg-[#DCFCE7] text-[#166534]' }
      : model.status === 'ARCHIVED'
        ? { value: 'Archived', cls: 'bg-[#F3F4F6] text-[#6B7280]' }
        : { value: 'Draft', cls: 'bg-[#FEF3C7] text-[#92400E]' };
  return (
    <div className="mb-4 rounded-xl border border-[#E8EDF2] bg-[#FBFCFE] px-4 py-3" data-testid="creator-status-strip">
      <div className="mb-2 text-[9.5px] font-extrabold uppercase tracking-wider text-[#9AA0AC]">
        Creator status · owner &amp; Choosify staff only — not shown on the public creator profile
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E8EDF2] bg-white px-2.5 py-1 text-[10px] font-bold text-[#6B7280]">
          Profile
          <span className={`rounded-full px-1.5 py-0.5 text-[9.5px] font-extrabold uppercase ${status.cls}`}>{status.value}</span>
        </span>
        <span
          className={`inline-flex items-center rounded-full px-2 py-1 text-[9.5px] font-extrabold uppercase ${
            model.verified ? 'bg-[#EEF2FF] text-[#2323FF]' : 'bg-[#F3F4F6] text-[#6B7280]'
          }`}
        >
          {model.verified ? 'Verified creator' : 'Not verified by Choosify yet'}
        </span>
      </div>
      {model.status !== 'LIVE' ? (
        <p className="mt-2 mb-0 text-[10.5px] font-semibold text-[#92400E]">
          This profile is not public yet — only its owner and Choosify can see it.
        </p>
      ) : null}
    </div>
  );
}

export function CreatorProfilePresentation({
  model,
  mode = 'view',
  studio,
  publicHandle,
  guides = [],
}: {
  model: CreatorEditorModel;
  mode?: 'view' | 'studio';
  studio?: CreatorStudioBridge;
  /** The approved public username (Public Identity), without "@". */
  publicHandle?: string | null;
  /** This creator's own Guides (all statuses; only LIVE ones count publicly). */
  guides?: CreatorProfileGuide[];
}) {
  const isStudio = mode === 'studio' && !!studio;
  const trust = normalizeTrustScore(model.score);
  const initial = String(model.name || 'C')
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  // Only the registered public username (Public Identity) — the same rule as the storefront.
  const handle = publicHandle ? `@${publicHandle.replace(/^@/, '')}` : '';
  const liveGuides = guides.filter((g) => (g.status || '').toLowerCase() === 'live');
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
  ).filter((e): e is readonly [string, string] => !!e[0] && isSafeHref(e[1]));

  const bestFor = model.bestFor || model.bestForTags[0] || '';
  const infoFacts = [
    { icon: '📝', label: 'Guides', value: String(liveGuides.length) },
    { icon: '📹', label: 'Videos', value: String(model.videos.length) },
    { icon: '✦', label: 'Reels', value: String(model.reels.length) },
    { icon: '♥', label: 'Followers', value: model.followerTotal || '0' },
    { icon: '★', label: 'Trust', value: trust > 0 ? String(trust) : '—' },
    { icon: '🎯', label: 'Best for', value: bestFor || '—' },
  ];

  const editingId = isStudio ? studio!.editingSection : null;
  const editingHere = (k: CreatorEditSection) => editingId === k;
  const pill = (k: CreatorEditSection, label?: string) =>
    isStudio && !editingHere(k) ? <EditPill section={SECTION_TITLE[k]} onClick={() => studio!.onEdit(k)} label={label} /> : null;
  const frame = (k: CreatorEditSection) => (
    <CreatorInlineEditFrame title={SECTION_TITLE[k]} studio={studio!}>
      {studio!.renderEditor(k)}
    </CreatorInlineEditFrame>
  );
  const heroEditing = editingHere('cover') ? 'cover' : editingHere('avatar') ? 'avatar' : null;

  // Contact & Reach: only the methods the creator added, in their order of importance.
  const linkFor = (v: string): string | undefined => {
    const t = v.trim();
    if (/^(https?:\/\/|mailto:|tel:)/i.test(t)) return t;
    return undefined;
  };
  const contactRows = [
    model.email ? { key: 'email', icon: '✉', label: 'Business email', value: model.email, href: `mailto:${model.email}` } : null,
    model.phone ? { key: 'phone', icon: '📞', label: 'Phone', value: model.phone, href: `tel:${model.phone.replace(/[^+0-9]/g, '')}` } : null,
    ...(model.customContacts || []).map((c, i) => ({ key: `c-${i}`, icon: '💬', label: c.label, value: c.value, href: linkFor(c.value) })),
    model.responseTime ? { key: 'rt', icon: '⏱', label: 'Response time', value: model.responseTime, href: undefined } : null,
    model.preferredContact ? { key: 'pc', icon: '⭐', label: 'Preferred contact', value: model.preferredContact, href: undefined } : null,
  ].filter(Boolean) as Array<{ key: string; icon: string; label: string; value: string; href?: string }>;


  return (
    <div className="bg-[#F0F8FF] text-[#1A1A2E] overflow-hidden">
      {/* Cover + profile photo — each its own section (Brand Studio pattern) */}
      <div className="w-full px-5 sm:px-8 lg:px-10 pt-4 relative">
        <div className="max-w-[1180px] mx-auto relative">
          <CreatorStudioStatusStrip model={model} />
          {heroEditing ? (
            <div className="pb-2">{frame(heroEditing)}</div>
          ) : (
            <>
              <div
                className={`relative h-[220px] sm:h-[280px] md:h-[320px] overflow-hidden rounded-none ${
                  model.coverImage || !isStudio ? 'choosify-dark-surface' : 'bg-[#F1F3F5] border border-dashed border-[#D9DEE7]'
                }`}
                data-testid="creator-cover"
              >
                {pill('cover')}
                {model.coverImage ? (
                  <img src={model.coverImage} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : isStudio ? (
                  <div className="w-full h-full flex items-center justify-center text-[11px] text-[#6B7280] font-semibold">
                    Add a creator cover image
                  </div>
                ) : null}
                {model.coverImage ? <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" /> : null}
              </div>
              <div className="absolute left-1/2 top-full -translate-x-1/2 -translate-y-[60px] w-[100px] h-[100px] md:w-[120px] md:h-[120px] z-[5]">
                <div className="w-full h-full rounded-full bg-[#1A1A2E] border-[5px] border-white shadow-[0_16px_36px_rgba(0,0,0,0.28),0_0_0_4px_rgba(7,208,80,0.18)] overflow-hidden flex items-center justify-center text-white text-[30px] font-extrabold">
                  {model.avatar ? (
                    <img src={model.avatar} alt={model.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    initial
                  )}
                </div>
                {isStudio ? (
                  <button
                    type="button"
                    onClick={() => studio!.onEdit('avatar')}
                    title="Upload / change profile photo"
                    aria-label="Edit Profile Photo"
                    data-testid="creator-avatar-edit"
                    className="absolute -bottom-1 -right-1 z-10 inline-flex items-center gap-1 rounded-full border-2 border-white bg-[#EF3C23] px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-wide text-white shadow-md hover:bg-[#CF3319] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2323FF] focus-visible:ring-offset-2"
                  >
                    <Pencil className="h-3 w-3" aria-hidden="true" /> Photo
                  </button>
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="max-w-[1180px] mx-auto px-5 sm:px-8 lg:px-10 pb-6">
        {/* Identity + social */}
        <div className={`relative ${heroEditing ? 'mt-6' : 'mt-[74px]'} mb-6`}>
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
                {model.title ? (
                  <div className="text-[13px] text-[#2323FF] font-semibold">{model.title}</div>
                ) : isStudio ? (
                  <div className="text-[13px] text-[#9AA0AC] font-semibold">Add a creator title</div>
                ) : null}
                {handle || model.location || isStudio ? (
                  <div className="text-[12.5px] text-[#9AA0AC] mb-2.5 break-words" data-testid="creator-handle-line">
                    {[handle || (isStudio ? 'No username yet — set one in Identity' : ''), model.location || (isStudio ? 'Add location' : '')]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                ) : null}
                {model.verified ? (
                  <div className="inline-flex items-center gap-1.5 text-[10px] font-bold text-[#2323FF] mb-2">
                    <ShieldCheck size={12} /> Verified Creator
                  </div>
                ) : null}

                {/* Social — its own editable section */}
                <div
                  className={`relative mt-2.5 min-h-[30px] ${
                    isStudio && !editingHere('social')
                      ? 'rounded-lg border border-dashed border-[#E8EDF2] px-3 pt-11 pb-3 lg:pt-3 lg:pr-28 lg:min-h-[48px]'
                      : ''
                  }`}
                  data-testid="creator-social"
                >
                  {editingHere('social') ? (
                    <div className="text-left">{frame('social')}</div>
                  ) : (
                    <>
                      {pill('social', 'Social')}
                      <div className="flex flex-wrap gap-2 justify-center lg:justify-start">
                        {socialEntries.length ? (
                          socialEntries.map(([label, url]) => (
                            <a
                              key={`${label}-${url}`}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1.5 rounded-full border border-[#E8EDF2] bg-white text-[11px] font-bold text-[#1A1A2E] max-w-full truncate"
                            >
                              {label}
                            </a>
                          ))
                        ) : (
                          <span className="text-[11px] text-[#9AA0AC]">No social links added yet.</span>
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
                  <p className="text-[12.5px] text-[#9AA0AC] mt-3 m-0">Add a bio in Creator Overview.</p>
                ) : null}
              </div>

              {/* Owner view (Brand Studio pattern): the real recorded follower count; Follow /
                  Message / Share are shopper actions that only exist on the storefront. */}
              <div className="flex justify-center lg:justify-end lg:mt-[52px] shrink-0 w-full lg:w-auto">
                <span
                  className="inline-flex items-center gap-1.5 bg-[#EEF0FF] text-[#2323FF] border border-[#D9DCFF] px-[18px] py-2.5 rounded-lg text-xs font-bold"
                  data-testid="creator-follower-count"
                >
                  ♥ {model.followerTotal || '0'} Follower{model.followerTotal === '1' ? '' : 's'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Trust (derived) + Creator info (derived) */}
        <div className="flex flex-col md:flex-row gap-4 mb-2">
          <div className="bg-white border border-[#E8EDF2] rounded-[10px] p-5 md:w-[300px] shadow-[0_2px_10px_rgba(0,0,0,0.03)] shrink-0">
            <div className="text-[11px] font-extrabold text-[#9AA0AC] tracking-wide mb-2.5">TRUST SCORE</div>
            <div className="flex items-baseline gap-2 mb-2">
              <div className="text-[30px] font-extrabold text-[#1A1A2E]">{trust > 0 ? trust : '—'}</div>
              <div className="text-[11.5px] text-[#9AA0AC]">/5</div>
            </div>
            <p className="text-[11px] text-[#9AA0AC] m-0">
              {trust > 0 ? 'Calculated by Choosify.' : 'No trust score yet.'}
            </p>
            {isStudio ? <DerivedNote>Trust Score is calculated by Choosify — not editable here.</DerivedNote> : null}
          </div>

          <div className="bg-white border border-[#E8EDF2] rounded-[10px] p-5 flex-1 shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
            <div className="text-[11px] font-extrabold text-[#9AA0AC] tracking-wide mb-4">CREATOR INFO</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-5">
              {infoFacts.map((f) => (
                <div key={f.label} className="flex items-center gap-2.5 min-w-0">
                  <div className="w-[34px] h-[34px] rounded-lg bg-[#F4F7F9] flex items-center justify-center text-sm shrink-0">
                    {f.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[15px] font-extrabold text-[#1A1A2E] truncate">{f.value}</div>
                    <div className="text-[10.5px] text-[#9AA0AC]">{f.label}</div>
                  </div>
                </div>
              ))}
            </div>
            {isStudio ? (
              <DerivedNote>
                Guides counts your live guides. Followers and Trust are recorded by Choosify; “—” means no trust score
                yet.
              </DerivedNote>
            ) : null}
          </div>
        </div>
      </div>

      {/* No storefront tab bar here: Guides, Reviews and Deals are managed in their own Studio pages
          (Guide Management, Reviews, Ads & Deals Studio) — this page is only the editable profile. */}
      <div className="max-w-[1180px] mx-auto px-5 sm:px-8 lg:px-10 py-6 w-full space-y-8 pb-10">
          <>
            {/* Featured Content — creator-curated (own Guides + external links) */}
            <section className="relative">
              {editingHere('featured') ? (
                frame('featured')
              ) : (
                <div className="relative bg-white border border-[#E8EDF2] rounded-[10px] p-5">
                  {pill('featured')}
                  <div className="flex justify-between items-baseline mb-3.5 pr-16">
                    <h2 className="text-sm font-extrabold text-[#1A1A2E] m-0">Featured Content</h2>
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
                              <div className="text-[10px] font-extrabold text-[#EF3C23] uppercase mb-1 flex items-center gap-1">
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
                            className="block border border-[#E8EDF2] rounded-[10px] overflow-hidden bg-[#F9FAFB] hover:border-[#EF3C23]/40 transition-colors"
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
                  {isStudio && curatedFeatured.length === 0 && featured.length ? (
                    <DerivedNote>Not curated — showing your newest videos and reels until you pick featured items.</DerivedNote>
                  ) : null}
                </div>
              )}
            </section>

            {/* Expertise & Topics (editable in place) + Latest Reviews (community-written, read-only) */}
            <section className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-4">
              <div className="relative">
                {editingHere('expertise') ? (
                  frame('expertise')
                ) : (
                <div className="relative bg-white border border-[#E8EDF2] rounded-[10px] p-5">
                  {pill('expertise')}
                  <h3 className="text-[13px] font-extrabold text-[#1A1A2E] mb-3.5 m-0 pr-16">Expertise &amp; Topics</h3>
                  {model.bestForTags.length ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {model.bestForTags.map((tag) => (
                        <div key={tag} className="flex items-center gap-2 min-w-0">
                          <div className="w-[30px] h-[30px] rounded-lg bg-[#F4F7F9] flex items-center justify-center text-[13px] shrink-0">#</div>
                          <div className="min-w-0">
                            <div className="text-[11.5px] font-bold text-[#1A1A2E] break-words">{tag}</div>
                            <div className="text-[10px] text-[#9AA0AC]">Topic</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState message={isStudio ? 'No expertise topics yet — use Edit to add them.' : 'No expertise topics yet.'} />
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
                </div>
                )}
              </div>
              <div className="relative bg-white border border-[#E8EDF2] rounded-[10px] p-5">
                <div className="flex items-center justify-between gap-2 mb-3.5">
                  <h3 className="text-[13px] font-extrabold text-[#1A1A2E] m-0">Latest Reviews</h3>
                  {isStudio ? (
                    <span className="rounded-full bg-[#F3F4F6] px-2 py-0.5 text-[9.5px] font-extrabold uppercase text-[#6B7280]" title="Reviews are written by the community and can't be edited by the creator">
                      Read-only
                    </span>
                  ) : null}
                </div>
                <EmptyState message="No reviews yet." />
                {isStudio ? <DerivedNote>Community reviews are collected by Choosify and shown read-only.</DerivedNote> : null}
              </div>
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
                    <div className="mb-3.5 last:mb-0">
                      <div className="text-[11.5px] font-bold text-[#1A1A2E] flex items-center gap-1.5 mb-1">📄 Background &amp; Bio</div>
                      <p className={`text-[11px] leading-relaxed m-0 whitespace-pre-wrap ${model.bio ? 'text-[#4B5563]' : 'text-[#9AA0AC]'}`}>
                        {model.bio || (isStudio ? 'Add a bio.' : 'No bio yet.')}
                      </p>
                    </div>
                    {(model.overviewSections || []).map((o) => (
                      <div key={o.id} className="mb-3.5 last:mb-0 rounded-lg bg-[#F9FAFB] border border-[#F1F1F3] px-3 py-2.5" data-testid="creator-overview-section">
                        <div className="text-[11.5px] font-bold text-[#1A1A2E] mb-1 break-words">{o.title}</div>
                        <p className="text-[11px] text-[#4B5563] leading-relaxed m-0 whitespace-pre-wrap break-words">{o.body}</p>
                      </div>
                    ))}
                    {isStudio && !(model.overviewSections || []).length ? (
                      <DerivedNote>Add your own sections — Experience, How I review, Equipment &amp; setup… — with Edit.</DerivedNote>
                    ) : null}
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
                    {contactRows.length ? (
                      contactRows.map((r) => (
                        <div key={r.key} className="flex items-start gap-2 mb-3 last:mb-0 min-w-0">
                          <div className="text-xs shrink-0">{r.icon}</div>
                          <div className="min-w-0">
                            <div className="text-[11px] font-bold text-[#1A1A2E]">{r.label}</div>
                            {r.href ? (
                              <a
                                href={r.href}
                                {...(/^https?:/i.test(r.href) ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                                className="text-[11px] text-[#2323FF] break-words hover:underline"
                              >
                                {r.value}
                              </a>
                            ) : (
                              <div className="text-[11px] text-[#4B5563] break-words">{r.value}</div>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-[11px] text-[#9AA0AC] m-0">
                        {isStudio ? 'No contact details yet — use Edit to add the ways brands can reach you.' : 'No contact details added yet.'}
                      </p>
                    )}
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
                          className="border border-[#E5E7EB] rounded-md p-3 text-center text-[11px] font-extrabold flex flex-col items-center gap-1.5 min-w-0 break-words"
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
                      <EmptyState message={isStudio ? 'No partnerships added yet' : 'No brand partners yet.'} />
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
                    <EmptyState message={isStudio ? 'Add collaboration types' : 'No collaboration types yet.'} />
                  )}
                </div>
              )}
            </section>

          </>
      </div>
    </div>
  );
}
