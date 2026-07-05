import type { OpsStorefrontOrder } from '../services/operationsApi';
import type { Order, OrderProduct, OrderStatus, PaymentStatus } from '../contexts/OrdersContext';

const mapTrackingStatus = (status: string): 'pending' | 'dispatched' | 'transit' | 'delivered' | 'cancelled' => {
  if (status === 'picked_up') return 'dispatched';
  if (status === 'in_transit') return 'transit';
  if (status === 'delivered') return 'delivered';
  if (status === 'cancelled' || status === 'returned' || status === 'failed_delivery') return 'cancelled';
  return 'pending';
};

export function mapPlatformOrderToCmsOrder(row: OpsStorefrontOrder): Order[] {
  const subOrders = (row.subOrders || []) as Array<{
    sellerId?: string;
    sellerBusinessName?: string;
    sellerName?: string;
    items?: Array<{
      productId?: string;
      productTitle?: string;
      quantity?: number;
      price?: number;
      image?: string;
      brand?: string;
    }>;
    deliveryFee?: number;
    invoiceId?: string;
    trackingStatus?: string;
  }>;

  if (!subOrders.length) {
    const product: OrderProduct = {
      id: row.orderId,
      name: `Order ${row.orderId}`,
      brand: 'Platform',
      price: Number(row.overallTotal || 0),
      image: '',
      sellerId: 'platform',
      sellerName: 'Choosify Platform',
    };
    return [
      {
        id: row.orderId,
        product,
        customer: {
          id: row.buyerId,
          name: row.shipping?.fullName || row.buyerId,
          email: '',
          avatar: '',
          behavior: 'Good',
          flagged: false,
          history: [],
        },
        status: (row.status === 'completed' ? 'Delivered' : 'Confirmed') as OrderStatus,
        paymentStatus: (row.isCOD ? 'Pending' : 'Paid') as PaymentStatus,
        timestamp: row.createdAt,
        earnings: {
          totalRevenue: Number(row.overallTotal || 0),
          commissionPercent: 10,
          futureAutomatedDeduction: Number(row.overallTotal || 0) * 0.1,
          sellerNet: Number(row.overallTotal || 0) * 0.9,
        },
        promoCode: row.promoCode,
        promoDiscount: row.promoDiscount,
        platformSource: 'Offline',
        subOrders: [],
      },
    ];
  }

  return subOrders.map((sub, index) => {
    const firstItem = sub.items?.[0];
    const product: OrderProduct = {
      id: firstItem?.productId || `${row.orderId}-${index}`,
      name: firstItem?.productTitle || `Sub-order ${index + 1}`,
      brand: firstItem?.brand || sub.sellerBusinessName || 'Unknown',
      price: Number(firstItem?.price || 0),
      image: firstItem?.image || '',
      sellerId: sub.sellerId || `seller-${index}`,
      sellerName: sub.sellerBusinessName || sub.sellerName || 'Seller',
    };

    return {
      id: `${row.orderId}-${sub.sellerId || index}`,
      product,
      customer: {
        id: row.buyerId,
        name: row.shipping?.fullName || row.buyerId,
        email: '',
        avatar: '',
        behavior: 'Good' as const,
        flagged: false,
        history: [],
      },
      status: (row.status === 'cancelled' ? 'Cancelled' : 'Confirmed') as OrderStatus,
      paymentStatus: (row.isCOD ? 'Pending' : 'Paid') as PaymentStatus,
      timestamp: row.createdAt,
      earnings: {
        totalRevenue: Number(row.overallTotal || 0) / subOrders.length,
        commissionPercent: 10,
        futureAutomatedDeduction: (Number(row.overallTotal || 0) / subOrders.length) * 0.1,
        sellerNet: (Number(row.overallTotal || 0) / subOrders.length) * 0.9,
      },
      promoCode: row.promoCode,
      promoDiscount: row.promoDiscount,
      invoice_id: sub.invoiceId,
      delivery_charge: sub.deliveryFee,
      platformSource: 'Offline' as const,
      subOrders: [
        {
          sellerId: sub.sellerId || `seller-${index}`,
          sellerName: sub.sellerBusinessName || sub.sellerName || 'Seller',
          trackingStatus: mapTrackingStatus(sub.trackingStatus || 'pending'),
        },
      ],
    };
  });
}

export function mergePlatformOrders(existing: Order[], platformRows: OpsStorefrontOrder[]): Order[] {
  const mapped = platformRows.flatMap(mapPlatformOrderToCmsOrder);
  const withoutLegacySeed = existing.filter((order) => !order.id.startsWith('CSS-'));
  if (!mapped.length) return withoutLegacySeed;
  const platformIds = new Set(mapped.map((order) => order.id));
  const preserved = withoutLegacySeed.filter((order) => !platformIds.has(order.id));
  return [...mapped, ...preserved];
}
