import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Loader2, Send } from 'lucide-react';
import { messagingApi } from '../../services/messagingApi';

/**
 * "Message" popup for a profile/details view (Consumer/Seller/Creator).
 * Uses the SAME canonical Support relationship every other Admin messaging
 * entry point uses (openAdminSupportConversation via
 * startAdminSupportConversation) — never a separate/mock DM system. On
 * success, closes and drops the staffer straight into the real conversation
 * at /admin/messages?c=<id> (the same deep-link MessagesInbox.tsx already
 * reads on load). Cancel just closes the popup — no API call, no navigation.
 */
export function ProfileMessagePopup({
  targetUserId,
  targetName,
  onClose,
}: {
  targetUserId: string;
  targetName?: string;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await messagingApi.startAdminSupportConversation({
        targetUserId,
        body: body.trim() || undefined,
      });
      onClose();
      navigate(`/admin/messages?c=${encodeURIComponent(res.conversation.id)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send message');
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/50 flex items-center justify-center p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="bg-app-card border border-app-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-app-border">
          <span className="text-sm font-black text-app-text-primary">
            Message{targetName ? ` ${targetName}` : ''}
          </span>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="text-app-text-secondary hover:text-app-text-primary disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4">
          <textarea
            autoFocus
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            placeholder="Write your message (optional — you can also just open the thread)…"
            className="w-full p-3 rounded-xl border border-app-border bg-transparent text-[12px] text-app-text-primary resize-none"
          />
          {error ? <p className="text-[11px] text-red-500 mt-1 m-0">{error}</p> : null}
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="flex-1 py-2.5 rounded-xl border border-app-border text-[11px] font-bold text-app-text-secondary disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void send()}
              disabled={busy}
              className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-app-accent text-white text-[11px] font-bold uppercase tracking-wide hover:opacity-90 disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {body.trim() ? 'Send & open' : 'Open conversation'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProfileMessagePopup;
