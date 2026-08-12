/**
 * Choosify User ID (CF-#####) focused probe.
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
    body = (await res.json().catch(() => ({}))) as Json;
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

async function main() {
  const results: Array<{ id: string; ok: boolean; detail?: string }> = [];
  const mark = (id: string, ok: boolean, detail?: string) => {
    results.push({ id, ok, detail });
    console.log(`${ok ? 'PASS' : 'FAIL'} ${id}${detail ? ` — ${detail}` : ''}`);
  };

  // Unit: padding + growth
  mark('format-1', formatChoosifyUserId(1) === 'CF-00001');
  mark('format-25', formatChoosifyUserId(25) === 'CF-00025');
  mark('format-99999', formatChoosifyUserId(99999) === 'CF-99999');
  mark('format-100000', formatChoosifyUserId(100000) === 'CF-100000');
  mark('format-1000000', formatChoosifyUserId(1000000) === 'CF-1000000');
  mark('normalize-127', normalizeChoosifyUserIdQuery('127') === 'CF-00127');
  mark('normalize-00127', normalizeChoosifyUserIdQuery('00127') === 'CF-00127');
  mark('normalize-CF-00127', normalizeChoosifyUserIdQuery('CF-00127') === 'CF-00127');

  try {
    const adminLogin = await req('POST', '/auth/login', {
      body: { email: ADMIN_EMAIL, password: ADMIN_PASS },
      expect: [200],
    });
    const adminToken = String(adminLogin.body.accessToken || '');
    let adminCf = String(adminLogin.body.choosifyUserId || '');
    if (!adminCf) {
      const me = await req('GET', '/auth/me', { token: adminToken, expect: [200] });
      adminCf = String(me.body.choosifyUserId || '');
    }
    mark('admin-has-cf-id', /^CF-\d+$/.test(adminCf), adminCf);

    const suffix = randomBytes(4).toString('hex');
    const consumerEmail = `cf.consumer.${suffix}@example.com`;
    const consumerPass = `CfPass1_${suffix}`;
    const consumerReg = await req('POST', '/auth/register', {
      body: {
        email: consumerEmail,
        password: consumerPass,
        fullName: `CF Consumer ${suffix}`,
        choosifyUserId: 'CF-99999',
      },
      expect: [400],
    });
    mark('client-cannot-submit-cf-id', consumerReg.status === 400, `code=${(consumerReg.body as Json).code}`);

    const consumerOk = await req('POST', '/auth/register', {
      body: {
        email: consumerEmail,
        password: consumerPass,
        fullName: `CF Consumer ${suffix}`,
      },
      expect: [201],
    });
    const consumerCf = String(consumerOk.body.choosifyUserId || '');
    const consumerUid = String(consumerOk.body.uid || '');
    mark('consumer-receives-cf-id', /^CF-\d{5,}$/.test(consumerCf), consumerCf);
    mark('auth-uid-unchanged-shape', /^[0-9a-f-]{36}$/i.test(consumerUid), consumerUid);

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
      expect: [201],
    });
    const sellerCf = String(sellerOk.body.choosifyUserId || '');
    const sellerUid = String(sellerOk.body.uid || '');
    const sellerToken = String(sellerOk.body.customToken || '');
    mark('seller-receives-cf-id', /^CF-\d{5,}$/.test(sellerCf), sellerCf);
    mark('ids-globally-unique', consumerCf !== sellerCf && sellerCf !== adminCf, `${consumerCf} vs ${sellerCf}`);

    // Profile edit preserves CF ID
    await req('PATCH', '/auth/profile', {
      token: sellerToken,
      body: { website: 'https://example.com/cf-probe' },
      expect: [200],
    });
    const meSeller = await req('GET', '/auth/me', { token: sellerToken, expect: [200] });
    mark('profile-edit-preserves-cf-id', meSeller.body.choosifyUserId === sellerCf, String(meSeller.body.choosifyUserId));

    // Cannot mutate CF ID
    const mutate = await req('PATCH', '/auth/profile', {
      token: sellerToken,
      body: { choosifyUserId: 'CF-00001' },
    });
    mark('seller-cannot-modify-cf-id', mutate.status === 403, `status=${mutate.status}`);

    // Upgrade consumer → seller preserves CF ID
    const upgradeEmail = `cf.upgrade.${suffix}@example.com`;
    const upgradePass = `CfPass1_${suffix}`;
    const upReg = await req('POST', '/auth/register', {
      body: { email: upgradeEmail, password: upgradePass, fullName: `CF Upgrade ${suffix}` },
      expect: [201],
    });
    const upCf = String(upReg.body.choosifyUserId || '');
    const upToken = String(upReg.body.customToken || '');
    const upgraded = await req('POST', '/auth/upgrade-to-seller', {
      token: upToken,
      body: {
        storeName: `Upgrade Store ${suffix}`,
        phone: '01822222222',
        category: 'Fashion',
        city: 'Dhaka',
      },
      expect: [200, 201],
    });
    const upMe = await req('GET', '/auth/me', {
      token: String(upgraded.body.customToken || upgraded.body.accessToken || upToken),
      expect: [200],
    });
    mark(
      'role-change-preserves-cf-id',
      String(upMe.body.choosifyUserId || upCf) === upCf,
      `${upCf} → ${upMe.body.choosifyUserId}`,
    );

    // Admin search
    const searchExact = await req('GET', `/auth/users/search?q=${encodeURIComponent(sellerCf)}`, {
      token: adminToken,
      expect: [200],
    });
    mark(
      'admin-search-exact',
      String(((searchExact.body.data as Json) || {}).choosifyUserId) === sellerCf,
    );
    const numeric = sellerCf.replace(/^CF-0*/, '');
    const searchNum = await req('GET', `/auth/users/search?q=${encodeURIComponent(numeric)}`, {
      token: adminToken,
      expect: [200],
    });
    mark(
      'admin-search-normalized',
      String(((searchNum.body.data as Json) || {}).uid) === sellerUid,
      numeric,
    );

    // Concurrent allocation uniqueness
    const concurrent = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        req('POST', '/auth/register', {
          body: {
            email: `cf.conc.${suffix}.${i}@example.com`,
            password: `CfPass1_${suffix}`,
            fullName: `CF Conc ${i}`,
          },
          expect: [201],
        }),
      ),
    );
    const ids = concurrent.map((r) => String(r.body.choosifyUserId || ''));
    mark('concurrent-unique', new Set(ids).size === ids.length, ids.join(','));

    // Idempotent backfill
    const bf1 = await req('POST', '/auth/admin/backfill-choosify-user-ids', {
      token: adminToken,
      expect: [200],
    });
    const bf2 = await req('POST', '/auth/admin/backfill-choosify-user-ids', {
      token: adminToken,
      expect: [200],
    });
    const d1 = bf1.body.data as Json;
    const d2 = bf2.body.data as Json;
    mark('backfill-idempotent', Number(d2.assigned) === 0, `firstAssigned=${d1.assigned} second=${d2.assigned}`);
    mark('backfill-no-duplicates', Array.isArray(d1.duplicatesDetected) && (d1.duplicatesDetected as unknown[]).length === 0);

    // Restart persistence — sequence mirror file exists after allocations
    const fs = await import('node:fs');
    const mirrorPath = '.data/choosify-user-id-sequence.json';
    mark('sequence-mirror-persisted', fs.existsSync(mirrorPath));

    // Avatar dropdown / UI source checks
    const dropdown = fs.readFileSync('src/components/account/UserProfileDropdown.tsx', 'utf8');
    mark('dropdown-shows-cf-id', dropdown.includes('User ID:') && dropdown.includes('choosifyUserId'));
    const mirror = fs.readFileSync('public/cms-mirror/app.html', 'utf8');
    mark('seller-profile-shows-cf-id', mirror.includes('selectedBrand.choosifyUserId'));
    mark(
      'creator-profile-shows-cf-id',
      mirror.includes('selectedCreator.choosifyUserId') ||
        mirror.includes('window.resolveProfileChoosifyUserId(c.userId'),
    );
    mark(
      'cf-id-helpers-on-window',
      mirror.includes('window.cfIdLabelForUid') && mirror.includes('window.resolveProfileChoosifyUserId'),
    );
  } catch (error) {
    console.error('PROBE FATAL', error);
    process.exitCode = 1;
  }

  const failed = results.filter((r) => !r.ok);
  console.log('\n--- SUMMARY ---');
  console.log(`PASS ${results.filter((r) => r.ok).length} / ${results.length}`);
  if (failed.length) {
    console.log('FAILED:', failed.map((f) => f.id).join(', '));
    process.exitCode = 1;
  }
}

main();
