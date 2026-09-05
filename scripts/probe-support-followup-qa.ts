/**
 * Browser QA for the three support-messaging follow-up fixes:
 *   1. Admin-initiated message discovery + unread badge on the storefront
 *      (no "Contact Support" click required).
 *   2. Message alignment by canonical senderId (not persona/role).
 *   3. Profile "Message" popup redirects into the real conversation.
 *
 * Captures:
 *   1 admin-profile-message-popup.png  — the popup on a Consumer profile.
 *   2 admin-redirected-to-thread.png   — after Send, landed on
 *       /admin/messages?c=<id> with that exact conversation open.
 *   3 web-badge-before-messages-page.png — storefront home/header shows the
 *       unread message-icon badge WITHOUT ever visiting Messages or clicking
 *       Contact Support.
 *   4 web-thread-visible-in-inbox.png  — Messages page: the Support thread
 *       is already in the list (admin's message visible), no manual
 *       creation needed.
 *   5 web-alignment-admin-left-user-right.png — Admin's message left-
 *       aligned, the consumer's own reply right-aligned.
 *
 * Usage: npx tsx scripts/probe-support-followup-qa.ts   (needs :3001, :5173)
 */
import { chromium, type Page } from 'playwright-core';
import { mkdirSync } from 'fs';
import { join } from 'path';

const BASE = process.env.PROBE_BASE_URL_ROOT || 'http://localhost:3001';
const API = `${BASE}/api/v1`;
const PW = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';
const OUT = join(process.cwd(), 'scripts', '_tmp_support-followup-artifacts');
mkdirSync(OUT, { recursive: true });
const RID = Date.now();
const settle = (p: Page, ms = 1500) => p.waitForTimeout(ms);

