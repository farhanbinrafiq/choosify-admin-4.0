/**
 * Account username validation (PATCH /auth/profile `username`).
 *
 * Unit: parseAccountUsername contract (3–30 ASCII letters, digits, dots,
 * underscores; trim + one leading "@" stripped; empty clears).
 * API (PROBE_BASE_URL, isolated stack): self and staff-on-behalf edits accept
 * valid names and reject invalid ones with 400 INVALID_USERNAME; a rejected
 * request leaves the username, the phone sent alongside it, the account
 * activity log and (when PROBE_SERVER_LOG points at the server's stdout log)
 * the audit log unchanged. A seller cannot change another account.
 */
import { existsSync, readFileSync } from 'node:fs';
import { parseAccountUsername } from '../server/auth/accountUsername';

const BASE = (process.env.PROBE_BASE_URL || 'http://localhost:3001/api/v1').replace(/\/$/, '');
const PASS = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';
const SERVER_LOG = process.env.PROBE_SERVER_LOG || '';

type Json = Record<string, any>;
const results: Array<{ id: string; ok: boolean; detail?: string }> = [];
const mark = (id: string, ok: boolean, detail?: unknown) => {
  results.push({ id, ok, detail: ok ? undefined : String(detail ?? '').slice(0, 300) });
  console.log(ok ? 'PASS' : 'FAIL', id, ok ? '' : String(detail ?? '').slice(0, 300));
};

async function req(method: string, path: string, token?: string, body?: unknown): Promise<{ status: number; body: Json }> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: (await res.json().catch(() => ({}))) as Json };
}

async function login(email: string): Promise<{ token: string; uid: string }> {
  const r = await req('POST', '/auth/login', undefined, { email, password: PASS });
  if (r.status !== 200 || !r.body.accessToken) throw new Error(`login ${email} failed: ${r.status}`);
  return { token: String(r.body.accessToken), uid: String(r.body.uid) };
}

/** Username/phone from the account's own /auth/me (the staff user detail does not carry username); activity via staff. */
async function accountState(adminToken: string, account: { token: string; uid: string }) {
  const d = await req('GET', '/auth/me', account.token);
  const a = await req('GET', `/operations/account-activity/${encodeURIComponent(account.uid)}`, adminToken);
  const data = (d.body.data ?? d.body) as Json;
  const activity = (a.body.data ?? a.body.items ?? a.body.activity ?? []) as unknown[];
  return { username: String(data.username || ''), phone: String(data.phone || ''), activity: Array.isArray(activity) ? activity.length : -1 };
}

function auditCount(uid: string): number {
  if (!SERVER_LOG || !existsSync(SERVER_LOG)) return -1;
  return readFileSync(SERVER_LOG, 'utf8')
    .split('\n')
    .filter((l) => l.includes('"AUDIT"') && l.includes('auth.profile_') && l.includes(uid)).length;
}

function unit() {
  for (const ok of ['abc', 'qa.admin_1', 'A1_b.C', 'x'.repeat(30), '  padded_ok  ']) {
    const r = parseAccountUsername(ok);
    mark(`unit: accepts "${ok}"`, r.ok && r.value === ok.trim(), JSON.stringify(r));
  }
  const at = parseAccountUsername('@qa.ok');
  mark('unit: strips one leading @', at.ok && at.value === 'qa.ok', JSON.stringify(at));
  const empty = parseAccountUsername('   ');
  mark('unit: empty clears', empty.ok && empty.value === '', JSON.stringify(empty));
  for (const bad of ['qa admin bad!', 'ab', 'x'.repeat(31), 'naïve', 'a-b', '@@x', 'name@x', 'tab\tname', '用户名']) {
    const r = parseAccountUsername(bad);
    mark(`unit: rejects ${JSON.stringify(bad)}`, !r.ok && Boolean(r.error), JSON.stringify(r));
  }
}

