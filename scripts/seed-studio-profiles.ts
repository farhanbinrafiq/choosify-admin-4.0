/**
 * Upsert phase-1 profile defaults (Walton, Tech Talks BD) into the active catalog store.
 * Run: npx tsx scripts/seed-studio-profiles.ts
 */
import { catalogStore, ensureCatalogSeedData, getCatalogPersistenceMode } from '../lib/vercel-catalog/catalogStore';
import { defaultBrands } from '../lib/vercel-catalog/catalogDefaults';
import { defaultCreators } from '../lib/vercel-catalog/catalogEditorialDefaults';
import { normalizeBrandInput } from '../server/catalogContract';
import { normalizeCreatorInput } from '../lib/vercel-catalog/catalogEditorialContract';

async function main() {
  console.log('persistence', getCatalogPersistenceMode());
  await ensureCatalogSeedData();

  const waltonSeed = defaultBrands().find((b) => b.slug === 'walton' || b.id === 'brand-walton');
  if (!waltonSeed) throw new Error('Walton missing from defaultBrands()');
  const existingBrand = await catalogStore.getBrand(waltonSeed.id);
  const brand = normalizeBrandInput(waltonSeed, existingBrand || undefined);
  await catalogStore.upsertBrand(brand);
  console.log('upserted brand', brand.id, brand.coverImage ? 'has cover' : 'no cover');

  const creatorSeed = defaultCreators().find((c) => c.slug === 'tech-talks-bd' || c.id === 'creator-techtalks');
  if (!creatorSeed) throw new Error('Tech Talks BD missing from defaultCreators()');
  const existingCreator = await catalogStore.getCreator(creatorSeed.id);
  const creator = normalizeCreatorInput(creatorSeed, existingCreator || undefined);
  await catalogStore.upsertCreator(creator);
  console.log('upserted creator', creator.id, creator.coverImage ? 'has cover' : 'no cover', creator.brandPartners);

  const brands = await catalogStore.listBrands();
  const creators = await catalogStore.listCreators();
  console.log(
    'store brands',
    brands.map((b) => b.name),
    'creators',
    creators.map((c) => c.name),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
