import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useInventory } from './InventoryContext';
import { useCoupons } from './CouponsContext';
import { commerceApi } from '../services/commerceApi';
import {
  getAuthToken,
  mapCommerceOrderToUi,
  type CommerceOrderDto,
  type CommerceShipmentDto,
} from '../lib/commerceOrderAdapter';
import { messagingApi, type ApiConversation, type ApiMessage } from '../services/messagingApi';

/**
 * OrdersContext — presentation/cache layer for Order Hub UI.
 *
 * Sprint 6: When the user is authenticated, Commerce Order API is the
 * authoritative source. localStorage `choosify_orders` is legacy/demo only and
 * is not written while commerceAuthoritative is true.
 *
 * Sprint 9: Platform message threads hydrate from /api/v1/conversations when
 * authenticated. Demo choosify_threads must not masquerade as real Conversations.
 */

export type OrderStatus = 'Pending' | 'Confirmed' | 'Dispatched' | 'In Transit' | 'Delivered' | 'Cancelled' | 'Rejected' | 'Returned' | 'Exchange' | 'Processing';
export type PaymentStatus = 'Pending' | 'Paid' | 'Refunded' | 'Failed' | 'Partial' | 'COD Due';
export type CustomerBehavior = 'Good' | 'Neutral' | 'Risk';

export interface Review {
  id: string;
  user: string;
  product: string;
  store: string;
  rating: number;
  comment: string;
  status: 'pending' | 'approved' | 'rejected' | 'Flagged' | 'Published' | 'Deleted' | 'Hidden';
  reports: number;
  flags?: string[];
  response?: {
    id: string;
    author: string;
    comment: string;
    timestamp: string;
  };
  isAuthentic?: boolean;
  authenticityScore?: number;
  authenticityReason?: string;
  notes?: string;
  timestamp: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  avatar: string;
  behavior: CustomerBehavior;
  flagged: boolean;
  flagReason?: string;
  history: { timestamp: string; action: string; note: string }[];
}

export interface OrderProduct {
  id: string;
  name: string;
  brand: string;
  price: number; // in raw currency BDT
  image: string;
  sellerId: string;
  sellerName: string;
  productType?: 'physical' | 'service';
  serviceCategory?: string;
  serviceDetails?: Record<string, string | number>;
}

export interface Order {
  id: string;
  product: OrderProduct;
  customer: Customer;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  timestamp: string;
  approveTime?: string;
  dispatchTime?: string;
  deliverTime?: string;
  cancelTime?: string;
  cancelReason?: string;
  declineReason?: string;
  deliveryPartner?: string;
  trackingUrl?: string;
  customerNotes?: string[];
  sellerNotes?: string[];
  earnings: {
    totalRevenue: number;
    commissionPercent: number; // default e.g. 10
    futureAutomatedDeduction: number; // commission BDT
    sellerNet: number; // totalRevenue - commission BDT
  };
  base_product_price?: number;
  delivery_charge?: number;
  total_payable?: number;
  invoice_id?: string;
  invoice_status?: 'Paid' | 'Unpaid' | 'Refunded' | 'Partial';
  confirmation_timestamp?: string;
  isManual?: boolean;
  platformSource?: 'WhatsApp' | 'Facebook' | 'Instagram' | 'Offline';
  chatRefId?: string;
  quantity?: number;
  subOrders?: {
    sellerId: string;
    sellerName: string;
    trackingStatus: 'pending' | 'dispatched' | 'transit' | 'delivered' | 'cancelled';
  }[];
  adminNotes?: string[];
  codCollected?: boolean;
  promoCode?: string;
  promoDiscount?: number;
  /** Commerce checkout grouping (presentation); SoT remains server Order.checkoutId */
  checkoutId?: string;
  brandId?: string;
  commerceStatus?: string;
  commerceSource?: string;
  shipmentId?: string;
  /** Set on manual orders — the token embedded in confirmOrderUrl, cleared once claimed */
  claimToken?: string;
  /** Customer-facing "View & Confirm Order" link sent to the buyer's chat (Choosify-Web) */
  confirmOrderUrl?: string;
}

export interface ThreadMessage {
  id: string;
  senderName: string;
  senderRole: 'customer' | 'seller' | 'admin';
  text: string;
  timestamp: string;
  bookingOffer?: import('../../shared/booking/bookingTypes').BookingOfferCard;
}

export interface MessageThread {
  id: string; 
  orderId?: string;
  customer: Customer;
  product?: OrderProduct;
  subject: string;
  preview: string;
  messages: ThreadMessage[];
  status: 'UNREAD' | 'READ' | 'RESPONDED';
  time: string;
}

interface OrdersContextType {
  orders: Order[];
  customers: Customer[];
  messageThreads: MessageThread[];
  /** True when list is loaded from Commerce API (not localStorage demo). */
  commerceAuthoritative: boolean;
  /** True when platform threads are loaded from Messaging API. */
  messagingAuthoritative: boolean;
  refreshMessageThreads: () => Promise<void>;
  ordersLoading: boolean;
  ordersError: string | null;
  refreshOrders: () => Promise<void>;
  approveOrder: (orderId: string, deliveryChargeNum?: number, note?: string) => void;
  declineOrder: (orderId: string, reason: string) => void;
  cancelOrder: (orderId: string, reason: string) => void;
  dispatchOrder: (orderId: string, deliveryPartner: string, trackingUrl: string) => void;
  addCustomerNotes: (orderId: string, note: string) => void;
  addSellerNotes: (orderId: string, note: string) => void;
  updateOrderStatus: (orderId: string, status: OrderStatus) => void;
  flagCustomer: (customerId: string, flagged: boolean, reason: string) => void;
  sendChatMessage: (threadId: string, text: string, senderRole: 'customer' | 'seller' | 'admin', senderName: string) => void;
  createOrderNow: (product: OrderProduct, customerMsg: string, promoCode?: string, promoDiscount?: number) => void;
  createManualOrder: (params: {
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    customerAddress: string;
    platformSource: 'WhatsApp' | 'Facebook' | 'Instagram' | 'Offline';
    chatRefId?: string;
    product: OrderProduct;
    quantity: number;
    priceOverride?: number;
    notes?: string;
    promoCode?: string;
    promoDiscount?: number;
  }) => Promise<{ orderId: string; invoiceId: string; confirmOrderUrl?: string } | null>;
  markAllThreadsAsRead: () => void;
  markThreadAsRead: (threadId: string) => void;
  updateOrderTrackingStatus: (orderId: string, sellerId: string, newStatus: 'pending' | 'dispatched' | 'transit' | 'delivered' | 'cancelled') => void;
  addAdminNote: (orderId: string, note: string) => void;
  updateCodCollected: (orderId: string, collected: boolean) => void;
}

