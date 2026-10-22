import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCheck, ChevronRight, RefreshCw } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  listMyNotifications,
  markNotificationRead,
  markNotificationsRead,
  type AppNotification,
  type NotificationSummary,
} from '../../services/notificationsApi';
import { formatNotificationTime, resolveNotificationPath } from '../../lib/notificationRouting';
import { DashShell, ContentCard, KpiPanel, KpiTile } from './dashboards/primitives';

/**
 * Notifications — the signed-in account's real notification inbox (the same
 * feed as the header bell: GET /api/notifications). Replaces the legacy
 * CMS-mirror "broadcast composer" prototype, which used seed data, sent nothing
 * and showed invented reach / open-rate numbers. Every count here is the
 * server's summary.
 */
type Filter = 'all' | 'unread';

const PRIORITY_TONE: Record<string, string> = {
  critical: 'bg-red-50 text-red-700 border-red-200',
  high: 'bg-amber-50 text-amber-700 border-amber-200',
};

export default function NotificationsPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [summary, setSummary] = useState<NotificationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await listMyNotifications({ limit: 100 });
    setItems(res.items);
    setSummary(res.summary);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const unreadIds = useMemo(() => items.filter((n) => !n.read).map((n) => n.id), [items]);
  const visible = filter === 'unread' ? items.filter((n) => !n.read) : items;

  const markLocal = (ids: string[]) => {
    const set = new Set(ids);
    setItems((prev) => prev.map((n) => (set.has(n.id) ? { ...n, read: true } : n)));
    setSummary((s) =>
      s ? { ...s, unread: Math.max(0, s.unread - ids.length), read: s.read + ids.length } : s,
    );
  };

  const open = (n: AppNotification) => {
    if (!n.read) {
      markLocal([n.id]);
      void markNotificationRead(n.id);
    }
    const path = resolveNotificationPath(n, profile?.role);
    if (!path) return;
    if (/^https?:\/\//i.test(path)) window.location.href = path;
    else navigate(path);
  };

  const markAll = () => {
    if (!unreadIds.length) return;
    markLocal(unreadIds);
    void markNotificationsRead(unreadIds);
  };

  const dash = (v?: number) => (loading ? '…' : String(v ?? 0));

  return (
    <DashShell
      title="Notifications"
      subtitle="Everything Choosify has sent to your account, newest first."
      actions={
        <>
          <button
            type="button"
            onClick={markAll}
            disabled={!unreadIds.length}
            className="h-[42px] px-4 bg-white border border-[#E2E8F0] text-[#000435] rounded-xl font-bold text-[13px] inline-flex items-center gap-2 hover:bg-[#FFF0E8] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="notifications-mark-all"
          >
            <CheckCheck className="w-4 h-4 text-[#F96500]" /> Mark all read
          </button>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="h-[42px] px-4 bg-white border-[1.5px] border-[#F96500] text-[#000435] rounded-xl font-bold text-[13px] inline-flex items-center gap-2 hover:bg-[#FFF0E8] transition-all disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 text-[#F96500] ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </>
      }
    >
      <KpiPanel cols={3}>
        <KpiTile label="All notifications" value={dash(summary?.total)} sub="In your inbox" />
        <KpiTile label="Unread" value={dash(summary?.unread)} sub="Waiting for you" />
        <KpiTile label="Read" value={dash(summary?.read)} sub="Already opened" />
      </KpiPanel>

      <ContentCard>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="text-[18px] font-extrabold text-[#000435] tracking-tight m-0" style={{ fontFamily: 'var(--font-heading)' }}>
            Inbox
          </h3>
          <div className="flex bg-white p-1 rounded-xl border border-[#E2E8F0]" role="group" aria-label="Filter notifications">
            {(['all', 'unread'] as Filter[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
                className={`px-4 py-2 text-[12px] font-bold rounded-lg transition-all ${
                  filter === f ? 'bg-[#F96500] text-white' : 'text-[#000435] hover:bg-[#F8FAFC]'
                }`}
              >
                {f === 'all' ? 'All' : `Unread${summary?.unread ? ` (${summary.unread})` : ''}`}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-[#64748B]">Loading notifications…</div>
        ) : visible.length === 0 ? (
          <div className="py-12 text-center text-sm text-[#64748B]" data-testid="notifications-empty">
            {filter === 'unread' ? 'You are all caught up — no unread notifications.' : 'No notifications yet.'}
          </div>
        ) : (
          <ul className="divide-y divide-[#EEF2F7] border border-[#E2E8F0] rounded-xl overflow-hidden m-0 p-0 list-none" data-testid="notifications-list">
            {visible.map((n) => {
              const path = resolveNotificationPath(n, profile?.role);
              const tone = PRIORITY_TONE[n.priority];
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => open(n)}
                    className={`w-full text-left px-4 py-3.5 flex items-start gap-3 transition-colors hover:bg-[#FFF7F2] ${n.read ? 'bg-white' : 'bg-[#F0F8FF]'}`}
                    data-testid="notification-row"
                  >
                    <span
                      className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${n.read ? 'bg-transparent' : 'bg-[#F96500]'}`}
                      aria-label={n.read ? undefined : 'Unread'}
                    />
                    <span className="min-w-0 flex-1">
                      <span className={`block text-[13.5px] text-[#000435] ${n.read ? 'font-semibold' : 'font-extrabold'}`}>{n.title}</span>
                      {n.summary ? <span className="block text-[12.5px] text-[#475569] mt-0.5">{n.summary}</span> : null}
                      <span className="flex flex-wrap items-center gap-2 mt-1.5 text-[11px] text-[#64748B]">
                        <span>{formatNotificationTime(n.createdAt)}</span>
                        {n.category ? <span className="capitalize">· {n.category}</span> : null}
                        {tone ? (
                          <span className={`px-1.5 py-0.5 rounded border text-[9.5px] font-black uppercase ${tone}`}>{n.priority}</span>
                        ) : null}
                      </span>
                    </span>
                    {path ? <ChevronRight className="w-4 h-4 text-[#94A3B8] mt-1 shrink-0" aria-label="Open" /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </ContentCard>
    </DashShell>
  );
}
