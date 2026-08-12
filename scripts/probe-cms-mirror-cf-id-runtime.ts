/**
 * CMS-mirror CF-ID runtime regression guard.
 * Catches the class of bug where helpers are declared inside an IIFE but
 * called from renderVals (script/class scope) → ReferenceError blank UI.
 *
 * Run: npx tsx scripts/probe-cms-mirror-cf-id-runtime.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import vm from 'node:vm';

const ROOT = process.cwd();
const APP_HTML = path.join(ROOT, 'public/cms-mirror/app.html');
const HOST_TSX = path.join(ROOT, 'src/cms-mirror/CmsMirrorHost.tsx');
const BASE = process.env.PROBE_BASE_URL || 'http://localhost:3001';

type Result = { id: string; ok: boolean; detail?: string };
const results: Result[] = [];
function mark(id: string, ok: boolean, detail?: string) {
  results.push({ id, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id}${detail ? ` — ${detail}` : ''}`);
}

function staticChecks() {
  const html = fs.readFileSync(APP_HTML, 'utf8');
  const host = fs.readFileSync(HOST_TSX, 'utf8');

  // Bare free calls to cfIdLabelForUid (not window.cfIdLabelForUid, not function decl)
  const bareCfCalls = [...html.matchAll(/(?<![.\w])cfIdLabelForUid\s*\(/g)].filter((m) => {
    const before = html.slice(Math.max(0, m.index! - 80), m.index!);
    return !/function\s+$/.test(before) && !/window\s*\.\s*$/.test(before);
  });
  mark(
    'no-bare-cfIdLabelForUid-calls',
    bareCfCalls.length === 0,
    bareCfCalls.length ? `found ${bareCfCalls.length}` : 'ok',
  );

  const bareResolveCalls = [...html.matchAll(/(?<![.\w])resolveProfileChoosifyUserId\s*\(/g)].filter((m) => {
    const before = html.slice(Math.max(0, m.index! - 100), m.index!);
    // Allow: function decl, window., and internal calls from cfIdLabelForUid / ensure block
    if (/function\s+$/.test(before)) return false;
    if (/window\s*\.\s*$/.test(before)) return false;
    // Internal call inside top-level cfIdLabelForUid helper body is OK
    const ctx = html.slice(Math.max(0, m.index! - 400), m.index!);
    if (ctx.includes('function cfIdLabelForUid') && !ctx.includes('renderVals')) return false;
    // IIFE may still call ensureCfIdCache; resolve should only be via window in render paths
    if (ctx.includes('renderVals') || ctx.includes('ownerCfIdLabel') || ctx.includes('selectedBrand.choosifyUserId')) {
      return true;
    }
    return false;
  });
  mark(
    'render-paths-use-window-resolve',
    bareResolveCalls.length === 0,
    bareResolveCalls.length ? `suspect bare resolve: ${bareResolveCalls.length}` : 'ok',
  );

  mark(
    'helpers-assigned-to-window',
    html.includes('window.cfIdLabelForUid') &&
      html.includes('window.resolveProfileChoosifyUserId') &&
      html.includes('window.__CMS_MIRROR_RESOLVE_CF_ID__'),
  );

  mark(
    'helpers-declared-outside-iife-comment',
    html.includes('MUST stay in this script') || html.includes('not inside IIFE'),
  );

  // set-state must use e.data not bare data
  const setStateBlock = html.slice(
    html.indexOf("e.data.type === 'cms-mirror-set-state'"),
    html.indexOf("e.data.type === 'cms-mirror-set-state'") + 1200,
  );
  mark(
    'set-state-uses-e-data',
    setStateBlock.includes('e.data.choosifyUserId') && !/\bif\s*\(\s*data\.choosifyUserId/.test(setStateBlock),
    setStateBlock.includes('e.data.choosifyUserId') ? 'e.data.choosifyUserId present' : 'missing',
  );
  mark(
    'set-state-no-bare-data-ref',
    !/\bif\s*\(\s*data\.(activeBrandId|username|website|bio|choosifyUserId)/.test(setStateBlock),
  );

  mark(
    'asset-version-bumped',
    /CMS_MIRROR_ASSET_VERSION\s*=\s*'20260810-ads-deals-quick-actions-1'/.test(host),
  );

  // Simulate helpers: missing CF → "—", target ≠ viewer
  const sandbox: Record<string, unknown> = {
    window: {
      __CMS_MIRROR_USER_ID__: 'admin-uid',
      __CMS_MIRROR_CHOOSIFY_USER_ID__: 'CF-00005',
      __CMS_MIRROR_CF_ID_BY_UID__: { 'seller-uid': 'CF-00127' },
      __CMS_MIRROR_CF_ID_BY_EMAIL__: {},
    },
  };
  sandbox.window = Object.assign(sandbox.window as object, {
    ensureCfIdCache: function ensureCfIdCache(this: unknown) {
      const w = (sandbox as { window: Record<string, unknown> }).window;
      if (!w.__CMS_MIRROR_CF_ID_BY_UID__) w.__CMS_MIRROR_CF_ID_BY_UID__ = {};
      return w.__CMS_MIRROR_CF_ID_BY_UID__;
    },
  });
  vm.createContext(sandbox);
  vm.runInContext(
    `
    function resolveProfileChoosifyUserId(accountUserId, entityCfId, email) {
      if (entityCfId && entityCfId !== '—') return entityCfId;
      var viewerUid = window.__CMS_MIRROR_USER_ID__ || '';
      var targetUid = accountUserId || viewerUid;
      var cache = window.__CMS_MIRROR_CF_ID_BY_UID__ || {};
      if (targetUid && cache[targetUid]) return cache[targetUid];
      if (!accountUserId || accountUserId === viewerUid) {
        return window.__CMS_MIRROR_CHOOSIFY_USER_ID__ || '—';
      }
      return '—';
    }
    window.resolveProfileChoosifyUserId = resolveProfileChoosifyUserId;
    window.cfIdLabelForUid = function(accountUserId, entityCfId) {
      var cf = resolveProfileChoosifyUserId(accountUserId, entityCfId);
      return cf && cf !== '—' ? cf : '';
    };
    globalThis.__own = resolveProfileChoosifyUserId(null, null);
    globalThis.__target = resolveProfileChoosifyUserId('seller-uid', null);
    globalThis.__missing = resolveProfileChoosifyUserId('unknown-uid', null);
    globalThis.__label = (window.cfIdLabelForUid('unknown-uid', null) || '—');
    `,
    sandbox,
  );
  const g = sandbox as {
    __own?: string;
    __target?: string;
    __missing?: string;
    __label?: string;
  };
  mark('resolver-own-profile', g.__own === 'CF-00005', g.__own);
  mark('resolver-target-not-viewer', g.__target === 'CF-00127' && g.__target !== g.__own, `${g.__target} vs ${g.__own}`);
  mark('resolver-missing-dash', g.__missing === '—', g.__missing);
  mark('label-missing-fallback', g.__label === '—', g.__label);
}

async function browserChecks() {
  let browser;
  try {
    browser = await chromium.launch({ headless: true, channel: 'chrome' }).catch(async () =>
      chromium.launch({ headless: true }),
    );
  } catch (err) {
    mark('browser-launch', false, String(err));
    return;
  }

  const page = await browser.newPage();
  const consoleErrors: string[] = [];
  page.on('pageerror', (err) => consoleErrors.push(String(err)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  // Load cms-mirror iframe asset directly (no auth required for script parse)
  await page.goto(`${BASE}/cms-mirror/app.html?v=20260810-ads-deals-quick-actions-1#page=brands&role=admin`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForTimeout(2500);

  const runtime = await page.evaluate(() => {
    const w = window as unknown as Record<string, unknown>;
    const helpersOk =
      typeof w.cfIdLabelForUid === 'function' &&
      typeof w.resolveProfileChoosifyUserId === 'function' &&
      typeof w.__CMS_MIRROR_RESOLVE_CF_ID__ === 'function';
    let label = '—';
    let target = '—';
    let threw = '';
    try {
      w.__CMS_MIRROR_USER_ID__ = 'admin-uid';
      w.__CMS_MIRROR_CHOOSIFY_USER_ID__ = 'CF-00005';
      (w.__CMS_MIRROR_CF_ID_BY_UID__ as Record<string, string>)['seller-uid'] = 'CF-00127';
      const resolve = w.resolveProfileChoosifyUserId as (
        a?: string | null,
        b?: string | null,
        c?: string | null,
      ) => string;
      target = resolve('seller-uid', null);
      const labelFn = w.cfIdLabelForUid as (a?: string | null, b?: string | null) => string;
      label = labelFn('missing-uid', null) || '—';
    } catch (e) {
      threw = String(e);
    }
    const bodyText = document.body ? document.body.innerText : '';
    return {
      helpersOk,
      target,
      label,
      threw,
      hasSellerMgmt: /Seller Management|Brand Management|BRAND/i.test(bodyText),
      bodySnippet: bodyText.slice(0, 200),
    };
  });

  mark('browser-helpers-on-window', runtime.helpersOk);
  mark('browser-no-cfIdLabel-referenceerror', !consoleErrors.some((e) => /cfIdLabelForUid is not defined/i.test(e)), consoleErrors.slice(0, 3).join(' | ') || 'none');
  mark('browser-target-resolve', runtime.target === 'CF-00127', runtime.target);
  mark('browser-missing-fallback', runtime.label === '—' && !runtime.threw, runtime.label || runtime.threw);
  mark('browser-brands-page-renders', runtime.hasSellerMgmt, runtime.bodySnippet.replace(/\s+/g, ' ').slice(0, 80));

  // Simulate set-state message
  const setStateOk = await page.evaluate(() => {
    try {
      window.postMessage(
        {
          type: 'cms-mirror-set-state',
          role: 'admin',
          userId: 'admin-uid',
          displayName: 'Admin',
          choosifyUserId: 'CF-00005',
          email: 'admin@test.local',
          page: 'brands',
        },
        '*',
      );
      return true;
    } catch (e) {
      return String(e);
    }
  });
  await page.waitForTimeout(500);
  mark('browser-set-state-message', setStateOk === true, String(setStateOk));
  mark(
    'browser-set-state-no-data-referror',
    !consoleErrors.some((e) => /data is not defined|cfIdLabelForUid is not defined/i.test(e)),
  );

  await browser.close();
}

async function main() {
  staticChecks();
  try {
    const health = await fetch(`${BASE}/health`);
    mark('server-health', health.ok, String(health.status));
    if (health.ok) await browserChecks();
  } catch (err) {
    mark('server-health', false, String(err));
  }

  const failed = results.filter((r) => !r.ok);
  console.log('\n--- SUMMARY ---');
  console.log(`PASS ${results.length - failed.length} / ${results.length}`);
  if (failed.length) {
    console.log('FAILED:', failed.map((f) => f.id).join(', '));
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('PROBE FATAL', err);
  process.exit(1);
});
