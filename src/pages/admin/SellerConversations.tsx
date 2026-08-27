import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MessageCircleMore, Loader2, RefreshCw, Send, AlertCircle } from 'lucide-react';
import { operationsApi, type OpsPlatformMessage, type OpsStorefrontOrder } from '../../services/operationsApi';
import { useAuth } from '../../contexts/AuthContext';
import { GlassCard } from '../../components/ui/GlassCard';

/**
 * Real buyer<->seller conversations for seller/creator accounts.
 *
 * The seller sidebar's "Messages" item used to point at /admin/messages,
 * which is the staff-only Meta/omnichannel support inbox (WhatsApp/
 * Messenger/Instagram DM triage) -- server-side role allowlists exclude
 * seller/creator from it entirely, so it always rendered an empty inbox
 * for them regardless of any real buyer message. The actual buyer<->seller
 * thread lives in the same backend choosify-web's buyer inbox already
 * reads/writes (conv_platform_<buyerId>, GET/POST /operations/platform-
 * messages) -- this page is the seller-side counterpart of that, built as
 * its own screen rather than retrofitted into Messages.tsx so the staff
 * Omni tool (and choosify-web's buyer-facing message UI) stay untouched.
 *
 * There's no "list my conversations" endpoint -- a seller's real buyer
 * relationships are exactly the buyers who have ordered from them, so the
 * conversation list is derived from their own orders (operationsApi.
 * listOrders(), already server-scoped to sellerId=self), one entry per
 * unique buyer.
 */

interface ConversationRow {
  buyerId: string;
  buyerName: string;
  lastOrderId: string;
  lastMessage: string;
  updatedAt: string;
  hasMessages: boolean;
}

function formatElapsed(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/** Order-context prefix (e.g. "[Order ORD-123] ") is stored on the message
 * body for server-side thread bucketing -- strip it for display, keep it
 * on send so the buyer's own inbox keeps bucketing correctly. */
function displayBody(body: string): string {
  return body.replace(/^\[Order [^\]]+]\s*/i, '').trim() || body;
}

