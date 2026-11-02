/**
 * Applies CATEGORY_ADDITION_MIGRATIONS to an existing catalog, once each.
 *
 * The default taxonomy is only seeded into an EMPTY catalog, so categories added
 * to the code later never reached production. This adds them at startup:
 *  - only categories listed in a not-yet-applied migration;
 *  - only when no category with the same id, slug, or name under the same parent
 *    exists (staff or sellers may already have created it);
 *  - never edits or removes an existing category;
 *  - records the migration id in site config, so a category staff delete later
 *    is not re-added on the next start.
 */
import { catalogStore } from './catalogStore';
import { buildDefaultCatalogCategories, CATEGORY_ADDITION_MIGRATIONS } from './storefrontCategories';

const norm = (v: unknown) => String(v ?? '').trim().toLowerCase();

export async function ensureCategoryAdditions(log: (msg: string) => void = console.log): Promise<string[]> {
  const site = await catalogStore.getSiteConfig();
  const applied = new Set(site?.catalogMigrations ?? []);
  const pending = CATEGORY_ADDITION_MIGRATIONS.filter((m) => !applied.has(m.id));
  if (!pending.length) return [];

  const defaults = new Map(buildDefaultCatalogCategories().map((c) => [c.id, c]));
  const existing = (await catalogStore.listCategories()) as Array<{ id: string; slug?: string; name?: string; parentId?: string | null }>;
  const taken = (c: { id: string; slug?: string; name?: string; parentId?: string | null }) =>
    existing.some(
      (e) =>
        e.id === c.id ||
        (c.slug && norm(e.slug) === norm(c.slug)) ||
        (norm(e.name) === norm(c.name) && (e.parentId ?? null) === (c.parentId ?? null)),
    );

  const added: string[] = [];
  for (const migration of pending) {
    // Parents before children, so a new main category exists before its subcategories.
    const rows = migration.categoryIds
      .map((id) => defaults.get(id))
      .filter((c): c is NonNullable<typeof c> => Boolean(c))
      .sort((a, b) => Number(Boolean(a.parentId)) - Number(Boolean(b.parentId)));
    for (const row of rows) {
      if (taken(row)) continue;
      if (row.parentId && !existing.some((e) => e.id === row.parentId)) continue; // parent was removed by staff
      await catalogStore.upsertCategory(row);
      existing.push(row);
      added.push(row.id);
    }
    applied.add(migration.id);
  }

  const latest = await catalogStore.getSiteConfig();
  await catalogStore.upsertSiteConfig({ ...latest, catalogMigrations: [...applied] });
  log(`[Catalog] Category additions applied (${pending.map((m) => m.id).join(', ')}): ${added.length} added.`);
  return added;
}
