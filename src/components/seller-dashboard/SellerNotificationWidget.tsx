import React from 'react';
import { Bell, CheckCircle2, MessageSquare, Megaphone, ShieldAlert } from 'lucide-react';
import type { SellerDashboardNotification } from '../../types/sellerDashboard';
import WidgetShell from './WidgetShell';

type Props = {
  notifications?: SellerDashboardNotification[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
};

const iconByType = {
  approval: CheckCircle2,
  rejection: ShieldAlert,
  message: MessageSquare,
  system: Bell,
  announcement: Megaphone,
};

export default function SellerNotificationWidget({ notifications, loading, error, onRetry }: Props) {
  return (
    <WidgetShell
      title="Notifications"
      subtitle="Latest store activity"
      loading={loading}
      error={error}
      isEmpty={!notifications?.length}
      emptyTitle="No notifications"
      emptyMessage="Approvals, messages, and system updates will appear here."
      onRetry={onRetry}
    >
      <div className="space-y-3">
        {notifications?.map((notification) => {
          const Icon = iconByType[notification.type];
          return (
            <div
              key={notification.id}
              className={`p-3 rounded-xl border ${notification.read ? 'bg-app-bg/40 border-app-border/60' : 'bg-app-bg border-app-accent/20'}`}
            >
              <div className="flex items-start gap-3">
                <Icon className="w-4 h-4 text-app-accent mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-bold text-white">{notification.title}</div>
                  <p className="text-xs text-app-text-secondary mt-1">{notification.body}</p>
                  <p className="text-[10px] text-app-text-secondary mt-2 font-mono">
                    {new Date(notification.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </WidgetShell>
  );
}
