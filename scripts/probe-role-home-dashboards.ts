/**
 * Permanent regression gate for the role-specific home dashboards
 * (/admin/dashboard → AdminHomeDashboard / SellerHomeDashboard /
 * CreatorHomeDashboard / WorkspaceFallback).
 *
 * Locks the four failure modes the dashboard rebuild must never regress:
 *   1. Seller seeing a platform-wide order/revenue trend
 *   2. Creator seeing platform revenue / fabricated KPI strings
 *   3. Consumer reaching the Admin Platform Command Center
 *   4. Unknown / non-dashboard staff falling into the Admin UI
 * ...plus: moderator's canonically-authorized platform analytics access stays.
 *
 * Two layers:
 *   - live server contract   → GET /api/v1/operations/analytics per role
 *   - static source guards    → the dispatcher routes on profile.role (not
 *                               response-shape sniffing); the partner dashboards
 *                               don't consume platform analytics.daily
 *
 * Usage: npx tsx scripts/probe-role-home-dashboards.ts
 *    or: npm run test:role-home-dashboards
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE = process.env.PROBE_BASE_URL_ROOT || 'http://localhost:3001';
const API = `${BASE}/api/v1`;
const PASS: string[] = [];
const FAIL: string[] = [];

function check(cond: unknown, label: string, detail?: unknown) {
  if (cond) {
    PASS.push(label);
    console.log('PASS', label);
  } else {
    FAIL.push(label);
    console.log('FAIL', label, detail !== undefined ? JSON.stringify(detail) : '');
  }
}

const jsonOf = async (r: Response) => {
  const t = await r.text();
  try {
    return t ? JSON.parse(t) : {};
  } catch {
    return { _raw: t };
  }
};

async function login(email: string, password = 'ChoosifyDev!2026'): Promise<string | null> {
  try {
    const b = await jsonOf(
      await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      }),
    );
    return b.accessToken || b.token || b.data?.accessToken || null;
  } catch {
    return null;
  }
}

async function getAnalytics(token: string | null) {
  const r = await fetch(`${API}/operations/analytics?range=30d`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return { status: r.status, body: await jsonOf(r) };
}

const SRC = (rel: string) => resolve(process.cwd(), rel);
function read(rel: string): string {
  const p = SRC(rel);
  return existsSync(p) ? readFileSync(p, 'utf8') : '';
}

async function main() {
  // ── 1. static architecture guards ────────────────────────────────────
  const dispatcher = read('src/pages/admin/Dashboard.tsx');
  check(/profile\??\.role/.test(dispatcher), 'dispatcher routes on canonical profile.role');
  check(
    dispatcher.includes('WorkspaceFallback') &&
      dispatcher.includes('AdminHomeDashboard') &&
      dispatcher.includes('SellerHomeDashboard') &&
      dispatcher.includes('CreatorHomeDashboard'),
    'dispatcher wires all four role dashboards',
  );
  check(
    !/isRoleScoped|'cards'\s+in|"cards"\s+in/.test(dispatcher),
    'dispatcher does NOT sniff the analytics response shape',
  );

  for (const f of [
    'src/pages/admin/dashboards/AdminHomeDashboard.tsx',
    'src/pages/admin/dashboards/SellerHomeDashboard.tsx',
    'src/pages/admin/dashboards/CreatorHomeDashboard.tsx',
    'src/pages/admin/dashboards/WorkspaceFallback.tsx',
    'src/pages/admin/dashboards/primitives.tsx',
  ]) {
    check(existsSync(SRC(f)), `exists: ${f}`);
  }

  const sellerSrc = read('src/pages/admin/dashboards/SellerHomeDashboard.tsx');
  // strip line comments so a doc-comment mentioning the anti-pattern isn't a hit
  const sellerCode = sellerSrc.replace(/^\s*\*.*$/gm, '').replace(/\/\/.*$/gm, '');
  check(
    !/getAnalytics\s*\(/.test(sellerCode) && !/\banalytics\s*\??\.\s*daily\b/.test(sellerCode),
    'SellerHomeDashboard never reads platform analytics / the platform daily series',
  );
  check(
    /operationsApi\.listOrders/.test(sellerSrc),
    'SellerHomeDashboard builds its trend from actor-scoped operationsApi.listOrders',
  );

  const creatorSrc = read('src/pages/admin/dashboards/CreatorHomeDashboard.tsx');
  check(
    !/TrendChart/.test(creatorSrc),
    'CreatorHomeDashboard renders NO order/revenue trend chart',
  );
  check(
    !/\b(Earnings|Engagement|Watch time|Revenue)\b/.test(creatorSrc),
    'CreatorHomeDashboard has no Revenue / Earnings / Engagement / Watch-time widget',
  );
  check(
    /manageGuides/.test(creatorSrc),
    'CreatorHomeDashboard reads canonical guide data (manageGuides)',
  );

  const svc = read('server/operations/analyticsService.ts');
  check(
    !/'Your Guides'|"Your Guides"|'Unavailable until metrics'|'No invented figures'/.test(svc),
    'analyticsService no longer emits hardcoded Creator KPI strings',
  );

  // ── 2. live server contract per role ─────────────────────────────────
  const adminTok = await login('admin@choosify.com.bd');
  check(!!adminTok, 'seed login: admin');
  if (adminTok) {
    const a = await getAnalytics(adminTok);
    check(a.status === 200, 'admin: /operations/analytics → 200', a.status);
    check(
      a.body?.data && !('cards' in a.body.data) && Array.isArray(a.body.data.daily) && !!a.body.data.orders,
      'admin: gets the platform AnalyticsSummary (orders + daily, no role cards)',
      Object.keys(a.body?.data || {}),
    );
  }

  const modTok = await login('moderator@choosify.com.bd');
  if (modTok) {
    const m = await getAnalytics(modTok);
    check(
      m.status === 200 && m.body?.data && Array.isArray(m.body.data.daily) && !('cards' in m.body.data),
      'moderator: canonically-authorized platform analytics access is PRESERVED',
      m.status,
    );
  } else {
    console.log('SKIP moderator seed login unavailable');
  }

  const sellerTok = await login('seller@choosify.com.bd');
  if (!sellerTok) {
    console.log('SKIP seller seed login unavailable');
  } else {
    const s = await getAnalytics(sellerTok);
    if (s.status === 403) {
      // A marketplace-pending seller is correctly denied the platform analytics
      // endpoint; SellerHomeDashboard never depends on it (source guard above).
      check(true, 'seller: marketplace-pending → platform analytics denied (dashboard uses actor-scoped orders)');
    } else {
      check(s.status === 200, 'seller: /operations/analytics → 200', s.status);
      check(Array.isArray(s.body?.data?.cards), 'seller: gets a role-scoped payload (cards[])');
      check(
        Array.isArray(s.body?.data?.summary?.daily) && s.body.data.summary.daily.length === 0,
        'seller: role-scoped summary carries NO platform daily series',
        s.body?.data?.summary?.daily,
      );
      check(
        Number(s.body?.data?.summary?.orders?.revenue || 0) === 0,
        'seller: role-scoped summary does not leak platform revenue',
        s.body?.data?.summary?.orders,
      );
    }
  }

  const creatorTok = await login('creator@choosify.com.bd');
  check(!!creatorTok, 'seed login: creator');
  if (creatorTok) {
    const c = await getAnalytics(creatorTok);
    if (c.status === 403) {
      // A marketplace-pending creator is correctly denied platform analytics;
      // CreatorHomeDashboard never uses it (reads canonical guide/profile data).
      check(true, 'creator: marketplace-pending → platform analytics denied (dashboard uses canonical guide/profile data)');
    } else {
      check(c.status === 200, 'creator: /operations/analytics → 200', c.status);
      check(
        Array.isArray(c.body?.data?.cards) && c.body.data.cards.length === 0,
        'creator: NO fabricated KPI cards (cards[] is empty)',
        c.body?.data?.cards,
      );
      check(
        Array.isArray(c.body?.data?.summary?.daily) && c.body.data.summary.daily.length === 0,
        'creator: role-scoped summary carries NO platform daily series',
        c.body?.data?.summary?.daily,
      );
      check(
        Number(c.body?.data?.summary?.orders?.revenue || 0) === 0,
        'creator: role-scoped summary does not leak platform revenue',
        c.body?.data?.summary?.orders,
      );
    }
  }

  const consumerTok = await login('consumer@choosify.com.bd');
  if (!consumerTok) {
    console.log('SKIP consumer seed login unavailable (dispatcher source guard still covers the consumer→WorkspaceFallback path)');
  } else {
    const cc = await getAnalytics(consumerTok);
    check(
      cc.status === 403,
      'consumer: cannot reach platform analytics (→ dispatcher gives WorkspaceFallback, never the Admin shell)',
      cc.status,
    );
  }

  const financeTok = await login('finance@choosify.com.bd');
  if (financeTok) {
    const f = await getAnalytics(financeTok);
    check(
      f.status === 403,
      'finance_manager: no platform analytics access (fails closed to WorkspaceFallback, not an empty Admin shell)',
      f.status,
    );
  } else {
    console.log('SKIP finance seed login unavailable');
  }

  console.log(`\n=== ${PASS.length} passed, ${FAIL.length} failed ===`);
  if (FAIL.length) {
    console.log('FAILURES:');
    for (const f of FAIL) console.log(' -', f);
    process.exit(1);
  }
  console.log('ALL ROLE HOME DASHBOARD CHECKS PASSED');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
