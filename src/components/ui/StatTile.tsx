import React from 'react';

interface StatTileProps {
  label: string;
  value: string | number;
  icon?: React.ElementType;
  trend?: { value: string; direction: 'up' | 'down' };
  accent?: 'orange' | 'emerald' | 'rose' | 'indigo' | 'slate';
}

const ACCENT_CLASSES: Record<NonNullable<StatTileProps['accent']>, string> = {
  orange: 'bg-app-accent/10 text-app-accent',
  emerald: 'bg-emerald-100 text-emerald-600',
  rose: 'bg-rose-100 text-rose-600',
  indigo: 'bg-indigo-100 text-indigo-600',
  slate: 'bg-slate-100 text-slate-600',
};

export const StatTile: React.FC<StatTileProps> = ({ label, value, icon: Icon, trend, accent = 'orange' }) => {
  return (
    <div className="glass-card glass-card-hover p-5 flex items-center gap-4">
      {Icon && (
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${ACCENT_CLASSES[accent]}`}>
          <Icon className="w-5 h-5" />
        </div>
      )}
      <div className="min-w-0">
        <div className="text-[10px] font-bold text-app-text-secondary uppercase tracking-widest truncate">{label}</div>
        <div className="flex items-baseline gap-2">
          <div className="text-[20px] font-extrabold text-app-text-primary">{value}</div>
          {trend && (
            <span className={`text-[10px] font-bold ${trend.direction === 'up' ? 'text-emerald-600' : 'text-rose-600'}`}>
              {trend.direction === 'up' ? '▲' : '▼'} {trend.value}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
