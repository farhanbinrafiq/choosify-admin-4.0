/**
 * Feature Access & Entitlements — Phase 1 enforcement integrity probe (offline).
 *
 * No server and no database needed: the DB client is pointed at an unreachable
 * address, which also PROVES the core-lock paths never touch the database.
 *
 * Covers:
 *   A  every catalog key has tier/group/planControlled metadata; per-key route coverage
 *   B  segment-boundary prefix matching
 *   C  mid-path ':param' pattern matching (+ query strings, case-insensitivity)
 *   D  guide writes are entitlement-gated (route chain + mapping)
 *   E  product-details PUT/PATCH gated under products
 *   F  seller platform-messages gated under messaging; staff hub not mapped
 *   G  draft/version entity-type mapping (product/brand/guide; creator stays core)
 *   H  promotion requests (both paths) gated under promotionRequests, reads stay open
 *   I  notifications is core — resolver + path check never deny, never hit the DB
 *   J  financial visibility is core — same
 *   K  orders / shipments / manual offers are core (no mapping, allowed without DB)
 *   L  returnsRefunds is operational and not plan-controlled
 *   M  logistics does not gate shipments
 *   N  advancedAnalytics deprecated, courier analytics uses logisticsAnalytics
 *   S  seller Conversations nav controlled by messaging; creator partnerSupport stays core
 *   +  route coverage: every mapped prefix/pattern hits a real route inside a gated chain
 *
 * Run: npx tsx scripts/probe-entitlement-phase1.ts
 */
import { readFileSync, readdirSync } from 'fs';
import { join, relative } from 'path';

process.env.DATABASE_URL = 'postgres://probe:probe@127.0.0.1:1/unreachable_phase1_probe';

const ROOT = process.cwd();
const fails: string[] = [];
let passes = 0;
function check(cond: unknown, label: string, detail?: unknown) {
  if (cond) {
    passes += 1;
    return;
  }
  fails.push(`${label}${detail === undefined ? '' : ` :: ${JSON.stringify(detail).slice(0, 300)}`}`);
}

type RouteRow = { method: string; path: string; file: string; line: number; gated: boolean };

