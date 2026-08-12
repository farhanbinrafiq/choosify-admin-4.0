import { chromium } from 'playwright-core';

async function main() {
  const browser = await chromium
    .launch({ headless: true, channel: 'chrome' })
    .catch(() => chromium.launch({ headless: true }));
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(
    'http://localhost:3001/cms-mirror/app.html?v=20260810-cashbook-delete-btn-1#page=myCashbook&role=seller',
    { waitUntil: 'domcontentloaded', timeout: 60000 },
  );
  await page.evaluate(() => {
    (window as any).__CMS_MIRROR_ROLE__ = 'seller';
    try {
      (window as any).__CMS_MIRROR_INSTANCE__?.setPage?.('myCashbook', { silent: true });
    } catch {
      /* ignore */
    }
  });
  await page.waitForTimeout(2000);
  await page.evaluate(() => {
    const inst = (window as any).__CMS_MIRROR_INSTANCE__;
    if (!inst) return;
    const books = [];
    for (let i = 1; i <= 12; i++) {
      books.push({
        id: 'cb_test_' + i,
        name: 'Book ' + i,
        icon: '📒',
        color: '#EF3C23',
        entries: [],
        updated: 'now',
      });
    }
    books[0].name = 'Weaving Hub Handloom Supplies';
    books[0].id = 'cb_test_A';
    books[5].name = 'Middle Book';
    books[5].id = 'cb_test_M';
    books[11].name = 'Last Book';
    books[11].id = 'cb_test_Z';
    inst.setState({
      cashbookBooks: books,
      selectedCashbookBookId: null,
      cashbookDeleteBookId: null,
    });
  });
  await page.waitForTimeout(400);

  await page.evaluate(() =>
    (window as any).__CMS_MIRROR_INSTANCE__.requestDeleteCashbookBook('cb_test_A')({
      stopPropagation() {},
    }),
  );
  await page.waitForTimeout(300);

  const disabledBtn = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const del = buttons.find((b) => /Delete Permanently/i.test(b.textContent || ''));
    if (!del) return { found: false };
    const s = getComputedStyle(del);
    const r = del.getBoundingClientRect();
    return {
      found: true,
      text: (del.textContent || '').trim(),
      disabled: (del as HTMLButtonElement).disabled,
      width: Math.round(r.width),
      height: Math.round(r.height),
      bg: s.backgroundColor,
      color: s.color,
      opacity: s.opacity,
      minWidth: s.minWidth,
      whiteSpace: s.whiteSpace,
    };
  });
  console.log('DISABLED_BTN', JSON.stringify(disabledBtn));

  const m1 = await page.evaluate(() => {
    const text = document.body.innerText;
    const inst = (window as any).__CMS_MIRROR_INSTANCE__;
    const fixed = Array.from(document.querySelectorAll('div')).some((d) => {
      const s = getComputedStyle(d);
      return s.position === 'fixed' && s.zIndex === '220' && /Delete Cashbook/i.test(d.innerText || '');
    });
    return {
      fixed,
      modalTitle: /Delete Cashbook\?/i.test(text),
      pendingId: inst.state.cashbookDeleteBookId,
      noInlineDangerPanel: !/DANGER: CONFIRM DELETION/i.test(text),
      hasLabel: /Delete Permanently/i.test(text),
    };
  });
  console.log('FIRST', JSON.stringify(m1));

  // Wrong partial name → still disabled grey
  await page.evaluate(() =>
    (window as any).__CMS_MIRROR_INSTANCE__.setState({
      cashbookDeleteConfirmText: 'Weaving Hub Handloom Supplie',
    }),
  );
  await page.waitForTimeout(150);
  const wrongBtn = await page.evaluate(() => {
    const del = Array.from(document.querySelectorAll('button')).find((b) =>
      /Delete Permanently/i.test(b.textContent || ''),
    ) as HTMLButtonElement | undefined;
    if (!del) return { found: false };
    const s = getComputedStyle(del);
    return {
      found: true,
      disabled: del.disabled,
      width: Math.round(del.getBoundingClientRect().width),
      bg: s.backgroundColor,
      color: s.color,
    };
  });
  console.log('WRONG_NAME_BTN', JSON.stringify(wrongBtn));

  // Exact match → enabled red
  await page.evaluate(() =>
    (window as any).__CMS_MIRROR_INSTANCE__.setState({
      cashbookDeleteConfirmText: 'Weaving Hub Handloom Supplies',
    }),
  );
  await page.waitForTimeout(150);
  const enabledBtn = await page.evaluate(() => {
    const del = Array.from(document.querySelectorAll('button')).find((b) =>
      /Delete Permanently/i.test(b.textContent || ''),
    ) as HTMLButtonElement | undefined;
    if (!del) return { found: false };
    const s = getComputedStyle(del);
    return {
      found: true,
      disabled: del.disabled,
      width: Math.round(del.getBoundingClientRect().width),
      height: Math.round(del.getBoundingClientRect().height),
      bg: s.backgroundColor,
      color: s.color,
      opacity: s.opacity,
    };
  });
  console.log('ENABLED_BTN', JSON.stringify(enabledBtn));

  await page.evaluate(() => (window as any).__CMS_MIRROR_INSTANCE__.cancelDeleteCashbookBook());
  await page.waitForTimeout(200);
  await page.evaluate(() =>
    (window as any).__CMS_MIRROR_INSTANCE__.requestDeleteCashbookBook('cb_test_Z')({
      stopPropagation() {},
    }),
  );
  await page.waitForTimeout(200);
  const m2 = await page.evaluate(() => ({
    pendingId: (window as any).__CMS_MIRROR_INSTANCE__.state.cashbookDeleteBookId,
    saysLast: /Last Book/i.test(document.body.innerText),
  }));
  console.log('LAST', JSON.stringify(m2));

  await page.evaluate(() =>
    (window as any).__CMS_MIRROR_INSTANCE__.setState({ cashbookDeleteConfirmText: 'test' }),
  );
  await page.waitForTimeout(100);
  const wrong = await page.evaluate(() => {
    const inst = (window as any).__CMS_MIRROR_INSTANCE__;
    const book = inst.state.cashbookBooks.find((b: any) => b.id === inst.state.cashbookDeleteBookId);
    return { match: inst.state.cashbookDeleteConfirmText === book.name, name: book.name };
  });
  console.log('WRONG_NAME', JSON.stringify(wrong));

  await page.evaluate(() =>
    (window as any).__CMS_MIRROR_INSTANCE__.setState({ cashbookDeleteConfirmText: 'Last Book' }),
  );
  await page.waitForTimeout(100);
  await page.evaluate(() => (window as any).__CMS_MIRROR_INSTANCE__.confirmDeleteCashbookBook());
  await page.waitForTimeout(200);
  const after = await page.evaluate(() => {
    const books = (window as any).__CMS_MIRROR_INSTANCE__.state.cashbookBooks;
    return {
      hasZ: books.some((b: any) => b.id === 'cb_test_Z'),
      hasA: books.some((b: any) => b.id === 'cb_test_A'),
      modalClosed: !(window as any).__CMS_MIRROR_INSTANCE__.state.cashbookDeleteBookId,
      count: books.length,
    };
  });
  console.log('AFTER', JSON.stringify(after));

  // Mobile width: button still visible
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() =>
    (window as any).__CMS_MIRROR_INSTANCE__.requestDeleteCashbookBook('cb_test_A')({
      stopPropagation() {},
    }),
  );
  await page.waitForTimeout(250);
  const mobileBtn = await page.evaluate(() => {
    const del = Array.from(document.querySelectorAll('button')).find((b) =>
      /Delete Permanently/i.test(b.textContent || ''),
    );
    if (!del) return { found: false };
    const r = del.getBoundingClientRect();
    return {
      found: true,
      text: (del.textContent || '').trim(),
      width: Math.round(r.width),
      height: Math.round(r.height),
      visible: r.width >= 140 && r.height >= 36,
    };
  });
  console.log('MOBILE_BTN', JSON.stringify(mobileBtn));

  await browser.close();

  const isGreyDisabled =
    disabledBtn.found &&
    disabledBtn.text === 'Delete Permanently' &&
    disabledBtn.disabled === true &&
    disabledBtn.width >= 150 &&
    disabledBtn.height >= 36 &&
    Number(disabledBtn.opacity) >= 0.95;

  const wrongStillDisabled =
    wrongBtn.found && wrongBtn.disabled === true && (wrongBtn.width || 0) >= 150;

  const enabledOk =
    enabledBtn.found &&
    enabledBtn.disabled === false &&
    (enabledBtn.width || 0) >= 150 &&
    (enabledBtn.height || 0) >= 36;

  const ok =
    m1.fixed &&
    m1.modalTitle &&
    m1.pendingId === 'cb_test_A' &&
    m1.noInlineDangerPanel &&
    m1.hasLabel &&
    isGreyDisabled &&
    wrongStillDisabled &&
    enabledOk &&
    m2.pendingId === 'cb_test_Z' &&
    !wrong.match &&
    after.modalClosed &&
    !after.hasZ &&
    after.hasA &&
    mobileBtn.found &&
    mobileBtn.visible;
  console.log(ok ? 'BROWSER_PASS' : 'BROWSER_FAIL');
  process.exit(ok ? 0 : 2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
