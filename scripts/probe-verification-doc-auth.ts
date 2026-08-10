/**
 * Verification Center document auth probe (UI-regression hotfix).
 * Seller/Creator/Consumer must get 403 on approve/reject; replace is owner-only.
 */
import dotenv from 'dotenv';
import { existsSync } from 'fs';

dotenv.config({ path: '.env' });
if (existsSync('.env.local')) dotenv.config({ path: '.env.local', override: true });

const BASE = process.env.PROBE_BASE_URL || 'http://localhost:3001/api/v1';
const PASS = process.env.DEV_SEED_PASSWORD || 'DevPass123!';

async function login(email: string) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASS }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`login ${email}: ${res.status} ${JSON.stringify(json)}`);
  return json.data?.token || json.token || json.accessToken;
}

async function main() {
  const results: string[] = [];
  const pass = (n: string) => results.push(`PASS ${n}`);
  const fail = (n: string, d: string) => {
    results.push(`FAIL ${n}: ${d}`);
  };

  // Unauthenticated approve
  {
    const res = await fetch(`${BASE}/operations/verifications/does-not-exist/document/doc1`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved' }),
    });
    if (res.status === 401) pass('unauth approve → 401');
    else fail('unauth approve → 401', `got ${res.status}`);
  }

  const adminToken = await login('admin@choosify.local').catch(() => login('admin@choosify.com'));
  const sellerToken = await login('seller@choosify.local').catch(() => login('seller@choosify.com'));
  const creatorToken = await login('creator@choosify.local').catch(() => login('creator@choosify.com'));

  // List verifications as admin to find a real id
  const listRes = await fetch(`${BASE}/operations/verifications`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const listJson = await listRes.json().catch(() => ({}));
  const rows = listJson.data || listJson.items || [];
  const row = Array.isArray(rows) ? rows.find((r: any) => (r.documents || []).length) || rows[0] : null;
  if (!row?.id) {
    console.log(results.join('\n'));
    console.log('SKIP rest: no verification rows available');
    process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
  }
  const docId = (row.documents || [])[0]?.id || 'doc-1';
  const vId = row.id;
  const ownerId = row.submitted_by;

  // Seller self-approval
  {
    const res = await fetch(`${BASE}/operations/verifications/${vId}/document/${docId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${sellerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'approved' }),
    });
    if (res.status === 403) pass('seller approve → 403');
    else fail('seller approve → 403', `got ${res.status}`);
  }

  // Creator self-approval
  {
    const res = await fetch(`${BASE}/operations/verifications/${vId}/document/${docId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${creatorToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'rejected', notes: 'nope' }),
    });
    if (res.status === 403) pass('creator reject → 403');
    else fail('creator reject → 403', `got ${res.status}`);
  }

  // Cross-user replace (seller on someone else's verification when not owner)
  {
    const res = await fetch(`${BASE}/operations/verifications/${vId}/document/${docId}/replace`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${sellerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ doc_url: 'https://example.com/x.pdf' }),
    });
    // If seller owns it, 200/400; if not, 403
    const meRes = await fetch(`${BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${sellerToken}` },
    });
    const me = await meRes.json().catch(() => ({}));
    const sellerId = me.data?.id || me.user?.id || me.id;
    if (ownerId && sellerId && ownerId === sellerId) {
      if (res.status === 200 || res.status === 400) pass(`owner replace allowed (${res.status}) owner=${ownerId}`);
      else fail('owner replace', `got ${res.status}`);
    } else if (res.status === 403) {
      pass('cross-user replace → 403');
    } else {
      fail('cross-user replace → 403', `got ${res.status} owner=${ownerId} seller=${sellerId}`);
    }
  }

  // Admin approve path still authorized (may 404 if doc missing — but not 403)
  {
    const res = await fetch(`${BASE}/operations/verifications/${vId}/document/${docId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'approved', notes: 'probe' }),
    });
    if (res.status !== 403 && res.status !== 401) pass(`admin approve authorized (${res.status})`);
    else fail('admin approve authorized', `got ${res.status}`);
  }

  console.log(results.join('\n'));
  if (results.some((r) => r.startsWith('FAIL'))) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