/** Mounted-route inventory from server/app.ts mounts + router files (static parse). */
function routeInventory(): RouteRow[] {
  const files: string[] = [];
  (function walk(d: string) {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) {
        if (!/node_modules|dist/.test(e.name)) walk(p);
      } else if (/\.ts$/.test(e.name)) files.push(p);
    }
  })(join(ROOT, 'server'));
  const app = readFileSync(join(ROOT, 'server/app.ts'), 'utf8');
  const mounts: Record<string, string> = {};
  for (const m of app.matchAll(/app\.use\("([^"]+)",\s*(\w+Router)\)/g)) mounts[m[2]] = m[1];
  const out: RouteRow[] = [];
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    const chains: Record<string, string> = {};
    for (const m of src.matchAll(/const\s+(\w+)\s*=\s*\[([^\]]*)\]/g)) chains[m[1]] = m[2];
    const re =
      /(\w+Router)\.(get|post|put|patch|delete)\(\s*(?:\n\s*)?['"`]([^'"`]+)['"`]\s*,([\s\S]*?)(?:async\s*\(|\(\s*req\b|\bfunction\b)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      const [, router, method, p, args] = m;
      if (!mounts[router]) continue;
      const used = Object.keys(chains).filter((c) => new RegExp(`\\b${c}\\b`).test(args));
      const expanded = `${args} ${used.map((c) => chains[c]).join(' ')}`;
      out.push({
        method: method.toUpperCase(),
        path: (mounts[router] + p).replace(/\/+/g, '/'),
        file: relative(ROOT, f).replace(/\\/g, '/'),
        line: src.slice(0, m.index).split('\n').length,
        gated: /requirePartnerEntitlement/.test(expanded),
      });
    }
  }
  return out;
}

/** Turn an Express route path into a sample concrete request path. */
function concrete(path: string): string {
  return path.replace(/:entityType/g, 'product').replace(/:(\w+)/g, 'x1');
}

/**
 * Does an entitlement mapping (prefix/pattern) reach this Express route? A
 * mapping ':param' matches any route segment; a route ':entityType' segment
 * (the one mid-path dispatch key) is reached by a literal entity type, so
 * '/catalog/:entityType/:id/draft' is reached by '/catalog/brand/:id/draft'.
 */
function mappingReachesRoute(routePath: string, mapping: string): boolean {
  const r = routePath.toLowerCase().split('/');
  const m = mapping.toLowerCase().split('/');
  if (m.length > r.length) return false;
  return m.every((seg, i) => seg.startsWith(':') || r[i] === ':entitytype' || seg === r[i]);
}

async function main() {
  const reg = await import('../shared/entitlements/registry');
  const store = await import('../server/entitlements/entitlementStore');
  const { PARTNER_FEATURES, featureByKey, apiRouteMatches, featuresForApiRequest } = reg;
  const keysFor = (role: 'seller' | 'creator', path: string, method = 'GET') =>
    featuresForApiRequest(role, path, method).map((f) => f.key).sort();

  // ── A. catalog metadata ──────────────────────────────────────────────
  const APPROVED_PREMIUM = new Set(['metaMessaging', 'logisticsAnalytics', 'customerInsights', 'promotionRequests']);
  const EXPECTED_CORE = new Set(['notifications', 'analytics', 'feesAdjustments', 'myEarnings', 'payouts']);
  const groups = new Set(reg.PARTNER_FEATURE_GROUPS.map((g) => g.key));
  for (const f of PARTNER_FEATURES) {
    check(['core', 'operational', 'premium', 'reserved'].includes(f.tier), `A ${f.key}: tier set`, f.tier);
    check(groups.has(f.group), `A ${f.key}: group is a catalog group`, f.group);
    check(typeof f.planControlled === 'boolean', `A ${f.key}: planControlled set`);
    if (f.planControlled) check(f.tier === 'premium' && !f.deprecated, `A ${f.key}: planControlled ⇒ active premium`);
    if (f.tier === 'premium' && !f.deprecated) {
      check(APPROVED_PREMIUM.has(f.key), `A ${f.key}: premium key is an approved candidate`);
      check(f.planControlled, `A ${f.key}: premium ⇒ planControlled`);
    }
    if (f.tier === 'core') check(EXPECTED_CORE.has(f.key), `A ${f.key}: core key expected`);
  }
  for (const k of EXPECTED_CORE) check(featureByKey(k)?.tier === 'core', `A ${k} is core`);
  check(PARTNER_FEATURES.length === new Set(PARTNER_FEATURES.map((f) => f.key)).size, 'A keys unique');

  // ── B. prefix boundary ───────────────────────────────────────────────
  check(apiRouteMatches('/api/messaging', '/api/messaging'), 'B exact match');
  check(apiRouteMatches('/api/messaging/threads/1', '/api/messaging'), 'B nested path matches');
  check(apiRouteMatches('/api/messaging/', '/api/messaging'), 'B trailing slash matches');
  check(!apiRouteMatches('/api/messaging-anything', '/api/messaging'), 'B /api/messaging-anything rejected');
  check(!apiRouteMatches('/api/messagingx/1', '/api/messaging'), 'B /api/messagingx rejected');
  check(!apiRouteMatches('/api/v1/cashbooksX', '/api/v1/cashbooks'), 'B /cashbooksX rejected');
  check(!apiRouteMatches('/api/v1', '/api/v1/cashbooks'), 'B shorter path rejected');
  check(apiRouteMatches('/api/v1/cashbooks?x=1', '/api/v1/cashbooks'), 'B query string ignored');
  check(apiRouteMatches('/API/V1/Cashbooks', '/api/v1/cashbooks'), 'B case-insensitive (Express routing is)');
  check(keysFor('seller', '/api/v1/ads-archive').length === 0, 'B /api/v1/ads-archive not adsDeals');

  // ── C. mid-path patterns ─────────────────────────────────────────────
  const P = '/api/v1/ads/deals/:id/promotion-requests';
  check(apiRouteMatches('/api/v1/ads/deals/deal_123/promotion-requests', P), 'C param segment matches');
  check(apiRouteMatches('/api/v1/ads/deals/deal_123/promotion-requests?src=ui', P), 'C pattern + query string');
  check(apiRouteMatches('/api/v1/ads/deals/d/promotion-requests/extra', P), 'C nested under pattern');
  check(!apiRouteMatches('/api/v1/ads/deals//promotion-requests', P), 'C empty param rejected');
  check(!apiRouteMatches('/api/v1/ads/deals/deal_123', P), 'C shorter path rejected');
  check(!apiRouteMatches('/api/v1/ads/deals/deal_123/pause', P), 'C different tail rejected');
  check(!apiRouteMatches('/api/v1/ads/deals/deal_123/promotion-requests-x', P), 'C boundary on last segment');

  // ── route inventory + coverage ───────────────────────────────────────
  const routes = routeInventory();
  check(routes.length > 400, 'inventory parsed', routes.length);
  const coverage: string[] = [];
  const PAGE_LEVEL_ONLY = new Set(['logisticsAnalytics', 'myEarnings', 'payouts', 'logistics']);
  for (const f of PARTNER_FEATURES) {
    const mapped = [...f.apiPrefixes, ...(f.apiPatterns || [])];
    const hits = routes.filter(
      (r) =>
        mapped.some((m) => mappingReachesRoute(r.path, m)) &&
        (!f.apiMethods?.length || f.apiMethods.includes(r.method as never)),
    );
    const gated = hits.filter((r) => r.gated);
    coverage.push(
      `${f.key.padEnd(20)} ${f.tier.padEnd(11)} plan=${String(f.planControlled).padEnd(5)} ${f.deprecated ? 'DEPRECATED ' : ''}routes=${hits.length} gated=${gated.length} pages=${f.pageKeys.join('|') || '-'}` +
        (hits.length > gated.length
          ? `\n${' '.repeat(22)}not-in-partner-chain: ${hits.filter((r) => !r.gated).map((r) => `${r.method} ${r.path}`).join(', ')}`
          : ''),
    );
    if (f.deprecated) {
      check(mapped.length === 0 && f.pageKeys.length === 0, `A ${f.key}: deprecated key maps nothing`);
      continue;
    }
    if (PAGE_LEVEL_ONLY.has(f.key)) {
      check(mapped.length === 0, `A ${f.key}: page-level only (no fake API mapping)`, mapped);
      continue;
    }
    // No dead mappings: every mapped prefix/pattern reaches at least one mounted route.
    for (const m of mapped) {
      check(
        routes.some((r) => mappingReachesRoute(r.path, m)),
        `A ${f.key}: mapping ${m} matches a mounted route`,
      );
    }
    if (f.tier !== 'core') {
      // Every partner-callable (partner-chain) route under a switchable key is enforced by middleware.
      const ungatedPartner = hits.filter((r) => !r.gated && !/admin/.test(r.path) && r.method !== 'GET');
      check(gated.length > 0, `A ${f.key}: has gated routes`, hits.length);
      for (const r of ungatedPartner) {
        // Public buyer checkout coupon validation is intentionally ungated (core).
        if (r.path === '/api/v1/operations/coupons/validate') continue;
        // Admin-only chains (requireAdmin / requireRole) are not partner-callable.
        const src = readFileSync(join(ROOT, r.file), 'utf8').split('\n')[r.line - 1] || '';
        if (/requireAdmin|requireRole|requireCmsWrite/.test(src)) continue;
        check(false, `A ${f.key}: partner write route not gated ${r.method} ${r.path} (${r.file}:${r.line})`);
      }
    }
  }

  // ── D. guides ────────────────────────────────────────────────────────
  for (const [method, path] of [
    ['POST', '/api/v1/catalog/guides'],
    ['PUT', '/api/v1/catalog/guides/:id'],
    ['PATCH', '/api/v1/catalog/guides/:id'],
    ['POST', '/api/v1/catalog/guides/:id/publish'],
    ['POST', '/api/v1/catalog/guides/:id/archive'],
    ['POST', '/api/v1/catalog/guides/:id/unpublish'],
  ] as const) {
    const r = routes.find((x) => x.method === method && x.path === path);
    check(r?.gated, `D ${method} ${path} chain includes requirePartnerEntitlement`, r);
    check(keysFor('creator', concrete(path), method).includes('guideManagement'), `D ${method} ${path} → guideManagement (creator)`);
    check(keysFor('seller', concrete(path), method).includes('guideManagement'), `D ${method} ${path} → guideManagement (seller)`);
  }
  check(keysFor('creator', '/api/v1/catalog/guides', 'GET').length === 0, 'D guide reads stay public/ungated');

  // ── E. product details ───────────────────────────────────────────────
  for (const method of ['PUT', 'PATCH']) {
    check(keysFor('seller', '/api/v1/catalog/product-details/p1', method).includes('products'), `E ${method} product-details → products`);
    const r = routes.find((x) => x.method === method && x.path === '/api/v1/catalog/product-details/:productId');
    check(r?.gated, `E ${method} product-details chain gated`);
  }
  check(keysFor('seller', '/api/v1/catalog/product-details/p1', 'GET').length === 0, 'E product-details GET (storefront) not gated');

  // ── F. seller messaging ──────────────────────────────────────────────
  check(keysFor('seller', '/api/v1/operations/platform-messages', 'GET').includes('messaging'), 'F GET platform-messages → messaging');
  check(keysFor('seller', '/api/v1/operations/platform-messages?userId=u1', 'POST').includes('messaging'), 'F POST platform-messages → messaging');
  check(routes.filter((r) => r.path === '/api/v1/operations/platform-messages').every((r) => r.gated), 'F platform-messages chains gated');
  for (const staffPath of ['/api/conversations', '/api/messages/1', '/api/messaging/status', '/api/messaging/flush']) {
    check(keysFor('seller', staffPath).length === 0, `F staff hub ${staffPath} not mapped to a partner key`);
  }
  check(!featureByKey('metaMessaging')!.apiPrefixes.includes('/api/messaging'), 'F metaMessaging dead /api/messaging removed');
  check(keysFor('seller', '/api/v1/seller/social-inbox/threads').includes('metaMessaging'), 'F social inbox → metaMessaging');
  check(keysFor('seller', '/api/v1/support/conversations').length === 0, 'F Choosify Support not mapped (core)');

  // ── G. drafts / versions by entity type ──────────────────────────────
  const draftCases: Array<[string, string, string | null]> = [
    ['product', 'products', 'seller'],
    ['brand', 'brandStudio', 'seller'],
    ['guide', 'guideManagement', 'creator'],
  ];
  for (const [entity, key, role] of draftCases) {
    for (const tail of ['draft', 'versions']) {
      const method = tail === 'draft' ? 'PUT' : 'POST';
      const got = keysFor(role as 'seller' | 'creator', `/api/v1/catalog/${entity}/e1/${tail}`, method);
      check(got.length === 1 && got[0] === key, `G ${method} ${entity}/${tail} → ${key}`, got);
    }
  }
  check(keysFor('creator', '/api/v1/catalog/creator/c1/draft', 'PUT').length === 0, 'G creator profile draft stays core');
  check(keysFor('seller', '/api/v1/catalog/guide/g1/draft', 'PUT').join() === 'guideManagement', 'G guide draft never maps to products');
  check(keysFor('seller', '/api/v1/catalog/brand/b1/draft', 'PUT').join() === 'brandStudio', 'G brand draft never maps to products');

  // ── H. promotion requests ────────────────────────────────────────────
  check(featureByKey('promotionRequests')?.planControlled === true, 'H promotionRequests planControlled');
  check(featureByKey('adsDeals')?.tier === 'operational', 'H adsDeals retained (operational)');
  check(keysFor('seller', '/api/v1/ads/deals/d1/promotion-requests', 'POST').join() === 'adsDeals,promotionRequests', 'H POST deal promotion-request → adsDeals+promotionRequests');
  check(keysFor('creator', '/api/v1/ads/promotion-requests/r1/cancel', 'POST').includes('promotionRequests'), 'H cancel → promotionRequests');
  check(!keysFor('seller', '/api/v1/ads/promotion-requests', 'GET').includes('promotionRequests'), 'H GET own promotion requests stays readable');
  check(!keysFor('seller', '/api/v1/ads/deals', 'POST').includes('promotionRequests'), 'H plain deal create is adsDeals only');

  // ── I / J. core lock — no DB (unreachable DB would throw) ────────────
  for (const key of EXPECTED_CORE) {
    for (const role of ['seller', 'creator']) {
      const ok = await store.resolveFeatureEnabled({ role, featureKey: key, userId: 'u_probe' });
      check(ok === true, `I/J resolveFeatureEnabled(${role}, ${key}) is always true`);
    }
  }
  for (const [path, method] of [
    ['/api/notifications', 'GET'],
    ['/api/notifications/preferences', 'PUT'],
    ['/api/v1/finance/summary', 'GET'],
    ['/api/v1/finance/adjustments', 'GET'],
  ]) {
    const r = await store.isApiPathEntitled({ role: 'seller', userId: 'u_probe', path, method });
    check(r.ok, `I/J ${method} ${path} allowed with entitlement DB unreachable`, r);
  }
  check(!reg.switchableFeatureKeysForRole('seller').includes('notifications'), 'I notifications not switchable');
  check(!reg.isEntitlementControlledPageKey('seller', 'notifications'), 'I notifications page not entitlement-controlled');
  check(!reg.pageKeysDisabledByFeatures('seller', { analytics: false, myEarnings: false, payouts: false, feesAdjustments: false }).size, 'J financial pages never hidden');

  // ── K / M. orders, shipments, manual offers are core ─────────────────
  for (const [path, method] of [
    ['/api/v1/operations/orders', 'GET'],
    ['/api/v1/operations/orders/o1/status', 'PATCH'],
    ['/api/v1/operations/shipments', 'GET'],
    ['/api/v1/operations/shipments/s1', 'PATCH'],
    ['/api/v1/operations/shipments/track/o1', 'GET'],
    ['/api/v1/operations/manual-offers', 'POST'],
    ['/api/v1/operations/manual-offers/m1/accept', 'POST'],
    ['/api/v1/operations/warranty-claims', 'GET'],
  ]) {
    check(keysFor('seller', path, method).length === 0, `K ${method} ${path} has no feature mapping`);
    const r = await store.isApiPathEntitled({ role: 'seller', userId: 'u_probe', path, method });
    check(r.ok, `K ${method} ${path} allowed with entitlement DB unreachable`);
  }
  for (const core of reg.CORE_PARTNER_API_ROUTES) {
    check(keysFor('seller', core).length === 0 && keysFor('creator', core).length === 0, `K core route ${core} unmapped`);
  }
  check(featureByKey('logistics')?.tier === 'reserved', 'M logistics reserved');
  check(featureByKey('logistics')!.apiPrefixes.length === 0, 'M logistics gates no API');
  check(!featureByKey('logistics')!.pageKeys.includes('shipmentOperations'), 'M logistics does not gate shipment operations page');

  // ── L. returns ───────────────────────────────────────────────────────
  const rr = featureByKey('returnsRefunds')!;
  check(rr.tier === 'operational' && rr.planControlled === false, 'L returnsRefunds operational, not plan-controlled');
  check(reg.switchableFeatureKeysForRole('seller').includes('returnsRefunds'), 'L returnsRefunds administratively switchable');

  // ── N. deprecation ───────────────────────────────────────────────────
  const aa = featureByKey('advancedAnalytics')!;
  check(aa.deprecated?.replacedBy === 'logisticsAnalytics', 'N advancedAnalytics deprecated → logisticsAnalytics');
  check(!reg.featureKeysForRole('seller').includes('advancedAnalytics' as never), 'N deprecated key not an active role key');
  check(!reg.switchableFeatureKeysForRole('seller').includes('advancedAnalytics' as never), 'N deprecated key not switchable');
  check((await store.resolveFeatureEnabled({ role: 'seller', featureKey: 'advancedAnalytics' })) === true, 'N deprecated key gates nothing (no DB)');
  check(reg.featuresForPageKey('seller', 'courierAnalytics').map((f) => f.key).join() === 'logisticsAnalytics', 'N courierAnalytics page → logisticsAnalytics');
  check(featureByKey('logisticsAnalytics')?.planControlled === true, 'N logisticsAnalytics premium/plan-controlled');

  // ── S. nav mapping ───────────────────────────────────────────────────
  check(reg.pageKeysDisabledByFeatures('seller', { messaging: false }).has('sellerConversations'), 'S messaging OFF hides seller Conversations');
  check(!reg.pageKeysDisabledByFeatures('seller', { messaging: true }).has('sellerConversations'), 'S messaging ON keeps seller Conversations');
  const creatorAllOff = Object.fromEntries(reg.featureKeysForRole('creator').map((k) => [k, false]));
  check(!reg.pageKeysDisabledByFeatures('creator', creatorAllOff).has('partnerSupport'), 'S creator partnerSupport (Choosify Support) never hidden');

  console.log('\n=== ENTITLEMENT KEY COVERAGE ===');
  for (const line of coverage) console.log(line);
  const partnerChain = routes.filter((r) => r.gated);
  const mappedChain = partnerChain.filter((r) =>
    PARTNER_FEATURES.some(
      (f) =>
        !f.deprecated &&
        [...f.apiPrefixes, ...(f.apiPatterns || [])].some((m) => mappingReachesRoute(r.path, m)) &&
        (!f.apiMethods?.length || f.apiMethods.includes(r.method as never)),
    ),
  );
  console.log(
    `\nroutes=${routes.length} partner-chain(gated middleware)=${partnerChain.length} feature-mapped=${mappedChain.length} unmapped(core/admin/legacy)=${partnerChain.length - mappedChain.length}`,
  );

  if (fails.length) {
    console.error(`\nFAIL probe-entitlement-phase1 (${fails.length} failed, ${passes} passed)`);
    for (const f of fails) console.error(' -', f);
    process.exit(1);
  }
  console.log(`\nPASS probe-entitlement-phase1 (${passes} checks)`);
  process.exit(0);
}

main().catch((e) => {
  console.error('CRASH', e);
  process.exit(1);
});
