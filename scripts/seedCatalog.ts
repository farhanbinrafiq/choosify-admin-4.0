import { ensureCatalogSeedData } from '../server/catalogStore';

async function run() {
  try {
    await ensureCatalogSeedData();
    console.log('[Catalog Seed] Completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('[Catalog Seed] Failed.', error);
    process.exit(1);
  }
}

run();
