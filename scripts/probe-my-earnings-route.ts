/**
 * Verify Finance → My Earnings hosts Overview + Payment Info,
 * and own Seller/Creator profiles no longer expose those finance tabs.
 * Admin inspection profiles retain Payment Info.
 */
import { chromium } from 'playwright-core';

const ASSET = '20260811-my-earnings-payment-1';

async function probeRole(role: 'seller' | 'creator') {
  const browser = await chromium
    .launch({ headless: true, channel: 'chrome' })
    .catch(() => chromium.launch({ headless: true }));
  const page = await browser.newPage();
  await page.goto(
    `http://localhost:3001/cms-mirror/app.html?v=${ASSET}#page=myEarnings&role=${role}&tab=overview`,
    { waitUntil: 'domcontentloaded', timeout: 60000 },
  );
  await page.evaluate((r) => {
    (window as any).__CMS_MIRROR_ROLE__ = r;
    try {
      (window as any).__CMS_MIRROR_INSTANCE__?.setPage?.('myEarnings', { silent: true, tab: 'overview' });
    } catch {
      /* ignore */
    }
  }, role);
  await page.waitForTimeout(1800);

  const overview = await page.evaluate(() => {
    const text = document.body.innerText || '';
    const inst = (window as any).__CMS_MIRROR_INSTANCE__;
    return {
      page: inst?.state?.page,
      tab: inst?.state?.myEarningsTab,
      hasOverviewTab: /\bOverview\b/.test(text),
      hasPaymentInfoTab: /Payment Info/i.test(text),
      hasLifetime: /LIFETIME EARNINGS/i.test(text),
      hasNet: /NET WITHDRAWABLE/i.test(text),
      hasPayoutDetails: /Payout Account Details/i.test(text),
      hasSellerProfileTitle: /Seller Profile/i.test(text) && /Account Information/i.test(text),
      hasCreatorProfileTitle: /Creator Profile/i.test(text) && /Account Information/i.test(text),
    };
  });

  await page.evaluate(() => {
    (window as any).__CMS_MIRROR_INSTANCE__?.setPage?.('myEarnings', { silent: true, tab: 'payment' });
  });
  await page.waitForTimeout(1000);

  const payment = await page.evaluate(() => {
    const text = document.body.innerText || '';
    const inst = (window as any).__CMS_MIRROR_INSTANCE__;
    return {
      page: inst?.state?.page,
      tab: inst?.state?.myEarningsTab,
      hash: location.hash,
      hasPayoutDetails: /Payout Account Details/i.test(text),
      hasPayoutMethod: /PAYOUT METHOD/i.test(text),
      hasLifetime: /LIFETIME EARNINGS/i.test(text),
      hasSellerProfileTitle: /Seller Profile/i.test(text) && /Account Information/i.test(text),
    };
  });

  await page.evaluate((r) => {
    const target = r === 'creator' ? 'creatorProfile' : 'brandProfile';
    (window as any).__CMS_MIRROR_INSTANCE__?.setPage?.(target, { silent: true });
  }, role);
  await page.waitForTimeout(1200);

  const profile = await page.evaluate((r) => {
    const labels = Array.from(document.querySelectorAll('div'))
      .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim())
      .filter((t) => t.length > 0 && t.length < 60);
    const profileTabs = [...new Set(labels.filter((t) => /^[⚙▤◆▥💰🏦●🏷]\s/.test(t)))];
    return {
      page: (window as any).__CMS_MIRROR_INSTANCE__?.state?.page,
      profileTabs,
      hasEarningsTab: profileTabs.some((t) => /My Earnings/i.test(t)),
      hasPaymentTab: profileTabs.some((t) => /Payment Info/i.test(t)),
      hasVerificationTab: profileTabs.some((t) => /Verification Center/i.test(t)),
      profileTitleOk:
        r === 'seller' ? /Seller Profile/i.test(document.body.innerText || '') : /Creator Profile/i.test(document.body.innerText || ''),
    };
  }, role);

  await page.evaluate(() => (window as any).__CMS_MIRROR_INSTANCE__?.goFinanceMyEarnings?.());
  await page.waitForTimeout(800);
  const nav = await page.evaluate(() => {
    const inst = (window as any).__CMS_MIRROR_INSTANCE__;
    return { page: inst?.state?.page, tab: inst?.state?.myEarningsTab };
  });

  await browser.close();
  return { role, overview, payment, profile, nav };
}

