/**
 * Minimal Workspace ownership backfill — LOCAL DEV DB ONLY.
 *
 * Per the approved schema, workspaces are created purely from real `users`
 * rows (role = seller/verified_seller -> one 'seller' workspace,
 * role = creator -> one 'creator' workspace) — independent of whether that
 * Seller/Creator currently owns any Brand/Creator profile in the JSON-snapshot
 * catalog store. This script does NOT read CatalogBrand/CatalogCreator at
 * all, so it structurally cannot create a workspace for a Community/
 * unclaimed profile or any catalog entity with a broken/missing owner —
 * there is no code path here that could do that.
 *
 * Idempotent: skips any (owner_user_id, type) pair that already has a
 * workspaces row (the DB's own unique index would reject a duplicate anyway;
 * this check just avoids a noisy constraint-violation on re-run).
 *
 * Usage: npx tsx scripts/backfill-workspaces-local.ts
 */
import { db } from '../server/db/client';
import { users, sellerProfiles, workspaces } from '../server/db/schema';
import { eq, inArray } from 'drizzle-orm';

async function main() {
  const dbUrl = process.env.DATABASE_URL || '';
  if (!dbUrl.includes('127.0.0.1') && !dbUrl.includes('localhost')) {
    console.error('REFUSING: DATABASE_URL does not look like a local database. Aborting.');
    process.exit(1);
  }
  console.log('Target DB (must be local dev only):', dbUrl.replace(/:[^:@]+@/, ':****@'));

  const sellerUsers = await db
    .select({ id: users.id, email: users.email, displayName: users.displayName, role: users.role })
    .from(users)
    .where(inArray(users.role, ['seller', 'verified_seller']));
  const creatorUsers = await db
    .select({ id: users.id, email: users.email, displayName: users.displayName })
    .from(users)
    .where(eq(users.role, 'creator'));

  const sellerProfileRows = await db
    .select({ userId: sellerProfiles.userId, storeName: sellerProfiles.storeName })
    .from(sellerProfiles);
  const storeNameByUser = new Map(sellerProfileRows.map((r) => [r.userId, r.storeName]));

  const existing = await db.select({ ownerUserId: workspaces.ownerUserId, type: workspaces.type }).from(workspaces);
  const existingKeys = new Set(existing.map((w) => `${w.ownerUserId}:${w.type}`));

  let sellerCreated = 0;
  let sellerSkipped = 0;
  for (const u of sellerUsers) {
    const key = `${u.id}:seller`;
    if (existingKeys.has(key)) {
      sellerSkipped++;
      continue;
    }
    const displayName = storeNameByUser.get(u.id) || u.displayName || u.email || 'Seller Workspace';
    await db.insert(workspaces).values({
      type: 'seller',
      ownerUserId: u.id,
      displayName,
    });
    sellerCreated++;
  }

  let creatorCreated = 0;
  let creatorSkipped = 0;
  for (const u of creatorUsers) {
    const key = `${u.id}:creator`;
    if (existingKeys.has(key)) {
      creatorSkipped++;
      continue;
    }
    const displayName = u.displayName || u.email || 'Creator Workspace';
    await db.insert(workspaces).values({
      type: 'creator',
      ownerUserId: u.id,
      displayName,
    });
    creatorCreated++;
  }

  console.log('--- Seller workspace backfill ---');
  console.log('eligible seller/verified_seller users:', sellerUsers.length);
  console.log('workspaces created:', sellerCreated);
  console.log('already existed (skipped):', sellerSkipped);

  console.log('--- Creator workspace backfill ---');
  console.log('eligible creator users:', creatorUsers.length);
  console.log('workspaces created:', creatorCreated);
  console.log('already existed (skipped):', creatorSkipped);

  const totalNow = await db.select({ id: workspaces.id }).from(workspaces);
  console.log('total workspaces rows now:', totalNow.length);

  process.exit(0);
}

main().catch((e) => {
  console.error('BACKFILL FAILED:', e);
  process.exit(1);
});
