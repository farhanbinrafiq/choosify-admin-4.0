import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Settings, 
  Shield, 
  Bell, 
  Database, 
  Globe, 
  Smartphone, 
  User, 
  Lock, 
  Mail, 
  Users, 
  FileText, 
  Trash2, 
  Key, 
  AlertTriangle, 
  RefreshCw,
  CheckCircle2
} from 'lucide-react';

const SettingRow = ({ icon: Icon, label, desc, action }: any) => (
  <div className="flex items-center justify-between py-4 border-b border-gray-50 last:border-0">
     <div className="flex gap-4">
        <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400">
           <Icon className="w-5 h-5" />
        </div>
        <div>
           <h4 className="text-[13px] font-bold text-[#0D1B2A]">{label}</h4>
           <p className="text-[11px] text-gray-400 mt-0.5">{desc}</p>
        </div>
     </div>
     {action}
  </div>
);

export default function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get('tab') || 'platform';

  // State to manage toast notification
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg(null);
    }, 3500);
  };

  const handleTabChange = (tabId: string) => {
    setSearchParams({ tab: tabId });
  };

  // 1. Two-Factor & Maintenance States
  const [twoFA, setTwoFA] = useState(() => {
     return localStorage.getItem('choosify_settings_2fa') === 'true';
  });
  const [maintenance, setMaintenance] = useState(() => {
     return localStorage.getItem('choosify_settings_maintenance') === 'true';
  });

  const toggle2FA = () => {
    const newVal = !twoFA;
    setTwoFA(newVal);
    localStorage.setItem('choosify_settings_2fa', String(newVal));
    showToast(`✓ Two-Factor Authentication set to: ${newVal ? 'ENABLED' : 'DISABLED'}`);
  };

  const toggleMaintenance = () => {
    const newVal = !maintenance;
    setMaintenance(newVal);
    localStorage.setItem('choosify_settings_maintenance', String(newVal));
    showToast(`⚠️ Maintenance Mode set to: ${newVal ? 'ACTIVE (Offline)' : 'INACTIVE (Live)'}`);
  };

  // 2. Invite User form states
  const [isInviting, setIsInviting] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('admin');

  // 3. Roles and Permissions State
  const defaultPermissions: Record<string, Record<string, boolean>> = {
    super_admin: {
      content: true,
      users: true,
      finance: true,
      brand: true,
      system: true,
      analytics: true,
    },
    admin: {
      content: true,
      users: true,
      finance: false,
      brand: true,
      system: true,
      analytics: true,
    },
    seller: {
      content: true,
      users: false,
      finance: false,
      brand: false,
      system: false,
      analytics: true,
    },
    creator: {
      content: true,
      users: false,
      finance: false,
      brand: false,
      system: false,
      analytics: true,
    },
    moderator: {
      content: true,
      users: false,
      finance: false,
      brand: true,
      system: false,
      analytics: true,
    },
    finance_manager: {
      content: false,
      users: false,
      finance: true,
      brand: false,
      system: false,
      analytics: true,
    },
    support_agent: {
      content: false,
      users: true,
      finance: false,
      brand: false,
      system: false,
      analytics: true,
    },
    marketing_manager: {
      content: true,
      users: false,
      finance: false,
      brand: false,
      system: false,
      analytics: true,
    }
  };

  const [rolePermissions, setRolePermissions] = useState<Record<string, Record<string, boolean>>>(() => {
    const saved = localStorage.getItem('choosify_role_permissions');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return defaultPermissions;
  });

  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const handlePermissionToggle = (role: string, permKey: string, checked: boolean) => {
    const updated = {
      ...rolePermissions,
      [role]: {
        ...rolePermissions[role],
        [permKey]: checked
      }
    };
    setRolePermissions(updated);
    localStorage.setItem('choosify_role_permissions', JSON.stringify(updated));
    showToast(`✓ Updated [${role.replace('_', ' ')}] permission for [${permKey}]`);
  };

  // 4. Feature Flags State
  const defaultFeatureFlags: Record<string, boolean> = {
    enable_creator_marketplace: true,
    enable_community_submissions: true,
    enable_campaign_banners: true,
    enable_cod_only_mode: false,
    enable_promo_codes: true,
    enable_brand_deals_page: true,
    enable_comparison_engine: true,
  };

  const [featureFlags, setFeatureFlags] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('choosify_feature_flags');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return defaultFeatureFlags;
  });

  const toggleFeatureFlag = (key: string) => {
    const updated = {
      ...featureFlags,
      [key]: !featureFlags[key]
    };
    setFeatureFlags(updated);
    localStorage.setItem('choosify_feature_flags', JSON.stringify(updated));
    showToast(`✓ Flag '${key.toUpperCase()}' toggled to: ${updated[key] ? 'TRUE' : 'FALSE'}`);
  };

  // 5. Security Audit Trail (Read-only)
  const mockAuditLogs = [
    { action: 'Updated Role Permissions', user: 'Abdur Rahman', role: 'super_admin', timestamp: '22-Jun-2026 14:15', ip: '192.168.1.102' },
    { action: 'Maintenance Mode Toggled (OFF)', user: 'Abdur Rahman', role: 'super_admin', timestamp: '22-Jun-2026 11:02', ip: '192.168.1.102' },
    { action: 'Approved Seller Claim: Aarong', user: 'Tanvir Hossain', role: 'admin', timestamp: '21-Jun-2026 09:47', ip: '103.25.120.4' },
    { action: 'Campaign Banner Sync Executed', user: 'Nusrat Jahan', role: 'marketing_manager', timestamp: '21-Jun-2026 08:31', ip: '203.111.45.22' },
    { action: 'Refund Dispute Resolved (INV-4921)', user: 'Sajid Islam', role: 'finance_manager', timestamp: '20-Jun-2026 17:12', ip: '103.220.89.5' },
    { action: 'Suspended Creator: S. Akter', user: 'Afsana Mimi', role: 'moderator', timestamp: '20-Jun-2026 15:55', ip: '202.4.119.83' },
    { action: 'Configured SMTP Credentials', user: 'Abdur Rahman', role: 'super_admin', timestamp: '20-Jun-2026 12:30', ip: '192.168.1.102' },
    { action: 'Manually Dispatched Order 3291', user: 'Kazi Farhan', role: 'support_agent', timestamp: '20-Jun-2026 10:14', ip: '180.234.12.51' }
  ];

  // 6. Danger Actions
  const handleFlushAnalytics = () => {
    showToast("✓ All analytics and interaction intelligence data purged successfully.");
  };

  const handleResetFeatureFlags = () => {
    setFeatureFlags(defaultFeatureFlags);
    localStorage.setItem('choosify_feature_flags', JSON.stringify(defaultFeatureFlags));
    showToast("✓ Feature flags successfully reverted to system default configurations.");
  };

  const handleClearSessions = () => {
    showToast("✓ All active administrator, merchant, and moderator session tokens terminated.");
  };

  const isCurrentTab = (tabId: string, aliases: string[] = []) => {
    return currentTab === tabId || aliases.includes(currentTab);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Toast Alert overlay */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#0D1B2A] border border-emerald-500/30 text-emerald-400 px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-bounce">
           <CheckCircle2 className="w-5 h-5 text-emerald-400" />
           <span className="text-xs font-black uppercase tracking-wider">{toastMsg}</span>
        </div>
      )}

      {/* Settings Navigation Tab System */}
      <div className="flex border-b border-gray-100 bg-white rounded-2xl p-2 shadow-sm gap-1 overflow-x-auto">
        {[
          { id: 'platform', label: 'Platform Config' },
          { id: 'roles', label: 'Roles & Permissions', aliases: ['permissions'] },
          { id: 'features', label: 'Feature Flags' },
          { id: 'security', label: 'Security' },
          { id: 'danger', label: 'Danger Zone' }
        ].map((t) => {
          const isActive = isCurrentTab(t.id, t.aliases);
          return (
            <button
              id={`tab-btn-${t.id}`}
              key={t.id}
              onClick={() => handleTabChange(t.id)}
              className={`px-5 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                isActive 
                  ? 'bg-[#0D1B2A] text-white shadow-md' 
                  : 'text-gray-400 hover:text-[#0D1B2A] hover:bg-gray-50'
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT Renderers */}

      {/* 1. PLATFORM CONFIG TAB */}
      {isCurrentTab('platform') && (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm space-y-8">
          <div>
            <h3 className="text-lg font-bold text-[#0D1B2A] mb-1">Platform Settings</h3>
            <p className="text-gray-400 text-sm">Manage global configurations for the Choosify platform security, modules, and gateways.</p>
          </div>
          
          <div className="space-y-2">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1 py-4 border-b">SECURITY & ACCESS</div>
            <SettingRow 
              icon={Shield} 
              label="Two-Factor Authentication" 
              desc="Enforce 2FA for all moderator and admin accounts."
              action={
                <button
                  id="btn-settings-2fa"
                  onClick={toggle2FA}
                  className={`w-10 h-5 rounded-full relative transition-colors duration-200 cursor-pointer ${twoFA ? 'bg-[#ef3c23]' : 'bg-gray-200'}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all duration-200 ${twoFA ? 'left-[22px]' : 'left-0.5'}`} />
                </button>
              }
            />
            <SettingRow 
              icon={User} 
              label="Admin Invite" 
              desc="Invite a new administrator or content moderator."
              action={
                <button 
                  id="btn-trigger-invite"
                  onClick={() => setIsInviting(!isInviting)}
                  className="px-4 py-2 border border-gray-100 rounded-xl text-[11px] font-bold text-blue-600 cursor-pointer hover:bg-blue-50 transition-colors uppercase tracking-widest"
                >
                  {isInviting ? 'Collapse Form' : 'Invite User'}
                </button>
              }
            />

            {/* Invite Form sliding panel */}
            {isInviting && (
              <div className="p-6 bg-gray-50 rounded-xl border border-gray-100 space-y-4 animate-fadeIn">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-blue-500" />
                  <h4 className="text-[11px] font-extrabold text-[#0D1B2A] uppercase tracking-wider">Access invitation panel</h4>
                </div>
                <form 
                  id="form-admin-invite"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (inviteEmail) {
                      showToast(`✓ Credentials for [${inviteRole.toUpperCase()}] invited account successfully sent to: ${inviteEmail}`);
                      setInviteEmail('');
                      setIsInviting(false);
                    }
                  }} 
                  className="grid grid-cols-1 md:grid-cols-2 gap-4"
                >
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Email Address</label>
                    <input 
                      type="email"
                      required
                      placeholder="e.g. name@choosify.com.bd"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="w-full px-3 py-2.5 text-xs bg-white border border-gray-200 rounded-xl outline-none focus:border-orange-500 transition-all text-[#0D1B2A] font-medium"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Assign System Role</label>
                    <select 
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value)}
                      className="w-full px-3 py-2.5 text-xs bg-white border border-gray-200 rounded-xl outline-none focus:border-orange-500 transition-all text-[#0D1B2A] font-bold cursor-pointer"
                    >
                      {['super_admin', 'admin', 'seller', 'creator', 'moderator', 'finance_manager', 'support_agent', 'marketing_manager'].map((r) => (
                        <option key={r} value={r} className="capitalize">{r.replace('_', ' ')}</option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2 flex justify-end gap-2 pt-2">
                    <button 
                      type="button"
                      onClick={() => setIsInviting(false)}
                      className="px-4 py-2 border border-gray-200 rounded-xl text-xs text-gray-500 font-bold hover:bg-gray-100 transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      className="px-5 py-2 bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-md shadow-orange-600/10"
                    >
                      Send Invite
                    </button>
                  </div>
                </form>
              </div>
            )}
            
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1 py-4 border-b mt-4">PLATFORM CONFIG</div>
            <SettingRow 
              icon={Globe} 
              label="Maintenance Mode" 
              desc="Take the platform offline for system-wide updates."
              action={
                <button
                  id="btn-settings-maintenance"
                  onClick={toggleMaintenance}
                  className={`w-10 h-5 rounded-full relative transition-colors duration-200 cursor-pointer ${maintenance ? 'bg-[#ef3c23]' : 'bg-gray-200'}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all duration-200 ${maintenance ? 'left-[22px]' : 'left-0.5'}`} />
                </button>
              }
            />
            <SettingRow 
              icon={Database} 
              label="Database Optimization" 
              desc="Run indexing and cache clearing (Last run: 4h ago)."
              action={
                <button 
                  onClick={() => showToast("✓ Database optimization indices rebuilt & fast cache metrics cleared!")}
                  className="px-3.5 py-1.5 border border-gray-100 rounded-xl text-[11px] font-bold hover:bg-gray-50 cursor-pointer text-[#0D1B2A]"
                >
                  Run Now
                </button>
              }
            />
            <SettingRow 
              icon={Mail} 
              label="SMTP Configuration" 
              desc="Manage transactional email settings for notifications."
              action={
                <button 
                  onClick={() => showToast("✓ SMTP transactional test dispatcher responded healthy.")}
                  className="text-[11px] font-bold text-gray-400 cursor-pointer hover:text-[#0D1B2A]"
                >
                  Configure
                </button>
              }
            />
          </div>
        </div>
      )}

      {/* 2. ROLES & PERMISSIONS TAB */}
      {isCurrentTab('roles', ['permissions']) && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
             <h3 className="text-lg font-bold text-[#0D1B2A] mb-1">Roles &amp; Access Controls</h3>
             <p className="text-gray-400 text-sm">Fine-tune system access limits for the 8 default role personas across administrative workspace directories.</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
             <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                   <thead>
                      <tr className="bg-gray-50 border-b border-gray-100 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                         <th className="p-4 pl-6 whitespace-nowrap">Assignee Role Persona</th>
                         <th className="p-4 text-center whitespace-nowrap">Content Mgmt</th>
                         <th className="p-4 text-center whitespace-nowrap">User Mgmt</th>
                         <th className="p-4 text-center whitespace-nowrap">Financial Access</th>
                         <th className="p-4 text-center whitespace-nowrap">Brand Verification</th>
                         <th className="p-4 text-center whitespace-nowrap">System Config</th>
                         <th className="p-4 text-center whitespace-nowrap">Analytics Access</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-50">
                      {Object.keys(rolePermissions).map((role) => (
                         <tr key={role} className="hover:bg-gray-50/50 transition-colors">
                            <td className="p-4 pl-6 font-extrabold text-[12px] capitalize text-[#0D1B2A]">
                               {role.replace(/_/g, ' ')}
                            </td>
                            {['content', 'users', 'finance', 'brand', 'system', 'analytics'].map((permKey) => (
                               <td key={permKey} className="p-4 text-center">
                                  <input 
                                    id={`chk-permission-${role}-${permKey}`}
                                    type="checkbox"
                                    checked={rolePermissions[role]?.[permKey] || false}
                                    onChange={(e) => handlePermissionToggle(role, permKey, e.target.checked)}
                                    className="w-4 h-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500 cursor-pointer accent-[#ef3c23]"
                                  />
                               </td>
                            ))}
                         </tr>
                      ))}
                   </tbody>
                </table>
             </div>
          </div>
        </div>
      )}

      {/* 3. FEATURE FLAGS TAB */}
      {isCurrentTab('features') && (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm space-y-6">
          <div>
            <h3 className="text-lg font-bold text-[#0D1B2A] mb-1">Platform Feature Flags</h3>
            <p className="text-gray-400 text-sm">Toggle live client-side modules, marketing mechanics, or experimental payment flows with instant hot reloads.</p>
          </div>

          <div className="divide-y divide-gray-50">
             <SettingRow 
               icon={User}
               label="Enable Creator Marketplace"
               desc="Allow brand sponsors to scout, contact, and contract creators directly."
               action={
                 <button
                   onClick={() => toggleFeatureFlag('enable_creator_marketplace')}
                   className={`w-10 h-5 rounded-full relative transition-colors duration-200 cursor-pointer ${featureFlags.enable_creator_marketplace ? 'bg-[#ef3c23]' : 'bg-gray-200'}`}
                 >
                   <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all duration-200 ${featureFlags.enable_creator_marketplace ? 'left-[22px]' : 'left-0.5'}`} />
                 </button>
               }
             />
             <SettingRow 
               icon={Globe}
               label="Enable Community Submissions"
               desc="Enable users to submit alternative links, upvote brand rankings, and flag issues."
               action={
                 <button
                   onClick={() => toggleFeatureFlag('enable_community_submissions')}
                   className={`w-10 h-5 rounded-full relative transition-colors duration-200 cursor-pointer ${featureFlags.enable_community_submissions ? 'bg-[#ef3c23]' : 'bg-gray-200'}`}
                 >
                   <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all duration-200 ${featureFlags.enable_community_submissions ? 'left-[22px]' : 'left-0.5'}`} />
                 </button>
               }
             />
             <SettingRow 
               icon={Settings}
               label="Enable Campaign Banners"
               desc="Ensure active campaign promos are displayed prominently on the main storefront homepage banner."
               action={
                 <button
                   onClick={() => toggleFeatureFlag('enable_campaign_banners')}
                   className={`w-10 h-5 rounded-full relative transition-colors duration-200 cursor-pointer ${featureFlags.enable_campaign_banners ? 'bg-[#ef3c23]' : 'bg-gray-200'}`}
                 >
                   <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all duration-200 ${featureFlags.enable_campaign_banners ? 'left-[22px]' : 'left-0.5'}`} />
                 </button>
               }
             />
             <SettingRow 
               icon={Shield}
               label="Enable COD Only Mode"
               desc="Enforce Cash on Delivery validation requirements globally for high-volume fraud prevention."
               action={
                 <button
                   onClick={() => toggleFeatureFlag('enable_cod_only_mode')}
                   className={`w-10 h-5 rounded-full relative transition-colors duration-200 cursor-pointer ${featureFlags.enable_cod_only_mode ? 'bg-[#ef3c23]' : 'bg-gray-200'}`}
                 >
                   <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all duration-200 ${featureFlags.enable_cod_only_mode ? 'left-[22px]' : 'left-0.5'}`} />
                 </button>
               }
             />
             <SettingRow 
               icon={Lock}
               label="Enable Promo Codes"
               desc="Turn on support for coupon-based discounts and interactive client-side rewards page."
               action={
                 <button
                   onClick={() => toggleFeatureFlag('enable_promo_codes')}
                   className={`w-10 h-5 rounded-full relative transition-colors duration-200 cursor-pointer ${featureFlags.enable_promo_codes ? 'bg-[#ef3c23]' : 'bg-gray-200'}`}
                 >
                   <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all duration-200 ${featureFlags.enable_promo_codes ? 'left-[22px]' : 'left-0.5'}`} />
                 </button>
               }
             />
             <SettingRow 
               icon={Mail}
               label="Enable Brand Deals Page"
               desc="Unlock custom listings for special curated bundle offers and creator-sponsored products."
               action={
                 <button
                   onClick={() => toggleFeatureFlag('enable_brand_deals_page')}
                   className={`w-10 h-5 rounded-full relative transition-colors duration-200 cursor-pointer ${featureFlags.enable_brand_deals_page ? 'bg-[#ef3c23]' : 'bg-gray-200'}`}
                 >
                   <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all duration-200 ${featureFlags.enable_brand_deals_page ? 'left-[22px]' : 'left-0.5'}`} />
                 </button>
               }
             />
             <SettingRow 
               icon={Database}
               label="Enable Comparison Engine"
               desc="Turn on side-by-side product comparisons of user choices on the frontend catalog."
               action={
                 <button
                   onClick={() => toggleFeatureFlag('enable_comparison_engine')}
                   className={`w-10 h-5 rounded-full relative transition-colors duration-200 cursor-pointer ${featureFlags.enable_comparison_engine ? 'bg-[#ef3c23]' : 'bg-gray-200'}`}
                 >
                   <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all duration-200 ${featureFlags.enable_comparison_engine ? 'left-[22px]' : 'left-0.5'}`} />
                 </button>
               }
             />
          </div>
        </div>
      )}

      {/* 4. SECURITY TAB */}
      {isCurrentTab('security') && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
             <h3 className="text-lg font-bold text-[#0D1B2A] mb-1">Security Audit &amp; Activity Logs</h3>
             <p className="text-gray-400 text-sm">Read-only system tracing ledger registering authorization updates across admin accounts.</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
             <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                   <thead>
                      <tr className="bg-gray-50 border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                         <th className="p-4 pl-6">Core Action Type</th>
                         <th className="p-4">Performed By</th>
                         <th className="p-4">Session Role</th>
                         <th className="p-4">Timestamp Log</th>
                         <th className="p-4 pr-6">IP Address</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-50 text-xs text-gray-600">
                      {mockAuditLogs.map((log, idx) => (
                         <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                            <td className="p-4 pl-6 font-extrabold text-[#0D1B2A]">{log.action}</td>
                            <td className="p-4 font-medium">{log.user}</td>
                            <td className="p-4">
                               <span className="px-2 py-0.5 rounded text-[9px] font-mono font-black uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
                                  {log.role.replace(/_/g, ' ')}
                               </span>
                            </td>
                            <td className="p-4 text-gray-400 font-mono">{log.timestamp}</td>
                            <td className="p-4 pr-6 text-gray-400 font-mono">{log.ip}</td>
                         </tr>
                      ))}
                   </tbody>
                </table>
             </div>
          </div>
        </div>
      )}

      {/* 5. DANGER ZONE TAB */}
      {isCurrentTab('danger') && (
        <div className="bg-red-50 rounded-2xl border border-red-100 p-8 space-y-6">
          <div>
            <h3 className="text-lg font-bold text-red-900 mb-1">Danger Zone</h3>
            <p className="text-red-700/60 text-sm">Irreversible, high-risk administrative operations that impact system session tokens and database logs.</p>
          </div>

          <div className="flex flex-col md:flex-row gap-4 flex-wrap">
             <div className="flex flex-col">
               <button 
                 onClick={() => setConfirmingId('flush_analytics')}
                 className="bg-red-600 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-xl shadow-red-200 hover:bg-red-700 transition-colors cursor-pointer"
               >
                  Flush All Analytics Logs
               </button>
               {confirmingId === 'flush_analytics' && (
                 <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-xl flex flex-col gap-2 max-w-xs">
                   <span className="text-[10px] font-black text-red-600">Flush all logs? This cannot be undone.</span>
                   <div className="flex gap-2">
                     <button
                       onClick={() => { handleFlushAnalytics(); setConfirmingId(null); }}
                       className="px-3 py-1.5 bg-red-500 text-white text-[9px] font-black uppercase rounded-lg hover:bg-red-600 transition-colors"
                     >Confirm</button>
                     <button
                       onClick={() => setConfirmingId(null)}
                       className="px-3 py-1.5 bg-gray-100 text-gray-600 text-[9px] font-black uppercase rounded-lg hover:bg-gray-200 transition-colors"
                     >Cancel</button>
                   </div>
                 </div>
               )}
             </div>

             <div className="flex flex-col">
               <button 
                 onClick={() => setConfirmingId('reset_flags')}
                 className="bg-red-100 text-red-700 border border-red-200 px-6 py-3 rounded-xl font-bold text-sm hover:bg-red-200 transition-colors cursor-pointer text-center"
               >
                  Reset All Feature Flags to Default
               </button>
               {confirmingId === 'reset_flags' && (
                 <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-xl flex flex-col gap-2 max-w-xs">
                   <span className="text-[10px] font-black text-red-600">Reset all feature flags to default?</span>
                   <div className="flex gap-2">
                     <button
                       onClick={() => { handleResetFeatureFlags(); setConfirmingId(null); }}
                       className="px-3 py-1.5 bg-red-500 text-white text-[9px] font-black uppercase rounded-lg hover:bg-red-600 transition-colors"
                     >Confirm</button>
                     <button
                       onClick={() => setConfirmingId(null)}
                       className="px-3 py-1.5 bg-gray-100 text-gray-600 text-[9px] font-black uppercase rounded-lg hover:bg-gray-200 transition-colors"
                     >Cancel</button>
                   </div>
                 </div>
               )}
             </div>

             <div className="flex flex-col">
               <button 
                 onClick={() => setConfirmingId('clear_sessions')}
                 className="bg-white text-red-600 border border-red-200 px-6 py-3 rounded-xl font-bold text-sm hover:bg-red-50 transition-colors cursor-pointer text-center"
               >
                  Clear All Admin Sessions
               </button>
               {confirmingId === 'clear_sessions' && (
                 <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-xl flex flex-col gap-2 max-w-xs">
                   <span className="text-[10px] font-black text-red-600">Terminate all admin sessions?</span>
                   <div className="flex gap-2">
                     <button
                       onClick={() => { handleClearSessions(); setConfirmingId(null); }}
                       className="px-3 py-1.5 bg-red-500 text-white text-[9px] font-black uppercase rounded-lg hover:bg-red-600 transition-colors"
                     >Confirm</button>
                     <button
                       onClick={() => setConfirmingId(null)}
                       className="px-3 py-1.5 bg-gray-100 text-gray-600 text-[9px] font-black uppercase rounded-lg hover:bg-gray-200 transition-colors"
                     >Cancel</button>
                   </div>
                 </div>
               )}
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
