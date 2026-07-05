import crypto from 'crypto';
import { getMetaAppSecret, shouldVerifyWebhookSignature } from './config';

export function verifyMetaWebhookSignature(rawBody: Buffer | string, signatureHeader: string | undefined): boolean {
  if (!shouldVerifyWebhookSignature()) {
    return true;
  }

  const appSecret = getMetaAppSecret();
  if (!appSecret || !signatureHeader?.startsWith('sha256=')) {
    return false;
  }

  const expected = crypto
    .createHmac('sha256', appSecret)
    .update(typeof rawBody === 'string' ? rawBody : rawBody)
    .digest('hex');

  const received = signatureHeader.slice('sha256='.length);

  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(received, 'hex'));
  } catch {
    return false;
  }
}
