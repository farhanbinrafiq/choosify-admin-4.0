/**
 * Closed Beta seed script — creates synthetic tester accounts covering every
 * role/state combination the Sprint 12 beta gate exercises, using the REAL
 * partner-apply → admin-approve HTTP flow (not direct DB writes), so the
 * resulting accounts are indistinguishable from a real tester walking
 * through onboarding.
 *
 * Run AFTER: `npx tsx server/db/seedDevUsers.ts` (staff personas) and
 * `npm run seed:catalog` (baseline catalog) have already been run against
 * the target database.
 *
 * Usage:
 *   BETA_API_BASE_URL=https://api-beta.choosify.bd \
 *   BETA_TESTER_PASSWORD='pick-a-real-password' \
 *   npx tsx scripts/seed-beta-personas.ts
 *
 * BETA_API_BASE_URL and BETA_TESTER_PASSWORD are both required — this script
 * refuses to guess a target or fall back to a guessable shared password.
 * http://localhost:3001 (or any 127.0.0.1 address) is accepted for local
 * dry runs; any known Production Choosify domain is refused outright, see
 * assertSafeTarget() below.
 */

/**
 * Safety guard — this script performs real account-creation and brand-
 * mutation writes, so it must never be able to reach Production even if
 * BETA_API_BASE_URL is set incorrectly (e.g. copy-pasted from the wrong
 * place). Extend this list if new production hostnames are added.
 */
const PRODUCTION_HOSTS = new Set([
  'choosify.bd',
  'www.choosify.bd',
  'api.choosify.bd',
  'dashboard.choosify.bd',
]);

function assertSafeTarget(rawBase: string | undefined): string {
  if (!rawBase || !rawBase.trim()) {
    throw new Error(
      'BETA_API_BASE_URL is required (e.g. https://api-beta.choosify.bd, or ' +
        'http://localhost:3001 for a local dry run). Refusing to guess a target.',
    );
  }
  let url: URL;
  try {
    url = new URL(rawBase.trim());
  } catch {
    throw new Error(`BETA_API_BASE_URL is not a valid URL: "${rawBase}"`);
  }
  const host = url.hostname.toLowerCase();
  if (PRODUCTION_HOSTS.has(host)) {
    throw new Error(
      `Refusing to run: "${host}" is a known Production Choosify domain. ` +
        'This script creates and mutates real accounts/brands and must only ' +
        'target an isolated beta/staging environment.',
    );
  }
  return rawBase.trim().replace(/\/$/, '');
}

const BASE = assertSafeTarget(process.env.BETA_API_BASE_URL);
const V1 = `${BASE}/api/v1`;
const ADMIN_EMAIL = 'admin@choosify.com.bd';
const ADMIN_PASS = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';
const BETA_PASSWORD = process.env.BETA_TESTER_PASSWORD;
if (!BETA_PASSWORD || !BETA_PASSWORD.trim()) {
  throw new Error(
    'BETA_TESTER_PASSWORD is required — pick a real password for the seeded ' +
      'beta tester accounts. Refusing to fall back to a hardcoded, ' +
      'publicly-visible-in-source default.',
  );
}

type Json = Record<string, unknown>;