async function api(path: string, init: RequestInit, token?: string) {
  const r = await fetch(`${API}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers || {}) },
  });
  return { status: r.status, body: (await r.json().catch(() => ({}))) as any };
}
async function login(email: string) {
  const b = (await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password: PW }) })).body;
  return { token: b.accessToken || b.token || b.data?.accessToken || '', uid: b.uid || b.data?.uid || '' };
}
async function registerConsumer(email: string) {
  const b = (await api('/auth/register', { method: 'POST', body: JSON.stringify({ email, password: 'Probe!2026xx', fullName: 'Followup QA Consumer' }) })).body;
  return { token: b.accessToken || b.customToken, uid: b.uid as string };
}

async function main() {
  const admin = await login('admin@choosify.com.bd');
  if (!admin.token) throw new Error('admin dev login failed');
  const consumerEmail = `followup-qa-${RID}@probe.local`;
  const consumer = await registerConsumer(consumerEmail);
  if (!consumer.token || !consumer.uid) throw new Error('consumer register failed');
  console.log('consumer uid:', consumer.uid);

  // ── Part A: Admin side — Profile Message popup ────────────────────────────
  const adminCtx = await (await chromium.launch({ headless: true, channel: 'chrome' }).catch(() => chromium.launch({ headless: true })))
    .newContext({ viewport: { width: 1500, height: 1100 } });
  await adminCtx.addInitScript((t) => { try { localStorage.setItem('choosify_auth_token', t as string); } catch {} }, admin.token);
  const adminPage = await adminCtx.newPage();
  adminPage.on('pageerror', (e) => console.log('admin pageerror:', String(e).slice(0, 200)));

  await adminPage.goto(`${BASE}/admin/consumers/${consumer.uid}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await adminPage.waitForFunction(() => /Consumer Profile/i.test(document.body.innerText), { timeout: 20000 }).catch(() => {});
  await settle(adminPage);

  // Click the SIDEBAR "Message" button (Mail icon, next to the disabled Call
  // button) -- the one that used to open the mock popup with no redirect.
  const sidebarMsgBtn = adminPage.locator('button:has-text("Message")').last();
  await sidebarMsgBtn.click({ timeout: 8000 });
  await settle(adminPage, 800);
  const popupText = await adminPage.evaluate(() => document.body.innerText);
  console.log('A1: popup opened with a textarea + Send?', /Write your message/i.test(popupText) && /Send & open|Open conversation/i.test(popupText));
  await adminPage.screenshot({ path: join(OUT, '1 admin-profile-message-popup.png'), fullPage: false });

  await adminPage.locator('textarea[placeholder*="Write your message"]').fill('Hello from Admin Support! (followup QA)');
  await adminPage.locator('button:has-text("Send & open")').click({ timeout: 8000 });
  await adminPage.waitForFunction(() => /\/admin\/messages/.test(window.location.pathname), { timeout: 10000 }).catch(() => {});
  await settle(adminPage, 1200);
  const urlAfterSend = adminPage.url();
  console.log('A2: redirected to /admin/messages?c=... ?', /\/admin\/messages\?c=/.test(urlAfterSend), urlAfterSend);
  const threadOpenText = await adminPage.evaluate(() => document.body.innerText);
  console.log('A3: the sent message is visible in the opened thread?', /Hello from Admin Support! \(followup QA\)/.test(threadOpenText));
  await adminPage.screenshot({ path: join(OUT, '2 admin-redirected-to-thread.png'), fullPage: true });
  await adminPage.close();

  // ── Part B: Storefront — discovery + badge + alignment ────────────────────
  // Real UI login (not a token-injection shortcut) -- exercises this exactly
  // as a real buyer would, and avoids guessing at internal localStorage keys.
  const webBase = BASE.replace('3001', '5173');
  const webCtx = await (await chromium.launch({ headless: true, channel: 'chrome' }).catch(() => chromium.launch({ headless: true })))
    .newContext({ viewport: { width: 1400, height: 1000 } });
  const webPage = await webCtx.newPage();
  webPage.on('pageerror', (e) => console.log('web pageerror:', String(e).slice(0, 200)));

  await webPage.goto(webBase, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await webPage.waitForTimeout(2500);
  // Logged out: the home page has no embedded login form, only a header
  // "Sign In" button that navigates to the real auth page.
  await webPage.locator('button:has-text("Sign In"), a:has-text("Sign In")').first().click({ timeout: 10000 });
  await webPage.waitForTimeout(1500);
  const emailInput = webPage.locator('input[type="email"], input[placeholder*="email" i]').first();
  await webPage.waitForSelector('input[type="email"], input[placeholder*="email" i]', { timeout: 15000 });
  await emailInput.fill(consumerEmail, { timeout: 20000 });
  await webPage.locator('input[type="password"], input[placeholder*="password" i]').first().fill('Probe!2026xx');
  await webPage.locator('button:has-text("Sign in to Choosify")').first().click({ timeout: 8000 });
  await webPage.waitForFunction(() => /SIGN IN/i.test(document.body.innerText) === false, { timeout: 15000 }).catch(() => {});
  await webPage.waitForTimeout(4000); // let bootstrap discovery run post-login

  const loggedInCheck = await webPage.evaluate(() => document.body.innerText);
  console.log('B0: actually logged in (no SIGN IN button)?', !/\bSIGN IN\b/.test(loggedInCheck));
  const badgeVisible = await webPage.evaluate(() =>
    !!Array.from(document.querySelectorAll('span')).find((s) => (s.textContent || '').trim() === '1'),
  );
  console.log('B1: message-icon unread badge visible on first page load (no Contact Support click)?', badgeVisible);
  await webPage.screenshot({ path: join(OUT, '3 web-badge-before-messages-page.png'), fullPage: false });

  // Use the real in-app navigation path (click the message-icon button, which
  // does React Router's client-side navigate('/messages')) instead of
  // page.goto(), which performs a hard/full navigation and therefore wipes the
  // in-memory-only access token (see authSession.ts) before the async
  // refresh-cookie restore effect in GlobalStateContext.tsx can repopulate it.
  await webPage.locator('button[aria-label="Message inbox"]').first().click({ timeout: 8000 });
  await webPage.waitForTimeout(4000);
  const inboxText = await webPage.evaluate(() => document.body.innerText);
  console.log('B2: "Choosify Support" thread already listed (no Contact Support click needed)?', /Choosify Support/i.test(inboxText));
  await webPage.screenshot({ path: join(OUT, '4 web-thread-visible-in-inbox.png'), fullPage: true });

  // Open the Support thread and check alignment + reply.
  await webPage.locator('text=Choosify Support').first().click({ timeout: 8000 }).catch(() => {});
  await webPage.waitForTimeout(2500);
  const adminMsgAlignment = await webPage.evaluate(() => {
    const bubbles = Array.from(document.querySelectorAll('div'));
    const target = bubbles.find((d) => (d.textContent || '').includes('Hello from Admin Support! (followup QA)') && d.children.length === 0);
    if (!target) return null;
    // Walk up to the row wrapper and check its justify-content alignment.
    let node: HTMLElement | null = target as HTMLElement;
    for (let i = 0; i < 5 && node; i++) {
      const cls = node.className || '';
      if (typeof cls === 'string' && /justify-(start|end)/.test(cls)) return cls.match(/justify-(start|end)/)?.[1];
      node = node.parentElement;
    }
    return 'unknown';
  });
  console.log('B3: Admin\'s message alignment (expect "start" = left)?', adminMsgAlignment);

  const replyInput = webPage.locator('input[placeholder*="message" i], textarea[placeholder*="message" i]').first();
  await replyInput.fill('Thanks Support, this is my reply!');
  await webPage.keyboard.press('Enter').catch(() => {});
  await webPage.waitForTimeout(800);
  // Enter may not submit a single-line input in this component; fall back to
  // clicking the send button next to it if the message hasn't appeared yet.
  const sentAlready = await webPage.evaluate(() => document.body.innerText.includes('Thanks Support, this is my reply!'));
  if (!sentAlready) {
    await webPage.locator('button:near(input[placeholder*="message" i])').last().click({ timeout: 3000 }).catch(() => {});
  }
  await webPage.waitForTimeout(1500);
  const myMsgAlignment = await webPage.evaluate(() => {
    const bubbles = Array.from(document.querySelectorAll('div'));
    const target = bubbles.find((d) => (d.textContent || '').includes('Thanks Support, this is my reply!') && d.children.length === 0);
    if (!target) return null;
    let node: HTMLElement | null = target as HTMLElement;
    for (let i = 0; i < 5 && node; i++) {
      const cls = node.className || '';
      if (typeof cls === 'string' && /justify-(start|end)/.test(cls)) return cls.match(/justify-(start|end)/)?.[1];
      node = node.parentElement;
    }
    return 'unknown';
  });
  console.log('B4: consumer\'s own reply alignment (expect "end" = right)?', myMsgAlignment);
  await webPage.screenshot({ path: join(OUT, '5 web-alignment-admin-left-user-right.png'), fullPage: true });

  await webCtx.close();

  console.log('screens written to', OUT);
  console.log('consumer:', consumer.uid);
}

main().catch((e) => { console.error(e); process.exit(1); });
