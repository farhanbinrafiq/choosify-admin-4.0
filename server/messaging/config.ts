export type MessagingMode = 'mock' | 'live';

export type OmniPlatform = 'whatsapp' | 'messenger' | 'instagram' | 'platform';

export function getMessagingMode(): MessagingMode {
  const mode = (process.env.MESSAGING_MODE || 'mock').toLowerCase();
  return mode === 'live' ? 'live' : 'mock';
}

export function getMetaVerifyToken(): string {
  return process.env.META_VERIFY_TOKEN || 'choosify_omni_secure_token_abc123';
}

export function getMetaAppSecret(): string | undefined {
  return process.env.META_APP_SECRET?.trim() || undefined;
}

export function shouldVerifyWebhookSignature(): boolean {
  return Boolean(getMetaAppSecret()) && getMessagingMode() === 'live';
}

export function getMessagingStatus() {
  const mode = getMessagingMode();
  const hasAppSecret = Boolean(getMetaAppSecret());
  const hasWhatsApp =
    Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID?.trim()) &&
    Boolean(process.env.WHATSAPP_ACCESS_TOKEN?.trim());
  const hasMessenger =
    Boolean(process.env.META_PAGE_ACCESS_TOKEN?.trim()) &&
    Boolean(process.env.META_PAGE_ID?.trim());
  const hasInstagram =
    Boolean(process.env.META_PAGE_ACCESS_TOKEN?.trim()) &&
    Boolean(process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID?.trim());

  return {
    mode,
    webhookVerifyTokenConfigured: Boolean(process.env.META_VERIFY_TOKEN?.trim()),
    webhookSignatureVerification: shouldVerifyWebhookSignature(),
    channels: {
      whatsapp: mode === 'live' && hasWhatsApp ? 'ready' : mode === 'mock' ? 'simulated' : 'pending_credentials',
      messenger: mode === 'live' && hasMessenger ? 'ready' : mode === 'mock' ? 'simulated' : 'pending_credentials',
      instagram: mode === 'live' && hasInstagram ? 'ready' : mode === 'mock' ? 'simulated' : 'pending_credentials',
    },
    metaCredentials: {
      appId: Boolean(process.env.META_APP_ID?.trim()),
      appSecret: hasAppSecret,
      pageAccessToken: Boolean(process.env.META_PAGE_ACCESS_TOKEN?.trim()),
      whatsappPhoneNumberId: Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID?.trim()),
      whatsappAccessToken: Boolean(process.env.WHATSAPP_ACCESS_TOKEN?.trim()),
      instagramBusinessAccountId: Boolean(process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID?.trim()),
    },
    publicWebhookUrl: process.env.WEBHOOK_PUBLIC_URL || null,
  };
}

export function extractRecipientId(conversationId: string, platform: OmniPlatform): string {
  const prefix = `conv_${platform}_`;
  if (conversationId.startsWith(prefix)) {
    return conversationId.slice(prefix.length);
  }
  return '';
}
