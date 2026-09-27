/**
 * Feature Access & Entitlements — Phase 1 live enforcement probe.
 *
 * Needs the dev API (:3001) + its local database. Uses the dev seller/creator/admin
 * accounts. Every role toggle and direct DB row this probe changes is restored in
 * `finally`. Write calls use empty/invalid bodies, so a request that passes the
 * entitlement gate fails validation/ownership instead of persisting data.
 *
 * Covers D E F G H I J K L (+ U-adjacent /entitlements/me) over real HTTP.
 * Run: npx tsx scripts/probe-entitlement-phase1-http.ts
 */
import { and, eq } from 'drizzle-orm';
import { db } from '../server/db/client';
import { featureEntitlements } from '../server/db/schema';
import { resolveFeatureEnabled } from '../server/entitlements/entitlementStore';
import { workspaceService } from '../server/subscriptions/workspaceService';

const ROOT = process.env.PROBE_BASE_URL_ROOT || 'http://127.0.0.1:3001';
const API = `${ROOT}/api/v1`;
const PASS_ = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';

const fails: string[] = [];
let passes = 0;
function check(cond: unknown, label: string, detail?: unknown) {
  if (cond) {
    passes += 1;
    console.log('PASS', label);
    return;
  }
  fails.push(label);
  console.log('FAIL', label, JSON.stringify(detail ?? '').slice(0, 300));
}

type Res = { status: number; body: Record<string, any> };
async function call(path: string, token: string, method = 'GET', body?: unknown, base = API): Promise<Res> {
  const r = await fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: r.status, body: (await r.json().catch(() => ({}))) as Record<string, any> };
}
const denied = (r: Res, key?: string) =>
  r.status === 403 && r.body.code === 'FEATURE_ENTITLEMENT_DENIED' && (!key || r.body.featureKey === key);
const notDenied = (r: Res) => !(r.status === 403 && r.body.code === 'FEATURE_ENTITLEMENT_DENIED') && r.status !== 503;

async function login(email: string) {
  const r = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASS_ }),
  });
  const b = (await r.json()) as Record<string, any>;
  if (!b.accessToken) throw new Error(`login ${email} failed (${r.status})`);
  return { token: String(b.accessToken), uid: String(b.uid || '') };
}

