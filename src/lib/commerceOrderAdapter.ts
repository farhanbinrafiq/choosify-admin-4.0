/**
 * Maps Sprint 5–6 Commerce Orders → OrdersContext presentation shape.
 * Commerce persisted Orders are authoritative; this is display/cache mapping only.
 */
import type { Order, OrderStatus, PaymentStatus } from '../contexts/OrdersContext';

export type CommerceOrderDto = {
  id: string;
  orderNumber: string;
  checkoutId: string;
  consumerId: string;
  sellerId: string;
  brandId: string;
  brandName: string;
  status: string;
  source: string;
  currency: string;
  items: Array<{
    listingType: string;
    listingId: string;
    variantId?: string;
    title: string;
    brandId: string;
    brandName: string;
    sellerId: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    finalUnitPrice: number;
    lineTotal: number;
    currency: string;
    selectedOptions?: Record<string, string>;
  }>;
  subtotal: number;
  discountTotal: number;
  deliveryTotal: number;
  taxTotal: number;
  grandTotal: number;
  shipping?: {
    fullName: string;
    phone: string;
    address: string;
    region?: string;
    deliveryNotes?: string;
  };
  shipmentId?: string;
  paymentId?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  paidAmount?: number;
  outstandingAmount?: number;
  invoicePaymentStatus?: string;
  cancelledBy?: string;
  cancelReason?: string;
  cancelledAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type CommerceShipmentDto = {
  id: string;
  orderId: string;
  fulfilmentMethod?: string;
  courierProvider?: string | null;
  trackingNumber?: string | null;
  status: string;
  shippedAt?: string;
  deliveredAt?: string;
};

/** UI OrderStatus ← commerce lifecycle (ES-005 §27). */
export function commerceStatusToUi(status: string): OrderStatus {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'confirmed':
      return 'Confirmed';
    case 'packed':
      return 'Processing';
    case 'shipped':
      return 'Dispatched';
    case 'delivered':
    case 'completed':
      return 'Delivered';
    case 'cancelled':
      return 'Cancelled';
    default:
      return 'Pending';
  }
}

export function uiStatusToCommerceTarget(status: OrderStatus): string | null {
  switch (status) {
    case 'Pending':
      return 'pending';
    case 'Confirmed':
      return 'confirmed';
    case 'Processing':
      return 'packed';
    case 'Dispatched':
    case 'In Transit':
      return 'shipped';
    case 'Delivered':
      return 'delivered';
    case 'Cancelled':
    case 'Rejected':
      return 'cancelled';
    default:
      return null;
  }
}

function mapSource(source: string): Order['platformSource'] | undefined {
  switch (source) {
    case 'external_whatsapp':
      return 'WhatsApp';
    case 'external_facebook':
      return 'Facebook';
    case 'external_instagram':
      return 'Instagram';
    case 'external_offline':
    case 'manual':
      return 'Offline';
    default:
      return undefined;
  }
}

function trackingFromShipment(
  shipment?: CommerceShipmentDto | null,
): 'pending' | 'dispatched' | 'transit' | 'delivered' | 'cancelled' {
  if (!shipment) return 'pending';
  switch (shipment.status) {
    case 'in_transit':
    case 'out_for_delivery':
    case 'picked_up':
      return 'transit';
    case 'courier_assigned':
    case 'packed':
      return 'dispatched';
    case 'delivered':
      return 'delivered';
    case 'cancelled':
      return 'cancelled';
    default:
      return 'pending';
  }
}

function mapPaymentStatus(raw?: string): PaymentStatus {
  switch (String(raw || '').toLowerCase()) {
    case 'paid':
      return 'Paid';
    case 'partial':
      return 'Partial';
    case 'cod_due':
      return 'COD Due';
    case 'failed':
      return 'Failed';
    case 'cancelled':
    case 'canceled':
      return 'Pending';
    case 'refunded':
      return 'Refunded';
    default:
      return 'Pending';
  }
}

function mapInvoiceStatus(
  raw?: string,
  paymentStatus?: PaymentStatus,
): Order['invoice_status'] {
  if (raw === 'Paid' || paymentStatus === 'Paid') return 'Paid';
  if (raw === 'Partial' || paymentStatus === 'Partial' || paymentStatus === 'COD Due') {
    return 'Partial';
  }
  if (raw === 'Refunded' || paymentStatus === 'Refunded') return 'Refunded';
  return 'Unpaid';
}

/**
 * One Commerce Brand Order → one UI Order row (primary line for list cards).
 * Extra line items are not collapsed; totals use Order.grandTotal.
 */
export function mapCommerceOrderToUi(
  row: CommerceOrderDto,
  shipment?: CommerceShipmentDto | null,
): Order {
  const primary = row.items[0];
  const qty = row.items.reduce((s, i) => s + (i.quantity || 0), 0) || 1;
  const unit = primary?.finalUnitPrice ?? primary?.unitPrice ?? row.subtotal;
  const isManual = row.source === 'manual' || row.source.startsWith('external_');
  const uiStatus = commerceStatusToUi(row.status);
  const track = trackingFromShipment(shipment);
  const paymentStatus = mapPaymentStatus(row.paymentStatus);

  return {
    id: row.id,
    product: {
      id: primary?.listingId || row.id,
      name: primary?.title || `Order ${row.orderNumber}`,
      brand: row.brandName || primary?.brandName || 'Brand',
      price: unit,
      image: '',
      sellerId: row.sellerId,
      sellerName: row.brandName || 'Seller',
      productType: primary?.listingType === 'service' ? 'service' : 'physical',
      serviceDetails: primary?.selectedOptions,
    },
    customer: {
      id: row.consumerId,
      name: row.shipping?.fullName || row.consumerId,
      email: '',
      avatar: '',
      behavior: 'Good',
      flagged: false,
      history: [],
    },
    status: uiStatus,
    paymentStatus,
    timestamp: row.createdAt,
    cancelTime: row.cancelledAt,
    cancelReason: row.cancelReason,
    deliveryPartner: shipment?.courierProvider || undefined,
    trackingUrl: shipment?.trackingNumber
      ? `tracking:${shipment.trackingNumber}`
      : undefined,
    quantity: qty,
    base_product_price: row.subtotal,
    delivery_charge: row.deliveryTotal,
    total_payable: row.grandTotal,
    invoice_id: row.orderNumber,
    invoice_status: mapInvoiceStatus(row.invoicePaymentStatus, paymentStatus),
    isManual,
    platformSource: mapSource(row.source),
    earnings: {
      totalRevenue: row.grandTotal,
      // Commission % is Finance-owned; do not invent a platform rate in the UI adapter.
      commissionPercent: 0,
      futureAutomatedDeduction: 0,
      sellerNet: row.grandTotal,
    },
    subOrders: [
      {
        sellerId: row.sellerId,
        sellerName: row.brandName || 'Seller',
        trackingStatus: track,
      },
    ],
    adminNotes: [],
    codCollected: paymentStatus === 'COD Due' ? false : paymentStatus === 'Paid',
    ...( {
      checkoutId: row.checkoutId,
      brandId: row.brandId,
      commerceStatus: row.status,
      commerceSource: row.source,
      shipmentId: row.shipmentId || shipment?.id,
      paymentId: row.paymentId,
      outstandingAmount: row.outstandingAmount,
    } as Partial<Order>),
  };
}

export function getAuthToken(): string | null {
  return localStorage.getItem('choosify_auth_token');
}
