import type { OmniPlatform } from '../config';

export type OutboundContent = {
  type: 'text' | 'image' | 'file';
  body: string;
  mediaUrl?: string;
  templateName?: string;
  templateLanguage?: string;
};

export type SendMessageInput = {
  platform: OmniPlatform;
  recipientId: string;
  content: OutboundContent;
};

export type SendMessageResult = {
  platformMessageId: string;
  delivered: boolean;
  mode: 'mock' | 'live';
  note?: string;
};

export interface ChannelAdapter {
  readonly platform: OmniPlatform;
  sendMessage(input: SendMessageInput): Promise<SendMessageResult>;
}

export class ChannelAdapterError extends Error {
  constructor(
    message: string,
    public readonly platform: OmniPlatform,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'ChannelAdapterError';
  }
}

async function graphPost(url: string, accessToken: string, body: Record<string, unknown>) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;

  if (!response.ok) {
    const err = payload.error as { message?: string } | undefined;
    throw new Error(err?.message || `Graph API request failed (${response.status})`);
  }

  return payload;
}

export class MockChannelAdapter implements ChannelAdapter {
  readonly platform: OmniPlatform;

  constructor(platform: OmniPlatform) {
    this.platform = platform;
  }

  async sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
    console.log(`[MockChannel:${input.platform}] Outbound to ${input.recipientId}:`, input.content.body);
    return {
      platformMessageId: `mid.mock_${input.platform}_${Date.now()}`,
      delivered: false,
      mode: 'mock',
      note: 'Message saved in Choosify inbox only. Set MESSAGING_MODE=live and Meta credentials to deliver externally.',
    };
  }
}

export class MetaWhatsAppAdapter implements ChannelAdapter {
  readonly platform = 'whatsapp' as const;

  async sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim();

    if (!phoneNumberId || !accessToken) {
      throw new ChannelAdapterError('WhatsApp credentials missing', 'whatsapp');
    }

    const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;
    let body: Record<string, unknown>;

    if (input.content.templateName) {
      body = {
        messaging_product: 'whatsapp',
        to: input.recipientId,
        type: 'template',
        template: {
          name: input.content.templateName,
          language: { code: input.content.templateLanguage || 'en' },
        },
      };
    } else if (input.content.type === 'image' && input.content.mediaUrl) {
      body = {
        messaging_product: 'whatsapp',
        to: input.recipientId,
        type: 'image',
        image: { link: input.content.mediaUrl, caption: input.content.body },
      };
    } else {
      body = {
        messaging_product: 'whatsapp',
        to: input.recipientId,
        type: 'text',
        text: { body: input.content.body },
      };
    }

    const result = await graphPost(url, accessToken, body);
    const messages = result.messages as Array<{ id?: string }> | undefined;

    return {
      platformMessageId: messages?.[0]?.id || `mid.wa_${Date.now()}`,
      delivered: true,
      mode: 'live',
    };
  }
}

export class MetaMessengerAdapter implements ChannelAdapter {
  readonly platform = 'messenger' as const;

  async sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
    const pageAccessToken = process.env.META_PAGE_ACCESS_TOKEN?.trim();
    if (!pageAccessToken) {
      throw new ChannelAdapterError('Messenger page access token missing', 'messenger');
    }

    const url = 'https://graph.facebook.com/v21.0/me/messages';
    let message: Record<string, unknown>;

    if (input.content.type === 'image' && input.content.mediaUrl) {
      message = {
        attachment: {
          type: 'image',
          payload: { url: input.content.mediaUrl, is_reusable: true },
        },
      };
    } else {
      message = { text: input.content.body };
    }

    const result = await graphPost(url, pageAccessToken, {
      recipient: { id: input.recipientId },
      message,
      messaging_type: 'RESPONSE',
    });

    const messageId = result.message_id as string | undefined;

    return {
      platformMessageId: messageId || `mid.me_${Date.now()}`,
      delivered: true,
      mode: 'live',
    };
  }
}

export class MetaInstagramAdapter implements ChannelAdapter {
  readonly platform = 'instagram' as const;

  async sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
    const pageAccessToken = process.env.META_PAGE_ACCESS_TOKEN?.trim();
    const igUserId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID?.trim();

    if (!pageAccessToken || !igUserId) {
      throw new ChannelAdapterError('Instagram credentials missing', 'instagram');
    }

    const url = `https://graph.facebook.com/v21.0/${igUserId}/messages`;
    let message: Record<string, unknown>;

    if (input.content.type === 'image' && input.content.mediaUrl) {
      message = {
        attachment: {
          type: 'image',
          payload: { url: input.content.mediaUrl },
        },
      };
    } else {
      message = { text: input.content.body };
    }

    const result = await graphPost(url, pageAccessToken, {
      recipient: { id: input.recipientId },
      message,
    });

    const messageId = result.message_id as string | undefined;

    return {
      platformMessageId: messageId || `mid.ig_${Date.now()}`,
      delivered: true,
      mode: 'live',
    };
  }
}