async function post(path: string, body: unknown, token?: string) {
  const res = await fetch(`${V1}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Json;
  return { ok: res.ok, status: res.status, data };
}

async function patch(path: string, body: unknown, token: string) {
  const res = await fetch(`${V1}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Json;
  return { ok: res.ok, status: res.status, data };
}

async function approveApplication(applicationId: string, token: string) {
  const res = await post(`/operations/partner-applications/${applicationId}/approve`, {}, token);
  return res;
}

async function login(email: string, password: string): Promise<string> {
  const res = await post('/auth/login', { email, password });
  if (!res.ok || typeof res.data.accessToken !== 'string') {
    throw new Error(`login failed for ${email}: ${res.status} ${JSON.stringify(res.data)}`);
  }
  return res.data.accessToken as string;
}

function log(label: string, ok: boolean, detail?: unknown) {
  console.log(ok ? 'OK  ' : 'FAIL', label, ok ? '' : JSON.stringify(detail));
}

async function main() {
  console.log(`Seeding beta personas against ${BASE}\n`);
  const stamp = Date.now();
  const adminToken = await login(ADMIN_EMAIL, ADMIN_PASS);
  log('admin login', true);

  // --- Pending Seller (left un-approved, to exercise the pending state) ---
  const pendingSellerEmail = `beta-pending-seller-${stamp}@testers.choosify.bd`;
  const pendingSellerApply = await post('/auth/partner-apply', {
    applicantType: 'seller',
    email: pendingSellerEmail,
    displayName: 'Beta Pending Seller',
    businessOrChannelName: 'Pending Beta Storefront',
    phone: '01700000001',
    category: 'fashion',
    city: 'Dhaka',
    password: BETA_PASSWORD,
  });
  log('pending seller: partner-apply', pendingSellerApply.ok, pendingSellerApply.data);

  // --- Approved Seller, Marketplace Access ON ---
  const approvedSellerOnEmail = `beta-approved-seller-mpon-${stamp}@testers.choosify.bd`;
  const approvedSellerOnApply = await post('/auth/partner-apply', {
    applicantType: 'seller',
    email: approvedSellerOnEmail,
    displayName: 'Beta Approved Seller (MP On)',
    businessOrChannelName: 'Approved Beta Storefront A',
    phone: '01700000002',
    category: 'electronics',
    city: 'Dhaka',
    password: BETA_PASSWORD,
  });
  log('approved seller (MP on): partner-apply', approvedSellerOnApply.ok, approvedSellerOnApply.data);
  const approvedSellerOnAppId = approvedSellerOnApply.data.applicationId as string | undefined;
  if (approvedSellerOnAppId) {
    const approve = await approveApplication(approvedSellerOnAppId, adminToken);
    log('approved seller (MP on): admin approve', approve.ok, approve.data);
    const brandId = (approve.data as { application?: { catalogEntityId?: string } }).application?.catalogEntityId;
    if (brandId) {
      const mpOn = await patch(`/catalog/brands/${brandId}`, { marketplaceAccess: true }, adminToken);
      log('approved seller (MP on): enable Marketplace Access', mpOn.ok, mpOn.data);
    }
  }

  // --- Approved Seller, Marketplace Access OFF (approved but not yet marketplace-visible) ---
  const approvedSellerOffEmail = `beta-approved-seller-mpoff-${stamp}@testers.choosify.bd`;
  const approvedSellerOffApply = await post('/auth/partner-apply', {
    applicantType: 'seller',
    email: approvedSellerOffEmail,
    displayName: 'Beta Approved Seller (MP Off)',
    businessOrChannelName: 'Approved Beta Storefront B',
    phone: '01700000003',
    category: 'home-goods',
    city: 'Chattogram',
    password: BETA_PASSWORD,
  });
  log('approved seller (MP off): partner-apply', approvedSellerOffApply.ok, approvedSellerOffApply.data);
  const approvedSellerOffAppId = approvedSellerOffApply.data.applicationId as string | undefined;
  if (approvedSellerOffAppId) {
    const approve = await approveApplication(approvedSellerOffAppId, adminToken);
    log('approved seller (MP off): admin approve (Marketplace Access left off)', approve.ok, approve.data);
  }

  // --- Pending Creator ---
  const pendingCreatorEmail = `beta-pending-creator-${stamp}@testers.choosify.bd`;
  const pendingCreatorApply = await post('/auth/partner-apply', {
    applicantType: 'creator',
    email: pendingCreatorEmail,
    displayName: 'Beta Pending Creator',
    businessOrChannelName: 'Pending Beta Channel',
    phone: '01700000004',
    category: 'lifestyle',
    city: 'Dhaka',
    password: BETA_PASSWORD,
  });
  log('pending creator: partner-apply', pendingCreatorApply.ok, pendingCreatorApply.data);

  // --- Approved Creator ---
  const approvedCreatorEmail = `beta-approved-creator-${stamp}@testers.choosify.bd`;
  const approvedCreatorApply = await post('/auth/partner-apply', {
    applicantType: 'creator',
    email: approvedCreatorEmail,
    displayName: 'Beta Approved Creator',
    businessOrChannelName: 'Approved Beta Channel',
    phone: '01700000005',
    category: 'tech-reviews',
    city: 'Sylhet',
    password: BETA_PASSWORD,
  });
  log('approved creator: partner-apply', approvedCreatorApply.ok, approvedCreatorApply.data);
  const approvedCreatorAppId = approvedCreatorApply.data.applicationId as string | undefined;
  if (approvedCreatorAppId) {
    const approve = await approveApplication(approvedCreatorAppId, adminToken);
    log('approved creator: admin approve', approve.ok, approve.data);
  }

  // --- Plain Consumer ---
  const consumerEmail = `beta-consumer-${stamp}@testers.choosify.bd`;
  const consumerRegister = await post('/auth/register', {
    email: consumerEmail,
    password: BETA_PASSWORD,
    fullName: 'Beta Consumer',
  });
  log('consumer: register', consumerRegister.ok, consumerRegister.data);

  console.log('\n=== BETA TESTER ACCOUNTS (shared password unless noted) ===');
  console.log(`Password for all tester accounts below: ${BETA_PASSWORD}`);
  console.log(`Admin/staff accounts already exist from seedDevUsers.ts (password: ${ADMIN_PASS})`);
  console.log(`  Pending Seller:              ${pendingSellerEmail}`);
  console.log(`  Approved Seller (MP ON):     ${approvedSellerOnEmail}`);
  console.log(`  Approved Seller (MP OFF):    ${approvedSellerOffEmail}`);
  console.log(`  Pending Creator:             ${pendingCreatorEmail}`);
  console.log(`  Approved Creator:            ${approvedCreatorEmail}`);
  console.log(`  Consumer:                    ${consumerEmail}`);
  console.log('\nDone. Review any FAIL lines above before inviting testers.');
}

main().catch((err) => {
  console.error('CRASH', err);
  process.exit(1);
});
