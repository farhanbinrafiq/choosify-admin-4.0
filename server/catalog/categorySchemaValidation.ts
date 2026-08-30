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
  optionGroups?: Array<{ name: string; values?: string[]; custom?: boolean; customValues?: string[] }> | null;
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

  const slugOf = (name: string) =>
    name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

  const resolveVariantDim = (name: string): CatalogCategoryAttribute | undefined =>
    variantEligible.get(name) ||
    variantEligible.get(slugOf(name)) ||
    variantByName.get(name.toLowerCase());

  // ANY attribute on this category (variant-eligible or descriptive) — used to
  // stop a seller custom dimension from shadowing a known descriptive attribute.
  const anyAttrByAlias = new Map<string, CatalogCategoryAttribute>();
  for (const a of schema) {
    anyAttrByAlias.set(a.key, a);
    anyAttrByAlias.set(slugOf(a.key), a);
    anyAttrByAlias.set(a.name.toLowerCase(), a);
  }
  const resolveAnyAttr = (name: string): CatalogCategoryAttribute | undefined =>
    anyAttrByAlias.get(name) || anyAttrByAlias.get(slugOf(name)) || anyAttrByAlias.get(name.toLowerCase());

  /**
   * Hybrid model: a dimension is EITHER a category variant-eligible attribute
   * (values constrained by its schema) OR a seller custom product-only
   * dimension (free-form values). The one thing a custom dimension may NOT do
   * is reuse the name of a category attribute that exists but is NOT
   * variant-eligible — that would let a descriptive facet be spoofed as a
   * variant.
   */
  const assertDimensionAllowed = (name: string, kind: 'Option group' | 'Variant option') => {
    if (resolveVariantDim(name)) return; // canonical variant dimension
    const clash = resolveAnyAttr(name);
    if (clash && !clash.variantEligible) {
      throw new CategorySchemaError(
        `${kind} "${name}" matches the descriptive attribute "${clash.name}" on this category and cannot be used as a variant dimension. Rename the custom dimension.`,
      );
    }
    // otherwise: a seller custom dimension — permitted, values unconstrained.
  };

  // Hybrid model: a seller may append extra values to a category `select`
  // dimension (e.g. 12GB on 8/16/32GB RAM, "M(42)" on S/M/L) as long as the
  // group DECLARES them in `customValues`. Declared extras sell like any value
  // but are not category search facets. An undeclared out-of-schema value is
  // still a typo guard and is rejected.
  const declaredCustomValues = new Map<string, Set<string>>();
  for (const group of input.optionGroups ?? []) {
    const key = slugOf(group.name);
    const set = declaredCustomValues.get(key) ?? new Set<string>();
    for (const v of group.customValues ?? []) set.add(v);
    declaredCustomValues.set(key, set);
  }
  const valueAllowedForDim = (dim: CatalogCategoryAttribute, dimName: string, value: string) =>
    dim.options.includes(value) || declaredCustomValues.get(slugOf(dimName))?.has(value) === true;

  if (input.optionGroups && input.optionGroups.length > 0) {
    for (const group of input.optionGroups) {
      assertDimensionAllowed(group.name, 'Option group');
      const dim = resolveVariantDim(group.name);
      if (dim && (dim.type === 'select' || dim.type === 'multi_select')) {
        for (const v of group.values ?? []) {
          if (!valueAllowedForDim(dim, group.name, v)) {
            throw new CategorySchemaError(
              `Variant value "${v}" is not in the "${dim.name}" schema list. Add it as a custom value on the dimension to sell it.`,
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
        assertDimensionAllowed(optKey, 'Variant option');
        const dim = resolveVariantDim(optKey);
        if (dim && (dim.type === 'select' || dim.type === 'multi_select')) {
          if (!valueAllowedForDim(dim, optKey, opts[optKey])) {
            throw new CategorySchemaError(
              `Variant option value "${opts[optKey]}" is not allowed for "${dim.name}".`,
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
