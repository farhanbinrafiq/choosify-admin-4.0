import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { RefreshCw, Plus, CheckCircle2, RotateCcw, ExternalLink, Clock, StickyNote } from 'lucide-react';
import {
  messagingApi,
  type AdminSupportInboxRow,
  type ApiMessage,
  type SupportAudience,
  type SupportTicketStatus,
  type SupportTicketPriority,
  type SupportDepartment,
  type SupportTicketNote,
  type SupportFollowup,
} from '../../services/messagingApi';
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
  Avatar,
  formatWhen,
  type MsgRole,
} from '../../components/messaging/MessagingPrimitives';
import { NewMessageDialog } from '../../components/messaging/NewMessageDialog';

const AUDIENCE_TABS: Array<{ key: 'all' | SupportAudience; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'consumer', label: 'Consumer' },
  { key: 'seller', label: 'Seller' },
  { key: 'creator', label: 'Creator' },
];

const STATUS_FILTERS: Array<{ key: 'all' | SupportTicketStatus; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'pending', label: 'Pending' },
  { key: 'need_followup', label: 'Need Follow-up' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'closed', label: 'Closed' },
];

const STATUS_OPTIONS: SupportTicketStatus[] = [
  'open',
  'in_progress',
  'pending',
  'need_followup',
  'resolved',
  'closed',
];
const STATUS_LABEL: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  pending: 'Pending',
  need_followup: 'Need Follow-up',
  resolved: 'Resolved',
  closed: 'Closed',
};
const PRIORITY_OPTIONS: SupportTicketPriority[] = ['low', 'medium', 'high', 'urgent'];
const PRIORITY_TONE: Record<string, string> = {
  low: 'text-slate-500',
  medium: 'text-sky-600',
  high: 'text-amber-600',
  urgent: 'text-red-600',
};
const DEPARTMENTS: Array<{ key: SupportDepartment; label: string }> = [
  { key: 'general_support', label: 'General Support' },
  { key: 'seller_operations', label: 'Seller Operations' },
  { key: 'payments', label: 'Payments' },
  { key: 'creator_support', label: 'Creator Support' },
  { key: 'trust_safety', label: 'Trust & Safety' },
];

const ACTIVE_STATUSES = new Set(['open', 'in_progress', 'pending', 'need_followup']);

function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(9, 0, 0, 0);
  return d.toISOString();
}

/**
 * Choosify Support Desk (CRM) for staff. Real React screen wired to canonical
 * System A `/admin/support/*`. Left: conversation list + filters. Centre:
 * thread. Right: the Conversation Control Panel — user snapshot, ticket
 * status/priority, assignment, follow-up, internal notes, related context.
 * All CRM metadata is staff-only server-side; never exposed to the user.
 */
