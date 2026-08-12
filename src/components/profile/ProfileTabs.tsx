import React from 'react';
import { profileShellClasses, type ProfileShellVariant } from './profileTheme';

export interface TabItem {
  id: string;
  label: string;
  count?: number;
}

interface ProfileTabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  variant?: ProfileShellVariant;
}

export default function ProfileTabs({ tabs, activeTab, onChange, variant = 'dark' }: ProfileTabsProps) {
  const t = profileShellClasses(variant);
  return (
    <div className={`${t.tabsWrap} font-sans`}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`${t.tabBtn} ${isActive ? t.tabActive : t.tabInactive}`}
          >
            {tab.label} {tab.count !== undefined ? `(${tab.count})` : ''}
          </button>
        );
      })}
    </div>
  );
}
