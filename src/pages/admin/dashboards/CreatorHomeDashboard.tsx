import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FilePlus2,
  FolderOpen,
  UserSquare2,
  ExternalLink,
  MessagesSquare,
  Megaphone,
  Bell,
  CheckCircle2,
  Circle,
  FileEdit,
  Archive,
} from 'lucide-react';
import { catalogApi, type GuideManageRow } from '../../../services/catalogApi';
import type { CatalogCreator } from '../../../types/catalog';
import { useAuth } from '../../../contexts/AuthContext';
import { useNavAttention } from '../../../contexts/NavAttentionContext';
import {
  DashShell,
  KpiPanel,
  KpiTile,
  ContentCard,
  CardColumns,
  MiniStat,
  EmptyState,
  ActionRowList,
  QuickActionGrid,
  WEB_ORIGIN,
  type ActionItem,
  type QuickAction,
} from './primitives';

type CompletionItem = { key: string; label: string; done: boolean; hint: string };

/**
 * Creator Command Center — creator. NOT a seller dashboard.
 *
 * There is no canonical Creator-attributable order / revenue / engagement /
 * views backend, so this dashboard shows NO revenue KPI, NO order/revenue
 * trend, and NO earnings / engagement / views widgets.
 *
 *   Published Guides / Drafts   → GET /catalog/guides/manage (server: creatorIdsForUser scope)
 *   Profile Status              → GET /catalog/creators (server: c.userId === userId) — status + verifiedStatus
 *   Recent Guides / Attention   → same guides/manage rows (status, updatedAt, productCount)
 *   Profile Completeness        → deterministic checklist over canonical CatalogCreator fields
 *   Messages / Notifications    → GET /dashboard/nav-attention (creator branch)
 */
