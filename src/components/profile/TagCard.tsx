import React from 'react';

interface TagCardProps {
  title: string;
  badgeText?: string;
  badgeColorClass?: string;
  tags?: string[];
}

export default function TagCard({
  title,
  badgeText = 'SPECIALTY',
  badgeColorClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  tags = [],
}: TagCardProps) {
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

      <div className="flex flex-wrap gap-1.5">
        {tags && tags.length > 0 ? (
          tags.map((tag, idx) => (
            <span key={idx} className="px-2 py-1 rounded-[2px] bg-white/5 border border-white/5 text-[10.5px] font-bold text-emerald-400">
              ⚡ {tag}
            </span>
          ))
        ) : (
          <span className="text-[10px] text-app-text-secondary/50 font-mono italic">No tags assigned</span>
        )}
      </div>
    </div>
  );
}
