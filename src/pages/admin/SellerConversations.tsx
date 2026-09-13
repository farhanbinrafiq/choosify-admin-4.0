import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useMessagingPoll } from '../../hooks/useMessagingPoll';
import {
  MessageCircleMore,
  Loader2,
  RefreshCw,
  Send,
  AlertCircle,
  ExternalLink,
  Flag,
} from 'lucide-react';
import { ReportEntityModal } from '../../components/shared/ReportEntityModal';
import {
  operationsApi,
  type OpsPlatformMessage,
  type OpsStorefrontOrder,
  type OpsShipment,
  type OpsBookingOffer,
} from '../../services/operationsApi';
import { useAuth } from '../../contexts/AuthContext';
import { GlassCard } from '../../components/ui/GlassCard';
import { MetaInbox } from '../../components/messaging/MetaInbox';
import { messagingApi, type ApiConversation, type ApiMessage } from '../../services/messagingApi';
import { ManualOrderDialog } from '../../components/messaging/ManualOrderDialog';
import {
  ThreadListSearch,
  ContextRail,
  ContextSection,
  ContextRow,
  ContextActionButton,
  OfferCard,
  OfferCardButton,
} from '../../components/messaging/MessagingPrimitives';

const money = (v?: number) => (typeof v === 'number' ? `৳${v.toLocaleString()}` : undefined);

/**
 * Seller Messaging — three operational surfaces:
 *   • Customers       — real buyer<->seller threads (legacy System B:
 *                       conv_platform_<buyerId>, /operations/platform-messages).
 *                       Kept as-is; enriched here with a canonical context
 *                       rail (order / payment / fulfillment) resolved via the
 *                       Operations APIs — no System-B storage change.
 *   • Choosify Support — System A /support/* (PartnerSupportInbox).
 *   • Meta Inbox      — seller-owned WhatsApp / Messenger / Instagram
 *                       (MetaInbox, entitlement-gated).
 *
 * The Customers conversation list is derived from the seller's own orders
 * (operationsApi.listOrders(), server-scoped to sellerId=self) — one entry
 * per unique buyer — because there is no "list my conversations" endpoint
 * for the legacy buyer<->seller channel.
 */

