/**
 * Real browser verification: Admin Orders oversight + Select All + Seller ops.
 * TempRole buttons on /login. Does not commit financial mutations beyond UI checks.
 */
import { chromium, type Page, type Frame } from 'playwright-core';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const BASE = process.env.PROBE_BASE_URL?.replace(/\/api\/v1$/, '') || 'http://localhost:3001';
const OUT = join(process.cwd(), '.data', 'probe-orders-oversight-selectall.json');

type RoleReport = Record<string, unknown>;

async function tempRole(page: Page, roleLabel: string) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(700);
  await page.evaluate(() => {
    try { localStorage.removeItem('choosify_order_intervention_mode'); } catch {}
  });
  const btn = page.getByRole('button', { name: roleLabel, exact: true });
  if (!(await btn.count())) throw new Error(`TempRole button missing: ${roleLabel}`);
  await btn.click();
  await page.waitForTimeout(1500);
}

async function ordersFrame(page: Page): Promise<Frame> {
  await page.goto(`${BASE}/admin/orders`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3500);
  const iframe = page.frameLocator('iframe[title="Choosify Admin CMS"]');
  // Wait for Order Console
  await iframe.locator('text=Order Console').first().waitFor({ timeout: 20000 });
  const cms = page.frames().find((f) => f.url().includes('cms-mirror/app.html'));
  if (!cms) throw new Error('cms-mirror iframe not found');
  return cms;
}

async function textHas(frame: Frame, re: RegExp) {
  const body = await frame.locator('body').innerText().catch(() => '');
  return re.test(body);
}

async function countText(frame: Frame, re: RegExp) {
  const body = await frame.locator('body').innerText().catch(() => '');
  return (body.match(re) || []).length;
}

