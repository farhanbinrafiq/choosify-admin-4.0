/**
 * Platform-defined payment method policies (IS-004 §28–§33, ES-005 §35–§36).
 * Sellers may enable only from this list — they cannot invent percentages/methods.
 */

export type PlatformPaymentMethodId =
  | 'full'
  | 'cod'
  | 'deposit'
  | 'installment'
  | 'wallet';

export type PaymentOptionKind =
  | 'full_online'
  | 'cod'
  | 'partial_advance'
  | 'booking_deposit'
  | 'installment'
  | 'wallet';

export type PlatformPaymentPolicy = {
  id: PlatformPaymentMethodId;
  option: PaymentOptionKind;
  label: string;
  /** Whether gateway capture is required before OrderConfirmed for product prepaid. */
  requiresGatewayCapture: boolean;
  /** Deposit percent of grand total (0–100). Platform-owned — not seller-defined. */
  depositPercent?: number;
  /** When COD: charge delivery total online first (ES-005 §36 product example). */
  codPrepaidDeliveryCharge: boolean;
  /** True when deeper Finance/schedule work is deferred. */
  deferred?: boolean;
  enabledByDefault: boolean;
};

/** Platform Administration policies — single source for Sprint 10 depth. */
export const PLATFORM_PAYMENT_POLICIES: PlatformPaymentPolicy[] = [
  {
    id: 'full',
    option: 'full_online',
    label: 'Full Online Payment',
    requiresGatewayCapture: true,
    codPrepaidDeliveryCharge: false,
    enabledByDefault: true,
  },
  {
    id: 'cod',
    option: 'cod',
    label: 'Cash on Delivery',
    requiresGatewayCapture: false,
    codPrepaidDeliveryCharge: true,
    enabledByDefault: true,
  },
  {
    id: 'deposit',
    option: 'booking_deposit',
    label: 'Deposit / Partial Advance (30%)',
    requiresGatewayCapture: true,
    depositPercent: 30,
    codPrepaidDeliveryCharge: false,
    enabledByDefault: true,
  },
  {
    id: 'installment',
    option: 'installment',
    label: 'Installment (foundation only)',
    requiresGatewayCapture: true,
    deferred: true,
    codPrepaidDeliveryCharge: false,
    enabledByDefault: false,
  },
  {
    id: 'wallet',
    option: 'wallet',
    label: 'Wallet (Finance-owned — interface only)',
    requiresGatewayCapture: false,
    deferred: true,
    codPrepaidDeliveryCharge: false,
    enabledByDefault: false,
  },
];

export function getPlatformPaymentPolicy(
  id: string,
): PlatformPaymentPolicy | null {
  const key = String(id || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
  const aliases: Record<string, PlatformPaymentMethodId> = {
    full: 'full',
    full_online: 'full',
    online: 'full',
    prepaid: 'full',
    cod: 'cod',
    cash_on_delivery: 'cod',
    deposit: 'deposit',
    partial: 'deposit',
    partial_advance: 'deposit',
    booking_deposit: 'deposit',
    installment: 'installment',
    instalment: 'installment',
    wallet: 'wallet',
  };
  const mapped = aliases[key];
  if (!mapped) return null;
  return PLATFORM_PAYMENT_POLICIES.find((p) => p.id === mapped) ?? null;
}

export function listEnabledPaymentPolicies(): PlatformPaymentPolicy[] {
  return PLATFORM_PAYMENT_POLICIES.filter((p) => p.enabledByDefault && !p.deferred);
}

export type PayableBreakdown = {
  currency: string;
  orderTotal: number;
  deliveryTotal: number;
  /** Amount charged via gateway now (0 for pure COD without prepaid delivery). */
  chargeNow: number;
  /** Remaining due later (COD / deposit balance). */
  outstanding: number;
  paymentOption: PaymentOptionKind;
  requiresGatewayCapture: boolean;
};

/**
 * Server-authoritative payable amount — never trust client amount.
 */
export function calculatePayable(params: {
  methodId: string;
  grandTotal: number;
  deliveryTotal: number;
  currency: string;
}): PayableBreakdown {
  const policy = getPlatformPaymentPolicy(params.methodId);
  if (!policy) {
    throw new Error(`Unsupported payment method: ${params.methodId}`);
  }
  if (policy.deferred) {
    throw new Error(
      `Payment method ${policy.id} is not available in this sprint (${policy.label})`,
    );
  }

  const orderTotal = Math.max(0, Number(params.grandTotal) || 0);
  const deliveryTotal = Math.max(0, Number(params.deliveryTotal) || 0);
  const currency = params.currency || 'BDT';

  if (policy.id === 'full') {
    return {
      currency,
      orderTotal,
      deliveryTotal,
      chargeNow: orderTotal,
      outstanding: 0,
      paymentOption: policy.option,
      requiresGatewayCapture: true,
    };
  }

  if (policy.id === 'cod') {
    const prepaidDelivery =
      policy.codPrepaidDeliveryCharge && deliveryTotal > 0 ? deliveryTotal : 0;
    return {
      currency,
      orderTotal,
      deliveryTotal,
      chargeNow: prepaidDelivery,
      outstanding: Math.max(0, orderTotal - prepaidDelivery),
      paymentOption: policy.option,
      requiresGatewayCapture: prepaidDelivery > 0,
    };
  }

  if (policy.id === 'deposit') {
    const pct = policy.depositPercent ?? 30;
    const chargeNow = Math.round((orderTotal * pct) / 100 * 100) / 100;
    return {
      currency,
      orderTotal,
      deliveryTotal,
      chargeNow,
      outstanding: Math.max(0, Math.round((orderTotal - chargeNow) * 100) / 100),
      paymentOption: policy.option,
      requiresGatewayCapture: true,
    };
  }

  throw new Error(`Payment method ${policy.id} not calculable`);
}
