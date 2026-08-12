export type ProfileShellVariant = 'dark' | 'light';

export function profileShellClasses(variant: ProfileShellVariant) {
  if (variant === 'light') {
    return {
      root: 'text-[#111827]',
      headerTitle: 'text-[15px] font-extrabold text-[#111827]',
      headerSubtitle: 'text-[11.5px] text-[#9CA3AF] font-semibold',
      breadcrumb: 'text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF]',
      breadcrumbActive: 'text-[#EF3C23]',
      identityCard: 'bg-white border border-[#E8EDF2] rounded-[10px] overflow-hidden shadow-sm',
      identityBanner: 'h-20 profile-identity-banner',
      identityName: 'text-[13.5px] font-extrabold text-[#111827]',
      identityHandle: 'text-[11px] text-[#2563EB] font-semibold',
      identityPersona: 'text-[11.5px] text-[#374151] font-semibold',
      identityFieldLabel: 'text-[9px] font-extrabold text-[#9CA3AF] uppercase tracking-wide',
      identityFieldValue: 'text-[11.5px] font-bold text-[#111827] mt-0.5',
      kpiCard: 'bg-white border border-[#E8EDF2] rounded-lg p-3.5 shadow-sm',
      kpiTitle: 'text-[9px] font-extrabold text-[#9CA3AF uppercase tracking-wide',
      kpiValue: 'text-base font-extrabold text-[#111827]',
      kpiSub: 'text-[9.5px] text-[#9CA3AF] font-semibold',
      tabsWrap: 'flex gap-4 bg-white border border-[#E8EDF2] rounded-lg px-4 overflow-x-auto',
      tabActive: 'border-b-2 border-[#EF3C23] text-[#EF3C23] font-extrabold',
      tabInactive: 'border-b-2 border-transparent text-[#6B7280] font-extrabold hover:text-[#374151]',
      tabBtn: 'py-3 text-[11.5px] whitespace-nowrap cursor-pointer',
      panel: 'bg-white border border-[#E8EDF2] rounded-lg p-4 shadow-sm',
      panelTitle: 'text-[13px] font-extrabold text-[#111827] uppercase tracking-wide',
      panelSub: 'text-[10.5px] text-[#9CA3AF] font-semibold',
      input:
        'w-full h-10 rounded-lg border border-[#E8EDF2] bg-[#F9FAFB] px-3 text-[12.5px] text-[#111827] outline-none focus:border-[#EF3C23]/40',
      label: 'text-[11px] font-extrabold text-[#9CA3AF] uppercase tracking-wide',
    };
  }

  return {
    root: 'text-app-text-primary',
    headerTitle: 'text-xl font-bold text-white tracking-tight',
    headerSubtitle: 'text-app-text-secondary text-[12px]',
    breadcrumb: 'text-[11px] font-bold uppercase tracking-wider text-app-text-secondary',
    breadcrumbActive: 'text-app-accent-light',
    identityCard: 'bg-app-card border border-app-border rounded-[4px] overflow-hidden shadow-xl',
    identityBanner: 'h-24 profile-identity-banner',
    identityName: 'text-lg font-bold text-white',
    identityHandle: 'text-xs text-app-accent-light font-semibold',
    identityPersona: 'text-xs text-app-text-secondary font-semibold',
    identityFieldLabel: 'text-[9px] font-bold text-app-text-secondary uppercase tracking-wider',
    identityFieldValue: 'text-xs font-bold text-white mt-0.5',
    kpiCard: 'bg-app-card border border-app-border rounded-[4px] p-4.5 shadow-xl',
    kpiTitle: 'text-[10px] font-bold text-app-text-secondary uppercase tracking-widest',
    kpiValue: 'text-xl font-bold tracking-tight text-white font-mono',
    kpiSub: 'text-[9px] font-semibold text-app-text-secondary',
    tabsWrap: 'flex border-b border-white/5 gap-4 mb-3',
    tabActive: 'border-b-2 border-app-accent text-white font-black',
    tabInactive: 'border-b-2 border-transparent text-app-text-secondary hover:text-white',
    tabBtn: 'pb-3 text-[11.5px] font-extrabold uppercase tracking-widest transition-all cursor-pointer',
    panel: 'bg-app-card border border-app-border rounded-[4px] p-6 shadow-xl',
    panelTitle: 'text-sm font-bold text-app-text-primary uppercase tracking-wider',
    panelSub: 'text-[11px] text-app-text-secondary',
    input:
      'bg-white/5 border border-app-border rounded-[4px] text-xs text-white px-3 py-2 outline-none focus:border-app-accent/40 w-full',
    label: 'text-[11px] font-bold text-app-text-secondary uppercase tracking-wider',
  };
}
