import React from 'react';

interface DetailsCardProps {
  title: string;
  badgeText?: string;
  badgeColorClass?: string;
  children: React.ReactNode;
}

export default function DetailsCard({
  title,
  badgeText,
  badgeColorClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  children,
}: DetailsCardProps) {
  return (
    <div className="bg-app-card border border-app-border rounded-[4px] p-5 shadow-xl space-y-4 font-sans">
      <h3 className="text-[10px] font-bold text-white uppercase tracking-wider border-b border-white/5 pb-2 flex items-center justify-between">
        <span>{title}</span>
        {badgeText && (
          <span className={`text-[8px] px-1.5 py-0.5 rounded-[2px] border ${badgeColorClass}`}>
            {badgeText}
          </span>
        )}
      </h3>
      <div className="space-y-3 pt-1">
        {children}
      </div>
    </div>
  );
}
