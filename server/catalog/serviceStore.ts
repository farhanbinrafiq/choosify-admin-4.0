/**
 * Service catalog foundation — persisted via catalogStore (same layer as Products).
 * Booking/counter-offer/availability engines are deferred.
 */

import { randomUUID } from 'node:crypto';
import { catalogStore } from '../../lib/vercel-catalog/catalogStore';
import type { CatalogService } from '../../src/types/catalog';
import {
  normalizeProductLifecycle,
  toPersistedProductStatus,
  type ProductStatusWire,
} from './productLifecycle';

function nowIso(): string {
  return new Date().toISOString();
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-') || 'service'
  );
}

export async function listServices(): Promise<CatalogService[]> {
  return catalogStore.listServices() as Promise<CatalogService[]>;
}

export async function getService(id: string): Promise<CatalogService | null> {
  return catalogStore.getService(id) as Promise<CatalogService | null>;
}

export async function upsertService(service: CatalogService): Promise<CatalogService> {
  return catalogStore.upsertService(service) as Promise<CatalogService>;
}

export async function deleteService(id: string): Promise<boolean> {
  await catalogStore.deleteService(id);
  return true;
}

export type ServiceNormalizeContext = {
  existingSlugs?: string[];
};

export function normalizeServiceInput(
  payload: unknown,
  existing?: CatalogService,
  context?: ServiceNormalizeContext,
): CatalogService {
  const raw = (payload ?? {}) as Record<string, unknown>;
  const title =
    typeof raw.title === 'string' && raw.title.trim()
      ? raw.title.trim()
      : existing?.title || 'Untitled Service';
  const id =
    typeof raw.id === 'string' && raw.id.trim()
      ? raw.id.trim()
      : existing?.id || `svc-${randomUUID()}`;

  const requestedSlug =
    typeof raw.slug === 'string' && raw.slug.trim()
      ? slugify(raw.slug)
      : existing?.slug || slugify(title);
  const taken = new Set((context?.existingSlugs ?? []).filter((s) => s !== existing?.slug));
  let slug = requestedSlug;
  if (taken.has(slug)) {
    slug = `${requestedSlug}-${Date.now().toString(36).slice(-5)}`;
  }

  const statusRaw =
    typeof raw.status === 'string' ? raw.status : existing?.status ?? 'draft';
  const status = toPersistedProductStatus(
    normalizeProductLifecycle(statusRaw),
  ) as CatalogService['status'];

  const price =
    typeof raw.price === 'number'
      ? raw.price
      : typeof raw.rate === 'number'
        ? raw.rate
        : existing?.price ?? 0;

  const media = Array.isArray(raw.media)
    ? raw.media.filter((m): m is string => typeof m === 'string')
    : typeof raw.image === 'string'
      ? [raw.image]
      : existing?.media ?? [];

  return {
    id,
    slug,
    title,
    description:
      typeof raw.description === 'string' ? raw.description : existing?.description ?? '',
    brandId:
      typeof raw.brandId === 'string' && raw.brandId.trim()
        ? raw.brandId.trim()
        : existing?.brandId || '',
    brandName:
      typeof raw.brandName === 'string' ? raw.brandName : existing?.brandName ?? '',
    categoryId:
      typeof raw.categoryId === 'string' ? raw.categoryId : existing?.categoryId ?? '',
    categoryName:
      typeof raw.categoryName === 'string' ? raw.categoryName : existing?.categoryName ?? '',
    serviceCategory:
      typeof raw.serviceCategory === 'string'
        ? (raw.serviceCategory as CatalogService['serviceCategory'])
        : existing?.serviceCategory,
    price: Number.isFinite(price) ? Math.max(0, price) : 0,
    currency:
      typeof raw.currency === 'string' && raw.currency.trim()
        ? raw.currency.trim()
        : existing?.currency ?? 'BDT',
    durationMinutes:
      typeof raw.durationMinutes === 'number'
        ? Math.max(0, Math.floor(raw.durationMinutes))
        : typeof raw.duration === 'number'
          ? Math.max(0, Math.floor(raw.duration))
          : existing?.durationMinutes,
    serviceArea:
      typeof raw.serviceArea === 'string'
        ? raw.serviceArea
        : typeof raw.location === 'string'
          ? raw.location
          : existing?.serviceArea,
    media,
    image: typeof raw.image === 'string' ? raw.image : media[0] || existing?.image || '',
    status,
    sellerId:
      typeof raw.sellerId === 'string' && raw.sellerId.trim()
        ? raw.sellerId.trim()
        : existing?.sellerId,
    createdAt: existing?.createdAt ?? nowIso(),
    updatedAt: nowIso(),
  };
}

export async function __resetServiceStoreForTests(): Promise<void> {
  const all = await listServices();
  await Promise.all(all.map((s) => deleteService(s.id)));
}

export type { ProductStatusWire };
