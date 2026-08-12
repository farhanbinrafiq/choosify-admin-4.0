import { chromium } from 'playwright-core';

async function main() {
  const browser = await chromium
    .launch({ headless: true, channel: 'chrome' })
    .catch(() => chromium.launch({ headless: true }));
  const page = await browser.newPage();
  await page.goto(
    'http://localhost:3001/cms-mirror/app.html?v=20260810-finance-payouts-cashbook-import-1#page=finance&role=seller',
    { waitUntil: 'domcontentloaded', timeout: 60000 },
  );
  await page.evaluate(() => {
    (window as any).__CMS_MIRROR_ROLE__ = 'seller';
    window.postMessage({ type: 'cms-mirror-set-state', role: 'seller', page: 'finance' }, '*');
    try {
      (window as any).__CMS_MIRROR_INSTANCE__?.setPage?.('finance', { silent: true });
    } catch {
      /* ignore */
    }
  });
  await page.waitForTimeout(3000);

  const finance = await page.evaluate(() => {
    const text = document.body?.innerText || '';
    return {
      hasFinancePayoutsHeading: /FINANCE & PAYOUTS/i.test(text),
      hasNet: /NET WITHDRAWABLE/i.test(text),
      hasCommission: /CHOOSIFY COMMISSION/i.test(text),
      hasCashbooksNav: /Cashbooks/i.test(text),
      hasFeesNav: /Fees & Adjustments/i.test(text),
      hasPayoutsNav: /Payouts \/ Withdrawals/i.test(text),
      hasMyEarningsNav: /My Earnings/i.test(text),
      snippet: text.replace(/\s+/g, ' ').slice(0, 600),
    };
  });
  console.log('FINANCE', JSON.stringify(finance, null, 2));

  await page.evaluate(() => {
    try {
      (window as any).__CMS_MIRROR_INSTANCE__?.setPage?.('orders', { silent: true });
    } catch {
      /* ignore */
    }
  });
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const inst = (window as any).__CMS_MIRROR_INSTANCE__;
    if (!inst) return;
    inst.setState({ orderSelectedIds: new Set(['ORD-TEST-1']) });
  });
  await page.waitForTimeout(800);
  const orders = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button')).map((b) =>
      (b.textContent || '').trim(),
    );
    return {
      hasImportBtn: buttons.some((b) => /Import to Cashbook/i.test(b)),
      bulkButtons: buttons.filter((b) =>
        /Approve All|Reject All|Import to Cashbook|Export/i.test(b),
      ),
    };
  });
  console.log('ORDERS', JSON.stringify(orders, null, 2));

  await page.evaluate(() => {
    try {
      (window as any).__CMS_MIRROR_INSTANCE__?.openImportToCashbookModal?.();
    } catch {
      /* ignore */
    }
  });
  await page.waitForTimeout(600);
  const modal = await page.evaluate(() => {
    const text = document.body?.innerText || '';
    return {
      hasModal:
        /Import to Cashbook/i.test(text) &&
        /Search Cashbooks|Create New Cashbook|DESTINATION/i.test(text),
      hasCreateNew: /\+ Create New Cashbook/i.test(text),
    };
  });
  console.log('MODAL', JSON.stringify(modal, null, 2));

  await page.evaluate(() => {
    const inst = (window as any).__CMS_MIRROR_INSTANCE__;
    try {
      inst?.startImportCashbookCreateMode?.();
    } catch {
      /* ignore */
    }
    try {
      inst?.setCashbookNewBookName?.({ target: { value: 'Should Not Persist' } });
    } catch {
      /* ignore */
    }
    try {
      inst?.closeImportCashbookModal?.();
    } catch {
      /* ignore */
    }
  });
  await page.waitForTimeout(400);
  const afterCancel = await page.evaluate(() => {
    const inst = (window as any).__CMS_MIRROR_INSTANCE__;
    const books = inst?.state?.cashbookBooks || [];
    return {
      hasNamed: books.some((b: { name: string }) => b.name === 'Should Not Persist'),
      modalClosed: !inst?.state?.showImportCashbookModal,
    };
  });
  console.log('CANCEL', JSON.stringify(afterCancel, null, 2));

  await browser.close();
  const ok =
    finance.hasFinancePayoutsHeading &&
    finance.hasNet &&
    finance.hasCommission &&
    orders.hasImportBtn &&
    modal.hasModal &&
    afterCancel.modalClosed &&
    !afterCancel.hasNamed;
  console.log(ok ? 'BROWSER_PASS' : 'BROWSER_FAIL');
  process.exit(ok ? 0 : 2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
