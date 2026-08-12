/**
 * Dashboard Global Search — role-scoped RBAC probe (API level).
 *
 * Focuses on the security invariant:
 *   Seller/Creator must not resolve arbitrary Choosify CF IDs owned by other accounts.
 */
import { randomBytes } from 'node:crypto';

import {
  formatChoosifyUserId,
  normalizeChoosifyUserIdQuery,
} from '../server/auth/choosifyUserId';

const BASE = (process.env.PROBE_BASE_URL || 'http://localhost:3001/api/v1').replace(/\/$/, '');
const ADMIN_EMAIL = process.env.PROBE_ADMIN_EMAIL || 'admin@choosify.com.bd';
const ADMIN_PASS = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';

type Json = Record<string, unknown>;

async function req(
  method: string,
  path: string,
  opts?: { token?: string; body?: unknown; expect?: number[] },
): Promise<{ status: number; body: Json }> {
  let status = 0;
  let body: Json = {};
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(opts?.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      },
      body: opts?.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    status = res.status;
    const raw = await res.text().catch(() => '');
    if (!raw) {
      body = {} as Json;
    } else {
      try {
        body = JSON.parse(raw) as Json;
      } catch {
        body = { _raw: raw } as unknown as Json;
      }
    }
    if (status !== 429) break;
    await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
  }
  if (opts?.expect && !opts.expect.includes(status)) {
    throw new Error(`${method} ${path} expected ${opts.expect} got ${status}: ${JSON.stringify(body)}`);
  }
  return { status, body };
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function loginAdmin() {
  const adminLogin = await req('POST', '/auth/login', {
    body: { email: ADMIN_EMAIL, password: ADMIN_PASS },
    expect: [200],
  });
  const adminToken = String(adminLogin.body.accessToken || '');
  assert(adminToken, 'missing admin accessToken');

  const adminCf =
    String(adminLogin.body.choosifyUserId || adminLogin.body.choosifyUserIdNormalized || '');
  let adminCfResolved = adminCf;
  if (!adminCfResolved) {
    const me = await req('GET', '/auth/me', { token: adminToken, expect: [200] });
    adminCfResolved = String(me.body.choosifyUserId || '');
  }
  return { adminToken, adminCf: adminCfResolved };
}

async function registerSellerAndGetToken(suffix: string) {
  const sellerEmail = `cf.seller.${suffix}@example.com`;
  const sellerPass = `CfPass1_${suffix}`;

  const sellerOk = await req('POST', '/auth/seller-register', {
    body: {
      email: sellerEmail,
      password: sellerPass,
      displayName: `CF Seller ${suffix}`,
      storeName: `CF Store ${suffix}`,
      phone: '01711111111',
      category: 'Fashion',
      city: 'Dhaka',
    },
    expect: [200, 201],
  });

  const sellerToken = String(sellerOk.body.customToken || sellerOk.body.accessToken || '');
  const sellerCf = String(sellerOk.body.choosifyUserId || '');
  const sellerUid = String(sellerOk.body.uid || '');

  assert(sellerToken, 'missing seller token');
  assert(sellerCf, 'missing seller CF id');
  assert(sellerUid, 'missing seller uid');

  return { sellerToken, sellerCf, sellerUid };
}

function getUserIdGroups(body: any): string[] {
  const groups = body?.groups || [];
  const usersGroup = groups.find((g: any) => g.group === 'Users') as any;
  const items = usersGroup?.items || [];
  return items.map((it: any) => String(it.publicId || it.id || ''));
}

async function main() {
  const results: Array<{ id: string; ok: boolean; detail?: string }> = [];
  const mark = (id: string, ok: boolean, detail?: string) => {
    results.push({ id, ok, detail });
    console.log(`${ok ? 'PASS' : 'FAIL'} ${id}${detail ? ` — ${detail}` : ''}`);
  };

  // Smoke check helper usage
  mark('format-choosify-sample', formatChoosifyUserId(127) === 'CF-00127');

  try {
    const { adminToken } = await loginAdmin();

    const sellerA = await registerSellerAndGetToken(randomBytes(4).toString('hex'));
    const sellerB = await registerSellerAndGetToken(randomBytes(4).toString('hex'));

    // Seller A searches Seller B's CF ID → must NOT resolve Seller B as a User result.
    const resA = await req('GET', `/search?q=${encodeURIComponent(sellerB.sellerCf)}`, {
      token: sellerA.sellerToken,
    });
    const groupsA = (resA.body as any)?.groups || [];
    mark(
      'seller-cannot-resolve-other-seller-cf',
      Array.isArray(groupsA) && groupsA.length === 0,
      `status=${resA.status} body=${JSON.stringify(resA.body)}`,
    );

    // Admin can resolve Seller B's CF ID.
    const resAdmin = await req('GET', `/search?q=${encodeURIComponent(sellerB.sellerCf)}`, {
      token: adminToken,
    });
    const publics = getUserIdGroups(resAdmin.body);
    mark(
      'admin-can-resolve-other-seller-cf',
      publics.includes(sellerB.sellerCf),
      `status=${resAdmin.status} body=${JSON.stringify(resAdmin.body)}`,
    );
  } catch (error) {
    console.error('PROBE FATAL', error);
    process.exitCode = 1;
  }
}

void main();

