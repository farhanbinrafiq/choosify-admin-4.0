/**
 * Seller/Creator left-nav regression probe.
 *
 * Proves:
 * - Seller/Creator baseline page keys are present
 * - Admin-only keys are absent
 * - Entitlement OFF removes the controlled key; ON restores it
 * - Core role keys are not removed because of a missing entitlement mapping
 * - Empty/unresolved entitlement maps do not deny-all (mock/loading)
 * - Failed partner JWT resolution still fail-closes gated pages
 *
 * Run: npx tsx scripts/probe-partner-nav-regression.ts
 */
import {
  ADMIN_ONLY_PAGE_KEYS,
  CREATOR_NAV_GROUPS,
  ROLE_ALLOWED_PAGE_KEYS,
  SELLER_NAV_GROUPS,
  corePageKeysForRole,
  pageKeysFromNavGroups,
} from '../src/cms-mirror/nav';
import { PARTNER_FEATURES } from '../shared/entitlements/registry';
import {
  filterRolePageKeysByEntitlements,
} from '../shared/entitlements/navFilter';
import { pageKeysDisabledByFeatures } from '../shared/entitlements/registry';

const fails: string[] = [];

function assert(cond: unknown, msg: string) {
  if (!cond) fails.push(msg);
}

function sameSet(a: string[], b: string[]) {
  const A = [...a].sort();
  const B = [...b].sort();
  return A.length === B.length && A.every((k, i) => k === B[i]);
}

