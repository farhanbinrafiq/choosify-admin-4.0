import { chromium } from 'playwright-core';
import { db } from '../server/db/client.ts';
import { users } from '../server/db/schema.ts';
import { eq } from 'drizzle-orm';
import { signAccessToken } from '../server/auth/jwtTokens.ts';

async function waitReady(page: import('playwright-core').Page) {
  await page
    .waitForFunction(
      () => {
        const t = document.body?.innerText || '';
        return !/AUTHENTICATING CHOOSIFY SESSION/i.test(t) && t.trim().length > 40;
      },
      { timeout: 45000 },
    )
    .catch(() => undefined);
  await page.waitForTimeout(2000);
}

async function measure(page: import('playwright-core').Page, label: string) {
  await waitReady(page);
  const m = await page.evaluate(() => {
    const body = document.body?.innerText || '';
    const layoutRoot = document.querySelector('.space-y-6.pb-12') as HTMLElement | null;
    const grid = layoutRoot?.querySelector('.grid') as HTMLElement | null;
    const leftCol = grid?.children?.[0] as HTMLElement | undefined;
    const rightCol = grid?.children?.[1] as HTMLElement | undefined;
    const tabs = Array.from(document.querySelectorAll('button, a, [role=tab]'))
      .map((b) => (b.textContent || '').trim())
      .filter((t) =>
        /Account|Security|Orders|Reviews|Permissions|Activity|Notification|Verification|Portfolio|Followed|Saved|Search History|Ads/i.test(
          t,
        ),
      )
      .slice(0, 12);
    const cfMatch = body.match(/CF-\d{5}/g);
    const titleEls = Array.from(document.querySelectorAll('h1, h2, h3'));
    const profileTitle =
      titleEls.map((e) => (e.textContent || '').trim()).find((t) => /Profile/i.test(t)) ||
      (titleEls[0]?.textContent || '').trim();
    return {
      profileTitle,
      cfIds: cfMatch || [],
      tabs,
      leftWidth: leftCol ? Math.round(leftCol.getBoundingClientRect().width) : null,
      rightLeft: rightCol ? Math.round(rightCol.getBoundingClientRect().left) : null,
      hasSearchRecords: /Search records/i.test(body),
      hasProfileLayout: Boolean(layoutRoot),
      hasLoginAs: /Login As User/i.test(body),
      hasAdminTabs: /Security & Sessions|Permissions & Role|Activity Log/i.test(body),
      snippet: body.replace(/\s+/g, ' ').slice(0, 280),
    };
  });
  console.log(label, JSON.stringify(m));
  return m;
}

async function openAs(
  browser: import('playwright-core').Browser,
  user: { id: string; email: string; emailVerified?: boolean | null },
  url: string,
  label: string,
) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const token = signAccessToken({
    id: user.id,
    email: user.email,
    emailVerified: !!user.emailVerified,
  });
  await page.addInitScript((t) => localStorage.setItem('choosify_auth_token', t), token);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const m = await measure(page, label);
  await context.close();
  return m;
}