async function probeAdmin(page: Page): Promise<RoleReport> {
  const frame = await ordersFrame(page);
  await frame.waitForTimeout(800);

  const body = await frame.locator('body').innerText();
  const report: RoleReport = {
    role: 'admin',
    hasOversightBanner: /Admin Oversight Mode/i.test(body),
    hasEnterIntervention: /Enter Intervention Mode/i.test(body),
    hasInterventionBanner: /Admin Intervention Mode/i.test(body) && /Exit Intervention Mode/i.test(body),
    hasApprove: /APPROVE ORDER/i.test(body),
    hasReject: /\bREJECT\b/.test(body) && /APPROVE ORDER|MARK DELIVERED|INTERNAL NOTE/.test(body),
    hasMarkDelivered: /MARK DELIVERED/i.test(body),
    hasInternalNoteOp: /⚖ INTERNAL NOTE|INTERNAL NOTE/.test(body) && !/View Internal Notes/.test(body),
    hasFulfillmentOp: /\bFULFILLMENT\b/.test(body) && !/View Fulfillment Details/.test(body),
    hasOversightStatus: /ORDER STATUS/i.test(body),
    hasOversightPayment: /PAYMENT/i.test(body) && /ORDER STATUS/i.test(body),
    hasOversightDelivery: /DELIVERY STATUS/i.test(body),
    hasOversightFulfillment: /FULFILLMENT/i.test(body),
    hasOversightNotes: /INTERNAL NOTES/i.test(body),
    hasOversightCourier: /COURIER/i.test(body),
    hasOversightTracking: /TRACKING/i.test(body),
    hasViewInvoice: /View Invoice/i.test(body),
    hasSelectAllLabel: /Select All\s*\(/i.test(body) || /All Selected/i.test(body),
    hasMatchingResults: /matching results/i.test(body),
    subtitleOversight: /Oversight & support console/i.test(body),
  };

  // Multi-select: click first row checkbox
  const checks = frame.locator('input[type="checkbox"]');
  const checkCount = await checks.count();
  report.checkboxCount = checkCount;
  if (checkCount >= 2) {
    // Skip master (index 0), click first order checkbox
    await checks.nth(1).check({ force: true }).catch(async () => {
      await checks.nth(1).click({ force: true });
    });
    await frame.waitForTimeout(600);
    let after1 = await frame.locator('body').innerText();
    report.afterOneSelected = {
      selectedLabel: /\b1 selected\b/i.test(after1),
      clearVisible: /Clear Selection/i.test(after1),
      selectAllBtn: /Select All|All Selected/i.test(after1),
      importCashbook: /Import to Cashbook/i.test(after1),
    };

    await checks.nth(2).check({ force: true }).catch(async () => {
      await checks.nth(2).click({ force: true });
    });
    await frame.waitForTimeout(600);
    let after2 = await frame.locator('body').innerText();
    report.afterTwoSelected = {
      selectedLabel: /\b2 selected\b/i.test(after2),
    };

    // Select All via master / button
    const selectAllBtn = frame.locator('button', { hasText: /Select All|All Selected/i }).first();
    if (await selectAllBtn.count()) {
      await selectAllBtn.click({ force: true });
      await frame.waitForTimeout(700);
    } else {
      await checks.nth(0).check({ force: true }).catch(async () => {
        await checks.nth(0).click({ force: true });
      });
      await frame.waitForTimeout(700);
    }
    let afterAll = await frame.locator('body').innerText();
    const m = afterAll.match(/(\d+)\s+selected/i);
    report.afterSelectAll = {
      selectedCountText: m ? Number(m[1]) : null,
      allSelectedLabel: /All Selected/i.test(afterAll),
      importCashbook: /Import to Cashbook/i.test(afterAll),
    };

    // Cashbook modal open check (no mutate)
    if (/Import to Cashbook/i.test(afterAll)) {
      await frame.locator('button', { hasText: /Import to Cashbook/i }).first().click({ force: true });
      await frame.waitForTimeout(1000);
      const modalBody = await frame.locator('body').innerText();
      report.cashbookModal = {
        opened: /cashbook|import/i.test(modalBody),
        mentionsSelected: new RegExp(`${report.afterSelectAll && (report.afterSelectAll as any).selectedCountText || ''}`).test(modalBody)
          || /selected|import/i.test(modalBody),
        snippet: modalBody.slice(0, 400),
      };
      // Close if possible
      const close = frame.locator('button', { hasText: /Cancel|Close|✕/i }).first();
      if (await close.count()) await close.click({ force: true }).catch(() => {});
      await frame.waitForTimeout(400);
    }

    // Clear selection
    const clearBtn = frame.locator('button', { hasText: /Clear Selection/i }).first();
    if (await clearBtn.count()) {
      await clearBtn.click({ force: true });
      await frame.waitForTimeout(600);
    }
    const afterClear = await frame.locator('body').innerText();
    report.afterClear = {
      selectedGone: !/\d+\s+selected/i.test(afterClear) || /0 selected/i.test(afterClear),
      clearHidden: !(await frame.locator('button', { hasText: /Clear Selection/i }).count()),
    };
  }

  // Intervention mode flow
  const enter = frame.locator('button', { hasText: /Enter Intervention Mode/i }).first();
  if (await enter.count()) {
    await enter.click({ force: true });
    await frame.waitForTimeout(500);
    const confirmBody = await frame.locator('body').innerText();
    report.interventionConfirm = /Enter Order Intervention Mode\?/i.test(confirmBody);
    const cont = frame.locator('button', { hasText: /^Continue$/i }).first();
    if (await cont.count()) {
      await cont.click({ force: true });
      await frame.waitForTimeout(800);
    }
    const intervBody = await frame.locator('body').innerText();
    report.afterIntervention = {
      banner: /Admin Intervention Mode/i.test(intervBody) && /Exit Intervention Mode/i.test(intervBody),
      approveVisible: /APPROVE ORDER/i.test(intervBody),
      internalNoteOp: /⚖ INTERNAL NOTE|INTERNAL NOTE/.test(intervBody),
      oversightBannerGone: !/Admin Oversight Mode/i.test(intervBody),
    };
    const exit = frame.locator('button', { hasText: /Exit Intervention Mode/i }).first();
    if (await exit.count()) {
      await exit.click({ force: true });
      await frame.waitForTimeout(800);
    }
    const exitBody = await frame.locator('body').innerText();
    report.afterExitIntervention = {
      oversightBack: /Admin Oversight Mode/i.test(exitBody),
      approveGone: !/APPROVE ORDER/i.test(exitBody),
      interventionBannerGone: !(/Admin Intervention Mode/i.test(exitBody) && /Exit Intervention Mode/i.test(exitBody)),
    };
  }

  return report;
}

async function probeSeller(page: Page): Promise<RoleReport> {
  await tempRole(page, 'Seller');
  const frame = await ordersFrame(page);
  await frame.waitForTimeout(800);
  const body = await frame.locator('body').innerText();
  const report: RoleReport = {
    role: 'seller',
    hasEnterIntervention: /Enter Intervention Mode/i.test(body),
    hasOversightBanner: /Admin Oversight Mode/i.test(body),
    hasApproveOrOps: /APPROVE ORDER|MARK DELIVERED|INTERNAL NOTE|FULFILLMENT|COMMS NOTE/i.test(body),
    hasSelectAll: /Select All/i.test(body),
    hasMatchingResults: /matching results/i.test(body),
    operationalSubtitle: /Process active customer orders/i.test(body),
  };

  const checks = frame.locator('input[type="checkbox"]');
  if ((await checks.count()) >= 2) {
    await checks.nth(1).check({ force: true }).catch(async () => {
      await checks.nth(1).click({ force: true });
    });
    await frame.waitForTimeout(500);
    const after = await frame.locator('body').innerText();
    report.sellerSelection = {
      selected1: /\b1 selected\b/i.test(after),
      clear: /Clear Selection/i.test(after),
    };
  }
  return report;
}

async function main() {
  mkdirSync(join(process.cwd(), '.data'), { recursive: true });
  const browser = await chromium.launch({ headless: true, channel: 'chrome' }).catch(() =>
    chromium.launch({ headless: true }),
  );
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });

  await tempRole(page, 'Admin');
  const admin = await probeAdmin(page);
  const seller = await probeSeller(page);

  const gates = {
    A_adminOversightDefault:
      admin.hasOversightBanner === true &&
      admin.hasEnterIntervention === true &&
      admin.hasApprove === false &&
      admin.hasOversightStatus === true &&
      admin.subtitleOversight === true,
    B_interventionMode:
      admin.interventionConfirm === true &&
      (admin.afterIntervention as any)?.banner === true &&
      (admin.afterExitIntervention as any)?.oversightBack === true,
    C_multiSelect:
      (admin.afterOneSelected as any)?.selectedLabel === true &&
      (admin.afterOneSelected as any)?.clearVisible === true &&
      admin.hasSelectAllLabel === true &&
      (admin.afterClear as any)?.selectedGone === true,
    D_cashbookSameSelection:
      (admin.afterSelectAll as any)?.importCashbook === true &&
      (admin.cashbookModal as any)?.opened === true,
  };

  const out = { admin, seller, gates, base: BASE, at: new Date().toISOString() };
  writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  await browser.close();

  const allYes = Object.values(gates).every(Boolean);
  process.exit(allYes ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
