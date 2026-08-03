/**
 * One-off Tier 1 auth probe. Does not print secrets.
 * Usage: npx tsx scripts/probe-tier1-auth.ts
 *
 * Requires seeded Postgres users (npx tsx server/db/seedDevUsers.ts)
 * and a running local server (npm run dev on :3001).
 */
import dotenv from 'dotenv';
import { existsSync } from 'fs';

dotenv.config({ path: '.env' });
if (existsSync('.env.local')) {
  dotenv.config({ path: '.env.local', override: true });
}

const DEV_PASSWORD = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';
const base = process.env.PROBE_BASE_URL || 'http://localhost:3001/api/v1';

async function loginForEmail(email: string) {
  const resp = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: DEV_PASSWORD }),
  });
  const data = (await resp.json()) as { accessToken?: string; error?: string; uid?: string };
  if (!resp.ok || !data.accessToken) {
    throw new Error(`login failed for ${email}: ${resp.status} ${JSON.stringify(data)}`);
  }
  return { email, uid: data.uid || '', accessToken: data.accessToken };
}

const seller = await loginForEmail('seller@choosify.com.bd');
const admin = await loginForEmail('admin@choosify.com.bd');

async function probe(
  label: string,
  method: string,
  path: string,
  token: string,
  body?: unknown,
) {
  const res = await fetch(base + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  console.log(label, '->', res.status, text.slice(0, 140).replace(/\s+/g, ' '));
}

await probe('seller PUT permissions', 'PUT', '/operations/permissions', seller.accessToken, {
  permissions: {
    seller: {
      content: true,
      users: true,
      finance: true,
      brand: true,
      system: true,
      analytics: true,
    },
  },
});
await probe('seller POST fee', 'POST', '/operations/fee-charges', seller.accessToken, {
  name: 'seller-probe-fee',
});
await probe('seller PUT payment', 'PUT', '/operations/payment-options', seller.accessToken, {
  partialPaymentEnabled: true,
});
await probe('seller PUT flags', 'PUT', '/operations/feature-flags', seller.accessToken, {
  flags: { maintenance_mode: false },
});
await probe('seller POST coupon', 'POST', '/operations/coupons', seller.accessToken, {
  code: `SELLER_T1_${Date.now()}`,
  type: 'percentage',
  discountValue: 5,
});

await probe('admin PUT permissions', 'PUT', '/operations/permissions', admin.accessToken, {
  permissions: {
    admin: {
      content: true,
      users: true,
      finance: false,
      brand: true,
      system: true,
      analytics: true,
    },
  },
});
await probe('admin POST fee', 'POST', '/operations/fee-charges', admin.accessToken, {
  name: `admin-probe-fee-${Date.now()}`,
  rateValue: 1,
});
await probe('admin PUT payment', 'PUT', '/operations/payment-options', admin.accessToken, {
  partialPaymentEnabled: true,
  minDepositPercent: 10,
  maxDepositPercent: 50,
});
await probe('admin PUT flags', 'PUT', '/operations/feature-flags', admin.accessToken, {
  flags: { maintenance_mode: false },
});
await probe('admin POST coupon', 'POST', '/operations/coupons', admin.accessToken, {
  code: `ADMIN_T1_${Date.now()}`,
  type: 'percentage',
  discountValue: 10,
});