function main() {
  const sellerKeys = ROLE_ALLOWED_PAGE_KEYS.seller || [];
  const creatorKeys = ROLE_ALLOWED_PAGE_KEYS.creator || [];
  const sellerTree = pageKeysFromNavGroups(SELLER_NAV_GROUPS);
  const creatorTree = pageKeysFromNavGroups(CREATOR_NAV_GROUPS);

  assert(sameSet(sellerKeys, sellerTree), `Seller ROLE_ALLOWED drifted from SELLER_NAV_GROUPS: allow=${sellerKeys.join(',')} tree=${sellerTree.join(',')}`);
  assert(sameSet(creatorKeys, creatorTree), `Creator ROLE_ALLOWED drifted from CREATOR_NAV_GROUPS: allow=${creatorKeys.join(',')} tree=${creatorTree.join(',')}`);

  for (const key of ADMIN_ONLY_PAGE_KEYS) {
    assert(!sellerKeys.includes(key), `Seller allowlist contains admin-only key ${key}`);
    assert(!creatorKeys.includes(key), `Creator allowlist contains admin-only key ${key}`);
  }

  const sellerCore = corePageKeysForRole('seller');
  const creatorCore = corePageKeysForRole('creator');
  assert(sellerCore.includes('dashboard') && sellerCore.includes('settings') && sellerCore.includes('brandProfile'), `Seller core incomplete: ${sellerCore.join(',')}`);
  assert(creatorCore.includes('dashboard') && creatorCore.includes('settings') && creatorCore.includes('creatorProfile'), `Creator core incomplete: ${creatorCore.join(',')}`);

  // Mock / loading: empty entitlements must NOT strip gated (or core) keys.
  for (const status of ['idle', 'mock', 'loading'] as const) {
    const sellerKept = filterRolePageKeysByEntitlements({
      roleKeys: sellerKeys,
      partnerRole: 'seller',
      entitlements: {},
      status,
    });
    const creatorKept = filterRolePageKeysByEntitlements({
      roleKeys: creatorKeys,
      partnerRole: 'creator',
      entitlements: {},
      status,
    });
    assert(sameSet(sellerKept || [], sellerKeys), `Seller ${status} stripped keys: ${(sellerKept || []).join(',')}`);
    assert(sameSet(creatorKept || [], creatorKeys), `Creator ${status} stripped keys: ${(creatorKept || []).join(',')}`);
  }

  // Missing mapping after successful payload: empty {} must not hide unmapped/core keys.
  // pageKeysDisabledByFeatures only hides enabled===false, so {} hides nothing.
  const readyEmptySeller = filterRolePageKeysByEntitlements({
    roleKeys: sellerKeys,
    partnerRole: 'seller',
    entitlements: {},
    status: 'ready',
  });
  assert(sameSet(readyEmptySeller || [], sellerKeys), 'Ready + missing map must not hide Seller nav');
  for (const k of sellerCore) {
    assert((readyEmptySeller || []).includes(k), `Core seller key ${k} hidden by missing entitlement mapping`);
  }

  // Explicit OFF hides only that feature's page keys.
  const cashbooksOff = filterRolePageKeysByEntitlements({
    roleKeys: sellerKeys,
    partnerRole: 'seller',
    entitlements: { cashbooks: false },
    status: 'ready',
  });
  assert(!(cashbooksOff || []).includes('myCashbook'), 'cashbooks OFF must hide myCashbook');
  assert((cashbooksOff || []).includes('dashboard'), 'cashbooks OFF must not hide dashboard');
  assert((cashbooksOff || []).includes('products'), 'cashbooks OFF must not hide products');
  assert((cashbooksOff || []).includes('brandProfile'), 'cashbooks OFF must not hide Seller Profile');

  const cashbooksOn = filterRolePageKeysByEntitlements({
    roleKeys: sellerKeys,
    partnerRole: 'seller',
    entitlements: { cashbooks: true },
    status: 'ready',
  });
  assert((cashbooksOn || []).includes('myCashbook'), 'cashbooks ON must restore myCashbook');

  const creatorEconomyOff = filterRolePageKeysByEntitlements({
    roleKeys: creatorKeys,
    partnerRole: 'creator',
    entitlements: { creatorEconomy: false },
    status: 'ready',
  });
  assert(!(creatorEconomyOff || []).includes('creatorEconomy'), 'creatorEconomy OFF must hide Creator Economy');
  assert((creatorEconomyOff || []).includes('creators'), 'creatorEconomy OFF must not hide Creator Studio');
  assert((creatorEconomyOff || []).includes('creatorProfile'), 'creatorEconomy OFF must not hide Creator Profile');

  const creatorEconomyOn = filterRolePageKeysByEntitlements({
    roleKeys: creatorKeys,
    partnerRole: 'creator',
    entitlements: { creatorEconomy: true },
    status: 'ready',
  });
  assert((creatorEconomyOn || []).includes('creatorEconomy'), 'creatorEconomy ON must restore Creator Economy');

  // Failed partner JWT: gated pages hidden, core remains.
  const sellerFailed = filterRolePageKeysByEntitlements({
    roleKeys: sellerKeys,
    partnerRole: 'seller',
    entitlements: {},
    status: 'failed',
  });
  const sellerDisabled = pageKeysDisabledByFeatures(
    'seller',
    Object.fromEntries(PARTNER_FEATURES.filter((f) => f.roles.includes('seller')).map((f) => [f.key, false])),
  );
  for (const k of sellerCore) {
    assert((sellerFailed || []).includes(k), `Failed fetch must keep seller core ${k}`);
  }
  for (const k of sellerDisabled) {
    assert(!(sellerFailed || []).includes(k), `Failed fetch must hide gated seller ${k}`);
  }

  // Admin unrestricted.
  const adminKeys = filterRolePageKeysByEntitlements({
    roleKeys: null,
    partnerRole: null,
    entitlements: {},
    status: 'ready',
  });
  assert(adminKeys === null, 'Admin filter must remain unrestricted (null)');

  if (fails.length) {
    console.error('FAIL probe-partner-nav-regression');
    for (const f of fails) console.error(' -', f);
    process.exit(1);
  }
  console.log('PASS probe-partner-nav-regression');
  console.log(JSON.stringify({
    sellerBaseline: sellerKeys,
    sellerCore,
    creatorBaseline: creatorKeys,
    creatorCore,
    sellerCategories: SELLER_NAV_GROUPS.map((g) => g.title),
    creatorCategories: CREATOR_NAV_GROUPS.map((g) => g.title),
  }, null, 2));
}

main();
