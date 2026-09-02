import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Lock, Plug, RefreshCw, Loader2, CheckCircle2, Plus, ClipboardCopy } from 'lucide-react';
import { ManualOrderDialog } from './ManualOrderDialog';
import {
  messagingApi,
  type ApiConversation,
  type ApiMessage,
  type SocialConnection,
  type SocialChannel,
} from '../../services/messagingApi';
import { catalogApi } from '../../services/catalogApi';
import { useEntitlements } from '../../contexts/EntitlementsContext';
import { MACRO_PRESETS, buildMacroMessage, type MacroProductContext } from '../../lib/orderDetailsMacro';
import { extractOrderDraftFromMessages, type ExtractOptionGroup } from '../../lib/manualOrderExtract';
import {
  InboxShell,
  ThreadListSearch,
  ThreadListItem,
  ChannelBadge,
  MessageScroller,
  MessageBubble,
  Composer,
  CenterState,
  ContextRail,
  ContextSection,
  ContextRow,
  ContextActionButton,
  formatWhen,
} from './MessagingPrimitives';

/**
 * Seller-owned Meta / omnichannel social inbox (WhatsApp · Messenger ·
 * Instagram) — the third Seller Messaging surface next to Customers and
 * Choosify Support.
 *
 * Data sources (all ownership-scoped server-side):
 *   - GET /seller/social-inbox/status  → the seller/brand's channel
 *     connections, filtered by sellerOwnsBrand.
 *   - GET /conversations?contextType=external_social → System-A social
 *     threads where the seller is a participant.
 *
 * BLOCKER (surfaced, not worked around): real inbound Meta webhook
 * messages currently land only in the staff-only System-C omni hub
 * (server/messagingHub.ts, unscoped). Nothing yet routes them into this
 * seller-scoped System-A external_social surface, so the thread list is
 * empty until that ingest bridge is built. The connection management and
 * the surface itself are real; replies are disabled until inbound sync is
 * connected (assertCanSendMessage has no external_social carve-out for a
 * brand-owning seller yet — a deliberate DEFER pending security review).
 *
 * Entitlement: gated on the canonical `metaMessaging` partner feature.
 * The tab is intended to become a paid add-on; the boundary is already
 * server-authoritative (requirePartnerEntitlement → 403), this only hides
 * the UI when it's switched off.
 */

const CHANNELS: { key: SocialChannel; label: string }[] = [
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'facebook', label: 'Messenger' },
  { key: 'instagram', label: 'Instagram' },
];

type Filter = 'all' | 'unread' | SocialChannel;

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All Conversations' },
  { key: 'unread', label: 'Unread' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'facebook', label: 'Messenger' },
  { key: 'instagram', label: 'Instagram' },
];

function convChannel(c: ApiConversation): SocialChannel | 'platform' {
  const ch = (c.sourceChannel || '').toLowerCase();
  if (ch === 'whatsapp' || ch === 'external_whatsapp') return 'whatsapp';
  if (ch === 'facebook') return 'facebook';
  if (ch === 'instagram') return 'instagram';
  return 'platform';
}

function counterpartName(c: ApiConversation): string {
  const meta = (c.metadata || {}) as Record<string, unknown>;
  return (
    (meta.externalName as string) ||
    (meta.contactName as string) ||
    (meta.senderName as string) ||
    c.consumerId ||
    'Social contact'
  );
}

