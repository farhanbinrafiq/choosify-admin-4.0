import React from 'react';

interface ContentTableProps {
  title: string;
  tabs?: { id: string; label: string; count: number }[];
  activeTab?: string;
  onTabChange?: (id: string) => void;
  headers?: string[];
  children?: React.ReactNode;
  emptyState?: React.ReactNode;
  emptyImage?: React.ReactNode;
}

export default function ContentTable({
  title,
  tabs = [],
  activeTab,
  onTabChange,
  headers = [],
  children,
  emptyState,
  emptyImage,
}: ContentTableProps) {
  return (
    <div className="bg-app-card border border-app-border rounded-[4px] shadow-xl p-5 space-y-5 font-sans">
      {/* Table Header and Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-3">
        <span className="text-sm font-bold text-white uppercase tracking-wider">
          {title}
        </span>

        {/* Tab filters inside table if provided */}
        {tabs && tabs.length > 0 && onTabChange && activeTab && (
          <div className="flex flex-wrap items-center gap-1 font-sans">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`relative px-2.5 py-1 text-[11px] font-bold transition-all cursor-pointer ${
                    isActive 
                      ? 'text-app-accent bg-app-accent/5 rounded-[3px]' 
                      : 'text-app-text-secondary hover:text-white'
                  }`}
                >
                  <span className="mr-1">{tab.label}</span>
                  <span className="opacity-60">({tab.count})</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {children ? (
        <div className="space-y-4">
          {/* Headers */}
          {headers && headers.length > 0 && (
            <div className="hidden md:grid grid-cols-12 gap-4 pb-2 text-[10px] text-app-text-secondary font-bold uppercase tracking-widest border-b border-white/10">
              {headers.map((hdr, idx) => {
                let colSpan = 'col-span-2';
                if (idx === 0) colSpan = 'col-span-6';
                else if (idx === headers.length - 1) colSpan = 'col-span-2 text-right';
                else if (idx === headers.length - 2) colSpan = 'col-span-2 text-right';
                else colSpan = 'col-span-2';
                
                return (
                  <div key={idx} className={colSpan}>
                    {hdr}
                  </div>
                );
              })}
            </div>
          )}

          {/* Children body */}
          <div className="space-y-2.5">
            {children}
          </div>
        </div>
      ) : (
        emptyState || (
          <div className="py-12 text-center space-y-2 bg-white/5 rounded-[4px] border border-dashed border-white/10">
            {emptyImage}
            <h4 className="text-xs font-bold text-white">No items found</h4>
            <p className="text-[11px] text-app-text-secondary opacity-60">
              Try modifying dynamic selection filters or parameters
            </p>
          </div>
        )
      )}
    </div>
  );
}
