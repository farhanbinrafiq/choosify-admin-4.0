/**
 * Admin Message Center — CRM / Support Desk lifecycle + security.
 *
 * Parts C / D / F: persisted status, priority, assignment, department,
 * internal notes (staff-only), follow-up + lazy sweep, auto-reopen on user
 * reply, CFID search no-duplication, and role isolation of all CRM metadata.
 *
 * Usage: npx tsx scripts/probe-admin-crm-lifecycle.ts
 */
const BASE = process.env.PROBE_BASE_URL_ROOT || 'http://localhost:3001';
const API = `${BASE}/api/v1`;
const DEV_PASS = process.env.DEV_SEED_PASSWORD || 'ChoosifyDev!2026';
const ADMIN_EMAIL = 'admin@choosify.com.bd';
const SUPPORT_EMAIL = 'support@choosify.com.bd';
const SELLER_EMAIL = 'seller@choosify.com.bd';

const PASS: string[] = [];
const FAIL: string[] = [];
function check(c: unknown, label: string, detail?: unknown) {
  (c ? PASS : FAIL).push(label);
  console.log(c ? 'PASS' : 'FAIL', label, c ? '' : JSON.stringify(detail ?? '').slice(0, 300));
}
async function jsonOf(r: Response) {
  const t = await r.text();
  try {
    return t ? JSON.parse(t) : {};
  } catch {
    return { _raw: t };
  }
}
async function api(path: string, init?: RequestInit, token?: string) {
  const r = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
  });
  return { status: r.status, body: await jsonOf(r) };
}
async function login(email: string, password = DEV_PASS) {
  const r = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  return { token: r.body.accessToken || r.body.token || r.body.data?.accessToken || '', uid: r.body.uid || r.body.data?.uid || '' };
}
async function registerConsumer(tag: string) {
  const email = `crm.${tag}.${Date.now()}@buyer.choosify`;
  const password = 'CrmProbe!2026';
  const reg = await api('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, fullName: `CRM Probe ${tag}` }),
  });
  return { email, password, uid: reg.body.uid || reg.body.data?.uid };
}
async function dbVerifyEmail(email: string) {
  const { db } = await import('../server/db/client');
  const { users } = await import('../server/db/schema');
  const { eq } = await import('drizzle-orm');
  await db.update(users).set({ emailVerified: true, updatedAt: new Date() }).where(eq(users.email, email.toLowerCase()));
}

