import type {
  PaymentGatewayProvider,
  PaymentRefundInput,
  PaymentRefundResult,
  PaymentSessionInput,
  PaymentSessionResult,
  PaymentValidationResult,
} from './types';

type SslMode = 'sandbox' | 'live';

function readMode(): SslMode {
  const raw = (process.env.SSLCOMMERZ_MODE || 'sandbox').trim().toLowerCase();
  return raw === 'live' ? 'live' : 'sandbox';
}

function baseUrl(mode: SslMode): string {
  return mode === 'live'
    ? 'https://securepay.sslcommerz.com'
    : 'https://sandbox.sslcommerz.com';
}

function sessionOrderId(input: PaymentSessionInput): string {
  return input.order.orderId;
}

/**
 * Real SSLCommerz Session/Init + Order Validation API.
 * Not configured until SSLCOMMERZ_STORE_ID and SSLCOMMERZ_STORE_PASSWORD are set —
 * callers must check isConfigured() before initiate/validate.
 */
export class SslcommerzProvider implements PaymentGatewayProvider {
  readonly id = 'sslcommerz' as const;

  private storeId(): string {
    return (process.env.SSLCOMMERZ_STORE_ID || '').trim();
  }

  private storePassword(): string {
    return (process.env.SSLCOMMERZ_STORE_PASSWORD || '').trim();
  }

  isConfigured(): boolean {
    return Boolean(this.storeId() && this.storePassword());
  }

  getMode(): SslMode {
    return readMode();
  }

  async initiateSession(input: PaymentSessionInput): Promise<PaymentSessionResult> {
    if (!this.isConfigured()) {
      throw new Error('SSLCommerz is not configured');
    }

    const mode = this.getMode();
    const url = `${baseUrl(mode)}/gwprocess/v4/api.php`;
    const orderId = sessionOrderId(input);
    const body = new URLSearchParams();
    body.set('store_id', this.storeId());
    body.set('store_passwd', this.storePassword());
    body.set('total_amount', input.amount.toFixed(2));
    body.set('currency', input.currency || 'BDT');
    body.set('tran_id', input.tranId);
    body.set('success_url', input.successUrl);
    body.set('fail_url', input.failUrl);
    body.set('cancel_url', input.cancelUrl);
    body.set('ipn_url', input.ipnUrl);
    body.set('cus_name', input.customer.name || 'Customer');
    body.set('cus_email', input.customer.email || 'noreply@choosify.com.bd');
    body.set('cus_phone', input.customer.phone || '01700000000');
    body.set('cus_add1', input.customer.address || 'N/A');
    body.set('cus_city', input.customer.city || 'Dhaka');
    body.set('cus_country', 'Bangladesh');
    body.set('shipping_method', 'NO');
    body.set('product_name', `Order ${orderId}`);
    body.set('product_category', 'general');
    body.set('product_profile', 'general');
    body.set('value_a', orderId);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const rawText = await response.text();
    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(rawText) as Record<string, unknown>;
    } catch {
      throw new Error(`SSLCommerz session response was not JSON: ${rawText.slice(0, 200)}`);
    }

    const status = String(data.status || '');
    const gatewayUrl = String(data.GatewayPageURL || data.gatewayPageURL || '');
    if (status !== 'SUCCESS' || !gatewayUrl) {
      const reason = String(data.failedreason || data.message || status || 'unknown');
      throw new Error(`SSLCommerz session failed: ${reason}`);
    }

    return {
      redirectUrl: gatewayUrl,
      tranId: input.tranId,
      sessionKey: typeof data.sessionkey === 'string' ? data.sessionkey : undefined,
    };
  }

  async validateTransaction(valId: string): Promise<PaymentValidationResult> {
    if (!this.isConfigured()) {
      throw new Error('SSLCommerz is not configured');
    }
    if (!valId.trim()) {
      return {
        valid: false,
        amount: 0,
        status: 'MISSING_VAL_ID',
        tranId: '',
        valId: '',
      };
    }

    const mode = this.getMode();
    const qs = new URLSearchParams({
      val_id: valId.trim(),
      store_id: this.storeId(),
      store_passwd: this.storePassword(),
      v: '1',
      format: 'json',
    });
    const url = `${baseUrl(mode)}/validator/api/validationserverAPI.php?${qs}`;
    const response = await fetch(url, { method: 'GET' });
    const rawText = await response.text();
    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(rawText) as Record<string, unknown>;
    } catch {
      throw new Error(`SSLCommerz validation response was not JSON: ${rawText.slice(0, 200)}`);
    }

    const status = String(data.status || '').toUpperCase();
    const valid = status === 'VALID' || status === 'VALIDATED';
    return {
      valid,
      amount: Number(data.amount || data.store_amount || 0),
      currency: typeof data.currency === 'string' ? data.currency : 'BDT',
      status,
      tranId: String(data.tran_id || ''),
      valId: String(data.val_id || valId),
      raw: data,
    };
  }

  /**
   * Provider-level refund API readiness (Sprint 8 input).
   * Does NOT implement Returns/Refund business workflow.
   */
  async refundTransaction(input: PaymentRefundInput): Promise<PaymentRefundResult> {
    if (!this.isConfigured()) {
      throw new Error('SSLCommerz is not configured');
    }
    const mode = this.getMode();
    const url = `${baseUrl(mode)}/validator/api/merchantTransIDvalidationAPI.php`;
    const body = new URLSearchParams();
    body.set('store_id', this.storeId());
    body.set('store_passwd', this.storePassword());
    body.set('bank_tran_id', input.bankTranId);
    body.set('refund_amount', input.refundAmount.toFixed(2));
    body.set('refund_remarks', input.refundRemarks || 'Refund');
    if (input.refeId) body.set('refe_id', input.refeId);
    body.set('format', 'json');

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const rawText = await response.text();
    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(rawText) as Record<string, unknown>;
    } catch {
      return {
        success: false,
        message: `SSLCommerz refund response was not JSON: ${rawText.slice(0, 200)}`,
      };
    }
    const status = String(data.status || '').toUpperCase();
    const success = status === 'SUCCESS' || status === 'REFUNDED' || status === 'PROCESSING';
    return {
      success,
      refundRefId: typeof data.refund_ref_id === 'string' ? data.refund_ref_id : undefined,
      message: String(data.errorReason || data.failedreason || data.status || ''),
      raw: data,
    };
  }
}

export const sslcommerzProvider = new SslcommerzProvider();
