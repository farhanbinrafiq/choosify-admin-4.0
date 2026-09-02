import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircleMore, Loader2 } from 'lucide-react';
import { messagingApi } from '../../services/messagingApi';
import { useAuth } from '../../contexts/AuthContext';

const STAFF_ROLES = new Set(['super_admin', 'admin', 'moderator', 'support_agent']);

/**
 * "Message" action for a canonical Admin user/profile surface. Opens (or reuses)
 * that user's Choosify Support thread via the canonical reconciliation key and
 * drops the staffer straight into it at /admin/messages. Not a separate DM
 * engine — the same support relationship the inbox search produces.
 */
export function AdminMessageUserButton({
  targetUserId,
  className = '',
  label = 'Message',
}: {
  targetUserId: string;
  className?: string;
  label?: string;
}) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!profile || !STAFF_ROLES.has(profile.role) || !targetUserId) return null;

  const go = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await messagingApi.startAdminSupportConversation({ targetUserId });
      navigate(`/admin/messages?c=${encodeURIComponent(res.conversation.id)}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not open conversation');
      setBusy(false);
    }
  };

  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        onClick={() => void go()}
        disabled={busy}
        className={
          className ||
          'inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-app-border text-xs font-bold text-app-text-secondary hover:text-app-text-primary hover:border-app-accent/40 transition-colors disabled:opacity-50'
        }
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageCircleMore className="w-3.5 h-3.5" />}
        {label}
      </button>
      {err ? <span className="text-[10px] text-red-500 mt-1">{err}</span> : null}
    </span>
  );
}

export default AdminMessageUserButton;
