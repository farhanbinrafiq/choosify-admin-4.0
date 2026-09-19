import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, Send, RefreshCw, AlertTriangle, ArrowLeft, MessageCircleMore } from 'lucide-react';
import { getAuthToken } from '../../lib/commerceOrderAdapter';

/**
 * Super Admin Meta Inbox — platform-level view onto the SAME Meta/omni
 * messaging backend (`server/messagingHub.ts`, mounted at `/api`, NOT
 * `/api/v1`) that real inbound WhatsApp/Messenger/Instagram webhooks
 * already write to. This is deliberately NOT built on the Seller-facing
 * "Meta Inbox" tab's system (`SellerConversations.tsx` -> `MetaInbox.tsx` ->
 * `/api/v1` `external_social` conversations): that tab is entitlement-gated
 * and UI-complete, but its inbound ingestion path
 * (`ingestExternalMessageIdempotent`) is never actually called anywhere in
 * the server, so it never receives a real inbound Meta message today. Real
 * Meta webhook traffic only ever lands in the omni/messagingHub backend this
 * page reads — reusing that is the only way this screen shows real data
 * rather than an empty shell.
 *
 * Server-side authorization already existed before this page: messagingHub's
 * `requireOmniMessagingAccess` middleware allow-lists
 * super_admin/admin/moderator/support_agent (`OMNI_MESSAGING_ACCESS_ROLES`)
 * and fails closed (403) for anyone else, including a Seller. No backend or
 * RBAC change was needed to add Super Admin access — only this UI, wired to
 * the same already-authorized endpoints.
 *
 * Status model: the omni Conversation record only supports
 * 'open' | 'pending' | 'resolved' (see src/types.ts). The richer six-state
 * model (Open/In Progress/Pending/Need Follow-up/Resolved/Closed) belongs to
 * the separate System A support-ticket model, not this one — introducing
 * those extra states here would mean inventing status values the backend
 * can't actually persist, so this screen only ever offers the three real
 * ones.
 */

type Platform = 'whatsapp' | 'messenger' | 'instagram' | 'platform';
type ConvStatus = 'open' | 'pending' | 'resolved';

interface ApiConversation {
  conversationId: string;
  platform: Platform;
  senderName: string;
  senderAvatar?: string;
  lastMessage?: string;
  assignedAgent?: string;
  status: ConvStatus;
  updatedAt: string;
}

interface ApiMessage {
  id: string;
  platform: Platform;
  conversationId: string;
  senderId: string;
  senderName: string;
  content: { type: string; body: string; mediaUrl?: string };
  direction: 'inbound' | 'outbound';
  status: 'sent' | 'delivered' | 'read';
  timestamp: string;
}

interface ApiAgent {
  id: string;
  name: string;
  email: string;
  role: string;
  status: 'active' | 'inactive';
}

interface MessagingStatus {
  mode: 'mock' | 'live';
  channels: Record<'whatsapp' | 'messenger' | 'instagram', 'ready' | 'simulated' | 'pending_credentials'>;
}

