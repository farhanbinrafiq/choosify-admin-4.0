/**
 * Visual QA capture for the Phase B auth work. No assertions — it drives the
 * real local UIs and writes screenshots for product-owner review.
 *
 * Consumer (Choosify-Web :5173): Login (balanced Google/Facebook), Signup,
 *   Forgot Password, Check Email, Reset Password (form + invalid), Reset
 *   Success, Verify Email (success + invalid).
 * Dashboard (admin :3001): Login, Forgot Password, Check Email, Reset Password
 *   (form + invalid), Reset Success.
 * Emails: every rendered template, desktop + 380px mobile width.
 *
 * Needs: admin :3001 (with RESEND_API_KEY unset so reset tokens hit the log),
 * Choosify-Web :5173, and `npm run preview:emails` already run.
 *
 * Usage: npx tsx scripts/probe-auth-visual-qa.ts
 */
import { chromium, type Page } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ADMIN = 'http://localhost:3001';
const WEB = 'http://localhost:5173';
const OUT = join(process.cwd(), 'scripts', '_tmp_auth-qa');
const EMAIL_DIR = join(process.cwd(), 'scripts', '_tmp_email-previews');
const SERVER_LOG = join(process.cwd(), '_devserver.out.log');
mkdirSync(OUT, { recursive: true });

const settle = (p: Page, ms = 1400) => p.waitForTimeout(ms);

async function api(path: string, body: unknown) {
  const r = await fetch(`${ADMIN}/api/v1${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

/** A fresh single-use password_reset token for a brand-new consumer, minted
 *  in-process by the dev-only helper (so it never has to be scraped from a log
 *  or an email). */
function freshResetToken(): string | null {
  try {
    const out = execFileSync('npx', ['tsx', 'scripts/_tmp_issue_reset.ts'], { encoding: 'utf8', shell: true });
    const m = out.match(/TOKEN=([a-f0-9]{64})/);
    return m ? m[1] : null;
  } catch (e) {
    console.log('freshResetToken failed:', (e as Error).message);
    return null;
  }
}

async function shoot(page: Page, url: string, name: string, opts: { waitText?: RegExp; act?: (p: Page) => Promise<void> } = {}) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  if (opts.waitText) {
    await page.waitForFunction((re) => new RegExp(re).test(document.body.innerText), opts.waitText.source, { timeout: 15000 }).catch(() => {});
  }
  await settle(page);
  if (opts.act) await opts.act(page);
  await settle(page);
  await page.screenshot({ path: join(OUT, `${name}.png`), fullPage: true });
  console.log('shot', name);
}

async function main() {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' }).catch(() => chromium.launch({ headless: true }));
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('pageerror', String(e).slice(0, 140)));

  const token = freshResetToken();
  console.log('reset token captured:', token ? 'yes' : 'no (success-state shots skipped)');

  // ── Consumer ──────────────────────────────────────────────────────────
  await shoot(page, `${WEB}/login`, 'consumer-01-login', { waitText: /Sign in to Choosify|Welcome back/ });
  await shoot(page, `${WEB}/login`, 'consumer-02-signup', {
    waitText: /Create/,
    act: async (p) => { await p.locator('button:has-text("Sign up")').first().click().catch(() => {}); },
  });
  await shoot(page, `${WEB}/forgot-password`, 'consumer-03-forgot', { waitText: /Forgot your password/ });
  await shoot(page, `${WEB}/forgot-password`, 'consumer-04-check-email', {
    waitText: /Forgot your password/,
    act: async (p) => {
      await p.locator('#email').fill('qa@example.com');
      await p.locator('button:has-text("Send reset link")').click();
      await p.waitForFunction(() => /Check your email/.test(document.body.innerText), { timeout: 10000 }).catch(() => {});
    },
  });
  await shoot(page, `${WEB}/reset-password?token=not-a-real-token-preview-only`, 'consumer-05-reset-form', { waitText: /Choose a new password/ });
  await shoot(page, `${WEB}/reset-password`, 'consumer-06-reset-invalid', { waitText: /expired or invalid/ });
  if (token) {
    await shoot(page, `${WEB}/reset-password?token=${token}`, 'consumer-07-reset-success', {
      waitText: /Choose a new password/,
      act: async (p) => {
        await p.locator('#new-password').fill('QaNewPass!2026');
        await p.locator('#confirm-password').fill('QaNewPass!2026');
        await p.locator('button:has-text("Reset password")').click();
        await p.waitForFunction(() => /Password updated/.test(document.body.innerText), { timeout: 10000 }).catch(() => {});
      },
    });
  }
  await shoot(page, `${WEB}/verify-email`, 'consumer-08-verify-invalid', { waitText: /expired or invalid/ });

  // ── Dashboard ─────────────────────────────────────────────────────────
  await shoot(page, `${ADMIN}/login`, 'dashboard-01-login', { waitText: /admin dashboard|Operations/ });
  await shoot(page, `${ADMIN}/forgot-password`, 'dashboard-02-forgot', { waitText: /Reset your password/ });
  await shoot(page, `${ADMIN}/forgot-password`, 'dashboard-03-check-email', {
    waitText: /Reset your password/,
    act: async (p) => {
      await p.locator('#email').fill('seller@choosify.com.bd');
      await p.locator('button:has-text("Send reset link")').click();
      await p.waitForFunction(() => /Check your email/.test(document.body.innerText), { timeout: 10000 }).catch(() => {});
    },
  });
  await shoot(page, `${ADMIN}/reset-password?token=not-a-real-token-preview-only`, 'dashboard-04-reset-form', { waitText: /Choose a new password/ });
  await shoot(page, `${ADMIN}/reset-password`, 'dashboard-05-reset-invalid', { waitText: /expired or invalid/ });
  const token2 = freshResetToken();
  if (token2) {
    await shoot(page, `${ADMIN}/reset-password?token=${token2}`, 'dashboard-06-reset-success', {
      waitText: /Choose a new password/,
      act: async (p) => {
        await p.locator('#new-password').fill('QaNewPass!2026');
        await p.locator('#confirm-password').fill('QaNewPass!2026');
        await p.locator('button:has-text("Reset password")').click();
        await p.waitForFunction(() => /Password updated/.test(document.body.innerText), { timeout: 10000 }).catch(() => {});
      },
    });
  }

  // ── Emails (desktop + mobile) ─────────────────────────────────────────
  const emailFiles = ['1-welcome', '2-verify-email', '3-password-reset', '4-password-changed', '5-order-confirmed', '6-order-dispatched', '7-order-delivered'];
  for (const f of emailFiles) {
    const src = join(EMAIL_DIR, `${f}.html`);
    if (!existsSync(src)) continue;
    await page.setViewportSize({ width: 800, height: 900 });
    await page.goto('file://' + src, { waitUntil: 'load' });
    await settle(page, 500);
    await page.screenshot({ path: join(OUT, `email-${f}-desktop.png`), fullPage: true });
    await page.setViewportSize({ width: 380, height: 900 });
    await page.goto('file://' + src, { waitUntil: 'load' });
    await settle(page, 500);
    await page.screenshot({ path: join(OUT, `email-${f}-mobile.png`), fullPage: true });
    console.log('shot email', f);
  }

  await browser.close();
  console.log('\nscreens ->', OUT);
}
main().catch((e) => { console.error('CRASH', e); process.exit(1); });
