import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { RefreshCw, X } from 'lucide-react';
import { useAuth, UserRole } from '../contexts/AuthContext';

/**
 * TEMPORARY — floating role switcher for QA.
 * Delete this component (and its mounts) once multi-role flows are finished.
 */
const TEMP_ROLES: { role: UserRole; label: string; path: string }[] = [
  { role: 'super_admin', label: 'Admin', path: '/admin/dashboard' },
  { role: 'seller', label: 'Seller', path: '/admin/dashboard' },
  { role: 'creator', label: 'Creator', path: '/admin/dashboard' },
];

export function TempRoleSwitcher() {
  const { profile, switchRole, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(true);

  const onAuthSurface =
    location.pathname === '/login' ||
    location.pathname === '/signup' ||
    Boolean(profile);

  if (!onAuthSurface) return null;

  const current = profile?.role;

  const activate = (role: UserRole, path: string) => {
    if (profile) {
      switchRole(role);
    } else {
      login(role);
    }
    // Always land on dashboard so role-filtered nav remounts cleanly
    navigate(path, { replace: true });
    // Force a soft reload of mirror host by tweaking search when already on dashboard
    if (location.pathname === path) {
      navigate(`${path}?as=${role}`, { replace: true });
    }
  };

  return (
    <div
      className="fixed bottom-5 left-5 z-[9999] font-sans"
      data-temp-role-switcher="true"
    >
      {open ? (
        <div
          className="rounded-2xl border border-white/15 p-3 shadow-2xl min-w-[168px]"
          style={{
            background: 'linear-gradient(180deg, rgba(0,4,53,0.96), rgba(0,2,37,0.98))',
            backdropFilter: 'blur(14px)',
          }}
        >
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#FF5B00]">
              Temp roles
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-white/40 hover:text-white p-0.5"
              title="Hide"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex flex-col gap-1">
            {TEMP_ROLES.map((item) => {
              const active = current === item.role;
              return (
                <button
                  key={item.role}
                  type="button"
                  onClick={() => activate(item.role, item.path)}
                  className="h-9 rounded-lg px-3 text-left text-[12px] font-bold transition-all"
                  style={
                    active
                      ? {
                          background: 'rgba(255,91,0,0.22)',
                          color: '#FF5B00',
                          border: '1px solid rgba(255,91,0,0.45)',
                        }
                      : {
                          background: 'rgba(255,255,255,0.06)',
                          color: 'rgba(255,255,255,0.85)',
                          border: '1px solid rgba(255,255,255,0.1)',
                        }
                  }
                >
                  {item.label}
                </button>
              );
            })}
          </div>
          <p className="text-[8px] text-white/35 font-semibold mt-2 px-1 leading-snug">
            Temporary test switcher — remove later
          </p>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="h-11 px-3.5 rounded-full text-white text-[11px] font-extrabold shadow-2xl flex items-center gap-2 border border-white/15"
          style={{ background: 'linear-gradient(90deg, #FF5B00, #E64A00)' }}
          title="Temp role switcher"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Roles
        </button>
      )}
    </div>
  );
}

export default TempRoleSwitcher;
