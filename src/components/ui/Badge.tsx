import React from 'react';

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'accent';

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  success: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-100 text-amber-700 border-amber-200',
  danger: 'bg-rose-100 text-rose-700 border-rose-200',
  info: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  neutral: 'bg-slate-100 text-slate-700 border-slate-200',
  accent: 'bg-app-accent/10 text-app-accent border-app-accent/20',
};

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ variant = 'neutral', children, className = '' }) => {
  return (
    <span
      className={`inline-flex items-center text-[10px] px-2.5 py-1 rounded-lg border font-bold uppercase tracking-widest ${VARIANT_CLASSES[variant]} ${className}`}
    >
      {children}
    </span>
  );
};
