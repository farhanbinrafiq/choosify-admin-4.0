import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Circle } from 'lucide-react';
import type { CatalogBrand, CatalogCreator } from '../../types/catalog';

/**
 * Profile completion for an owner's own Brand / Creator profile: a score plus
 * exactly what is still missing and where to add it. Shown in the owner's
 * dashboard only (never on the public storefront).
 */
export type CompletionItem = { key: string; label: string; done: boolean; hint: string; to?: string };

const SOCIAL_KEYS = ['facebook', 'instagram', 'youtube', 'linkedin', 'tiktok'] as const;
const hasSocial = (links: unknown) => {
  const l = (links || {}) as Record<string, unknown>;
  return SOCIAL_KEYS.some((k) => typeof l[k] === 'string' && (l[k] as string).trim()) || (Array.isArray(l.custom) && l.custom.length > 0);
};

export function brandCompletionItems(b: CatalogBrand): CompletionItem[] {
  const studio = `/admin/brand-studio/${encodeURIComponent(b.id)}/edit`;
  const ov = b.overview || {};
  return [
    { key: 'logo', label: 'Logo', done: !!b.logo && /^(https?:\/\/|\/)/.test(b.logo), hint: 'Brand Studio → Logo', to: studio },
    { key: 'cover', label: 'Cover image', done: !!b.coverImage, hint: 'Brand Studio → Cover image', to: studio },
    { key: 'description', label: 'Description (40+ characters)', done: (b.description?.trim().length || 0) >= 40, hint: 'Brand Studio → About', to: studio },
    { key: 'category', label: 'Category', done: !!b.category, hint: 'Brand Studio → Category', to: studio },
    { key: 'tags', label: 'Best for #tags', done: (ov.tags?.length || 0) >= 1, hint: 'Brand Studio → Best-for tags', to: studio },
    { key: 'price', label: 'Price range', done: !!ov.priceRange?.trim(), hint: 'Brand Studio → Price range', to: studio },
    { key: 'location', label: 'Address / location', done: !!ov.address?.trim(), hint: 'Brand Studio → Contact & location', to: studio },
    { key: 'contact', label: 'Contact email or phone', done: !!ov.email?.trim() || !!ov.phone?.trim(), hint: 'Brand Studio → Contact & location', to: studio },
    { key: 'online', label: 'Website or social link', done: !!b.website?.trim() || hasSocial(b.socialLinks), hint: 'Brand Studio → Website & social links', to: studio },
    {
      key: 'verified',
      label: 'Documents verified',
      done: b.verifiedStatus === true,
      hint: 'Upload every required document in Verification Center and submit — the Verified badge appears once Choosify approves them',
      to: '/admin/brand-profile?tab=verification',
    },
  ];
}

export function creatorCompletionItems(c: CatalogCreator | null): CompletionItem[] {
  const studio = '/admin/creator-studio';
  return [
    { key: 'avatar', label: 'Profile photo', done: !!c?.avatar, hint: 'Creator Studio → Profile Photo', to: studio },
    { key: 'cover', label: 'Cover image', done: !!c?.coverImage, hint: 'Creator Studio → Cover Image', to: studio },
    { key: 'bio', label: 'Bio (40+ characters)', done: (c?.bio?.trim().length || 0) >= 40, hint: 'Creator Studio → Creator Overview', to: studio },
    { key: 'expertise', label: 'Areas of expertise', done: (c?.bestForTags?.length || 0) >= 1, hint: 'Creator Studio → Creator Overview', to: studio },
    { key: 'social', label: 'Social presence', done: hasSocial(c?.socialLinks), hint: 'Creator Studio → Social Links', to: studio },
    { key: 'contact', label: 'Contact information', done: !!c?.email || !!c?.phone, hint: 'Creator Studio → Contact & Reach', to: studio },
    {
      key: 'verified',
      label: 'Documents verified',
      done: c?.verifiedStatus === true,
      hint: 'Upload every required document in Verification Center and submit — the Verified badge appears once Choosify approves them',
      to: '/admin/creator-profile?tab=verification',
    },
  ];
}

export function ProfileCompletionCard({
  title,
  items,
  editTo,
}: {
  title: string;
  items: CompletionItem[];
  editTo?: string;
}) {
  const done = items.filter((i) => i.done).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;
  const missing = items.filter((i) => !i.done);
  return (
    <div className="space-y-3" data-testid="profile-completion">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[12px] font-bold text-app-text-primary truncate">{title}</div>
          <div className="text-[11px] text-app-text-secondary">
            {done} of {items.length} complete{missing.length ? ` · ${missing.length} left` : ' · all done'}
          </div>
        </div>
        <div className={`text-[22px] font-black ${pct === 100 ? 'text-emerald-600' : 'text-app-accent'}`} data-testid="profile-completion-pct">
          {pct}%
        </div>
      </div>
      <div className="h-1.5 bg-app-border rounded-full overflow-hidden">
        <div className={`h-full transition-all ${pct === 100 ? 'bg-emerald-500' : 'bg-app-accent'}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="space-y-2">
        {[...missing, ...items.filter((i) => i.done)].map((item) => (
          <div key={item.key} className="flex items-start gap-2" data-testid={`completion-item-${item.key}`} data-done={item.done ? '1' : '0'}>
            {item.done ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
            ) : (
              <Circle className="w-4 h-4 text-app-text-secondary shrink-0 mt-0.5" />
            )}
            <div className="min-w-0">
              <div className={`text-[12px] font-semibold ${item.done ? 'text-app-text-primary' : 'text-app-text-secondary'}`}>{item.label}</div>
              {!item.done ? (
                item.to ? (
                  <Link to={item.to} className="text-[10.5px] text-app-accent hover:underline no-underline">
                    {item.hint} →
                  </Link>
                ) : (
                  <div className="text-[10.5px] text-app-text-secondary">{item.hint}</div>
                )
              ) : null}
            </div>
          </div>
        ))}
      </div>
      {editTo ? (
        <Link to={editTo} className="inline-block text-[11px] font-bold text-app-accent hover:underline no-underline">
          Edit profile →
        </Link>
      ) : null}
    </div>
  );
}
