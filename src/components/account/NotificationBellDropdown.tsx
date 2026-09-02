import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Bell, CheckCheck, ExternalLink } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  listMyNotifications,
  markNotificationRead,
  markNotificationsRead,
  type AppNotification,
} from '../../services/notificationsApi';
import { formatNotificationTime, resolveNotificationPath } from '../../lib/notificationRouting';

type NotificationBellDropdownProps = {
  /** Matches AdminWorkspace topbar icon button styling when true. */
  className?: string;
};

export function NotificationBellDropdown({ className = '' }: NotificationBellDropdownProps) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listMyNotifications({ limit: 20, archived: false, dismissed: false });
      setItems(result.items);
      setUnread(result.summary.unread || 0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, profile?.id]);

  useEffect(() => {
    if (!open) return;
    void refresh();
  }, [open, refresh]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setDetailId(null);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        setDetailId(null);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const markOneReadLocal = (id: string) => {
    setItems((prev) =>
      prev.map((n) => (n.id === id && !n.read ? { ...n, read: true, readAt: new Date().toISOString() } : n)),
    );
    setUnread((n) => Math.max(0, n - 1));
  };

  const onSelect = async (notification: AppNotification) => {
    if (!notification.read) {
      markOneReadLocal(notification.id);
      void markNotificationRead(notification.id);
    }
    const path = resolveNotificationPath(notification, profile?.role);
    if (path) {
      setOpen(false);
      setDetailId(null);
      if (/^https?:\/\//i.test(path)) {
        window.location.href = path;
      } else {
        navigate(path);
      }
      return;
    }
    setDetailId(notification.id);
  };

  const onMarkAllRead = async () => {
    const unreadIds = items.filter((n) => !n.read).map((n) => n.id);
    setItems((prev) => prev.map((n) => ({ ...n, read: true, readAt: n.readAt || new Date().toISOString() })));
    setUnread(0);
    if (unreadIds.length) void markNotificationsRead(unreadIds);
  };

  const onViewAll = () => {
    setOpen(false);
    setDetailId(null);
    navigate('/admin/notifications');
  };

  const detail = detailId ? items.find((n) => n.id === detailId) : null;

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        className="admin-workspace__topbar-icon"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        onClick={() => {
          setOpen((prev) => !prev);
          setDetailId(null);
        }}
      >
        <Bell size={19} strokeWidth={2} aria-hidden />
        {unread > 0 ? (
          <span className="admin-workspace__topbar-badge">{unread > 99 ? '99+' : unread}</span>
        ) : null}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            id={menuId}
            role="menu"
            aria-label="Notifications"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-0 top-full mt-[14px] w-[360px] max-w-[min(360px,calc(100vw-24px))] rounded-xl border border-[#E8EDF2] bg-white shadow-[0_18px_50px_rgba(24,21,76,0.18)] overflow-hidden z-[120]"
          >
            <div className="px-4 pt-3.5 pb-2.5 border-b border-[#F1F5F9] flex items-center justify-between gap-3">
              <div>
                <p className="text-[13px] font-extrabold text-[#111827]">Notifications</p>
                <p className="text-[11px] text-[#6B7280] font-semibold mt-0.5">
                  {loading ? 'Refreshing…' : unread > 0 ? `${unread} unread` : 'You are up to date'}
                </p>
              </div>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#374151] hover:text-[#EF3C23] disabled:opacity-40 disabled:hover:text-[#374151]"
                onClick={() => void onMarkAllRead()}
                disabled={unread === 0}
              >
                <CheckCheck className="w-3.5 h-3.5" aria-hidden />
                Mark all as read
              </button>
            </div>

            {detail ? (
              <div className="px-4 py-3 border-b border-[#F1F5F9] bg-[#FAFBFC]">
                <button
                  type="button"
                  className="text-[11px] font-bold text-[#6B7280] hover:text-[#EF3C23] mb-2"
                  onClick={() => setDetailId(null)}
                >
                  ← Back to list
                </button>
                <p className="text-[13px] font-extrabold text-[#111827]">{detail.title}</p>
                {detail.summary ? (
                  <p className="text-[12px] text-[#374151] mt-1.5 leading-relaxed">{detail.summary}</p>
                ) : null}
                <p className="text-[10px] text-[#9CA3AF] font-semibold mt-2">{formatNotificationTime(detail.createdAt)}</p>
              </div>
            ) : null}

            <div className="max-h-[340px] overflow-y-auto">
              {!items.length && !loading ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-[13px] font-bold text-[#111827]">No notifications yet</p>
                  <p className="text-[11px] text-[#6B7280] mt-1 leading-relaxed">
                    Order, verification, and account alerts for your identity will appear here.
                  </p>
                </div>
              ) : (
                items.map((notification) => (
                  <button
                    key={notification.id}
                    type="button"
                    role="menuitem"
                    className={`w-full text-left px-4 py-3 border-b border-[#F8FAFC] last:border-b-0 hover:bg-[#F8FAFC] transition-colors focus:bg-[#F8FAFC] focus:outline-none ${
                      notification.read ? 'opacity-80' : ''
                    }`}
                    onClick={() => void onSelect(notification)}
                  >
                    <div className="flex items-start gap-2.5">
                      <span
                        className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${
                          notification.read ? 'bg-transparent' : 'bg-[#EF3C23]'
                        }`}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-[12.5px] leading-snug ${notification.read ? 'font-semibold text-[#374151]' : 'font-extrabold text-[#111827]'}`}>
                            {notification.title}
                          </p>
                          {resolveNotificationPath(notification, profile?.role) ? (
                            <ExternalLink className="w-3 h-3 text-[#9CA3AF] shrink-0 mt-0.5" aria-hidden />
                          ) : null}
                        </div>
                        {notification.summary ? (
                          <p className="text-[11px] text-[#6B7280] mt-0.5 line-clamp-2">{notification.summary}</p>
                        ) : null}
                        <p className="text-[10px] text-[#9CA3AF] font-semibold mt-1.5">
                          {formatNotificationTime(notification.createdAt)}
                        </p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>

            <div className="border-t border-[#F1F5F9] py-1.5">
              <button
                type="button"
                role="menuitem"
                className="w-full px-4 py-2.5 text-left text-[12px] font-bold text-[#EF3C23] hover:bg-[#FFF4F1] transition-colors"
                onClick={onViewAll}
              >
                View all
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default NotificationBellDropdown;
