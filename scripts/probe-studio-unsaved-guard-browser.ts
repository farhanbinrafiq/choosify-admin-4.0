/**
 * Studio Phase A — unsaved-changes guard, shared confirmation dialog and Edit
 * pills, driven in a real browser across the Product, Guide, Brand and Creator
 * Studios.
 *
 * LOCAL + ISOLATED ONLY: needs an Admin dev server (PROBE_BASE_URL_ROOT, default
 * http://localhost:3001) running against a DISPOSABLE local database, and that same
 * database in PROBE_DISPOSABLE_DATABASE_URL (127.0.0.1 / localhost). Refuses
 * otherwise. Creates its own throwaway product / guide / brand / creator in the
 * disposable catalog (left there, clearly named "PA …").
 *
 * Per Studio:
 *   G1 section Edit pills have section-specific accessible names; keyboard focus shows a ring
 *   G2 beforeunload is registered only while dirty; edit-then-revert is clean again
 *   G3 an in-app link click while dirty opens the dialog (role, aria-modal, labelled,
 *      described, focus on "Keep editing", Tab stays inside); Escape cancels; focus returns
 *   G4 the Studio's own Back asks first; "Keep editing" stays; View (Guide/Creator) asks too
 *   G5 a failed save keeps the editor open with the edits, still dirty
 *   G6 Cancel restores the saved values and clears dirty
 *   G7 Back → "Discard changes" leaves to the Studio list
 *   G8 closing the tab while dirty prompts (beforeunload); clean close does not
 * Lifecycle / destructive:
 *   L1 Product Publish asks first; Escape cancels with no status change
 *   L2 Guide Publish asks first (Cancel = no change); Archive asks, is busy-locked, then archives
 *   L3 Guide section Remove asks first; Cancel keeps it; confirm removes it
 *   L4 Creator Publish / Archive ask first; Archive is busy-locked, then archives
 *
 *   PROBE_DISPOSABLE_DATABASE_URL=postgres://postgres@127.0.0.1:55499/choosify_qa \
 *     npx tsx scripts/probe-studio-unsaved-guard-browser.ts
 *
 * Not covered by design (Phase A limitation): the browser's own Back / Forward buttons.
 */
import pg from 'pg';
import { chromium, type BrowserContext, type Page } from 'playwright-core';

const BASE = process.env.PROBE_BASE_URL_ROOT || 'http://localhost:3001';
const API = `${BASE}/api/v1`;
const DB_URL = process.env.PROBE_DISPOSABLE_DATABASE_URL || '';
const DEV_PASSWORD = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';
const SHOTS = process.env.PROBE_SCREENSHOT_DIR || '';
const IMG = 'https://example.invalid/pa-probe.jpg';

const FAIL: string[] = [];
let passes = 0;
function check(c: unknown, label: string, detail?: unknown) {
  if (c) passes += 1;
  else FAIL.push(label);
  console.log(c ? 'PASS' : 'FAIL', label, c ? '' : JSON.stringify(detail ?? '').slice(0, 400));
}
function note(label: string, detail: unknown) {
  console.log('NOTE', label, JSON.stringify(detail).slice(0, 400));
}

