import React from 'react';

export interface TabItem {
  id: string;
  label: string;
  count?: number;
}

interface ProfileTabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
}

export default function ProfileTabs({
  tabs,
  activeTab,
  onChange,
}: ProfileTabsProps) {
  return (
    <div className="flex border-b border-white/5 gap-4 mb-3 font-sans">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`pb-3 text-[11.5px] font-extrabold uppercase tracking-widest border-b-2 transition-all cursor-pointer ${
              isActive
                ? 'border-app-accent text-white font-black'
                : 'border-transparent text-app-text-secondary hover:text-white'
            }`}
          >
            {tab.label} {tab.count !== undefined ? `(${tab.count})` : ''}
          </button>
        );
      })}
    </div>
  );
}
