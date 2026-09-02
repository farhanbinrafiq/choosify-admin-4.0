import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Plus } from 'lucide-react';
import { messagingApi, type ApiConversation, type ApiMessage } from '../../services/messagingApi';
import { useAuth } from '../../contexts/AuthContext';
import { useNavAttention } from '../../contexts/NavAttentionContext';
import {
  InboxShell,
  ThreadListItem,
  MessageBubble,
  MessageScroller,
  Composer,
  CenterState,
  RoleBadge,
  formatWhen,
} from './MessagingPrimitives';

/**
 * Creator + Seller "Choosify Support" inbox — canonical System A `/support/*`.
 * V1 is SUPPORT ONLY: the actor's one active Choosify Support thread. No
 * Buyer/Seller/Brand/Guide messaging here.
 */
export function PartnerSupportInbox({
  title = 'Choosify Support',
  subtitle = 'Message the Choosify team. Order and buyer conversations live elsewhere.',
}: {
  title?: string;
  subtitle?: string;
}) {
  const { profile } = useAuth();
  const { refresh: refreshNav } = useNavAttention();
  const [conversation, setConversation] = useState<ApiConversation | null>(null);
  const [messages, setMessages] = useState<ApiMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const loadMessages = useCallback(async (conversationId: string) => {
    const rows = await messagingApi.listMessages(conversationId).catch(() => [] as ApiMessage[]);
    setMessages(rows);
    messagingApi.markSupportConversationRead(conversationId).then(
      () => refreshNav(),
      () => {},
    );
  }, [refreshNav]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const active = await messagingApi.getActiveSupportConversation();
      setConversation(active.conversation);
      await loadMessages(active.conversation.id);
    } catch (err) {
      // 404 = no active thread yet — that's a valid empty state.
      const msg = err instanceof Error ? err.message : '';
      if (/No active support|404/i.test(msg)) {
        setConversation(null);
        setMessages([]);
      } else {
        setError(msg || 'Failed to load support conversation');
      }
    } finally {
      setLoading(false);
    }
  }, [loadMessages]);

  useEffect(() => {
    void load();
  }, [load]);

  const startThread = async () => {
    setStarting(true);
    setError(null);
    try {
      const res = await messagingApi.ensureActiveSupportConversation({
        subject: 'Choosify Support',
      });
      setConversation(res.conversation);
      await loadMessages(res.conversation.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start support conversation');
    } finally {
      setStarting(false);
    }
  };

  const send = async (body: string) => {
    if (!conversation) return;
    const res = await messagingApi.sendSupportMessage(conversation.id, body);
    setMessages((prev) => [...prev, res.message]);
    setConversation(res.conversation);
  };

  const list = (
    <>
      <div className="p-3 border-b border-app-border flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-wider text-app-text-secondary">
          Conversations
        </span>
        <button
          type="button"
          onClick={() => void load()}
          className="text-app-text-secondary hover:text-app-text-primary"
          title="Refresh"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <CenterState loading />
        ) : conversation ? (
          <ThreadListItem
            title="Choosify Support"
            preview={conversation.lastMessagePreview}
            when={formatWhen(conversation.lastMessageAt || conversation.updatedAt)}
            active
            badge={<RoleBadge role="Admin" />}
            onClick={() => void loadMessages(conversation.id)}
          />
        ) : (
          <div className="p-4 text-[12px] text-app-text-secondary">
            No support conversation yet.
            <button
              type="button"
              onClick={() => void startThread()}
              disabled={starting}
              className="mt-3 w-full inline-flex items-center justify-center gap-2 py-2 rounded-xl bg-app-accent text-white text-[11px] font-bold uppercase tracking-wide hover:opacity-90 disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" /> Contact Choosify Support
            </button>
          </div>
        )}
      </div>
    </>
  );

  const thread = !conversation ? (
    <CenterState
      loading={loading}
      error={error || undefined}
      message="Start a conversation with Choosify Support to get help."
    />
  ) : (
    <>
      <div className="p-3 border-b border-app-border flex items-center gap-2">
        <span className="font-bold text-[13px] text-app-text-primary">Choosify Support</span>
        <RoleBadge role="Admin" />
        {conversation.status !== 'active' ? (
          <span className="text-[10px] text-app-text-secondary">· {conversation.status}</span>
        ) : null}
      </div>
      <MessageScroller>
        {messages.length === 0 ? (
          <p className="text-[12px] text-app-text-secondary text-center py-8 m-0">
            No messages yet. Say hello — the Choosify team will reply here.
          </p>
        ) : (
          messages.map((m) => (
            <MessageBubble
              key={m.id}
              body={m.body}
              mine={m.senderId === profile?.id}
              when={formatWhen(m.createdAt)}
              system={m.senderRole === 'system' || m.messageType === 'system'}
              senderLabel={m.senderRole === 'admin' ? 'Choosify Support' : undefined}
            />
          ))
        )}
      </MessageScroller>
      {error ? <div className="px-4 pb-1 text-[11px] text-red-500">{error}</div> : null}
      <Composer
        onSend={send}
        disabled={conversation.status === 'closed'}
        placeholder={conversation.status === 'closed' ? 'This conversation is closed.' : 'Message Choosify Support…'}
        attachmentsDisabledReason="Attachments aren't available in support chat yet."
      />
    </>
  );

  return <InboxShell title={title} subtitle={subtitle} list={list} thread={thread} />;
}

export default PartnerSupportInbox;
