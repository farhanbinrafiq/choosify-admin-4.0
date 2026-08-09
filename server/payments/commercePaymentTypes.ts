/**
 * Durable Commerce Payment records — IS-004 / ES-005 §34.
 * Server-authoritative; never use UI/localStorage as payment truth.
 */

import type { PaymentLifecycleStatus } from './paymentLifecycle';
import type { PaymentOptionKind, PlatformPaymentMethodId } from './paymentPolicy';
import type { PaymentProviderId } from './types';

/** Order-facing payment knowledge (display + gating). */
export type CommerceOrderPaymentStatus =
  | 'unpaid'
  | 'pending'
  | 'paid'
  | 'partial'
  | 'failed'
  | 'cancelled'
  | 'cod_due';

export type CommercePayment = {
  paymentId: string;
  checkoutId: string;
  orderIds: string[];
  consumerId: string;
  paymentMethod: PlatformPaymentMethodId;
  paymentOption: PaymentOptionKind;
  provider: PaymentProviderId | 'none';
  amount: number;
  currency: string;
  authorizedAmount: number;
  capturedAmount: number;
  outstandingAmount: number;
  status: PaymentLifecycleStatus;
  providerTransactionId?: string;
  providerSessionId?: string;
  providerValId?: string;
  idempotencyKey: string;
  failureCode?: string;
  failureMessage?: string;
  initiatedAt: string;
  authorizedAt?: string;
  capturedAt?: string;
  failedAt?: string;
  cancelledAt?: string;
  /** Idempotency: reservation already released for this payment failure/cancel. */
  reservationReleased?: boolean;
  /** Idempotency: PaymentCaptured already emitted. */
  paymentCapturedEmitted?: boolean;
  /** Idempotency: PaymentFailed already emitted. */
  paymentFailedEmitted?: boolean;
  /** Idempotency: PaymentCancelled already emitted. */
  paymentCancelledEmitted?: boolean;
  /** Processed provider val_ids for this payment. */
  processedValIds?: string[];
  createdAt: string;
  updatedAt: string;
};

export type CommercePaymentInitInput = {
  checkoutId: string;
  consumerId: string;
  paymentMethod: string;
  idempotencyKey?: string;
  customer?: {
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
  };
  /** Ignored — server calculates amount. Present only to detect spoof attempts. */
  amount?: number;
  successUrl?: string;
  failUrl?: string;
  cancelUrl?: string;
};