export default function CreatorHomeDashboard() {
  const { profile } = useAuth();
  const { counts } = useNavAttention();
  const [guides, setGuides] = useState<GuideManageRow[]>([]);
  const [creator, setCreator] = useState<CatalogCreator | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [g, creators] = await Promise.all([
        catalogApi.manageGuides({ status: 'all' }).then((r) => r.data || []).catch(() => []),
        catalogApi.listCreators().catch(() => [] as CatalogCreator[]),
      ]);
      if (cancelled) return;
      setGuides(Array.isArray(g) ? g : []);
      const mine =
        (creators as CatalogCreator[]).find((c) => c.userId && c.userId === profile?.id) ||
        (creators as CatalogCreator[])[0] ||
        null;
      setCreator(mine);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  const live = guides.filter((g) => g.status === 'live');
  const drafts = guides.filter((g) => g.status === 'draft');
  const archived = guides.filter((g) => g.status === 'archived');

  const recent = useMemo(
    () =>
      [...guides]
        .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
        .slice(0, 5),
    [guides],
  );

  const completion: CompletionItem[] = useMemo(() => {
    const c = creator;
    const social =
      !!c?.socialLinks &&
      (['facebook', 'instagram', 'youtube', 'linkedin', 'tiktok'] as const).some(
        (k) => !!(c.socialLinks as Record<string, string | undefined>)[k],
      );
    const customSocial = Array.isArray((c?.socialLinks as { custom?: unknown[] })?.custom)
      ? ((c!.socialLinks as { custom?: unknown[] }).custom as unknown[]).length > 0
      : false;
    return [
      { key: 'avatar', label: 'Profile photo', done: !!c?.avatar, hint: 'Add an avatar in Creator Studio → Cover & Avatar' },
      { key: 'cover', label: 'Cover image', done: !!c?.coverImage, hint: 'Add a cover image in Creator Studio → Cover & Avatar' },
      { key: 'bio', label: 'Bio (40+ characters)', done: (c?.bio?.trim().length || 0) >= 40, hint: 'Write your bio in Creator Studio → Creator Overview' },
      { key: 'expertise', label: 'Areas of expertise', done: (c?.bestForTags?.length || 0) >= 1, hint: 'Add expertise topics in Creator Studio → Creator Overview' },
      { key: 'social', label: 'Social presence', done: social || customSocial, hint: 'Add a social link in Creator Studio → Social Links' },
      { key: 'contact', label: 'Contact information', done: !!c?.email || !!c?.phone, hint: 'Add an email or phone in Creator Studio → Contact & Reach' },
    ];
  }, [creator]);
  const completedCount = completion.filter((i) => i.done).length;
  const hasDeals =
    !!creator && ((creator.brandPartners?.length || 0) > 0 || (creator.collabTypes?.length || 0) > 0);

  const statusValue = creator
    ? creator.status === 'live'
      ? 'Live'
      : creator.status === 'draft'
        ? 'Draft'
        : '—'
    : loading
      ? '…'
      : '—';
  const statusSub = creator
    ? creator.verifiedStatus
      ? 'Verified by Choosify'
      : profile?.marketplaceAccess === false
        ? 'Marketplace access pending'
        : 'Not yet verified'
    : 'Profile not found';

  const publicHref =
    creator && creator.status === 'live' && (creator.slug || creator.id)
      ? `${WEB_ORIGIN}/creators/${creator.slug || creator.id}`
      : '';

  const attentionItems: ActionItem[] = [
    ...(drafts.length
      ? [{ key: 'drafts', label: 'Draft guides to finish', icon: FileEdit, to: '/admin/guides', count: drafts.length }]
      : []),
    ...(archived.length
      ? [{ key: 'archived', label: 'Archived guides', icon: Archive, to: '/admin/guides', count: archived.length }]
      : []),
    ...(['adsDealsStudio', 'messages', 'notifications'] as const)
      .map((key) => {
        const entry = counts[key];
        if (!entry || entry.count <= 0) return null;
        const meta = {
          adsDealsStudio: { label: 'Ads rejected — need updates', icon: Megaphone, to: '/admin/ads-deals-studio' },
          messages: { label: 'Unread conversations', icon: MessagesSquare, to: '/admin/conversations' },
          notifications: { label: 'Unread notifications', icon: Bell, to: '/admin/notifications' },
        }[key];
        return { key, count: entry.count, ...meta } as ActionItem;
      })
      .filter((x): x is ActionItem => x !== null),
  ];

  const appStatus = counts.creatorProfile;

  const quickActions: QuickAction[] = [
    { key: 'create', label: 'Create Guide / Story', sub: 'Start a new guide', to: '/dashboard/content-studio/guides/new', icon: FilePlus2 },
    { key: 'manage', label: 'Manage Guides', sub: 'Your content library', to: '/admin/guides', icon: FolderOpen },
    { key: 'studio', label: 'Creator Studio', sub: 'Edit your profile', to: '/admin/creator-studio', icon: UserSquare2 },
    {
      key: 'public',
      label: 'View Public Profile',
      sub: 'Open your live storefront profile',
      href: publicHref || undefined,
      to: '/admin/creator-studio',
      icon: ExternalLink,
      disabled: !publicHref,
      disabledHint: 'Publish your profile to view it',
    },
    { key: 'ads', label: 'Ads & Deals', sub: 'Promotions & collaborations', to: '/admin/ads-deals-studio', icon: Megaphone },
    { key: 'messages', label: 'Messages', sub: 'Conversations & support', to: '/admin/conversations', icon: MessagesSquare },
  ];

  const statusPill = (s: GuideManageRow['status']) => {
    const map: Record<string, string> = {
      live: 'bg-emerald-500/10 text-emerald-600',
      draft: 'bg-amber-500/10 text-amber-600',
      archived: 'bg-slate-400/10 text-slate-500',
    };
    return (
      <span
        className={`text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${
          map[String(s)] || 'bg-slate-400/10 text-slate-500'
        }`}
      >
        {s || '—'}
      </span>
    );
  };

  return (
    <DashShell
      title="Creator Command Center"
      subtitle="What content and profile work to focus on, and how your Creator presence is doing."
    >
      {appStatus ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-[12px] font-semibold text-amber-800">
          {appStatus.label} —{' '}
          <Link to="/admin/creator-studio" className="underline">
            open Creator Studio
          </Link>
        </div>
      ) : null}

      <KpiPanel cols={3}>
        <KpiTile
          label="Published Guides"
          value={loading ? '…' : String(live.length)}
          sub={guides.length ? `${guides.length} total` : 'No guides yet'}
          to="/admin/guides"
        />
        <KpiTile
          label="Drafts"
          value={loading ? '…' : String(drafts.length)}
          sub={drafts.length ? 'In progress' : 'Nothing in progress'}
          to="/admin/guides"
        />
        <KpiTile label="Profile Status" value={statusValue} sub={statusSub} to="/admin/creator-studio" />
      </KpiPanel>

      <ContentCard
        title="Recent Guides"
        aside={
          <Link
            to="/admin/guides"
            className="text-[11px] font-bold text-app-accent hover:underline no-underline"
          >
            Manage Guides →
          </Link>
        }
      >
        {recent.length === 0 ? (
          <EmptyState message={loading ? 'Loading…' : 'No guides yet — create your first guide.'} />
        ) : (
          <div className="divide-y divide-app-border">
            {recent.map((g) => (
              <Link
                key={g.id}
                to="/admin/guides"
                className="flex items-center gap-3 py-3 hover:opacity-80 transition-opacity"
              >
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-app-bg border border-app-border shrink-0">
                  {g.image ? (
                    <img src={g.image} alt="" className="w-full h-full object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-bold text-app-text-primary truncate">
                    {g.title || 'Untitled guide'}
                  </div>
                  <div className="text-[10px] text-app-text-secondary">
                    {g.productCount} product{g.productCount === 1 ? '' : 's'} · {g.brandCount} brand
                    {g.brandCount === 1 ? '' : 's'} · updated{' '}
                    {g.updatedAt ? new Date(g.updatedAt).toLocaleDateString() : '—'}
                  </div>
                </div>
                {statusPill(g.status)}
              </Link>
            ))}
          </div>
        )}
      </ContentCard>

      <CardColumns>
        <ContentCard title="Content Requiring Attention">
          <ActionRowList
            items={attentionItems}
            emptyMessage="Nothing needs your attention right now."
          />
        </ContentCard>

        <ContentCard title="Profile Completeness">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[12px] text-app-text-secondary">
              {completedCount} of {completion.length} complete
            </span>
            <Link
              to="/admin/creator-studio"
              className="text-[11px] font-bold text-app-accent hover:underline no-underline"
            >
              Edit →
            </Link>
          </div>
          <div className="h-1.5 bg-app-border rounded-full overflow-hidden mb-4">
            <div
              className="h-full bg-app-accent transition-all"
              style={{ width: `${(completedCount / completion.length) * 100}%` }}
            />
          </div>
          <div className="space-y-2">
            {completion.map((item) => (
              <div key={item.key} className="flex items-start gap-2">
                {item.done ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                ) : (
                  <Circle className="w-4 h-4 text-app-text-secondary shrink-0 mt-0.5" />
                )}
                <div className="min-w-0">
                  <div
                    className={`text-[12px] font-semibold ${
                      item.done ? 'text-app-text-primary' : 'text-app-text-secondary'
                    }`}
                  >
                    {item.label}
                  </div>
                  {!item.done ? (
                    <div className="text-[10.5px] text-app-text-secondary">{item.hint}</div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </ContentCard>

        <ContentCard title="Guides Overview">
          <MiniStat label="Total guides" value={String(guides.length)} to="/admin/guides" />
          <MiniStat label="Live" value={String(live.length)} to="/admin/guides" />
          <MiniStat label="Drafts" value={String(drafts.length)} to="/admin/guides" />
          <MiniStat label="Archived" value={String(archived.length)} to="/admin/guides" />
        </ContentCard>

        {hasDeals ? (
          <ContentCard title="Deals & Collaboration">
            <MiniStat
              label="Brand partnerships"
              value={String(creator?.brandPartners?.length || 0)}
              to="/admin/creator-studio"
            />
            <MiniStat
              label="Collaboration types"
              value={String(creator?.collabTypes?.length || 0)}
              to="/admin/creator-studio"
            />
            <Link
              to="/admin/ads-deals-studio"
              className="mt-3 inline-block text-[11px] font-bold text-app-accent hover:underline no-underline"
            >
              Open Ads &amp; Deals Studio →
            </Link>
          </ContentCard>
        ) : null}
      </CardColumns>

      <QuickActionGrid actions={quickActions} />
    </DashShell>
  );
}
