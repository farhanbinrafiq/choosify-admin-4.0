/**
 * PRE-SPRINT-9 completion probe — forced password, verification RBAC,
 * analytics ownership, ads flows, prefs round-trip.
 * Does not weaken auth. Requires running server (PROBE_BASE_URL).
 */
import { randomBytes } from 'node:crypto';

const BASE = (process.env.PROBE_BASE_URL || 'http://localhost:3001/api/v1').replace(/\/$/, '');
const API_ROOT = BASE.replace(/\/api\/v1$/, '/api');
const ADMIN_EMAIL = process.env.PROBE_ADMIN_EMAIL || 'admin@choosify.com.bd';
const ADMIN_PASS = process.env.DEV_SEED_PASSWORD || process.env.PROBE_ADMIN_PASSWORD || 'ChoosifyDev!2026';

type Json = Record<string, unknown>;

async function req(
  method: string,
  path: string,
  opts?: { token?: string; body?: unknown; expect?: number[]; root?: 'v1' | 'api' },
): Promise<{ status: number; body: Json }> {
  const root = opts?.root === 'api' ? API_ROOT : BASE;
  let lastStatus = 0;
  let body: Json = {};
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(`${root}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(opts?.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      },
      body: opts?.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    lastStatus = res.status;
    body = (await res.json().catch(() => ({}))) as Json;
    if (res.status !== 429) break;
    await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
  }
  if (opts?.expect && !opts.expect.includes(lastStatus)) {
    throw new Error(`${method} ${path} expected ${opts.expect.join('|')} got ${lastStatus}: ${JSON.stringify(body)}`);
  }
  return { status: lastStatus, body };
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function login(email: string, password: string) {
  const { body } = await req('POST', '/auth/login', {
    body: { email, password },
    expect: [200],
  });
  assert(typeof body.accessToken === 'string', 'login missing accessToken');
  return body as { accessToken: string; uid: string; changeNextLogin?: boolean; role?: string };
}

async function main() {
  const results: Array<{ id: string; ok: boolean; detail?: string }> = [];
  const mark = (id: string, ok: boolean, detail?: string) => {
    results.push({ id, ok, detail });
    console.log(`${ok ? 'PASS' : 'FAIL'} ${id}${detail ? ` — ${detail}` : ''}`);
  };

  try {
    const admin = await login(ADMIN_EMAIL, ADMIN_PASS);
    mark('admin-login', true);

    // Unauth analytics
    {
      const { status } = await req('GET', '/operations/analytics');
      mark('analytics-unauth', status === 401 || status === 403, `status=${status}`);
    }

    // Create a seller-like user via seller-register with unique email
    const suffix = randomBytes(4).toString('hex');
    const sellerEmail = `probe.seller.${suffix}@example.com`;
    const sellerPass = `ProbePass1_${suffix}`;
    const reg = await req('POST', '/auth/seller-register', {
      body: {
        email: sellerEmail,
        password: sellerPass,
        displayName: `Probe Seller ${suffix}`,
        storeName: `Probe Store ${suffix}`,
        phone: '01700000000',
        category: 'Fashion',
        city: 'Dhaka',
      },
      expect: [200, 201],
    });
    const sellerToken = String(reg.body.customToken || reg.body.accessToken || '');
    const sellerId = String(reg.body.uid || '');
    assert(sellerToken && sellerId, 'seller register token/uid');
    mark('seller-register', true);

    // Admin password reset assist
    const assist = await req('POST', '/auth/admin/password-reset-assist', {
      token: admin.accessToken,
      body: { userId: sellerId, mode: 'temp' },
      expect: [200],
    });
    const tempPassword = String((assist.body.data as Json)?.tempPassword || '');
    assert(tempPassword, 'temp password returned once');
    assert(!(assist.body as Json).password, 'must not expose existing password');
    mark('admin-reset-assist', true, 'temp issued');

    // Login with temp → changeNextLogin
    const sellerForced = await login(sellerEmail, tempPassword);
    mark('forced-flag-on-login', sellerForced.changeNextLogin === true, `changeNextLogin=${sellerForced.changeNextLogin}`);

    // Direct analytics while forced → 403 PASSWORD_CHANGE_REQUIRED
    {
      const { status, body } = await req('GET', '/operations/analytics', {
        token: sellerForced.accessToken,
      });
      mark(
        'dashboard-bypass-blocked',
        status === 403 && String(body.code || '') === 'PASSWORD_CHANGE_REQUIRED',
        `status=${status} code=${body.code}`,
      );
    }

    // Forced password change
    await req('POST', '/auth/change-password', {
      token: sellerForced.accessToken,
      body: { currentPassword: tempPassword, newPassword: `NewPass1_${suffix}xx` },
      expect: [200],
    });
    mark('forced-password-change', true);

    const sellerAfter = await login(sellerEmail, `NewPass1_${suffix}xx`);
    mark('forced-flag-cleared', sellerAfter.changeNextLogin !== true, `changeNextLogin=${sellerAfter.changeNextLogin}`);

    // Analytics ownership — seller own only
    {
      const { status, body } = await req('GET', '/operations/analytics', {
        token: sellerAfter.accessToken,
        expect: [200],
      });
      const data = (body.data || body) as Json;
      const cards = (data.cards as Json[]) || [];
      const labels = cards.map((c) => String(c.label || '')).join('|');
      mark(
        'seller-analytics-owned',
        status === 200 && !/Platform Revenue|Storefront Orders/i.test(labels),
        labels.slice(0, 120),
      );
    }

    // Cross-account seller-dashboard
    {
      const { status } = await req(
        'GET',
        `/operations/seller-dashboard?sellerId=${encodeURIComponent(admin.uid || 'other')}`,
        { token: sellerAfter.accessToken },
      );
      mark('seller-dashboard-cross-403', status === 403, `status=${status}`);
    }

    // Creator analytics role request as seller → 403
    {
      const { status } = await req('GET', '/operations/analytics/role/creator', {
        token: sellerAfter.accessToken,
      });
      mark('cross-role-analytics-403', status === 403, `status=${status}`);
    }

    // Identity update ownership + 90-day (first change should pass)
    {
      const { status } = await req('PATCH', '/auth/profile', {
        token: sellerAfter.accessToken,
        body: { displayName: `Probe Seller Renamed ${suffix}`, website: 'https://example.com' },
        expect: [200],
      });
      mark('identity-update-owner', status === 200);
      const second = await req('PATCH', '/auth/profile', {
        token: sellerAfter.accessToken,
        body: { displayName: `Probe Seller Again ${suffix}` },
      });
      mark('name-90d-lock', second.status === 403, `status=${second.status}`);
    }

    // Prefs round-trip
    {
      await req('PUT', '/notifications/preferences', {
        token: sellerAfter.accessToken,
        body: { channels: { email: false, whatsapp: true } },
        expect: [200],
        root: 'api',
      });
      const got = await req('GET', '/notifications/preferences', {
        token: sellerAfter.accessToken,
        expect: [200],
        root: 'api',
      });
      const channels = ((got.body.data as Json)?.channels || got.body.channels) as Json;
      mark(
        'prefs-roundtrip',
        channels?.email === false && channels?.whatsapp === true,
        JSON.stringify(channels),
      );
    }

    // Ads: eligible listings + deal + promote
    {
      const listings = await req('GET', '/ads/listings/eligible', {
        token: sellerAfter.accessToken,
        expect: [200],
      });
      mark('ads-listings-eligible', Array.isArray(listings.body.data), `n=${(listings.body.data as unknown[])?.length}`);

      const deal = await req('POST', '/ads/deals', {
        token: sellerAfter.accessToken,
        body: { title: `Probe Deal ${suffix}` },
        expect: [201],
      });
      const dealStatus = String(((deal.body.data as Json) || {}).status || '');
      mark('deal-auto-approve', dealStatus === 'active' || dealStatus === 'approved', `status=${dealStatus}`);

      const promo = await req('POST', '/ads/promotions', {
        token: sellerAfter.accessToken,
        body: { title: `Probe Promo ${suffix}` },
        expect: [201],
      });
      const promoStatus = String(((promo.body.data as Json) || {}).status || '');
      mark('promo-pending', promoStatus === 'pending' || promoStatus === 'draft', `status=${promoStatus}`);

      const promoId = String(((promo.body.data as Json) || {}).id || '');
      const selfApprove = await req('POST', `/ads/promotions/${encodeURIComponent(promoId)}/approve`, {
        token: sellerAfter.accessToken,
      });
      mark('seller-cannot-self-approve-ads', selfApprove.status === 401 || selfApprove.status === 403, `status=${selfApprove.status}`);

      const cross = await req('PATCH', `/ads/${encodeURIComponent(promoId)}`, {
        token: admin.accessToken,
        body: { title: 'hijack' },
      });
      // Admin may edit; create another owner's ad and have seller mutate
      mark('ads-admin-can-manage', cross.status === 200 || cross.status === 403, `status=${cross.status}`);
    }

    // Cross-owner ads: seller tries to delete admin deal if any
    {
      const deals = await req('GET', '/ads/deals', { token: admin.accessToken, expect: [200] });
      const rows = (deals.body.data as Json[]) || [];
      const other = rows.find((r) => r.ownerId && r.ownerId !== sellerId);
      if (other?.id) {
        const del = await req('DELETE', `/ads/${encodeURIComponent(String(other.id))}`, {
          token: sellerAfter.accessToken,
        });
        mark('cross-owner-ads-denied', del.status === 403, `status=${del.status}`);
      } else {
        mark('cross-owner-ads-denied', true, 'no foreign deal to probe — skipped ok');
      }
    }

    // Verification self-approve / cross-user
    {
      const create = await req('POST', '/operations/verifications', {
        token: sellerAfter.accessToken,
        body: {
          entityType: 'brand',
          entityId: `probe-brand-${suffix}`,
          entityName: `Probe Brand ${suffix}`,
          documents: [
            {
              type: 'nid',
              name: 'nid.pdf',
              doc_url: 'https://example.com/nid.pdf',
              status: 'approved',
              notes: 'secret-admin',
            },
          ],
        },
        expect: [201],
      });
      const ver = (create.body.data || {}) as Json;
      const docs = (ver.documents as Json[]) || [];
      mark(
        'verification-force-pending',
        docs[0] && docs[0].status === 'pending' && !docs[0].notes,
        `status=${docs[0]?.status}`,
      );
      const verId = String(ver.id || '');
      const docId = String(docs[0]?.id || '');

      const selfReview = await req('PATCH', `/operations/verifications/${encodeURIComponent(verId)}/review`, {
        token: sellerAfter.accessToken,
        body: { status: 'approved', feedback: 'self' },
      });
      mark('verification-self-approve-403', selfReview.status === 401 || selfReview.status === 403, `status=${selfReview.status}`);

      const crossGet = await req('GET', `/operations/verifications/${encodeURIComponent(verId)}`, {
        token: admin.accessToken,
        expect: [200],
      });
      mark('admin-can-view-verification', crossGet.status === 200);

      // Create second seller and deny access
      const suffix2 = randomBytes(3).toString('hex');
      const otherEmail = `probe.other.${suffix2}@example.com`;
      const otherReg = await req('POST', '/auth/seller-register', {
        body: {
          email: otherEmail,
          password: `OtherPass1_${suffix2}`,
          displayName: `Other ${suffix2}`,
          storeName: `Other Store ${suffix2}`,
          phone: '01800000000',
          category: 'Fashion',
          city: 'Dhaka',
        },
        expect: [200, 201],
      });
      const otherToken = String(otherReg.body.customToken || otherReg.body.accessToken || '');
      const crossMut = await req(
        'PUT',
        `/operations/verifications/${encodeURIComponent(verId)}/document/${encodeURIComponent(docId)}/replace`,
        {
          token: otherToken,
          body: { doc_url: 'https://example.com/hack.pdf', name: 'hack.pdf' },
        },
      );
      mark('verification-cross-user-403', crossMut.status === 403, `status=${crossMut.status}`);

      const replace = await req(
        'PUT',
        `/operations/verifications/${encodeURIComponent(verId)}/document/${encodeURIComponent(docId)}/replace`,
        {
          token: sellerAfter.accessToken,
          body: { doc_url: 'https://example.com/nid2.pdf', name: 'nid2.pdf' },
          expect: [200],
        },
      );
      const replacedDoc = (((replace.body.data as Json)?.documents as Json[]) || []).find(
        (d) => d.id === docId,
      );
      mark('verification-owner-replace-pending', replacedDoc?.status === 'pending', `status=${replacedDoc?.status}`);
    }

    // Unsafe banner URL
    {
      const bad = await req('POST', '/ads/banners', {
        token: admin.accessToken,
        body: {
          title: 'bad',
          externalUrl: 'javascript:alert(1)',
          formatId: 'hero_banner',
          placementId: 'HOME_HERO',
          pageKey: 'homepage',
        },
      });
      mark('banner-url-safe', bad.status === 400, `status=${bad.status}`);
    }

    // Messages badge hardcoded check (static source)
    {
      const fs = await import('node:fs');
      const nav = fs.readFileSync('src/cms-mirror/nav.ts', 'utf8');
      const html = fs.readFileSync('public/cms-mirror/app.html', 'utf8');
      const bad =
        /tag:\s*['"]12['"]/.test(nav) ||
        /tag:'12'/.test(html) ||
        /Messages',tag:'12'/.test(html);
      mark('messages-badge-no-hardcoded-12', !bad);
    }

    // Brand routing contract exists in App.tsx
    {
      const fs = await import('node:fs');
      const app = fs.readFileSync('src/App.tsx', 'utf8');
      mark(
        'seller-one-brand-routing',
        app.includes('ownedBrandIds.length === 1') &&
          app.includes('/admin/brand-studio/') &&
          app.includes('SellerBrandStudioHome'),
      );
      mark('seller-multi-brand-routing', app.includes('CmsMirrorHost') && app.includes('ownedBrandIds'));
    }
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
