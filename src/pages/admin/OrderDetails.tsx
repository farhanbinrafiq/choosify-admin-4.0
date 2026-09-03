import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Truck,
  MessageSquare,
  ExternalLink,
  RefreshCw,
  Printer,
  ShieldCheck,
  StickyNote,
  ArrowRight,
} from 'lucide-react';
import {
  operationsApi,
  type OpsStorefrontOrder,
  type OpsShipment,
  type OpsOrderInternalNote,
  type CommerceOrderLite,
} from '../../services/operationsApi';
import { authApi } from '../../services/authApi';
import { catalogApi, type WorkspaceCustomerRow } from '../../services/catalogApi';
import { useAuth } from '../../contexts/AuthContext';
import type { ReturnRequest } from '../../contexts/ReturnsContext';
import {
  ACCENT,
  ACCENT_WASH,
  S,
  formatCurrency,
  formatDate,
  formatDay,
  lifecycleBadgeStyle,
  paymentBadgeStyle,
  paymentBadgeText,
  chipStyle,
  actionBtnStyle,
  ORDER_HUB_CSS,
  ProductIdentityLink,
  useOrderedItemThumbs,
} from './orderHubChrome';
import {
  resolveOrderHubViewer,
  orderHubBasePath,
  buildOperationsTimeline,
  scopedFinancials,
  visibleSubOrders,
  otherSellerCount,
  isMultiSeller,
  derivedFulfillment,
  deriveHubStatus,
  hubStatusLabel,
  fulfillmentStatusLabel,
  isStaffRole,
  conversationDeepLink,
  viewCustomerPath,
  invoicePath,
  lifecyclePanel,
  commerceStatusLabel,
  canAdministrativelyCorrect,
  validateDispatchForm,
  supportCorrectionPath,
  shipmentStatusLabel,
  EMPTY_DISPATCH_FORM,
  type LifecycleSecondaryAction,
  type LifecycleAdminAction,
  type DispatchForm,
} from './orderHubModel';

/**
 * Full Order Details — the operational workspace for one canonical Operations
 * order. Routes: /admin/orders/:orderId (staff) · /admin/platform-orders/:orderId
 * (seller). Authorization is NOT route-dependent — every read/write goes
 * through the canonical Operations / Commerce APIs and the SERVER owns the
 * ownership + transition + note-visibility decisions.
 *
 * Sprint 14 functional-completion pass:
 *   - Order Lifecycle panel drives the canonical Commerce FSM
 *     (GET /orders/by-number/:id → POST /orders/:id/transition | /cancel).
 *   - Internal Notes: staff-only (GET/POST /operations/orders/:id/notes).
 *   - Conversation opens the canonical System-B thread
 *     (/admin/conversations?buyerId=… — same as Seller Inbox), NOT the storefront.
 *   - Invoice View + Print wired to the existing OperationsInvoiceView, per
 *     seller sub-order.
 *   - Customer rail enriched with transaction-safe fields only.
 *   - Perf: the Hub row is handed in via router state for instant first paint;
 *     order / shipment / returns / commerce-lifecycle / notes / customer load
 *     in PARALLEL, each hydrating its own section with a local skeleton.
 *
 * Omitted (no canonical backend — not faked): risk scores, behaviour
 * verification, dispute-case creation, audit-log trail, Reorder / Send Invoice.
 */

type ToastState = { kind: 'success' | 'error'; message: string } | null;
type LoadState<T> = { status: 'idle' | 'loading' | 'ok' | 'error'; data: T; error?: string };

const RESPONSIVE_CSS = `
.ohd-page { overflow-x: clip; }
.ohd-grid { display: grid; grid-template-columns: 1fr; gap: 16px; align-items: start; min-width: 0; }
@media (min-width: 1024px) { .ohd-grid { grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr); } }
.ohd-col { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
.ohd-timeline { display: grid; gap: 8px; grid-template-columns: repeat(2, 1fr); overflow: hidden; }
@media (min-width: 640px) { .ohd-timeline { grid-template-columns: repeat(var(--steps, 5), 1fr); } }
.ohd-tl-conn { position: absolute; left: -50%; top: 13px; width: 100%; height: 2px; }
@media (max-width: 639px) { .ohd-tl-conn { display: none; } }
.ohd-skel { background: linear-gradient(90deg,#F1F3F5 25%,#E8EDF2 37%,#F1F3F5 63%); background-size: 400% 100%; animation: ohd-shimmer 1.4s ease infinite; border-radius: 6px; }
@keyframes ohd-shimmer { 0% { background-position: 100% 50%; } 100% { background-position: 0 50%; } }
` + ORDER_HUB_CSS;

function Skeleton({ h = 14, w = '100%' }: { h?: number; w?: number | string }) {
  return <div className="ohd-skel" style={{ height: h, width: w }} />;
}