type Tab = 'inbox' | 'meta';

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
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const deepLinkBuyerId = searchParams.get('buyerId');
  const [tab, setTab] = useState<Tab>(searchParams.get('tab') === 'meta' ? 'meta' : 'inbox');
  // Choosify Support is now a labelled thread inside the Seller Inbox, not a tab.
  const wantSupport = searchParams.get('tab') === 'support';
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [allOrders, setAllOrders] = useState<OpsStorefrontOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [reportTarget, setReportTarget] = useState<{ id: string; name: string } | null>(null);

  const [selectedBuyerId, setSelectedBuyerId] = useState<string | null>(null);
  const [messages, setMessages] = useState<OpsPlatformMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [composerText, setComposerText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const [contextOrder, setContextOrder] = useState<OpsStorefrontOrder | null>(null);
  const [contextShipment, setContextShipment] = useState<OpsShipment | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);

  // ── Choosify Support thread, folded into the Seller Inbox list ───────
  const [supportConv, setSupportConv] = useState<ApiConversation | null>(null);
  const [supportMessages, setSupportMessages] = useState<ApiMessage[]>([]);
  const [supportSelected, setSupportSelected] = useState(false);
  const [supportBusy, setSupportBusy] = useState(false);

  const loadSupport = useCallback(async () => {
    try {
      const active = await messagingApi.getActiveSupportConversation();
      setSupportConv(active.conversation);
      const rows = await messagingApi.listMessages(active.conversation.id).catch(() => [] as ApiMessage[]);
      setSupportMessages(rows);
    } catch {
      setSupportConv(null);
      setSupportMessages([]);
    }
  }, []);

  useEffect(() => {
    void loadSupport();
  }, [loadSupport]);

  // Live delivery for the Choosify Support thread: System A messages are
  // dual-written to `omni_messages` (mirrorMessageToOmni) — the same
  // collection Messages.tsx already subscribes to. A write there for this
  // conversation re-pulls canonical REST messages so a Support reply appears
  // without leaving/reopening the thread.
  useEffect(() => {
    const conversationId = supportConv?.id;
    if (!conversationId || !supportSelected) return;
    const q = query(collection(db, 'omni_messages'), where('conversationId', '==', conversationId));
    const unsub = onSnapshot(
      q,
      () => {
        void messagingApi
          .listMessages(conversationId)
          .then((rows) => setSupportMessages(rows))
          .catch(() => {});
      },
      (err) => {
        console.warn('[SellerConversations] Live support-message listener failed; staying on manual refresh.', err);
      },
    );
    return () => unsub();
  }, [supportConv?.id, supportSelected]);

  // REST-polling safety net for the Support thread when the omni Firestore
  // mirror isn't genuinely live — production must not depend on Firebase
  // credentials for messages to arrive.
  useMessagingPoll(
    supportSelected ? supportConv?.id : null,
    () => {
      const id = supportConv?.id;
      if (!id) return;
      void messagingApi
        .listMessages(id)
        .then((rows) => setSupportMessages(rows))
        .catch(() => {});
    },
    4000,
  );

  const openSupport = useCallback(async () => {
    setSupportSelected(true);
    setSelectedBuyerId(null);
    let conv = supportConv;
    if (!conv) {
      setSupportBusy(true);
      try {
        const res = await messagingApi.ensureActiveSupportConversation({ subject: 'Choosify Support' });
        conv = res.conversation;
        setSupportConv(conv);
      } catch (err) {
        setSendError(err instanceof Error ? err.message : 'Could not open Choosify Support');
      } finally {
        setSupportBusy(false);
      }
    }
    if (conv) {
      const rows = await messagingApi.listMessages(conv.id).catch(() => [] as ApiMessage[]);
      setSupportMessages(rows);
      messagingApi.markSupportConversationRead(conv.id).catch(() => undefined);
    }
  }, [supportConv]);

  const sendSupport = async (body: string) => {
    if (!supportConv || !body.trim()) return;
    setSupportBusy(true);
    try {
      const res = await messagingApi.sendSupportMessage(supportConv.id, body.trim());
      setSupportMessages((prev) => [...prev, res.message]);
      setSupportConv(res.conversation);
      setComposerText('');
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Failed to send to Choosify Support');
    } finally {
      setSupportBusy(false);
    }
  };

  // Live booking-request state keyed by requestId — re-resolves the current
  // status of the bookingOffer snapshots embedded on platform messages, so
  // the Seller card reflects canonical state, not a stale snapshot.
  const [bookingByRequestId, setBookingByRequestId] = useState<Record<string, OpsBookingOffer>>({});
  const [offerBusy, setOfferBusy] = useState<string | null>(null);

  const refreshBookingRequests = useCallback(async () => {
    if (!profile?.id) return;
    try {
      const rows = await operationsApi.listBookingRequests({ sellerId: profile.id });
      const map: Record<string, OpsBookingOffer> = {};
      for (const r of rows) if (r.requestId) map[r.requestId] = r;
      setBookingByRequestId(map);
    } catch {
      // Non-fatal: cards fall back to the message snapshot.
    }
  }, [profile?.id]);

  useEffect(() => {
    void refreshBookingRequests();
  }, [refreshBookingRequests]);

  // Each thread scrolls its own viewport directly (no sentinel "end" div) so
  // positioning can be read/set synchronously without relying on
  // scrollIntoView's animated, interruptible behavior.
  const buyerThreadRef = useRef<HTMLDivElement>(null);
  const buyerNearBottomRef = useRef(true);
  const supportThreadRef = useRef<HTMLDivElement>(null);
  const supportNearBottomRef = useRef(true);

  const loadConversations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const orders = await operationsApi.listOrders();
      setAllOrders(orders);
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

      // Inquiry-only buyers: a product/service request (booking_requests row)
      // creates a real conv_platform_<buyerId> thread before any order exists.
      // Fold those buyers in so the Seller sees the inquiry, not just buyers
      // who have already ordered.
      const seen = new Set(rows.map((r) => r.buyerId));
      try {
        const reqs = profile?.id
          ? await operationsApi.listBookingRequests({ sellerId: profile.id })
          : [];
        for (const req of reqs) {
          const bId = req.buyerId;
          if (!bId || seen.has(bId)) continue;
          seen.add(bId);
          let last = req.listingTitle ? `Request: ${req.listingTitle}` : 'New request';
          let when = req.createdAt || new Date().toISOString();
          let has = false;
          try {
            const { data } = await operationsApi.listPlatformMessages(bId);
            if (data.length > 0) {
              last = displayBody(data[data.length - 1].content?.body || '') || last;
              when = data[data.length - 1].timestamp;
              has = true;
            }
          } catch {
            /* keep the request-derived fallback */
          }
          rows.push({
            buyerId: bId,
            buyerName: `Buyer ${bId.slice(0, 8)}`,
            lastOrderId: req.orderId || '',
            lastMessage: last,
            updatedAt: when,
            hasMessages: has,
          });
        }
      } catch {
        /* booking requests unavailable — order-derived list still stands */
      }

      rows.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      setConversations(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load conversations');
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  // `silent` distinguishes a genuine cold open (show the spinner) from a
  // background realtime/poll refresh (must never blank the thread the user
  // is currently reading — that collapse-then-rebuild cycle, repeating every
  // few seconds, was the actual cause of the visible scroll loop).
  const loadMessages = useCallback(async (buyerId: string, opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    if (!silent) {
      setMessagesLoading(true);
      setSendError(null);
    }
    try {
      const { data } = await operationsApi.listPlatformMessages(buyerId);
      setMessages(data);
    } catch (err) {
      if (!silent) {
        setMessages([]);
        setSendError(err instanceof Error ? err.message : 'Failed to load messages');
      }
      // Silent background refreshes keep whatever is already on screen.
    } finally {
      if (!silent) setMessagesLoading(false);
    }
  }, []);

  // Live delivery for the open buyer (Customers tab) thread — legacy System B
  // (conv_platform_<buyerId>) writes straight into the same omni_messages
  // collection Messages.tsx already subscribes to, so the identical listener
  // pattern applies here too.
  useEffect(() => {
    if (!selectedBuyerId) return;
    const conversationId = `conv_platform_${selectedBuyerId}`;
    const q = query(collection(db, 'omni_messages'), where('conversationId', '==', conversationId));
    const unsub = onSnapshot(
      q,
      () => void loadMessages(selectedBuyerId, { silent: true }),
      (err) => {
        console.warn('[SellerConversations] Live buyer-message listener failed; staying on manual refresh.', err);
      },
    );
    return () => unsub();
  }, [selectedBuyerId, loadMessages]);

  // REST-polling safety net for the open buyer thread + a slower one for the
  // conversation list — both only actually poll when the omni Firestore
  // mirror isn't genuinely live.
  useMessagingPoll(
    selectedBuyerId,
    () => selectedBuyerId && void loadMessages(selectedBuyerId, { silent: true }),
    4000,
  );
  useMessagingPoll('seller-conversations-list', () => void loadConversations(), 20000);

  const selectConversation = (buyerId: string) => {
    setSupportSelected(false);
    setSelectedBuyerId(buyerId);
    void loadMessages(buyerId);
  };

  useEffect(() => {
    if (wantSupport) void openSupport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantSupport]);

  useEffect(() => {
    if (deepLinkBuyerId) selectConversation(deepLinkBuyerId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkBuyerId]);

  // Buyer thread scroll lifecycle: (1) jump to the bottom once, synchronously,
  // whenever a different buyer is opened; (2) track how close to the bottom
  // the user currently is; (3) on any later message-array update (a reply
  // sent, a realtime/poll refresh landing), only follow to the bottom if the
  // user was already there — never yank someone reading history back down.
  useLayoutEffect(() => {
    const el = buyerThreadRef.current;
    if (!el || !selectedBuyerId) return;
    el.scrollTop = el.scrollHeight;
    buyerNearBottomRef.current = true;
  }, [selectedBuyerId]);

  useEffect(() => {
    const el = buyerThreadRef.current;
    if (!el) return;
    const NEAR_BOTTOM_PX = 120;
    const handleScroll = () => {
      buyerNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight <= NEAR_BOTTOM_PX;
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [selectedBuyerId]);

  useEffect(() => {
    const el = buyerThreadRef.current;
    if (!el || !buyerNearBottomRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Same lifecycle for the Choosify Support thread, keyed on which
  // conversation is actually open (a buyer thread and Support are mutually
  // exclusive panels, but each keeps its own independent scroll state).
  useLayoutEffect(() => {
    const el = supportThreadRef.current;
    if (!el || !supportSelected) return;
    el.scrollTop = el.scrollHeight;
    supportNearBottomRef.current = true;
  }, [supportSelected, supportConv?.id]);

  useEffect(() => {
    const el = supportThreadRef.current;
    if (!el) return;
    const NEAR_BOTTOM_PX = 120;
    const handleScroll = () => {
      supportNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight <= NEAR_BOTTOM_PX;
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [supportSelected, supportConv?.id]);

  useEffect(() => {
    const el = supportThreadRef.current;
    if (!el || !supportNearBottomRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [supportMessages]);

  const selectedConversation = useMemo(
    () => conversations.find((c) => c.buyerId === selectedBuyerId) || null,
    [conversations, selectedBuyerId],
  );

  const [orderActionBusy, setOrderActionBusy] = useState<string | null>(null);
  const [orderActionMsg, setOrderActionMsg] = useState<string | null>(null);

  /**
   * Re-pull the canonical order + shipment straight from Operations after any
   * quick action. Messaging holds NO order state of its own — this is the
   * same `operationsApi.getOrder` the Order Console reads.
   */
  const reloadOrderContext = useCallback(async (orderId: string) => {
    setContextLoading(true);
    try {
      const fresh = await operationsApi.getOrder(orderId);
      setContextOrder(fresh);
      setAllOrders((prev) => prev.map((o) => (o.orderId === orderId ? fresh : o)));
    } catch {
      /* keep the last known order */
    }
    try {
      setContextShipment(await operationsApi.getShipment(orderId));
    } catch {
      setContextShipment(null);
    }
    setContextLoading(false);
  }, []);

  // Resolve canonical order + shipment context for the selected buyer's most
  // recent order. Presentation enrichment only — the relationship is explicit
  // (the conversation row's lastOrderId), never inferred.
  useEffect(() => {
    setOrderActionMsg(null);
    if (!selectedConversation) {
      setContextOrder(null);
      setContextShipment(null);
      return;
    }
    const order =
      allOrders.find((o) => o.orderId === selectedConversation.lastOrderId) || null;
    setContextOrder(order);
    setContextShipment(null);
    if (!order) return;
    let cancelled = false;
    setContextLoading(true);
    operationsApi
      .getShipment(order.orderId)
      .then((s) => {
        if (!cancelled) setContextShipment(s);
      })
      .catch(() => {
        if (!cancelled) setContextShipment(null);
      })
      .finally(() => {
        if (!cancelled) setContextLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConversation?.lastOrderId, allOrders.length]);

  const orderStatusLower = String(contextOrder?.status || '').toLowerCase();
  const orderTerminal = orderStatusLower === 'cancelled' || orderStatusLower === 'completed';
  const undeliveredItems = (contextOrder?.subOrders || [])
    .flatMap((s) => s.items || [])
    .filter((it) => !it.deliveredAt);

  /** Mark every not-yet-delivered line delivered — the SAME canonical call
   *  the Seller Order Console makes (operationsApi.markOrderItemDelivered):
   *  reserved→consumed inventory, deliveredAt stamp, buyer notification,
   *  review eligibility + completion/freeze all handled server-side. */
  const markDelivered = async () => {
    if (!contextOrder || undeliveredItems.length === 0) return;
    if (!window.confirm(`Mark order ${contextOrder.orderId} delivered? This finalises inventory and notifies the buyer.`)) return;
    setOrderActionBusy('deliver');
    setOrderActionMsg(null);
    try {
      for (const it of undeliveredItems) {
        await operationsApi.markOrderItemDelivered(contextOrder.orderId, it.itemId);
      }
      await reloadOrderContext(contextOrder.orderId);
      setOrderActionMsg('Order marked delivered.');
    } catch (err) {
      setOrderActionMsg(err instanceof Error ? err.message : 'Could not mark delivered');
    } finally {
      setOrderActionBusy(null);
    }
  };

  const [trackCourier, setTrackCourier] = useState('');
  const [trackNumber, setTrackNumber] = useState('');
  useEffect(() => {
    setTrackCourier(contextShipment?.courier || '');
    setTrackNumber(contextShipment?.trackingNumber || '');
  }, [contextShipment?.id]);

  const saveTracking = async () => {
    if (!contextShipment || !contextOrder) return;
    setOrderActionBusy('track');
    setOrderActionMsg(null);
    try {
      await operationsApi.updateShipment(contextShipment.id, {
        courier: trackCourier.trim() || undefined,
        trackingNumber: trackNumber.trim() || undefined,
      });
      await reloadOrderContext(contextOrder.orderId);
      setOrderActionMsg('Tracking updated.');
    } catch (err) {
      setOrderActionMsg(err instanceof Error ? err.message : 'Could not update tracking');
    } finally {
      setOrderActionBusy(null);
    }
  };

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
              ? {
                  ...c,
                  lastMessage: displayBody(message.content.body),
                  updatedAt: message.timestamp,
                  hasMessages: true,
                }
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

  const runOfferAction = async (
    requestId: string,
    action: 'accept' | 'decline' | 'counter',
  ) => {
    setOfferBusy(requestId);
    try {
      if (action === 'accept') {
        await operationsApi.acceptBookingRequest(requestId, profile?.displayName);
      } else if (action === 'decline') {
        const reason = window.prompt('Decline reason (shown to the buyer):', 'Unavailable') || 'Declined';
        await operationsApi.declineBookingRequest(requestId, reason, profile?.displayName);
      } else {
        const raw = window.prompt('Counter price (৳):', '');
        const price = raw ? Number.parseFloat(raw) : NaN;
        if (!raw || Number.isNaN(price)) return;
        await operationsApi.counterBookingRequest(requestId, { price }, profile?.displayName);
      }
      await refreshBookingRequests();
      if (selectedBuyerId) await loadMessages(selectedBuyerId);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Could not update the offer');
    } finally {
      setOfferBusy(null);
    }
  };

  const renderMessage = (m: OpsPlatformMessage) => {
    const mine = m.direction === 'outbound';
    const when = formatElapsed(m.timestamp);

    // Platform-generated events (e.g. "Order ORD-13659 placed") are written
    // with senderId:'system' (see server/operations/platformMessagingBridge.ts)
    // — neither the buyer nor the seller said this, so it must never inherit
    // the mine/not-mine buyer-vs-seller bubble treatment based on `direction`.
    if (m.senderId === 'system') {
      return (
        <div key={m.id} className="flex justify-center my-1">
          <span className="text-[10.5px] font-semibold text-slate-500 bg-slate-100 border border-app-border rounded-full px-3 py-1 text-center">
            {displayBody(m.content?.body || '')}
          </span>
        </div>
      );
    }

    if (m.bookingOffer && (m.bookingOffer.requestId || m.bookingOffer.listingTitle)) {
      const snap = m.bookingOffer;
      const live = snap.requestId ? bookingByRequestId[snap.requestId] : undefined;
      const offer = { ...snap, ...(live || {}) };
      const status = offer.status || 'pending';
      const isProduct = offer.isService === false;
      const fields = Object.entries(offer.fields || {})
        .slice(0, 6)
        .map(([k, v]) => [k, String(v)] as [string, string]);
      const canAct = !!offer.requestId && status === 'pending';
      return (
        <OfferCard
          key={m.id}
          kind={isProduct ? 'product' : 'booking'}
          title={offer.listingTitle || 'Listing'}
          image={offer.listingImage}
          subtitle={offer.serviceCategory}
          price={money(offer.price)}
          originalPrice={
            status === 'countered' && offer.originalPrice && offer.originalPrice !== offer.price
              ? money(offer.originalPrice)
              : undefined
          }
          status={status}
          fields={fields}
          mine={mine}
          when={when}
          actions={
            canAct ? (
              <>
                <OfferCardButton
                  tone="accent"
                  disabled={offerBusy === offer.requestId}
                  onClick={() => void runOfferAction(offer.requestId!, 'accept')}
                >
                  Accept
                </OfferCardButton>
                <OfferCardButton
                  disabled={offerBusy === offer.requestId}
                  onClick={() => void runOfferAction(offer.requestId!, 'counter')}
                >
                  Counter
                </OfferCardButton>
                <OfferCardButton
                  tone="danger"
                  disabled={offerBusy === offer.requestId}
                  onClick={() => void runOfferAction(offer.requestId!, 'decline')}
                >
                  Decline
                </OfferCardButton>
              </>
            ) : status === 'countered' ? (
              <span className="text-[10px] text-app-text-secondary">Awaiting buyer response</span>
            ) : offer.orderId ? (
              <OfferCardButton onClick={() => navigate('/admin/platform-orders')}>
                View Order
              </OfferCardButton>
            ) : null
          }
        />
      );
    }

    if (m.orderOffer && (m.orderOffer.offerId || m.orderOffer.orderId || m.orderOffer.items)) {
      const o = m.orderOffer;
      return (
        <OfferCard
          key={m.id}
          kind="order"
          title={o.items?.[0]?.name ? `${o.items[0].name}${o.items.length > 1 ? ` +${o.items.length - 1}` : ''}` : 'Manual order offer'}
          image={o.items?.[0]?.image}
          status={o.status}
          items={(o.items || []).map((it) => ({
            name: it.name || 'Item',
            quantity: it.quantity,
            price: money(it.price),
          }))}
          total={money(o.overallTotal)}
          mine={mine}
          when={when}
          actions={
            o.orderId ? (
              <OfferCardButton onClick={() => navigate('/admin/platform-orders')}>
                View Order
              </OfferCardButton>
            ) : o.rejectReason ? (
              <span className="text-[10px] text-red-500">Rejected: {o.rejectReason}</span>
            ) : null
          }
        />
      );
    }

    return (
      <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
        <div
          className={`w-fit max-w-[75%] rounded-2xl px-3.5 py-2 text-xs font-bold leading-relaxed ${
            mine
              ? 'bg-orange-600 bg-gradient-to-br from-[#EF3C23] to-[#FF5B00] text-white rounded-br-sm'
              : 'bg-navy bg-gradient-to-br from-[#18154C] to-[#3D1D6B] text-white rounded-bl-sm'
          }`}
        >
          <p className="whitespace-pre-wrap break-words !text-[#FFFFFF]">{displayBody(m.content?.body || '')}</p>
          <p className="text-[9px] mt-1 text-white/70">{when}</p>
        </div>
      </div>
    );
  };

  const filteredConversations = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(
      (c) =>
        c.buyerName.toLowerCase().includes(q) ||
        c.lastMessage.toLowerCase().includes(q) ||
        c.lastOrderId.toLowerCase().includes(q),
    );
  }, [conversations, search]);

  const subtitle =
    tab === 'inbox'
      ? 'Your buyer conversations and Choosify Support in one place'
      : "WhatsApp, Messenger and Instagram from your brand's connected accounts";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-app-accent/10 border border-app-accent/20">
            <MessageCircleMore className="w-5 h-5 text-app-accent" />
          </div>
          <div>
            <h1 className="text-xl font-black text-app-text-primary tracking-tight m-0">Messages</h1>
            <p className="text-xs text-app-text-secondary m-0">
              Manage customer, Choosify support and connected social conversations. {subtitle}.
            </p>
          </div>
        </div>
        {tab === 'inbox' ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void openSupport()}
              disabled={supportBusy}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#FF5B00] text-white text-xs font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              <MessageCircleMore className="w-3.5 h-3.5" /> Contact Choosify Support
            </button>
            <button
              type="button"
              onClick={() => void loadConversations()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-app-border text-xs font-bold text-app-text-secondary hover:text-app-text-primary hover:border-app-accent/40 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>
        ) : null}
      </div>

      <div className="flex gap-1 border-b border-app-border">
        {(
          [
            ['inbox', 'Choosify Seller Inbox'],
            ['meta', 'Meta Inbox'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-[12px] font-bold border-b-2 -mb-px transition-colors ${
              tab === key
                ? 'border-app-accent text-app-accent'
                : 'border-transparent text-app-text-secondary hover:text-app-text-primary'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'meta' ? (
        <MetaInbox currentUserId={profile?.id} />
      ) : (
        <>
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs font-semibold text-red-500">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr_280px] gap-4 h-[calc(100vh-220px)] min-h-[440px]">
            <GlassCard hoverLift={false} className="p-0 flex flex-col overflow-hidden">
              <ThreadListSearch
                value={search}
                onChange={setSearch}
                placeholder="Search buyer, message, order…"
              />
              <div className="px-3 py-2 border-b border-app-border">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 m-0">
                  {filteredConversations.length} buyer{filteredConversations.length === 1 ? '' : 's'}
                </p>
              </div>
              <div className="flex-1 overflow-y-auto">
                {/* Choosify Support — pinned, labelled thread inside the Seller Inbox */}
                <button
                  type="button"
                  onClick={() => void openSupport()}
                  className={`w-full text-left p-3 border-b border-app-border/60 transition-colors ${
                    supportSelected ? 'bg-app-accent/10' : 'hover:bg-slate-50/80'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-sm text-app-text-primary truncate flex items-center gap-1.5">
                      <span className="inline-flex items-center text-[8.5px] font-black uppercase tracking-wide px-1 py-0.5 rounded border bg-[#FF5B00]/10 text-[#FF5B00] border-[#FF5B00]/20">
                        Choosify Support
                      </span>
                      Choosify team
                    </span>
                    {supportConv?.lastMessageAt ? (
                      <span className="text-[10px] text-slate-400 shrink-0">
                        {formatElapsed(supportConv.lastMessageAt)}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-app-text-secondary truncate mt-0.5">
                    {supportConv?.lastMessagePreview || 'Message the Choosify team for help.'}
                  </p>
                </button>

                {loading ? (
                  <div className="flex items-center justify-center py-10 text-slate-400">
                    <Loader2 className="w-5 h-5 animate-spin" />
                  </div>
                ) : filteredConversations.length === 0 ? (
                  <div className="p-4 text-xs text-slate-400">
                    {conversations.length === 0
                      ? 'No buyers yet. Conversations appear here once someone orders from you.'
                      : 'No conversations match your search.'}
                  </div>
                ) : (
                  filteredConversations.map((c) => (
                    <button
                      key={c.buyerId}
                      type="button"
                      onClick={() => selectConversation(c.buyerId)}
                      className={`w-full text-left p-3 border-b border-app-border/60 transition-colors ${
                        selectedBuyerId === c.buyerId ? 'bg-app-accent/10' : 'hover:bg-slate-50/80'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-sm text-app-text-primary truncate">
                          {c.buyerName}
                        </span>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {formatElapsed(c.updatedAt)}
                        </span>
                      </div>
                      <p className="text-xs text-app-text-secondary truncate mt-0.5">
                        {c.lastMessage}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Order {c.lastOrderId}</p>
                    </button>
                  ))
                )}
              </div>
            </GlassCard>

            <GlassCard hoverLift={false} className="p-0 flex flex-col overflow-hidden">
              {supportSelected ? (
                <>
                  <div className="p-3 border-b border-app-border flex items-center gap-2">
                    <span className="inline-flex items-center text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded border bg-[#FF5B00]/10 text-[#FF5B00] border-[#FF5B00]/20">
                      Choosify Support
                    </span>
                    <span className="font-bold text-sm text-app-text-primary">Choosify team</span>
                    {supportConv && supportConv.status !== 'active' ? (
                      <span className="text-[10px] text-slate-400">· {supportConv.status}</span>
                    ) : null}
                  </div>
                  <div ref={supportThreadRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                    {!supportConv ? (
                      <p className="text-xs text-slate-400 text-center py-10">
                        {supportBusy ? 'Opening…' : 'Start a conversation with the Choosify team.'}
                      </p>
                    ) : supportMessages.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-10">
                        No messages yet. Say hello — the Choosify team will reply here.
                      </p>
                    ) : (
                      supportMessages.map((m) => (
                        m.senderRole === 'system' || m.messageType === 'system' ? (
                          <div key={m.id} className="flex justify-center my-1">
                            <span className="text-[10.5px] font-semibold text-slate-500 bg-slate-100 border border-app-border rounded-full px-3 py-1 text-center">
                              {m.body}
                            </span>
                          </div>
                        ) : (
                          <div
                            key={m.id}
                            className={`flex ${m.senderId === profile?.id ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`w-fit max-w-[75%] rounded-2xl px-3.5 py-2 text-xs font-bold leading-relaxed ${
                                m.senderId === profile?.id
                                  ? 'bg-orange-600 bg-gradient-to-br from-[#EF3C23] to-[#FF5B00] text-white rounded-br-sm'
                                  : 'bg-navy bg-gradient-to-br from-[#18154C] to-[#3D1D6B] text-white rounded-bl-sm'
                              }`}
                            >
                              {m.senderRole === 'admin' ? (
                                <p className="text-[9px] font-bold uppercase tracking-wide text-white/70 m-0 mb-0.5">
                                  Choosify Support
                                </p>
                              ) : null}
                              <p className="whitespace-pre-wrap break-words m-0 !text-[#FFFFFF]">{m.body}</p>
                              <p className="text-[9px] mt-1 text-white/70">
                                {formatElapsed(m.createdAt)}
                              </p>
                            </div>
                          </div>
                        )
                      ))
                    )}
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
                          void sendSupport(composerText);
                        }
                      }}
                      rows={2}
                      placeholder={
                        supportConv?.status === 'closed'
                          ? 'This conversation is closed.'
                          : 'Message Choosify Support…'
                      }
                      disabled={supportConv?.status === 'closed'}
                      className="flex-1 p-2.5 border border-app-border rounded-xl text-xs resize-none bg-transparent text-app-text-primary disabled:opacity-50"
                    />
                    <button
                      type="button"
                      disabled={supportBusy || !composerText.trim() || supportConv?.status === 'closed'}
                      onClick={() => void sendSupport(composerText)}
                      className="flex items-center justify-center h-10 w-10 rounded-xl bg-app-accent text-white disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                      title="Send"
                    >
                      {supportBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                  </div>
                </>
              ) : !selectedBuyerId ? (
                <div className="flex-1 flex items-center justify-center text-sm text-slate-400">
                  Select a conversation to view it.
                </div>
              ) : (
                <>
                  <div className="p-3 border-b border-app-border flex items-center justify-between gap-2">
                    <div>
                      <p className="font-bold text-sm text-app-text-primary">
                        {selectedConversation?.buyerName}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Order {selectedConversation?.lastOrderId}
                      </p>
                    </div>
                    {selectedBuyerId && (
                      <button
                        type="button"
                        onClick={() => setReportTarget({ id: selectedBuyerId, name: selectedConversation?.buyerName || 'this customer' })}
                        title="Report this customer"
                        className="rounded-lg border border-app-border p-2 text-slate-400 hover:border-red-200 hover:text-red-500 shrink-0"
                      >
                        <Flag className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <div ref={buyerThreadRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                    {messagesLoading ? (
                      <div className="flex items-center justify-center py-10 text-slate-400">
                        <Loader2 className="w-5 h-5 animate-spin" />
                      </div>
                    ) : messages.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-10">
                        No messages yet. Say hello about their order.
                      </p>
                    ) : (
                      messages.map((m) => renderMessage(m))
                    )}
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
                      {sending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </>
              )}
            </GlassCard>

            <GlassCard
              hoverLift={false}
              className="p-0 hidden lg:flex flex-col overflow-hidden"
            >
              {supportSelected ? (
                <ContextRail>
                  <ContextSection title="Choosify Support">
                    <p className="text-[10.5px] text-app-text-secondary m-0 leading-relaxed">
                      This is your direct line to the Choosify team for account, payout, policy or
                      platform questions. Buyer order conversations stay in the list on the left.
                    </p>
                  </ContextSection>
                </ContextRail>
              ) : !selectedConversation ? (
                <div className="flex-1 flex items-center justify-center text-[11px] text-slate-400 p-4 text-center">
                  Select a conversation to see customer &amp; order context.
                </div>
              ) : (
                <ContextRail>
                  <ContextSection title="Customer">
                    <ContextRow label="Name" value={selectedConversation.buyerName} />
                    <ContextRow
                      label="Buyer ID"
                      value={<span className="font-mono text-[10px]">{selectedConversation.buyerId}</span>}
                    />
                    {contextOrder?.shipping?.phone ? (
                      <ContextRow label="Phone" value={contextOrder.shipping.phone} />
                    ) : null}
                  </ContextSection>

                  <ContextSection title="Transaction">
                    {contextOrder ? (
                      <>
                        <ContextRow
                          label="Order"
                          value={<span className="font-mono text-[10px]">{contextOrder.orderId}</span>}
                        />
                        <ContextRow
                          label="Total"
                          value={`৳${contextOrder.overallTotal.toLocaleString()}`}
                        />
                        {contextOrder.paymentMethod ? (
                          <ContextRow
                            label="Payment"
                            value={contextOrder.paymentMethod.toUpperCase()}
                          />
                        ) : null}
                        <ContextRow
                          label="Payment status"
                          value={contextOrder.paymentStatus || (contextOrder.isCOD ? 'cod' : '—')}
                        />
                        <ContextRow label="Order status" value={contextOrder.status} />
                        {contextOrder.isManual ? (
                          <ContextRow
                            label="Source"
                            value={`Manual · ${contextOrder.platformSource || 'Offline'}`}
                          />
                        ) : null}
                      </>
                    ) : (
                      <p className="text-[10.5px] text-slate-400 m-0">
                        No order is explicitly linked to this conversation.
                      </p>
                    )}
                  </ContextSection>

                  <ContextSection title="Fulfillment">
                    {contextLoading ? (
                      <p className="text-[10.5px] text-slate-400 m-0">Checking shipment…</p>
                    ) : contextShipment ? (
                      <>
                        <ContextRow label="Courier" value={contextShipment.courier || '—'} />
                        <ContextRow
                          label="Tracking"
                          value={
                            <span className="font-mono text-[10px]">
                              {contextShipment.trackingNumber || '—'}
                            </span>
                          }
                        />
                        <ContextRow label="Transit status" value={contextShipment.status} />
                        <button
                          type="button"
                          onClick={() => navigate('/admin/logistics/shipments')}
                          className="flex items-center gap-1 text-[10.5px] font-bold text-app-accent mt-1"
                        >
                          <ExternalLink className="w-3 h-3" /> Manage fulfillment
                        </button>
                      </>
                    ) : (
                      <>
                        <p className="text-[10.5px] text-slate-400 m-0">
                          No shipment record for this order yet.
                        </p>
                        <button
                          type="button"
                          onClick={() => navigate('/admin/logistics/shipments')}
                          className="flex items-center gap-1 text-[10.5px] font-bold text-app-accent mt-1"
                        >
                          <ExternalLink className="w-3 h-3" /> Open Shipment Operations
                        </button>
                      </>
                    )}
                  </ContextSection>

                  {contextOrder && !orderTerminal ? (
                    <ContextSection title="Quick actions">
                      {contextShipment ? (
                        <div className="space-y-1.5 mb-1.5">
                          <input
                            value={trackCourier}
                            onChange={(e) => setTrackCourier(e.target.value)}
                            placeholder="Courier"
                            className="w-full px-2 py-1 rounded-lg border border-app-border bg-transparent text-[11px] text-app-text-primary"
                          />
                          <input
                            value={trackNumber}
                            onChange={(e) => setTrackNumber(e.target.value)}
                            placeholder="Tracking number"
                            className="w-full px-2 py-1 rounded-lg border border-app-border bg-transparent text-[11px] text-app-text-primary"
                          />
                          <ContextActionButton
                            onClick={() => void saveTracking()}
                            disabled={orderActionBusy === 'track'}
                          >
                            Save tracking update
                          </ContextActionButton>
                        </div>
                      ) : null}
                      {undeliveredItems.length > 0 ? (
                        <ContextActionButton
                          onClick={() => void markDelivered()}
                          disabled={orderActionBusy === 'deliver'}
                        >
                          Mark Delivered
                        </ContextActionButton>
                      ) : null}
                      <ContextActionButton onClick={() => navigate('/admin/logistics/shipments')}>
                        Manage Fulfillment
                      </ContextActionButton>
                      {orderActionMsg ? (
                        <p className="text-[10px] text-app-text-secondary m-0">{orderActionMsg}</p>
                      ) : null}
                    </ContextSection>
                  ) : null}

                  <ContextSection title="Actions">
                    <ContextActionButton onClick={() => setManualOpen(true)}>
                      Create Manual Order for this buyer
                    </ContextActionButton>
                    {contextOrder ? (
                      <ContextActionButton onClick={() => navigate('/admin/platform-orders')}>
                        View Order
                      </ContextActionButton>
                    ) : null}
                    <ContextActionButton onClick={() => navigate('/admin/customers')}>
                      View Customer
                    </ContextActionButton>
                    <ContextActionButton onClick={() => navigate('/admin/conversations?tab=support')}>
                      Report to Choosify Support
                    </ContextActionButton>
                  </ContextSection>
                </ContextRail>
              )}
            </GlassCard>
          </div>
        </>
      )}

      <ManualOrderDialog
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        prefill={
          selectedConversation
            ? {
                buyerId: selectedConversation.buyerId,
                buyerName: selectedConversation.buyerName,
                conversationId: `conv_platform_${selectedConversation.buyerId}`,
                provenanceSource: 'manual',
              }
            : undefined
        }
        onCreated={() => {
          setManualOpen(false);
          void loadMessages(selectedConversation?.buyerId || '');
        }}
      />

      {reportTarget && (
        <ReportEntityModal
          isOpen={Boolean(reportTarget)}
          onClose={() => setReportTarget(null)}
          targetType="consumer"
          targetId={reportTarget.id}
          targetName={reportTarget.name}
          source={profile?.role === 'creator' ? 'creator_dashboard' : 'seller_dashboard'}
        />
      )}
    </div>
  );
}
