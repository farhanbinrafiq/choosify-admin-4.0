/**
 * Client Commerce API — Sprint 5–6 (IS-010 Sprint 8–9).
 * Thin wrapper over /api/v1 cart + checkout + orders + lifecycle.
 * Does not redesign UI; consumers wire existing pages to these calls.
 */

const API_BASE = (import.meta as { env?: { VITE_API_BASE?: string } }).env?.VITE_API_BASE || '/api/v1';

export type CommerceListingType = 'product' | 'service';

export type CommerceOrderStatus =
  | 'pending'
  | 'confirmed'
  | 'packed'
  | 'shipped'
  | 'delivered'
  | 'completed'
  | 'cancelled';

async function commerceFetch<T>(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<{ ok: boolean; status: number; body: T }> {
  const { token, headers, ...rest } = options;
  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers || {}),
    },
  });
  const body = (await res.json().catch(() => ({}))) as T;
  return { ok: res.ok, status: res.status, body };
}

export const commerceApi = {
  getCart(token: string) {
    return commerceFetch<{ success: boolean; data: unknown; totals: unknown }>('/cart', {
      token,
    });
  },
  addItem(
    token: string,
    input: {
      listingType: CommerceListingType;
      listingId: string;
      quantity?: number;
      variantId?: string;
      requestedAt?: string;
      serviceArea?: string;
      notes?: string;
    },
  ) {
    return commerceFetch<{ success: boolean; data: unknown; totals: unknown; error?: string }>(
      '/cart/items',
      { method: 'POST', token, body: JSON.stringify(input) },
    );
  },
  updateItemQuantity(token: string, itemId: string, quantity: number) {
    return commerceFetch<{ success: boolean; data: unknown; totals: unknown; error?: string }>(
      `/cart/items/${encodeURIComponent(itemId)}`,
      { method: 'PATCH', token, body: JSON.stringify({ quantity }) },
    );
  },
  removeItem(token: string, itemId: string) {
    return commerceFetch<{ success: boolean; data: unknown; totals: unknown; error?: string }>(
      `/cart/items/${encodeURIComponent(itemId)}`,
      { method: 'DELETE', token },
    );
  },
  clearCart(token: string) {
    return commerceFetch<{ success: boolean; data: unknown }>('/cart/clear', {
      method: 'POST',
      token,
    });
  },
  checkout(
    token: string,
    input: {
      shipping: {
        fullName: string;
        phone: string;
        address: string;
        region?: string;
        deliveryNotes?: string;
      };
      idempotencyKey?: string;
    },
  ) {
    return commerceFetch<{ success: boolean; data: unknown; error?: string }>('/checkout', {
      method: 'POST',
      token,
      headers: input.idempotencyKey ? { 'Idempotency-Key': input.idempotencyKey } : undefined,
      body: JSON.stringify({ shipping: input.shipping, idempotencyKey: input.idempotencyKey }),
    });
  },
  listOrders(
    token: string,
    opts?: {
      as?: 'consumer' | 'seller';
      brandId?: string;
      status?: string;
      byCheckout?: boolean;
    },
  ) {
    const q = new URLSearchParams();
    if (opts?.as) q.set('as', opts.as);
    if (opts?.brandId) q.set('brandId', opts.brandId);
    if (opts?.status) q.set('status', opts.status);
    if (opts?.byCheckout) q.set('byCheckout', '1');
    const qs = q.toString();
    return commerceFetch<{ success: boolean; data: unknown; byCheckout?: unknown }>(
      `/orders${qs ? `?${qs}` : ''}`,
      { token },
    );
  },
  getOrder(token: string, orderId: string) {
    return commerceFetch<{ success: boolean; data: unknown; error?: string }>(
      `/orders/${encodeURIComponent(orderId)}`,
      { token },
    );
  },
  getCheckout(token: string, checkoutId: string) {
    return commerceFetch<{ success: boolean; data: unknown }>(
      `/checkout/${encodeURIComponent(checkoutId)}`,
      { token },
    );
  },
  transitionOrder(
    token: string,
    orderId: string,
    input: {
      status: CommerceOrderStatus;
      brandId?: string;
      fulfilmentMethod?: string;
      courierProvider?: string;
      trackingNumber?: string;
    },
  ) {
    return commerceFetch<{ success: boolean; data: unknown; error?: string }>(
      `/orders/${encodeURIComponent(orderId)}/transition`,
      { method: 'POST', token, body: JSON.stringify(input) },
    );
  },
  cancelOrder(token: string, orderId: string, reason: string, brandId?: string) {
    return commerceFetch<{ success: boolean; data: unknown; reused?: boolean; error?: string }>(
      `/orders/${encodeURIComponent(orderId)}/cancel`,
      { method: 'POST', token, body: JSON.stringify({ reason, brandId }) },
    );
  },
  getOrderShipment(token: string, orderId: string) {
    return commerceFetch<{ success: boolean; data: unknown; error?: string }>(
      `/orders/${encodeURIComponent(orderId)}/shipment`,
      { token },
    );
  },
  getShipment(token: string, shipmentId: string) {
    return commerceFetch<{ success: boolean; data: unknown; error?: string }>(
      `/shipments/${encodeURIComponent(shipmentId)}`,
      { token },
    );
  },
  createManualOrder(token: string, input: Record<string, unknown>) {
    return commerceFetch<{ success: boolean; data: unknown; claimToken?: string; error?: string }>(
      '/orders/manual',
      { method: 'POST', token, body: JSON.stringify(input) },
    );
  },
};
