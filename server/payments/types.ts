import type { OpsStorefrontOrder } from '../operations/types';

export type PaymentProviderId = 'sslcommerz' | 'mock';

/** Minimal order reference for gateway product_name / value_a echo. */
export type PaymentSessionOrderRef = {
  orderId: string;
};

export interface PaymentSessionInput {
  /** Ops storefront order OR commerce payment id reference. */
  order: PaymentSessionOrderRef | OpsStorefrontOrder;
  /** Amount the customer will be charged in this session (BDT). */
  amount: number;
  currency?: string;
  successUrl: string;
  failUrl: string;
  cancelUrl: string;
  ipnUrl: string;
  customer: {
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
  };
  /** Merchant-side transaction id — must be unique per payment attempt. */
  tranId: string;
}

export interface PaymentSessionResult {
  redirectUrl: string;
  tranId: string;
  sessionKey?: string;
}

export interface PaymentValidationResult {
  valid: boolean;
  amount: number;
  currency?: string;
  status: string;
  tranId: string;
  valId: string;
  raw?: Record<string, unknown>;
}

export interface PaymentRefundInput {
  bankTranId: string;
  refundAmount: number;
  refundRemarks: string;
  refeId?: string;
}

export interface PaymentRefundResult {
  success: boolean;
  refundRefId?: string;
  message?: string;
  raw?: Record<string, unknown>;
}

/**
 * Generic gateway contract — SSLCommerz is the first implementation;
 * a second provider can implement the same shape later.
 * refundTransaction is provider-level readiness for Sprint 8 — not a Refund workflow.
 */
export interface PaymentGatewayProvider {
  readonly id: PaymentProviderId;
  isConfigured(): boolean;
  initiateSession(input: PaymentSessionInput): Promise<PaymentSessionResult>;
  validateTransaction(valId: string): Promise<PaymentValidationResult>;
  refundTransaction?(input: PaymentRefundInput): Promise<PaymentRefundResult>;
}