export default function OrderDetailsPage() {
  const { orderId = '' } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();
  const viewer = useMemo(() => resolveOrderHubViewer(profile), [profile]);
  const staff = isStaffRole(profile?.role);
  const hubPath = orderHubBasePath(viewer);

  // Hub hands the already-loaded row in via router state → instant first paint.
  const seededOrder = (location.state as { order?: OpsStorefrontOrder } | null)?.order;
  const seededMatches = seededOrder?.orderId === orderId;

  const [order, setOrder] = useState<OpsStorefrontOrder | null>(seededMatches ? seededOrder! : null);
  const [orderState, setOrderState] = useState<LoadState<null>>({
    status: seededMatches ? 'ok' : 'loading',
    data: null,
  });

  // Current-catalog product photos for this order's (few) items — Full Details
  // only. Snapshot title/price/variant stay from the order; photo is a live
  // presentational enrichment with a placeholder fallback. Hook runs before the
  // early returns (rules of hooks); harmless when `order` is still null.
  const thumbItems = useMemo(
    () => (order?.subOrders || []).flatMap((s) => s.items || []),
    [order],
  );
  const productThumbs = useOrderedItemThumbs(thumbItems);

  const [shipment, setShipment] = useState<LoadState<OpsShipment | null>>({ status: 'loading', data: null });
  const [returns, setReturns] = useState<LoadState<ReturnRequest[]>>({ status: 'loading', data: [] });
  const [commerce, setCommerce] = useState<LoadState<CommerceOrderLite | null>>({ status: 'loading', data: null });
  const [notes, setNotes] = useState<LoadState<OpsOrderInternalNote[]>>({
    status: staff ? 'loading' : 'idle',
    data: [],
  });
  const [customer, setCustomer] = useState<LoadState<{
    cfId?: string | null;
    email?: string | null;
    displayName?: string | null;
    relationship?: Pick<WorkspaceCustomerRow, 'totalOrders' | 'totalSpend' | 'segment' | 'lastPurchase'>;
  } | null>>({ status: 'loading', data: null });

  const [trackingDraft, setTrackingDraft] = useState({ courier: '', trackingNumber: '' });
  const [savingTracking, setSavingTracking] = useState(false);
  const [markingItemId, setMarkingItemId] = useState<string | null>(null);
  const [lifecycleBusy, setLifecycleBusy] = useState(false);
  const [modifyOpen, setModifyOpen] = useState(false);
  const [pendingSecondary, setPendingSecondary] = useState<LifecycleSecondaryAction | null>(null);
  const [secondaryReason, setSecondaryReason] = useState('');
  // Dispatch Details sheet
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [dispatchForm, setDispatchForm] = useState<DispatchForm>(EMPTY_DISPATCH_FORM);
  const [dispatchErrors, setDispatchErrors] = useState<Record<string, string>>({});
  // Administrative Status Correction
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const [pendingAdmin, setPendingAdmin] = useState<LifecycleAdminAction | null>(null);
  const [adminReason, setAdminReason] = useState('');
  const [noteDraft, setNoteDraft] = useState('');
  const [noteBusy, setNoteBusy] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const trackingTouched = useRef(false);

  const showToast = useCallback((kind: 'success' | 'error', message: string) => {
    setToast({ kind, message });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const hydrateTrackingDraft = useCallback((s: OpsShipment | null) => {
    if (trackingTouched.current) return;
    setTrackingDraft({ courier: s?.courier || '', trackingNumber: s?.trackingNumber || '' });
  }, []);

  // ── parallel load ─────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!seededMatches) setOrderState({ status: 'loading', data: null });
    setShipment({ status: 'loading', data: null });
    setReturns({ status: 'loading', data: [] });
    setCommerce({ status: 'loading', data: null });
    if (staff) setNotes({ status: 'loading', data: [] });
    setCustomer({ status: 'loading', data: null });

    // primary
    operationsApi
      .getOrder(orderId)
      .then((row) => {
        setOrder(row);
        setOrderState({ status: 'ok', data: null });
      })
      .catch((err) => {
        if (!seededMatches) setOrder(null);
        setOrderState({
          status: 'error',
          data: null,
          error: err instanceof Error ? err.message : 'Failed to load order',
        });
      });

    // secondary — independent, parallel
    operationsApi
      .getShipment(orderId)
      .then((s) => {
        setShipment({ status: 'ok', data: s });
        hydrateTrackingDraft(s);
      })
      .catch(() => setShipment({ status: 'ok', data: null }));

    operationsApi
      .listReturns(viewer.mode === 'seller' && viewer.sellerId ? { sellerId: viewer.sellerId, orderId } : { orderId })
      .then((rows) => setReturns({ status: 'ok', data: rows.filter((r) => r.orderId === orderId) }))
      .catch(() => setReturns({ status: 'ok', data: [] }));

    operationsApi
      .getCommerceOrderByNumber(orderId)
      .then((co) => setCommerce({ status: 'ok', data: co }))
      .catch((err) =>
        setCommerce({
          status: 'error',
          data: null,
          error: err instanceof Error ? err.message : 'lifecycle unavailable',
        }),
      );

    if (staff) {
      operationsApi
        .listOrderNotes(orderId)
        .then((n) => setNotes({ status: 'ok', data: n }))
        .catch((err) =>
          setNotes({ status: 'error', data: [], error: err instanceof Error ? err.message : 'notes unavailable' }),
        );
    }
  }, [orderId, seededMatches, staff, viewer.mode, viewer.sellerId, hydrateTrackingDraft]);

  useEffect(() => {
    void load();
  }, [load]);

  // customer enrichment — depends on the loaded order's buyerId
  useEffect(() => {
    const buyerId = order?.buyerId;
    if (!buyerId) return;
    let cancelled = false;
    setCustomer({ status: 'loading', data: null });
    (async () => {
      try {
        if (viewer.mode === 'admin') {
          const u = await authApi.getUserDetail(buyerId);
          if (!cancelled)
            setCustomer({
              status: 'ok',
              data: { cfId: u.choosifyUserId, email: u.email, displayName: u.displayName },
            });
        } else {
          const c = await catalogApi.getMyCustomer(buyerId, 'seller');
          if (!cancelled)
            setCustomer({
              status: 'ok',
              data: {
                cfId: c.choosifyUserId,
                email: c.email,
                displayName: c.name,
                relationship: {
                  totalOrders: c.totalOrders,
                  totalSpend: c.totalSpend,
                  segment: c.segment,
                  lastPurchase: c.lastPurchase,
                },
              },
            });
        }
      } catch {
        if (!cancelled) setCustomer({ status: 'ok', data: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [order?.buyerId, viewer.mode]);

  // ── mutations ────────────────────────────────────────────────────────
  const refetchOrder = useCallback(async () => {
    try {
      setOrder(await operationsApi.getOrder(orderId));
    } catch {
      /* keep prior */
    }
  }, [orderId]);

  // Canonical delivery settlement can advance the Commerce order + OpsShipment
  // as a side effect of a per-item "Mark Delivered" — pull both so the
  // lifecycle panel / badges reflect the converged state without a full reload.
  const refetchLifecycle = useCallback(async () => {
    await Promise.allSettled([
      operationsApi
        .getCommerceOrderByNumber(orderId)
        .then((co) => setCommerce({ status: 'ok', data: co }))
        .catch(() => {}),
      operationsApi
        .getShipment(orderId)
        .then((s) => setShipment({ status: 'ok', data: s }))
        .catch(() => {}),
    ]);
  }, [orderId]);

  const handleSaveTracking = async () => {
    const s = shipment.data;
    if (!s) return;
    setSavingTracking(true);
    try {
      const updated = await operationsApi.updateShipment(s.id, {
        courier: trackingDraft.courier.trim(),
        trackingNumber: trackingDraft.trackingNumber.trim(),
      });
      setShipment({ status: 'ok', data: updated });
      showToast('success', 'Courier & tracking updated.');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to update tracking');
    } finally {
      setSavingTracking(false);
    }
  };

  const handleMarkDelivered = async (itemId: string) => {
    if (!order) return;
    setMarkingItemId(itemId);
    try {
      const updated = await operationsApi.markOrderItemDelivered(order.orderId, itemId);
      setOrder(updated);
      await refetchLifecycle();
      showToast('success', 'Item marked delivered.');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to mark item delivered');
    } finally {
      setMarkingItemId(null);
    }
  };

  // PRIMARY: advance one legitimate step. Canonical endpoint + refetch — never
  // advance cosmetically. The Hub re-derives on Back (it remounts).
  const handleTransition = async (to: CommerceOrderLite['status']) => {
    const co = commerce.data;
    if (!co) return;
    setLifecycleBusy(true);
    try {
      const next = await operationsApi.transitionCommerceOrder(co.id, to);
      setCommerce({ status: 'ok', data: next });
      await refetchOrder();
      showToast('success', `Order moved to ${commerceStatusLabel(next.status)}.`);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Transition rejected');
    } finally {
      setLifecycleBusy(false);
    }
  };

  // SECONDARY: one of the server-authorized corrections (reject / cancel /
  // return-to-pending). Reason required; server re-validates eligibility.
  const runSecondary = async () => {
    const co = commerce.data;
    const action = pendingSecondary;
    if (!co || !action) return;
    // Seller post-dispatch correction → route into Choosify Support with context.
    if (action.kind === 'request_correction') {
      const st = commerceStatusLabel(co.status);
      setPendingSecondary(null);
      setModifyOpen(false);
      navigate(supportCorrectionPath(order?.orderId || orderId, st, secondaryReason.trim() || undefined));
      return;
    }
    if (!secondaryReason.trim()) return;
    setLifecycleBusy(true);
    try {
      let next: CommerceOrderLite;
      if (action.kind === 'return_to_pending') {
        next = await operationsApi.returnCommerceOrderToPending(co.id, secondaryReason.trim());
      } else {
        // 'reject' and 'cancel' both go through the canonical cancel endpoint;
        // the server records cancelledBy + statusBeforeCancel, so a cancel from
        // 'pending' surfaces as "Rejected".
        next = await operationsApi.cancelCommerceOrder(co.id, secondaryReason.trim());
      }
      setCommerce({ status: 'ok', data: next });
      setPendingSecondary(null);
      setSecondaryReason('');
      setModifyOpen(false);
      await refetchOrder();
      showToast(
        'success',
        action.kind === 'return_to_pending'
          ? 'Order returned to Pending.'
          : action.kind === 'reject'
            ? 'Order rejected.'
            : 'Order cancelled.',
      );
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Action rejected by the server');
    } finally {
      setLifecycleBusy(false);
    }
  };

  // DISPATCH: validate → server writes shipment then advances → refetch.
  const handleDispatch = async () => {
    const co = commerce.data;
    if (!co) return;
    const errs = validateDispatchForm(dispatchForm);
    if (Object.keys(errs).length > 0) {
      setDispatchErrors(errs);
      return;
    }
    setDispatchErrors({});
    setLifecycleBusy(true);
    try {
      const res = await operationsApi.dispatchCommerceOrder(co.id, {
        fulfillmentMethod: dispatchForm.fulfillmentMethod,
        courier: dispatchForm.courier.trim() || undefined,
        trackingNumber: dispatchForm.trackingNumber.trim() || undefined,
        trackingUrl: dispatchForm.trackingUrl.trim() || undefined,
        estimatedDelivery: dispatchForm.estimatedDelivery.trim() || undefined,
        dispatchNote: dispatchForm.dispatchNote.trim() || undefined,
      });
      setCommerce({ status: 'ok', data: res.order });
      setShipment({ status: 'ok', data: res.shipment });
      setDispatchOpen(false);
      setDispatchForm(EMPTY_DISPATCH_FORM);
      await refetchOrder();
      showToast('success', res.reused ? 'Order was already dispatched.' : 'Order dispatched.');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Dispatch rejected — the order did not advance.');
    } finally {
      setLifecycleBusy(false);
    }
  };

  // ADMIN CORRECTION: explicit allow-list target + required reason. 409 → toast, no change.
  const handleAdminCorrect = async () => {
    const co = commerce.data;
    const a = pendingAdmin;
    if (!co || !a || !adminReason.trim()) return;
    setLifecycleBusy(true);
    try {
      const res = await operationsApi.adminCorrectCommerceOrder(co.id, a.to, adminReason.trim());
      setCommerce({ status: 'ok', data: res.order });
      setPendingAdmin(null);
      setAdminReason('');
      setAdminMenuOpen(false);
      await refetchOrder();
      // shipment may have changed (dispatch retracted) — refresh it
      operationsApi.getShipment(orderId).then((s) => setShipment({ status: 'ok', data: s })).catch(() => {});
      showToast('success', `Correction applied: ${res.from} → ${res.to}.`);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Correction rejected (no change made).');
    } finally {
      setLifecycleBusy(false);
    }
  };

  const handleAddNote = async () => {
    if (!noteDraft.trim()) return;
    setNoteBusy(true);
    try {
      const next = await operationsApi.addOrderNote(
        orderId,
        noteDraft.trim(),
        profile?.displayName || undefined,
      );
      setNotes({ status: 'ok', data: next });
      setNoteDraft('');
      showToast('success', 'Internal note added.');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to add note');
    } finally {
      setNoteBusy(false);
    }
  };

  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate(hubPath);
  };

  // ── not-authorized / hard error ──────────────────────────────────────
  if (orderState.status === 'error' && !order) {
    return (
      <div className="ohd-page" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <style>{RESPONSIVE_CSS}</style>
        <CommandBar orderId={orderId} onBack={goBack} />
        <div style={{ ...S.card, padding: 28, textAlign: 'center' }}>
          <AlertCircle style={{ width: 22, height: 22, color: '#DC2626', margin: '0 auto 10px' }} />
          <div style={{ fontSize: 13, fontWeight: 800, color: '#111827' }}>
            This order is not available to you.
          </div>
          <div style={{ fontSize: 11.5, color: '#6B7280', fontWeight: 600, marginTop: 4 }}>
            {orderState.error || 'Order not found.'} The Operations API authorizes order access on the
            server — you can only open orders your account owns.
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 14 }}>
            <button type="button" onClick={goBack} style={actionBtnStyle(false)}>
              <ArrowLeft style={{ width: 13, height: 13 }} /> Back to Order Hub
            </button>
            <button type="button" onClick={() => void load()} style={actionBtnStyle(false)}>
              <RefreshCw style={{ width: 13, height: 13 }} /> Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="ohd-page" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <style>{RESPONSIVE_CSS}</style>
        <CommandBar orderId={orderId} onBack={goBack} />
        <div style={{ ...S.card, padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Skeleton h={18} w={220} />
          <Skeleton h={12} />
          <Skeleton h={12} w="80%" />
          <Skeleton h={80} />
        </div>
      </div>
    );
  }

  const subs = visibleSubOrders(order, viewer);
  const timeline = buildOperationsTimeline(order, viewer);
  const fin = scopedFinancials(order, viewer);
  const others = otherSellerCount(order, viewer);
  const fx = derivedFulfillment(order, viewer);
  const invoiceSub = subs.find((s) => s.invoiceId && s.sellerId);
  const lc = lifecyclePanel(commerce.data, viewer, shipment.data);
  const hubStatus = deriveHubStatus(order, {
    commerce: commerce.data,
    shipment: shipment.data,
    hasReturn: returns.data.length > 0,
  });
  const hubStatusText = fulfillmentStatusLabel(hubStatus, shipment.data);
  // once the canonical shipment is delivered / failed / returned there is no
  // ordinary per-item "Mark Delivered" — the lifecycle panel drives it.
  const perItemDeliveryLocked =
    shipment.data?.status === 'delivered' ||
    shipment.data?.status === 'failed_delivery' ||
    shipment.data?.status === 'returned';

  return (
    <div className="ohd-page" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <style>{RESPONSIVE_CSS}</style>

      {/* command bar */}
      <div
        style={{
          ...S.card,
          padding: '14px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={goBack}
            aria-label="Back to Order Hub"
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: '1px solid #E8EDF2',
              background: '#fff',
              cursor: 'pointer',
              color: '#374151',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <ArrowLeft style={{ width: 15, height: 15 }} />
          </button>
          <div style={{ minWidth: 0 }}>
            <Link to={hubPath} style={{ ...S.microLabel, letterSpacing: '0.05em', color: '#9CA3AF', textDecoration: 'none' }}>
              Back to Order Hub
            </Link>
            <div style={{ fontSize: 14.5, fontWeight: 800, marginTop: 2, color: '#111827', wordBreak: 'break-word' }}>
              Order Details: <span style={{ color: ACCENT }}>#{order.orderId}</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Link to={conversationDeepLink(order.buyerId)} style={actionBtnStyle(false)}>
            <MessageSquare style={{ width: 13, height: 13 }} /> Conversation
          </Link>
          {invoiceSub && (
            <>
              <Link to={invoicePath(order.orderId, invoiceSub.sellerId!)} style={actionBtnStyle(false)}>
                📄 View invoice
              </Link>
              <a
                href={invoicePath(order.orderId, invoiceSub.sellerId!, true)}
                target="_blank"
                rel="noopener noreferrer"
                style={actionBtnStyle(false)}
              >
                <Printer style={{ width: 13, height: 13 }} /> Print
              </a>
            </>
          )}
          <Link to="/admin/logistics/shipments" style={actionBtnStyle(true)}>
            <Truck style={{ width: 13, height: 13 }} /> Shipment Operations
          </Link>
          <button type="button" onClick={() => void load()} style={actionBtnStyle(false)}>
            <RefreshCw style={{ width: 13, height: 13 }} /> Refresh
          </button>
          <span style={lifecycleBadgeStyle(hubStatus)}>{hubStatusText}</span>
          <span style={paymentBadgeStyle(order)}>{paymentBadgeText(order)}</span>
          {order.isCOD && <span style={chipStyle()}>COD</span>}
          {isMultiSeller(order) && <span style={chipStyle()}>Split</span>}
        </div>
      </div>

      <div className="ohd-grid">
        {/* ── main left column ─────────────────────────────────────────── */}
        <div className="ohd-col">
          {/* operations timeline */}
          <section style={{ ...S.card, padding: 20 }}>
            <div style={{ ...S.microLabel, marginBottom: 16 }}>Operations Timeline</div>
            <div className="ohd-timeline" style={{ ['--steps' as string]: String(timeline.length) }}>
              {timeline.map((step, i) => (
                <div key={step.key} style={{ textAlign: 'center', position: 'relative', minWidth: 0 }}>
                  {i > 0 && (
                    <div
                      className="ohd-tl-conn"
                      style={{ background: step.done && timeline[i - 1].done ? ACCENT : '#F1F3F5' }}
                    />
                  )}
                  <div
                    style={{
                      position: 'relative',
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: step.done ? ACCENT : '#F1F3F5',
                      color: step.done ? '#fff' : '#9CA3AF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: 11,
                      margin: '0 auto 6px',
                    }}
                  >
                    {step.done ? '✓' : i + 1}
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 800, color: step.done ? '#111827' : '#9CA3AF' }}>
                    {step.label}
                  </div>
                  <div style={{ fontSize: 9, color: '#9CA3AF', fontWeight: 600, marginTop: 2 }}>
                    {step.ts ? formatDay(step.ts) : '—'}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ordered items */}
          <section style={{ ...S.card, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: ACCENT, letterSpacing: '0.03em' }}>
                {viewer.mode === 'seller' ? 'YOUR ORDERED ITEMS' : 'ORDERED ITEMS'}
              </div>
              <span style={{ ...S.microLabel }}>
                {subs.flatMap((s) => s.items || []).length} item(s)
              </span>
            </div>
            {subs.flatMap((s) => s.items || []).length === 0 ? (
              <div style={{ fontSize: 11.5, color: '#9CA3AF', fontStyle: 'italic', fontWeight: 600 }}>
                No line items in your scope for this order.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {subs.map((sub, si) =>
                  (sub.items || []).map((it) => {
                    const isDelivered = Boolean(it.deliveredAt);
                    const isMarking = markingItemId === it.itemId;
                    const lineTotal =
                      Number(it.price || 0) * Math.max(1, Math.floor(Number(it.quantity) || 1));
                    return (
                      <div
                        key={it.itemId}
                        style={{
                          display: 'flex',
                          gap: 16,
                          alignItems: 'flex-start',
                          padding: '16px 0',
                          borderTop: si === 0 && (sub.items || [])[0]?.itemId === it.itemId ? 'none' : '1px solid #F1F3F5',
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <ProductIdentityLink
                            size="lg"
                            productId={it.productId}
                            title={it.productTitle}
                            imageUrl={productThumbs.get(String(it.productId || ''))}
                            meta={[
                              it.productType || 'physical',
                              it.variantId ? `variant ${it.variantId}` : '',
                              it.serviceCategory || '',
                              it.productId ? `code ${it.productId}` : '',
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          />
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                            <span style={chipStyle()}>{sub.sellerBusinessName || sub.sellerId || 'Seller'}</span>
                            {sub.invoiceId && (
                              <span style={{ fontSize: 9.5, color: '#9CA3AF', fontWeight: 700 }}>Invoice {sub.invoiceId}</span>
                            )}
                            <span
                              style={{
                                fontSize: 9,
                                fontWeight: 800,
                                letterSpacing: '0.04em',
                                textTransform: 'uppercase',
                                color: isDelivered ? '#16A34A' : '#B45309',
                              }}
                            >
                              {isDelivered ? 'Delivered' : 'Awaiting delivery'}
                            </span>
                          </div>
                          {isDelivered && (
                            <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600 }}>
                              Delivered {formatDate(it.deliveredAt)}
                              {it.warrantyExpiresAt ? ` · warranty to ${formatDay(it.warrantyExpiresAt)}` : ''}
                            </div>
                          )}
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 800, color: '#111827' }}>
                            {formatCurrency(lineTotal)}
                          </div>
                          <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600 }}>
                            {formatCurrency(it.price)} × {it.quantity}
                          </div>
                          {!isDelivered && !perItemDeliveryLocked && (
                            <button
                              type="button"
                              disabled={isMarking}
                              onClick={() => void handleMarkDelivered(it.itemId)}
                              style={{
                                marginTop: 8,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                background: '#16A34A',
                                color: '#fff',
                                border: 'none',
                                borderRadius: 6,
                                padding: '6px 12px',
                                fontSize: 10,
                                fontWeight: 800,
                                textTransform: 'uppercase',
                                cursor: isMarking ? 'not-allowed' : 'pointer',
                                opacity: isMarking ? 0.6 : 1,
                              }}
                            >
                              {isMarking ? (
                                <Loader2 style={{ width: 12, height: 12 }} className="animate-spin" />
                              ) : (
                                <CheckCircle2 style={{ width: 12, height: 12 }} />
                              )}
                              {shipment.data?.fulfillmentMethod === 'pickup' ? 'Mark Collected' : 'Mark Delivered'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  }),
                )}
              </div>
            )}
          </section>

          {/* financial summary */}
          <section style={{ ...S.card, padding: 20 }}>
            <div style={{ ...S.microLabel, marginBottom: 14 }}>
              {viewer.mode === 'seller' ? 'Your financial summary' : 'Order financial summary'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
              <Row label={viewer.mode === 'seller' ? 'Your items subtotal' : 'Items subtotal'} value={formatCurrency(fin.itemsSubtotal)} />
              <Row label={viewer.mode === 'seller' ? 'Your delivery fees' : 'Delivery total'} value={formatCurrency(fin.deliveryTotal)} />
              {viewer.mode === 'admin' && typeof order.promoDiscount === 'number' && order.promoDiscount > 0 && (
                <Row label={`Promo${order.promoCode ? ` (${order.promoCode})` : ''}`} value={`− ${formatCurrency(order.promoDiscount)}`} />
              )}
              <div style={{ height: 1, background: '#F1F3F5', margin: '4px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#111827' }}>
                  {viewer.mode === 'seller' ? 'Your items value' : 'Whole-order total'}
                </span>
                <span style={{ fontSize: 15, fontWeight: 800, color: '#111827' }}>
                  {formatCurrency(viewer.mode === 'seller' ? fin.scopedTotal : fin.wholeOrderTotal)}
                </span>
              </div>
              {viewer.mode === 'seller' && (
                <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600 }}>
                  Items + delivery on your sub-order{subs.length === 1 ? '' : 's'}. Order-level promo and the
                  whole-order total are visible to platform staff only.
                  {others > 0 && ` This is a shared order with ${others} other seller${others > 1 ? 's' : ''}.`}
                </div>
              )}
            </div>
          </section>

          {/* order lifecycle */}
          <section style={{ ...S.card, padding: 20 }}>
            <div style={{ ...S.microLabel, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <ShieldCheck style={{ width: 13, height: 13 }} /> Order status / fulfillment lifecycle
            </div>
            {commerce.status === 'loading' && <Skeleton h={44} />}
            {commerce.status !== 'loading' && !lc.available && (
              <div style={{ fontSize: 11.5, color: '#9CA3AF', fontWeight: 600 }}>
                Lifecycle controls are not available for this order type (no linked commerce order —
                e.g. a service booking). Use per-item “Mark Delivered” above and the shipment controls
                below.
              </div>
            )}
            {commerce.status !== 'loading' && lc.available && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 700 }}>Current state</span>
                  {/* the derived hub status distinguishes Dispatched vs In transit vs
                      Ready for pickup (shipment- + fulfillment-aware) */}
                  <span style={lifecycleBadgeStyle(hubStatus)}>{hubStatusText}</span>
                  {/* raw Commerce-FSM term shown for staff transparency — hidden for
                      pickup, where "Shipped / In transit" would misrepresent it */}
                  {shipment.data?.fulfillmentMethod !== 'pickup' &&
                    commerceStatusLabel(lc.current || 'pending') !== hubStatusText && (
                      <span style={{ fontSize: 9.5, color: '#9CA3AF', fontWeight: 600 }}>
                        (commerce: {lc.currentLabel})
                      </span>
                    )}
                </div>

                {lc.exception && (
                  <div
                    style={{
                      ...S.inset,
                      padding: '10px 12px',
                      borderLeft: '3px solid #DC2626',
                      background: '#FEF2F2',
                      fontSize: 11.5,
                      color: '#991B1B',
                      fontWeight: 600,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                    }}
                  >
                    <span style={{ fontWeight: 800 }}>⚠ {lc.exception.label}</span>
                    <span style={{ color: '#B91C1C', fontWeight: 600 }}>
                      The courier reported this parcel as{' '}
                      {lc.exception.kind === 'returned' ? 'returned to sender' : 'undeliverable'}. Use
                      “Modify status ▾ → {lc.exception.kind === 'returned' ? 'Manage returned parcel' : 'Resolve failed delivery'}”
                      to open a Support / Returns request — do not mark it delivered.
                    </span>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', position: 'relative' }}>
                  {/* PRIMARY — label derives from canonical state */}
                  {lc.primaryAction ? (
                    <button
                      type="button"
                      disabled={lifecycleBusy}
                      onClick={() =>
                        lc.primaryAction!.requiresDispatchForm
                          ? (setDispatchErrors({}), setDispatchOpen(true))
                          : void handleTransition(lc.primaryAction!.to)
                      }
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        background: ACCENT,
                        color: '#fff',
                        border: 'none',
                        borderRadius: 6,
                        padding: '9px 16px',
                        fontSize: 10.5,
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        cursor: lifecycleBusy ? 'not-allowed' : 'pointer',
                        opacity: lifecycleBusy ? 0.6 : 1,
                      }}
                    >
                      {lifecycleBusy ? (
                        <Loader2 style={{ width: 12, height: 12 }} className="animate-spin" />
                      ) : (
                        <ArrowRight style={{ width: 12, height: 12 }} />
                      )}
                      {lc.primaryAction.label}
                    </button>
                  ) : (
                    <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600, alignSelf: 'center' }}>
                      {lc.terminal
                        ? 'This order has reached a terminal state — no forward action.'
                        : 'No forward action available.'}
                    </span>
                  )}

                  {/* SECONDARY — server-authorized corrections only */}
                  {lc.secondaryActions.length > 0 && (
                    <button
                      type="button"
                      disabled={lifecycleBusy}
                      onClick={() => {
                        setModifyOpen((v) => !v);
                        setPendingSecondary(null);
                        setSecondaryReason('');
                        setAdminMenuOpen(false);
                      }}
                      style={actionBtnStyle(false)}
                    >
                      Modify status ▾
                    </button>
                  )}

                  {/* ADMIN ACTIONS — Administrative Status Correction (staff only, explicit allow-list) */}
                  {canAdministrativelyCorrect(viewer) && lc.adminActions.length > 0 && (
                    <button
                      type="button"
                      disabled={lifecycleBusy}
                      onClick={() => {
                        setAdminMenuOpen((v) => !v);
                        setPendingAdmin(null);
                        setAdminReason('');
                        setModifyOpen(false);
                      }}
                      style={{ ...actionBtnStyle(false), color: '#7C3AED', borderColor: '#C4B5FD' }}
                    >
                      Admin actions ▾
                    </button>
                  )}

                  {adminMenuOpen && lc.adminActions.length > 0 && !pendingAdmin && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        right: 0,
                        marginTop: 6,
                        zIndex: 20,
                        background: '#fff',
                        border: '1px solid #E8EDF2',
                        borderRadius: 8,
                        boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
                        minWidth: 260,
                        overflow: 'hidden',
                      }}
                    >
                      <div style={{ ...S.microLabel, padding: '8px 14px', background: '#F9FAFB' }}>
                        Administrative status correction
                      </div>
                      {lc.adminActions.map((a) => (
                        <button
                          key={a.to}
                          type="button"
                          onClick={() => {
                            setPendingAdmin(a);
                            setAdminReason('');
                          }}
                          style={{
                            display: 'block',
                            width: '100%',
                            textAlign: 'left',
                            background: 'none',
                            border: 'none',
                            borderBottom: '1px solid #F1F3F5',
                            padding: '10px 14px',
                            fontSize: 11.5,
                            fontWeight: 700,
                            color: '#7C3AED',
                            cursor: 'pointer',
                          }}
                        >
                          {a.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {modifyOpen && lc.secondaryActions.length > 0 && !pendingSecondary && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: lc.primaryAction ? undefined : 0,
                        right: 0,
                        marginTop: 6,
                        zIndex: 20,
                        background: '#fff',
                        border: '1px solid #E8EDF2',
                        borderRadius: 8,
                        boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
                        minWidth: 220,
                        overflow: 'hidden',
                      }}
                    >
                      {lc.secondaryActions.map((a) => (
                        <button
                          key={a.kind}
                          type="button"
                          onClick={() => {
                            setPendingSecondary(a);
                            setSecondaryReason('');
                          }}
                          style={{
                            display: 'block',
                            width: '100%',
                            textAlign: 'left',
                            background: 'none',
                            border: 'none',
                            borderBottom: '1px solid #F1F3F5',
                            padding: '10px 14px',
                            fontSize: 11.5,
                            fontWeight: 700,
                            color: a.kind === 'return_to_pending' ? '#C2410C' : '#DC2626',
                            cursor: 'pointer',
                          }}
                        >
                          {a.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* confirm + reason for the chosen correction */}
                {pendingSecondary && (
                  <div style={{ ...S.inset, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 800, color: '#111827' }}>
                      {pendingSecondary.label}
                    </div>
                    {pendingSecondary.confirmNote && (
                      <div style={{ fontSize: 10.5, color: '#6B7280', fontWeight: 600 }}>
                        {pendingSecondary.confirmNote}
                      </div>
                    )}
                    <div style={S.microLabel}>Reason (required)</div>
                    <textarea
                      value={secondaryReason}
                      onChange={(e) => setSecondaryReason(e.target.value)}
                      rows={2}
                      placeholder={
                        pendingSecondary.kind === 'return_to_pending'
                          ? 'Why is this acceptance being reversed?'
                          : `Why is this order being ${pendingSecondary.kind === 'reject' ? 'rejected' : 'cancelled'}?`
                      }
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        border: '1px solid #E8EDF2',
                        borderRadius: 8,
                        padding: '8px 10px',
                        fontSize: 12,
                        resize: 'vertical',
                      }}
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        disabled={!secondaryReason.trim() || lifecycleBusy}
                        onClick={() => void runSecondary()}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          background: pendingSecondary.kind === 'return_to_pending' ? '#C2410C' : '#DC2626',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 6,
                          padding: '8px 14px',
                          fontSize: 10.5,
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          cursor: !secondaryReason.trim() || lifecycleBusy ? 'not-allowed' : 'pointer',
                          opacity: !secondaryReason.trim() || lifecycleBusy ? 0.5 : 1,
                        }}
                      >
                        {lifecycleBusy && <Loader2 style={{ width: 12, height: 12 }} className="animate-spin" />}
                        Confirm {pendingSecondary.label.toLowerCase()}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPendingSecondary(null);
                          setModifyOpen(false);
                        }}
                        style={actionBtnStyle(false)}
                      >
                        Keep as is
                      </button>
                    </div>
                  </div>
                )}

                {/* ADMIN CORRECTION — confirmation dialog (current → proposed + consequences + reason) */}
                {pendingAdmin && (
                  <div style={{ ...S.inset, padding: 12, display: 'flex', flexDirection: 'column', gap: 8, borderLeft: '3px solid #7C3AED' }}>
                    <div style={{ fontSize: 11.5, fontWeight: 800, color: '#111827' }}>
                      Administrative correction: <span style={{ color: '#7C3AED' }}>{lc.currentLabel} → {pendingAdmin.to}</span>
                    </div>
                    <div style={{ fontSize: 10.5, color: '#6B7280', fontWeight: 600 }}>{pendingAdmin.consequence}</div>
                    <div style={S.microLabel}>Correction reason (required — recorded with your user id + role)</div>
                    <textarea
                      value={adminReason}
                      onChange={(e) => setAdminReason(e.target.value)}
                      rows={2}
                      placeholder="Why is this correction being made?"
                      style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #E8EDF2', borderRadius: 8, padding: '8px 10px', fontSize: 12, resize: 'vertical' }}
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        disabled={!adminReason.trim() || lifecycleBusy}
                        onClick={() => void handleAdminCorrect()}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          background: '#7C3AED',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 6,
                          padding: '8px 14px',
                          fontSize: 10.5,
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          cursor: !adminReason.trim() || lifecycleBusy ? 'not-allowed' : 'pointer',
                          opacity: !adminReason.trim() || lifecycleBusy ? 0.5 : 1,
                        }}
                      >
                        {lifecycleBusy && <Loader2 style={{ width: 12, height: 12 }} className="animate-spin" />}
                        Confirm correction
                      </button>
                      <button type="button" onClick={() => { setPendingAdmin(null); setAdminMenuOpen(false); }} style={actionBtnStyle(false)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* DISPATCH DETAILS sheet — Processing/Packed → Dispatched */}
                {dispatchOpen && (
                  <div style={{ ...S.inset, padding: 14, display: 'flex', flexDirection: 'column', gap: 10, borderLeft: `3px solid ${ACCENT}` }}>
                    <div style={{ fontSize: 11.5, fontWeight: 800, color: '#111827' }}>Dispatch details</div>
                    <div style={{ fontSize: 10.5, color: '#6B7280', fontWeight: 600 }}>
                      The canonical shipment record is saved first; the order only moves to Dispatched if it succeeds.
                      Dispatched is not the same as In Transit — courier checkpoints advance that.
                    </div>

                    <div style={S.microLabel}>Fulfillment method</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {(['courier', 'seller_delivery', 'pickup'] as const).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => { setDispatchForm((f) => ({ ...f, fulfillmentMethod: m })); setDispatchErrors({}); }}
                          style={{
                            ...actionBtnStyle(dispatchForm.fulfillmentMethod === m),
                            fontSize: 10,
                          }}
                        >
                          {m === 'courier' ? 'Courier' : m === 'seller_delivery' ? 'Seller delivery' : 'Pickup'}
                        </button>
                      ))}
                    </div>

                    {dispatchForm.fulfillmentMethod === 'courier' && (
                      <>
                        <label style={{ display: 'block' }}>
                          <span style={S.microLabel}>Courier / logistics provider *</span>
                          <input
                            type="text"
                            value={dispatchForm.courier}
                            onChange={(e) => setDispatchForm((f) => ({ ...f, courier: e.target.value }))}
                            placeholder="e.g. Pathao, RedX, Sundarban"
                            style={{ ...S.input, width: '100%', marginTop: 4, borderColor: dispatchErrors.courier ? '#DC2626' : '#E8EDF2' }}
                          />
                          {dispatchErrors.courier && <span style={{ fontSize: 10, color: '#DC2626', fontWeight: 600 }}>{dispatchErrors.courier}</span>}
                        </label>
                        <label style={{ display: 'block' }}>
                          <span style={S.microLabel}>Tracking / consignment number *</span>
                          <input
                            type="text"
                            value={dispatchForm.trackingNumber}
                            onChange={(e) => setDispatchForm((f) => ({ ...f, trackingNumber: e.target.value }))}
                            placeholder="Courier consignment / AWB number"
                            style={{ ...S.input, width: '100%', marginTop: 4, borderColor: dispatchErrors.trackingNumber ? '#DC2626' : '#E8EDF2' }}
                          />
                          {dispatchErrors.trackingNumber && <span style={{ fontSize: 10, color: '#DC2626', fontWeight: 600 }}>{dispatchErrors.trackingNumber}</span>}
                        </label>
                        <label style={{ display: 'block' }}>
                          <span style={S.microLabel}>Tracking URL (optional)</span>
                          <input
                            type="text"
                            value={dispatchForm.trackingUrl}
                            onChange={(e) => setDispatchForm((f) => ({ ...f, trackingUrl: e.target.value }))}
                            placeholder="https://…"
                            style={{ ...S.input, width: '100%', marginTop: 4 }}
                          />
                        </label>
                      </>
                    )}

                    {dispatchForm.fulfillmentMethod === 'seller_delivery' && (
                      <label style={{ display: 'block' }}>
                        <span style={S.microLabel}>Delivery method / reference *</span>
                        <input
                          type="text"
                          value={dispatchForm.courier}
                          onChange={(e) => setDispatchForm((f) => ({ ...f, courier: e.target.value }))}
                          placeholder="e.g. Own rider — Rahim, or an internal reference"
                          style={{ ...S.input, width: '100%', marginTop: 4, borderColor: dispatchErrors.courier ? '#DC2626' : '#E8EDF2' }}
                        />
                        {dispatchErrors.courier && <span style={{ fontSize: 10, color: '#DC2626', fontWeight: 600 }}>{dispatchErrors.courier}</span>}
                        <span style={{ fontSize: 9.5, color: '#9CA3AF', fontWeight: 600 }}>No courier tracking number is required for own delivery.</span>
                      </label>
                    )}

                    {dispatchForm.fulfillmentMethod === 'pickup' && (
                      <div style={{ fontSize: 10.5, color: '#6B7280', fontWeight: 600 }}>
                        Customer pickup — no courier or tracking number required.
                      </div>
                    )}

                    <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
                      <label style={{ display: 'block' }}>
                        <span style={S.microLabel}>Estimated delivery (optional)</span>
                        <input
                          type="date"
                          value={dispatchForm.estimatedDelivery}
                          onChange={(e) => setDispatchForm((f) => ({ ...f, estimatedDelivery: e.target.value }))}
                          style={{ ...S.input, width: '100%', marginTop: 4 }}
                        />
                      </label>
                    </div>
                    <label style={{ display: 'block' }}>
                      <span style={S.microLabel}>Dispatch note (optional)</span>
                      <input
                        type="text"
                        value={dispatchForm.dispatchNote}
                        onChange={(e) => setDispatchForm((f) => ({ ...f, dispatchNote: e.target.value }))}
                        style={{ ...S.input, width: '100%', marginTop: 4 }}
                      />
                    </label>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        disabled={lifecycleBusy}
                        onClick={() => void handleDispatch()}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          background: ACCENT,
                          color: '#fff',
                          border: 'none',
                          borderRadius: 6,
                          padding: '9px 16px',
                          fontSize: 10.5,
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          cursor: lifecycleBusy ? 'not-allowed' : 'pointer',
                          opacity: lifecycleBusy ? 0.6 : 1,
                        }}
                      >
                        {lifecycleBusy ? <Loader2 style={{ width: 12, height: 12 }} className="animate-spin" /> : <ArrowRight style={{ width: 12, height: 12 }} />}
                        {dispatchForm.fulfillmentMethod === 'pickup' ? 'Confirm — ready for pickup' : 'Confirm dispatch'}
                      </button>
                      <button type="button" onClick={() => { setDispatchOpen(false); setDispatchErrors({}); }} style={actionBtnStyle(false)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                <div style={{ fontSize: 9.5, color: '#9CA3AF', fontWeight: 600 }}>
                  The primary action derives from the canonical current state; every transition and
                  correction is re-validated server-side (allowed-transition + role + ownership).
                  {viewer.mode === 'seller'
                    ? ' You can drive your own order forward, cancel it until it is packed, and return an accidental acceptance to Pending while nothing has shipped. After dispatch, a status correction must go through Choosify Support.'
                    : ' Staff drive legitimate transitions; Administrative Status Correction is an explicit allow-list (never a free status setter) and every correction is recorded with a reason + actor + role.'}
                </div>
              </div>
            )}
          </section>

          {/* internal notes (staff only) */}
          {staff && (
            <section style={{ ...S.card, padding: 20 }}>
              <div style={{ ...S.microLabel, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <StickyNote style={{ width: 13, height: 13 }} /> Internal notes
                <span style={{ ...chipStyle(), marginLeft: 4 }}>Staff only</span>
              </div>
              {notes.status === 'loading' && <Skeleton h={40} />}
              {notes.status === 'error' && (
                <div style={{ fontSize: 11, color: '#DC2626', fontWeight: 600 }}>{notes.error}</div>
              )}
              {notes.status === 'ok' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {notes.data.length === 0 && (
                    <div style={{ fontSize: 11.5, color: '#9CA3AF', fontWeight: 600 }}>No internal notes yet.</div>
                  )}
                  {notes.data.map((n) => (
                    <div key={n.id} style={{ ...S.inset, padding: '10px 12px' }}>
                      <div style={{ fontSize: 12, color: '#374151', fontWeight: 600, whiteSpace: 'pre-wrap' }}>
                        {n.body}
                      </div>
                      <div style={{ fontSize: 9.5, color: '#9CA3AF', fontWeight: 700, marginTop: 4 }}>
                        {n.authorName} · {n.authorRole} · {formatDate(n.createdAt)}
                      </div>
                    </div>
                  ))}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <textarea
                      value={noteDraft}
                      onChange={(e) => setNoteDraft(e.target.value)}
                      rows={2}
                      placeholder="Add a private staff note (never shown to the buyer or seller)…"
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        border: '1px solid #E8EDF2',
                        borderRadius: 8,
                        padding: '8px 10px',
                        fontSize: 12,
                        resize: 'vertical',
                      }}
                    />
                    <button
                      type="button"
                      disabled={!noteDraft.trim() || noteBusy}
                      onClick={() => void handleAddNote()}
                      style={{
                        alignSelf: 'flex-start',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        background: ACCENT,
                        color: '#fff',
                        border: 'none',
                        borderRadius: 6,
                        padding: '8px 14px',
                        fontSize: 10.5,
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        cursor: !noteDraft.trim() || noteBusy ? 'not-allowed' : 'pointer',
                        opacity: !noteDraft.trim() || noteBusy ? 0.5 : 1,
                      }}
                    >
                      {noteBusy ? <Loader2 style={{ width: 12, height: 12 }} className="animate-spin" /> : null}
                      Add note
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* logistics & fulfillment */}
          <section style={{ ...S.card, padding: 20 }}>
            <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 14, color: '#111827' }}>
              🚚 Logistics &amp; Fulfillment
            </div>

            <div style={{ ...S.microLabel, marginBottom: 8 }}>Seller sub-orders — dispatch &amp; tracking</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {subs.map((s, i) => (
                <div
                  key={`${s.sellerId}-${i}`}
                  style={{ ...S.inset, padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}
                >
                  <div>
                    <div style={{ fontSize: 11.5, fontWeight: 800, color: '#111827' }}>
                      {s.sellerBusinessName || s.sellerId}
                    </div>
                    <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 700 }}>
                      Tracking {(s.trackingStatus || 'pending').toUpperCase()} · Delivery fee {formatCurrency(s.deliveryFee)}
                    </div>
                  </div>
                </div>
              ))}
              {subs.length === 0 && (
                <div style={{ fontSize: 11, color: '#9CA3AF', fontStyle: 'italic', fontWeight: 600 }}>
                  No sub-orders in your scope.
                </div>
              )}
            </div>

            <div style={{ ...S.microLabel, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Truck style={{ width: 13, height: 13 }} /> Shipment
            </div>
            {shipment.status === 'loading' && <Skeleton h={70} />}
            {shipment.status === 'ok' && !shipment.data && (
              <div style={{ fontSize: 12, color: '#9CA3AF' }}>
                No shipment record for this order yet. It is created once fulfillment begins.
              </div>
            )}
            {shipment.status === 'ok' && shipment.data && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                  <label style={{ display: 'block' }}>
                    <span style={S.microLabel}>Courier</span>
                    <input
                      type="text"
                      value={trackingDraft.courier}
                      onChange={(e) => {
                        trackingTouched.current = true;
                        setTrackingDraft((d) => ({ ...d, courier: e.target.value }));
                      }}
                      placeholder="e.g. Pathao, RedX"
                      style={{ ...S.input, width: '100%', marginTop: 4 }}
                    />
                  </label>
                  <label style={{ display: 'block' }}>
                    <span style={S.microLabel}>Tracking #</span>
                    <input
                      type="text"
                      value={trackingDraft.trackingNumber}
                      onChange={(e) => {
                        trackingTouched.current = true;
                        setTrackingDraft((d) => ({ ...d, trackingNumber: e.target.value }));
                      }}
                      placeholder="Courier consignment number"
                      style={{ ...S.input, width: '100%', marginTop: 4 }}
                    />
                  </label>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    disabled={
                      savingTracking ||
                      (trackingDraft.courier.trim() === (shipment.data.courier || '') &&
                        trackingDraft.trackingNumber.trim() === (shipment.data.trackingNumber || ''))
                    }
                    onClick={() => void handleSaveTracking()}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      background: ACCENT,
                      color: '#fff',
                      border: 'none',
                      borderRadius: 6,
                      padding: '9px 16px',
                      fontSize: 10.5,
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      opacity:
                        savingTracking ||
                        (trackingDraft.courier.trim() === (shipment.data.courier || '') &&
                          trackingDraft.trackingNumber.trim() === (shipment.data.trackingNumber || ''))
                          ? 0.5
                          : 1,
                    }}
                  >
                    {savingTracking ? (
                      <Loader2 style={{ width: 12, height: 12 }} className="animate-spin" />
                    ) : (
                      <Truck style={{ width: 12, height: 12 }} />
                    )}
                    Save tracking changes
                  </button>
                  <span style={{ fontSize: 12 }}>
                    <span style={{ color: '#9CA3AF' }}>Shipment state: </span>
                    <span style={{ fontWeight: 800, color: '#111827' }}>
                      {shipmentStatusLabel(shipment.data.status, shipment.data.fulfillmentMethod)}
                    </span>
                    <span style={{ fontSize: 10, color: '#9CA3AF' }}>
                      {' · '}
                      {shipment.data.fulfillmentMethod === 'pickup'
                        ? shipment.data.status === 'delivered'
                          ? 'collected by the customer'
                          : 'awaiting customer collection'
                        : shipment.data.status === 'awaiting_dispatch'
                          ? 'no courier assigned yet'
                          : shipment.data.status === 'dispatched'
                            ? 'handed to courier — not yet moving (In Transit follows a checkpoint)'
                            : 'courier webhook-driven'}
                    </span>
                  </span>
                </div>
                {(shipment.data.dispatchedAt || shipment.data.fulfillmentMethod || shipment.data.estimatedDelivery) && (
                  <div style={{ ...S.inset, padding: '8px 10px', fontSize: 11, color: '#374151', fontWeight: 600, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {shipment.data.fulfillmentMethod && (
                      <div>Method: <b style={{ textTransform: 'capitalize' }}>{shipment.data.fulfillmentMethod.replace('_', ' ')}</b></div>
                    )}
                    {shipment.data.dispatchedAt && (
                      <div>
                        {shipment.data.fulfillmentMethod === 'pickup' ? 'Ready for pickup: ' : 'Dispatched: '}
                        {formatDate(shipment.data.dispatchedAt)}
                      </div>
                    )}
                    {shipment.data.estimatedDelivery && <div>Estimated delivery: {formatDay(shipment.data.estimatedDelivery)}</div>}
                    {shipment.data.trackingUrl && (
                      <a href={shipment.data.trackingUrl} target="_blank" rel="noopener noreferrer" style={{ color: ACCENT, fontWeight: 700 }}>
                        Track shipment ↗
                      </a>
                    )}
                    {shipment.data.dispatchNote && <div style={{ color: '#6B7280' }}>Note: {shipment.data.dispatchNote}</div>}
                  </div>
                )}
                <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 600 }}>
                  Fulfillment: {fx === 'delivered' ? 'all items delivered' : fx === 'partial' ? 'partially delivered' : fx === 'awaiting' ? 'awaiting delivery' : 'no physical items'}
                </div>
                {shipment.data.trackingEvents && shipment.data.trackingEvents.length > 0 && (
                  <div>
                    <div style={{ ...S.microLabel, marginBottom: 6 }}>Checkpoint history</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {shipment.data.trackingEvents.map((ev) => (
                        <div
                          key={ev.id}
                          style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 11, paddingBottom: 6, borderBottom: '1px solid #F1F3F5' }}
                        >
                          <span style={{ color: '#111827', fontWeight: 700 }}>
                            {ev.description}
                            {ev.location ? ` · ${ev.location}` : ''}
                          </span>
                          <span style={{ color: '#9CA3AF', whiteSpace: 'nowrap' }}>{formatDate(ev.timestamp)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          {order.shipping?.deliveryNotes && (
            <section style={{ ...S.card, padding: 20 }}>
              <div style={{ ...S.microLabel, marginBottom: 8 }}>Customer instructions</div>
              <div style={{ ...S.inset, padding: '10px 12px', fontSize: 12, color: '#374151', fontWeight: 600 }}>
                💬 {order.shipping.deliveryNotes}
              </div>
            </section>
          )}
        </div>

        {/* ── right rail ───────────────────────────────────────────────── */}
        <div className="ohd-col">
          {/* customer */}
          <section style={{ ...S.card, padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: ACCENT, marginBottom: 14 }}>CUSTOMER / RECEIVER</div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: '50%',
                  background: '#EFF6FF',
                  color: '#2563EB',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  flexShrink: 0,
                }}
              >
                {(customer.data?.displayName || order.shipping?.fullName || order.buyerId || '?').charAt(0).toUpperCase()}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#111827' }}>
                  {customer.data?.displayName || order.shipping?.fullName || '—'}
                </div>
                <div style={{ fontSize: 10.5, color: '#9CA3AF', fontWeight: 600 }}>
                  {customer.status === 'loading' ? 'loading…' : customer.data?.cfId ? `CF-ID ${customer.data.cfId}` : `Buyer ID ${order.buyerId}`}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11.5 }}>
              {customer.data?.email && <KV k="Email" v={customer.data.email} />}
              {order.shipping && (
                <>
                  <KV k="Phone" v={order.shipping.phone} />
                  <KV k="Deliver to" v={`${order.shipping.address}, ${order.shipping.region}`} />
                </>
              )}
              {!order.shipping && (
                <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600 }}>
                  No shipping address on this order (manual / service order).
                </div>
              )}
              {viewer.mode === 'seller' && customer.data?.relationship && (
                <>
                  <div style={{ height: 1, background: '#F1F3F5', margin: '4px 0' }} />
                  <KV k="With your business" v={`${customer.data.relationship.totalOrders} order(s) · ${formatCurrency(customer.data.relationship.totalSpend)}`} />
                  {customer.data.relationship.segment && <KV k="Segment" v={customer.data.relationship.segment} />}
                </>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <Link to={viewCustomerPath(viewer, order.buyerId)} style={{ ...actionBtnStyle(false), flex: 1, justifyContent: 'center' }}>
                View customer
              </Link>
              <Link to={conversationDeepLink(order.buyerId)} style={{ ...actionBtnStyle(false), flex: 1, justifyContent: 'center' }}>
                <MessageSquare style={{ width: 13, height: 13 }} /> Conversation
              </Link>
            </div>
            <div style={{ fontSize: 9.5, color: '#9CA3AF', fontWeight: 600, marginTop: 8 }}>
              Transaction-context only. Conversation opens the canonical buyer↔seller order thread (System&nbsp;B).
            </div>
          </section>

          {/* payment / order context */}
          <section style={{ ...S.card, padding: 20 }}>
            <div style={{ ...S.microLabel, marginBottom: 12 }}>Payment &amp; order context</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11.5 }}>
              <KV k="Method" v={order.paymentMethod || '—'} />
              <KV k="Payment status" v={order.paymentStatus || '—'} />
              {typeof order.paidAmount === 'number' && <KV k="Paid amount" v={formatCurrency(order.paidAmount)} />}
              {order.paidAt && <KV k="Paid at" v={formatDate(order.paidAt)} />}
              {order.paymentDueAt && !order.paidAt && <KV k="Payment due" v={formatDate(order.paymentDueAt)} />}
              {order.isCOD && <KV k="COD" v={order.codDeliveryFeePaid ? 'delivery fee prepaid' : 'collect at door'} />}
              {order.paymentProvider && <KV k="Provider" v={order.paymentProvider} />}
              <div style={{ height: 1, background: '#F1F3F5', margin: '4px 0' }} />
              <KV k="Placed" v={formatDate(order.createdAt)} />
              <KV k="Updated" v={formatDate(order.updatedAt)} />
              {order.isManual && <KV k="Source" v={order.platformSource ? `Manual · ${order.platformSource}` : 'Manual'} />}
              {order.claimedByName && <KV k="Claimed by" v={order.claimedByName} />}
            </div>
          </section>

          {/* returns */}
          <section style={{ ...S.card, padding: 20 }}>
            <div style={{ ...S.microLabel, marginBottom: 12 }}>Returns &amp; issues</div>
            {returns.status === 'loading' && <Skeleton h={28} />}
            {returns.status === 'ok' && returns.data.length === 0 && (
              <div style={{ fontSize: 11.5, color: '#9CA3AF', fontWeight: 600 }}>No return request for this order.</div>
            )}
            {returns.status === 'ok' && returns.data.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 11.5 }}>
                {returns.data.map((r) => (
                  <div key={r.id} style={{ ...S.inset, padding: '8px 10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontWeight: 700, color: '#111827', textTransform: 'capitalize' }}>
                        {r.reason.replace(/_/g, ' ')}
                      </span>
                      <span style={{ fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase' }}>{r.status}</span>
                    </div>
                    <div style={{ fontSize: 9.5, color: '#9CA3AF', fontWeight: 600, marginTop: 2 }}>Request {r.id}</div>
                  </div>
                ))}
              </div>
            )}
            <Link to="/admin/returns" style={{ ...actionBtnStyle(false), marginTop: 12, width: '100%', justifyContent: 'center' }}>
              Go to Returns &amp; Refunds <ExternalLink style={{ width: 11, height: 11 }} />
            </Link>
          </section>

          {/* operational metadata */}
          <section style={{ ...S.card, padding: 20 }}>
            <div style={{ ...S.microLabel, marginBottom: 12 }}>Operational metadata</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11 }}>
              <KV k="Order ID" v={order.orderId} />
              {commerce.data && (
                <KV
                  k="Commerce ref"
                  v={`${commerce.data.id} · ${
                    shipment.data?.fulfillmentMethod === 'pickup' && commerce.data.status === 'shipped'
                      ? 'Handed over (pickup)'
                      : commerceStatusLabel(commerce.data.status)
                  }`}
                />
              )}
              <KV k="Sub-orders (your scope)" v={String(subs.length)} />
              {viewer.mode === 'seller' && others > 0 && <KV k="Other sellers on order" v={String(others)} />}
              <KV k="Split order" v={isMultiSeller(order) ? 'yes' : 'no'} />
              {order.promoCode && <KV k="Promo code" v={order.promoCode} />}
              {order.paymentTranId && <KV k="Txn ID" v={order.paymentTranId} />}
            </div>
          </section>
        </div>
      </div>

      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 32,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '12px 24px',
            borderRadius: 12,
            boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
            fontWeight: 700,
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            zIndex: 600,
            color: '#fff',
            background: toast.kind === 'success' ? '#16A34A' : '#DC2626',
          }}
        >
          {toast.kind === 'success' ? (
            <CheckCircle2 style={{ width: 18, height: 18 }} />
          ) : (
            <AlertCircle style={{ width: 18, height: 18 }} />
          )}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}

