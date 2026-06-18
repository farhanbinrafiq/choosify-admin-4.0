import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  ArrowLeft,
  Mail,
  Phone,
  Calendar,
  MessageSquare,
  Star,
  ShoppingBag,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Search,
  MoreVertical,
  CheckCircle2,
  XCircle,
  ExternalLink,
  ChevronRight,
  Shield,
  Activity,
  FileText,
  UserCheck
} from 'lucide-react';

interface LogItem {
  id: string;
  action: string;
  module: string;
  ipAddress: string;
  status: 'Completed' | 'Pending' | 'Flagged';
  timestamp: string;
  targetUser: string;
}

interface LogGroup {
  date: string;
  shiftId: string;
  items: LogItem[];
}

interface ActivityItem {
  iconType: 'chat' | 'rating' | 'order' | 'warning';
  title: string;
  subtitle: string;
}

interface AdminProfileData {
  id: string;
  name: string;
  employeeId: string;
  role: string;
  status: 'Active' | 'On Leave' | 'Suspended';
  permissionGroup: string;
  securityLevel: string;
  avatarUrl: string;
  department: string;
  email: string;
  phone: string;
  lastLogin: string;
  casesResolved: number;
  reviewsCompleted: number;
  moderationScore: string;
  authorizedScopes: string[];
  recentActivities: ActivityItem[];
  logGroups: LogGroup[];
}

