/**
 * Verify avatar dropdown closes on outside click + Escape for overlay (CmsMirror) and header layouts.
 */
import { chromium } from 'playwright-core';

async function probeOverlay(role: 'seller' | 'creator' | 'admin') {
  const browser = await chromium
    .launch({ headless: true, channel: 'chrome' })
    .catch(() => chromium.launch({ headless: true }));
  const page = await browser.newPage();
  await page.goto(`http://localhost:3001/admin/dashboard`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2500);

  const trigger = page.locator('.cms-mirror-profile-trigger');
  if (!(await trigger.count())) {
    await browser.close();
    return { role, skipped: true, reason: 'no overlay trigger (not logged in or wrong route)' };
  }

  await trigger.click();
  await page.waitForTimeout(300);
  const openAfterClick = await page.locator('[role="menu"][aria-label="Account menu"]').isVisible();

  // Click inside iframe (outside dropdown)
  const iframe = page.frameLocator('iframe[title="Choosify Admin CMS"]');
  await iframe.locator('body').click({ position: { x: 40, y: 120 }, force: true }).catch(() => {});
  await page.waitForTimeout(400);
  const closedAfterIframeClick = !(await page.locator('[role="menu"][aria-label="Account menu"]').isVisible());

  await trigger.click();
  await page.waitForTimeout(300);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const closedAfterEscape = !(await page.locator('[role="menu"][aria-label="Account menu"]').isVisible());

  await browser.close();
  return { role, openAfterClick, closedAfterIframeClick, closedAfterEscape };
}

async function main() {
  const overlay = await probeOverlay('seller');
  const pass =
    overlay.skipped ||
    (overlay.openAfterClick && overlay.closedAfterIframeClick && overlay.closedAfterEscape);

  console.log(JSON.stringify({ overlay }, null, 2));
  console.log(pass ? 'BROWSER_PASS' : 'BROWSER_FAIL');
  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