async function main() {
  const admin = await login('admin@choosify.com.bd');
  const seller = await login('seller@choosify.com.bd');
  const creator = await login('creator@choosify.com.bd');

  const snapshot = await call('/entitlements/admin', admin.token);
  if (snapshot.status !== 200) throw new Error(`GET /entitlements/admin → ${snapshot.status}`);
  const original: Record<'seller' | 'creator', Record<string, boolean>> = snapshot.body.roleDefaults;
  const touched = new Set<string>();
  const setRole = async (role: 'seller' | 'creator', key: string, enabled: boolean) => {
    touched.add(`${role}:${key}`);
    const r = await call(`/entitlements/admin/role-defaults/${role}/${key}`, admin.token, 'PATCH', { enabled });
    if (r.status !== 200) throw new Error(`toggle ${role}/${key} → ${r.status} ${JSON.stringify(r.body)}`);
  };
  const dbRowsToRestore: Array<() => Promise<void>> = [];

  try {
    // ── /entitlements/me ──
    const me = await call('/entitlements/me', seller.token);
    check(me.status === 200, 'me: 200 for seller');
    check(!('advancedAnalytics' in (me.body.entitlements || {})), 'N me: deprecated advancedAnalytics not resolved');
    check('logisticsAnalytics' in (me.body.entitlements || {}), 'N me: logisticsAnalytics resolved');
    check(me.body.entitlements?.notifications === true, 'I me: notifications true');

    // ── I / J: core keys cannot be switched via API ──
    for (const key of ['notifications', 'analytics', 'feesAdjustments', 'myEarnings', 'payouts']) {
      const r = await call(`/entitlements/admin/role-defaults/seller/${key}`, admin.token, 'PATCH', { enabled: false });
      check(r.status === 400 && r.body.code === 'FEATURE_NOT_SWITCHABLE', `I/J PATCH seller/${key} → 400 FEATURE_NOT_SWITCHABLE`, r);
    }
    for (const key of ['logistics', 'advancedAnalytics']) {
      const r = await call(`/entitlements/admin/role-defaults/seller/${key}`, admin.token, 'PATCH', { enabled: false });
      check(r.status === 400, `M/N PATCH seller/${key} rejected (${r.body.code || r.body.error})`, r);
    }

    // ── I / J: even a legacy DB row / account override cannot remove core ──
    const upsert = async (scope: 'role' | 'account', scopeKey: string, featureKey: string, enabled: boolean) => {
      const prev = await db
        .select()
        .from(featureEntitlements)
        .where(and(eq(featureEntitlements.scope, scope), eq(featureEntitlements.scopeKey, scopeKey), eq(featureEntitlements.featureKey, featureKey)));
      dbRowsToRestore.push(async () => {
        if (prev[0]) {
          await db
            .update(featureEntitlements)
            .set({ enabled: prev[0].enabled })
            .where(and(eq(featureEntitlements.scope, scope), eq(featureEntitlements.scopeKey, scopeKey), eq(featureEntitlements.featureKey, featureKey)));
        } else {
          await db
            .delete(featureEntitlements)
            .where(and(eq(featureEntitlements.scope, scope), eq(featureEntitlements.scopeKey, scopeKey), eq(featureEntitlements.featureKey, featureKey)));
        }
      });
      await db
        .insert(featureEntitlements)
        .values({ scope, scopeKey, featureKey, enabled })
        .onConflictDoUpdate({
          target: [featureEntitlements.scope, featureEntitlements.scopeKey, featureEntitlements.featureKey],
          set: { enabled, updatedAt: new Date() },
        });
    };
    await upsert('role', 'seller', 'notifications', false);
    await upsert('account', seller.uid, 'notifications', false);
    await upsert('role', 'seller', 'analytics', false);
    await upsert('account', seller.uid, 'feesAdjustments', false);
    const notif = await call('/notifications', seller.token, 'GET', undefined, `${ROOT}/api`);
    check(notDenied(notif), 'I seller notifications reachable despite role+account rows=false', notif.status);
    const prefs = await call('/notifications/preferences', seller.token, 'GET', undefined, `${ROOT}/api`);
    check(notDenied(prefs), 'I seller notification preferences reachable', prefs.status);
    const summary = await call('/finance/summary', seller.token);
    check(notDenied(summary), 'J seller /finance/summary reachable despite analytics row=false', summary);
    const adj = await call('/finance/adjustments', seller.token);
    check(notDenied(adj), 'J seller /finance/adjustments reachable despite account override=false', adj.status);

    // ── D: guides ──
    await setRole('creator', 'guideManagement', false);
    check(denied(await call('/catalog/guides', creator.token, 'POST', {}), 'guideManagement'), 'D creator POST guide denied when guideManagement off');
    check(denied(await call('/catalog/guides/x1/publish', creator.token, 'POST', {}), 'guideManagement'), 'D creator publish guide denied');
    check(denied(await call('/catalog/guide/x1/draft', creator.token, 'PUT', {}), 'guideManagement'), 'G creator guide draft denied under guideManagement');
    check(notDenied(await call('/catalog/guides', creator.token)), 'D guide list read still open');
    await setRole('creator', 'guideManagement', true);
    check(notDenied(await call('/catalog/guides', creator.token, 'POST', {})), 'D creator POST guide passes gate when on');

    // ── E + G: products ──
    await setRole('seller', 'products', false);
    check(denied(await call('/catalog/product-details/x1', seller.token, 'PUT', {}), 'products'), 'E PUT product-details denied');
    check(denied(await call('/catalog/product-details/x1', seller.token, 'PATCH', {}), 'products'), 'E PATCH product-details denied');
    check(notDenied(await call('/catalog/product-details/x1', seller.token)), 'E GET product-details stays open');
    check(denied(await call('/catalog/product/x1/draft', seller.token, 'PUT', {}), 'products'), 'G product draft → products');
    check(denied(await call('/catalog/product/x1/versions', seller.token, 'POST', {}), 'products'), 'G product version → products');
    check(notDenied(await call('/catalog/brand/x1/draft', seller.token, 'PUT', {})), 'G brand draft NOT blocked by products');
    await setRole('seller', 'products', true);
    await setRole('seller', 'brandStudio', false);
    check(denied(await call('/catalog/brand/x1/draft', seller.token, 'PUT', {}), 'brandStudio'), 'G brand draft → brandStudio');
    check(notDenied(await call('/catalog/product/x1/draft', seller.token, 'PUT', {})), 'G product draft NOT blocked by brandStudio');
    await setRole('seller', 'brandStudio', true);

    // ── F: seller messaging ──
    await setRole('seller', 'messaging', false);
    check(denied(await call('/operations/platform-messages', seller.token), 'messaging'), 'F GET platform-messages denied when messaging off');
    check(denied(await call('/operations/platform-messages', seller.token, 'POST', {}), 'messaging'), 'F POST platform-messages denied when messaging off');
    check(notDenied(await call('/support/conversations', seller.token)), 'F Choosify Support stays reachable');
    await setRole('seller', 'messaging', true);
    check(notDenied(await call('/operations/platform-messages', seller.token)), 'F platform-messages open when messaging on');

    // ── H: promotion requests ──
    await setRole('seller', 'promotionRequests', false);
    check(denied(await call('/ads/deals/x1/promotion-requests', seller.token, 'POST', {}), 'promotionRequests'), 'H POST deal promotion-request denied');
    check(denied(await call('/ads/promotion-requests/x1/cancel', seller.token, 'POST', {}), 'promotionRequests'), 'H cancel promotion-request denied (read-only)');
    check(notDenied(await call('/ads/promotion-requests', seller.token)), 'H GET own promotion-requests stays readable');
    check(notDenied(await call('/ads/deals', seller.token)), 'H Deals (adsDeals) unaffected');
    await setRole('seller', 'promotionRequests', true);
    check(notDenied(await call('/ads/deals/x1/promotion-requests', seller.token, 'POST', {})), 'H promotion-request passes gate when on');

    // ── K / L / M: core fulfilment with operational keys off ──
    for (const key of ['returnsRefunds', 'messaging', 'products', 'adsDeals', 'cashbooks']) await setRole('seller', key, false);
    check(denied(await call('/operations/returns', seller.token), 'returnsRefunds'), 'L returnsRefunds administratively restrictable');
    for (const path of ['/operations/orders', '/operations/shipments', '/operations/manual-offers/x1', '/operations/shipments/track/x1']) {
      const r = await call(path, seller.token);
      check(notDenied(r), `K/M ${path} not entitlement-gated (${r.status})`, r.body);
    }
    const mo = await call('/operations/manual-offers', seller.token, 'POST', {});
    check(notDenied(mo), `K POST manual-offers not entitlement-gated (${mo.status})`);
    for (const key of ['returnsRefunds', 'messaging', 'products', 'adsDeals', 'cashbooks']) await setRole('seller', key, true);

    // ── L: plan rows never consulted for non-plan-controlled keys ──
    const original_resolve = workspaceService.resolveWorkspaceForUser;
    let workspaceLookups = 0;
    (workspaceService as { resolveWorkspaceForUser: typeof original_resolve }).resolveWorkspaceForUser = async (...args) => {
      workspaceLookups += 1;
      return original_resolve.apply(workspaceService, args);
    };
    try {
      await resolveFeatureEnabled({ role: 'seller', featureKey: 'returnsRefunds', userId: seller.uid });
      await resolveFeatureEnabled({ role: 'seller', featureKey: 'products', userId: seller.uid });
      check(workspaceLookups === 0, 'L operational keys skip plan/subscription resolution', workspaceLookups);
      await resolveFeatureEnabled({ role: 'seller', featureKey: 'customerInsights', userId: seller.uid });
      check(workspaceLookups === 1, 'L plan-controlled key consults plan/subscription', workspaceLookups);
    } finally {
      (workspaceService as { resolveWorkspaceForUser: typeof original_resolve }).resolveWorkspaceForUser = original_resolve;
    }
  } finally {
    for (const restore of dbRowsToRestore.reverse()) await restore();
    for (const entry of touched) {
      const [role, key] = entry.split(':') as ['seller' | 'creator', string];
      const was = original[role]?.[key] !== false;
      await call(`/entitlements/admin/role-defaults/${role}/${key}`, admin.token, 'PATCH', { enabled: was });
    }
    const after = await call('/entitlements/admin', admin.token);
    const restored = [...touched].every((entry) => {
      const [role, key] = entry.split(':') as ['seller' | 'creator', string];
      return (after.body.roleDefaults?.[role]?.[key] !== false) === (original[role]?.[key] !== false);
    });
    check(restored, 'cleanup: all toggled role defaults restored');
  }

  if (fails.length) {
    console.error(`\nFAIL probe-entitlement-phase1-http (${fails.length} failed, ${passes} passed)`);
    for (const f of fails) console.error(' -', f);
    process.exit(1);
  }
  console.log(`\nPASS probe-entitlement-phase1-http (${passes} checks)`);
  process.exit(0);
}

main().catch((e) => {
  console.error('CRASH', e);
  process.exit(1);
});