async function api() {
  const admin = await login(process.env.PROBE_ADMIN_EMAIL || 'admin@choosify.com.bd');
  const seller = await login(process.env.PROBE_SELLER_EMAIL || 'seller@choosify.com.bd');
  const creator = await login(process.env.PROBE_CREATOR_EMAIL || 'creator@choosify.com.bd');
  const original = {
    admin: (await accountState(admin.token, admin)).username,
    seller: (await accountState(admin.token, seller)).username,
    creator: (await accountState(admin.token, creator)).username,
  };

  try {
    // Self: valid
    let r = await req('PATCH', '/auth/profile', admin.token, { username: 'qa.admin_1' });
    mark('self valid username saved', r.status === 200 && r.body.data?.username === 'qa.admin_1', JSON.stringify(r));
    r = await req('PATCH', '/auth/profile', admin.token, { username: '@qa.admin_2' });
    mark('self "@name" stored without the @', r.status === 200 && r.body.data?.username === 'qa.admin_2', JSON.stringify(r));

    // Self: invalid — nothing changes, no audit / activity
    const before = await accountState(admin.token, admin);
    const auditBefore = auditCount(admin.uid);
    for (const bad of ['qa admin bad!', 'ab', 'x'.repeat(31), 'a-b']) {
      r = await req('PATCH', '/auth/profile', admin.token, { username: bad });
      mark(`self invalid ${JSON.stringify(bad)} → 400 INVALID_USERNAME`, r.status === 400 && r.body.code === 'INVALID_USERNAME', JSON.stringify(r));
    }
    // Mixed request: a valid phone must not be written when the username is rejected.
    r = await req('PATCH', '/auth/profile', admin.token, { username: 'bad name', phone: '01711000321' });
    mark('mixed valid phone + invalid username → 400', r.status === 400 && r.body.code === 'INVALID_USERNAME', JSON.stringify(r));
    const after = await accountState(admin.token, admin);
    mark('rejected requests left username unchanged', after.username === before.username, `${before.username} -> ${after.username}`);
    mark('rejected requests left phone unchanged', after.phone === before.phone, `${before.phone} -> ${after.phone}`);
    mark('rejected requests added no account activity', after.activity === before.activity, `${before.activity} -> ${after.activity}`);
    if (auditBefore >= 0) {
      await new Promise((res) => setTimeout(res, 500));
      mark('rejected requests wrote no audit event', auditCount(admin.uid) === auditBefore, `${auditBefore} -> ${auditCount(admin.uid)}`);
    } else {
      console.log('SKIP audit-log check (PROBE_SERVER_LOG not set)');
    }

    // Staff on behalf: the same rule applies; valid succeeds.
    const sBefore = await accountState(admin.token, seller);
    r = await req('PATCH', '/auth/profile', admin.token, { userId: seller.uid, username: 'seller bad!' });
    mark('staff-on-behalf invalid → 400 INVALID_USERNAME', r.status === 400 && r.body.code === 'INVALID_USERNAME', JSON.stringify(r));
    r = await req('PATCH', '/auth/profile', admin.token, { userId: seller.uid, username: 'x', adminOverride: true });
    mark('staff adminOverride does not bypass username rule', r.status === 400 && r.body.code === 'INVALID_USERNAME', JSON.stringify(r));
    const sAfter = await accountState(admin.token, seller);
    mark('staff rejection left seller username unchanged', sAfter.username === sBefore.username, `${sBefore.username} -> ${sAfter.username}`);
    mark('staff rejection added no seller activity', sAfter.activity === sBefore.activity, `${sBefore.activity} -> ${sAfter.activity}`);
    r = await req('PATCH', '/auth/profile', admin.token, { userId: seller.uid, username: 'qa_seller.1' });
    mark('staff-on-behalf valid username saved', r.status === 200 && r.body.data?.username === 'qa_seller.1', JSON.stringify(r));

    // A seller cannot change another account (valid or invalid name), and nothing changes.
    const cBefore = await accountState(admin.token, creator);
    r = await req('PATCH', '/auth/profile', seller.token, { userId: creator.uid, username: 'hijack_ok' });
    mark('seller editing another account → 403', r.status === 403, JSON.stringify(r));
    r = await req('PATCH', '/auth/profile', seller.token, { userId: creator.uid, username: 'hijack bad' });
    mark('seller editing another account with invalid name is refused', r.status === 400 || r.status === 403, JSON.stringify(r));
    const cAfter = await accountState(admin.token, creator);
    mark('creator username unchanged by seller attempts', cAfter.username === cBefore.username, `${cBefore.username} -> ${cAfter.username}`);

    // Empty clears (existing contract) — also when sent together with a phone change.
    r = await req('PATCH', '/auth/profile', admin.token, { username: '' });
    mark('empty username clears it', r.status === 200 && (r.body.data?.username || '') === '', JSON.stringify(r));
    await req('PATCH', '/auth/profile', admin.token, { username: 'qa.admin_3' });
    r = await req('PATCH', '/auth/profile', admin.token, { username: '', phone: '01711000654' });
    const me = await req('GET', '/auth/me', admin.token);
    const meData = (me.body.data ?? me.body) as Json;
    mark('clearing username alongside a phone change stays cleared', r.status === 200 && !meData.username && /8801711000654$/.test(String(meData.phone || '')), JSON.stringify(meData).slice(0, 200));
    await req('PATCH', '/auth/profile', admin.token, { phone: null });
  } finally {
    await req('PATCH', '/auth/profile', admin.token, { username: original.admin });
    await req('PATCH', '/auth/profile', admin.token, { userId: seller.uid, username: original.seller });
    await req('PATCH', '/auth/profile', admin.token, { userId: creator.uid, username: original.creator });
  }
}

(async () => {
  unit();
  if (process.env.PROBE_UNIT_ONLY !== '1') await api();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
