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
};

/**
 * Storefront Navbar uses lucide `MessageCircleMore` at 19px / stroke 2 / white
 * on the dark chrome. Dashboard header reuses that exact icon treatment.
 */
export function DashboardHeaderMessageButton({
  className = '',
  buttonRef,
}: DashboardHeaderMessageButtonProps) {
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
  const role = profile?.role;
  const isPartnerRole = role === 'seller' || role === 'verified_seller' || role === 'creator';
  const inboxPath = isPartnerRole ? '/admin/conversations' : PAGE_KEY_TO_PATH.messages || '/admin/messages';

  return (
    <button
      ref={buttonRef}
      type="button"
      className={`relative text-white hover:opacity-90 transition-opacity cursor-pointer bg-transparent border-0 p-0 w-7 h-7 flex items-center justify-center ${className}`}
      aria-label={unread > 0 ? `Messages, ${unread} unread` : 'Message inbox'}
      title="Messages"
      onClick={() => navigate(inboxPath)}
    >
      <MessageCircleMore size={19} strokeWidth={2} className="text-white transition-colors" aria-hidden />
      {unread > 0 ? (
        <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 text-white text-[9px] font-bold bg-[#EB4501] rounded-full flex items-center justify-center leading-none">
          {formatNavAttentionCount(unread)}
        </span>
      ) : null}
    </button>
  );
}

export default DashboardHeaderMessageButton;
