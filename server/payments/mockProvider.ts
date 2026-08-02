import type {
  PaymentGatewayProvider,
  PaymentSessionInput,
  PaymentSessionResult,
  PaymentValidationResult,
} from './types';

/**
 * Deterministic fake gateway for ownership / idempotency / state-transition tests
 * without SSLCommerz credentials.
 *
 * NEVER used by the public status endpoint — isConfigured() is only true when
 * PAYMENT_GATEWAY_MOCK=true (server-side harness). Real checkout stays offline
 * until SSLCOMMERZ_STORE_ID + SSLCOMMERZ_STORE_PASSWORD are set.
 */
export class MockPaymentProvider implements PaymentGatewayProvider {
  readonly id = 'mock' as const;

  /** val_id → expected validation outcome (harness can seed). */
  private validations = new Map<
    string,
    { valid: boolean; amount: number; status: string; tranId: string }
  >();

  isConfigured(): boolean {
    return (process.env.PAYMENT_GATEWAY_MOCK || '').trim().toLowerCase() === 'true';
  }

  seedValidation(
    valId: string,
    outcome: { valid: boolean; amount: number; status?: string; tranId: string },
  ): void {
    this.validations.set(valId, {
      valid: outcome.valid,
      amount: outcome.amount,
      status: outcome.status || (outcome.valid ? 'VALID' : 'INVALID_TRANSACTION'),
      tranId: outcome.tranId,
    });
  }

  clear(): void {
    this.validations.clear();
  }

  async initiateSession(input: PaymentSessionInput): Promise<PaymentSessionResult> {
    if (!this.isConfigured()) {
      throw new Error('Mock payment gateway is not enabled (set PAYMENT_GATEWAY_MOCK=true)');
    }
    // Deterministic redirect — harness / tests follow this URL, not a real bank page.
    const redirectUrl = `${input.successUrl}${input.successUrl.includes('?') ? '&' : '?'}mock=1&tran_id=${encodeURIComponent(input.tranId)}&orderId=${encodeURIComponent(input.order.orderId)}`;
    return { redirectUrl, tranId: input.tranId, sessionKey: `mock_session_${input.tranId}` };
  }

  async validateTransaction(valId: string): Promise<PaymentValidationResult> {
    if (!this.isConfigured()) {
      throw new Error('Mock payment gateway is not enabled');
    }
    const seeded = this.validations.get(valId);
    if (!seeded) {
      return {
        valid: false,
        amount: 0,
        status: 'INVALID_TRANSACTION',
        tranId: '',
        valId,
      };
    }
    return {
      valid: seeded.valid,
      amount: seeded.amount,
      currency: 'BDT',
      status: seeded.status,
      tranId: seeded.tranId,
      valId,
    };
  }
}

export const mockPaymentProvider = new MockPaymentProvider();
