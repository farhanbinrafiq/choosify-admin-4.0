import React from 'react';
import { Phone, MessageSquare } from 'lucide-react';

export interface IdentityBadge {
  label: string;
  colorClass?: string; // e.g. "bg-green-500/10 text-green-400 border-green-500/20"
}

export interface IdentityField {
  label: string;
  value: React.ReactNode;
}

interface IdentityCardProps {
  bannerText: string;
  bannerGradientClass?: string; // e.g. "from-emerald-600/30 via-app-card to-app-gradient-end"
  avatarUrl?: string;
  initials?: string;
  name: string;
  handle?: string;
  persona?: string;
  badges?: IdentityBadge[];
  fields?: IdentityField[];
  onPhoneClick?: () => void;
  onMessageClick?: () => void;
}

export default function IdentityCard({
  bannerText,
  bannerGradientClass = 'from-emerald-600/30 via-app-card to-app-gradient-end',
  avatarUrl,
  initials = 'CL',
  name,
  handle,
  persona,
  badges = [],
  fields = [],
  onPhoneClick,
  onMessageClick,
}: IdentityCardProps) {
  return (
    <div className="bg-app-card border border-app-border rounded-[4px] overflow-hidden shadow-xl font-sans">
      {/* Top Banner */}
      <div className={`h-24 bg-gradient-to-r ${bannerGradientClass} opacity-90 relative overflow-hidden flex items-center justify-center`}>
        <div className="absolute inset-0 flex items-center justify-center px-4">
          <span className="text-xl sm:text-2xl md:text-xl lg:text-xl xl:text-2xl font-black text-white uppercase tracking-[0.22em] select-none text-center max-w-full truncate">
            {bannerText}
          </span>
        </div>
      </div>

      {/* Details Box */}
      <div className="px-5 pb-5 relative">
        <div className="-mt-10 mb-4 flex items-end justify-between">
          {avatarUrl ? (
            <img 
              src={avatarUrl} 
              alt={name}
              className="w-20 h-20 rounded-full border-2 border-app-border object-cover bg-app-card shrink-0" 
            />
          ) : (
            <div className="w-20 h-20 rounded-full border-2 border-app-border bg-slate-900 flex items-center justify-center text-xl font-black text-white shrink-0">
              {initials}
            </div>
          )}

          {/* Contact Actions */}
          <div className="flex gap-1.5">
            {onPhoneClick && (
              <button 
                onClick={onPhoneClick}
                className="p-2 rounded-[4px] border border-app-border text-app-accent hover:border-app-accent hover:bg-app-accent/5 transition-all bg-app-card cursor-pointer"
                title="Call Entity"
              >
                <Phone className="w-3.5 h-3.5" />
              </button>
            )}
            {onMessageClick && (
              <button 
                onClick={onMessageClick}
                className="p-2 rounded-[4px] bg-app-accent text-white hover:bg-app-accent-light transition-all shadow-sm cursor-pointer"
                title="Message Entity"
              >
                <MessageSquare className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Identity Details */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base font-bold tracking-tight text-white">{name}</h2>
            {badges.map((badge, idx) => (
              <span
                key={idx}
                className={`px-2 py-0.5 rounded-[2px] text-[8.5px] uppercase tracking-widest font-extrabold border ${
                  badge.colorClass || 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                }`}
              >
                {badge.label}
              </span>
            ))}
          </div>
          {handle && (
            <p className="text-[9.5px] font-semibold text-app-accent-light font-mono block">
              {handle}
            </p>
          )}
          {persona && (
            <p className="text-[11px] text-app-text-secondary leading-relaxed">
              {persona}
            </p>
          )}
        </div>

        {/* Key-Value Attributes List */}
        {fields.length > 0 && (
          <div className="mt-5 space-y-3.5 pt-4 border-t border-white/5">
            {fields.map((field, idx) => (
              <div key={idx} className={idx > 0 ? "pt-2 border-t border-white/5" : ""}>
                <label className="text-[9px] text-app-text-secondary font-bold uppercase tracking-wider block opacity-70">
                  {field.label}
                </label>
                <div className="text-xs text-white font-semibold mt-0.5 block truncate leading-relaxed">
                  {field.value}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
