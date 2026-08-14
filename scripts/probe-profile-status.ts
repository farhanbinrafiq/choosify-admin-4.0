/**
 * In-process resolver UAT — does not start or kill the API.
 * Usage: npx tsx scripts/probe-profile-status.ts
 */
import {
  kindFromRole,
  resolveProfileStatus,
  type ProfileStatusFacts,
} from '../src/lib/profileStatus';

let failed = 0;
function assert(condition: boolean, label: string, detail?: unknown) {
  if (condition) console.log('PASS', label);
  else {
    failed += 1;
    console.log('FAIL', label, detail ?? '');
  }
}

function primary(facts: ProfileStatusFacts) {
  return resolveProfileStatus(facts);
}

console.log('\n=== Universal profile-status resolver ===');

assert(kindFromRole('seller') === 'seller', 'kindFromRole seller');
assert(kindFromRole('creator') === 'creator', 'kindFromRole creator');
assert(kindFromRole('user') === 'consumer', 'kindFromRole consumer');
assert(kindFromRole('super_admin') === 'admin', 'kindFromRole super_admin');

const pendingSeller = primary({
  kind: 'seller',
  partnerApplicationStatus: 'pending',
  identityVerified: false,
  marketplaceAccess: false,
  marketplaceStatus: 'not_granted',
});
assert(pendingSeller.primary === 'UNDER_REVIEW', 'pending seller → UNDER_REVIEW', pendingSeller);
assert(!pendingSeller.secondary.includes('VERIFIED'), 'pending seller is not VERIFIED');

const rejected = primary({
  kind: 'seller',
  partnerApplicationStatus: 'rejected',
  identityVerified: false,
  marketplaceAccess: false,
});
assert(rejected.primary === 'REJECTED', 'rejected seller → REJECTED');

const verifiedOff = primary({
  kind: 'seller',
  partnerApplicationStatus: 'approved',
  identityVerified: true,
  verifiedStatus: true,
  claimStatus: 'verified',
  marketplaceAccess: false,
  marketplaceStatus: 'not_granted',
});
assert(verifiedOff.primary === 'ACTIVE', 'identity approved, marketplace off → ACTIVE primary', verifiedOff);
assert(
  verifiedOff.secondary.includes('VERIFIED')
    && verifiedOff.secondary.includes('VERIFIED_OWNER')
    && verifiedOff.secondary.includes('MARKETPLACE_ACCESS_OFF'),
  'identity approved, marketplace off → VERIFIED + VERIFIED OWNER + MARKETPLACE ACCESS OFF',
  verifiedOff.secondary,
);

const pendingClaim = primary({
  kind: 'seller',
  partnerApplicationStatus: 'approved',
  identityVerified: true,
  verifiedStatus: true,
  claimStatus: 'pending',
  ownershipClaimPending: true,
  marketplaceAccess: false,
  marketplaceStatus: 'not_granted',
});
assert(pendingClaim.primary === 'UNDER_REVIEW', 'pending ownership claim → UNDER_REVIEW');
assert(pendingClaim.secondary.includes('OWNERSHIP_CLAIM_PENDING'), 'pending ownership claim → OWNERSHIP CLAIM PENDING');
assert(!pendingClaim.secondary.includes('VERIFIED_OWNER'), 'pending ownership claim is not VERIFIED OWNER');

const rejectedClaimDoesNotRejectAccount = primary({
  kind: 'seller',
  partnerApplicationStatus: 'approved',
  identityVerified: true,
  verifiedStatus: true,
  claimStatus: 'community',
  ownershipClaimPending: false,
  marketplaceAccess: false,
  marketplaceStatus: 'not_granted',
});
assert(rejectedClaimDoesNotRejectAccount.primary === 'ACTIVE', 'rejected ownership claim does not mark account REJECTED');
assert(!rejectedClaimDoesNotRejectAccount.secondary.includes('VERIFIED_OWNER'), 'rejected claim is not VERIFIED OWNER');

