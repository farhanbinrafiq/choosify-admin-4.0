import React from 'react';
import {
  BarChart3,
  Eye,
  Heart,
  MessageSquare,
  Package,
  Scale,
  Star,
  Ticket,
  TrendingUp,
  UserCheck,
} from 'lucide-react';
import type { SellerOverviewMetrics } from '../../types/sellerDashboard';
import WidgetShell from './WidgetShell';

type Props = {
  overview?: SellerOverviewMetrics;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
};

const cards = [
  { key: 'todaysViews', label: "Today's Views", icon: Eye },
  { key: 'productViews7d', label: 'Product Views (7d)', icon: BarChart3 },
  { key: 'totalProducts', label: 'Total Products', icon: Package },
  { key: 'activeProducts', label: 'Active Products', icon: TrendingUp },
  { key: 'pendingProducts', label: 'Pending Products', icon: Package },
  { key: 'outOfStockProducts', label: 'Out of Stock', icon: Package },
  { key: 'wishlistCount', label: 'Wishlist Count', icon: Heart },
  { key: 'compareCount', label: 'Compare Count', icon: Scale },
  { key: 'averageRating', label: 'Average Rating', icon: Star },
  { key: 'unreadMessages', label: 'Unread Messages', icon: MessageSquare },
  { key: 'supportTickets', label: 'Support Tickets', icon: Ticket },
  { key: 'profileCompletion', label: 'Profile Completion', icon: UserCheck },
] as const;

export default function SellerOverviewCards({ overview, loading, error, onRetry }: Props) {
  const isEmpty = !overview;

  return (
    <WidgetShell
      title="Business Overview"
      subtitle="Actionable seller metrics"
      loading={loading}
      error={error}
      isEmpty={isEmpty}
      emptyTitle="No analytics yet"
      emptyMessage="Seller metrics will appear once products and activity are available."
      onRetry={onRetry}
      className="!p-0 !bg-transparent !border-0 !shadow-none"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map((card) => {
          const rawValue = overview?.[card.key];
          const value =
            card.key === 'averageRating'
              ? Number(rawValue || 0).toFixed(1)
              : card.key === 'profileCompletion'
                ? `${rawValue || 0}%`
                : String(rawValue ?? 0);

          return (
            <div
              key={card.key}
              className="bg-app-card border border-app-border rounded-[1.5rem] p-5 shadow-xl"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="p-2.5 rounded-xl bg-white/5 border border-app-border text-app-accent">
                  <card.icon className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-bold text-app-text-primary tracking-tight">{value}</div>
              <div className="text-[10px] text-app-text-secondary uppercase font-bold tracking-widest mt-1 opacity-70">
                {card.label}
              </div>
            </div>
          );
        })}
      </div>
    </WidgetShell>
  );
}
