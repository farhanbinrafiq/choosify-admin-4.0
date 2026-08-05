import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { LogOut, Settings, Shield, User } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  formatRoleLabel,
  getAvatarUrl,
  getMyProfilePath,
  getUserInitials,
} from '../../lib/userDisplay';

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
  danger?: boolean;
};

export function UserProfileDropdown({ variant = 'header', className = '' }: UserProfileDropdownProps) {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const displayName = profile?.displayName?.trim() || 'User';
  const email = profile?.email?.trim() || '';
  const roleLabel = formatRoleLabel(profile?.role);
  const initials = getUserInitials(displayName, email);
  const avatarUrl = profile ? getAvatarUrl(profile) : '';

  const close = useCallback(() => setOpen(false), []);

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

  const menuItems: MenuItem[] = profile
    ? [
        {
          id: 'profile',
          label: 'My Profile',
          icon: <User className="w-4 h-4" aria-hidden />,
          onSelect: () => go(getMyProfilePath(profile)),
        },
        {
          id: 'settings',
          label: 'Account Settings',
          icon: <Settings className="w-4 h-4" aria-hidden />,
          onSelect: () => go('/admin/account/settings'),
        },
        {
          id: 'security',
          label: 'Security',
          icon: <Shield className="w-4 h-4" aria-hidden />,
          onSelect: () => go('/admin/account/security'),
        },
      ]
    : [];

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        close();
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
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

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [close, open]);

  useEffect(() => {
    if (!open) return;
    const first = menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]');
    first?.focus();
  }, [open]);

  if (!profile) return null;

  const triggerClasses =
    variant === 'overlay'
      ? 'cms-mirror-profile-trigger'
      : 'flex items-center gap-2.5 pl-1 shrink-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-white/30';

  return (
    <div
      ref={rootRef}
      className={`relative ${variant === 'overlay' ? 'cms-mirror-profile-anchor' : ''} ${className}`}
    >
      <button
        ref={triggerRef}
        type="button"
        className={triggerClasses}
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
        <span
          className={`relative flex items-center justify-center rounded-full font-bold text-white shrink-0 overflow-hidden transition-transform ${
            variant === 'overlay' ? 'w-9 h-9 text-[12px]' : 'w-8 h-8 text-[13px] group-hover:scale-105'
          }`}
          style={{ backgroundImage: 'linear-gradient(135deg, #FF5B00, #2323FF)' }}
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
            className={`absolute right-0 mt-2 w-[280px] rounded-xl border border-[#E8EDF2] bg-white shadow-[0_18px_50px_rgba(0,4,53,0.18)] overflow-hidden z-[120] ${
              variant === 'overlay' ? 'top-full' : 'top-full'
            }`}
          >
            <div className="px-4 pt-4 pb-3 text-center border-b border-[#F1F5F9] bg-gradient-to-b from-[#FAFBFC] to-white">
              <div className="mx-auto mb-3 relative w-14 h-14 rounded-full overflow-hidden ring-2 ring-white shadow-md">
                <div
                  className="absolute inset-0 flex items-center justify-center text-[15px] font-extrabold text-white"
                  style={{ backgroundImage: 'linear-gradient(135deg, #FF5B00, #2323FF)' }}
                >
                  {initials}
                </div>
                <img
                  src={avatarUrl}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                  onError={(event) => {
                    event.currentTarget.style.display = 'none';
                  }}
                />
              </div>
              <p className="text-[14px] font-extrabold text-[#111827] leading-tight truncate">{displayName}</p>
              <p className="text-[12px] text-[#6B7280] mt-0.5 truncate">{email}</p>
              <div className="mt-3 flex items-center justify-center gap-3 text-[11px]">
                <span className="inline-flex items-center rounded-full bg-[#FFF4ED] px-2.5 py-1 font-bold text-[#C2410C]">
                  Role: {roleLabel}
                </span>
                <span className="inline-flex items-center gap-1.5 text-[#059669] font-semibold">
                  <span className="w-2 h-2 rounded-full bg-[#10B981] shadow-[0_0_0_3px_rgba(16,185,129,0.18)]" aria-hidden />
                  Online
                </span>
              </div>
            </div>

            <div className="py-1.5">
              {menuItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-[13px] font-semibold text-[#111827] hover:bg-[#F8FAFC] transition-colors focus:bg-[#F8FAFC] focus:outline-none"
                  onClick={item.onSelect}
                >
                  <span className="text-[#6B7280]">{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </div>

            <div className="border-t border-[#F1F5F9] py-1.5">
              <button
                type="button"
                role="menuitem"
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-[13px] font-semibold text-[#DC2626] hover:bg-[#FEF2F2] transition-colors focus:bg-[#FEF2F2] focus:outline-none"
                onClick={handleLogout}
              >
                <LogOut className="w-4 h-4" aria-hidden />
                Logout
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default UserProfileDropdown;
