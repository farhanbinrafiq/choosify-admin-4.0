import React, { useRef } from 'react';
import { Camera, Loader2, Phone, MessageSquare } from 'lucide-react';
import { profileShellClasses, type ProfileShellVariant } from './profileTheme';
import { ProfileStatusBadges } from './ProfileStatusBadges';
import type { ResolvedProfileStatus } from '../../lib/profileStatus';

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
  /** Universal account status — rendered below name/handle, before Role / CF ID. */
  profileStatus?: ResolvedProfileStatus | null;
  showStatusHint?: boolean;
  fields?: IdentityField[];
  onPhoneClick?: () => void;
  onMessageClick?: () => void;
  variant?: ProfileShellVariant;
  /** Self-profile only — renders a small camera control on the avatar that
   *  uploads a new photo through the caller's own persistence (canonical
   *  AuthContext.updateAvatar). Omit entirely when viewing another user's
   *  profile — there is no admin-edit-another-user's-photo affordance. */
  onAvatarChange?: (file: File) => void;
  avatarBusy?: boolean;
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
  profileStatus = null,
  showStatusHint = false,
  fields = [],
  onPhoneClick,
  onMessageClick,
  variant = 'dark',
  onAvatarChange,
  avatarBusy = false,
}: IdentityCardProps) {
  const t = profileShellClasses(variant);
  const fieldDivider = variant === 'light' ? 'border-[#F1F3F5]' : 'border-white/5';
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !onAvatarChange) return;
    if (!file.type.startsWith('image/')) {
      window.alert('Please choose an image file (JPG, PNG, WebP, or GIF).');
      return;
    }
    if (file.size > 2_500_000) {
      window.alert('Please choose an image under 2.5 MB.');
      return;
    }
    onAvatarChange(file);
  };
  return (
    <div className={`${t.identityCard} font-sans`}>
      <div className={`${t.identityBanner} relative overflow-hidden flex items-center justify-center`}>
        <div className="absolute inset-0 flex items-center justify-center px-4">
          <span className="text-sm font-black text-white uppercase tracking-[0.22em] select-none text-center max-w-full truncate">
            {bannerText}
          </span>
        </div>
      </div>

      <div className="px-5 pb-5 relative">
        <div className="-mt-10 mb-4 flex items-end justify-between">
          <div className="relative shrink-0">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={name}
                className={`w-20 h-20 rounded-full border-2 object-cover ${
                  variant === 'light' ? 'border-white shadow-md bg-white' : 'border-app-border bg-app-card'
                }`}
              />
            ) : (
              <div
                className={`w-20 h-20 rounded-full border-2 flex items-center justify-center text-xl font-black ${
                  variant === 'light'
                    ? 'border-white bg-[#111827] text-white shadow-md'
                    : 'border-app-border bg-slate-900 text-white'
                }`}
              >
                {initials}
              </div>
            )}
            {onAvatarChange && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={avatarBusy}
                  aria-label="Change profile photo"
                  title="Change profile photo"
                  className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-app-accent text-white flex items-center justify-center border-2 border-app-card shadow-md hover:bg-app-accent-light transition-colors disabled:opacity-60"
                >
                  {avatarBusy ? (
                    <Loader2 className="w-3 h-3 animate-spin" aria-hidden />
                  ) : (
                    <Camera className="w-3 h-3" aria-hidden />
                  )}
                </button>
              </>
            )}
          </div>

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

        <div className="space-y-1.5">
          <h2 className={`${t.identityName} tracking-tight`}>{name}</h2>
          {handle && <p className={`${t.identityHandle} font-mono block`}>{handle}</p>}
          {profileStatus ? (
            <ProfileStatusBadges status={profileStatus} showHint={showStatusHint} />
          ) : badges.length > 0 ? (
            <div className="flex items-center gap-2 flex-wrap pt-0.5">
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
          ) : null}
          {persona && <p className={`${t.identityPersona} pt-0.5`}>{persona}</p>}
        </div>

        {fields.length > 0 && (
          <div className={`mt-5 space-y-3.5 pt-4 border-t ${fieldDivider}`}>
            {fields.map((field, idx) => (
              <div key={idx} className={idx > 0 ? `pt-2 border-t ${fieldDivider}` : ''}>
                <label className={`${t.identityFieldLabel} block`}>{field.label}</label>
                <div className={`${t.identityFieldValue} block truncate leading-relaxed`}>{field.value}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
