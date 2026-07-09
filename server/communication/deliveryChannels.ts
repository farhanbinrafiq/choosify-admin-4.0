import type {
  DeliveryChannel,
  DeliveryDispatchRequest,
  DeliveryDispatchResult,
} from './communicationTypes';
import { DELIVERY_CHANNELS } from './communicationTypes';

export type ChannelProvider = {
  channel: DeliveryChannel;
  dispatch(request: DeliveryDispatchRequest): Promise<DeliveryDispatchResult>;
  isConfigured(): boolean;
};

class FrameworkChannelProvider implements ChannelProvider {
  constructor(public channel: DeliveryChannel) {}

  isConfigured(): boolean {
    return false;
  }

  async dispatch(request: DeliveryDispatchRequest): Promise<DeliveryDispatchResult> {
    return {
      channel: this.channel,
      status: 'unsupported',
      message: `Provider for ${this.channel} is not configured. Framework only.`,
    };
  }
}

const providers: Record<DeliveryChannel, ChannelProvider> = {
  [DELIVERY_CHANNELS.IN_APP]: {
    channel: DELIVERY_CHANNELS.IN_APP,
    isConfigured: () => true,
    async dispatch(request) {
      return {
        channel: DELIVERY_CHANNELS.IN_APP,
        status: 'queued',
        message: `In-app notification queued for ${request.userId}`,
      };
    },
  },
  [DELIVERY_CHANNELS.EMAIL]: new FrameworkChannelProvider(DELIVERY_CHANNELS.EMAIL),
  [DELIVERY_CHANNELS.PUSH]: new FrameworkChannelProvider(DELIVERY_CHANNELS.PUSH),
  [DELIVERY_CHANNELS.SMS]: new FrameworkChannelProvider(DELIVERY_CHANNELS.SMS),
  [DELIVERY_CHANNELS.WHATSAPP]: new FrameworkChannelProvider(DELIVERY_CHANNELS.WHATSAPP),
  [DELIVERY_CHANNELS.WEBHOOK]: new FrameworkChannelProvider(DELIVERY_CHANNELS.WEBHOOK),
};

export function getChannelProvider(channel: DeliveryChannel): ChannelProvider {
  return providers[channel];
}

export async function dispatchToChannels(
  request: Omit<DeliveryDispatchRequest, 'channel'>,
  channels: DeliveryChannel[],
): Promise<DeliveryDispatchResult[]> {
  const results: DeliveryDispatchResult[] = [];
  for (const channel of channels) {
    const provider = getChannelProvider(channel);
    results.push(await provider.dispatch({ ...request, channel }));
  }
  return results;
}

export function listChannelStatus(): Array<{ channel: DeliveryChannel; configured: boolean }> {
  return Object.values(providers).map((provider) => ({
    channel: provider.channel,
    configured: provider.isConfigured(),
  }));
}
