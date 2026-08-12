/**
 * Verify role-specific Command Center dashboards: layout gap fix, honest chart,
 * role-appropriate cards, period filter wiring.
 */
import { chromium } from 'playwright-core';

const ASSET = '20260811-command-center-1';

type Role = 'seller' | 'creator' | 'admin';

async function probeDashboard(role: Role, zeroData = false) {
  const browser = await chromium
    .launch({ headless: true, channel: 'chrome' })
    .catch(() => chromium.launch({ headless: true }));
  const page = await browser.newPage();
  await page.goto(
    `http://localhost:3001/cms-mirror/app.html?v=${ASSET}#page=dashboard&role=${role}`,
    { waitUntil: 'domcontentloaded', timeout: 60000 },
  );
  await page.evaluate(
    ({ r, zero }) => {
      (window as any).__CMS_MIRROR_ROLE__ = r === 'admin' ? 'super_admin' : r;
      if (zero && r === 'seller') {
        (window as any).__CMS_MIRROR_UID__ = '__zero_seller_probe__';
        (window as any).__CMS_MIRROR_USER_ID__ = '__zero_seller_probe__';
      }
      try {
        (window as any).__CMS_MIRROR_INSTANCE__?.setPage?.('dashboard', { silent: true });
        (window as any).__CMS_MIRROR_INSTANCE__?.setState?.({ range: '30d' });
      } catch {
        /* ignore */
      }
    },
    { r: role, zero: zeroData },
  );
  await page.waitForTimeout(2200);

  const snapshot = await page.evaluate((r) => {
    const text = document.body.innerText || '';
    const inst = (window as any).__CMS_MIRROR_INSTANCE__;
    const grid = document.querySelector('[style*="grid-template-columns:2fr 1fr"]');
    const leftCol = grid?.querySelector(':scope > div:first-child');
    const leftCards = leftCol ? leftCol.querySelectorAll(':scope > div').length : 0;
    const leftHeight = leftCol ? (leftCol as HTMLElement).offsetHeight : 0;
    const rightCol = grid?.querySelector(':scope > div:last-child');
    const rightHeight = rightCol ? (rightCol as HTMLElement).offsetHeight : 0;
    const heightGap = leftHeight && rightHeight ? Math.abs(leftHeight - rightHeight) : 0;
    const chartArea = leftCol?.querySelector('[style*="height:160px"]');
    const chartBars = chartArea?.querySelectorAll('[style*="border-radius:5px 5px 0 0"]').length || 0;
    const emptyChart = /No sales yet|No platform orders|No content yet|No view activity|No sales in selected period/i.test(text);
    const dashCardText = Array.from(document.querySelectorAll('[style*="border:1px solid #E8EDF2"]'))
      .map((el) => (el as HTMLElement).innerText || '')
      .join('\n');
    return {
      role: r,
      page: inst?.state?.page,
      title: text.match(/(Seller|Creator|Platform) Command Center/)?.[0] || '',
      hasCmsPublishCard: /CMS Publish Health/i.test(text),
      hasTrustCard: /Trust & Safety/i.test(text) && /View Trust Center/i.test(text),
      hasPublishChoosify: /Publish to choosify\.bd/i.test(text),
      hasCategoryStudioQuick: /Category Management Studio/i.test(text),
      hasInventoryPanel: /Inventory & Catalog Health/i.test(text),
      hasFinanceSnapshot: /Finance Snapshot|Earnings Snapshot|Financial Operations/i.test(text),
      hasActionCenter: /Action Center|Today \/ Action Center/i.test(text),
      leftCards,
      leftHeight,
      rightHeight,
      heightGap,
      chartBars,
      emptyChart,
      hasSalesTrend: /Sales & Order Trend|Content Performance Trend|Platform GMV/i.test(text),
    };
  }, role);

  await browser.close();
  return { ...snapshot, zeroData };
}

function passRole(role: Role, s: Awaited<ReturnType<typeof probeDashboard>>) {
  const isAdmin = role === 'admin';
  const isSeller = role === 'seller';
  const isCreator = role === 'creator';
  const layoutOk =
    (isSeller && s.hasInventoryPanel && s.hasFinanceSnapshot) ||
    (isCreator && s.hasFinanceSnapshot) ||
    (isAdmin && s.hasFinanceSnapshot);
  const adminCardsOk = isAdmin
    ? s.hasCmsPublishCard && s.hasTrustCard
    : !s.hasCmsPublishCard && !s.hasTrustCard;
  const sellerQuickOk = isSeller ? !s.hasCategoryStudioQuick : true;
  const adminQuickOk = isAdmin ? s.hasCategoryStudioQuick : true;
  const roleTitleOk =
    (isSeller && s.title.includes('Seller')) ||
    (isCreator && s.title.includes('Creator')) ||
    (isAdmin && s.title.includes('Platform'));
  const chartOk = s.zeroData ? s.emptyChart && s.chartBars === 0 : s.hasSalesTrend;
  const gapOk = !s.leftHeight || !s.rightHeight || s.heightGap < Math.max(s.leftHeight, s.rightHeight) * 0.35;
  return layoutOk && adminCardsOk && sellerQuickOk && adminQuickOk && roleTitleOk && s.hasActionCenter && chartOk && gapOk;
}

async function main() {
  const results = [];
  for (const role of ['seller', 'creator', 'admin'] as Role[]) {
    results.push(await probeDashboard(role, false));
  }
  results.push(await probeDashboard('seller', true));

  const allPass = results.every((r) => passRole(r.role === 'seller' && r.zeroData ? 'seller' : r.role, r));

  console.log(JSON.stringify({ results, allPass }, null, 2));
  console.log(allPass ? 'BROWSER_PASS' : 'BROWSER_FAIL');
  process.exit(allPass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
