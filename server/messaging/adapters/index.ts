import { getMessagingMode, type OmniPlatform } from '../config';
import {
  ChannelAdapter,
  MetaInstagramAdapter,
  MetaMessengerAdapter,
  MetaWhatsAppAdapter,
  MockChannelAdapter,
} from './channelAdapter';

const mockAdapters: Partial<Record<OmniPlatform, ChannelAdapter>> = {};
const liveAdapters: Partial<Record<OmniPlatform, ChannelAdapter>> = {};

function getMockAdapter(platform: OmniPlatform): ChannelAdapter {
  if (!mockAdapters[platform]) {
    mockAdapters[platform] = new MockChannelAdapter(platform);
  }
  return mockAdapters[platform]!;
}

function getLiveAdapter(platform: OmniPlatform): ChannelAdapter | null {
  if (platform === 'platform') return null;

  if (!liveAdapters[platform]) {
    if (platform === 'whatsapp') liveAdapters[platform] = new MetaWhatsAppAdapter();
    if (platform === 'messenger') liveAdapters[platform] = new MetaMessengerAdapter();
    if (platform === 'instagram') liveAdapters[platform] = new MetaInstagramAdapter();
  }

  return liveAdapters[platform] ?? null;
}

export function getChannelAdapter(platform: OmniPlatform): ChannelAdapter {
  if (platform === 'platform') {
    return getMockAdapter(platform);
  }

  if (getMessagingMode() === 'live') {
    const live = getLiveAdapter(platform);
    if (live) return live;
  }

  return getMockAdapter(platform);
}

export function listAdapterModes(): Record<string, 'mock' | 'live'> {
  const mode = getMessagingMode();
  return {
    whatsapp: mode === 'live' && getLiveAdapter('whatsapp') ? 'live' : 'mock',
    messenger: mode === 'live' && getLiveAdapter('messenger') ? 'live' : 'mock',
    instagram: mode === 'live' && getLiveAdapter('instagram') ? 'live' : 'mock',
    platform: 'mock',
  };
}
