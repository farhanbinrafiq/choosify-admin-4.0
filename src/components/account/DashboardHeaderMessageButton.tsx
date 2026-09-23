import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircleMore } from 'lucide-react';
import { useNavAttention } from '../../contexts/NavAttentionContext';
import { formatNavAttentionCount } from '../../services/navAttentionApi';
import { PAGE_KEY_TO_PATH } from '../../cms-mirror/nav';
import { useAuth } from '../../contexts/AuthContext';

type DashboardHeaderMessageButtonProps = {
  className?: string;
  buttonRef?: React.Ref<HTMLButtonElement>;
  /**
   * 'dark' (default) = white icon for a dark chrome header (legacy
   * CmsMirrorHost iframe header). 'light' = dark navy icon for the real
   * AdminWorkspaceLayout topbar, which is now solid white (Dashboard Design
   * System). Same component, same click behavior -- only the icon color
   * needs to branch since it's rendered in both header treatments.
   */
  variant?: 'dark' | 'light';
};

/**
 * Storefront Navbar uses lucide `MessageCircleMore` at 19px / stroke 2 / white
 * on the dark chrome. Dashboard header reuses that exact icon treatment for
 * the `dark` variant; `light` matches the white AdminWorkspaceLayout topbar.
 */
export function DashboardHeaderMessageButton({
  className = '',
  buttonRef,
  variant = 'dark',
}: DashboardHeaderMessageButtonProps) {
  const iconColorClass = variant === 'light' ? 'text-[#475467]' : 'text-white';
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { counts } = useNavAttention();
  const unread = counts.messages?.count || 0;
  // Seller/creator have their own real conversation view (/admin/conversations)
  // -- the shared 'messages' page key still points staff at the legacy
  // CmsMirror-hosted /admin/messages screen on purpose. This button is
  // rendered in both the migrated-page header (AdminWorkspaceLayout) and the
  // CmsMirror iframe's own header (CmsMirrorHost), so it needs to branch
  // itself rather than relying on a single shared page key.
  const role = String(profile?.role || '');
  const inboxPath =
    role === 'seller' || role === 'verified_seller'
      ? '/admin/conversations'
      : role === 'creator'
        ? PAGE_KEY_TO_PATH.partnerSupport || '/admin/support'
        : PAGE_KEY_TO_PATH.messages || '/admin/messages';

  return (
    <button
      ref={buttonRef}
      type="button"
      className={`relative ${iconColorClass} hover:opacity-90 transition-opacity cursor-pointer bg-transparent border-0 p-0 w-7 h-7 flex items-center justify-center ${className}`}
      aria-label={unread > 0 ? `Messages, ${unread} unread` : 'Message inbox'}
      title="Messages"
      onClick={() => navigate(inboxPath)}
    >
      <MessageCircleMore size={19} strokeWidth={2} className={`${iconColorClass} transition-colors`} aria-hidden />
      {unread > 0 ? (
        <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 text-white text-[9px] font-bold bg-[#EF3C23] rounded-full flex items-center justify-center leading-none">
          {formatNavAttentionCount(unread)}
        </span>
      ) : null}
    </button>
  );
}

export default DashboardHeaderMessageButton;