async function probeAdminInspection() {
  const browser = await chromium
    .launch({ headless: true, channel: 'chrome' })
    .catch(() => chromium.launch({ headless: true }));
  const page = await browser.newPage();
  await page.goto(
    `http://localhost:3001/cms-mirror/app.html?v=${ASSET}#page=brands&role=admin`,
    { waitUntil: 'domcontentloaded', timeout: 60000 },
  );
  await page.evaluate(() => {
    (window as any).__CMS_MIRROR_ROLE__ = 'admin';
    const inst = (window as any).__CMS_MIRROR_INSTANCE__;
    if (inst?.setPage) inst.setPage('brands', { silent: true });
  });
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    const inst = (window as any).__CMS_MIRROR_INSTANCE__;
    // Seed brand list lives in script-scope Component (not window.Component).
    if (inst?.selectBrand) inst.selectBrand('Aarong');
  });
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    const inst = (window as any).__CMS_MIRROR_INSTANCE__;
    if (inst?.setBrandProfileTab) inst.setBrandProfileTab('payment');
    try {
      inst?.forceUpdate?.();
    } catch {
      /* ignore */
    }
  });
  await page.waitForTimeout(1200);
  const admin = await page.evaluate(() => {
    const text = document.body.innerText || '';
    const inst = (window as any).__CMS_MIRROR_INSTANCE__;
    const labels = Array.from(document.querySelectorAll('div'))
      .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim())
      .filter((t) => t.length > 0 && t.length < 80);
    const profileTabs = [
      ...new Set(
        labels.filter(
          (t) =>
            /Payment Info|My Earnings|Verification Center|Account Information|Brand Portfolio|Product Listings/i.test(t) &&
            t.length < 40,
        ),
      ),
    ];
    return {
      page: inst?.state?.page,
      selectedBrandName: inst?.state?.selectedBrandName,
      tab: inst?.state?.brandProfileTab,
      profileTabs,
      hasPaymentTab: profileTabs.some((t) => /Payment Info/i.test(t)) || /🏦\s*Payment Info/i.test(text),
      hasEarningsTab: profileTabs.some((t) => /My Earnings/i.test(t)) || /💰\s*My Earnings/i.test(text),
      hasPayoutDetails: /Payout Account Details/i.test(text),
      hasPayoutMethod: /PAYOUT METHOD/i.test(text),
    };
  });
  await browser.close();
  return admin;
}

async function main() {
  const seller = await probeRole('seller');
  const creator = await probeRole('creator');
  const admin = await probeAdminInspection();
  console.log('SELLER', JSON.stringify(seller, null, 2));
  console.log('CREATOR', JSON.stringify(creator, null, 2));
  console.log('ADMIN', JSON.stringify(admin, null, 2));

  const roleOk = (r: typeof seller) =>
    r.overview.page === 'myEarnings' &&
    r.overview.hasLifetime &&
    r.overview.hasNet &&
    !r.overview.hasPayoutDetails &&
    !r.overview.hasSellerProfileTitle &&
    !r.overview.hasCreatorProfileTitle &&
    r.payment.page === 'myEarnings' &&
    r.payment.tab === 'payment' &&
    r.payment.hasPayoutDetails &&
    r.payment.hasPayoutMethod &&
    !r.payment.hasLifetime &&
    /tab=payment/.test(r.payment.hash) &&
    !r.profile.hasEarningsTab &&
    !r.profile.hasPaymentTab &&
    r.profile.hasVerificationTab &&
    r.nav.page === 'myEarnings';

  const ok = roleOk(seller) && roleOk(creator) && admin.hasPaymentTab && admin.hasPayoutDetails && admin.hasPayoutMethod;
  console.log(ok ? 'BROWSER_PASS' : 'BROWSER_FAIL');
  process.exit(ok ? 0 : 2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