export default function MessagesInbox() {
  const { profile } = useAuth();
  const { refresh: refreshNav } = useNavAttention();
  const [params, setParams] = useSearchParams();
  const deepLinkC = params.get('c');

  const [audience, setAudience] = useState<'all' | SupportAudience>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | SupportTicketStatus>('all');
  const [rows, setRows] = useState<AdminSupportInboxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ApiMessage[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const [notes, setNotes] = useState<SupportTicketNote[]>([]);
  const [followups, setFollowups] = useState<SupportFollowup[]>([]);
  const [noteDraft, setNoteDraft] = useState('');
  const [crmBusy, setCrmBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await messagingApi.listAdminSupportInbox());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the support inbox');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const loadCrm = useCallback(async (conversationId: string) => {
    try {
      const [n, f] = await Promise.all([
        messagingApi.listSupportNotes(conversationId).catch(() => [] as SupportTicketNote[]),
        messagingApi.listSupportFollowups(conversationId).catch(() => [] as SupportFollowup[]),
      ]);
      setNotes(n);
      setFollowups(f);
    } catch {
      setNotes([]);
      setFollowups([]);
    }
  }, []);

  const openThread = useCallback(
    async (conversationId: string) => {
      setSelectedId(conversationId);
      setMsgLoading(true);
      setNoteDraft('');
      try {
        const rows2 = await messagingApi.listMessages(conversationId);
        setMessages(rows2);
        await messagingApi.markSupportConversationRead(conversationId).catch(() => {});
        setRows((prev) =>
          prev.map((r) => (r.conversation.id === conversationId ? { ...r, unread: 0 } : r)),
        );
        void loadCrm(conversationId);
        refreshNav();
      } catch (err) {
        setMessages([]);
        setError(err instanceof Error ? err.message : 'Failed to load messages');
      } finally {
        setMsgLoading(false);
      }
    },
    [refreshNav, loadCrm],
  );

  useEffect(() => {
    if (deepLinkC && deepLinkC !== selectedId) void openThread(deepLinkC);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkC]);

  const visibleRows = useMemo(
    () =>
      rows.filter(
        (r) =>
          (audience === 'all' || r.audience === audience) &&
          (statusFilter === 'all' || (r.status || r.ticket?.status || 'open') === statusFilter),
      ),
    [rows, audience, statusFilter],
  );
  const selected = rows.find((r) => r.conversation.id === selectedId) || null;

  const patchRowLocal = (conversationId: string, patch: Partial<AdminSupportInboxRow>) =>
    setRows((prev) =>
      prev.map((r) => (r.conversation.id === conversationId ? { ...r, ...patch } : r)),
    );

  const send = async (body: string) => {
    if (!selectedId) return;
    const res = await messagingApi.sendSupportMessage(selectedId, body);
    setMessages((prev) => [...prev, res.message]);
    setRows((prev) =>
      prev
        .map((r) =>
          r.conversation.id === selectedId
            ? {
                ...r,
                lastMessageAt: res.message.createdAt,
                lastMessagePreview: res.message.body.slice(0, 120),
              }
            : r,
        )
        .sort((a, b) => (b.lastMessageAt || '').localeCompare(a.lastMessageAt || '')),
    );
  };

  // ── CRM mutations ────────────────────────────────────────────────────
  const runCrm = async (fn: () => Promise<unknown>) => {
    if (!selected) return;
    setCrmBusy(true);
    setError(null);
    try {
      await fn();
      await load();
      void loadCrm(selected.conversation.id);
      refreshNav();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'CRM update failed');
    } finally {
      setCrmBusy(false);
    }
  };

  const setStatus = (status: SupportTicketStatus) => {
    if (!selected) return;
    patchRowLocal(selected.conversation.id, { status });
    void runCrm(() => messagingApi.updateSupportTicketCrm(selected.conversation.id, { status }));
  };
  const setPriority = (priority: SupportTicketPriority) => {
    if (!selected) return;
    patchRowLocal(selected.conversation.id, { priority });
    void runCrm(() => messagingApi.updateSupportTicketCrm(selected.conversation.id, { priority }));
  };
  const setDepartment = (department: SupportDepartment | '') => {
    if (!selected) return;
    void runCrm(() =>
      messagingApi.updateSupportTicketCrm(selected.conversation.id, {
        department: department || null,
      }),
    );
  };
  const assignToMe = () => {
    if (!selected || !profile?.id) return;
    void runCrm(() =>
      messagingApi.updateSupportTicketCrm(selected.conversation.id, { assigneeId: profile.id }),
    );
  };
  const unassign = () => {
    if (!selected) return;
    void runCrm(() =>
      messagingApi.updateSupportTicketCrm(selected.conversation.id, { assigneeId: null }),
    );
  };
  const scheduleFollowup = (dueAt: string) => {
    if (!selected) return;
    void runCrm(() => messagingApi.scheduleSupportFollowup(selected.conversation.id, dueAt));
  };
  const cancelFollowup = (id: string) => {
    if (!selected) return;
    void runCrm(() => messagingApi.cancelSupportFollowup(selected.conversation.id, id));
  };
  const addNote = () => {
    if (!selected || !noteDraft.trim()) return;
    const body = noteDraft.trim();
    setNoteDraft('');
    void runCrm(() => messagingApi.addSupportNote(selected.conversation.id, body));
  };

  const toggleResolve = async () => {
    if (!selected) return;
    const isActive = ACTIVE_STATUSES.has(selected.status || selected.ticket?.status || 'open');
    void runCrm(() =>
      isActive
        ? messagingApi.updateSupportTicketCrm(selected.conversation.id, { status: 'resolved' })
        : messagingApi.updateSupportTicketCrm(selected.conversation.id, { status: 'open' }),
    );
  };

  const startNew = async (targetUserId: string, body: string) => {
    const res = await messagingApi.startAdminSupportConversation({ targetUserId, body: body || undefined });
    setShowNew(false);
    await load();
    setParams((p) => {
      p.set('c', res.conversation.id);
      return p;
    });
    await openThread(res.conversation.id);
    refreshNav();
  };

  const activeFollowup = followups.find((f) => f.status === 'scheduled');
  const relatedOrderId =
    (selected?.conversation.metadata?.orderId as string) ||
    (selected?.conversation.orderId as string) ||
    undefined;

  // ── list column ──────────────────────────────────────────────────────
  const list = (
    <>
      <div className="p-3 border-b border-app-border">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-black uppercase tracking-wider text-app-text-secondary">
            Support Desk
          </span>
          <button type="button" onClick={() => void load()} className="text-app-text-secondary hover:text-app-text-primary" title="Refresh">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex gap-1 flex-wrap mb-1.5">
          {AUDIENCE_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setAudience(t.key)}
              className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-colors ${
                audience === t.key ? 'bg-app-accent text-white' : 'bg-app-bg text-app-text-secondary hover:text-app-text-primary'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 flex-wrap">
          {STATUS_FILTERS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setStatusFilter(t.key)}
              className={`px-2 py-0.5 rounded-full text-[9.5px] font-bold border transition-colors ${
                statusFilter === t.key
                  ? 'bg-app-accent text-white border-app-accent'
                  : 'border-app-border text-app-text-secondary hover:text-app-text-primary'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <CenterState loading />
        ) : visibleRows.length === 0 ? (
          <p className="p-4 text-[12px] text-app-text-secondary m-0">No support conversations.</p>
        ) : (
          visibleRows.map((r) => {
            const st = r.status || r.ticket?.status || 'open';
            return (
              <ThreadListItem
                key={r.conversation.id}
                title={r.opener.displayName}
                preview={r.lastMessagePreview}
                when={formatWhen(r.lastMessageAt)}
                active={r.conversation.id === selectedId}
                unread={r.unread}
                badge={
                  <span className="inline-flex items-center gap-1">
                    <RoleBadge role={r.opener.roleLabel as MsgRole} />
                    {r.priority && r.priority !== 'low' ? (
                      <span className={`text-[8.5px] font-black uppercase ${PRIORITY_TONE[r.priority]}`}>
                        {r.priority}
                      </span>
                    ) : null}
                  </span>
                }
                sub={`${STATUS_LABEL[st] || st}${r.followupDueAt ? ' · ⏰' : ''}${r.noteCount ? ` · ${r.noteCount}📝` : ''}`}
                onClick={() => void openThread(r.conversation.id)}
              />
            );
          })
        )}
      </div>
    </>
  );

  // ── thread column ────────────────────────────────────────────────────
  const thread = !selected ? (
    <CenterState loading={loading} error={error || undefined} message="Select a support conversation, or start a new one." />
  ) : (
    <>
      <div className="p-3 border-b border-app-border flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-bold text-[13px] text-app-text-primary truncate">{selected.opener.displayName}</span>
          <RoleBadge role={selected.opener.roleLabel as MsgRole} />
          <span className="text-[9.5px] font-bold uppercase text-app-text-secondary">
            {STATUS_LABEL[selected.status || selected.ticket?.status || 'open']}
          </span>
        </div>
        <button
          type="button"
          onClick={() => void toggleResolve()}
          disabled={crmBusy}
          className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-app-border text-[10px] font-bold text-app-text-secondary hover:text-app-text-primary disabled:opacity-50"
        >
          {ACTIVE_STATUSES.has(selected.status || selected.ticket?.status || 'open') ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5" /> Resolve
            </>
          ) : (
            <>
              <RotateCcw className="w-3.5 h-3.5" /> Reopen
            </>
          )}
        </button>
      </div>
      <MessageScroller>
        {msgLoading ? (
          <CenterState loading />
        ) : messages.length === 0 ? (
          <p className="text-[12px] text-app-text-secondary text-center py-8 m-0">No messages yet.</p>
        ) : (
          messages.map((m) => (
            <MessageBubble
              key={m.id}
              body={m.body}
              mine={m.senderRole === 'admin'}
              when={formatWhen(m.createdAt)}
              system={m.senderRole === 'system' || m.messageType === 'system'}
              senderLabel={m.senderRole === 'admin' ? 'Choosify Support' : selected.opener.displayName}
            />
          ))
        )}
      </MessageScroller>
      {error ? <div className="px-4 pb-1 text-[11px] text-red-500">{error}</div> : null}
      <Composer
        onSend={send}
        placeholder="Reply as Choosify Support…"
        attachmentsDisabledReason="Attachments aren't available in support chat yet."
      />
    </>
  );

  // ── context column — Conversation Control Panel ──────────────────────
  const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="flex justify-between gap-3 text-[11px]">
      <span className="text-app-text-secondary shrink-0">{label}</span>
      <span className="font-semibold text-app-text-primary text-right break-words min-w-0">{value}</span>
    </div>
  );
  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="mb-3">
      <h4 className="text-[9px] font-black uppercase tracking-wider text-app-text-secondary m-0 mb-1.5">{title}</h4>
      <div className="space-y-1.5">{children}</div>
    </div>
  );

  const context = selected ? (
    <div className="p-3.5 overflow-y-auto">
      <div className="flex flex-col items-center text-center gap-1.5 mb-3">
        <Avatar name={selected.opener.displayName} src={selected.opener.avatarUrl} size={52} />
        <div className="font-bold text-[13px] text-app-text-primary">{selected.opener.displayName}</div>
        <RoleBadge role={selected.opener.roleLabel as MsgRole} />
      </div>

      <Section title="Customer snapshot">
        <Row label="CFID" value={<span className="font-mono">{selected.opener.choosifyUserId || '—'}</span>} />
        <Row label="Role" value={selected.opener.roleLabel} />
        <Row label="Email" value={selected.opener.email || '—'} />
        <Row label="Email verified" value={selected.opener.emailVerified ? 'Yes' : 'No'} />
        <Row
          label="Member since"
          value={selected.opener.memberSince ? new Date(selected.opener.memberSince).toLocaleDateString() : '—'}
        />
        <Row label="Total orders" value={selected.opener.totalOrders ?? '—'} />
        {selected.opener.contextLabel ? (
          <Row label={selected.audience === 'seller' ? 'Business' : 'Creator'} value={selected.opener.contextLabel} />
        ) : null}
        <Link
          to={
            selected.audience === 'seller'
              ? `/admin/sellers/${selected.opener.id}`
              : selected.audience === 'creator'
                ? `/admin/creators`
                : `/admin/consumers/${selected.opener.id}`
          }
          className="mt-1 w-full inline-flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-app-border text-[10.5px] font-bold text-app-text-secondary hover:text-app-text-primary no-underline"
        >
          <ExternalLink className="w-3 h-3" /> Open full profile
        </Link>
      </Section>

      <Section title="Conversation status">
        <select
          value={selected.status || selected.ticket?.status || 'open'}
          onChange={(e) => setStatus(e.target.value as SupportTicketStatus)}
          disabled={crmBusy}
          className="w-full p-1.5 rounded-lg border border-app-border bg-transparent text-[11px] text-app-text-primary"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <select
          value={selected.priority || 'medium'}
          onChange={(e) => setPriority(e.target.value as SupportTicketPriority)}
          disabled={crmBusy}
          className="w-full p-1.5 rounded-lg border border-app-border bg-transparent text-[11px] text-app-text-primary"
        >
          {PRIORITY_OPTIONS.map((p) => (
            <option key={p} value={p}>
              Priority: {p[0].toUpperCase() + p.slice(1)}
            </option>
          ))}
        </select>
        {selected.reopenedAt ? (
          <p className="text-[9.5px] text-amber-600 m-0">Reopened {formatWhen(selected.reopenedAt)} by a user reply.</p>
        ) : null}
      </Section>

      <Section title="Follow-up reminder">
        {activeFollowup ? (
          <div className="text-[11px]">
            <span className="text-app-text-primary font-semibold">
              Due {new Date(activeFollowup.dueAt).toLocaleString()}
            </span>
            <button
              type="button"
              onClick={() => cancelFollowup(activeFollowup.id)}
              disabled={crmBusy}
              className="ml-2 text-[10px] font-bold text-red-500"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-1">
            {[
              ['Tomorrow', 1],
              ['3 days', 3],
              ['7 days', 7],
            ].map(([label, n]) => (
              <button
                key={label as string}
                type="button"
                onClick={() => scheduleFollowup(daysFromNow(n as number))}
                disabled={crmBusy}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-app-border text-[10px] font-bold text-app-text-primary hover:border-app-accent/40"
              >
                <Clock className="w-2.5 h-2.5" /> {label}
              </button>
            ))}
            <input
              type="datetime-local"
              onChange={(e) => e.target.value && scheduleFollowup(new Date(e.target.value).toISOString())}
              className="px-1.5 py-1 rounded-lg border border-app-border bg-transparent text-[10px] text-app-text-primary"
            />
          </div>
        )}
      </Section>

      <Section title="Internal notes">
        <div className="space-y-1.5 max-h-40 overflow-y-auto">
          {notes.length === 0 ? (
            <p className="text-[10.5px] text-app-text-secondary m-0">No internal notes yet.</p>
          ) : (
            notes.map((n) => (
              <div key={n.id} className="rounded-lg border border-app-border bg-app-bg p-1.5">
                <div className="flex justify-between text-[9px] text-app-text-secondary">
                  <span>{n.authorName || 'Staff'}</span>
                  <span>{formatWhen(n.createdAt)}</span>
                </div>
                <p className="text-[11px] text-app-text-primary m-0 whitespace-pre-wrap break-words">{n.body}</p>
              </div>
            ))
          )}
        </div>
        <textarea
          value={noteDraft}
          onChange={(e) => setNoteDraft(e.target.value)}
          rows={2}
          placeholder="Add an internal note (staff only)…"
          className="w-full p-1.5 rounded-lg border border-app-border bg-transparent text-[11px] text-app-text-primary resize-none"
        />
        <button
          type="button"
          onClick={addNote}
          disabled={crmBusy || !noteDraft.trim()}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-app-accent text-white text-[10.5px] font-bold disabled:opacity-50"
        >
          <StickyNote className="w-3 h-3" /> Add note
        </button>
      </Section>

      <Section title="Assignment">
        <Row label="Assignee" value={selected.assigneeName || 'Unassigned'} />
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={assignToMe}
            disabled={crmBusy}
            className="flex-1 px-2 py-1 rounded-lg border border-app-border text-[10px] font-bold text-app-text-primary hover:border-app-accent/40 disabled:opacity-50"
          >
            Assign to me
          </button>
          <button
            type="button"
            onClick={unassign}
            disabled={crmBusy || !selected.assigneeId}
            className="flex-1 px-2 py-1 rounded-lg border border-app-border text-[10px] font-bold text-app-text-secondary disabled:opacity-40"
          >
            Unassign
          </button>
        </div>
        <select
          value={selected.department || ''}
          onChange={(e) => setDepartment(e.target.value as SupportDepartment | '')}
          disabled={crmBusy}
          className="w-full p-1.5 rounded-lg border border-app-border bg-transparent text-[11px] text-app-text-primary"
        >
          <option value="">Department: unset</option>
          {DEPARTMENTS.map((d) => (
            <option key={d.key} value={d.key}>
              {d.label}
            </option>
          ))}
        </select>
      </Section>

      {relatedOrderId ? (
        <Section title="Related context">
          <Row label="Order" value={<span className="font-mono text-[10px]">{relatedOrderId}</span>} />
          <Link
            to="/admin/orders"
            className="inline-flex items-center gap-1 text-[10.5px] font-bold text-app-accent no-underline"
          >
            <ExternalLink className="w-3 h-3" /> View Order
          </Link>
        </Section>
      ) : null}
    </div>
  ) : undefined;

  return (
    <>
      <InboxShell
        title="Choosify Support Desk"
        subtitle="Support conversations addressed to Choosify by Consumers, Sellers and Creators."
        actions={
          <button
            type="button"
            onClick={() => setShowNew(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-app-accent text-white text-[11px] font-bold hover:opacity-90"
          >
            <Plus className="w-3.5 h-3.5" /> New Message
          </button>
        }
        list={list}
        thread={thread}
        context={context}
      />
      {showNew ? <NewMessageDialog onClose={() => setShowNew(false)} onStart={startNew} /> : null}
      <span hidden>{profile?.id}</span>
    </>
  );
}
