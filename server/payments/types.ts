import type { OpsStorefrontOrder } from '../operations/types';

export type PaymentProviderId = 'sslcommerz' | 'mock';

export interface PaymentSessionInput {
  order: OpsStorefrontOrder;
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

/**
 * Generic gateway contract — SSLCommerz is the first implementation;
 * a second provider can implement the same shape later.
 */
export interface PaymentGatewayProvider {
  readonly id: PaymentProviderId;
  isConfigured(): boolean;
  initiateSession(input: PaymentSessionInput): Promise<PaymentSessionResult>;
  validateTransaction(valId: string): Promise<PaymentValidationResult>;
}
