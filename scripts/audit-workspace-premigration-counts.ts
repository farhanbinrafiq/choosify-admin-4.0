/**
 * READ-ONLY pre-migration reconnaissance for the proposed Workspace/Team &
 * Access schema. Revised per the Phase A review: distinguishes intentional
 * Community/Unclaimed profiles from genuinely broken owner references
 * instead of calling everything "orphaned".
 *
 * No writes. No schema changes. Local dev DB only -- re-run against
 * production before any real migration is authored or applied.
 *
 * Usage: npx tsx scripts/audit-workspace-premigration-counts.ts
 */
import { db } from '../server/db/client';
import { users } from '../server/db/schema';
import { eq } from 'drizzle-orm';
import { catalogStore } from '../lib/vercel-catalog/catalogStore';

async function main() {
  const sellers = await db.select({ id: users.id, email: users.email, role: users.role }).from(users).where(eq(users.role, 'seller'));
  const verifiedSellers = await db.select({ id: users.id, email: users.email, role: users.role }).from(users).where(eq(users.role, 'verified_seller'));
  const creatorsRows = await db.select({ id: users.id, email: users.email, role: users.role }).from(users).where(eq(users.role, 'creator'));
  const allUsers = await db.select({ id: users.id, email: users.email, role: users.role }).from(users);
  const allSellerUsers = [...sellers, ...verifiedSellers];
  const sellerUserIds = new Set(allSellerUsers.map((u) => u.id));
  const creatorUserIds = new Set(creatorsRows.map((u) => u.id));

  console.log('=== Seller/Creator persona counts ===');
  console.log('seller role rows:', sellers.length);
  console.log('verified_seller role rows:', verifiedSellers.length);
  console.log('creator role rows:', creatorsRows.length);
  // "Both personas" isn't representable by a single users.role string today
  // (one row = one role), so the only way a canonical human holds both
  // personas is two DIFFERENT user rows sharing contact identity (same email).
  const sellerEmails = new Set(allSellerUsers.map((u) => u.email?.toLowerCase()).filter(Boolean));
  const dualPersonaCreators = creatorsRows.filter((u) => u.email && sellerEmails.has(u.email.toLowerCase()));
  console.log('creator-role users sharing an email with a seller-role user (possible dual persona via two accounts):', dualPersonaCreators.length);
  console.log('  (users.role is a single string per row -- no row can natively BE both seller and creator today; flagging as an open question, not a count of a real feature.)');

  const brands = await catalogStore.listBrands();
  const catalogCreators = await catalogStore.listCreators();

  console.log('\n=== Brand classification (', brands.length, 'total) ===');
  let A_community = 0, B_ownedValid = 0, D_brokenOwner = 0, E_unknown = 0;
  const brokenSample: any[] = [];
  const communityWithSellerId: any[] = [];
  for (const b of brands as any[]) {
    const claim = b.claimStatus || 'community';
    if (claim === 'community') {
      A_community++;
      if (b.sellerId) communityWithSellerId.push({ brandId: b.id, sellerId: b.sellerId, claimStatus: claim });
      continue;
    }
    // claim === 'verified' or 'pending' -- supposed to be owned
    if (b.sellerId && sellerUserIds.has(b.sellerId)) {
      B_ownedValid++;
    } else if (b.sellerId) {
      D_brokenOwner++;
      if (brokenSample.length < 10) brokenSample.push({ brandId: b.id, sellerId: b.sellerId, claimStatus: claim });
    } else {
      // claimStatus says verified/pending but no sellerId at all -- inconsistent state
      E_unknown++;
    }
  }
  console.log('A. Intentional Community/Unclaimed (claimStatus=community):', A_community);
  console.log('   of which unexpectedly ALSO carry a sellerId (inconsistent, needs review):', communityWithSellerId.length);
  if (communityWithSellerId.length) console.log('   sample:', communityWithSellerId.slice(0, 5));
  console.log('B. Valid owned (claimStatus=verified/pending, sellerId matches a real seller user):', B_ownedValid);
  console.log('D. Broken owner reference (claimStatus=verified/pending, sellerId set but matches NO real user):', D_brokenOwner);
  if (brokenSample.length) console.log('   sample:', brokenSample);
  console.log('E. Unknown/inconsistent (claimStatus=verified/pending, no sellerId at all):', E_unknown);
  console.log('C. Legacy/demo/prototype: NOT separately detectable -- no dedicated field exists in CatalogBrand for this. Any such rows are currently indistinguishable from category A/D above; flagging as a genuine data-model gap, not a count.');

  const brandsPerSeller = new Map<string, number>();
  for (const b of brands as any[]) {
    if (b.claimStatus !== 'community' && b.sellerId && sellerUserIds.has(b.sellerId)) {
      brandsPerSeller.set(b.sellerId, (brandsPerSeller.get(b.sellerId) || 0) + 1);
    }
  }
  console.log('\nBrands-per-Seller distribution (category B only):');
  const dist = new Map<number, number>();
  for (const count of brandsPerSeller.values()) dist.set(count, (dist.get(count) || 0) + 1);
  for (const [count, numSellers] of [...dist.entries()].sort((a, b) => a[0] - b[0])) {
    console.log(`  ${count} brand(s): ${numSellers} seller(s)`);
  }
  const sellersWithZeroBrands = allSellerUsers.filter((u) => !brandsPerSeller.has(u.id));
  console.log('Seller users with ZERO owned (category B) brands:', sellersWithZeroBrands.length);

  console.log('\n=== Creator profile classification (', catalogCreators.length, 'total) ===');
  console.log('NOTE: CatalogCreator has NO claimStatus field (unlike CatalogBrand) -- the');
  console.log('Community/Unclaimed distinction is not yet formally modeled for Creators.');
  console.log('Best-effort classification below uses presence/absence of userId only.');
  let creatorB = 0, creatorD = 0, creatorNoOwnerClaimed = 0;
  const creatorBrokenSample: any[] = [];
  for (const c of catalogCreators as any[]) {
    if (!c.userId) {
      creatorNoOwnerClaimed++; // treated as community/editorial by absence-of-claim convention
      continue;
    }
    if (creatorUserIds.has(c.userId)) {
      creatorB++;
    } else {
      creatorD++;
      if (creatorBrokenSample.length < 10) creatorBrokenSample.push({ profileId: c.id, userId: c.userId });
    }
  }
  console.log('A-equivalent. No userId set (treated as community/editorial by convention, NOT a formal claimStatus):', creatorNoOwnerClaimed);
  console.log('B. Valid owned (userId matches a real creator-role user):', creatorB);
  console.log('D. Broken owner reference (userId set but matches NO real user):', creatorD);
  if (creatorBrokenSample.length) console.log('   sample:', creatorBrokenSample);

  const profilesPerCreatorUser = new Map<string, number>();
  for (const c of catalogCreators as any[]) {
    if (c.userId && creatorUserIds.has(c.userId)) {
      profilesPerCreatorUser.set(c.userId, (profilesPerCreatorUser.get(c.userId) || 0) + 1);
    }
  }
  const creatorsWithZeroProfiles = creatorsRows.filter((u) => !profilesPerCreatorUser.has(u.id));
  console.log('Creator users with ZERO owned profiles:', creatorsWithZeroProfiles.length);
  const creatorsWithMultipleProfiles = [...profilesPerCreatorUser.entries()].filter(([, n]) => n > 1);
  console.log('Creator users owning MORE than one profile:', creatorsWithMultipleProfiles.length);

  console.log('\n=== Duplicate/conflict check ===');
  const suspiciousBrandIds = (brands as any[]).filter((b) => typeof b.sellerId === 'string' && b.sellerId.trim() === '' && b.sellerId !== '');
  console.log('brands with a blank/whitespace-only sellerId (edge case):', suspiciousBrandIds.length);
  console.log('(Brand.sellerId is a single scalar field -- two sellers cannot both claim the same brand row today; no duplicate-owner state is structurally possible pre-migration.)');

  process.exit(0);
}

main().catch((e) => {
  console.error('COUNT SCRIPT FAILED:', e);
  process.exit(1);
});