function CommandBar({ orderId, onBack }: { orderId: string; onBack: () => void }) {
  return (
    <div style={{ ...S.card, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
      <button
        type="button"
        onClick={onBack}
        aria-label="Back to Order Hub"
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          border: '1px solid #E8EDF2',
          background: '#fff',
          cursor: 'pointer',
          color: '#374151',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ArrowLeft style={{ width: 15, height: 15 }} />
      </button>
      <div>
        <div style={{ ...S.microLabel, letterSpacing: '0.05em' }}>Back to Order Hub</div>
        <div style={{ fontSize: 14.5, fontWeight: 800, marginTop: 2, color: '#111827' }}>
          Order Details: <span style={{ color: ACCENT }}>#{orderId}</span>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, minWidth: 0 }}>
      <span style={{ color: '#6B7280', fontWeight: 600 }}>{label}</span>
      <span style={{ color: '#111827', fontWeight: 800, overflowWrap: 'anywhere' }}>{value}</span>
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, minWidth: 0 }}>
      <span style={{ color: '#9CA3AF', fontWeight: 600, flexShrink: 0 }}>{k}</span>
      <span style={{ color: '#111827', fontWeight: 700, textAlign: 'right', overflowWrap: 'anywhere', minWidth: 0 }}>{v}</span>
    </div>
  );
}
