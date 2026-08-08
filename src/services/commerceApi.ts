/**
 * Client Commerce API — Sprint 5 (IS-010 Sprint 8).
 * Thin wrapper over /api/v1 cart + checkout + orders.
 * Does not redesign UI; consumers wire existing pages to these calls.
 */

const API_BASE = (import.meta as { env?: { VITE_API_BASE?: string } }).env?.VITE_API_BASE || '/api/v1';

export type CommerceListingType = 'product' | 'service';

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
      shipping: { fullName: string; phone: string; address: string; region?: string; deliveryNotes?: string };
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
  listOrders(token: string, as?: 'consumer' | 'seller') {
    const q = as ? `?as=${as}` : '';
    return commerceFetch<{ success: boolean; data: unknown }>(`/orders${q}`, { token });
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
};
