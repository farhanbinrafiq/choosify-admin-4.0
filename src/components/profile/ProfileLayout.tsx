import React from 'react';
import ProfileHeader, { Breadcrumb, HeaderAction } from './ProfileHeader';
import IdentityCard, { IdentityBadge, IdentityField } from './IdentityCard';
import TagCard from './TagCard';
import ActivityTimeline, { ActivityEvent } from './ActivityTimeline';
import KPISection, { KPICard } from './KPISection';
import ProfileTabs, { TabItem } from './ProfileTabs';
import FloatingActionButton from './FloatingActionButton';
import { Search } from 'lucide-react';

export interface ProfileLayoutProps {
  breadcrumbs: Breadcrumb[];
  title: string;
  subtitle: string;
  headerActions?: HeaderAction[];
  backLink?: string;
  backLinkLabel?: string;

  // Banner & Identity info
  bannerText: string;
  bannerGradientClass?: string;
  avatarUrl?: string;
  initials?: string;
  name: string;
  handle?: string;
  persona?: string;
  identityBadges?: IdentityBadge[];
  identityFields?: IdentityField[];
  onPhoneClick?: () => void;
  onMessageClick?: () => void;

  // Extra Left Column Element (e.g. Tags/Specialties)
  tagsTitle?: string;
  tagsBadgeText?: string;
  tagsBadgeColorClass?: string;
  tags?: string[];
  
  // Custom left side supplemental content
  supplementalLeftContent?: React.ReactNode;

  // Recent Activities
  timelineTitle?: string;
  timelineEvents?: ActivityEvent[];

  // Right column Search panel
  searchPlaceholder?: string;
  searchQuery?: string;
  onSearchChange?: (val: string) => void;
  searchButtons?: { label: string; onClick: () => void; icon?: React.ReactNode }[];

  // KPIs Metrics
  kpis: KPICard[];

  // Tabs selection
  tabs: TabItem[];
  activeTab: string;
  onTabChange: (id: string) => void;

  // Floating Action button
  fab?: {
    onClick: () => void;
    icon: React.ReactNode;
    label?: string;
    title?: string;
  };

  // Toast Box state
  toast?: { message: string; type?: 'success' | 'info' | 'error' } | null;

  // Tab Content Children
  children?: React.ReactNode;
}

export default function ProfileLayout({
  breadcrumbs,
  title,
  subtitle,
  headerActions,
  backLink,
  backLinkLabel,
  bannerText,
  bannerGradientClass,
  avatarUrl,
  initials,
  name,
  handle,
  persona,
  identityBadges,
  identityFields,
  onPhoneClick,
  onMessageClick,
  tagsTitle,
  tagsBadgeText,
  tagsBadgeColorClass,
  tags,
  supplementalLeftContent,
  timelineTitle = 'Recent Event Trail',
  timelineEvents,
  searchPlaceholder = 'Search records...',
  searchQuery,
  onSearchChange,
  searchButtons,
  kpis,
  tabs,
  activeTab,
  onTabChange,
  fab,
  toast,
  children,
}: ProfileLayoutProps) {
  return (
    <div className="space-y-6 pb-12 text-app-text-primary font-sans transition-all animate-in fade-in duration-300">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-app-card text-app-text-primary shadow-2xl px-4 py-2.5 rounded-[4px] border border-app-border animate-slide-in">
          <div className={`w-2 h-2 rounded-full ${toast.type === 'success' ? 'bg-emerald-500 animate-ping' : toast.type === 'error' ? 'bg-rose-500' : 'bg-app-accent'}`} />
          <span className="text-xs font-bold font-mono text-white">{toast.message}</span>
        </div>
      )}

      {/* Header and Breadcrumb */}
      <ProfileHeader
        breadcrumbs={breadcrumbs}
        title={title}
        subtitle={subtitle}
        actions={headerActions}
        backLink={backLink}
        backLinkLabel={backLinkLabel}
      />

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: Profile card, specialties tags, timeline */}
        <div className="lg:col-span-4 space-y-6">
          <IdentityCard
            bannerText={bannerText}
            bannerGradientClass={bannerGradientClass}
            avatarUrl={avatarUrl}
            initials={initials}
            name={name}
            handle={handle}
            persona={persona}
            badges={identityBadges}
            fields={identityFields}
            onPhoneClick={onPhoneClick}
            onMessageClick={onMessageClick}
          />

          {tagsTitle && tags && (
            <TagCard
              title={tagsTitle}
              badgeText={tagsBadgeText}
              badgeColorClass={tagsBadgeColorClass}
              tags={tags}
            />
          )}

          {supplementalLeftContent}

          {timelineEvents && (
            <ActivityTimeline
              title={timelineTitle}
              events={timelineEvents}
            />
          )}
        </div>

        {/* RIGHT COLUMN: Search panel, KPIs counters, Tabs & tabular children content */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* SEARCH & FILTERS BAR */}
          {onSearchChange && (
            <div className="bg-app-card border border-app-border rounded-[4px] p-4 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="relative w-full sm:w-80 group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-app-text-secondary group-focus-within:text-app-accent-light" />
                <input 
                  type="text" 
                  placeholder={searchPlaceholder}
                  value={searchQuery || ''}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="pl-9 pr-4 py-1.5 bg-white/5 border border-app-border rounded-[4px] text-xs w-full focus:outline-none focus:border-app-accent/40 text-white placeholder-app-text-secondary/40 font-medium"
                />
              </div>

              {searchButtons && searchButtons.length > 0 && (
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  {searchButtons.map((btn, idx) => (
                    <button 
                      key={idx}
                      onClick={btn.onClick}
                      className="px-3.5 py-1.5 bg-app-card border border-app-border rounded-[4px] text-xs font-bold text-app-text-primary flex items-center gap-1.5 hover:border-app-accent hover:text-white shadow-sm transition-colors cursor-pointer"
                    >
                      {btn.icon}
                      <span>{btn.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Metric Cards Row */}
          {kpis && kpis.length > 0 && (
            <KPISection kpis={kpis} />
          )}

          {/* Tab switches */}
          {tabs && tabs.length > 0 && (
            <ProfileTabs
              tabs={tabs}
              activeTab={activeTab}
              onChange={onTabChange}
            />
          )}

          {/* Render Active Tab Children */}
          <div className="space-y-6">
            {children}
          </div>

        </div>
      </div>

      {/* Floating Action Button */}
      {fab && (
        <FloatingActionButton
          onClick={fab.onClick}
          icon={fab.icon}
          label={fab.label}
          title={fab.title}
        />
      )}
    </div>
  );
}