async function main() {
  const admin = await login(ADMIN_EMAIL);
  const support = await login(SUPPORT_EMAIL);
  const seller = await login(SELLER_EMAIL);
  check(!!admin.token && !!support.token, 'seed logins (admin + support)');

  // ── Consumer opens a support ticket ────────────────────────────────
  const cons = await registerConsumer('c1');
  await dbVerifyEmail(cons.email);
  const consTok = (await login(cons.email, cons.password)).token;
  const ensure = await api(
    '/support/conversations/ensure',
    { method: 'POST', body: JSON.stringify({ subject: 'Order help', body: 'My order has not arrived.' }) },
    consTok,
  );
  const convId: string = ensure.body?.data?.conversation?.id || ensure.body?.conversation?.id || ensure.body?.data?.conversationId;
  check(!!convId, 'consumer opens a support conversation', ensure.body);
  if (!convId) return finish();

  // ── Admin sees it in the Support Desk with a snapshot ──────────────
  const inbox1 = await api('/admin/support/conversations', {}, admin.token);
  const row = (inbox1.body?.data || []).find((r: Record<string, unknown>) => (r.conversation as { id: string }).id === convId);
  check(!!row, 'admin: ticket appears in the Support Desk');
  check(row?.opener?.email === cons.email.toLowerCase(), 'admin: snapshot shows the canonical email', row?.opener);
  check(!!row?.opener?.memberSince && typeof row?.opener?.totalOrders === 'number', 'admin: snapshot has memberSince + totalOrders');
  check((row?.status || row?.ticket?.status) === 'open', 'ticket starts as open', row?.status);

  // ── Status → In Progress, Priority → High ──────────────────────────
  const st1 = await api(`/admin/support/conversations/${convId}`, { method: 'PATCH', body: JSON.stringify({ status: 'in_progress' }) }, admin.token);
  check(st1.status === 200 && st1.body?.data?.status === 'in_progress', 'admin: status → in_progress persists', st1.body);
  const pr1 = await api(`/admin/support/conversations/${convId}`, { method: 'PATCH', body: JSON.stringify({ priority: 'high' }) }, admin.token);
  check(pr1.status === 200 && pr1.body?.data?.priority === 'high', 'admin: priority → high persists', pr1.body);

  // ── Internal note (staff-only) ────────────────────────────────────
  const note = await api(`/admin/support/conversations/${convId}/notes`, { method: 'POST', body: JSON.stringify({ body: 'Contacted courier, ETA tomorrow.' }) }, admin.token);
  check(note.status === 201 && note.body?.data?.body?.includes('courier'), 'admin: internal note created', note.body);
  const notesList = await api(`/admin/support/conversations/${convId}/notes`, {}, support.token);
  check(notesList.status === 200 && (notesList.body?.data || []).length >= 1, 'support-agent: can read internal notes');
  const consNotes = await api(`/admin/support/conversations/${convId}/notes`, {}, consTok);
  check(consNotes.status === 403, 'SECURITY: consumer CANNOT read internal notes (403)', consNotes.status);
  const consPatch = await api(`/admin/support/conversations/${convId}`, { method: 'PATCH', body: JSON.stringify({ status: 'resolved', priority: 'low' }) }, consTok);
  check(consPatch.status === 403, 'SECURITY: consumer CANNOT mutate ticket status/priority (403)', consPatch.status);
  const sellerPatch = await api(`/admin/support/conversations/${convId}`, { method: 'PATCH', body: JSON.stringify({ status: 'closed' }) }, seller.token);
  check(sellerPatch.status === 403, 'SECURITY: an unrelated Seller CANNOT mutate this ticket (403)', sellerPatch.status);

  // ── Assignment ───────────────────────────────────────────────────
  const asg = await api(`/admin/support/conversations/${convId}`, { method: 'PATCH', body: JSON.stringify({ assigneeId: support.uid }) }, admin.token);
  check(asg.status === 200 && asg.body?.data?.assigneeId === support.uid, 'admin: assign to a real staff account persists', asg.body);
  const badAsg = await api(`/admin/support/conversations/${convId}`, { method: 'PATCH', body: JSON.stringify({ assigneeId: cons.uid }) }, admin.token);
  check(badAsg.status === 400, 'admin: cannot assign to a non-staff account (400)', badAsg.status);
  const dep = await api(`/admin/support/conversations/${convId}`, { method: 'PATCH', body: JSON.stringify({ department: 'seller_operations' }) }, admin.token);
  check(dep.status === 200 && dep.body?.data?.department === 'seller_operations', 'admin: department persists', dep.body);

  // ── Follow-up + lazy sweep ───────────────────────────────────────
  const past = new Date(Date.now() - 60_000).toISOString();
  const fu = await api(`/admin/support/conversations/${convId}/followups`, { method: 'POST', body: JSON.stringify({ dueAt: past }) }, admin.token);
  check(fu.status === 201 && fu.body?.data?.status === 'scheduled', 'admin: follow-up scheduled', fu.body);
  const afterSchedule = await api(`/admin/support/conversations/${convId}`, { method: 'PATCH', body: JSON.stringify({}) }, admin.token);
  check(afterSchedule.body?.data?.status === 'need_followup', 'scheduling a follow-up moves the ticket to need_followup', afterSchedule.body?.data?.status);
  // list inbox → triggers the sweep (dueAt is in the past)
  await api('/admin/support/conversations', {}, admin.token);
  const fuAfter = await api(`/admin/support/conversations/${convId}/followups`, {}, admin.token);
  const fired = (fuAfter.body?.data || []).find((f: Record<string, unknown>) => f.id === fu.body?.data?.id);
  check(fired?.status === 'fired', 'lazy sweep fires the due follow-up exactly once (idempotent)', fired);
  // second sweep does not re-fire
  await api('/admin/support/conversations', {}, admin.token);
  const fuAgain = await api(`/admin/support/conversations/${convId}/followups`, {}, admin.token);
  check(
    (fuAgain.body?.data || []).filter((f: Record<string, unknown>) => f.status === 'fired').length === 1,
    'lazy sweep is idempotent across repeated runs',
  );

  // ── A future follow-up is auto-cancelled when the user replies ─────
  await api(`/admin/support/conversations/${convId}`, { method: 'PATCH', body: JSON.stringify({ status: 'in_progress' }) }, admin.token);
  const futureFu = await api(`/admin/support/conversations/${convId}/followups`, { method: 'POST', body: JSON.stringify({ dueAt: new Date(Date.now() + 3 * 864e5).toISOString() }) }, admin.token);
  await api(`/support/conversations/${convId}/messages`, { method: 'POST', body: JSON.stringify({ body: 'Any update?' }) }, consTok);
  const fuList3 = await api(`/admin/support/conversations/${convId}/followups`, {}, admin.token);
  const cancelled = (fuList3.body?.data || []).find((f: Record<string, unknown>) => f.id === futureFu.body?.data?.id);
  check(cancelled?.status === 'cancelled' && cancelled?.cancelReason === 'reply', 'user reply auto-cancels the scheduled follow-up (reason: reply)', cancelled);

  // ── Resolve → user reply auto-reopens (open + reopenedAt) ─────────
  await api(`/admin/support/conversations/${convId}`, { method: 'PATCH', body: JSON.stringify({ status: 'resolved' }) }, admin.token);
  await api(`/support/conversations/${convId}/messages`, { method: 'POST', body: JSON.stringify({ body: 'Still not here!' }) }, consTok);
  const reopened = await api(`/admin/support/conversations/${convId}`, { method: 'PATCH', body: JSON.stringify({}) }, admin.token);
  check(reopened.body?.data?.status === 'open' && !!reopened.body?.data?.reopenedAt, 'user reply after resolution auto-reopens the ticket (open + reopenedAt)', reopened.body?.data);
  const notesAfter = await api(`/admin/support/conversations/${convId}/notes`, {}, admin.token);
  check((notesAfter.body?.data || []).length >= 1, 'internal note history survives resolve→reopen');

  // ── CFID search resolves the SAME conversation (no duplicate) ────
  const searchRes = await fetch(
    `${API}/operations/users?context=messaging&q=${encodeURIComponent(row?.opener?.choosifyUserId || cons.email)}`,
    { headers: { Authorization: `Bearer ${admin.token}` } },
  );
  const sBody = await jsonOf(searchRes);
  const hit = (sBody.data || []).find((u: Record<string, unknown>) => u.id === cons.uid);
  check(!!hit, 'admin: CFID/identity search finds the user');
  const reopen2 = await api('/admin/support/conversations', { method: 'POST', body: JSON.stringify({ targetUserId: cons.uid }) }, admin.token);
  check(
    reopen2.body?.data?.conversation?.id === convId && reopen2.body?.data?.created === false,
    'admin: starting support for the same user reuses the existing conversation (no duplicate)',
    { got: reopen2.body?.data?.conversation?.id, want: convId, created: reopen2.body?.data?.created },
  );

  finish();
}

function finish() {
  console.log(`\n=== ${PASS.length} passed, ${FAIL.length} failed ===`);
  if (FAIL.length) {
    for (const f of FAIL) console.log(' -', f);
    process.exit(1);
  }
  console.log('ALL ADMIN CRM LIFECYCLE CHECKS PASSED');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
