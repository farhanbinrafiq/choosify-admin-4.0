import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { KeyRound, Pencil, RefreshCw, Settings, Trash2, Undo2, User } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  formatRoleLabel,
  getAvatarUrl,
  getMyProfilePath,
  getSettingsPath,
  getUserInitials,
} from '../../lib/userDisplay';
import { dataUrlToFile, uploadUserAvatar } from '../../services/mediaUpload';
import { AvatarCropModal } from './AvatarCropModal';

type UserProfileDropdownProps = {
  /** `header` = AdminLayout chrome; `overlay` = fixed on CMS mirror iframe host */
  variant?: 'header' | 'overlay';
  className?: string;
};

type MenuItem = {
  id: string;
  label: string;
  icon: React.ReactNode;
  onSelect: () => void;
};

export function UserProfileDropdown({ variant = 'header', className = '' }: UserProfileDropdownProps) {
  const { profile, logout, updateAvatar } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [cropOpen, setCropOpen] = useState(false);
  const [cropSrc, setCropSrc] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const avatarMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuId = useId();

  const isClickOutside = useCallback((target: EventTarget | null) => {
    if (!(target instanceof Node)) return true;
    if (triggerRef.current?.contains(target)) return false;
    if (menuRef.current?.contains(target)) return false;
    if (avatarMenuRef.current?.contains(target)) return false;
    return true;
  }, []);

  const displayName = profile?.displayName?.trim() || 'User';
  const email = profile?.email?.trim() || '';
  const roleLabel = formatRoleLabel(profile?.role);
  const roleBadge = roleLabel.toUpperCase();
  const initials = getUserInitials(displayName, email);
  // profile.avatar (via getAvatarUrl) is the ONE canonical source — no
  // separate local/localStorage copy. Every consumer of `profile` (this
  // dropdown, the mobile drawer, the profile page) re-renders from the same
  // AuthContext state the instant updateAvatar() resolves.
  const avatarUrl = profile ? getAvatarUrl(profile) : '';
  const hasRealPhoto = Boolean(profile?.avatar?.trim());

  const close = useCallback(() => {
    setOpen(false);
    setAvatarMenuOpen(false);
  }, []);

  const handleLogout = useCallback(() => {
    close();
    logout();
    navigate('/login');
  }, [close, logout, navigate]);

  const go = useCallback(
    (path: string) => {
      close();
      navigate(path);
    },
    [close, navigate],
  );

  /** Uploads through the canonical media pipeline (category 'users'), then
   *  persists avatarUrl onto the account (PATCH /auth/profile) via AuthContext
   *  — the same call the Profile Photo section on the profile page makes. */
  const persistAvatar = useCallback(
    async (file: File) => {
      setAvatarBusy(true);
      try {
        const url = await uploadUserAvatar(file);
        await updateAvatar(url);
      } catch (err) {
        window.alert(err instanceof Error ? err.message : 'Failed to update profile photo.');
      } finally {
        setAvatarBusy(false);
      }
    },
    [updateAvatar],
  );

  /** Edit = crop / reposition the current photo. */
  const openCropEditor = useCallback(() => {
    setAvatarMenuOpen(false);
    if (!hasRealPhoto) {
      window.alert('No photo to edit. Use Replace to upload one first.');
      return;
    }
    setCropSrc(avatarUrl);
    setCropOpen(true);
  }, [avatarUrl, hasRealPhoto]);

  /** Replace = pick a new image file (reupload / change). */
  const openReplacePicker = useCallback(() => {
    setAvatarMenuOpen(false);
    fileInputRef.current?.click();
  }, []);

  const onAvatarFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        window.alert('Please choose an image file (JPG, PNG, WebP, or GIF).');
        return;
      }
      if (file.size > 2_500_000) {
        window.alert('Please choose an image under 2.5 MB.');
        return;
      }
      // Replace applies the new upload immediately; user can Edit to crop/reposition.
      void persistAvatar(file);
    },
    [persistAvatar],
  );

  const onCropSave = useCallback(
    (dataUrl: string) => {
      setCropOpen(false);
      setCropSrc('');
      void persistAvatar(dataUrlToFile(dataUrl, 'avatar.png'));
    },
    [persistAvatar],
  );

  const onRemovePhoto = useCallback(async () => {
    setAvatarMenuOpen(false);
    setAvatarBusy(true);
    try {
      await updateAvatar(null);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to remove profile photo.');
    } finally {
      setAvatarBusy(false);
    }
  }, [updateAvatar]);

  const onCropCancel = useCallback(() => {
    setCropOpen(false);
    setCropSrc('');
  }, []);

  const menuItems: MenuItem[] = profile
    ? (() => {
        const items: MenuItem[] = [
          {
            id: 'profile',
            label: 'My Profile',
            icon: <User className="w-[18px] h-[18px] text-[#7C3AED]" aria-hidden strokeWidth={2.25} />,
            onSelect: () => {
              go(getMyProfilePath(profile));
            },
          },
          {
            id: 'settings',
            label: 'Account Settings',
            icon: <Settings className="w-[18px] h-[18px] text-[#6B7280]" aria-hidden strokeWidth={2.25} />,
            onSelect: () => go(getSettingsPath()),
          },
          {
            id: 'security',
            label: 'Change password',
            icon: <KeyRound className="w-[18px] h-[18px] text-[#6B7280]" aria-hidden strokeWidth={2.25} />,
            onSelect: () => go('/admin/account/security'),
          },
        ];

        return items;
      })()
    : [];

  useEffect(() => {
    if (!open || cropOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!isClickOutside(event.target)) return;
      close();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (avatarMenuOpen) {
          setAvatarMenuOpen(false);
          return;
        }
        close();
        triggerRef.current?.focus();
        return;
      }

      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      const items = menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]');
      if (!items?.length) return;

      event.preventDefault();
      const list = Array.from(items);
      const active = document.activeElement as HTMLElement | null;
      const index = list.findIndex((el) => el === active);
      const next =
        event.key === 'ArrowDown'
          ? list[(index + 1 + list.length) % list.length]
          : list[(index - 1 + list.length) % list.length];
      next?.focus();
    };

    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [avatarMenuOpen, close, cropOpen, isClickOutside, open]);

  useEffect(() => {
    if (!open) {
      setAvatarMenuOpen(false);
      return;
    }
    if (cropOpen) return;
    const first = menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]');
    first?.focus();
  }, [cropOpen, open]);

  if (!profile) return null;

  const triggerClasses =
    variant === 'overlay'
      ? 'cms-mirror-profile-trigger'
      : 'flex items-center gap-2.5 pl-1 shrink-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-white/30';

  const AvatarFace = ({ sizeClass, textClass }: { sizeClass: string; textClass: string }) => (
    <span
      className={`relative flex items-center justify-center rounded-full font-bold text-white shrink-0 overflow-hidden ${sizeClass} ${textClass}`}
      style={{ backgroundImage: 'linear-gradient(135deg, #EF3C23, #2323FF)' }}
    >
      <img
        src={avatarUrl}
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
        onError={(event) => {
          event.currentTarget.style.display = 'none';
        }}
      />
      <span aria-hidden>{initials}</span>
    </span>
  );

  return (
    <div
      ref={rootRef}
      className={`relative ${variant === 'overlay' ? 'cms-mirror-profile-anchor' : ''} ${className}`}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={onAvatarFileChange}
      />

      <AvatarCropModal
        open={cropOpen}
        imageSrc={cropSrc}
        onCancel={onCropCancel}
        onSave={onCropSave}
      />

      {open && variant === 'overlay' && (
        <div
          className="fixed inset-0"
          style={{ zIndex: 118 }}
          aria-hidden="true"
          onPointerDown={() => {
            close();
          }}
        />
      )}

      <button
        ref={triggerRef}
        type="button"
        className={`${triggerClasses}${variant === 'overlay' ? ' relative z-[119]' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((prev) => !prev)}
        title={displayName}
      >
        {variant === 'header' && (
          <div className="hidden lg:block text-right">
            <div className="text-[12px] font-bold text-white leading-tight">{displayName}</div>
            <div className="text-[10px] text-white/50 leading-tight">{roleLabel}</div>
          </div>
        )}
        <AvatarFace
          sizeClass={variant === 'overlay' ? 'w-9 h-9' : 'w-8 h-8'}
          textClass={variant === 'overlay' ? 'text-[12px]' : 'text-[13px]'}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-label="Account menu"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-0 top-full mt-2.5 w-[268px] rounded-2xl border border-[#EEF2F6] bg-white shadow-[0_16px_40px_rgba(15,23,42,0.14)] overflow-visible z-[120]"
          >
            <div className="px-5 pt-5 pb-4 text-center">
              <div className="relative mx-auto mb-3 w-[72px] h-[72px]">
                <button
                  type="button"
                  className="relative w-full h-full rounded-full overflow-hidden ring-[3px] ring-white shadow-[0_6px_16px_rgba(15,23,42,0.12)] outline-none focus-visible:ring-2 focus-visible:ring-[#EF3C23]/40"
                  aria-label="Profile photo options"
                  aria-expanded={avatarMenuOpen}
                  title="Photo options"
                  disabled={avatarBusy}
                  onClick={(event) => {
                    event.stopPropagation();
                    setAvatarMenuOpen((prev) => !prev);
                  }}
                >
                  <span
                    className="absolute inset-0 flex items-center justify-center text-[18px] font-extrabold text-white"
                    style={{ backgroundImage: 'linear-gradient(135deg, #EF3C23, #2323FF)' }}
                  >
                    {initials}
                  </span>
                  <img
                    src={avatarUrl}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover"
                    onError={(event) => {
                      event.currentTarget.style.display = 'none';
                    }}
                  />
                  {avatarBusy && (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <RefreshCw className="w-4 h-4 text-white animate-spin" aria-hidden />
                    </span>
                  )}
                </button>

                <AnimatePresence>
                  {avatarMenuOpen && (
                    <motion.div
                      ref={avatarMenuRef}
                      initial={{ opacity: 0, y: 4, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 4, scale: 0.96 }}
                      transition={{ duration: 0.12 }}
                      className="absolute left-1/2 top-[58%] z-10 w-[118px] -translate-x-1/2 rounded-xl border border-[#E8EDF2] bg-white py-1.5 shadow-[0_10px_28px_rgba(15,23,42,0.16)]"
                      role="menu"
                      aria-label="Photo actions"
                    >
                      <button
                        type="button"
                        role="menuitem"
                        title="Crop and reposition the current photo"
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-[13px] font-semibold text-[#111827] hover:bg-[#F8FAFC]"
                        onClick={(event) => {
                          event.stopPropagation();
                          openCropEditor();
                        }}
                      >
                        <Pencil className="w-3.5 h-3.5 text-[#C2410C]" aria-hidden strokeWidth={2.4} />
                        Edit
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        title="Upload a different photo"
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-[13px] font-semibold text-[#111827] hover:bg-[#F8FAFC]"
                        onClick={(event) => {
                          event.stopPropagation();
                          openReplacePicker();
                        }}
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-[#2563EB]" aria-hidden strokeWidth={2.4} />
                        Replace
                      </button>
                      {hasRealPhoto && (
                        <button
                          type="button"
                          role="menuitem"
                          title="Remove the current photo"
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-[13px] font-semibold text-[#DC2626] hover:bg-[#FEF2F2]"
                          onClick={(event) => {
                            event.stopPropagation();
                            void onRemovePhoto();
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5 text-[#DC2626]" aria-hidden strokeWidth={2.4} />
                          Remove
                        </button>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <p className="text-[15px] font-extrabold text-[#111827] leading-tight truncate">{displayName}</p>
              <div className="mt-3 flex items-center justify-center gap-2 flex-wrap">
                <span className="inline-flex items-center rounded-full bg-[#F3E8FF] px-2.5 py-1 text-[10px] font-extrabold tracking-wide text-[#7C3AED]">
                  {roleBadge}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ECFDF5] px-2.5 py-1 text-[10px] font-bold text-[#059669]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" aria-hidden />
                  Active
                </span>
              </div>
              <p className="text-[11.5px] font-bold text-[#374151] mt-2 truncate" title="Choosify User ID">
                User ID: {profile?.choosifyUserId || '—'}
              </p>
              <p className="text-[12.5px] text-[#6B7280] mt-1 truncate">{email}</p>
            </div>

            <div className="mx-4 border-t border-[#EEF2F6]" />

            <div className="py-2 px-1.5">
              {menuItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left text-[13.5px] font-semibold text-[#1F2937] hover:bg-[#F8FAFC] rounded-xl transition-colors focus:bg-[#F8FAFC] focus:outline-none"
                  onClick={item.onSelect}
                >
                  <span className="shrink-0 w-5 flex justify-center">{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </div>

            <div className="mx-4 border-t border-[#EEF2F6]" />

            <div className="py-2 px-1.5 pb-2.5">
              <button
                type="button"
                role="menuitem"
                className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left text-[13.5px] font-bold text-[#DC2626] hover:bg-[#FEF2F2] rounded-xl transition-colors focus:bg-[#FEF2F2] focus:outline-none"
                onClick={handleLogout}
              >
                <span className="shrink-0 w-5 flex justify-center">
                  <Undo2 className="w-[18px] h-[18px]" aria-hidden strokeWidth={2.25} />
                </span>
                Log Out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default UserProfileDropdown;
