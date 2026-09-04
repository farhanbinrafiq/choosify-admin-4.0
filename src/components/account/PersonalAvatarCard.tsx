import React, { useRef, useState } from 'react';
import { Camera, Loader2, Trash2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getAvatarUrl, getUserInitials } from '../../lib/userDisplay';
import { uploadUserAvatar } from '../../services/mediaUpload';

/**
 * Self-service personal profile photo — drop-in for any dashboard "Account
 * Settings" tab (Seller, Creator; Admin/Super Admin use IdentityCard's own
 * inline control since their avatar circle already IS the personal photo).
 * Deliberately separate from Brand/Channel logo controls elsewhere on the
 * page — this only ever touches the signed-in user's own `users.avatarUrl`
 * via AuthContext.updateAvatar, never a brand/creator record.
 */
export function PersonalAvatarCard() {
  const { profile, updateAvatar } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!profile) return null;

  const avatarUrl = getAvatarUrl(profile);
  const initials = getUserInitials(profile.displayName, profile.email);
  const hasRealPhoto = Boolean(profile.avatar?.trim());

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file (JPG, PNG, WebP, or GIF).');
      return;
    }
    if (file.size > 2_500_000) {
      setError('Please choose an image under 2.5 MB.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const url = await uploadUserAvatar(file);
      await updateAvatar(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile photo.');
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    setBusy(true);
    setError(null);
    try {
      await updateAvatar(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove profile photo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-3.5 bg-white/5 border border-app-border rounded space-y-3 text-xs font-sans">
      <div>
        <span className="font-bold text-app-text-primary block">Personal Profile Photo</span>
        <span className="text-[9.5px] text-app-text-secondary block mt-0.5">
          Shown on your own account only — separate from your business/brand logo.
        </span>
      </div>
      <div className="flex items-center gap-3">
        <div className="relative w-12 h-12 rounded-full shrink-0 overflow-hidden border border-app-border bg-slate-900 flex items-center justify-center text-white text-[11px] font-black">
          <span aria-hidden>{initials}</span>
          <img
            src={avatarUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            onError={(event) => {
              event.currentTarget.style.display = 'none';
            }}
          />
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) void handleFile(file);
          }}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => fileInputRef.current?.click()}
          className="px-3 py-1.5 bg-white/5 border border-app-border hover:bg-white/10 text-app-text-primary rounded font-bold cursor-pointer transition-colors text-xs disabled:opacity-60 inline-flex items-center gap-1.5"
        >
          {busy ? <Loader2 className="w-3 h-3 animate-spin" aria-hidden /> : <Camera className="w-3 h-3" aria-hidden />}
          {hasRealPhoto ? 'Change' : 'Upload'}
        </button>
        {hasRealPhoto && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleRemove()}
            className="px-3 py-1.5 bg-white/5 border border-app-border hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/30 text-app-text-primary rounded font-bold cursor-pointer transition-colors text-xs disabled:opacity-60 inline-flex items-center gap-1.5"
          >
            <Trash2 className="w-3 h-3" aria-hidden /> Remove
          </button>
        )}
      </div>
      {error && <div className="text-[10px] text-rose-400 font-semibold">{error}</div>}
      <div className="text-[9.5px] text-app-text-secondary">JPG, PNG, WebP, or GIF. Up to 2.5 MB.</div>
    </div>
  );
}

export default PersonalAvatarCard;
