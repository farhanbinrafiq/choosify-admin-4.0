/**
 * Category hierarchy integrity + attribute/variant schema persistence (IS-010 Sprint 7).
 * Reuses catalogStore (Firestore or memory-disk) — not a parallel database.
 */

import { catalogStore } from '../../lib/vercel-catalog/catalogStore';
import type {
  CatalogCategory,
  CatalogCategoryAttribute,
} from '../../lib/vercel-catalog/catalogTypes';

export class CategorySchemaError extends Error {
  readonly statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

/** Simple in-process schema cache (ES-009 configuration cache pattern). */
const schemaCache = new Map<string, { at: number; attrs: CatalogCategoryAttribute[] }>();
const SCHEMA_CACHE_TTL_MS = 30_000;

export function invalidateCategorySchemaCache(categoryId?: string): void {
  if (categoryId) {
    schemaCache.delete(categoryId);
    return;
  }
  schemaCache.clear();
}

function nowIso(): string {
  return new Date().toISOString();
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export async function assertCategoryHierarchy(
  category: CatalogCategory,
  allCategories?: CatalogCategory[],
): Promise<void> {
  const categories = allCategories ?? (await catalogStore.listCategories());
  const parentId = category.parentId;

  if (parentId === category.id) {
    throw new CategorySchemaError('A category cannot be its own parent');
  }

  if (parentId) {
    const parent = categories.find((c) => c.id === parentId);
    if (!parent) {
      throw new CategorySchemaError(`Parent category "${parentId}" does not exist`);
    }
    // Walk ancestors to reject cycles (moving a node under its descendant).
    let cursor: string | null = parentId;
    const seen = new Set<string>([category.id]);
    while (cursor) {
      if (seen.has(cursor)) {
        throw new CategorySchemaError('Category hierarchy cycle rejected');
      }
      seen.add(cursor);
      const node = categories.find((c) => c.id === cursor);
      cursor = node?.parentId ?? null;
    }
  }

  const slugClash = categories.find(
    (c) => c.slug === category.slug && c.id !== category.id,
  );
  if (slugClash) {
    throw new CategorySchemaError(`Slug "${category.slug}" is already in use`);
  }
}

export async function assertCategoryDeletable(categoryId: string): Promise<void> {
  const categories = await catalogStore.listCategories();
  const hasChildren = categories.some((c) => c.parentId === categoryId);
  if (hasChildren) {
    throw new CategorySchemaError(
      'Cannot delete category with child categories. Move or delete children first.',
    );
  }
  const products = await catalogStore.listProducts();
  if (products.some((p) => p.categoryId === categoryId)) {
    throw new CategorySchemaError(
      'Cannot delete category while products still reference it. Reassign products first.',
    );
  }
  const services = await catalogStore.listServices();
  if (services.some((s) => s.categoryId === categoryId)) {
    throw new CategorySchemaError(
      'Cannot delete category while services still reference it. Reassign services first.',
    );
  }
}

export async function listAttributesForCategory(
  categoryId: string,
  opts?: { includeArchived?: boolean; bypassCache?: boolean },
): Promise<CatalogCategoryAttribute[]> {
  if (!opts?.bypassCache) {
    const cached = schemaCache.get(categoryId);
    if (cached && Date.now() - cached.at < SCHEMA_CACHE_TTL_MS) {
      return opts?.includeArchived
        ? cached.attrs
        : cached.attrs.filter((a) => a.status === 'active');
    }
  }
  const all = await catalogStore.listCategoryAttributes();
  const attrs = all
    .filter((a) => a.categoryId === categoryId)
    .sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name));
  schemaCache.set(categoryId, { at: Date.now(), attrs });
  return opts?.includeArchived ? attrs : attrs.filter((a) => a.status === 'active');
}

export async function getAttribute(id: string): Promise<CatalogCategoryAttribute | null> {
  return catalogStore.getCategoryAttribute(id);
}

