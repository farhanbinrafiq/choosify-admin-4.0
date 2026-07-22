import type { CatalogDealsBanner, DealsBannerDestinationType } from './catalogTypes';

export function resolveDealsBannerHref(banner: Pick<CatalogDealsBanner, 'destinationType' | 'destinationRef'>): string {
  const ref = String(banner.destinationRef || '').trim();
  if (banner.destinationType === 'product') {
    return ref ? `/products/${ref}` : '/deals';
  }
  if (banner.destinationType === 'brand') {
    return ref ? `/brands/${ref}` : '/brands';
  }
  if (!ref) return '/deals';
  if (/^https?:\/\//i.test(ref) || ref.startsWith('/')) return ref;
  return `/${ref}`;
}

export function isDealsBannerDestinationType(value: string): value is DealsBannerDestinationType {
  return value === 'product' || value === 'brand' || value === 'custom-url';
}
