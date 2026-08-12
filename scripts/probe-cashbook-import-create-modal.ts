/**
 * Verify Order Console Import → Create New Cashbook uses the shared
 * Create New Book modal (Book Name + Book Icon), not the simplified form.
 */
import { chromium } from 'playwright-core';

const ASSET = '20260811-cashbook-create-modal-1';

async function probeImportCreateModal(role: 'seller' | 'creator') {
  const browser = await chromium
    .launch({ headless: true, channel: 'chrome' })
    .catch(() => chromium.launch({ headless: true }));
  const page = await browser.newPage();
  await page.goto(
    `http://localhost:3001/cms-mirror/app.html?v=${ASSET}#page=orders&role=${role}`,
    { waitUntil: 'domcontentloaded', timeout: 60000 },
  );
  await page.evaluate((r) => {
    (window as any).__CMS_MIRROR_ROLE__ = r;
    (window as any).__CMS_MIRROR_INSTANCE__?.setPage?.('orders', { silent: true });
  }, role);
  await page.waitForTimeout(1500);

  await page.evaluate(() => {
    const inst = (window as any).__CMS_MIRROR_INSTANCE__;
    inst?.setState?.({ orderSelectedIds: new Set(['ORD-PROBE-1', 'ORD-PROBE-2']) });
    inst?.openImportToCashbookModal?.();
  });
  await page.waitForTimeout(800);

  const picker = await page.evaluate(() => {
    const text = document.body.innerText || '';
    return {
      hasImportPicker: /Import to Cashbook/i.test(text) && /Create New Cashbook/i.test(text),
      hasSimplifiedNameOnly: /CASHBOOK NAME/i.test(text),
      selectedCount: ((window as any).__CMS_MIRROR_INSTANCE__?.state?.orderSelectedIds?.size) || 0,
    };
  });

  await page.evaluate(() => {
    (window as any).__CMS_MIRROR_INSTANCE__?.startImportCashbookCreateMode?.();
  });
  await page.waitForTimeout(800);

  const createModal = await page.evaluate(() => {
    const text = document.body.innerText || '';
    const inst = (window as any).__CMS_MIRROR_INSTANCE__;
    return {
      mode: inst?.state?.cashbookNewBookMode,
      modal: inst?.state?.cashbookModal,
      importStillOpen: !!inst?.state?.showImportCashbookModal,
      selectedCount: inst?.state?.orderSelectedIds?.size || 0,
      hasBookName: /BOOK NAME/i.test(text),
      hasBookIcon: /BOOK ICON/i.test(text),
      hasSelectedIcon: /Selected icon for this book/i.test(text),
      hasCreateAndImport: /Create & Import/i.test(text),
      hasSimplifiedCashbookName: /CASHBOOK NAME/i.test(text),
      defaultIcon: inst?.state?.cashbookNewBookIcon,
    };
  });

  await page.evaluate(() => {
    const inst = (window as any).__CMS_MIRROR_INSTANCE__;
    inst?.setCashbookNewBookName?.({ target: { value: 'August Electronics Sales' } });
    inst?.setCashbookNewBookIcon?.('🛒')?.();
  });
  await page.waitForTimeout(400);

  const afterIcon = await page.evaluate(() => ({
    icon: (window as any).__CMS_MIRROR_INSTANCE__?.state?.cashbookNewBookIcon,
    name: (window as any).__CMS_MIRROR_INSTANCE__?.state?.cashbookNewBookName,
  }));

  await page.evaluate(() => {
    (window as any).__CMS_MIRROR_INSTANCE__?.cancelCreateCashbookBook?.();
  });
  await page.waitForTimeout(500);

  const afterCancel = await page.evaluate(() => {
    const inst = (window as any).__CMS_MIRROR_INSTANCE__;
    const books = inst?.state?.cashbookBooks || [];
    return {
      backToPicker: /Import to Cashbook/i.test(document.body.innerText || ''),
      modalClosed: inst?.state?.cashbookModal !== 'newBook',
      selectedCount: inst?.state?.orderSelectedIds?.size || 0,
      noAugustBook: !books.some((b: { name: string }) => b.name === 'August Electronics Sales'),
      nameCleared: !(inst?.state?.cashbookNewBookName || '').trim(),
    };
  });

  await page.evaluate(() => {
    (window as any).__CMS_MIRROR_INSTANCE__?.closeImportCashbookModal?.();
  });
  await page.waitForTimeout(300);

  await browser.close();
  return { role, picker, createModal, afterIcon, afterCancel };
}

