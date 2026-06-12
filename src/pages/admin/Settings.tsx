import React from 'react';
import { Settings, Shield, Bell, Database, Globe, Smartphone, User, Lock, Mail } from 'lucide-react';

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
  return (
    <div className="max-w-4xl mx-auto space-y-6">
       <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
          <h3 className="text-lg font-bold text-[#0D1B2A] mb-2">Platform Settings</h3>
          <p className="text-gray-400 text-sm mb-6">Manage global configurations for the Choosify platform.</p>
          
          <div className="space-y-2">
             <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1 py-4 border-b">SECURITY & ACCESS</div>
             <SettingRow 
               icon={Shield} 
               label="Two-Factor Authentication" 
               desc="Enforce 2FA for all moderator and admin accounts."
               action={<div className="w-10 h-5 bg-[#0D1B2A] rounded-full relative"><div className="absolute right-0.5 top-0.5 w-4 h-4 bg-white rounded-full" /></div>}
             />
             <SettingRow 
               icon={User} 
               label="Admin Invite" 
               desc="Invite a new administrator or content moderator."
               action={<button className="text-[11px] font-bold text-blue-600">Invite User</button>}
             />
             
             <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1 py-4 border-b mt-4">PLATFORM CONFIG</div>
             <SettingRow 
               icon={Globe} 
               label="Maintenance Mode" 
               desc="Take the platform offline for system-wide updates."
               action={<div className="w-10 h-5 bg-gray-200 rounded-full relative"><div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full" /></div>}
             />
             <SettingRow 
               icon={Database} 
               label="Database Optimization" 
               desc="Run indexing and cache clearing (Last run: 4h ago)."
               action={<button className="px-3 py-1.5 border border-gray-100 rounded text-[11px] font-bold hover:bg-gray-50">Run Now</button>}
             />
             <SettingRow 
               icon={Mail} 
               label="SMTP Configuration" 
               desc="Manage transactional email settings for notifications."
               action={<button className="text-[11px] font-bold text-gray-400">Configure</button>}
             />
          </div>
       </div>

       <div className="bg-red-50 rounded-2xl border border-red-100 p-8">
          <h3 className="text-lg font-bold text-red-900 mb-2">Danger Zone</h3>
          <p className="text-red-700/60 text-sm mb-6">Irreversible actions that affect the entire production system.</p>
          <button className="bg-red-600 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-xl shadow-red-200">
             Flush All Analytics Logs
          </button>
       </div>
    </div>
  );
}