export default function SellerConversations() {
  const { profile } = useAuth();
  const [searchParams] = useSearchParams();
  const deepLinkBuyerId = searchParams.get('buyerId');
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedBuyerId, setSelectedBuyerId] = useState<string | null>(null);
  const [messages, setMessages] = useState<OpsPlatformMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [composerText, setComposerText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const orders = await operationsApi.listOrders();
      const byBuyer = new Map<string, OpsStorefrontOrder>();
      for (const order of orders) {
        const existing = byBuyer.get(order.buyerId);
        if (!existing || new Date(order.createdAt) > new Date(existing.createdAt)) {
          byBuyer.set(order.buyerId, order);
        }
      }

      const rows = await Promise.all(
        Array.from(byBuyer.values()).map(async (order): Promise<ConversationRow> => {
          const base: ConversationRow = {
            buyerId: order.buyerId,
            buyerName: order.shipping?.fullName || order.buyerId,
            lastOrderId: order.orderId,
            lastMessage: 'No messages yet',
            updatedAt: order.createdAt,
            hasMessages: false,
          };
          try {
            const { data } = await operationsApi.listPlatformMessages(order.buyerId);
            if (data.length > 0) {
              const latest = data[data.length - 1];
              base.lastMessage = displayBody(latest.content?.body || '');
              base.updatedAt = latest.timestamp;
              base.hasMessages = true;
            }
          } catch {
            // No conversation yet for this buyer -- keep the order-derived fallback row.
          }
          return base;
        }),
      );

      rows.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      setConversations(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load conversations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  const loadMessages = useCallback(async (buyerId: string) => {
    setMessagesLoading(true);
    setSendError(null);
    try {
      const { data } = await operationsApi.listPlatformMessages(buyerId);
      setMessages(data);
    } catch (err) {
      setMessages([]);
      setSendError(err instanceof Error ? err.message : 'Failed to load messages');
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  const selectConversation = (buyerId: string) => {
    setSelectedBuyerId(buyerId);
    void loadMessages(buyerId);
  };

  // Deep-link from a notification (?buyerId=...) -- select immediately,
  // independent of the derived conversation list (which may still be
  // loading, or may not include this buyer if their order predates it).
  useEffect(() => {
    if (deepLinkBuyerId) selectConversation(deepLinkBuyerId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkBuyerId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const selectedConversation = useMemo(
    () => conversations.find((c) => c.buyerId === selectedBuyerId) || null,
    [conversations, selectedBuyerId],
  );

  const handleSend = async () => {
    const body = composerText.trim();
    if (!body || !selectedBuyerId) return;
    setSending(true);
    setSendError(null);
    try {
      const { message } = await operationsApi.sendPlatformMessage({
        buyerId: selectedBuyerId,
        userName: profile?.displayName || 'Seller',
        body,
        orderId: selectedConversation?.lastOrderId,
      });
      setMessages((prev) => [...prev, message]);
      setComposerText('');
      setConversations((prev) =>
        prev
          .map((c) =>
            c.buyerId === selectedBuyerId
              ? { ...c, lastMessage: displayBody(message.content.body), updatedAt: message.timestamp, hasMessages: true }
              : c,
          )
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
      );
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-app-accent/10 border border-app-accent/20">
            <MessageCircleMore className="w-5 h-5 text-app-accent" />
          </div>
          <div>
            <h1 className="text-xl font-black text-app-text-primary tracking-tight">Messages</h1>
            <p className="text-xs text-app-text-secondary">Conversations with your buyers</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void loadConversations()}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-app-border text-xs font-bold text-app-text-secondary hover:text-app-text-primary hover:border-app-accent/40 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs font-semibold text-red-500">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4 h-[calc(100vh-220px)] min-h-[420px]">
        <GlassCard hoverLift={false} className="p-0 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-app-border">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              {conversations.length} buyer{conversations.length === 1 ? '' : 's'}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-10 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-4 text-xs text-slate-400">
                No buyers yet. Conversations appear here once someone orders from you.
              </div>
            ) : (
              conversations.map((c) => (
                <button
                  key={c.buyerId}
                  type="button"
                  onClick={() => selectConversation(c.buyerId)}
                  className={`w-full text-left p-3 border-b border-app-border/60 transition-colors ${
                    selectedBuyerId === c.buyerId ? 'bg-app-accent/10' : 'hover:bg-slate-50/80'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-sm text-app-text-primary truncate">{c.buyerName}</span>
                    <span className="text-[10px] text-slate-400 shrink-0">{formatElapsed(c.updatedAt)}</span>
                  </div>
                  <p className="text-xs text-app-text-secondary truncate mt-0.5">{c.lastMessage}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Order {c.lastOrderId}</p>
                </button>
              ))
            )}
          </div>
        </GlassCard>

        <GlassCard hoverLift={false} className="p-0 flex flex-col overflow-hidden">
          {!selectedBuyerId ? (
            <div className="flex-1 flex items-center justify-center text-sm text-slate-400">
              Select a buyer to view the conversation.
            </div>
          ) : (
            <>
              <div className="p-3 border-b border-app-border">
                <p className="font-bold text-sm text-app-text-primary">{selectedConversation?.buyerName}</p>
                <p className="text-[10px] text-slate-400">Order {selectedConversation?.lastOrderId}</p>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messagesLoading ? (
                  <div className="flex items-center justify-center py-10 text-slate-400">
                    <Loader2 className="w-5 h-5 animate-spin" />
                  </div>
                ) : messages.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-10">
                    No messages yet. Say hello about their order.
                  </p>
                ) : (
                  messages.map((m) => {
                    const mine = m.direction === 'outbound';
                    return (
                      <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed ${
                            mine
                              ? 'bg-app-accent text-white rounded-br-sm'
                              : 'bg-app-card border border-app-border text-app-text-primary rounded-bl-sm'
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words">{displayBody(m.content?.body || '')}</p>
                          <p className={`text-[9px] mt-1 ${mine ? 'text-white/70' : 'text-slate-400'}`}>
                            {formatElapsed(m.timestamp)}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
              {sendError && (
                <div className="px-4 pb-1 text-[11px] font-semibold text-red-500">{sendError}</div>
              )}
              <div className="p-3 border-t border-app-border flex items-end gap-2">
                <textarea
                  value={composerText}
                  onChange={(e) => setComposerText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void handleSend();
                    }
                  }}
                  rows={2}
                  placeholder="Reply to buyer..."
                  className="flex-1 p-2.5 border border-app-border rounded-xl text-xs resize-none bg-transparent text-app-text-primary"
                />
                <button
                  type="button"
                  disabled={sending || !composerText.trim()}
                  onClick={() => void handleSend()}
                  className="flex items-center justify-center h-10 w-10 rounded-xl bg-app-accent text-white disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                  title="Send"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