export default function AdminProfile() {
  const { id } = useParams();
  const [activeTab, setActiveTab] = useState<'All' | 'Completed' | 'Pending' | 'Flagged'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const profilesData: Record<string, AdminProfileData> = {
    '8': {
      id: '8',
      name: 'Adnan Chowdhury',
      employeeId: 'EMP-9821-ADM',
      role: 'Super Admin',
      status: 'Active',
      permissionGroup: 'Platform Controls (Full Access)',
      securityLevel: 'Level 5 (Top Cryptography Clear)',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256&h=256',
      department: 'Platform Operations & System Architecture',
      email: 'adnan@choosify.com',
      phone: '+880 1819-001122',
      lastLogin: 'Active Now',
      casesResolved: 421,
      reviewsCompleted: 1540,
      moderationScore: '99.8%',
      authorizedScopes: ['Read/Write Database', 'Suspend Merchant', 'Edit Security Keys', 'Approve Settlements', 'Manage Moderators'],
      recentActivities: [
        { iconType: 'warning', title: 'Security audit completed', subtitle: 'Friday, Sep 6, 2026 | 12:24am' },
        { iconType: 'order', title: 'Approved super payout #DF982', subtitle: 'Thursday, Sep 5, 2026 | 10:15am' },
        { iconType: 'chat', title: 'Upgraded Server Web ingress', subtitle: 'Tuesday, Sep 3, 2026 | 09:30pm' }
      ],
      logGroups: [
        {
          date: 'Shift Activity: 10 May, 2026',
          shiftId: 'Session Token: SEC-889410',
          items: [
            {
              id: 'log-1',
              action: 'Approved Seller Onboarding Application',
              module: 'Merchant Directory',
              ipAddress: '192.168.1.14',
              status: 'Completed',
              timestamp: '10 May, 2026 | 10:24 AM',
              targetUser: 'Aarong Digital Ltd'
            }
          ]
        },
        {
          date: 'Shift Activity: 02 Apr, 2026',
          shiftId: 'Session Token: SEC-889214',
          items: [
            {
              id: 'log-2',
              action: 'Suspended Counterfeit Listing #8172',
              module: 'Safety Systems',
              ipAddress: '192.168.1.14',
              status: 'Completed',
              timestamp: '02 Apr, 2026 | 04:12 PM',
              targetUser: 'FakeStore BD'
            }
          ]
        }
      ]
    },
    'default': {
      id: 'admin_sys',
      name: 'System Controller',
      employeeId: 'EMP-0000-SYS',
      role: 'Platform Owner',
      status: 'Active',
      permissionGroup: 'Omnipotent Governance Controls',
      securityLevel: 'Level 5 (System Root Keys)',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=256&h=256',
      department: 'Platform Development Operations',
      email: 'sysadmin@choosify.com',
      phone: '+880 1711-223344',
      lastLogin: 'Online',
      casesResolved: 9940,
      reviewsCompleted: 45100,
      moderationScore: '100%',
      authorizedScopes: ['Root Administration', 'Credential Issuance', 'Database Partition Management'],
      recentActivities: [
        { iconType: 'warning', title: 'System Heartbeat Restored', subtitle: 'Continuous System' }
      ],
      logGroups: [
        {
          date: 'Continuous Activity Cycle',
          shiftId: 'Daemon Process: SYSD-01',
          items: [
            {
              id: 'log-sys-1',
              action: 'Platform Registry Auto-Re-indexed',
              module: 'Search Core',
              ipAddress: '127.0.0.1',
              status: 'Completed',
              timestamp: 'Continuous',
              targetUser: 'Unified DB Core'
            }
          ]
        }
      ]
    }
  };

  const profile = profilesData[id || ''] || profilesData['8'] || profilesData['default'];

  const getFilteredGroups = () => {
    return profile.logGroups
      .map(group => {
        const filteredItems = group.items.filter(item => {
          let tabMatch = true;
          if (activeTab === 'Completed') tabMatch = item.status === 'Completed';
          else if (activeTab === 'Pending') tabMatch = item.status === 'Pending'; 
          else if (activeTab === 'Flagged') tabMatch = item.status === 'Flagged';

          const s = searchQuery.toLowerCase();
          const searchMatch = !searchQuery || 
            item.action.toLowerCase().includes(s) || 
            item.module.toLowerCase().includes(s) || 
            item.targetUser.toLowerCase().includes(s);

          return tabMatch && searchMatch;
        });

        return {
          ...group,
          items: filteredItems
        };
      })
      .filter(group => group.items.length > 0);
  };

  const filteredGroups = getFilteredGroups();

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'chat':
        return (
          <div className="w-8 h-8 rounded-full bg-app-accent/10 flex items-center justify-center border border-app-accent/20 shrink-0">
            <MessageSquare className="w-4 h-4 text-app-accent-light" />
          </div>
        );
      case 'rating':
        return (
          <div className="w-8 h-8 rounded-full bg-app-accent/10 flex items-center justify-center border border-app-accent/20 shrink-0">
            <Star className="w-4 h-4 text-app-accent-light" fill="currentColor" />
          </div>
        );
      case 'order':
        return (
          <div className="w-8 h-8 rounded-full bg-app-accent/10 flex items-center justify-center border border-app-accent/20 shrink-0">
            <ShoppingBag className="w-4 h-4 text-app-accent-light" />
          </div>
        );
      case 'warning':
      default:
        return (
          <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20 shrink-0">
            <ShieldAlert className="w-4 h-4 text-red-500" />
          </div>
        );
    }
  };

  return (
    <div className="space-y-6 pb-12 text-app-text-primary font-sans transition-all animate-in fade-in duration-300">
      
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-app-card text-app-text-primary shadow-2xl px-4 py-2.5 rounded-[4px] border border-app-border animate-slide-in">
          <div className="w-2 h-2 rounded-full bg-app-accent" />
          <span className="text-xs font-bold font-mono text-white">{toast.message}</span>
        </div>
      )}

      {/* Header and Breadcrumb */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-app-text-secondary">
            <Link to="/admin/consumers" className="hover:text-app-accent transition-colors">Dashboard</Link>
            <ChevronRight className="w-3.5 h-3.5 text-app-text-secondary/30" />
            <Link to="/admin/consumers?tab=admins" className="hover:text-app-accent transition-colors">Consumers</Link>
            <ChevronRight className="w-3.5 h-3.5 text-app-text-secondary/30" />
            <span className="text-app-accent-light">
              {profile.name} (Admin)
            </span>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">System Guard & Audit</h1>
          <p className="text-app-text-secondary text-[12px]">Detailed security monitoring, identity verification, and permission group authorization</p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <button 
            onClick={() => showToast(`Regenerated API tokens & Rotate session keys`, 'success')}
            className="px-3.5 py-2 bg-app-accent text-white hover:bg-app-accent-light rounded-[4px] text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Generate Security Credentials</span>
          </button>
          
          <Link 
            to="/admin/consumers?tab=admins"
            className="flex items-center gap-2 px-3.5 py-2 border border-app-border rounded-[4px] text-xs font-bold text-app-text-primary bg-app-card hover:border-app-accent hover:text-white transition-all shadow-sm"
          >
            <ArrowLeft className="w-4 h-4 text-app-accent" />
            <span>All Admins</span>
          </Link>
        </div>
      </div>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: Admin profile card & permissions scope */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Profile Identity Card */}
          <div className="bg-app-card border border-app-border rounded-[4px] overflow-hidden shadow-xl">
            
            {/* Top Banner gradient compatible with Choosify colors */}
            <div className="h-24 bg-gradient-to-r from-red-610/30 via-app-card to-app-gradient-end opacity-90 relative overflow-hidden flex items-center justify-center">
              <div className="absolute inset-0 flex items-center justify-center px-4">
                <span className="text-xl sm:text-2xl md:text-xl lg:text-xl xl:text-2xl font-black text-white uppercase tracking-[0.25em] select-none text-center max-w-full truncate">ADMIN</span>
              </div>
            </div>

            {/* Profile Avatar & Details Box */}
            <div className="px-5 pb-5 relative">
              
              <div className="-mt-10 mb-4 flex items-end justify-between">
                <img 
                  src={profile.avatarUrl} 
                  alt={profile.name}
                  className="w-20 h-20 rounded-full border-2 border-app-border object-cover bg-app-card shrink-0" 
                />

                {/* Styled action triggers */}
                <div className="flex gap-1.5">
                  <button 
                    onClick={() => showToast(`Audited System Permission Logs for: ${profile.name}`, 'info')}
                    className="p-2 rounded-[4px] border border-app-border text-app-accent hover:border-app-accent hover:bg-app-accent/5 transition-all bg-app-card cursor-pointer"
                    title="Audit Employee"
                  >
                    <Activity className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={() => showToast(`Initiated Confidential Slack Tunnel`, 'info')}
                    className="p-2 rounded-[4px] bg-app-accent text-white hover:bg-app-accent-light transition-all shadow-sm cursor-pointer"
                    title="Secure Message"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Identity Row */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-bold tracking-tight text-white">{profile.name}</h2>
                  <span className="px-2 py-0.5 rounded-[2px] text-[8.5px] uppercase tracking-widest font-extrabold border bg-red-500/10 text-red-400 border-red-500/20">
                    {profile.role}
                  </span>
                  <span className="px-2 py-0.5 rounded-[2px] text-[8.5px] uppercase tracking-widest font-extrabold border bg-green-500/10 text-green-400 border-green-500/20">
                    {profile.status}
                  </span>
                </div>
                <p className="text-[9.5px] font-semibold text-app-accent-light font-mono block">
                  {profile.employeeId}
                </p>
                <p className="text-[11px] text-app-text-secondary leading-relaxed">
                  {profile.department}
                </p>
              </div>

              {/* Admin Information Fields */}
              <div className="mt-5 space-y-3.5 pt-4 border-t border-white/[0.04]">
                
                <div>
                  <label className="text-[9px] text-app-text-secondary font-bold uppercase tracking-wider block opacity-70">
                    Staff Email Contract
                  </label>
                  <span className="text-xs text-white font-semibold mt-0.5 block truncate">
                    {profile.email}
                  </span>
                </div>

                <div className="pt-2 border-t border-white/[0.04]">
                  <label className="text-[9px] text-app-text-secondary font-bold uppercase tracking-wider block opacity-70">
                    Permission Scope Domain
                  </label>
                  <span className="text-xs text-white font-semibold mt-0.5 block truncate">
                    {profile.permissionGroup}
                  </span>
                </div>

                <div className="pt-2 border-t border-white/[0.04]">
                  <label className="text-[9px] text-app-text-secondary font-bold uppercase tracking-wider block opacity-70">
                    Assigned Phone
                  </label>
                  <span className="text-xs text-white font-semibold mt-0.5 block font-mono">
                    {profile.phone}
                  </span>
                </div>

                <div className="pt-2 border-t border-white/[0.04]">
                  <label className="text-[9px] text-app-text-secondary font-bold uppercase tracking-wider block opacity-70">
                    Security Operations Level
                  </label>
                  <span className="text-xs text-app-accent-light font-bold mt-0.5 block truncate">
                    {profile.securityLevel}
                  </span>
                </div>

                <div className="pt-2 border-t border-white/[0.04]">
                  <label className="text-[9px] text-app-text-secondary font-bold uppercase tracking-wider block opacity-70">
                    Last active timestamp
                  </label>
                  <span className="text-xs text-app-accent-light font-bold mt-0.5 flex items-center gap-1.5 font-mono">
                    <Clock className="w-3 h-3" />
                    <span>{profile.lastLogin}</span>
                  </span>
                </div>

              </div>

            </div>
          </div>

          {/* Social Connectivity & Specialties */}
          <div className="bg-app-card border border-app-border rounded-[4px] p-5 shadow-xl space-y-4">
            <h3 className="text-[10px] font-bold text-white uppercase tracking-wider border-b border-white/[0.04] pb-2 flex items-center justify-between">
              <span>Authorized Security Scopes</span>
              <span className="text-[8px] bg-red-500/10 text-red-500 px-1.5 py-0.5 rounded-[2px] border border-red-500/20">RBAC ADMIN</span>
            </h3>

            <div className="flex flex-wrap gap-1.5">
              {profile.authorizedScopes.map((scope) => (
                <span key={scope} className="px-2 py-1 rounded-[2px] bg-white/[0.02] border border-white/[0.04] text-[10px] font-bold text-red-400">
                  🛡️ {scope}
                </span>
              ))}
            </div>
          </div>

          {/* Recent Activities Timeline card */}
          <div className="bg-app-card border border-app-border rounded-[4px] p-5 shadow-xl space-y-4">
            <h3 className="text-[10px] font-bold text-white uppercase tracking-wider border-b border-white/[0.04] pb-2">
              Recent System Action Trail
            </h3>

            <div className="space-y-3 pt-1">
              {profile.recentActivities.map((act, index) => (
                <div key={index} className="flex gap-3 items-start p-1.5 hover:bg-white/[0.01] transition-all rounded-[3px]">
                  {getActivityIcon(act.iconType)}
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-white">{act.title}</h4>
                    <p className="text-[9.5px] text-app-text-secondary font-mono mt-0.5">{act.subtitle}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Search controls, metric cards & Action Logs list */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* SEARCH & FILTERS BAR */}
          <div className="bg-app-card border border-app-border rounded-[4px] p-4 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
            
            {/* Search Input box */}
            <div className="relative w-full sm:w-80 group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-app-text-secondary group-focus-within:text-app-accent-light" />
              <input 
                type="text" 
                placeholder="Search action logs, targets, modules..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-1.5 bg-white/[0.02] border border-app-border rounded-[4px] text-xs w-full focus:outline-none focus:border-app-accent/40 text-white placeholder-app-text-secondary/40 font-medium"
              />
            </div>

            {/* Actions and Export options */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button 
                onClick={() => showToast('Generated administrative log stream', 'success')}
                className="px-3.5 py-1.5 bg-app-card border border-app-border rounded-[4px] text-xs font-bold text-app-text-primary flex items-center gap-1.5 hover:border-app-accent hover:text-white shadow-sm transition-colors cursor-pointer"
              >
                <Calendar className="w-3.5 h-3.5 text-app-accent" />
                <span>Select Shift Block</span>
              </button>
              
              <button 
                onClick={() => showToast('Exported security report', 'success')}
                className="p-1.5 bg-app-card border border-app-border rounded-[4px] hover:border-app-accent hover:text-white text-app-text-secondary shadow-sm transition-all cursor-pointer"
                title="Action Options"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
            </div>

          </div>

          {/* METRIC CARDS ROW - EXACTLY ALIGNED */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Cases Resolved */}
            <div className="bg-app-card border border-app-border rounded-[4px] p-4.5 shadow-xl flex items-center justify-between hover:border-app-accent/30 transition-all relative overflow-hidden group">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-app-text-secondary uppercase tracking-widest block opacity-70">Support Cases Handled</span>
                <span className="text-xl font-bold text-white tracking-tight block font-mono">
                  {profile.casesResolved} cases
                </span>
                <span className="text-[9px] text-green-400 block font-semibold">
                  SLA Compliance: 99.1%
                </span>
              </div>
              <div className="shrink-0 pl-1.5">
                <svg className="w-16 h-8 text-emerald-400" viewBox="0 0 100 40" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 25 Q 25 10, 45 35 T 85 15 T 95 20" />
                </svg>
              </div>
            </div>

            {/* Moderation Actions */}
            <div className="bg-app-card border border-app-border rounded-[4px] p-4.5 shadow-xl flex items-center justify-between hover:border-app-accent/30 transition-all relative overflow-hidden group">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-app-text-secondary uppercase tracking-widest block opacity-70">Reviews & Mod Approved</span>
                <span className="text-xl font-bold text-white tracking-tight block font-mono">
                  {profile.reviewsCompleted} events
                </span>
                <span className="text-[9px] text-app-text-secondary block font-medium">
                  Review backlog clear
                </span>
              </div>
              <div className="shrink-0 pl-1.5">
                <svg className="w-16 h-8 text-indigo-400" viewBox="0 0 100 40" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 10 Q 30 35, 55 15 T 85 30 T 95 20" />
                </svg>
              </div>
            </div>

            {/* System Quality Score */}
            <div className="bg-app-card border border-app-border rounded-[4px] p-4.5 shadow-xl flex items-center justify-between hover:border-app-accent/30 transition-all relative overflow-hidden group">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-app-text-secondary uppercase tracking-widest block opacity-70">Platform Quality Score</span>
                <span className="text-xl font-bold text-emerald-400 tracking-tight block font-mono">
                  {profile.moderationScore}
                </span>
                <span className="text-[9px] text-green-400 block font-semibold">
                  Perfect alignment rating
                </span>
              </div>
              <div className="shrink-0 pl-1.5">
                <svg className="w-16 h-8 text-emerald-400" viewBox="0 0 100 40" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 30 Q 25 5, 45 25 T 85 10 T 95 5" />
                </svg>
              </div>
            </div>

          </div>

          {/* AUDIT LOG PANEL */}
          <div className="bg-app-card border border-app-border rounded-[4px] shadow-xl p-5 space-y-5">
            
            {/* Table Header and Tabs */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.04] pb-3">
              <span className="text-sm font-bold text-white uppercase tracking-wider">
                Platform Action Ledger Log
              </span>

              {/* Underlying Tab Switchers */}
              <div className="flex flex-wrap items-center gap-1">
                {(['All', 'Completed', 'Pending', 'Flagged'] as const).map((tab) => {
                  let count = 0;
                  if (tab === 'All') {
                    count = profile.logGroups.reduce((sum, g) => sum + g.items.length, 0);
                  } else {
                    count = profile.logGroups.reduce((sum, g) => sum + g.items.filter(i => i.status === tab).length, 0);
                  }

                  const isActive = activeTab === tab;
                  return (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`relative px-2.5 py-1 text-[11px] font-bold transition-all cursor-pointer ${
                        isActive 
                          ? 'text-app-accent bg-app-accent/5 rounded-[3px]' 
                          : 'text-app-text-secondary hover:text-white'
                      }`}
                    >
                      <span className="mr-1">
                        {tab === 'All' ? 'All Activities' : tab}
                      </span>
                      <span className="opacity-60">({count})</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Table layout matching Choosify look */}
            {filteredGroups.length > 0 ? (
              <div className="space-y-4">
                
                {/* Headers */}
                <div className="hidden md:grid grid-cols-12 gap-4 pb-2 text-[10px] text-app-text-secondary font-bold uppercase tracking-widest border-b border-white/[0.04]">
                  <div className="col-span-6">Operation Ledger / Event Action</div>
                  <div className="col-span-2 text-right">Module Area</div>
                  <div className="col-span-2 pl-4">Target Audience</div>
                  <div className="col-span-2 text-right">Operation status</div>
                </div>

                {/* Date groups */}
                <div className="space-y-6">
                  {filteredGroups.map((group, groupIndex) => (
                    <div key={groupIndex} className="space-y-3">
                      
                      {/* Date Indicator Line */}
                      <div className="flex items-center justify-between border-b border-dashed border-white/[0.04] pb-1.5 font-mono text-[10px]">
                        <span className="text-app-text-secondary font-bold uppercase">
                          {group.date}
                        </span>
                        <span className="text-white font-semibold">
                          {group.shiftId}
                        </span>
                      </div>

                      {/* Items loop */}
                      <div className="space-y-2.5">
                        {group.items.map((item) => (
                          <div 
                            key={item.id}
                            className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center p-3 rounded-[3px] bg-white/[0.01] hover:bg-white/[0.03] transition-all border border-white/[0.02]"
                          >
                            {/* Log column */}
                            <div className="col-span-1 md:col-span-6 flex items-center gap-3">
                              <div className="w-10 h-10 rounded-[3px] bg-white/[0.02] border border-white/[0.04] flex items-center justify-center shrink-0">
                                <FileText className="w-5 h-5 text-red-400" />
                              </div>
                              <div className="min-w-0">
                                <h4 className="text-xs font-bold text-white truncate">{item.action}</h4>
                                <p className="text-[10px] text-app-text-secondary font-mono truncate">
                                  ID: {item.id} | Authorized IP: {item.ipAddress}
                                </p>
                              </div>
                            </div>

                            {/* Module column */}
                            <div className="col-span-1 md:col-span-2 md:text-right">
                              <span className="text-[9px] md:hidden text-app-text-secondary uppercase font-bold block mb-0.5">Module</span>
                              <span className="text-xs font-bold text-white">
                                {item.module}
                              </span>
                            </div>

                            {/* Target Column */}
                            <div className="col-span-1 md:col-span-2 md:pl-4">
                              <span className="text-[9px] md:hidden text-app-text-secondary uppercase font-bold block mb-0.5">Target</span>
                              <span className="text-xs font-semibold text-app-accent-light">
                                {item.targetUser}
                              </span>
                            </div>

                            {/* Status badge */}
                            <div className="col-span-1 md:col-span-2 md:text-right flex md:justify-end">
                              <span className="text-[9px] md:hidden text-app-text-secondary uppercase font-bold block mr-2 mb-0.5">Status</span>
                              {item.status === 'Pending' && (
                                <span className="inline-block px-2.5 py-0.5 rounded-[2px] text-[8.5px] font-bold uppercase tracking-wider bg-app-accent/20 text-app-accent border border-app-accent/30 shrink-0 w-24 text-center">
                                  Pending
                                </span>
                              )}
                              {item.status === 'Completed' && (
                                <span className="inline-block px-2.5 py-0.5 rounded-[2px] text-[8.5px] font-bold uppercase tracking-wider bg-green-500/10 text-green-400 border-green-500/20 shrink-0 w-24 text-center">
                                  Completed
                                </span>
                              )}
                              {item.status === 'Flagged' && (
                                <span className="inline-block px-2.5 py-0.5 rounded-[2px] text-[8.5px] font-bold uppercase tracking-wider bg-red-500/10 text-red-400 border-red-500/20 shrink-0 w-24 text-center">
                                  Flagged
                                </span>
                              )}
                            </div>

                          </div>
                        ))}
                      </div>

                    </div>
                  ))}
                </div>

              </div>
            ) : (
              <div className="py-12 text-center space-y-2 bg-white/[0.01] rounded-[4px] border border-dashed border-white/[0.04]">
                <ShieldAlert className="w-8 h-8 text-app-text-secondary/20 mx-auto" />
                <h4 className="text-xs font-bold text-white">No administrative actions match filters</h4>
                <p className="text-[11px] text-app-text-secondary opacity-60">Try selecting another filter status or refining query keywords</p>
              </div>
            )}

          </div>

        </div>

      </div>

    </div>
  );
}