export async function upsertAttribute(
  payload: CatalogCategoryAttribute,
): Promise<CatalogCategoryAttribute> {
  const category = await catalogStore.getCategory(payload.categoryId);
  if (!category) {
    throw new CategorySchemaError(`Category "${payload.categoryId}" not found`, 404);
  }
  const siblings = (await catalogStore.listCategoryAttributes()).filter(
    (a) => a.categoryId === payload.categoryId && a.id !== payload.id,
  );
  if (siblings.some((a) => a.key === payload.key)) {
    throw new CategorySchemaError(`Attribute key "${payload.key}" already exists on this category`);
  }
  if (
    (payload.type === 'select' || payload.type === 'multi_select') &&
    (!payload.options || payload.options.length === 0)
  ) {
    throw new CategorySchemaError('select/multi_select attributes require at least one option');
  }
  const saved = await catalogStore.upsertCategoryAttribute(payload);
  invalidateCategorySchemaCache(payload.categoryId);
  return saved;
}

export async function deleteAttribute(id: string): Promise<CatalogCategoryAttribute> {
  const existing = await catalogStore.getCategoryAttribute(id);
  if (!existing) {
    throw new CategorySchemaError('Attribute not found', 404);
  }
  await catalogStore.deleteCategoryAttribute(id);
  invalidateCategorySchemaCache(existing.categoryId);
  return existing;
}

export function normalizeAttributeInput(
  payload: unknown,
  categoryId: string,
  existing?: CatalogCategoryAttribute,
): CatalogCategoryAttribute {
  const raw = (payload ?? {}) as Record<string, unknown>;
  const name = String(raw.name ?? existing?.name ?? '').trim();
  if (!name) throw new CategorySchemaError('Attribute name is required');
  const keyRaw = String(raw.key ?? existing?.key ?? slugify(name)).trim();
  const key = slugify(keyRaw).replace(/-/g, '_') || slugify(name).replace(/-/g, '_');
  if (!key) throw new CategorySchemaError('Attribute key is required');

  const typeRaw = String(raw.type ?? existing?.type ?? 'text');
  const allowedTypes = new Set(['text', 'number', 'boolean', 'select', 'multi_select']);
  if (!allowedTypes.has(typeRaw)) {
    throw new CategorySchemaError(`Unsupported attribute type "${typeRaw}"`);
  }
  const type = typeRaw as CatalogCategoryAttribute['type'];

  const optionsRaw = Array.isArray(raw.options)
    ? raw.options
    : existing?.options ?? [];
  const options = optionsRaw
    .map((o) => String(o).trim())
    .filter((o) => o.length > 0);

  return {
    id: String(raw.id ?? existing?.id ?? `attr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
    categoryId,
    key,
    name,
    type,
    required: Boolean(raw.required ?? existing?.required ?? false),
    searchable: Boolean(raw.searchable ?? existing?.searchable ?? false),
    filterable: Boolean(raw.filterable ?? existing?.filterable ?? false),
    comparable: Boolean(raw.comparable ?? existing?.comparable ?? false),
    variantEligible: Boolean(raw.variantEligible ?? existing?.variantEligible ?? false),
    unit: String(raw.unit ?? existing?.unit ?? '').trim() || undefined,
    options,
    displayOrder: Math.floor(Number(raw.displayOrder ?? existing?.displayOrder ?? 0)) || 0,
    status: (String(raw.status ?? existing?.status ?? 'active') === 'archived'
      ? 'archived'
      : 'active') as CatalogCategoryAttribute['status'],
    createdAt: existing?.createdAt ?? nowIso(),
    updatedAt: nowIso(),
  };
}

export type CategorySchemaBundle = {
  category: CatalogCategory;
  attributes: CatalogCategoryAttribute[];
  variantDimensions: CatalogCategoryAttribute[];
};

export async function getCategorySchema(categoryId: string): Promise<CategorySchemaBundle | null> {
  const category = await catalogStore.getCategory(categoryId);
  if (!category) return null;
  const attributes = await listAttributesForCategory(categoryId);
  return {
    category,
    attributes,
    variantDimensions: attributes.filter((a) => a.variantEligible),
  };
}