async function probeMyCashbookNormalCreate(role: 'seller' | 'creator') {
  const browser = await chromium
    .launch({ headless: true, channel: 'chrome' })
    .catch(() => chromium.launch({ headless: true }));
  const page = await browser.newPage();
  await page.goto(
    `http://localhost:3001/cms-mirror/app.html?v=${ASSET}#page=myCashbook&role=${role}`,
    { waitUntil: 'domcontentloaded', timeout: 60000 },
  );
  await page.evaluate((r) => {
    (window as any).__CMS_MIRROR_ROLE__ = r;
    (window as any).__CMS_MIRROR_INSTANCE__?.setPage?.('myCashbook', { silent: true });
  }, role);
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    (window as any).__CMS_MIRROR_INSTANCE__?.createNewCashbookBook?.();
  });
  await page.waitForTimeout(600);
  const normal = await page.evaluate(() => {
    const text = document.body.innerText || '';
    const inst = (window as any).__CMS_MIRROR_INSTANCE__;
    return {
      mode: inst?.state?.cashbookNewBookMode,
      hasBookName: /BOOK NAME/i.test(text),
      hasBookIcon: /BOOK ICON/i.test(text),
      hasCreateBook: /Create Book/i.test(text) && !/Create & Import/i.test(text),
      defaultIcon: inst?.state?.cashbookNewBookIcon,
    };
  });
  await browser.close();
  return { role, normal };
}

async function main() {
  const sellerImport = await probeImportCreateModal('seller');
  const creatorImport = await probeImportCreateModal('creator');
  const sellerCashbook = await probeMyCashbookNormalCreate('seller');
  const creatorCashbook = await probeMyCashbookNormalCreate('creator');

  console.log('SELLER_IMPORT', JSON.stringify(sellerImport, null, 2));
  console.log('CREATOR_IMPORT', JSON.stringify(creatorImport, null, 2));
  console.log('SELLER_CASHBOOK', JSON.stringify(sellerCashbook, null, 2));
  console.log('CREATOR_CASHBOOK', JSON.stringify(creatorCashbook, null, 2));

  const okImport = (r: typeof sellerImport) =>
    r.picker.hasImportPicker &&
    !r.picker.hasSimplifiedNameOnly &&
    r.picker.selectedCount >= 1 &&
    r.createModal.mode === 'create-and-import' &&
    r.createModal.hasBookName &&
    r.createModal.hasBookIcon &&
    r.createModal.hasSelectedIcon &&
    r.createModal.hasCreateAndImport &&
    !r.createModal.hasSimplifiedCashbookName &&
    r.createModal.defaultIcon === '📒' &&
    r.afterIcon.icon === '🛒' &&
    r.afterCancel.backToPicker &&
    r.afterCancel.selectedCount >= 1 &&
    r.afterCancel.noAugustBook &&
    r.afterCancel.nameCleared;

  const okNormal = (r: typeof sellerCashbook) =>
    r.normal.mode === 'normal' &&
    r.normal.hasBookName &&
    r.normal.hasBookIcon &&
    r.normal.hasCreateBook &&
    r.normal.defaultIcon === '📒';

  const ok =
    okImport(sellerImport) &&
    okImport(creatorImport) &&
    okNormal(sellerCashbook) &&
    okNormal(creatorCashbook);

  console.log(ok ? 'BROWSER_PASS' : 'BROWSER_FAIL');
  process.exit(ok ? 0 : 2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
