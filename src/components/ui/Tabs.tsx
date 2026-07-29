import React from 'react';

export interface TabItem {
  key: string;
  label: string;
  icon?: React.ElementType;
  badge?: string | number;
}

interface TabsProps {
  tabs: TabItem[];
  activeKey: string;
  onChange: (key: string) => void;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({ tabs, activeKey, onChange, className = '' }) => {
  return (
    <div className={`flex items-center gap-1 border-b border-app-border overflow-x-auto ${className}`}>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = tab.key === activeKey;
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={`flex items-center gap-2 px-4 py-3 text-[12px] font-bold whitespace-nowrap border-b-2 transition-colors cursor-pointer ${
              isActive
                ? 'border-app-accent text-app-accent'
                : 'border-transparent text-app-text-secondary hover:text-app-text-primary'
            }`}
          >
            {Icon && <Icon className="w-3.5 h-3.5" />}
            {tab.label}
            {tab.badge !== undefined && (
              <span
                className={`text-[9px] px-1.5 py-0.5 rounded font-black ${
                  isActive ? 'bg-app-accent text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
