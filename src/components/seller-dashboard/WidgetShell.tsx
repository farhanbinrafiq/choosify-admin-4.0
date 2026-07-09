import React from 'react';
import { AlertCircle, Inbox, Loader2 } from 'lucide-react';

type WidgetShellProps = {
  title: string;
  subtitle?: string;
  loading?: boolean;
  error?: string | null;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyMessage?: string;
  onRetry?: () => void;
  children: React.ReactNode;
  className?: string;
};

export function WidgetSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="h-10 rounded-xl bg-white/5 border border-app-border/40" />
      ))}
    </div>
  );
}

export default function WidgetShell({
  title,
  subtitle,
  loading,
  error,
  isEmpty,
  emptyTitle = 'No data available',
  emptyMessage = 'There is nothing to show in this widget yet.',
  onRetry,
  children,
  className = '',
}: WidgetShellProps) {
  return (
    <section
      className={`bg-app-card border border-app-border rounded-[2rem] p-6 lg:p-8 shadow-2xl ${className}`}
    >
      <div className="mb-6">
        <h3 className="text-lg font-bold text-app-text-primary tracking-tight">{title}</h3>
        {subtitle ? (
          <p className="text-[11px] text-app-text-secondary uppercase font-bold tracking-widest mt-1">
            {subtitle}
          </p>
        ) : null}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-10 text-app-text-secondary">
          <Loader2 className="w-6 h-6 animate-spin mb-3 text-app-accent" />
          <WidgetSkeleton rows={4} />
        </div>
      ) : error ? (
        <div className="py-10 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
          <p className="text-sm text-rose-300">{error}</p>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="px-4 py-2 rounded-xl bg-white/5 border border-app-border text-xs font-bold uppercase tracking-wider hover:border-app-accent/40"
            >
              Retry
            </button>
          ) : null}
        </div>
      ) : isEmpty ? (
        <div className="py-10 text-center space-y-2">
          <Inbox className="w-8 h-8 text-app-text-secondary mx-auto opacity-60" />
          <h4 className="text-sm font-bold text-white">{emptyTitle}</h4>
          <p className="text-xs text-app-text-secondary max-w-sm mx-auto">{emptyMessage}</p>
        </div>
      ) : (
        children
      )}
    </section>
  );
}
