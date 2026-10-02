/**
 * Public Identity Phase C3 — catalog integration for public handles.
 *
 * Small, dependency-light helpers the catalog write paths and read routes call:
 *  - publicHandle on Brand / Creator catalog responses (the ACTIVE handle only;
 *    retired history and handle-management data never leave the handle API);
 *  - slug writes that can never equal another same-type entity's handle (active
 *    or retired), so a slug URL and a handle URL can never name two entities;
 *  - the approved slug lock (D2): once an entity has an active handle only a
 *    Super Admin may change its slug.
 *
 * Deliberately imports only the database layer (no catalogContract / store /
 * sellerWorkspace) so creation paths such as server/catalog/sellerWorkspace.ts can
 * use it without an import cycle.
 *
 * Handles are owned by the catalog entity id (public_handles.entity_id), never by
 * a seller or user: catalog ownership changes (sellerId) need no handle write.
 */
import { and, eq, inArray, ne, or } from 'drizzle-orm';
import { db } from '../db/client';
import { publicHandles } from '../db/schema';

export type CatalogHandleEntityType = 'brand' | 'creator';

/** A write was refused because of the handle rules (mapped to an HTTP status by the caller). */
export class CatalogHandleError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'CatalogHandleError';
  }
}

const UNAVAILABLE = () =>
  new CatalogHandleError('Public handles are unavailable right now, so this change was not saved. Please try again shortly.', 503, 'HANDLES_UNAVAILABLE');

async function guarded<T>(context: string, work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof CatalogHandleError) throw error;
    console.error(`[PublicHandles] ${context} failed:`, error instanceof Error ? error.message : error);
    throw UNAVAILABLE();
  }
}

/** entity id → active handle, for the given ids (or every entity of the type). */
export async function activeHandlesByEntity(entityType: CatalogHandleEntityType, entityIds?: string[]): Promise<Map<string, string>> {
  if (entityIds && entityIds.length === 0) return new Map();
  const rows = await db
    .select({ entityId: publicHandles.entityId, handle: publicHandles.handle })
    .from(publicHandles)
    .where(
      and(
        eq(publicHandles.entityType, entityType),
        eq(publicHandles.status, 'active'),
        entityIds ? inArray(publicHandles.entityId, entityIds) : undefined,
      ),
    );
  return new Map(rows.filter((r) => r.entityId).map((r) => [r.entityId as string, r.handle]));
}

/**
 * Adds `publicHandle` (string | null) to already-scoped catalog items. The caller
 * passes only items the requester may see (the existing scope*ForRequest rules),
 * so a draft's handle reaches nobody who cannot already see that draft.
 * Never fails a catalog read: on a database error the field is omitted and
 * clients fall back to the slug URL. The handle store is the ONLY source of
 * publicHandle: any value a catalog record itself carries (legacy or imported
 * data) is always replaced or removed, never passed through.
 */
export async function withPublicHandles<T extends { id: string }>(
  entityType: CatalogHandleEntityType,
  items: T[],
): Promise<Array<T & { publicHandle?: string | null }>> {
  if (items.length === 0) return items;
  try {
    const byId = await activeHandlesByEntity(entityType, items.map((i) => i.id));
    return items.map((item) => ({ ...item, publicHandle: byId.get(item.id) ?? null }));
  } catch (error) {
    console.error('[PublicHandles] catalog enrichment failed:', error instanceof Error ? error.message : error);
    return items.map((item) => {
      if (!('publicHandle' in item)) return item;
      const { publicHandle: _ignored, ...rest } = item as T & { publicHandle?: unknown };
      return rest as T;
    });
  }
}

/** Handles (active or retired) held by OTHER entities of the same type. */
export async function handlesHeldByOthers(entityType: CatalogHandleEntityType, entityId: string | null): Promise<string[]> {
  return guarded('handle lookup', async () => {
    const rows = await db
      .select({ handle: publicHandles.handle })
      .from(publicHandles)
      .where(
        and(
          eq(publicHandles.entityType, entityType),
          or(eq(publicHandles.status, 'active'), eq(publicHandles.status, 'retired')),
          entityId ? ne(publicHandles.entityId, entityId) : undefined,
        ),
      );
    return rows.map((r) => r.handle);
  });
}

/**
 * The slug to store: unchanged unless it equals another same-type entity's
 * handle, in which case a short suffix is added — the same way an existing Brand
 * slug collision is resolved (catalogContract.ensureUniqueSlug).
 */
export async function slugAvoidingHandles(entityType: CatalogHandleEntityType, slug: string, entityId: string | null): Promise<string> {
  if (!slug) return slug;
  const taken = new Set(await handlesHeldByOthers(entityType, entityId));
  if (!taken.has(slug.toLowerCase())) return slug;
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const suffix = attempt === 0 ? Date.now().toString(36).slice(-5) : Math.random().toString(36).slice(2, 7);
    const candidate = `${slug}-${suffix}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
  return `${slug}-${Date.now().toString(36)}`;
}

/**
 * Automated creation paths (partner application, Creator workspace) run inside
 * multi-step flows that already wrote other records (user account, application),
 * so they must not abort half-way when the handle store is unavailable. On
 * HANDLES_UNAVAILABLE the slug gets a random 5-character suffix instead: it
 * cannot be checked against handles then, but a suffixed slug equalling an
 * existing handle is practically impossible. User-initiated catalog writes keep
 * failing closed (slugAvoidingHandles).
 */
export async function slugForAutomatedCreation(entityType: CatalogHandleEntityType, slug: string, entityId: string | null): Promise<string> {
  try {
    return await slugAvoidingHandles(entityType, slug, entityId);
  } catch (error) {
    if (!(error instanceof CatalogHandleError) || !slug) throw error;
    const fallback = `${slug}-${Math.random().toString(36).slice(2, 7)}`;
    console.warn(`[PublicHandles] handle store unavailable during automated ${entityType} creation; using suffixed slug ${fallback}`);
    return fallback;
  }
}

/**
 * D2 slug lock: refuses a slug CHANGE for an entity that has an active handle
 * unless the actor is a Super Admin. An unchanged slug (editors resend the stored
 * value on every save) is never refused and needs no lookup.
 */
export async function assertSlugChangeAllowed(input: {
  entityType: CatalogHandleEntityType;
  entityId: string;
  previousSlug: string | null | undefined;
  nextSlug: string | null | undefined;
  isSuperAdmin: boolean;
}): Promise<void> {
  const previous = String(input.previousSlug ?? '');
  const next = String(input.nextSlug ?? '');
  if (!previous || previous === next || input.isSuperAdmin) return;
  const active = await guarded('slug lock lookup', () => activeHandlesByEntity(input.entityType, [input.entityId]));
  if (active.has(input.entityId)) {
    throw new CatalogHandleError(
      'This profile has a public handle, so its slug can only be changed by a Super Admin.',
      409,
      'HANDLE_SLUG_LOCKED',
    );
  }
}