async function main() {
  const admin = (await db.select().from(users).where(eq(users.email, 'admin@choosify.com.bd')).limit(1))[0];
  const all = await db.select().from(users).limit(200);
  const seller = all.find((u) => String(u.role) === 'seller') || null;
  const creator = all.find((u) => String(u.role) === 'creator') || null;
  const consumer =
    all.find((u) => /consumer|customer|buyer/i.test(String(u.role))) || null;

  console.log(
    'USERS',
    JSON.stringify({
      admin: admin && { id: admin.id, cf: (admin as { choosifyUserId?: string }).choosifyUserId },
      seller: seller && { id: seller.id, cf: (seller as { choosifyUserId?: string }).choosifyUserId, email: seller.email },
      creator: creator && {
        id: creator.id,
        cf: (creator as { choosifyUserId?: string }).choosifyUserId,
        email: creator.email,
      },
      consumer: consumer && {
        id: consumer.id,
        cf: (consumer as { choosifyUserId?: string }).choosifyUserId,
        email: consumer.email,
        role: consumer.role,
      },
      roles: [...new Set(all.map((u) => String(u.role)))],
    }),
  );

  if (!admin) throw new Error('admin missing');

  const browser = await chromium
    .launch({ headless: true, channel: 'chrome' })
    .catch(() => chromium.launch({ headless: true }));

  const adminSelf = await openAs(browser, admin, 'http://localhost:3001/admin/profile', 'ADMIN_SELF');

  const consumerId = consumer?.id || '1';
  const inspectConsumer = await openAs(
    browser,
    admin,
    `http://localhost:3001/consumer/${encodeURIComponent(consumerId)}`,
    consumer ? 'ADMIN_INSPECT_CONSUMER' : 'ADMIN_INSPECT_CONSUMER_FALLBACK',
  );

  const inspectSeller = await openAs(
    browser,
    admin,
    `http://localhost:3001/seller/${encodeURIComponent(seller?.id || '1')}`,
    seller ? 'ADMIN_INSPECT_SELLER' : 'ADMIN_INSPECT_SELLER_FALLBACK',
  );

  const inspectCreator = await openAs(
    browser,
    admin,
    `http://localhost:3001/creator/${encodeURIComponent(creator?.id || '1')}`,
    creator ? 'ADMIN_INSPECT_CREATOR' : 'ADMIN_INSPECT_CREATOR_FALLBACK',
  );

  let sellerSelf = null as Awaited<ReturnType<typeof measure>> | null;
  if (seller) {
    sellerSelf = await openAs(
      browser,
      seller,
      `http://localhost:3001/seller/${encodeURIComponent(seller.id)}`,
      'SELLER_SELF',
    );
  }

  let creatorSelf = null as Awaited<ReturnType<typeof measure>> | null;
  if (creator) {
    creatorSelf = await openAs(
      browser,
      creator,
      `http://localhost:3001/creator/${encodeURIComponent(creator.id)}`,
      'CREATOR_SELF',
    );
  }

  let consumerSelf = null as Awaited<ReturnType<typeof measure>> | null;
  if (consumer) {
    consumerSelf = await openAs(
      browser,
      consumer,
      `http://localhost:3001/consumer/${encodeURIComponent(consumer.id)}`,
      'CONSUMER_SELF',
    );
  }

  console.log(
    'STRUCT_COMPARE',
    JSON.stringify({
      admin: {
        left: adminSelf.leftWidth,
        layout: adminSelf.hasProfileLayout,
        cf: adminSelf.cfIds,
        adminTabs: adminSelf.hasAdminTabs,
        loginAs: adminSelf.hasLoginAs,
      },
      inspectConsumer: {
        left: inspectConsumer.leftWidth,
        layout: inspectConsumer.hasProfileLayout,
        cf: inspectConsumer.cfIds,
      },
      inspectSeller: {
        left: inspectSeller.leftWidth,
        layout: inspectSeller.hasProfileLayout,
        cf: inspectSeller.cfIds,
        loginAs: inspectSeller.hasLoginAs,
      },
      inspectCreator: {
        left: inspectCreator.leftWidth,
        layout: inspectCreator.hasProfileLayout,
        cf: inspectCreator.cfIds,
        loginAs: inspectCreator.hasLoginAs,
      },
      sellerSelf: sellerSelf && {
        left: sellerSelf.leftWidth,
        layout: sellerSelf.hasProfileLayout,
        cf: sellerSelf.cfIds,
      },
      creatorSelf: creatorSelf && {
        left: creatorSelf.leftWidth,
        layout: creatorSelf.hasProfileLayout,
        cf: creatorSelf.cfIds,
      },
      consumerSelf: consumerSelf && {
        left: consumerSelf.leftWidth,
        layout: consumerSelf.hasProfileLayout,
        cf: consumerSelf.cfIds,
      },
      sameLeftWidth:
        Boolean(adminSelf.leftWidth) &&
        adminSelf.leftWidth === inspectSeller.leftWidth &&
        inspectSeller.leftWidth === inspectCreator.leftWidth,
    }),
  );

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
