import React, { useState } from 'react';
import { Sliders, Mail, Phone, Lock, CheckCircle2 } from 'lucide-react';

interface BrandAccountTabProps {
  merchantContact: any;
  setMerchantContact: React.Dispatch<React.SetStateAction<any>>;
  notifications: any;
  setNotifications: React.Dispatch<React.SetStateAction<any>>;
  authControls: any;
  setAuthControls: React.Dispatch<React.SetStateAction<any>>;
  adminControls: any;
  setAdminControls: React.Dispatch<React.SetStateAction<any>>;
  brandProfile: any;
  saveIdentity: () => void;
  saveAlerts: () => void;
  saveAuthCreds: () => void;
  saveAdminControls: () => void;
  logs: any[];
  addLog: (action: string, notes: string) => void;
}

export const BrandAccountTab: React.FC<BrandAccountTabProps> = ({
  merchantContact,
  setMerchantContact,
  notifications,
  setNotifications,
  authControls,
  setAuthControls,
  adminControls,
  setAdminControls,
  brandProfile,
  saveIdentity,
  saveAlerts,
  saveAuthCreds,
  saveAdminControls,
  logs,
  addLog
}) => {
  const [newLogAction, setNewLogAction] = useState('');
  const [newLogNotes, setNewLogNotes] = useState('');
  const brandLogs = logs.filter(l => l.brandId === brandProfile.id);

  const handleAddLog = () => {
    if (!newLogAction.trim()) return;
    addLog(newLogAction, newLogNotes || 'Performed standard administrative audit review.');
    setNewLogAction('');
    setNewLogNotes('');
  };

  return (
    <div className="space-y-6" id="account_information_panel">
      {/* Profile Identity Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5 text-left">
        <h3 className="text-xs font-black text-app-text-secondary uppercase tracking-widest">Merchant Contact & Identity Settings</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-medium">
          <div className="space-y-1.5">
            <label className="text-slate-650 font-bold">Official Representative Name</label>
            <input 
              value={merchantContact.repName} 
              onChange={(e) => setMerchantContact(prev => ({ ...prev, repName: e.target.value }))}
              className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#F4631E] font-medium" 
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-slate-650 font-bold">Official Business Email</label>
            <input 
              value={merchantContact.busEmail} 
              onChange={(e) => setMerchantContact(prev => ({ ...prev, busEmail: e.target.value }))}
              className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#F4631E] font-mono" 
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-slate-650 font-bold">Registered Phone Contact</label>
            <input 
              value={merchantContact.phone} 
              onChange={(e) => setMerchantContact(prev => ({ ...prev, phone: e.target.value }))}
              className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#F4631E]" 
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-slate-650 font-bold">Profile Logo Photo URL / Asset Link</label>
            <input 
              value={merchantContact.logoUrl} 
              onChange={(e) => setMerchantContact(prev => ({ ...prev, logoUrl: e.target.value }))}
              className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#F4631E]" 
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-slate-650 font-bold">Corporate Registered HQ Address</label>
            <textarea 
              rows={2}
              value={merchantContact.address} 
              onChange={(e) => setMerchantContact(prev => ({ ...prev, address: e.target.value }))}
              className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#F4631E] font-medium resize-none" 
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button 
            onClick={saveIdentity}
            className="px-5 py-2 bg-app-card hover:bg-slate-800 text-app-text-primary rounded-xl text-xs font-bold transition-all"
          >
            Save Profile Identity
          </button>
        </div>
      </div>

      {/* Communications Channels settings */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5 text-left">
        <h3 className="text-xs font-black text-app-text-secondary uppercase tracking-widest">Merchant Communications & Alert Channels</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-medium">
          {[
            { key: 'push', title: 'Browser Push Notifications', desc: 'Enable native dashboard updates' },
            { key: 'weeklyReport', title: 'Commerce Summary Reports', desc: 'Get weekly sales volumes and logistics updates' },
            { key: 'emailAlerts', title: 'Email Routing Channel', desc: 'Route disputes and orders to verified email' },
            { key: 'phoneSms', title: 'Phone Routing Channel', desc: 'Critical warehouse operations SMS backup' }
          ].map((item) => (
            <label key={item.key} className="flex items-start gap-3 bg-slate-50 p-4 border border-slate-205 rounded-xl cursor-pointer hover:bg-slate-100/50 transition-all select-none">
              <input 
                type="checkbox" 
                checked={!!notifications[item.key]} 
                onChange={(e) => setNotifications((prev: any) => ({ ...prev, [item.key]: e.target.checked }))}
                className="mt-0.5 accent-[#F4631E]" 
              />
              <div className="text-left">
                <span className="font-bold text-slate-800 block">{item.title}</span>
                <span className="text-[10px] text-app-text-secondary block mt-0.5">{item.desc}</span>
              </div>
            </label>
          ))}
        </div>

        <div className="flex justify-end">
          <button 
            onClick={saveAlerts}
            className="px-5 py-2 bg-app-card hover:bg-slate-800 text-app-text-primary rounded-xl text-xs font-bold transition-all"
          >
            Save Communication Settings
          </button>
        </div>
      </div>

      {/* Access Controls Panel */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5 text-left">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-[#F4631E]" />
          <h3 className="text-xs font-black text-app-text-secondary uppercase tracking-widest">Platform Access Controls (Administrative Only)</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="space-y-1.5 text-left">
            <label className="text-slate-650 font-bold">Subscription Tier Access</label>
            <select 
              value={adminControls.subscriptionType} 
              onChange={(e) => setAdminControls((prev: any) => ({ ...prev, subscriptionType: e.target.value }))}
              className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 focus:outline-none font-bold"
            >
              <option>Platinum Enterprise</option>
              <option>Gold Premium Tier</option>
              <option>Basic Free Onboarding</option>
            </select>
          </div>

          <div className="space-y-1.5 text-left">
            <label className="text-slate-650 font-bold">Administrative Seller Status</label>
            <select 
              value={adminControls.sellerStatus} 
              onChange={(e) => setAdminControls((prev: any) => ({ ...prev, sellerStatus: e.target.value, isActive: e.target.value !== 'Suspended' }))}
              className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 focus:outline-none font-bold"
            >
              <option>Verified</option>
              <option>Pending Verification</option>
              <option>Suspended</option>
              <option>Banned</option>
            </select>
          </div>

          <div className="md:col-span-2 border-t border-slate-150 pt-4 space-y-3 select-none text-left">
            <span className="font-bold text-slate-700 block">Feature Access Permissions</span>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { key: 'allowAds', title: 'Can Administer Ads' },
                { key: 'allowStoreCustomization', title: 'Premium Branding Studio' },
                { key: 'allowDirectMessaging', title: 'Direct Chat Access' }
              ].map(f => (
                <label key={f.key} className="flex items-center gap-2 bg-slate-50 px-4 py-2.5 border border-slate-205 rounded-xl cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={!!adminControls[f.key]} 
                    onChange={(e) => setAdminControls((prev: any) => ({ ...prev, [f.key]: e.target.checked }))}
                    className="accent-[#F4631E]" 
                  />
                  <span className="font-bold text-slate-650">{f.title}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button 
            onClick={saveAdminControls}
            className="px-6 py-2.5 bg-[#F4631E] hover:bg-[#eb4501] text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all"
          >
            Save Access Constraints
          </button>
        </div>
      </div>

      {/* Security settings */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5 text-left">
        <h3 className="text-xs font-black text-app-text-secondary uppercase tracking-widest font-bold">Authorized Access Controls</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-left">
          <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="flex items-center gap-3 bg-slate-50 p-4 border border-slate-205 rounded-xl cursor-pointer">
              <input 
                type="checkbox" 
                checked={!!authControls.twoFactor} 
                onChange={(e) => setAuthControls((prev: any) => ({ ...prev, twoFactor: e.target.checked }))}
                className="accent-[#F4631E]" 
              />
              <div className="text-left">
                <span className="font-bold text-slate-800 block">Two Factor Authentication (MFA)</span>
                <span className="text-[10px] text-app-text-secondary block mt-0.5">Enforce SMS/OTP verification code upon sign in</span>
              </div>
            </label>

            <label className="flex items-center gap-3 bg-slate-50 p-4 border border-slate-205 rounded-xl cursor-pointer">
              <input 
                type="checkbox" 
                checked={!!authControls.sessionLapse} 
                onChange={(e) => setAuthControls((prev: any) => ({ ...prev, sessionLapse: e.target.checked }))}
                className="accent-[#F4631E]" 
              />
              <div className="text-left">
                <span className="font-bold text-slate-800 block">Enforce Inactive Session Timeout</span>
                <span className="text-[10px] text-app-text-secondary block mt-0.5">Automatically lock console after 15 mins inactivity</span>
              </div>
            </label>
          </div>

          <div className="md:col-span-2 border-t border-slate-150 pt-4 space-y-3">
            <h4 className="text-[10px] font-black text-app-text-secondary uppercase tracking-wider">Password Credentials Management</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-slate-500 font-bold">Current Password</label>
                <input 
                  type="password" 
                  value={authControls.currentPass || ''}
                  onChange={(e) => setAuthControls((prev: any) => ({ ...prev, currentPass: e.target.value }))}
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2 focus:outline-none focus:border-[#F4631E]" 
                  placeholder="••••••••"
                />
              </div>
              <div className="space-y-1">
                <label className="text-slate-500 font-bold">New Password</label>
                <input 
                  type="password" 
                  value={authControls.newPass || ''}
                  onChange={(e) => setAuthControls((prev: any) => ({ ...prev, newPass: e.target.value }))}
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2 focus:outline-none focus:border-[#F4631E]" 
                  placeholder="••••••••"
                />
              </div>
              <div className="space-y-1">
                <label className="text-slate-500 font-bold">Confirm New Password</label>
                <input 
                  type="password" 
                  value={authControls.confirmPass || ''}
                  onChange={(e) => setAuthControls((prev: any) => ({ ...prev, confirmPass: e.target.value }))}
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2 focus:outline-none focus:border-[#F4631E]" 
                  placeholder="••••••••"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button 
            onClick={saveAuthCreds}
            className="px-5 py-2 bg-app-card hover:bg-slate-800 text-app-text-primary rounded-xl text-xs font-bold transition-all"
          >
            Save Password Credentials
          </button>
        </div>
      </div>

      {/* Interactive Audit Logs Journal Legder */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4 text-left">
        <h3 className="text-xs font-black text-app-text-secondary uppercase tracking-widest">Administrative Audit Ledger Logs</h3>
        
        <div className="space-y-3">
          <div className="max-h-60 overflow-y-auto border border-slate-205 rounded-xl divide-y divide-slate-100 bg-slate-50">
            {brandLogs.length === 0 ? (
              <p className="text-slate-450 p-4 font-mono text-[11px] text-center">No security ledger items recorded for this brand.</p>
            ) : (
              brandLogs.map((log: any) => (
                <div key={log.id} className="p-3 text-xs flex justify-between gap-4">
                  <div className="space-y-0.5">
                    <span className="font-bold font-mono text-indigo-600 block">{log.action}</span>
                    <span className="text-slate-600 font-medium block">{log.notes}</span>
                    <span className="text-[10px] text-app-text-secondary block">{log.timestamp}</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-md h-fit">
                    {log.user}
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="bg-slate-50/50 border border-slate-205 rounded-xl p-4 space-y-3">
            <span className="text-[10px] font-black tracking-widest text-[#F4631E] uppercase block">Record New Audit Event</span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <input 
                type="text" 
                placeholder="Action Title (e.g., KYC Document Approved)" 
                value={newLogAction}
                onChange={(e) => setNewLogAction(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2 focus:outline-none focus:border-[#F4631E] font-bold"
              />
              <input 
                type="text" 
                placeholder="Audit description details..." 
                value={newLogNotes}
                onChange={(e) => setNewLogNotes(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2 focus:outline-none focus:border-[#F4631E] font-medium"
              />
            </div>
            <div className="flex justify-end">
              <button 
                onClick={handleAddLog}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all"
              >
                Insert Ledger Event
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
