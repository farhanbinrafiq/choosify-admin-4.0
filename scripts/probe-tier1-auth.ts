/**
 * One-off Tier 1 auth probe. Does not print secrets.
 * Usage: npx tsx scripts/probe-tier1-auth.ts
 */
import dotenv from 'dotenv';
import { readFileSync, existsSync } from 'fs';
import { getAdminAuth } from '../server/firebaseAdmin';
import firebaseConfig from '../firebase-applet-config.json';

dotenv.config({ path: '.env' });
if (existsSync('.env.local')) {
  dotenv.config({ path: '.env.local', override: true });
}

const hasSa = Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim());
const apiKey =
  process.env.VITE_FIREBASE_API_KEY ||
  process.env.FIREBASE_API_KEY ||
  process.env.VITE_FIREBASE_WEB_API_KEY ||
  firebaseConfig.apiKey ||
  '';

if (!hasSa) {
  console.error('SKIP: FIREBASE_SERVICE_ACCOUNT_JSON not configured');
  process.exit(2);
}
if (!apiKey) {
  console.error('SKIP: Firebase web API key not configured for custom-token exchange');
  process.exit(2);
}

const auth = await getAdminAuth();
if (!auth) {
  console.error('SKIP: getAdminAuth returned null');
  process.exit(3);
}

async function idTokenForEmail(email: string, roleHint: string) {
  let user;
  try {
    user = await auth!.getUserByEmail(email);
  } catch {
    user = await auth!.createUser({
      email,
      emailVerified: true,
      password: `TempProbe!${Date.now()}`,
    });
  }
  const custom = await auth!.createCustomToken(user.uid, { role: roleHint });
  const resp = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: custom, returnSecureToken: true }),
    },
  );
  const data = (await resp.json()) as { idToken?: string };
  if (!data.idToken) {
    throw new Error(`exchange failed for ${email}: ${JSON.stringify(data)}`);
  }
  return { email, uid: user.uid, idToken: data.idToken };
}

const seller = await idTokenForEmail('seller@choosify.com.bd', 'seller');
const admin = await idTokenForEmail('admin@choosify.com.bd', 'super_admin');
const base = 'http://localhost:3001/api/v1';

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

await probe('seller PUT permissions', 'PUT', '/operations/permissions', seller.idToken, {
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
await probe('seller POST fee', 'POST', '/operations/fee-charges', seller.idToken, {
  name: 'seller-probe-fee',
});
await probe('seller PUT payment', 'PUT', '/operations/payment-options', seller.idToken, {
  partialPaymentEnabled: true,
});
await probe('seller PUT flags', 'PUT', '/operations/feature-flags', seller.idToken, {
  flags: { maintenance_mode: false },
});
await probe('seller POST coupon', 'POST', '/operations/coupons', seller.idToken, {
  code: `SELLER_T1_${Date.now()}`,
  type: 'percentage',
  discountValue: 5,
});

await probe('admin PUT permissions', 'PUT', '/operations/permissions', admin.idToken, {
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
await probe('admin POST fee', 'POST', '/operations/fee-charges', admin.idToken, {
  name: `admin-probe-fee-${Date.now()}`,
  rateValue: 1,
});
await probe('admin PUT payment', 'PUT', '/operations/payment-options', admin.idToken, {
  partialPaymentEnabled: true,
  minDepositPercent: 10,
  maxDepositPercent: 50,
});
await probe('admin PUT flags', 'PUT', '/operations/feature-flags', admin.idToken, {
  flags: { maintenance_mode: false },
});
await probe('admin POST coupon', 'POST', '/operations/coupons', admin.idToken, {
  code: `ADMIN_T1_${Date.now()}`,
  type: 'percentage',
  discountValue: 10,
});