const OrdersContext = createContext<OrdersContextType | undefined>(undefined);

export const useOrders = () => {
  const context = useContext(OrdersContext);
  if (!context) throw new Error('useOrders must be used within an OrdersProvider');
  return context;
};

// Raw initial mock data for orders
const initialProducts: OrderProduct[] = [
  { id: '101', name: 'Aarong Silk Panjabi', brand: 'Aarong', price: 4200, image: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=400&q=80', sellerId: 'seller_001', sellerName: 'Aarong Digital' },
  { id: '102', name: 'Apex Mens Formal Leather', brand: 'Apex', price: 3500, image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=80', sellerId: 'seller_001', sellerName: 'Apex Shoes' },
  { id: '103', name: 'Samsung S25 Ultra', brand: 'Samsung BD', price: 139999, image: 'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=400&q=80', sellerId: 'seller_002', sellerName: 'TechZone BD' },
  { id: '104', name: 'Walton 2-Door Fridge', brand: 'Walton', price: 29990, image: 'https://images.unsplash.com/photo-1571175432247-fe0320b5da22?w=400&q=80', sellerId: 'seller_002', sellerName: 'ElectroBD' },
];

const initialCustomers: Customer[] = [
  {
    id: 'cust_001',
    name: 'Farhan Bin Rafiq',
    email: 'farhanbinrafiq@gmail.com',
    avatar: 'FR',
    behavior: 'Good',
    flagged: false,
    history: [
      { timestamp: '2026-05-18T10:00:00Z', action: 'Order Placed', note: 'Aarong Silk Panjabi approved and received' }
    ]
  },
  {
    id: 'cust_002',
    name: 'Mehedi Rahman',
    email: 'mehedi@yahoo.com',
    avatar: 'MR',
    behavior: 'Neutral',
    flagged: false,
    history: []
  },
  {
    id: 'cust_003',
    name: 'Nadia Akter',
    email: 'nadia@hotmail.com',
    avatar: 'NA',
    behavior: 'Risk',
    flagged: true,
    flagReason: 'High order cancellation rate and duplicate booking spam',
    history: [
      { timestamp: '2026-05-15T08:30:00Z', action: 'Flagged', note: 'Restricted for spamming checkout 4 times in 1 hour.' }
    ]
  },
  {
    id: 'cust_004',
    name: 'Sifat Tanvir',
    email: 'sifat@tech.com',
    avatar: 'ST',
    behavior: 'Good',
    flagged: false,
    history: []
  },
  {
    id: 'cust_005',
    name: 'Sultana R.',
    email: 'sultana@outlook.com',
    avatar: 'SR',
    behavior: 'Risk',
    flagged: false,
    history: []
  }
];

const createEarnings = (price: number) => {
  const commPercent = 10;
  const commission = Math.round(price * (commPercent / 100));
  return {
    totalRevenue: price,
    commissionPercent: commPercent,
    futureAutomatedDeduction: commission,
    sellerNet: price - commission
  };
};

const initialOrders: Order[] = [];

export const OrdersProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { allocateStock, deallocateStock, logStockChange } = useInventory();
  const { applyCoupon } = useCoupons();
  const [commerceAuthoritative, setCommerceAuthoritative] = useState(false);
  const [messagingAuthoritative, setMessagingAuthoritative] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>(() => {
    // Demo/legacy bootstrap only — replaced by Commerce API when authenticated.
    const saved = localStorage.getItem('choosify_orders');
    if (!saved) return initialOrders;
    try {
      const parsed = JSON.parse(saved);
      return (Array.isArray(parsed) ? parsed : []).map((o: any) => ({
        ...o,
        subOrders: o.subOrders || [
          {
            sellerId: o.product?.sellerId,
            sellerName: o.product?.sellerName,
            trackingStatus: o.trackingStatus || 'pending',
          },
        ],
        adminNotes: o.adminNotes || [],
        codCollected: o.codCollected !== undefined ? o.codCollected : false,
      }));
    } catch {
      return initialOrders;
    }
  });

  const refreshOrders = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      setCommerceAuthoritative(false);
      return;
    }
    setOrdersLoading(true);
    setOrdersError(null);
    try {
      const listed = await commerceApi.listOrders(token, { byCheckout: true });
      if (!listed.ok) {
        setOrdersError(
          (listed.body as { error?: string })?.error || `Failed to load orders (${listed.status})`,
        );
        setOrdersLoading(false);
        return;
      }
      const rows = (listed.body as { data?: CommerceOrderDto[] }).data || [];
      const mapped: Order[] = rows.map((row) => mapCommerceOrderToUi(row, null));
      setOrders(mapped);
      setCommerceAuthoritative(true);
      try {
        localStorage.removeItem('choosify_orders');
      } catch {
        /* ignore */
      }
    } catch (err) {
      setOrdersError(err instanceof Error ? err.message : 'Failed to load Commerce Orders');
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshOrders();
    const onFocus = () => {
      void refreshOrders();
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refreshOrders]);

  const patchOrderFromCommerce = async (orderId: string) => {
    const token = getAuthToken();
    if (!token) return;
    const res = await commerceApi.getOrder(token, orderId);
    if (!res.ok) return;
    const row = (res.body as { data?: CommerceOrderDto }).data;
    if (!row) return;
    let shipment: CommerceShipmentDto | null = null;
    const shipRes = await commerceApi.getOrderShipment(token, orderId);
    if (shipRes.ok) shipment = (shipRes.body as { data?: CommerceShipmentDto }).data || null;
    const mapped = mapCommerceOrderToUi(row, shipment);
    setOrders((prev) => {
      const idx = prev.findIndex((o) => o.id === orderId);
      if (idx < 0) return [mapped, ...prev];
      const next = [...prev];
      next[idx] = { ...prev[idx], ...mapped, adminNotes: prev[idx].adminNotes, customerNotes: prev[idx].customerNotes, sellerNotes: prev[idx].sellerNotes };
      return next;
    });
  };

  const runCommerceTransition = async (
    orderId: string,
    status: string,
    extra?: Record<string, unknown>,
  ): Promise<{ ok: boolean; error?: string }> => {
    const token = getAuthToken();
    if (!token) return { ok: false, error: 'Not authenticated' };
    const res = await commerceApi.transitionOrder(token, orderId, {
      status: status as 'confirmed' | 'packed' | 'shipped' | 'delivered' | 'completed',
      ...extra,
    });
    if (!res.ok) {
      const err = (res.body as { error?: string })?.error || `Transition failed (${res.status})`;
      setOrdersError(err);
      return { ok: false, error: err };
    }
    await patchOrderFromCommerce(orderId);
    return { ok: true };
  };

  const runCommerceCancel = async (
    orderId: string,
    reason: string,
  ): Promise<{ ok: boolean; error?: string }> => {
    const token = getAuthToken();
    if (!token) return { ok: false, error: 'Not authenticated' };
    const res = await commerceApi.cancelOrder(token, orderId, reason);
    if (!res.ok) {
      const err = (res.body as { error?: string })?.error || `Cancel failed (${res.status})`;
      setOrdersError(err);
      return { ok: false, error: err };
    }
    await patchOrderFromCommerce(orderId);
    return { ok: true };
  };

  const [customers, setCustomers] = useState<Customer[]>(() => {
    const saved = localStorage.getItem('choosify_customers');
    return saved ? JSON.parse(saved) : initialCustomers;
  });

  const [messageThreads, setMessageThreads] = useState<MessageThread[]>(() => {
    // Demo fixtures are isolated: only hydrate from localStorage when unauthenticated.
    if (getAuthToken()) return [];
    const saved = localStorage.getItem('choosify_threads');
    if (saved) {
      try {
        return JSON.parse(saved) as MessageThread[];
      } catch {
        /* fall through */
      }
    }

    // Bootstrap demo threads from orders (preview only — not Messaging SoT)
    return [
      {
        id: 'thread_CSS-9921',
        orderId: 'CSS-9921',
        customer: initialCustomers[0],
        product: initialProducts[0],
        subject: 'Order #CSS-9921 Aarong Silk Panjabi Spec Inquiry',
        preview: 'Our delivery agent is assigned on Pathao Delivery.',
        status: 'RESPONDED',
        time: '52 min ago',
        messages: [
          { id: 'm1', senderName: 'Farhan Bin Rafiq', senderRole: 'customer', text: 'Assalamu alaikum. Can I get immediate delivery of Aarong Panjabi?', timestamp: '2026-05-20T01:15:00Z' },
          { id: 'm2', senderName: 'Aarong Digital', senderRole: 'seller', text: 'Walaikum Assalam! Yes, our driver has been scheduled via Pathao.', timestamp: '2026-05-20T04:30:00Z' }
        ]
      },
      {
        id: 'thread_CSS-9844',
        orderId: 'CSS-9844',
        customer: initialCustomers[0],
        product: initialProducts[1],
        subject: 'Order #CSS-9844 Size Check Request',
        preview: 'Hi, I purchased the Apex Men Leather. Please check the sizes before packing.',
        status: 'UNREAD',
        time: '14 min ago',
        messages: [
          { id: 'm3', senderName: 'Farhan Bin Rafiq', senderRole: 'customer', text: 'Hi, I purchased the Apex Men Leather. Please check the sizes before packing.', timestamp: '2026-05-20T08:45:00Z' }
        ]
      }
    ];
  });

  const mapApiMessages = (rows: ApiMessage[]): ThreadMessage[] =>
    rows.map((m) => ({
      id: m.id,
      senderName: m.senderRole,
      senderRole:
        m.senderRole === 'consumer'
          ? 'customer'
          : m.senderRole === 'admin'
            ? 'admin'
            : 'seller',
      text: m.body,
      timestamp: m.createdAt,
    }));

  const mapApiConversation = async (c: ApiConversation): Promise<MessageThread> => {
    let messages: ThreadMessage[] = [];
    try {
      messages = mapApiMessages(await messagingApi.listMessages(c.id));
    } catch {
      messages = [];
    }
    const subject =
      c.orderId
        ? `Order ${c.orderId}`
        : c.bookingRequestId
          ? `Booking ${c.bookingRequestId}`
          : `${c.contextType} conversation`;
    return {
      id: c.id,
      orderId: c.orderId,
      customer: {
        id: c.consumerId,
        name: `Consumer ${c.consumerId.slice(0, 8)}`,
        email: '',
        avatar: 'C',
        behavior: 'Neutral',
        flagged: false,
        history: [],
      },
      subject,
      preview: c.lastMessagePreview || subject,
      status: c.status === 'active' ? 'UNREAD' : 'READ',
      time: c.lastMessageAt || c.updatedAt,
      messages,
    };
  };

  const refreshMessageThreads = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      setMessagingAuthoritative(false);
      return;
    }
    try {
      const rows = await messagingApi.listConversations();
      const mapped = await Promise.all(rows.map((c) => mapApiConversation(c)));
      setMessageThreads(mapped);
      setMessagingAuthoritative(true);
    } catch (error) {
      console.warn('[Messaging] Failed to hydrate conversations', error);
      // Keep whatever is on screen; do not silently restore demo as SoT.
      setMessagingAuthoritative(true);
    }
  }, []);

  useEffect(() => {
    void refreshMessageThreads();
  }, [refreshMessageThreads, commerceAuthoritative]);

  // Persist demo orders only when Commerce is not authoritative
  useEffect(() => {
    if (commerceAuthoritative) return;
    localStorage.setItem('choosify_orders', JSON.stringify(orders));
  }, [orders, commerceAuthoritative]);

  useEffect(() => {
    localStorage.setItem('choosify_customers', JSON.stringify(customers));
  }, [customers]);

  useEffect(() => {
    if (messagingAuthoritative || getAuthToken()) return;
    localStorage.setItem('choosify_threads', JSON.stringify(messageThreads));
  }, [messageThreads, messagingAuthoritative]);

  // Actions
  const approveOrder = (orderId: string, deliveryChargeNum?: number, note?: string) => {
    if (commerceAuthoritative || getAuthToken()) {
      void (async () => {
        const result = await runCommerceTransition(orderId, 'confirmed');
        if (!result.ok) return;
        if (note) {
          setOrders((prev) =>
            prev.map((o) =>
              o.id === orderId
                ? { ...o, sellerNotes: [...(o.sellerNotes || []), note] }
                : o,
            ),
          );
        }
      })();
      return;
    }

    try {
      const orderToApprove = orders.find(o => o.id === orderId);
      if (orderToApprove) {
        const qty = orderToApprove.quantity || 1;
        deallocateStock(orderToApprove.product.id, qty);
        logStockChange(orderToApprove.product.id, -qty, 'order_placed', orderId);
      }
    } catch (e) {
      console.error('Failed to log stock deduction on approval:', e);
    }

    const timestampStr = new Date().toISOString();
    const invoiceIdGenerated = 'INV-' + Math.floor(100000 + Math.random() * 900000);
    const resolvedDeliveryCharge = deliveryChargeNum !== undefined ? deliveryChargeNum : 120;

    // Helper variables to populate messages
    let basePriceMsg = 0;
    let totalPayableMsg = 0;
    let customerNameMsg = 'Customer';
    let productNameMsg = 'Product';

    setOrders(prev => prev.map(o => {
      if (o.id === orderId) {
        const basePrice = o.product.price;
        const totalPayableNum = basePrice + resolvedDeliveryCharge;
        const sellerNotes = o.sellerNotes ? [...o.sellerNotes] : [];
        if (note) sellerNotes.push(note);

        // Capture details for communication logic
        basePriceMsg = basePrice;
        totalPayableMsg = totalPayableNum;
        customerNameMsg = o.customer.name;
        productNameMsg = o.product.name;

        // Recalculate earnings with locked totals
        const commPercent = o.earnings?.commissionPercent || 10;
        const commission = Math.round(basePrice * (commPercent / 100)); // commission logic on base product price

        return {
          ...o,
          status: 'Confirmed',
          approveTime: timestampStr,
          sellerNotes,
          base_product_price: basePrice,
          delivery_charge: resolvedDeliveryCharge,
          total_payable: totalPayableNum,
          invoice_id: invoiceIdGenerated,
          invoice_status: 'Unpaid',
          confirmation_timestamp: timestampStr,
          earnings: {
            totalRevenue: totalPayableNum,
            commissionPercent: commPercent,
            futureAutomatedDeduction: commission,
            sellerNet: totalPayableNum - commission
          }
        };
      }
      return o;
    }));

    // Update or create message thread with automated Invoice generation copies
    setMessageThreads(prev => prev.map(t => {
      if (t.orderId === orderId) {
        const productVal = t.product;
        const basePrice = productVal ? productVal.price : basePriceMsg || 0;
        const totalPayableNum = basePrice + resolvedDeliveryCharge;

        return {
          ...t,
          status: 'RESPONDED',
          messages: [
            ...t.messages,
            {
              id: 'm_seller_' + Math.random().toString(),
              senderName: productVal?.sellerName || 'Merchant Partner',
              senderRole: 'seller',
              text: `🟢 [ORDER CONFIRMED - SELLER NOTIFICATION]\nInvoice Attached: #${invoiceIdGenerated}\n\nInvoice Total Payable Summary:\n- Base Product Price: ৳${basePrice.toLocaleString()}\n- Added Delivery Charge BDT: ৳${resolvedDeliveryCharge.toLocaleString()}\n- Total Payable Amount: ৳${totalPayableNum.toLocaleString()}\n- Status: INVOICE GENERATED & PRICING LOCKED.\n\nNote: ${note || "System auto-validation."}`,
              timestamp: new Date().toISOString(),
            },
            {
              id: 'm_cust_' + Math.random().toString(),
              senderName: 'Platform Support Admin',
              senderRole: 'admin',
              text: `📦 [ORDER CONFIRMED - CUSTOMER COPY]\nHello ${customerNameMsg || t.customer.name},\nYour purchase order for "${productNameMsg || productVal?.name}" has been confirmed with pricing details locked.\n\nPayment Invoice Breakdown:\n- Product Price: ৳${basePrice.toLocaleString()}\n- Delivery Charge: ৳${resolvedDeliveryCharge.toLocaleString()}\n- Total Payable Amount BDT: ৳${totalPayableNum.toLocaleString()}\n- Invoice Code: ${invoiceIdGenerated}\n\nEstimated Delivery Status: Handover scheduled with our courier. Thanks for shopping with Choosify!`,
              timestamp: new Date().toISOString(),
            }
          ]
        };
      }
      return t;
    }));
  };

  const declineOrder = (orderId: string, reason: string) => {
    if (commerceAuthoritative || getAuthToken()) {
      void runCommerceCancel(orderId, reason || 'Declined by seller');
      return;
    }

    try {
      const orderToDecline = orders.find(o => o.id === orderId);
      if (orderToDecline) {
        const qty = orderToDecline.quantity || 1;
        deallocateStock(orderToDecline.product.id, qty);
      }
    } catch (e) {
      console.error('Failed to restore stock on decline:', e);
    }

    setOrders(prev => prev.map(o => {
      if (o.id === orderId) {
        return {
          ...o,
          status: 'Rejected',
          cancelTime: new Date().toISOString(),
          declineReason: reason,
          invoice_status: 'Refunded' as any,
          earnings: {
            totalRevenue: 0,
            commissionPercent: o.earnings?.commissionPercent || 10,
            futureAutomatedDeduction: 0,
            sellerNet: 0
          }
        };
      }
      return o;
    }));

    setMessageThreads(prev => prev.map(t => {
      if (t.orderId === orderId) {
        return {
          ...t,
          status: 'RESPONDED',
          messages: [
            ...t.messages,
            {
              id: 'decline_seller_' + Math.random().toString(),
              senderName: t.product?.sellerName || 'Merchant Partner',
              senderRole: 'seller',
              text: `❌ [ORDER REJECTED - AUTOMATED MESSAGE]\nYour order #${orderId} has been Rejected. Reason: "${reason}". Fulfillment stopped and ERP ledger updated.`,
              timestamp: new Date().toISOString(),
            },
            {
              id: 'decline_cust_' + Math.random().toString(),
              senderName: 'Platform Support Admin',
              senderRole: 'admin',
              text: `Your order #${orderId} has been Rejected and is being processed. Reason for cancellation: ${reason}`,
              timestamp: new Date().toISOString(),
            }
          ]
        };
      }
      return t;
    }));
  };

  const cancelOrder = (orderId: string, reason: string) => {
    if (commerceAuthoritative || getAuthToken()) {
      void runCommerceCancel(orderId, reason || 'Cancelled');
      return;
    }

    try {
      const orderToCancel = orders.find(o => o.id === orderId);
      if (orderToCancel) {
        const qty = orderToCancel.quantity || 1;
        if (orderToCancel.status === 'Pending') {
          deallocateStock(orderToCancel.product.id, qty);
        } else if (orderToCancel.status === 'Confirmed' || orderToCancel.status === 'Dispatched' || orderToCancel.status === 'In Transit' || orderToCancel.status === 'Processing') {
          logStockChange(orderToCancel.product.id, qty, 'cancel_order', orderId);
        }
      }
    } catch (e) {
      console.error('Failed to restore stock on cancel:', e);
    }

    setOrders(prev => prev.map(o => {
      if (o.id === orderId) {
        return {
          ...o,
          status: 'Cancelled',
          cancelTime: new Date().toISOString(),
          cancelReason: reason,
        };
      }
      return o;
    }));

    setMessageThreads(prev => prev.map(t => {
      if (t.orderId === orderId) {
        return {
          ...t,
          status: 'RESPONDED',
          messages: [
            ...t.messages,
            {
              id: Math.random().toString(),
              senderName: t.product?.sellerName || 'Seller Store',
              senderRole: 'seller',
              text: `🛑 Order #${orderId} was CANCELLED. Reason: ${reason}`,
              timestamp: new Date().toISOString(),
            }
          ]
        };
      }
      return t;
    }));
  };

  const dispatchOrder = (orderId: string, deliveryPartner: string, trackingUrl: string) => {
    if (commerceAuthoritative || getAuthToken()) {
      void (async () => {
        const current = orders.find((o) => o.id === orderId);
        const commerceStatus = current?.commerceStatus;
        if (commerceStatus === 'confirmed' || current?.status === 'Confirmed') {
          const packed = await runCommerceTransition(orderId, 'packed');
          if (!packed.ok) return;
        } else if (commerceStatus === 'pending' || current?.status === 'Pending') {
          const conf = await runCommerceTransition(orderId, 'confirmed');
          if (!conf.ok) return;
          const packed = await runCommerceTransition(orderId, 'packed');
          if (!packed.ok) return;
        } else if (commerceStatus !== 'packed' && current?.status !== 'Processing') {
          // already packed/shipped — continue to ship
        }
        const trackingNumber =
          trackingUrl?.replace(/^tracking:/, '') ||
          trackingUrl?.split('/').pop() ||
          trackingUrl ||
          undefined;
        await runCommerceTransition(orderId, 'shipped', {
          fulfilmentMethod: 'self_delivery',
          courierProvider: deliveryPartner || 'self',
          trackingNumber,
        });
      })();
      return;
    }

    setOrders(prev => prev.map(o => {
      if (o.id === orderId) {
        return {
          ...o,
          status: 'Dispatched',
          dispatchTime: new Date().toISOString(),
          deliveryPartner,
          trackingUrl,
        };
      }
      return o;
    }));

    setMessageThreads(prev => prev.map(t => {
      if (t.orderId === orderId) {
        return {
          ...t,
          status: 'RESPONDED',
          messages: [
            ...t.messages,
            {
              id: Math.random().toString(),
              senderName: t.product?.sellerName || 'Seller Store',
              senderRole: 'seller',
              text: `🚚 Dispatched via ${deliveryPartner}! Track live here: ${trackingUrl}`,
              timestamp: new Date().toISOString(),
            }
          ]
        };
      }
      return t;
    }));
  };

  const addCustomerNotes = (orderId: string, note: string) => {
    setOrders(prev => prev.map(o => {
      if (o.id === orderId) {
        return {
          ...o,
          customerNotes: o.customerNotes ? [...o.customerNotes, note] : [note],
        };
      }
      return o;
    }));
  };

  const updateOrderStatus = (orderId: string, status: OrderStatus) => {
    if (commerceAuthoritative || getAuthToken()) {
      void (async () => {
        const current = orders.find((o) => o.id === orderId);
        // Intermediate UI-only step after ship
        if (status === 'In Transit' && (current?.commerceStatus === 'shipped' || current?.status === 'Dispatched')) {
          setOrders((prev) =>
            prev.map((o) => (o.id === orderId ? { ...o, status: 'In Transit' } : o)),
          );
          return;
        }
        if (status === 'Processing') {
          await runCommerceTransition(orderId, 'packed');
          return;
        }
        if (status === 'Dispatched' || status === 'In Transit') {
          if (current?.commerceStatus === 'confirmed' || current?.status === 'Confirmed') {
            const packed = await runCommerceTransition(orderId, 'packed');
            if (!packed.ok) return;
          }
          await runCommerceTransition(orderId, 'shipped', { fulfilmentMethod: 'self_delivery' });
          if (status === 'In Transit') {
            setOrders((prev) =>
              prev.map((o) => (o.id === orderId ? { ...o, status: 'In Transit' } : o)),
            );
          }
          return;
        }
        if (status === 'Delivered') {
          const cs = current?.commerceStatus;
          if (cs === 'confirmed' || current?.status === 'Confirmed') {
            const packed = await runCommerceTransition(orderId, 'packed');
            if (!packed.ok) return;
          }
          if (cs !== 'shipped' && cs !== 'delivered' && cs !== 'completed' && current?.status !== 'Dispatched' && current?.status !== 'In Transit') {
            // after pack may need ship
            const after = orders.find((o) => o.id === orderId);
            if (after?.commerceStatus === 'packed' || after?.status === 'Processing') {
              const shipped = await runCommerceTransition(orderId, 'shipped', {
                fulfilmentMethod: 'self_delivery',
              });
              if (!shipped.ok) return;
            }
          }
          // re-read via transition path: if still packed, ship first
          let latest = await (async () => {
            const token = getAuthToken();
            if (!token) return null;
            const res = await commerceApi.getOrder(token, orderId);
            return (res.body as { data?: CommerceOrderDto })?.data;
          })();
          if (latest?.status === 'packed') {
            const shipped = await runCommerceTransition(orderId, 'shipped', {
              fulfilmentMethod: 'self_delivery',
            });
            if (!shipped.ok) return;
            latest = { ...latest, status: 'shipped' };
          }
          if (latest?.status === 'shipped' || current?.status === 'Dispatched' || current?.status === 'In Transit') {
            const del = await runCommerceTransition(orderId, 'delivered');
            if (!del.ok) return;
          }
          await runCommerceTransition(orderId, 'completed');
          return;
        }
        if (status === 'Confirmed') {
          await runCommerceTransition(orderId, 'confirmed');
          return;
        }
        if (status === 'Cancelled' || status === 'Rejected') {
          await runCommerceCancel(orderId, 'Status set to ' + status);
        }
      })();
      return;
    }

    setOrders(prev => prev.map(o => {
      if (o.id === orderId) {
        const updateObj: Partial<Order> = { status };
        if (status === 'Delivered') {
          updateObj.deliverTime = new Date().toISOString();
          // Payment status from Commerce Order payment fields (Sprint 7)
        }
        return {
          ...o,
          ...updateObj,
        };
      }
      return o;
    }));

    setMessageThreads(prev => prev.map(t => {
      if (t.orderId === orderId) {
        return {
          ...t,
          messages: [
            ...t.messages,
            {
              id: Math.random().toString(),
              senderName: t.product?.sellerName || 'System',
              senderRole: 'admin',
              text: `📦 Order status transitioned to: ${status}`,
              timestamp: new Date().toISOString(),
            }
          ]
        };
      }
      return t;
    }));
  };

  const flagCustomer = (customerId: string, flagged: boolean, reason: string) => {
    setCustomers(prev => prev.map(c => {
      if (c.id === customerId) {
        const updatedHistory = [...c.history];
        updatedHistory.push({
          timestamp: new Date().toISOString(),
          action: flagged ? 'Flagged Risk' : 'Cleared Risk',
          note: reason,
        });
        return {
          ...c,
          flagged,
          flagReason: flagged ? reason : undefined,
          behavior: flagged ? 'Risk' : 'Neutral',
          history: updatedHistory,
        };
      }
      return c;
    }));

    // Update customers inside order models in-state too
    setOrders(prev => prev.map(o => {
      if (o.customer.id === customerId) {
        return {
          ...o,
          customer: {
            ...o.customer,
            flagged,
            flagReason: flagged ? reason : undefined,
            behavior: flagged ? 'Risk' : 'Neutral'
          }
        };
      }
      return o;
    }));
  };

  const sendChatMessage = (threadId: string, text: string, senderRole: 'customer' | 'seller' | 'admin', senderName: string) => {
    const optimistic = () => {
      setMessageThreads(prev => prev.map(t => {
        if (t.id === threadId) {
          return {
            ...t,
            status: senderRole === 'customer' ? 'UNREAD' : 'RESPONDED',
            preview: text,
            time: 'Just now',
            messages: [
              ...t.messages,
              {
                id: Math.random().toString(),
                senderName,
                senderRole,
                text,
                timestamp: new Date().toISOString(),
              }
            ]
          };
        }
        return t;
      }));
    };

    // Authoritative Messaging API for real conversation ids (conv_*)
    if ((messagingAuthoritative || getAuthToken()) && threadId.startsWith('conv_')) {
      optimistic();
      void messagingApi
        .sendMessage(threadId, text)
        .then(() => refreshMessageThreads())
        .catch((error) => {
          console.error('[Messaging] send failed', error);
        });
      return;
    }

    optimistic();
  };

  const createOrderNow = (product: OrderProduct, customerMsg: string, promoCode?: string, promoDiscount?: number) => {
    const orderId = 'CSS-' + Math.floor(1000 + Math.random() * 9000);
    const primaryCustomer = customers[0]; // Farhan Bin Rafiq (Default customer simulation)

    const finalProductPrice = product.price;
    const deliveryCharge = 120;
    const discount = promoDiscount || 0;
    const totalPayable = Math.max(0, finalProductPrice + deliveryCharge - discount);

    const commPercent = 10;
    const commission = Math.round(finalProductPrice * (commPercent / 100));

    const newOrder: Order = {
      id: orderId,
      product,
      customer: primaryCustomer,
      status: 'Pending',
      paymentStatus: 'Pending',
      timestamp: new Date().toISOString(),
      customerNotes: [customerMsg],
      base_product_price: finalProductPrice,
      delivery_charge: deliveryCharge,
      total_payable: totalPayable,
      earnings: {
        totalRevenue: totalPayable,
        commissionPercent: commPercent,
        futureAutomatedDeduction: commission,
        sellerNet: totalPayable - commission
      },
      quantity: 1,
      promoCode,
      promoDiscount: discount
    } as any;

    setOrders(prev => [newOrder, ...prev]);
    
    if (promoCode && discount > 0) {
      try {
        applyCoupon(promoCode, orderId, finalProductPrice, primaryCustomer.id, discount);
      } catch (err) {
        console.error('Error applying coupon during order creation:', err);
      }
    }

    try {
      allocateStock(product.id, 1);
    } catch (e) {
      console.error('Failed to allocate stock for order:', e);
    }

    // Create immediate inbox message link
    const newThread: MessageThread = {
      id: `thread_${orderId}`,
      orderId,
      customer: primaryCustomer,
      product,
      subject: `Order #${orderId} ${product.name} Auto-Inquiry`,
      preview: customerMsg,
      status: 'UNREAD',
      time: 'Just now',
      messages: [
        {
          id: 'chat_msg_1',
          senderName: primaryCustomer.name,
          senderRole: 'customer',
          text: `🛒 (NEW ORDER REQUESTED) Hello, I want to order this product: ${product.name}. Msg: "${customerMsg}"`,
          timestamp: new Date().toISOString(),
        }
      ]
    };

    setMessageThreads(prev => [newThread, ...prev]);
  };

  const addSellerNotes = (orderId: string, note: string) => {
    setOrders(prev => prev.map(o => {
      if (o.id === orderId) {
        return {
          ...o,
          sellerNotes: o.sellerNotes ? [...o.sellerNotes, note] : [note],
        };
      }
      return o;
    }));
  };

  const createManualOrder = async (params: {
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    customerAddress: string;
    platformSource: 'WhatsApp' | 'Facebook' | 'Instagram' | 'Offline';
    chatRefId?: string;
    product: OrderProduct;
    quantity: number;
    priceOverride?: number;
    notes?: string;
    promoCode?: string;
    promoDiscount?: number;
  }): Promise<{ orderId: string; invoiceId: string; confirmOrderUrl?: string } | null> => {
    const token = getAuthToken();
    if (token) {
      const sourceMap: Record<string, string> = {
        WhatsApp: 'external_whatsapp',
        Facebook: 'external_facebook',
        Instagram: 'external_instagram',
        Offline: 'external_offline',
      };
      const res = await commerceApi.createManualOrder(token, {
        sellerId: params.product.sellerId,
        brandId: (params.product as { brandId?: string }).brandId,
        listingType: params.product.productType === 'service' ? 'service' : 'product',
        listingId: params.product.id,
        quantity: params.quantity,
        source: sourceMap[params.platformSource] || 'manual',
        shipping: {
          fullName: params.customerName,
          phone: params.customerPhone,
          address: params.customerAddress,
        },
        notes: params.notes,
      });
      if (!res.ok) {
        console.error('Commerce manual order failed', res.body);
        setOrdersError((res.body as { error?: string })?.error || 'Manual order failed');
        return null;
      }
      const data = (res.body as { data?: CommerceOrderDto }).data;
      const claimToken = (res.body as { claimToken?: string }).claimToken;
      if (!data?.id) return null;
      await refreshOrders();
      return {
        orderId: data.id,
        invoiceId: data.orderNumber,
        confirmOrderUrl: claimToken
          ? `${((import.meta as any).env?.VITE_CHOOSIFY_WEB_URL || 'http://localhost:5173').replace(/\/$/, '')}/orders/confirm/${claimToken}`
          : undefined,
      };
    }

    const orderId = 'CSS-' + Math.floor(1000 + Math.random() * 9000);
    const invoiceId = 'INV-' + Math.floor(100000 + Math.random() * 900000);
    const timestampStr = new Date().toISOString();

    const productPrice = params.priceOverride !== undefined ? params.priceOverride : params.product.price;
    const finalProductPrice = productPrice * params.quantity;
    const deliveryCharge = 120;
    const discount = params.promoDiscount || 0;
    const totalPayable = Math.max(0, finalProductPrice + deliveryCharge - discount);

    // Demo-only path without auth token — no operationsApi SoT
    const claimToken = `demo-claim-${orderId}`;
    const confirmOrderUrl = `${((import.meta as any).env?.VITE_CHOOSIFY_WEB_URL || 'http://localhost:5173').replace(/\/$/, '')}/orders/confirm/${claimToken}`;
    const synced = { claimToken, confirmOrderUrl };

    const newCustomer: Customer = {
      id: 'cust_' + Math.floor(1000 + Math.random() * 9000),
      name: params.customerName,
      email: params.customerEmail,
      avatar: params.customerName.substring(0, 2).toUpperCase(),
      behavior: 'Good',
      flagged: false,
      history: [
        {
          timestamp: timestampStr,
          action: 'Manual Order Created',
          note: `Manual order created via ${params.platformSource}. Invoice attached.`
        }
      ]
    };

    (newCustomer as any).phone = params.customerPhone;
    (newCustomer as any).address = params.customerAddress;

    const commPercent = 10;
    const commission = Math.round(finalProductPrice * (commPercent / 100));

    const newOrder: Order = {
      id: orderId,
      product: {
        ...params.product,
        price: productPrice
      },
      customer: newCustomer,
      status: 'Pending',
      paymentStatus: 'Pending',
      timestamp: timestampStr,
      customerNotes: params.notes ? [params.notes] : [],
      sellerNotes: [`Manual order initialized via ${params.platformSource}. Ref: ${params.chatRefId || 'N/A'}`],
      base_product_price: finalProductPrice,
      delivery_charge: deliveryCharge,
      total_payable: totalPayable,
      invoice_id: invoiceId,
      invoice_status: 'Unpaid',
      earnings: {
        totalRevenue: totalPayable,
        commissionPercent: commPercent,
        futureAutomatedDeduction: commission,
        sellerNet: totalPayable - commission
      },
      isManual: true,
      platformSource: params.platformSource,
      chatRefId: params.chatRefId,
      quantity: params.quantity,
      promoCode: params.promoCode,
      promoDiscount: discount,
      claimToken,
      confirmOrderUrl,
    } as any;

    setOrders(prev => [newOrder, ...prev]);

    if (params.promoCode && discount > 0) {
      try {
        applyCoupon(params.promoCode, orderId, finalProductPrice, newCustomer.id, discount);
      } catch (err) {
        console.error('Error applying coupon during manual order creation:', err);
      }
    }
    try {
      allocateStock(params.product.id, params.quantity);
    } catch (e) {
      console.error('Failed to allocate stock for manual order:', e);
    }

    const newThread: MessageThread = {
      id: `thread_${orderId}`,
      orderId,
      customer: newCustomer,
      product: {
        ...params.product,
        price: productPrice
      },
      subject: `Order #${orderId} ${params.product.name} (Qty: ${params.quantity})`,
      preview: `Order created via ${params.platformSource}. Invoice Attached: #${invoiceId}`,
      status: 'RESPONDED',
      time: 'Just now',
      messages: [
        {
          id: 'chat_msg_1',
          senderName: params.customerName,
          senderRole: 'customer',
          text: `👋 (Manual Sourced via ${params.platformSource}) Phone: ${params.customerPhone}, Address: ${params.customerAddress}. Notes: ${params.notes || 'None'}`,
          timestamp: timestampStr,
        },
        {
          id: 'chat_msg_2',
          senderName: 'System ERP',
          senderRole: 'admin',
          text: `🟢 [MANUAL ORDER CREATED - ERP RECORD]\nInvoice Number: #${invoiceId}\n\nInvoice Total Payable Summary:\n- Item: ${params.product.name} (Qty: ${params.quantity})\n- Unit Price: ৳${productPrice.toLocaleString()}\n- Total Product Price: ৳${finalProductPrice.toLocaleString()}\n- Logistics Carriage: ৳120\n- Grand Total Amount: ৳${totalPayable.toLocaleString()}\n\n👉 View & Confirm Order: ${confirmOrderUrl}\n(Sign in or create a Choosify.bd account to confirm — this links the order to your account and order history.)\n\nSync established with seller order console.`,
          timestamp: timestampStr,
        }
      ]
    };

    setMessageThreads(prev => [newThread, ...prev]);
    return { orderId, invoiceId, confirmOrderUrl };
  };

  const markAllThreadsAsRead = () => {
    setMessageThreads(prev => prev.map(t => ({ ...t, status: 'READ' as const })));
  };

  const markThreadAsRead = (threadId: string) => {
    setMessageThreads(prev => prev.map(t => t.id === threadId ? { ...t, status: 'READ' as const } : t));
  };

  const updateOrderTrackingStatus = (
    orderId: string,
    sellerId: string,
    newStatus: 'pending' | 'dispatched' | 'transit' | 'delivered' | 'cancelled'
  ) => {
    if (commerceAuthoritative || getAuthToken()) {
      void (async () => {
        if (newStatus === 'dispatched' || newStatus === 'transit') {
          const current = orders.find((o) => o.id === orderId);
          if (current?.commerceStatus === 'confirmed' || current?.status === 'Confirmed') {
            const packed = await runCommerceTransition(orderId, 'packed');
            if (!packed.ok) return;
          }
          if (current?.commerceStatus !== 'shipped' && current?.commerceStatus !== 'delivered') {
            await runCommerceTransition(orderId, 'shipped', {
              fulfilmentMethod: 'self_delivery',
              courierProvider: 'self',
            });
          }
          if (newStatus === 'transit') {
            setOrders((prev) =>
              prev.map((o) =>
                o.id === orderId
                  ? {
                      ...o,
                      status: 'In Transit',
                      subOrders: o.subOrders?.map((so) =>
                        so.sellerId === sellerId ? { ...so, trackingStatus: 'transit' } : so,
                      ),
                    }
                  : o,
              ),
            );
          }
          return;
        }
        if (newStatus === 'delivered') {
          await updateOrderStatus(orderId, 'Delivered');
          return;
        }
        if (newStatus === 'cancelled') {
          await runCommerceCancel(orderId, 'Cancelled via shipment tracking');
        }
      })();
      return;
    }

    setOrders(prev => prev.map(o => {
      if (o.id === orderId) {
        const subOrders = o.subOrders ? [...o.subOrders] : [];
        const updatedSubOrders = subOrders.map(so => {
          if (so.sellerId === sellerId) {
            return { ...so, trackingStatus: newStatus };
          }
          return so;
        });
        return { ...o, subOrders: updatedSubOrders };
      }
      return o;
    }));
  };

  const addAdminNote = (orderId: string, note: string) => {
    const timestampStr = new Date().toISOString();
    const formattedNote = `[${timestampStr}] ${note}`;
    setOrders(prev => prev.map(o => {
      if (o.id === orderId) {
        return {
          ...o,
          adminNotes: o.adminNotes ? [...o.adminNotes, formattedNote] : [formattedNote]
        };
      }
      return o;
    }));
  };

  const updateCodCollected = (orderId: string, collected: boolean) => {
    setOrders(prev => prev.map(o => {
      if (o.id === orderId) {
        return { ...o, codCollected: collected };
      }
      return o;
    }));
  };

  return (
    <OrdersContext.Provider value={{
      orders,
      customers,
      messageThreads,
      commerceAuthoritative,
      messagingAuthoritative,
      refreshMessageThreads,
      ordersLoading,
      ordersError,
      refreshOrders,
      approveOrder,
      declineOrder,
      cancelOrder,
      dispatchOrder,
      addCustomerNotes,
      addSellerNotes,
      updateOrderStatus,
      flagCustomer,
      sendChatMessage,
      createOrderNow,
      createManualOrder,
      markAllThreadsAsRead,
      markThreadAsRead,
      updateOrderTrackingStatus,
      addAdminNote,
      updateCodCollected
    }}>
      {children}
    </OrdersContext.Provider>
  );
};
