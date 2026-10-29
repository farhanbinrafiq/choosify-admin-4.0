import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { useAuth, WELCOME_BACK_KEY } from '../../contexts/AuthContext';
import { getMyProfilePath } from '../../lib/userDisplay';

/** One-time note after signing in ended an inactive / in-deletion period. */
export function WelcomeBackBanner() {
  const { profile } = useAuth();
  const [show, setShow] = useState(() => {
    try {
      return sessionStorage.getItem(WELCOME_BACK_KEY) === '1';
    } catch {
      return false;
    }
  });
  if (!show) return null;
  const role = String(profile?.role || '').toLowerCase();
  const partner = role === 'seller' || role === 'verified_seller' || role === 'creator';
  const dismiss = () => {
    try {
      sessionStorage.removeItem(WELCOME_BACK_KEY);
    } catch {}
    setShow(false);
  };
  return (
    <div
      data-testid="welcome-back-banner"
      className="mx-4 mt-3 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[12px] text-emerald-800"
    >
      <div className="flex-1">
        <span className="font-extrabold">Welcome back! Your account is active again.</span>{' '}
        {partner && profile ? (
          <>
            While you were away, {role === 'creator' ? 'your creator profile' : 'your brands'} left the marketplace.{' '}
            Choosify will review your Marketplace Access again —{' '}
            <Link to={getMyProfilePath(profile)} className="font-bold underline" onClick={dismiss}>
              open Profile &amp; Verification
            </Link>{' '}
            to go live again.
          </>
        ) : null}
      </div>
      <button type="button" onClick={dismiss} aria-label="Dismiss" className="text-emerald-700 hover:text-emerald-900">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