const pendingCreatorClaim = primary({
  kind: 'creator',
  partnerApplicationStatus: 'approved',
  identityVerified: true,
  ownershipClaimPending: true,
  creatorCatalogStatus: 'live',
  marketplaceAccess: true,
});
assert(pendingCreatorClaim.primary === 'UNDER_REVIEW', 'pending creator ownership claim → UNDER_REVIEW');
assert(pendingCreatorClaim.secondary.includes('OWNERSHIP_CLAIM_PENDING'), 'pending creator claim → OWNERSHIP CLAIM PENDING');

const live = primary({
  kind: 'seller',
  partnerApplicationStatus: 'approved',
  identityVerified: true,
  verifiedStatus: true,
  marketplaceAccess: true,
  marketplaceStatus: 'granted',
});
assert(live.primary === 'ACTIVE' && live.secondary.includes('VERIFIED'), 'marketplace enabled → ACTIVE + VERIFIED');
assert(!live.secondary.includes('MARKETPLACE_ACCESS_OFF'), 'enabled marketplace is not ACCESS OFF');

const suspended = primary({
  kind: 'seller',
  partnerApplicationStatus: 'approved',
  identityVerified: true,
  marketplaceAccess: false,
  marketplaceStatus: 'suspended',
});
assert(suspended.primary === 'SUSPENDED', 'suspended marketplace → SUSPENDED');
assert(!suspended.secondary.includes('MARKETPLACE_ACCESS_OFF'), 'suspended does not also show ACCESS OFF');

const banned = primary({
  kind: 'seller',
  partnerApplicationStatus: 'approved',
  identityVerified: true,
  marketplaceStatus: 'revoked',
  marketplaceAccess: false,
});
assert(banned.primary === 'BANNED', 'revoked marketplace → BANNED');

const pendingCreator = primary({
  kind: 'creator',
  partnerApplicationStatus: 'pending',
  creatorCatalogStatus: 'draft',
  marketplaceAccess: false,
});
assert(pendingCreator.primary === 'UNDER_REVIEW', 'pending creator → UNDER_REVIEW');

const liveCreator = primary({
  kind: 'creator',
  partnerApplicationStatus: 'approved',
  identityVerified: true,
  verifiedStatus: true,
  creatorCatalogStatus: 'live',
  marketplaceAccess: true,
});
assert(liveCreator.primary === 'ACTIVE' && liveCreator.secondary.includes('VERIFIED'), 'live creator → ACTIVE + VERIFIED');

const archivedCreator = primary({
  kind: 'creator',
  partnerApplicationStatus: 'approved',
  identityVerified: true,
  creatorCatalogStatus: 'archived',
  marketplaceAccess: false,
});
assert(archivedCreator.primary === 'INACTIVE', 'archived creator → INACTIVE');

const consumer = primary({ kind: 'consumer' });
assert(consumer.primary === 'ACTIVE', 'consumer → ACTIVE');
assert(consumer.secondary.length === 0, 'consumer has no marketplace secondary');

const admin = primary({ kind: 'admin' });
assert(admin.primary === 'ACTIVE', 'admin → ACTIVE');
assert(admin.secondary.length === 0, 'admin has no VERIFIED status badge');

const entitlementMustNotMatter = primary({
  kind: 'seller',
  partnerApplicationStatus: 'approved',
  identityVerified: true,
  marketplaceAccess: true,
  marketplaceStatus: 'granted',
});
assert(entitlementMustNotMatter.primary === 'ACTIVE', 'feature entitlements are not an input — ACTIVE stays ACTIVE');

console.log('\n=== Profile-status probe DONE ===');
if (failed > 0) {
  console.error(`FAILED ${failed} assertion(s)`);
  process.exit(1);
}
console.log('ALL PROFILE-STATUS PROBES PASSED');
