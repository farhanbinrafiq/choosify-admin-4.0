/**
 * Validate listing attribute values + variant dimensions against category schema (IS-003 §11–§12).
 *
 * Compatibility (Sprint 4):
 * - Empty category schema → no attribute enforcement (legacy listings keep working).
 * - Draft lifecycle → required fields may be incomplete.
 * - Publish/Active → required attributes enforced when schema is non-empty.
 * - Unknown keys rejected when schema is non-empty (prevents foreign-schema spoofing).
 * - Legacy listings without `attributes` still load; validation applies on write/publish.
 */

import type { CatalogCategoryAttribute } from '../../lib/vercel-catalog/catalogTypes';
import { listAttributesForCategory, CategorySchemaError } from './categorySchemaStore';
import { normalizeProductLifecycle } from './productLifecycle';

export { CategorySchemaError };

function isEmptyValue(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

function validateOneValue(
  def: CatalogCategoryAttribute,
  value: unknown,
  strictRequired: boolean,
): void {
  if (isEmptyValue(value)) {
    if (strictRequired && def.required) {
      throw new CategorySchemaError(`Required attribute "${def.name}" (${def.key}) is missing`);
    }
    return;
  }

  switch (def.type) {
    case 'text':
      if (typeof value !== 'string') {
        throw new CategorySchemaError(`Attribute "${def.key}" must be text`);
      }
      break;
    case 'number':
      if (typeof value !== 'number' || Number.isNaN(value)) {
        throw new CategorySchemaError(`Attribute "${def.key}" must be a number`);
      }
      break;
    case 'boolean':
      if (typeof value !== 'boolean') {
        throw new CategorySchemaError(`Attribute "${def.key}" must be a boolean`);
      }
      break;
    case 'select':
      if (typeof value !== 'string' || !def.options.includes(value)) {
        throw new CategorySchemaError(
          `Attribute "${def.key}" value must be one of: ${def.options.join(', ')}`,
        );
      }
      break;
    case 'multi_select': {
      if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) {
        throw new CategorySchemaError(`Attribute "${def.key}" must be an array of strings`);
      }
      for (const v of value as string[]) {
        if (!def.options.includes(v)) {
          throw new CategorySchemaError(
            `Attribute "${def.key}" contains invalid option "${v}"`,
          );
        }
      }
      break;
    }
    default:
      throw new CategorySchemaError(`Unsupported attribute type for "${def.key}"`);
  }
}

export type ListingSchemaValidationInput = {
  categoryId: string;
  status: string;
  attributes?: Record<string, unknown> | null;
  /** optionGroups from product detail (variant dimensions). */
  optionGroups?: Array<{ name: string; values?: string[] }> | null;
  /** productVariants options keys must be variant-eligible. */
  productVariants?: Array<{ options?: Record<string, string> }> | null;
  /**
   * When true, enforce required even for draft (tests). Default: publish/active only.
   */
  forceStrict?: boolean;
};

/**
 * Centralized listing↔category schema validation.
 * Call from product/service create/update/publish paths.
 */
export async function validateListingAgainstCategorySchema(
  input: ListingSchemaValidationInput,
): Promise<void> {
  if (!input.categoryId) {
    throw new CategorySchemaError('categoryId is required for schema validation');
  }

  const schema = await listAttributesForCategory(input.categoryId);
  // Compatibility: categories with no Admin-defined attributes skip enforcement.
  if (schema.length === 0) {
    return;
  }

  const lifecycle = normalizeProductLifecycle(input.status);
  const strictRequired =
    input.forceStrict === true || lifecycle === 'active' || lifecycle === 'out_of_stock';

  const values = input.attributes && typeof input.attributes === 'object' ? input.attributes : {};
  const byKey = new Map(schema.map((a) => [a.key, a]));

  for (const key of Object.keys(values)) {
    const def = byKey.get(key);
    if (!def) {
      throw new CategorySchemaError(
        `Unknown attribute "${key}" is not part of this category schema`,
      );
    }
  }

  for (const def of schema) {
    validateOneValue(def, values[def.key], strictRequired);
  }

  const variantEligible = new Map(
    schema.filter((a) => a.variantEligible).map((a) => [a.key, a]),
  );
  // Also allow matching by attribute display name (option group UI often uses labels).
  const variantByName = new Map(
    schema.filter((a) => a.variantEligible).map((a) => [a.name.toLowerCase(), a]),
  );

  const resolveVariantDim = (name: string): CatalogCategoryAttribute | undefined => {
    const keySlug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    return (
      variantEligible.get(name) ||
      variantEligible.get(keySlug) ||
      variantByName.get(name.toLowerCase())
    );
  };

  if (input.optionGroups && input.optionGroups.length > 0) {
    for (const group of input.optionGroups) {
      const dim = resolveVariantDim(group.name);
      if (!dim) {
        throw new CategorySchemaError(
          `Option group "${group.name}" is not a variant-eligible attribute for this category`,
        );
      }
      if (dim.type === 'select' || dim.type === 'multi_select') {
        for (const v of group.values ?? []) {
          if (!dim.options.includes(v)) {
            throw new CategorySchemaError(
              `Variant value "${v}" is not allowed for dimension "${dim.name}"`,
            );
          }
        }
      }
    }
  }

  if (input.productVariants && input.productVariants.length > 0) {
    for (const variant of input.productVariants) {
      const opts = variant.options ?? {};
      for (const optKey of Object.keys(opts)) {
        const dim = resolveVariantDim(optKey);
        if (!dim) {
          throw new CategorySchemaError(
            `Variant option "${optKey}" is not a variant-eligible attribute for this category`,
          );
        }
        const val = opts[optKey];
        if (dim.type === 'select' || dim.type === 'multi_select') {
          if (!dim.options.includes(val)) {
            throw new CategorySchemaError(
              `Variant option value "${val}" is not allowed for "${dim.name}"`,
            );
          }
        }
      }
    }
  }
}

/** Merge specs[{key,value}] into attributes map for legacy product-detail payloads. */
export function attributesFromSpecs(
  specs: Array<{ key?: string; value?: string }> | undefined | null,
  existing?: Record<string, unknown> | null,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...(existing ?? {}) };
  if (!specs) return out;
  for (const row of specs) {
    const key = String(row.key ?? '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    if (!key) continue;
    if (out[key] === undefined) {
      out[key] = row.value ?? '';
    }
  }
  return out;
}
