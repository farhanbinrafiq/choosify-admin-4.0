import React from 'react';

export interface BulkAction {
  label: string;
  onClick: () => void;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  disabled?: boolean;
}

const VARIANT_CLASSES: Record<NonNullable<BulkAction['variant']>, string> = {
  success: 'bg-emerald-600 hover:bg-emerald-500',
  warning: 'bg-amber-600 hover:bg-amber-500',
  danger: 'bg-rose-600 hover:bg-rose-500',
  info: 'bg-indigo-600 hover:bg-indigo-500',
  neutral: 'bg-white/15 hover:bg-white/25',
};

interface BulkActionBarProps {
  count: number;
  actions: BulkAction[];
  onClear: () => void;
  itemLabel?: string;
  className?: string;
}

export const BulkActionBar: React.FC<BulkActionBarProps> = ({ count, actions, onClear, itemLabel = 'items', className = '' }) => {
  if (count === 0) return null;

  return (
    <div
      className={`navy-glass px-4 py-3 rounded-xl flex items-center justify-between gap-3 mb-3 text-[12px] font-bold shadow-lg animate-fade-in ${className}`}
    >
      <div className="flex items-center gap-3 flex-wrap">
        <span className="glass-on-navy px-2.5 py-1 rounded-lg font-mono">
          {count} {itemLabel} selected
        </span>
        <div className="flex items-center gap-2">
          {actions.map((action) => (
            <button
              key={action.label}
              onClick={action.onClick}
              disabled={action.disabled}
              className={`px-3 py-1.5 text-white rounded-lg transition-colors uppercase font-extrabold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                VARIANT_CLASSES[action.variant || 'neutral']
              }`}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
      <button
        onClick={onClear}
        className="text-white/70 hover:text-white px-3 py-1 cursor-pointer transition-colors uppercase text-[10px]"
      >
        ✕ Clear selection
      </button>
    </div>
  );
};