const PLATFORM_META: Record<Platform, { label: string; dot: string; pill: string }> = {
  whatsapp: { label: 'WhatsApp', dot: 'bg-emerald-500', pill: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  messenger: { label: 'Messenger', dot: 'bg-blue-500', pill: 'bg-blue-50 text-blue-700 border-blue-200' },
  instagram: { label: 'Instagram', dot: 'bg-pink-500', pill: 'bg-pink-50 text-pink-700 border-pink-200' },
  platform: { label: 'Choosify', dot: 'bg-slate-400', pill: 'bg-slate-50 text-slate-600 border-slate-200' },
};

const STATUS_META: Record<ConvStatus, { label: string; pill: string }> = {
  open: { label: 'Open', pill: 'bg-orange-50 text-orange-700 border-orange-200' },
  pending: { label: 'Pending', pill: 'bg-amber-50 text-amber-700 border-amber-200' },
  resolved: { label: 'Resolved', pill: 'bg-green-50 text-green-700 border-green-200' },
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body && (body.error as string)) || `Request failed (${res.status})`);
  }
  return body as T;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = Date.now();
  const diffMin = (now - d.getTime()) / 60000;
  if (diffMin < 1) return 'now';
  if (diffMin < 60) return `${Math.floor(diffMin)}m`;
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h`;
  return d.toLocaleDateString();
}

export default function MetaInboxAdmin() {
  const [conversations, setConversations] = useState<ApiConversation[]>([]);
  const [agents, setAgents] = useState<ApiAgent[]>([]);
  const [messagingStatus, setMessagingStatus] = useState<MessagingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [platformFilter, setPlatformFilter] = useState<'all' | Platform>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ConvStatus>('all');
  const [search, setSearch] = useState('');

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ApiMessage[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [mobilePane, setMobilePane] = useState<'list' | 'thread' | 'context'>('list');

  const threadEndRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    try {
      setError(null);
      const data = await api<ApiConversation[]>('/api/conversations');
      setConversations(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load conversations.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConversations();
    void api<ApiAgent[]>('/api/agents').then(setAgents).catch(() => setAgents([]));
    void api<MessagingStatus>('/api/messaging/status').then(setMessagingStatus).catch(() => setMessagingStatus(null));
    const id = window.setInterval(() => void loadConversations(), 20000);
    return () => window.clearInterval(id);
  }, [loadConversations]);

  const loadMessages = useCallback(async (conversationId: string) => {
    setMsgLoading(true);
    try {
      const data = await api<ApiMessage[]>(`/api/messages/${encodeURIComponent(conversationId)}`);
      setMessages(Array.isArray(data) ? data : []);
    } catch {
      setMessages([]);
    } finally {
      setMsgLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    void loadMessages(selectedId);
    const id = window.setInterval(() => void loadMessages(selectedId), 8000);
    return () => window.clearInterval(id);
  }, [selectedId, loadMessages]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return conversations
      .filter((c) => platformFilter === 'all' || c.platform === platformFilter)
      .filter((c) => statusFilter === 'all' || c.status === statusFilter)
      .filter((c) => !q || c.senderName.toLowerCase().includes(q) || (c.lastMessage ?? '').toLowerCase().includes(q))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [conversations, platformFilter, statusFilter, search]);

  const selected = conversations.find((c) => c.conversationId === selectedId) ?? null;

  const selectConversation = (id: string) => {
    setSelectedId(id);
    setSendError(null);
    setMobilePane('thread');
  };

  const updateStatus = async (status: ConvStatus) => {
    if (!selected) return;
    try {
      await api('/api/conversation/status', {
        method: 'PATCH',
        body: JSON.stringify({ conversationId: selected.conversationId, status }),
      });
      await loadConversations();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update status.');
    }
  };

  const assignAgent = async (agentId: string) => {
    if (!selected) return;
    try {
      await api('/api/conversation/assign-agent', {
        method: 'PATCH',
        body: JSON.stringify({ conversationId: selected.conversationId, agentId }),
      });
      await loadConversations();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to assign agent.');
    }
  };

  const sendReply = async () => {
    if (!selected || !draft.trim()) return;
    setSending(true);
    setSendError(null);
    try {
      const res = await api<{ delivery: { delivered: boolean; mode: 'mock' | 'live' }; whatsapp24HourWarning: string | null }>(
        '/api/messages/send',
        {
          method: 'POST',
          body: JSON.stringify({ conversationId: selected.conversationId, content: { type: 'text', body: draft.trim() } }),
        },
      );
      setDraft('');
      await loadMessages(selected.conversationId);
      await loadConversations();
      if (res.whatsapp24HourWarning) setSendError(res.whatsapp24HourWarning);
      else if (res.delivery.mode === 'mock') {
        setSendError('Sent in simulated mode — this channel has no live Meta credentials configured, so nothing was actually delivered to the customer.');
      }
    } catch (e) {
      setSendError(e instanceof Error ? e.message : 'Failed to send reply.');
    } finally {
      setSending(false);
    }
  };

  const channelBanner = messagingStatus && messagingStatus.mode !== 'live'
    ? 'Messaging is running in simulated mode (no live Meta credentials configured) — inbound demo data may appear, and outbound replies are not delivered to a real device.'
    : null;

  return (
    <div className="flex flex-col h-[calc(100vh-var(--cms-topbar-height,64px)-56px)] min-h-[520px] bg-white rounded-[10px] border border-[#E8EDF2] overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[#E8EDF2] shrink-0">
        <div>
          <h1 className="text-[15px] font-extrabold text-[#1A1A2E] m-0">Meta Inbox</h1>
          <p className="text-[11px] text-[#9AA0AC] m-0">Platform-level WhatsApp, Messenger and Instagram conversations</p>
        </div>
        <button
          type="button"
          onClick={() => void loadConversations()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E5E7EB] text-[11px] font-bold text-[#1A1A2E] hover:border-[#EF3C23]"
          aria-label="Refresh conversations"
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {channelBanner && (
        <div className="flex items-start gap-2 px-4 py-2 bg-amber-50 border-b border-amber-200 text-[11px] text-amber-800 shrink-0">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <span>{channelBanner}</span>
        </div>
      )}
      {error && (
        <div className="px-4 py-2 bg-rose-50 border-b border-rose-200 text-[11px] text-rose-700 shrink-0">{error}</div>
      )}

      <div className="flex flex-1 min-h-0">
        {/* Conversation list */}
        <div className={`w-full lg:w-[320px] shrink-0 border-r border-[#E8EDF2] flex-col min-h-0 ${mobilePane === 'list' ? 'flex' : 'hidden lg:flex'}`}>
          <div className="p-3 border-b border-[#F1F1F3] flex flex-col gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9AA0AC]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search conversations…"
                aria-label="Search conversations"
                className="w-full h-8 pl-7 pr-2 text-[11.5px] border border-[#E5E7EB] rounded-md focus:outline-none focus:border-[#EF3C23]"
              />
            </div>
            <div className="flex gap-1 flex-wrap">
              {(['all', 'whatsapp', 'messenger', 'instagram'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPlatformFilter(p)}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                    platformFilter === p ? 'bg-[#1A1A2E] text-white border-[#1A1A2E]' : 'bg-white text-[#4B5563] border-[#E5E7EB]'
                  }`}
                >
                  {p === 'all' ? 'All' : PLATFORM_META[p].label}
                </button>
              ))}
            </div>
            <div className="flex gap-1 flex-wrap">
              {(['all', 'open', 'pending', 'resolved'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                    statusFilter === s ? 'bg-[#EF3C23] text-white border-[#EF3C23]' : 'bg-white text-[#4B5563] border-[#E5E7EB]'
                  }`}
                >
                  {s === 'all' ? 'All statuses' : STATUS_META[s].label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-6 text-center text-[11px] text-[#9AA0AC]">Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="p-6 text-center text-[11px] text-[#9AA0AC]">
                {conversations.length === 0 ? 'No Meta conversations yet.' : 'No conversations match these filters.'}
              </div>
            ) : (
              filtered.map((c) => {
                const meta = PLATFORM_META[c.platform];
                return (
                  <button
                    key={c.conversationId}
                    type="button"
                    onClick={() => selectConversation(c.conversationId)}
                    className={`w-full text-left px-3 py-2.5 border-b border-[#F1F1F3] hover:bg-[#FAFBFC] ${
                      selectedId === c.conversationId ? 'bg-[#FFF4EE]' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${meta.dot}`} aria-hidden />
                        <span className="text-[12px] font-bold text-[#1A1A2E] truncate">{c.senderName || 'Unknown contact'}</span>
                      </div>
                      <span className="text-[9.5px] text-[#9AA0AC] shrink-0">{formatTime(c.updatedAt)}</span>
                    </div>
                    <p className="text-[10.5px] text-[#9AA0AC] truncate mt-0.5">{c.lastMessage || 'No messages yet'}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${meta.pill}`}>{meta.label}</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${STATUS_META[c.status].pill}`}>
                        {STATUS_META[c.status].label}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Thread */}
        <div className={`flex-1 flex-col min-h-0 ${mobilePane === 'thread' ? 'flex' : 'hidden lg:flex'}`}>
          {!selected ? (
            <div className="flex-1 flex flex-col items-center justify-center text-[#9AA0AC] gap-2">
              <MessageCircleMore size={28} />
              <p className="text-[12px]">Select a conversation to view the thread.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#E8EDF2] shrink-0">
                <button type="button" onClick={() => setMobilePane('list')} className="lg:hidden p-1" aria-label="Back to conversation list">
                  <ArrowLeft size={16} />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-bold text-[#1A1A2E] truncate">{selected.senderName || 'Unknown contact'}</div>
                  <div className="text-[10px] text-[#9AA0AC]">{PLATFORM_META[selected.platform].label} · {selected.conversationId}</div>
                </div>
                <button type="button" onClick={() => setMobilePane('context')} className="lg:hidden p-1" aria-label="View customer context">
                  <Search size={16} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2.5 bg-[#FAFBFC]">
                {msgLoading ? (
                  <div className="text-center text-[11px] text-[#9AA0AC] py-6">Loading messages…</div>
                ) : messages.length === 0 ? (
                  <div className="text-center text-[11px] text-[#9AA0AC] py-6">No messages in this conversation yet.</div>
                ) : (
                  messages.map((m) => (
                    <div key={m.id} className={`flex ${m.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-[12px] ${
                          m.direction === 'outbound' ? 'bg-[#EF3C23] text-white' : 'bg-white border border-[#E8EDF2] text-[#1A1A2E]'
                        }`}
                      >
                        <p className="m-0 whitespace-pre-wrap break-words">{m.content.body}</p>
                        <span className={`block text-[9px] mt-1 ${m.direction === 'outbound' ? 'text-white/70' : 'text-[#9AA0AC]'}`}>
                          {formatTime(m.timestamp)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
                <div ref={threadEndRef} />
              </div>
              {sendError && (
                <div className="px-4 py-2 bg-amber-50 border-t border-amber-200 text-[10.5px] text-amber-800 shrink-0">{sendError}</div>
              )}
              <div className="flex items-center gap-2 p-3 border-t border-[#E8EDF2] shrink-0">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void sendReply();
                    }
                  }}
                  placeholder="Type a reply…"
                  aria-label="Reply message"
                  className="flex-1 h-9 px-3 text-[12px] border border-[#E5E7EB] rounded-lg focus:outline-none focus:border-[#EF3C23]"
                />
                <button
                  type="button"
                  onClick={() => void sendReply()}
                  disabled={sending || !draft.trim()}
                  aria-label="Send reply"
                  className="w-9 h-9 rounded-lg bg-[#EF3C23] text-white flex items-center justify-center disabled:opacity-40"
                >
                  <Send size={15} />
                </button>
              </div>
            </>
          )}
        </div>

        {/* Customer context */}
        {selected && (
          <div className={`w-full lg:w-[280px] shrink-0 border-l border-[#E8EDF2] flex-col min-h-0 overflow-y-auto p-4 gap-4 ${mobilePane === 'context' ? 'flex' : 'hidden lg:flex'}`}>
            <button type="button" onClick={() => setMobilePane('thread')} className="lg:hidden flex items-center gap-1.5 text-[11px] font-bold text-[#1A1A2E]">
              <ArrowLeft size={14} /> Back to thread
            </button>

            <div>
              <div className="text-[10px] font-bold text-[#9AA0AC] uppercase tracking-wide mb-2">Contact</div>
              <div className="text-[13px] font-bold text-[#1A1A2E]">{selected.senderName || 'Unknown contact'}</div>
              <div className="text-[10.5px] text-[#9AA0AC] mt-0.5">{PLATFORM_META[selected.platform].label} contact ID: {selected.conversationId.replace(/^conv_[a-z]+_/, '')}</div>
              {/* Honest limitation: the omni conversation record has no link
                  to a Choosify account (CF ID / role / email) -- Meta
                  contacts are external platform identities, not necessarily
                  registered users. Never fabricate this. */}
              <p className="text-[10.5px] text-[#9AA0AC] mt-2 italic">Not linked to a Choosify account (CF ID, role and email are unavailable for external Meta contacts).</p>
            </div>

            <div>
              <div className="text-[10px] font-bold text-[#9AA0AC] uppercase tracking-wide mb-2">Status</div>
              <select
                value={selected.status}
                onChange={(e) => void updateStatus(e.target.value as ConvStatus)}
                className="w-full h-8 px-2 text-[11.5px] border border-[#E5E7EB] rounded-md"
              >
                {(['open', 'pending', 'resolved'] as const).map((s) => (
                  <option key={s} value={s}>{STATUS_META[s].label}</option>
                ))}
              </select>
            </div>

            <div>
              <div className="text-[10px] font-bold text-[#9AA0AC] uppercase tracking-wide mb-2">Assigned agent</div>
              <select
                value={selected.assignedAgent ?? ''}
                onChange={(e) => void assignAgent(e.target.value)}
                className="w-full h-8 px-2 text-[11.5px] border border-[#E5E7EB] rounded-md"
              >
                <option value="">Unassigned</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>

            <div>
              <div className="text-[10px] font-bold text-[#9AA0AC] uppercase tracking-wide mb-2">Channel delivery</div>
              <p className="text-[10.5px] text-[#4B5563] m-0">
                {messagingStatus?.channels?.[selected.platform as 'whatsapp' | 'messenger' | 'instagram'] === 'ready'
                  ? 'Live — replies are delivered through Meta.'
                  : messagingStatus?.channels?.[selected.platform as 'whatsapp' | 'messenger' | 'instagram'] === 'pending_credentials'
                    ? 'Pending credentials — outbound delivery is not yet configured for this channel.'
                    : 'Simulated — no live Meta credentials configured for this environment.'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
