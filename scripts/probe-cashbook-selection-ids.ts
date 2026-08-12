import { chromium } from 'playwright-core';
import { writeFileSync } from 'fs';

const BASE = 'http://localhost:3001';

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' }).catch(() =>
    chromium.launch({ headless: true }),
  );
  const page = await browser.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  await page.evaluate(() => localStorage.removeItem('choosify_order_intervention_mode'));
  await page.getByRole('button', { name: 'Admin', exact: true }).click();
  await page.waitForTimeout(1000);
  await page.goto(`${BASE}/admin/orders`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3500);
  const cms = page.frames().find((f) => f.url().includes('cms-mirror/app.html'));
  if (!cms) throw new Error('no frame');
  const ids = ['#CH-10234', '#CH-10233', '#CH-10232'];
  await cms.evaluate((orderIds) => {
    const inst = (window as any).__CMS_MIRROR_INSTANCE__;
    inst.setState({ orderSelectedIds: new Set(orderIds), showImportCashbookModal: false });
  }, ids);
  await page.waitForTimeout(500);
  await cms.locator('button', { hasText: /Import to Cashbook/i }).first().click({ force: true });
  await page.waitForTimeout(900);
  const out = await cms.evaluate(() => {
    const inst = (window as any).__CMS_MIRROR_INSTANCE__;
    const selected = Array.from(inst.state.orderSelectedIds || []);
    const body = document.body.innerText;
    const labelMatch = body.match(/Selected:\s*([^\n]+)/);
    return {
      selected,
      selectedCount: selected.length,
      label: labelMatch ? labelMatch[1].trim() : null,
      modalOpen: !!inst.state.showImportCashbookModal,
      labelMatchesCount: labelMatch ? labelMatch[1].includes(String(selected.length)) : false,
    };
  });
  writeFileSync('.data/probe-cashbook-selection-ids.json', JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
  process.exit(out.modalOpen && out.selectedCount === 3 && out.labelMatchesCount ? 0 : 1);
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
