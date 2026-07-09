import { catalogStore } from '../../../lib/vercel-catalog/catalogStore';
import { summarize } from '../../analytics/analyticsService';
import { getCommunicationSummary } from '../../communication/communicationService';
import { calculateSellerReputation, calculateTrustScore } from '../../moderation/reputationEngine';
import { getModerationSummary } from '../../moderation/moderationService';
import { operationsStore } from '../../operations/operationsStore';
import { getDiscoveryCollections } from '../../search/discoveryEngine';
import { search } from '../../search/searchEngine';
import type { ContextSource } from '../types';

export type ContextBuildInput = {
  sources: ContextSource[];
  ids?: Record<string, string>;
  query?: string;
};

function truncateJson(value: unknown, max = 4000): string {
  const text = JSON.stringify(value, null, 2);
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

async function buildProductContext(ids?: Record<string, string>): Promise<string> {
  if (ids?.productId) {
    const product = await catalogStore.getProduct(ids.productId);
    return truncateJson({ product });
  }
  const products = (await catalogStore.listProducts()).filter((p) => p.status === 'live').slice(0, 20);
  return truncateJson({ products });
}

async function buildBuyerContext(ids?: Record<string, string>): Promise<string> {
  const productId = ids?.productId;
  const reviews = operationsStore
    .listReviews()
    .filter((review) => !productId || review.productId === productId)
    .slice(0, 15);
  return truncateJson({ recentReviews: reviews });
}

async function buildSellerContext(ids?: Record<string, string>): Promise<string> {
  const sellerId = ids?.sellerId || ids?.brandId;
  if (!sellerId) return truncateJson({ note: 'sellerId not provided' });
  return truncateJson({
    reputation: calculateSellerReputation(sellerId, ids?.sellerName),
    orders: operationsStore.listOrders().slice(0, 10),
  });
}

async function buildAnalyticsContext(): Promise<string> {
  return truncateJson(await summarize('30d'));
}

async function buildTrustContext(ids?: Record<string, string>): Promise<string> {
  const entityType = ids?.entityType || 'seller';
  const entityId = ids?.entityId || ids?.sellerId || ids?.productId || ids?.brandId;
  if (!entityId) {
    return truncateJson({ moderation: getModerationSummary() });
  }
  if (entityType === 'seller') {
    return truncateJson({
      reputation: calculateSellerReputation(entityId, ids?.entityLabel),
      moderation: getModerationSummary(),
    });
  }
  return truncateJson({
    trust: calculateTrustScore(entityType, entityId, ids?.entityLabel),
    moderation: getModerationSummary(),
  });
}

async function buildDiscoveryContext(): Promise<string> {
  return truncateJson(await getDiscoveryCollections(['trendingProducts', 'featuredProducts', 'topRated']));
}

async function buildCommunicationContext(): Promise<string> {
  return truncateJson(getCommunicationSummary());
}

async function buildSearchContext(query?: string, ids?: Record<string, string>): Promise<string> {
  const q = query || ids?.query || '';
  if (!q) return truncateJson({ note: 'No search query provided' });
  return truncateJson(await search({ q, limit: 10 }));
}

export async function buildCombinedContext(input: ContextBuildInput): Promise<{
  block: string;
  sources: ContextSource[];
}> {
  const sections: string[] = [];
  const sources = [...new Set(input.sources)];

  for (const source of sources) {
    switch (source) {
      case 'product':
        sections.push(`[PRODUCT]\n${await buildProductContext(input.ids)}`);
        break;
      case 'buyer':
        sections.push(`[BUYER]\n${await buildBuyerContext(input.ids)}`);
        break;
      case 'seller':
        sections.push(`[SELLER]\n${await buildSellerContext(input.ids)}`);
        break;
      case 'analytics':
        sections.push(`[ANALYTICS]\n${await buildAnalyticsContext()}`);
        break;
      case 'trust':
        sections.push(`[TRUST]\n${await buildTrustContext(input.ids)}`);
        break;
      case 'discovery':
        sections.push(`[DISCOVERY]\n${await buildDiscoveryContext()}`);
        break;
      case 'communication':
        sections.push(`[COMMUNICATION]\n${await buildCommunicationContext()}`);
        break;
      case 'search':
        sections.push(`[SEARCH]\n${await buildSearchContext(input.query, input.ids)}`);
        break;
      default:
        break;
    }
  }

  return {
    block: sections.join('\n\n'),
    sources,
  };
}