export function MetaInbox({ currentUserId }: { currentUserId?: string }) {
  const { isFeatureEnabled } = useEntitlements();
  const entitled = isFeatureEnabled('metaMessaging');

  const [connections, setConnections] = useState<SocialConnection[]>([]);
  const [brandId, setBrandId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ApiConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ApiMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [connecting, setConnecting] = useState<SocialChannel | null>(null);
  const [manualOpen, setManualOpen] = useState(false);

  // Product association for macro-generation + product-aware extraction.
  const [assocProductId, setAssocProductId] = useState('');
  const [assocProductQuery, setAssocProductQuery] = useState('');
  const [catalog, setCatalog] = useState<Array<{ id: string; name: string; brand: string }>>([]);
  const [optionGroups, setOptionGroups] = useState<ExtractOptionGroup[]>([]);
  const [macroCopied, setMacroCopied] = useState<string | null>(null);
  const [macroPreview, setMacroPreview] = useState<string>('');

  useEffect(() => {
    if (!entitled || catalog.length > 0) return;
    catalogApi
      .listProducts({ status: 'active' })
      .then((rows) =>
        setCatalog(
          rows.filter((p) => !!p.sellerId).map((p) => ({ id: p.id, name: p.title, brand: p.brandName })),
        ),
      )
      .catch(() => undefined);
  }, [entitled, catalog.length]);

  useEffect(() => {
    if (!assocProductId) {
      setOptionGroups([]);
      return;
    }
    let cancelled = false;
    catalogApi
      .getProductDetail(assocProductId)
      .then((detail) => {
        if (cancelled) return;
        const og = detail?.optionGroups;
        setOptionGroups(
          Array.isArray(og) ? og.map((g) => ({ name: g.name, values: g.values })) : [],
        );
      })
      .catch(() => {
        if (!cancelled) setOptionGroups([]);
      });
    return () => {
      cancelled = true;
    };
  }, [assocProductId]);

  const assocProduct = catalog.find((p) => p.id === assocProductId) || null;

  const macroContext: MacroProductContext | undefined = assocProduct
    ? { title: assocProduct.name, optionGroupNames: optionGroups.map((g) => g.name) }
    : undefined;

  const copyMacro = (id: string) => {
    const text = buildMacroMessage(id as never, macroContext);
    setMacroPreview(text);
    navigator.clipboard?.writeText(text).then(
      () => {
        setMacroCopied(id);
        setTimeout(() => setMacroCopied(null), 2000);
      },
      () => undefined,
    );
  };

  const load = useCallback(async () => {
    if (!entitled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [conns, convs, brands] = await Promise.all([
        messagingApi.listSocialConnections().catch(() => [] as SocialConnection[]),
        messagingApi.listSocialConversations().catch(() => [] as ApiConversation[]),
        catalogApi.listBrands().catch(() => []),
      ]);
      setConnections(conns);
      setConversations(convs);
      setBrandId(conns[0]?.brandId || brands[0]?.id || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the social inbox');
    } finally {
      setLoading(false);
    }
  }, [entitled]);

  useEffect(() => {
    void load();
  }, [load]);

  const openThread = useCallback(async (id: string) => {
    setSelectedId(id);
    setThreadLoading(true);
    try {
      const rows = await messagingApi.listMessages(id);
      setMessages(rows);
      await messagingApi.markConversationRead(id).catch(() => undefined);
    } catch {
      setMessages([]);
    } finally {
      setThreadLoading(false);
    }
  }, []);

  const connectChannel = useCallback(
    async (channel: SocialChannel) => {
      if (!brandId) {
        setError('Connect a brand before linking a social channel.');
        return;
      }
      setConnecting(channel);
      try {
        const row = await messagingApi.connectSocialChannel({ channel, brandId });
        setConnections((prev) => [...prev.filter((c) => c.channel !== channel), row]);
      } catch (err) {
        setError(err instanceof Error ? err.message : `Could not connect ${channel}`);
      } finally {
        setConnecting(null);
      }
    },
    [brandId],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return conversations.filter((c) => {
      if (filter === 'unread' && !(c as { unread?: number }).unread) return false;
      if (filter !== 'all' && filter !== 'unread' && convChannel(c) !== filter) return false;
      if (!q) return true;
      return (
        counterpartName(c).toLowerCase().includes(q) ||
        (c.lastMessagePreview || '').toLowerCase().includes(q)
      );
    });
  }, [conversations, filter, search]);

  const selected = conversations.find((c) => c.id === selectedId) || null;
  const connectedChannels = new Set(
    connections.filter((c) => c.status === 'connected').map((c) => c.channel),
  );

  if (!entitled) {
    return (
      <div className="rounded-2xl border border-app-border bg-app-card p-10 text-center max-w-lg mx-auto mt-6">
        <div className="w-12 h-12 rounded-xl bg-app-accent/10 border border-app-accent/20 flex items-center justify-center mx-auto mb-3">
          <Lock className="w-5 h-5 text-app-accent" />
        </div>
        <h3 className="text-base font-black text-app-text-primary m-0">Meta Inbox is a paid add-on</h3>
        <p className="text-xs text-app-text-secondary mt-2 mb-0">
          Connect WhatsApp, Messenger and Instagram conversations from your brand's linked
          accounts into one place. This surface is disabled for your account — contact Choosify
          to enable the Meta Inbox add-on.
        </p>
      </div>
    );
  }

  const filterBar = (
    <div className="flex flex-wrap gap-1.5 px-2.5 pt-2.5">
      {FILTERS.map((f) => (
        <button
          key={f.key}
          type="button"
          onClick={() => setFilter(f.key)}
          className={`px-2.5 py-1 rounded-full text-[10.5px] font-bold border transition-colors ${
            filter === f.key
              ? 'bg-app-accent text-white border-app-accent'
              : 'border-app-border text-app-text-secondary hover:text-app-text-primary'
          }`}
        >
          {f.label}
        </button>
      ))}
    </div>
  );

  const list = (
    <>
      {filterBar}
      <ThreadListSearch value={search} onChange={setSearch} placeholder="Search social contacts…" />
      <div className="flex-1 overflow-y-auto min-h-0">
        {loading ? (
          <CenterState loading />
        ) : filtered.length === 0 ? (
          <div className="p-4 text-[11.5px] text-app-text-secondary space-y-2">
            <p className="m-0 font-semibold text-app-text-primary">No social conversations yet.</p>
            <p className="m-0">
              {connectedChannels.size === 0
                ? 'Connect a channel below to start receiving WhatsApp / Messenger / Instagram messages here.'
                : 'Connected channels are ready. Inbound social messages will appear here once Meta message sync is activated for your brand.'}
            </p>
          </div>
        ) : (
          filtered.map((c) => (
            <ThreadListItem
              key={c.id}
              title={counterpartName(c)}
              preview={c.lastMessagePreview}
              when={formatWhen(c.lastMessageAt || c.updatedAt)}
              active={c.id === selectedId}
              unread={(c as { unread?: number }).unread}
              badge={<ChannelBadge channel={convChannel(c)} />}
              onClick={() => void openThread(c.id)}
            />
          ))
        )}
      </div>
    </>
  );

  const thread = !selected ? (
    <CenterState message="Select a social conversation to view it." />
  ) : (
    <>
      <div className="p-3 border-b border-app-border flex items-center gap-2">
        <ChannelBadge channel={convChannel(selected)} />
        <div>
          <p className="font-bold text-[13px] text-app-text-primary m-0">{counterpartName(selected)}</p>
          <p className="text-[10px] text-app-text-secondary m-0">External social contact</p>
        </div>
      </div>
      {threadLoading ? (
        <CenterState loading />
      ) : (
        <MessageScroller>
          {messages.map((m) => (
            <MessageBubble
              key={m.id}
              body={m.body}
              mine={!!currentUserId && m.senderId === currentUserId}
              when={formatWhen(m.createdAt)}
              messageType={m.messageType}
              metadata={m.metadata}
            />
          ))}
        </MessageScroller>
      )}
      <Composer
        onSend={() => undefined}
        disabled
        placeholder="Replies activate once inbound Meta sync is connected"
        attachmentsDisabledReason="Outbound social replies are not enabled yet — inbound Meta message sync into your seller inbox is still being wired up."
      />
    </>
  );

  const context = (
    <ContextRail>
      {selected ? (
        <ContextSection title="Social contact">
          <ContextRow label="Name" value={counterpartName(selected)} />
          <ContextRow label="Channel" value={<ChannelBadge channel={convChannel(selected)} />} />
        </ContextSection>
      ) : null}

      <ContextSection title="Connected channels">
        {CHANNELS.map(({ key, label }) => {
          const isConnected = connectedChannels.has(key);
          return (
            <div key={key} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-[11.5px] text-app-text-primary">
                <ChannelBadge channel={key} /> {label}
              </span>
              {isConnected ? (
                <span className="flex items-center gap-1 text-[10.5px] font-bold text-emerald-600">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Connected
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => void connectChannel(key)}
                  disabled={connecting === key || !brandId}
                  className="flex items-center gap-1 text-[10.5px] font-bold text-app-accent disabled:opacity-40"
                >
                  {connecting === key ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Plug className="w-3.5 h-3.5" />
                  )}
                  Connect
                </button>
              )}
            </div>
          );
        })}
        {!brandId ? (
          <p className="text-[10px] text-app-text-secondary m-0">
            No brand found on your account to attach a channel to.
          </p>
        ) : null}
      </ContextSection>

      <ContextSection title="Associated product">
        <div className="relative">
          <input
            value={assocProduct ? assocProduct.name : assocProductQuery}
            onChange={(e) => {
              setAssocProductQuery(e.target.value);
              setAssocProductId('');
            }}
            placeholder="Search an item to base the request on…"
            className="w-full px-2.5 py-1.5 rounded-lg border border-app-border bg-transparent text-[11px] text-app-text-primary"
          />
          {assocProductQuery.trim() && !assocProductId ? (
            <ul className="absolute z-20 mt-1 w-full max-h-40 overflow-y-auto rounded-lg border border-app-border bg-app-card shadow-lg">
              {catalog
                .filter((p) => p.name.toLowerCase().includes(assocProductQuery.toLowerCase()))
                .slice(0, 8)
                .map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setAssocProductId(p.id);
                        setAssocProductQuery('');
                      }}
                      className="w-full text-left px-2.5 py-1.5 text-[10.5px] hover:bg-app-accent/[0.06]"
                    >
                      {p.name} <span className="text-app-text-secondary">({p.brand})</span>
                    </button>
                  </li>
                ))}
            </ul>
          ) : null}
        </div>
        {optionGroups.length > 0 ? (
          <p className="text-[9.5px] text-app-text-secondary m-0">
            Options: {optionGroups.map((g) => g.name).join(', ')}
          </p>
        ) : null}
      </ContextSection>

      <ContextSection title="Quick replies">
        <p className="text-[9.5px] text-app-text-secondary m-0 mb-1.5">
          Tap to copy, then paste into the chat.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {MACRO_PRESETS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => copyMacro(m.id)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-app-border text-[10px] font-bold text-app-text-primary hover:border-app-accent/40 hover:bg-app-accent/[0.04]"
            >
              {macroCopied === m.id ? (
                <span className="text-emerald-600">Copied ✓</span>
              ) : (
                <>
                  <ClipboardCopy className="w-2.5 h-2.5 text-app-text-secondary" /> {m.label}
                </>
              )}
            </button>
          ))}
        </div>
        {macroPreview ? (
          <textarea
            readOnly
            value={macroPreview}
            rows={Math.min(10, macroPreview.split('\n').length + 1)}
            className="mt-1.5 w-full p-2 border border-app-border rounded-lg text-[10px] bg-app-bg text-app-text-primary resize-none"
          />
        ) : null}
      </ContextSection>

      <ContextSection title="Off-platform sale">
        <p className="text-[10.5px] text-app-text-secondary m-0 leading-relaxed mb-1.5">
          Turn a WhatsApp / Messenger / Instagram chat into a real Choosify order using the
          canonical manual-order flow. Details are pre-filled from the customer's reply where clear —
          you review everything before creating.
        </p>
        <ContextActionButton onClick={() => setManualOpen(true)}>
          + Create Manual Order
        </ContextActionButton>
      </ContextSection>

      <ContextSection title="Status">
        <p className="text-[10.5px] text-app-text-secondary m-0 leading-relaxed">
          Channel connections are live and ownership-scoped to your brand. Inbound message sync
          from Meta into this inbox is not active yet — connected channels will start populating
          conversations here once it is enabled.
        </p>
      </ContextSection>
    </ContextRail>
  );

  return (
    <>
      <InboxShell
        title="Meta Inbox"
        subtitle="WhatsApp, Messenger and Instagram conversations from your brand's connected accounts."
        actions={
          <>
            <button
              type="button"
              onClick={() => setManualOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-app-accent text-white text-xs font-bold hover:opacity-90 transition-opacity"
            >
              <Plus className="w-3.5 h-3.5" /> Create Manual Order
            </button>
            <button
              type="button"
              onClick={() => void load()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-app-border text-xs font-bold text-app-text-secondary hover:text-app-text-primary hover:border-app-accent/40 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </>
        }
        list={list}
        thread={thread}
        context={context}
      />
      <ManualOrderDialog
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        prefill={{
          customerName: selected ? counterpartName(selected) : undefined,
          conversationId: selected?.id,
          provenanceSource: selected
            ? META_PROVENANCE[convChannel(selected)] || 'external_offline'
            : 'external_offline',
        }}
        extracted={
          selected
            ? extractOrderDraftFromMessages(
                messages.map((m) => ({
                  body: m.body,
                  fromCustomer: !!currentUserId && m.senderId !== currentUserId,
                })),
                optionGroups,
              )
            : undefined
        }
        productOptionGroups={optionGroups}
        onCreated={() => {
          setManualOpen(false);
          void load();
        }}
      />
    </>
  );
}

const META_PROVENANCE: Record<
  string,
  'external_whatsapp' | 'external_facebook' | 'external_instagram' | 'external_offline'
> = {
  whatsapp: 'external_whatsapp',
  facebook: 'external_facebook',
  messenger: 'external_facebook',
  instagram: 'external_instagram',
};

export default MetaInbox;