type Res = { status: number; body: Record<string, any> };
async function call(path: string, token: string | null, method = 'GET', body?: unknown): Promise<Res> {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: r.status, body: (await r.json().catch(() => ({}))) as Record<string, any> };
}
const data = (r: Res, what: string) => {
  if (r.status >= 300) throw new Error(`${what}: HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
  return (r.body.data ?? r.body) as any;
};

/** Track window beforeunload listeners (the guard's registration is what we test). */
function trackBeforeUnload() {
  const set = new Set<unknown>();
  (window as any).__paBU = set;
  const add = window.addEventListener;
  const rem = window.removeEventListener;
  window.addEventListener = function (this: Window, type: string, l: any, o?: any) {
    if (type === 'beforeunload') set.add(l);
    return add.call(this, type, l, o);
  } as typeof window.addEventListener;
  window.removeEventListener = function (this: Window, type: string, l: any, o?: any) {
    if (type === 'beforeunload') set.delete(l);
    return rem.call(this, type, l, o);
  } as typeof window.removeEventListener;
}
const bu = (p: Page) => p.evaluate(() => ((window as any).__paBU as Set<unknown>).size);

/** Mark the first editable text field of the open inline editor as [data-pa-field]. */
async function tagField(p: Page): Promise<string> {
  return p.evaluate(() => {
    const save = Array.from(document.querySelectorAll('button')).find(
      (b) => /^Save Changes$/.test((b.textContent || '').trim()) && (b as HTMLElement).offsetParent,
    );
    if (!save) return 'no-save-button';
    document.querySelectorAll('[data-pa-field]').forEach((n) => n.removeAttribute('data-pa-field'));
    let el: Element | null = save;
    while ((el = el.parentElement)) {
      const f = Array.from(el.querySelectorAll('input, textarea')).find((x) => {
        const i = x as HTMLInputElement;
        const textual = i.tagName === 'TEXTAREA' || ['text', 'url', 'email', 'search', 'tel'].includes(i.type);
        return textual && !i.disabled && !i.readOnly && i.offsetParent;
      });
      if (f) {
        f.setAttribute('data-pa-field', '1');
        return 'ok';
      }
    }
    return 'no-field';
  });
}

type DialogFacts = { role: string | null; modal: string | null; title: string; desc: string; focused: string; buttons: string[] };
async function dialogFacts(p: Page): Promise<DialogFacts | null> {
  return p.evaluate(() => {
    const d = document.querySelector('[data-studio-confirm-overlay] [role="dialog"]') as HTMLElement | null;
    if (!d) return null;
    const lb = d.getAttribute('aria-labelledby');
    const ds = d.getAttribute('aria-describedby');
    return {
      role: d.getAttribute('role'),
      modal: d.getAttribute('aria-modal'),
      title: (lb && document.getElementById(lb)?.textContent?.trim()) || '',
      desc: (ds && document.getElementById(ds)?.textContent?.trim()) || '',
      focused: (document.activeElement?.textContent || '').trim(),
      buttons: Array.from(d.querySelectorAll('button')).map((b) => `${(b.textContent || '').trim()}${(b as HTMLButtonElement).disabled ? ' (disabled)' : ''}`),
    };
  });
}
const dialogOpen = async (p: Page) => (await p.locator('[data-studio-confirm-overlay]').count()) > 0;

type StudioSpec = {
  name: string;
  path: string;
  ready: RegExp;
  listPath: string;
  backName: string;
  pill: RegExp;
  hasView: boolean;
  pillOffsetPx: number;
};

async function main() {
  let dbUrl: URL;
  try {
    dbUrl = new URL(DB_URL);
  } catch {
    console.error('REFUSING: set PROBE_DISPOSABLE_DATABASE_URL to a disposable LOCAL database.');
    process.exit(2);
  }
  if (!['127.0.0.1', 'localhost'].includes(dbUrl.hostname)) {
    console.error('REFUSING: PROBE_DISPOSABLE_DATABASE_URL is not local.');
    process.exit(2);
  }
  if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) {
    console.error('REFUSING: PROBE_BASE_URL_ROOT is not a local server.');
    process.exit(2);
  }
  const db = new pg.Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await db.connect();
  const seeded = (await db.query(`select id from users where email='admin@choosify.com.bd'`)).rows[0];
  await db.end();
  if (!seeded) {
    console.error('REFUSING: the seeded dev Super Admin is not in this database.');
    process.exit(2);
  }

  const login = await call('/auth/login', null, 'POST', { email: 'admin@choosify.com.bd', password: DEV_PASSWORD });
  const SA = String(login.body.accessToken || '');
  if (!SA) throw new Error(`super admin login failed ${login.status}`);
  const sfx = Date.now().toString(36);

  // ── throwaway entities in the disposable catalog ──
  const brand = data(await call('/catalog/brands', SA, 'POST', { name: `PA Brand ${sfx}`, category: 'General' }), 'brand');
  const cats = data(await call('/catalog/categories', null), 'categories') as Array<{ id: string }>;
  let cat = '';
  for (const c of cats) {
    const s = (await call(`/catalog/categories/${c.id}/schema`, null)).body?.data ?? {};
    if (!((s.attributes ?? []) as Array<{ required?: boolean }>).some((a) => a.required)) {
      cat = c.id;
      break;
    }
  }
  const product = data(
    await call('/catalog/products', SA, 'POST', {
      title: `PA Product ${sfx}`,
      brandId: brand.id,
      brandName: brand.name,
      categoryId: cat,
      image: IMG,
      gallery: [IMG],
      price: 100,
      stock: 5,
      description: `PA saved description ${sfx}`,
    }),
    'product',
  );
  const guide = data(await call('/catalog/guides', SA, 'POST', { title: `PA Guide ${sfx}` }), 'guide');
  const creatorId = `creator-pa-${sfx}`;
  const creator = data(
    await call(`/catalog/creators/${creatorId}`, SA, 'PUT', { id: creatorId, slug: creatorId, name: `PA Creator ${sfx}` }),
    'creator',
  );
  console.log('entities', { product: product.id, guide: guide.id, brand: brand.id, creator: creator.id });

  const browser = await chromium.launch({ headless: true, channel: 'chrome' }).catch(() => chromium.launch({ headless: true }));
  const ctx: BrowserContext = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  await ctx.addInitScript((t) => {
    try {
      if (!sessionStorage.getItem('pa')) {
        localStorage.setItem('choosify_auth_token', t as string);
        sessionStorage.setItem('pa', '1');
      }
    } catch {}
  }, SA);
  await ctx.addInitScript(trackBeforeUnload);

  const open = async (p: Page, path: string, ready: RegExp) => {
    await p.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await p.getByText(ready).first().waitFor({ timeout: 45000 });
    await p.waitForTimeout(1200);
    const editToggle = p.getByRole('button', { name: 'Edit', exact: true });
    if ((await editToggle.count()) > 0) {
      await editToggle.first().click();
      await p.waitForTimeout(400);
    }
  };
  const pathOf = (p: Page) => new URL(p.url()).pathname;

  const studios: StudioSpec[] = [
    { name: 'Product', path: `/admin/products/${product.id}/edit`, ready: new RegExp(`PA Product ${sfx}`), listPath: '/admin/products', backName: 'Back to products', pill: /About/i, hasView: false, pillOffsetPx: 8 },
    { name: 'Guide', path: `/admin/guides/${guide.id}/edit`, ready: new RegExp(`PA Guide ${sfx}`), listPath: '/admin/guides', backName: 'Back', pill: /^Edit Guide Identity$/, hasView: true, pillOffsetPx: 8 },
    { name: 'Brand', path: `/admin/brand-studio/${brand.id}/edit`, ready: new RegExp(`PA Brand ${sfx}`), listPath: '/admin/brand-studio', backName: 'Back', pill: /Contact Information/, hasView: false, pillOffsetPx: 8 },
    { name: 'Creator', path: `/admin/creator-studio/${creator.id}/edit`, ready: new RegExp(`PA Creator ${sfx}`), listPath: '/admin/creator-studio', backName: 'Back', pill: /Profile Identity/, hasView: false, pillOffsetPx: 12 }, // Creator Studio is always in Studio mode (Brand pattern) — no View toggle
  ];

  for (const s of studios) {
    console.log(`\n── ${s.name} Studio ──`);
    const page = await ctx.newPage();
    try {
      await open(page, s.path, s.ready);
      const P = (label: string) => `${s.name}: ${label}`;

      // G1 pills
      const pills = await page.$$eval('[data-studio-edit-pill]', (els) =>
        els.map((e) => {
          const cs = getComputedStyle(e);
          return { name: e.getAttribute('aria-label') || '', text: (e.textContent || '').trim(), position: cs.position, top: parseFloat(cs.top), right: parseFloat(cs.right) };
        }),
      );
      const legacy = await page.$$eval('button', (els) =>
        els
          .filter((b) => !b.hasAttribute('data-studio-edit-pill') && !b.getAttribute('aria-label') && /^Edit$/i.test((b.textContent || '').trim()) && (b as HTMLElement).offsetParent)
          .map((b) => b.className.includes('absolute')),
      );
      check(pills.length > 0 && pills.every((x) => /^Edit \S/.test(x.name) || / — \S/.test(x.name)), P('G1 every shared Edit pill has a section-specific accessible name'), pills);
      note(P('pill accessible names'), pills.map((x) => x.name));
      if (legacy.filter(Boolean).length) note(P('section pills NOT converted (no section name)'), legacy.filter(Boolean).length);
      const misplaced = pills.filter((x) => x.position !== 'absolute' || x.top !== s.pillOffsetPx || x.right !== s.pillOffsetPx);
      check(misplaced.length === 0, P(`G1 pills keep their position (absolute, ${s.pillOffsetPx}px top/right)`), misplaced);
      check(legacy.filter(Boolean).length === 0, P('G1 no unnamed section Edit pills remain'), legacy.filter(Boolean).length);
      if (s.name === 'Brand') {
        // Hero pills (BrandProfileHero): named, keyboard ring, and each opens its own editor.
        for (const [section, frame] of [['Cover Image', 'Editing — Cover Image'], ['Brand Identity', 'Editing — Brand Identity']]) {
          const hp = page.getByRole('button', { name: `Edit ${section}`, exact: true });
          check((await hp.count()) === 1 && pills.some((x) => x.name === `Edit ${section}`), P(`G1 Hero pill is named "Edit ${section}"`));
          await page.keyboard.press('Tab');
          await hp.focus();
          const hr = await hp.evaluate((el) => ({ fv: el.matches(':focus-visible'), shadow: getComputedStyle(el).boxShadow }));
          check(hr.fv && /35,\s*35,\s*255/.test(hr.shadow), P(`G1 Hero "${section}" pill shows a keyboard focus ring`), hr);
          await hp.click();
          await page.waitForTimeout(400);
          check(await page.getByText(frame, { exact: true }).isVisible().catch(() => false), P(`G1 Hero "${section}" pill opens its editor`));
          await page.getByRole('button', { name: 'Cancel', exact: true }).first().click();
          await page.waitForTimeout(300);
        }
      }
      const pillIdx = pills.findIndex((x) => s.pill.test(x.name));
      check(pillIdx >= 0, P(`G1 found the pill to edit (${s.pill})`), pills.map((x) => x.name));
      const pill = page.locator('[data-studio-edit-pill]').nth(Math.max(pillIdx, 0));
      await page.keyboard.press('Tab');
      await pill.focus();
      const ring = await pill.evaluate((el) => ({ fv: el.matches(':focus-visible'), shadow: getComputedStyle(el).boxShadow }));
      check(ring.fv && /35,\s*35,\s*255/.test(ring.shadow), P('G1 keyboard focus shows a visible ring on the Edit pill'), ring);

      // G2 dirty detection
      const base = await bu(page);
      await pill.click();
      await page.waitForTimeout(400);
      check((await tagField(page)) === 'ok', P('G2 inline editor opened with a text field'));
      const field = page.locator('[data-pa-field]');
      const orig = await field.inputValue();
      check((await bu(page)) === base, P('G2 opening an editor without changes registers no beforeunload'), { base, now: await bu(page) });
      await field.fill(`${orig} PA-edit`);
      await page.waitForTimeout(250);
      check((await bu(page)) === base + 1, P('G2 a real change registers beforeunload'), { base, now: await bu(page) });
      await field.fill(orig);
      await page.waitForTimeout(250);
      check((await bu(page)) === base, P('G2 edit-then-revert is clean again (beforeunload removed)'), { base, now: await bu(page) });
      await field.fill(`${orig} PA-edit`);
      await page.waitForTimeout(250);

      // G3 in-app link
      const before = pathOf(page);
      const linkHref = await page.evaluate((cur) => {
        const a = Array.from(document.querySelectorAll('a[href^="/admin"]')).find((x) => {
          const el = x as HTMLAnchorElement;
          return el.offsetParent && !el.target && new URL(el.href).pathname !== cur;
        }) as HTMLAnchorElement | undefined;
        if (!a) return '';
        a.setAttribute('data-pa-link', '1');
        return a.getAttribute('href') || '';
      }, before);
      check(!!linkHref, P('G3 found an in-app link (sidebar / top bar)'));
      if (linkHref) {
        await page.locator('[data-pa-link]').click();
        await page.waitForTimeout(400);
        const f = await dialogFacts(page);
        check(pathOf(page) === before && !!f, P(`G3 in-app link (${linkHref}) is held and the dialog opens`), { url: pathOf(page), f });
        check(f?.role === 'dialog' && f.modal === 'true' && f.title === 'Discard unsaved changes?' && f.desc.length > 10, P('G3 dialog semantics: role=dialog, aria-modal, labelled + described'), f);
        check(f?.focused === 'Keep editing', P('G3 focus starts on the safe action ("Keep editing")'), f?.focused);
        for (let i = 0; i < 5; i += 1) await page.keyboard.press('Tab');
        const inside = await page.evaluate(() => !!document.activeElement?.closest('[data-studio-confirm-overlay]'));
        check(inside, P('G3 Tab keeps focus inside the dialog'));
        await page.keyboard.press('Escape');
        await page.waitForTimeout(250);
        const ret = await page.evaluate(() => document.activeElement?.getAttribute('data-pa-link') === '1');
        check(!(await dialogOpen(page)) && pathOf(page) === before, P('G3 Escape cancels: dialog closes, still on the Studio'));
        check(ret, P('G3 focus returns to the element that opened the dialog'));
        check((await field.inputValue()) === `${orig} PA-edit`, P('G3 edits are still there after cancelling'));
      }

      // G4 Back / View
      await page.getByRole('button', { name: s.backName, exact: true }).first().click();
      await page.waitForTimeout(300);
      check(await dialogOpen(page), P('G4 Studio Back asks before leaving'));
      await page.getByRole('button', { name: 'Keep editing' }).click();
      await page.waitForTimeout(250);
      check(!(await dialogOpen(page)) && pathOf(page) === before && (await bu(page)) === base + 1, P('G4 "Keep editing" stays on the Studio, still dirty'));
      if (s.hasView) {
        await page.getByRole('button', { name: 'View', exact: true }).first().click();
        await page.waitForTimeout(300);
        check(await dialogOpen(page), P('G4 View toggle asks first while dirty'));
        await page.getByRole('button', { name: 'Keep editing' }).click();
        await page.waitForTimeout(250);
        check((await field.count()) === 1 && (await field.inputValue()) === `${orig} PA-edit`, P('G4 after "Keep editing" the editor and edits remain'));
      }

      // G5 failed save
      await page.route('**/api/v1/catalog/**', (r) =>
        r.request().method() === 'GET' ? r.continue() : r.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"PA simulated failure"}' }),
      );
      await page.getByRole('button', { name: 'Save Changes' }).first().click();
      await page.waitForTimeout(1800);
      await page.unroute('**/api/v1/catalog/**');
      check(
        (await field.count()) === 1 && (await field.inputValue()) === `${orig} PA-edit` && (await bu(page)) === base + 1,
        P('G5 failed save keeps the editor open with the edits, still guarded'),
        { open: await field.count(), bu: await bu(page) },
      );

      // G6 Cancel restores
      await page.getByRole('button', { name: 'Cancel', exact: true }).first().click();
      await page.waitForTimeout(400);
      check((await bu(page)) === base && !(await dialogOpen(page)), P('G6 Cancel clears dirty (no prompt, beforeunload removed)'), await bu(page));
      await pill.click();
      await page.waitForTimeout(400);
      await tagField(page);
      check((await field.inputValue()) === orig, P('G6 reopening shows the saved value (Cancel restored it)'), { now: await field.inputValue(), orig });

      // G7 Back → Discard
      await field.fill(`${orig} PA-discard`);
      await page.waitForTimeout(250);
      await page.getByRole('button', { name: s.backName, exact: true }).first().click();
      await page.waitForTimeout(300);
      await page.getByRole('button', { name: 'Discard changes' }).click();
      await page.waitForURL((u) => u.pathname === s.listPath, { timeout: 15000 }).catch(() => undefined);
      check(pathOf(page) === s.listPath, P(`G7 "Discard changes" leaves to ${s.listPath}`), pathOf(page));

      // G8 real tab close
      const closeWith = async (dirty: boolean) => {
        const p = await ctx.newPage();
        await open(p, s.path, s.ready);
        await p.locator('[data-studio-edit-pill]').nth(Math.max(pillIdx, 0)).click();
        await p.waitForTimeout(300);
        await tagField(p);
        if (dirty) await p.locator('[data-pa-field]').fill(`${orig} PA-close`);
        await p.waitForTimeout(250);
        let kind = '';
        p.on('dialog', (d) => {
          kind = d.type();
          void d.dismiss();
        });
        await p.close({ runBeforeUnload: true });
        await new Promise((r) => setTimeout(r, 1200));
        if (!p.isClosed()) await p.close();
        return kind;
      };
      check((await closeWith(true)) === 'beforeunload', P('G8 closing the tab while dirty prompts'));
      check((await closeWith(false)) === '', P('G8 closing the tab with an untouched editor does not prompt'));

      if (SHOTS) {
        await open(page, s.path, s.ready);
        await page.screenshot({ path: `${SHOTS}/pa-${s.name.toLowerCase()}.png`, fullPage: false });
      }
    } catch (e) {
      check(false, `${s.name}: probe step threw`, e instanceof Error ? e.message : String(e));
    } finally {
      if (!page.isClosed()) await page.close();
    }
  }

  // ── lifecycle + destructive confirmations ──
  console.log('\n── Lifecycle / destructive confirmations ──');
  const page = await ctx.newPage();
  try {
    // L1 Product
    await open(page, `/admin/products/${product.id}/edit`, new RegExp(`PA Product ${sfx}`));
    const prodStatus = async () => String(data(await call(`/catalog/products/${product.id}`, SA), 'product').status);
    const pBefore = await prodStatus();
    await page.getByTestId('product-lifecycle-publish').click();
    await page.waitForTimeout(300);
    const pf = await dialogFacts(page);
    check(pf?.role === 'dialog' && pf.modal === 'true' && !!pf.title && pf.focused === 'Cancel', 'L1 Product Publish opens the shared dialog (focus on Cancel)', pf);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    check(!(await dialogOpen(page)) && (await prodStatus()) === pBefore, 'L1 Escape cancels, product status unchanged', { before: pBefore, after: await prodStatus() });

    // L2 Guide
    const guideStatus = async () => String(data(await call(`/catalog/guides/${guide.id}`, SA), 'guide').status);
    await open(page, `/admin/guides/${guide.id}/edit`, new RegExp(`PA Guide ${sfx}`));
    const gBefore = await guideStatus();
    await page.getByRole('button', { name: 'Publish', exact: true }).first().click();
    await page.waitForTimeout(300);
    const gf = await dialogFacts(page);
    check(gf?.title === 'Publish this guide?' && gf.focused === 'Cancel', 'L2 Guide Publish asks first', gf);
    await page.locator('[data-studio-confirm-overlay]').getByRole('button', { name: 'Cancel' }).click();
    await page.waitForTimeout(500);
    check((await guideStatus()) === gBefore, 'L2 Cancel → guide status unchanged', { before: gBefore, after: await guideStatus() });

    // L3 Guide section Remove
    const removeBtns = await page.$$eval('button[aria-label^="Remove "]', (els) => els.map((e) => e.getAttribute('aria-label') || ''));
    const named = await page.$$eval('button[aria-label^="Move "], button[aria-label^="Hide "], button[aria-label^="Show "]', (els) => els.length);
    check(removeBtns.length > 0 && named > 0, 'L3 Guide section controls have names (Move/Hide/Remove <section>)', { removeBtns: removeBtns.slice(0, 4), named });
    if (removeBtns.length) {
      const label = removeBtns[removeBtns.length - 1];
      await page.locator(`button[aria-label="${label}"]`).click();
      await page.waitForTimeout(300);
      const rf = await dialogFacts(page);
      check(!!rf && /^Remove the “.+” section\?$/.test(rf.title), 'L3 Remove asks first, naming the section', rf);
      await page.locator('[data-studio-confirm-overlay]').getByRole('button', { name: 'Cancel' }).click();
      await page.waitForTimeout(500);
      check((await page.locator(`button[aria-label="${label}"]`).count()) === 1, 'L3 Cancel keeps the section');
      await page.locator(`button[aria-label="${label}"]`).click();
      await page.waitForTimeout(300);
      await page.getByRole('button', { name: 'Remove section' }).click();
      await page.waitForTimeout(1500);
      check((await page.locator(`button[aria-label="${label}"]`).count()) === 0, `L3 confirming removes the section (${label})`);
    }

    // L2 archive with busy state
    await page.route('**/api/v1/catalog/guides/*/archive', async (r) => {
      await new Promise((res) => setTimeout(res, 2500));
      await r.continue();
    });
    await page.getByRole('button', { name: 'Archive', exact: true }).first().click();
    await page.waitForTimeout(300);
    await page.locator('[data-studio-confirm-overlay]').getByRole('button', { name: 'Archive' }).click();
    await page.waitForTimeout(600);
    const busyFacts = await dialogFacts(page);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    check(
      !!busyFacts && busyFacts.buttons.every((b) => b.endsWith('(disabled)')) && busyFacts.buttons.some((b) => b.startsWith('Working')),
      'L2 while archiving: both buttons disabled, confirm shows "Working…"',
      busyFacts,
    );
    check(await dialogOpen(page), 'L2 Escape is ignored while busy');
    await page.waitForFunction(() => !document.querySelector('[data-studio-confirm-overlay]'), null, { timeout: 15000 }).catch(() => undefined);
    await page.unroute('**/api/v1/catalog/guides/*/archive');
    check(!(await dialogOpen(page)) && /archived/i.test(await guideStatus()), 'L2 after confirming, the dialog closes and the guide is archived', await guideStatus());

    // L4 Creator
    // No single-creator GET route: read it from the list.
    const creatorStatus = async () =>
      String((data(await call('/catalog/creators', SA), 'creators') as Array<{ id: string; status?: string }>).find((c) => c.id === creator.id)?.status);
    await open(page, `/admin/creator-studio/${creator.id}/edit`, new RegExp(`PA Creator ${sfx}`));
    const cBefore = await creatorStatus();
    const pubBtn = page.getByRole('button', { name: 'Publish', exact: true });
    if (await pubBtn.count()) {
      await pubBtn.first().click();
      await page.waitForTimeout(300);
      const cf = await dialogFacts(page);
      check(cf?.title === 'Publish this creator profile?' && cf.focused === 'Cancel', 'L4 Creator Publish asks first (original copy kept)', cf);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
      check((await creatorStatus()) === cBefore, 'L4 Escape → creator status unchanged', { before: cBefore, after: await creatorStatus() });
    } else {
      await page.getByRole('button', { name: 'Unpublish', exact: true }).first().click();
      await page.waitForTimeout(300);
      const uf = await dialogFacts(page);
      check(uf?.title === 'Unpublish this creator profile?' && uf.focused === 'Cancel', `L4 Creator Unpublish asks first (creator is ${cBefore})`, uf);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
      check((await creatorStatus()) === cBefore, 'L4 Escape → creator status unchanged', { before: cBefore, after: await creatorStatus() });
    }
    await page.route('**/api/v1/catalog/creators/**', async (r) => {
      if (r.request().method() !== 'GET') await new Promise((res) => setTimeout(res, 2500));
      await r.continue();
    });
    await page.getByRole('button', { name: 'Archive', exact: true }).first().click();
    await page.waitForTimeout(300);
    const af = await dialogFacts(page);
    check(af?.title === 'Archive this creator profile?', 'L4 Creator Archive asks first', af);
    await page.locator('[data-studio-confirm-overlay]').getByRole('button', { name: 'Archive' }).click();
    await page.waitForTimeout(600);
    const cBusy = await dialogFacts(page);
    check(!!cBusy && cBusy.buttons.every((b) => b.endsWith('(disabled)')), 'L4 while archiving: both buttons disabled', cBusy);
    await page.waitForFunction(() => !document.querySelector('[data-studio-confirm-overlay]'), null, { timeout: 15000 }).catch(() => undefined);
    await page.unroute('**/api/v1/catalog/creators/**');
    check(!(await dialogOpen(page)) && /archived/i.test(await creatorStatus()), 'L4 after confirming, the creator is archived', await creatorStatus());
  } catch (e) {
    check(false, 'lifecycle probe step threw', e instanceof Error ? e.message : String(e));
  } finally {
    await browser.close();
  }

  console.log(`\n${FAIL.length ? 'FAIL' : 'PASS'} probe-studio-unsaved-guard-browser (${passes} passed, ${FAIL.length} failed)`);
  if (FAIL.length) {
    for (const f of FAIL) console.log('  -', f);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
